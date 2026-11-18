import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  ACHIEVEMENT_DEFINITION_BY_ID,
  ACHIEVEMENT_DIRECT_EVENT_IDS,
} from "../../../packages/shared/src/constants/achievements.js";
import {
  DISCOVERY_TRAILS,
  GUIDE_QUEST_GROUPS,
  guideQuestAchievementEvent,
} from "../../../packages/shared/src/constants/discovery-trails.js";
import {
  AI_BASICS_QUESTS,
  DEEP_DIVES,
  DEEP_DIVE_GROUPS,
  GUIDE_QUESTS,
  GUIDE_QUEST_BY_ID,
  deepDiveGroupKey,
  finishedGuideQuestGroups,
  guideQuestKey,
  nextBasicsQuest,
  pickDeepDives,
  rankDeepDiveGroups,
} from "../../../packages/client/src/lib/guide-quests.js";

// AI basics and Deep dives: every quest points at a real passage, has its strings, and ranks sensibly.
assert.equal(AI_BASICS_QUESTS.length, 12, "twelve AI basics quests");
assert.equal(DEEP_DIVES.length, 83, "83 deep dives");
assert.equal(GUIDE_QUEST_BY_ID.size, GUIDE_QUESTS.length, "quest ids are unique");
assert.equal(AI_BASICS_QUESTS.at(-1)?.special, "mari", "the tour ends at Professor Mari");
assert.ok(
  AI_BASICS_QUESTS.some((quest) => quest.special === "setup"),
  "the tour has the optional model setup quest",
);
assert.equal(nextBasicsQuest("AB1")?.id, "AB2");
assert.equal(nextBasicsQuest("AB12"), null);

// Each quest's heading exists in its guide, and its quote sits under that heading.
const plain = (text: string) =>
  text
    .replace(/\*\*|`|<\/?kbd>/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
for (const quest of GUIDE_QUESTS) {
  const lines = readFileSync(`docs/${quest.guide}`, "utf8").split("\n");
  let start = 0;
  let end = lines.length;
  if (quest.heading) {
    start = lines.findIndex(
      (line) => /^#{1,6} /.test(line) && plain(line.replace(/^#+ /, "")) === plain(quest.heading),
    );
    assert.ok(start >= 0, `${quest.id}: heading "${quest.heading}" is in ${quest.guide}`);
    const level = lines[start]!.match(/^#+/)![0].length;
    const next = lines.findIndex(
      (line, i) => i > start && /^#{1,6} /.test(line) && line.match(/^#+/)![0].length <= level,
    );
    if (next > 0) end = next;
  }
  if (quest.quote) {
    assert.ok(
      plain(lines.slice(start, end).join(" ")).includes(plain(quest.quote)),
      `${quest.id}: quote "${quest.quote}" is under its heading in ${quest.guide}`,
    );
  }
}

// Every string is in en.json, word for word, and no text looks like markup to the locale checker.
const en = JSON.parse(readFileSync("packages/client/src/localization/locales/en.json", "utf8")) as Record<
  string,
  string
>;
for (const quest of GUIDE_QUESTS) {
  for (const part of ["title", "note", "more"] as const) {
    assert.equal(en[guideQuestKey(quest.id, part)], quest[part], `${quest.id}.${part} is in en.json`);
    assert.ok(!/<[a-z]/i.test(quest[part]), `${quest.id}.${part} has no angle-bracket tags`);
  }
}
for (const group of DEEP_DIVE_GROUPS) assert.equal(en[deepDiveGroupKey(group.id)], group.name);

// One Explorer achievement per group, reachable from its event, and no clash with trail ids.
const trailIds = new Set<string>(DISCOVERY_TRAILS.map((trail) => trail.id));
for (const group of GUIDE_QUEST_GROUPS) {
  assert.ok(!trailIds.has(group.id), `${group.id} doesn't clash with a Things to try trail`);
  assert.equal(ACHIEVEMENT_DIRECT_EVENT_IDS[guideQuestAchievementEvent(group.id)], `explorer_${group.id}`);
  assert.ok(ACHIEVEMENT_DEFINITION_BY_ID.get(`explorer_${group.id}`), `explorer_${group.id} is defined`);
  assert.ok(en[`achievements.definitions.explorer.${group.id}.title`], `${group.id} achievement title is in en.json`);
  if (group.id !== "deepAll")
    assert.ok(
      GUIDE_QUESTS.some((quest) => quest.group === group.id),
      `${group.id} has quests`,
    );
}

// "Off The Deep End" needs every deep dive; a finished group earns its own achievement only.
const allDeep = new Set(DEEP_DIVES.map((quest) => quest.id));
assert.ok(finishedGuideQuestGroups(allDeep).includes("deepAll"), "every deep dive done earns deepAll");
const oneShort = new Set([...allDeep].slice(1));
assert.ok(!finishedGuideQuestGroups(oneShort).includes("deepAll"), "one deep dive short is not deepAll");
const loreOnly = new Set(DEEP_DIVES.filter((quest) => quest.group === "deepLore").map((quest) => quest.id));
assert.deepEqual(finishedGuideQuestGroups(loreOnly), ["deepLore"]);
assert.deepEqual(finishedGuideQuestGroups(new Set()), []);

// Ranking follows what the person does: a Game player sees Game deep dives first,
// a Roleplay player sees Roleplay first, and recent lorebook work lifts Lorebook tricks.
const none = { thingsDone: {}, trailOf: () => undefined, deepDone: {} };
assert.equal(rankDeepDiveGroups({ ...none, modes: { conversation: 0, roleplay: 1, game: 9 } })[0], "deepGame");
assert.equal(rankDeepDiveGroups({ ...none, modes: { conversation: 1, roleplay: 12, game: 0 } })[0], "deepRoleplay");
const now = Date.now();
const lore = rankDeepDiveGroups(
  {
    modes: null,
    thingsDone: { L1: now - 1000, L2: now - 500, L5: now - 100 },
    trailOf: (id) => (id.startsWith("L") ? "lore" : undefined),
    deepDone: {},
  },
  now,
);
assert.equal(lore[0], "deepLore", "recent lorebook work puts Lorebook tricks first");
assert.equal(new Set(lore).size, DEEP_DIVE_GROUPS.length, "every group is ranked once");

// Picking: one per group first, skipping done and skipped ones.
const picked = pickDeepDives(new Set(["DL1"]), new Set(["DL2"]), ["deepLore", "deepCards"], 3);
assert.deepEqual(
  picked.map((quest) => quest.id),
  ["DL3", "DK1", "DL4"],
);

console.log("guide quests regression passed");
