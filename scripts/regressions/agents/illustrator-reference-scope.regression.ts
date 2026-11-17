import assert from "node:assert/strict";
import { buildUncaptionedCharacterAppearanceBlock } from "../../../packages/server/src/services/image/character-prompts.js";
import { resolveIllustratorCharacterReferences } from "../../../packages/server/src/services/image/illustrator-references.js";

const cards = [
  { id: "chat", name: "Doctor Ash" },
  { id: "unrelated", name: "Rain" },
  { id: "duplicate", name: "Doctor Ash" },
  { id: "global", name: "Elena Vale" },
  { id: "ambiguous-a", name: "Alex" },
  { id: "ambiguous-b", name: "Alex" },
];
const charactersStore = {
  list: async () => cards.map(({ id, name }) => ({ id, data: { name, appearance: `${id} appearance` } })),
};
const resolve = (requestedNames: string[], promptText = "", chatIds = ["chat"]) =>
  resolveIllustratorCharacterReferences({
    charactersStore,
    chatCharacters: cards.filter((card) => chatIds.includes(card.id)),
    requestedNames,
    promptText,
    includeReferenceImages: false,
  });

assert.deepEqual((await resolve([], "Doctor Ash watches the rain.")).characterIds, ["chat"]);
assert.deepEqual((await resolve(["Ash"], "Rain falls.")).characterIds, ["chat"]);
assert.deepEqual((await resolve(["Doctor Ash"])).characterIds, ["chat"]);
assert.deepEqual((await resolve([], "Elena Vale waits in the rain.")).characterIds, []);
assert.deepEqual((await resolve(["Elena Vale"])).characterIds, ["global"]);
assert.deepEqual((await resolve(["Elena"])).characterIds, []);
assert.deepEqual((await resolve(["Alex"])).characterIds, []);
assert.deepEqual((await resolve(["Doctor Ash"], "Doctor Ash", ["chat", "duplicate"])).characterIds, []);
const group = await resolve([], "Doctor Ash and Elena Vale stand together.", ["chat", "global"]);
assert.deepEqual(group.characterIds, ["chat", "global"]);
assert.deepEqual(group.appearanceNames, ["Doctor Ash", "Elena Vale"]);
assert.doesNotMatch(group.appearanceBlock ?? "", /unrelated|duplicate|ambiguous/);
// The image service takes only so many reference images, but the picture is still filed under everyone in it.
const capped = await resolveIllustratorCharacterReferences({
  charactersStore,
  chatCharacters: cards.filter((card) => ["chat", "global", "unrelated"].includes(card.id)),
  requestedNames: ["Doctor Ash", "Elena Vale", "Rain"],
  promptText: "",
  includeReferenceImages: false,
  maxReferences: 1,
});
assert.deepEqual(capped.characterIds, ["chat", "unrelated", "global"]);
assert.deepEqual((await resolve([], "An empty landscape.")).characterIds, []);
assert.deepEqual((await resolve([], "")).characterIds, [], "Backgrounds must not inherit a solo-chat avatar");

const globalAppearance = await resolve(["Doctor Ash", "Elena Vale"]);
assert.equal(
  buildUncaptionedCharacterAppearanceBlock(
    globalAppearance.appearanceSources,
    ["Doctor Ash", "Elena Vale"],
    [{ name: "Doctor Ash", prompt: "boy, new outfit", position: { x: 0.3, y: 0.5 } }],
  ),
  "Elena Vale's Appearance: global appearance",
  "partial captions retain resolved library appearances as well as active-chat cards",
);
const scopedLookups: Array<[string, string]> = [];
const roleplayReference = await resolveIllustratorCharacterReferences({
  charactersStore,
  chatScope: {
    chatId: "roleplay",
    characterIds: ["chat", "disabled", "missing"],
    async getById(id: string, chatId: string) {
      scopedLookups.push([id, chatId]);
      return id === "disabled"
        ? { id, data: { name: "Captain Rowan", extensions: { appearance: "chat-specific blue coat" } } }
        : null;
    },
  },
  chatCharacters: [cards[0]!],
  persona: { id: "persona", name: "Elena Vale", appearance: "chosen persona appearance" },
  requestedNames: ["Elena Vale", "Rowan", "Rain"],
  promptText: "Doctor Ash watches.",
  includeReferenceImages: false,
});
assert.deepEqual(roleplayReference.characterIds, ["chat", "disabled"]);
assert.equal(roleplayReference.personaId, "persona");
assert.deepEqual(roleplayReference.appearanceSources, [
  { name: "Captain Rowan", appearance: "chat-specific blue coat" },
  { name: "Elena Vale", appearance: "chosen persona appearance" },
]);
assert.deepEqual(scopedLookups, [
  ["chat", "roleplay"],
  ["disabled", "roleplay"],
  ["missing", "roleplay"],
]);
for (const [requestedNames, promptText] of [
  [["Doctor Ash"], ""],
  [[], "Doctor Ash watches."],
] as const) {
  const resolution = await resolveIllustratorCharacterReferences({
    charactersStore,
    chatScope: {
      chatId: "roleplay",
      characterIds: ["chat", "duplicate"],
      getById: async (id) => (await charactersStore.list()).find((row) => row.id === id) ?? null,
    },
    chatCharacters: [cards[0]!],
    requestedNames: [...requestedNames],
    promptText,
    includeReferenceImages: false,
  });
  assert.deepEqual(resolution.characterIds, ["chat"]);
}
console.info("Illustrator reference scope regression passed");
