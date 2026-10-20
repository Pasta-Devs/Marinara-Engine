// Real generation/storage path with local image/vision providers and a synthetic face only.
// The old generator fails the first assertion: it never writes drawn mouth/eye sprites.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-mesh-pictures-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.IMAGE_LOCAL_URLS_ENABLED = "true";
process.env.BACKGROUNDREMOVER_DISABLED = "true";
process.env.LOG_LEVEL = "silent";

const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { createCharactersStorage } = await import("../../packages/server/src/services/storage/characters.storage.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { characterDataSchema } = await import("../../packages/shared/src/index.js");
const { getSharp } = await import("../../packages/server/src/services/image/sharp-runtime.js");
const { avatarCanvasPlacement } =
  await import("../../packages/server/src/services/avatars/generation/generation-context.js");
const { generateMeshRig, saveMeshRig } =
  await import("../../packages/server/src/services/avatars/generation/mesh-rig.js");
const { previewMeshSpritePrompts } =
  await import("../../packages/server/src/services/avatars/generation/mesh-sprite-generation.js");
const { savePngtuberVariants } =
  await import("../../packages/server/src/services/avatars/generation/pngtuber-variants.js");
const { avatarOwnerDir, readAvatarConfig } = await import("../../packages/server/src/services/avatars/storage.js");
const { meshDrawnFaceFixture } = await import("./fixtures/mesh-drawn-face.js");
const fixture = await meshDrawnFaceFixture();
const sharp = await getSharp();
const AdmZip = createRequire(new URL("../../packages/server/package.json", import.meta.url))("adm-zip");
const expectedKeys = [
  "mouth_a",
  "mouth_i",
  "mouth_o",
  "mouth_a_half",
  "eyes_closed_0",
  "eyes_closed_1",
  "eyes_half_0",
  "eyes_half_1",
  "eyes_smile_0",
  "eyes_smile_1",
];
let edits: string[] = [];
let sheets = 0;
let rejectVisionAnswers = 0;
let refuse = "";
let hold = "";
const held = Promise.withResolvers<void>();
const providerClosed = Promise.withResolvers<void>();
const provider = createServer(async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const body = Buffer.concat(chunks).toString("utf8");
  res.setHeader("content-type", "application/json");
  if (req.url?.endsWith("/chat/completions")) {
    const layout = rejectVisionAnswers > 0 ? (rejectVisionAnswers--, {}) : fixture.layout;
    res.end(JSON.stringify({ choices: [{ message: { role: "assistant", content: JSON.stringify(layout) } }] }));
    return;
  }
  if (req.url?.endsWith("/images/edits")) {
    const key = /MESH PICTURE CONTRACT \[(\w+)\]/u.exec(body)?.[1] as keyof typeof fixture.pictures;
    edits.push(key);
    if (key === hold) {
      res.on("close", () => providerClosed.resolve());
      held.resolve();
      return;
    }
    if (!key || key === refuse) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: { message: "The fixture refused this picture." } }));
      return;
    }
    const place = avatarCanvasPlacement(fixture.source, { width: 1024, height: 1536 });
    const picture = await sharp(fixture.pictures[key])
      .resize(place.width, place.height)
      .extend({
        left: place.left,
        right: 1024 - place.width - place.left,
        top: place.top,
        bottom: 1536 - place.height - place.top,
        background: "#ffffff",
      })
      .png()
      .toBuffer();
    res.end(JSON.stringify({ data: [{ b64_json: picture.toString("base64") }] }));
    return;
  }
  if (req.url?.endsWith("/images/generations")) {
    sheets += 1;
    const keys = [
      "face",
      "mouth_a",
      "mouth_i",
      "mouth_o",
      "mouth_a_half",
      "eyes_closed",
      "eyes_half",
      "eyes_smile",
    ] as const;
    const matte = /#[0-9a-f]{6}\b/iu.exec(body)?.[0] ?? "#00ff00";
    const sheet = await sharp({ create: { width: 960, height: 600, channels: 4, background: matte } })
      .composite(
        keys.map((key, index) => ({
          input: key === "face" ? fixture.source.png : fixture.pictures[key],
          left: (index % 4) * 240,
          top: Math.floor(index / 4) * 300,
        })),
      )
      .png()
      .toBuffer();
    res.end(JSON.stringify({ data: [{ b64_json: sheet.toString("base64") }] }));
    return;
  }
  res.end(JSON.stringify({ data: [] }));
});
await new Promise<void>((resolve) => provider.listen(0, "127.0.0.1", resolve));
const baseUrl = `http://127.0.0.1:${(provider.address() as { port: number }).port}/v1`;
const db = await getDB();
const character = await createCharactersStorage(db).create(
  characterDataSchema.parse({
    name: "Synthetic mesh fixture",
    description: "An illustrated brown-haired character wearing a blue shirt.",
  }),
);
const owner = { ownerType: "character" as const, ownerId: character!.id };
const connections = createConnectionsStorage(db);
const vision = await connections.create({
  name: "Synthetic vision",
  provider: "custom",
  baseUrl,
  model: "fixture",
  apiKey: "fixture",
});
const image = await connections.create({
  name: "Synthetic edit",
  provider: "image_generation",
  baseUrl,
  model: "gpt-image-1",
  imageGenerationSource: "openai",
  imageService: "openai",
  apiKey: "fixture",
});
const sheetImage = await connections.create({
  name: "Synthetic sheet",
  provider: "image_generation",
  baseUrl,
  model: "dall-e-3",
  imageGenerationSource: "openai",
  imageService: "openai",
  apiKey: "fixture",
});
const dir = join(dataDir, "sprites", owner.ownerId);
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, "neutral.png"), fixture.source.png);
const request = { owner, sourceLabel: "neutral", connectionId: vision.id, imageConnectionId: image.id };
const zip = (archive: string) => new AdmZip(Buffer.from(archive, "base64"));
const assertComplete = (archive: string) => {
  const sprites = zip(archive).readAsText("built/sprites/sprites.json");
  assert.ok(sprites, "generation writes a drawn sprite manifest");
  const manifest = JSON.parse(sprites);
  assert.deepEqual(Object.keys(manifest.layers).sort(), [...expectedKeys].sort());
  for (const key of expectedKeys) assert.ok(zip(archive).getEntry(`built/sprites/${key}.png`), `${key} is present`);
};

try {
  const allPrompts = await previewMeshSpritePrompts(db, request);
  assert.equal(allPrompts.length, 7, "without saved blink/talk pictures, all seven whole-face pictures are generated");
  assert.deepEqual(edits, [], "prompt review makes no image requests");
  await assert.rejects(generateMeshRig(db, { ...request, connectionId: "missing-vision" }));
  assert.equal(edits.length, 0, "a missing vision connection is refused before paying for images");
  const fresh = await generateMeshRig(db, request);
  assert.equal(fresh.spriteStatus, "complete", fresh.spriteError);
  assertComplete(fresh.archive);
  assert.equal(edits.length, 7, "missing mouth-open and eyes-closed are generated too");
  assert.equal(fresh.pictures?.length, 7, "the complete pictures return for review");
  assert.equal(await readAvatarConfig(owner), null, "generation does not save an avatar");
  assert.equal(existsSync(avatarOwnerDir(owner)), false, "even generated picture files stay unsaved");

  const hash = createHash("sha256").update(fixture.source.png).digest("hex");
  await savePngtuberVariants({
    owner,
    images: [
      { label: "neutral", variant: "mouth-open", sourceHash: hash, image: fixture.pictures.mouth_a.toString("base64") },
      {
        label: "neutral",
        variant: "eyes-closed",
        sourceHash: hash,
        image: fixture.pictures.eyes_closed.toString("base64"),
      },
    ],
  });
  const before = await readAvatarConfig(owner);
  const savedConfigBytes = readFileSync(join(avatarOwnerDir(owner), "avatar.json"));
  edits = [];
  assert.equal((await previewMeshSpritePrompts(db, request)).length, 5);
  const reused = await generateMeshRig(db, request);
  assert.equal(reused.spriteStatus, "complete", reused.spriteError);
  assertComplete(reused.archive);
  assert.deepEqual(
    edits.sort(),
    ["eyes_half", "eyes_smile", "mouth_a_half", "mouth_i", "mouth_o"].sort(),
    "only missing pictures are paid for",
  );
  assert.deepEqual(await readAvatarConfig(owner), before, "Try again leaves the saved setup unchanged");
  assert.deepEqual(readFileSync(join(avatarOwnerDir(owner), "avatar.json")), savedConfigBytes);

  // Replacing the selected sprite must not reuse pictures belonging to the old base.
  writeFileSync(join(dir, "neutral.png"), fixture.pictures.mouth_a);
  try {
    assert.equal((await previewMeshSpritePrompts(db, request)).length, 7);
  } finally {
    writeFileSync(join(dir, "neutral.png"), fixture.source.png);
  }
  hold = "mouth_i";
  const abortEdit = new AbortController();
  const editing = generateMeshRig(db, request, { signal: abortEdit.signal });
  await held.promise;
  abortEdit.abort(new DOMException("Cancelled", "AbortError"));
  await assert.rejects(editing, { name: "AbortError" });
  await providerClosed.promise;
  assert.deepEqual(await readAvatarConfig(owner), before, "cancelling an image edit stores no partial mesh");
  hold = "";

  refuse = "mouth_o";
  const fallback = await generateMeshRig(db, request);
  assert.equal(fallback.spriteStatus, "unavailable");
  assert.ok(fallback.spriteError);
  assert.equal(
    zip(fallback.archive).getEntry("built/sprites/sprites.json"),
    null,
    "a refused shape cannot leave a partial set",
  );
  assert.equal(fallback.pictures, undefined, "incomplete pictures are never offered as a complete set");
  assert.deepEqual(await readAvatarConfig(owner), before);
  refuse = "";

  const noConnection = await generateMeshRig(db, { ...request, imageConnectionId: "missing-connection" });
  assert.equal(noConnection.spriteStatus, "unavailable");
  assert.equal(zip(noConnection.archive).getEntry("built/sprites/sprites.json"), null);
  const cancelled = new AbortController();
  cancelled.abort(new DOMException("Cancelled", "AbortError"));
  await assert.rejects(generateMeshRig(db, request, { signal: cancelled.signal }), { name: "AbortError" });

  const matched = await generateMeshRig(db, { ...request, imageConnectionId: sheetImage.id });
  assert.equal(matched.spriteStatus, "complete", matched.spriteError);
  assert.equal(matched.newFace, true, "a provider without image edits uses a new matched base");
  assertComplete(matched.archive);
  assert.equal(sheets, 1, "all shapes are drawn in one matched sheet");
  assert.deepEqual(await readAvatarConfig(owner), before);
  rejectVisionAnswers = 2; // Both layout attempts for the new face fail; the original sprite remains riggable.
  const unriggable = await generateMeshRig(db, { ...request, imageConnectionId: sheetImage.id });
  assert.equal(unriggable.spriteStatus, "unavailable", "an unusable new face falls back to the original sprite");
  assert.equal(unriggable.newFace, undefined);
  assert.equal(zip(unriggable.archive).getEntry("built/sprites/sprites.json"), null);
  assert.ok(unriggable.spriteError);
  assert.deepEqual(await readAvatarConfig(owner), before);
  const kept = await saveMeshRig({ owner, archive: reused.archive });
  assert.ok(kept.config.kinds["mesh-avatar"]);
  assert.deepEqual(
    kept.config.kinds.pngtuber,
    before?.kinds.pngtuber,
    "keeping a mesh preserves its PNGTuber pictures",
  );
  assert.deepEqual(readFileSync(join(dir, "neutral.png")), fixture.source.png, "the source sprite is never rewritten");
} finally {
  await closeDB();
  provider.closeAllConnections();
  await new Promise<void>((resolve) => provider.close(() => resolve()));
  rmSync(dataDir, { recursive: true, force: true });
}
