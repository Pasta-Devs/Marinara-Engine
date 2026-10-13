// Experience files (Capability API 1.382): a data-only Experience as one plain JSON file, read as a stream,
// reviewed from its start alone, and imported only when every file matches its manifest.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-experience-file-"));
process.env.DATA_DIR = dataDir;
const packagesRoot = join(dataDir, "capability-packages");

const {
  EXPERIENCE_FILE_HEADER_MAX_BYTES,
  ExperienceFileError,
  ExperienceFileReader,
  experienceFileParts,
  experienceFileType,
  readExperienceFileManifest,
} = await import("../../packages/shared/src/features/world/experience-file.js");
const { capabilityPackageManifestSchema } = await import(
  "../../packages/shared/src/schemas/capability-package.schema.js"
);
const { capabilityPackageManager } = await import(
  "../../packages/server/src/services/capability-packages/package-manager.service.js"
);

const encoder = new TextEncoder();
const sha256 = (data: Uint8Array) => createHash("sha256").update(data).digest("hex");

function experience(
  files: Array<{ path: string; data: Uint8Array }>,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    schemaVersion: 2,
    id: "held-autumn-test",
    name: "Held Autumn (test)",
    version: "1.0.0",
    description: "An Experience file fixture.",
    capabilityApi: { major: 1, minor: 382 },
    builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
    engine: { min: "2.3.0", maxExclusive: "4.0.0" },
    kind: ["experience"],
    entrypoints: {},
    contributions: {
      slots: ["game-surface"],
      gameSurface: { setup: {} },
      assets: { paths: files.map((file) => file.path) },
    },
    files: files.map((file) => ({ path: file.path, sha256: sha256(file.data), bytes: file.data.byteLength })),
    permissions: [],
    ...overrides,
  };
}

const picture = Uint8Array.from({ length: 70_000 }, (_, index) => (index * 31 + 7) % 256);
const music = Uint8Array.from({ length: 200_001 }, (_, index) => (index * 17) % 251);
const data = encoder.encode(JSON.stringify({ hello: "world" }));
const files = [
  { path: "art/portrait.png", data: picture },
  { path: "music/theme.ogg", data: music },
  { path: "worlds/vale.json", data },
];

/** The file as bytes, handed over in uneven chunks the way a network delivers it. */
async function* stream(text: string, size = 1_337): AsyncGenerator<Uint8Array> {
  const bytes = encoder.encode(text);
  for (let at = 0; at < bytes.length; at += size) yield bytes.subarray(at, at + size);
}

const fileText = (manifest: unknown, parts = files) => experienceFileParts(manifest, parts).join("");

// ── The schema: a data-only Experience carries nothing that runs ──
{
  const parsed = capabilityPackageManifestSchema.safeParse(experience(files));
  assert.ok(parsed.success, "A data-only Experience needs no client entrypoint for its game surface");
  const refuse = (overrides: Record<string, unknown>, pattern: RegExp) => {
    const result = capabilityPackageManifestSchema.safeParse(experience(files, overrides));
    assert.equal(result.success, false);
    assert.match(result.error!.issues.map((issue) => issue.message).join("\n"), pattern);
  };
  refuse({ entrypoints: { client: "client.js" } }, /carries no code/);
  refuse({ permissions: ["ui"] }, /no permissions/);
  refuse({ kind: ["experience", "agent"] }, /nothing else/);
  refuse({ capabilityApi: { major: 1, minor: 381 } }, /1\.382 or newer/);
  refuse(
    { files: [{ path: "client.js", sha256: "0".repeat(64), bytes: 1 }] },
    /client\.js is not a picture, music or data file/,
  );
  refuse({ contributions: { slots: ["game-surface", "home-widget"] } }, /"game-surface" slot and nothing else/);
  // Any other game surface still needs a client to draw it.
  const drawn = capabilityPackageManifestSchema.safeParse(experience(files, { kind: ["agent"] }));
  assert.equal(drawn.success, false);
  assert.match(drawn.error!.issues.map((issue) => issue.message).join("\n"), /must provide a client entrypoint/);
  assert.equal(experienceFileType("a/b.PNG"), "image");
  assert.equal(experienceFileType("a/b.js"), null);
  assert.equal(experienceFileType("a/b.svg"), null);
}

// ── The review: the manifest from the start of the file alone, with its size by type ──
{
  const text = fileText(experience(files));
  const reader = new ExperienceFileReader();
  const head = encoder.encode(text).subarray(0, text.indexOf('\n"files"') + 1);
  const manifestEvent = reader.push(head).find((event) => event.type === "manifest");
  assert.ok(manifestEvent && manifestEvent.type === "manifest", "The manifest reads before any file does");
  const read = readExperienceFileManifest(manifestEvent.manifest);
  assert.ok(read.ok);
  assert.equal(read.summary.contentBytes, picture.length + music.length + data.length);
  assert.deepEqual(read.summary.byType.image, { files: 1, bytes: picture.length });
  assert.deepEqual(read.summary.byType.audio, { files: 1, bytes: music.length });
  assert.deepEqual(read.summary.byType.data, { files: 1, bytes: data.length });
  const agent = readExperienceFileManifest({ ...experience(files), kind: ["agent"], entrypoints: { client: "c.js" } });
  assert.equal(agent.ok, false, "Only an Experience package can come as an Experience file");
  // Whitespace cannot stand in for a manifest forever.
  assert.throws(
    () =>
      new ExperienceFileReader().push(
        encoder.encode(
          `{"format":"marinara-experience","version":1,"manifest":${" ".repeat(EXPERIENCE_FILE_HEADER_MAX_BYTES)}`,
        ),
      ),
    ExperienceFileError,
  );
}

// ── The reader, byte by byte: what it refuses ──
for (const [text, pattern] of [
  ['{"format":"marinara-experience","version":2,"manifest":{},"files":{}}', /version 2/],
  ['{"format":"marinara-experience","version":01,"manifest":{},"files":{}}', /version 01/],
  ['PK\u0003\u0004', /not an Experience file/],
  ['{"format":"marinara-experience","version":1,"manifest":{},"files":{"a":"QUJD","a":"QUJD"}}', /twice/],
  ['{"format":"marinara-experience","version":1,"manifest":{},"files":{"a":"QU\nJD"}}', /not base64/],
  ['{"format":"marinara-experience","version":1,"manifest":{},"files":{"a\\u0062":"QUJD"}}', /does not read/],
  ['{"format":"marinara-experience","version":1,"manifest":{},"files":{"a":"QUJD",}}', /do not read/],
  ['{"format":"marinara-experience","version":1,"manifest":{},"files":{"a":"QUJD"}}{}', /past its end/],
  ['{"format":"marinara-experience","version":1,"manifest":{},"files":{"a":"QQ==QUJD"}}', /not base64/],
] as const) {
  assert.throws(
    () => {
      const reader = new ExperienceFileReader();
      reader.push(encoder.encode(text));
      reader.finish();
    },
    pattern,
    text,
  );
}
assert.throws(() => {
  const reader = new ExperienceFileReader();
  reader.push(encoder.encode('{"format":"marinara-experience","version":1,"manifest":{},"files":{"a":"QUJD"'));
  reader.finish();
}, /stops before its end/);

// ── The import: installed as it streams, every file checked ──
const leftovers = () =>
  existsSync(packagesRoot) ? readdirSync(packagesRoot).filter((name) => name.startsWith(".import-")) : [];
{
  const installed = await capabilityPackageManager.installExperienceFile(stream(fileText(experience(files))));
  assert.equal(installed.id, "held-autumn-test");
  assert.equal(installed.status, "active");
  assert.equal(installed.readiness, "ready");
  const root = join(packagesRoot, "versions", "held-autumn-test", "1.0.0");
  for (const file of files) assert.deepEqual(new Uint8Array(readFileSync(join(root, file.path))), file.data);
  assert.equal(JSON.parse(readFileSync(join(root, "manifest.json"), "utf8")).id, "held-autumn-test");
  const listed = await capabilityPackageManager.installed();
  assert.ok(listed.some((item) => item.id === "held-autumn-test" && item.manifest.kind[0] === "experience"));
  // Its files are served as any package's are.
  const served = await capabilityPackageManager.packageAsset("held-autumn-test", "art/portrait.png");
  assert.deepEqual(new Uint8Array(served!.data), picture);
  assert.deepEqual(leftovers(), []);
}

const refuseImport = async (text: string, pattern: RegExp, message: string) => {
  await assert.rejects(capabilityPackageManager.installExperienceFile(stream(text)), pattern, message);
  assert.deepEqual(leftovers(), [], `${message}: nothing it wrote is left behind`);
};
{
  const tampered = experienceFileParts(experience(files, { version: "1.0.1" }), [
    files[0]!,
    { path: "music/theme.ogg", data: music.map((byte, index) => (index === 1000 ? byte ^ 1 : byte)) },
    files[2]!,
  ]).join("");
  await refuseImport(tampered, /does not match its manifest's checksum/, "A changed byte");
  await refuseImport(
    fileText(experience(files, { version: "1.0.1" }), [...files, { path: "extra.json", data }]),
    /which its manifest does not list/,
    "An undeclared file",
  );
  await refuseImport(
    fileText(experience(files, { version: "1.0.1" }), files.slice(0, 2)),
    /missing worlds\/vale\.json/,
    "A missing file",
  );
  await refuseImport(
    fileText(experience(files, { version: "1.0.1" }), [
      files[0]!,
      { path: "music/theme.ogg", data: music.subarray(0, 100) },
      files[2]!,
    ]),
    /not the size its manifest says/,
    "A short file",
  );
  await refuseImport(
    fileText(experience(files, { version: "1.0.1" }), [
      files[0]!,
      { path: "music/theme.ogg", data: new Uint8Array(music.length + 5) },
      files[2]!,
    ]),
    /larger than its manifest says/,
    "A long file",
  );
  await refuseImport(fileText(experience(files, { version: "0.9.0" })), /refusing to downgrade/, "An older version");
  const withPath = (path: string) => {
    const manifest = experience([{ path, data }]);
    return fileText({ ...manifest, version: "1.0.1" }, [{ path, data }]);
  };
  await refuseImport(withPath("../escape.json"), /unsafe path/, "A path out of the package");
  await refuseImport(withPath("run.js"), /run\.js is not a picture, music or data file/, "A script");
  await refuseImport(
    fileText({ ...experience(files), kind: ["agent"], entrypoints: { client: "client.js" } }),
    /holds an Experience package only/,
    "A package with code",
  );
  const truncated = fileText(experience(files, { version: "1.0.1" }));
  await refuseImport(truncated.slice(0, truncated.length - 1000), /stops before its end/, "A cut-off file");
  // Nothing refused changed what was installed.
  const listed = await capabilityPackageManager.installed();
  assert.equal(listed.find((item) => item.id === "held-autumn-test")?.version, "1.0.0");
}

// A newer version replaces the old, as a catalog update would.
{
  const installed = await capabilityPackageManager.installExperienceFile(
    stream(fileText(experience(files, { version: "1.1.0" })), 65_536),
  );
  assert.equal(installed.version, "1.1.0");
  assert.equal(installed.previousVersion, "1.0.0");
}

console.log("experience-file-import: ok");
