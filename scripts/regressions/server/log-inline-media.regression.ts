// Server log inline media: debug lines print base64 images, PDFs and audio as a short marker (type, size, the two
// ends of the encoded text) instead of several MB of base64, for data URLs, the Anthropic and Google base64 parts and
// plain %s / %j lines. The payload being logged is never changed, and LOG_INLINE_MEDIA=full prints it whole again.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const { inlineMediaMarker, messageTextWithImagesForLog } =
  await import("../../../packages/server/src/lib/log-redaction.js");

const base64 = `iVBORw0KGgo${"A".repeat(40_000)}ElFTkSuQmCC`;
assert.equal(inlineMediaMarker("image/png", base64), "[image/png base64, ~29 KB: iVBORw0KGgoAAAAA...AAAAAElFTkSuQmCC]");
assert.equal(
  inlineMediaMarker("application/pdf", "A".repeat(4_000_000)),
  `[application/pdf base64, ~2.9 MB: ${"A".repeat(16)}...${"A".repeat(16)}]`,
);

// The real logger, in a child process with JSON output, so pino's own %s / %j substitution and serializers run.
const repoRoot = resolve(import.meta.dirname, "../../..");
const dir = mkdtempSync(join(tmpdir(), "marinara-log-inline-media-"));
const script = join(dir, "log.mts");
writeFileSync(
  script,
  `import assert from "node:assert/strict";
const { logger, debugJson } = await import(${JSON.stringify(pathToFileURL(join(repoRoot, "packages/server/src/lib/logger.ts")).href)});
const base64 = ${JSON.stringify(base64)};
const dataUrl = "data:image/png;base64," + base64;
// MIME-style: wrapped at 76 columns with CRLF, ending in padding.
const folded = (base64 + "==").match(/.{1,76}/g).join("\\r\\n");
const payloads = {
  mari: [{ role: "user", content: "Look at this", images: [dataUrl] }],
  openai: { messages: [{ role: "user", content: [{ type: "text", text: "hi" }, { type: "image_url", image_url: { url: dataUrl } }] }] },
  anthropic: { messages: [{ role: "user", content: [{ type: "image", source: { type: "base64", media_type: "image/jpeg", data: base64 } }] }] },
  google: { contents: [{ parts: [{ inline_data: { mime_type: "image/webp", data: base64 } }] }] },
  embedded: { role: "tool", content: "Saved as " + dataUrl + " for later" },
  untyped: { url: "data:;base64," + base64 },
  small: { url: "data:image/png;base64,AAAA" },
  foldedText: { content: "Before\\r\\ndata:image/png;base64," + folded + "\\r\\nThanks for reading" },
  foldedAnthropic: { source: { type: "base64", media_type: "image/png", data: folded } },
  foldedGoogle: { inline_data: { mime_type: "image/png", data: folded } },
  shortRunThenWord: { content: "data:image/png;base64," + base64 + "\\nNext" },
};
const before = structuredClone(payloads);
for (const [name, payload] of Object.entries(payloads)) logger.debug("payload %s:\\n%s", name, debugJson(payload));
logger.debug("replacer:\\n%s", debugJson({ apiKey: "keep-out", url: dataUrl }, (key, value) => (key === "apiKey" ? "[r]" : value)));
logger.debug("raw text %s", dataUrl);
logger.debug("raw json %j", { url: dataUrl });
logger.debug("raw untyped %s", "data:;base64," + base64);
logger.debug("raw folded %s", "data:image/png;base64," + folded + "\\r\\nThanks for reading");
logger.debug("raw folded json %j", { url: "data:image/png;base64," + folded, note: "kept" });
assert.deepEqual(payloads, before);
// pino writes to a pipe asynchronously; without a flush a Linux pipe can cut the last long line at exit.
await new Promise((done) => logger.flush(() => done(undefined)));
console.log("PAYLOADS_UNCHANGED");
`,
);
const require = createRequire(join(repoRoot, "packages/server/package.json"));
function run(inlineMedia?: string) {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    LOG_FORMAT: "json",
    LOG_LEVEL: "debug",
    NODE_ENV: "production",
    DATA_DIR: dir,
  };
  delete env.LOG_INLINE_MEDIA;
  if (inlineMedia) env.LOG_INLINE_MEDIA = inlineMedia;
  const result = spawnSync(process.execPath, [require.resolve("tsx/cli"), script], {
    env,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.stdout.includes("PAYLOADS_UNCHANGED"), "the logged payloads were changed");
  const lines = result.stdout
    .split("\n")
    .filter((line) => line.startsWith("{"))
    .map((line) => {
      try {
        return JSON.parse(line) as { msg?: string };
      } catch {
        assert.fail(`unparsable log line (${line.length} chars): ${line.slice(0, 120)}...${line.slice(-120)}`);
      }
    });
  const msg = (prefix: string) => {
    const line = lines.find((entry) => entry.msg?.startsWith(prefix));
    assert.ok(line?.msg, `no line starting with ${prefix}`);
    return line.msg;
  };
  return { output: result.stdout, msg };
}

const edges = "iVBORw0KGgoAAAAA...AAAAAElFTkSuQmCC]";
const short = run();
// Folded lines are 76 characters, so a shorter run is the tell.
assert.ok(!short.output.includes("A".repeat(50)), "a base64 run reached the log");
const foldedMarker = "[image/png base64, ~29 KB: iVBORw0KGgoAAAAA...AAAElFTkSuQmCC==]";
assert.ok(short.msg("payload foldedText").includes(`Before\r\n${foldedMarker}\r\nThanks for reading`));
assert.ok(short.msg("payload foldedAnthropic").includes(`"data": "${foldedMarker}"`));
assert.ok(short.msg("payload foldedGoogle").includes(`"data": "${foldedMarker}"`));
assert.ok(short.msg("payload shortRunThenWord").includes(`${edges}\nNext`), "a word after a compact payload stays");
assert.equal(short.msg("raw folded "), `raw folded ${foldedMarker}\r\nThanks for reading`);
assert.ok(short.msg("raw folded json").includes(`"url":"${foldedMarker}","note":"kept"`));
assert.ok(short.msg("payload mari").includes(`"[image/png base64, ~29 KB: ${edges}"`));
assert.ok(short.msg("payload openai").includes(`"url": "[image/png base64, ~29 KB: ${edges}"`));
assert.ok(short.msg("payload anthropic").includes(`"data": "[image/jpeg base64, ~29 KB: ${edges}"`));
assert.ok(short.msg("payload anthropic").includes(`"media_type": "image/jpeg"`));
assert.ok(short.msg("payload google").includes(`"data": "[image/webp base64, ~29 KB: ${edges}"`));
assert.ok(short.msg("payload embedded").includes(`Saved as [image/png base64, ~29 KB: ${edges} for later`));
assert.ok(short.msg("payload small").includes(`"data:image/png;base64,AAAA"`), "a short data URL should stay whole");
assert.ok(short.msg("replacer").includes(`"apiKey": "[r]"`), "the caller's replacer still runs");
assert.ok(short.msg("replacer").includes(`[image/png base64, ~29 KB: ${edges}`));
assert.equal(short.msg("raw text"), `raw text [image/png base64, ~29 KB: ${edges}`);
assert.ok(short.msg("raw json").includes(`[image/png base64, ~29 KB: ${edges}`));
assert.ok(short.msg("payload untyped").includes(`"url": "[text/plain base64, ~29 KB: ${edges}"`));
assert.equal(short.msg("raw untyped"), `raw untyped [text/plain base64, ~29 KB: ${edges}`);

const full = run("full");
assert.ok(full.msg("payload mari").includes(base64), "LOG_INLINE_MEDIA=full keeps the data URL whole");
assert.ok(full.msg("payload google").includes(base64), "LOG_INLINE_MEDIA=full keeps bare base64 whole");
assert.ok(full.msg("raw text").includes(base64));

// A prompt printed as text still shows the pictures attached to its messages (the Illustrator writer's references).
assert.equal(messageTextWithImagesForLog("Draw Raven.", undefined), "Draw Raven.");
assert.equal(
  messageTextWithImagesForLog("Draw Raven.", [`data:image/png;base64,${base64}`]),
  "Draw Raven.\n[attached picture 1: [image/png base64, ~29 KB: iVBORw0KGgoAAAAA...AAAAAElFTkSuQmCC]]",
);

console.log("Log inline media regression passed.");
