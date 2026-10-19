/**
 * Avatar models of the 2D and 3D avatar agents (base lane, #7537):
 *   - avatar.json is validated on every write, queued per owner, and read back only when valid;
 *   - imports dispatch to the kind's importer (by its bytes, else by the file's extension), refuse with
 *     that importer's own plain message, and add no size limit below the global upload cap;
 *   - stored files are served only from the owner's folder, with a content type their bytes prove;
 *   - a refused save replaces no stored file, and a file lost since it was saved blocks no later change;
 *   - removing a kind or deleting (or expunging) the character or persona removes its files, even when the
 *     delete lands during an import; removing the last kind keeps avatar.json only while the avatar is
 *     turned off or a switch is changed (sprites are an avatar without it); backups cover the folder.
 */
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "marinara-avatar-models-"));
process.env.DATA_DIR = dir;
process.env.FILE_STORAGE_DIR = join(dir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";
const requireServer = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const Fastify = requireServer("fastify") as typeof import("fastify").default;
const multipart = requireServer("@fastify/multipart") as typeof import("@fastify/multipart").default;
const sharp = requireServer("sharp") as typeof import("sharp").default;
const { PROFESSOR_MARI_ID, characterDataSchema, createAvatarConfig } =
  await import("../../packages/shared/src/index.js");
// The copy the server resolves `@marinara-engine/shared` to, so the import route's instanceof check matches.
const { AvatarImportError } = await import("../../packages/shared/dist/index.js");
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { createCharactersStorage } = await import("../../packages/server/src/services/storage/characters.storage.js");
const { avatarModelsRoutes } = await import("../../packages/server/src/routes/avatar-models.routes.js");
const { charactersRoutes } = await import("../../packages/server/src/routes/characters.routes.js");
const { adminRoutes } = await import("../../packages/server/src/routes/admin.routes.js");
const { vrmImporter } = await import("../../packages/server/src/services/avatars/formats/vrm.js");
const storage = await import("../../packages/server/src/services/avatars/storage.js");

const db = await getDB();
const characters = createCharactersStorage(db);
const app = Fastify();
app.decorate("db", db);
await app.register(multipart, { limits: { fileSize: 256 * 1024 * 1024 } });
await app.register(avatarModelsRoutes, { prefix: "/api/avatar-models" });
await app.register(charactersRoutes, { prefix: "/api/characters" });
await app.register(adminRoutes, { prefix: "/api/admin" });
await app.ready();

const png = await sharp({ create: { width: 4, height: 4, channels: 4, background: "#c33" } })
  .png()
  .toBuffer();
const glb = (size = 64) => {
  const bytes = Buffer.alloc(size);
  bytes.write("glTF", 0, "ascii");
  return bytes;
};

function multipartBody(fields: Record<string, string>, file: { name: string; bytes: Buffer }) {
  const boundary = "----avatar-models-regression";
  const parts: Buffer[] = [];
  for (const [name, value] of Object.entries(fields)) {
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`));
  }
  parts.push(
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${file.name}"\r\nContent-Type: application/octet-stream\r\n\r\n`,
    ),
    file.bytes,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  );
  return { payload: Buffer.concat(parts), headers: { "content-type": `multipart/form-data; boundary=${boundary}` } };
}

try {
  const character = await characters.create(characterDataSchema.parse({ name: "Ava" }));
  const persona = await characters.createPersona("Mari", "The player.");
  assert(character && persona);
  const owner = { ownerType: "character", ownerId: character.id } as const;
  const personaOwner = { ownerType: "persona", ownerId: persona.id } as const;
  const base = `/api/avatar-models/character/${character.id}`;
  const ownerDir = join(dir, "avatar-models", "character", character.id);

  // ── Config: none yet, validated owner ids, unknown owners ──
  assert.deepEqual((await app.inject({ method: "GET", url: "/api/avatar-models" })).json(), []);
  // No avatar set up yet is not an error (the browser would log one), but an owner that doesn't exist is.
  const none = await app.inject({ method: "GET", url: base });
  assert.equal(none.statusCode, 200, "no avatar set up yet");
  assert.equal(none.payload, "null");
  assert.match(String(none.headers["content-type"]), /^application\/json/u);
  assert.equal(
    (await app.inject({ method: "GET", url: "/api/avatar-models/character/missing-id" })).statusCode,
    404,
    "a character that doesn't exist",
  );
  assert.equal((await app.inject({ method: "GET", url: "/api/avatar-models/persona/missing-id" })).statusCode, 404);
  assert.equal((await app.inject({ method: "GET", url: "/api/avatar-models/npc/abc" })).statusCode, 400);
  assert.equal((await app.inject({ method: "GET", url: "/api/avatar-models/character/a.b" })).statusCode, 400);
  assert.equal(
    (await app.inject({ method: "PUT", url: "/api/avatar-models/character/missing-id", payload: { enabled: true } }))
      .statusCode,
    404,
    "no avatar folder for a character that doesn't exist",
  );
  assert.equal(existsSync(join(dir, "avatar-models", "character", "missing-id")), false);
  assert.equal((await app.inject({ method: "PUT", url: base, payload: { extra: 1 } })).statusCode, 400, "strict body");

  const created = await app.inject({
    method: "PUT",
    url: base,
    payload: { enabled: false, features: { blink: false } },
  });
  assert.equal(created.statusCode, 200);
  assert.equal(created.json().enabled, false);
  assert.deepEqual(created.json().features, { lipSync: true, blink: false, idleMotion: true }, "flags merge");
  assert.equal(created.json().activeKind, null);

  const missingFile = await app.inject({
    method: "PUT",
    url: base,
    payload: { kinds: { vrm: { file: "vrm/model.vrm", specVersion: "1.0", expressionMap: {} } }, activeKind: "vrm" },
  });
  assert.equal(missingFile.statusCode, 400, "a kind may only name files that exist");
  assert.match(missingFile.json().error, /missing/u);

  // ── Storage: saving an import writes its files, sets the kind and cleans files the data no longer names ──
  const pngtuberData = (path: string) => ({
    layers: { neutral: { base: { source: "file", path } }, happy: { base: { source: "sprite", label: "happy" } } },
    expressionMap: { neutral: { target: "neutral", source: "sprite-label", confidence: 1 } },
    motion: { bounceOnTalk: true, bounceHeight: 0.06, blinkIntervalSeconds: 4 },
    source: "generated",
  });
  const first = await storage.saveExtractedAvatar(owner, {
    kind: "pngtuber",
    files: [{ path: "pngtuber/neutral.png", bytes: png }],
    data: pngtuberData("pngtuber/neutral.png") as never,
    detected: {},
    warnings: ["one note"],
  });
  assert.equal(first.config.activeKind, "pngtuber", "the first kind becomes the active one");
  assert.deepEqual(first.warnings, ["one note"]);
  await storage.saveExtractedAvatar(owner, {
    kind: "pngtuber",
    files: [{ path: "pngtuber/neutral-2.png", bytes: png }],
    data: pngtuberData("pngtuber/neutral-2.png") as never,
    detected: {},
    warnings: [],
  });
  assert.equal(existsSync(join(ownerDir, "pngtuber", "neutral.png")), false, "the replaced layer file is gone");
  assert.equal(existsSync(join(ownerDir, "pngtuber", "neutral-2.png")), true);
  await assert.rejects(
    storage.saveExtractedAvatar(owner, {
      kind: "pngtuber",
      files: [{ path: "vrm/escape.png", bytes: png }],
      data: pngtuberData("vrm/escape.png") as never,
      detected: {},
      warnings: [],
    }),
    /pngtuber files live in pngtuber\//u,
    "a kind's files stay in its own folder",
  );
  await assert.rejects(
    storage.writeAvatarFiles(owner, [{ path: "pngtuber/../../x.png", bytes: png }]),
    /isn't allowed/u,
    "a stored path can't leave the folder",
  );

  // Concurrent saves of two kinds both land (the per-owner queue).
  await Promise.all([
    storage.saveExtractedAvatar(owner, {
      kind: "vrm",
      files: [{ path: "vrm/model.vrm", bytes: glb() }],
      data: { file: "vrm/model.vrm", specVersion: "1.0", expressionMap: {}, idleAnimation: null } as never,
      detected: {},
      warnings: [],
    }),
    storage.updateAvatarConfig(owner, (current) => ({ ...current!, enabled: true })),
  ]);
  const both = (await app.inject({ method: "GET", url: base })).json();
  assert.deepEqual(Object.keys(both.kinds).sort(), ["pngtuber", "vrm"]);
  assert.equal(both.enabled, true);
  assert.equal(both.activeKind, "pngtuber", "an existing active kind stays");

  // ── Serving files ──
  const image = await app.inject({ method: "GET", url: `${base}/files/pngtuber/neutral-2.png` });
  assert.equal(image.statusCode, 200);
  assert.equal(image.headers["content-type"], "image/png");
  const model = await app.inject({ method: "GET", url: `${base}/files/vrm/model.vrm` });
  assert.equal(model.statusCode, 200);
  assert.equal(model.headers["content-type"], "model/gltf-binary");
  assert.equal(model.rawPayload.length, 64);
  const ranged = await app.inject({
    method: "GET",
    url: `${base}/files/vrm/model.vrm`,
    headers: { range: "bytes=0-3" },
  });
  assert.equal(ranged.statusCode, 206);
  assert.equal(ranged.payload, "glTF");
  writeFileSync(join(ownerDir, "vrm", "fake.vrm"), "<script>alert(1)</script>");
  assert.equal(
    (await app.inject({ method: "GET", url: `${base}/files/vrm/fake.vrm` })).statusCode,
    404,
    "bytes must be glTF",
  );
  writeFileSync(join(ownerDir, "pngtuber", "page.png"), "<html></html>");
  assert.equal((await app.inject({ method: "GET", url: `${base}/files/pngtuber/page.png` })).statusCode, 404);
  for (const url of [
    `${base}/files/vrm/..%2F..%2Favatar.json`,
    `${base}/files/sprites/a.png`,
    `${base}/files/vrm/.hidden`,
    `${base}/files/vrm/nul.vrm`,
  ]) {
    assert.equal((await app.inject({ method: "GET", url })).statusCode, 400, `${url} is refused`);
  }
  assert.equal(
    (await app.inject({ method: "GET", url: `${base}/files/pngtuber/avatar.json` })).statusCode,
    404,
    "only images are served from pngtuber/",
  );

  // ── Import ──
  // A file of a kind's extension that its importer does not recognise still goes to that importer, and the
  // person gets its own refusal. A stand-in importer keeps this independent of the 3D lane's real one.
  const stub = { detect: vrmImporter.detect, validate: vrmImporter.validate, extract: vrmImporter.extract };
  Object.assign(vrmImporter, {
    detect: () => false,
    validate: async () => {
      throw new AvatarImportError("unsupported-format", "This VRM model can't be read.");
    },
  });
  try {
    const refused = await app.inject({
      method: "POST",
      url: `${base}/import`,
      ...multipartBody({ kind: "vrm" }, { name: "model.vrm", bytes: glb() }),
    });
    assert.equal(refused.statusCode, 415);
    assert.deepEqual(refused.json(), { error: "This VRM model can't be read.", code: "unsupported-format" });
  } finally {
    Object.assign(vrmImporter, stub);
  }
  const unknown = await app.inject({
    method: "POST",
    url: `${base}/import`,
    ...multipartBody({}, { name: "notes.txt", bytes: Buffer.from("hi") }),
  });
  assert.equal(unknown.statusCode, 415);
  assert.match(unknown.json().error, /^Choose a \.save, \.mavatar, \.vrm, \.vrma file\.$/u);
  const badKind = await app.inject({
    method: "POST",
    url: `${base}/import`,
    ...multipartBody({ kind: "live2d" }, { name: "model.vrm", bytes: glb() }),
  });
  assert.equal(badKind.statusCode, 400);

  // A working importer (as the 3D lane will ship): a large upload is not refused below the global cap.
  Object.assign(vrmImporter, {
    detect: ({ head }: { head: Uint8Array }) => Buffer.from(head.subarray(0, 4)).toString("ascii") === "glTF",
    validate: async ({ bytes }: { bytes: Uint8Array }) => ({ size: bytes.byteLength }),
    extract: async (_validated: unknown, input: { bytes: Uint8Array }) => ({
      kind: "vrm",
      files: [{ path: "vrm/imported.vrm", bytes: input.bytes }],
      data: { file: "vrm/imported.vrm", specVersion: "0.x", expressionMap: {}, idleAnimation: null },
      detected: { happy: { target: "joy", source: "preset", confidence: 1 } },
      warnings: [],
    }),
  });
  try {
    const big = glb(12 * 1024 * 1024);
    const imported = await app.inject({
      method: "POST",
      url: `${base}/import`,
      ...multipartBody({}, { name: "Large Model.vrm", bytes: big }),
    });
    assert.equal(imported.statusCode, 200, imported.payload);
    assert.equal(imported.json().kind, "vrm");
    assert.equal(imported.json().config.kinds.vrm.file, "vrm/imported.vrm");
    assert.deepEqual(imported.json().detected.happy, { target: "joy", source: "preset", confidence: 1 });
    assert.equal(readFileSync(join(ownerDir, "vrm", "imported.vrm")).length, big.length, "the whole file is stored");
    assert.equal(existsSync(join(ownerDir, "vrm", "model.vrm")), false, "files the new data no longer names go");
    assert.equal(existsSync(join(ownerDir, "vrm", "fake.vrm")), false);

    // A character deleted while its import is still being read leaves no avatar folder behind.
    const doomed = await characters.create(characterDataSchema.parse({ name: "Doomed" }));
    assert(doomed);
    let entered!: () => void;
    let release!: () => void;
    const validating = new Promise<void>((resolve) => (entered = resolve));
    const gate = new Promise<void>((resolve) => (release = resolve));
    const working = vrmImporter.validate;
    Object.assign(vrmImporter, {
      validate: async (input: Parameters<typeof working>[0]) => {
        entered();
        await gate;
        return working(input);
      },
    });
    const racing = app.inject({
      method: "POST",
      url: `/api/avatar-models/character/${doomed.id}/import`,
      ...multipartBody({}, { name: "model.vrm", bytes: glb() }),
    });
    await validating;
    assert.equal((await app.inject({ method: "DELETE", url: `/api/characters/${doomed.id}` })).statusCode, 204);
    release();
    assert.equal((await racing).statusCode, 404, "the import reports the character is gone");
    assert.equal(existsSync(join(dir, "avatar-models", "character", doomed.id)), false, "and stores nothing");
  } finally {
    Object.assign(vrmImporter, stub);
  }

  // ── A broken avatar.json reads as none, and the list skips it ──
  const corruptOwner = await characters.create(characterDataSchema.parse({ name: "Broken" }));
  assert(corruptOwner);
  const corruptDir = join(dir, "avatar-models", "character", corruptOwner.id);
  await storage.updateAvatarConfig({ ownerType: "character", ownerId: corruptOwner.id }, () =>
    createAvatarConfig({ ownerType: "character", ownerId: corruptOwner.id }, new Date().toISOString()),
  );
  writeFileSync(join(corruptDir, "avatar.json"), "{ not json");
  const corruptRead = await app.inject({ method: "GET", url: `/api/avatar-models/character/${corruptOwner.id}` });
  assert.equal(corruptRead.statusCode, 200);
  assert.equal(corruptRead.payload, "null");
  const listed = (await app.inject({ method: "GET", url: "/api/avatar-models" })).json() as Array<{
    owner: { ownerId: string };
    kinds: string[];
  }>;
  assert.deepEqual(
    listed.map((summary) => [summary.owner.ownerId, summary.kinds]),
    [[character.id, ["pngtuber", "vrm"]]],
  );

  // ── Removing kinds ──
  const afterPngtuber = await app.inject({ method: "DELETE", url: `${base}/kinds/pngtuber` });
  assert.equal(afterPngtuber.statusCode, 200);
  assert.equal(afterPngtuber.json().activeKind, "vrm", "the active kind falls back to one still set up");
  assert.equal(existsSync(join(ownerDir, "pngtuber")), false);
  // Blinking was turned off when the avatar was created; with the switches back at their defaults, nothing
  // in avatar.json is worth keeping once the last kind goes.
  assert.equal(
    (await app.inject({ method: "PUT", url: base, payload: { features: { blink: true } } })).statusCode,
    200,
  );
  const afterVrm = await app.inject({ method: "DELETE", url: `${base}/kinds/vrm` });
  assert.equal(afterVrm.statusCode, 200);
  assert.equal(afterVrm.json(), null, "nothing remains");
  assert.equal(existsSync(ownerDir), false, "the owner's folder is gone with its last kind");
  assert.equal((await app.inject({ method: "DELETE", url: `${base}/kinds/live2d` })).statusCode, 400);

  // ── A refused save keeps the stored files; a file lost since it was saved blocks nothing ──
  const vrmData = { file: "vrm/model.vrm", specVersion: "1.0", expressionMap: {}, idleAnimation: null } as never;
  await storage.saveExtractedAvatar(owner, {
    kind: "pngtuber",
    files: [{ path: "pngtuber/neutral.png", bytes: png }],
    data: pngtuberData("pngtuber/neutral.png") as never,
    detected: {},
    warnings: [],
  });
  const larger = await sharp({ create: { width: 8, height: 8, channels: 4, background: "#3c3" } })
    .png()
    .toBuffer();
  const tooManyLayers = Object.fromEntries(
    Array.from({ length: 65 }, (_, index) => [`l${index}`, { base: { source: "file", path: "pngtuber/neutral.png" } }]),
  );
  await assert.rejects(
    storage.saveExtractedAvatar(owner, {
      kind: "pngtuber",
      files: [{ path: "pngtuber/neutral.png", bytes: larger }],
      data: { ...pngtuberData("pngtuber/neutral.png"), layers: tooManyLayers } as never,
      detected: {},
      warnings: [],
    }),
    /at most 64 layer sets/u,
  );
  assert.deepEqual(readFileSync(join(ownerDir, "pngtuber", "neutral.png")), png, "a refused save replaces no file");
  assert.deepEqual(readdirSync(join(ownerDir, "pngtuber")), ["neutral.png"], "and leaves no temporary file");
  await storage.saveExtractedAvatar(owner, {
    kind: "vrm",
    files: [{ path: "vrm/model.vrm", bytes: glb() }],
    data: vrmData,
    detected: {},
    warnings: [],
  });
  rmSync(join(ownerDir, "pngtuber", "neutral.png"));
  const offWithLostFile = await app.inject({ method: "PUT", url: base, payload: { enabled: false } });
  assert.equal(offWithLostFile.statusCode, 200, offWithLostFile.payload);
  await storage.saveExtractedAvatar(owner, {
    kind: "vrm",
    files: [{ path: "vrm/other.vrm", bytes: glb() }],
    data: { file: "vrm/other.vrm", specVersion: "1.0", expressionMap: {}, idleAnimation: null } as never,
    detected: {},
    warnings: [],
  });
  assert.equal(existsSync(join(ownerDir, "vrm", "other.vrm")), true, "another kind still saves");
  const removedVrm = await app.inject({ method: "DELETE", url: `${base}/kinds/vrm` });
  assert.equal(removedVrm.statusCode, 200, removedVrm.payload);
  assert.deepEqual(Object.keys(removedVrm.json().kinds), ["pngtuber"]);
  assert.equal(existsSync(join(ownerDir, "vrm")), false);
  const removedBroken = await app.inject({ method: "DELETE", url: `${base}/kinds/pngtuber` });
  assert.equal(removedBroken.statusCode, 200, "the kind with the lost file can be removed");
  assert.deepEqual(
    [removedBroken.json().enabled, removedBroken.json().activeKind, removedBroken.json().kinds],
    [false, null, {}],
    "an avatar turned off stays off without kinds, so the owner's sprites don't show in its place",
  );
  assert.deepEqual(readdirSync(ownerDir), ["avatar.json"], "only the settings stay");

  // ── Deleting the character or persona removes its avatar ──
  await storage.saveExtractedAvatar(owner, {
    kind: "vrm",
    files: [{ path: "vrm/model.vrm", bytes: glb() }],
    data: { file: "vrm/model.vrm", specVersion: "1.0", expressionMap: {} } as never,
    detected: {},
    warnings: [],
  });
  await storage.updateAvatarConfig(personaOwner, () => createAvatarConfig(personaOwner, new Date().toISOString()));
  const personaDir = join(dir, "avatar-models", "persona", persona.id);
  assert.equal(existsSync(personaDir), true);
  assert.equal((await app.inject({ method: "DELETE", url: `/api/characters/${character.id}` })).statusCode, 204);
  assert.equal(existsSync(ownerDir), false, "a deleted character's avatar folder is removed");
  assert.equal((await app.inject({ method: "DELETE", url: `/api/characters/personas/${persona.id}` })).statusCode, 204);
  assert.equal(existsSync(personaDir), false, "a deleted persona's avatar folder is removed");

  // ── Expunging every character or persona removes their avatars; Professor Mari's stays ──
  const swept = await characters.create(characterDataSchema.parse({ name: "Swept" }));
  const sweptPersona = await characters.createPersona("Swept", "The player.");
  assert(swept && sweptPersona);
  const sweptOwners = [
    { ownerType: "character", ownerId: swept.id },
    { ownerType: "persona", ownerId: sweptPersona.id },
    { ownerType: "character", ownerId: PROFESSOR_MARI_ID },
  ] as const;
  for (const sweptOwner of sweptOwners) {
    await storage.updateAvatarConfig(sweptOwner, () => createAvatarConfig(sweptOwner, new Date().toISOString()));
  }
  const expunged = await app.inject({
    method: "POST",
    url: "/api/admin/expunge",
    headers: { host: "localhost" },
    payload: { confirm: true, scopes: ["characters", "personas"] },
  });
  assert.equal(expunged.statusCode, 200, expunged.payload);
  assert.deepEqual(
    sweptOwners.map((sweptOwner) => existsSync(join(dir, "avatar-models", sweptOwner.ownerType, sweptOwner.ownerId))),
    [false, false, true],
  );

  // ── Backups and restores cover the folder; Clear media data empties it ──
  const source = (path: string) => readFileSync(new URL(`../../packages/server/src/${path}`, import.meta.url), "utf8");
  assert.match(
    source("routes/backup.routes.ts"),
    /const BACKUP_DIRS = \[[^\]]*"avatar-models",/u,
    "backups include it",
  );
  assert.match(
    source("routes/admin.routes.ts"),
    /filesDeleted\.avatarModels = clearDirectory\(join\(DATA_DIR, "avatar-models"\)\)/u,
  );
  const { stageProfileImportAssets } =
    await import("../../packages/server/src/services/import/profile-import-assets.js");
  const restoreDir = mkdtempSync(join(tmpdir(), "marinara-avatar-restore-"));
  try {
    const staged = await stageProfileImportAssets(restoreDir, [
      { path: "avatar-models/character/abc/pngtuber/layer.png", expectedSize: 6, read: () => Buffer.from("<html>") },
      { path: "avatar-models/character/abc/pngtuber/real.png", expectedSize: png.length, read: () => png },
      { path: "avatar-models/character/abc/vrm/model.vrm", expectedSize: 64, read: () => glb() },
    ]);
    assert.deepEqual(
      staged.skipped.map((entry) => entry.path),
      ["avatar-models/character/abc/pngtuber/layer.png"],
      "a restored PNGTuber layer must be an image",
    );
    assert.deepEqual(
      staged.assets.map((asset) => asset.path),
      ["avatar-models/character/abc/pngtuber/real.png", "avatar-models/character/abc/vrm/model.vrm"],
      "real layers and models restore",
    );
  } finally {
    rmSync(restoreDir, { recursive: true, force: true });
  }

  console.log("avatar models regression passed");
} finally {
  await app.close();
  await closeDB();
  rmSync(dir, { recursive: true, force: true });
}
