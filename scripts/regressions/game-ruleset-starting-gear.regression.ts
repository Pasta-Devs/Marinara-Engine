/**
 * Starting gear (P1-6, Capability API 1.78): gear a character may take into their bag at the start,
 * never on its own.
 *
 *   - The schema: lines of the ruleset's items, coins, one of a list, or a plain item; choices of
 *     options; `fits` read off the sheet; every item, coin and word checked at import; the 1.78 gate.
 *   - The resolver: every choice needs an option, every list a pick that is one of it and one of the
 *     game's own items; lines merge by item; what a layer took out of the game is left out and named.
 *   - The route: into one bag, all of it or none of it, once for each group unless asked again, armor
 *     put on as it is taken, the journal and the marker written with the items, the holder one of the
 *     party.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  defaultRulesetSheetBuild,
  parseRulesetDefinition,
  resolveRulesetStartingGear,
  rulesetItemBook,
  rulesetStartingGearFits,
  rulesetStartingGearKind,
  rulesetStartingGearTakenBy,
  type GameInventoryStack,
  type RulesetCatalogEntry,
  type RulesetDefinition,
  type RulesetItemBook,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-ruleset-starting-gear-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");

const { default: Fastify } = await import("../../packages/server/node_modules/fastify/fastify.js");
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createGameStateStorage } = await import("../../packages/server/src/services/storage/game-state.storage.js");
const { createGameRulesetsStorage } =
  await import("../../packages/server/src/services/storage/game-rulesets.storage.js");
const { gameInventoryRoutes } = await import("../../packages/server/src/routes/game-inventory.routes.js");
const { readGameStartingGearTaken } =
  await import("../../packages/server/src/services/game/game-starting-gear.service.js");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

const db = await getDB();
const app = Fastify();
app.decorate("db", db);
await app.register(gameInventoryRoutes, { prefix: "/game/inventory" });

try {
  const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
  const emberText = read("../../docs/examples/rulesets/ember-roads.json");
  /** Ember Roads with a traveller's gear (two choices) and a background's (a plain item and salt). */
  const withGear = (edit: (doc: Record<string, any>) => void = () => {}) => {
    const doc = JSON.parse(emberText) as Record<string, any>;
    doc.items.startingGear = [
      {
        id: "traveller",
        label: "Traveller",
        group: "calling",
        fits: { value: { field: "toughness" }, atLeast: 2 },
        lines: [
          { coins: "mark", count: 5 },
          { item: "outfitter/road-rations", count: 3 },
        ],
        choices: [
          {
            label: "Weapon",
            options: [
              { label: "A hand axe", lines: [{ item: "outfitter/hand-axe" }] },
              {
                label: "A hunting bow",
                lines: [{ item: "outfitter/hunting-bow" }, { item: "outfitter/arrows", count: 20 }],
              },
            ],
          },
          {
            label: "Protection",
            options: [
              { label: "A leather coat", lines: [{ item: "outfitter/leather-coat", equip: true }] },
              { label: "A second weapon", lines: [{ oneOf: ["outfitter/hand-axe", "outfitter/boar-spear"] }] },
            ],
          },
        ],
      },
      {
        id: "pilgrim",
        label: "Pilgrim",
        group: "background",
        lines: [
          { name: "Lucky charm", count: 1 },
          { coins: "pinch", count: 10 },
        ],
      },
      { id: "hoarder", label: "Hoarder", group: "calling", lines: [{ item: "outfitter/road-rations", count: 13 }] },
      { id: "drifter", label: "Drifter", group: "calling", lines: [{ coins: "bit", count: 3 }] },
    ];
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
  const ember = parsedOrThrow(withGear());
  const book = rulesetItemBook(ember, entriesOf(ember));

  // ── The schema ──
  {
    const gear = (doc: Record<string, any>) => doc.items.startingGear[0];
    for (const [edit, message] of [
      [(doc: Record<string, any>) => (gear(doc).lines[1].item = "outfitter/spade"), /No item "spade" in catalog/],
      [(doc: Record<string, any>) => (gear(doc).lines[1].item = "packs/spade"), /No item catalog "packs"/],
      [(doc: Record<string, any>) => (gear(doc).lines[0].coins = "crown"), /Unknown currency unit "crown"/],
      [
        (doc: Record<string, any>) => (gear(doc).choices[1].options[1].lines[0].oneOf = ["outfitter/hand-axe"]),
        /Too small: expected array to have >=2 items/,
      ],
      [(doc: Record<string, any>) => gear(doc).choices[0].options.pop(), /Too small: expected array to have >=2 items/],
      [(doc: Record<string, any>) => (doc.items.startingGear[1].lines = []), /Starting gear gives something/],
      [(doc: Record<string, any>) => (doc.items.freeform = "refuse"), /refuses plain items/],
      [(doc: Record<string, any>) => (gear(doc).lines[0].equip = true), /Only one of the ruleset's items is put on/],
      [(doc: Record<string, any>) => (gear(doc).fits.value = { field: "toughnes" }), /toughnes/],
      [
        (doc: Record<string, any>) => (gear(doc).lines[1] = { item: "outfitter/road-rations", count: 999 }),
        /more stacks than one bag/,
      ],
      [(doc: Record<string, any>) => (doc.items.startingGear[2].id = "traveller"), /Duplicate starting gear/],
      [
        (doc: Record<string, any>) =>
          (gear(doc).choices[1].options[1].lines[0].oneOf = ["outfitter/hand-axe", "outfitter/shovel"]),
        /No item "shovel" in catalog/,
      ],
      [
        (doc: Record<string, any>) =>
          (doc.catalogs
            .find((catalog: { id: string }) => catalog.id === "outfitter")
            .entries.find((entry: { id: string }) => entry.id === "road-rations").item.service = true),
        /"road-rations" is a service/,
      ],
      [(doc: Record<string, any>) => (gear(doc).lines[0].item = "outfitter/hand-axe"), /one of them/],
      [(doc: Record<string, any>) => (doc.items.startingGear[1].lines[0].name = "Lucky [charm]"), /square brackets/],
    ] as const) {
      assert.match(refusal(withGear(edit)), message);
    }
    // The gate: starting gear is 1.78's.
    const manifest = (minor: number) => ({
      schemaVersion: 2,
      capabilityApi: { major: 1, minor },
      id: "ember",
      name: "Ember",
      version: "1.0.0",
      kind: ["ruleset"],
      entrypoints: {},
      contributions: { assets: { paths: ["ruleset.json"] } },
      files: [{ path: "ruleset.json", sha256: "0".repeat(64), bytes: 10 }],
      permissions: [],
      restartRequired: false,
    });
    const issue = (minor: number) => getCapabilityPackageInstallIssue(manifest(minor) as never, withGear());
    assert.match(issue(77) ?? "", /starting gear requires .*capabilityApi 1\.78/);
    assert.ok(!/starting gear/.test(issue(78) ?? ""));
  }

  // ── Fits ──
  {
    const traveller = ember.items!.startingGear![0]!;
    const sheet = defaultRulesetSheetBuild(ember);
    assert.equal(
      rulesetStartingGearFits(ember, traveller, { ...sheet, fields: { ...sheet.fields, toughness: 2 } }),
      true,
    );
    assert.equal(
      rulesetStartingGearFits(ember, traveller, { ...sheet, fields: { ...sheet.fields, toughness: 1 } }),
      false,
    );
    assert.equal(rulesetStartingGearFits(ember, ember.items!.startingGear![1]!, sheet), false, "names nobody");
  }

  // ── The resolver ──
  {
    const resolve = (choices: number[], picks: Record<string, string> = {}, over: RulesetItemBook = book) =>
      resolveRulesetStartingGear(ember, over, { gear: "traveller", choices, picks });
    const axeAndCoat = resolve([0, 0]);
    assert.ok(axeAndCoat.ok);
    assert.deepEqual(
      axeAndCoat.adds.map((add) => [add.item ?? add.name, add.count, add.equip ?? false]),
      [
        ["coin:mark", 5, false],
        ["outfitter/road-rations", 3, false],
        ["outfitter/hand-axe", 1, false],
        ["outfitter/leather-coat", 1, true],
      ],
    );
    // Two picks of the same weapon are one add of two.
    const twoAxes = resolve([0, 1], { "1.0": "outfitter/hand-axe" });
    assert.ok(twoAxes.ok);
    assert.equal(twoAxes.adds.find((add) => add.item === "outfitter/hand-axe")?.count, 2);
    // Refused: a choice without an option, a pick missing or not in its list, an unknown gear.
    assert.deepEqual(resolve([0]).ok, false);
    assert.equal((resolve([0, 0, 1]) as { reason: string }).reason, "choice");
    assert.equal((resolve([0, 2]) as { reason: string }).reason, "choice");
    assert.equal((resolve([0, 1]) as { reason: string }).reason, "pick");
    assert.equal((resolve([0, 1], { "1.0": "outfitter/hunting-bow" }) as { reason: string }).reason, "pick");
    assert.equal((resolve([0, 1], { "1.0": "coin:mark" }) as { reason: string }).reason, "pick");
    assert.equal(
      (resolveRulesetStartingGear(ember, book, { gear: "nomad", choices: [], picks: {} }) as { reason: string }).reason,
      "unknown-gear",
    );
    // What a layer took out of the game is left out and named; a pick of it is refused.
    const hidden: RulesetItemBook = {
      ...book,
      entries: book.entries.filter((entry) => entry.item !== "outfitter/leather-coat"),
    };
    const withoutCoat = resolve([0, 0], {}, hidden);
    assert.ok(withoutCoat.ok);
    assert.deepEqual(withoutCoat.dropped, ["Leather coat"]);
    assert.ok(!withoutCoat.adds.some((add) => add.item === "outfitter/leather-coat"));
    const withoutSpear: RulesetItemBook = {
      ...book,
      entries: book.entries.filter((entry) => entry.item !== "outfitter/boar-spear"),
    };
    assert.equal(
      (resolve([0, 1], { "1.0": "outfitter/boar-spear" }, withoutSpear) as { reason: string }).reason,
      "pick",
    );
    // An item the ruleset does not have at all (a catalog in its own file that lost it) is refused.
    const lost: RulesetItemBook = {
      ...hidden,
      itemOf: (ref) => (ref === "outfitter/leather-coat" ? undefined : book.itemOf(ref)),
    };
    assert.equal((resolve([0, 0], {}, lost) as { reason: string }).reason, "unknown-item");
    // A coin a layer takes out is paid at the same worth in the largest coin left that pays it exactly.
    const noMarks = parsedOrThrow(
      withGear((doc) => doc.layers.push({ id: "no_marks", label: "No marks", currencies: { removeUnits: ["mark"] } })),
    );
    const paid = resolveRulesetStartingGear(
      noMarks,
      book,
      { gear: "traveller", choices: [0, 0], picks: {} },
      { "layer.no_marks": true },
    );
    assert.ok(paid.ok);
    assert.deepEqual(
      paid.adds.filter((add) => add.item?.startsWith("coin:")).map((add) => [add.item, add.count]),
      [["coin:bit", 50]],
    );
    // One line that puts an item on is enough for the merged add to be put on.
    const twoCoats = parsedOrThrow(
      withGear((doc) =>
        doc.items.startingGear.push({
          id: "tailor",
          label: "Tailor",
          lines: [{ item: "outfitter/leather-coat" }, { item: "outfitter/leather-coat", equip: true }],
        }),
      ),
    );
    const coats = resolveRulesetStartingGear(twoCoats, book, { gear: "tailor", choices: [], picks: {} });
    assert.ok(coats.ok);
    assert.deepEqual(
      coats.adds.map((add) => [add.item, add.count, add.equip ?? false]),
      [["outfitter/leather-coat", 2, true]],
    );
    // Gear of which nothing is left in this game is refused, so it is never marked as taken for nothing.
    assert.equal(
      (resolveRulesetStartingGear(twoCoats, hidden, { gear: "tailor", choices: [], picks: {} }) as { reason: string })
        .reason,
      "empty",
    );
    // A list all of whose items a layer took out is left out and named, rather than blocking the gear.
    const noWeapons: RulesetItemBook = {
      ...book,
      entries: book.entries.filter(
        (entry) => entry.item !== "outfitter/hand-axe" && entry.item !== "outfitter/boar-spear",
      ),
    };
    const unarmed = resolve([0, 1], {}, noWeapons);
    assert.ok(unarmed.ok);
    assert.deepEqual(unarmed.dropped, ["Hand axe", "Hand axe or Boar spear"]);
    // A service is never offered from a list.
    const spearService: RulesetItemBook = {
      ...book,
      entries: book.entries.map((entry) =>
        entry.item === "outfitter/boar-spear" ? { ...entry, service: true as const } : entry,
      ),
    };
    assert.equal(
      (resolve([0, 1], { "1.0": "outfitter/boar-spear" }, spearService) as { reason: string }).reason,
      "pick",
    );
    // The marker is read by a bag's own key: a bag named "constructor" has taken nothing.
    assert.deepEqual(rulesetStartingGearTakenBy({}, "constructor"), []);
    assert.deepEqual(rulesetStartingGearTakenBy({ constructor: ["pilgrim"] }, "constructor"), ["pilgrim"]);
    // A gear's id and another gear's group are different kinds.
    const named = parsedOrThrow(
      withGear((doc) =>
        doc.items.startingGear.push({ id: "background", label: "Background", lines: [{ name: "Hat" }] }),
      ),
    );
    assert.notEqual(rulesetStartingGearKind(named, "background"), rulesetStartingGearKind(named, "pilgrim"));
    assert.equal(rulesetStartingGearKind(named, "traveller"), rulesetStartingGearKind(named, "hoarder"));
  }

  // ── The route ──
  const RULESET_ID = "local/ember-gear";
  await createGameRulesetsStorage(db).put({
    rulesetId: RULESET_ID,
    version: 1,
    sourceKind: "local",
    // With a layer that takes out marks, and a coat to wear, for the games below that ask for them.
    definition: JSON.stringify({
      ...withGear((doc) => {
        doc.layers.push({ id: "no_marks", label: "No marks", currencies: { removeUnits: ["mark"] } });
        doc.items.startingGear.push({
          id: "coat",
          label: "Coat",
          lines: [{ item: "outfitter/leather-coat", equip: true }],
        });
      }),
      id: "ember-gear",
    }),
  });
  const chats = createChatsStorage(db);
  const states = createGameStateStorage(db);
  const newGame = async (
    inventory: GameInventoryStack[] = [],
    { cards = ["Ada", "Juno"], options = {} }: { cards?: string[]; options?: Record<string, unknown> } = {},
  ) => {
    const chat = await chats.create({ name: "Gear", mode: "game", characterIds: [] });
    const anchor = await chats.createMessage({ chatId: chat.id, role: "assistant", content: "The road." });
    await chats.patchMetadata(chat.id, {
      gameRuleset: { id: RULESET_ID, version: 1, packageId: null, options },
      gameCharacterCards: cards.map((name) => ({ name })),
      gameInventory: inventory,
    });
    await states.create({
      chatId: chat.id,
      messageId: anchor.id,
      swipeIndex: 0,
      date: "",
      time: "",
      location: "road",
      weather: "",
      temperature: "",
      worldCustomFields: [],
      presentCharacters: [],
      recentEvents: [],
      playerStats: null,
      personaStats: null,
      fieldLocks: {},
      hiddenTrackerFields: [],
      committed: true,
    });
    return chat.id;
  };
  const take = (payload: Record<string, unknown>) =>
    app.inject({ method: "POST", url: "/game/inventory/starting-gear", payload });
  const metadataOf = async (chatId: string) => {
    const raw = (await chats.getById(chatId))!.metadata;
    return (typeof raw === "string" ? JSON.parse(raw) : raw) as Record<string, any>;
  };
  {
    const chatId = await newGame();
    const first = await take({ chatId, selection: { gear: "traveller", choices: [0, 0], picks: {} } });
    assert.equal(first.statusCode, 200, first.body);
    const answer = first.json();
    const bag = (answer.inventory as GameInventoryStack[]).filter((stack) => !stack.holder);
    assert.deepEqual(
      bag.map((stack) => [stack.item, stack.quantity, stack.equipped ?? false]).sort(),
      [
        ["coin:mark", 5, false],
        ["outfitter/hand-axe", 1, false],
        ["outfitter/leather-coat", 1, true],
        ["outfitter/road-rations", 3, false],
      ].sort(),
      "the gear in the player's bag, the coat worn",
    );
    assert.deepEqual(answer.taken, { "": ["traveller"] });
    const metadata = await metadataOf(chatId);
    assert.deepEqual(metadata.gameStartingGearTaken, { "": ["traveller"] });
    // The journal says what was taken as the bag writes it.
    assert.equal(
      metadata.gameJournal.entries.find((entry: { title: string }) => entry.title === "Starting gear: Traveller")
        ?.content,
      "Ada took marks x5, Road rations x3, Hand axe, Leather coat.",
    );
    assert.ok(metadata.gameJournal.inventoryLog.some((entry: { item: string }) => entry.item === "Hand axe"));
    // Once for each group: the calling's gear again is refused, the background's is not.
    const again = await take({ chatId, selection: { gear: "hoarder", choices: [], picks: {} } });
    assert.equal(again.statusCode, 409);
    assert.equal(again.json().reason, "taken");
    const background = await take({ chatId, selection: { gear: "pilgrim", choices: [], picks: {} } });
    assert.equal(background.statusCode, 200, background.body);
    assert.ok(
      (background.json().inventory as GameInventoryStack[]).some((stack) => stack.name === "Lucky charm"),
      "a plain item",
    );
    assert.deepEqual(background.json().taken, { "": ["traveller", "pilgrim"] });
    // All of it or none of it: too heavy, and nothing is stored, the marker included.
    const heavy = await take({ chatId, selection: { gear: "hoarder", choices: [], picks: {} }, again: true });
    assert.equal(heavy.statusCode, 409);
    assert.equal(heavy.json().reason, "too-heavy");
    assert.deepEqual((await metadataOf(chatId)).gameStartingGearTaken, { "": ["traveller", "pilgrim"] });
    // Asked again, the calling's gear may be taken a second time, and the marker keeps both (playtest:
    // a second calling's kit dropped the first from it).
    const twice = await take({ chatId, selection: { gear: "drifter", choices: [], picks: {} }, again: true });
    assert.equal(twice.statusCode, 200, twice.body);
    assert.deepEqual(twice.json().taken, { "": ["traveller", "pilgrim", "drifter"] });
    // Read back, a bag's marker keeps its newest forty: the kit just taken is never the one dropped.
    const many = Array.from({ length: 41 }, (_, index) => `kit-${index}`);
    assert.deepEqual(readGameStartingGearTaken({ "": many })[""], many.slice(1));
    // A party member's own bag, by their card's name; nobody else's.
    const juno = await take({ chatId, holder: "juno", selection: { gear: "pilgrim", choices: [], picks: {} } });
    assert.equal(juno.statusCode, 200, juno.body);
    assert.ok((juno.json().inventory as GameInventoryStack[]).some((stack) => stack.holder === "Juno"));
    assert.deepEqual(juno.json().taken.juno, ["pilgrim"]);
    const stranger = await take({ chatId, holder: "Mallory", selection: { gear: "pilgrim", choices: [], picks: {} } });
    assert.equal(stranger.json().reason, "unknown-holder");
    // The player's own card names the player's own bag, which has taken a background's gear.
    const ada = await take({ chatId, holder: "Ada", selection: { gear: "pilgrim", choices: [], picks: {} } });
    assert.equal(ada.json().reason, "taken");
    // Never trusted: a pick that is not one of its list.
    const forged = await take({
      chatId,
      holder: "Juno",
      selection: { gear: "traveller", choices: [0, 1], picks: { "1.0": "outfitter/hunting-bow" } },
    });
    assert.equal(forged.json().reason, "pick");
  }
  {
    // A party member named after an object's built-in keeps their own bag and marker.
    const chatId = await newGame([], { cards: ["Ada", "Constructor"] });
    const builder = await take({
      chatId,
      holder: "Constructor",
      selection: { gear: "pilgrim", choices: [], picks: {} },
    });
    assert.equal(builder.statusCode, 200, builder.body);
    assert.deepEqual(builder.json().taken, { constructor: ["pilgrim"] });
    const builderAgain = await take({
      chatId,
      holder: "Constructor",
      selection: { gear: "pilgrim", choices: [], picks: {} },
    });
    assert.equal(builderAgain.json().reason, "taken");
  }
  {
    // A layer that takes out marks: the gear's 5 marks come as 50 bits, in the same write.
    const chatId = await newGame([], { options: { "layer.no_marks": true } });
    const paid = await take({ chatId, selection: { gear: "traveller", choices: [0, 0], picks: {} } });
    assert.equal(paid.statusCode, 200, paid.body);
    const coins = (paid.json().inventory as GameInventoryStack[]).filter((stack) => stack.item?.startsWith("coin:"));
    assert.deepEqual(
      coins.map((stack) => [stack.item, stack.quantity]),
      [["coin:bit", 50]],
    );
  }
  {
    // Armor goes on where its slot is free; a second coat, taken again, stays in the bag.
    const chatId = await newGame();
    const first = await take({ chatId, selection: { gear: "coat", choices: [], picks: {} } });
    assert.equal(first.statusCode, 200, first.body);
    const second = await take({ chatId, selection: { gear: "coat", choices: [], picks: {} }, again: true });
    assert.equal(second.statusCode, 200, second.body);
    const coats = (second.json().inventory as GameInventoryStack[]).filter(
      (stack) => stack.item === "outfitter/leather-coat",
    );
    assert.deepEqual(coats.map((stack) => Boolean(stack.equipped)).sort(), [false, true]);
  }
  {
    // A coat the Game Master already gave is not taken twice (laptop 2026-10-26: heroes handed a
    // shield before their kits carried two after). Taken again on purpose, it is.
    const given: GameInventoryStack = {
      id: "s1",
      name: "Leather coat",
      item: "outfitter/leather-coat",
      quantity: 1,
      holder: "Juno",
    };
    const chatId = await newGame([given]);
    const kit = await take({ chatId, holder: "Juno", selection: { gear: "coat", choices: [], picks: {} } });
    assert.equal(kit.statusCode, 200, kit.body);
    assert.deepEqual(kit.json().added, []);
    const coatsOf = (response: typeof kit) =>
      (response.json().inventory as GameInventoryStack[]).filter((stack) => stack.item === "outfitter/leather-coat");
    assert.deepEqual(
      coatsOf(kit).map((stack) => [stack.holder, stack.quantity]),
      [["Juno", 1]],
    );
    assert.deepEqual(kit.json().taken, { juno: ["coat"] });
    const again = await take({
      chatId,
      holder: "Juno",
      selection: { gear: "coat", choices: [], picks: {} },
      again: true,
    });
    assert.equal(again.statusCode, 200, again.body);
    assert.equal(
      coatsOf(again).reduce((total, stack) => total + stack.quantity, 0),
      2,
    );
  }

  console.log("Ruleset starting gear: schema and gate, fits, the resolver, and the route into one bag, once a group.");
} finally {
  await app.close();
  await closeDB();
  rmSync(dataDir, { recursive: true, force: true });
}
