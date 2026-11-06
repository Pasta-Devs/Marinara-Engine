/**
 * A ruleset game with no persona plays its first character card as the player (2026-10-23 playtest):
 *
 *   - What the Game Master put in that card's own name counts on its sheet: an Amulet of Health worn
 *     by a multiclass fighter who leads the party.
 *   - A Game Master's inventory tag naming it fills the player's bag, and the inventory window shows
 *     one bag for them.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyGameInventoryTags,
  gameInventoryBags,
  gameInventoryFoldStandIn,
  parseRulesetDefinition,
  rulesetCardItems,
  rulesetItemBook,
  type GameInventoryStack,
} from "../../packages/shared/src/index.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const readSource = (path: string) => readFileSync(join(root, path), "utf8");
const result = parseRulesetDefinition(JSON.parse(readSource("docs/examples/rulesets/gravewatch.json")));
assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
const definition = result.definition;
const book = rulesetItemBook(
  definition,
  Object.fromEntries((definition.catalogs ?? []).map((catalog) => [catalog.id, catalog.entries ?? []])),
);
const stacks: GameInventoryStack[] = [
  {
    id: "coat",
    name: "Lantern-keeper's coat",
    item: "kit/lantern-coat",
    quantity: 1,
    holder: "Brannoc",
    equipped: true,
  },
  { id: "spade", name: "Grave spade", item: "kit/grave-spade", quantity: 1 },
  { id: "pistol", name: "Watch pistol", item: "kit/watch-pistol", quantity: 1, holder: "Ada", equipped: true },
];
const names = (items: ReturnType<ReturnType<typeof rulesetCardItems>>) => items.map((held) => held.name).sort();

// No persona: Brannoc stands in for the player, and reads both bags.
{
  const itemsOf = rulesetCardItems(book, stacks, ["Brannoc", "Ada"], null);
  const brannoc = itemsOf("Brannoc");
  assert.deepEqual(names(brannoc), ["Grave spade", "Lantern-keeper's coat"]);
  const coat = brannoc.find((held) => held.name === "Lantern-keeper's coat")!;
  assert.equal(coat.worn, true, "worn as equipped");
  assert.equal(coat.stack?.holder, "Brannoc", "still says whose bag it is in");
  assert.deepEqual(names(itemsOf("Ada")), ["Watch pistol"]);
  // A persona named for nobody on the cards is no persona either.
  assert.deepEqual(names(rulesetCardItems(book, stacks, ["Brannoc", "Ada"], "User")("Brannoc")), [
    "Grave spade",
    "Lantern-keeper's coat",
  ]);
}

// One bag for the stand-in, folded wherever bags are listed.
{
  const bags = gameInventoryBags(gameInventoryFoldStandIn(stacks, "Brannoc"));
  assert.deepEqual(
    bags.map((bag) => bag.holder ?? ""),
    ["", "Ada"],
  );
  assert.equal(bags[0]!.items.length, 2);
  assert.deepEqual(gameInventoryFoldStandIn(stacks, undefined), stacks);
}

// The player has a card of their own: Brannoc is a companion with his own bag only.
{
  const itemsOf = rulesetCardItems(book, stacks, ["Ada", "Brannoc"], "Ada");
  assert.deepEqual(names(itemsOf("Brannoc")), ["Lantern-keeper's coat"]);
  assert.deepEqual(names(itemsOf("Ada")), ["Grave spade"], "the player's own bag, as before");
}

// A save from before: what was put in the stand-in's own name is still reached by the Game Master's
// tags, with or without who= (2026-10-23 retest).
{
  const party = { player: "Brannoc", members: ["Brannoc", "Ada"] };
  const named = applyGameInventoryTags(
    `[inventory: action="unequip" item="Lantern-keeper's coat" who="Brannoc"]`,
    stacks,
    party,
    undefined,
    book,
  );
  const coat = named.stacks.find((stack) => stack.name === "Lantern-keeper's coat");
  assert.ok(coat && !coat.equipped, JSON.stringify(named.stacks));
  assert.equal(coat.holder, undefined, "folded into the player's bag");
  const plain = applyGameInventoryTags(
    `[inventory: action="unequip" item="Lantern-keeper's coat"]`,
    stacks,
    party,
    undefined,
    book,
  );
  assert.ok(!plain.stacks.find((stack) => stack.name === "Lantern-keeper's coat")!.equipped);
  // Ada's own bag is hers.
  assert.equal(named.stacks.find((stack) => stack.name === "Watch pistol")!.holder, "Ada");
}

// The Game Master's tags and the window.
{
  const generate = readSource("packages/server/src/routes/generate.routes.ts");
  assert.match(generate, /const party = \{ player: gameStandIn \?\? \(personaName \|\| undefined\)/u);
  assert.match(generate, /gameInventoryFoldStandIn\(promptInventoryStacks, gameStandIn\)/u);
  const prompts = readSource("packages/server/src/services/game/gm-prompts.ts");
  assert.match(prompts, /ctx\.playerBagName \?\? ctx\.playerName/u);
  // Kits are taken one at a time, which the picker says.
  const messages = JSON.parse(readSource("packages/client/src/localization/locales/en.json")) as Record<string, string>;
  assert.match(messages["game.ruleset.startingGear.intro"]!, /one kit at a time/u);
  const surface = readSource("packages/client/src/components/game/GameSurface.tsx");
  assert.match(surface, /items=\{inventoryShown\}/u);
  assert.match(surface, /for \(const stack of inventoryShown\) if \(stack\.holder\) addBag/u);
}

console.log("Stand-in bag: a persona-less party's first card wears what is in its own name, and has one bag.");
