import assert from "node:assert/strict";
import {
  clampParsedDiceToLimits,
  isDiceNotation as sharedIsDiceNotation,
  isWithinDiceLimits,
  parseDiceNotation,
  MAX_DICE_COUNT,
  MAX_DICE_SIDES,
} from "../../packages/shared/dist/index.js";
import { isDiceNotation, rollDice } from "../../packages/server/src/services/game/dice.service.js";
import { executeToolCalls } from "../../packages/server/src/services/tools/tool-executor.js";
import { parseGmTags } from "../../packages/client/src/lib/game-tag-parser.js";
import { matchSlashCommand, type SlashCommandContext } from "../../packages/client/src/lib/slash-commands.js";

// One NdM grammar, four readers. The engine used to carry four private regexes
// that disagreed about the most common notation a GM writes: the roll_dice tool
// refused a bare "d20" while /roll, the slash roller and the skill-check tag all
// accepted it. This pins the grammar in the shared module and then drives the
// same table through each call site's own entry point, so a site that grows its
// own regex again fails here rather than in a chat.

type ToolOutcome = "rolled" | "invalid" | "out-of-range";

interface NotationCase {
  notation: string;
  /** Does the shared grammar accept it at all? */
  grammar: boolean;
  /** What the roll_dice tool does with it (its bounds policy is refuse, not clamp). */
  tool: ToolOutcome;
  /** Rolls a GM would have reported for this notation, used to drive the tag parser. */
  tagRolls: number[];
  /** Does the skill-check tag accept it as a dice label? */
  tagLabel: boolean;
}

const CASES: NotationCase[] = [
  // Bare dN — legal everywhere. This row is the whole point of the change.
  { notation: "d20", grammar: true, tool: "rolled", tagRolls: [12], tagLabel: true },
  { notation: "d6", grammar: true, tool: "rolled", tagRolls: [4], tagLabel: true },
  { notation: "1d20", grammar: true, tool: "rolled", tagRolls: [12], tagLabel: true },
  { notation: "2d6", grammar: true, tool: "rolled", tagRolls: [3, 4], tagLabel: true },
  { notation: "2D6", grammar: true, tool: "rolled", tagRolls: [3, 4], tagLabel: true },
  { notation: " 2d6 ", grammar: true, tool: "rolled", tagRolls: [3, 4], tagLabel: true },
  { notation: "1d020", grammar: true, tool: "rolled", tagRolls: [12], tagLabel: true },
  { notation: "100d1000", grammar: true, tool: "rolled", tagRolls: Array.from({ length: 100 }, () => 7), tagLabel: true },
  // Modifiers are part of the grammar, but a dice *label* names dice only —
  // the modifier belongs in modifier=, so the tag refuses one.
  { notation: "2d6+3", grammar: true, tool: "rolled", tagRolls: [3, 4], tagLabel: false },
  { notation: "d20+5", grammar: true, tool: "rolled", tagRolls: [12], tagLabel: false },
  { notation: "4d8-1", grammar: true, tool: "rolled", tagRolls: [1, 2, 3, 4], tagLabel: false },
  // Grammatical, but past a caller's ceiling or floor. Each caller owns that
  // policy; the grammar does not.
  { notation: "101d20", grammar: true, tool: "out-of-range", tagRolls: [12], tagLabel: false },
  { notation: "500d6", grammar: true, tool: "out-of-range", tagRolls: [3], tagLabel: false },
  { notation: "1d1001", grammar: true, tool: "out-of-range", tagRolls: [12], tagLabel: false },
  // One-faced dice: refused by the tool (2-sided floor), accepted elsewhere.
  { notation: "1d1", grammar: true, tool: "out-of-range", tagRolls: [1], tagLabel: true },
  // Not dice notation.
  { notation: "0d20", grammar: false, tool: "invalid", tagRolls: [12], tagLabel: false },
  { notation: "1d0", grammar: false, tool: "invalid", tagRolls: [12], tagLabel: false },
  { notation: "d", grammar: false, tool: "invalid", tagRolls: [12], tagLabel: false },
  { notation: "20", grammar: false, tool: "invalid", tagRolls: [12], tagLabel: false },
  { notation: "2d", grammar: false, tool: "invalid", tagRolls: [3, 4], tagLabel: false },
  { notation: "2d6+", grammar: false, tool: "invalid", tagRolls: [3, 4], tagLabel: false },
  { notation: "2d6x3", grammar: false, tool: "invalid", tagRolls: [3, 4], tagLabel: false },
  { notation: "-1d6", grammar: false, tool: "invalid", tagRolls: [3], tagLabel: false },
  { notation: "1d20+3 extra", grammar: false, tool: "invalid", tagRolls: [12], tagLabel: false },
  // Too large to be an exact integer: refused rather than silently clamped.
  { notation: "99999999999999999999d6", grammar: false, tool: "invalid", tagRolls: [3], tagLabel: false },
  { notation: "1d6+9007199254740992", grammar: false, tool: "invalid", tagRolls: [3], tagLabel: false },
  { notation: `1d6+${"9".repeat(49)}`, grammar: false, tool: "invalid", tagRolls: [3], tagLabel: false },
  { notation: `1d6-${"9".repeat(49)}`, grammar: false, tool: "invalid", tagRolls: [3], tagLabel: false },
  // Exact in every piece and still refused: a six would put the total on 2^53.
  // The largest 1d6 modifier that survives its own top throw sits six lower and
  // is legal everywhere. Both ends of that boundary are swept in full below.
  { notation: "1d6+9007199254740991", grammar: false, tool: "invalid", tagRolls: [3], tagLabel: false },
  { notation: "1d6+9007199254740985", grammar: true, tool: "rolled", tagRolls: [3], tagLabel: false },
];

// ── Entry 1: the shared grammar ──

for (const testCase of CASES) {
  const parsed = parseDiceNotation(testCase.notation);
  assert.equal(parsed !== null, testCase.grammar, `shared grammar disagrees on ${JSON.stringify(testCase.notation)}`);
  assert.equal(sharedIsDiceNotation(testCase.notation), testCase.grammar);
  if (parsed) {
    assert.equal(parsed.notation, testCase.notation.trim());
    assert.ok(parsed.count >= 1 && parsed.sides >= 1);
    assert.equal(parsed.dice, `${parsed.notation.split(/[+-]/)[0]}`.toLowerCase());
  }
}

// The grammar reports the pieces every caller needs, modifier included.
const withModifier = parseDiceNotation("2d6+3");
assert.ok(withModifier);
assert.deepEqual(
  { dice: withModifier.dice, count: withModifier.count, sides: withModifier.sides, modifier: withModifier.modifier },
  { dice: "2d6", count: 2, sides: 6, modifier: 3 },
);
const bare = parseDiceNotation("d20");
assert.ok(bare);
assert.deepEqual({ dice: bare.dice, count: bare.count, modifier: bare.modifier }, { dice: "d20", count: 1, modifier: 0 });

// ── Entry 2: the /roll service ──

for (const testCase of CASES) {
  // The route's zod refine and the grammar are the same predicate.
  assert.equal(isDiceNotation(testCase.notation), testCase.grammar);

  if (!testCase.grammar) {
    assert.throws(() => rollDice(testCase.notation), /Invalid dice notation/);
    continue;
  }

  const parsed = parseDiceNotation(testCase.notation)!;
  const rolled = rollDice(testCase.notation);
  const expectedCount = Math.min(parsed.count, MAX_DICE_COUNT);
  assert.equal(rolled.rolls.length, expectedCount, `wrong die count for ${testCase.notation}`);
  // A roll inside the ceilings still reports the text it was given, character
  // for character. A clamped one reports the dice it threw instead — see the
  // sweep below for that half.
  if (isWithinDiceLimits(parsed)) {
    assert.equal(rolled.notation, testCase.notation.trim(), `an unclamped /roll echoes its input: ${testCase.notation}`);
  }
  assert.equal(rolled.modifier, parsed.modifier);
  assert.equal(
    rolled.total,
    rolled.rolls.reduce((sum, roll) => sum + roll, 0) + parsed.modifier,
  );
  for (const roll of rolled.rolls) {
    assert.ok(roll >= 1 && roll <= Math.min(parsed.sides, MAX_DICE_SIDES), `die out of range for ${testCase.notation}`);
  }
}

// This path clamps an oversized roll rather than refusing it, and always has.
// Pinned because the tool path deliberately does the opposite.
assert.equal(rollDice("500d6").rolls.length, MAX_DICE_COUNT);
assert.equal(rollDice("1d5000").rolls.length, 1);
assert.ok(!isWithinDiceLimits(parseDiceNotation("500d6")!));

// ── A clamped roll names the dice it threw ──
//
// This is a deliberate behavior change, disclosed in the changelog. Before it, a
// clamped roll kept the text the player typed: staging's dice service returned
// `notation.trim()` next to a count it had already run through Math.min, and the
// branch that moved the grammar into the shared module preserved that byte for
// byte. So a hundred dice landed under a card headed 500d6, and the narrator tag
// and the message metadata told the model the same thing. The clamp now rebuilds
// the notation from what it will actually throw. The old pin here read
// `rolled.notation === typed` for every case including these; it now reads the
// canonical form, and the unclamped half of that promise is asserted on its own
// in the sweep above and again at the end of this block.
for (const [typed, canonical] of [
  ["101d6", "100d6"],
  ["500d6", "100d6"],
  ["101d20", "100d20"],
  ["1d1001", "1d1000"],
  ["1d5000", "1d1000"],
  // The modifier sits outside both ceilings and comes back with its own sign.
  ["500d6+3", "100d6+3"],
  ["500d6-2", "100d6-2"],
  // A bare dN stays bare — only the faces can clamp there, since one die never does.
  ["d5000", "d1000"],
  // Both ceilings at once.
  ["500d5000", "100d1000"],
] as const) {
  assert.equal(rollDice(typed).notation, canonical, `a clamped /roll names the dice it threw: ${typed}`);
  const clamped = clampParsedDiceToLimits(parseDiceNotation(typed)!);
  assert.equal(clamped.notation, canonical, `and the clamp itself is where that happens: ${typed}`);
  assert.equal(clamped.dice, canonical.split(/[+-]/)[0], `dice and notation agree after a clamp: ${typed}`);
}

// The notation a clamped roll reports is one the grammar reads back to the dice
// that were thrown — a card the player can retype and get the same roll.
for (const typed of ["500d6+3", "d5000", "500d5000"]) {
  const rolled = rollDice(typed);
  const reparsed = parseDiceNotation(rolled.notation);
  assert.ok(reparsed, `a clamped notation parses: ${typed}`);
  assert.ok(isWithinDiceLimits(reparsed), `and asks for nothing past the ceilings: ${typed}`);
  assert.equal(reparsed.count, rolled.rolls.length, `and names the dice actually thrown: ${typed}`);
  assert.equal(reparsed.modifier, rolled.modifier, `and keeps the modifier: ${typed}`);
}

// Nothing inside the ceilings moved. An unclamped roll still echoes its input
// character for character, leading zeros and all.
for (const typed of ["2d6+3", "d20", "100d1000", "1d020", " 2d6 ", "4d8-1"]) {
  assert.equal(rollDice(typed).notation, typed.trim(), `an unclamped /roll is byte-identical: ${typed}`);
}

// ── Entry 3: the roll_dice tool ──

async function rollThroughTool(notation: string): Promise<Record<string, unknown>> {
  const [result] = await executeToolCalls([
    { id: "call_1", type: "function", function: { name: "roll_dice", arguments: JSON.stringify({ notation }) } },
  ]);
  assert.ok(result);
  return JSON.parse(result.result) as Record<string, unknown>;
}

// The sum the tool reports is the dice as thrown, and the total is exactly that
// sum plus the modifier — asserted at the largest modifier a 1d6 may legally
// carry, where the float arithmetic has the least room left.
//
// Honest note on the shape of this pin: it is a plain property assertion, not a
// trap for a re-derivation. Now that the grammar refuses any notation whose
// total range could leave the safe integers, `total - modifier` and a reduce
// over the rolls agree exactly, so this cannot red a swap between them. The
// reduce form is kept because summing the dice directly is what the property
// says. Forty throws so the assertion sees more than one face of the die, and
// BigInt is the arithmetic truth the float total is measured against.
const LARGEST_1D6_MODIFIER = Number.MAX_SAFE_INTEGER - 6;
for (let i = 0; i < 40; i++) {
  const boundary = await rollThroughTool(`1d6+${LARGEST_1D6_MODIFIER}`);
  const rolls = boundary.rolls as number[];
  assert.ok(Array.isArray(rolls) && rolls.length === 1, "the boundary roll throws one die");
  assert.equal(boundary.sum, rolls[0], "the reported sum is the die actually rolled");
  assert.equal(boundary.modifier, LARGEST_1D6_MODIFIER, "the boundary modifier survives the round trip");
  assert.ok(Number.isSafeInteger(boundary.total as number), "the boundary total is still an exact integer");
  assert.equal(
    BigInt(boundary.total as number),
    BigInt(rolls[0]!) + BigInt(LARGEST_1D6_MODIFIER),
    "the boundary total matches the arithmetic truth, not a rounded neighbour",
  );
}

for (const testCase of CASES) {
  const result = await rollThroughTool(testCase.notation);

  if (testCase.tool === "invalid") {
    assert.match(String(result.error), /^Invalid dice notation/, `expected invalid: ${testCase.notation}`);
    assert.ok(typeof result.hint === "string" && result.hint.length > 0, "an invalid notation keeps its hint");
    continue;
  }

  if (testCase.tool === "out-of-range") {
    assert.match(String(result.error), /^Dice values out of range/, `expected out of range: ${testCase.notation}`);
    assert.equal(result.rolls, undefined, "a refused roll never reports dice it did not throw");
    continue;
  }

  const parsed = parseDiceNotation(testCase.notation)!;
  assert.equal(result.error, undefined, `expected a roll for ${testCase.notation}`);
  assert.equal(result.notation, testCase.notation.trim());
  assert.ok(Array.isArray(result.rolls));
  assert.equal((result.rolls as number[]).length, parsed.count);
  assert.equal(result.modifier, parsed.modifier);
  assert.equal(result.sum, (result.rolls as number[]).reduce((sum, roll) => sum + roll, 0));
  assert.equal(result.total, (result.sum as number) + parsed.modifier);
  assert.match(String(result.display), /^🎲 /);
}

// The tool's own shape is unchanged by the consolidation.
const toolReason = await rollThroughTool("2d6+3");
assert.equal(toolReason.reason, "");
const toolWithReason = await executeToolCalls([
  {
    id: "call_2",
    type: "function",
    function: { name: "roll_dice", arguments: JSON.stringify({ notation: "d20", reason: "Perception check" }) },
  },
]);
const parsedToolResult = JSON.parse(toolWithReason[0]!.result) as Record<string, unknown>;
assert.equal(parsedToolResult.reason, "Perception check");
assert.match(String(parsedToolResult.display), /^🎲 d20 \(Perception check\): \[\d+\] = \*\*\d+\*\*$/);
assert.equal(toolWithReason[0]!.success, true, "a bare d20 is a successful tool call, not an error result");

// ── Entry 4: the GM skill-check tag ──

function parseDiceLabel(notation: string, rolls: number[]) {
  const total = rolls.reduce((sum, roll) => sum + roll, 0);
  const dc = 10;
  const attributes = [
    'skill="Stealth"',
    `dc="${dc}"`,
    `rolls="${rolls.join("|")}"`,
    `used="${rolls[0]}"`,
    'modifier="0"',
    `total="${total}"`,
    `result="${total >= dc ? "success" : "failure"}"`,
    `dice="${notation}"`,
  ].join(" ");
  return parseGmTags(`[skill_check: ${attributes}]`).skillChecks[0];
}

for (const testCase of CASES) {
  const tag = parseDiceLabel(testCase.notation, testCase.tagRolls);
  assert.ok(tag, `the tag itself must still parse for ${testCase.notation}`);
  if (testCase.tagLabel) {
    assert.equal(
      tag.resolvedResult?.dice,
      testCase.notation.trim().toLowerCase(),
      `expected the tag to accept ${testCase.notation}`,
    );
  } else {
    assert.equal(tag.resolvedResult, undefined, `expected the tag to refuse ${testCase.notation}`);
  }
}

// The ceiling itself, not just a roll-count mismatch: a label whose dice all
// line up is still refused once it passes the shared limits.
assert.equal(
  parseDiceLabel(
    `${MAX_DICE_COUNT + 1}d20`,
    Array.from({ length: MAX_DICE_COUNT + 1 }, () => 7),
  )?.resolvedResult,
  undefined,
);
assert.equal(parseDiceLabel(`1d${MAX_DICE_SIDES + 1}`, [MAX_DICE_SIDES + 1])?.resolvedResult, undefined);
assert.ok(parseDiceLabel(`${MAX_DICE_COUNT}d20`, Array.from({ length: MAX_DICE_COUNT }, () => 7))?.resolvedResult);

// The same grammar reads a rolls="..." value that is notation rather than
// numbers, and keeps labelling it with the NdM half only.
function parseRollsNotation(rollsValue: string) {
  return parseGmTags(
    `[skill_check: skill="Stealth" dc="10" rolls="${rollsValue}" modifier="0" total="12" result="success"]`,
  ).skillChecks[0];
}
assert.equal(parseRollsNotation("d20")?.resolvedResult?.dice, "d20");
assert.equal(parseRollsNotation("1d20")?.resolvedResult?.dice, "1d20");
assert.equal(parseRollsNotation("1d20+3")?.resolvedResult?.dice, "1d20");
assert.equal(parseRollsNotation("1d100")?.resolvedResult, undefined, "only a d20 resolves without a dice label");
assert.equal(parseRollsNotation("0d20")?.resolvedResult, undefined);

// ── The whole range of totals is held to the same exactness bar as the dice ──
//
// The regex puts no ceiling on the modifier's digits. The count and the faces
// have always been checked with Number.isSafeInteger; the modifier was not, so
// "1d6+9007199254740992" parsed happily and every reader downstream trusted it.
// The damage is a wrong number rather than an error: past 2^53 the modifier
// swallows the die (a rolled 1 came back as a total identical to the modifier),
// a 49-digit modifier totals to 1e+49, and a long enough one totals to Infinity
// — which the roll_dice tool serializes to a null total for the model. The
// refusal belongs in the grammar because no caller re-checks the parsed value.
//
// An exact modifier is not the whole bar, though. What every reader reports is
// the total, and the total is sum(rolls) + modifier: the notation could land
// anywhere in [modifier + count, modifier + count * sides], and which end it
// lands near is the RNG's business. "1d6+9007199254740991" is exact in every
// piece and still totals 2^53 the moment the die shows a 6, so the boundary is
// the total range's, not the modifier's — the largest legal 1d6 modifier is
// MAX_SAFE_INTEGER - 6.
//
// The negative direction is the same rule read from the other end, and it does
// not mirror the positive one: dice only ever add, so a negative modifier is
// pushed toward zero and its lowest total (modifier + count) cannot leave the
// safe integers on its own. "1d6-9007199254740991" therefore stays legal while
// its positive twin does not — the asymmetry is the arithmetic's.

const FORTY_NINE_NINES = "9".repeat(49);
/** A d20 tops out twenty above its modifier, so its boundary sits below 1d6's. */
const LARGEST_1D20_MODIFIER = Number.MAX_SAFE_INTEGER - 20;

interface ModifierCase {
  notation: string;
  accepted: boolean;
  /**
   * The same case written as a single d20 — the only shape the skill-check tag
   * resolves. Spelled out per row rather than swapped in with a replace: the
   * boundary moves with the dice, so a d6 row and a d20 row do not sit on the
   * same side of the line at the same modifier.
   */
  tagNotation: string;
  note: string;
}

const MODIFIER_CASES: ModifierCase[] = [
  {
    notation: `1d6+${LARGEST_1D6_MODIFIER}`,
    tagNotation: `1d20+${LARGEST_1D20_MODIFIER}`,
    accepted: true,
    note: "the largest modifier whose whole total range stays exact",
  },
  {
    notation: `1d6+${LARGEST_1D6_MODIFIER + 1}`,
    tagNotation: `1d20+${LARGEST_1D20_MODIFIER + 1}`,
    accepted: false,
    note: "one past it — the top face lands the total on 2^53",
  },
  {
    notation: `1d6+${Number.MAX_SAFE_INTEGER}`,
    tagNotation: `1d20+${Number.MAX_SAFE_INTEGER}`,
    accepted: false,
    note: "an exact modifier is not enough when every face overflows the total",
  },
  {
    notation: `1d6-${Number.MAX_SAFE_INTEGER}`,
    tagNotation: `1d20-${Number.MAX_SAFE_INTEGER}`,
    accepted: true,
    note: "the negative mirror stays legal — the dice push the total toward zero",
  },
  {
    notation: `1d6+${Number.MAX_SAFE_INTEGER + 1}`,
    tagNotation: `1d20+${Number.MAX_SAFE_INTEGER + 1}`,
    accepted: false,
    note: "one past the modifier's own exactness",
  },
  {
    notation: `1d6-${Number.MAX_SAFE_INTEGER + 1}`,
    tagNotation: `1d20-${Number.MAX_SAFE_INTEGER + 1}`,
    accepted: false,
    note: "one past the modifier's own exactness, negative",
  },
  {
    notation: `1d6+${FORTY_NINE_NINES}`,
    tagNotation: `1d20+${FORTY_NINE_NINES}`,
    accepted: false,
    note: "49 digits parses to an imprecise float",
  },
  {
    notation: `1d6-${FORTY_NINE_NINES}`,
    tagNotation: `1d20-${FORTY_NINE_NINES}`,
    accepted: false,
    note: "49 digits, negative",
  },
  {
    notation: `1d6+${"9".repeat(400)}`,
    tagNotation: `1d20+${"9".repeat(400)}`,
    accepted: false,
    note: "long enough to parse as Infinity",
  },
];

// The grammar itself. An accepted notation promises both ends of its own total
// range, not just an exact modifier. The low end is a property assertion rather
// than a branch in the parser — it cannot fail while a modifier is held to its
// own exactness and count is at least one — so it lives here, where loosening
// either of those guards would red it.
for (const testCase of MODIFIER_CASES) {
  const parsed = parseDiceNotation(testCase.notation);
  assert.equal(parsed !== null, testCase.accepted, `shared grammar: ${testCase.note}`);
  assert.equal(sharedIsDiceNotation(testCase.notation), testCase.accepted);
  if (parsed) {
    assert.ok(Number.isSafeInteger(parsed.modifier), `an accepted modifier is always exact: ${testCase.note}`);
    assert.ok(
      Number.isSafeInteger(parsed.modifier + parsed.count),
      `the lowest total an accepted notation can roll is exact: ${testCase.note}`,
    );
    assert.ok(
      Number.isSafeInteger(parsed.modifier + parsed.count * parsed.sides),
      `the highest total an accepted notation can roll is exact: ${testCase.note}`,
    );
  }
}

// The /roll service. Its bounds policy clamps oversized dice, but a total range
// that leaves the safe integers is a grammar refusal, so it throws rather than
// clamping.
for (const testCase of MODIFIER_CASES) {
  if (!testCase.accepted) {
    assert.throws(() => rollDice(testCase.notation), /Invalid dice notation/, `/roll must refuse: ${testCase.note}`);
    continue;
  }
  const rolled = rollDice(testCase.notation);
  assert.ok(Number.isSafeInteger(rolled.modifier), `/roll reports an exact modifier: ${testCase.note}`);
  assert.ok(Number.isSafeInteger(rolled.total), `/roll reports an exact total: ${testCase.note}`);
  assert.equal(
    BigInt(rolled.total),
    rolled.rolls.reduce((sum, roll) => sum + BigInt(roll), BigInt(rolled.modifier)),
    `/roll's total matches the arithmetic truth: ${testCase.note}`,
  );
}

// The roll_dice tool. A refusal has to reach the model as a rejected notation;
// the failure this pins is the model being handed a total it cannot use.
for (const testCase of MODIFIER_CASES) {
  const result = await rollThroughTool(testCase.notation);
  if (!testCase.accepted) {
    assert.match(String(result.error), /^Invalid dice notation/, `roll_dice must refuse: ${testCase.note}`);
    assert.ok(
      typeof result.hint === "string" && result.hint.length > 0,
      `a refused notation still carries its hint: ${testCase.note}`,
    );
    assert.equal(result.total, undefined, `a refused notation reports no total: ${testCase.note}`);
    assert.equal(result.rolls, undefined, `a refused notation reports no dice: ${testCase.note}`);
    continue;
  }
  const parsed = parseDiceNotation(testCase.notation)!;
  assert.equal(result.error, undefined, `roll_dice must accept: ${testCase.note}`);
  assert.ok(Number.isSafeInteger(result.total as number), `roll_dice reports an exact total: ${testCase.note}`);
  assert.equal(result.modifier, parsed.modifier);
  // Both formulas are pinned here now. `sum` used to be unpinnable at this
  // magnitude because total - modifier rounded; with the total range itself held
  // to the safe integers the two agree, so the tool has to report a sum that is
  // the dice and a total that is that sum plus the modifier.
  const rolls = result.rolls as number[];
  assert.equal(
    result.sum,
    rolls.reduce((sum, roll) => sum + roll, 0),
    `roll_dice's sum is the dice as thrown: ${testCase.note}`,
  );
  assert.equal(result.total, (result.sum as number) + parsed.modifier, `roll_dice's total closes: ${testCase.note}`);
  assert.equal(
    BigInt(result.total as number),
    rolls.reduce((sum, roll) => sum + BigInt(roll), BigInt(parsed.modifier)),
    `roll_dice's total matches the arithmetic truth: ${testCase.note}`,
  );
}

// The GM skill-check tag. An unusable total must leave the check unresolved —
// publishing a resolved result would put a number on the card that the GM never
// rolled.
for (const testCase of MODIFIER_CASES) {
  const resolved = parseRollsNotation(testCase.tagNotation)?.resolvedResult;
  if (testCase.accepted) {
    assert.equal(resolved?.dice, "1d20", `a usable total still resolves: ${testCase.note}`);
    continue;
  }
  assert.equal(resolved, undefined, `an unusable total leaves the check unresolved: ${testCase.note}`);
}

// ── The boundary moves with the dice, not with a constant ──
//
// Each shape's largest legal modifier is MAX_SAFE_INTEGER minus its own top
// throw, because that top throw is what the total has to survive.
for (const { dice, topThrow } of [
  { dice: "1d6", topThrow: 6 },
  { dice: "2d6", topThrow: 12 },
  { dice: "d20", topThrow: 20 },
  { dice: "100d1000", topThrow: 100_000 },
]) {
  const largest = Number.MAX_SAFE_INTEGER - topThrow;
  const accepted = parseDiceNotation(`${dice}+${largest}`);
  assert.ok(accepted, `${dice} accepts a modifier of MAX_SAFE_INTEGER - ${topThrow}`);
  assert.equal(accepted.count * accepted.sides, topThrow, `${dice} tops out ${topThrow} above its modifier`);
  assert.equal(BigInt(largest) + BigInt(topThrow), BigInt(Number.MAX_SAFE_INTEGER), "and that lands exactly on 2^53-1");
  assert.equal(parseDiceNotation(`${dice}+${largest + 1}`), null, `${dice} refuses one past it`);
  // Negative modifiers are bounded by their own exactness instead: from there
  // the dice can only move the total toward zero.
  assert.ok(parseDiceNotation(`${dice}-${Number.MAX_SAFE_INTEGER}`), `${dice} keeps its negative mirror`);
  assert.equal(parseDiceNotation(`${dice}-${Number.MAX_SAFE_INTEGER + 1}`), null, `${dice} refuses past that mirror`);
}

// The count-times-sides product is checked before it is added to anything.
// Past 2^53 the product rounds on its own, and a rounded product carried into
// the sum claims an exactness the true total does not have: 3d3002399751580331
// throws at most 2^53 + 1, which rounds to 2^53, and taking one off *that*
// lands on MAX_SAFE_INTEGER while the honest maximum is 2^53.
const ROUNDED_PRODUCT_NOTATION = "3d3002399751580331-1";
assert.equal(3 * 3002399751580331, 9007199254740992, "the float product rounds down to 2^53");
assert.equal(BigInt(3) * BigInt(3002399751580331), 9007199254740993n, "while the honest product is 2^53 + 1");
assert.equal(-1 + 3 * 3002399751580331, Number.MAX_SAFE_INTEGER, "so the naive maximum total looks safe");
assert.equal(parseDiceNotation(ROUNDED_PRODUCT_NOTATION), null, "the grammar refuses it on the product alone");
assert.throws(() => rollDice(ROUNDED_PRODUCT_NOTATION), /Invalid dice notation/);
const roundedProductResult = await rollThroughTool(ROUNDED_PRODUCT_NOTATION);
assert.match(String(roundedProductResult.error), /^Invalid dice notation/);
assert.equal(roundedProductResult.total, undefined, "and reports no total for it");

// ── Entry 5: the client /roll slash command ──

async function rollThroughSlashCommand(notation: string) {
  const match = matchSlashCommand(`/roll ${notation}`);
  assert.ok(match, "/roll must stay registered");
  const posted: Array<{ role: string; content: string; extra?: Record<string, unknown> }> = [];
  const result = await match.command.execute(match.args, {
    chatId: "dice-notation-regression",
    generate: async () => true,
    createMessage: (data) => {
      posted.push(data);
    },
    invalidate: () => {},
    characterNames: [],
  } as unknown as SlashCommandContext);
  return { result, posted: posted[0] };
}

interface SlashDiceRollResult {
  notation: string;
  rolls: number[];
  modifier: number;
  total: number;
}

function slashDiceRollResult(posted: { extra?: Record<string, unknown> } | undefined): SlashDiceRollResult {
  assert.ok(posted, "a roll posts a narrator message");
  const rolled = (posted.extra as { diceRollResult?: SlashDiceRollResult } | undefined)?.diceRollResult;
  assert.ok(rolled, "and carries the roll on the message's extra metadata");
  return rolled;
}

// The command still rolls what it always rolled.
const slashOrdinary = await rollThroughSlashCommand("2d6+3");
assert.equal(slashOrdinary.result.handled, true);
assert.ok(slashOrdinary.posted, "an ordinary notation posts a narrator message");
assert.match(slashOrdinary.posted.content, /^🎲 \*\*2d6\+3\*\* → \*\*\d+\*\*/);

// A bare d20 through the client path. This is the notation the whole change is
// about: the tool used to refuse it while the three other readers took it, so
// the client's own narrator message and the metadata the dice card reads are
// pinned here as well as the grammar.
const slashBareD20 = await rollThroughSlashCommand("d20");
assert.equal(slashBareD20.result.handled, true, "a bare d20 is handled by /roll");
assert.equal(slashBareD20.result.feedback, undefined, "a bare d20 posts no error copy");
assert.equal(slashBareD20.posted?.role, "narrator", "a bare d20 posts as the narrator");
const bareD20Roll = slashDiceRollResult(slashBareD20.posted);
assert.deepEqual(
  Object.keys(bareD20Roll).sort(),
  ["modifier", "notation", "rolls", "total"],
  "the diceRollResult metadata keeps the shape the dice card reads",
);
assert.equal(bareD20Roll.notation, "d20", "the metadata keeps the notation as typed");
assert.equal(bareD20Roll.rolls.length, 1, "a bare d20 throws exactly one die");
assert.ok(bareD20Roll.rolls[0]! >= 1 && bareD20Roll.rolls[0]! <= 20, "and it lands on a d20 face");
assert.equal(bareD20Roll.modifier, 0, "a bare d20 carries no modifier");
assert.equal(bareD20Roll.total, bareD20Roll.rolls[0], "and its total is the die");
// One die and no modifier means the message is the bare headline, no detail tail.
assert.equal(slashBareD20.posted!.content, `🎲 **d20** → **${bareD20Roll.total}**`);

for (const testCase of MODIFIER_CASES) {
  const { result, posted } = await rollThroughSlashCommand(testCase.notation);
  assert.equal(result.handled, true, `/roll always handles the command: ${testCase.note}`);
  if (!testCase.accepted) {
    assert.equal(posted, undefined, `a refused notation posts nothing: ${testCase.note}`);
    assert.match(String(result.feedback), /^Invalid dice notation/, `/roll error copy: ${testCase.note}`);
    continue;
  }
  assert.equal(result.feedback, undefined, `an accepted notation needs no error copy: ${testCase.note}`);
  const rolled = slashDiceRollResult(posted);
  assert.ok(Number.isSafeInteger(rolled.modifier), `/roll reports an exact modifier: ${testCase.note}`);
  assert.ok(Number.isSafeInteger(rolled.total), `/roll reports an exact total: ${testCase.note}`);
  assert.equal(
    BigInt(rolled.total),
    rolled.rolls.reduce((sum, roll) => sum + BigInt(roll), BigInt(rolled.modifier)),
    `/roll's total matches the arithmetic truth: ${testCase.note}`,
  );
}

process.stdout.write("Dice notation regression passed.\n");
