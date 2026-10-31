/**
 * An item whose use harms its own user (2026-10-23 playtest): a fake Potion of Healing that is really
 * Poison. Drunk outside a fight, its save is rolled against its difficulty, a failed one costs its
 * damage and applies what it applies, and a made one costs nothing (or half, where it says so).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  defaultRulesetSheetBuild,
  parseRulesetDefinition,
  readRulesetLive,
  rulesetItemBook,
  rulesetItemUseLine,
  useRulesetItemOutsideFight,
  type GameInventoryStack,
} from "../../packages/shared/src/index.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const doc = JSON.parse(readFileSync(join(root, "docs/development/ruleset-5e-2014.example.json"), "utf8")) as Record<
  string,
  any
>;
const poison = (onSuccess: "none" | "half" | "negates") => ({
  kind: "attack",
  budget: "action",
  range: 0,
  targets: "self",
  amount: { dice: "3d6" },
  damageType: "poison",
  save: { save: "con_save", onSuccess },
  saveDifficulty: 13,
  applies: [{ condition: "poisoned", duration: "until-dispelled" }],
  consumes: true,
});
doc.items = { categories: [{ id: "potion", label: "Potion" }] };
doc.catalogs.push({
  id: "gear",
  label: "Gear",
  holds: "items",
  entries: [
    { id: "bad", label: "Potion of Poison", item: { category: "potion", use: poison("none") } },
    { id: "worse", label: "Potion of Worse Poison", item: { category: "potion", use: poison("half") } },
    { id: "mild", label: "Potion of Mild Poison", item: { category: "potion", use: poison("negates") } },
    {
      id: "heal",
      label: "Potion of Healing",
      item: {
        category: "potion",
        use: { kind: "heal", budget: "action", range: 0, targets: "ally", amount: { dice: "2d4+2" }, consumes: true },
      },
    },
  ],
});
const result = parseRulesetDefinition(doc);
assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
const definition = result.definition;
const book = rulesetItemBook(
  definition,
  Object.fromEntries((definition.catalogs ?? []).map((catalog) => [catalog.id, catalog.entries ?? []])),
);
const build = defaultRulesetSheetBuild(definition);
build.fields = { ...build.fields, hp_max: 30 };
const drink = (item: string, face: number, save = face) => {
  const stacks: GameInventoryStack[] = [{ id: "st", name: "Bottle", item: `gear/${item}`, quantity: 2 }];
  const used = useRulesetItemOutsideFight({
    definition,
    itemOf: book.itemOf,
    stacks,
    stackId: "st",
    user: { name: "Ada", build, live: {} },
    roll: (sides: number) => (sides === 20 ? save : face),
  });
  assert.ok(used.ok, JSON.stringify(used));
  return used;
};
const hp = (live: unknown) => readRulesetLive(definition, build, live).pools.find((one) => one.key === "hp")!.value;
const poisoned = (live: unknown) =>
  readRulesetLive(definition, build, live).conditions.some((one) => one.id === "poisoned" && one.active);

// Failed (every die a 1): harmed and rattled, and said so, never "aimed at somebody else".
{
  const failed = drink("bad", 1);
  const line = rulesetItemUseLine(failed.said);
  assert.doesNotMatch(line, /aimed at somebody else/u);
  assert.match(line, /save \d+ against 13, failed/u);
  assert.ok(poisoned(failed.live), line);
  assert.equal(hp(failed.live), 27, "three 1s of poison");
  assert.match(line, /Constitution save 1 against 13, failed, takes 3 poison \(Hit points 27\/30\)/u);
  assert.match(line, /1 left\.$/u);
  assert.equal(failed.stacks[0]?.quantity, 1);
}
// Made (every die a 6, the save a 20): "none" still takes it all and only keeps off what it applies
// (the SRD's Potion of Poison), "half" half, "negates" nothing.
{
  const made = drink("bad", 6, 20);
  const line = rulesetItemUseLine(made.said);
  assert.match(line, /made, takes 18 poison/u);
  assert.ok(!poisoned(made.live));
  assert.equal(hp(made.live), 12);
  const half = drink("worse", 6, 20);
  assert.equal(hp(half.live), 21, "half of 18");
  assert.ok(!poisoned(half.live));
  const mild = drink("mild", 6, 20);
  assert.match(rulesetItemUseLine(mild.said), /made, takes nothing/u);
  assert.equal(hp(mild.live), 30);
}
// A drinker with no live state yet who makes the save: still a state, never undefined (2026-10-23 retest:
// the server read its keys and threw).
{
  const stacks: GameInventoryStack[] = [{ id: "st", name: "Bottle", item: "gear/mild", quantity: 2 }];
  const used = useRulesetItemOutsideFight({
    definition,
    itemOf: book.itemOf,
    stacks,
    stackId: "st",
    user: { name: "Ada", build, live: undefined },
    roll: (sides: number) => (sides === 20 ? 20 : 6),
  });
  assert.ok(used.ok, JSON.stringify(used));
  assert.deepEqual(used.live, {});
}

// The dead drink nothing back to life (laptop pass 6 2026-10-26: a Potion of Healing healed a hero with
// every death save failed); the living still drink it.
{
  const stacks: GameInventoryStack[] = [{ id: "st", name: "Bottle", item: "gear/heal", quantity: 1 }];
  const use = (live: unknown) =>
    useRulesetItemOutsideFight({
      definition,
      itemOf: book.itemOf,
      stacks,
      stackId: "st",
      user: { name: "Ada", build, live },
      roll: () => 3,
    });
  const dead = use({ pools: { hp: { value: 0 } }, tracks: { death_save_failures: 3 } });
  assert.equal(dead.ok ? "" : dead.reason, "dead");
  assert.ok(use({ pools: { hp: { value: 0 } }, tracks: { death_save_failures: 2 } }).ok, "one still dying drinks it");
}

console.log(
  "A fake potion drunk: its save, its harm and what it applies, on whoever drank it; the dead drink nothing.",
);
