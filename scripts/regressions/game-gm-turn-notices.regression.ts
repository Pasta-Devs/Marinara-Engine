/**
 * Game Mode: an item nobody carries.
 *
 * What is pinned here:
 *   - The turn's notice names the ruleset items the player's message names that no bag holds, plural
 *     and case aside, a shorter name once for a longer one that holds it, and never a held item or a
 *     word inside another word.
 *   - The notice is said in the turn part of the reminder, just before its closing lines, and nowhere
 *     else.
 *   - An add the same reply then gives or removes from the same bag is refused as having no source; an
 *     add that names who it goes to is a give; an add that says where it came from stands.
 */
import assert from "node:assert/strict";

import { applyGameInventoryTags, readResolvedInventoryTags } from "../../packages/shared/src/index.js";
import { buildGmFormatReminder } from "../../packages/server/src/services/game/gm-prompts.js";
import { gmTurnNotices } from "../../packages/server/src/services/game/gm-turn-notices.js";

const known = ["Torch", "Everburning Torch", "Potion of Healing", "Rope, hempen (50 feet)"];

assert.deepEqual(
  gmTurnNotices({
    playerMessage: "Kesh hands Vyre a torch from his pack.",
    knownItems: known,
    heldItems: ["Potion of Healing"],
  }),
  ["Nobody in the party carries: Torch."],
);
// Plural, case and several at once; a held item is never said.
assert.deepEqual(
  gmTurnNotices({
    playerMessage: "We light TORCHES and drink a Potion of Healing.",
    knownItems: known,
    heldItems: ["Potion of Healing"],
  }),
  ["Nobody in the party carries: Torch."],
);
assert.deepEqual(
  gmTurnNotices({
    playerMessage: "Mara drinks the Potion of Healing.",
    knownItems: known,
    heldItems: ["Potion of Healing"],
  }),
  [],
);
// A held Torch covers the Everburning one the message only names as a torch.
assert.deepEqual(gmTurnNotices({ playerMessage: "I raise my torch.", knownItems: known, heldItems: ["Torch"] }), []);
// A nickname is what the bag holds too.
assert.deepEqual(
  gmTurnNotices({
    playerMessage: "I drink the potion of healing.",
    knownItems: known,
    heldItems: ["Red Vial", "Potion of Healing"],
  }),
  [],
);
// A plural name finds its singular, and an "-e" name its plural.
assert.deepEqual(
  gmTurnNotices({
    playerMessage: "I light a candle and coil the ropes.",
    knownItems: ["Candles", "Rope"],
    heldItems: [],
  }),
  ["Nobody in the party carries: Candles, Rope."],
);
// Two book entries that name each other are said once, as the first listed.
assert.deepEqual(
  gmTurnNotices({ playerMessage: "Pass me a torch.", knownItems: ["Torch", "Torches", "TORCH"], heldItems: [] }),
  ["Nobody in the party carries: Torch."],
);
assert.deepEqual(gmTurnNotices({ playerMessage: "I put on my cap.", knownItems: ["Cap", "Cape"], heldItems: [] }), [
  "Nobody in the party carries: Cap.",
]);
// A word inside another word is not the item ("torchlight" names no Torch).
assert.deepEqual(gmTurnNotices({ playerMessage: "By torchlight we read.", knownItems: known, heldItems: [] }), []);
assert.deepEqual(gmTurnNotices({ playerMessage: "   ", knownItems: known, heldItems: [] }), []);

// The notice sits in the turn part, just before the closing reminder.
{
  const base = { hasSceneModel: true } as Parameters<typeof buildGmFormatReminder>[0];
  const notices = ["Nobody in the party carries: Torch."];
  const turn = buildGmFormatReminder({ ...base, part: "turn", turnNotices: notices });
  assert.match(turn, /\n\nNobody in the party carries: Torch\.\n\nREMINDER: write by the <output_format> rules/);
  assert.equal(
    buildGmFormatReminder({ ...base, part: "turn", turnNotices: [] }),
    buildGmFormatReminder({ ...base, part: "turn" }),
  );
  assert.doesNotMatch(
    buildGmFormatReminder({ ...base, part: "stable", turnNotices: notices }),
    /Nobody in the party carries/,
  );
  assert.doesNotMatch(buildGmFormatReminder({ ...base, turnNotices: notices }), /Nobody in the party carries/);
}

// An add the same reply gives away has no source.
{
  const party = { player: "Ada", members: ["Bram", "Cass"] };
  const reply = [
    `[inventory: action="add" item="Torch" who="Bram"]`,
    `[inventory: action="give" item="Torch" who="Bram" to="Cass"]`,
    `[inventory: action="add" item="Rope" who="Bram"]`,
    `[inventory: action="add" item="Lantern" who="Cass" to="Bram"]`,
    `[inventory: action="add" item="Gem" who="Bram" source="loot"]`,
    `[inventory: action="give" item="Gem" who="Bram" to="Cass"]`,
    `[inventory: action="add" item="Candles" who="Cass"]`,
    `[inventory: action="remove" item="Candle" who="Cass"]`,
    `[inventory: action="add" item="Bread"]`,
    `[inventory: action="give" item="Bread" who="Bram" to="Cass"]`,
  ].join(" ");
  let n = 0;
  const id = () => `s${++n}`;
  const checked = readResolvedInventoryTags(applyGameInventoryTags(reply, [], party, id).content).map(
    (tag) => `${tag.action} ${tag.item} ${tag.ok ? "ok" : tag.reason}`,
  );
  assert.deepEqual(checked, [
    "add Torch no-source",
    "give Torch none-held",
    "add Rope ok",
    "give Lantern none-held",
    "add Gem ok",
    "give Gem ok",
    "add Candles no-source",
    "remove Candle none-held",
    // Another bag gives it on: what the player found stands.
    "add Bread ok",
    "give Bread none-held",
  ]);
}

console.log("An item nobody carries is said as this turn's fact, and an add made only to hand on is refused.");
