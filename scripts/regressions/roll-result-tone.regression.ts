// The Roleplay `[roll:]` card tints by the server's verdict, the way the skill-check card does.
// Driven through the real helper the cards import, so no color or rule is copied here.
import assert from "node:assert/strict";
import {
  normalizeRollOutcomeToneMode,
  rollTone,
  skillCheckTone,
  TONE_ACCENT,
} from "../../packages/client/src/components/dice/dice-tone.js";
import { isDiceRollResult } from "../../packages/client/src/lib/dice-roll-result.js";

const d20 = (natural: number, success?: boolean) => ({ notation: "1d20", rolls: [natural], success });

// off: never a tone.
assert.equal(rollTone(d20(10, true), "off"), undefined);

// No server verdict: no tone in any mode, and a crit alone never tints.
for (const mode of ["outcome", "outcome-crits"] as const) {
  assert.equal(rollTone(d20(10), mode), undefined);
  assert.equal(rollTone(d20(20), mode), undefined);
  assert.equal(rollTone(d20(1), mode), undefined);
}

// outcome: the verdict only, crits ignored.
assert.equal(rollTone(d20(10, true), "outcome"), "success");
assert.equal(rollTone(d20(10, false), "outcome"), "failure");
assert.equal(rollTone(d20(1, true), "outcome"), "success");
assert.equal(rollTone(d20(20, false), "outcome"), "failure");

// outcome-crits: a natural crit on a single die overrides the verdict.
assert.equal(rollTone(d20(10, true), "outcome-crits"), "success");
assert.equal(rollTone(d20(10, false), "outcome-crits"), "failure");
assert.equal(rollTone(d20(1, true), "outcome-crits"), "critical-failure");
assert.equal(rollTone(d20(20, false), "outcome-crits"), "critical-success");
assert.equal(rollTone({ notation: "1d6+2", rolls: [6], success: true }, "outcome-crits"), "critical-success");

// Several dice never crit, and an unparseable notation falls back to the verdict.
assert.equal(rollTone({ notation: "2d20", rolls: [20, 1], success: false }, "outcome-crits"), "failure");
assert.equal(rollTone({ notation: "3d6", rolls: [6, 6, 6], success: true }, "outcome-crits"), "success");
assert.equal(rollTone({ notation: "fate", rolls: [4], success: true }, "outcome-crits"), "success");
assert.equal(rollTone({ notation: "fate", rolls: [1], success: true }, "outcome-crits"), "success");

// A missing or unknown setting means "outcome".
assert.equal(normalizeRollOutcomeToneMode(undefined), "outcome");
assert.equal(normalizeRollOutcomeToneMode("bogus"), "outcome");
assert.equal(normalizeRollOutcomeToneMode("off"), "off");
assert.equal(normalizeRollOutcomeToneMode("outcome-crits"), "outcome-crits");

// Skill-check tones are unchanged, including the symbols branch.
assert.equal(skillCheckTone({ success: true, criticalSuccess: true }), "critical-success");
assert.equal(skillCheckTone({ success: false, criticalFailure: true }), "critical-failure");
assert.equal(skillCheckTone({ success: true }), "success");
assert.equal(skillCheckTone({ success: false }), "failure");
assert.equal(skillCheckTone({ symbols: true, success: true, criticalSuccess: true }), "success");
assert.equal(skillCheckTone({ symbols: true, success: false, criticalFailure: true }), "failure");
assert.equal(TONE_ACCENT["critical-success"], "oklch(0.82 0.15 86)");

// The payload guard takes `success` only as a boolean.
const base = { notation: "1d20", rolls: [5], modifier: 0, total: 5 };
assert.equal(isDiceRollResult({ ...base }), true);
assert.equal(isDiceRollResult({ ...base, dc: 10, success: false }), true);
assert.equal(isDiceRollResult({ ...base, success: "yes" }), false);
assert.equal(isDiceRollResult({ ...base, success: 1 }), false);

console.log("roll-result-tone regression passed");
