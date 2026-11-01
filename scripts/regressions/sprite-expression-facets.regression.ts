import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// #8637: faceted sprite names (emotion_outfit_condition) are offered to the Expression agent and resolved by
// dropping the lowest-priority facets, while legacy variant groups (happy_01, happy_blush) keep working.
const directory = mkdtempSync(join(tmpdir(), "marinara-sprite-facets-"));
process.env.DATA_DIR = directory;
const random = Math.random;
try {
  const { listCharacterSprites, listPartySprites } =
    await import("../../packages/server/src/services/game/sprite.service.js");
  const { buildAvailableSpriteCharacter, validateSpriteExpressionEntries } =
    await import("../../packages/server/src/routes/generate/expression-agent-utils.js");
  const { resolveSpriteExpression } = await import("../../packages/client/src/lib/sprite-expression-match.js");
  const { resolveSpriteDisplayExpression } =
    await import("../../packages/client/src/components/chat/sprite-display-expression.js");

  const library = (owner: string, handles: string[]) => {
    mkdirSync(join(directory, "sprites", owner), { recursive: true });
    for (const handle of handles) writeFileSync(join(directory, "sprites", owner, `${handle}.png`), "fixture");
    const available = buildAvailableSpriteCharacter(owner, "Owner", listCharacterSprites(owner)!, ["expressions"])!;
    const validate = (expression: string, roll = 0) => {
      Math.random = () => roll;
      return validateSpriteExpressionEntries([{ characterId: owner, expression }], [available]).expressions[0]
        ?.expression;
    };
    const sprites = handles.map((expression) => ({ expression, label: expression }));
    return { available, validate, sprites };
  };

  const faceted = library("faceted", [
    "angry_formalwear",
    "angry_formalwear_soaked_01",
    "angry_formalwear_soaked_02",
    "happy",
    "happy_formalwear",
    "happy_formalwear_wounded",
    "happy_pajamas_01",
    "happy_pajamas_02",
    "neutral",
  ]);

  // Listing: group keys stay, each facet combination is added once, variant numbers are never listed.
  const facetedChoices = [
    "angry",
    "angry_formalwear",
    "angry_formalwear_soaked",
    "happy",
    "happy_formalwear",
    "happy_formalwear_wounded",
    "happy_pajamas",
    "neutral",
  ];
  // Choices keep the catalog's file order, so compare them as sets.
  const sorted = (choices: string[] | undefined) => [...(choices ?? [])].sort();
  assert.deepEqual(sorted(faceted.available.expressionChoices), facetedChoices, "agent sees group keys and facets");
  assert.deepEqual(
    sorted(listPartySprites([{ id: "faceted", name: "Owner" }])[0]?.expressionChoices),
    facetedChoices,
    "the Game Master sees the same faceted names",
  );

  // Server: a listed faceted name picks among its own numbered variants only.
  assert.equal(faceted.validate("happy_pajamas", 0), "happy_pajamas_01");
  assert.equal(faceted.validate("happy_pajamas", 0.999), "happy_pajamas_02");
  assert.equal(faceted.validate("angry_formalwear_soaked", 0.999), "angry_formalwear_soaked_02");
  assert.equal(faceted.validate("happy_formalwear"), "happy_formalwear");
  assert.equal(faceted.validate("happy_pajamas_02", 0), "happy_pajamas_02", "a concrete handle is never rerolled");
  // Server fallback: drop the lowest-priority (last) facet first, keep the group key.
  assert.equal(faceted.validate("happy_pajamas_wounded", 0), "happy_pajamas_01", "missing condition keeps the outfit");
  assert.equal(faceted.validate("happy_pajamas_wounded", 0.999), "happy_pajamas_02", "fallback keeps variant rolls");
  assert.equal(faceted.validate("happy_formalwear_soaked"), "happy_formalwear", "a missing condition keeps the outfit");
  assert.equal(faceted.validate("happy_formalwear", 0.999), "happy_formalwear", "never rolls into further facets");
  assert.equal(faceted.validate("angry_formalwear_wet", 0.999), "angry_formalwear", "exact facets beat further ones");
  // No facet match falls back to the group key, which rolls over the whole group as before.
  const angryGroup = new Set(["angry_formalwear", "angry_formalwear_soaked_01", "angry_formalwear_soaked_02"]);
  const angryRolls = new Set([0, 0.5, 0.999].map((roll) => faceted.validate("angry_pajamas", roll)!));
  assert.deepEqual(angryRolls, angryGroup, "an unmatched facet falls back to every variant of the group key");
  const deeper = library("deeper", ["sad_armor_wounded_01", "sad_armor_wounded_02", "sad_casual"]);
  assert.equal(deeper.validate("sad_armor", 0.999), "sad_armor_wounded_02", "further facets keep the outfit");
  assert.equal(
    library("legacy-fallback", ["happy_01", "happy_02"]).validate("happy_pajamas", 0.999),
    "happy_02",
    "a faceted name against a numbered-only library falls back to the group instead of being removed",
  );
  assert.equal(faceted.validate("neutral"), "neutral");

  // Client: the same rule, deterministic (first matching sprite), ahead of fuzzy token containment.
  assert.equal(resolveSpriteExpression(faceted.sprites, "happy_pajamas")?.expression, "happy_pajamas_01");
  assert.equal(resolveSpriteExpression(faceted.sprites, "happy_pajamas_wounded")?.expression, "happy_pajamas_01");
  assert.equal(resolveSpriteExpression(faceted.sprites, "happy_wounded")?.expression, "happy", "facets are positional");
  assert.equal(resolveSpriteExpression(faceted.sprites, "angry_pajamas")?.expression, "angry_formalwear");
  assert.equal(
    resolveSpriteDisplayExpression(faceted.sprites, "happy_pajamas", ["expressions"])?.expression,
    "happy_pajamas_01",
    "the sprite overlay resolves faceted names before partial token matches",
  );

  // Legacy variant naming: the group key still selects among all of its variants.
  const legacy = library("legacy", ["happy_01", "happy_02", "happy_blush", "sad"]);
  assert.deepEqual(sorted(legacy.available.expressionChoices), ["happy", "happy_blush", "sad"]);
  assert.equal(legacy.validate("happy", 0), "happy_01");
  assert.equal(legacy.validate("happy", 0.5), "happy_02");
  assert.equal(legacy.validate("happy", 0.999), "happy_blush", "group key still rolls over every variant");
  assert.equal(legacy.validate("happy_blush"), "happy_blush");
  assert.equal(legacy.validate("happy_02"), "happy_02", "a concrete handle is kept");
  // A group key with a hyphen is still one group key: listed once and rolled over all of its variants.
  const hyphen = library("hyphen", ["half-smile", "half-smile_01", "half-smile_blush", "sad"]);
  assert.deepEqual(sorted(hyphen.available.expressionChoices), ["half-smile", "half_smile_blush", "sad"]);
  assert.deepEqual(
    new Set([0, 0.5, 0.999].map((roll) => hyphen.validate("half-smile", roll))),
    new Set(["half-smile", "half-smile_01", "half-smile_blush"]),
    "a hyphenated group key still rolls over every variant",
  );
  assert.equal(hyphen.validate("half_smile_blush"), "half-smile_blush", "its listed facet resolves");
  assert.equal(resolveSpriteExpression(legacy.sprites, "happy")?.expression, "happy_01");
  assert.equal(resolveSpriteExpression(legacy.sprites, "happy_blush")?.expression, "happy_blush");

  const numbered = library("numbered", ["sad", "sad_01", "sad_02", "neutral"]);
  assert.deepEqual(
    sorted(numbered.available.expressionChoices),
    ["neutral", "sad"],
    "numbered-only libraries list as before",
  );
  const frames = library("frames", ["happy", "happy_blink", "happy_pajamas", "happy_talk"]);
  assert.equal(
    resolveSpriteExpression(library("outfit-frames", ["happy", "happy_pajamas_talk"]).sprites, "happy_pajamas")
      ?.expression,
    "happy",
    "a talk frame is never shown as an outfit's face",
  );
  assert.equal(
    resolveSpriteExpression(library("outfit-frames-only", ["happy_pajamas_talk", "neutral"]).sprites, "happy_pajamas")
      ?.expression,
    "neutral",
    "with no face of its own, an outfit falls back past its talk frame",
  );
  assert.equal(
    resolveSpriteExpression(
      library("outfit-frames-only", ["happy_pajamas_talk", "neutral"]).sprites,
      "happy_pajamas_talk",
    )?.expression,
    "happy_pajamas_talk",
    "a frame asked for by name still shows",
  );
  const serverFrames = library("outfit-frames-server", [
    "happy_pajamas_talk",
    "happy_pajamas_blink",
    "happy_formalwear",
    "happy_01",
  ]);
  for (const roll of [0, 0.5, 0.999]) {
    const picked = serverFrames.validate("happy_pajamas", roll);
    assert.ok(
      picked === "happy_formalwear" || picked === "happy_01",
      `a faceted name with no face of its own falls back to the group, never a talk or blink frame (roll ${roll}: ${picked})`,
    );
  }
  assert.equal(
    serverFrames.validate("happy_pajamas_talk"),
    "happy_pajamas_talk",
    "a frame asked for by name still resolves",
  );
  const unrelated = library("outfit-unrelated", ["unhappy_pajamas", "happy_01", "happy_02"]);
  for (const roll of [0, 0.999]) {
    assert.match(
      unrelated.validate("happy_pajamas", roll) ?? "",
      /^happy_0[12]$/u,
      `a faceted name falls back to its own group before an unrelated name that contains it (roll ${roll})`,
    );
  }
  assert.equal(
    resolveSpriteDisplayExpression(
      [
        { expression: "full_happy_pajamas", label: "full_happy_pajamas" },
        { expression: "happy_pajamas_wounded_01", label: "happy_pajamas_wounded_01" },
      ],
      "happy_pajamas_wounded",
      ["expressions", "full-body"],
    )?.expression,
    "happy_pajamas_wounded_01",
    "the more specific portrait facet beats a shorter full-body fallback",
  );
  assert.deepEqual(
    sorted(frames.available.expressionChoices),
    ["happy", "happy_pajamas"],
    "PNGTuber frames are not facets",
  );
} finally {
  Math.random = random;
  rmSync(directory, { recursive: true, force: true });
}
