import assert from "node:assert/strict";
import { parseGameJsonish } from "../../src/services/game/jsonish.js";
import {
  noodleStageProfileDraftResponseSchema,
} from "../../../shared/src/schemas/noodle.schema.js";

// ── Array-wrapped LLM response: [{…}] → {…} ──────────────────────────────
const arrayWrapped = parseGameJsonish('[{"displayName":"Taro","handle":"Taro_One","bio":"A test","stagePersonality":"Quiet","disclosureMode":"Always","reasoning":"extra key"}]');
assert.ok(Array.isArray(arrayWrapped), "parseGameJsonish returns raw array for JSON array input");
const unwrapped = arrayWrapped.length === 1 ? arrayWrapped[0] : arrayWrapped;
// The schema strips extras and omits disclosureMode — must not throw.
const parsed = noodleStageProfileDraftResponseSchema.omit({ disclosureMode: true }).strip().parse(
  unwrapped as Record<string, unknown>,
);
assert.equal(parsed.displayName, "Taro", "field extracted correctly after unwrapping");
assert.equal(parsed.handle, "Taro_One", "handle extracted correctly");
assert.equal(parsed.stagePersonality, "Quiet", "stagePersonality extracted correctly");
assert.ok(!("reasoning" in parsed), "extra keys must be dropped by .strip()");
assert.ok(!("disclosureMode" in parsed), "disclosureMode must be dropped by .omit()");

// ── Single valid object (no array) ────────────────────────────────────────
const singleObj = parseGameJsonish('{"displayName":"Yuki","handle":"Yuki_M","bio":"A bio","stagePersonality":"Brave","disclosureMode":"hinted"}');
assert.ok(!Array.isArray(singleObj), "single object should not be an array");
const parsedSingle = noodleStageProfileDraftResponseSchema.omit({ disclosureMode: true }).strip().parse(
  singleObj as Record<string, unknown>,
);
assert.equal(parsedSingle.displayName, "Yuki");
assert.equal(parsedSingle.handle, "Yuki_M");
assert.equal(parsedSingle.stagePersonality, "Brave");

// ── Invalid disclosureMode value — must not crash (omitted before validation) ─
const badDisclosure = parseGameJsonish('{"displayName":"Ryo","handle":"Ryo","bio":"Ryo bio","stagePersonality":"Calm","disclosureMode":"Always"}');
const parsedBad = noodleStageProfileDraftResponseSchema.omit({ disclosureMode: true }).strip().parse(
  badDisclosure as Record<string, unknown>,
);
assert.equal(parsedBad.displayName, "Ryo", "displayName preserved despite invalid disclosureMode");

// ── Schema .strict() rejects extras that survive — must be dropped ────────
const withExtras = { displayName: "M", handle: "M", bio: "b", stagePersonality: "s", reasoning: "LLM chatted", extra: true } as Record<string, unknown>;

const stripped = noodleStageProfileDraftResponseSchema.omit({ disclosureMode: true }).strip().parse(
  withExtras as Record<string, unknown>,
);
assert.ok(!("reasoning" in stripped), "reasoning must not survive .strip()");
assert.ok(!("extra" in stripped), "unknown keys must not survive .strip()");

process.stdout.write("Noodle stage profile draft regression passed.\n");
