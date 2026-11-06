/** Levels of one sheet value that each add a weapon die on a critical hit read as one line, their
 *  dice summed (ship readiness 2026-10-25: Brutal Critical showed four "one more weapon die" lines). */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  parseRulesetDefinition,
  rulesetCheckSources,
  rulesetItemEffectFacts,
  rulesetSheetBuildSchema,
} from "../../packages/shared/src/index.js";

const doc = JSON.parse(
  readFileSync(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url), "utf8"),
);
const brutal = (at: number) => ({
  track: "death_save_successes",
  at,
  modifiers: [
    {
      to: "damage",
      criticalDice: 1,
      attacks: "weapon",
      blow: "melee",
      label: "one more weapon die on a melee critical",
    },
  ],
});
doc.combat.levels.push(brutal(1), brutal(2), brutal(3));
const parsed = parseRulesetDefinition(doc);
assert.ok(parsed.ok, parsed.ok ? "" : parsed.issues.join("; "));
const definition = parsed.definition;
const build = rulesetSheetBuildSchema.parse({ abilities: { str: 16 }, fields: { level: 9 } });
const sources = (value: number) =>
  rulesetCheckSources(definition, build, { tracks: { death_save_successes: value } }).filter((source) =>
    source.modifiers?.some((one) => one.criticalDice),
  );
const three = sources(3);
assert.equal(three.length, 1, JSON.stringify(three));
assert.equal(three[0]!.modifiers![0]!.criticalDice, 3);
const facts = rulesetItemEffectFacts(definition, { modifiers: three[0]!.modifiers });
assert.deepEqual(
  facts.map((fact) => fact.change),
  [{ criticalDice: 3 }],
);
assert.deepEqual(facts[0]!.damage, { attacks: "weapon", blow: "melee" });
assert.equal(sources(1)[0]!.modifiers![0]!.criticalDice, 1, "one level, one die");
assert.equal(sources(0).length, 0);

// Levels that each add a plain number are one term too (laptop 0706 Party B: a revival's penalty read as
// three -1s on one death save).
{
  const penalty = JSON.parse(
    readFileSync(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url), "utf8"),
  );
  penalty.combat.levels.push(
    ...[1, 2, 3].map((at) => ({
      track: "death_save_successes",
      at,
      modifiers: [
        { to: "attacks", flat: -1 },
        { to: "saves", flat: -1 },
      ],
    })),
  );
  const read = parseRulesetDefinition(penalty);
  assert.ok(read.ok, read.ok ? "" : read.issues.join("; "));
  const lines = rulesetCheckSources(read.definition, build, { tracks: { death_save_successes: 3 } }).filter((source) =>
    source.modifiers?.some((one) => one.flat !== undefined && one.to === "saves"),
  );
  assert.equal(lines.length, 1, JSON.stringify(lines));
  assert.deepEqual(
    lines[0]!.modifiers!.map((one) => one.flat),
    [-3, -3],
  );
  assert.doesNotMatch(lines[0]!.name, / \d$/, "named once, not by its level");
}
console.log("Critical dice line: levels that each add a weapon die on a critical are one line, summed.");
