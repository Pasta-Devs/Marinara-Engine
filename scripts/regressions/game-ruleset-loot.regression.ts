/**
 * Loot (#6894, #6758, Capability API 1.63).
 *
 *   - A won fight drops loot in every Game Mode game, once, into the party's bags: the native tables
 *     without a ruleset (or with one that leaves native items on and declares no tables), the table
 *     each defeated bestiary creature names in a ruleset that declares loot tables, nothing when
 *     native items are off and there are no tables.
 *   - A directed fight drops it on the step that wins; one the screen plays alone asks the loot route,
 *     once per fight.
 *   - The Game Master's `[loot: table="..."]` rolls a table into the bags, answered as resolved adds.
 *   - Checked at import, gated at 1.63.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  applyGameInventoryTags,
  defaultRulesetSheetBuild,
  parseRulesetDefinition,
  refuseGameInventoryTags,
  resolveRulesetLayers,
  rollRulesetLootTable,
  rulesetItemBook,
  stripGmTags,
  type DirectedCombatView,
  type GameInventoryStack,
  type RulesetCatalogEntry,
  type RulesetDefinition,
  dropGameLootRepeats,
  GAME_LOOT_GIVEN_LINE,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-ruleset-loot-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");

const { default: Fastify } = await import("../../packages/server/node_modules/fastify/fastify.js");
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createGameStateStorage } = await import("../../packages/server/src/services/storage/game-state.storage.js");
const { createGameRulesetsStorage } =
  await import("../../packages/server/src/services/storage/game-rulesets.storage.js");
const { gameInventoryRoutes } = await import("../../packages/server/src/routes/game-inventory.routes.js");
const { combatDirectorRoutes } = await import("../../packages/server/src/routes/combat-director.routes.js");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");
const { generateCombatLoot } = await import("../../packages/server/src/services/game/loot.service.js");
const { addGameLoot, planGameVictoryLoot, gameLootTagRoller } =
  await import("../../packages/server/src/services/game/game-loot.service.js");
const { buildGmFormatReminder } = await import("../../packages/server/src/services/game/gm-prompts.js");

const db = await getDB();
const app = Fastify();
app.decorate("db", db);
await app.register(gameInventoryRoutes, { prefix: "/game/inventory" });
await app.register(combatDirectorRoutes, { prefix: "/combat", chooseBoss: async () => "" });

try {
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
  const catalogOf = (doc: Record<string, any>, id: string) =>
    doc.catalogs.find((catalog: { id: string }) => catalog.id === id);
  const entryOf = (doc: Record<string, any>, catalog: string, id: string) =>
    catalogOf(doc, catalog).entries.find((entry: { id: string }) => entry.id === id);
  const entriesOf = (definition: RulesetDefinition): Record<string, RulesetCatalogEntry[]> =>
    Object.fromEntries(
      (definition.catalogs ?? []).flatMap((catalog) =>
        catalog.entries && catalog.holds !== "rows" ? [[catalog.id, catalog.entries]] : [],
      ),
    );
  /** A die that answers from a list, then keeps giving its last answer. */
  const dice = (...faces: number[]) => {
    const rolled: number[] = [];
    let at = 0;
    const roll = (sides: number) => {
      rolled.push(sides);
      return Math.min(sides, faces[Math.min(at++, faces.length - 1)]!);
    };
    return Object.assign(roll, { rolled });
  };
  const gravewatch = parsedOrThrow(JSON.parse(gravewatchText), "Gravewatch");
  const ember = parsedOrThrow(JSON.parse(emberText), "Ember Roads");
  const graveBook = rulesetItemBook(gravewatch, entriesOf(gravewatch));
  /** Every arm of Gravewatch's kit, which the grave goods' filter line picks from. */
  const arms = graveBook.entries.filter((entry) => entry.entry.item?.category === "arm");
  /** Ember Roads keeps no loot of its own, so a toll warden's spoils are written here. */
  const roadSpoils = {
    id: "road_spoils",
    label: "Road spoils",
    entries: [
      { item: "outfitter/arrows", weight: 3, count: "1d6" },
      { item: "outfitter/road-rations", weight: 3, count: "1d3" },
      { item: "outfitter/poultice", weight: 2 },
      { filter: { category: "weapon" }, weight: 1 },
    ],
  };

  // ── Import ──
  {
    assert.equal(gravewatch.items?.lootTables?.[0]?.id, "grave_goods");
    assert.equal(entryOf(JSON.parse(gravewatchText), "night", "grave-wight").creature.loot, "grave_goods");
    assert.equal(gravewatch.items?.lootTables?.[0]?.entries.at(-2)?.filter?.category, "arm");
    const table = (edit: (table: Record<string, any>) => void) => (doc: Record<string, any>) =>
      edit(doc.items.lootTables[0]);
    refused(
      table((t) => (t.entries[0].item = "charms/steady-hand")),
      /lootTables\.0\.entries\.0\.item: No item catalog "charms"/,
      "a catalog of rows",
    );
    refused(
      table((t) => (t.entries[0].item = "kit/golden-spade")),
      /lootTables\.0\.entries\.0\.item: No item "golden-spade" in catalog "kit"/,
      "an item the catalog lacks",
    );
    refused(
      table((t) => (t.entries[0].item = "Kit Spade")),
      /item is named as <catalog>\/<entry>/,
      "a bare name",
    );
    refused(
      table((t) => (t.entries[0] = { filter: { rarity: "mythic" } })),
      /entries\.0\.filter\.rarity: Unknown item rarity "mythic"/,
      "a rarity",
    );
    refused(
      table((t) => (t.entries[0] = { filter: { category: "wand" } })),
      /entries\.0\.filter\.category: Unknown item category "wand"/,
      "a category",
    );
    refused(
      table((t) => (t.entries[0] = { filter: { tag: "cursed" } })),
      /entries\.0\.filter\.tag: Unknown item tag "cursed"/,
      "a tag",
    );
    refused(
      table((t) => (t.entries[0] = { filter: {} })),
      /A filter names a rarity/,
      "an empty filter",
    );
    refused(
      table((t) => (t.entries[0] = { item: "kit/silver-nail", filter: { tag: "silver" } })),
      /names an item, a filter or coins, one of them/,
      "both",
    );
    refused(
      table((t) => (t.entries[0] = { weight: 2 })),
      /names an item, a filter or coins, one of them/,
      "neither",
    );
    refused(
      table((t) => (t.rolls = "1d1")),
      /lootTables\.0\.rolls/,
      "a die of one side",
    );
    refused(
      table((t) => (t.entries[0].count = 0)),
      /lootTables\.0\.entries\.0\.count/,
      "a count of none",
    );
    refused(
      (doc) => doc.items.lootTables.push({ ...doc.items.lootTables[0] }),
      /Duplicate loot table/,
      "the same table twice",
    );
    refused(
      (doc) => (entryOf(doc, "night", "grave-wight").creature.loot = "dragon_hoard"),
      /creature\.loot: Unknown loot table "dragon_hoard"/,
      "a creature's table",
    );
    parsedOrThrow(
      variant(
        gravewatchText,
        table((t) => (t.rolls = 0)),
      ),
      "a table that may drop nothing",
    );
  }

  // ── Install gate: 1.63 ──
  {
    const manifest = (minor: number, paths = ["ruleset.json"]) => ({
      schemaVersion: 2,
      capabilityApi: { major: 1, minor },
      builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
      id: "ruleset-loot",
      name: "Loot",
      version: "0.1.0",
      description: "A packaged ruleset with loot tables.",
      engine: { min: "2.4.6", maxExclusive: "4.0.0" },
      kind: ["ruleset"],
      entrypoints: {},
      contributions: { assets: { paths } },
      files: paths.map((path) => ({ path, sha256: "0".repeat(64), bytes: 10 })),
      permissions: [],
      restartRequired: false,
    });
    const gateIssue = /loot tables, or creatures that carry loot.*capabilityApi 1\.63/;
    // Gravewatch without the coins of 1.64 and the market of 1.65 (their own lanes gate those).
    const lootText = JSON.stringify(
      variant(gravewatchText, (doc) => {
        delete doc.layers[0].currencies;
        // And the market, which is 1.65's.
        delete doc.items.market;
        for (const catalog of doc.catalogs) {
          for (const entry of catalog.entries ?? []) {
            delete entry.item?.sold;
            delete entry.item?.service;
          }
        }
        doc.items.lootTables[0].entries = doc.items.lootTables[0].entries.filter(
          (entry: { coins?: string }) => !entry.coins,
        );
      }),
    );
    const issue = (minor: number, doc: Record<string, any>, paths?: string[], files?: Map<string, unknown>) =>
      getCapabilityPackageInstallIssue(manifest(minor, paths) as any, doc, files);
    const lootless = (doc: Record<string, any>) => {
      delete doc.items.lootTables;
      for (const entry of catalogOf(doc, "night").entries) delete entry.creature.loot;
    };
    assert.match(issue(62, variant(lootText)) ?? "", gateIssue);
    assert.equal(issue(63, variant(lootText)), null);
    assert.equal(issue(62, variant(lootText, lootless)), null, "the rest of the example stays 1.62");
    const tablesOnly = variant(lootText, (doc) => {
      for (const entry of catalogOf(doc, "night").entries) delete entry.creature.loot;
    });
    assert.match(issue(62, tablesOnly) ?? "", gateIssue, "tables alone");
    const creaturesOnly = variant(lootText, (doc) => delete doc.items.lootTables);
    assert.match(issue(62, creaturesOnly) ?? "", gateIssue, "a creature's loot alone");
    // A bestiary in its own file: the creature's loot is 1.63 there too.
    const inFile = variant(lootText, (doc) => {
      delete doc.items.lootTables;
      const night = catalogOf(doc, "night");
      delete night.entries;
      night.asset = "catalogs/night.json";
    });
    const paths = ["ruleset.json", "catalogs/night.json"];
    const files = new Map<string, unknown>([
      ["catalogs/night.json", { entries: catalogOf(variant(lootText), "night").entries }],
    ]);
    assert.match(issue(62, inFile, paths, files) ?? "", gateIssue, "a creature in a catalog file");
    assert.equal(issue(63, inFile, paths, files), null);
  }

  // ── Rolling a table ──
  {
    // One pick (the first of 1d2), the heaviest line (shot, weight 4 of 12), three of it (1d4).
    const shot = dice(1, 3, 3);
    assert.deepEqual(rollRulesetLootTable(gravewatch, graveBook, "grave_goods", shot), [
      { item: "kit/shot-and-powder", name: "Shot and powder", count: 3 },
    ]);
    assert.deepEqual(shot.rolled, [2, 12, 4], "the picks, the line by weight, the count");
    // Two picks of the same line add up; a line's weight is its share: 5 to 7 is the tonic.
    assert.deepEqual(rollRulesetLootTable(gravewatch, graveBook, "grave_goods", dice(2, 6, 7)), [
      { item: "kit/warming-tonic", name: "Warming tonic", count: 2 },
    ]);
    // Face 10 is the lightest line, whose filter picks evenly among every arm: the second here.
    assert.ok(arms.length >= 2);
    assert.deepEqual(rollRulesetLootTable(gravewatch, graveBook, "grave_goods", dice(1, 10, 2)), [
      { item: arms[1]!.item, name: arms[1]!.name, count: 1 },
    ]);
    // An item a layer took out drops nothing, as a filter that finds none does.
    const hidden = { entries: graveBook.entries.filter((entry) => entry.item !== "kit/warming-tonic") };
    assert.deepEqual(rollRulesetLootTable(gravewatch, hidden, "grave_goods", dice(1, 6)), []);
    const none = parsedOrThrow(
      variant(emberText, (doc) => {
        doc.items.lootTables = [
          { ...roadSpoils, entries: [{ filter: { rarity: "storied", category: "provisions" } }] },
        ];
      }),
      "Ember with a filter nothing answers",
    );
    assert.deepEqual(rollRulesetLootTable(none, rulesetItemBook(none, entriesOf(none)), "road_spoils", dice(1)), []);
    // A filter by tag finds only what carries it: the silver nail.
    const silver = parsedOrThrow(
      variant(gravewatchText, (doc) => (doc.items.lootTables[0].entries = [{ filter: { tag: "silver" } }])),
      "Gravewatch with a silver line",
    );
    assert.deepEqual(rollRulesetLootTable(silver, graveBook, "grave_goods", dice(1, 1, 1)), [
      { item: "kit/silver-nail", name: "Silver coffin nail", count: 1 },
    ]);
    // No picks at all, and no such table.
    const empty = parsedOrThrow(
      variant(gravewatchText, (doc) => (doc.items.lootTables[0].rolls = 0)),
      "",
    );
    assert.deepEqual(rollRulesetLootTable(empty, graveBook, "grave_goods", dice(1)), []);
    assert.equal(rollRulesetLootTable(gravewatch, graveBook, "dragon_hoard", dice(1)), null);
  }

  // ── A layer still applies in the browser ──
  {
    // The listing a browser gets sends each catalog without its entries, so a loot line's item cannot
    // be found there; it was checked at import, and the long night must not be dropped for it.
    const listing = {
      ...gravewatch,
      catalogs: gravewatch.catalogs!.map(({ entries, ...catalog }) => ({
        ...catalog,
        entryCount: entries?.length ?? 0,
      })),
    } as unknown as RulesetDefinition;
    assert.deepEqual(
      resolveRulesetLayers(listing, { "layer.long_night": true }).applied.map((layer) => layer.id),
      ["long_night"],
    );
  }

  // ── Game Mode's native tables ──
  {
    const never = () => 0;
    assert.equal(generateCombatLoot(2, "normal", never).length, 2, "one drop per fallen, at the least");
    assert.equal(generateCombatLoot(2, "hard", never).length, 3, "and one more on a hard game");
    assert.equal(generateCombatLoot(20, "brutal", () => 0.99).length, 10, "never more than ten");
    assert.equal(generateCombatLoot(2, "normal", () => 0.99).length, 4, "and up to one more per fallen");
    for (const drop of generateCombatLoot(3, "normal", never)) {
      assert.ok(drop.item.name.length > 0 && drop.quantity >= 1);
    }
  }

  // ── In a game ──
  const chats = createChatsStorage(db);
  const states = createGameStateStorage(db);
  const newGame = async (metadata: Record<string, unknown>) => {
    const chat = await chats.create({ name: "Loot", mode: "game", characterIds: [] });
    const anchor = await chats.createMessage({ chatId: chat.id, role: "assistant", content: "[state: combat]" });
    await chats.patchMetadata(chat.id, {
      gameSetupConfig: { combatDirector: true, difficulty: "Normal" },
      gameInventory: [],
      ...metadata,
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
      presentCharacters: [],
      recentEvents: [],
      playerStats: null,
      personaStats: null,
    });
    return { chatId: chat.id, anchor: anchor.id };
  };
  const saved = async (chatId: string) =>
    JSON.parse((await chats.getById(chatId))!.metadata as string) as {
      gameInventory: GameInventoryStack[];
      gameJournal?: { entries?: Array<{ content?: string }> };
    };
  const pinned = async (id: string, document: Record<string, unknown>, definition: RulesetDefinition) => {
    await createGameRulesetsStorage(db).put({
      rulesetId: `local/${id}`,
      version: definition.version,
      sourceKind: "local",
      definition: JSON.stringify({ ...document, id }),
    });
    return { id: `local/${id}`, version: definition.version, packageId: null, options: {} };
  };
  const cards = (definition: RulesetDefinition, ...names: string[]) =>
    names.map((name) => ({ name, rulesetSheet: { v: 1, build: defaultRulesetSheetBuild(definition) } }));
  const loot = (chatId: string, fight: string, defeated: number) =>
    app.inject({ method: "POST", url: "/game/inventory/loot", payload: { chatId, fight, defeated } });

  // What nobody can carry is left behind, and said: Ember Roads carries 12 bulk at most, a spear is 2.
  {
    const carrying = rulesetItemBook(ember, entriesOf(ember), { sheets: { player: defaultRulesetSheetBuild(ember) } });
    const added = addGameLoot([], {
      ops: [{ op: "add", name: "Boar spear", item: "outfitter/boar-spear", count: 10, among: [""], log: true }],
      rules: carrying,
    });
    const [spears] = added.dropped;
    assert.ok(spears && spears.quantity >= 1 && (spears.left ?? 0) >= 1, JSON.stringify(added.dropped));
    assert.equal(spears!.quantity + spears!.left!, 10);
    assert.equal(
      added.stacks.reduce((sum, stack) => sum + stack.quantity, 0),
      spears!.quantity,
    );
  }

  // Without a ruleset, a fight the screen played drops the native loot into the player's bag, once.
  {
    const game = await newGame({});
    const first = await loot(game.chatId, "fight-1", 2);
    assert.equal(first.statusCode, 200, first.body);
    const body = first.json() as { loot: Array<{ name: string; quantity: number }>; inventory: GameInventoryStack[] };
    assert.ok(body.loot.length >= 1, JSON.stringify(body));
    const kept = (await saved(game.chatId)).gameInventory;
    assert.equal(
      kept.reduce((sum, stack) => sum + stack.quantity, 0),
      body.loot.reduce((sum, drop) => sum + drop.quantity, 0),
    );
    assert.ok(
      kept.every((stack) => stack.holder === undefined && stack.item === undefined),
      "plain, in the player's bag",
    );
    const again = await loot(game.chatId, "fight-1", 2);
    assert.deepEqual(again.json().loot, [], "the same fight drops nothing twice");
    assert.deepEqual((await saved(game.chatId)).gameInventory, kept);
    assert.ok((await loot(game.chatId, "fight-2", 1)).json().loot.length >= 1, "the next fight drops its own");
    assert.equal((await loot("no-such-chat", "fight-1", 1)).statusCode, 404);
    assert.equal((await loot(game.chatId, "fight-3", 0)).statusCode, 400);
  }

  // A ruleset that declares loot tables drops its own: a fight without bestiary creatures drops none.
  const graveRuleset = await pinned("gravewatch-loot", JSON.parse(gravewatchText), gravewatch);
  {
    const game = await newGame({ gameRuleset: graveRuleset, gameCharacterCards: cards(gravewatch, "Ada", "Bram") });
    assert.deepEqual((await loot(game.chatId, "fight-1", 2)).json().loot, []);
    // The tables of the fallen, into the shared view: the player's bag first, then Bram's.
    const plan = await planGameVictoryLoot(
      db,
      game.chatId,
      { tables: ["grave_goods", "grave_goods"], defeated: 2, difficulty: "normal" },
      dice(1, 1, 3, 1, 1, 3),
    );
    assert.deepEqual(plan?.ops, [
      { op: "add", name: "Shot and powder", item: "kit/shot-and-powder", count: 6, among: ["", "Bram"], log: true },
    ]);
  }
  // One that leaves native items on and declares no tables drops the native loot; one that turns them
  // off drops nothing.
  {
    const noTables = (doc: Record<string, any>) => {
      delete doc.items.lootTables;
      // And the smith's stock, which is rolled from one of them.
      for (const seller of doc.items.market?.sellers ?? []) delete seller.stock;
      for (const entry of catalogOf(doc, "night").entries) delete entry.creature.loot;
    };
    const plainDoc = variant(gravewatchText, noTables);
    const plain = parsedOrThrow(plainDoc, "Gravewatch without loot");
    const onGame = await newGame({
      gameRuleset: await pinned("gravewatch-native-on", plainDoc, plain),
      gameCharacterCards: cards(plain, "Ada"),
    });
    assert.ok((await loot(onGame.chatId, "fight-1", 1)).json().loot.length >= 1, "native items on");
    const offDoc = variant(gravewatchText, (doc) => {
      noTables(doc);
      doc.items.native = false;
    });
    const off = parsedOrThrow(offDoc, "Gravewatch with native items off");
    const offGame = await newGame({
      gameRuleset: await pinned("gravewatch-native-off", offDoc, off),
      gameCharacterCards: cards(off, "Ada"),
    });
    assert.deepEqual((await loot(offGame.chatId, "fight-1", 1)).json().loot, [], "native items off");
    assert.deepEqual((await saved(offGame.chatId)).gameInventory, []);
  }

  // ── A directed ruleset fight drops its creatures' loot on the step that wins ──
  {
    const emberDoc = variant(emberText, (doc) => {
      doc.items.lootTables = [roadSpoils];
      entryOf(doc, "road_trouble", "cinder-moth").creature.loot = "road_spoils";
    });
    const emberLoot = parsedOrThrow(emberDoc, "Ember with a moth that carries loot");
    const emberRuleset = await pinned("ember-loot", emberDoc, emberLoot);
    const unit = (id: string, name: string, side: "player" | "enemy") => ({
      id,
      name,
      side,
      hp: 30,
      maxHp: 30,
      attack: 8,
      defense: 6,
      speed: 6,
      level: 3,
      skills: [],
    });
    const strong = { ...defaultRulesetSheetBuild(emberLoot), abilities: { brawn: 14, wits: 12, heart: 12 } };
    // A sheet's attacks are the weapons it holds: an axe in each pair of hands.
    const carried: GameInventoryStack[] = [
      { id: "st-axe-juno", name: "Hand axe", quantity: 1, item: "outfitter/hand-axe", equipped: true },
      { id: "st-axe-bram", name: "Hand axe", quantity: 1, item: "outfitter/hand-axe", holder: "Bram", equipped: true },
    ];
    let won: { chatId: string; session: DirectedCombatView } | null = null;
    for (let attempt = 0; attempt < 6 && !won; attempt++) {
      const game = await newGame({
        gameRuleset: emberRuleset,
        gameCharacterCards: [
          { name: "Juno", rulesetSheet: { v: 1, build: strong } },
          { name: "Bram", rulesetSheet: { v: 1, build: strong } },
        ],
        gameInventory: carried,
      });
      const start = await app.inject({
        method: "POST",
        url: "/combat/start",
        payload: {
          chatId: game.chatId,
          anchor: game.anchor,
          style: "ruleset",
          party: [unit("juno", "Juno", "player"), unit("bram", "Bram", "player")],
          enemies: [unit("moth", "Cinder Moth", "enemy")],
        },
      });
      assert.equal(start.statusCode, 200, start.body);
      let session = start.json().session as DirectedCombatView;
      let requests = 0;
      const command = async (body: Record<string, unknown>) => {
        const answer = await app.inject({
          method: "POST",
          url: "/combat/command",
          payload: {
            chatId: game.chatId,
            anchor: game.anchor,
            id: session.id,
            instanceId: session.instanceId,
            revision: session.revision,
            requestId: `r${++requests}`,
            command: body,
          },
        });
        assert.equal(answer.statusCode, 200, answer.body);
        session = answer.json().session as DirectedCombatView;
      };
      for (const id of ["juno", "bram"]) await command({ type: "control", unitId: id, controller: "ai" });
      for (let step = 0; step < 300 && !session.outcome; step++) await command({ type: "continue" });
      if (session.outcome === "victory") won = { chatId: game.chatId, session };
    }
    assert.ok(won, "one of the fights was won");
    const { chatId, session } = won!;
    const dropped = session.summary?.loot;
    assert.ok(Array.isArray(dropped), `a won fight says what it dropped: ${JSON.stringify(session.summary)}`);
    assert.ok(dropped!.length >= 1, "the moth's table always picks something");
    const bags = (await saved(chatId)).gameInventory;
    // Counted past what the party carried in, since the table may drop another hand axe.
    const count = (stacks: GameInventoryStack[], name: string) =>
      stacks.filter((stack) => stack.name === name).reduce((sum, stack) => sum + stack.quantity, 0);
    for (const drop of dropped!) {
      assert.equal(count(bags, drop.name) - count(carried, drop.name), drop.quantity, `${drop.name} is in the bags`);
      assert.ok(bags.find((stack) => stack.name === drop.name)?.item?.startsWith("outfitter/"), "a ruleset item");
    }
    // Read again, it still says so, and nothing drops twice.
    const state = await app.inject({
      url: `/combat/state?chatId=${chatId}&anchor=${(await chats.listMessages(chatId))[0]!.id}`,
    });
    assert.deepEqual((state.json().session as DirectedCombatView).summary?.loot, dropped);
    assert.deepEqual((await saved(chatId)).gameInventory, bags);
  }

  // ── The Game Master's [loot:] ──
  {
    const party = { members: ["Bram"] };
    const roller = (faces: number[]) => {
      const roll = dice(...faces);
      return (table: string) => rollRulesetLootTable(gravewatch, graveBook, table, roll);
    };
    const tagged = applyGameInventoryTags(
      'The wight falls. [loot: table="grave_goods"] Bram searches it. [loot: table="grave_goods" who="Bram"]',
      [],
      party,
      undefined,
      graveBook,
      undefined,
      roller([1, 1, 2, 1, 8]),
    );
    assert.match(tagged.content, /\[inventory: action="add" item="Shot and powder" count="2" result="ok" now="2"\]/);
    assert.match(
      tagged.content,
      /\[inventory: action="add" item="Page of the vigil litany" count="1" who="Bram" result="ok" now="1"\]/,
    );
    assert.ok(!/\[loot:/.test(tagged.content), "every drop answered as an add");
    assert.deepEqual(
      tagged.stacks.map((stack) => [stack.name, stack.quantity, stack.holder ?? ""]),
      [
        ["Shot and powder", 2, ""],
        ["Page of the vigil litany", 1, "Bram"],
      ],
    );
    assert.deepEqual(
      tagged.journal.map((entry) => entry.action),
      ["acquired", "acquired"],
    );
    // A table the ruleset lacks, one that drops nothing, a ruleset with no tables, a name nobody has.
    const answered = (text: string, loot?: (table: string) => ReturnType<typeof rollRulesetLootTable>) =>
      applyGameInventoryTags(text, [], party, undefined, graveBook, undefined, loot).content;
    assert.equal(
      answered('[loot: table="dragon_hoard"]', roller([1])),
      '[loot: table="dragon_hoard" result="refused" reason="unknown-loot-table"]',
    );
    assert.equal(
      answered('[loot: table="grave_goods"]', () => []),
      '[loot: table="grave_goods" result="nothing"]',
    );
    assert.equal(
      answered('[loot: table="grave_goods"]'),
      '[loot: table="grave_goods" result="refused" reason="no-loot-tables"]',
    );
    assert.equal(
      answered('[loot: table="grave_goods" who="Cora"]', roller([1])),
      '[loot: table="grave_goods" who="Cora" result="refused" reason="unknown-character"]',
    );
    assert.equal(
      answered("[loot: grave_goods]", roller([1, 8])).includes('item="Page of the vigil litany"'),
      true,
      "a bare table",
    );
    assert.equal(
      refuseGameInventoryTags('[loot: table="grave_goods"]', "unapplied"),
      '[loot: table="grave_goods" result="refused" reason="unapplied"]',
    );
    // Seeded, a reply's answers roll the same before and after it is saved.
    const twice = [0, 1].map(
      () =>
        applyGameInventoryTags(
          '[loot: table="grave_goods"]',
          [],
          party,
          undefined,
          graveBook,
          undefined,
          gameLootTagRoller(gravewatch, graveBook, 12345),
        ).content,
    );
    assert.equal(twice[0], twice[1]);
    assert.equal(gameLootTagRoller(ember, undefined, 1), undefined, "no book, no roller");
    // Never shown to the player as it is written.
    assert.equal(stripGmTags('Dust. [loot: table="grave_goods"]').trim(), "Dust.");
    // And the Game Master is told how, only where there are tables.
    const reminder = (definition: RulesetDefinition) =>
      buildGmFormatReminder({ hasSceneModel: true, ruleset: definition } as never);
    assert.match(reminder(gravewatch), /\[loot: table="id" who="Name"\].*Tables: grave_goods \(Grave goods\)/);
    const plain = parsedOrThrow(
      variant(gravewatchText, (doc) => {
        delete doc.items.lootTables;
        for (const seller of doc.items.market?.sellers ?? []) delete seller.stock;
        for (const entry of catalogOf(doc, "night").entries) delete entry.creature.loot;
      }),
      "",
    );
    assert.doesNotMatch(reminder(plain), /\[loot:/);
  }

  // ── What a won fight dropped is not added again by the reply to its recap (laptop playtest
  //    2026-10-25: "Found: Staff, gold pieces ×15", then the gold earned again and a second Staff) ──
  {
    const recap = `OUTCOME: VICTORY (after 3 rounds)\n${GAME_LOOT_GIVEN_LINE}Staff, Crossbow, heavy, gold pieces ×15\nParty: ...`;
    const reply =
      'The staff lies by the fallen priest. [inventory: action="add" item="Staff"] ' +
      '[inventory: action="earn" item="gold pieces" count="15" who="Aldric"] ' +
      '[inventory: action="add" item="Staff"] [inventory: action="add" item="Crossbow, heavy"] ' +
      '[inventory: action="earn" item="gold pieces" count="5"] [inventory: action="add" item="Rope"]';
    const kept = dropGameLootRepeats(reply, recap);
    assert.equal(
      kept,
      'The staff lies by the fallen priest.   [inventory: action="add" item="Staff"]  ' +
        '[inventory: action="earn" item="gold pieces" count="5"] [inventory: action="add" item="Rope"]',
      "each drop once, at its count; a second Staff and other coins stay",
    );
    assert.equal(dropGameLootRepeats(reply, "OUTCOME: VICTORY"), reply, "no loot line, nothing taken");
  }

  console.log(
    "Ruleset loot: import checks, the 1.63 gate, rolling tables, native drops, the loot route once per fight, ruleset tables in place of native loot, a directed win dropping its creatures' loot, and the Game Master's [loot:] passed.",
  );
} finally {
  await app.close();
  await closeDB();
  rmSync(dataDir, { recursive: true, force: true });
}
