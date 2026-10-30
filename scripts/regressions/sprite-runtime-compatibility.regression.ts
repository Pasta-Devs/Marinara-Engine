import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

const directory = mkdtempSync(join(tmpdir(), "marinara-sprite-compatibility-"));
process.env.DATA_DIR = directory;
const random = Math.random;
try {
  const { listCharacterSprites } = await import("../../packages/server/src/services/game/sprite.service.js");
  const { buildAvailableSpriteCharacter, validateSpriteExpressionEntries, completeRequiredSpriteExpressionEntries } =
    await import("../../packages/server/src/routes/generate/expression-agent-utils.js");
  const { writeSpriteCatalog } = await import("../../packages/server/src/services/sprites/sprite-catalog.js");
  const owner = "compatibility";
  const sprites = join(directory, "sprites", owner);
  mkdirSync(sprites, { recursive: true });
  for (const expression of ["happy", "happy_alt", "sad", "sad_01", "sad_02", "neutral", "full_idle", "full_happy"])
    writeFileSync(join(sprites, `${expression}.png`), "fixture");
  const before = listCharacterSprites(owner)!;
  const validate = (expression: string, modes: ("expressions" | "full-body")[] = ["expressions"]) =>
    validateSpriteExpressionEntries(
      [{ characterId: owner, expression }],
      [buildAvailableSpriteCharacter(owner, "Owner", listCharacterSprites(owner)!, modes)!],
    ).expressions[0]?.expression;
  Math.random = () => 0;
  assert.equal(validate("happy"), "happy", "one suffix variant must not replace an existing exact expression");
  Math.random = () => 0.999;
  assert.equal(validate("sad"), "sad_02", "multiple suffix variants retain original group randomization");
  const folder = randomUUID();
  await writeSpriteCatalog(owner, {
    version: 1,
    defaultFolderId: folder,
    folders: [{ id: folder, name: "Side", description: "", category: "expressions" }],
    sprites: { happy: { id: "happy", label: "happy", folderId: folder } },
  });
  const after = listCharacterSprites(owner)!;
  for (const key of ["expressions", "fullBody", "automaticFullBody"] as const)
    assert.deepEqual(after[key], before[key], "folder membership leaves runtime handles unchanged");
  assert.equal(validate("happy"), "happy");
  const duplicateHandle = "happy_sprite_abcdef123456";
  writeFileSync(join(sprites, `${duplicateHandle}.png`), "fixture");
  await writeSpriteCatalog(owner, {
    version: 1,
    defaultFolderId: null,
    folders: [],
    sprites: { [duplicateHandle]: { id: "duplicate", label: "happy", folderId: null } },
  });
  assert.equal(
    validate(duplicateHandle),
    duplicateHandle,
    "an explicit duplicate handle is never rerolled to another asset",
  );
  // Renaming a portrait must not rename a full-body pose that shares its base handle.
  await writeSpriteCatalog(owner, {
    version: 1,
    defaultFolderId: null,
    folders: [],
    sprites: {
      happy: { id: "happy", label: "delighted", folderId: null },
      [duplicateHandle]: { id: "duplicate", label: "happy", folderId: null },
    },
  });
  assert.deepEqual(
    buildAvailableSpriteCharacter(owner, "Owner", listCharacterSprites(owner)!, ["full-body"])?.expressionChoices,
    ["happy", "idle"],
  );
  assert.equal(validate("delighted"), "happy", "renamed labels resolve to saved file handles");
  assert.equal(
    validate("happy"),
    duplicateHandle,
    "a semantic choice follows the current label instead of an asset renamed away from it",
  );
  await writeSpriteCatalog(owner, {
    version: 1,
    defaultFolderId: null,
    folders: [],
    sprites: { sad: { id: "sad", label: "angry", folderId: null } },
  });
  const available = buildAvailableSpriteCharacter(owner, "Owner", listCharacterSprites(owner)!, ["expressions"])!;
  assert.equal(
    completeRequiredSpriteExpressionEntries([], [available], [owner], {
      defaultSourceText: "Owner is angry and furious.",
    }).expressions[0]?.expression,
    "sad",
    "omitted-owner fallback uses the current label and persists the concrete handle",
  );
} finally {
  Math.random = random;
  rmSync(directory, { recursive: true, force: true });
}
