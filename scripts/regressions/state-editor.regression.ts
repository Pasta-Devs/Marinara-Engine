// #7736: the State Editor pretty-prints sections exactly like JSON.stringify while knowing each node's line,
// searches keys and values with readable trails, tells real changes from reformatting, and folds several
// game-state sections into one PATCH without one playerStats slice undoing another.
import assert from "node:assert/strict";
import type { GameState } from "@marinara-engine/shared";
import {
  collectStateChanges,
  getStateSectionDraftStatus,
  humanizeStateKey,
  layoutStateJson,
  searchStateSections,
  setStateValueAtPath,
  statePathKey,
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

console.log("state-editor regression passed");
