/**
 * A layer's items (Capability API 1.813): where things are sold and what drops, changed for one game.
 *
 *   - `layers[].items.market.removeSellers` takes sellers out; `unsold` takes wares off every seller,
 *     appended to the market's own new `unsold`; `lootTables` replaces tables by id, the last active
 *     layer that replaces one winning.
 *   - Nothing is added and nothing is hidden: an unsold item is still an item the game knows and
 *     offers (the Game Master can hand one out, a carried one keeps working), and a seller's stock
 *     table may still roll it, so a rare odd lot is the only way to buy one.
 *   - A layer leaves the market at least one seller, also when two layers together would not.
 *   - Checked at import, gated at 1.813.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  applyGameInventoryTags,
  parseRulesetDefinition,
  resolveRulesetLayers,
  rollRulesetLootTable,
  rulesetItemBook,
  rulesetItemSoldRank,
  rulesetItemUnsold,
  rulesetMarketPlace,
  rulesetMarketPromptText,
  rulesetMarketQuoter,
  rulesetMarketShelf,
  type GameInventoryStack,
  type RulesetCatalogEntry,
  type RulesetDefinition,
  type RulesetMarketDay,
} from "../../packages/shared/src/index.js";

const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
const gravewatchText = read("../../docs/examples/rulesets/gravewatch.json");
const variant = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
  const doc = JSON.parse(gravewatchText) as Record<string, any>;
  edit(doc);
  return doc;
};
const parsedOrThrow = (document: unknown, what: string): RulesetDefinition => {
  const parsed = parseRulesetDefinition(document);
  assert.ok(parsed.ok, `${what} must import cleanly: ${parsed.ok ? "" : parsed.issues.join("; ")}`);
  return parsed.definition;
};
const refused = (edit: (doc: Record<string, any>) => void, pattern: RegExp, what: string) => {
  const parsed = parseRulesetDefinition(variant(edit));
  assert.equal(parsed.ok, false, `${what}: the file should be refused`);
  if (parsed.ok) return;
  assert.ok(
    parsed.issues.some((issue) => pattern.test(issue)),
    `${what}: expected ${pattern}, got ${parsed.issues.join("; ")}`,
  );
};
const entriesOf = (definition: RulesetDefinition): Record<string, RulesetCatalogEntry[]> =>
  Object.fromEntries(
    (definition.catalogs ?? []).flatMap((catalog) =>
      catalog.entries && catalog.holds !== "rows" ? [[catalog.id, catalog.entries]] : [],
    ),
  );
const coins = (entries: Array<[name: string, unit: string, quantity: number]>): GameInventoryStack[] =>
  entries.map(([name, unit, quantity], index) => ({ id: `c${index}`, name, item: `coin:${unit}`, quantity }));
/** A die that answers from a list, then keeps giving its last answer. */
const dice = (...faces: number[]) => {
  let at = 0;
  return (sides: number) => Math.min(sides, faces[Math.min(at++, faces.length - 1)]!);
};

/** Gravewatch's "quiet roads": no chapel, nothing rare among anybody's wares, the smith's odd lot only
 *  ever the pistol, and the dead carry no arms. A second layer takes the chandler and the smith out. */
const quietRoads = {
  id: "quiet_roads",
  label: "Quiet roads",
  summary: "Rare things are not sold over a counter.",
  items: {
    market: { removeSellers: ["chapel"], unsold: [{ rarity: "rare" }] },
    lootTables: [
      {
        id: "smiths_odd_lot",
        label: "A smith's odd lot",
        rolls: 1,
        entries: [{ item: "kit/watch-pistol", weight: 1, count: 1 }],
      },
      {
        id: "grave_goods",
        label: "Grave goods",
        rolls: 1,
        entries: [{ item: "kit/shot-and-powder", weight: 1, count: "1d4" }],
      },
    ],
  },
};
const emptyStreets = {
  id: "empty_streets",
  label: "Empty streets",
  items: { market: { removeSellers: ["chandler", "smith"] } },
};
const withLayers = (doc: Record<string, any>) => {
  doc.layers.push(structuredClone(quietRoads), structuredClone(emptyStreets));
};
const gravewatch = parsedOrThrow(variant(withLayers), "Gravewatch with item layers");
const quiet = { "layer.quiet_roads": true };

// ── Applied: the market and the tables the game plays by ──
{
  const off = resolveRulesetLayers(gravewatch, {});
  assert.equal(off.definition, gravewatch, "no layer, the same definition");
  const layered = resolveRulesetLayers(gravewatch, quiet);
  assert.deepEqual(
    layered.applied.map((layer) => layer.id),
    ["quiet_roads"],
  );
  const market = layered.definition.items!.market!;
  assert.deepEqual(
    market.sellers!.map((seller) => seller.id),
    ["chandler", "smith"],
    "the chapel is gone",
  );
  assert.deepEqual(market.unsold, [{ rarity: "rare" }]);
  assert.deepEqual(
    layered.definition.items!.lootTables!.map((table) => [table.id, table.entries.length]),
    [
      ["grave_goods", 1],
      ["smiths_odd_lot", 1],
    ],
    "replaced in place, the ruleset's order kept",
  );
  // The ruleset itself is never rewritten.
  assert.equal(gravewatch.items!.market!.sellers!.length, 3);
  assert.equal(gravewatch.items!.market!.unsold, undefined);
  assert.equal(gravewatch.items!.lootTables![0]!.entries.length, 5);

  // Two layers that together would take every seller out: the removal that empties it is not made.
  const both = resolveRulesetLayers(gravewatch, { ...quiet, "layer.empty_streets": true });
  assert.deepEqual(
    both.applied.map((layer) => layer.id),
    ["quiet_roads", "empty_streets"],
  );
  assert.deepEqual(
    both.definition.items!.market!.sellers!.map((seller) => seller.id),
    ["chandler", "smith", "chapel"],
    "a market without sellers would let anybody sell everything",
  );
  assert.deepEqual(both.definition.items!.market!.unsold, [{ rarity: "rare" }], "the rest of it still applies");

  // The last active layer that replaces a table wins.
  const twice = parsedOrThrow(
    variant((doc) => {
      withLayers(doc);
      doc.layers[2].items.lootTables = [
        { id: "smiths_odd_lot", label: "Nothing", rolls: 1, entries: [{ item: "kit/grave-spade", weight: 1 }] },
      ];
    }),
    "two layers replacing one table",
  );
  const last = resolveRulesetLayers(twice, { ...quiet, "layer.empty_streets": true }).definition;
  assert.deepEqual(last.items!.lootTables!.find((table) => table.id === "smiths_odd_lot")!.entries, [
    { item: "kit/grave-spade", weight: 1, count: 1 },
  ]);
}

// ── Buying: unsold wares are no seller's, a stock table may still roll one ──
{
  const layered = resolveRulesetLayers(gravewatch, quiet).definition;
  const book = rulesetItemBook(layered, entriesOf(layered), { layerOptions: quiet });
  const market = layered.items!.market!;
  const nail = book.itemOf("kit/silver-nail")!.entry.item!;
  const spade = book.itemOf("kit/grave-spade")!.entry.item!;
  assert.equal(rulesetItemUnsold(market, nail), true);
  assert.equal(rulesetItemSoldRank(market, nail), Number.POSITIVE_INFINITY, "sold at no place");
  assert.equal(rulesetItemUnsold(market, spade), false);
  assert.equal(rulesetItemSoldRank(market, spade), 1, "a village");
  assert.ok(book.offers("kit/silver-nail"), "an unsold item is still one the game offers");

  const town = rulesetMarketPlace(market, "town")!;
  const day: RulesetMarketDay = { key: "d1", bought: new Map(), stockBought: new Map(), paidOut: new Map() };
  const quoter = rulesetMarketQuoter(layered, book, town, () => true, quiet, day);
  const buy = (tag: string) =>
    applyGameInventoryTags(
      tag,
      coins([["crowns", "crown", 9]]),
      { members: [] },
      undefined,
      book,
      undefined,
      undefined,
      quoter,
    ).content;
  assert.match(buy('[inventory: action="buy" item="Silver coffin nail"]'), /result="refused" reason="not-here"/);
  assert.match(buy('[inventory: action="buy" item="Grave spade"]'), /seller="smith" result="ok"/);
  // The smith's odd lot is the layer's table, and the pistol in it can be bought from the smith.
  assert.deepEqual(rulesetMarketShelf(layered, book, town, "d1").stock.get("smith"), [
    { item: "kit/watch-pistol", name: "Watch pistol", count: 1 },
  ]);
  assert.match(buy('[inventory: action="buy" item="Watch pistol"]'), /seller="smith" result="ok"[^\]]*stock="true"/);

  // The Game Master's market block lists no rare ware and no chapel, and still the smith's stock.
  const text = rulesetMarketPromptText(layered, book, { name: "Ashford", size: "town" }, quiet, day)!;
  assert.doesNotMatch(text, /Silver coffin nail/);
  assert.doesNotMatch(text, /chapel/);
  assert.match(text, /in stock today: Watch pistol ×1/);

  // The dead carry what the layer's table says.
  assert.deepEqual(rollRulesetLootTable(layered, book, "grave_goods", dice(1, 3)), [
    { item: "kit/shot-and-powder", name: "Shot and powder", count: 3 },
  ]);
}

// ── A market's own unsold, without a layer ──
{
  const own = parsedOrThrow(
    variant((doc) => (doc.items.market.unsold = [{ category: "page" }])),
    "a market with unsold wares",
  );
  const market = own.items!.market!;
  const book = rulesetItemBook(own, entriesOf(own));
  assert.equal(rulesetItemSoldRank(market, book.itemOf("kit/litany-page")!.entry.item!), Number.POSITIVE_INFINITY);
  refused((doc) => (doc.items.market.unsold = [{ category: "scroll" }]), /Unknown item category "scroll"/, "a word");
  refused((doc) => (doc.items.market.unsold = [{}]), /A filter names a rarity, a category or a tag/, "an empty filter");
}

// ── Import ──
{
  const layer = (items: unknown) => (doc: Record<string, any>) => doc.layers.push({ id: "x", label: "X", items });
  refused(layer({}), /A layer's items change the market, the loot tables or both/, "nothing at all");
  refused(layer({ market: {} }), /takes out sellers \(removeSellers\) or wares \(unsold\)/, "an empty market");
  refused(layer({ market: { removeSellers: ["baker"] } }), /Unknown seller "baker"/, "an unknown seller");
  refused(
    layer({ market: { removeSellers: ["chandler", "smith", "chapel"] } }),
    /A layer leaves the market at least one seller/,
    "every seller",
  );
  refused(layer({ market: { unsold: [{ rarity: "mythic" }] } }), /Unknown item rarity "mythic"/, "a rarity");
  // The market's own unsold and every layer's are held to one market's 24 together, at import, so no
  // layer is skipped in play for pushing the merged list over.
  const filters = (count: number) => Array.from({ length: count }, () => ({ rarity: "rare" }));
  refused(
    (doc) => {
      doc.items.market.unsold = filters(13);
      layer({ market: { unsold: filters(12) } })(doc);
    },
    /The market's unsold wares and every layer's come to 25, over the 24 a market holds/,
    "the base and a layer together",
  );
  refused(
    (doc) => {
      for (const id of ["a", "b", "c"]) doc.layers.push({ id, label: id, items: { market: { unsold: filters(10) } } });
    },
    /come to 30, over the 24/,
    "three layers together",
  );
  parsedOrThrow(
    variant((doc) => {
      doc.items.market.unsold = filters(12);
      layer({ market: { unsold: filters(12) } })(doc);
    }),
    "exactly 24",
  );
  refused(
    layer({ lootTables: [{ id: "hoard", label: "Hoard", entries: [{ coins: "shilling", weight: 1 }] }] }),
    /A layer replaces loot tables the ruleset has: no "hoard"/,
    "a new table",
  );
  refused(
    layer({ lootTables: [{ id: "grave_goods", label: "Grave goods", entries: [{ item: "kit/lute", weight: 1 }] }] }),
    /No item "lute" in catalog "kit"/,
    "a replacement held to a table's rules",
  );
  refused(
    layer({ lootTables: [{ id: "grave_goods", label: "G", entries: [{ coins: "guinea", weight: 1 }] }] }),
    /Unknown currency unit "guinea"/,
    "a coin",
  );
  refused(
    (doc) => {
      delete doc.items.market;
      for (const catalog of doc.catalogs ?? [])
        for (const entry of catalog.entries ?? []) {
          delete entry.item?.sold;
          delete entry.item?.service;
        }
      layer({ market: { unsold: [{ rarity: "rare" }] } })(doc);
    },
    /This ruleset has no market for a layer to change/,
    "no market",
  );
}

// ── Gated at 1.813 ──
{
  const manifest = (minor: number) => ({
    schemaVersion: 2,
    capabilityApi: { major: 1, minor },
    builtAgainst: { engineVersion: "2.5.1", engineCommit: "0".repeat(40) },
    id: "ruleset-layer-items",
    name: "Layer items",
    version: "0.1.0",
    description: "A packaged ruleset whose layer changes its market.",
    engine: { min: "2.5.1", maxExclusive: "4.0.0" },
    kind: ["ruleset"],
    entrypoints: {},
    contributions: { assets: { paths: ["ruleset.json"] } },
    files: [{ path: "ruleset.json", sha256: "0".repeat(64), bytes: 10 }],
    permissions: [],
    restartRequired: false,
  });
  const gate = /layers change its market or loot tables.*capabilityApi 1\.813/;
  const issue = (minor: number, doc: Record<string, any>) =>
    getCapabilityPackageInstallIssue(manifest(minor) as any, doc);
  assert.match(issue(812, variant(withLayers)) ?? "", gate);
  assert.equal(issue(813, variant(withLayers)), null);
  assert.match(
    issue(
      812,
      variant((doc) => (doc.items.market.unsold = [{ rarity: "rare" }])),
    ) ?? "",
    gate,
  );
  assert.doesNotMatch(issue(812, variant()) ?? "", gate, "the example as it is needs nothing new");
}

console.log("game-ruleset-layer-items regression passed");
