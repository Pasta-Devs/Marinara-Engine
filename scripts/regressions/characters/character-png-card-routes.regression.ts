// Character cards through the real character and import routes, on the runner's throwaway data folder:
// - a PNG card carries the character's sprites, and importing it puts them under the new character;
// - a sprite set too large for a PNG card is refused, and an oversized sprite is never read into memory;
// - replacing the avatar with a card's data waits for an edit in progress, and drops another character's
//   gallery image;
// - a .charx is not refused for holding many or large files.
import assert from "node:assert/strict";
import fs from "node:fs";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "silent";
const dataDir = process.env.DATA_DIR!;
assert.ok(dataDir, "the regression runner provides a throwaway DATA_DIR");

const { default: Fastify } = await import("../../../packages/server/node_modules/fastify/fastify.js");
const { default: multipart } = await import("../../../packages/server/node_modules/@fastify/multipart/index.js");
const { default: AdmZip } = await import("../../../packages/server/node_modules/adm-zip/adm-zip.js");
const { characterDataSchema } = await import("../../../packages/shared/src/index.ts");
const { MAX_FILE_SIZES } = await import("../../../packages/shared/src/constants/defaults.ts");
const { closeDB, getDB } = await import("../../../packages/server/src/db/connection.js");
const { errorHandler } = await import("../../../packages/server/src/middleware/error-handler.js");
const { charactersRoutes } = await import("../../../packages/server/src/routes/characters.routes.js");
const { importRoutes } = await import("../../../packages/server/src/routes/import.routes.js");
const { createCharactersStorage, withCharacterUpdateQueue } =
  await import("../../../packages/server/src/services/storage/characters.storage.js");
const { createCharacterGalleryStorage } =
  await import("../../../packages/server/src/services/storage/character-gallery.storage.js");
const { listSpriteCatalog } = await import("../../../packages/server/src/services/sprites/sprite-catalog.ts");

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aU1cAAAAASUVORK5CYII=",
  "base64",
);
const db = await getDB();
const app = Fastify();
app.decorate("db", db);
app.setErrorHandler(errorHandler);
await app.register(multipart);
await app.register(charactersRoutes, { prefix: "/api/characters" });
await app.register(importRoutes, { prefix: "/api/import" });
const upload = (filename: string, bytes: Buffer) => {
  const boundary = "marinara-png-card";
  return app.inject({
    method: "POST",
    url: "/api/import/st-character",
    headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
    payload: Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
          "Content-Type: application/octet-stream\r\n\r\n",
      ),
      bytes,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]),
  });
};
const characters = createCharactersStorage(db);
const cardData = async (id: string) => JSON.parse((await characters.getById(id))!.data);
try {
  // A PNG card carries the sprites, and its import restores them under the new character.
  const owner = (await characters.create(characterDataSchema.parse({ name: "Sprite Card" })))!;
  const spriteDir = join(dataDir, "sprites", owner.id);
  mkdirSync(spriteDir, { recursive: true });
  const happy = Buffer.concat([png, Buffer.from("happy")]);
  const sad = Buffer.concat([png, Buffer.from("sad")]);
  writeFileSync(join(spriteDir, "happy.png"), happy);
  writeFileSync(join(spriteDir, "sad.png"), sad);
  const exported = await app.inject({ method: "GET", url: `/api/characters/${owner.id}/export-png` });
  assert.equal(exported.statusCode, 200, exported.body);
  const imported = await upload("Sprite Card.png", exported.rawPayload);
  assert.equal(imported.statusCode, 200, imported.body);
  const importedId = imported.json().characterId as string;
  assert.ok(importedId && importedId !== owner.id, imported.body);
  assert.deepEqual(
    listSpriteCatalog(importedId)
      .sprites.map((sprite) => sprite.expression)
      .sort(),
    ["happy", "sad"],
    "the imported character has the card's sprites",
  );
  assert.deepEqual(readFileSync(join(dataDir, "sprites", importedId, "happy.png")), happy);
  assert.deepEqual(readFileSync(join(dataDir, "sprites", importedId, "sad.png")), sad);

  // A sprite over the PNG card limit is refused before it is read.
  writeFileSync(join(spriteDir, "huge.png"), Buffer.concat([png, Buffer.alloc(MAX_FILE_SIZES.SPRITE)]));
  const read: string[] = [];
  const readFile = fs.promises.readFile;
  fs.promises.readFile = ((path: Parameters<typeof readFile>[0], ...rest: unknown[]) => {
    read.push(String(path));
    return (readFile as (...args: unknown[]) => unknown)(path, ...rest);
  }) as typeof readFile;
  syncBuiltinESMExports();
  try {
    const refused = await app.inject({ method: "GET", url: `/api/characters/${owner.id}/export-png` });
    assert.equal(refused.statusCode, 413, refused.body);
    assert.equal(refused.json().error, "Sprite collection exceeds compatible PNG export limits");
  } finally {
    fs.promises.readFile = readFile;
    syncBuiltinESMExports();
  }
  assert.ok(!read.some((path) => path.endsWith("huge.png")), "the oversized sprite is never read");

  // Replacing the avatar with a card's data keeps only this character's own gallery images.
  const other = (await characters.create(characterDataSchema.parse({ name: "Other" })))!;
  const gallery = createCharacterGalleryStorage(db);
  const ownImage = await gallery.create({ characterId: owner.id, filePath: `characters/${owner.id}/own.png` });
  const otherImage = await gallery.create({ characterId: other.id, filePath: `characters/${other.id}/other.png` });
  const replaceAvatar = (description: string, characterSheetImageId: string) =>
    app.inject({
      method: "POST",
      url: `/api/characters/${owner.id}/avatar`,
      payload: {
        avatar: `data:image/png;base64,${png.toString("base64")}`,
        data: { description, extensions: { characterSheetImageId, useCharacterSheetAsReference: true } },
      },
    });
  const own = await replaceAvatar("Own sheet", ownImage.id);
  assert.equal(own.statusCode, 200, own.body);
  assert.equal((await cardData(owner.id)).extensions.characterSheetImageId, ownImage.id, "its own image is kept");
  const foreign = await replaceAvatar("Foreign sheet", otherImage.id);
  assert.equal(foreign.statusCode, 200, foreign.body);
  const afterForeign = await cardData(owner.id);
  assert.equal(afterForeign.description, "Foreign sheet");
  assert.equal(afterForeign.extensions.characterSheetImageId, null, "another character's image is dropped");
  assert.equal(afterForeign.extensions.useCharacterSheetAsReference, false);

  // An edit already in progress for this character finishes before the card is written.
  const avatarsDir = join(dataDir, "avatars");
  const avatarCount = readdirSync(avatarsDir).length;
  let release!: () => void;
  const edit = withCharacterUpdateQueue(owner.id, () => new Promise<void>((resolve) => (release = resolve)));
  const queued = replaceAvatar("Queued", ownImage.id);
  for (let waited = 0; readdirSync(avatarsDir).length === avatarCount; waited += 10) {
    assert.ok(waited < 5_000, "the route saves the new avatar file");
    await delay(10);
  }
  await delay(200);
  assert.equal((await cardData(owner.id)).description, "Foreign sheet", "the card waits for the edit in progress");
  release();
  await edit;
  assert.equal((await queued).statusCode, 200);
  assert.equal((await cardData(owner.id)).description, "Queued");

  // A .charx is not refused for holding many files, or a large one.
  const charx = new AdmZip();
  charx.addFile(
    "card.json",
    Buffer.from(JSON.stringify({ spec: "chara_card_v3", spec_version: "3.0", data: { name: "Big Archive" } })),
  );
  for (let index = 0; index < 600; index++) charx.addFile(`assets/other/image/${index}.png`, png);
  charx.addFile("assets/other/image/large.png", Buffer.concat([png, Buffer.alloc(65 * 1024 * 1024)]));
  const archive = await upload("Big Archive.charx", charx.toBuffer());
  assert.equal(archive.statusCode, 200, archive.body);
  assert.equal(archive.json().success, true, archive.body);
  assert.equal((await cardData(archive.json().characterId)).name, "Big Archive");
  console.info("Character PNG card and avatar routes keep sprites, limits, gallery owners and edit order.");
} finally {
  await app.close();
  await closeDB();
}
