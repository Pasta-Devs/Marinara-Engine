import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseRulesetDefinition } from "../../packages/shared/src/index.js";
import {
  buildGmFormatReminder,
  insertStableGmInstructions,
} from "../../packages/server/src/services/game/gm-prompts.js";

type ReminderContext = Parameters<typeof buildGmFormatReminder>[0];

const gravewatch = parseRulesetDefinition(
  JSON.parse(
    readFileSync(fileURLToPath(new URL("../../docs/examples/rulesets/gravewatch.json", import.meta.url)), "utf8"),
  ),
);
assert.ok(gravewatch.ok);

const turn = (overrides: Partial<ReminderContext> = {}): ReminderContext => ({
  sceneState: "<scene_state>\nWeather: driving rain\n</scene_state>",
  turnNumber: 7,
  gameActiveState: "exploration",
  sessionNumber: 2,
  gameTime: "Day 3, 21:00",
  partyNames: ["Isolde", "Brann"],
  playerName: "Rook",
  ruleset: gravewatch.definition,
  rulesetSheetBlocks: ["Isolde\nHealth 5/7", "Brann\nHealth 7/7"],
  playerInventory: [{ name: "Rope", quantity: 1 }],
  hudWidgets: [{ id: "torch", type: "progress_bar", label: "Torch", value: 4, max: 10 } as never],
  whereYouAre: "WHERE YOU ARE: the drowned chapel.",
  storyNow: "The bell tolls once.",
  gameSpecialInstructions: "Keep it grim.",
  ...overrides,
});

// The whole reminder is the default: the parts are asked for by name.
const whole = buildGmFormatReminder(turn());
assert.equal(buildGmFormatReminder({ ...turn(), part: "whole" }), whole);

// The stable part holds for the whole game: the same bytes whatever the turn holds.
const stable = buildGmFormatReminder({ ...turn(), part: "stable" });
for (const other of [
  turn({ sceneState: "<scene_state>\nWeather: clear\n</scene_state>", turnNumber: 8, gameTime: "Day 4" }),
  turn({ rulesetSheetBlocks: ["Isolde\nHealth 1/7", "Brann\nHealth 7/7"], playerInventory: [] }),
  turn({ addressMode: "gm", playerDiceRollSubmitted: true, gameActiveState: "combat" }),
  turn({ whereYouAre: "WHERE YOU ARE: the road.", storyNow: "Dawn.", market: "MARKET: none" }),
]) {
  assert.equal(buildGmFormatReminder({ ...other, part: "stable" }), stable);
}
assert.match(stable, /^<output_format>/);
assert.match(stable, /<\/output_format>$/);
assert.match(stable, /COMMANDS:/);
assert.match(stable, /CHARACTER SHEETS:/);
assert.match(stable, /SPECIAL INSTRUCTIONS:/);
assert.doesNotMatch(stable, /Health 5\/7|driving rain|drowned chapel|The bell tolls|Rope|<current_state>/);

// The turn part says what changes and ends with the instruction to write.
const turnPart = buildGmFormatReminder({ ...turn(), part: "turn" });
assert.match(turnPart, /^<current_state>/);
assert.match(turnPart, /driving rain/);
assert.match(turnPart, /Health 5\/7/);
assert.match(turnPart, /Rope/);
assert.match(turnPart, /drowned chapel/);
assert.match(turnPart, /Write the next turn now\.$/);
assert.doesNotMatch(turnPart, /COMMANDS:|SPECIAL INSTRUCTIONS:|^<output_format>/m);
assert.ok(turnPart.length < whole.length / 2, "the turn part is the smaller share of the reminder");

// A turn's own mode is said in the turn part.
const gmTurn = buildGmFormatReminder({ ...turn({ addressMode: "gm", playerDiceRollSubmitted: true }), part: "turn" });
assert.match(gmTurn, /TALK-TO-GM MODE:/);
assert.match(gmTurn, /THIS TURN:/);
assert.match(buildGmFormatReminder({ ...turn({ gameActiveState: "combat" }), part: "turn" }), /COMBAT GM ADJUDICATION/);

// Every instruction lands in one part or the other.
for (const heading of ["COMMANDS:", "SPECIAL INSTRUCTIONS:", "<current_state>", "HUD WIDGETS"]) {
  if (whole.includes(heading)) assert.ok(stable.includes(heading) || turnPart.includes(heading), heading);
}

// Placement: the stable instructions go before lore written after the GM prompt, and the history
// is left alone.
const messages = [
  { role: "system", content: "GM PROMPT\n\n<lore>\nafter\n</lore>" },
  { role: "user", content: "p1" },
  { role: "assistant", content: "g1" },
  { role: "user", content: "p2" },
  { role: "assistant", content: "g2" },
  { role: "user", content: "p3" },
];
insertStableGmInstructions(messages, stable, "<lore>\nafter\n</lore>");
assert.ok(messages[0]!.content.startsWith("GM PROMPT\n\n<output_format>"));
assert.ok(messages[0]!.content.endsWith("<lore>\nafter\n</lore>"));
assert.deepEqual(
  messages.slice(1).map((message) => message.content),
  ["p1", "g1", "p2", "g2", "p3"],
);
// With no lore after the GM prompt they follow it; with no system message they become one.
const plain = [{ role: "system", content: "GM PROMPT" }];
insertStableGmInstructions(plain, stable, "");
assert.equal(plain[0]!.content, `GM PROMPT\n\n${stable}`);
const bare = [{ role: "user", content: "p1" }];
insertStableGmInstructions(bare, stable, "");
assert.deepEqual(bare.at(0), { role: "system", content: stable });

console.log("The GM reminder splits into a stable part for the system prompt and a turn part for the tail.");
