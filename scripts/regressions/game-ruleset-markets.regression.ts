/**
 * Markets (#6917, Capability API 1.65).
 *
 *   - `items.market`: price levels on an item's cost, place sizes, where things are sold, and kinds of
 *     seller (with who they sell `only` to); an item's own `sold` place, and a `service`, bought and
 *     never carried. Checked at import, gated at 1.65.
 *   - The Game Master's `[place:]`, answered in place; the place in force is the last one answered.
 *   - The Game Master's `[inventory: action="buy"]`: priced at the place, paid out of the buyer's purse
 *     with change and put in their bag (a service only pays), or refused and nothing changes.
 *   - The Game Master's MARKET block and instructions, only where the ruleset has a market.
 *   - The server's place before a reply, and a seller's `only` read off the buyer's own sheet.
 *   - A market day (#6934, 1.69): a stay, or a new day the Game Master marks; a seller's stock rolled
 *     for the day, how many of a thing a place keeps a day, and selling back out of a place's purse.
 *     The server reads the day and what it saw back off the Game Master's answered tags.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  applyGameInventoryOps,
  applyGameInventoryTags,
  answeredGamePlaces,
  applyGamePlaceTags,
  gameMarketDayStart,
  defaultRulesetSheetBuild,
  lastGamePlace,
  parseRulesetDefinition,
  readResolvedInventoryTags,
  rulesetItemBook,
  rulesetItemMatchesFilter,
  rulesetItemLimit,
  rulesetItemSoldRank,
  rulesetMarketLevel,
  rulesetMarketPlace,
  rulesetMarketPrice,
  rulesetPricedCoins,
  rulesetCoinAmount,
  rulesetPurseText,
  rulesetMarketPromptText,
  rulesetMarketQuoter,
  rulesetMarketSellersAt,
  rulesetMarketShelf,
  type GameInventoryStack,
  type RulesetCatalogEntry,
  type RulesetDefinition,
  type RulesetMarket,
  type RulesetMarketDay,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-markets-"));
process.env.DATA_DIR = dataDir;
process.env.MARINARA_DATA_DIR = dataDir;
process.env.DATABASE_URL = `file:${join(dataDir, "marinara-engine.db")}`;

const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");
const { buildGmFormatReminder } = await import("../../packages/server/src/services/game/gm-prompts.js");
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createCharactersStorage } = await import("../../packages/server/src/services/storage/characters.storage.js");
const { gameMarketDayFor, gamePlaceBefore, gameRepliesBefore, loadGameMarket } =
  await import("../../packages/server/src/services/game/game-market.service.js");

const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
/** The example as it is, with a market day (#6934, 1.69). */
const gravewatchDayText = read("../../docs/examples/rulesets/gravewatch.json");
/** The example's market as 1.65 had it: no purse, buy-back, stock or limit. Every section before the
 *  market day's own reads this, so what it proves does not move with the day's dice. */
const gravewatchText = (() => {
  const doc = JSON.parse(gravewatchDayText) as Record<string, any>;
  const market = doc.items.market;
  delete market.buyBack;
  for (const place of market.places) delete place.purse;
  for (const seller of market.sellers) delete seller.stock;
  for (const rule of market.sold) delete rule.limited;
  return JSON.stringify(doc);
})();
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
const book = rulesetItemBook(gravewatch, entriesOf(gravewatch));
const market = gravewatch.items!.market!;
const night = { "layer.long_night": true };

// ── Import ──
{
  assert.deepEqual(
    market.places.map((place) => place.id),
    ["hamlet", "village", "town", "city"],
  );
  assert.equal(book.itemOf("kit/watch-house-bed")?.entry.item?.service, true, "the bed is a service");
  const at = (path: string[], value: unknown) => (doc: Record<string, any>) => {
    let node = doc.items.market;
    for (const key of path.slice(0, -1)) node = node[key];
    node[path.at(-1)!] = value;
  };
  refused(at(["prices"], []), /items\.market\.prices: Too small: expected array to have >=1 items/, "no price levels");
  refused(
    at(
      ["prices"],
      [
        { id: "fair", label: "fair", times: 1 },
        { id: "dear", label: "dear", times: 2 },
      ],
    ),
    /One price level is the default/,
    "no default level",
  );
  refused(
    at(
      ["prices"],
      [
        { id: "fair", label: "fair", times: 1, default: true },
        { id: "dear", label: "dear", times: 2, default: true },
      ],
    ),
    /One price level is the default/,
    "two defaults",
  );
  refused(
    at(["prices", "0", "times"], 0),
    /items\.market\.prices\.0\.times: Too small: expected number to be >0/,
    "a level of nothing",
  );
  refused(at(["places"], []), /items\.market\.places: Too small: expected array to have >=1 items/, "no places");
  refused(at(["places", "1", "id"], "hamlet"), /market\.places\.1\.id: Duplicate place id "hamlet"/, "a place twice");
  refused(at(["sold", "0", "place"], "metropolis"), /sold\.0\.place: Unknown place "metropolis"/, "a rule's place");
  refused(at(["sold", "0", "filter"], { rarity: "mythic" }), /sold\.0\.filter\.rarity: Unknown item rarity/, "a word");
  refused(at(["sold", "0", "filter"], {}), /sold\.0\.filter: A filter names a rarity, a category or a tag/, "a filter");
  refused(
    at(["sellers", "0", "place"], "metropolis"),
    /sellers\.0\.place: Unknown place "metropolis"/,
    "a seller's place",
  );
  refused(
    at(["sellers", "0", "sells"], [{ category: "wand" }]),
    /sellers\.0\.sells\.0\.category: Unknown item category "wand"/,
    "what a seller sells",
  );
  refused(
    at(["sellers", "2", "only", "value"], { abilityScore: "luck" }),
    /sellers\.2\.only\.value/,
    "who a seller sells to",
  );
  refused(
    at(["sellers", "1", "id"], "chandler"),
    /market\.sellers\.1\.id: Duplicate seller id "chandler"/,
    "a seller twice",
  );
  const item = (id: string, edit: (item: Record<string, any>) => void) => (doc: Record<string, any>) =>
    edit(
      doc.catalogs
        .find((catalog: { id: string }) => catalog.id === "kit")
        .entries.find((entry: { id: string }) => entry.id === id).item,
    );
  refused(
    item("watch-pistol", (it) => (it.sold = { place: "capital" })),
    /sold\.place: Unknown place "capital"/,
    "an item's place",
  );
  refused(
    (doc) => {
      delete doc.items.market;
    },
    /This ruleset declares no market, so nothing is sold anywhere/,
    "an item's place without a market",
  );
  refused(
    item("watch-house-bed", (it) => delete it.cost),
    /A service is bought, so it has a cost/,
    "a free service",
  );
  refused(
    item("watch-house-bed", (it) => (it.slots = { body: 1 })),
    /A service is never carried, so it has no slots/,
    "a service worn",
  );
  refused(
    item("watch-house-bed", (it) => (it.use = { kind: "heal", targets: "self", amount: { flat: 1 }, consumes: true })),
    /A service is never carried, so it has no use/,
    "a service used",
  );
}

// ── Places, levels, where things are sold, sellers ──
{
  assert.deepEqual(rulesetMarketPlace(market, "Market Town"), { id: "town", label: "market town", rank: 2 });
  assert.deepEqual(rulesetMarketPlace(market, "town"), { id: "town", label: "market town", rank: 2 }, "by id");
  assert.equal(rulesetMarketPlace(market, "metropolis"), undefined);
  assert.equal(rulesetMarketLevel(market)?.id, "fair", "the default level");
  assert.equal(rulesetMarketLevel(market, "DEAR")?.times, 1.5);
  assert.equal(rulesetMarketLevel(market, "bargain"), undefined);
  const item = (id: string) => book.itemOf(id)!.entry.item!;
  assert.equal(rulesetItemMatchesFilter(item("kit/silver-nail"), { tag: "silver" }), true, "a tag it has");
  assert.equal(rulesetItemMatchesFilter(item("kit/grave-spade"), { tag: "silver" }), false, "a tag it has not");
  assert.equal(
    rulesetItemMatchesFilter(item("kit/silver-nail"), { tag: "silver", category: "coat" }),
    false,
    "every word",
  );
  assert.equal(rulesetItemSoldRank(market, item("kit/lantern-coat")), 0, "sold anywhere");
  assert.equal(rulesetItemSoldRank(market, item("kit/grave-spade")), 1, "arms from a village");
  assert.equal(rulesetItemSoldRank(market, item("kit/silver-nail")), 2, "rare arms from a market town: first rule");
  assert.equal(rulesetItemSoldRank(market, item("kit/watch-pistol")), 3, "the item's own place wins");
  assert.deepEqual(
    rulesetMarketSellersAt(market, 0).map((seller) => seller.id),
    ["chandler"],
  );
  assert.deepEqual(
    rulesetMarketSellersAt(market, 2).map((seller) => seller.id),
    ["chandler", "smith", "chapel"],
  );
}

// ── Prices ──
{
  const coat = book.itemOf("kit/lantern-coat")!.entry.item!.cost!;
  assert.deepEqual(rulesetMarketPrice(gravewatch, coat, 1.5, 1)?.said, "12 shillings", "8 shillings, dear");
  assert.deepEqual(rulesetMarketPrice(gravewatch, coat, 0.75, 1)?.said, "6 shillings");
  assert.equal(rulesetMarketPrice(gravewatch, coat, 1, 2)?.owed, 192, "two coats in pennies");
  // Said in the coin the cost is written in where that coin pays it exactly, else in it and smaller ones.
  assert.equal(rulesetMarketPrice(gravewatch, coat, 1, 10)?.said, "80 shillings", "ten coats, in the coat's own coin");
  assert.equal(rulesetMarketPrice(gravewatch, coat, 1.5, 1)?.said, "12 shillings");
  assert.equal(
    rulesetMarketPrice(gravewatch, { amount: 5, unit: "shilling" }, 1.5, 1)?.said,
    "7 shillings and 6 pennies",
    "7.5 shillings: in shillings and the pennies left over (laptop pass 6: 12.5 gold said as 125 silver)",
  );
  assert.equal(
    rulesetMarketPrice(gravewatch, { amount: 15, unit: "penny" }, 1, 4)?.said,
    "60 pennies",
    "a price in pennies stays in pennies, though a crown would pay it",
  );
  // Where its own coin does not pay it, a coin some price is written in says it before one none is
  // (laptop playtest 2026-10-25: a Mace sold for "5 electrum pieces", a coin no 5e price uses).
  assert.equal(rulesetMarketPrice(gravewatch, { amount: 1, unit: "crown" }, 0.6, 1)?.said, "3 shillings");
  assert.equal(
    rulesetMarketPrice(gravewatch, { amount: 1, unit: "crown" }, 0.6, 1, null, new Set(["coin:crown", "coin:penny"]))
      ?.said,
    "36 pennies",
    "no price is written in shillings",
  );
  assert.deepEqual(
    [...rulesetPricedCoins(book.entries)].sort(),
    [
      ...new Set(
        book.entries.flatMap((entry) => (entry.entry.item?.cost ? [`coin:${entry.entry.item.cost.unit}`] : [])),
      ),
    ].sort(),
  );
  const tonic = book.itemOf("kit/warming-tonic")!.entry.item!.cost!;
  assert.equal(rulesetMarketPrice(gravewatch, tonic, 0.75, 1)?.owed, 3, "4 pennies cheap");
  assert.equal(rulesetMarketPrice(gravewatch, { amount: 1, unit: "penny" }, 0.3, 1)?.owed, 1, "never below one");
  assert.equal(rulesetMarketPrice(gravewatch, { amount: 0, unit: "penny" }, 1.5, 1)?.owed, 0, "free stays free");
  assert.equal(rulesetMarketPrice(gravewatch, { amount: 5, unit: "penny" }, 1.5, 1)?.owed, 8, "7.5 rounds up");
  const pistol = book.itemOf("kit/watch-pistol")!.entry.item!.cost!;
  assert.equal(rulesetMarketPrice(gravewatch, pistol, 1, 1)?.said, "3 crowns");
  assert.equal(
    rulesetMarketPrice(gravewatch, pistol, 1, 1, night)?.said,
    "15 shillings",
    "a layer that takes crowns out says the price in shillings",
  );
}

// ── Buying ──
const town = rulesetMarketPlace(market, "town")!;
const hamlet = rulesetMarketPlace(market, "hamlet")!;
const steady = (who: string | undefined) => who !== "Bram";
const quoter = (place = town, meets = steady) =>
  rulesetMarketQuoter(gravewatch, book, place, (_only, who) => meets(who));
const party = { members: ["Bram"] };
const buy = (tag: string, stacks: GameInventoryStack[], market = quoter()) =>
  applyGameInventoryTags(tag, stacks, party, undefined, book, undefined, undefined, market);
{
  // A dear coat (12 shillings, 144 pennies) out of three crowns: two go first, the third is broken,
  // and 3 shillings come back.
  const bought = buy(
    '[inventory: action="buy" item="Lantern-keeper\'s coat" level="dear"]',
    coins([["crowns", "crown", 3]]),
  );
  const [answer] = readResolvedInventoryTags(bought.content);
  assert.equal(answer?.ok, true, bought.content);
  assert.equal(answer?.price, "12 shillings");
  assert.match(bought.content, /level="dear" seller="chandler" result="ok" now="1" price="12 shillings"/);
  assert.match(bought.content, /note="Paid with crowns ×3; shillings ×3 back\."/);
  assert.deepEqual(held(bought.stacks), [
    ["shillings", 3, ""],
    ["Lantern-keeper's coat", 1, ""],
  ]);
  assert.deepEqual(bought.journal, [
    { item: "crowns", action: "used", quantity: 3 },
    { item: "shillings", action: "acquired", quantity: 3 },
    { item: "Lantern-keeper's coat", action: "acquired", quantity: 1 },
  ]);
  // A service only pays.
  const bed = buy('[inventory: action="buy" item="A bed at the watch-house"]', coins([["shillings", "shilling", 1]]));
  assert.match(bed.content, /result="ok" now="0" price="6 pennies"/);
  assert.deepEqual(held(bed.stacks), [["pennies", 6, ""]], "change, and no bed in the bag");
  // Out of a member's own purse, into their own bag, counted.
  const bram = buy(
    '[inventory: action="buy" item="Warming tonic" count="3" who="Bram"]',
    coins([
      ["shillings", "shilling", 1, "Bram"],
      ["shillings", "shilling", 5],
    ]),
  );
  assert.match(
    bram.content,
    /count="3" who="Bram" level="fair" seller="chandler" result="ok" now="3" price="12 pennies"/,
  );
  assert.deepEqual(held(bram.stacks), [
    ["shillings", 5, ""],
    ["Warming tonic", 3, "Bram"],
  ]);
  // A member short of coin pays the rest out of the party's (laptop pass 5 2026-10-26: "Hessa buys
  // with the party's coin" refused with 62 gp in another's purse).
  const broke = buy(
    '[inventory: action="buy" item="Warming tonic" count="3" who="Bram"]',
    coins([["shillings", "shilling", 5]]),
  );
  assert.match(broke.content, /who="Bram"[^\]]*result="ok" now="3"/, broke.content);
  assert.deepEqual(held(broke.stacks), [
    ["shillings", 4, ""],
    ["Warming tonic", 3, "Bram"],
  ]);
  // By its ref; and a name with a comma in it is one item, not two
  // (#8271: "Rope, hempen (50 feet)" and "Lantern, hooded").
  for (const item of ["kit/warming-tonic"]) {
    const byId = buy(`[inventory: action="buy" item="${item}"]`, coins([["shillings", "shilling", 1]]));
    assert.match(byId.content, /item="Warming tonic"[^\]]*result="ok"/, `${item}: ${byId.content}`);
  }
  {
    const comma = parsedOrThrow(
      variant(gravewatchText, (doc) => {
        for (const catalog of doc.catalogs)
          for (const entry of catalog.entries ?? []) if (entry.id === "warming-tonic") entry.label = "Tonic, warming";
      }),
      "Gravewatch with a comma",
    );
    const commaBook = rulesetItemBook(comma, entriesOf(comma));
    const commaQuote = rulesetMarketQuoter(comma, commaBook, town, () => true);
    const tagged = '[inventory: action="buy" item="Tonic, warming"]';
    const one = applyGameInventoryTags(
      tagged,
      coins([["shillings", "shilling", 1]]),
      party,
      undefined,
      commaBook,
      undefined,
      undefined,
      commaQuote,
    );
    assert.equal(readResolvedInventoryTags(one.content).length, 1, one.content);
    assert.match(one.content, /item="Tonic, warming"[^\]]*result="ok"/, one.content);
    // Held, it is found whole too; and a real list still splits.
    const added = applyGameInventoryTags(
      '[inventory: action="add" item="Tonic, warming"]',
      [],
      party,
      undefined,
      commaBook,
    );
    assert.deepEqual(held(added.stacks), [["Tonic, warming", 1, ""]]);
    const two = applyGameInventoryTags(
      '[inventory: action="add" item="Grave spade, Warming tonic"]',
      [],
      party,
      undefined,
      book,
    );
    assert.equal(readResolvedInventoryTags(two.content).length, 2, two.content);
    // Each comma name in a list is found whole too (laptop 2026-10-25).
    const listed = applyGameInventoryTags(
      '[inventory: action="add" item="Tonic, warming, Grave spade"]',
      [],
      party,
      undefined,
      commaBook,
    );
    assert.deepEqual(
      readResolvedInventoryTags(listed.content).map((tag) => tag.item),
      ["Tonic, warming", "Grave spade"],
      listed.content,
    );
  }
  // Two items of one label: the ref names the one it is, and the label the first (#8271).
  {
    const twins = parsedOrThrow(
      variant(gravewatchText, (doc) => {
        for (const catalog of doc.catalogs) {
          const entries = catalog.entries ?? [];
          const tonic = entries.find((entry: { id: string }) => entry.id === "warming-tonic");
          if (tonic) entries.push({ ...structuredClone(tonic), id: "warming-tonic-dear" });
        }
      }),
      "Gravewatch with twin tonics",
    );
    const twinBook = rulesetItemBook(twins, entriesOf(twins));
    const twinQuote = rulesetMarketQuoter(twins, twinBook, town, () => true);
    const items = (tag: string, market?: typeof twinQuote) =>
      applyGameInventoryTags(
        tag,
        coins([["shillings", "shilling", 1]]),
        party,
        undefined,
        twinBook,
        undefined,
        undefined,
        market,
      ).stacks.flatMap((stack) => (stack.item?.startsWith("kit/") ? [stack.item] : []));
    assert.deepEqual(items('[inventory: action="add" item="kit/warming-tonic-dear"]'), ["kit/warming-tonic-dear"]);
    assert.deepEqual(items('[inventory: action="buy" item="kit/warming-tonic-dear"]', twinQuote), [
      "kit/warming-tonic-dear",
    ]);
    assert.deepEqual(items('[inventory: action="buy" item="Warming tonic"]', twinQuote), ["kit/warming-tonic"]);
  }
  // Refusals change nothing.
  const refusedWith = (tag: string, reason: string, stacks = coins([["crowns", "crown", 9]]), at = quoter()) => {
    const answered = buy(tag, stacks, at);
    assert.match(answered.content, new RegExp(`result="refused" reason="${reason}"`), `${tag}: ${answered.content}`);
    assert.deepEqual(answered.stacks, stacks, `${tag} changes nothing`);
    assert.deepEqual(answered.journal, []);
  };
  refusedWith('[inventory: action="buy" item="Watch pistol"]', "not-here");
  refusedWith('[inventory: action="buy" item="Grave spade"]', "not-here", undefined, quoter(hamlet));
  refusedWith('[inventory: action="buy" item="Grave spade" seller="chandler"]', "no-seller");
  refusedWith('[inventory: action="buy" item="Grave spade" seller="fence"]', "no-seller");
  refusedWith('[inventory: action="buy" item="Page of the vigil litany" who="Bram"]', "not-to-you");
  refusedWith('[inventory: action="buy" item="Lantern-keeper\'s coat" level="bargain"]', "unknown-level");
  refusedWith('[inventory: action="buy" item="Golden spade"]', "unknown-item");
  refusedWith('[inventory: action="buy" item="Dawn bell"]', "not-for-sale");
  refusedWith('[inventory: action="buy" item="crowns"]', "unknown-item");
  refusedWith(
    '[inventory: action="buy" item="Lantern-keeper\'s coat"]',
    "cannot-afford",
    coins([["pennies", "penny", 5]]),
  );
  refusedWith(
    '[inventory: action="buy" item="Lantern-keeper\'s coat"]',
    "no-place",
    undefined,
    rulesetMarketQuoter(gravewatch, book, null, () => true),
  );
  // A game with no market refuses every buy.
  const noMarket = applyGameInventoryTags(
    '[inventory: action="buy" item="Lantern-keeper\'s coat"]',
    coins([["crowns", "crown", 9]]),
    party,
    undefined,
    book,
  );
  assert.match(noMarket.content, /result="refused" reason="no-market"/);
  assert.deepEqual(noMarket.journal, []);
  // The chapel sells its pages to a warden who meets its `only`, and the page at a market town.
  assert.match(
    buy('[inventory: action="buy" item="Page of the vigil litany"]', coins([["crowns", "crown", 1]])).content,
    /seller="chapel of the Vigil" result="ok"/,
  );
  // A seller's `only` reads the stacks as the reply's earlier tags left them: a ring added first is
  // carried when the page is bought after it.
  const ringHolder = rulesetMarketQuoter(gravewatch, book, town, (_only, _who, stacks) =>
    stacks.some((stack) => stack.item === "kit/widows-ring"),
  );
  const purseOnly = coins([["crowns", "crown", 1]]);
  const ringThenPage = applyGameInventoryTags(
    '[inventory: action="add" item="Widow\'s ring"] [inventory: action="buy" item="Page of the vigil litany"]',
    purseOnly,
    party,
    undefined,
    book,
    undefined,
    undefined,
    ringHolder,
  );
  assert.match(ringThenPage.content, /item="Page of the vigil litany".*result="ok"/);
  const pageAlone = applyGameInventoryTags(
    '[inventory: action="buy" item="Page of the vigil litany"]',
    purseOnly,
    party,
    undefined,
    book,
    undefined,
    undefined,
    ringHolder,
  );
  assert.match(pageAlone.content, /result="refused" reason="not-to-you"/);
  // An item a layer hides is not sold, whoever asks.
  const hidden = applyGameInventoryTags(
    '[inventory: action="buy" item="Warming tonic"]',
    coins([["crowns", "crown", 1]]),
    party,
    undefined,
    book,
    undefined,
    undefined,
    rulesetMarketQuoter(gravewatch, { itemNamed: book.itemNamed, offers: () => false }, town, () => true),
  );
  assert.match(hidden.content, /result="refused" reason="unknown-item"/);
  // A coat nobody can carry is not bought at all: the price stays in the purse.
  const carrying = parsedOrThrow(
    variant(gravewatchText, (doc) => {
      doc.items.stats.push({ id: "weight", label: "Weight", type: "number", min: 0, max: 100, default: 0 });
      doc.items.carry = { stat: "weight", encumberedAbove: { const: 1 }, limit: { const: 2 } };
      doc.catalogs
        .find((catalog: { id: string }) => catalog.id === "kit")
        .entries.find((entry: { id: string }) => entry.id === "lantern-coat").item.stats.weight = 5;
    }),
    "Gravewatch that counts weight",
  );
  const carryingBook = rulesetItemBook(carrying, entriesOf(carrying), {
    sheets: { player: defaultRulesetSheetBuild(carrying) },
  });
  const purse = coins([["crowns", "crown", 2]]);
  const tooHeavy = applyGameInventoryTags(
    '[inventory: action="buy" item="Lantern-keeper\'s coat"]',
    purse,
    party,
    undefined,
    carryingBook,
    undefined,
    undefined,
    rulesetMarketQuoter(carrying, carryingBook, town, () => true),
  );
  assert.match(tooHeavy.content, /result="refused" reason="too-heavy"/);
  assert.deepEqual(tooHeavy.stacks, purse, "nothing paid");
  assert.deepEqual(tooHeavy.journal, []);
  // Two coats where only one fits: paid for in full or not at all, so not at all.
  const oneFits = parsedOrThrow(
    variant(gravewatchText, (doc) => {
      doc.items.stats.push({ id: "weight", label: "Weight", type: "number", min: 0, max: 100, default: 0 });
      doc.items.carry = { stat: "weight", encumberedAbove: { const: 1 }, limit: { const: 2 } };
      doc.catalogs
        .find((catalog: { id: string }) => catalog.id === "kit")
        .entries.find((entry: { id: string }) => entry.id === "lantern-coat").item.stats.weight = 2;
    }),
    "Gravewatch with a coat that weighs 2",
  );
  const oneFitsBook = rulesetItemBook(oneFits, entriesOf(oneFits), {
    sheets: { player: defaultRulesetSheetBuild(oneFits) },
  });
  const richer = coins([["crowns", "crown", 5]]);
  const twoCoats = applyGameInventoryTags(
    '[inventory: action="buy" item="Lantern-keeper\'s coat" count="2"]',
    richer,
    party,
    undefined,
    oneFitsBook,
    undefined,
    undefined,
    rulesetMarketQuoter(oneFits, oneFitsBook, town, () => true),
  );
  assert.match(twoCoats.content, /result="refused" reason="too-heavy"/);
  assert.deepEqual(twoCoats.stacks, richer, "nothing paid, nothing added");
  // A service is never carried, however it is added: the Game Master's add, the picker's.
  assert.deepEqual(
    applyGameInventoryOps(
      [],
      [{ op: "add", name: "A bed at the watch-house", item: "kit/watch-house-bed", count: 1 }],
      undefined,
      book,
    ).results,
    [{ ok: false, reason: "service" }],
  );
  const added = applyGameInventoryTags(
    '[inventory: action="add" item="A bed at the watch-house"]',
    [],
    party,
    undefined,
    book,
  );
  assert.match(added.content, /result="refused" reason="service"/);
  assert.deepEqual(added.stacks, []);
  // A layer that takes crowns out prices and pays in what is left.
  const nightBook = rulesetItemBook(gravewatch, entriesOf(gravewatch), { layerOptions: night });
  const paidAtNight = applyGameInventoryTags(
    '[inventory: action="buy" item="Watch pistol"]',
    coins([["shillings", "shilling", 20]]),
    party,
    undefined,
    nightBook,
    undefined,
    undefined,
    rulesetMarketQuoter(gravewatch, nightBook, rulesetMarketPlace(market, "city")!, () => true, night),
  );
  assert.match(paidAtNight.content, /result="ok" now="1" price="15 shillings"/);
}

// ── Places ──
{
  const sizeOf = (word: string) => rulesetMarketPlace(market, word);
  const placed = applyGamePlaceTags(
    'Road. [place: name="Barrow Road"] Then [place: name=Millbrook size="Market Town"] and [place: size="metropolis"]',
    sizeOf,
  );
  assert.equal(
    placed.content,
    'Road. [place: name="Barrow Road" result="ok"] Then [place: name="Millbrook" size="town" result="ok"] and [place: size="metropolis" result="refused" reason="unknown-size"]',
  );
  assert.deepEqual(placed.place, { name: "Millbrook", size: "town" }, "a refused one changes nothing");
  assert.deepEqual(applyGamePlaceTags("[place: ]", sizeOf).content, '[place: result="refused" reason="unreadable"]');
  assert.equal(applyGamePlaceTags("No place here.", sizeOf).place, undefined);
  assert.deepEqual(lastGamePlace(['[place: name="A" size="hamlet" result="ok"]', placed.content, "Later."]), {
    name: "Millbrook",
    size: "town",
  });
  assert.equal(lastGamePlace(['[place: name="A" size="hamlet"]']), null, "only an answered tag counts");
  assert.deepEqual(lastGamePlace(['[place: name="Barrow Road" result="ok"]']), { name: "Barrow Road" }, "no market");
}

// ── The Game Master ──
{
  const text = rulesetMarketPromptText(gravewatch, book, { name: "Millbrook", size: "town" })!;
  const lines = text.split("\n");
  assert.equal(
    lines[0],
    "MARKET: Millbrook, a market town. Prices at fair, the default level (cheap ×0.75, fair ×1, dear ×1.5).",
  );
  assert.equal(
    lines[1],
    "- chandler: Shot and powder 1 pennies, Warming tonic 4 pennies, A bed at the watch-house 6 pennies (a service), Lantern-keeper's coat 8 shillings",
  );
  assert.equal(lines[2], "- smith: Grave spade 3 shillings, Silver coffin nail 2 crowns");
  assert.equal(
    lines[3],
    "- chapel of the Vigil (to wardens of Nerve 3 or more only): Page of the vigil litany 1 shillings",
  );
  // And nothing it does not name is priced or counted (laptop playtest 2026-10-25: a temple's last vial).
  assert.equal(
    lines[4],
    "Never name a price or say how many are left of a ware this block does not name: try the buy first and narrate what the Engine answers.",
  );
  assert.equal(lines.length, 5);
  assert.deepEqual(
    rulesetMarketPromptText(gravewatch, book, { name: "Crossroads", size: "hamlet" })!.split("\n").slice(1),
    [
      "- chandler: Shot and powder 1 pennies, Warming tonic 4 pennies, A bed at the watch-house 6 pennies (a service), Lantern-keeper's coat 8 shillings",
      "Never name a price or say how many are left of a ware this block does not name: try the buy first and narrate what the Engine answers.",
    ],
  );
  assert.equal(
    rulesetMarketPromptText(gravewatch, book, { name: "Barrow Road" }),
    "MARKET: Barrow Road has no market.",
  );
  assert.match(rulesetMarketPromptText(gravewatch, book, null)!, /no place said yet/);
  const ember = parsedOrThrow(JSON.parse(emberText), "Ember Roads");
  assert.equal(rulesetMarketPromptText(ember, book, { size: "town" }), undefined, "no market, no block");
  // A seller who needs a bigger place is not listed; with none here, the block says so.
  const smallOnly = parsedOrThrow(
    variant(
      gravewatchText,
      (doc) =>
        (doc.items.market.sellers = [{ id: "smith", label: "smith", sells: [{ category: "arm" }], place: "village" }]),
    ),
    "only a smith",
  );
  assert.deepEqual(
    rulesetMarketPromptText(smallOnly, rulesetItemBook(smallOnly, entriesOf(smallOnly)), { size: "hamlet" })!
      .split("\n")
      .slice(1),
    [
      "- No seller keeps shop in a place this size.",
      "Never name a price or say how many are left of a ware this block does not name: try the buy first and narrate what the Engine answers.",
    ],
  );
  // More than a dozen of one seller's wares: the cheapest dozen, and how many more.
  const crowded = parsedOrThrow(
    variant(gravewatchText, (doc) => {
      const kit = doc.catalogs.find((catalog: { id: string }) => catalog.id === "kit");
      for (let index = 0; index < 14; index++) {
        kit.entries.push({
          id: `tonic-${index}`,
          label: `Tonic ${index}`,
          item: { category: "tonic", cost: { amount: index + 10, unit: "penny" } },
        });
      }
    }),
    "a crowded chandler",
  );
  const crowdedLine = rulesetMarketPromptText(crowded, rulesetItemBook(crowded, entriesOf(crowded)), {
    size: "hamlet",
  })!.split("\n")[1]!;
  assert.match(crowdedLine, /, and 6 more$/);
  assert.equal(crowdedLine.split(", ").length - 1, 12, "twelve listed");

  const prompt = (definition: RulesetDefinition, market?: string) =>
    buildGmFormatReminder({ ruleset: definition, ...(market ? { market } : {}) } as Parameters<
      typeof buildGmFormatReminder
    >[0]);
  const taught = prompt(gravewatch, text);
  assert.match(
    taught,
    /\[place: name="Name" size="city"\] - whenever the scene moves to a new place, with its size, one of: hamlet, village, market town, city/,
  );
  assert.match(taught, /\[inventory: action="buy" item="Name" count="1" level="fair" seller="Seller" who="Name"\]/);
  assert.match(taught, /Levels: cheap ×0\.75, fair ×1 \(the default\), dear ×1\.5/);
  assert.match(taught, /Buying is a buy \(below\)/);
  // A shop the block does not list is narrated as for sale nowhere (laptop playtest 2026-10-25: a
  // village herbalist's "shelf of red-tinged vials", where no potion was sold).
  assert.match(taught, /Describe only the sellers and wares it lists: .*never narrate one as for sale\./);
  assert.ok(taught.includes(text), "the block");
  const untaught = prompt(ember);
  assert.doesNotMatch(untaught, /\[place:|action="buy"|MARKET:/);
}

const manifest = (minor: number) => ({
  schemaVersion: 2,
  capabilityApi: { major: 1, minor },
  builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
  id: "ruleset-markets",
  name: "Markets",
  version: "0.1.0",
  description: "A packaged ruleset with a market.",
  engine: { min: "2.4.6", maxExclusive: "4.0.0" },
  kind: ["ruleset"],
  entrypoints: {},
  contributions: { assets: { paths: ["ruleset.json"] } },
  files: [{ path: "ruleset.json", sha256: "0".repeat(64), bytes: 10 }],
  permissions: [],
  restartRequired: false,
});

// ── 1.89: a coin's name for one ──
{
  const named = (doc: Record<string, any>) => {
    const units = doc.items.currencies[0].units;
    units.find((unit: { id: string }) => unit.id === "penny").one = "penny";
    units.find((unit: { id: string }) => unit.id === "shilling").one = "shilling";
  };
  const singular = parsedOrThrow(variant(gravewatchText, named), "Gravewatch with singular coins");
  const singularBook = rulesetItemBook(singular, entriesOf(singular));
  const lines = rulesetMarketPromptText(singular, singularBook, { name: "Millbrook", size: "town" })!.split("\n");
  assert.equal(
    lines[1],
    "- chandler: Shot and powder 1 penny, Warming tonic 4 pennies, A bed at the watch-house 6 pennies (a service), Lantern-keeper's coat 8 shillings",
    "one penny, four pennies",
  );
  assert.equal(
    lines[3],
    "- chapel of the Vigil (to wardens of Nerve 3 or more only): Page of the vigil litany 1 shilling",
  );
  assert.equal(rulesetCoinAmount({ label: "crowns" }, 1), "1 crowns", "a coin with no name for one keeps its label");
  assert.equal(rulesetCoinAmount({ label: "pennies", one: "penny" }, 0), "0 pennies");
  const shot = singularBook.itemNamed("Shot and powder");
  assert.deepEqual(shot?.facts.cost, { amount: 1, unit: "penny" }, "the item's own price");
  assert.equal(
    rulesetPurseText(singularBook, coins([["pennies", "penny", 1]]), undefined),
    "Coin worth 1 penny",
    "a purse of one",
  );
  refused((doc) => (doc.items.currencies[0].units[0].one = "x".repeat(41)), /one/, "a name for one is a short word");
  const gate = (minor: number, doc: Record<string, any>) =>
    getCapabilityPackageInstallIssue(manifest(minor) as any, doc);
  assert.match(gate(88, variant(gravewatchDayText, named)) ?? "", /coins name one of themselves.*1\.89/);
  assert.equal(gate(89, variant(gravewatchDayText, named)), null);
  assert.equal(gate(88, variant(gravewatchDayText)), null, "without it, nothing new");
}

// ── Install gate: 1.65 ──
{
  const gateIssue = /with a market, or whose items name where they are sold or are services.*capabilityApi 1\.65/;
  const issue = (minor: number, doc: Record<string, any>) =>
    getCapabilityPackageInstallIssue(manifest(minor) as any, doc);
  const noMarket = (doc: Record<string, any>) => delete doc.items.market;
  const kit = (doc: Record<string, any>) => doc.catalogs.find((catalog: { id: string }) => catalog.id === "kit");
  const noSold = (doc: Record<string, any>) => {
    for (const entry of kit(doc).entries) delete entry.item.sold;
  };
  const noService = (doc: Record<string, any>) => {
    for (const entry of kit(doc).entries) delete entry.item.service;
  };
  assert.match(issue(64, variant(gravewatchText)) ?? "", gateIssue);
  assert.equal(issue(65, variant(gravewatchText)), null);
  assert.match(
    issue(
      64,
      variant(gravewatchText, (doc) => (noSold(doc), noService(doc))),
    ) ?? "",
    gateIssue,
    "a market alone",
  );
  assert.match(
    issue(
      64,
      variant(gravewatchText, (doc) => (noMarket(doc), noService(doc))),
    ) ?? "",
    gateIssue,
    "an item's place alone",
  );
  assert.match(
    issue(
      64,
      variant(gravewatchText, (doc) => (noMarket(doc), noSold(doc))),
    ) ?? "",
    gateIssue,
    "a service alone",
  );
  assert.doesNotMatch(
    issue(
      64,
      variant(gravewatchText, (doc) => (noMarket(doc), noSold(doc), noService(doc))),
    ) ?? "",
    gateIssue,
    "none of them",
  );
}

// ── A market day (#6934, 1.69) ──
{
  // Import.
  const day = (edit: (doc: Record<string, any>) => void, pattern: RegExp, what: string) => {
    const parsed = parseRulesetDefinition(variant(gravewatchDayText, edit));
    assert.equal(parsed.ok, false, `${what}: the file should be refused`);
    if (!parsed.ok)
      assert.ok(
        parsed.issues.some((issue) => pattern.test(issue)),
        `${what}: ${parsed.issues.join("; ")}`,
      );
  };
  parsedOrThrow(JSON.parse(gravewatchDayText), "Gravewatch with a market day");
  day(
    (doc) => (doc.items.market.places[0].purse.unit = "florin"),
    /places\.0\.purse\.unit: Unknown currency unit "florin"/,
    "a purse's coin",
  );
  day(
    (doc) => (doc.items.market.sellers[1].stock.table = "nothing"),
    /sellers\.1\.stock\.table: Unknown loot table "nothing"/,
    "a stock table",
  );
  day(
    (doc) => (doc.items.market.sold[0] = { filter: { rarity: "rare" } }),
    /A rule names a place, a limit or both/,
    "a rule naming nothing",
  );
  day((doc) => (doc.items.market.buyBack = 0), /buyBack: Too small: expected number to be >0/, "nothing back");
  day((doc) => (doc.items.market.buyBack = 1.5), /buyBack: Too big: expected number to be <=1/, "more back than paid");
  day((doc) => (doc.items.market.sold[0].limited = 0), /sold\.0\.limited/, "a limit of none");
  const pistolOf = (doc: Record<string, any>) =>
    doc.catalogs
      .find((catalog: { id: string }) => catalog.id === "kit")
      .entries.find((entry: { id: string }) => entry.id === "watch-pistol").item;
  day((doc) => (pistolOf(doc).sold = {}), /Sold names a place, a limit or both/, "an item's sold naming nothing");
  const ownLimit = parsedOrThrow(
    variant(gravewatchDayText, (doc) => (pistolOf(doc).sold = { limited: 1 })),
    "an item's own limit with no place",
  );
  const ownPistol = rulesetItemBook(ownLimit, entriesOf(ownLimit)).itemOf("kit/watch-pistol")!.entry.item!;
  assert.equal(rulesetItemLimit(ownLimit.items!.market!, ownPistol), 1);
  assert.equal(
    rulesetItemSoldRank(ownLimit.items!.market!, ownPistol),
    2,
    "no place of its own: the first rule naming one (rare things, from a market town)",
  );
  // A rule that names only a limit never decides the place, and one that names only a place never the
  // limit: the first rule that names each decides it.
  const arms = { filter: { category: "arm" } };
  const ruled = (sold: Array<Record<string, unknown>>) => ({ ...ownLimit.items!.market!, sold }) as RulesetMarket;
  const plainPistol = { ...ownPistol, sold: undefined };
  assert.equal(
    rulesetItemSoldRank(
      ruled([
        { ...arms, limited: 3 },
        { ...arms, place: "town" },
      ]),
      plainPistol,
    ),
    2,
  );
  assert.equal(
    rulesetItemLimit(
      ruled([
        { ...arms, place: "town" },
        { ...arms, limited: 3 },
      ]),
      plainPistol,
    ),
    3,
  );
  assert.equal(rulesetItemLimit(ruled([{ ...arms, limited: 3 }]), ownPistol), 1, "an item's own limit wins");

  // The 1.69 gate: each key alone.
  const dayIssue = /keeps stock, limits what a place keeps, buys back or has a purse.*capabilityApi 1\.69/;
  const issue = (minor: number, doc: Record<string, any>) =>
    getCapabilityPackageInstallIssue(manifest(minor) as any, doc);
  assert.match(issue(68, JSON.parse(gravewatchDayText)) ?? "", dayIssue);
  assert.equal(issue(69, JSON.parse(gravewatchDayText)), null);
  assert.equal(issue(65, JSON.parse(gravewatchText)), null, "the 1.65 market alone");
  const only = (edit: (market: Record<string, any>, doc: Record<string, any>) => void) =>
    variant(gravewatchText, (doc) => edit(doc.items.market, doc));
  assert.match(
    issue(
      68,
      only((market) => (market.buyBack = 0.5)),
    ) ?? "",
    dayIssue,
    "a buy-back alone",
  );
  assert.match(
    issue(
      68,
      only((market) => (market.places[0].purse = { amount: 1, unit: "penny" })),
    ) ?? "",
    dayIssue,
    "a purse alone",
  );
  assert.match(
    issue(
      68,
      only((market) => (market.sellers[1].stock = { table: "grave_goods" })),
    ) ?? "",
    dayIssue,
    "a stock alone",
  );
  assert.match(
    issue(
      68,
      only((market) => (market.sold[0].limited = 2)),
    ) ?? "",
    dayIssue,
    "a rule's limit alone",
  );
  assert.match(
    issue(
      68,
      only((market) => market.sold.push({ filter: { tag: "silver" }, limited: 1 })),
    ) ?? "",
    dayIssue,
    "a rule with no place",
  );
  assert.match(
    issue(
      68,
      only(
        (_market, doc) =>
          (doc.catalogs
            .find((c: { id: string }) => c.id === "kit")
            .entries.find((e: { id: string }) => e.id === "watch-pistol").item.sold = { limited: 1 }),
      ),
    ) ?? "",
    dayIssue,
    "an item's limit alone",
  );

  // The day: restating the place keeps it, another place or day="new" begins one.
  const sizeOf = (word: string) => rulesetMarketPlace(gravewatch.items!.market!, word);
  assert.equal(
    applyGamePlaceTags('[place: name="Millbrook" size="town" day="new"]', sizeOf).content,
    '[place: name="Millbrook" size="town" day="new" result="ok"]',
  );
  // A world's place keeps day="new" too, so staying in a world town still starts a new day.
  const worldTown = (name: string) => (name === "thornmere" ? { name: "Thornmere", size: "town" } : undefined);
  const worldDay = applyGamePlaceTags('[place: name="thornmere" size="hamlet" day="new"]', sizeOf, worldTown);
  assert.equal(worldDay.content, '[place: name="Thornmere" size="town" day="new" result="ok"]');
  assert.equal(
    gameMarketDayStart(answeredGamePlaces(['[place: name="Thornmere" size="town" result="ok"]', worldDay.content]))
      ?.ordinal,
    1,
    "a new day at a world's place",
  );
  const told = [
    '[place: name="Millbrook" size="town" result="ok"] Morning.',
    '[place: name="Millbrook" size="town" result="ok"] Noon.',
    '[place: name="Barrowmere" size="hamlet" result="ok"] Evening.',
    '[place: name="Barrowmere" size="hamlet" result="ok"] Night. [place: name="Barrowmere" size="hamlet" day="new" result="ok"] Dawn.',
  ];
  const startOf = (texts: string[]) => gameMarketDayStart(answeredGamePlaces(texts));
  assert.equal(startOf(told.slice(0, 2))?.ordinal, 0, "the same place, the same day");
  assert.equal(
    startOf([told[0]!, told[1]!.replace("Millbrook", "MILLBROOK")])?.ordinal,
    0,
    "a place's name in another case",
  );
  assert.equal(startOf(told.slice(0, 3))?.ordinal, 2, "another place, another day");
  assert.equal(startOf(told)?.ordinal, 4, "a new day at the same place");
  assert.equal(startOf(told)?.mark.text, 3);
  assert.equal(
    startOf([told[0]!, '[place: name="Millbrook" size="city" result="ok"]'])?.ordinal,
    1,
    "the same name grown a size",
  );
  assert.equal(startOf([told[0]!, '[place: name="Thornby" size="town" result="ok"]'])?.ordinal, 1, "another town");
  assert.equal(startOf([])?.ordinal, undefined);

  // A fixed day: the smith's odd lot is one watch pistol, and a place keeps two rare things a day.
  const fixed = parsedOrThrow(
    variant(gravewatchDayText, (doc) => {
      doc.items.lootTables.find((table: { id: string }) => table.id === "smiths_odd_lot").entries = [
        { item: "kit/watch-pistol", weight: 1, count: 1 },
      ];
      doc.items.market.sold[0].limited = 2;
    }),
    "a fixed market day",
  );
  const dayBook = rulesetItemBook(fixed, entriesOf(fixed));
  const dayMarket = fixed.items!.market!;
  const dayTown = rulesetMarketPlace(dayMarket, "town")!;
  const dayHamlet = rulesetMarketPlace(dayMarket, "hamlet")!;
  const dayOf = (seen: Partial<RulesetMarketDay> = {}): RulesetMarketDay => ({
    key: "d1",
    bought: new Map(),
    stockBought: new Map(),
    paidOut: new Map(),
    ...seen,
  });
  const dayQuoter = (place = dayTown, seen = dayOf()) =>
    rulesetMarketQuoter(fixed, dayBook, place, () => true, undefined, seen);
  const dayTags = (tag: string, stacks: GameInventoryStack[], at = dayQuoter()) =>
    applyGameInventoryTags(tag, stacks, party, undefined, dayBook, undefined, undefined, at);
  const shelf = rulesetMarketShelf(fixed, dayBook, dayTown, "d1");
  assert.deepEqual(shelf.stock.get("smith"), [{ item: "kit/watch-pistol", name: "Watch pistol", count: 1 }]);
  assert.equal(shelf.stock.has("chandler"), false, "only a seller with a stock table");
  assert.equal(rulesetMarketShelf(fixed, dayBook, dayHamlet, "d1").stock.has("smith"), false, "no smith in a hamlet");
  assert.equal(shelf.limit("kit/silver-nail", dayBook.itemOf("kit/silver-nail")!.entry.item!), 2);
  assert.equal(
    shelf.limit("kit/lantern-coat", dayBook.itemOf("kit/lantern-coat")!.entry.item!),
    undefined,
    "as many as wanted",
  );
  // The real example rolls its shelf by the day: the same day, the same shelf.
  const example = parsedOrThrow(JSON.parse(gravewatchDayText), "Gravewatch");
  const exampleBook = rulesetItemBook(example, entriesOf(example));
  const rolled = (key: string) => {
    const real = rulesetMarketShelf(example, exampleBook, dayTown, key);
    return JSON.stringify([
      real.stock.get("smith"),
      real.limit("kit/silver-nail", dayBook.itemOf("kit/silver-nail")!.entry.item!),
    ]);
  };
  assert.equal(rolled("chat|3|Millbrook|town"), rolled("chat|3|Millbrook|town"));
  // ...and another day, another shelf: both what the smith turns up and how many rare things there are.
  const days = Array.from({ length: 24 }, (_, index) => rulesetMarketShelf(example, exampleBook, dayTown, `d${index}`));
  assert.ok(new Set(days.map((each) => JSON.stringify(each.stock.get("smith")))).size > 1, "the stock");
  assert.ok(
    new Set(days.map((each) => each.limit("kit/silver-nail", dayBook.itemOf("kit/silver-nail")!.entry.item!))).size > 1,
    "the limit",
  );
  const coinLot = parsedOrThrow(
    variant(gravewatchDayText, (doc) => {
      doc.items.lootTables.find((table: { id: string }) => table.id === "smiths_odd_lot").entries = [
        { coins: "shilling", weight: 1, count: 2 },
      ];
    }),
    "a smith whose odd lot is coin",
  );
  assert.deepEqual(
    rulesetMarketShelf(coinLot, rulesetItemBook(coinLot, entriesOf(coinLot)), dayTown, "d1").stock.get("smith"),
    [],
    "coin is never stock",
  );

  // Buying from the smith's stock: the city's pistol in a market town, once.
  const purse = coins([["crowns", "crown", 9]]);
  const pistol = dayTags(
    '[inventory: action="buy" item="Watch pistol"] [inventory: action="buy" item="Watch pistol"]',
    purse,
  );
  assert.match(
    pistol.content,
    /item="Watch pistol" count="1" level="fair" seller="smith" result="ok" now="1" price="3 crowns" stock="true"/,
  );
  assert.match(
    pistol.content,
    /result="ok"[^\]]*\] \[inventory: action="buy" item="Watch pistol" count="1" result="refused" reason="sold-out"\]/,
  );
  assert.match(
    dayTags(
      '[inventory: action="buy" item="Watch pistol"]',
      purse,
      dayQuoter(dayTown, dayOf({ stockBought: new Map([["smith|watch pistol", 1]]) })),
    ).content,
    /reason="sold-out"/,
    "bought earlier today",
  );
  assert.match(
    dayTags('[inventory: action="buy" item="Watch pistol"]', purse, dayQuoter(dayHamlet)).content,
    /reason="not-here"/,
    "no smith in a hamlet",
  );
  assert.match(
    dayTags('[inventory: action="buy" item="Watch pistol" seller="chandler"]', purse).content,
    /reason="not-here"/,
    "the smith's stock is the smith's",
  );
  const choosySmith = parsedOrThrow(
    variant(gravewatchDayText, (doc) => {
      doc.items.lootTables.find((table: { id: string }) => table.id === "smiths_odd_lot").entries = [
        { item: "kit/watch-pistol", weight: 1 },
      ];
      doc.items.market.sellers[1].only = { value: { abilityScore: "nerve" }, atLeast: 3, label: "the steady" };
    }),
    "a choosy smith",
  );
  const choosyBook = rulesetItemBook(choosySmith, entriesOf(choosySmith));
  const choosy = (passes: boolean) =>
    applyGameInventoryTags(
      '[inventory: action="buy" item="Watch pistol"]',
      purse,
      party,
      undefined,
      choosyBook,
      undefined,
      undefined,
      rulesetMarketQuoter(choosySmith, choosyBook, dayTown, () => passes, undefined, dayOf()),
    ).content;
  assert.match(choosy(true), /result="ok"[^\]]*stock="true"/);
  assert.match(choosy(false), /reason="not-to-you"/, "a seller's only on their stock too");
  // Two rare nails a day.
  const nails = dayTags(
    '[inventory: action="buy" item="Silver coffin nail" count="2"] [inventory: action="buy" item="Silver coffin nail"]',
    purse,
  );
  assert.match(nails.content, /count="2" level="fair" seller="smith" result="ok"/);
  assert.match(nails.content, /item="Silver coffin nail" count="1" result="refused" reason="sold-out"\]$/);
  assert.match(
    dayTags(
      '[inventory: action="buy" item="Silver coffin nail"]',
      purse,
      dayQuoter(dayTown, dayOf({ bought: new Map([["silver coffin nail", 2]]) })),
    ).content,
    /reason="sold-out"/,
  );

  // Selling back: half the fair price, up to the place's purse a day.
  const coats = (count: number, holder?: string): GameInventoryStack[] => [
    {
      id: "coat",
      name: "Lantern-keeper's coat",
      item: "kit/lantern-coat",
      quantity: count,
      ...(holder ? { holder } : {}),
    },
  ];
  const sold = dayTags('[inventory: action="sell" item="Lantern-keeper\'s coat"]', coats(1), dayQuoter(dayHamlet));
  assert.match(
    sold.content,
    /action="sell" item="Lantern-keeper's coat" count="1" seller="chandler" result="ok" now="0" price="4 shillings"/,
  );
  assert.deepEqual(held(sold.stacks), [["shillings", 4, ""]]);
  assert.deepEqual(sold.journal, [
    { item: "Lantern-keeper's coat", action: "sold", quantity: 1 },
    { item: "shillings", action: "acquired", quantity: 4 },
  ]);
  // Paid in the coin its price is said in, never a bigger one (laptop playtest 2026-10-25: a 60 gold
  // sale came in as 6 platinum).
  const threeSold = dayTags(
    '[inventory: action="sell" item="Lantern-keeper\'s coat" count="3"]',
    coats(3),
    dayQuoter(dayTown),
  );
  assert.match(threeSold.content, /result="ok"/, threeSold.content);
  assert.deepEqual(held(threeSold.stacks), [["shillings", 12, ""]]);
  // Sold by its ref, it is the coat; and a fake sold by ref is seen through as one sold by name (#8271).
  assert.match(
    dayTags('[inventory: action="sell" item="kit/lantern-coat"]', coats(1), dayQuoter(dayHamlet)).content,
    /item="Lantern-keeper's coat" count="1" seller="chandler" result="ok" now="0" price="4 shillings"/,
  );
  const fakeCoat: GameInventoryStack[] = [{ ...coats(1)[0]!, truly: "kit/warming-tonic" }];
  for (const item of ["Lantern-keeper's coat", "kit/lantern-coat"])
    assert.match(
      dayTags(`[inventory: action="sell" item="${item}"]`, fakeCoat, dayQuoter(dayHamlet)).content,
      /revealed="Warming tonic" result="ok" now="0" price="2 pennies"/,
      item,
    );
  // A hamlet pays out 10 shillings a day: two coats (8), then a third is too much.
  const three = dayTags(
    '[inventory: action="sell" item="Lantern-keeper\'s coat" count="2"] [inventory: action="sell" item="Lantern-keeper\'s coat"]',
    coats(3),
    dayQuoter(dayHamlet),
  );
  assert.match(three.content, /count="2" seller="chandler" result="ok" now="1" price="8 shillings"/);
  assert.match(three.content, /reason="purse-spent"\]$/);
  assert.match(
    dayTags(
      '[inventory: action="sell" item="Lantern-keeper\'s coat"]',
      coats(1),
      dayQuoter(dayHamlet, dayOf({ paidOut: new Map([["coin", 100]]) })),
    ).content,
    /reason="purse-spent"/,
    "paid out earlier today",
  );
  assert.match(
    dayTags('[inventory: action="sell" item="Page of the vigil litany"]', [], dayQuoter(dayHamlet)).content,
    /reason="not-bought"/,
    "nobody here deals in pages",
  );
  assert.match(
    dayTags('[inventory: action="sell" item="Lantern-keeper\'s coat"]', [], dayQuoter(dayHamlet)).content,
    /reason="none-held"/,
  );
  assert.match(
    dayTags('[inventory: action="sell" item="Lantern-keeper\'s coat"]', coats(1, "Bram"), dayQuoter(dayHamlet)).content,
    /reason="none-held"/,
    "out of the seller's own bag: the player's without who",
  );
  const bramSold = dayTags(
    '[inventory: action="sell" item="Lantern-keeper\'s coat" who="Bram"]',
    coats(1, "Bram"),
    dayQuoter(dayHamlet),
  );
  assert.deepEqual(held(bramSold.stacks), [["shillings", 4, "Bram"]]);
  assert.match(
    applyGameInventoryTags(
      '[inventory: action="sell" item="Lantern-keeper\'s coat"]',
      coats(1),
      party,
      undefined,
      book,
      undefined,
      undefined,
      rulesetMarketQuoter(gravewatch, book, town, () => true),
    ).content,
    /reason="not-bought"/,
    "a market that buys nothing back",
  );
  assert.match(
    dayTags('[inventory: action="sell" item="Lantern-keeper\'s coat" seller="smith"]', coats(1)).content,
    /reason="not-bought"/,
    "the smith does not deal in coats",
  );
  assert.match(
    dayTags('[inventory: action="sell" item="A bed at the watch-house"]', []).content,
    /reason="not-for-sale"/,
    "a service is never sold back",
  );
  const short = dayTags('[inventory: action="sell" item="Lantern-keeper\'s coat" count="2"]', coats(1));
  assert.match(short.content, /reason="none-held"/, "two coats sold, one held");
  assert.deepEqual(short.stacks, coats(1), "nothing taken");
  // Coins that will not fit: the coat stays and no coin comes in.
  const heavyCoins = parsedOrThrow(
    variant(gravewatchDayText, (doc) => {
      doc.items.stats.push({ id: "weight", label: "Weight", type: "number", min: 0, max: 100, default: 0 });
      doc.items.carry = { stat: "weight", encumberedAbove: { const: 1 }, limit: { const: 2 } };
      doc.items.currencies[0].perWeight = 1;
    }),
    "Gravewatch whose coins weigh one each",
  );
  const heavyBook = rulesetItemBook(heavyCoins, entriesOf(heavyCoins), {
    sheets: { player: defaultRulesetSheetBuild(heavyCoins) },
  });
  const heavy = applyGameInventoryTags(
    '[inventory: action="sell" item="Lantern-keeper\'s coat"]',
    coats(1),
    party,
    undefined,
    heavyBook,
    undefined,
    undefined,
    rulesetMarketQuoter(heavyCoins, heavyBook, dayHamlet, () => true, undefined, dayOf()),
  );
  assert.match(heavy.content, /reason="too-heavy"/);
  assert.deepEqual(heavy.stacks, coats(1));

  // What the Game Master sees of the day.
  const block = rulesetMarketPromptText(
    fixed,
    dayBook,
    { name: "Millbrook", size: "town" },
    undefined,
    dayOf({ bought: new Map([["silver coffin nail", 1]]) }),
  )!.split("\n");
  assert.equal(
    block[2],
    "- smith: Grave spade 3 shillings, Silver coffin nail 2 crowns (1 left); in stock today: Watch pistol ×1 3 crowns",
  );
  assert.equal(
    block.at(-1),
    "Selling: sellers here buy what they sell at ×0.5 of the fair price, up to 100 shillings a day (100 shillings left today).",
  );
  const later = rulesetMarketPromptText(
    fixed,
    dayBook,
    { size: "hamlet" },
    undefined,
    dayOf({ paidOut: new Map([["coin", 48]]) }),
  )!;
  assert.match(later, /up to 10 shillings a day \(6 shillings left today\)\.$/);
  assert.doesNotMatch(
    rulesetMarketPromptText(
      fixed,
      dayBook,
      { size: "town" },
      undefined,
      dayOf({ stockBought: new Map([["smith|watch pistol", 1]]) }),
    )!,
    /in stock today/,
    "the pistol bought today",
  );
  assert.doesNotMatch(
    rulesetMarketPromptText(gravewatch, book, { size: "town" })!,
    /Selling:|in stock today|left\)/,
    "a 1.65 market says none of it",
  );
  const taught = buildGmFormatReminder({ ruleset: fixed } as Parameters<typeof buildGmFormatReminder>[0]);
  assert.match(taught, /say the place again with day="new"/);
  // A buy before any place is refused, so the place comes first (#8273).
  assert.match(
    taught,
    /Say the place before the first buy or sell there: with no place said, every buy and sell is refused\./,
  );
  assert.match(taught, /\[inventory: action="sell" item="Name" count="1" seller="Seller" who="Name"\]/);
  assert.doesNotMatch(
    buildGmFormatReminder({ ruleset: gravewatch } as Parameters<typeof buildGmFormatReminder>[0]),
    /action="sell"/,
  );
}

// ── The server's place before a reply ──
try {
  const db = await getDB();
  const chats = createChatsStorage(db);
  const chat = await chats.create({ name: "Markets", mode: "game", characterIds: [] });
  await chats.createMessage({
    chatId: chat.id,
    role: "assistant",
    content: 'At the gate. [place: name="Crossroads" size="hamlet" result="ok"]',
  });
  const later = await chats.createMessage({
    chatId: chat.id,
    role: "assistant",
    content: 'On to town. [place: name="Millbrook" size="town" result="ok"]',
  });
  // A place tag a player types, answered or not, is never read: only the Game Master's replies are.
  await chats.createMessage({
    chatId: chat.id,
    role: "user",
    content: 'I look for a smith. [place: name="Anywhere" size="city" result="ok"]',
  });
  assert.deepEqual(await gamePlaceBefore(db, chat.id), { name: "Millbrook", size: "town" });
  await chats.createMessage({
    chatId: chat.id,
    role: "assistant",
    content: 'By ship. [place: name="Grey Harbour" size="city" result="ok"]',
  });
  assert.deepEqual(await gamePlaceBefore(db, chat.id), { name: "Grey Harbour", size: "city" });
  assert.deepEqual(
    await gamePlaceBefore(db, chat.id, later.id),
    { name: "Crossroads", size: "hamlet" },
    "a regeneration reads only what came before the telling it replaces",
  );
  // A conversation start begins the Game Master's context afresh, and the place with it.
  await chats.createMessage({
    chatId: chat.id,
    role: "system",
    content: "A new chapter.",
    extra: { isConversationStart: true },
  });
  assert.equal(await gamePlaceBefore(db, chat.id), null);
  // The world's ledger (worldgen W4) reads every reply: a conversation start scopes what the Game
  // Master reads, not what the story did to the world.
  const replies = await gameRepliesBefore(db, chat.id);
  assert.equal(replies.scoped.length, 0);
  assert.equal(replies.all.length, 3);
  // A seller's `only` is read off the buyer's own card: the player's (the first card, with no
  // persona), a member's by name, and a blank sheet for someone with none (Nerve 2 by default).
  const cards = [
    {
      name: "Ada",
      rulesetSheet: {
        v: 1,
        build: { ...defaultRulesetSheetBuild(gravewatch), abilities: { sinew: 2, nerve: 3, warmth: 2 } },
      },
    },
    {
      name: "Bram",
      rulesetSheet: {
        v: 1,
        build: { ...defaultRulesetSheetBuild(gravewatch), abilities: { sinew: 2, nerve: 1, warmth: 2 } },
      },
    },
  ];
  const game = await chats.create({ name: "Market buyers", mode: "game", characterIds: [] });
  await chats.patchMetadata(game.id, {
    gameRuleset: { id: gravewatch.id, version: gravewatch.version, packageId: null, options: {} },
    gameCharacterCards: cards,
  });
  const resolved = { status: "ok", definition: gravewatch, packageId: null, layers: [], ref: {} } as never;
  const buyers = (await loadGameMarket(db, game.id, resolved, book, { size: "town" }, {}))!();
  const page = (who?: string) =>
    buyers.quote({ item: "Page of the vigil litany", count: 1, ...(who ? { who } : {}), stacks: [] });
  assert.equal(page().ok, true, "the player (Ada, Nerve 3)");
  assert.equal(page("Ada").ok, true, "the player by name");
  assert.deepEqual(page("Bram"), { ok: false, reason: "not-to-you" }, "Bram, Nerve 1");
  assert.deepEqual(page("Cleo"), { ok: false, reason: "not-to-you" }, "a blank sheet, Nerve 2");
  assert.equal(
    await loadGameMarket(db, game.id, resolved, book, null, {}).then(
      (m) => m?.().quote({ item: "Warming tonic", count: 1, stacks: [] }).ok,
    ),
    false,
  );
  // With a persona who has no card of their own name, the player is still the first card: named
  // by the persona, they buy with Ada's sheet.
  const wren = await createCharactersStorage(db).createPersona("Wren", "The player");
  await chats.update(game.id, { personaId: wren.id });
  const asPersona = (await loadGameMarket(db, game.id, resolved, book, { size: "town" }, {}))!();
  assert.equal(asPersona.quote({ item: "Page of the vigil litany", count: 1, who: "Wren", stacks: [] }).ok, true);
  // `only` reads the live state the turn hands it: a chapel that asks for Resolve left sells to Ada
  // with 3 and not with 1.
  const resolveChapel = parsedOrThrow(
    variant(gravewatchText, (doc) => {
      doc.items.market.sellers[2].only = {
        value: { livePool: "resolve" },
        atLeast: 2,
        label: "wardens with Resolve left",
      };
    }),
    "a chapel that asks for Resolve",
  );
  const resolveBook = rulesetItemBook(resolveChapel, entriesOf(resolveChapel));
  const resolvedChapel = { status: "ok", definition: resolveChapel, packageId: null, layers: [], ref: {} } as never;
  const withResolve = async (value: number) =>
    (await loadGameMarket(
      db,
      game.id,
      resolvedChapel,
      resolveBook,
      { size: "town" },
      {
        ada: { pools: { resolve: { value } } },
      },
    ))!().quote({ item: "Page of the vigil litany", count: 1, who: "Ada", stacks: [] });
  assert.equal((await withResolve(3)).ok, true);
  assert.deepEqual(await withResolve(1), { ok: false, reason: "not-to-you" });

  // The market day before a reply: begun by the last place tag that changed the place or said
  // day="new", named by the chat, that tag's count among place tags and the place, and counting the
  // buys and sales the Engine answered after it.
  const daily = await chats.create({ name: "Market days", mode: "game", characterIds: [] });
  const say = (content: string, role: "assistant" | "user" = "assistant") =>
    chats.createMessage({ chatId: daily.id, role, content });
  const nail =
    '[inventory: action="buy" item="Silver coffin nail" count="1" level="fair" seller="smith" result="ok" now="1" price="2 crowns"]';
  await say(`${nail} On to town. [place: name="Millbrook" size="town" result="ok"]`);
  await say(
    '[inventory: action="buy" item="Watch pistol" count="1" level="fair" seller="smith" result="ok" now="1" price="3 crowns" stock="true"] ' +
      '[inventory: action="buy" item="Watch pistol" count="1" result="refused" reason="sold-out"] ' +
      '[inventory: action="sell" item="Lantern-keeper\'s coat" count="2" seller="chandler" result="ok" now="0" price="8 shillings"]',
  );
  await say(`I buy a nail. ${nail}`, "user");
  const stay = await say(`[place: name="Millbrook" size="town" result="ok"] Still in town. ${nail}`);
  const dayBefore = (replacing?: string, reply?: string) => gameMarketDayFor(db, daily.id, replacing, reply, book);
  const seen = (day: RulesetMarketDay) => [day.key, [...day.bought], [...day.stockBought], [...day.paidOut]];
  const today = await dayBefore();
  assert.deepEqual(today.place, { name: "Millbrook", size: "town" });
  assert.deepEqual(
    seen(today.day),
    [`${daily.id}|0|Millbrook|town`, [["silver coffin nail", 1]], [["smith|watch pistol", 1]], [["coin", 96]]],
    "the nail before the town, the refused pistol and the player's own tag are not the day's",
  );
  assert.deepEqual(
    seen((await dayBefore(undefined, `${nail} [place: name="Millbrook" size="town" result="ok"]`)).day),
    seen(today.day),
    "a reply's own buys are counted as it is read, and saying the place again keeps the day",
  );
  assert.deepEqual(
    seen((await dayBefore(stay.id)).day).slice(1),
    [[], [["smith|watch pistol", 1]], [["coin", 96]]],
    "a regeneration",
  );
  const dawn = await dayBefore(undefined, '[place: name="Millbrook" size="town" day="new" result="ok"] Dawn.');
  assert.deepEqual(seen(dawn.day), [`${daily.id}|2|Millbrook|town`, [], [], []], "a new day at the same place");
  assert.equal(
    (await dayBefore(stay.id, '[place: name="Millbrook" size="town" day="new" result="ok"]')).day.key,
    `${daily.id}|1|Millbrook|town`,
  );
  const away = await dayBefore(undefined, '[place: name="Barrowmere" size="hamlet" result="ok"]');
  assert.deepEqual(
    [away.place, seen(away.day)],
    [{ name: "Barrowmere", size: "hamlet" }, [`${daily.id}|2|Barrowmere|hamlet`, [], [], []]],
  );
  // Where the world has the party at the place a tag began the day at, the tag's day is the one in force.
  const sameAsTag = await gameMarketDayFor(db, daily.id, undefined, undefined, book, {
    name: "millbrook",
    size: "town",
  });
  assert.deepEqual([sameAsTag.day.key, sameAsTag.worldPlace], [`${daily.id}|0|Millbrook|town`, undefined]);
  const quiet = await chats.create({ name: "No place yet", mode: "game", characterIds: [] });
  assert.deepEqual(await gameMarketDayFor(db, quiet.id, null, undefined, book), {
    place: null,
    day: {
      key: "",
      bought: new Map(),
      stockBought: new Map(),
      paidOut: new Map(),
      warned: new Set(),
      inspected: new Set(),
    },
  });
  // A place the world set (no place tag began a day there): its day runs over the replies in a row
  // whose turns were there, each stamped so on its extra, and counts what they bought; a turn anywhere
  // else ends it, so coming back is a new day.
  {
    const mapped = await chats.create({ name: "World market", mode: "game", characterIds: [] });
    const town = { name: "Ashford", size: "town" as const };
    const at = `world|ashford|town`;
    const reply = (content: string, stamp?: string | null) =>
      chats.createMessage({
        chatId: mapped.id,
        role: "assistant",
        content,
        ...(stamp !== undefined ? { extra: { gameMarketPlace: stamp } } : {}),
      } as never);
    const pistol =
      '[inventory: action="buy" item="Watch pistol" count="1" level="fair" seller="smith" result="ok" now="1" price="3 crowns" stock="true"]';
    const worldDay = (replacing?: string) => gameMarketDayFor(db, mapped.id, replacing, undefined, book, town);
    // Before any turn there: a day of nothing bought, named for the reply that begins it.
    const fresh = await worldDay();
    assert.deepEqual(
      [fresh.place, fresh.worldPlace, seen(fresh.day)],
      [town, at, [`${mapped.id}|${at}|start`, [], [], []]],
    );
    await reply(`We arrive. ${pistol}`, at);
    const bought = await reply(`Still here. ${nail}`, at);
    const held = await worldDay();
    assert.deepEqual(
      seen(held.day),
      [`${mapped.id}|${at}|start`, [["silver coffin nail", 1]], [["smith|watch pistol", 1]], []],
      "the day keeps its name and counts every turn's buys there",
    );
    assert.deepEqual(
      seen((await worldDay(bought.id)).day).slice(1, 3),
      [[], [["smith|watch pistol", 1]]],
      "a regeneration",
    );
    // A turn somewhere else ends the day; back again, a new one begins with nothing bought.
    const road = await reply("On the road.", null);
    const back = await worldDay();
    assert.deepEqual(seen(back.day), [`${mapped.id}|${at}|${road.id}`, [], [], []], "named by the reply before it");
    // A place tag answered while the world keeps the party here begins a day of its own: the world's day
    // runs on from after it.
    const named = await reply('They call it Millbrook. [place: name="Millbrook" size="town" result="ok"]', at);
    assert.deepEqual(seen((await worldDay()).day)[0], `${mapped.id}|${at}|${named.id}`);
    await reply(`Back in town. ${pistol}`, at);
    assert.deepEqual(seen((await worldDay()).day).slice(0, 3), [
      `${mapped.id}|${at}|${named.id}`,
      [],
      [["smith|watch pistol", 1]],
    ]);
    // A reply deleted inside the day neither renames it nor loses the others' buys.
    const idle = await reply("They wait.", at);
    await reply(`Another. ${pistol}`, at);
    await chats.removeMessage(idle.id);
    assert.deepEqual(seen((await worldDay()).day).slice(0, 3), [
      `${mapped.id}|${at}|${named.id}`,
      [],
      [["smith|watch pistol", 2]],
    ]);
  }
} finally {
  await closeDB();
  rmSync(dataDir, { recursive: true, force: true });
}

console.info("game ruleset markets regressions passed.");
