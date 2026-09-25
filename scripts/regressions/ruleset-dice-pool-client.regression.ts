// The client half of the `dice-pool` resolution kind, driven through the REAL exported helpers and
// REAL example rulesets, so nothing here can agree with a mistake the components also make.
//
// What it pins: one check number is spelled the way its kind means it, and a `dice-sum` ruleset is
// spelled exactly as the shared formatter spells it, so nothing about today's d20 and 2d6 sheets
// moves; the rules summary reads the numbers out of the definition rather than assuming a
// ten-sided die or a target of seven; the optional rules are listed only when the file turned them
// on, in a fixed order; and every localization key the changed components ask for exists.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  formatRulesetCheckValue,
  parseRulesetDefinition,
  type RulesetDefinition,
} from "../../packages/shared/src/index.js";
import { rulesetCheckValueText, rulesetRulesSummary } from "../../packages/client/src/lib/ruleset-resolution.js";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const readSource = (path: string) => readFileSync(join(repositoryRoot, path), "utf8");

const messages = JSON.parse(readSource("packages/client/src/localization/locales/en.json")) as Record<string, string>;

/** English rendering with i18next's own plural suffix and interpolation, so the assertions below
 *  read the shipped strings rather than a copy of them. */
function translate(key: string, params: Record<string, unknown> = {}): string {
  const count = params.count;
  const plural = typeof count === "number" ? `${key}_${count === 1 ? "one" : "other"}` : key;
  const message = messages[plural] ?? messages[key];
  assert.ok(message, `en.json is missing ${key}`);
  return message.replace(/\{\{\s*([^{}]+?)\s*\}\}/gu, (_all, name: string) => String(params[name] ?? ""));
}
const t = translate as unknown as Parameters<typeof rulesetRulesSummary>[1];

/** A translator that says WHICH key was asked for and with what, instead of rendering English, so
 *  rewording a string in en.json cannot fail a test that is about which parts a summary has and in
 *  what order. */
function describeKey(key: string, params: Record<string, unknown> = {}): string {
  const name = key.replace("game.ruleset.", "");
  const shown = Object.keys(params)
    .sort()
    .map((param) => `${param}=${String(params[param])}`);
  return shown.length > 0 ? `${name}(${shown.join(",")})` : name;
}
const keyed = describeKey as unknown as Parameters<typeof rulesetRulesSummary>[1];

// ── Every key the changed client code asks for exists ──

const keyPattern = /"((?:game\.ruleset\.(?:check|rules)|ui\.dice)\.[a-zA-Z0-9_.]+)"/gu;
const sources = [
  "packages/client/src/lib/ruleset-resolution.ts",
  "packages/client/src/components/rulesets/RulesetSheetEditor.tsx",
  "packages/client/src/components/game/GameRulesetSheet.tsx",
  "packages/client/src/components/game/GameSetupRulesChooser.tsx",
  "packages/client/src/components/agents/RulesetImportReviewModal.tsx",
  "packages/client/src/components/dice/AnimatedDiceRoll.tsx",
  "packages/client/src/components/dice/AnimatedSkillCheckResult.tsx",
].map(readSource);
const referenced = new Set<string>();
for (const source of sources) for (const match of source.matchAll(keyPattern)) referenced.add(match[1]!);
assert.ok(referenced.size >= 12, "the changed components' localization keys were not found in the source");
for (const key of referenced) {
  // A key used with a count resolves to its plural forms, and both have to exist.
  const present = key in messages || (`${key}_one` in messages && `${key}_other` in messages);
  assert.ok(present, `en.json is missing ${key}`);
}

// ── The example rulesets, parsed exactly as the Engine parses them ──

function parseExample(path: string, edit?: (source: Record<string, unknown>) => void): RulesetDefinition {
  const source = JSON.parse(readSource(path)) as Record<string, unknown>;
  edit?.(source);
  const parsed = parseRulesetDefinition(source);
  assert.ok(parsed.ok, `${path} does not parse: ${parsed.ok ? "" : parsed.issues.join("; ")}`);
  return parsed.definition;
}

const gravewatch = parseExample("docs/examples/rulesets/gravewatch.json");
const ember = parseExample("docs/examples/rulesets/ember-roads.json");
// The packaged 5e ruleset lives in the Marinara-Agents repository, so the d20 sum it is built on is
// stood up here from the example the Engine does ship. It is the same resolution kind and the same
// summary path; only the dice differ from Ember Roads.
const d20Sum = parseExample("docs/examples/rulesets/ember-roads.json", (source) => {
  (source.resolution as Record<string, unknown>).dice = { count: 1, sides: 20 };
});

/** A pool ruleset with only the rules this test asks for, still validated as a real file. */
function poolRuleset(resolution: Record<string, unknown>): RulesetDefinition {
  return parseExample("docs/examples/rulesets/gravewatch.json", (source) => {
    const base = source.resolution as Record<string, unknown>;
    // The shipped layer swaps the shipped ladder, and these resolutions replace it, so the layer
    // goes with the ladder it was written for.
    delete source.layers;
    // The shipped Grave Sight charm moves the exploding face to 8, which these resolutions may not
    // allow, and the summary never reads a catalog, so it goes.
    for (const catalog of (source.catalogs as Array<{ entries?: Array<Record<string, any>> }>) ?? []) {
      catalog.entries = (catalog.entries ?? []).filter((entry) => entry.mechanics?.check?.explode === undefined);
    }
    source.resolution = {
      kind: "dice-pool",
      abilityModifier: base.abilityModifier,
      proficiencyTiers: base.proficiencyTiers,
      difficultyLadder: [{ label: "Standard", successes: 1 }],
      ...resolution,
    };
  });
}

// ── One check number, spelled the way its kind means it ──

// A pool says dice, in the user's language, with the singular the count calls for.
assert.equal(rulesetCheckValueText(gravewatch, 5, keyed), "check.dice(count=5)");
assert.equal(rulesetCheckValueText(gravewatch, 5, t), "5 dice");
assert.equal(rulesetCheckValueText(gravewatch, 1, t), "1 die");
assert.equal(rulesetCheckValueText(gravewatch, 0, t), "0 dice");

// A summed ruleset asks for no key at all and comes out of the shared formatter, byte for byte, so
// every d20 and 2d6 sheet on screen today reads exactly as it did before this kind existed.
for (const value of [-3, -1, 0, 1, 5, 12]) {
  assert.equal(rulesetCheckValueText(ember, value, keyed), formatRulesetCheckValue(ember, value));
  assert.equal(rulesetCheckValueText(d20Sum, value, keyed), formatRulesetCheckValue(d20Sum, value));
}
assert.equal(rulesetCheckValueText(ember, 5, t), "+5");
assert.equal(rulesetCheckValueText(ember, 0, t), "+0");
assert.equal(rulesetCheckValueText(ember, -1, t), "-1");

// ── The rules summary ──

// A summed ruleset is the one line it has always been, and names its own dice.
assert.deepEqual(rulesetRulesSummary(ember, keyed), ["import.resolutionDiceSum(dice=2d6)"]);
assert.deepEqual(rulesetRulesSummary(d20Sum, keyed), ["import.resolutionDiceSum(dice=1d20)"]);
assert.equal(
  rulesetRulesSummary(ember, t)[0],
  "Roll 2d6, add the sheet's modifiers, and compare the result against a difficulty.",
);

// Gravewatch: an adjustable target is reported as the range it may move in, and every optional rule
// it turns on is listed once, in the order the summary declares. It ships no doubling rule, so no
// doubling phrase appears. Its exploding face may be lowered to 8 for a check, a check may name its
// standing re-throw, and an ability check may add a second ability, which is said last because it
// is about what fills the pool.
assert.deepEqual(rulesetRulesSummary(gravewatch, keyed), [
  "rules.poolTargetRange(max=9,min=5,sides=10)",
  "rules.explodeMovable(from=10,min=8)",
  "rules.cancel(upTo=1)",
  "rules.botch(upTo=1)",
  "rules.exceptional(count=5)",
  "rules.situational(max=3,min=-3)",
  "rules.reroll(id=careful,upTo=6)",
  "rules.abilityPlusAbility",
]);
assert.equal(
  rulesetRulesSummary(gravewatch, t)[1],
  "A face of 10 or more rolls one more die; a check can lower it to 8.",
);
assert.equal(rulesetRulesSummary(gravewatch, t)[0], "d10 pool, a die succeeds on 5 to 9, set per check.");

// A plain pool: a fixed target says "or more", and a file that turns no optional rule on is one
// line. The numbers are its own, which is what proves nothing is hardcoded to a ten or a one.
const plainPool = poolRuleset({
  die: { sides: 6 },
  pool: { min: 0, max: 8 },
  target: { default: 4, min: 4, max: 4 },
});
assert.deepEqual(rulesetRulesSummary(plainPool, keyed), ["rules.poolTarget(sides=6,target=4)"]);
assert.equal(rulesetRulesSummary(plainPool, t)[0], "d6 pool, a die succeeds on 4 or more.");
assert.equal(rulesetCheckValueText(plainPool, 1, t), "1 die");

// Doubling is listed before exploding, and a pool that doubles but never explodes says only that.
const doublingPool = poolRuleset({
  die: { sides: 12 },
  target: { default: 8, min: 8, max: 8 },
  double: { from: 11 },
  cancel: { upTo: 2 },
});
assert.deepEqual(rulesetRulesSummary(doublingPool, keyed), [
  "rules.poolTarget(sides=12,target=8)",
  "rules.double(from=11)",
  "rules.cancel(upTo=2)",
]);
assert.equal(rulesetRulesSummary(doublingPool, t)[1], "A face of 11 or more counts twice.");

// A face rule with only a min fires only when a check asks, and says so; a botch read off half the
// dice says what it does on a roll that still succeeded.
const onAskPool = poolRuleset({
  die: { sides: 6 },
  target: { default: 5, min: 5, max: 5 },
  explode: { min: 6 },
  double: { min: 5 },
  botch: { upTo: 1, rule: "halfOrMore" },
});
assert.deepEqual(rulesetRulesSummary(onAskPool, keyed), [
  "rules.poolTarget(sides=6,target=5)",
  "rules.doubleOnAsk(min=5)",
  "rules.explodeOnAsk(min=6)",
  "rules.botchHalf(upTo=1)",
]);
assert.equal(rulesetRulesSummary(onAskPool, t)[2], "A check can make faces from 6 up roll one more die.");
assert.match(rulesetRulesSummary(onAskPool, t)[3]!, /half the dice or more/);

// A single success required still reads as one success, not "1 successes".
const exceptionalOne = poolRuleset({
  die: { sides: 10 },
  target: { default: 7, min: 7, max: 7 },
  exceptional: { successes: 1 },
});
assert.equal(rulesetRulesSummary(exceptionalOne, t).at(-1), "1 success or more is a critical success.");

// ── The lane stays hooked up ──

assert.match(
  readSource("scripts/regressions/tsconfig.client-lanes.json"),
  /ruleset-dice-pool-client\.regression\.ts/u,
  "this lane needs DOM-free client types, so the client lint's lane tsconfig must include it",
);

console.log("Ruleset dice-pool client regressions passed.");
