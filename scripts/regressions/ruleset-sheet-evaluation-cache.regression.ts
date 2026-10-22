/**
 * The live-less sheet evaluation a ruleset fight command remembers (#8036):
 *
 *   - Inside `withRulesetSheetEvaluationCache` the same definition and build evaluate to the same
 *     object; with live values it is worked out again, every time.
 *   - Outside a scope, and once one has ended (even by throwing), every call works the sheet out anew.
 *   - The creature-sheet health hold, run inside a scope, still says the clamped maximum: the clone it
 *     edits is read only after the edit.
 *   - A scope opened inside another uses the outer one and does not clear it.
 *   - Work that returns a promise is refused, at the top or nested, and the scope still closes.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  evaluateRulesetSheet,
  holdRulesetSheetHealth,
  parseRulesetDefinition,
  readRulesetLive,
  rulesetSheetBuildSchema,
  withRulesetSheetEvaluationCache,
} from "../../packages/shared/src/index.js";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const parsed = parseRulesetDefinition(
  JSON.parse(readFileSync(join(repositoryRoot, "docs/development/ruleset-5e-2014.example.json"), "utf8")),
);
assert.ok(parsed.ok, parsed.ok ? "" : parsed.issues.join("; "));
const definition = parsed.definition;
const build = rulesetSheetBuildSchema.parse({ fields: { hp_max: 200 } });

// (a) The same build, the same answer; live values are never remembered.
withRulesetSheetEvaluationCache(() => {
  const first = evaluateRulesetSheet(definition, build);
  assert.equal(evaluateRulesetSheet(definition, build), first, "a second live-less read is the first one");
  const live = readRulesetLive(definition, build, {});
  const withLive = evaluateRulesetSheet(definition, build, live);
  assert.notEqual(withLive, first, "a read with live values is worked out");
  assert.notEqual(evaluateRulesetSheet(definition, build, live), withLive, "and worked out again");
  assert.equal(evaluateRulesetSheet(definition, build), first, "without displacing the live-less one");
});

// (b) No scope, no memory; a scope that threw is closed all the same.
assert.notEqual(evaluateRulesetSheet(definition, build), evaluateRulesetSheet(definition, build));
assert.throws(
  () =>
    withRulesetSheetEvaluationCache(() => {
      evaluateRulesetSheet(definition, build);
      throw new Error("command failed");
    }),
  /command failed/,
);
assert.notEqual(evaluateRulesetSheet(definition, build), evaluateRulesetSheet(definition, build));

// (c) Health 200 held into CR 2's 27 to 67 inside a scope says 67, not the clone's stale 200.
const tier = definition.combat!.threat!.tiers.find((entry) => entry.id === "cr_2")!;
const held = withRulesetSheetEvaluationCache(() => holdRulesetSheetHealth(definition, build, tier));
assert.equal(held.sheet.fields.hp_max, 67);
assert.equal(build.fields.hp_max, 200, "the proposed sheet is not written to");
assert.match(held.adjusted.join("\n"), /Health 200 was pulled into the 27 to 67 of CR 2 .*, and is now 67\./);

// (d) A nested scope shares the outer one and leaves it open.
withRulesetSheetEvaluationCache(() => {
  const outer = evaluateRulesetSheet(definition, build);
  const inner = withRulesetSheetEvaluationCache(() => evaluateRulesetSheet(definition, build));
  assert.equal(inner, outer, "the inner scope reads the outer one's");
  assert.equal(evaluateRulesetSheet(definition, build), outer, "and the outer one is still open after it");
});

// (e) A promise would outlive the scope, so it is refused, and the scope is closed after.
assert.throws(() => withRulesetSheetEvaluationCache(() => Promise.resolve(1)), /synchronous work only/);
assert.notEqual(evaluateRulesetSheet(definition, build), evaluateRulesetSheet(definition, build));
withRulesetSheetEvaluationCache(() => {
  assert.throws(() => withRulesetSheetEvaluationCache(() => Promise.resolve(1)), /synchronous work only/);
});

console.log("ruleset sheet evaluation cache regression passed");
