/**
 * Items the Game Master invents (#6814, Capability API 1.51).
 *
 *   - `items.rarityCaps` and `items.propose` are read and checked at import: a cap names a rarity the
 *     ruleset has, once, and only number stats, inside each stat's own range and in whole numbers
 *     for a stat that takes them. The install gate asks for 1.51 for either.
 *   - A proposal is read against the ruleset's own words (ids or labels, in any case): what the
 *     ruleset does not have is left out, a rarity it does not have becomes its lowest, a number stat
 *     is held to its range and then to its rarity's cap (the part `like` started it from as well),
 *     and every change is said.
 *   - The Game Master's book invents: a catalog item's name is that item, `propose: false` refuses,
 *     a name still held is that item, one this book made is found again, one nobody holds is an item
 *     of its own under a new id (an older telling may hold the first), and ids never collide. The player's book cannot invent. Saved invented items are read back only while the
 *     ruleset can still read them.
 *   - The inventory tag reads a proposal's parts, the answer says what was changed, and a game
 *     without a ruleset adds the name as it always did.
 *   - The Game Master is shown the proposal form and the ruleset's words only when it may invent, and
 *     never a stat it is not shown: not in the words, not in the caps, not in what was changed.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  applyGameInventoryTags,
  inventRulesetItem,
  parseInventoryTagBody,
  parseRulesetDefinition,
  readRulesetInventedItems,
  rulesetInventedItemId,
  rulesetInventedItemsHeld,
  rulesetItemBook,
  RULESET_INVENTED_ITEMS_MAX,
  type GameInventoryStack,
  type RulesetCatalogEntry,
  type RulesetDefinition,
  type RulesetInventedItem,
} from "../../packages/shared/src/index.js";

// Server modules read DATA_DIR once at load, so they are imported only after it points at scratch.
const dataDir = mkdtempSync(join(tmpdir(), "marinara-ruleset-invented-"));
const previousDataDir = process.env.DATA_DIR;
process.env.DATA_DIR = dataDir;

try {
  const [{ buildGmFormatReminder }, { getCapabilityPackageInstallIssue }] = await Promise.all([
    import("../../packages/server/src/services/game/gm-prompts.js"),
    import("../../packages/server/src/services/capability-packages/package-manager.service.js"),
  ]);

  const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
  const emberText = read("../../docs/examples/rulesets/ember-roads.json");
  const gravewatchText = read("../../docs/examples/rulesets/gravewatch.json");
  const variant = (text: string, edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(text) as Record<string, any>;
    edit(doc);
    return doc;
  };
  const parsedOrThrow = (document: unknown, what: string): RulesetDefinition => {
    const parsed = parseRulesetDefinition(document);
    assert.ok(parsed.ok, `${what} must import cleanly: ${parsed.ok ? "" : parsed.issues.join("; ")}`);
    return parsed.definition;
  };
  const refused = (edit: (doc: Record<string, any>) => void, pattern: RegExp, what: string) => {
    const parsed = parseRulesetDefinition(variant(emberText, edit));
    assert.equal(parsed.ok, false, `${what}: the file should be refused`);
    if (parsed.ok) return;
    assert.ok(
      parsed.issues.some((issue) => pattern.test(issue)),
      `${what}: expected ${pattern}, got ${parsed.issues.join("; ")}`,
    );
  };
  const ember = parsedOrThrow(JSON.parse(emberText), "Ember Roads");
  const gravewatch = parsedOrThrow(JSON.parse(gravewatchText), "Gravewatch");
  const entriesOf = (definition: RulesetDefinition): Record<string, RulesetCatalogEntry[]> =>
    Object.fromEntries(
      (definition.catalogs ?? [])
        .filter((catalog) => catalog.holds === "items")
        .map((catalog) => [catalog.id, (catalog.entries ?? []) as RulesetCatalogEntry[]]),
    );
  const itemOf = (definition: RulesetDefinition, id: string) =>
    Object.values(entriesOf(definition))
      .flat()
      .find((entry) => entry.id === id)!.item!;

  // ── The format: rarityCaps and propose ──
  {
    assert.deepEqual(ember.items?.rarityCaps?.[2], { rarity: "storied", stats: { guard: 3 }, bonus: 2 });
    assert.equal(ember.items?.propose, true, "invention is allowed unless a ruleset says otherwise");
    const closed = parsedOrThrow(
      variant(emberText, (doc) => {
        doc.items.propose = false;
      }),
      "a ruleset that forbids invention",
    );
    assert.equal(closed.items?.propose, false);
    refused(
      (doc) => {
        doc.items.rarityCaps[0].rarity = "legendary";
      },
      /Unknown rarity "legendary"/,
      "a cap for a rarity the ruleset lacks",
    );
    refused(
      (doc) => {
        doc.items.rarityCaps[1].rarity = "common";
      },
      /Duplicate rarity "common"/,
      "two caps for one rarity",
    );
    refused(
      (doc) => {
        doc.items.rarityCaps[0].stats = { heft: 1 };
      },
      /Unknown item stat "heft"/,
      "a cap on a stat the ruleset lacks",
    );
    refused(
      (doc) => {
        doc.items.rarityCaps[0].stats = { damage: 1 };
      },
      /Item stat "damage" is not a number/,
      "a cap on dice",
    );
    refused(
      (doc) => {
        doc.items.rarityCaps[0].stats = { guard: 9 };
      },
      /Item stat "guard" runs from 0 to 4/,
      "a cap outside the stat's own range",
    );
    refused(
      (doc) => {
        delete doc.items.rarities;
        for (const catalog of doc.catalogs)
          for (const entry of catalog.entries ?? []) if (entry.item) delete entry.item.rarity;
      },
      /This ruleset declares no rarities/,
      "caps without rarities",
    );
  }

  // ── Install gate: rarityCaps and propose are 1.51 ──
  {
    const manifest = (minor: number) => ({
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
      contributions: { assets: { paths: ["ruleset.json"] } },
      files: [{ path: "ruleset.json", sha256: "0".repeat(64), bytes: 10 }],
      permissions: [],
      restartRequired: false,
    });
    const inventedIssue =
      /caps or forbids the items its Game Master invents requires schemaVersion 2 and capabilityApi 1\.51/;
    const issue = (minor: number, doc: Record<string, any>) =>
      getCapabilityPackageInstallIssue(manifest(minor) as any, doc);
    // Less the example's item read on Guard, which is 1.52's, and what its items do to checks and
    // its bonus caps, which are 1.53's; each has a lane of its own.
    const withoutItemReads = (doc: Record<string, any>) => {
      const guard = doc.sheet.derived.find((entry: { id: string }) => entry.id === "guard");
      guard.of = guard.of.filter((ref: { itemStat?: unknown }) => ref.itemStat === undefined);
      // And the bulk carried (1.52) with the 1.54 level that reads it.
      doc.sheet.derived = doc.sheet.derived.filter((entry: { id: string }) => entry.id !== "bulk_carried");
      if (doc.combat?.levels) {
        doc.combat.levels = doc.combat.levels.filter((level: { derived?: string }) => level.derived === undefined);
      }

      for (const cap of doc.items.rarityCaps ?? []) delete cap.bonus;
      for (const catalog of doc.catalogs) {
        for (const entry of catalog.entries ?? []) {
          delete entry.item?.worn;
          delete entry.item?.carried;
          // And its weapons, which are 1.55's.
          delete entry.item?.attack;
        }
      }
    };
    const withCaps = variant(emberText, withoutItemReads);
    assert.match(issue(50, withCaps) ?? "", inventedIssue, "rarityCaps");
    assert.equal(issue(51, withCaps), null);
    const proposeOnly = variant(emberText, (doc) => {
      withoutItemReads(doc);
      delete doc.items.rarityCaps;
      doc.items.propose = false;
    });
    assert.match(issue(50, proposeOnly) ?? "", inventedIssue, "propose on its own");
    assert.equal(issue(51, proposeOnly), null);
    const neither = variant(emberText, (doc) => {
      withoutItemReads(doc);
      delete doc.items.rarityCaps;
    });
    assert.equal(issue(49, neither), null, "items without either stay 1.49");
  }

  // ── A proposal, read against the ruleset's words ──
  {
    // Labels and ids alike, in any case; an unknown tag left out; a number held to its rarity's cap.
    // Whole numbers only, for a stat that takes them.
    const fraction = parseRulesetDefinition(
      variant(emberText, (doc) => {
        doc.items.rarityCaps[0].stats = { guard: 1.5 };
      }),
    );
    assert.ok(!fraction.ok && fraction.issues.some((issue) => /Item stat "guard" takes whole numbers/.test(issue)));

    const blade = inventRulesetItem(ember, {
      category: "Weapon",
      rarity: "UNCOMMON",
      tags: ["thrown", "Silver"],
      stats: { Damage: "1d8", bulk: "2", guard: "4", "Rolls with": "Wits" },
      slots: { hands: "1" },
    })!;
    assert.deepEqual(blade.item, {
      category: "weapon",
      rarity: "uncommon",
      tags: ["thrown"],
      stats: { damage: "1d8", bulk: 2, guard: 2, swing: "wits" },
      slots: { hands: 1 },
    });
    assert.deepEqual(blade.notes, [
      'No tag "Silver", so it was left out.',
      "Guard is 2 instead of 4, the most at Uncommon.",
    ]);

    // Started from a catalog item: its parts are kept, the ones given replace them, and what it
    // started with is held to the cap as well.
    const coat = itemOf(ember, "leather-coat");
    const storied = inventRulesetItem(ember, { rarity: "storied", stats: { guard: "4" } }, coat)!;
    assert.deepEqual(storied.item, {
      category: "armor",
      rarity: "storied",
      stats: { bulk: 3, guard: 3 },
      slots: { body: 1 },
      // What it does while worn comes along too; a penalty is never capped.
      worn: { modifiers: [{ to: "checks", skills: ["sneak"], flat: -1 }] },
    });
    assert.deepEqual(storied.notes, ["Guard is 3 instead of 4, the most at Storied."]);
    const plainCoat = inventRulesetItem(ember, { summary: "Patched at the elbows." }, coat)!;
    assert.equal(plainCoat.item.rarity, "common", "a rarity not given is the one it started from");
    assert.deepEqual(plainCoat.notes, []);
    const cappedCoat = inventRulesetItem(ember, { rarity: "common" }, { ...coat, stats: { bulk: 3, guard: 4 } })!;
    assert.equal(cappedCoat.item.stats?.guard, 1, "the part it started from is capped too");

    // What the ruleset does not have.
    const odd = inventRulesetItem(ember, {
      category: "relic",
      rarity: "legendary",
      stats: { heft: "3", damage: "big", bulk: "15", guard: "1.6", reach: "nowhere" },
      slots: { wings: "2", hands: "3" },
      binds: "cursed",
    })!;
    assert.deepEqual(odd.item, {
      category: "weapon",
      rarity: "common",
      stats: { bulk: 10, guard: 1 },
      slots: { hands: 2 },
    });
    assert.deepEqual(odd.notes, [
      'No category "relic", so it is in Weapon.',
      'No rarity "legendary", so it is Common.',
      'No stat "heft", so it was left out.',
      'Damage takes dice such as 1d8, so "big" was left out.',
      "Bulk runs from 0 to 10, so it is 10.",
      "Guard takes whole numbers, so it is 2.",
      'Reach takes one of close, near, far, so "nowhere" was left out.',
      "Guard is 1 instead of 2, the most at Common.",
    ]);
    assert.equal(odd.notes.length, 8, "at most eight changes are kept: the slots' are past them");
    assert.deepEqual(
      inventRulesetItem(ember, { category: "gear", rarity: "common", slots: { wings: "2", hands: "3" } })!.notes,
      ['No slot "wings", so it was left out.', "A character has 2 Hands, so it takes 2."],
    );
    assert.deepEqual(
      inventRulesetItem(ember, { category: "gear", rarity: "common", slots: { hands: "0", body: "a lot" } })!.notes,
      ["Hands takes a count of 1 or more, so it takes 1.", "Body takes a count of 1 or more, so it takes 1."],
    );
    const bare = inventRulesetItem(ember, {})!;
    assert.deepEqual(bare.item, { category: "weapon", rarity: "common" });
    assert.deepEqual(bare.notes, [
      "No category was given, so it is in Weapon.",
      "No rarity was given, so it is Common.",
    ]);
    assert.deepEqual(inventRulesetItem(ember, { category: "gear", rarity: "common", binds: "yes" })!.notes, [
      "This ruleset binds nothing, so it does not bind.",
    ]);
    // A ruleset that binds: a cursed item, and "no" undoes what it started from.
    const ring = inventRulesetItem(gravewatch, { binds: "cursed" }, itemOf(gravewatch, "widows-ring"))!;
    assert.deepEqual(ring.item.binds, { cursed: true });
    assert.equal(
      inventRulesetItem(gravewatch, { binds: "no" }, itemOf(gravewatch, "widows-ring"))!.item.binds,
      undefined,
    );
    assert.equal(inventRulesetItem({ ...ember, items: undefined }, {}), null, "no items block, nothing to invent");

    // A stat the Game Master is not shown: a change to it is kept for the player, never said to it.
    const concealed = inventRulesetItem(
      gravewatch,
      { stats: { conceal: "sleeve", damage: "big" } },
      itemOf(gravewatch, "widows-ring"),
    )!;
    assert.deepEqual(concealed.notes, [
      'Hidden in takes one of pocket, coat, none, so "sleeve" was left out.',
      'Damage takes dice such as 1d8, so "big" was left out.',
    ]);
    assert.deepEqual(concealed.promptNotes, ['Damage takes dice such as 1d8, so "big" was left out.']);
    const secretGuard = parsedOrThrow(
      variant(emberText, (doc) => {
        doc.items.stats.find((stat: { id: string }) => stat.id === "guard").promptVisible = false;
      }),
      "a hidden guard",
    );
    const capped = inventRulesetItem(secretGuard, { category: "armor", rarity: "common", stats: { guard: "4" } })!;
    assert.deepEqual(capped.notes, ["Guard is 1 instead of 4, the most at Common."]);
    assert.deepEqual(capped.promptNotes, []);
    const secretBook = rulesetItemBook(secretGuard, entriesOf(secretGuard), { actor: "game-master" });
    assert.deepEqual(
      secretBook.invent!({ name: "Iron Vest", category: "armor", rarity: "common", stats: { guard: "4" } }, []),
      {
        item: "invented:iron-vest",
        notes: [],
      },
    );
    assert.deepEqual(secretBook.itemOf("invented:iron-vest")?.invented, {
      notes: ["Guard is 1 instead of 4, the most at Common."],
    });
  }

  // ── The Game Master's book ──
  {
    const book = (definition: RulesetDefinition, invented: RulesetInventedItem[] = []) =>
      rulesetItemBook(definition, entriesOf(definition), { actor: "game-master", invented });
    const gm = book(ember);
    assert.equal(gm.inventedChanged(), false);
    const edge = gm.invent!(
      { name: "Mourning Edge", category: "weapon", rarity: "storied", stats: { damage: "1d10" } },
      [],
    );
    assert.deepEqual(edge, { item: "invented:mourning-edge", notes: [] });
    assert.equal(gm.inventedChanged(), true);
    assert.equal(gm.itemNamed("mourning edge")?.item, "invented:mourning-edge", "found by name, in any case");
    assert.equal(gm.offers("invented:mourning-edge"), true);
    assert.deepEqual(
      gm.itemOf("invented:mourning-edge")?.facts.stats.map((stat) => stat.text),
      ["1d10"],
    );
    assert.deepEqual(gm.itemOf("invented:mourning-edge")?.invented, { notes: [] });
    assert.equal(
      gm.entries.some((entry) => entry.item.startsWith("invented:")),
      false,
      "never on the picker's list",
    );
    // A name still held is that item: a later proposal changes nothing.
    const held: GameInventoryStack[] = [
      { id: "st-edge", name: "Mourning Edge", item: "invented:mourning-edge", quantity: 1 },
    ];
    assert.deepEqual(gm.invent!({ name: "Mourning Edge", stats: { damage: "2d6" } }, held), {
      item: "invented:mourning-edge",
      notes: [],
    });
    assert.equal(gm.itemOf("invented:mourning-edge")?.entry.item?.stats?.damage, "1d10");
    // The book that made it finds it again: the reply read a second time gives the same answer.
    assert.deepEqual(gm.invent!({ name: "Mourning Edge", stats: { damage: "2d6" } }, []), {
      item: "invented:mourning-edge",
      notes: [],
    });
    assert.equal(gm.inventedItems().length, 1);
    // Told again (a new book, from what the game kept), a proposal nobody holds is an item of its own:
    // the first telling may still hold the first, and a switch back to it must find it unchanged.
    const retold = book(ember, gm.inventedItems());
    assert.deepEqual(
      retold.invent!({ name: "Mourning Edge", category: "weapon", rarity: "storied", stats: { damage: "2d6" } }, []),
      { item: "invented:mourning-edge-2", notes: [] },
    );
    assert.equal(retold.itemOf("invented:mourning-edge")?.entry.item?.stats?.damage, "1d10");
    assert.equal(retold.itemOf("invented:mourning-edge-2")?.entry.item?.stats?.damage, "2d6");
    assert.equal(retold.itemNamed("Mourning Edge")?.item, "invented:mourning-edge-2", "a name finds the newest");
    assert.deepEqual(
      retold.invent!({ name: "Mourning Edge", stats: { damage: "3d6" } }, held),
      { item: "invented:mourning-edge", notes: [] },
      "held, the older one is still that item",
    );
    // Only the ones still held are kept.
    assert.deepEqual(
      rulesetInventedItemsHeld(retold.inventedItems(), held).map((made) => made.id),
      ["mourning-edge"],
    );
    // Another name spelled the same way gets an id of its own.
    assert.equal(
      (gm.invent!({ name: "Mourning-Edge!", category: "gear" }, []) as { item: string }).item,
      "invented:mourning-edge-2",
    );
    // One of the ruleset's own names is that item.
    assert.deepEqual(gm.invent!({ name: "hand axe", rarity: "storied" }, []), {
      item: "outfitter/hand-axe",
      notes: ["Hand axe is one of this ruleset's own items, so it is that item."],
    });
    // Starting from one of the ruleset's items by its id or its name, or from nothing it has.
    gm.invent!({ name: "Old Coat", like: "outfitter/leather-coat", rarity: "uncommon" }, []);
    assert.deepEqual(gm.itemOf("invented:old-coat")?.slots, { body: 1 });
    gm.invent!({ name: "Worn Bow", like: "Hunting bow" }, []);
    assert.deepEqual(gm.itemOf("invented:worn-bow")?.slots, { hands: 2 });
    assert.deepEqual(
      (gm.invent!({ name: "Oddity", like: "a lamp", category: "gear" }, []) as { notes: string[] }).notes,
      ['No item "a lamp" to start from.', "No rarity was given, so it is Common."],
    );
    assert.deepEqual(gm.invent!({ name: "  ", category: "gear" }, []), { refused: "unreadable" });

    const closed = book(
      parsedOrThrow(
        variant(emberText, (doc) => (doc.items.propose = false)),
        "closed",
      ),
    );
    assert.deepEqual(closed.invent!({ name: "Mourning Edge", category: "weapon" }, []), { refused: "no-invention" });
    assert.deepEqual(
      closed.invent!({ name: "Hand axe", category: "weapon" }, []),
      { item: "outfitter/hand-axe", notes: ["Hand axe is one of this ruleset's own items, so it is that item."] },
      "a ruleset's own item is still that item",
    );
    const player = rulesetItemBook(ember, entriesOf(ember), { actor: "player" });
    assert.equal(player.invent, undefined, "only the Game Master invents");
    // A game already at the most it keeps.
    const many = Array.from({ length: RULESET_INVENTED_ITEMS_MAX }, (_, n) => ({
      id: `thing-${n}`,
      name: `Thing ${n}`,
      item: { category: "gear", rarity: "common" },
    }));
    assert.deepEqual(book(ember, many).invent!({ name: "One more", category: "gear" }, []), { refused: "too-many" });

    // The invented items a game keeps, read back.
    const saved = gm.inventedItems();
    const reread = readRulesetInventedItems(ember, JSON.parse(JSON.stringify(saved)));
    assert.deepEqual(reread, saved);
    const kept = book(ember, reread);
    assert.equal(kept.itemNamed("Old Coat")?.item, "invented:old-coat");
    assert.equal(kept.inventedChanged(), false);
    assert.deepEqual(
      readRulesetInventedItems(ember, [
        { id: "good", name: "Good", item: { category: "gear" }, notes: ["kept", 3, ""] },
        { id: "good", name: "Twice", item: { category: "gear" } },
        { id: "Bad Id", name: "Bad", item: { category: "gear" } },
        { id: "gone", name: "Gone", item: { category: "relic" } },
        { id: "nameless", name: " [ ] ", item: { category: "gear" } },
        "junk",
      ]),
      [{ id: "good", name: "Good", item: { category: "gear" }, notes: ["kept"] }],
      "only what the ruleset can still read, once",
    );
    assert.deepEqual(readRulesetInventedItems(ember, { not: "a list" }), []);
    // A catalog item of the same name is found first.
    const shadowed = book(ember, [{ id: "hand-axe", name: "Hand axe", item: { category: "gear" } }]);
    assert.equal(shadowed.itemNamed("Hand axe")?.item, "outfitter/hand-axe");
    assert.equal(rulesetInventedItemId("Ünter Blade"), "unter-blade");
    assert.match(rulesetInventedItemId("Меч"), /^item-[a-z0-9]+$/);
  }

  // ── The inventory tag ──
  {
    const request = parseInventoryTagBody(
      ` action="add" item="Mourning Edge" like="outfitter/hand-axe" category=weapon rarity="Storied" tags="thrown, ranged" stats="damage=1d10; bulk: 2, guard=1" slots="hands" binds="no" summary="A widow's blade."`,
    );
    assert.deepEqual(request?.proposal, {
      like: "outfitter/hand-axe",
      category: "weapon",
      rarity: "Storied",
      tags: ["thrown", "ranged"],
      stats: { damage: "1d10", bulk: "2", guard: "1" },
      slots: { hands: "" },
      binds: "no",
      summary: "A widow's blade.",
    });
    assert.deepEqual(
      parseInventoryTagBody(`action="add" item="Ring" category="gear" tags="none" stats="None" slots=" nothing "`)
        ?.proposal,
      { category: "gear", tags: [], stats: {}, slots: {} },
      'a list written as "none" is given, and empty',
    );
    assert.equal(parseInventoryTagBody(`action="add" item="Rope" count="2"`)?.proposal, undefined);
    assert.equal(parseInventoryTagBody(`action="remove" item="Rope" category="gear"`)?.proposal, undefined);

    const party = { player: "Ada", members: [] };
    const gm = rulesetItemBook(ember, entriesOf(ember), { actor: "game-master" });
    const told = applyGameInventoryTags(
      `The widow presses it into your hands. [inventory: action="add" item="Mourning Edge" category="weapon" rarity="storied" stats="damage=1d10, guard=4" slots="hands=1"] Later: [inventory: action="add" item="mourning edge"]`,
      [],
      party,
      undefined,
      gm,
    );
    assert.match(
      told.content,
      /\[inventory: action="add" item="Mourning Edge" count="1" result="ok" now="1" note="Guard is 3 instead of 4, the most at Storied\. It fights as Hand axe does\."\]/,
    );
    assert.match(told.content, /\[inventory: action="add" item="mourning edge" count="1" result="ok" now="2"\]/);
    assert.deepEqual(
      told.stacks.map((stack) => [stack.name, stack.item, stack.quantity]),
      [["Mourning Edge", "invented:mourning-edge", 2]],
    );
    assert.equal(gm.inventedChanged(), true);

    const closed = rulesetItemBook(
      parsedOrThrow(
        variant(emberText, (doc) => (doc.items.propose = false)),
        "closed",
      ),
      entriesOf(ember),
      { actor: "game-master" },
    );
    const refusedTell = applyGameInventoryTags(
      `[inventory: action="add" item="Mourning Edge" category="weapon"]`,
      [],
      party,
      undefined,
      closed,
    );
    assert.match(refusedTell.content, /result="refused" reason="no-invention"/);
    assert.deepEqual(refusedTell.stacks, []);
    // Without a ruleset its parts mean nothing, and the name is added as it always was.
    const plain = applyGameInventoryTags(`[inventory: action="add" item="Mourning Edge" category="weapon"]`, [], party);
    assert.match(plain.content, /item="Mourning Edge" count="1" result="ok" now="1"\]/);
    assert.equal(plain.stacks[0]?.item, undefined);
  }

  // ── What the Game Master is told ──
  {
    const base = { hasSceneModel: true } as never as Parameters<typeof buildGmFormatReminder>[0];
    const told = buildGmFormatReminder({ ...base, ruleset: ember });
    assert.match(
      told,
      /invent one of its items in the add: \[inventory: action="add" item="New name" category="\.\.\." rarity="\.\.\." tags="a, b" stats="id=value, id=value" slots="id=count" worn="\+1 Skill" summary="one line"\]\. Every part but item is optional\. worn is what it does while worn, and carried="\.\.\." what it does while only carried: changes split by ";", each \+N, -N, advantage, disadvantage, or fails \(saves only\), on skills or saves by name, or on checks or saves for all of them; \+N or -N on an ability's name raises or lowers that ability; in a fight, \+N, -N, advantage or disadvantage on attacks, and \+N or -N on Guard \(defense; an item's guard stat already adds to it, so give one or the other\)\. A bonus or penalty to a skill, save or ability always goes in worn or carried, never in stats\. To start from one of the ruleset's own items, add like="that item's exact name" \(leave like out otherwise\)/,
    );
    assert.match(told, /and holds each number to the most its rarity allows/);
    // Where the ruleset has fights, a weapon made like one fights like it.
    assert.match(told, /what else you give replaces its parts, and a weapon made like one fights like it\. The Engine/);
    const noFights = parsedOrThrow(
      variant(emberText, (doc) => {
        delete doc.combat;
        doc.catalogs = doc.catalogs.filter((catalog: { holds?: string }) => catalog.holds !== "creatures");
        doc.sheet.derived = doc.sheet.derived.filter((entry: { id: string }) => entry.id !== "stance_brawn");
        doc.resolution.adjust = doc.resolution.adjust.filter(
          (adjust: { value: { derived?: string } }) => adjust.value.derived !== "stance_brawn",
        );
      }),
      "Ember Roads with no fights",
    );
    assert.match(
      buildGmFormatReminder({ ...base, ruleset: noFights }),
      /what else you give replaces its parts\. The Engine/,
    );
    assert.match(
      told,
      /Its words: categories weapon, armor, ammunition, provisions, gear; rarities common, uncommon, storied \(lowest first\); tags thrown, ranged, two_handed; stats bulk \(number 0 to 10\), guard \(number 0 to 4\), damage \(dice\), swing \(one of brawn, wits, heart\), reach \(one of close, near, far\); slots body \(1\), hands \(2\); skills Scrap, Sneak, Tinker, Sway; abilities Brawn, Wits, Heart\. The most at each rarity: common guard 1, worn or carried bonus 1; uncommon guard 2, worn or carried bonus 1; storied guard 3, worn or carried bonus 2\./,
    );
    assert.match(
      buildGmFormatReminder({ ...base, ruleset: gravewatch }),
      /slots="id=count" binds="yes\|cursed" worn="\+1 Skill" summary=/,
    );
    const closed = parsedOrThrow(
      variant(emberText, (doc) => (doc.items.propose = false)),
      "closed",
    );
    assert.doesNotMatch(buildGmFormatReminder({ ...base, ruleset: closed }), /invent one of its items/);
    assert.doesNotMatch(buildGmFormatReminder(base), /invent one of its items/, "no ruleset, no proposal form");
    const secretGuard = parsedOrThrow(
      variant(emberText, (doc) => {
        doc.items.stats.find((stat: { id: string }) => stat.id === "guard").promptVisible = false;
      }),
      "a hidden guard",
    );
    // `native: false` (#6822): the Game Master is told it has only the ruleset's items and the ones it
    // invents, or only the ruleset's when it may not invent.
    const closedShop = parsedOrThrow(
      variant(emberText, (doc) => (doc.items.native = false)),
      "no untyped items",
    );
    const shop = buildGmFormatReminder({ ...base, ruleset: closedShop });
    assert.match(
      shop,
      /This ruleset has no untyped items: an add must name one of its items or invent one of its items as below, and any other name is refused as not-ruleset-item\. More of something already held can still be added\./,
    );
    assert.match(shop, /invent one of its items in the add/);
    const listedOnly = parsedOrThrow(
      variant(emberText, (doc) => {
        doc.items.native = false;
        doc.items.propose = false;
      }),
      "only listed items",
    );
    const listed = buildGmFormatReminder({ ...base, ruleset: listedOnly });
    assert.match(listed, /an add must name one of its items, and any other name is refused/);
    assert.doesNotMatch(listed, /invent one of its items/);
    assert.doesNotMatch(told, /no untyped items/, "a ruleset with Game Mode's own items says nothing of it");
    const secret = buildGmFormatReminder({ ...base, ruleset: secretGuard });
    assert.match(secret, /invent one of its items/);
    assert.doesNotMatch(secret, /guard/, "a stat it is not shown is never named, its cap included");
  }

  console.info("game ruleset invented item regressions passed.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
  if (previousDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = previousDataDir;
}
