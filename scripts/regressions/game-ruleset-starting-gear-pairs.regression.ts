/**
 * Starting gear that puts on several of one item (laptop 2026-10-26: a ranger's "Two shortswords",
 * `count: 2, equip: true`, became one stack of two with only one held, so the dual-wielder began with a
 * hand empty).
 *
 *   - Each of the line's items is put on in turn, into slots still free, and what finds none is carried.
 *   - Armor taken in the same kit goes on beside them; a hand already full leaves one carried.
 *   - With MARINARA_SRD_DIR naming the 5e SRD package, its ranger kit holds both shortswords.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  applyGameInventoryOps,
  parseRulesetCatalogFile,
  parseRulesetDefinition,
  resolveRulesetStartingGear,
  rulesetItemBook,
  rulesetStartingGearEquips,
  type GameInventoryEngineOp,
  type GameInventoryStack,
  type RulesetCatalogEntry,
  type RulesetDefinition,
  type RulesetItemBook,
  type RulesetStartingGearSelection,
} from "../../packages/shared/src/index.js";

/** The gear taken into a bag as the starting-gear route takes it: added, then put on. */
function take(
  definition: RulesetDefinition,
  book: RulesetItemBook,
  selection: RulesetStartingGearSelection,
  stacks: GameInventoryStack[] = [],
): GameInventoryStack[] {
  const resolved = resolveRulesetStartingGear(definition, book, selection);
  assert.ok(resolved.ok, resolved.ok ? "" : resolved.detail);
  const ops: GameInventoryEngineOp[] = resolved.adds.map((add) => ({
    op: "add",
    name: add.name,
    ...(add.item ? { item: add.item } : {}),
    count: add.count,
  }));
  const added = applyGameInventoryOps(stacks, ops, undefined, book);
  const equips = rulesetStartingGearEquips(
    resolved.adds,
    added.results.map((result) => (result.ok ? result.id : undefined)),
  );
  return applyGameInventoryOps(added.stacks, equips, undefined, book).stacks;
}

const held = (stacks: GameInventoryStack[], item: string) =>
  stacks
    .filter((stack) => stack.item === item)
    .map((stack) => [stack.quantity, !!stack.equipped])
    .sort();

// ── A ruleset of two hands ──
{
  const doc = JSON.parse(
    readFileSync(fileURLToPath(new URL("../../docs/examples/rulesets/ember-roads.json", import.meta.url)), "utf8"),
  ) as Record<string, any>;
  doc.items.startingGear = [
    {
      id: "skirmisher",
      label: "Skirmisher",
      lines: [{ item: "outfitter/leather-coat", equip: true }],
      choices: [
        {
          label: "Weapons",
          options: [
            { label: "Two hand axes", lines: [{ item: "outfitter/hand-axe", count: 2, equip: true }] },
            { label: "Three hand axes", lines: [{ item: "outfitter/hand-axe", count: 3, equip: true }] },
          ],
        },
      ],
    },
  ];
  const parsed = parseRulesetDefinition(doc);
  assert.ok(parsed.ok, parsed.ok ? "" : parsed.issues.join("; "));
  const definition = parsed.definition;
  const entries = Object.fromEntries(
    (definition.catalogs ?? []).flatMap((catalog) =>
      catalog.holds === "items" && catalog.entries ? [[catalog.id, catalog.entries]] : [],
    ),
  );
  const book = rulesetItemBook(definition, entries, { actor: "player" });

  const two = take(definition, book, { gear: "skirmisher", choices: [0], picks: {} });
  assert.deepEqual(
    held(two, "outfitter/hand-axe"),
    [
      [1, true],
      [1, true],
    ],
    "both axes held, one in each hand",
  );
  assert.deepEqual(held(two, "outfitter/leather-coat"), [[1, true]], "the coat worn beside them");

  const three = take(definition, book, { gear: "skirmisher", choices: [1], picks: {} });
  assert.deepEqual(
    held(three, "outfitter/hand-axe"),
    [
      [1, false],
      [1, true],
      [1, true],
    ],
    "two held, the third carried: there are two hands",
  );

  // A hand already full: one more axe held, the other carried.
  const spear: GameInventoryStack = {
    id: "spear",
    name: "Boar spear",
    item: "outfitter/boar-spear",
    quantity: 1,
    equipped: true,
  };
  const busy = take(definition, book, { gear: "skirmisher", choices: [0], picks: {} }, [spear]);
  assert.deepEqual(held(busy, "outfitter/hand-axe"), [
    [1, false],
    [1, true],
  ]);
  assert.deepEqual(held(busy, "outfitter/boar-spear"), [[1, true]], "the spear stays in hand");

  // Nothing put on where a line asks none of it.
  assert.deepEqual(rulesetStartingGearEquips([{ item: "outfitter/hand-axe", name: "Hand axe", count: 2 }], ["s1"]), []);
}

// ── The SRD ranger's kit, where the package is at hand ──
{
  const dir = process.env.MARINARA_SRD_DIR;
  if (dir && existsSync(join(dir, "ruleset.json"))) {
    const parsed = parseRulesetDefinition(JSON.parse(readFileSync(join(dir, "ruleset.json"), "utf8")));
    assert.ok(parsed.ok, parsed.ok ? "" : parsed.issues.slice(0, 5).join("; "));
    const definition = parsed.definition;
    const entries: Record<string, RulesetCatalogEntry[]> = {};
    for (const catalog of definition.catalogs ?? []) {
      if (catalog.holds !== "items") continue;
      if (catalog.entries) entries[catalog.id] = catalog.entries;
      else {
        const read = parseRulesetCatalogFile(
          definition,
          catalog.id,
          JSON.parse(readFileSync(join(dir, "catalogs", `${catalog.id}.json`), "utf8")),
        );
        assert.ok(read.ok, `catalog ${catalog.id}`);
        entries[catalog.id] = (read as { entries: RulesetCatalogEntry[] }).entries;
      }
    }
    const book = rulesetItemBook(definition, entries, { actor: "player" });
    const bag = take(definition, book, { gear: "ranger", choices: [1, 0, 1], picks: {} });
    assert.deepEqual(
      held(bag, "equipment/shortsword"),
      [
        [1, true],
        [1, true],
      ],
      "the ranger holds both shortswords",
    );
    assert.deepEqual(held(bag, "equipment/leather-armor"), [[1, true]]);
    console.log("  (checked against the SRD package's ranger kit)");
  }
}

console.log("game-ruleset-starting-gear-pairs regression passed");
