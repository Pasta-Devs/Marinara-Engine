// #7736: the State Editor pretty-prints sections exactly like JSON.stringify while knowing each node's line,
// searches keys and values with readable trails, tells real changes from reformatting, and folds several
// game-state sections into one PATCH without one playerStats slice undoing another.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { GameState } from "@marinara-engine/shared";
import {
  blankStateArrayItem,
  blankStateValueLike,
  collectStateChanges,
  getStateSectionDraftStatus,
  humanizeStateKey,
  layoutStateJson,
  searchStateSections,
  setStateValueAtPath,
  shapeStateEntry,
  statePathKey,
  tokenizeStateJson,
} from "../../packages/client/src/lib/state-editor/state-editor-json.js";
import {
  buildGameStateEditorPatch,
  buildGameStateEditorSections,
  findGameStateSectionsChangedSince,
  GAME_STATE_EDITOR_SECTION_IDS,
} from "../../packages/client/src/lib/state-editor/game-state-editor-source.js";
import {
  buildChatVariablesEditorPatch,
  readChatVariables,
} from "../../packages/client/src/lib/state-editor/chat-variables-editor-source.js";
import {
  buildGameDataEditorEdits,
  buildGameDataEditorSections,
  gameDataSectionRoute,
  readGameDataRouteSection,
  readGameMetadata,
  readGameWorldEdits,
} from "../../packages/client/src/lib/state-editor/game-data-editor-source.js";
import type { StateEditorSection } from "../../packages/client/src/lib/state-editor/state-editor.types.js";

// ── layout ──

for (const value of [
  null,
  "text",
  42,
  [],
  {},
  [1, [2, []], { a: {} }],
  { a: 1, b: [true, null, "x"], c: { d: 'e\n"quoted"' }, skipped: undefined },
  [undefined, () => 1],
]) {
  assert.equal(
    layoutStateJson(value).text,
    JSON.stringify(value, null, 2),
    `layout matches JSON.stringify for ${JSON.stringify(value)}`,
  );
}

const sample = { scene: { location: "Harbor" }, people: [{ name: "Gwendolyn", mood: "tense" }, { mood: "calm" }] };
const { text, lineByPath } = layoutStateJson(sample);
const lines = text.split("\n");
const lineOf = (path: Array<string | number>) => lines[lineByPath.get(statePathKey(path))! - 1]!.trim();
assert.equal(lineOf(["scene", "location"]), '"location": "Harbor"', "a leaf's line is the line holding it");
assert.equal(lineOf(["people", 0]), "{", "an array item's line is where it opens");
assert.equal(lineOf(["people", 1, "mood"]), '"mood": "calm"');

// ── drafts ──

const section: StateEditorSection = { id: "scene", label: "Scene", value: { location: "Harbor" } };
assert.deepEqual(getStateSectionDraftStatus(section, undefined), { kind: "clean" }, "no draft is clean");
assert.deepEqual(
  getStateSectionDraftStatus(section, '{"location":"Harbor"}'),
  { kind: "clean" },
  "reformatting alone is not a change",
);
assert.deepEqual(getStateSectionDraftStatus(section, '{"location":"Docks"}'), {
  kind: "changed",
  value: { location: "Docks" },
});
assert.equal(getStateSectionDraftStatus(section, '{"location":').kind, "invalid", "broken JSON is invalid");

const other: StateEditorSection = { id: "quests", label: "Quests", value: [] };
assert.deepEqual(collectStateChanges([section, other], { scene: '{"location":"Docks"}', quests: "[" }), {
  changes: [{ sectionId: "scene", value: { location: "Docks" } }],
  invalidSectionIds: ["quests"],
});

// ── search ──

const people: StateEditorSection = { id: "people", label: "Present Characters", value: sample.people };
const hits = searchStateSections([section, people], "MOOD");
assert.deepEqual(
  hits.map((hit) => [hit.sectionLabel, ...hit.trail, hit.key].join(" > ")),
  ["Present Characters > Gwendolyn > mood", "Present Characters > #2 > mood"],
  "keys match case-insensitively, and array items are named by their name field or position",
);
assert.equal(hits[0]!.preview, '"mood": "tense"');
assert.equal(
  layoutStateJson(sample.people).text.split("\n")[hits[0]!.line - 1]!.trim(),
  '"mood": "tense"',
  "a result's line points at the match",
);

const valueHits = searchStateSections([section, people], "harb");
assert.equal(valueHits.length, 1, "primitive values match too");
assert.equal(valueHits[0]!.key, "location");

assert.equal(
  searchStateSections([section], "docks", { scene: { location: "Docks" } }).length,
  1,
  "search reads the draft values it's given",
);
assert.deepEqual(searchStateSections([section], "   "), [], "a blank query finds nothing");
assert.deepEqual(hits[0]!.path, [0, "mood"], "a result carries its path for the Fields view");

// ── fields view ──

const people0 = sample.people as Array<Record<string, unknown>>;
const edited = setStateValueAtPath(sample.people, [0, "mood"], "calm") as Array<Record<string, unknown>>;
assert.equal(edited[0]!.mood, "calm", "a field edit lands at its path");
assert.equal(people0[0]!.mood, "tense", "the saved value is never mutated");
assert.equal(edited[1], people0[1], "untouched items keep their identity");
assert.deepEqual(Object.keys(edited[0]!), Object.keys(people0[0]!), "key order stays as the user sees it");
assert.equal(setStateValueAtPath({ a: 1 }, [], 2), 2, "the empty path replaces the root");
assert.deepEqual(setStateValueAtPath({ a: 1 }, [0, "x"], 2), { a: 1 }, "a path that doesn't fit changes nothing");
assert.equal(humanizeStateKey("currentMood"), "Current mood");
assert.equal(humanizeStateKey("world_custom-fields"), "World custom fields");
assert.equal(humanizeStateKey("maxHP"), "Max HP", "acronyms keep their capitals");
assert.equal(humanizeStateKey("___"), "___", "a key with no words stays as it is");

// ── game-state patch folding ──

const gameState = {
  id: "gs-1",
  chatId: "chat-1",
  messageId: "msg-1",
  swipeIndex: 0,
  date: "Day 3",
  time: "Dusk",
  location: "Harbor",
  weather: "Fog",
  temperature: "12°C",
  worldCustomFields: [],
  presentCharacters: [],
  recentEvents: [],
  playerStats: {
    stats: [],
    attributes: null,
    skills: {},
    inventory: [],
    activeQuests: [{ name: "Find the lighthouse keeper", completed: false }],
    status: "",
    customTrackerFields: [{ name: "Reputation", value: "Neutral" }],
  },
  personaStats: [],
  createdAt: "2026-10-16T00:00:00.000Z",
} as unknown as GameState;

const sections = buildGameStateEditorSections(gameState, (id, part) => `${id}.${part}`);
assert.deepEqual(
  sections.map((item) => item.id),
  [...GAME_STATE_EDITOR_SECTION_IDS],
);
assert.equal(sections[0]!.label, "world-state.label");

const quests = [{ name: "Find the lighthouse keeper", completed: true }];
const customFields = [{ name: "Reputation", value: "Trusted" }];
const folded = buildGameStateEditorPatch(gameState, [
  { sectionId: "quest", value: quests },
  { sectionId: "custom-tracker", value: customFields },
]);
assert.ok("patch" in folded);
const playerStats = folded.patch.playerStats as Record<string, unknown>;
assert.deepEqual(playerStats.activeQuests, quests, "the first playerStats section survives the second");
assert.deepEqual(playerStats.customTrackerFields, customFields);

const scene = buildGameStateEditorPatch(gameState, [
  { sectionId: "world-state", value: { location: "Docks", worldCustomFields: [] } },
]);
assert.ok("patch" in scene);
assert.deepEqual(scene.patch, { location: "Docks", worldCustomFields: [] }, "only the keys in the draft are sent");

const rejected = buildGameStateEditorPatch(gameState, [{ sectionId: "quest", value: { not: "an array" } }]);
assert.ok("error" in rejected);
assert.equal(rejected.sectionId, "quest", "a slice's validation error names its section");
assert.deepEqual(
  rejected.error,
  { code: "notArray", field: "activeQuests" },
  "the error is a code the modal localizes",
);

const agentUpdated = { ...gameState, location: "Lighthouse" } as GameState;
assert.deepEqual(
  findGameStateSectionsChangedSince(gameState, agentUpdated, [
    { sectionId: "world-state", value: { location: "Docks", worldCustomFields: [] } },
    { sectionId: "quest", value: quests },
  ]),
  ["world-state"],
  "a section the tracker updated on the same turn blocks the save; untouched ones don't",
);

// ── chat variables ──

assert.deepEqual(
  readChatVariables(JSON.stringify({ macroVariables: { char1: "Mary", count: 3 } })),
  { char1: "Mary" },
  "string metadata parses and non-string values are skipped",
);
assert.deepEqual(readChatVariables({ macroVariables: ["no"] }), {});

const opened = { char1: "Mary", "story.day": "3", mood: "calm" };
// A generation set {{setvar::weather}} after the editor opened.
const savedNow = { ...opened, weather: "rain" };
const varsPatch = buildChatVariablesEditorPatch(savedNow, opened, {
  char1: "Anne",
  "story.day": "3",
  hero: "Gwen",
});
assert.ok("patch" in varsPatch);
assert.deepEqual(
  { ...varsPatch.patch },
  { char1: "Anne", hero: "Gwen", mood: null },
  "only edits, additions and removals are sent; a value set elsewhere meanwhile is left alone",
);
assert.deepEqual(
  { ...(buildChatVariablesEditorPatch(opened, opened, { ...opened, "story.day": "4" }) as { patch: object }).patch },
  { "story.day": "4" },
  "a stored loose name ({{setvar}} spelling) stays editable",
);
const issueOf = (draft: unknown) => {
  const result = buildChatVariablesEditorPatch(opened, opened, draft);
  return "issue" in result ? result.issue : null;
};
assert.deepEqual(issueOf(["x"]), { kind: "notObject" });
assert.deepEqual(issueOf({ ...opened, n: 4 }), { kind: "notString", name: "n" });
assert.deepEqual(issueOf({ "new.name": "x" }), { kind: "name", name: "new.name", issue: "format" });
assert.deepEqual(issueOf({ " padded": "x" }), { kind: "name", name: " padded", issue: "format" });
assert.deepEqual(issueOf({ user: "x" }), { kind: "name", name: "user", issue: "reserved" });
assert.deepEqual(issueOf({ big: "x".repeat(10_001) }), { kind: "tooLong", name: "big" });
assert.deepEqual(issueOf(Object.fromEntries(Array.from({ length: 501 }, (_, i) => [`v${i}`, "x"]))), {
  kind: "tooMany",
});

// ── game data (#7743): read-only sections ──

const lockedSection: StateEditorSection = { id: "locked", label: "Locked", value: { a: 1 }, readOnly: true };
assert.deepEqual(
  collectStateChanges([lockedSection], { locked: '{ "a": 2 }' }),
  { changes: [], invalidSectionIds: [] },
  "a read-only section never counts as changed or invalid, whatever draft it is handed",
);
assert.deepEqual(
  collectStateChanges([lockedSection], { locked: "{ broken" }),
  { changes: [], invalidSectionIds: [] },
  "a broken draft on a read-only section doesn't block saving the others",
);

const gameMetadata = readGameMetadata(
  JSON.stringify({
    gameNpcs: [{ id: "npc-1", name: "Bram", reputation: 35 }],
    gameStoryArc: "The bell was stolen.",
    gamePlotTwists: ["The mayor did it"],
    activeGameMapId: "map-1",
    gameSpecialInstructions: "Keep combat rare.",
    gameNarrationIndex: 0,
    gameSomethingNew: { added: "later" },
    macroVariables: { day: "3" },
    sceneBackground: "not a game key",
  }),
);
const gameSections = buildGameDataEditorSections(gameMetadata, (id, part) => `${id}.${part}`);
const gameSectionById = Object.fromEntries(gameSections.map((section) => [section.id, section]));
assert.deepEqual(
  gameSections.map((section) => section.id),
  ["npcs", "story", "maps", "settings", "other"],
  "only sections the game has data for show, named ones first, then Settings and Other",
);
assert.deepEqual(
  gameSections.filter((section) => !section.readOnly).map((section) => section.id),
  ["npcs", "story"],
  "a section is editable only when every key in it is on the allow-list; catch-alls never are",
);
assert.deepEqual(gameSectionById.npcs?.value, gameMetadata.gameNpcs, "a one-key section shows that key's value as is");
assert.deepEqual(
  gameSectionById.story?.value,
  { gameStoryArc: "The bell was stolen.", gamePlotTwists: ["The mayor did it"] },
  "a several-key section shows the keys the game has, by name",
);
assert.deepEqual(
  gameSectionById.maps?.value,
  { activeGameMapId: "map-1" },
  "named keys without the game prefix land in their section",
);
assert.deepEqual(
  gameSectionById.settings?.value,
  { gameSpecialInstructions: "Keep combat rare." },
  "prompt and media preferences fall into Settings, by name even when alone",
);
assert.deepEqual(
  gameSectionById.other?.value,
  { gameNarrationIndex: 0, gameSomethingNew: { added: "later" } },
  "a game key no section names still shows, so new Game Mode keys are never hidden",
);
assert.equal(gameSectionById.npcs?.label, "npcs.label", "labels come from the localize callback");
assert.deepEqual(readGameMetadata("{ not json"), {}, "unreadable metadata shows no sections instead of throwing");
assert.deepEqual(
  buildGameDataEditorSections({ macroVariables: { a: "b" } }, () => ""),
  [],
  "non-game keys never show",
);

// ── game data (#7743): per-key edits with the opened values ──

const openedGame = { gameNpcs: [{ id: "n1", name: "Bram" }], gameStoryArc: "Old arc", gamePlotTwists: ["a"] };
assert.deepEqual(
  buildGameDataEditorEdits(openedGame, [
    { sectionId: "npcs", value: [{ id: "n1", name: "Bram", reputation: 5 }] },
    { sectionId: "story", value: { gameStoryArc: "New arc", gamePlotTwists: ["a"], gameWorldOverview: "Added" } },
  ]),
  {
    edits: [
      { key: "gameNpcs", expected: openedGame.gameNpcs, value: [{ id: "n1", name: "Bram", reputation: 5 }] },
      { key: "gameWorldOverview", expected: null, value: "Added" },
      { key: "gameStoryArc", expected: "Old arc", value: "New arc" },
    ],
  },
  "a several-key section sends only changed keys, each with the value it opened (null when absent)",
);
assert.deepEqual(
  buildGameDataEditorEdits(openedGame, [{ sectionId: "story", value: { gamePlotTwists: ["a"] } }]),
  { edits: [{ key: "gameStoryArc", expected: "Old arc", value: null }] },
  "a key removed from a several-key section is sent as null",
);
assert.deepEqual(
  buildGameDataEditorEdits(openedGame, [{ sectionId: "story", value: { gameSystemPrompt: "x" } }]),
  { sectionId: "story", issue: { kind: "unknownKey", key: "gameSystemPrompt" } },
  "a key that isn't the section's is refused before it reaches the server",
);
assert.deepEqual(buildGameDataEditorEdits(openedGame, [{ sectionId: "story", value: ["x"] }]), {
  sectionId: "story",
  issue: { kind: "notObject" },
});
assert.deepEqual(
  buildGameDataEditorEdits(openedGame, [{ sectionId: "maps", value: {} }]),
  { sectionId: "maps", issue: { kind: "readOnly" } },
  "a read-only section can't produce an edit",
);

// ── game data (#7743 slices 3-4): sections saved through the game's own routes ──

assert.equal(readGameWorldEdits({}), undefined, "a game with no world has no world edits section");
assert.equal(
  readGameWorldEdits({ gameWorld: { seed: 1 } }),
  null,
  "a world without edits shows null, ready to add some",
);
assert.deepEqual(
  readGameWorldEdits({ gameWorld: { seed: 1, edits: { editsVersion: 1, places: [] } } }),
  { editsVersion: 1, places: [] },
  "the layer is read where the world route keeps it",
);
const routed = buildGameDataEditorSections(
  {
    gameWorld: { seed: 1, edits: { editsVersion: 1 } },
    gameInventory: [{ name: "Rope", quantity: 2 }],
  },
  (id) => id,
);
const routedById = Object.fromEntries(routed.map((section) => [section.id, section]));
assert.equal(routedById.world?.readOnly, true, "the world itself stays read-only");
assert.equal(routedById.worldEdits?.readOnly, undefined, "its edits layer is editable");
assert.equal(routedById.inventory?.readOnly, false, "the inventory is editable");
assert.equal(
  (routedById.inventory?.value as Array<{ id?: string }>)[0]?.id !== undefined,
  true,
  "the inventory shows each stack with the id the game works out for it",
);
assert.equal(gameDataSectionRoute("inventory"), "inventory");
assert.equal(gameDataSectionRoute("worldEdits"), "world");
assert.equal(gameDataSectionRoute("npcs"), undefined, "allow-listed keys go through the data route");
assert.deepEqual(
  ["storyScript", "partySheet", "widgets"].map(gameDataSectionRoute),
  ["story", "partySheet", "widgets"],
  "story script, party sheet and widgets save through their own routes",
);
assert.deepEqual(
  readGameDataRouteSection({ gameWorld: { edits: { editsVersion: 1 } }, gameWidgetState: [{ id: "w" }] }, "worldEdits"),
  { editsVersion: 1 },
  "a routed section is read the way the editor shows it, to tell whether it changed since",
);
assert.deepEqual(readGameDataRouteSection({ gameWidgetState: [{ id: "w" }] }, "widgets"), [{ id: "w" }]);
assert.equal(readGameDataRouteSection({}, "storyScript"), null, "an absent key reads as null");
assert.deepEqual(
  buildGameDataEditorEdits({}, [
    { sectionId: "inventory", value: [] },
    { sectionId: "worldEdits", value: { editsVersion: 1 } },
  ]),
  { edits: [] },
  "sections with a route of their own never reach the data route",
);

// ── tracker windows open on their own section ──
// The Trackers window and every tracker popped out into its own window name the section to open, so a
// renamed or mistyped id would silently land on Scene. The ids are the agent types. Each drawer is read
// from its own block, so a swap between two drawers fails as well as a missing one.
const trackerWindowSource = readFileSync(
  new URL("../../packages/client/src/components/chat/RoleplayTrackerWindow.tsx", import.meta.url),
  "utf8",
);
const sectionByDrawer: Record<string, string[]> = {};
for (const drawerBlock of trackerWindowSource.split("<TrackerDrawer").slice(1)) {
  const drawerId = drawerBlock.match(/id="([^"]+)"/u)?.[1];
  const sectionId = drawerBlock.match(/stateEditorSection="([^"]+)"/u)?.[1];
  if (!drawerId || !sectionId) continue;
  (sectionByDrawer[drawerId] ??= []).push(sectionId);
}
assert.deepEqual(
  sectionByDrawer,
  {
    "tracker-world": ["world-state"],
    "tracker-persona": ["persona-stats"],
    "tracker-characters": ["character-tracker"],
    "tracker-quests": ["quest"],
    "tracker-inventory": ["inventory-tracker"],
    "tracker-custom": ["custom-tracker"],
  },
  "each game-state tracker drawer opens the State Editor on its own section, exactly once",
);
assert.deepEqual(
  [...new Set(Object.values(sectionByDrawer).flat())].sort(),
  [...GAME_STATE_EDITOR_SECTION_IDS].sort(),
  "and those sections are the game-state editor's own ids",
);

// ── JSON highlight tokens ──
// StateJsonField draws the text through a coloured layer and makes the textarea's own text
// transparent, so tokens that lose or misplace a character show up as invisible or overlapping
// text while typing — nothing else in the repo would catch that.
const tokenText = (text: string) =>
  tokenizeStateJson(text)
    .map((token) => token.text)
    .join("");
for (const sample of [
  '{\n  "mood": "Watchful",\n  "hp": 78,\n  "ok": true,\n  "note": null\n}',
  '{"escaped": "a \\"quoted\\" line", "unicode": "émoji 💠", "exp": -1.5e3}',
  '{"half": "typed',
  "[1, 2, 3]",
  "",
]) {
  assert.equal(tokenText(sample), sample, `tokens reproduce the text exactly: ${JSON.stringify(sample)}`);
}
const kindsOf = (text: string, needle: string) =>
  tokenizeStateJson(text)
    .filter((token) => token.text === needle)
    .map((token) => token.kind);
const pinnedJson = '{"mood": "Watchful", "hp": 78, "ok": true, "none": null}';
assert.deepEqual(kindsOf(pinnedJson, '"mood"'), ["key"], "an object key is a key, not a string");
assert.deepEqual(kindsOf(pinnedJson, '"Watchful"'), ["string"], "a value string stays a string");
assert.deepEqual(kindsOf(pinnedJson, "78"), ["number"], "numbers get their own colour");
assert.deepEqual(kindsOf(pinnedJson, "true"), ["literal"], "true is a literal");
assert.deepEqual(kindsOf(pinnedJson, "null"), ["literal"], "null is a literal");
assert.deepEqual(kindsOf(pinnedJson, "{"), ["punctuation"], "braces are punctuation");
assert.equal(
  tokenizeStateJson('{"escaped": "a \\"quoted\\" line"}').filter((token) => token.kind === "string").length,
  1,
  "an escaped quote never splits one string into two tokens",
);
assert.deepEqual(
  kindsOf('{"half": "typed', '"half"'),
  ["key"],
  "an unfinished value still leaves the key highlighted while typing",
);

// ── Fields view: an added entry copies the shape of the entry above it ──
// Cloning the shape is what keeps an added character, stat or custom field readable by the tracker
// that reads that section: the editor is never told a schema, only what is already in the draft.
const pinnedCustomField = { name: "Fel Lockheart's Status", value: "Under observation/Quarantined", icon: "tag" };
assert.deepEqual(
  blankStateValueLike(pinnedCustomField),
  { name: "", value: "", icon: "" },
  "an added custom field keeps name, value and icon, all empty",
);
assert.deepEqual(
  blankStateArrayItem([pinnedCustomField]),
  { name: "", value: "", icon: "" },
  "the entry an add control appends is the last item's shape, cleared",
);
assert.deepEqual(
  blankStateValueLike({ hp: 12, alive: true, tags: ["quick"], nested: { mood: "calm" } }),
  { hp: 0, alive: false, tags: [], nested: { mood: "" } },
  "every kind of leaf is cleared rather than copied",
);
assert.equal(blankStateValueLike("Chilly"), "", "a text leaf clears to an empty string");
assert.equal(blankStateValueLike(0), 0, "a number leaf clears to 0");
assert.equal(blankStateValueLike(false), false, "an on/off leaf clears to off");
assert.equal(blankStateValueLike(null), "", "a null leaf starts as empty text");
assert.deepEqual(
  blankStateArrayItem([]),
  {},
  "a list whose key declares no shape starts as an empty object for the add-field row",
);
assert.deepEqual(
  blankStateArrayItem([], "worldCustomFields"),
  { name: "", value: "", icon: "" },
  "an empty list of custom fields starts with the shape the game declares, icon included",
);
assert.deepEqual(
  blankStateArrayItem([], "stats"),
  { name: "", value: 0, max: 0, color: "" },
  "an empty list of stats carries the colour the game's stats carry",
);
assert.deepEqual(blankStateArrayItem([], "anUnknownKey"), {}, "an unknown key still falls back to an empty object");
assert.deepEqual(
  blankStateArrayItem([{ ...pinnedCustomField, extra: "shape from the entry" }], "worldCustomFields"),
  { name: "", value: "", icon: "", extra: "" },
  "an existing entry is cloned instead of the declared shape, so the list keeps its own keys",
);
assert.deepEqual(blankStateValueLike({}), {}, "an empty object stays empty");
assert.deepEqual(
  blankStateArrayItem([], "customTrackerFields"),
  { name: "", value: "" },
  "a Custom Tracker Fields entry added to an empty section starts with a name and a value",
);
assert.deepEqual(
  blankStateArrayItem([{ name: "Rope", qty: 3, description: "", location: "" }], "inventory", "inventory-tracker"),
  { name: "", qty: 1, description: "", location: "" },
  "a cleared Inventory Tracker row keeps a quantity of 1, because the tracker reads qty as at least one",
);
assert.equal(
  (blankStateArrayItem([], "currencies") as { qty?: number }).qty,
  1,
  "a currency row added to an empty list starts at 1 too",
);
assert.deepEqual(
  shapeStateEntry({ name: "Rope", qty: 2 }, "inventory", "inventory-tracker"),
  { name: "Rope", qty: 2, description: null, location: null },
  "an Inventory Tracker row shows the fields its section declares, not only the stored ones",
);

// ── The same list name, two contracts ──
// "inventory" is PlayerStats.inventory in Persona Stats (rows count `quantity`) and an Inventory Tracker
// row list in the Inventory Tracker (rows carry `qty`). The section decides which shape a row gets.
assert.deepEqual(
  blankStateArrayItem([], "inventory"),
  { name: "", description: "", quantity: 1, location: "" },
  "a persona inventory item starts with the quantity its contract counts",
);
assert.deepEqual(
  blankStateArrayItem([], "inventory", "inventory-tracker"),
  { name: "", qty: 1, description: "", location: "" },
  "an Inventory Tracker row in the same position starts with qty instead",
);

// ── A half-filled entry still shows the rows it is missing ──
// The tracker wrote { name, value, icon }; a stored entry with only a name shows the rest as "no value",
// so the user can complete it without opening the JSON. Nothing reaches the draft until one is edited.
assert.deepEqual(
  shapeStateEntry({ name: "Guard" }, "worldCustomFields"),
  { name: "Guard", value: null, icon: null },
  "a custom field without value and icon shows both rows as no value",
);
assert.deepEqual(
  shapeStateEntry({ name: "Guard", value: "on duty" }, "worldCustomFields"),
  { name: "Guard", value: "on duty", icon: null },
  "a stored value wins over the declared shape",
);
assert.deepEqual(
  shapeStateEntry({ name: "Guard", colour: "red" }, "worldCustomFields"),
  { name: "Guard", colour: "red", value: null, icon: null },
  "keys the entry has and the shape doesn't are kept",
);
assert.deepEqual(
  shapeStateEntry({ name: "Guard" }, "anUnknownKey"),
  { name: "Guard" },
  "a list whose key declares no shape is shown exactly as stored",
);
assert.equal(shapeStateEntry("plain", "worldCustomFields"), "plain", "a non-record entry is left alone");

console.log("state-editor regression passed");
