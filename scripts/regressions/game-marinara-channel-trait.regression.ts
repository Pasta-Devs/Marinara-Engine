/**
 * Channel Element is a Channeler tree trait (Alyssa 2026-11-02): every Channeler-tree class keeps it,
 * the Pure line (Astral Adept, Starweaver) has Greater Channel Element instead, and a character in
 * another tree can carry it in one of their four slots. It isn't offered beside Greater Channel.
 */
import assert from "node:assert/strict";
import {
  createMarinaraProgression,
  marinaraCarryRedundant,
  setMarinaraClass,
  marinaraClassTraits,
  marinaraUsableSkills,
  setMarinaraCarried,
  type MarinaraProgression,
} from "../../packages/shared/src/features/marinara-classes.js";
import {
  buildMarinaraPartyFighter,
  marinaraBasicAttack,
  marinaraCanChannel,
} from "../../packages/shared/src/features/marinara-combat.js";

const base = createMarinaraProgression({ seed: "ch", primary: "channeler", temperament: "methodical" });
const at = (activeClass: string, levels: Record<string, number>, carried: string[] = []): MarinaraProgression => ({
  ...base,
  level: 30,
  activeClass,
  classLevels: { ...levels },
  carried,
});
const usable = (p: MarinaraProgression) => marinaraUsableSkills(p).map((skill) => skill.id);

assert.ok(marinaraClassTraits("elementalist").includes("channel-element"));
assert.ok(!marinaraClassTraits("astral-adept").includes("channel-element"), "the Pure line has Greater Channel");

const elementalist = at("elementalist", { channeler: 10, elementalist: 12 });
assert.ok(usable(elementalist).includes("channel-element"), "an Elementalist keeps Channel Element");
assert.throws(() => setMarinaraCarried(elementalist, ["channel-element"]), /needs no carry slot/);

const runelord = at("runelord", { channeler: 10, "rune-scholar": 20, runelord: 20 });
assert.ok(usable(runelord).includes("channel-element"), "so does a Runelord");

const astral = at("astral-adept", { channeler: 10, "astral-adept": 10 });
assert.ok(!usable(astral).includes("channel-element"), "an Astral Adept doesn't keep it");
assert.ok(usable(astral).includes("greater-channel-element"));
assert.ok(marinaraCarryRedundant(astral, "channel-element"), "and isn't offered it beside Greater Channel");
assert.throws(() => setMarinaraCarried(astral, ["channel-element"]), /Greater Channel/);

// A Starweaver promoted from Astral Adept has its own Greater Channel: Astral Adept's isn't auto-carried
// (playtest 2026-11-02: two Greater Channel buttons and a lost slot), nor can it be carried.
const astral20 = at("astral-adept", { channeler: 10, "astral-adept": 20 });
const starweaver = setMarinaraClass(astral20, "starweaver");
assert.ok(!starweaver.carried.includes("greater-channel-element"), "not auto-carried on promotion");
assert.ok(marinaraCarryRedundant(starweaver, "greater-channel-element"));
assert.throws(() => setMarinaraCarried(starweaver, ["greater-channel-element"]));
assert.equal(usable(starweaver).filter((id) => id.startsWith("greater-channel-element")).length, 1);
// An old save that already carries it shows one Greater Channel, not two.
const staleCarry = { ...starweaver, carried: ["greater-channel-element"] };
assert.equal(usable(staleCarry).filter((id) => id.startsWith("greater-channel-element")).length, 1);

// Channel Element is learned at Channeler class level 5 (Alyssa 2026-11-04: a free one-level dip was
// too strong); before that a Blade can't carry it.
assert.throws(() => setMarinaraCarried(at("blade", { channeler: 4, blade: 5 }), ["channel-element"]));
// A Blade who trained Channeler to 5 carries it, and channels.
const blade = at("blade", { channeler: 5, blade: 5 });
const carrying = setMarinaraCarried(blade, ["channel-element"]);
assert.ok(usable(carrying).includes("channel-element"));
assert.ok(marinaraCanChannel(buildMarinaraPartyFighter({ id: "b", name: "b", progression: carrying })));
assert.ok(!marinaraCanChannel(buildMarinaraPartyFighter({ id: "b", name: "b", progression: blade })));

console.log("game-marinara-channel-trait: ok");

// The weapon in hand decides the basic attack's stat too (Alyssa 2026-11-02): a Blade with a focus casts,
// a Channeler with a sword swings, and armour alone leaves the class to decide.
{
  const bladeOnly = at("blade", { blade: 5 });
  const focus = { power: 0, spellPower: 6, weaponType: "blunt" as const };
  const sword = { power: 6, spellPower: 0, weaponType: "slash" as const };
  const swing = (p: MarinaraProgression, gear?: Parameters<typeof buildMarinaraPartyFighter>[0]["gear"]) =>
    marinaraBasicAttack(buildMarinaraPartyFighter({ id: "w", name: "w", progression: p, ...(gear ? { gear } : {}) }));
  assert.equal(swing(bladeOnly).scales, "strength", "an unarmed Blade swings on Strength");
  assert.equal(swing(bladeOnly, focus).scales, "magic", "a Blade with a focus casts on Magic");
  const mage = at("channeler", { channeler: 5 });
  assert.equal(swing(mage).scales, "magic", "an unarmed Channeler casts on Magic");
  assert.equal(swing(mage, sword).scales, "strength", "a Channeler with a sword swings on Strength");
  assert.equal(swing(mage, { power: 0, spellPower: 0 }).scales, "magic", "armour alone is no weapon");
}
