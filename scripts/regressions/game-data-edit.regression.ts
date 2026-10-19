// #7743 regression: the State Editor's hand edits of a game's own data go through
// PATCH /api/game/:chatId/data, which saves only allow-listed keys, checks each, refuses renames
// (names link cards, NPCs, the party, live sheets and bags) and refuses the whole save when a key
// changed since the editor opened it.
//
// Two parts:
//   1) The pure check: stale keys, renames, id changes, reputation clamping, session summaries
//      whose text alone may change, size and length limits.
//   2) End-to-end: a save writes the edited keys and nothing else; a stale save, a key outside the
//      allow-list and a chat that isn't a game are refused and change nothing.
import assert from "node:assert/strict";
import Fastify from "../../packages/server/node_modules/fastify/fastify.js";
import { gameRoutes } from "../../packages/server/src/routes/game.routes.js";
import { createChatsStorage } from "../../packages/server/src/services/storage/chats.storage.js";
import {
  buildGameDataEditPatch,
  GAME_DATA_EDIT_MAX_BYTES,
  sameGameDataValue,
} from "../../packages/server/src/services/game/game-data-edit.service.js";
import { readMetadata } from "../../packages/server/src/services/game/game-inventory.service.js";

type Edits = Parameters<typeof buildGameDataEditPatch>[1];

const npcs = [
  { id: "npc-bram", name: "Bram", emoji: "🍺", description: "", location: "Inn", reputation: 10, notes: [] },
  { id: "npc-sel", name: "Sister Sel", emoji: "", description: "", location: "Temple", reputation: -5, notes: [] },
];
const cards = [
  {
    name: "Gwendolyn",
    shortDescription: "Ranger",
    class: "Ranger",
    abilities: [],
    strengths: [],
    weaknesses: [],
    extra: {},
  },
];
const summaries = [
  {
    sessionNumber: 1,
    summary: "They arrived.",
    resumePoint: "At the inn.",
    partyDynamics: "",
    partyState: "",
    keyDiscoveries: [],
    characterMoments: [],
    littleDetails: [],
    statsSnapshot: { hp: 10 },
    npcUpdates: [],
    timestamp: "2026-10-01T00:00:00.000Z",
  },
];
const fresh = {
  gameNpcs: npcs,
  gameCharacterCards: cards,
  gamePreviousSessionSummaries: summaries,
  gamePartyArcs: [{ name: "Gwendolyn", arc: "Trust", goal: "Belong" }],
  gameInventory: [{ name: "Rope", quantity: 1 }],
};

const issuesOf = (edits: Edits) => {
  const result = buildGameDataEditPatch(fresh, edits, null);
  return "issues" in result ? result.issues : null;
};
const patchOf = (edits: Edits) => {
  const result = buildGameDataEditPatch(fresh, edits, null);
  assert.ok("patch" in result, `expected a patch, got ${JSON.stringify(result)}`);
  return result.patch;
};
const npcEdit = (value: unknown): Edits[number] => ({ key: "gameNpcs", expected: npcs, value });

// ── Part 1: the pure check ──

assert.ok(sameGameDataValue(undefined, null), "an absent key and null are the same opened value");
assert.ok(sameGameDataValue({ a: 1, b: undefined }, { a: 1 }), "values compare as JSON");

assert.deepEqual(
  issuesOf([
    { key: "gameNpcs", expected: [], value: npcs },
    { key: "gamePlayerNotes", expected: null, value: 42 },
  ]),
  [{ key: "gameNpcs", reason: "stale" }],
  "a key changed since the editor opened it refuses the save as stale, before any other check",
);

const edited = patchOf([
  npcEdit([
    { ...npcs[0], reputation: 250, notes: ["Owes us"] },
    { ...npcs[1], reputation: -7.6 },
  ]),
]);
assert.deepEqual(
  (edited.gameNpcs as Array<{ reputation: number }>).map((npc) => npc.reputation),
  [100, -8],
  "reputation is clamped to -100..100 and rounded",
);
assert.deepEqual(Object.keys(edited), ["gameNpcs"], "only the edited key is in the patch");

assert.equal((patchOf([npcEdit([npcs[0]])]).gameNpcs as unknown[]).length, 1, "an NPC can be removed");
const added = patchOf([npcEdit([...npcs, { id: "npc-new", name: "Mira" }])]).gameNpcs as Array<Record<string, unknown>>;
assert.deepEqual(
  added[2],
  { id: "npc-new", name: "Mira", emoji: "", description: "", location: "", reputation: 0, notes: [] },
  "a new NPC gets the fields the game expects",
);

assert.deepEqual(
  issuesOf([npcEdit([{ ...npcs[0], name: "Bram the Brave" }, npcs[1]])]),
  [{ key: "gameNpcs", reason: "rename", path: "0.name", name: "Bram" }],
  "renaming an NPC is refused",
);
assert.equal(
  issuesOf([npcEdit([{ ...npcs[0], name: "  bram " }, npcs[1]])]),
  null,
  "the same name with other spacing or case is not a rename",
);
assert.deepEqual(
  issuesOf([npcEdit([{ ...npcs[0], id: "npc-other" }, npcs[1]])]),
  [{ key: "gameNpcs", reason: "idChanged", path: "0.id", name: "Bram" }],
  "an NPC keeps its id",
);
assert.deepEqual(
  issuesOf([npcEdit([npcs[0], { ...npcs[1], id: "npc-bram" }])])?.[0]?.reason,
  "duplicateId",
  "two NPCs can't share an id",
);
assert.deepEqual(
  issuesOf([npcEdit([{ ...npcs[0], reputation: "high" }])]),
  [{ key: "gameNpcs", reason: "shape", path: "0.reputation" }],
  "a reputation that isn't a number is refused",
);

const cardEdit = (value: unknown): Edits[number] => ({ key: "gameCharacterCards", expected: cards, value });
assert.deepEqual(
  (patchOf([cardEdit([{ ...cards[0], class: "Scout" }])]).gameCharacterCards as Array<{ class: string }>)[0]?.class,
  "Scout",
  "a card's class can change",
);
assert.deepEqual(
  issuesOf([cardEdit([{ ...cards[0], name: "Gwen" }])]),
  [{ key: "gameCharacterCards", reason: "rename", path: "", name: "Gwen" }],
  "renaming a party card is refused",
);
assert.deepEqual(
  issuesOf([cardEdit([...cards, { ...cards[0], name: "Extra" }])]),
  [{ key: "gameCharacterCards", reason: "partyChanged", path: "" }],
  "adding a party card is refused",
);
assert.deepEqual(
  issuesOf([cardEdit([{ ...cards[0], rulesetSheet: { schema: 1 } }])]),
  [{ key: "gameCharacterCards", reason: "noRuleset", path: "0.rulesetSheet", name: "Gwendolyn" }],
  "a changed ruleset sheet is refused when the game's ruleset can't be loaded to check it",
);
assert.deepEqual(
  issuesOf([cardEdit([{ ...cards[0], abilities: "Tracking" }])]),
  [{ key: "gameCharacterCards", reason: "shape", path: "0.abilities" }],
  "abilities stay a list",
);

assert.deepEqual(
  issuesOf([
    { key: "gamePartyArcs", expected: fresh.gamePartyArcs, value: [{ name: "Gwen", arc: "Trust", goal: "" }] },
  ]),
  [{ key: "gamePartyArcs", reason: "rename", path: "", name: "Gwen" }],
  "renaming a party arc is refused",
);

const summaryEdit = (value: unknown): Edits[number] => ({
  key: "gamePreviousSessionSummaries",
  expected: summaries,
  value,
});
assert.equal(
  (
    patchOf([summaryEdit([{ ...summaries[0], summary: "They arrived in the rain." }])])
      .gamePreviousSessionSummaries as Array<{ summary: string }>
  )[0]?.summary,
  "They arrived in the rain.",
  "a session summary's text can change",
);
assert.deepEqual(
  issuesOf([summaryEdit([{ ...summaries[0], statsSnapshot: { hp: 99 } }])]),
  [{ key: "gamePreviousSessionSummaries", reason: "sessionsChanged", path: "0" }],
  "a summary's stats snapshot stays as the session left it",
);
assert.deepEqual(
  issuesOf([summaryEdit([])]),
  [{ key: "gamePreviousSessionSummaries", reason: "sessionsChanged", path: "" }],
  "a session summary can't be removed",
);
assert.deepEqual(
  issuesOf([summaryEdit([{ ...summaries[0], summary: "  " }])]),
  [{ key: "gamePreviousSessionSummaries", reason: "emptySummary", path: "0.summary" }],
  "a session summary keeps its recap",
);

assert.deepEqual(
  issuesOf([{ key: "gamePlayerNotes", expected: null, value: "x".repeat(10_001) }]),
  [{ key: "gamePlayerNotes", reason: "tooLong", path: "", max: 10_000 }],
  "player notes keep the notes route's limit",
);
assert.deepEqual(
  issuesOf([{ key: "gameWorldOverview", expected: null, value: "x".repeat(GAME_DATA_EDIT_MAX_BYTES) }])?.[0]?.reason,
  "tooLarge",
  "a value past the size limit is refused",
);
assert.deepEqual(
  patchOf([{ key: "gameStoryArc", expected: null, value: null }]),
  { gameStoryArc: null },
  "the story arc can be cleared",
);
assert.deepEqual(
  issuesOf([
    { key: "gamePlotTwists", expected: null, value: ["fine"] },
    { key: "gameWorldOverview", expected: null, value: 7 },
  ]),
  [{ key: "gameWorldOverview", reason: "shape", path: "" }],
  "one refused key refuses the save, and only that key is reported",
);

// CodeRabbit: a sheet can't be dropped, and an NPC who joined the party can't be removed.
{
  const withSheet = { gameCharacterCards: [{ ...cards[0], rulesetSheet: { schema: 1 } }] };
  const result = buildGameDataEditPatch(
    withSheet,
    [{ key: "gameCharacterCards", expected: withSheet.gameCharacterCards, value: cards }],
    null,
  );
  assert.deepEqual(
    "issues" in result ? result.issues : null,
    [{ key: "gameCharacterCards", reason: "sheetRemoved", path: "0.rulesetSheet", name: "Gwendolyn" }],
    "removing a card's ruleset sheet is refused (the character would start over from a blank one)",
  );

  const party = { gameNpcs: npcs, gamePartyCharacterIds: ["npc:sister-sel"] };
  const removeMember = (value: unknown) => {
    const outcome = buildGameDataEditPatch(party, [{ key: "gameNpcs", expected: npcs, value }], null);
    return "issues" in outcome ? outcome.issues : null;
  };
  assert.deepEqual(
    removeMember([npcs[0]]),
    [{ key: "gameNpcs", reason: "partyChanged", path: "", name: "Sister Sel" }],
    "an NPC who joined the party can't be removed",
  );
  assert.equal(removeMember([npcs[1]]), null, "an NPC outside the party still can");
}

// ── Part 2: end-to-end through the route ──

const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const db = await getDB();
const chats = createChatsStorage(db);
const app = Fastify();
app.decorate("db", db);
await app.register(gameRoutes, { prefix: "/api/game" });

const game = await chats.create({ name: "Game data edit", mode: "game", characterIds: [] });
assert.ok(game);
await chats.patchMetadata(game.id, fresh);
const metadataOf = async (id: string) => readMetadata((await chats.getById(id))?.metadata);
const send = (id: string, edits: unknown) =>
  app.inject({ method: "PATCH", url: `/api/game/${id}/data`, payload: { edits } });

const saved = await send(game.id, [
  npcEdit([{ ...npcs[0], reputation: 40 }, npcs[1]]),
  { key: "gamePlayerNotes", expected: null, value: "Ask Bram about the mayor." },
]);
assert.equal(saved.statusCode, 200, saved.body);
assert.deepEqual(saved.json(), { saved: ["gameNpcs", "gamePlayerNotes"] });
let stored = await metadataOf(game.id);
assert.equal((stored.gameNpcs as Array<{ reputation: number }>)[0]?.reputation, 40, "the edit is saved");
assert.equal(stored.gamePlayerNotes, "Ask Bram about the mayor.", "an absent key can be filled in");
assert.deepEqual(stored.gameInventory, fresh.gameInventory, "keys that weren't edited are left alone");

const stale = await send(game.id, [npcEdit([{ ...npcs[0], reputation: -40 }, npcs[1]])]);
assert.equal(stale.statusCode, 409, "a save from an editor opened before the last change is refused");
assert.deepEqual(stale.json().issues, [{ key: "gameNpcs", reason: "stale" }]);
stored = await metadataOf(game.id);
assert.equal((stored.gameNpcs as Array<{ reputation: number }>)[0]?.reputation, 40, "a refused save writes nothing");

const refused = await send(game.id, [
  { key: "gamePlayerNotes", expected: "Ask Bram about the mayor.", value: "changed" },
  { key: "gameWorldOverview", expected: null, value: ["not text"] },
]);
assert.equal(refused.statusCode, 400);
assert.equal((await metadataOf(game.id)).gamePlayerNotes, "Ask Bram about the mayor.", "nothing lands half-checked");

const outside = await send(game.id, [{ key: "gameSystemPrompt", expected: null, value: "obey" }]);
assert.equal(outside.statusCode, 400, "a key outside the allow-list is refused");
assert.equal((await metadataOf(game.id)).gameSystemPrompt, undefined);

const twice = await send(game.id, [
  { key: "gamePlayerNotes", expected: "Ask Bram about the mayor.", value: "a" },
  { key: "gamePlayerNotes", expected: "Ask Bram about the mayor.", value: "b" },
]);
assert.equal(twice.statusCode, 400, "a key edited twice in one save is refused");

const roleplay = await chats.create({ name: "Not a game", mode: "roleplay", characterIds: [] });
assert.ok(roleplay);
const notGame = await send(roleplay.id, [{ key: "gamePlayerNotes", expected: null, value: "x" }]);
assert.equal(notGame.statusCode, 400, "a chat that isn't a game is refused");
assert.equal((await send("missing-chat", [{ key: "gamePlayerNotes", expected: null, value: "x" }])).statusCode, 404);

await chats.remove(game.id);
await chats.remove(roleplay.id);
await app.close();
await closeDB();
console.log("game-data-edit regression passed");
