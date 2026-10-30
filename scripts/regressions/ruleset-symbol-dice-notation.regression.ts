/** Named symbol dice (#8489): a symbol-pool ruleset's dice thrown by name, as the composer dice route
 *  and the roll_dice tool read them, counted and cancelled the way the ruleset's own checks are. */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  isDiceRollSymbols,
  parseRulesetDefinition,
  parseSymbolDiceNotation,
  rollSymbolDiceNotation,
  rollSymbolPoolCheck,
  SYMBOL_DICE_MAX_DICE,
  type RulesetDefinition,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-symbol-dice-"));
const previousDataDir = process.env.DATA_DIR;
process.env.DATA_DIR = dataDir;
try {
  const [{ parseRollDiceToolResult }, { executeToolCalls, symbolDiceToolResult }, { isDiceRollResult }] =
    await Promise.all([
      import("../../packages/server/src/services/game/dice.service.js"),
      import("../../packages/server/src/services/tools/tool-executor.js"),
      import("../../packages/client/src/lib/dice-roll-result.js"),
    ]);
  const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
  // The guide's own Genesys-style dice and symbols.
  const ember = JSON.parse(read("../../docs/examples/rulesets/ember-roads.json"));
  const guide = read("../../docs/extending/writing-rulesets.md").split("#### `symbol-pool`")[1]!;
  const example = JSON.parse(`{${guide.split("```json\n")[1]!.split("```")[0]}}`).resolution;
  const document = structuredClone(ember);
  delete document.combat;
  delete document.layers;
  document.catalogs = document.catalogs.filter((catalog: { holds?: string }) => catalog.holds !== "creatures");
  document.resolution = { ...example, proficiencyTiers: ember.resolution.proficiencyTiers };
  const parsed = parseRulesetDefinition(document);
  assert.ok(parsed.ok, parsed.ok ? "" : parsed.issues.join("; "));
  const definition: RulesetDefinition = parsed.definition;
  const resolution = definition.resolution;
  const faces = (...values: number[]) => {
    let at = 0;
    return (sides: number) => {
      assert.ok(at < values.length, "unexpected extra die");
      const value = values[at++]!;
      assert.ok(value >= 1 && value <= sides, `face ${value} on d${sides}`);
      return value;
    };
  };

  // ── Reading the notation ──
  assert.deepEqual(parseSymbolDiceNotation(resolution, "2 ability 1 proficiency vs 2 difficulty"), [
    { die: "ability", count: 2 },
    { die: "proficiency", count: 1 },
    { die: "difficulty", count: 2 },
  ]);
  assert.deepEqual(
    parseSymbolDiceNotation(resolution, "1 Ability, 2 boosts + 1 setback against 1 Challenge"),
    [
      { die: "ability", count: 1 },
      { die: "boost", count: 2 },
      { die: "setback", count: 1 },
      { die: "challenge", count: 1 },
    ],
    "labels in any case, a plural, and commas, + and against as separators",
  );
  assert.deepEqual(
    parseSymbolDiceNotation(resolution, "1 ability 2 ability"),
    [{ die: "ability", count: 3 }],
    "a die named twice is counted once",
  );
  for (const refused of ["2d6", "2 fireball", "ability", "0 ability", "2 ability 2d6", "", "x".repeat(201)]) {
    assert.equal(parseSymbolDiceNotation(resolution, refused), null, refused);
  }
  assert.equal(
    parseSymbolDiceNotation(resolution, `${SYMBOL_DICE_MAX_DICE} ability`)?.[0]?.count,
    SYMBOL_DICE_MAX_DICE,
  );
  assert.equal(parseSymbolDiceNotation(resolution, `${SYMBOL_DICE_MAX_DICE} ability 1 boost`), null, "past the cap");
  assert.equal(
    parseSymbolDiceNotation(ember.resolution, "2 ability"),
    null,
    "a ruleset that does not throw symbol dice reads none",
  );
  assert.equal(parseSymbolDiceNotation(null, "2 ability"), null);

  // ── Throwing them: the same symbols the ruleset's own check counts for the same faces ──
  // A check with ability 2 and rank 1 throws one proficiency and one ability die, then two difficulty.
  const values = [12, 4, 2, 8];
  const check = rollSymbolPoolCheck(
    definition,
    { ability: 2, rank: 1, difficulty: 2, isSave: false },
    faces(...values),
  );
  const named = rollSymbolDiceNotation(resolution, "1 proficiency 1 ability vs 2 difficulty", faces(...values));
  assert.ok(named);
  assert.deepEqual(named.rolls, check.rolls);
  assert.deepEqual(named.symbolFaces, check.symbolFaces);
  assert.deepEqual(named.symbols, check.symbols, "counting and cancellation match the check");
  assert.equal(named.total, check.total);
  assert.equal(named.success, check.success);
  assert.deepEqual(named.thrown, ["Proficiency", "Ability", "Difficulty", "Difficulty"], "dice read by their labels");
  assert.equal(named.symbolLabels.s, "Success");
  assert.equal(named.modifier, 0);
  assert.equal(named.notation, "1 proficiency 1 ability vs 2 difficulty");
  // Triumph counts a success, and a success cancelled by failure leaves a net failure.
  const cancelled = rollSymbolDiceNotation(resolution, "1 ability 1 difficulty", faces(2, 3));
  assert.deepEqual(cancelled?.symbols, { f: 1 }, "one success against two failures");
  assert.equal(cancelled?.success, false);
  assert.equal(cancelled?.total, 0, "the total is never negative");

  // ── Carried through the tool result and the dice card ──
  assert.ok(isDiceRollResult(named), "the card draws a symbol roll");
  const stored = parseRollDiceToolResult(JSON.stringify({ ...named, reason: "Stealth" }));
  assert.deepEqual(stored, { ...named, label: "Stealth" }, "a tool roll keeps its symbols and verdict");
  for (const broken of [
    { ...named, thrown: named.thrown.slice(1) },
    { ...named, symbolFaces: undefined },
    { ...named, symbols: { s: -1 } },
    { ...named, symbolLabels: { s: 3 } },
  ]) {
    assert.equal(parseRollDiceToolResult(JSON.stringify(broken)), null);
    assert.equal(isDiceRollResult(broken), false);
  }
  assert.equal(isDiceRollSymbols({}, 2), true, "a plain roll has none of them");

  // ── A modifier or DC the GM passes with symbol dice is reported, not silently dropped ──
  const modified = symbolDiceToolResult(named, { notation: named.notation, modifier: 2, dc: 12 });
  assert.equal(modified.total, named.total, "the modifier does not change the net successes");
  assert.equal(modified.success, named.success);
  assert.match(String(modified.note), /ignore modifier and dc/);
  assert.equal("note" in symbolDiceToolResult(named, { notation: named.notation, modifier: 0 }), false);

  // ── The roll_dice tool outside a symbol-pool game still refuses named dice ──
  const [outside] = await executeToolCalls([
    {
      id: "call_1",
      type: "function",
      function: { name: "roll_dice", arguments: JSON.stringify({ notation: "2 ability" }) },
    },
  ]);
  assert.match(String(JSON.parse(outside!.result).error), /Invalid dice notation/);
  const [missing] = await executeToolCalls(
    [
      {
        id: "call_2",
        type: "function",
        function: { name: "roll_dice", arguments: JSON.stringify({ notation: "2 ability" }) },
      },
    ],
    { chatMeta: { gameRuleset: { id: "not-installed", version: "1.0.0" } } },
  );
  assert.match(
    String(JSON.parse(missing!.result).error),
    /Invalid dice notation/,
    "a game whose ruleset is missing reads no named dice",
  );
  const [plain] = await executeToolCalls(
    [
      {
        id: "call_3",
        type: "function",
        function: { name: "roll_dice", arguments: JSON.stringify({ notation: "2d6" }) },
      },
    ],
    { chatMeta: { gameRuleset: { id: "not-installed", version: "1.0.0" } } },
  );
  assert.equal(JSON.parse(plain!.result).rolls.length, 2, "NdM rolls as before in any game");
} finally {
  if (previousDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = previousDataDir;
  rmSync(dataDir, { recursive: true, force: true });
}

process.stdout.write("Ruleset symbol dice notation regression passed.\n");
