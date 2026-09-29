/**
 * Ruleset items, slice I1: the item format.
 *
 * What is pinned here:
 *   - The `items` block declares the words every item is written in (categories, rarities, tags,
 *     stats, slots, binding, carry, currencies, `native` and `freeform`), and every name it uses
 *     or reads is checked at import: duplicate ids, a stat's own shape, a carry stat that is a
 *     number that is never below 0, carry and binding values read off the sheet without the live
 *     state, and currency families whose smallest coin is worth 1.
 *   - A third catalog kind, `holds: "items"`, whose entries carry an `item` and nothing else. It
 *     feeds no list, needs the items block, and holds no rows or creatures; a catalog of rows or
 *     creatures holds no items.
 *   - Every name an item uses is one the items block declares, and every stat value is one its
 *     stat could hold, inline and in a catalog file alike.
 *   - The published JSON schema tells an editor the same three-way rule.
 *   - An item catalog never teaches the Game Master the sheet's `use` command, since it writes
 *     nothing onto a sheet.
 *   - Items are Capability API 1.49, the block and the catalog, inline and in a catalog file.
 *   - The FORMAT is not shaped around one game system: both examples carry items, one a pool
 *     system with one coin and binding, the other a summed system with carrying and two families.
 *
 * Slice I2b-2 (#6795), the items a game's inventory reads (`rulesetItemBook`):
 *   - A name is one of the ruleset's items by its label, in any case; an item's id is its catalog
 *     and entry; `stack` is how many one stack holds; `freeform: "refuse"` refuses plain items.
 *   - What an item is reads in the ruleset's own words: category, rarity and tag labels, its stats
 *     (an enum by its value label, a yes-or-no stat by its label alone, a no left out) and its price
 *     in the unit's label. The Game Master is shown only the stats the ruleset makes visible.
 *   - A layer that hides an entry takes it out of what a name finds and what the picker offers, and
 *     an item of it already held still reads as itself.
 *   - The Game Master's inventory shows each ruleset item's facts in brackets, and its command line
 *     says a name that is one of the ruleset's items becomes that item, only when the ruleset has an
 *     item catalog.
 *
 * Slice I2b-3 (#6801), wearing and carrying:
 *   - The book gives each item its weight (its value of the carry stat), its slots and whether it
 *     binds (and is cursed), and the ruleset's slots; each character's carrying and binding limits
 *     are read off their own sheet, a character without one reading a blank sheet.
 *   - The Game Master is shown what is worn and bound beside each item, each character's load, bound
 *     items and slots, the carrying rule only with `carry`, and the equip and bind command only with
 *     slots or binding.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  GAME_INVENTORY_MAX_QUANTITY,
  parseRulesetCatalogFile,
  parseRulesetDefinition,
  rulesetItemBearers,
  rulesetItemBook,
  rulesetItemCatalogIds,
  rulesetItemPromptFacts,
  type RulesetCatalogEntry,
  type RulesetDefinition,
} from "../../packages/shared/src/index.js";

// Server modules read DATA_DIR once at load, so they are imported only after it points at scratch.
const dataDir = mkdtempSync(join(tmpdir(), "marinara-ruleset-items-"));
const previousDataDir = process.env.DATA_DIR;
process.env.DATA_DIR = dataDir;

try {
  const [{ buildGmFormatReminder }, { renderGameRulesetSheetBlocks }, { getCapabilityPackageInstallIssue }] =
    await Promise.all([
      import("../../packages/server/src/services/game/gm-prompts.js"),
      import("../../packages/server/src/services/game/ruleset-sheet-turn.service.js"),
      import("../../packages/server/src/services/capability-packages/package-manager.service.js"),
    ]);

  const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
  const emberText = read("../../docs/examples/rulesets/ember-roads.json");
  const gravewatchText = read("../../docs/examples/rulesets/gravewatch.json");

  const parsedOrThrow = (document: unknown, what: string): RulesetDefinition => {
    const parsed = parseRulesetDefinition(document);
    assert.ok(parsed.ok, `${what} must import cleanly: ${parsed.ok ? "" : parsed.issues.join("; ")}`);
    return parsed.definition;
  };
  /** One of the shipped examples, optionally edited first. */
  const variant = (text: string, edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(text) as Record<string, any>;
    edit(doc);
    return doc;
  };
  const itemCatalog = (doc: Record<string, any>) =>
    doc.catalogs.find((catalog: { holds?: string }) => catalog.holds === "items");
  /** The example less its 1.52 item reads (on Guard, and the bulk carried), with the 1.54 level
   *  that reads the bulk. */
  const withoutItemReads = (doc: Record<string, any>) => {
    const guard = doc.sheet.derived.find((entry: { id: string }) => entry.id === "guard");
    guard.of = guard.of.filter((ref: { itemStat?: unknown }) => ref.itemStat === undefined);
    doc.sheet.derived = doc.sheet.derived.filter((entry: { id: string }) => entry.id !== "bulk_carried");
    if (doc.combat?.levels) {
      doc.combat.levels = doc.combat.levels.filter((level: { derived?: string }) => level.derived === undefined);
    }
  };
  /** And less what its items do to checks and its bonus caps, which are 1.53's. */
  const withoutCheckEffects = (doc: Record<string, any>) => {
    for (const cap of doc.items?.rarityCaps ?? []) delete cap.bonus;
    for (const catalog of doc.catalogs ?? []) {
      for (const entry of catalog.entries ?? []) {
        delete entry.item?.worn;
        delete entry.item?.carried;
      }
    }
  };
  /** Less the weapons and a resistance's exception, which are 1.55's and have a lane of their own. */
  const withoutWeapons = (doc: Record<string, any>) => {
    for (const catalog of doc.catalogs ?? []) {
      for (const entry of catalog.entries ?? []) {
        delete entry.item?.attack;
        for (const key of ["resist", "immune"]) {
          if (entry.creature?.[key]) {
            entry.creature[key] = entry.creature[key].filter((type: unknown) => typeof type === "string");
          }
        }
      }
    }
  };
  const itemEntry = (doc: Record<string, any>, id: string) =>
    itemCatalog(doc).entries.find((entry: { id: string }) => entry.id === id);
  /** The file is refused, and one of its issues matches. */
  const refused = (text: string, edit: (doc: Record<string, any>) => void, pattern: RegExp, what: string) => {
    const parsed = parseRulesetDefinition(variant(text, edit));
    assert.equal(parsed.ok, false, `${what}: the file should be refused`);
    if (parsed.ok) return;
    assert.ok(
      parsed.issues.some((issue) => pattern.test(issue)),
      `${what}: expected ${pattern}, got ${parsed.issues.join("; ")}`,
    );
  };

  const ember = parsedOrThrow(JSON.parse(emberText), "the 2d6 example");
  const gravewatch = parsedOrThrow(JSON.parse(gravewatchText), "the pool example");

  // ── Both examples carry items, and neither is 5e-shaped ──
  {
    assert.equal(ember.resolution.kind, "dice-sum");
    assert.equal(gravewatch.resolution.kind, "dice-pool");
    for (const definition of [ember, gravewatch]) {
      const items = definition.items;
      assert.ok(items, `${definition.id} has an items block`);
      // Nothing is switched off unless the ruleset says so.
      assert.equal(items.native, true);
      assert.equal(items.freeform, "plain");
      const catalog = definition.catalogs?.find((entry) => entry.holds === "items");
      assert.ok(catalog, `${definition.id} has a catalog of items`);
      assert.equal(catalog.feeds, undefined, "a catalog of items writes no rows, so it feeds no list");
      assert.ok(catalog.entries!.length >= 6);
      assert.ok(catalog.entries!.every((entry) => entry.item && !entry.rows && !entry.creature && !entry.mechanics));
      // The sheet editor offers a catalog on every list it feeds, and an item catalog feeds none.
      for (const list of definition.sheet.lists) {
        assert.ok(!catalog.feeds?.includes(list.id));
      }
    }
    // The summed example carries by bulk, read off the sheet, and pays in two families.
    assert.deepEqual(ember.items!.carry, {
      stat: "bulk",
      encumberedAbove: { derived: "load" },
      limit: { const: 12 },
    });
    assert.deepEqual(
      ember.items!.currencies!.map((family) => [family.id, family.units.map((unit) => unit.value)]),
      [
        ["coin", [1, 10, 100]],
        ["salt", [1, 20]],
      ],
    );
    // The pool example binds against a rating, pays in one weightless coin and carries nothing by weight.
    assert.deepEqual(gravewatch.items!.binding, { label: "Bound", max: { abilityScore: "nerve" } });
    assert.equal(gravewatch.items!.carry, undefined);
    assert.equal(gravewatch.items!.currencies!.length, 1);
    assert.equal(gravewatch.items!.currencies![0]!.perWeight, undefined);
    // A stat the Game Master never sees says so, and every other one is shown by default.
    const conceal = gravewatch.items!.stats!.find((stat) => stat.id === "conceal")!;
    assert.equal(conceal.promptVisible, false);
    assert.ok(ember.items!.stats!.every((stat) => stat.promptVisible));
  }

  // ── The items block: every name is declared once ──
  {
    for (const key of ["categories", "rarities", "tags", "slots", "stats", "currencies"] as const) {
      refused(
        emberText,
        (doc) => doc.items[key].push({ ...doc.items[key][0] }),
        /items\.[a-z]+\.\d+\.id: Duplicate/,
        `a duplicated ${key} id`,
      );
    }
    refused(emberText, (doc) => (doc.items.categories = []), /items\.categories/, "an item needs a category");
  }

  // ── The items block: stats are declared like list columns ──
  {
    const statOf = (doc: Record<string, any>, id: string) =>
      doc.items.stats.find((stat: { id: string }) => stat.id === id);
    refused(
      emberText,
      (doc) => (statOf(doc, "bulk").min = 20),
      /items\.stats\.0\.min: min is above max/,
      "min above max",
    );
    refused(
      emberText,
      (doc) => (statOf(doc, "bulk").default = 11),
      /items\.stats\.0\.default: default is outside min\.\.max/,
      "a default outside the range",
    );
    refused(
      emberText,
      (doc) => (statOf(doc, "reach").default = "beyond"),
      /default "beyond" is not one of the values/,
      "an enum default it does not list",
    );
    refused(emberText, (doc) => (statOf(doc, "reach").type = "longtext"), /items\.stats/, "a stat is never longtext");
  }

  // ── The items block: carrying and binding are read off the sheet ──
  {
    refused(
      emberText,
      (doc) => (doc.items.carry.stat = "heft"),
      /items\.carry\.stat: Unknown item stat "heft"/,
      "carry names an unknown stat",
    );
    refused(
      emberText,
      (doc) => (doc.items.carry.stat = "damage"),
      /items\.carry\.stat: Item stat "damage" is not a number/,
      "weight is a number",
    );
    refused(
      emberText,
      (doc) => (doc.items.stats[0].min = -1),
      /items\.carry\.stat: Item stat "bulk" is a weight, so its min is 0 or more/,
      "a weight is never below 0",
    );
    refused(
      emberText,
      (doc) => (doc.items.carry.encumberedAbove = { derived: "stamina" }),
      /items\.carry\.encumberedAbove\.derived: Unknown derived value "stamina"/,
      "an unknown derived value",
    );
    // A capacity is worked out without the live state, like a pool's maximum.
    refused(
      emberText,
      (doc) => (doc.items.carry.limit = { livePool: "grit" }),
      /items\.carry\.limit\.livePool: .*cannot read a live track or pool/,
      "a carry limit that reads a live pool",
    );
    refused(
      gravewatchText,
      (doc) => (doc.items.binding.max = { abilityScore: "grace" }),
      /items\.binding\.max\.abilityScore: Unknown ability "grace"/,
      "binding reads an unknown ability",
    );
    refused(
      gravewatchText,
      (doc) => (doc.items.binding.max = { liveTrack: "harm" }),
      /items\.binding\.max\.liveTrack: .*cannot read a live track or pool/,
      "binding reads a live track",
    );
    refused(
      emberText,
      (doc) => (doc.items.carry.encumberedAbove = { const: 6, derived: "load" }),
      /items\.carry\.encumberedAbove: A value reference names exactly one of/,
      "a value reference names one thing",
    );
  }

  // ── The items block: currencies ──
  {
    refused(
      emberText,
      (doc) => doc.items.currencies[1].units.push({ id: "bit", label: "salt bits", value: 5 }),
      /items\.currencies\.1\.units\.2\.id: Duplicate currency unit id "bit"/,
      "a unit id is one coin across every family, because a cost names the unit alone",
    );
    refused(
      emberText,
      (doc) => (doc.items.currencies[0].units[1].value = 1),
      /items\.currencies\.0\.units\.1\.value: Another unit of "coin" is already worth 1/,
      "two coins of one value",
    );
    refused(
      emberText,
      (doc) => (doc.items.currencies[1].units[0].value = 2),
      /items\.currencies\.1\.units: The smallest unit of "salt" is worth 1/,
      "every value counts the smallest coin",
    );
    refused(
      gravewatchText,
      (doc) => (doc.items.currencies[0].perWeight = 50),
      /items\.currencies\.0\.perWeight: Coins weigh something only when the items block has a carry block/,
      "coins weigh nothing without a carry block",
    );
    refused(
      emberText,
      (doc) => (doc.items.currencies[0].units[0].value = 0),
      /items\.currencies\.0\.units\.0\.value/,
      "a coin is worth at least 1",
    );
    refused(
      emberText,
      (doc) => (doc.items.currencies[0].perWeight = 0),
      /items\.currencies\.0\.perWeight/,
      "perWeight is above 0",
    );
    // With carrying declared, coins may weigh something.
    parsedOrThrow(variant(emberText), "two weighed families");
  }

  // ── The switch keys ──
  {
    const off = parsedOrThrow(
      variant(emberText, (doc) => Object.assign(doc.items, { native: false, freeform: "refuse" })),
      "native items off",
    );
    assert.equal(off.items!.native, false);
    assert.equal(off.items!.freeform, "refuse");
    refused(emberText, (doc) => (doc.items.freeform = "invent"), /items\.freeform/, "an unknown freeform rule");
    refused(emberText, (doc) => (doc.items.owners = []), /items: Unrecognized key/, "the block is strict");
  }

  // ── A catalog of items ──
  {
    refused(
      emberText,
      (doc) => (itemCatalog(doc).feeds = ["gear"]),
      /catalogs\.2\.feeds: A catalog of items writes no rows, so it feeds no list/,
      "an item catalog feeds no list",
    );
    refused(
      emberText,
      (doc) => delete doc.items,
      /catalogs\.2\.holds: A catalog of items needs an items block for its items to be written in/,
      "an item catalog needs the items block",
    );
    // Without the catalog, a ruleset with no items block still loads exactly as it always has.
    const plain = parsedOrThrow(
      variant(emberText, (doc) => {
        delete doc.items;
        doc.catalogs = doc.catalogs.filter((catalog: { holds?: string }) => catalog.holds !== "items");
        withoutItemReads(doc);
      }),
      "the example without items",
    );
    assert.equal(plain.items, undefined, "absent rather than empty");

    // One catalog, one kind of entry, and one kind per entry.
    const knack = () => JSON.parse(emberText).catalogs[0].entries[0];
    refused(
      emberText,
      (doc) => itemCatalog(doc).entries.push({ ...knack(), id: "a-knack" }),
      /catalogs\.2\.entries\.8\.item: Catalog "outfitter" holds items, so every entry carries one/,
      "rows in a catalog of items",
    );
    refused(
      emberText,
      (doc) => doc.catalogs[0].entries.push({ ...itemEntry(doc, "hand-axe"), id: "an-axe" }),
      /catalogs\.0\.entries\.8\.item: Catalog "knacks" holds rows, so an entry cannot carry an item/,
      "an item in a catalog of rows",
    );
    refused(
      emberText,
      (doc) => doc.catalogs[1].entries.push({ ...itemEntry(doc, "hand-axe"), id: "an-axe" }),
      /catalogs\.1\.entries\.4\.item: Catalog "road_trouble" holds creatures, so an entry cannot carry an item/,
      "an item in a bestiary",
    );
    refused(
      emberText,
      (doc) => itemCatalog(doc).entries.push({ ...doc.catalogs[1].entries[0], id: "a-creature" }),
      /catalogs\.2\.entries\.8\.creature: Catalog "outfitter" holds items, so an entry cannot carry a creature/,
      "a creature in a catalog of items",
    );
    refused(
      emberText,
      (doc) => (itemEntry(doc, "hand-axe").rows = knack().rows),
      /An entry has exactly one of "rows", "creature" or "item"/,
      "an item with rows",
    );
    refused(
      emberText,
      (doc) => (itemEntry(doc, "hand-axe").mechanics = { kind: "attack" }),
      /catalogs\.2\.entries\.0\.mechanics: An item is written only in its item block, so it carries no mechanics/,
      "an item with mechanics",
    );
    refused(
      emberText,
      (doc) => (itemEntry(doc, "hand-axe").item.enchantment = {}),
      /Unrecognized key/,
      "the item is strict",
    );
  }

  // ── Every name an item uses is one the items block declares ──
  {
    const at = /catalogs\.2\.entries\.0\.item/.source;
    const itemRefusal = (
      edit: (item: Record<string, any>, doc: Record<string, any>) => void,
      tail: string,
      what: string,
    ) => refused(emberText, (doc) => edit(itemEntry(doc, "hand-axe").item, doc), new RegExp(`${at}${tail}`), what);

    itemRefusal(
      (item) => (item.category = "relic"),
      `\\.category: Unknown item category "relic"`,
      "an unknown category",
    );
    itemRefusal((item) => (item.rarity = "legendary"), `\\.rarity: Unknown rarity "legendary"`, "an unknown rarity");
    itemRefusal((item) => (item.tags = ["cursed"]), `\\.tags\\.0: Unknown item tag "cursed"`, "an unknown tag");
    itemRefusal(
      (item) => (item.tags = ["thrown", "thrown"]),
      `\\.tags\\.1: Duplicate item tag "thrown"`,
      "a tag twice",
    );
    itemRefusal((item) => (item.stats.heft = 2), `\\.stats: Unknown stat "heft"`, "an unknown stat");
    itemRefusal((item) => (item.stats.bulk = "heavy"), `\\.stats: Stat "bulk" takes a number`, "a word for a number");
    itemRefusal((item) => (item.stats.bulk = 1.5), `\\.stats: Stat "bulk" takes a whole number`, "half a bulk");
    itemRefusal((item) => (item.stats.bulk = 11), `\\.stats: Stat "bulk" is outside 0 to 10`, "a bulk past the range");
    itemRefusal(
      (item) => (item.stats.reach = "beyond"),
      `\\.stats: Stat "reach" takes one of its declared values`,
      "an enum value it does not list",
    );
    itemRefusal((item) => (item.stats.damage = 6), `\\.stats: Stat "damage" takes dice text`, "a number for dice");
    itemRefusal((item) => (item.slots = { belt: 1 }), `\\.slots\\.belt: Unknown slot "belt"`, "an unknown slot");
    itemRefusal(
      (item) => (item.slots = { hands: 3 }),
      `\\.slots\\.hands: A character has 2 of slot "hands"`,
      "more slots than anyone has",
    );
    itemRefusal(
      (item) => (item.cost.unit = "florin"),
      `\\.cost\\.unit: Unknown currency unit "florin"`,
      "an unknown unit",
    );
    itemRefusal(
      (item) => (item.binds = { restriction: "Only a smith" }),
      `\\.binds: This ruleset declares no binding, so nothing is bound`,
      "binding without a binding rule",
    );
    // A text stat is held to its own length.
    refused(
      gravewatchText,
      (doc) => {
        doc.items.stats.push({ id: "maker", label: "Maker", type: "text", maxLength: 10 });
        itemEntry(doc, "grave-spade").item.stats.maker = "The sexton's own forge";
      },
      /catalogs\.2\.entries\.1\.item\.stats: Stat "maker" is longer than 10 characters/,
      "a text stat past its length",
    );
    // A rarity or a cost needs the ruleset to declare some at all.
    refused(
      emberText,
      (doc) => {
        delete doc.items.rarities;
        for (const entry of itemCatalog(doc).entries) if (entry.id !== "hand-axe") delete entry.item.rarity;
      },
      new RegExp(`${at}\\.rarity: This ruleset declares no rarities`),
      "a rarity with none declared",
    );
    refused(
      emberText,
      (doc) => {
        delete doc.items.currencies;
        for (const entry of itemCatalog(doc).entries) if (entry.id !== "hand-axe") delete entry.item.cost;
      },
      new RegExp(`${at}\\.cost\\.unit: This ruleset declares no currencies`),
      "a cost with no currencies",
    );
    // Schema bounds: a stack holds at least one and never more than any Game Mode stack.
    refused(emberText, (doc) => (itemEntry(doc, "arrows").item.stack = 0), /item\.stack/, "an empty stack");
    refused(
      emberText,
      (doc) => (itemEntry(doc, "arrows").item.stack = GAME_INVENTORY_MAX_QUANTITY + 1),
      /item\.stack/,
      "a stack past the inventory's bound",
    );
    parsedOrThrow(
      variant(emberText, (doc) => (itemEntry(doc, "arrows").item.stack = GAME_INVENTORY_MAX_QUANTITY)),
      "the largest stack",
    );
    refused(
      emberText,
      (doc) => (itemEntry(doc, "hand-axe").item.cost.amount = 1.5),
      /item\.cost\.amount/,
      "a cost is whole coins",
    );
    // An item may be bound, cursed and restricted where the ruleset binds at all.
    const bell = gravewatch
      .catalogs!.find((catalog) => catalog.holds === "items")!
      .entries!.find((entry) => entry.id === "widows-ring")!;
    assert.deepEqual(bell.item!.binds, { cursed: true });
  }

  // ── A catalog of items in a file of its own is held to the same rules ──
  {
    const asAsset = variant(emberText, (doc) => {
      const catalog = itemCatalog(doc);
      delete catalog.entries;
      catalog.asset = "catalogs/outfitter.json";
    });
    const definition = parsedOrThrow(asAsset, "the example with its items in a file");
    const entries = itemCatalog(JSON.parse(emberText)).entries;
    const file = (list: unknown[]) => ({ schemaVersion: 1, catalog: "outfitter", entries: list });
    const good = parseRulesetCatalogFile(definition, "outfitter", file(entries));
    assert.ok(good.ok, good.ok ? "" : good.issues.join("; "));
    assert.equal(good.ok && good.entries.length, entries.length);
    const bad = parseRulesetCatalogFile(
      definition,
      "outfitter",
      file([{ ...entries[0], item: { ...entries[0].item, slots: { hands: 3 } } }]),
    );
    assert.deepEqual(bad.ok ? [] : bad.issues, ['entries.0.item.slots.hands: A character has 2 of slot "hands"']);
    const knack = JSON.parse(emberText).catalogs[0].entries[0];
    const rows = parseRulesetCatalogFile(definition, "outfitter", file([knack]));
    assert.equal(
      rows.ok ? "" : rows.issues[0],
      `entries.0.item: Catalog "outfitter" holds items, so every entry carries one`,
      "said first, before what else is wrong with rows where no rows belong",
    );
  }

  // ── The published schema tells an editor the same ──
  {
    const schema = JSON.parse(read("../../docs/extending/ruleset.schema.json"));
    const catalogNode = schema.properties.catalogs.items;
    assert.deepEqual(catalogNode.properties.holds.enum, ["rows", "creatures", "items"]);
    assert.deepEqual(catalogNode.if, { properties: { holds: { enum: ["creatures", "items"] } }, required: ["holds"] });
    assert.deepEqual(catalogNode.then, { not: { required: ["feeds"] } });
    assert.deepEqual(catalogNode.else, { required: ["feeds"] });
    const entryNode = catalogNode.properties.entries.items;
    assert.deepEqual(entryNode.oneOf, [
      { required: ["rows"] },
      { required: ["creature"], not: { required: ["mechanics"] } },
      { required: ["item"], not: { required: ["mechanics"] } },
    ]);
    assert.equal(entryNode.properties.item.additionalProperties, false);
    assert.equal(entryNode.properties.item.properties.stack.maximum, GAME_INVENTORY_MAX_QUANTITY);
    assert.deepEqual(schema.properties.items.required, ["categories"]);
  }

  // ── An item catalog is not something a sheet can use ──
  {
    const base = { hasSceneModel: true } as never as Parameters<typeof buildGmFormatReminder>[0];
    const reminder = (definition: RulesetDefinition) =>
      buildGmFormatReminder({
        ...base,
        ruleset: definition,
        rulesetSheetBlocks: renderGameRulesetSheetBlocks(definition, [{ name: "Vex" }], null),
      });
    assert.match(reminder(ember), /op="use"/, "the knacks are rows, so the line is there");
    const noRows = parsedOrThrow(
      variant(emberText, (doc) => {
        doc.catalogs = doc.catalogs.filter((catalog: { holds?: string }) => catalog.holds === "items");
        delete doc.battle;
        delete doc.combat;
        delete doc.layers;
      }),
      "the example with only its items",
    );
    assert.doesNotMatch(reminder(noRows), /op="use"/, "a catalog of items writes nothing onto a sheet");
  }

  // ── Install gate: items are 1.49, the block and the catalog, inline and in a file ──
  {
    const manifest = (minor: number, paths = ["ruleset.json"]) => ({
      schemaVersion: 2,
      capabilityApi: { major: 1, minor },
      builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
      id: "ruleset-ember-roads",
      name: "Ember Roads",
      version: "0.1.0",
      description: "A packaged ruleset with items.",
      engine: { min: "2.4.6", maxExclusive: "4.0.0" },
      kind: ["ruleset"],
      entrypoints: {},
      contributions: { assets: { paths } },
      files: paths.map((path) => ({ path, sha256: "0".repeat(64), bytes: 10 })),
      permissions: [],
      restartRequired: false,
    });
    // The 1.49 keys alone: the example's rarity caps are 1.51's, its item read on Guard 1.52's, what
    // its items do to checks 1.53's and its weapons 1.55's, and each has a lane of its own.
    const older = (text: string, edit: (doc: Record<string, any>) => void = () => {}) =>
      variant(text, (doc) => {
        delete doc.items?.rarityCaps;
        withoutItemReads(doc);
        withoutCheckEffects(doc);
        withoutWeapons(doc);
        edit(doc);
      });
    const itemsIssue = /A ruleset that describes items requires schemaVersion 2 and capabilityApi 1\.49 or newer/;
    const issue = (minor: number, doc: Record<string, any>, paths?: string[], files?: Map<string, unknown>) =>
      getCapabilityPackageInstallIssue(manifest(minor, paths) as any, doc, files);

    const whole = older(emberText);
    assert.match(issue(48, whole) ?? "", itemsIssue);
    assert.equal(issue(49, whole), null);

    // The block alone, with no catalog written in it.
    const blockOnly = older(emberText, (doc) => {
      doc.catalogs = doc.catalogs.filter((catalog: { holds?: string }) => catalog.holds !== "items");
    });
    assert.match(issue(48, blockOnly) ?? "", itemsIssue, "the block is read wherever it is");
    assert.equal(issue(49, blockOnly), null);

    // The catalog's header is enough on its own, even before its entries are read.
    const headerOnly = older(emberText, (doc) => {
      delete doc.items;
      itemCatalog(doc).entries = [];
    });
    assert.match(issue(48, headerOnly) ?? "", itemsIssue, "holds: items is read from the header");
    assert.equal(issue(49, headerOnly), null);

    // Entries that carry an item inline, under a header an older Engine would read as rows.
    const inlineUnderRows = older(emberText, (doc) => {
      delete doc.items;
      delete itemCatalog(doc).holds;
    });
    assert.match(issue(48, inlineUnderRows) ?? "", itemsIssue, "an item written inline");

    // Entries that carry an item, in a catalog file under a header an older Engine would read.
    const fileEntries = itemCatalog(older(emberText)).entries;
    const inFile = older(emberText, (doc) => {
      delete doc.items;
      const catalog = itemCatalog(doc);
      delete catalog.holds;
      delete catalog.entries;
      catalog.asset = "catalogs/outfitter.json";
    });
    const paths = ["ruleset.json", "catalogs/outfitter.json"];
    const files = new Map<string, unknown>([["catalogs/outfitter.json", { entries: fileEntries }]]);
    assert.match(issue(48, inFile, paths, files) ?? "", itemsIssue, "an item in a catalog file");
    assert.equal(issue(49, inFile, paths, files), null);
  }

  // ── Slice I2b-2: the items a game's inventory reads ──
  {
    const entriesOf = (definition: RulesetDefinition): Record<string, RulesetCatalogEntry[]> =>
      Object.fromEntries(
        (definition.catalogs ?? []).flatMap((catalog) =>
          catalog.holds === "items" && catalog.entries ? [[catalog.id, catalog.entries]] : [],
        ),
      );
    assert.deepEqual(rulesetItemCatalogIds(ember), ["outfitter"]);
    const book = rulesetItemBook(ember, entriesOf(ember));
    assert.equal(book.entries.length, 8);
    assert.equal(book.itemNamed("  hand AXE ")?.item, "outfitter/hand-axe", "a label in any case");
    assert.equal(book.itemNamed("hand-axe"), undefined, "an entry's id is not its name");
    assert.equal(book.itemOf("outfitter/arrows")?.stack, 20);
    assert.equal(book.itemOf("outfitter/hand-axe")?.stack, undefined);
    assert.equal(book.plain, "allow");
    assert.equal(rulesetItemBook(ember, entriesOf(ember), { plain: "refuse" }).plain, "refuse");
    const axe = book.itemOf("outfitter/hand-axe")!;
    assert.equal(axe.name, "Hand axe");
    assert.deepEqual(axe.facts, {
      category: "Weapon",
      rarity: "Common",
      tags: ["Thrown"],
      stats: [
        { id: "bulk", label: "Bulk", text: "1", promptVisible: true },
        { id: "damage", label: "Damage", text: "1d6", promptVisible: true },
        { id: "swing", label: "Rolls with", text: "brawn", promptVisible: true },
        { id: "reach", label: "Reach", text: "close", promptVisible: true },
      ],
      cost: { amount: 4, unit: "marks" },
      attack: {
        budget: "Action",
        toHit: "Brawn",
        damage: "1d6 + Brawn",
        type: "cut",
        reach: 2,
        range: { normal: 10, long: 20 },
        unit: "paces",
      },
    });
    assert.equal(
      rulesetItemPromptFacts(axe.facts),
      "Weapon, Common, Thrown; Bulk 1, Damage 1d6, Rolls with brawn, Reach close; attack (Action): Brawn to hit, 1d6 + Brawn cut, reach 2 paces, range 10 to 20 paces",
    );
    // A stat the Game Master is not shown stays on the item's card only.
    const kit = rulesetItemBook(gravewatch, entriesOf(gravewatch));
    const nail = kit.itemNamed("Silver coffin nail")!;
    assert.ok(nail.facts.stats.some((stat) => stat.id === "conceal" && !stat.promptVisible));
    assert.equal(
      rulesetItemPromptFacts(nail.facts),
      "Arm, Rare, Silver, Easily hidden; Target 7, Damage 1d6, Harm tearing; attack (Act): Nerve + Wrestle to hit at 7, 1d6 tearing",
    );
    assert.equal(nail.stack, 12);
    // An enum reads by its value label, a yes by the stat's label alone, and a no not at all.
    const worded = parsedOrThrow(
      variant(emberText, (doc) => {
        const reach = doc.items.stats.find((stat: { id: string }) => stat.id === "reach");
        reach.valueLabels = { close: "Arm's length" };
        doc.items.stats.push({ id: "lit", label: "Lit", type: "boolean", default: false });
        itemEntry(doc, "waystone").item.stats = { lit: true };
        itemEntry(doc, "arrows").item.stats = { bulk: 1, lit: false };
      }),
      "stats with value labels and a yes-or-no stat",
    );
    const wordedBook = rulesetItemBook(worded, entriesOf(worded));
    assert.deepEqual(
      wordedBook.itemOf("outfitter/hand-axe")!.facts.stats.find((stat) => stat.id === "reach"),
      { id: "reach", label: "Reach", text: "Arm's length", promptVisible: true },
    );
    assert.deepEqual(wordedBook.itemOf("outfitter/waystone")!.facts.stats, [
      { id: "lit", label: "Lit", promptVisible: true },
    ]);
    assert.equal(
      rulesetItemPromptFacts(wordedBook.itemOf("outfitter/waystone")!.facts),
      "Gear, Storied; Lit; carried: +1 on checks (Sway)",
    );
    assert.ok(!wordedBook.itemOf("outfitter/arrows")!.facts.stats.some((stat) => stat.id === "lit"));
    // A layer that hides an entry takes it out of names and the picker, not out of what is held.
    const layered = parsedOrThrow(
      variant(emberText, (doc) => {
        const catalog = itemCatalog(doc);
        catalog.filters = [{ id: "rarity", label: "Rarity", type: "text" }];
        for (const entry of catalog.entries) entry.filters = { rarity: entry.item.rarity };
        doc.layers = [
          ...(doc.layers ?? []),
          {
            id: "plain_roads",
            label: "Plain roads",
            catalogs: [{ id: "outfitter", hide: { filter: "rarity", equals: "storied" } }],
          },
        ];
      }),
      "a layer hiding storied items",
    );
    const plainRoads = rulesetItemBook(layered, entriesOf(layered), { layerOptions: { "layer.plain_roads": true } });
    assert.equal(plainRoads.entries.length, 7);
    assert.equal(plainRoads.itemNamed("Waystone"), undefined);
    assert.equal(plainRoads.itemOf("outfitter/waystone")?.name, "Waystone");
    assert.equal(plainRoads.offers("outfitter/waystone"), false, "nor added by its id");
    assert.equal(plainRoads.offers("outfitter/hand-axe"), true);
    assert.equal(plainRoads.offers("outfitter/missing"), false);
    assert.equal(rulesetItemBook(layered, entriesOf(layered)).entries.length, 8, "a layer that is off hides nothing");
    // Two items of one name: the first the ruleset lists is the one the name finds.
    const twice = parsedOrThrow(
      variant(emberText, (doc) => {
        const second = JSON.parse(JSON.stringify(itemCatalog(doc)));
        second.id = "smithy";
        second.label = "Smithy";
        doc.catalogs.push(second);
      }),
      "two item catalogs",
    );
    assert.equal(rulesetItemBook(twice, entriesOf(twice)).itemNamed("Hand axe")?.item, "outfitter/hand-axe");
    assert.equal(rulesetItemBook(twice, entriesOf(twice)).entries.length, 16);

    // The Game Master sees what each ruleset item held is, and is told names become the ruleset's items.
    const base = { hasSceneModel: true } as never as Parameters<typeof buildGmFormatReminder>[0];
    const facts = { "outfitter/hand-axe": rulesetItemPromptFacts(axe.facts) };
    const held = buildGmFormatReminder({
      ...base,
      ruleset: ember,
      playerInventory: [
        { name: "Hand axe", quantity: 2, item: "outfitter/hand-axe" },
        { name: "Rope", quantity: 1 },
      ],
      inventoryItemFacts: facts,
    });
    assert.match(
      held,
      /PLAYER INVENTORY: Hand axe ×2 \[Weapon, Common, Thrown; Bulk 1, Damage 1d6, Rolls with brawn, Reach close; attack \(Action\): Brawn to hit, 1d6 \+ Brawn cut, reach 2 paces, range 10 to 20 paces\]; Rope/,
    );
    assert.match(held, /an item named exactly as one of them becomes that item/);
    const party = buildGmFormatReminder({
      ...base,
      ruleset: ember,
      playerName: "Ada",
      partyInventory: [
        { items: [{ name: "Rope", quantity: 1 }] },
        {
          holder: "Bram",
          items: [{ name: "Old Bitey", ownName: "Hand axe", quantity: 1, item: "outfitter/hand-axe" }],
        },
      ],
      inventoryItemFacts: facts,
    });
    assert.match(party, /- Bram: Old Bitey \(Hand axe\) \[Weapon, Common, Thrown;/);
    // No item catalog, no such line; no facts, no brackets.
    const noCatalog = parsedOrThrow(
      variant(emberText, (doc) => {
        doc.catalogs = doc.catalogs.filter((catalog: { holds?: string }) => catalog.holds !== "items");
      }),
      "items with no catalog of them",
    );
    const bare = buildGmFormatReminder({
      ...base,
      ruleset: noCatalog,
      playerInventory: [{ name: "Hand axe", quantity: 1, item: "outfitter/hand-axe" }],
    });
    assert.doesNotMatch(bare, /becomes that item/);
    assert.match(bare, /PLAYER INVENTORY: Hand axe$/m);
  }

  // ── Slice I2b-3: wearing and carrying ──
  {
    const entriesOf = (definition: RulesetDefinition): Record<string, RulesetCatalogEntry[]> =>
      Object.fromEntries(
        (definition.catalogs ?? []).flatMap((catalog) =>
          catalog.holds === "items" && catalog.entries ? [[catalog.id, catalog.entries]] : [],
        ),
      );
    const build = (abilities: Record<string, number>) => ({ abilities, fields: {}, lists: {} }) as never;
    const road = rulesetItemBook(ember, entriesOf(ember), {
      actor: "player",
      sheets: {
        player: build({ brawn: 0, wits: 0, heart: 0 }),
        members: [{ name: "Bram", build: build({ brawn: 3, wits: 0, heart: 0 }) }],
      },
    });
    // Weight is the carry stat (Bulk); slots and binding come from the entry.
    assert.equal(road.itemOf("outfitter/leather-coat")?.weight, 3);
    assert.deepEqual(road.itemOf("outfitter/leather-coat")?.slots, { body: 1 });
    assert.deepEqual(road.itemOf("outfitter/hunting-bow")?.slots, { hands: 2 });
    assert.equal(road.itemOf("outfitter/waystone")?.weight, undefined, "no Bulk, no weight");
    assert.equal(road.itemOf("outfitter/hand-axe")?.binds, undefined);
    assert.deepEqual(road.slots, [
      { id: "body", label: "Body", count: 1 },
      { id: "hands", label: "Hands", count: 2 },
    ]);
    assert.equal(road.actor, "player");
    // A traveller carries 6 + Brawn before the road slows them, and 12 at most, each off their sheet.
    assert.deepEqual(road.bearer?.(undefined), { encumberedAbove: 6, limit: 12 });
    assert.deepEqual(road.bearer?.("bram"), { encumberedAbove: 9, limit: 12 }, "any case");
    assert.deepEqual(road.bearer?.("Stranger"), { encumberedAbove: 6, limit: 12 }, "no sheet, a blank one");
    // Gravewatch binds up to the bearer's Nerve, and the Widow's ring is cursed.
    const kit = rulesetItemBook(gravewatch, entriesOf(gravewatch), {
      sheets: { player: build({ sinew: 1, nerve: 2, warmth: 1 }) },
    });
    assert.deepEqual(kit.itemOf("kit/widows-ring")?.binds, { cursed: true });
    assert.deepEqual(kit.itemOf("kit/dawn-bell")?.binds, {});
    assert.equal(kit.bearer?.(undefined).bindingMax, 2);
    assert.equal(kit.bearer?.(undefined).encumberedAbove, undefined, "no carry block");
    assert.equal(
      rulesetItemBearers(gravewatch, { player: build({ sinew: 1, nerve: 3, warmth: 1 }) })(undefined).bindingMax,
      3,
    );
    // Neither carry nor binding: nothing to read off a sheet.
    const plainRoad = parsedOrThrow(
      variant(emberText, (doc) => {
        delete doc.items.carry;
        for (const family of doc.items.currencies ?? []) delete family.perWeight;
      }),
      "items without carrying",
    );
    assert.equal(rulesetItemBook(plainRoad, entriesOf(plainRoad)).bearer, undefined);
    assert.equal(rulesetItemBook(plainRoad, entriesOf(plainRoad)).itemOf("outfitter/leather-coat")?.weight, undefined);

    // What the Game Master is shown.
    const base = { hasSceneModel: true } as never as Parameters<typeof buildGmFormatReminder>[0];
    const bearers = {
      "": {
        load: 8,
        encumberedAbove: 6,
        limit: 12,
        encumbered: true,
        bound: 0,
        slots: [
          { id: "body", label: "Body", count: 1, used: 1 },
          { id: "hands", label: "Hands", count: 2, used: 0 },
        ],
      },
      bram: {
        load: 3,
        encumberedAbove: 9,
        limit: 12,
        encumbered: false,
        bound: 0,
        slots: [
          { id: "body", label: "Body", count: 1, used: 0 },
          { id: "hands", label: "Hands", count: 2, used: 2 },
        ],
      },
    };
    const party = buildGmFormatReminder({
      ...base,
      ruleset: ember,
      playerName: "Ada",
      partyInventory: [
        { items: [{ name: "Leather coat", quantity: 1, item: "outfitter/leather-coat", equipped: 1 }] },
        { holder: "Bram", items: [{ name: "Hunting bow", quantity: 2, item: "outfitter/hunting-bow", equipped: 1 }] },
      ],
      inventoryBearers: bearers,
    });
    assert.match(
      party,
      /- Ada \(load 8 of 6, most 12, encumbered; Body 1 of 1, Hands 0 of 2\): Leather coat \(1 worn\)/,
    );
    assert.match(party, /- Bram \(load 3 of 9, most 12; Body 0 of 1, Hands 2 of 2\): Hunting bow ×2 \(1 worn\)/);
    assert.match(party, /an add with who left out goes to whoever can carry it/);
    assert.match(
      party,
      /\[inventory: action="equip\|unequip" item="Name" who="Name"\] - when a character puts on, wields or readies one of the ruleset's items \(equip\) or takes it off or puts it away \(unequip\)\. It must be in who's own bag \(the player's when who is left out\); the Engine checks the slots shown beside each character/,
    );
    const alone = buildGmFormatReminder({
      ...base,
      ruleset: gravewatch,
      playerInventory: [{ name: "Widow's ring", quantity: 1, item: "kit/widows-ring", bound: 1, equipped: 1 }],
      inventoryBearers: { "": { load: 0, encumbered: false, bound: 1, bindingMax: 2, slots: [] } },
    });
    assert.match(alone, /PLAYER INVENTORY \(Bound 1 of 2\): Widow's ring \(1 worn, 1 bound\)/);
    assert.match(
      alone,
      /action="equip\|unequip\|bind\|unbind" item="Name" who="Name"\] - when a character puts on, wields or readies one of the ruleset's items \(equip\) or takes it off or puts it away \(unequip\), or binds one \(Bound\) or unbinds it\. .* the Engine checks the slots and the binding limit shown/,
    );
    assert.doesNotMatch(alone, /whoever can carry it/, "no carry block, no carrying rule");
    const noWearing = buildGmFormatReminder({
      ...base,
      ruleset: parsedOrThrow(
        variant(emberText, (doc) => {
          delete doc.items.carry;
          delete doc.items.slots;
          for (const family of doc.items.currencies ?? []) delete family.perWeight;
          for (const entry of itemCatalog(doc).entries) {
            delete entry.item.slots;
            // A weapon is used while worn, so none is left either.
            delete entry.item.attack;
          }
        }),
        "items nobody wears",
      ),
      playerInventory: [{ name: "Hand axe", quantity: 1, item: "outfitter/hand-axe" }],
    });
    assert.doesNotMatch(noWearing, /action="equip/);
    // A ruleset that binds but has no slots is never offered equip, which it would refuse every time.
    const bindingOnly = buildGmFormatReminder({
      ...base,
      ruleset: parsedOrThrow(
        variant(gravewatchText, (doc) => {
          delete doc.items.slots;
          for (const entry of itemCatalog(doc).entries) {
            delete entry.item.slots;
            delete entry.item.attack;
          }
        }),
        "items nobody puts on",
      ),
      playerInventory: [{ name: "Widow's ring", quantity: 1, item: "kit/widows-ring" }],
    });
    assert.match(
      bindingOnly,
      /\[inventory: action="bind\|unbind" item="Name" who="Name"\] - when a character binds one of the ruleset's items \(Bound\) or unbinds it\. .* the Engine checks the binding limit shown/,
    );
    assert.doesNotMatch(bindingOnly, /action="equip/);
  }

  console.info("game ruleset item regressions passed.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
  if (previousDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = previousDataDir;
}
