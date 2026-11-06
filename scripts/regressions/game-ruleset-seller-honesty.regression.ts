/**
 * Honest and dishonest sellers (P1-7, Capability API 1.79).
 *
 *   - Schema: an item's `risky` and `passesFor`, a seller's `honest: false`; a fake's target is a real,
 *     sellable item of the same kind, worn the same way. Gated at 1.79, catalog files read at install.
 *   - Market: a cursed item or a fake is never among anybody's wares nor in an honest seller's stock; a
 *     dishonest seller's stock offers a fake as what it passes for, and only a buy naming that seller
 *     gets it. Honest sellers warn about risky wares in the MARKET block.
 *   - A fake in the bag: shown as what it passes for in every answer, journal line and total, kept apart
 *     from the real thing, kept through a give; the Game Master's block marks it.
 *   - Found out: a reveal (which never adds), binding it, using it, or an honest buyer (who pays its
 *     true worth); a dishonest buyer takes it as it seems.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  applyGameInventoryOps,
  applyGameInventoryTags,
  defaultRulesetSheetBuild,
  gameFightItems,
  gameFightUseEffect,
  gameInventoryFightSpendStack,
  gameInventoryTotals,
  parseRulesetDefinition,
  readResolvedInventoryTags,
  rulesetItemBook,
  rulesetItemPromptFacts,
  rulesetMarketPlace,
  rulesetMarketPromptText,
  rulesetMarketQuoter,
  rulesetMarketShelf,
  sameGameInventory,
  type GameInventoryStack,
  type RulesetCatalogEntry,
  type RulesetDefinition,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-seller-honesty-"));
process.env.DATA_DIR = dataDir;
process.env.MARINARA_DATA_DIR = dataDir;

const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");
const { buildGmFormatReminder } = await import("../../packages/server/src/services/game/gm-prompts.js");
const { gameInventoryItemUser } = await import("../../packages/server/src/services/game/game-item-use.service.js");

try {
  const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
  const gravewatchText = read("../../docs/examples/rulesets/gravewatch.json");
  /** Gravewatch with a fake tonic, a cursed ring that passes for the dawn bell, a risky tonic, and a
   *  fence whose stock is always two of the fake. */
  const honesty = (edit: (doc: Record<string, any>) => void = () => {}) => {
    const doc = JSON.parse(gravewatchText) as Record<string, any>;
    const kit = doc.catalogs.find((catalog: { id: string }) => catalog.id === "kit");
    kit.entries.find((entry: { id: string }) => entry.id === "dawn-bell").item.cost = { amount: 2, unit: "crown" };
    kit.entries.push(
      {
        id: "bitter-tonic",
        label: "Bitter tonic",
        item: { category: "tonic", passesFor: "kit/warming-tonic", cost: { amount: 1, unit: "penny" } },
      },
      {
        id: "hexed-ring",
        label: "Hexed ring",
        item: {
          category: "token",
          slots: { worn: 1 },
          stack: 1,
          binds: { cursed: true },
          passesFor: "kit/dawn-bell",
          cost: { amount: 1, unit: "penny" },
        },
      },
      {
        id: "wild-tonic",
        label: "Wild tonic",
        item: { category: "tonic", cost: { amount: 6, unit: "penny" }, risky: "a sip can sour into a fever" },
      },
    );
    doc.items.lootTables.push({
      id: "fences_lot",
      label: "A fence's lot",
      rolls: 1,
      entries: [{ item: "kit/bitter-tonic", weight: 1, count: 2 }],
    });
    doc.items.market.sellers.push({
      id: "fence",
      label: "fence",
      sells: [{ category: "tonic" }],
      place: "town",
      honest: false,
      stock: { table: "fences_lot" },
    });
    edit(doc);
    return doc;
  };
  const parsedOrThrow = (document: unknown): RulesetDefinition => {
    const parsed = parseRulesetDefinition(document);
    assert.ok(parsed.ok, parsed.ok ? "" : parsed.issues.join("; "));
    return parsed.definition;
  };
  const refusal = (document: unknown) => {
    const parsed = parseRulesetDefinition(document);
    assert.ok(!parsed.ok, "this document was supposed to be refused");
    return parsed.issues.join("; ");
  };
  const entriesOf = (definition: RulesetDefinition): Record<string, RulesetCatalogEntry[]> =>
    Object.fromEntries(
      (definition.catalogs ?? []).flatMap((catalog) =>
        catalog.entries && catalog.holds === "items" ? [[catalog.id, catalog.entries]] : [],
      ),
    );

  // ── Schema ──
  const definition = parsedOrThrow(honesty());
  const book = rulesetItemBook(definition, entriesOf(definition));
  {
    const fake = (doc: Record<string, any>) =>
      doc.catalogs
        .find((catalog: { id: string }) => catalog.id === "kit")
        .entries.find((entry: { id: string }) => entry.id === "bitter-tonic").item;
    for (const [edit, message] of [
      [(doc: Record<string, any>) => (fake(doc).passesFor = "kit/bitter-tonic"), /does not pass for itself/],
      [(doc: Record<string, any>) => (fake(doc).passesFor = "kit/bottled-sunlight"), /No item "kit\/bottled-sunlight"/],
      [
        (doc: Record<string, any>) => (fake(doc).passesFor = "kit/watch-house-bed"),
        /is a different kind of item|is a service/,
      ],
      [(doc: Record<string, any>) => (fake(doc).passesFor = "kit/lantern-coat"), /is a different kind of item/],
      [(doc: Record<string, any>) => (fake(doc).passesFor = "kit/widows-ring"), /is itself a fake or cursed/],
      [
        (doc: Record<string, any>) => {
          fake(doc).category = "token";
          fake(doc).passesFor = "kit/hexed-ring";
        },
        /is itself a fake or cursed/,
      ],
      [
        (doc: Record<string, any>) =>
          delete doc.catalogs
            .find((catalog: { id: string }) => catalog.id === "kit")
            .entries.find((entry: { id: string }) => entry.id === "warming-tonic").item.cost,
        /has no cost, so it is never sold/,
      ],
      [
        (doc: Record<string, any>) => {
          const ring = doc.catalogs
            .find((catalog: { id: string }) => catalog.id === "kit")
            .entries.find((entry: { id: string }) => entry.id === "hexed-ring").item;
          ring.slots = { worn: 1, hands: 1 };
        },
        /worn in other slots|slot "hands"/,
      ],
      [(doc: Record<string, any>) => (fake(doc).risky = "[ominous]"), /square brackets/],
      [
        (doc: Record<string, any>) =>
          delete doc.catalogs
            .find((catalog: { id: string }) => catalog.id === "kit")
            .entries.find((entry: { id: string }) => entry.id === "hexed-ring").item.binds,
        /binds and the fake does not/,
      ],
    ] as const) {
      assert.match(refusal(honesty(edit)), message);
    }
  }

  // ── The 1.79 gate ──
  {
    const manifest = (minor: number) => ({
      schemaVersion: 2,
      capabilityApi: { major: 1, minor },
      builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
      id: "ruleset-honesty",
      name: "Honesty",
      version: "0.1.0",
      description: "A packaged ruleset with honest and dishonest sellers.",
      engine: { min: "2.4.6", maxExclusive: "4.0.0" },
      kind: ["ruleset"],
      entrypoints: {},
      contributions: { assets: { paths: ["ruleset.json"] } },
      files: [{ path: "ruleset.json", sha256: "0".repeat(64), bytes: 10 }],
      permissions: [],
      restartRequired: false,
    });
    const gate = /risky items, fakes or a dishonest seller.*capabilityApi 1\.79/;
    const issue = (minor: number, doc: Record<string, any>) =>
      getCapabilityPackageInstallIssue(manifest(minor) as any, doc);
    assert.match(issue(78, honesty()) ?? "", gate);
    assert.equal(issue(79, honesty()), null);
    // Each key alone is 1.79's: a dishonest seller, a risky item, a fake.
    const without = (doc: Record<string, any>) => {
      const kit = doc.catalogs.find((catalog: { id: string }) => catalog.id === "kit");
      kit.entries = kit.entries.filter(
        (entry: { id: string }) => !["bitter-tonic", "hexed-ring", "wild-tonic"].includes(entry.id),
      );
      doc.items.lootTables = doc.items.lootTables.filter((table: { id: string }) => table.id !== "fences_lot");
      doc.items.market.sellers = doc.items.market.sellers.filter((seller: { id: string }) => seller.id !== "fence");
    };
    assert.equal(issue(78, honesty(without)), null);
    assert.match(
      issue(
        73,
        honesty((doc) => {
          without(doc);
          doc.items.market.sellers[0].honest = false;
        }),
      ) ?? "",
      gate,
    );
    // A fake's target in another catalog file is checked at install, where every file can be read.
    let kitEntries: unknown;
    const filed = honesty((doc) => {
      const kit = doc.catalogs.find((catalog: { id: string }) => catalog.id === "kit");
      kit.entries.find((entry: { id: string }) => entry.id === "bitter-tonic").item.passesFor = "kit/lantern-coat";
      kit.asset = "catalogs/kit.json";
      kitEntries = kit.entries;
      delete kit.entries;
    });
    const files = new Map([["catalogs/kit.json", { entries: kitEntries }]]);
    const filedManifest = {
      ...manifest(79),
      contributions: { assets: { paths: ["ruleset.json", "catalogs/kit.json"] } },
    };
    assert.match(
      getCapabilityPackageInstallIssue(filedManifest as any, filed, files as any) ?? "",
      /The fake "kit\/bitter-tonic" cannot pass for "kit\/lantern-coat": .*different kind of item/,
    );
  }

  // ── The market ──
  const market = definition.items!.market!;
  const town = rulesetMarketPlace(market, "market town")!;
  const day = { key: "honesty-day", bought: new Map(), stockBought: new Map(), paidOut: new Map() };
  {
    const shelf = rulesetMarketShelf(definition, book, town, day.key);
    // The fence passes two bitter tonics off as warming tonics; nobody honest keeps a fake.
    assert.deepEqual(shelf.stock.get("fence"), [
      {
        item: "kit/warming-tonic",
        name: "Warming tonic",
        count: 2,
        truly: "kit/bitter-tonic",
        trulyName: "Bitter tonic",
      },
    ]);
    const block = rulesetMarketPromptText(
      definition,
      book,
      { name: "Barrowmere", size: "market town" },
      undefined,
      day,
    )!;
    assert.match(
      block,
      /- fence \(dishonest\): .*in stock today: Warming tonic ×2 4 pennies \(FAKE: really Bitter tonic; this seller passes it off as the real thing\)/,
    );
    // A risky ware: the honest chandler warns, the fence says nothing.
    assert.match(block, /- chandler: [^\n]*Wild tonic 6 pennies \(warn the buyer first: a sip can sour into a fever\)/);
    assert.doesNotMatch(
      block.split("\n").find((line) => line.startsWith("- fence"))!,
      /warn the buyer/,
    );
    // Nobody's wares list a fake or a cursed item by its true name.
    assert.doesNotMatch(block, /Bitter tonic \d|Hexed ring|Widow's ring/);
    assert.match(block, /A dishonest seller buys a fake as what it seems; an honest one sees through it/);
  }
  {
    // An honest seller whose stock table lands on a fake does not keep it.
    const honestStock = parsedOrThrow(
      honesty((doc) => {
        doc.items.market.sellers.find((seller: { id: string }) => seller.id === "chandler").stock = {
          table: "fences_lot",
        };
      }),
    );
    const honestBook = rulesetItemBook(honestStock, entriesOf(honestStock));
    const honestTown = rulesetMarketPlace(honestStock.items!.market!, "market town")!;
    assert.deepEqual(rulesetMarketShelf(honestStock, honestBook, honestTown, day.key).stock.get("chandler"), []);
    // A fake whose target the game no longer sells (here its price is gone) is not offered.
    const costless = {
      ...book,
      entries: book.entries.map((entry) =>
        entry.item === "kit/warming-tonic"
          ? { ...entry, entry: { ...entry.entry, item: { ...entry.entry.item!, cost: undefined } } }
          : entry,
      ),
    };
    assert.deepEqual(rulesetMarketShelf(definition, costless, town, day.key).stock.get("fence"), []);
  }

  const party = { members: ["Juno"] };
  const coins = (count: number): GameInventoryStack[] => [
    { id: "c0", name: "shillings", item: "coin:shilling", quantity: count },
  ];
  const quoter = () => rulesetMarketQuoter(definition, book, town, () => true, undefined, day);
  const run = (tag: string, stacks: GameInventoryStack[], market = quoter()) =>
    applyGameInventoryTags(tag, stacks, party, undefined, book, undefined, undefined, market);
  const leaks = (text: string) => /bitter/i.test(text);

  // Buying from the fence: the fake, shown as a warming tonic everywhere the player looks.
  const bought = run('[inventory: action="buy" item="Warming tonic" count="2" seller="fence"]', coins(5));
  const [buyAnswer] = readResolvedInventoryTags(bought.content);
  assert.equal(buyAnswer?.ok, true, bought.content);
  assert.ok(!leaks(bought.content), `the answered tag never names the fake: ${bought.content}`);
  assert.ok(!bought.journal.some((entry) => leaks(entry.item)), "nor does the journal");
  const fake = bought.stacks.find((stack) => stack.item === "kit/warming-tonic")!;
  assert.deepEqual([fake.name, fake.quantity, fake.truly], ["Warming tonic", 2, "kit/bitter-tonic"]);
  const totals = gameInventoryTotals(bought.stacks);
  assert.ok(!totals.some((total) => leaks(total.name)), "nor does a total's name");
  assert.equal(totals.find((total) => total.item === "kit/warming-tonic")?.truly, "kit/bitter-tonic");
  {
    // A buy that names no seller never gets a fake; the true name is never for sale.
    const honestBuy = run('[inventory: action="buy" item="Warming tonic"]', coins(5));
    assert.equal(honestBuy.stacks.find((stack) => stack.item === "kit/warming-tonic")?.truly, undefined);
    const trueName = run('[inventory: action="buy" item="Bitter tonic" seller="fence"]', coins(5));
    assert.equal(readResolvedInventoryTags(trueName.content)[0]?.reason, "not-for-sale");
    // A real tonic bought beside the fake stays its own stack.
    const both = run('[inventory: action="buy" item="Warming tonic" seller="chandler"]', bought.stacks);
    const tonics = both.stacks.filter((stack) => stack.item === "kit/warming-tonic");
    assert.deepEqual(
      tonics.map((stack) => [stack.quantity, stack.truly ?? null]),
      [
        [2, "kit/bitter-tonic"],
        [1, null],
      ],
    );
    // The Game Master's totals keep them apart too: the fake line carries its truth, the real one none.
    assert.deepEqual(
      gameInventoryTotals(both.stacks)
        .filter((total) => total.item === "kit/warming-tonic")
        .map((total) => [total.quantity, total.truly ?? null]),
      [
        [2, "kit/bitter-tonic"],
        [1, null],
      ],
    );
    // Given to somebody who holds the real thing, the fake keeps a stack of its own.
    const realForJuno: GameInventoryStack[] = [
      ...bought.stacks,
      { id: "j1", name: "Warming tonic", item: "kit/warming-tonic", quantity: 1, holder: "Juno" },
    ];
    const handed = run('[inventory: action="give" item="Warming tonic" count="1" to="Juno"]', realForJuno);
    assert.deepEqual(
      handed.stacks
        .filter((stack) => stack.holder === "Juno")
        .map((stack) => [stack.quantity, stack.truly ?? null])
        .sort(),
      [
        [1, null],
        [1, "kit/bitter-tonic"],
      ],
      handed.content,
    );
    // The whole fake stack handed over keeps its id (a selection follows it), beside the real one.
    const whole = run('[inventory: action="give" item="Warming tonic" count="2" to="Juno"]', realForJuno);
    assert.equal(whole.stacks.find((stack) => stack.id === fake.id)?.holder, "Juno", whole.content);
    // Given one of two, the fake stays a fake in the other bag.
    const given = run('[inventory: action="give" item="Warming tonic" count="1" to="Juno"]', bought.stacks);
    const junos = given.stacks.find((stack) => stack.holder === "Juno")!;
    assert.deepEqual([junos.item, junos.quantity, junos.truly], ["kit/warming-tonic", 1, "kit/bitter-tonic"]);
    assert.ok(!leaks(given.content));
    // A fake found out is another inventory, though it shows the same until then.
    const revealedCopy = bought.stacks.map((stack) => (stack.truly ? { ...stack, truly: undefined } : stack));
    assert.equal(sameGameInventory(bought.stacks, revealedCopy), false);
  }

  // Where only the fence has something (a watch pistol is a city's; the fence's lot is a fake one), a buy
  // that names no seller is refused, and one that names the fence gets the fake.
  {
    const pistolDefinition = parsedOrThrow(
      honesty((doc) => {
        const kit = doc.catalogs.find((catalog: { id: string }) => catalog.id === "kit");
        const pistol = kit.entries.find((entry: { id: string }) => entry.id === "watch-pistol").item;
        kit.entries.push({
          id: "rusty-pistol",
          label: "Rusty pistol",
          item: {
            category: "arm",
            slots: pistol.slots,
            passesFor: "kit/watch-pistol",
            cost: { amount: 1, unit: "shilling" },
          },
        });
        doc.items.lootTables.find((table: { id: string }) => table.id === "fences_lot").entries = [
          { item: "kit/rusty-pistol", weight: 1 },
        ];
      }),
    );
    const pistolBook = rulesetItemBook(pistolDefinition, entriesOf(pistolDefinition));
    const pistolMarket = () => rulesetMarketQuoter(pistolDefinition, pistolBook, town, () => true, undefined, day);
    const buyPistol = (tag: string) =>
      applyGameInventoryTags(tag, coins(50), party, undefined, pistolBook, undefined, undefined, pistolMarket());
    assert.equal(
      readResolvedInventoryTags(buyPistol('[inventory: action="buy" item="Watch pistol"]').content)[0]?.ok,
      false,
    );
    const fenced = buyPistol('[inventory: action="buy" item="Watch pistol" seller="fence"]');
    assert.equal(
      fenced.stacks.find((stack) => stack.item === "kit/watch-pistol")?.truly,
      "kit/rusty-pistol",
      fenced.content,
    );
  }

  // The Game Master sees the truth beside it.
  {
    const known = book.itemOf("kit/bitter-tonic")!;
    const text = buildGmFormatReminder({
      ruleset: definition,
      playerInventory: gameInventoryTotals(bought.stacks),
      inventoryItemFacts: { "kit/bitter-tonic": rulesetItemPromptFacts(known.facts) },
      inventoryFakeNames: { "kit/bitter-tonic": "Bitter tonic" },
    } as Parameters<typeof buildGmFormatReminder>[0]);
    assert.match(text, /Warming tonic[^\n]*\(FAKE: really Bitter tonic\)/);
    assert.match(text, /A line marked FAKE is not what the party thinks it is/);
  }

  // ── Found out ──
  {
    // A reveal: the stack becomes its true item. A reveal of something not held adds nothing.
    const revealed = run('[inventory: action="reveal" item="Warming tonic"]', bought.stacks);
    const [answer] = readResolvedInventoryTags(revealed.content);
    assert.deepEqual([answer?.ok, answer?.revealed], [true, "Bitter tonic"]);
    assert.deepEqual(
      revealed.stacks
        .filter((stack) => !stack.item?.startsWith("coin:"))
        .map((stack) => [stack.item, stack.quantity, stack.truly ?? null]),
      [["kit/bitter-tonic", 2, null]],
    );
    const nothing = run('[inventory: action="reveal" item="Bottled sunlight"]', bought.stacks);
    assert.equal(readResolvedInventoryTags(nothing.content)[0]?.ok, false);
    assert.equal(nothing.stacks.length, bought.stacks.length, "a reveal never adds");
    const real = run('[inventory: action="reveal" item="shillings"]', bought.stacks);
    assert.equal(readResolvedInventoryTags(real.content)[0]?.count, 0, "what is what it seems stays so");
  }
  {
    // Sold to the honest chandler: seen through, paid its true worth (1 penny, at half: still a penny).
    const sold = run('[inventory: action="sell" item="Warming tonic" count="1" seller="chandler"]', bought.stacks);
    const [answer] = readResolvedInventoryTags(sold.content);
    assert.deepEqual([answer?.ok, answer?.revealed, answer?.price], [true, "Bitter tonic", "1 pennies"]);
    assert.deepEqual(
      sold.stacks
        .filter((stack) => stack.item?.startsWith("kit/"))
        .map((stack) => [stack.item, stack.quantity, stack.truly ?? null]),
      [["kit/bitter-tonic", 1, null]],
    );
    // Sold to the fence: taken as what it seems, at a warming tonic's half price.
    const fenced = run('[inventory: action="sell" item="Warming tonic" count="1" seller="fence"]', bought.stacks);
    const [fenceAnswer] = readResolvedInventoryTags(fenced.content);
    assert.deepEqual([fenceAnswer?.ok, fenceAnswer?.revealed, fenceAnswer?.price], [true, undefined, "2 pennies"]);
    assert.ok(!leaks(fenced.content));
  }
  {
    // Bound, a fake is found out: a cursed ring that passed for the dawn bell, which the player
    // cannot take off again.
    const ringFake: GameInventoryStack[] = [
      { id: "r1", name: "Dawn bell", item: "kit/dawn-bell", quantity: 1, truly: "kit/hexed-ring", equipped: true },
    ];
    const bound = applyGameInventoryOps(ringFake, [{ op: "bind", id: "r1" }], undefined, { ...book, actor: "player" });
    assert.equal(bound.results[0]?.ok, true);
    assert.deepEqual(
      bound.stacks.map((stack) => [stack.item, stack.name, stack.bound ?? false, stack.truly ?? null]),
      [["kit/hexed-ring", "Hexed ring", true, null]],
    );
    const unbound = applyGameInventoryOps(bound.stacks, [{ op: "unbind", id: "r1" }], undefined, {
      ...book,
      actor: "player",
    });
    assert.equal(unbound.results[0]?.ok, false, "the curse holds it");
  }
  {
    // Used, a fake does what it truly does; a bitter tonic does nothing the rules work out, so it is
    // found out and the Game Master tells it.
    const user = gameInventoryItemUser(
      {
        definition,
        packageId: null,
        cards: [{ name: "Ada", build: defaultRulesetSheetBuild(definition) }],
        playerName: "Ada",
      },
      book.itemOf,
      {},
      1,
    );
    const tagged = applyGameInventoryTags(
      '[inventory: action="use" item="Warming tonic"]',
      bought.stacks,
      party,
      undefined,
      book,
      user.useItem,
    );
    const [answer] = readResolvedInventoryTags(tagged.content);
    assert.equal(answer?.revealed, "Bitter tonic", tagged.content);
    assert.ok(tagged.stacks.some((stack) => stack.item === "kit/bitter-tonic" && !stack.truly));
    // Its count is the bitter tonic's left, as its line says, never the warming tonic's.
    const left = tagged.stacks
      .filter((stack) => stack.item === "kit/bitter-tonic")
      .reduce((sum, stack) => sum + stack.quantity, 0);
    assert.ok(left > 0);
    assert.equal(answer?.now, left, tagged.content);
  }
  // ── A fake beside the real thing ──
  {
    const realTonic: GameInventoryStack = { id: "w1", name: "Warming tonic", item: "kit/warming-tonic", quantity: 1 };
    const fakeTonic: GameInventoryStack = { ...fake, id: "w2" };
    const realFirst = [...coins(5), realTonic, fakeTonic];
    const fakeFirst = [...coins(5), fakeTonic, realTonic];
    const tonics = (stacks: GameInventoryStack[]) =>
      stacks
        .filter((stack) => stack.item?.startsWith("kit/"))
        .map((stack) => [stack.id, stack.item, stack.quantity, stack.truly ?? null]);

    // A reveal by name finds the fake, though the real one comes first.
    const revealed = run('[inventory: action="reveal" item="Warming tonic"]', realFirst);
    assert.equal(readResolvedInventoryTags(revealed.content)[0]?.revealed, "Bitter tonic", revealed.content);
    assert.deepEqual(tonics(revealed.stacks), [
      ["w1", "kit/warming-tonic", 1, null],
      ["w2", "kit/bitter-tonic", 2, null],
    ]);

    // A sale takes only the kind it was priced by, never the fake with the real thing: a count past
    // the real one sells it, then offers the fake on its own, which the honest buyer sees through and
    // buys for what it truly is.
    const mixed = run('[inventory: action="sell" item="Warming tonic" count="2" seller="chandler"]', realFirst);
    const mixedAnswers = readResolvedInventoryTags(mixed.content);
    assert.deepEqual(
      mixedAnswers.map((answer) => [answer.ok, answer.count, answer.revealed ?? null]),
      [
        [true, 1, null],
        [true, 1, "Bitter tonic"],
      ],
      mixed.content,
    );
    assert.deepEqual(tonics(mixed.stacks), [["w2", "kit/bitter-tonic", 1, null]], "the real one sold, the fake seen");
    // Nor the real thing with the fake: seen through, the fake alone is what the honest buyer prices.
    const seen = run('[inventory: action="sell" item="Warming tonic" count="3" seller="chandler"]', fakeFirst);
    assert.deepEqual(
      readResolvedInventoryTags(seen.content).map((answer) => [answer.ok, answer.count, answer.revealed ?? null]),
      [
        [true, 2, "Bitter tonic"],
        [true, 1, null],
      ],
      seen.content,
    );
    assert.deepEqual(tonics(seen.stacks), []);
    // The fence takes the fake it was offered and leaves the real one.
    const fenced = run('[inventory: action="sell" item="Warming tonic" count="2" seller="fence"]', fakeFirst);
    assert.equal(readResolvedInventoryTags(fenced.content)[0]?.ok, true, fenced.content);
    assert.deepEqual(tonics(fenced.stacks), [["w1", "kit/warming-tonic", 1, null]]);
    // A count past one kind is sold kind by kind, each priced on its own: the fence buys all three.
    const both = run('[inventory: action="sell" item="Warming tonic" count="3" seller="fence"]', fakeFirst);
    const answers = readResolvedInventoryTags(both.content);
    assert.deepEqual(
      answers.map((answer) => [answer.ok, answer.count]),
      [
        [true, 2],
        [true, 1],
      ],
      both.content,
    );
    assert.deepEqual(tonics(both.stacks), []);

    // A sale is about the stack the take takes first: a worn real bell comes after the fake in the
    // pack, so the honest buyer is offered the fake and sees through it, and the worn bell stays.
    const bells: GameInventoryStack[] = [
      ...coins(5),
      { id: "b1", name: "Dawn bell", item: "kit/dawn-bell", quantity: 1, equipped: true },
      { id: "b2", name: "Dawn bell", item: "kit/dawn-bell", quantity: 1, truly: "kit/hexed-ring" },
    ];
    const bellDefinition = parsedOrThrow(
      honesty((doc) =>
        doc.items.market.sellers
          .find((seller: { id: string }) => seller.id === "chandler")
          .sells.push({ category: "token" }),
      ),
    );
    const bellBook = rulesetItemBook(bellDefinition, entriesOf(bellDefinition));
    const bellSale = applyGameInventoryTags(
      '[inventory: action="sell" item="Dawn bell" count="1" seller="chandler"]',
      bells,
      party,
      undefined,
      bellBook,
      undefined,
      undefined,
      rulesetMarketQuoter(bellDefinition, bellBook, town, () => true, undefined, day),
    );
    assert.equal(readResolvedInventoryTags(bellSale.content)[0]?.revealed, "Hexed ring", bellSale.content);
    assert.deepEqual(
      bellSale.stacks.find((stack) => stack.id === "b1"),
      bells[1],
      "the worn bell is not sold in the fake's place",
    );
    // A fight lists the fake as what it passes for, on the real one's line: one line, no number.
    const fight = gameFightItems(realFirst, book, true, []);
    const tonicLines = fight.lines.filter((line) => line.item === "kit/warming-tonic");
    assert.deepEqual(
      tonicLines.map((line) => [line.name, line.quantity, line.truly ?? null]),
      [["Warming tonic", 3, null]],
      JSON.stringify(fight.lines),
    );
    // Held fake first, the line still carries no truth.
    assert.deepEqual(
      gameFightItems(fakeFirst, book, true, [])
        .lines.filter((line) => line.item === "kit/warming-tonic")
        .map((line) => [line.name, line.quantity, line.truly ?? null]),
      [["Warming tonic", 3, null]],
    );
    // Its uses come out of the stacks in the order a take takes them; one out of the fake does what the
    // fake truly does, which for a bitter tonic is nothing, and says so.
    assert.deepEqual(
      [0, 1, 2, 3].map((nth) => gameInventoryFightSpendStack(realFirst, "Warming tonic", book, nth)?.id ?? null),
      ["w1", "w2", "w2", null],
    );
    // Only from a stack the item may be used from: a fake bell in the pack is passed over for the real
    // one worn and bound.
    assert.equal(
      gameInventoryFightSpendStack(
        [
          { id: "b-fake", name: "Dawn bell", item: "kit/dawn-bell", quantity: 1, truly: "kit/hexed-ring" },
          { id: "b-real", name: "Dawn bell", item: "kit/dawn-bell", quantity: 1, equipped: true, bound: true },
        ],
        "Dawn bell",
        book,
      )?.id,
      "b-real",
    );
    const tonicEffect = fight.effects.find((effect) => effect.name === "Warming tonic")!;
    assert.equal(gameFightUseEffect(tonicEffect, realTonic, book), tonicEffect);
    assert.match(gameFightUseEffect(tonicEffect, fakeTonic, book).failed ?? "", /really Bitter tonic/);
    // Spent, the fake is written by its true name and the answer says what it was; lost, it is not.
    const drunk = applyGameInventoryOps(
      fakeFirst,
      [{ op: "take", name: "Warming tonic", count: 3, as: "used", worn: true }],
      undefined,
      book,
    );
    assert.deepEqual(drunk.results[0]?.revealed, ["Bitter tonic"]);
    assert.deepEqual(drunk.journal.map((entry) => [entry.item, entry.action, entry.quantity]).sort(), [
      ["Bitter tonic", "used", 2],
      ["Warming tonic", "used", 1],
    ]);
    const lost = applyGameInventoryOps(
      fakeFirst,
      [{ op: "take", name: "Warming tonic", count: 3, as: "lost" }],
      undefined,
      book,
    );
    assert.equal(lost.results[0]?.revealed, undefined);
    assert.ok(!lost.journal.some((entry) => leaks(entry.item)));
  }
  {
    // A use that finds a fake out ends there: the rest of the count is not drunk from the real one.
    const user = gameInventoryItemUser(
      {
        definition,
        packageId: null,
        cards: [{ name: "Ada", build: defaultRulesetSheetBuild(definition) }],
        playerName: "Ada",
      },
      book.itemOf,
      {},
      1,
    );
    const stacks: GameInventoryStack[] = [
      { ...fake, id: "w2", quantity: 1 },
      { id: "w1", name: "Warming tonic", item: "kit/warming-tonic", quantity: 1 },
    ];
    const tagged = applyGameInventoryTags(
      '[inventory: action="use" item="Warming tonic" count="2"]',
      stacks,
      party,
      undefined,
      book,
      user.useItem,
    );
    assert.equal(readResolvedInventoryTags(tagged.content)[0]?.revealed, "Bitter tonic", tagged.content);
    assert.equal(tagged.stacks.find((stack) => stack.id === "w1")?.quantity, 1, tagged.content);
  }
  {
    // A bind the Game Master writes finds a fake out too, and the curse then holds it.
    const ringFake: GameInventoryStack[] = [
      { id: "r1", name: "Dawn bell", item: "kit/dawn-bell", quantity: 1, truly: "kit/hexed-ring", equipped: true },
    ];
    const rules = { ...book, actor: "player" as const };
    const bound = applyGameInventoryTags(
      '[inventory: action="bind" item="Dawn bell"]',
      ringFake,
      party,
      undefined,
      rules,
    );
    const [answer] = readResolvedInventoryTags(bound.content);
    assert.deepEqual([answer?.ok, answer?.revealed], [true, "Hexed ring"], bound.content);
    assert.deepEqual(
      bound.stacks.map((stack) => [stack.item, stack.bound ?? false, stack.truly ?? null]),
      [["kit/hexed-ring", true, null]],
    );
    const unbound = applyGameInventoryOps(bound.stacks, [{ op: "unbind", id: "r1" }], undefined, rules);
    assert.equal(unbound.results[0]?.ok, false, "the curse holds it");
  }
  // A client op can never make a fake: the strict schema refuses `truly`.
  {
    const { gameInventoryOpSchema } = await import("../../packages/shared/src/index.js");
    assert.equal(
      gameInventoryOpSchema.safeParse({
        op: "add",
        name: "Warming tonic",
        item: "kit/warming-tonic",
        count: 1,
        truly: "kit/bitter-tonic",
      }).success,
      false,
    );
  }

  console.log(
    "Seller honesty: schema and gate, honest and dishonest stock, fakes that hold, and every way one is found out.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
