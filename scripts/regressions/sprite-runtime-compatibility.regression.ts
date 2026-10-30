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
  const { writeSpriteCatalog, listSpriteCatalog } =
    await import("../../packages/server/src/services/sprites/sprite-catalog.js");
  const { resolveSpriteDisplayExpression } =
    await import("../../packages/client/src/components/chat/sprite-display-expression.js");
  const { resolveSpriteUrl } =
    await import("../../packages/client/src/features/tracker-panel/lib/sprite-expressions.js");
  const trackerSprites = ["fneutral", "fhappy"].map((expression) => ({
    expression,
    filename: `${expression}.png`,
    url: `/${expression}`,
  }));
  assert.equal(resolveSpriteUrl(trackerSprites, "happy"), "/fhappy", "tracker keeps legacy prefix matches");
  assert.equal(resolveSpriteUrl(trackerSprites, "FHAPPY"), "/fhappy", "saved handles remain case insensitive");
  const renamedTrackerSprites = trackerSprites.map((sprite) => ({
    ...sprite,
    label: sprite.expression === "fhappy" ? "delighted" : "neutral",
  }));
  assert.equal(resolveSpriteUrl(renamedTrackerSprites, "delighted"), "/fhappy", "tracker follows renamed labels");
  assert.equal(
    resolveSpriteUrl(renamedTrackerSprites, "fhappy"),
    "/fhappy",
    "saved handles keep their original picture",
  );
  assert.equal(resolveSpriteUrl(renamedTrackerSprites, "unavailable"), "/fneutral", "neutral fallback is retained");
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
    folders: [{ id: folder, name: "Side", category: "expressions" }],
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
  const familyOwner = "family-collision";
  const familyDirectory = join(directory, "sprites", familyOwner);
  mkdirSync(familyDirectory, { recursive: true });
  for (const handle of ["happy", "full_happy"]) writeFileSync(join(familyDirectory, `${handle}.png`), "fixture");
  const validateFamily = (expression: string, modes: ("expressions" | "full-body")[]) =>
    validateSpriteExpressionEntries(
      [{ characterId: familyOwner, expression }],
      [buildAvailableSpriteCharacter(familyOwner, "Owner", listCharacterSprites(familyOwner)!, modes)!],
    ).expressions[0]?.expression;
  for (const [portraitLabel, bodyLabel] of [
    ["pleased", "furious"],
    ["happy", "furious"],
    ["pleased", "happy"],
    ["happy", "happy"],
    ["pleased", "pleased"],
  ] as const) {
    await writeSpriteCatalog(familyOwner, {
      version: 1,
      folders: [],
      sprites: {
        happy: { id: "face", label: portraitLabel!, folderId: null },
        full_happy: { id: "body", label: `full_${bodyLabel}`, folderId: null },
      },
    });
    const combined = buildAvailableSpriteCharacter(familyOwner, "Owner", listCharacterSprites(familyOwner)!, [
      "expressions",
      "full-body",
    ])!;
    assert(combined.expressionChoices!.includes(portraitLabel!));
    assert(combined.expressionChoices!.includes(bodyLabel!));
    for (const [label, family, expected] of [
      [portraitLabel, "expressions", "happy"],
      [bodyLabel, "full-body", "full_happy"],
    ] as const) {
      const result = validateSpriteExpressionEntries([{ characterId: familyOwner, expression: label }], [combined]);
      assert.equal(result.expressions.length, 1, JSON.stringify(result.warnings));
      const handle = result.expressions[0]!.expression!;
      assert.equal(
        validateSpriteExpressionEntries(result.expressions, [combined], { resolvedHandles: true }).expressions[0]
          ?.expression,
        handle,
        "persisting finalized entries cannot reinterpret labels or reroll variants",
      );
      assert.equal(
        resolveSpriteDisplayExpression(listSpriteCatalog(familyOwner).sprites, handle, [family])?.expression,
        expected,
        `combined choice ${label} resolves to its concrete ${family} image`,
      );
    }
    assert.equal(validateFamily(portraitLabel, ["expressions"]), "happy");
    const bodyHandle = validateFamily(bodyLabel, ["full-body"])!;
    assert.equal(
      resolveSpriteDisplayExpression(listSpriteCatalog(familyOwner).sprites, bodyHandle, ["full-body"])?.expression,
      "full_happy",
    );
    if (portraitLabel === bodyLabel) {
      assert(!combined.expressions.includes("full_happy"), "unchanged shared choices keep their legacy handles");
      assert.equal(
        resolveSpriteDisplayExpression(listSpriteCatalog(familyOwner).sprites, "happy", ["expressions", "full-body"])
          ?.expression,
        "full_happy",
        "shared names retain the base Engine full-body preference",
      );
    } else {
      assert(combined.expressions.includes("full_happy"));
      assert.equal(
        resolveSpriteDisplayExpression(listSpriteCatalog(familyOwner).sprites, "happy", ["expressions", "full-body"])
          ?.expression,
        "happy",
        "a renamed family cannot steal a concrete portrait handle",
      );
      assert.equal(
        validateSpriteExpressionEntries([{ characterId: familyOwner, expression: "full_happy" }], [combined])
          .expressions[0]?.expression,
        "full_happy",
        "explicit family handles are not reinterpreted as another label",
      );
    }
  }
  const crossedBodies = [
    { expression: "full_cheer", label: "full_happy" },
    { expression: "full_happy", label: "full_furious" },
  ];
  assert.equal(resolveSpriteDisplayExpression(crossedBodies, "happy", ["full-body"])?.expression, "full_happy");
  assert.equal(resolveSpriteDisplayExpression(crossedBodies, "full_happy", ["full-body"])?.expression, "full_happy");
  assert.equal(resolveSpriteDisplayExpression(crossedBodies, "full_cheer", ["full-body"])?.expression, "full_cheer");
} finally {
  Math.random = random;
  rmSync(directory, { recursive: true, force: true });
}
