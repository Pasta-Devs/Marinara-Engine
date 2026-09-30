/**
 * Using ruleset items outside a fight, and restoring a pool (#6881, Capability API 1.60).
 *
 *   - A use's `restore` gives back some of a pool: checked at import, gated at 1.60, written to each
 *     target with a sheet in a fight, and left alone by the Engine's picker when the pool is full.
 *   - Outside a fight, what a use does to its user lands on their sheet with the Engine's dice (a heal,
 *     temporary points, a restore, conditions), while a use aimed at somebody else applies nothing and
 *     says what it does. It is spent as a fight spends it, and refused when it cannot be used.
 *   - The Use button's route writes the bag and the sheet together; the Game Master's
 *     `[inventory: action="use"]` answers with what happened and rolls the same twice from one seed.
 *   - The `[item_used]` block is the Engine's, stripped from narration, and the prompt offers the tag.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  applyGameInventoryTags,
  applyRulesetCombatChoice,
  createRulesetEncounter,
  defaultRulesetSheetBuild,
  parseRulesetDefinition,
  readResolvedInventoryTags,
  readRulesetLive,
  RESERVED_GM_TAG_NAMES,
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetItemBook,
  rulesetItemFacts,
  rulesetItemPromptFacts,
  rulesetItemUseLine,
  stripEngineResultBlocks,
  stripGmTags,
  useRulesetItemOutsideFight,
  type GameInventoryStack,
  type RulesetCatalogEntry,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetSheetItem,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-ruleset-item-use-outside-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");

const { default: Fastify } = await import("../../packages/server/node_modules/fastify/fastify.js");
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createGameStateStorage } = await import("../../packages/server/src/services/storage/game-state.storage.js");
const { createGameRulesetsStorage } =
  await import("../../packages/server/src/services/storage/game-rulesets.storage.js");
const { gameInventoryRoutes } = await import("../../packages/server/src/routes/game-inventory.routes.js");
const { gameInventoryItemUser } = await import("../../packages/server/src/services/game/game-item-use.service.js");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");
const { buildGmFormatReminder } = await import("../../packages/server/src/services/game/gm-prompts.js");
const { rulesetCombatEventLine, rulesetCombatNames } =
  await import("../../packages/client/src/lib/ruleset-combat-log.js");
const { createCombatDirector } = await import("../../packages/server/src/services/game/combat-director.service.js");
const { commandRulesetCombatDirector, createRulesetFight, rulesetDirectorStage, syncRulesetCombatants } =
  await import("../../packages/server/src/services/game/ruleset-combat-director.service.js");

const db = await getDB();
const app = Fastify();
app.decorate("db", db);
await app.register(gameInventoryRoutes, { prefix: "/game/inventory" });

try {
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
  const refused = (text: string, edit: (doc: Record<string, any>) => void, pattern: RegExp, what: string) => {
    const parsed = parseRulesetDefinition(variant(text, edit));
    assert.equal(parsed.ok, false, `${what}: the file should be refused`);
    if (parsed.ok) return;
    assert.ok(
      parsed.issues.some((issue) => pattern.test(issue)),
      `${what}: expected ${pattern}, got ${parsed.issues.join("; ")}`,
    );
  };
  const itemCatalogOf = (doc: Record<string, any>) =>
    doc.catalogs.find((catalog: { holds?: string }) => catalog.holds === "items");
  const itemEntry = (doc: Record<string, any>, id: string) =>
    itemCatalogOf(doc).entries.find((entry: { id: string }) => entry.id === id);
  const entriesOf = (definition: RulesetDefinition): Record<string, RulesetCatalogEntry[]> =>
    Object.fromEntries(
      (definition.catalogs ?? []).flatMap((catalog) =>
        catalog.entries && catalog.holds !== "rows" ? [[catalog.id, catalog.entries]] : [],
      ),
    );
  const ember = parsedOrThrow(JSON.parse(emberText), "Ember Roads");
  const gravewatch = parsedOrThrow(JSON.parse(gravewatchText), "Gravewatch");
  const emberBook = rulesetItemBook(ember, entriesOf(ember));
  const graveBook = rulesetItemBook(gravewatch, entriesOf(gravewatch));
  const tonic = graveBook.itemOf("kit/warming-tonic")!.entry.item!;
  const resolveOf = (definition: RulesetDefinition, live: unknown) =>
    readRulesetLive(definition, defaultRulesetSheetBuild(definition), live).pools.find(
      (pool) => pool.key === "resolve",
    )!;

  // ── Import ──
  {
    assert.deepEqual(tonic.use?.restore, { pool: "resolve", amount: { flat: 1 } });
    const tonicUse = (edit: (use: Record<string, any>) => void) => (doc: Record<string, any>) =>
      edit(itemEntry(doc, "warming-tonic").item.use);
    refused(
      gravewatchText,
      tonicUse((use) => (use.restore.pool = "blood")),
      /use\.restore\.pool: Unknown pool "blood"/,
      "a pool",
    );
    refused(
      emberText,
      (doc) => (itemEntry(doc, "poultice").item.use.restore = { pool: "grit", amount: { flat: 1 } }),
      /use\.restore\.pool: Health comes back with a heal, not a restore/,
      "the health pool",
    );
    refused(
      gravewatchText,
      tonicUse((use) => (use.restore.amount = {})),
      /use\.restore: A restore says how much it gives back/,
      "no amount",
    );
    refused(
      gravewatchText,
      tonicUse((use) => {
        use.kind = "attack";
        use.amount = { dice: "1d10" };
      }),
      /use\.restore: A restore is on a use that helps, a heal or a buff/,
      "a restore on a blow",
    );
    refused(
      gravewatchText,
      tonicUse((use) => (use.restore.from = "bag")),
      /Unrecognized key/,
      "a key nobody reads",
    );
    // A buff that only restores is a use of its own.
    parsedOrThrow(
      variant(gravewatchText, (doc) => {
        const use = itemEntry(doc, "warming-tonic").item.use;
        use.kind = "buff";
        delete use.amount;
      }),
      "a restore alone",
    );
  }

  // ── Install gate: 1.60 ──
  {
    const manifest = (minor: number, paths = ["ruleset.json"]) => ({
      schemaVersion: 2,
      capabilityApi: { major: 1, minor },
      builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
      id: "ruleset-item-restore",
      name: "Item restore",
      version: "0.1.0",
      description: "A packaged ruleset whose items restore a pool.",
      engine: { min: "2.4.6", maxExclusive: "4.0.0" },
      kind: ["ruleset"],
      entrypoints: {},
      contributions: { assets: { paths } },
      files: paths.map((path) => ({ path, sha256: "0".repeat(64), bytes: 10 })),
      permissions: [],
      restartRequired: false,
    });
    const gateIssue = /items restore a pool when used.*capabilityApi 1\.60/;
    const issue = (minor: number, doc: Record<string, any>, paths?: string[], files?: Map<string, unknown>) =>
      getCapabilityPackageInstallIssue(manifest(minor, paths) as any, doc, files);
    // Less the dawn bell's recharge and break and the litany page, whose gate is 1.62's: they have
    // lanes of their own.
    const gravewatchAt160 = JSON.stringify(
      variant(gravewatchText, (doc) => {
        itemEntry(doc, "dawn-bell").item.charges = { max: 3 };
        const catalog = itemCatalogOf(doc);
        catalog.entries = catalog.entries.filter((entry: { id: string }) => entry.id !== "litany-page");
      }),
    );
    assert.match(issue(59, variant(gravewatchAt160)) ?? "", gateIssue);
    assert.equal(issue(60, variant(gravewatchAt160)), null);
    const withoutRestore = (doc: Record<string, any>) => delete itemEntry(doc, "warming-tonic").item.use.restore;
    assert.equal(issue(59, variant(gravewatchAt160, withoutRestore)), null, "the rest of the example stays 1.59");
    assert.equal(issue(59, variant(emberText)), null, "Ember Roads restores nothing");
    const inFile = variant(gravewatchAt160, (doc) => {
      const catalog = itemCatalogOf(doc);
      delete catalog.entries;
      catalog.asset = "catalogs/kit.json";
    });
    const paths = ["ruleset.json", "catalogs/kit.json"];
    const files = new Map<string, unknown>([
      ["catalogs/kit.json", { entries: itemCatalogOf(variant(gravewatchAt160)).entries }],
    ]);
    assert.match(issue(59, inFile, paths, files) ?? "", gateIssue, "a catalog file");
    assert.equal(issue(60, inFile, paths, files), null);
  }

  // ── In a fight ──
  const firstOf = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) => {
    const found = events.find((event): event is Extract<RulesetCombatEvent, { type: T }> => event.type === type);
    assert.ok(found, `no ${type} event in ${JSON.stringify(events.map((event) => event.type))}`);
    return found;
  };
  const held = (item: RulesetSheetItem["item"], name: string, worn = false, quantity = 1): RulesetSheetItem => ({
    item,
    quantity,
    worn,
    name,
  });
  const t = ((key: string, params?: Record<string, unknown>) =>
    [key, ...Object.values(params ?? {}).map(String)].join("|")) as never;
  {
    const state = createRulesetEncounter({
      definition: gravewatch,
      seed: 5,
      roller: () => 4,
      combatants: [
        {
          id: "ada",
          name: "Ada",
          side: "party",
          build: defaultRulesetSheetBuild(gravewatch),
          items: [held(tonic, "Warming tonic")],
          live: { pools: { resolve: { value: 1 } } },
        },
        {
          id: "foe",
          name: "Foe",
          side: "enemy",
          block: { health: 30, defense: 1, initiativeModifier: -20, actions: [] },
        },
      ],
    });
    assert.equal(
      rulesetCombatOptions(gravewatch, state, "ada").find((option) => option.id === "use:0")?.restores,
      "resolve",
    );
    const step = applyRulesetCombatChoice(
      gravewatch,
      state,
      { actorId: "ada", optionId: "use:0", targetIds: ["ada"] },
      () => 4,
    );
    const restored = firstOf(step.events, "restored");
    assert.deepEqual(restored, {
      type: "restored",
      targetId: "ada",
      sourceId: "ada",
      pool: "Resolve",
      rolls: [],
      flat: 1,
      amount: 1,
      value: 2,
      max: resolveOf(gravewatch, {}).max,
    });
    assert.equal(resolveOf(gravewatch, rulesetCombatant(step.state, "ada")!.sheet!.live).value, 2);
    const names = rulesetCombatNames(gravewatch, { combatants: step.state.combatants } as never, t);
    assert.equal(
      rulesetCombatEventLine(restored, names, t),
      `game.combat.ruleset.event.restored|Ada|1|Resolve|2|${resolveOf(gravewatch, {}).max}`,
    );
  }
  {
    // A party member the Engine plays drinks smelling salts that only give back Resolve when some is
    // gone, and leaves them alone when none is.
    const salted = parsedOrThrow(
      variant(gravewatchText, (doc) => {
        const use = itemEntry(doc, "warming-tonic").item.use;
        use.kind = "buff";
        delete use.amount;
      }),
      "smelling salts",
    );
    const salts = rulesetItemBook(salted, entriesOf(salted)).itemOf("kit/warming-tonic")!.entry.item!;
    const saltsUsed = (resolve: number) => {
      const bestiary = Object.fromEntries(
        (salted.catalogs ?? []).flatMap((catalog) =>
          catalog.holds === "creatures" && catalog.entries ? [[catalog.id, catalog.entries]] : [],
        ),
      );
      const built = createRulesetFight({
        definition: salted,
        seed: 3,
        party: [{ id: "ada", name: "Ada" }],
        enemies: [{ id: "rats", name: "Grave-rat swarm", creature: "night/grave-rats" }],
        cards: [{ name: "Ada", rulesetSheet: { v: 1, build: defaultRulesetSheetBuild(salted) } }],
        playerName: null,
        live: { ada: { pools: { resolve: { value: resolve } } } },
        items: () => [held(salts, "Smelling salts", false, 3)],
        partyCatalogs: {},
        bestiary,
      });
      assert.ok(built.ok, built.ok ? "" : built.error);
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
      const director = createCombatDirector({
        id: "fight",
        anchor: "anchor",
        style: "ruleset",
        party: [unit("ada", "Ada", "player")],
        enemies: [unit("rats", "Grave-rat swarm", "enemy")],
        gm: false,
        difficulty: "normal",
        seed: 3,
      } as never);
      director.rulesetFight = built.fight;
      syncRulesetCombatants(salted, director);
      director.stage = rulesetDirectorStage(director);
      assert.ok(
        commandRulesetCombatDirector(salted, director, { type: "control", unitId: "ada", controller: "ai" }).ok,
      );
      const said = () => director.rulesetFight!.events.map((entry) => entry.event);
      for (let guard = 0; guard < 12 && !director.outcome && !said().some((event) => event.type === "uses"); guard++) {
        assert.ok(commandRulesetCombatDirector(salted, director, { type: "continue" }).ok);
      }
      return said().some((event) => event.type === "uses" && event.actorId === "ada");
    };
    assert.equal(saltsUsed(0), true, "Resolve spent, so the salts are worth a turn");
    assert.equal(saltsUsed(resolveOf(salted, {}).max), false, "Resolve full, so they are left in the bag");
  }

  // ── Outside a fight ──
  const juno = defaultRulesetSheetBuild(ember);
  const dice = (...faces: number[]) => {
    let at = 0;
    return () => faces[at++ % faces.length]!;
  };
  const use = (
    definition: RulesetDefinition,
    book: typeof emberBook,
    stacks: GameInventoryStack[],
    stackId: string,
    live: unknown,
    roll = dice(3),
  ) =>
    useRulesetItemOutsideFight({
      definition,
      itemOf: book.itemOf,
      stacks,
      stackId,
      user: { name: "Juno", build: defaultRulesetSheetBuild(definition), live },
      roll,
    });
  {
    const stacks: GameInventoryStack[] = [
      { id: "st-poultice", name: "Poultice", item: "outfitter/poultice", quantity: 2, holder: "Juno" },
      { id: "st-arrows", name: "Arrows", item: "outfitter/arrows", quantity: 4, holder: "Juno" },
      { id: "st-rope", name: "Rope", quantity: 1, holder: "Juno" },
    ];
    const hurt = { pools: { grit: { value: 2 } } };
    const used = use(ember, emberBook, stacks, "st-poultice", hurt);
    assert.ok(used.ok, JSON.stringify(used));
    // 1d4 + 1 with a 3 on the die.
    assert.deepEqual(used.said.parts, [{ kind: "heal", amount: 4, rolls: [3], now: used.said.parts[0]!.now }]);
    assert.equal(readRulesetLive(ember, juno, used.live).pools.find((pool) => pool.key === "grit")!.value, 6);
    assert.equal(used.stacks.find((stack) => stack.id === "st-poultice")!.quantity, 1);
    assert.deepEqual(used.journal, [{ item: "Poultice", action: "used", quantity: 1 }]);
    assert.deepEqual(used.said.left, { count: 1 });
    assert.equal(rulesetItemUseLine(used.said), `Juno uses Poultice: heals 4 (${used.said.parts[0]!.now}). 1 left.`);
    assert.match(used.said.parts[0]!.now!, /^Grit 6\/\d+/);
    // The last one takes the stack with it.
    const last = use(ember, emberBook, used.stacks, "st-poultice", used.live);
    assert.ok(last.ok);
    assert.equal(
      last.stacks.some((stack) => stack.id === "st-poultice"),
      false,
    );
    assert.match(rulesetItemUseLine(last.said), /\. None left\.$/);
    // What cannot be used changes nothing.
    assert.deepEqual(use(ember, emberBook, stacks, "st-missing", hurt), { ok: false, reason: "no-stack" });
    assert.deepEqual(use(ember, emberBook, stacks, "st-rope", hurt), { ok: false, reason: "not-ruleset-item" });
    assert.deepEqual(use(ember, emberBook, stacks, "st-arrows", hurt), { ok: false, reason: "no-use" });
    // Temporary points and a condition on its user.
    const bracing = parsedOrThrow(
      variant(emberText, (doc) => {
        doc.sheet.live.pools.find((pool: { id: string }) => pool.id === "grit").allowTemp = true;
        const use = itemEntry(doc, "poultice").item.use;
        use.kind = "buff";
        delete use.amount;
        use.temporary = { flat: 3 };
        use.applies = [{ condition: "wounded", duration: { rounds: 2 } }];
      }),
      "a bracing draught",
    );
    const braced = use(bracing, rulesetItemBook(bracing, entriesOf(bracing)), stacks, "st-poultice", {});
    assert.ok(braced.ok);
    assert.deepEqual(
      braced.said.parts.map((part) => [part.kind, part.amount ?? part.label]),
      [
        ["temporary", 3],
        ["condition", "Wounded"],
      ],
    );
    // Without a buffer on the pool, temporary points land nowhere and are not said.
    const unbuffered = parsedOrThrow(
      variant(emberText, (doc) => {
        const use = itemEntry(doc, "poultice").item.use;
        use.kind = "buff";
        delete use.amount;
        use.temporary = { flat: 3 };
      }),
      "a draught with nowhere to go",
    );
    const nowhere = use(unbuffered, rulesetItemBook(unbuffered, entriesOf(unbuffered)), stacks, "st-poultice", {});
    assert.ok(nowhere.ok);
    assert.deepEqual(nowhere.said.parts, []);
    assert.match(rulesetItemUseLine(nowhere.said), /: nothing changed\. 1 left\.$/);
    const live = readRulesetLive(bracing, juno, braced.live);
    assert.equal(live.pools.find((pool) => pool.key === "grit")!.temp, 3);
    assert.equal(live.conditions.find((condition) => condition.id === "wounded")?.active, true);
    // Help aimed at the other side lands on nobody here either.
    const foesOnly = parsedOrThrow(
      variant(emberText, (doc) => Object.assign(itemEntry(doc, "poultice").item.use, { targets: "enemy" })),
      "a poultice for the foe",
    );
    const offered = use(foesOnly, rulesetItemBook(foesOnly, entriesOf(foesOnly)), stacks, "st-poultice", hurt);
    assert.ok(offered.ok);
    assert.deepEqual([offered.said.parts, offered.live], [[], hurt]);
    assert.equal(offered.said.aimed, "heals 1d4 + 1, range 0 paces");
    // Aimed at the other side: nothing lands, it is still used, and the words say what it does.
    const thrown = parsedOrThrow(
      variant(emberText, (doc) =>
        Object.assign(itemEntry(doc, "poultice").item.use, {
          kind: "attack",
          targets: "enemy",
          amount: { dice: "2d6" },
          damageType: "burn",
        }),
      ),
      "a poultice thrown",
    );
    const flung = use(thrown, rulesetItemBook(thrown, entriesOf(thrown)), stacks, "st-poultice", hurt);
    assert.ok(flung.ok);
    assert.deepEqual(flung.said.parts, []);
    assert.equal(flung.said.aimed, "2d6 burn, range 0 paces");
    assert.deepEqual(flung.live, hurt, "nothing on the sheet");
    assert.equal(flung.stacks.find((stack) => stack.id === "st-poultice")!.quantity, 1);
    assert.equal(
      rulesetItemUseLine(flung.said),
      "Juno uses Poultice: aimed at somebody else, so nothing was applied: 2d6 burn, range 0 paces. 1 left.",
    );
  }
  {
    // Gravewatch: the tonic clears a box of harm and gives back Resolve; the bell rings only worn and
    // bound, spends a charge and lands on nobody here.
    const stacks: GameInventoryStack[] = [
      { id: "st-tonic", name: "Warming tonic", item: "kit/warming-tonic", quantity: 1 },
      { id: "st-bell", name: "Dawn bell", item: "kit/dawn-bell", quantity: 1, equipped: true, bound: true, charges: 1 },
    ];
    const worn = { wounds: { harm: { marks: ["knock", "knock"] } }, pools: { resolve: { value: 1 } } };
    const drunk = use(gravewatch, graveBook, stacks, "st-tonic", worn);
    assert.ok(drunk.ok);
    assert.deepEqual(
      drunk.said.parts.map((part) => [part.kind, part.amount, part.label]),
      [
        ["heal", 1, undefined],
        ["restore", 1, "Resolve"],
      ],
    );
    const after = readRulesetLive(gravewatch, defaultRulesetSheetBuild(gravewatch), drunk.live);
    assert.equal(after.tracks.find((track) => track.id === "harm")!.wound!.filled, 1, "one mark cleared");
    assert.equal(after.pools.find((pool) => pool.key === "resolve")!.value, 2);
    const rung = use(gravewatch, graveBook, stacks, "st-bell", worn);
    assert.ok(rung.ok);
    assert.deepEqual(rung.said.parts, []);
    assert.equal(rung.said.aimed, "Steel 7 save negates it, Rattled");
    assert.deepEqual(rung.said.left, { charges: 0, max: 3 });
    assert.equal(rung.stacks.find((stack) => stack.id === "st-bell")!.charges, 0);
    assert.deepEqual(rung.journal, [{ item: "Dawn bell", action: "used", quantity: 1 }]);
    assert.deepEqual(use(gravewatch, graveBook, rung.stacks, "st-bell", worn), { ok: false, reason: "none-left" });
    const unbound = stacks.map((stack) => (stack.id === "st-bell" ? { ...stack, bound: undefined } : stack));
    assert.deepEqual(use(gravewatch, graveBook, unbound, "st-bell", worn), { ok: false, reason: "not-worn" });
    // A charm that binds and takes no slot is used once bound, with nothing to put on.
    const charmed = parsedOrThrow(
      variant(gravewatchText, (doc) => delete itemEntry(doc, "dawn-bell").item.slots),
      "a bell that only binds",
    );
    const charm = rulesetItemBook(charmed, entriesOf(charmed));
    const boundOnly = [{ id: "st-charm", name: "Dawn bell", item: "kit/dawn-bell", quantity: 1, bound: true as const }];
    assert.equal(use(charmed, charm, boundOnly, "st-charm", worn).ok, true);
    assert.deepEqual(use(charmed, charm, [{ ...boundOnly[0]!, bound: undefined }], "st-charm", worn), {
      ok: false,
      reason: "not-worn",
    });
    const pocketed = stacks.map((stack) => (stack.id === "st-bell" ? { ...stack, equipped: undefined } : stack));
    assert.deepEqual(use(gravewatch, graveBook, pocketed, "st-bell", worn), { ok: false, reason: "not-worn" });
    // Facts and the Game Master's line say the restore.
    assert.deepEqual(rulesetItemFacts(gravewatch, tonic).use?.restore, { pool: "Resolve", amount: "1" });
    assert.match(
      rulesetItemPromptFacts(rulesetItemFacts(gravewatch, tonic)),
      /; use \(Quick\): heals 1, restores 1 Resolve, used up$/,
    );
  }

  // ── The Use button's route ──
  const chats = createChatsStorage(db);
  const states = createGameStateStorage(db);
  const RULESET_ID = "local/ember-use";
  await createGameRulesetsStorage(db).put({
    rulesetId: RULESET_ID,
    version: 1,
    sourceKind: "local",
    definition: JSON.stringify({ ...JSON.parse(emberText), id: "ember-use" }),
  });
  const newGame = async (inventory: GameInventoryStack[], ruleset = true) => {
    const chat = await chats.create({ name: "Use", mode: "game", characterIds: [] });
    const anchor = await chats.createMessage({ chatId: chat.id, role: "assistant", content: "The road." });
    await chats.patchMetadata(chat.id, {
      ...(ruleset
        ? {
            gameRuleset: { id: RULESET_ID, version: 1, packageId: null, options: {} },
            gameCharacterCards: [{ name: "Juno", rulesetSheet: { v: 1, build: juno } }],
          }
        : {}),
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
    // Down to nothing, so whatever the die gives back leaves Juno below full.
    await states.updateLatest(chat.id, { rulesetLive: { juno: { pools: { grit: { value: 0 } } } } });
    return chat.id;
  };
  const post = (payload: unknown) => app.inject({ method: "POST", url: "/game/inventory/use", payload });
  {
    const chatId = await newGame([
      { id: "st-poultice", name: "Poultice", item: "outfitter/poultice", quantity: 2, holder: "Juno" },
      { id: "st-coat", name: "Leather coat", item: "outfitter/leather-coat", quantity: 1, holder: "Juno" },
    ]);
    const answered = await post({ chatId, stackId: "st-poultice" });
    assert.equal(answered.statusCode, 200, answered.body);
    const body = answered.json();
    assert.equal(body.inventory.find((stack: GameInventoryStack) => stack.id === "st-poultice").quantity, 1);
    assert.ok(body.rulesetLive.juno, "Juno's sheet is still below full");
    const grit = readRulesetLive(ember, juno, body.rulesetLive.juno).pools.find((pool) => pool.key === "grit")!.value;
    assert.ok(grit >= 2 && grit <= 5, `1d4 + 1 back on 0, now ${grit}`);
    assert.match(body.line, /^Juno uses Poultice: heals \d \(Grit \d+\/\d+.*\)\. 1 left\.$/);
    // Written: the bag and the journal in the chat, and the sheet on the row the player sees.
    const chat = await chats.getById(chatId);
    const metadata = typeof chat!.metadata === "string" ? JSON.parse(chat!.metadata) : chat!.metadata;
    assert.equal(metadata.gameInventory.find((stack: GameInventoryStack) => stack.id === "st-poultice").quantity, 1);
    assert.ok(JSON.stringify(metadata.gameJournal).includes("Poultice"), "the journal says it was used");
    const row = await states.getLatest(chatId);
    assert.deepEqual(JSON.parse(row!.rulesetLive as string), body.rulesetLive);
    // Refused, and nothing written.
    const missing = await post({ chatId, stackId: "st-nothing" });
    assert.equal(missing.statusCode, 404);
    const coat = await post({ chatId, stackId: "st-coat" });
    assert.equal(coat.statusCode, 409);
    assert.equal(coat.json().reason, "no-use");
    assert.equal((await post({ chatId })).statusCode, 400);
    const unchanged = await chats.getById(chatId);
    assert.deepEqual(
      (typeof unchanged!.metadata === "string" ? JSON.parse(unchanged!.metadata) : unchanged!.metadata).gameInventory,
      metadata.gameInventory,
    );
    const plain = await newGame([{ id: "st-rope", name: "Rope", quantity: 1 }], false);
    const noRuleset = await post({ chatId: plain, stackId: "st-rope" });
    assert.equal(noRuleset.statusCode, 409);
    assert.equal(noRuleset.json().reason, "no-ruleset");
  }

  // ── The Game Master's tag ──
  {
    const context = { definition: ember, packageId: null, cards: [{ name: "Juno", build: juno }], playerName: null };
    const stacks: GameInventoryStack[] = [
      { id: "st-poultice", name: "Poultice", item: "outfitter/poultice", quantity: 3, holder: "Juno" },
    ];
    const party = { members: ["Juno"] };
    const base = { juno: { pools: { grit: { value: 2 } } } };
    const tell = (content: string, seed = 11) => {
      const user = gameInventoryItemUser(context as never, emberBook.itemOf, base, seed);
      return { ...applyGameInventoryTags(content, stacks, party, undefined, emberBook, user.useItem), user };
    };
    const once = tell(`She presses it on. [inventory: action="use" item="Poultice" who="Juno"]`);
    assert.equal(once.stacks[0]!.quantity, 2);
    assert.equal(once.user.used(), true);
    const [answer] = readResolvedInventoryTags(once.content);
    assert.deepEqual(
      answer && { action: answer.action, item: answer.item, count: answer.count, ok: answer.ok, now: answer.now },
      { action: "use", item: "Poultice", count: 1, ok: true, now: 2 },
    );
    assert.match(once.content, /note="Juno uses Poultice: heals \d \(Grit \d+\/\d+[^"]*\)\. 2 left\."/);
    const grit = readRulesetLive(ember, juno, once.user.live().juno).pools.find((pool) => pool.key === "grit")!.value;
    assert.ok(grit > 2, "the sheet the turn saves has the heal");
    assert.deepEqual(once.journal, [{ item: "Poultice", action: "used", quantity: 1 }]);
    // Worked out again from the same seed, it rolls the same: the preview and the saved reply agree.
    assert.equal(tell(`She presses it on. [inventory: action="use" item="Poultice" who="Juno"]`).content, once.content);
    // Two at once, and more than there are.
    const twice = tell(`[inventory: action="use" item="Poultice" who="Juno" count="5"]`);
    assert.equal(twice.stacks.length, 0);
    assert.equal(readResolvedInventoryTags(twice.content)[0]!.count, 3);
    // Nothing to use it with, or nothing held.
    const bare = applyGameInventoryTags(
      `[inventory: action="use" item="Poultice" who="Juno"]`,
      stacks,
      party,
      undefined,
      emberBook,
    );
    assert.match(bare.content, /result="refused" reason="cannot-use"/);
    assert.match(tell(`[inventory: action="use" item="Hand axe" who="Juno"]`).content, /reason="none-held"/);
    assert.match(
      tell(`[inventory: action="use" item="Poultice"]`).content,
      /reason="none-held"/,
      "not in the player's bag",
    );
    // Written as a bare word, as the Game Master sometimes does, it is still a use.
    assert.equal(
      readResolvedInventoryTags(tell(`[inventory: use item="Poultice" who="Juno"]`).content)[0]?.action,
      "use",
    );
  }

  // ── The block, and the prompt ──
  {
    assert.ok(RESERVED_GM_TAG_NAMES.includes("item_used"));
    const sent = "I use my Poultice.\n\n[item_used]\nJuno uses Poultice: heals 4 (Grit 6/11). 1 left.\n[/item_used]";
    assert.equal(stripEngineResultBlocks(sent).trim(), "I use my Poultice.");
    assert.equal(stripGmTags(sent).trim(), "I use my Poultice.");
    assert.equal(
      stripEngineResultBlocks("[combat_result]\nWon.\n[/combat_result] After [item_used]x[/item_used]").trim(),
      "After",
    );
    const reminder = (definition: RulesetDefinition) =>
      buildGmFormatReminder({ hasSceneModel: true, ruleset: definition } as never);
    assert.match(reminder(ember), /\[inventory: action="use" item="Name" who="Name"\]/);
    assert.match(reminder(ember), /\[item_used\] block/);
    const noItems = parsedOrThrow(
      variant(emberText, (doc) => {
        doc.catalogs = doc.catalogs.filter((catalog: { holds?: string }) => catalog.holds !== "items");
      }),
      "Ember Roads without a catalog of items",
    );
    assert.doesNotMatch(reminder(noItems), /action="use"/);
  }

  console.log(
    "Ruleset item use outside a fight: restore at import, the 1.60 gate, restore in a fight and the picker, a use on its user or aimed away, refusals, the Use route, the Game Master's tag, the block and the prompt passed.",
  );
} finally {
  await app.close();
  await closeDB();
  rmSync(dataDir, { recursive: true, force: true });
}
