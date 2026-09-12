import assert from "node:assert/strict";
import { buildUncaptionedCharacterAppearanceBlock } from "../../packages/server/src/services/image/character-prompts.js";
import { resolveIllustratorCharacterReferences } from "../../packages/server/src/services/image/illustrator-references.js";

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
console.info("Illustrator reference scope regression passed");
