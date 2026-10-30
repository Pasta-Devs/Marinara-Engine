import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

const directory = mkdtempSync(join(tmpdir(), "marinara-generated-sprite-save-"));
process.env.DATA_DIR = directory;
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const requireFromServer = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const app = requireFromServer("fastify")();
const owner = "generated-save";
const base = `/api/sprites/${owner}`;
async function request(method: "POST" | "PATCH", url: string, payload: unknown, status = 200) {
  const response = await app.inject({ method, url, payload });
  assert.equal(response.statusCode, status, response.body);
  return response.json();
}
try {
  const { spritesRoutes } = await import("../../packages/server/src/routes/sprites.routes.js");
  const { listSpriteCatalog } = await import("../../packages/server/src/services/sprites/sprite-catalog.js");
  const { getSharp } = await import("../../packages/server/src/services/image/sharp-runtime.js");
  const sharp = await getSharp();
  const originalBytes = await sharp({
    create: { width: 2, height: 2, channels: 4, background: { r: 25, g: 90, b: 140, alpha: 1 } },
  })
    .png()
    .toBuffer();
  const nextBytes = await sharp(originalBytes).negate().png().toBuffer();
  const image = `data:image/png;base64,${originalBytes.toString("base64")}`;
  const nextImage = `data:image/png;base64,${nextBytes.toString("base64")}`;
  const files = join(directory, "sprites", owner);
  await app.register(spritesRoutes, { prefix: "/api/sprites" });
  const loose = await request("POST", base, { expression: "neutral", image, folderId: null });
  const regenerated = await request("POST", base, {
    expression: "neutral",
    image: nextImage,
    folderId: null,
    replaceExisting: true,
  });
  assert.equal(regenerated.expression, loose.expression);
  assert.equal(regenerated.folderId, null);
  assert.deepEqual(readFileSync(join(files, regenerated.filename)), nextBytes);
  assert.equal(listSpriteCatalog(owner).sprites.length, 1);

  const first = (await request("POST", base + "/folders", { name: "First", category: "expressions" })).folders[0].id;
  const second = (await request("POST", base + "/folders", { name: "Second", category: "expressions" })).folders[1].id;
  const original = await request("POST", base, { expression: "happy", image, folderId: first });
  const duplicate = await request("POST", base, { expression: "happy", image, folderId: second });
  await request("PATCH", `${base}/${duplicate.expression}`, { expression: "delighted" });
  const renamed = await request("POST", base, {
    expression: "delighted",
    image: nextImage,
    folderId: second,
    replaceExisting: true,
  });
  assert.equal(
    renamed.expression,
    duplicate.expression,
    "regeneration follows the current label, preserving the handle",
  );
  assert.equal(renamed.filename, duplicate.filename);
  assert.equal(renamed.folderId, second);
  assert.deepEqual(readFileSync(join(files, renamed.filename)), nextBytes);
  assert.deepEqual(readFileSync(join(files, original.filename)), originalBytes, "other folders are untouched");
  await request("POST", base, { expression: "delighted", image, folderId: second }, 409);

  const newLoose = await request("POST", base, {
    expression: "happy",
    image: nextImage,
    folderId: null,
    replaceExisting: true,
  });
  assert.notEqual(newLoose.expression, original.expression, "generation cannot overwrite a different destination");
  assert.equal(newLoose.folderId, null);
  assert.deepEqual(readFileSync(join(files, original.filename)), originalBytes);

  const jpeg = await sharp(originalBytes).jpeg().toBuffer();
  for (const scoped of [true, false]) {
    const expression = scoped ? "full_neutral" : "full_idle";
    const oldFormat = await request("POST", base, {
      expression,
      image: `data:image/jpeg;base64,${jpeg.toString("base64")}`,
      folderId: null,
    });
    const newFormat = await request("POST", base, {
      expression,
      image: nextImage,
      ...(scoped ? { folderId: null } : {}),
      replaceExisting: true,
    });
    assert.equal(newFormat.expression, oldFormat.expression);
    assert(!existsSync(join(files, oldFormat.filename)), "format changes leave one concrete sprite file");
    assert.deepEqual(readFileSync(join(files, newFormat.filename)), nextBytes);
    assert.equal(listSpriteCatalog(owner).sprites.filter((sprite) => sprite.expression === expression).length, 1);
  }

  const sameLabel = await request("POST", base, { expression: "delighted", image, folderId: first });
  await request("POST", base + "/move", { expressions: [sameLabel.expression], folderId: second });
  const before = listSpriteCatalog(owner);
  await request("POST", base, { expression: "delighted", image, folderId: second, replaceExisting: true }, 409);
  assert.deepEqual(listSpriteCatalog(owner), before, "ambiguous labels cannot choose a replacement arbitrarily");
  assert.deepEqual(readFileSync(join(files, renamed.filename)), nextBytes);
  assert.deepEqual(readFileSync(join(files, sameLabel.filename)), originalBytes);
  await request("POST", base, { expression: duplicate.expression, image });
  assert.deepEqual(
    readFileSync(join(files, duplicate.filename)),
    originalBytes,
    "explicit details replacement still works",
  );
  assert.equal(
    listSpriteCatalog(owner).sprites.find((sprite) => sprite.expression === duplicate.expression)?.folderId,
    second,
  );

  const { createCharactersStorage } = await import("../../packages/server/src/services/storage/characters.storage.js");
  const { characterDataSchema } = await import("../../packages/shared/dist/index.js");
  const { MariImagesService } = await import("../../packages/server/src/services/mari-db/mari-images.service.js");
  const db = await getDB();
  const mariOwner = (await createCharactersStorage(db).create(characterDataSchema.parse({ name: "Sprite proof" })))!;
  const mariBase = `/api/sprites/${mariOwner.id}`;
  const mariSprite = await request("POST", mariBase, { expression: "happy", image, folderId: null });
  await request("PATCH", `${mariBase}/happy`, { expression: "delighted" });
  const source = join(directory, "source.jpg");
  writeFileSync(source, jpeg);
  const mari = new MariImagesService(db);
  const assign = (expression: string) =>
    mari.execute(
      [
        "assign",
        "--target",
        "sprite",
        "--owner",
        mariOwner.id,
        "--expression",
        expression,
        "--source",
        source,
        "--apply",
      ],
      { command: "mari images assign", sessionId: "fixture" },
    );
  await assign("happy");
  const assigned = listSpriteCatalog(mariOwner.id).sprites;
  assert.equal(assigned.length, 1, "Mari replacement follows the stable handle, without making a second sprite");
  assert.equal(assigned[0]!.label, "delighted");
  assert(!existsSync(join(directory, "sprites", mariOwner.id, mariSprite.filename)));
  const folder = (await request("POST", mariBase + "/folders", { name: "Other" })).folders[0].id;
  await request("POST", mariBase, { expression: "delighted", image, folderId: folder });
  await request("PATCH", `${mariBase}/happy`, { expression: "joy" });
  await request("PATCH", `${mariBase}/delighted`, { expression: "joy" });
  const beforeAmbiguous = listSpriteCatalog(mariOwner.id);
  await assert.rejects(assign("joy"), /More than one sprite/);
  assert.deepEqual(listSpriteCatalog(mariOwner.id), beforeAmbiguous);
} finally {
  await app.close();
  await closeDB();
  rmSync(directory, { recursive: true, force: true });
}
