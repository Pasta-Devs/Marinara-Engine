import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

const directory = mkdtempSync(join(tmpdir(), "marinara-sprite-folders-"));
process.env.DATA_DIR = join(directory, "data");
const requireFromServer = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const app = requireFromServer("fastify")();
const png =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aU1cAAAAASUVORK5CYII=";
const owner = "sprite-folder-proof";
const base = `/api/sprites/${owner}`;
async function request(method: "GET" | "POST" | "PATCH" | "DELETE", url: string, payload?: unknown, status = 200) {
  const response = await app.inject({ method, url, payload });
  assert.equal(response.statusCode, status, response.body);
  return response;
}

try {
  const { spritesRoutes } = await import("../../packages/server/src/routes/sprites.routes.ts");
  const { listSpriteCatalog, readSpriteCatalog, activeOwnerSprites } =
    await import("../../packages/server/src/services/sprites/sprite-catalog.ts");
  const { listCharacterSprites, listPartySprites, readPreferredFullBodySpriteBase64 } =
    await import("../../packages/server/src/services/game/sprite.service.ts");
  const { buildAvailableSpriteCharacter, validateSpriteExpressionEntries } =
    await import("../../packages/server/src/routes/generate/expression-agent-utils.ts");
  const { restoreSprites } = await import("../../packages/server/src/services/import/marinara.importer.ts");
  const { resolveSpriteExpression } = await import("../../packages/client/src/lib/sprite-expression-match.ts");
  await app.register(spritesRoutes, { prefix: "/api/sprites" });
  const sourceDir = join(process.env.DATA_DIR, "sprites", owner);
  mkdirSync(sourceDir, { recursive: true });
  writeFileSync(join(sourceDir, "full_neutral.png"), Buffer.from(png.split(",")[1]!, "base64"));
  const legacy = listSpriteCatalog(owner).sprites[0]!;
  assert.equal(legacy.folderId, null);
  assert.equal(legacy.active, true);

  const frontResponse = (
    await request("POST", `${base}/folders`, {
      name: "Front view",
      description: "Facing the audience",
      category: "full-body",
    })
  ).json();
  const front = frontResponse.folders[0].id;
  const sideResponse = (await request("POST", `${base}/folders`, { name: "Side view", category: "full-body" })).json();
  const side = sideResponse.folders[1].id;
  await request("POST", `${base}/folders`, { name: "front VIEW", category: "full-body" }, 409);
  await request("POST", `${base}/move`, { expressions: [legacy.expression], folderId: front });
  assert.equal(listSpriteCatalog(owner).sprites[0]!.id, legacy.id, "moving keeps the asset identity");
  assert.equal(readFileSync(join(sourceDir, legacy.filename)).toString("base64"), png.split(",")[1]);
  assert.equal(activeOwnerSprites(owner).length, 1, "moving into a folder never hides sprites");
  await request("PATCH", `${base}/catalog`, { defaultFolderId: front });
  const original = (await request("POST", base, { expression: "full_happy", image: png, folderId: front })).json();
  const alternate = (await request("POST", base, { expression: "full_happy", image: png, folderId: side })).json();
  assert.notEqual(original.expression, alternate.expression, "equal labels in different folders never overwrite");
  assert.equal(alternate.label, "full_happy");
  await request("POST", base, { expression: "full_happy", image: png, folderId: front }, 409);
  const expressionFolder = (await request("POST", base + "/folders", { name: "Front view", category: "expressions" }))
    .json()
    .folders.find((folder: { category: string }) => folder.category === "expressions");
  await request("POST", base + "/move", { expressions: [legacy.expression], folderId: expressionFolder.id }, 400);
  await request("POST", base, { expression: "smile", image: png, folderId: front }, 400);

  const beforeOrder = listSpriteCatalog(owner);
  const reordered = (
    await request("POST", base + "/folders/reorder", {
      category: "full-body",
      orderedIds: [front, side],
    })
  ).json();
  assert.deepEqual(
    reordered.folders
      .filter((folder: { category: string }) => folder.category === "full-body")
      .map((folder: { id: string }) => folder.id),
    [side, front],
  );
  assert.deepEqual(
    reordered.sprites,
    beforeOrder.sprites,
    "reordering changes neither membership nor runtime availability",
  );
  assert.deepEqual(
    reordered.folders.filter((folder: { category: string }) => folder.category === "expressions"),
    [expressionFolder],
  );
  assert.equal(reordered.defaultFolderId, front);
  assert.deepEqual(readSpriteCatalog(owner).folders, reordered.folders, "folder order is persisted");
  for (const orderedIds of [
    [front],
    [front, front],
    [front, expressionFolder.id],
    [front, "00000000-0000-4000-8000-000000000000"],
  ]) {
    await request("POST", base + "/folders/reorder", { category: "full-body", orderedIds }, 409);
    assert.deepEqual(
      listSpriteCatalog(owner),
      reordered,
      "invalid or stale orders never partially overwrite a catalog",
    );
  }
  await request("POST", base + "/folders/reorder", { category: "full-body", orderedIds: ["invalid"] }, 400);
  await request("POST", base + "/folders/reorder", { orderedIds: [front, side] }, 400);
  await request(
    "POST",
    "/api/sprites/..%2Fescape/folders/reorder",
    { category: "full-body", orderedIds: [front, side] },
    400,
  );

  assert.equal(activeOwnerSprites(owner).length, 3, "all folders remain available despite the saved default");
  assert.ok(listSpriteCatalog(owner).sprites.every((sprite) => sprite.active));
  assert.equal(readPreferredFullBodySpriteBase64(owner)?.expression, "full_neutral");
  const available = buildAvailableSpriteCharacter(owner, "Proof", listCharacterSprites(owner)!, ["full-body"]);
  assert.deepEqual(available?.expressionChoices, ["happy", "neutral"]);
  const validated = validateSpriteExpressionEntries([{ characterId: owner, expression: "happy" }], [available!]);
  assert.ok(
    [original.expression.slice(5), alternate.expression.slice(5)].includes(validated.expressions[0]!.expression),
  );
  const party = listPartySprites([{ id: owner, name: "Proof" }], { spriteFolderOverrides: { [owner]: side } });
  assert.deepEqual(
    party[0]?.fullBody.slice().sort(),
    [legacy.expression.slice(5), original.expression.slice(5), alternate.expression.slice(5)].sort(),
    "legacy chat overrides cannot hide another folder",
  );
  assert.equal(available?.folderName, null);
  const beforeRename = Buffer.from(readFileSync(join(sourceDir, alternate.filename)));
  const renamed = (await request("PATCH", `${base}/${alternate.expression}`, { expression: "full_delighted" })).json();
  assert.equal(renamed.expression, alternate.expression, "a label change preserves saved file handles");
  assert.equal(renamed.id, alternate.id);
  assert.equal(renamed.label, "full_delighted");
  assert.deepEqual(readFileSync(join(sourceDir, alternate.filename)), beforeRename);
  assert.equal(resolveSpriteExpression(activeOwnerSprites(owner), "delighted")?.id, alternate.id);

  const exported = await request("POST", `${base}/export`, { folderName: "proof" });
  const AdmZip = requireFromServer("adm-zip");
  const zip = new AdmZip(exported.rawPayload);
  assert.ok(
    zip
      .getEntries()
      .some((entry: { entryName: string }) => entry.entryName === `proof/Side view/${alternate.filename}`),
  );
  const catalog = JSON.parse(zip.readAsText("proof/catalog.json"));
  assert.equal(catalog.defaultFolderId, front);
  assert.equal(catalog.sprites[alternate.expression].label, "full_delighted");
  const images = listSpriteCatalog(owner).sprites.map((sprite) => ({ filename: sprite.filename, data: png }));
  await restoreSprites(images, "restored-owner", readSpriteCatalog(owner));
  const restored = listSpriteCatalog("restored-owner");
  assert.equal(restored.folders.length, 3);
  assert.deepEqual(
    restored.folders,
    readSpriteCatalog(owner).folders,
    "exports and restores retain custom folder order",
  );
  assert.equal(restored.defaultFolderId, front);
  assert.equal(restored.sprites.find((sprite) => sprite.expression === alternate.expression)?.folderId, side);
  assert.equal(restored.sprites.find((sprite) => sprite.expression === alternate.expression)?.label, "full_delighted");

  await request("PATCH", `${base}/folders/${front}`, { name: "Front", description: "Main view" });
  assert.equal(listSpriteCatalog(owner).sprites.find((sprite) => sprite.id === legacy.id)?.folderName, "Front");
  await request("DELETE", `${base}/folders/${side}`);
  const retained = listSpriteCatalog(owner).sprites.find((sprite) => sprite.id === alternate.id)!;
  assert.equal(retained.folderId, null);
  assert.deepEqual(readFileSync(join(sourceDir, retained.filename)), beforeRename);
  assert.equal(
    activeOwnerSprites(owner).some((sprite) => sprite.id === alternate.id),
    true,
  );
  await request("POST", `${base}/move`, { expressions: ["not-there"], folderId: front }, 404);
  await request("PATCH", `${base}/catalog`, { defaultFolderId: "bad-id" }, 400);
  await request("POST", "/api/sprites/..%2Fescape/folders", { name: "Invalid" }, 400);
  await request("POST", base, { expression: "happy", image: png, folderId: "not-a-folder" }, 400);

  // Concurrent folder edits must merge through the owner queue, rather than lose one writer.
  await Promise.all([
    request("POST", `${base}/folders`, { name: "Outfit A" }),
    request("POST", `${base}/folders`, { name: "Outfit B" }),
  ]);
  assert.equal(listSpriteCatalog(owner).folders.length, 4);

  const legacyOwner = "legacy-mixed";
  const legacyDirectory = join(process.env.DATA_DIR!, "sprites", legacyOwner);
  mkdirSync(legacyDirectory, { recursive: true });
  writeFileSync(join(legacyDirectory, "happy.png"), Buffer.from(png.split(",")[1]!, "base64"));
  writeFileSync(join(legacyDirectory, "full_happy.png"), Buffer.from(png.split(",")[1]!, "base64"));
  writeFileSync(
    join(legacyDirectory, "catalog.json"),
    JSON.stringify({
      version: 1,
      folders: [{ id: front, name: "Mixed", description: "" }],
      defaultFolderId: front,
      sprites: {
        happy: { id: "face", label: "happy", folderId: front },
        full_happy: { id: "body", label: "full_happy", folderId: front },
      },
    }),
  );
  const split = listSpriteCatalog(legacyOwner);
  assert.equal(split.folders.length, 2);
  assert.equal(split.sprites.length, 2);
  assert.notEqual(split.sprites[0]!.folderId, split.sprites[1]!.folderId);
  assert.deepEqual(listSpriteCatalog(legacyOwner), split);
  writeFileSync(join(sourceDir, "constructor.png"), "legacy name");
  assert.equal(
    listSpriteCatalog(owner).sprites.find((sprite) => sprite.expression === "constructor")?.label,
    "constructor",
  );
} finally {
  await app.close();
  rmSync(directory, { recursive: true, force: true });
}
