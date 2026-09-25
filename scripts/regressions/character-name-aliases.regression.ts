import assert from "node:assert/strict";
import * as names from "../../packages/server/src/routes/generate/generate-route-utils.js";

assert.equal(typeof names.resolveCharacterIdentityMap, "function", "Character aliases need a server read path");
const cards = new Map<string, unknown>([
  ["wolverine", JSON.stringify({ name: " Wolverine ", extensions: { nameAliases: [" Logan ", "", 7, null, "Wolf"] } })],
  ["logan", { name: "Logan", extensions: { nameAliases: ["Wolf"] } }],
  ["disabled", { name: "Still in chat", extensions: { nameAliases: ["Sleeping"] } }],
  ["outside", { name: "Outside", extensions: { nameAliases: ["Stranger"] } }],
  ["legacy", { name: "Legacy" }],
  ["bad-aliases", { name: "Bad aliases", extensions: { nameAliases: "wrong" } }],
  ["bad-name", { name: "  ", extensions: { nameAliases: ["Alias alone"] } }],
  ["broken", "{broken"],
  ["array", []],
]);
const ids = [...cards.keys()].filter((id) => id !== "outside").concat("missing");
const lookups: string[] = [];
const lookup = async (id: string) => {
  lookups.push(id);
  return cards.has(id) ? { data: cards.get(id) } : null;
};
const identities = await names.resolveCharacterIdentityMap(ids, lookup);
assert.deepEqual(
  [...identities],
  [
    ["wolverine", { name: "Wolverine", nameAliases: ["Logan", "Wolf"] }],
    ["logan", { name: "Logan", nameAliases: ["Wolf"] }],
    ["disabled", { name: "Still in chat", nameAliases: ["Sleeping"] }],
    ["legacy", { name: "Legacy", nameAliases: [] }],
    ["bad-aliases", { name: "Bad aliases", nameAliases: [] }],
  ],
);
assert.deepEqual(lookups, ids, "Only supplied chat members are read, including disabled members");
assert.deepEqual(
  [...(await names.resolveCharacterNameMap(ids, lookup))],
  [...identities].map(([id, identity]) => [id, identity.name]),
  "Existing name-only callers keep the same map shape",
);
assert.deepEqual([...(await names.resolveCharacterIdentityMap([], lookup))], []);
console.info(
  "Character aliases: imported and object cards, malformed fields, chat scope and name-only compatibility passed.",
);
