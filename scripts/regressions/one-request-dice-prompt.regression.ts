// ──────────────────────────────────────────────
// One-request dice: the prompt rule.
//
// Which of the three forms a check is written in is a fact about the sentence the Game
// Master is about to write, so the engine cannot decide it. The prompt does, which makes
// the rendered block itself the contract and this lane the place it is pinned.
//
// Three things are worth asserting, in this order of importance.
//
//   1. THE SWITCH OFF RENDERS TODAY'S BYTES. Every field this feature adds is inert while
//      the switch is off, including the pool block and the tool line, so an existing chat
//      cannot read one character differently because the code shipped. The off case is
//      pinned against literal text rather than against "contains something dice-shaped".
//   2. THE SWITCH ON REPLACES THE roll_dice BLOCK WHOLESALE, and drops the one COMMANDS
//      line that tells the model to stop at the attempt and wait for the engine to send
//      the numbers back. That line is exactly the instruction the second request exists to
//      serve, and leaving it in would ask for the two-request turn the switch removes.
//   3. THE SHEET-MODIFIER SENTENCE IS CONDITIONAL. A name the chat cannot resolve is
//      refused, never defaulted to zero, so advertising `[[roll: 1d8+STR]]` in the default
//      configuration, where no game-state snapshot means no skills, would teach a form
//      that fails. The names printed are the names the resolver finds, spelled the way the
//      sheet spells them.
// ──────────────────────────────────────────────

import assert from "node:assert/strict";

import { buildGmFormatReminder } from "../../packages/server/src/services/game/gm-prompts.js";
import { buildGameSkillModifierView } from "../../packages/server/src/services/game/one-request-dice.js";
import type { SkillCheckModifierContext } from "../../packages/server/src/services/game/skill-check-resolution.service.js";

type ReminderContext = Parameters<typeof buildGmFormatReminder>[0];

const baseContext = {
  hasSceneModel: false,
  gameActiveState: "exploration",
  sessionNumber: 1,
  turnNumber: 4,
  map: null,
  partyNames: ["Mari"],
  playerName: "Player",
} as ReminderContext;

const reminder = (overrides: Partial<ReminderContext> = {}) =>
  buildGmFormatReminder({ ...baseContext, ...overrides } as ReminderContext);

// ── 1. The switch off, byte for byte ──

const LEGACY_SPARSE_CHECK_LINE = `- [skill_check: skill="Skill Name" dc="1-20"] - request a d20 check only when uncertainty matters. Choose a fair DC (5 trivial, 10 routine under pressure, 15 hard, 20 desperate). Do NOT invent rolls, modifier, total or result: the engine supplies the die and character-sheet modifiers.`;
const LEGACY_DICE_TAG_LINE = `- [dice: 3d8+2] - request any NdM roll with an optional flat modifier, even without a tools API. The engine rolls it, capped at 100 dice and 1000 sides per die. Never write the numbers yourself.`;
const LEGACY_WAIT_LINE = `- Place unresolved roll requests before any outcome that depends on them. Describe the attempt, then stop. The engine will send the real results back for you to finish this same turn; do not guess success or failure before receiving them.`;
const LEGACY_DICE_BLOCK = [
  `DICE:`,
  `- roll_dice is a real die you can throw. Call it the moment you need an actual number before you can keep writing - an attack, a save, damage, a random outcome the scene then reacts to - passing the notation (for example "1d20+3") and a short reason.`,
  `- Never invent a die result. Wait for the number the tool gives you, then narrate what it means, once, in this same turn.`,
].join("\n");

const off = reminder();
assert.ok(off.includes(LEGACY_SPARSE_CHECK_LINE), "the shipped sparse-check line has to render unchanged");
assert.ok(off.includes(LEGACY_DICE_TAG_LINE), "the shipped [dice:] line has to render unchanged");
assert.ok(off.includes(LEGACY_WAIT_LINE), "the shipped stop-at-the-attempt line stays while the switch is off");
assert.ok(off.includes(LEGACY_DICE_BLOCK), "the shipped roll_dice DICE block stays while the switch is off");
assert.ok(!off.includes("[[roll:"), "no placeholder form is taught while the switch is off");
assert.ok(!off.includes("[branch:"), "no branch form is taught while the switch is off");

// Every field the feature adds is read only through the switch, so a chat that somehow
// carries them without it renders the same bytes as a chat that does not.
assert.equal(
  reminder({
    skillModifiers: { skills: ["Stealth"], attributes: ["STR"] },
    dicePoolMode: true,
    dicePoolBlock: "<dice_pool>\nThe next d20 is 14.\n</dice_pool>",
    rollDiceToolAttached: true,
  }),
  off,
  "the new fields must be inert while the switch is off",
);
assert.equal(reminder({ oneRequestDice: false }), off, "an explicit false is the same as absent");

// ── 2. The switch on ──

const on = reminder({ oneRequestDice: true });

assert.ok(!on.includes(LEGACY_DICE_BLOCK), "the roll_dice block is replaced wholesale, not appended to");
assert.ok(!on.includes("roll_dice"), "with no tool in the resolved set the block never mentions one");
assert.ok(!on.includes(LEGACY_WAIT_LINE), "the stop-at-the-attempt line is dropped while the turn finishes itself");

const EXPECTED_ON_BLOCK = [
  `DICE:`,
  `- When an outcome turns on chance, you have three ways to write it. Pick by what the outcome is, not by preference.`,
  ``,
  `- IF THE OUTCOME SPLITS TWO WAYS, WRITE A BRANCH BLOCK. Write the check without numbers, then write both halves. The engine rolls, keeps the half the roll selects, and deletes the other before anyone reads the turn. Neither half may contain a command.`,
  `  [skill_check: skill="Stealth" dc="15" branch="crates"]`,
  `  [branch: crates]`,
  `  [on success] The guard's gaze slides over the crates and away. You are past him.`,
  `  [on failure] A boot scuffs stone. He turns, and his hand is already moving.`,
  `  [/branch]`,
  ``,
  `- IF THE OUTCOME IS ONLY A NUMBER, WRITE A PLACEHOLDER AND KEEP WRITING. Damage, healing, gold, a duration, a count, a distance. The engine rolls it and puts the number in its place, so the sentence reads the same either way.`,
  `  The axe bites deep for [[roll: 2d6+3]] damage, and the wound burns for [[roll: 1d4]] rounds.`,
  `  One placeholder holds one NdM notation, at most one flat number, and at most one sheet name. For two different dice, write two placeholders. Never put a placeholder inside a code block or inside another tag's brackets.`,
  ``,
  `- ONLY IF THE NUMBER ITSELF HAS TO DECIDE BETWEEN THREE OR MORE DIFFERENT OUTCOMES, ask for the value instead: write [skill_check: skill="Skill Name" dc="1-20"] or [dice: 3d8+2] and stop at the attempt. The engine rolls it and records it. Narrate what it meant at the start of your next turn.`,
  ``,
  `- A check you write in none of these forms is rolled by the engine and recorded, and this turn ends without its outcome; narrate what the number meant at the start of your next turn.`,
  ``,
  `- Never invent a die result, a modifier, a total, or an outcome. Never write both a branch block and a placeholder for the same check.`,
].join("\n");
assert.ok(on.includes(EXPECTED_ON_BLOCK), "the rule renders verbatim, including the fallback sentence");

// The two COMMANDS lines gain their form and keep everything they said before.
assert.ok(
  on.includes(
    `${LEGACY_SPARSE_CHECK_LINE} When the outcome splits two ways, add branch="label" to this tag and write the branch block described under DICE.`,
  ),
  "the sparse-check line gains the branch form without losing a word of its own",
);
assert.ok(
  on.includes(
    `${LEGACY_DICE_TAG_LINE} When the number does not fork the prose, write a [[roll: 3d8+2]] placeholder in the sentence instead of this tag and keep writing.`,
  ),
  "the [dice:] line gains the placeholder form without losing a word of its own",
);

// A turn where the player already threw keeps its own COMMANDS line, because the player's
// die is what that action uses; nothing about the branch form applies to it.
const playerRolled = reminder({ oneRequestDice: true, playerDiceRollSubmitted: true });
assert.ok(
  playerRolled.includes(
    `- [skill_check: skill="Skill Name" dc="1-20" rolls="the player's d20 result"] - use the player's exact die and choose a fair DC (5 trivial, 10 routine under pressure, 15 hard, 20 desperate). Do NOT write modifier, total or result: the engine applies their character-sheet modifiers.`,
  ),
  "the player's own roll keeps the shipped line",
);
assert.ok(!playerRolled.includes(`branch="label"`), "and that line is not amended");

// ── 3. The sheet-modifier sentence ──

assert.ok(
  !on.includes("These are the only names that resolve"),
  "with no resolvable name the sheet-modifier form is not advertised at all",
);
assert.ok(on.includes("[[roll: 2d6+3]]"), "the flat form is still taught when no name resolves");

const withNames = reminder({
  oneRequestDice: true,
  skillModifiers: { skills: ["Stealth", "Athletics"], attributes: ["STR", "DEX"] },
});
assert.ok(
  withNames.includes(
    `  To add a character-sheet modifier, write its name and let the engine add it: [[roll: 1d8+STR]]. Never write the modifier's value yourself and never write the die's result yourself. These are the only names that resolve: Stealth, Athletics, STR, DEX.`,
  ),
  "the names render in the shape the design fixes, skills first",
);

// The view is built from the same context the resolver reads, so a name it prints is a
// name `resolveSheetModifier` finds. Skill spellings are carried through untouched.
const context: SkillCheckModifierContext = {
  skills: { Stealth: 2, sleight_of_hand: 1, Broken: "not a number" } as Record<string, unknown>,
  attributes: null,
  sheetAttributes: { str: 14, dex: 12 },
};
assert.deepEqual(buildGameSkillModifierView(context), {
  skills: ["Stealth", "sleight_of_hand"],
  attributes: ["STR", "DEX"],
});
assert.deepEqual(
  buildGameSkillModifierView({ skills: null, attributes: null, sheetAttributes: {} }),
  { skills: [], attributes: [] },
  "the default configuration carries no names at all, which is what drops the sentence",
);

// ── The two conditional additions ──

const pooled = reminder({
  oneRequestDice: true,
  dicePoolMode: true,
  dicePoolBlock: "<dice_pool>\nThe next d20 is 14.\n</dice_pool>",
});
assert.ok(
  pooled.includes(
    `- ONLY IF THE NUMBER ITSELF HAS TO DECIDE BETWEEN THREE OR MORE DIFFERENT OUTCOMES, spend a pool value instead: write the value shown below into the check's rolls= and name its slot with pool=, then narrate what it meant in this same turn.`,
  ),
  "the fourth bullet asks for a pool spend while the sub-option is on",
);
assert.ok(!pooled.includes("ask for the value instead"), "and only one of the two spellings is present");
assert.ok(
  pooled.includes("<dice_pool>\nThe next d20 is 14.\n</dice_pool>"),
  "the pool block is appended after the rule",
);
assert.ok(
  !reminder({ oneRequestDice: true, dicePoolBlock: "<dice_pool>\nThe next d20 is 14.\n</dice_pool>" }).includes(
    "<dice_pool>",
  ),
  "a pool block without the sub-option renders nothing",
);

const TOOL_LINE = `- You also have roll_dice on this connection. Prefer the forms above: a tool call costs an extra round. Use the tool only for a roll none of them can serve.`;
assert.ok(
  reminder({ oneRequestDice: true, rollDiceToolAttached: true }).includes(TOOL_LINE),
  "the tool is never attached without being described",
);
assert.ok(!on.includes(TOOL_LINE), "and never described without being attached");

console.log("One-request dice: the prompt rule renders on demand and today's block is untouched without it.");
