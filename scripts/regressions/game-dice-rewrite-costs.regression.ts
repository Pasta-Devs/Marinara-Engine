/**
 * A dice rewrite keeps what the draft spent (laptop playtest 2026-10-25).
 *
 * After the engine rolls, the GM rewrites its draft around the results and only the rewrite's
 * commands execute. A `spend` or `use` sheet command is the price of acting at all, so one the
 * rewrite drops is put back; one it repeats is kept once; everything else is the rewrite's own.
 */
import assert from "node:assert/strict";

import { draftCostTags, keepDraftCosts } from "../../packages/server/src/services/game/dice-rewrite-costs.js";

const spendShape = `[sheet: who="Wren Mosswood" op="spend" pool="Wild Shape" amount="1"]`;
const spendSong = `[sheet: who="Lyra Quill" op="spend" pool="Bardic Inspiration" amount="1"]`;
const shaped = `[sheet: who="Wren Mosswood" op="condition" condition="Wild Shape" state="on"]`;
const draft = [
  spendShape,
  shaped,
  spendSong,
  `[sheet: who="Lyra Quill" op="damage" pool="hp" amount="4"]`,
  "Wren drops to all fours.",
  `[skill_check: who="Wren Mosswood" skill="Athletics" dc="12"]`,
].join("\n");

assert.deepEqual(draftCostTags(draft), [spendShape, spendSong], "spends and uses only");

// The rewrite kept the condition and dropped both spends and the guessed harm.
const rewrite = `${shaped}\nThe wolf bounds over the wall.`;
const kept = keepDraftCosts(draft, rewrite);
assert.equal(kept, `${spendShape}\n${spendSong}\n${rewrite}`, "both spends put back in front");
assert.doesNotMatch(kept, /op="damage"/, "a consequence the dice decide stays the rewrite's to write");

// One the rewrite repeats, in its own words' case and order, is kept once.
const repeated = `[sheet: op="SPEND" amount="1" pool="wild shape" who="wren mosswood"]\nThe wolf bounds over the wall.`;
assert.equal(keepDraftCosts(draft, repeated), `${spendSong}\n${repeated}`);

// A use is a cost too, and a failed rewrite still pays the draft's costs.
const cast = `[sheet: who="Ada" op="use" name="Bless"]`;
assert.equal(keepDraftCosts(`${cast}\nAda prays.`, ""), cast);

// A draft with no costs leaves the rewrite exactly as it is.
assert.equal(keepDraftCosts("No tags at all.", rewrite), rewrite);

console.log("Dice rewrite costs: the draft's spends and uses are kept once, the rest is the rewrite's.");
