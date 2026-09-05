import assert from "node:assert/strict";
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

console.info("Illustrator reference scope regression passed");
