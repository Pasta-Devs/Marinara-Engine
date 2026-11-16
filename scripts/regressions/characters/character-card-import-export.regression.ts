// Character cards in and out: merging an imported card into the saved one, the V2 export with its embedded sprites
// and their limits, gallery references on update, and validating card data on save and on native import.
import assert from "node:assert/strict";
import {
  buildCompatibleCharacterExport,
  validateCharacterGalleryReferences,
} from "../../../packages/server/src/routes/characters.routes.js";
import {
  embeddedSpriteSizesAreWithinLimits,
  MAX_EMBEDDED_SPRITE_COUNT,
} from "../../../packages/server/src/services/import/marinara.importer.js";
import { takeEmbeddedMarinaraSprites } from "../../../packages/server/src/services/import/st-character.importer.js";
import { characterDataSchema, updateCharacterSchema } from "../../../packages/shared/src/schemas/character.schema.js";
import { MAX_FILE_SIZES } from "../../../packages/shared/src/constants/defaults.js";
import { normalizeNativeCharacterData } from "../../../packages/server/src/services/import/marinara.importer.js";
import { mergeEmbeddedCharacterCardFields } from "../../../packages/client/src/lib/character-import.js";
import { type CharacterData } from "../../../packages/shared/src/index.js";

const existingCharacterCard = {
  name: "Old name",
  description: "Old description",
  personality: "Keep this personality",
  scenario: "Old scenario",
  first_mes: "Old greeting",
  mes_example: "Old example",
  creator_notes: "Old notes",
  system_prompt: "Old system prompt",
  post_history_instructions: "Old reminder",
  tags: ["old-tag"],
  creator: "Old creator",
  character_version: "1.0",
  alternate_greetings: ["Old alternate"],
  extensions: {
    talkativeness: 0.5,
    fav: true,
    world: "Old world",
    depth_prompt: { prompt: "Keep depth", depth: 4, role: "system" },
    backstory: "Old backstory",
    appearance: "Old appearance",
    nameColor: "#123456",
  },
  character_book: null,
} satisfies CharacterData;
const replacedCharacterCard = mergeEmbeddedCharacterCardFields(existingCharacterCard, {
  spec: "chara_card_v3",
  data: {
    name: "Updated name",
    description: "Updated description",
    scenario: "",
    tags: ["updated-tag"],
    extensions: { backstory: "Updated backstory", appearance: "Updated appearance" },
  },
});
assert.ok(replacedCharacterCard, "Embedded character metadata must be recognized during avatar replacement");
assert.equal(replacedCharacterCard.name, "Updated name");
assert.equal(replacedCharacterCard.description, "Updated description");
assert.equal(replacedCharacterCard.scenario, "", "Explicitly cleared card fields must stay cleared");
assert.deepEqual(replacedCharacterCard.tags, ["updated-tag"]);
assert.equal(replacedCharacterCard.extensions.backstory, "Updated backstory");
assert.equal(replacedCharacterCard.extensions.appearance, "Updated appearance");
assert.equal(replacedCharacterCard.personality, "Keep this personality", "Missing card fields must remain untouched");
assert.equal(replacedCharacterCard.extensions.nameColor, "#123456", "Local display extensions must be preserved");
const portableSprites = [
  { filename: "happy.png", data: "data:image/png;base64,iVBORw0KGgo=" },
  { filename: "full_idle.webp", data: "data:image/webp;base64,UklGRg==" },
];
const compatibleSpriteSource = {
  name: "Portable Sprite Card",
  extensions: {
    characterSheetImageId: "local-gallery-id",
    useCharacterSheetAsReference: true,
    marinara: { retained: true },
  },
};
const compatibleSpriteCard = buildCompatibleCharacterExport(compatibleSpriteSource, portableSprites);
const portableIdentitySource = {
  name: "Portable identity",
  description: "Original <description> & formatting.",
  extensions: { backstory: "A history.\nWith a second line.", appearance: "Silver hair.", retained: true },
};
const portableIdentity = buildCompatibleCharacterExport(portableIdentitySource);
assert.equal(
  portableIdentity.data.description,
  "Original <description> & formatting.\n\nBackstory:\nA history.\nWith a second line.\n\nAppearance:\nSilver hair.",
  "V2 JSON and PNG exports include Marinara-only identity fields in the standard description",
);
assert.equal(portableIdentity.data.extensions.backstory, undefined);
assert.equal(portableIdentity.data.extensions.appearance, undefined);
assert.equal(portableIdentity.data.extensions.retained, true);
assert.equal(portableIdentitySource.extensions.backstory, "A history.\nWith a second line.");
assert.equal(portableIdentitySource.description, "Original <description> & formatting.");
assert.equal(
  buildCompatibleCharacterExport(portableIdentity.data).data.description,
  portableIdentity.data.description,
  "re-exporting a compatible card must not duplicate the merged identity fields",
);
assert.equal(
  buildCompatibleCharacterExport({ description: "Unchanged", extensions: {} }).data.description,
  "Unchanged",
);
assert.equal(
  compatibleSpriteSource.extensions.characterSheetImageId,
  "local-gallery-id",
  "compatible export must not mutate local-only source extensions",
);
assert.equal(compatibleSpriteSource.extensions.useCharacterSheetAsReference, true);
assert.deepEqual(
  (compatibleSpriteCard.data.extensions.marinara as Record<string, unknown>).sprites,
  portableSprites,
  "compatible PNG metadata must carry the character sprite set",
);
const importedSpriteCard = structuredClone(compatibleSpriteCard) as unknown as Record<string, unknown>;
assert.deepEqual(
  takeEmbeddedMarinaraSprites(importedSpriteCard),
  portableSprites,
  "Marinara must recover its embedded sprite set from a compatible PNG card",
);
const importedSpriteExtensions = (importedSpriteCard.data as Record<string, unknown>).extensions as Record<
  string,
  unknown
>;
assert.equal(
  Object.hasOwn(importedSpriteExtensions.marinara as Record<string, unknown>, "sprites"),
  false,
  "embedded sprite binaries must be removed before character metadata is stored",
);
assert.equal(embeddedSpriteSizesAreWithinLimits([MAX_FILE_SIZES.SPRITE]), true);
assert.equal(embeddedSpriteSizesAreWithinLimits([MAX_FILE_SIZES.SPRITE + 1]), false);
assert.equal(
  embeddedSpriteSizesAreWithinLimits(Array(4).fill(MAX_FILE_SIZES.SPRITE)),
  false,
  "aggregate sprite bytes must be limited independently of the per-sprite ceiling",
);
assert.equal(embeddedSpriteSizesAreWithinLimits(Array(MAX_EMBEDDED_SPRITE_COUNT + 1).fill(0)), false);
const ownedGalleryUpdate = {
  extensions: { characterSheetImageId: "owned-image", useCharacterSheetAsReference: true },
};
assert.equal(
  await validateCharacterGalleryReferences("character-a", ownedGalleryUpdate, async () => ({
    characterId: "character-a",
  })),
  ownedGalleryUpdate,
  "A character-owned gallery reference must remain unchanged",
);
const foreignGalleryUpdate = await validateCharacterGalleryReferences(
  "character-a",
  { extensions: { characterSheetImageId: "foreign-image", useCharacterSheetAsReference: true } },
  async () => ({ characterId: "character-b" }),
);
assert.deepEqual(
  foreignGalleryUpdate.extensions,
  { characterSheetImageId: null, useCharacterSheetAsReference: false },
  "A foreign gallery reference must be cleared before character data is persisted",
);
assert.deepEqual(
  updateCharacterSchema.parse({
    data: {
      extensions: { fav: true, depth_prompt: { prompt: "Updated only" } },
      character_book: { name: "Renamed" },
    },
  }).data,
  {
    extensions: { fav: true, depth_prompt: { prompt: "Updated only" } },
    character_book: { name: "Renamed" },
  },
  "Character PATCH parsing must not materialize omitted nested defaults",
);
assert.equal(
  characterDataSchema.parse({ name: "  Trimmed Character  " }).name,
  "Trimmed Character",
  "Character validation must trim leading and trailing name whitespace",
);
assert.equal(
  updateCharacterSchema.parse({ data: { name: "  Renamed Character  " } }).data.name,
  "Renamed Character",
  "Character rename validation must trim leading and trailing whitespace",
);
assert.equal(
  normalizeNativeCharacterData({}),
  null,
  "A native character import without the required name must fail before persistence",
);
const normalizedNativeCharacter = normalizeNativeCharacterData({
  name: "Legacy",
  character_book: {
    name: "Archive",
    custom_top_level_property: "preserved",
  },
});
assert.ok(normalizedNativeCharacter);
assert.equal(normalizedNativeCharacter.description, "");
assert.equal(normalizedNativeCharacter.character_book?.entries.length, 0);
assert.equal(
  (normalizedNativeCharacter.character_book as Record<string, unknown>).custom_top_level_property,
  "preserved",
  "Native import normalization must preserve unknown embedded-lorebook properties",
);
