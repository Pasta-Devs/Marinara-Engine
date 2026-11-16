// #9329: Professor Mari's `mari images` command. The images it makes must load from the URL it hands her (they have no
// gallery row, only a manifest entry), and her prompt goes to the image model as written unless she asks for a style
// profile, in which case the result shows what the profile added.
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = mkdtempSync(join(tmpdir(), "marinara-mari-images-cli-"));
const originalEnv = { DATA_DIR: process.env.DATA_DIR, FILE_STORAGE_DIR: process.env.FILE_STORAGE_DIR };
process.env.DATA_DIR = root;
process.env.FILE_STORAGE_DIR = join(root, "storage");
process.env.LOG_LEVEL = "silent";
const skillsDir = join(import.meta.dirname, "../../../packages/server/src/assets/mari-skills");

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

// A local AUTOMATIC1111 stand-in that records what Marinara sent it.
const sent: Array<{ prompt?: string; negative_prompt?: string }> = [];
const imageServer = createServer((request, response) => {
  let body = "";
  request.on("data", (chunk) => (body += chunk));
  request.on("end", () => {
    if (body) sent.push(JSON.parse(body) as { prompt?: string; negative_prompt?: string });
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({ images: [PNG.toString("base64")] }));
  });
});
await new Promise<void>((resolve) => imageServer.listen(0, "127.0.0.1", resolve));
const imageBaseUrl = `http://127.0.0.1:${(imageServer.address() as AddressInfo).port}`;

const requireServer = createRequire(new URL("../../../packages/server/package.json", import.meta.url));
const Fastify = requireServer("fastify");
const { getDB } = await import("../../../packages/server/src/db/connection.js");
const { galleryRoutes } = await import("../../../packages/server/src/routes/gallery.routes.js");
const { getMariDbService } = await import("../../../packages/server/src/services/mari-db/mari-db.service.js");
const { MARI_SYSTEM_PROMPT } =
  await import("../../../packages/server/src/services/professor-mari/workspace-agent.service.js");
const { createConnectionsStorage } =
  await import("../../../packages/server/src/services/storage/connections.storage.js");
const { createAppSettingsStorage } =
  await import("../../../packages/server/src/services/storage/app-settings.storage.js");
const { createConnectionSchema } = await import("../../../packages/shared/dist/index.js");

const db = await getDB();
const app = Fastify();
app.decorate("db", db);
await app.register(galleryRoutes, { prefix: "/api/gallery" });

try {
  const mari = getMariDbService(db);
  const images = async (...args: string[]) => {
    const result = await mari.executeCli({ argv: ["images", ...args], sessionId: "mari-images-cli" });
    assert.equal(result.ok, true, `mari images ${args.join(" ")}\n${JSON.stringify(result)}`);
    return result.output as Record<string, unknown>;
  };
  const refused = async (...args: string[]) => {
    const result = await mari.executeCli({ argv: ["images", ...args], sessionId: "mari-images-cli" });
    assert.equal(result.ok, false, `mari images ${args.join(" ")} is refused`);
    return JSON.stringify(result);
  };
  // A default house profile with Avatar per-image tags, like the one that leaked into Ylli's run.
  const longTags = Array.from({ length: 40 }, (_, index) => `house tag ${index}`).join(", ");
  await createAppSettingsStorage(db).set(
    "ui",
    JSON.stringify({
      imageStyleProfiles: {
        defaultProfileId: "house",
        profiles: [
          {
            id: "house",
            name: "House",
            baseStyle: "custom",
            promptMode: "hybrid",
            styleText: "",
            positiveTags: `house style, ${longTags}`,
            negativeTags: "blurry",
            subjectTags: { avatar: "portrait, upper body, dynamic pose" },
            rules: { dedupeStrength: "normal", preferTagsOverNarrative: false, preserveUserPhrases: true },
            builtIn: false,
          },
        ],
      },
    }),
  );
  // The connection has Local image defaults with a prompt and negative prefix, which the A1111 call adds too.
  const connections = createConnectionsStorage(db);
  const connection = (await connections.create(
    createConnectionSchema.parse({
      name: "Local A1111",
      provider: "image_generation",
      baseUrl: imageBaseUrl,
      imageService: "automatic1111",
    }),
  ))!;
  await connections.updateDefaultParameters(connection.id, {
    imageGeneration: {
      version: 1,
      service: "automatic1111",
      automatic1111: { promptPrefix: "connection prefix tag", negativePromptPrefix: "connection negative tag" },
    },
  });
  type Style = {
    mode: string;
    chosenBy?: string;
    profile?: { id: string };
    requestedPrompt: string;
    added?: Record<string, string>;
    dropped?: string[];
    note?: string;
  };
  type Generated = { asset: Record<string, unknown> & { url: string; filename: string }; style: Style; show: string };

  // 1. The URL a generated preview asset returns serves the image.
  const generated = (await images("generate", "--prompt", "a castle above a lake at dusk")) as {
    asset: { id: string; url: string; filename: string };
  };
  const served = await app.inject(generated.asset.url);
  assert.equal(served.statusCode, 200, `preview asset URL ${generated.asset.url} loads`);
  assert.deepEqual(served.rawPayload, PNG, "the URL serves the saved image");
  assert.equal((await app.inject(`${generated.asset.url}?w=320`)).statusCode, 200, "a thumbnail request loads too");

  // A file dropped into the folder that the manifest doesn't list stays unserved.
  writeFileSync(join(root, "gallery", "mari-images", "stray.png"), PNG);
  assert.equal((await app.inject("/api/gallery/file/mari-images/stray.png")).statusCode, 404, "unlisted file");
  assert.equal(
    (await app.inject("/api/gallery/file/mari-images/manifest.json")).statusCode,
    404,
    "the manifest is not an image",
  );
  assert.ok(readFileSync(join(root, "gallery", "mari-images", generated.asset.filename)).length > 0);

  // 2. No flag: the prompt and negative reach the image model exactly as written, connection prefixes included.
  const scenery = "a castle above a lake at dusk, no characters";
  for (const flags of [[], ["--no-style"]]) {
    sent.length = 0;
    const plain = (await images(
      "generate",
      ...flags,
      "--kind",
      "avatar",
      "--prompt",
      scenery,
      "--negative",
      "text",
    )) as Generated;
    assert.equal(sent.at(-1)?.prompt, scenery, `${flags.join(" ") || "no flag"}: prompt sent as written`);
    assert.equal(sent.at(-1)?.negative_prompt, "text", `${flags.join(" ") || "no flag"}: negative sent as written`);
    assert.equal(plain.style.mode, "none");
    assert.equal(plain.asset.requestedPrompt, scenery, "the asset keeps the request");
    assert.equal(plain.asset.prompt, scenery);
    assert.equal(plain.asset.styleMode, "none");
    assert.equal(plain.show, `![avatar](${plain.asset.url})`, "the result says how to show the image");
  }

  // 3. --style: the default profile, its Avatar per-image tags and the connection prefix, all reported.
  sent.length = 0;
  const castle = scenery;
  const styled = (await images("generate", "--style", "--kind", "avatar", "--prompt", castle)) as Generated;
  const sentPrompt = sent.at(-1)?.prompt ?? "";
  for (const tag of ["house style", "upper body", "connection prefix tag", "castle"])
    assert.ok(sentPrompt.includes(tag), `--style sends "${tag}": ${sentPrompt}`);
  assert.ok(sent.at(-1)?.negative_prompt?.includes("blurry"), "profile negative tags apply");
  assert.equal(styled.style.mode, "profile");
  assert.equal(styled.style.profile?.id, "house");
  assert.equal(styled.style.chosenBy, "default");
  assert.equal(styled.style.requestedPrompt, castle);
  assert.equal(styled.style.added?.perImageTags, "portrait, upper body, dynamic pose", "per-image tags are reported");
  assert.equal(styled.style.added?.connectionPromptPrefix, "connection prefix tag");
  assert.equal(styled.asset.styleProfileId, "house");
  assert.equal(styled.asset.requestedPrompt, castle);
  assert.notEqual(styled.asset.prompt, castle, "the asset's prompt is what was sent");
  assert.equal(
    ((await images("generate", "--style", "default", "--prompt", scenery)) as Generated).style.profile?.id,
    "house",
  );

  // 3b. #9338: kind avatar distils a character prompt and the style block names what it dropped; illustration keeps
  // every tag and reports nothing dropped.
  const character =
    "priscilla barielle, re:zero kara hajimeru isekai seikatsu, 1girl, in her 20s, orange hair, red eyes, braided bangs, smug, 0.2::uncensored::, no text";
  const avatar = (await images("preview", "--style", "--kind", "avatar", "--prompt", character)) as { style: Style };
  assert.ok(avatar.style.dropped?.includes("priscilla barielle"), `avatar drops the name: ${avatar.style.dropped}`);
  assert.ok(!avatar.style.dropped?.includes("no text"), "a no-clause moved to the negative is not dropped");
  assert.match(avatar.style.note ?? "", /Kind avatar rewrote your prompt.*--kind illustration/);
  // Avatar distils a sentence starting "No glasses" into "avoid glasses" before moving it; still not a drop.
  const negated = (await images("preview", "--style", "--kind", "avatar", "--prompt", "red hair. No glasses")) as {
    style: Style;
  };
  assert.deepEqual(negated.style.dropped, [], `avatar no-clause is not dropped: ${negated.style.dropped}`);
  assert.equal(negated.style.note, undefined);
  const kept = (await images("preview", "--style", "--prompt", character)) as { style: Style };
  assert.deepEqual(kept.style.dropped, [], "illustration keeps every tag, weighted ones included");
  assert.equal(kept.style.note, undefined);
  // A closing period, and the compiler's other "move to the negative" phrasings, are not drops either.
  for (const prompt of [
    "red hair, smug.",
    "red hair, exclude text",
    "red hair, do not include watermark",
    "red hair, don't include logo",
    "1girl; solo; red hair",
  ]) {
    const result = (await images("preview", "--style", "--prompt", prompt)) as { style: Style };
    assert.deepEqual(result.style.dropped, [], `${prompt}: ${JSON.stringify(result.style)}`);
  }
  // A natural-language profile moves every item of "avoid hat, glasses" to the negative, not just the first.
  const avoidList = (await images(
    "preview",
    "--style",
    "realistic",
    "--prompt",
    "a woman reading in a garden. avoid hat, glasses",
  )) as { style: Style; negativePrompt?: string };
  assert.deepEqual(avoidList.style.dropped, [], JSON.stringify(avoidList.style));

  // 4. A chosen profile, by id or name; an unknown one, or both flags, is refused.
  sent.length = 0;
  const off = (await images("generate", "--style", "off", "--kind", "avatar", "--prompt", scenery)) as Generated;
  assert.equal(off.style.chosenBy, "flag");
  assert.equal(off.style.profile?.id, "off");
  assert.ok(!(sent.at(-1)?.prompt ?? "").includes("upper body"), "the Off profile adds no per-image tags");
  assert.equal(
    ((await images("preview", "--style", "House", "--prompt", scenery)) as { style: Style }).style.profile?.id,
    "house",
  );
  assert.match(await refused("generate", "--style", "nope", "--prompt", scenery), /Style profile not found: nope/);
  assert.match(
    await refused("generate", "--style", "off", "--no-style", "--prompt", scenery),
    /either --style or --no-style/,
  );

  // 5. styles: a short list, then one profile in full.
  const list = (await images("styles")) as {
    defaultProfileId: string;
    profiles: Array<{ id: string; isDefault?: boolean; positiveTags: string; perImageTags?: unknown }>;
  };
  assert.equal(list.defaultProfileId, "house");
  const house = list.profiles.find((profile) => profile.id === "house");
  assert.equal(house?.isDefault, true);
  assert.ok(house!.positiveTags.length <= 160, "long tags are cut in the list");
  assert.equal(house?.perImageTags, undefined, "the list leaves per-image tags out");
  assert.ok(
    list.profiles.some((profile) => profile.id === "off"),
    "built-in profiles are listed",
  );
  const full = (await images("styles", "house")) as { perImageTags: Record<string, string>; positiveTags: string };
  assert.equal(full.perImageTags.avatar, "portrait, upper body, dynamic pose");
  assert.ok(full.positiveTags.endsWith("house tag 39"), "the full profile is not cut");

  // 5b. #9342 look: the pictures ride on `images` (scaled to fit 1024, or 512 with --detail low), the output only
  // names them, transparency survives, an app URL resolves like --source, and bad calls are refused whole.
  const look = async (...args: string[]) => {
    const result = await mari.executeCli({ argv: ["images", ...args], sessionId: "mari-images-cli" });
    assert.equal(result.ok, true, `mari images ${args.join(" ")}\n${JSON.stringify(result).slice(0, 2000)}`);
    return result as typeof result & { images: string[]; output: { looked: Array<Record<string, unknown>> } };
  };
  const { getSharp } = await import("../../../packages/server/src/services/image/sharp-runtime.js");
  const sharp = await getSharp();
  const wide = await sharp({ create: { width: 2000, height: 1000, channels: 3, background: "#3366aa" } })
    .png()
    .toBuffer();
  const wideUrl = `data:image/png;base64,${wide.toString("base64")}`;
  const seen = await look("look", wideUrl, generated.asset.id);
  assert.equal(seen.images.length, 2);
  assert.match(seen.images[0]!, /^data:image\/jpeg;base64,/, "an opaque picture goes out as JPEG");
  const sentMeta = await sharp(Buffer.from(seen.images[0]!.split(",")[1]!, "base64")).metadata();
  assert.deepEqual([sentMeta.width, sentMeta.height], [1024, 512], "scaled to fit 1024 on the long side");
  assert.deepEqual(seen.output.looked[0], {
    image: 1,
    ref: "data-url",
    label: "data-url",
    original: "2000x1000",
    sent: "1024x512",
  });
  assert.equal(seen.output.looked[1]!.label, `asset:${generated.asset.id}`);
  assert.equal(seen.output.looked[1]!.sent, "1x1", "a small picture is never enlarged");
  assert.ok(!JSON.stringify(seen.output).includes("base64,"), "the text output never carries pixels");
  const low = await look("view", wideUrl, "--detail", "low");
  assert.equal(low.output.looked[0]!.sent, "512x256", "view is look, --detail low fits 512");
  const transparent = await sharp({
    create: { width: 10, height: 10, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .png()
    .toBuffer();
  const backgroundsDir = join(root, "backgrounds");
  mkdirSync(backgroundsDir, { recursive: true });
  writeFileSync(join(backgroundsDir, "glass.png"), transparent);
  const alpha = await look("look", "/api/backgrounds/file/glass.png");
  assert.match(alpha.images[0]!, /^data:image\/png;base64,/, "a transparent picture stays PNG");
  assert.equal(alpha.output.looked[0]!.label, "background:glass.png");
  const byTarget = await look("look", "--target", "asset", "--asset", generated.asset.id);
  assert.equal(byTarget.images.length, 1, "--target asset --asset names one picture, not two");
  assert.match(await refused("look"), /Usage: mari images look/);
  assert.match(await refused("look", "a", "b", "c", "d", "e"), /at most 4 images/);
  assert.match(await refused("look", wideUrl, "--detail", "huge"), /--detail takes low or high/);
  const partlyBad = await mari.executeCli({ argv: ["images", "look", wideUrl, "no-such-asset.png"], sessionId: "x" });
  assert.equal(partlyBad.ok, false, "one bad ref fails the whole call");
  assert.equal(partlyBad.images, undefined, "a failed look sends no pictures");

  // 6. Every subcommand and flag a handbook or Mari's system prompt uses with `mari images` is in the help text, so the
  // two cannot drift apart (as #9326 checks for app_data arguments).
  const help = String(await images("help"));
  const sources = [
    ...readdirSync(skillsDir)
      .filter((name) => name.endsWith(".md"))
      .map((name) => ({ name, text: readFileSync(join(skillsDir, name), "utf8") })),
    { name: "Mari's system prompt", text: MARI_SYSTEM_PROMPT },
  ];
  const undocumented: string[] = [];
  let examples = 0;
  for (const { name, text } of sources) {
    for (const match of text.matchAll(/`mari images ([^`]+)`/g)) {
      examples += 1;
      const command = match[1]!;
      const sub = command.split(/\s+/)[0]!;
      if (/^[a-z]/.test(sub) && !new RegExp(`\\b${sub}\\b`).test(help)) undocumented.push(`${name}: ${sub}`);
      for (const flag of command.match(/--[a-z][a-z-]*/g) ?? []) {
        if (!help.includes(flag)) undocumented.push(`${name}: ${flag}`);
      }
    }
  }
  assert.ok(examples >= 10, `found mari images examples in the handbooks (${examples})`);
  assert.deepEqual(undocumented, [], "handbook mari images examples use only documented subcommands and flags");

  console.log("mari images CLI regression passed.");
} finally {
  await app.close();
  await db._fileStore?.close?.();
  imageServer.close();
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  rmSync(root, { recursive: true, force: true });
}
