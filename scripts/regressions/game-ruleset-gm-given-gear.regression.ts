/**
 * Gear the Game Master hands out by its own words, and starting gear taken after it (laptop
 * 2026-10-26: a "Wooden Shield" given and then put on was refused as not wearable, being no item of
 * 5e's, whose shield is "Shield"; and heroes given a shield, a quarterstaff and a shortbow before
 * taking their kits carried two of each after).
 *
 *   - A name that is no item, but whose last words are exactly one item's own or other name, is that
 *     item: never a name two items have, one with a comma, a bracket or a "+1", or a count in front.
 *   - Added by such a name, the item is the ruleset's, and putting it on by the same name finds it.
 *   - Starting gear takes a worn item only as far as the bag does not hold it yet; everything else,
 *     and gear taken again on purpose, as it is.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  applyGameInventoryTags,
  parseRulesetDefinition,
  rulesetItemBook,
  rulesetStartingGearUnheld,
  type GameInventoryStack,
  type RulesetCatalogEntry,
  type RulesetDefinition,
} from "../../packages/shared/src/index.js";

const emberText = readFileSync(
  fileURLToPath(new URL("../../docs/examples/rulesets/ember-roads.json", import.meta.url)),
  "utf8",
);
const definitionOf = (edit: (doc: Record<string, any>) => void = () => {}): RulesetDefinition => {
  const doc = JSON.parse(emberText) as Record<string, any>;
  edit(doc);
  const parsed = parseRulesetDefinition(doc);
  assert.ok(parsed.ok, parsed.ok ? "" : parsed.issues.join("; "));
  return parsed.definition;
};
const entriesOf = (definition: RulesetDefinition): Record<string, RulesetCatalogEntry[]> =>
  Object.fromEntries(
    (definition.catalogs ?? []).flatMap((catalog) =>
      catalog.holds === "items" && catalog.entries ? [[catalog.id, catalog.entries]] : [],
    ),
  );

const ember = definitionOf();
const book = rulesetItemBook(ember, entriesOf(ember), { actor: "game-master" });

// ── A name's last words ──
{
  assert.equal(book.itemNamed("Oiled Leather coat")?.item, "outfitter/leather-coat", "words in front of a name");
  assert.equal(book.itemNamed("Old oiled leather coat")?.item, "outfitter/leather-coat", "several words in front");
  assert.equal(book.itemNamed("Rusty Hand axe")?.item, "outfitter/hand-axe");
  assert.equal(book.itemNamed("Grandmother's Hand axe")?.item, "outfitter/hand-axe", "an apostrophe is a word's");
  // The item's own name still wins, as before.
  assert.equal(book.itemNamed("Leather coat")?.item, "outfitter/leather-coat");
  // Never a name that only starts like one, nor one with more after it.
  assert.equal(book.itemNamed("Leather coat of the north"), undefined, "the name must end the words");
  assert.equal(book.itemNamed("Leather"), undefined);
  // Nothing past plain words: a list, a bracket, a "+1", or a count in front.
  assert.equal(book.itemNamed("Rope, Leather coat"), undefined, "a comma makes a list");
  assert.equal(book.itemNamed("Leather coat (torn)")?.item, "outfitter/leather-coat", "a bracket is still bare");
  assert.equal(book.itemNamed("Oiled Leather coat (torn)"), undefined, "a bracket says more than a word");
  assert.equal(book.itemNamed("+1 Leather coat"), undefined, "a +1 is no word in front");
  assert.equal(book.itemNamed("2 Leather coat"), undefined, "a count is no word in front");
  // A name two items have finds neither.
  const shared = definitionOf((doc) => {
    const catalog = doc.catalogs.find((each: Record<string, any>) => each.holds === "items");
    const coat = catalog.entries.find((each: Record<string, any>) => each.id === "leather-coat");
    catalog.entries.push({ ...structuredClone(coat), id: "wool-coat", label: "Wool coat", aliases: ["Coat"] });
    coat.aliases = ["Coat"];
  });
  const sharedBook = rulesetItemBook(shared, entriesOf(shared), { actor: "game-master" });
  assert.equal(sharedBook.itemNamed("Oiled Leather coat")?.item, "outfitter/leather-coat");
  assert.equal(sharedBook.itemNamed("Patched Coat"), undefined, "a name two items have finds neither");
}

// ── Past one word in front, only an item's own name (laptop room playtest 2026-10-30: "Raw deer hide"
// became Hide Armor by its other name "Hide") ──
{
  const aliased = definitionOf((doc) => {
    const catalog = doc.catalogs.find((each: Record<string, any>) => each.holds === "items");
    catalog.entries.find((each: Record<string, any>) => each.id === "leather-coat").aliases = ["Hide"];
  });
  const aliasBook = rulesetItemBook(aliased, entriesOf(aliased), { actor: "game-master" });
  assert.equal(aliasBook.itemNamed("Tanned Hide")?.item, "outfitter/leather-coat", "one word in front of another name");
  assert.equal(aliasBook.itemNamed("Raw deer hide"), undefined, "two words in front of another name find nothing");
  assert.equal(aliasBook.itemNamed("Old oiled leather coat")?.item, "outfitter/leather-coat", "but of its own name");
}

// ── A name the ruleset has, written another way, is that item, not a new one (laptop playtest
// 2026-10-30: an invented "Arrow +1" carried +1 on every attack) ──
{
  const made = book.invent!({ name: "coat, leather", carried: "+1 attacks" } as never, []);
  assert.ok("item" in made && made.item === "outfitter/leather-coat", JSON.stringify(made));
}

// ── Given by such a name, then put on by it ──
{
  const party = { player: "Ada", members: ["Bram"] };
  const told = applyGameInventoryTags(
    `[inventory: action="add" item="Oiled Leather coat" who="Bram"] [inventory: action="equip" item="Oiled Leather coat" who="Bram"]`,
    [],
    party,
    undefined,
    book,
  );
  assert.deepEqual(
    told.stacks.map((stack) => [stack.name, stack.item, stack.holder, !!stack.equipped]),
    [["Leather coat", "outfitter/leather-coat", "Bram", true]],
    "the ruleset's coat, worn",
  );
  assert.match(told.content, /action="equip" item="Oiled Leather coat"[^\]]*result="ok"/);
  // A plain item nobody's name finds is still refused as before.
  const plain = applyGameInventoryTags(
    `[inventory: action="add" item="Lucky Pebble"] [inventory: action="equip" item="Lucky Pebble"]`,
    [],
    party,
    undefined,
    book,
  );
  assert.match(plain.content, /action="equip" item="Lucky Pebble"[^\]]*reason="not-wearable"/);
}

// ── Starting gear after what the Game Master gave ──
{
  const stack = (item: string, name: string, quantity: number, holder?: string): GameInventoryStack => ({
    id: `${item}-${holder ?? ""}`,
    name,
    item,
    quantity,
    ...(holder ? { holder } : {}),
  });
  const adds = [
    { item: "outfitter/leather-coat", name: "Leather coat", count: 1, equip: true as const },
    { item: "outfitter/hand-axe", name: "Hand axe", count: 2 },
    { item: "outfitter/road-rations", name: "Road rations", count: 3 },
    { name: "Lucky Pebble", count: 1 },
  ];
  const held = [
    stack("outfitter/leather-coat", "Leather coat", 1, "Bram"),
    stack("outfitter/hand-axe", "Hand axe", 1, "Bram"),
    stack("outfitter/road-rations", "Road rations", 2, "Bram"),
    // Another bag's do not count.
    stack("outfitter/hand-axe", "Hand axe", 5),
  ];
  const left = rulesetStartingGearUnheld(adds, held, "Bram", book);
  assert.deepEqual(
    left.adds.map((add) => [add.name, add.count]),
    [
      ["Hand axe", 1],
      ["Road rations", 3],
      ["Lucky Pebble", 1],
    ],
    "the coat already held is left out, the axes topped up, the rations and the plain item taken whole",
  );
  assert.deepEqual(left.held, ["Leather coat", "Hand axe"]);
  // The player's own bag, holding none of it, takes all of it.
  const mine = rulesetStartingGearUnheld(adds, held.slice(0, 3), undefined, book);
  assert.deepEqual(mine.adds, adds);
  assert.deepEqual(mine.held, []);
}

console.log("game-ruleset-gm-given-gear regression passed");
