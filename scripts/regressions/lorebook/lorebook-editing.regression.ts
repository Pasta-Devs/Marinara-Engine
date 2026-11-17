// Editing lorebooks: bulk entry updates, adding activation keys, duplicating a lorebook and normalizing its category.
import assert from "node:assert/strict";
import type { Lorebook } from "../../../packages/shared/src/types/lorebook.js";
import {
  createLorebookSchema,
  bulkUpdateLorebookEntriesSchema,
  normalizeLorebookCategory,
  updateLorebookSchema,
} from "../../../packages/shared/src/schemas/lorebook.schema.js";
import { buildLorebookDuplicateInput } from "../../../packages/client/src/lib/lorebook-duplicate.js";
import { appendLorebookActivationKeys } from "../../../packages/client/src/lib/lorebook-keys.js";

assert.equal(
  bulkUpdateLorebookEntriesSchema.safeParse({
    entryIds: ["entry-1", "entry-2"],
    changes: { preventRecursion: false, caseSensitive: true },
  }).success,
  true,
);
assert.equal(bulkUpdateLorebookEntriesSchema.safeParse({ entryIds: ["entry-1"], changes: {} }).success, false);
assert.deepEqual(appendLorebookActivationKeys(["Apples"], " Apple, Appletree, red fruit, Apple, , Apples "), [
  "Apples",
  "Apple",
  "Appletree",
  "red fruit",
]);
assert.deepEqual(appendLorebookActivationKeys([], "single key"), ["single key"]);
const characterAssignedLorebook: Lorebook = {
  id: "character-book",
  name: "Assigned Character Book",
  description: "A character-linked lorebook.",
  category: "character",
  imagePath: null,
  scanDepth: 4,
  tokenBudget: 3072,
  entryLimit: 50,
  recursiveScanning: true,
  maxRecursionDepth: 5,
  excludeFromVectorization: false,
  vectorQueryDepth: 12,
  vectorScoreThreshold: 0.42,
  vectorMaxResults: 9,
  characterId: "character-1",
  characterIds: ["character-1"],
  personaId: null,
  personaIds: [],
  chatId: null,
  isGlobal: false,
  enabled: true,
  scope: { mode: "all", chatIds: [] },
  tags: ["assigned"],
  generatedBy: "user",
  sourceAgentId: null,
  createdAt: "2026-07-10T10:00:00.000Z",
  updatedAt: "2026-07-10T10:00:00.000Z",
};
const characterAssignedDuplicate = buildLorebookDuplicateInput(characterAssignedLorebook);
assert.equal(Object.hasOwn(characterAssignedDuplicate, "characterId"), false);
assert.deepEqual(characterAssignedDuplicate.characterIds, ["character-1"]);
assert.equal(createLorebookSchema.safeParse(characterAssignedDuplicate).success, true);
assert.equal(normalizeLorebookCategory("World"), "world");
assert.equal(normalizeLorebookCategory("Professor Mari's Experimental Category"), "uncategorized");
assert.equal(
  updateLorebookSchema.safeParse({
    category: normalizeLorebookCategory("Professor Mari's Experimental Category"),
    isGlobal: false,
    enabled: true,
    scanDepth: 2,
    tokenBudget: 2048,
    entryLimit: 100,
    maxRecursionDepth: 3,
    vectorQueryDepth: 10,
    vectorScoreThreshold: 0.3,
    vectorMaxResults: 10,
    characterIds: [],
    personaIds: [],
  }).success,
  true,
);
assert.equal(characterAssignedDuplicate.vectorQueryDepth, characterAssignedLorebook.vectorQueryDepth);
assert.equal(characterAssignedDuplicate.vectorScoreThreshold, characterAssignedLorebook.vectorScoreThreshold);
assert.equal(characterAssignedDuplicate.vectorMaxResults, characterAssignedLorebook.vectorMaxResults);
