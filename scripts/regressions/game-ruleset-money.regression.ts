/**
 * Money (#6901, Capability API 1.64).
 *
 *   - A ruleset's coins are inventory stacks (`coin:<unit>`), read by the item book: a weight from the
 *     family's `perWeight`, found by id or label, one or many.
 *   - The Game Master's `[inventory: action="pay"]` pays out of one bag inside one family, with change;
 *     `action="earn"` adds the coin.
 *   - The Game Master sees each bag's worth, an item's cost, and the pay and earn line only where the
 *     ruleset has coins.
 *   - A layer hides coins the way it hides catalog entries: the ruleset keeps them, so a price in one
 *     keeps its worth in the coins left, and the layer is never dropped for it.
 *   - A loot line may drop coins.
 *   - Checked at import, gated at 1.64.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  GAME_INVENTORY_ITEM_REF_PATTERN,
  applyGameInventoryTags,
  gameInventoryBagKey,
  gameInventoryCoinWorth,
  gameInventoryLoad,
  parseRulesetDefinition,
  payGameInventoryCoins,
  resolveRulesetLayers,
  rollRulesetLootTable,
  rulesetItemBook,
  rulesetItemPromptFacts,
  rulesetLayeredCurrencies,
  rulesetPurseText,
  type GameInventoryStack,
  type RulesetCatalogEntry,
  type RulesetDefinition,
} from "../../packages/shared/src/index.js";

const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");
const { buildGmFormatReminder } = await import("../../packages/server/src/services/game/gm-prompts.js");

const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
const gravewatchText = read("../../docs/examples/rulesets/gravewatch.json");
const emberText = read("../../docs/examples/rulesets/ember-roads.json");
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
  const parsed = parseRulesetDefinition(variant(gravewatchText, edit));
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
/** A die that answers from a list, then keeps giving its last answer. */
const dice = (...faces: number[]) => {
  let at = 0;
  return (sides: number) => Math.min(sides, faces[Math.min(at++, faces.length - 1)]!);
};
const coins = (entries: Array<[name: string, unit: string, quantity: number, holder?: string]>): GameInventoryStack[] =>
  entries.map(([name, unit, quantity, holder], index) => ({
    id: `c${index}`,
    name,
    item: `coin:${unit}`,
    quantity,
    ...(holder ? { holder } : {}),
  }));
const held = (stacks: readonly GameInventoryStack[]) =>
  stacks.map((stack) => [stack.name, stack.quantity, stack.holder ?? ""]);

const gravewatch = parsedOrThrow(JSON.parse(gravewatchText), "Gravewatch");
const ember = parsedOrThrow(JSON.parse(emberText), "Ember Roads");
const graveBook = rulesetItemBook(gravewatch, entriesOf(gravewatch));
const emberBook = rulesetItemBook(ember, entriesOf(ember));
const night = { "layer.long_night": true };
/** Gravewatch without its market, which is 1.65's and has a lane of its own. */
const withoutMarket = (doc: Record<string, any>) => {
  delete doc.items?.market;
  for (const catalog of doc.catalogs ?? []) {
    for (const entry of catalog.entries ?? []) {
      delete entry.item?.sold;
      delete entry.item?.service;
    }
  }
  return doc;
};

// ── Import ──
{
  const coinLine = gravewatch.items?.lootTables?.[0]?.entries.at(-1);
  assert.equal(coinLine?.coins, "shilling", "the grave goods drop shillings");
  assert.deepEqual(gravewatch.layers?.[0]?.currencies, { removeUnits: ["crown"] });
  const line = (entry: Record<string, unknown>) => (doc: Record<string, any>) =>
    (doc.items.lootTables[0].entries[0] = entry);
  refused(line({ coins: "florin" }), /entries\.0\.coins: Unknown currency unit "florin"/, "a coin nobody has");
  refused(
    line({ coins: "penny", item: "kit/grave-spade" }),
    /an item, a filter or coins, one of them/,
    "coins and an item",
  );
  refused(
    line({ coins: "penny", filter: { tag: "silver" } }),
    /an item, a filter or coins, one of them/,
    "coins and a filter",
  );
  refused(line({ weight: 2 }), /an item, a filter or coins, one of them/, "none of them");
  const layer = (currencies: Record<string, unknown>) => (doc: Record<string, any>) =>
    (doc.layers[0].currencies = currencies);
  refused(layer({ removeUnits: ["florin"] }), /currencies\.removeUnits\.0: Unknown currency unit "florin"/, "a unit");
  refused(layer({ removeFamilies: ["salt"] }), /currencies\.removeFamilies\.0: Unknown currency "salt"/, "a family");
  refused(
    layer({ removeUnits: ["penny"] }),
    /"penny" is the smallest coin of "coin", which goes only with its whole family/,
    "the smallest coin alone",
  );
  refused(layer({}), /take out coins \(removeUnits\) or families/, "a removal of nothing");
  refused(layer({ removeUnits: [] }), /removeUnits/, "an empty list");
  parsedOrThrow(
    variant(gravewatchText, layer({ removeUnits: ["penny"], removeFamilies: ["coin"] })),
    "the smallest coin with its family",
  );
}

// ── Install gate: 1.64 ──
{
  const manifest = (minor: number) => ({
    schemaVersion: 2,
    capabilityApi: { major: 1, minor },
    builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
    id: "ruleset-money",
    name: "Money",
    version: "0.1.0",
    description: "A packaged ruleset with money.",
    engine: { min: "2.4.6", maxExclusive: "4.0.0" },
    kind: ["ruleset"],
    entrypoints: {},
    contributions: { assets: { paths: ["ruleset.json"] } },
    files: [{ path: "ruleset.json", sha256: "0".repeat(64), bytes: 10 }],
    permissions: [],
    restartRequired: false,
  });
  const gateIssue = /layers remove coins, or whose loot tables drop coins.*capabilityApi 1\.64/;
  const issue = (minor: number, doc: Record<string, any>) =>
    getCapabilityPackageInstallIssue(manifest(minor) as any, withoutMarket(doc));
  const noLayerCoins = (doc: Record<string, any>) => delete doc.layers[0].currencies;
  const noLootCoins = (doc: Record<string, any>) =>
    (doc.items.lootTables[0].entries = doc.items.lootTables[0].entries.filter((entry: any) => !entry.coins));
  assert.match(issue(63, variant(gravewatchText)) ?? "", gateIssue);
  assert.equal(issue(64, variant(gravewatchText)), null);
  assert.match(issue(63, variant(gravewatchText, noLayerCoins)) ?? "", gateIssue, "a coin loot line alone");
  assert.match(issue(63, variant(gravewatchText, noLootCoins)) ?? "", gateIssue, "a layer's coins alone");
  assert.equal(
    issue(
      63,
      variant(gravewatchText, (doc) => (noLayerCoins(doc), noLootCoins(doc))),
    ),
    null,
    "the rest of the example stays 1.63",
  );
}

// ── Coins are stacks the book reads ──
{
  assert.ok(GAME_INVENTORY_ITEM_REF_PATTERN.test("coin:penny"));
  assert.ok(!GAME_INVENTORY_ITEM_REF_PATTERN.test("coin:"), "a coin needs a unit");
  assert.ok(!GAME_INVENTORY_ITEM_REF_PATTERN.test("coin:Penny"), "a unit id is lower case");
  assert.deepEqual(
    graveBook.coins.map((coin) => [coin.item, coin.name, coin.coin?.value]),
    [
      ["coin:penny", "pennies", 1],
      ["coin:shilling", "shillings", 12],
      ["coin:crown", "crowns", 60],
    ],
  );
  // Weight is the family's perWeight: a hundred of Ember's coins weigh one bulk, ten pinches of salt.
  assert.equal(emberBook.itemOf("coin:bit")?.weight, 0.01);
  assert.equal(emberBook.itemOf("coin:pinch")?.weight, 0.1);
  assert.equal(graveBook.itemOf("coin:penny")?.weight, undefined, "a family without perWeight weighs nothing");
  assert.equal(
    gameInventoryLoad(coins([["sovereigns", "sovereign", 300]]), undefined, emberBook),
    3,
    "coins count toward the load",
  );
  // Found by id or label, one or many, in any case.
  for (const name of ["penny", "pennies", "Penny", "PENNIES"]) {
    assert.equal(graveBook.coinNamed?.(name)?.coin.item, "coin:penny", name);
  }
  assert.equal(graveBook.coinNamed?.("shilling")?.coin.value, 12);
  // A coin whose id is not its name is found by either, its name one of it or many.
  const pence = parsedOrThrow(JSON.parse(gravewatchText.replaceAll('"penny"', '"d"')), "Gravewatch with pence as d");
  const penceBook = rulesetItemBook(pence, entriesOf(pence));
  for (const name of ["d", "penny", "Pennies"]) assert.equal(penceBook.coinNamed?.(name)?.coin.item, "coin:d", name);
  assert.equal(graveBook.coinNamed?.("florins"), undefined);
  assert.deepEqual(
    graveBook.coinNamed?.("crown")?.family.map((coin) => coin.item),
    ["coin:crown", "coin:shilling", "coin:penny"],
    "the family, largest first",
  );
  assert.equal(graveBook.itemNamed("shillings")?.item, "coin:shilling", "a name finds a coin");
  assert.equal(graveBook.offers?.("coin:crown"), true);
  assert.equal(emberBook.coinNamed?.("cakes")?.family.length, 2, "salt is its own family");
}

// ── Paying ──
{
  const family = graveBook.coinNamed!("penny")!.family;
  const pay = (stacks: GameInventoryStack[], owed: number, holder?: string) => {
    const paid = payGameInventoryCoins(stacks, holder, family, owed);
    return paid.ok ? { stacks: held(paid.stacks), paid: paid.paid, change: paid.change } : paid.reason;
  };
  const purse = coins([
    ["crowns", "crown", 3],
    ["shillings", "shilling", 30],
  ]);
  assert.equal(gameInventoryCoinWorth(purse, undefined, family), 540);
  // The largest coins that fit first: 5 crowns' worth is the 3 crowns and 10 of the shillings.
  assert.deepEqual(pay(purse, 300), {
    stacks: [["shillings", 20, ""]],
    paid: [
      { name: "crowns", count: 3 },
      { name: "shillings", count: 10 },
    ],
    change: [],
  });
  // What is still owed breaks the smallest coin that covers it, and the change comes back smaller.
  assert.deepEqual(pay(coins([["crowns", "crown", 1]]), 36), {
    stacks: [["shillings", 2, ""]],
    paid: [{ name: "crowns", count: 1 }],
    change: [{ name: "shillings", count: 2 }],
  });
  assert.deepEqual(pay(coins([["crowns", "crown", 1]]), 13), {
    stacks: [
      ["shillings", 3, ""],
      ["pennies", 11, ""],
    ],
    paid: [{ name: "crowns", count: 1 }],
    change: [
      { name: "shillings", count: 3 },
      { name: "pennies", count: 11 },
    ],
  });
  // A shilling is broken before a crown when a shilling covers what is left.
  assert.deepEqual(
    pay(
      coins([
        ["crowns", "crown", 1],
        ["shillings", "shilling", 1],
      ]),
      5,
    ),
    {
      stacks: [
        ["crowns", 1, ""],
        ["pennies", 7, ""],
      ],
      paid: [{ name: "shillings", count: 1 }],
      change: [{ name: "pennies", count: 7 }],
    },
  );
  // Paid out of one bag only; another's coins and another family never pay.
  const mixed = coins([
    ["shillings", "shilling", 1, "Bram"],
    ["pennies", "penny", 5],
  ]);
  assert.equal(pay(mixed, 12), "cannot-afford", "Bram's shilling is not the player's");
  assert.deepEqual(pay(mixed, 12, "Bram"), {
    stacks: [["pennies", 5, ""]],
    paid: [{ name: "shillings", count: 1 }],
    change: [],
  });
  // The same coin in two bags: only the payer's is taken, whichever stack comes first.
  const twoBags = payGameInventoryCoins(
    coins([
      ["shillings", "shilling", 3],
      ["shillings", "shilling", 1, "Bram"],
    ]),
    "Bram",
    family,
    12,
  );
  assert.ok(twoBags.ok);
  assert.deepEqual(held(twoBags.stacks), [["shillings", 3, ""]]);
  const bramChange = payGameInventoryCoins(mixed, "Bram", family, 5);
  assert.ok(bramChange.ok);
  assert.deepEqual(
    bramChange.stacks.find((stack) => stack.name === "pennies" && stack.holder === "Bram")?.quantity,
    7,
    "change goes into the payer's own bag",
  );
  const salted = coins([["cakes", "cake", 5]]);
  const coinFamily = emberBook.coinNamed!("bit")!.family;
  assert.equal(payGameInventoryCoins(salted, undefined, coinFamily, 1).ok, false, "salt never pays in coin");
  // Change comes back in the coins prices are written in, where they make it (laptop pass 6,
  // 2026-10-26: an inn's 5 silver out of a gold piece came back as an electrum piece).
  const srdCoins = [
    { item: "coin:gp", name: "gold pieces", value: 100 },
    { item: "coin:ep", name: "electrum pieces", value: 50 },
    { item: "coin:sp", name: "silver pieces", value: 10 },
    { item: "coin:cp", name: "copper pieces", value: 1 },
  ];
  const oneGold = [{ id: "g", name: "gold pieces", item: "coin:gp", quantity: 1 }];
  const back = (changeIn?: string[]) => {
    const paid = payGameInventoryCoins(oneGold, undefined, srdCoins, 50, changeIn);
    return paid.ok ? paid.change : paid.reason;
  };
  assert.deepEqual(back(), [{ name: "electrum pieces", count: 1 }]);
  assert.deepEqual(back(["coin:gp", "coin:sp", "coin:cp"]), [{ name: "silver pieces", count: 5 }]);
  // Where the usual coins cannot make it, any coin does.
  assert.deepEqual(back(["coin:gp", "coin:sp"]), [{ name: "silver pieces", count: 5 }]);
  assert.deepEqual(back(["coin:gp"]), [{ name: "electrum pieces", count: 1 }]);
  assert.equal(pay([], 0 + 1), "cannot-afford");
}

// ── who="party" pays out of every purse, the player's first (laptop playtest 2026-10-25: "the
//    party's coin" charged only one purse) ──
{
  const party = { members: ["Bram"] };
  const both = coins([
    ["shillings", "shilling", 1],
    ["shillings", "shilling", 2, "Bram"],
  ]);
  const together = applyGameInventoryTags(
    '[inventory: action="pay" amount="3 shillings" who="party"]',
    both,
    party,
    undefined,
    graveBook,
  );
  assert.match(together.content, /action="pay" item="shillings" count="3" who="party" result="ok"/, together.content);
  assert.deepEqual(held(together.stacks), []);
  const alone = applyGameInventoryTags(
    '[inventory: action="pay" amount="3 shillings"]',
    both,
    party,
    undefined,
    graveBook,
  );
  assert.match(alone.content, /reason="cannot-afford"/, "the player alone cannot");
}

// ── The Game Master's pay and earn ──
{
  const party = { members: ["Bram"] };
  const answered = (text: string, stacks: GameInventoryStack[] = [], rules = graveBook) =>
    applyGameInventoryTags(text, stacks, party, undefined, rules);
  const start = coins([
    ["crowns", "crown", 1],
    ["shillings", "shilling", 1, "Bram"],
  ]);
  const told = answered(
    'He pays. [inventory: action="pay" amount="3 shillings"] [inventory: action="earn" amount="12 pennies" who="Bram"] ' +
      '[inventory: pay amount="1 crown"] [inventory: action="pay" item="penny" count="4" who="Bram"]',
    start,
  );
  assert.match(
    told.content,
    /\[inventory: action="pay" item="shillings" count="3" result="ok" now="2" note="Paid with crowns ×1; shillings ×2 back\."\]/,
  );
  assert.match(told.content, /\[inventory: action="earn" item="pennies" count="12" who="Bram" result="ok" now="12"\]/);
  assert.match(
    told.content,
    /\[inventory: action="pay" item="crowns" count="1" result="refused" reason="cannot-afford"\]/,
    "the crown is spent, and a bare pay reads",
  );
  assert.match(
    told.content,
    /\[inventory: action="pay" item="pennies" count="4" who="Bram" result="ok" now="8" note="Paid with pennies ×4\."\]/,
    "an item and a count read as an amount; the shilling stays whole",
  );
  assert.deepEqual(held(told.stacks).sort(), [
    ["pennies", 8, "Bram"],
    ["shillings", 1, "Bram"],
    ["shillings", 2, ""],
  ]);
  assert.deepEqual(told.journal, [
    { item: "crowns", action: "used", quantity: 1 },
    { item: "shillings", action: "acquired", quantity: 2 },
    { item: "pennies", action: "acquired", quantity: 12 },
    { item: "pennies", action: "used", quantity: 4 },
  ]);
  // What a bag adds after its payment was refused is refused too, unless it says where it came from
  // (laptop room playtest 2026-10-30: tools came into the bag after "cannot-afford").
  const unpaid = answered(
    '[inventory: action="pay" amount="9 crowns"] [inventory: action="add" item="Rope"] ' +
      '[inventory: action="add" item="Torch" source="story"] [inventory: action="add" item="Lamp" who="Bram"]',
    start,
  );
  assert.match(unpaid.content, /item="Rope" count="1" result="refused" reason="unpaid"/, unpaid.content);
  assert.match(unpaid.content, /item="Torch" count="1" result="ok"/, unpaid.content);
  assert.match(unpaid.content, /item="Lamp" count="1" who="Bram" result="ok"/, "another bag's add is its own");
  // What a bag adds after a check it failed, in the same reply, it made or found on a roll it lost
  // (laptop room playtest 2026-10-30: a pouch out of a failed leatherworking check).
  const lost = answered(
    '[inventory: action="add" item="Lamp" who="Bram"] ' +
      '[skill_check: skill="Leatherworker\'s tools" dc="12" who="Bram" rolls="7" modifier="0" total="7" result="failure"] ' +
      '[inventory: action="add" item="Rope" who="Bram"] [inventory: action="add" item="Torch"] ' +
      '[inventory: action="add" item="Lantern" who="Bram" source="story"]',
  );
  assert.match(lost.content, /item="Lamp" count="1" who="Bram" result="ok"/, "an add before the roll stands");
  assert.match(lost.content, /item="Rope" count="1" who="Bram" result="refused" reason="check-failed"/, lost.content);
  assert.match(lost.content, /item="Torch" count="1" result="ok"/, "another bag's add is its own");
  assert.match(lost.content, /item="Lantern" count="1" who="Bram" result="ok"/, "a source stands");
  const won = answered(
    '[skill_check: skill="Leatherworker\'s tools" dc="12" who="Bram" rolls="17" modifier="0" total="17" result="success"] ' +
      '[inventory: action="add" item="Rope" who="Bram"]',
  );
  assert.match(won.content, /item="Rope" count="1" who="Bram" result="ok"/, won.content);
  assert.equal(
    answered('[inventory: action="pay" amount="2 florins"]').content,
    '[inventory: action="pay" item="florins" count="2" result="refused" reason="unknown-coin"]',
  );
  assert.equal(
    applyGameInventoryTags('[inventory: action="earn" amount="3 shillings"]', [], party).content,
    '[inventory: action="earn" item="shillings" count="3" result="refused" reason="no-currencies"]',
    "no ruleset coins, no money",
  );
  assert.equal(
    answered('[inventory: action="earn" amount="3 shillings" who="Cora"]').content,
    '[inventory: action="earn" item="shillings" count="3" who="Cora" result="refused" reason="unknown-character"]',
  );
  // Coins come by the thousand: an amount is held only to what one stack may hold.
  assert.match(
    answered('[inventory: action="earn" amount="50000 pennies"]').content,
    /count="50000" result="ok" now="50000"/,
  );
  // An earning with nobody named goes where an add would: the player's bag first.
  assert.deepEqual(held(answered('[inventory: action="earn" amount="3 shillings"]').stacks), [["shillings", 3, ""]]);
}

// ── What the Game Master sees ──
{
  const purse = coins([
    ["crowns", "crown", 1],
    ["pennies", "penny", 12],
    ["cakes", "cake", 1, "Bram"],
  ]);
  assert.equal(rulesetPurseText(graveBook, purse, undefined), "Coin worth 72 pennies");
  // An empty purse is said, or the Game Master narrates a buy the Engine then refuses.
  assert.equal(rulesetPurseText(graveBook, purse, "Bram"), "no coins");
  // Worth is said in the smallest coin, wherever the family lists it.
  const reversed = parsedOrThrow(
    variant(gravewatchText, (doc) => doc.items.currencies[0].units.reverse()),
    "Gravewatch's coins listed largest first",
  );
  assert.equal(
    rulesetPurseText(rulesetItemBook(reversed, entriesOf(reversed)), purse, undefined),
    "Coin worth 72 pennies",
  );
  assert.equal(
    rulesetPurseText(
      emberBook,
      coins([
        ["sovereigns", "sovereign", 1],
        ["cakes", "cake", 2],
        ["pinches", "pinch", 3],
      ]),
      undefined,
    ),
    "Coin worth 100 bits, Salt worth 43 pinches",
  );
  const pistol = graveBook.entries.find((entry) => entry.item === "kit/watch-pistol")!;
  assert.match(rulesetItemPromptFacts(pistol.facts), /costs 3 crowns/);
  const reminder = (definition: RulesetDefinition, extra: Record<string, unknown> = {}) =>
    buildGmFormatReminder({ hasSceneModel: true, ruleset: definition, ...extra } as never);
  assert.match(
    reminder(gravewatch),
    /\[inventory: action="pay" amount="5 crowns" who="Name"\] and \[inventory: action="earn" amount="12 pennies" who="Name"\].*\(Coin: crowns, shillings, pennies\)/,
  );
  assert.match(reminder(ember), /Coin: sovereigns, marks, bits; Salt: /);
  const coinless = parsedOrThrow(
    variant(gravewatchText, (doc) => {
      delete doc.items.currencies;
      delete doc.layers;
      doc.items.lootTables[0].entries = doc.items.lootTables[0].entries.filter((entry: any) => !entry.coins);
      for (const catalog of doc.catalogs) for (const entry of catalog.entries ?? []) delete entry.item?.cost;
      // Nothing is sold without coins: the market and its services go with them.
      withoutMarket(doc);
    }),
    "Gravewatch without coins",
  );
  assert.doesNotMatch(reminder(coinless), /action="pay"/);
  assert.equal(
    rulesetPurseText(rulesetItemBook(coinless, entriesOf(coinless)), purse, undefined),
    "",
    "no money at all",
  );
  // Each bag's worth beside it.
  assert.match(
    reminder(gravewatch, {
      playerInventory: [{ name: "crowns", quantity: 1 }],
      partyInventory: [{ items: [{ name: "crowns", quantity: 1 }] }],
      inventoryPurses: { "": "Coin worth 60 pennies" },
    }),
    /PLAYER INVENTORY \(Coin worth 60 pennies\): crowns\nParty members not listed carry nothing, coins included\./,
  );
  // With money in the game, an empty bag is still listed with its empty purse, and so is the player's
  // in a party where only others carry anything.
  assert.match(
    reminder(gravewatch, { playerInventory: [], partyInventory: [], inventoryPurses: { "": "no coins" } }),
    /\nPLAYER INVENTORY \(no coins\): nothing\nParty members not listed carry nothing, coins included\./,
  );
  assert.match(
    reminder(gravewatch, {
      playerName: "Ada",
      playerInventory: [],
      partyInventory: [{ holder: "Bram", items: [{ name: "cakes", quantity: 2 }] }],
      inventoryPurses: { "": "no coins", [gameInventoryBagKey("Bram")]: "no coins" },
    }),
    /\nPARTY INVENTORY:\n- Ada \(no coins\): nothing\n- Bram \(no coins\): cakes ×2\nParty members not listed carry nothing, coins included\./,
  );
  // A game without money says nothing of an empty bag, as before.
  assert.doesNotMatch(
    reminder(coinless, { playerInventory: [], partyInventory: [] }),
    /INVENTORY|Party members not listed/,
  );
  const lampOnly = reminder(coinless, { playerInventory: [{ name: "Lamp", quantity: 1 }], partyInventory: [] });
  assert.match(lampOnly, /\nPLAYER INVENTORY: Lamp\n/);
  assert.doesNotMatch(lampOnly, /Party members not listed/, "nor of anyone else's coins");
  // With a party and one bag, the bag is the whole party's: nobody has a pack of their own to pull a
  // torch out of, an item the pack does not list is not there, and its purse is the only money.
  const potions = { playerInventory: [{ name: "Potion of Healing", quantity: 2 }], partyInventory: [] };
  const directed = reminder(gravewatch, {
    ...potions,
    partyNames: ["Kesh", "Mara"],
    playerIsParty: true,
    inventoryPurses: { "": "Coin worth 60 pennies" },
  });
  assert.match(
    directed,
    /\nPARTY PACK \(Coin worth 60 pennies\) - the party's one shared pack, everything the party carries: Potion of Healing ×2\nNo member has a bag, pouch or gear of their own beyond this pack and what their sheet says they wear\. Its purse is the party's only money\. An item the pack does not list does not exist: if the player reaches for one, say in the story that it isn't there, and write no tag for it\./,
  );
  assert.doesNotMatch(directed, /PLAYER INVENTORY|Party members not listed/);
  const ownCharacter = reminder(coinless, { ...potions, playerName: "Ada", partyNames: ["Kesh"] });
  assert.match(
    ownCharacter,
    /\nAda's PACK - the only bag in the party, everything the party carries: Potion of Healing ×2\nNobody else in the party has a bag, pouch or gear of their own beyond this pack and what their sheet says they wear\. An item/,
  );
  assert.doesNotMatch(ownCharacter, /only money/, "no money, no purse to speak of");
  assert.match(
    reminder(coinless, potions),
    /\nPLAYER INVENTORY: Potion of Healing ×2\n/,
    "alone, the bag is as it was",
  );
  // With sheets shown, nobody makes light, fire or an item out of an ability the sheet does not give them.
  const abilities =
    /Nor can anyone do what their sheet doesn't list: no spell, breath or trick makes light, fire or an item unless the sheet has it, and a limited one \(a power with uses per day\) is spent with its \[sheet:\] tag\./;
  assert.doesNotMatch(ownCharacter, abilities, "no sheets, nothing to hold an ability to");
  const sheeted = { rulesetSheetBlocks: ["Kesh: HP 38/38"] };
  assert.match(reminder(coinless, { ...potions, ...sheeted, playerName: "Ada", partyNames: ["Kesh"] }), abilities);
  assert.match(
    reminder(gravewatch, {
      ...sheeted,
      playerName: "Ada",
      partyNames: ["Bram"],
      playerInventory: [],
      partyInventory: [{ holder: "Bram", items: [{ name: "cakes", quantity: 2 }] }],
      inventoryPurses: { "": "no coins", [gameInventoryBagKey("Bram")]: "no coins" },
    }),
    /coins included\.\nNor can anyone do what their sheet doesn't list/,
  );
}

// ── Layers hide coins, never rewrite them ──
{
  // The long night takes the crown out, and two kit items are priced in crowns: the layer still applies.
  const layered = resolveRulesetLayers(gravewatch, night);
  assert.deepEqual(
    layered.applied.map((layer) => layer.id),
    ["long_night"],
    "a price in a coin a layer hides never costs the game the layer",
  );
  assert.deepEqual(
    layered.definition.items?.currencies?.[0]?.units.map((unit) => unit.id),
    ["penny", "shilling", "crown"],
    "the ruleset keeps every coin",
  );
  assert.deepEqual(
    rulesetLayeredCurrencies(layered.definition, night).map((family) => family.units.map((unit) => unit.id)),
    [["penny", "shilling"]],
  );
  assert.deepEqual(rulesetLayeredCurrencies(gravewatch, {}), gravewatch.items?.currencies);
  const book = rulesetItemBook(layered.definition, entriesOf(layered.definition), { layerOptions: night });
  assert.deepEqual(
    book.coins.map((coin) => coin.item),
    ["coin:penny", "coin:shilling"],
  );
  assert.equal(book.coinNamed?.("crown"), undefined, "nobody pays or earns in crowns");
  assert.equal(book.itemOf("coin:crown")?.name, "crowns", "crowns already held still read as crowns");
  assert.equal(book.offers?.("coin:crown"), false, "and none are added");
  // A price in crowns is said at the same worth in the largest coin left that pays it exactly.
  const cost = (item: string) => book.entries.find((entry) => entry.item === item)?.facts.cost;
  assert.deepEqual(cost("kit/watch-pistol"), { amount: 15, unit: "shillings" });
  assert.deepEqual(cost("kit/silver-nail"), { amount: 10, unit: "shillings" });
  assert.deepEqual(cost("kit/grave-spade"), { amount: 3, unit: "shillings" }, "a coin left keeps its price");
  const odd = parsedOrThrow(
    variant(gravewatchText, (doc) => {
      doc.items.currencies[0].units[2].value = 61;
    }),
    "a crown of 61 pennies",
  );
  const oddBook = rulesetItemBook(odd, entriesOf(odd), { layerOptions: night });
  assert.deepEqual(
    oddBook.entries.find((entry) => entry.item === "kit/watch-pistol")?.facts.cost,
    { amount: 183, unit: "pennies" },
    "no shilling pays 183 pennies exactly",
  );
  // A family gone takes every price in it along.
  const gone = parsedOrThrow(
    variant(gravewatchText, (doc) => (doc.layers[0].currencies = { removeFamilies: ["coin"] })),
    "a long night without coin",
  );
  const goneBook = rulesetItemBook(gone, entriesOf(gone), { layerOptions: night });
  assert.equal(goneBook.coins.length, 0);
  assert.equal(goneBook.coinNamed, undefined, "no coins, no money");
  assert.equal(goneBook.entries.find((entry) => entry.item === "kit/watch-pistol")?.facts.cost, undefined);
  // The purse leaves the hidden coins out, and paying never breaks one.
  const purse = coins([
    ["crowns", "crown", 2],
    ["shillings", "shilling", 1],
  ]);
  assert.equal(rulesetPurseText(book, purse, undefined), "Coin worth 12 pennies");
  assert.match(
    applyGameInventoryTags('[inventory: action="pay" amount="2 shillings"]', purse, { members: [] }, undefined, book)
      .content,
    /reason="cannot-afford"/,
  );
  // The Game Master is taught only the coins left.
  const reminder = buildGmFormatReminder({
    hasSceneModel: true,
    ruleset: layered.definition,
    rulesetLayerOptions: night,
  } as never);
  assert.match(reminder, /amount="5 shillings".*\(Coin: shillings, pennies\)/);
  assert.doesNotMatch(reminder, /crowns/);
}

// ── Loot drops coins ──
{
  // Faces: one pick, 11 of 12 is the coin line (weights 4, 3, 2, 1 and 2), four of it.
  assert.deepEqual(rollRulesetLootTable(gravewatch, graveBook, "grave_goods", dice(1, 11, 4)), [
    { item: "coin:shilling", name: "shillings", count: 4 },
  ]);
  const crowns = parsedOrThrow(
    variant(gravewatchText, (doc) => (doc.items.lootTables[0].entries = [{ coins: "crown" }])),
    "grave goods of crowns",
  );
  assert.deepEqual(rollRulesetLootTable(crowns, graveBook, "grave_goods", dice(1)), [
    { item: "coin:crown", name: "crowns", count: 1 },
  ]);
  const nightBook = rulesetItemBook(crowns, entriesOf(crowns), { layerOptions: night });
  assert.deepEqual(
    rollRulesetLootTable(crowns, nightBook, "grave_goods", dice(1)),
    [],
    "a coin a layer hides drops nothing",
  );
  // Dropped coins are answered as adds, like any drop.
  const tagged = applyGameInventoryTags(
    '[loot: table="grave_goods"]',
    [],
    { members: [] },
    undefined,
    graveBook,
    undefined,
    (table) => rollRulesetLootTable(gravewatch, graveBook, table, dice(1, 11, 4)),
  );
  assert.equal(tagged.content, '[inventory: action="add" item="shillings" count="4" result="ok" now="4"]');
  assert.deepEqual(
    tagged.stacks.map((stack) => stack.item),
    ["coin:shilling"],
  );
}

console.info("game ruleset money regressions passed.");
