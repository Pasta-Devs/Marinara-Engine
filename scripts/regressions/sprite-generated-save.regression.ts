import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
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
  const { galleryRoutes } = await import("../../packages/server/src/routes/gallery.routes.js");
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
  app.decorate("db", await getDB());
  await app.register(spritesRoutes, { prefix: "/api/sprites" });
  await app.register(galleryRoutes, { prefix: "/api/gallery" });
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

  const oldName = await request("POST", base, { expression: "curious", image, folderId: null });
  await request("PATCH", `${base}/${oldName.expression}`, { expression: "amused" });
  const generated = await request("POST", base, {
    expression: "curious",
    image: nextImage,
    folderId: null,
    replaceExisting: true,
  });
  assert.notEqual(generated.expression, oldName.expression, "generation cannot overwrite a renamed image");
  assert.deepEqual(readFileSync(join(files, oldName.filename)), originalBytes);
  assert.equal(
    listSpriteCatalog(owner).sprites.find((sprite) => sprite.expression === oldName.expression)?.label,
    "amused",
  );

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
  const { characterDataSchema, createChatSchema } = await import("../../packages/shared/dist/index.js");
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
  const mixedCaseFile = join(directory, "sprites", mariOwner.id, "happy.JPG");
  renameSync(join(directory, "sprites", mariOwner.id, assigned[0]!.filename), mixedCaseFile);
  await assign("happy");
  assert.equal(listSpriteCatalog(mariOwner.id).sprites[0]!.filename, "happy.JPG");
  assert.deepEqual(readFileSync(mixedCaseFile), jpeg, "Mari preserves mixed-case replacement filenames");
  const folder = (await request("POST", mariBase + "/folders", { name: "Other" })).folders[0].id;
  await request("POST", mariBase, { expression: "delighted", image, folderId: folder });
  await request("PATCH", `${mariBase}/happy`, { expression: "joy" });
  await request("PATCH", `${mariBase}/delighted`, { expression: "joy" });
  const beforeAmbiguous = listSpriteCatalog(mariOwner.id);
  await assert.rejects(assign("joy"), /More than one sprite/);
  assert.deepEqual(listSpriteCatalog(mariOwner.id), beforeAmbiguous);
  const removeSprite = (expression: string) =>
    mari.execute(["delete", "--target", "sprite", "--owner", mariOwner.id, "--expression", expression, "--apply"], {
      command: "mari images delete",
      sessionId: "fixture",
    });
  await assert.rejects(() => removeSprite("joy"), /More than one sprite/);
  await request("PATCH", `${mariBase}/happy`, { expression: "joyful" });
  await removeSprite("joy");
  assert.deepEqual(
    listSpriteCatalog(mariOwner.id).sprites.map((sprite) => sprite.expression),
    ["happy"],
  );
  assert(
    !Object.hasOwn(
      JSON.parse(readFileSync(join(directory, "sprites", mariOwner.id, "catalog.json"), "utf8")).sprites,
      "delighted",
    ),
  );

  const beforeCatalogSprite = listSpriteCatalog(owner);
  const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
  const chat = await createChatsStorage(db).create(
    createChatSchema.parse({ name: "Sprite asset proof", mode: "roleplay", characterIds: [mariOwner.id] }),
  );
  assert(chat);
  const browserAssets = await app.inject({ method: "GET", url: `/api/gallery/assets/${chat.id}` });
  assert.equal(browserAssets.statusCode, 200, browserAssets.body);
  const asset = browserAssets.json().find((entry: { kind: string }) => entry.kind === "sprite");
  assert.equal(asset.name, "joyful", "the asset browser shows the edited label");
  const remaining = listSpriteCatalog(mariOwner.id).sprites[0]!;
  assert(asset.cardUrl.endsWith(remaining.filename), "portable concrete URLs retain the file handle");
  for (const target of [remaining.filename, "joyful.png"]) {
    const linkedImage = await app.inject({
      method: "GET",
      url: `/api/gallery/asset/${chat.id}/sprites/facial/${target}`,
    });
    assert.equal(linkedImage.statusCode, 200, linkedImage.body);
    assert.deepEqual(linkedImage.rawPayload, jpeg);
  }
  const filenameOwner = (await createCharactersStorage(db).create(
    characterDataSchema.parse({ name: "Filename proof" }),
  ))!;
  const persona = (await createCharactersStorage(db).createPersona("Sprite persona proof", ""))!;
  const partyChat = await createChatsStorage(db).create(
    createChatSchema.parse({
      name: "Cross-owner sprite proof",
      mode: "roleplay",
      characterIds: [mariOwner.id, filenameOwner.id],
      personaId: persona.id,
    }),
  );
  assert(partyChat);
  for (const [category, prefix] of [
    ["facial", ""],
    ["fullbody", "full_"],
  ] as const) {
    for (const [handle, label] of [
      ["smile", "grin"],
      ["greet", "wave"],
    ]) {
      await request("POST", mariBase, { expression: prefix + handle, image, folderId: null });
      await request("PATCH", `${mariBase}/${prefix}${handle}`, { expression: prefix + label });
    }
    await request("POST", `/api/sprites/${filenameOwner.id}`, { expression: prefix + "grin", image: nextImage });
    await request("POST", `/api/sprites/${persona.id}`, { expression: prefix + "wave", image: nextImage });
    for (const target of ["grin", "grin.png", "wave", "wave.png"]) {
      const linked = await app.inject({
        method: "GET",
        url: `/api/gallery/asset/${partyChat.id}/sprites/${category}/${target}`,
      });
      assert.equal(linked.statusCode, 200, linked.body);
      assert.deepEqual(linked.rawPayload, nextBytes, "filenames on later characters/personas precede earlier labels");
    }
    const deleted = await app.inject({ method: "DELETE", url: `/api/sprites/${filenameOwner.id}/${prefix}grin` });
    assert.equal(deleted.statusCode, 204, deleted.body);
    for (const target of ["grin", "grin.png"]) {
      const linked = await app.inject({
        method: "GET",
        url: `/api/gallery/asset/${partyChat.id}/sprites/${category}/${target}`,
      });
      assert.equal(linked.statusCode, 200, linked.body);
      assert.deepEqual(
        linked.rawPayload,
        originalBytes,
        "labels remain a fallback when no participant has the filename",
      );
    }
  }
  const catalogSprite = await request("POST", base, { expression: "catalog", image, folderId: first });
  const removed = await app.inject({ method: "DELETE", url: `${base}/catalog` });
  assert.equal(removed.statusCode, 204, removed.body);
  assert(existsSync(join(files, "catalog.json")), "deleting catalog.png must preserve folder metadata");
  assert(!existsSync(join(files, catalogSprite.filename)));
  assert.deepEqual(listSpriteCatalog(owner), beforeCatalogSprite);
  assert(!Object.hasOwn(JSON.parse(readFileSync(join(files, "catalog.json"), "utf8")).sprites, "catalog"));

  for (const mime of ["bmp", "tiff", "heic", "png"]) {
    await request(
      "POST",
      base,
      {
        expression: original.expression,
        image: `data:image/${mime};base64,${(mime === "png" ? Buffer.from("invalid") : nextBytes).toString("base64")}`,
      },
      400,
    );
    assert.deepEqual(readFileSync(join(files, original.filename)), originalBytes);
  }
  await request("POST", base, { expression: "a".repeat(161), image }, 400);
  await request("PATCH", `${base}/${original.expression}`, { expression: "a".repeat(161) }, 400);
  const longHandle = "b".repeat(161);
  writeFileSync(join(files, `${longHandle}.png`), originalBytes);
  await request("POST", base + "/move", { expressions: [longHandle], folderId: first });
  assert.equal(listSpriteCatalog(owner).sprites.find((sprite) => sprite.expression === longHandle)?.label.length, 160);

  const mixedBase = "/api/sprites/mixed-case";
  const mixedFolder = (await request("POST", mixedBase + "/folders", { name: "Other" })).folders[0].id;
  const mixedFile = join(directory, "sprites", "mixed-case", "Happy.PNG");
  writeFileSync(mixedFile, originalBytes);
  const mixed = await request("POST", mixedBase, { expression: "happy", image: nextImage, folderId: mixedFolder });
  assert.notEqual(mixed.expression.toLowerCase(), "happy", "case-insensitive collisions get a separate file handle");
  assert.deepEqual(readFileSync(mixedFile), originalBytes);
  const replacement = await request("POST", mixedBase, { expression: "Happy", image: nextImage });
  assert.equal(replacement.filename, "Happy.PNG", "case-only filename differences must not unlink the replacement");
  assert.deepEqual(readFileSync(mixedFile), nextBytes);
  const mariCatalog = join(directory, "sprites", mariOwner.id, "catalog.json");
  const beforeSvg = readFileSync(mariCatalog);
  const svg = Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"><rect width="2" height="2" fill="blue"/></svg>',
  );
  const drawing = await request("POST", mariBase, {
    expression: "drawing",
    image: `data:image/svg+xml;base64,${svg.toString("base64")}`,
    folderId: folder,
  });
  await request("PATCH", `${mariBase}/drawing`, { expression: "sketch" });
  await removeSprite("sketch");
  assert(!existsSync(join(directory, "sprites", mariOwner.id, drawing.filename)), "Mari deletes SVG files by label");
  assert.deepEqual(readFileSync(mariCatalog), beforeSvg, "other sprite metadata and folders are preserved");
  const layered = await request("POST", mariBase, { expression: "layered", image, folderId: folder });
  const companion = join(directory, "sprites", mariOwner.id, "layered.svg");
  writeFileSync(companion, svg);
  await removeSprite(layered.expression);
  assert(!existsSync(join(directory, "sprites", mariOwner.id, layered.filename)));
  assert(!existsSync(companion), "all listed files for the same handle are removed");
  assert.deepEqual(readFileSync(mariCatalog), beforeSvg);
  await removeSprite("not_uploaded");
  assert.deepEqual(readFileSync(mariCatalog), beforeSvg, "a no-op delete must not rewrite the catalog");
} finally {
  await app.close();
  await closeDB();
  rmSync(directory, { recursive: true, force: true });
}
