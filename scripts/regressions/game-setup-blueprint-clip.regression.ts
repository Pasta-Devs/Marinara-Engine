/**
 * A setup reply's blueprint keeps its campaign plan when a model writes past a cap: an over-long
 * string is cut at a word, never a reason to drop the blueprint (laptop playtest 2026-10-24: an
 * encounter principle over 160 characters left the game with only its HUD widgets).
 */
import assert from "node:assert/strict";
import { clipText, gameSetupBlueprintSchema } from "../../packages/server/src/services/game/game-setup-blueprint.js";

const long = "Every fight should turn on the terrain and the clock, ".repeat(5).trim();
const parsed = gameSetupBlueprintSchema.safeParse({
  campaignPlan: {
    openingSituation: "x ".repeat(200),
    pressureClocks: [{ name: "Clock ".repeat(30), steps: 6, current: 0, failure: long }],
    factions: [{ name: "A", goal: long, method: long, secret: long }],
    questSeeds: [long],
    encounterPrinciples: [long, "Short and fine."],
  },
  hudWidgets: [],
});
assert.ok(parsed.success, parsed.success ? "" : JSON.stringify(parsed.error.issues));
const plan = parsed.data.campaignPlan!;
assert.equal(plan.encounterPrinciples[1], "Short and fine.", "a string within its cap is kept as written");
assert.ok(plan.encounterPrinciples[0]!.length <= 160);
assert.ok(plan.encounterPrinciples[0]!.endsWith("…"));
assert.ok(plan.openingSituation.length <= 240);
assert.ok(plan.pressureClocks[0]!.name.length <= 80);
assert.ok(plan.factions[0]!.secret!.length <= 180);

// Cut at the last word that fits, or mid-word when no word break is near.
assert.equal(clipText("alpha beta gamma", 12), "alpha beta…");
assert.equal(clipText("abcdefghijklmnop", 8), "abcdefg…");
assert.equal(clipText("short", 8), "short");
// An emoji straddling the cut is dropped whole, never split into half a pair.
const straddled = clipText("abcdef\u{1F600}ghij", 8);
assert.equal(straddled, "abcdef…");
assert.ok(straddled.length <= 8);
assert.ok(!/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/.test(straddled));

console.log("game-setup-blueprint-clip: ok");
