/**
 * Spotting fakes (Capability API 1.802).
 *
 *   - Schema and gate: a fake's `tells` and `foolsReveal`, a dishonest seller's `manner`, and the items
 *     block's `namesItAt`, `passiveBase`, `warnBy` and `revealsFakes`, gated at 1.802; tells only on a
 *     fake, a way of seeing through fakes reading only fakes, foolsReveal naming only such ways.
 *   - About to be bought: a fake is weighed by every other member of the party with no dice, and a buy
 *     somebody noticed is held unpaid for their warning; asked again that day, it goes through.
 *   - Inspected: the best check the looker can make, rolled; suspect, named past `namesItAt`, a real
 *     item reading genuine; one try each, kept on the stack and in the day.
 *   - A way of seeing through fakes cast on an item: any fake, or only the tags or items it names, and
 *     never one whose foolsReveal names it.
 *   - The Game Master's market block teaches the inspect tag and the held buy, only where fakes can be
 *     spotted.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  applyGameInventoryTags,
  defaultRulesetSheetBuild,
  gameInventoryTotals,
  inspectRulesetItem,
  noticeRulesetFake,
  normalizeGameInventoryStacks,
  parseRulesetDefinition,
  readResolvedInventoryTags,
  revealRulesetFake,
  rulesetItemBook,
  rulesetMarketPlace,
  rulesetMarketPromptText,
  rulesetMarketQuoter,
  rulesetMarketStockKey,
  type GameInventoryStack,
  type RulesetCatalogEntry,
  type RulesetDefinition,
  type RulesetMarketDay,
  type RulesetSpotter,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-fake-spotting-"));
process.env.DATA_DIR = dataDir;
process.env.MARINARA_DATA_DIR = dataDir;

const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
  const gravewatchText = read("../../docs/examples/rulesets/gravewatch.json");
  const kitOf = (doc: Record<string, any>) => doc.catalogs.find((catalog: { id: string }) => catalog.id === "kit");
  const entryOf = (doc: Record<string, any>, id: string) =>
    kitOf(doc).entries.find((entry: { id: string }) => entry.id === id);
  /** Gravewatch with a fence whose stock is always two bitter tonics passed off as warming tonics. A
   *  bitter tonic gives itself away to Nerve 4 (a pool's number, so passives start from 0), and the fence
   *  to Warmth 6. Truesight sees through any fake, Ash-sight only the bitter tonic. */
  const spotting = (edit: (doc: Record<string, any>) => void = () => {}) => {
    const doc = JSON.parse(gravewatchText) as Record<string, any>;
    kitOf(doc).entries.push({
      id: "bitter-tonic",
      label: "Bitter tonic",
      item: {
        category: "tonic",
        passesFor: "kit/warming-tonic",
        cost: { amount: 1, unit: "penny" },
        tells: [{ check: { ability: "nerve" }, dc: 4, says: "it smells of nightshade, not ginger" }],
      },
    });
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
      manner: { check: { ability: "warmth" }, dc: 6, says: "the fence will not meet anyone's eye" },
    });
    doc.items.passiveBase = 0;
    doc.items.namesItAt = 1;
    doc.items.revealsFakes = [
      { id: "truesight", label: "Truesight" },
      { id: "ash_sight", label: "Ash-sight", items: ["kit/bitter-tonic"] },
      { id: "poison_sense", label: "Poison sense", tags: ["poison"] },
    ];
    edit(doc);
    return doc;
  };
  const parsedOrThrow = (document: unknown): RulesetDefinition => {
    const parsed = parseRulesetDefinition(document);
    assert.ok(parsed.ok, parsed.ok ? "" : parsed.issues.join("; "));
    return parsed.definition;
  };
  const entriesOf = (definition: RulesetDefinition): Record<string, RulesetCatalogEntry[]> =>
    Object.fromEntries(
      (definition.catalogs ?? []).flatMap((catalog) =>
        catalog.entries && catalog.holds === "items" ? [[catalog.id, catalog.entries]] : [],
      ),
    );

  // ── Schema ──
  const definition = parsedOrThrow(spotting());
  const book = rulesetItemBook(definition, entriesOf(definition));
  {
    for (const edit of [
      (doc: Record<string, any>) => (entryOf(doc, "bitter-tonic").item.tells[0].says = "[it is poison]"),
      (doc: Record<string, any>) => (entryOf(doc, "bitter-tonic").item.tells = []),
      (doc: Record<string, any>) => (doc.items.warnBy = "glance"),
      (doc: Record<string, any>) => (doc.items.revealsFakes[0].tags = []),
    ]) {
      assert.equal(parseRulesetDefinition(spotting(edit)).ok, false);
    }
  }

  // ── The 1.802 gate ──
  {
    const manifest = (minor: number) => ({
      schemaVersion: 2,
      capabilityApi: { major: 1, minor },
      builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
      id: "ruleset-spotting",
      name: "Spotting",
      version: "0.1.0",
      description: "A packaged ruleset whose fakes can be spotted.",
      engine: { min: "2.4.6", maxExclusive: "4.0.0" },
      kind: ["ruleset"],
      entrypoints: {},
      contributions: { assets: { paths: ["ruleset.json"] } },
      files: [{ path: "ruleset.json", sha256: "0".repeat(64), bytes: 10 }],
      permissions: [],
      restartRequired: false,
    });
    const gate = /fakes can be spotted.*capabilityApi 1\.802/;
    const issue = (minor: number, doc: Record<string, any>) =>
      getCapabilityPackageInstallIssue(manifest(minor) as any, doc);
    assert.match(issue(801, spotting()) ?? "", gate);
    assert.equal(issue(802, spotting()), null);
    // Each key alone is 1.802's.
    const bare = (doc: Record<string, any>) => {
      delete entryOf(doc, "bitter-tonic").item.tells;
      delete doc.items.market.sellers.find((seller: { id: string }) => seller.id === "fence").manner;
      for (const key of ["passiveBase", "namesItAt", "revealsFakes"]) delete doc.items[key];
    };
    assert.equal(issue(801, spotting(bare)), null);
    for (const edit of [
      (doc: Record<string, any>) =>
        (entryOf(doc, "bitter-tonic").item.tells = [{ check: { ability: "nerve" }, dc: 4, says: "x" }]),
      (doc: Record<string, any>) =>
        (doc.items.market.sellers.find((seller: { id: string }) => seller.id === "fence").manner = {
          check: { ability: "warmth" },
          dc: 6,
          says: "x",
        }),
      (doc: Record<string, any>) => (doc.items.warnBy = "roll"),
      (doc: Record<string, any>) => (doc.items.revealsFakes = [{ id: "truesight", label: "Truesight" }]),
    ]) {
      assert.match(
        issue(
          800,
          spotting((doc) => {
            bare(doc);
            edit(doc);
          }),
        ) ?? "",
        gate,
      );
    }
    // Tells read only a fake; a way reads only fakes; foolsReveal names only such ways.
    assert.match(
      issue(
        801,
        spotting(
          (doc) => (entryOf(doc, "warming-tonic").item.tells = [{ check: { ability: "nerve" }, dc: 4, says: "x" }]),
        ),
      ) ?? "",
      /"kit\/warming-tonic" has tells or foolsReveal but is no fake/,
    );
    assert.match(
      issue(
        801,
        spotting((doc) => (doc.items.revealsFakes[1].items = ["kit/warming-tonic"])),
      ) ?? "",
      /reads "kit\/warming-tonic": it is no fake/,
    );
    assert.match(
      issue(
        801,
        spotting((doc) => (entryOf(doc, "bitter-tonic").item.foolsReveal = ["sight"])),
      ) ?? "",
      /fools "sight": it is none of items.revealsFakes/,
    );
    assert.match(
      issue(
        801,
        spotting((doc) => (entryOf(doc, "bitter-tonic").item.tells[0].carries = { anyOf: ["kit/bottled-sunlight"] })),
      ) ?? "",
      /carries "kit\/bottled-sunlight": it is no item/,
    );
  }

  // ── The party ──
  const build = (nerve: number, warmth = 2) => {
    const base = defaultRulesetSheetBuild(definition);
    return { ...base, abilities: { ...base.abilities, nerve, warmth } };
  };
  const wren: RulesetSpotter = { name: "Wren", build: build(1), live: undefined, holder: undefined };
  const juno: RulesetSpotter = { name: "Juno", build: build(5), live: undefined, holder: "Juno" };
  const party = { members: ["Juno"] };
  const coins = (count: number): GameInventoryStack[] => [
    { id: "c0", name: "shillings", item: "coin:shilling", quantity: count },
  ];

  // ── Noticing, with no dice ──
  {
    const roll = () => assert.fail("a passive score throws no dice");
    const notice = (spotters: RulesetSpotter[]) =>
      noticeRulesetFake({ definition, book, stacks: [], spotters, truly: "kit/bitter-tonic", roll });
    // Juno's Nerve 5 meets 4; Wren's 1 does not.
    assert.deepEqual(notice([juno]), { who: "Juno", says: "it smells of nightshade, not ginger" });
    assert.equal(notice([wren]), undefined);
    // The fence's manner, Warmth 6, is met by somebody warm enough, and it says something is off.
    const warm = { ...wren, name: "Ama", build: build(1, 6) };
    const fence = definition.items!.market!.sellers!.find((seller) => seller.id === "fence")!;
    assert.deepEqual(
      noticeRulesetFake({
        definition,
        book,
        stacks: [],
        spotters: [warm],
        truly: "kit/bitter-tonic",
        manner: fence.manner,
        roll,
      }),
      { who: "Ama", says: "the fence will not meet anyone's eye" },
    );
    // A tell that needs a kit the spotter does not carry is never theirs to make.
    const kitted = parsedOrThrow(
      spotting((doc) => (entryOf(doc, "bitter-tonic").item.tells[0].carries = { anyOf: ["kit/lantern-coat"] })),
    );
    const kittedBook = rulesetItemBook(kitted, entriesOf(kitted));
    const kittedNotice = (stacks: GameInventoryStack[]) =>
      noticeRulesetFake({
        definition: kitted,
        book: kittedBook,
        stacks,
        spotters: [juno],
        truly: "kit/bitter-tonic",
        roll,
      });
    assert.equal(kittedNotice([]), undefined);
    assert.equal(
      kittedNotice([{ id: "k1", name: "Lantern coat", item: "kit/lantern-coat", quantity: 1, holder: "Juno" }])?.who,
      "Juno",
    );
  }

  // ── A buy held for a warning ──
  const market = definition.items!.market!;
  const town = rulesetMarketPlace(market, "market town")!;
  const newDay = (): RulesetMarketDay => ({
    key: "spotting-day",
    bought: new Map(),
    stockBought: new Map(),
    paidOut: new Map(),
  });
  const spottingOf = (spotters: RulesetSpotter[]) => ({
    spotters,
    spotterOf: (who: string | undefined) => (who ? spotters.find((each) => each.name === who) : spotters[0]),
    seed: "spotting-chat",
  });
  const party2 = spottingOf([wren, juno]);
  const quoter = (day = newDay(), spotters = party2) =>
    rulesetMarketQuoter(definition, book, town, () => true, undefined, day, spotters);
  const run = (tag: string, stacks: GameInventoryStack[], at = quoter()) =>
    applyGameInventoryTags(tag, stacks, party, undefined, book, undefined, undefined, at);
  const buyTag = '[inventory: action="buy" item="Warming tonic" count="1" seller="fence"]';
  {
    // Wren buys from the fence: Juno noticed, nothing is paid, and the answer says what she saw.
    const held = run(buyTag, coins(5));
    const [answer] = readResolvedInventoryTags(held.content);
    assert.deepEqual([answer?.ok, answer?.reason, answer?.seller], [false, "held", "fence"], held.content);
    assert.equal(answer?.note, "Juno noticed: it smells of nightshade, not ginger");
    assert.deepEqual(held.stacks, coins(5), "a held buy pays nothing");
    assert.ok(!/bitter/i.test(held.content), "a held buy never names the fake");
    // Asked again in the same reply, it goes through: the buyer was warned and chose.
    const twice = run(`${buyTag}\n${buyTag}`, coins(5));
    const answers = readResolvedInventoryTags(twice.content);
    assert.deepEqual(
      answers.map((each) => [each.ok, each.reason ?? null]),
      [
        [false, "held"],
        [true, null],
      ],
    );
    assert.equal(twice.stacks.find((stack) => stack.item === "kit/warming-tonic")?.truly, "kit/bitter-tonic");
    // And in a later reply the same day, as the day's count of held buys says.
    const warned = { ...newDay(), warned: new Set([rulesetMarketStockKey("fence", "Warming tonic")]) };
    assert.equal(readResolvedInventoryTags(run(buyTag, coins(5), quoter(warned)).content)[0]?.ok, true);
    // Juno buying: Wren notices nothing, so it goes through.
    const junoBuys = run('[inventory: action="buy" item="Warming tonic" count="1" seller="fence" who="Juno"]', [
      ...coins(5),
      { id: "c1", name: "shillings", item: "coin:shilling", quantity: 5, holder: "Juno" },
    ]);
    assert.equal(readResolvedInventoryTags(junoBuys.content)[0]?.ok, true, junoBuys.content);
    // A real tonic from the honest chandler is never held, and nor is a buy with nobody to notice.
    assert.equal(
      readResolvedInventoryTags(
        run('[inventory: action="buy" item="Warming tonic" seller="chandler"]', coins(5)).content,
      )[0]?.ok,
      true,
    );
    assert.equal(
      readResolvedInventoryTags(run(buyTag, coins(5), quoter(newDay(), spottingOf([wren]))).content)[0]?.ok,
      true,
    );
    // Without spotting (an older Engine's market), a fake's buy goes through as before.
    const plain = rulesetMarketQuoter(definition, book, town, () => true, undefined, newDay());
    assert.equal(readResolvedInventoryTags(run(buyTag, coins(5), plain).content)[0]?.ok, true);
  }
  {
    // warnBy "roll": each check rolled, with the day's dice, never a passive score.
    const rolled = parsedOrThrow(spotting((doc) => (doc.items.warnBy = "roll")));
    const rolledBook = rulesetItemBook(rolled, entriesOf(rolled));
    let thrown = 0;
    noticeRulesetFake({
      definition: rolled,
      book: rolledBook,
      stacks: [],
      spotters: [juno],
      truly: "kit/bitter-tonic",
      roll: () => {
        thrown += 1;
        return 9;
      },
    });
    assert.ok(thrown > 0, "warnBy roll throws dice");
  }

  // ── Inspected ──
  const fakeStack: GameInventoryStack = {
    id: "f1",
    name: "Warming tonic",
    item: "kit/warming-tonic",
    quantity: 1,
    truly: "kit/bitter-tonic",
  };
  const realStack: GameInventoryStack = { id: "r1", name: "Warming tonic", item: "kit/warming-tonic", quantity: 1 };
  {
    const look = (spotter: RulesetSpotter, face: number, truly?: string, on = definition, onBook = book) =>
      inspectRulesetItem({
        definition: on,
        book: onBook,
        stacks: [],
        spotter,
        item: "kit/warming-tonic",
        ...(truly ? { truly } : {}),
        roll: () => face,
      });
    // Juno's five dice all landing: far past the tell, so named; with no namesItAt, only suspect.
    assert.equal(look(juno, 9, "kit/bitter-tonic")?.found, "named");
    assert.equal(look(juno, 9, "kit/bitter-tonic")?.says, "it smells of nightshade, not ginger");
    const unnamed = parsedOrThrow(spotting((doc) => delete doc.items.namesItAt));
    assert.equal(
      look(juno, 9, "kit/bitter-tonic", unnamed, rulesetItemBook(unnamed, entriesOf(unnamed)))?.found,
      "fake",
    );
    // Every die missing: they cannot tell.
    assert.equal(look(juno, 2, "kit/bitter-tonic")?.found, "unsure");
    // A real tonic rolls its fakes' tells, the same check, and reads genuine.
    const real = look(juno, 9);
    assert.deepEqual([real?.found, real?.check], ["genuine", "Nerve"]);
    // An item no fake passes for has nothing to check it by.
    assert.equal(
      inspectRulesetItem({ definition, book, stacks: [], spotter: juno, item: "kit/lantern-coat", roll: () => 9 }),
      null,
    );
  }
  {
    // The tag on a carried stack: rolled with the day's dice, kept on the stack, one try each.
    const looked = run('[inventory: action="inspect" item="Warming tonic"]', [...coins(5), fakeStack]);
    const [answer] = readResolvedInventoryTags(looked.content);
    assert.equal(answer?.ok, true, looked.content);
    assert.ok(["fake", "named", "unsure"].includes(answer!.found!), looked.content);
    assert.match(answer!.note ?? "", /^Wren looks Warming tonic over: Nerve \d+ against \d+, /);
    const after = looked.stacks.find(
      (stack) => stack.id === "f1" || (stack.truly === undefined && stack.item === "kit/bitter-tonic"),
    );
    assert.ok(after, looked.content);
    if (answer!.found === "named") assert.equal(after!.item, "kit/bitter-tonic");
    else assert.deepEqual(after!.inspected, ["wren"]);
    if (answer!.found === "fake") assert.equal(after!.suspect, "Wren");
    // The same roll for the same look all day.
    assert.equal(
      run('[inventory: action="inspect" item="Warming tonic"]', [...coins(5), fakeStack]).content,
      looked.content,
    );
    // Tried once, not again.
    const tried = { ...fakeStack, inspected: ["wren"] };
    assert.equal(
      readResolvedInventoryTags(run('[inventory: action="inspect" item="Warming tonic"]', [tried]).content)[0]?.reason,
      "tried",
    );
    // Somebody with no sheet cannot look; without spotting nobody can.
    assert.equal(
      readResolvedInventoryTags(
        run('[inventory: action="inspect" item="Warming tonic" who="Nobody"]', [fakeStack]).content,
      )[0]?.reason,
      "unknown-character",
    );
    const plain = rulesetMarketQuoter(definition, book, town, () => true, undefined, newDay());
    assert.equal(
      readResolvedInventoryTags(
        run('[inventory: action="inspect" item="Warming tonic"]', [fakeStack], plain).content,
      )[0]?.reason,
      "cannot-inspect",
    );
  }
  {
    // A seller's ware, before it is bought: the fence's shows the fake, once a day for each looker.
    const day = newDay();
    const at = quoter(day);
    const first = run('[inventory: action="inspect" item="Warming tonic" seller="fence" who="Juno"]', coins(5), at);
    const [answer] = readResolvedInventoryTags(first.content);
    assert.deepEqual([answer?.ok, answer?.seller, answer?.who], [true, "fence", "Juno"], first.content);
    assert.deepEqual(first.stacks, coins(5), "a look at a ware changes no bag");
    const again = run('[inventory: action="inspect" item="Warming tonic" seller="fence" who="Juno"]', coins(5), at);
    assert.equal(readResolvedInventoryTags(again.content)[0]?.reason, "tried");
    // The honest chandler's ware is the real thing.
    const honest = run('[inventory: action="inspect" item="Warming tonic" seller="chandler" who="Juno"]', coins(5));
    assert.ok(["genuine", "unsure"].includes(readResolvedInventoryTags(honest.content)[0]!.found!), honest.content);
  }

  // ── Seeing through fakes ──
  {
    const way = (id: string) => definition.items!.revealsFakes!.find((each) => each.id === id)!;
    assert.equal(revealRulesetFake(book, way("truesight"), "kit/bitter-tonic"), "named");
    assert.equal(revealRulesetFake(book, way("truesight"), undefined), "genuine");
    assert.equal(revealRulesetFake(book, way("ash_sight"), "kit/bitter-tonic"), "named");
    assert.equal(revealRulesetFake(book, way("ash_sight"), undefined), "unsure");
    assert.equal(revealRulesetFake(book, way("poison_sense"), "kit/bitter-tonic"), "unsure");
    const fooled = parsedOrThrow(spotting((doc) => (entryOf(doc, "bitter-tonic").item.foolsReveal = ["truesight"])));
    assert.equal(
      revealRulesetFake(rulesetItemBook(fooled, entriesOf(fooled)), way("truesight"), "kit/bitter-tonic"),
      "genuine",
    );
    // Cast with the tag: named and shown for what it is, as often as it is cast, and never a try.
    const cast = run('[inventory: action="inspect" item="Warming tonic" with="Truesight"]', [fakeStack]);
    const [answer] = readResolvedInventoryTags(cast.content);
    assert.deepEqual([answer?.ok, answer?.found, answer?.revealed], [true, "named", "Bitter tonic"], cast.content);
    assert.deepEqual(
      cast.stacks.map((stack) => [stack.item, stack.truly ?? null]),
      [["kit/bitter-tonic", null]],
    );
    const onReal = run('[inventory: action="inspect" item="Warming tonic" with="truesight"]', [
      { ...realStack, inspected: ["wren"] },
    ]);
    assert.equal(readResolvedInventoryTags(onReal.content)[0]?.found, "genuine", onReal.content);
    assert.equal(
      readResolvedInventoryTags(
        run('[inventory: action="inspect" item="Warming tonic" with="Second sight"]', [fakeStack]).content,
      )[0]?.reason,
      "cannot-reveal",
    );
  }

  // ── Suspect, kept and shown ──
  {
    const kept = normalizeGameInventoryStacks([{ ...fakeStack, inspected: ["Wren", " "], suspect: "Juno" }]);
    assert.deepEqual([kept[0]!.inspected, kept[0]!.suspect], [["wren"], "Juno"]);
    assert.equal(gameInventoryTotals(kept)[0]?.suspect, "Juno");
  }

  // ── The Game Master's block ──
  {
    const block = rulesetMarketPromptText(definition, book, { name: "Barrowmere", size: "market town" })!;
    assert.match(block, /\[inventory: action="inspect" item="<its name>" who="<who looks>" seller="<the seller>"\]/);
    assert.match(block, /Truesight, Ash-sight, Poison sense\): the same tag with with="<its name>"/);
    assert.match(block, /A buy answered "held" was not paid.*unless their nature is to say it openly/);
    // Taught where there is no market too, and nowhere fakes cannot be spotted.
    assert.match(rulesetMarketPromptText(definition, book, null)!, /action="inspect"/);
    const none = parsedOrThrow(
      spotting((doc) => {
        delete entryOf(doc, "bitter-tonic").item.tells;
        delete doc.items.revealsFakes;
      }),
    );
    assert.doesNotMatch(
      rulesetMarketPromptText(none, rulesetItemBook(none, entriesOf(none)), {
        name: "Barrowmere",
        size: "market town",
      })!,
      /inspect|held/,
    );
  }

  console.log("Fake spotting: gate, a held buy warned with no dice, inspection, ways of seeing through, prompt.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
