/**
 * A dice rewrite keeps what the draft spent (laptop playtest 2026-10-25).
 *
 * After the engine rolls, the GM rewrites its draft around the results and only the rewrite's
 * commands execute. A `spend` or `use` sheet command is the price of acting at all, so one the
 * rewrite drops is put back; one it repeats is kept once, a command naming nobody being the
 * player's; everything else is the rewrite's own. The route hands in the draft with its chance
 * branches already picked, so a cost in a discarded half is never paid.
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

// A command naming nobody is the player's: the same cost as one naming them, either way round.
const unnamed = `[sheet: op="spend" pool="Ki" amount="1"]`;
const named = `[sheet: who="Mira" op="spend" pool="Ki" amount="1"]`;
assert.equal(keepDraftCosts(unnamed, named, "Mira"), named, "the draft's unnamed spend is the rewrite's named one");
assert.equal(keepDraftCosts(named, unnamed, "mira"), unnamed, "and the reverse");
// Another member's spend on the same pool stays a cost of its own, and so does the party sheet's.
const theirs = `[sheet: who="Tam" op="spend" pool="Ki" amount="1"]`;
assert.equal(keepDraftCosts(theirs, unnamed, "Mira"), `${theirs}\n${unnamed}`);
const party = `[sheet: sheet="party" op="spend" pool="Ki" amount="1"]`;
assert.equal(keepDraftCosts(party, unnamed, "Mira"), `${party}\n${unnamed}`);
// A party command that names anybody is refused by the sheet pass, so it never stands in for the
// draft's: the draft's is put back.
const partyNamed = `[sheet: sheet="party" who="Mira" op="spend" pool="Ki" amount="1"]`;
assert.equal(keepDraftCosts(party, partyNamed, "Mira"), `${party}\n${partyNamed}`);
assert.equal(keepDraftCosts(party, party, "Mira"), party, "the same party command is kept once");

// What the draft traded is kept too: a buy the rewrite dropped is put back, one it repeats is kept
// once, and an item found is the rewrite's to say (laptop 2026-10-25: a rewrite after a roll dropped
// a whole shopping trip and the player never saw the coin refusal).
const buyRope = `[inventory: action="buy" item="Rope, hempen (50 feet)" seller="general store" who="Rook Hallow"]`;
const buyLantern = `[inventory: action="buy" item="Lantern, hooded" who="Rook Hallow"]`;
const found = `[inventory: action="add" item="Silver key" who="Rook Hallow"]`;
const shopping = [buyRope, buyLantern, found, "Rook haggles.", `[skill_check: skill="Persuasion" dc="12"]`].join("\n");
assert.deepEqual(draftCostTags(shopping), [buyRope, buyLantern], "trades only, not what was found");
const shopped = `[inventory: who="rook hallow" item="lantern, hooded" action="BUY"]\nThe shopkeeper relents.`;
assert.equal(keepDraftCosts(shopping, shopped, "Mira"), `${buyRope}\n${shopped}`);
// In a game with no ruleset the trades are kept and a sheet command is left alone.
assert.equal(keepDraftCosts(`${cast}\n${buyLantern}`, "", null, false), buyLantern);

// A draft with no costs leaves the rewrite exactly as it is.
assert.equal(keepDraftCosts("No tags at all.", rewrite), rewrite);

console.log("Dice rewrite costs: the draft's spends and uses are kept once, the rest is the rewrite's.");
