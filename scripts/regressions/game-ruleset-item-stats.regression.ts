/**
 * Items reach the sheet (#6826, Capability API 1.52).
 *
 *   - `itemStat` is read and checked at import: it needs the items block, names a stat, slot,
 *     category and tag the ruleset has, reads only a number stat unless it counts, names a stat
 *     unless it counts, and is refused wherever the live state is (a pool's or track's maximum, the
 *     carry numbers, a scaled column, and a derived value one of those reads). The install gate asks
 *     for 1.52, in the ruleset file and in a catalog file.
 *   - It picks items by where they are (worn, only carried, all) and by slot, category and tag, and
 *     reads them by sum (value times how many), highest, lowest or count; none reads its default.
 *   - An item is worn while it is on, and bound where it must be; one that neither takes slots nor
 *     binds is only carried. The player's card reads the player's bag, every other card its own.
 *   - Every in-game sheet reads the holder's items: a check, the Game Master's sheet block and a
 *     ruleset fight's start, through the real services and routes. Outside a game nothing is held.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  createRulesetEncounter,
  defaultRulesetSheetBuild,
  evaluateRulesetSheetLive,
  parseRulesetDefinition,
  rulesetCardItems,
  rulesetCombatant,
  rulesetInitiativeModifierNow,
  rulesetItemBook,
  rulesetReadsItems,
  rulesetSheetItems,
  type DirectedCombatView,
  type GameInventoryStack,
  type RulesetCatalogEntry,
  type RulesetCatalogItem,
  type RulesetDefinition,
  type RulesetSheetItem,
} from "../../packages/shared/src/index.js";

// Server modules read DATA_DIR once at load, so they are imported only after it points at scratch.
const dataDir = mkdtempSync(join(tmpdir(), "marinara-ruleset-item-stats-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");

const { default: Fastify } = await import("../../packages/server/node_modules/fastify/fastify.js");
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createGameStateStorage } = await import("../../packages/server/src/services/storage/game-state.storage.js");
const { createGameRulesetsStorage } =
  await import("../../packages/server/src/services/storage/game-rulesets.storage.js");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");
const { renderGameRulesetSheetBlocks } =
  await import("../../packages/server/src/services/game/ruleset-sheet-turn.service.js");
const { loadSkillCheckModifierContext } =
  await import("../../packages/server/src/services/game/skill-check-resolution.service.js");
const { combatDirectorRoutes } = await import("../../packages/server/src/routes/combat-director.routes.js");

const db = await getDB();
const app = Fastify();
app.decorate("db", db);
await app.register(combatDirectorRoutes, { prefix: "/combat", chooseBoss: async () => "" });

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
  const derivedOf = (doc: Record<string, any>, id: string) =>
    doc.sheet.derived.find((entry: { id: string }) => entry.id === id);
  /** A derived value `probe` at the end of the sheet that reads one `itemStat` and nothing else. */
  const withProbe = (itemStat: Record<string, unknown>) => (doc: Record<string, any>) => {
    doc.sheet.derived.push({ id: "probe", label: "Probe", op: "sum", of: [{ itemStat }] });
  };
  const entriesOf = (definition: RulesetDefinition): Record<string, RulesetCatalogEntry[]> =>
    Object.fromEntries(
      (definition.catalogs ?? []).flatMap((catalog) =>
        catalog.holds === "items" && catalog.entries ? [[catalog.id, catalog.entries]] : [],
      ),
    );

  const ember = parsedOrThrow(JSON.parse(emberText), "Ember Roads");
  const gravewatch = parsedOrThrow(JSON.parse(gravewatchText), "Gravewatch");
  const emberBook = rulesetItemBook(ember, entriesOf(ember));
  const itemOf = (id: string): RulesetCatalogItem => {
    const found = emberBook.itemOf(`outfitter/${id}`)?.entry.item;
    assert.ok(found, `Ember Roads has ${id}`);
    return found;
  };

  // ── Import: what an itemStat may name, and where it may sit ──
  {
    assert.deepEqual(derivedOf(JSON.parse(emberText), "guard").of[2], {
      itemStat: { stat: "guard", from: "worn", pick: "sum" },
    });
    assert.equal(rulesetReadsItems(ember), true, "Ember Roads reads the items it holds");
    // Any ruleset with items may read them (an item's abilities or a level off a derived value do,
    // since 1.54), and one without has none to read.
    assert.equal(rulesetReadsItems(gravewatch), true, "so does Gravewatch");
    const noItems = parsedOrThrow(
      variant(gravewatchText, (doc) => {
        delete doc.items;
        doc.catalogs = doc.catalogs.filter((catalog: { holds?: string }) => catalog.holds !== "items");
        // And the grave wight's resistance, whose exception names an item tag.
        doc.catalogs = doc.catalogs.map((catalog: { entries?: Array<{ id: string }> }) => ({
          ...catalog,
          entries: catalog.entries?.filter((entry) => entry.id !== "grave-wight"),
        }));
      }),
      "Gravewatch without items",
    );
    assert.equal(rulesetReadsItems(noItems), false, "and one without items does not");

    const probe = (itemStat: Record<string, unknown>) => withProbe(itemStat);
    parsedOrThrow(variant(emberText, probe({ from: "all", pick: "count" })), "a count that names no stat");
    parsedOrThrow(
      variant(emberText, probe({ stat: "guard", from: "carried", pick: "max", slot: "body", category: "armor" })),
      "every filter",
    );
    parsedOrThrow(
      variant(emberText, probe({ stat: "damage", from: "all", pick: "count", tag: "thrown" })),
      "a count of a dice stat",
    );
    refused(
      emberText,
      probe({ from: "worn", pick: "sum" }),
      /itemStat\.stat: An itemStat names the stat it reads, unless it only counts items/,
      "a sum that names no stat",
    );
    refused(
      emberText,
      probe({ stat: "heft", from: "worn", pick: "sum" }),
      /Unknown item stat "heft"/,
      "an unknown stat",
    );
    refused(
      emberText,
      probe({ stat: "damage", from: "worn", pick: "max" }),
      /Item stat "damage" is not a number/,
      "a dice stat read as a number",
    );
    refused(
      emberText,
      probe({ stat: "reach", from: "worn", pick: "min" }),
      /Item stat "reach" is not a number/,
      "an enum stat read as a number",
    );
    refused(
      emberText,
      probe({ stat: "guard", from: "worn", pick: "sum", slot: "feet" }),
      /Unknown slot "feet"/,
      "an unknown slot",
    );
    refused(
      emberText,
      probe({ stat: "guard", from: "worn", pick: "sum", category: "shield" }),
      /Unknown item category "shield"/,
      "an unknown category",
    );
    refused(
      emberText,
      probe({ stat: "guard", from: "worn", pick: "sum", tag: "heavy" }),
      /Unknown item tag "heavy"/,
      "an unknown tag",
    );
    refused(emberText, probe({ stat: "guard", from: "pack", pick: "sum" }), /from/, "an unknown place");
    refused(emberText, probe({ stat: "guard", from: "worn", pick: "average" }), /pick/, "an unknown pick");
    refused(
      emberText,
      probe({ stat: "guard", from: "worn", pick: "sum", weight: 2 }),
      /Unrecognized key/,
      "an unknown key",
    );
    refused(
      gravewatchText,
      (doc) => {
        delete doc.items;
        doc.catalogs = doc.catalogs.filter((catalog: { holds?: string }) => catalog.holds !== "items");
        withProbe({ from: "all", pick: "count" })(doc);
      },
      /This ruleset has no items block, so there are no items to read/,
      "a ruleset with no items block",
    );

    // Items change in play, so nothing worked out without the live state may read them, directly or
    // through a derived value.
    const noLive = /cannot read the items anyone holds|reads the live state, which this value cannot/;
    refused(
      emberText,
      (doc) => (doc.items.carry.limit = { itemStat: { from: "all", pick: "count" } }),
      noLive,
      "the carry limit",
    );
    refused(
      emberText,
      (doc) => (doc.items.carry.encumberedAbove = { derived: "guard" }),
      noLive,
      "the carry line, through Guard",
    );
    refused(
      emberText,
      (doc) => (doc.sheet.live.pools[0].max = { itemStat: { stat: "guard", from: "worn", pick: "sum" } }),
      noLive,
      "a pool's maximum",
    );
    refused(
      gravewatchText,
      (doc) => (doc.sheet.live.tracks[0].max = { itemStat: { stat: "soak_blunt", from: "worn", pick: "sum" } }),
      noLive,
      "a track's maximum",
    );
    // And the places that are worked out with it take one: a check's modifier, a fight's defense.
    parsedOrThrow(
      variant(emberText, (doc) => {
        doc.resolution.adjust.push({ value: { itemStat: { from: "worn", pick: "count", category: "armor" } } });
      }),
      "a check modifier off the items",
    );
    parsedOrThrow(
      variant(emberText, (doc) => (doc.combat.defense = { itemStat: { stat: "guard", from: "all", pick: "max" } })),
      "a defense off the items",
    );
  }

  // ── Install gate: an itemStat is 1.52, in the ruleset file and in a catalog file ──
  {
    const manifest = (minor: number, paths = ["ruleset.json"]) => ({
      schemaVersion: 2,
      capabilityApi: { major: 1, minor },
      builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
      id: "ruleset-ember-roads",
      name: "Ember Roads",
      version: "0.1.0",
      description: "A packaged ruleset whose sheet reads items.",
      engine: { min: "2.4.6", maxExclusive: "4.0.0" },
      kind: ["ruleset"],
      entrypoints: {},
      contributions: { assets: { paths } },
      files: paths.map((path) => ({ path, sha256: "0".repeat(64), bytes: 10 })),
      permissions: [],
      restartRequired: false,
    });
    const itemStatIssue = /values read the items someone holds requires schemaVersion 2 and capabilityApi 1\.52/;
    const issue = (minor: number, doc: Record<string, any>, paths?: string[], files?: Map<string, unknown>) =>
      getCapabilityPackageInstallIssue(manifest(minor, paths) as any, doc, files);
    // Less what the example's items do to checks and its bonus caps, which are 1.53's and have a lane
    // of their own.
    const upTo152 = (edit: (doc: Record<string, any>) => void = () => {}) =>
      variant(emberText, (doc) => {
        // And the 1.54 level off a derived value.
        doc.combat.levels = doc.combat.levels.filter((level: { derived?: string }) => level.derived === undefined);
        for (const cap of doc.items.rarityCaps) delete cap.bonus;
        for (const catalog of doc.catalogs) {
          for (const entry of catalog.entries ?? []) {
            delete entry.item?.worn;
            delete entry.item?.carried;
            // And the 1.55 weapons.
            delete entry.item?.attack;
          }
        }
        edit(doc);
      });
    const whole = upTo152();
    assert.match(issue(51, whole) ?? "", itemStatIssue);
    assert.equal(issue(52, whole), null);
    const withoutRead = upTo152((doc) => {
      derivedOf(doc, "guard").of = derivedOf(doc, "guard").of.slice(0, 2);
      doc.sheet.derived = doc.sheet.derived.filter((entry: { id: string }) => entry.id !== "bulk_carried");
    });
    assert.equal(issue(51, withoutRead), null, "the rest of the example stays 1.51");
    // Anywhere it sits: a check's modifier, a catalog file.
    const inAdjust = upTo152((doc) => {
      derivedOf(doc, "guard").of = derivedOf(doc, "guard").of.slice(0, 2);
      doc.sheet.derived = doc.sheet.derived.filter((entry: { id: string }) => entry.id !== "bulk_carried");
      doc.resolution.adjust.push({ value: { itemStat: { from: "worn", pick: "count" } } });
    });
    assert.match(issue(51, inAdjust) ?? "", itemStatIssue, "a check's modifier");
    const catalogFile = { entries: [{ id: "x", label: "X", nested: [{ itemStat: { from: "all", pick: "count" } }] }] };
    assert.match(
      issue(51, withoutRead, ["ruleset.json", "catalogs/x.json"], new Map([["catalogs/x.json", catalogFile]])) ?? "",
      itemStatIssue,
      "a catalog file is read the same way",
    );
    assert.equal(
      issue(52, withoutRead, ["ruleset.json", "catalogs/x.json"], new Map([["catalogs/x.json", catalogFile]])),
      null,
    );
  }

  // ── What an itemStat reads ──
  {
    const coat = itemOf("leather-coat");
    const axe = itemOf("hand-axe");
    const bow = itemOf("hunting-bow");
    const rations = itemOf("road-rations");
    // A second armor, of the ruleset's own words, to have more than one of a kind.
    const mail: RulesetCatalogItem = { ...coat, stats: { bulk: 5, guard: 3 } };
    const held: RulesetSheetItem[] = [
      { item: coat, quantity: 1, worn: true },
      { item: mail, quantity: 1, worn: false },
      { item: axe, quantity: 3, worn: false },
      { item: bow, quantity: 1, worn: true },
      { item: rations, quantity: 4, worn: false },
    ];
    const read = (itemStat: Record<string, unknown>, items: RulesetSheetItem[] | "outside a game" = held) => {
      const definition = parsedOrThrow(variant(emberText, withProbe(itemStat)), "the probe");
      const given = items === "outside a game" ? undefined : items;
      return evaluateRulesetSheetLive(definition, defaultRulesetSheetBuild(definition), undefined, given).derived.probe;
    };
    // sum is each value times how many; an item without the stat is left out.
    assert.equal(read({ stat: "guard", from: "worn", pick: "sum" }), 1, "the coat on");
    assert.equal(read({ stat: "guard", from: "carried", pick: "sum" }), 3, "the mail in the pack");
    assert.equal(read({ stat: "guard", from: "all", pick: "sum" }), 4);
    assert.equal(read({ stat: "bulk", from: "all", pick: "sum" }), 3 + 5 + 3 + 2 + 4, "bulk times how many");
    assert.equal(read({ stat: "bulk", from: "carried", pick: "sum" }), 5 + 3 + 4);
    assert.equal(read({ stat: "bulk", from: "all", pick: "max" }), 5);
    assert.equal(read({ stat: "bulk", from: "all", pick: "min" }), 1, "one value, not times how many");
    assert.equal(read({ stat: "guard", from: "all", pick: "min" }), 1, "only items that give it");
    // count counts items, by how many, and only the ones that give a named stat.
    assert.equal(read({ from: "all", pick: "count" }), 1 + 1 + 3 + 1 + 4);
    assert.equal(read({ from: "worn", pick: "count" }), 2);
    assert.equal(read({ stat: "guard", from: "all", pick: "count" }), 2);
    // A stat written as 0 is still given, for every pick alike: counted, and the lowest.
    const cloak: RulesetCatalogItem = { ...coat, stats: { bulk: 1, guard: 0 } };
    const cloaked = [...held, { item: cloak, quantity: 1, worn: false }];
    assert.equal(read({ stat: "guard", from: "all", pick: "count" }, cloaked), 3, "a guard of 0 counts");
    assert.equal(read({ stat: "guard", from: "all", pick: "min" }, cloaked), 0, "and is the lowest");
    assert.equal(read({ stat: "damage", from: "all", pick: "count" }), 4, "a dice stat counts where it is given");
    // Filters.
    assert.equal(read({ stat: "guard", from: "all", pick: "max", slot: "body" }), 3);
    assert.equal(read({ from: "all", pick: "count", slot: "hands" }), 4);
    assert.equal(read({ from: "all", pick: "count", category: "weapon" }), 4);
    assert.equal(read({ from: "all", pick: "count", tag: "thrown" }), 3);
    assert.equal(read({ from: "worn", pick: "count", tag: "ranged", category: "weapon", slot: "hands" }), 1);
    // None reads the default, or nothing.
    assert.equal(read({ stat: "guard", from: "worn", pick: "max", category: "provisions" }), 0);
    assert.equal(read({ stat: "guard", from: "worn", pick: "max", category: "provisions", default: 10 }), 10);
    assert.equal(read({ from: "all", pick: "count", default: 2 }, []), 2);
    assert.equal(read({ stat: "guard", from: "all", pick: "sum", default: 1 }, "outside a game"), 1);

    // Guard, as the example writes it: the coat counts on the back and not in the pack.
    const guard = (items?: RulesetSheetItem[]) =>
      evaluateRulesetSheetLive(ember, defaultRulesetSheetBuild(ember), undefined, items).derived.guard;
    const bare = guard();
    assert.equal(guard([{ item: coat, quantity: 1, worn: true }]), bare + 1);
    assert.equal(guard([{ item: coat, quantity: 1, worn: false }]), bare);
  }

  // ── Worn, carried, and whose ──
  {
    const bag = (stacks: GameInventoryStack[], holder?: string) =>
      rulesetSheetItems(emberBook, stacks, holder).map((each) => ({ quantity: each.quantity, worn: each.worn }));
    const stacks: GameInventoryStack[] = [
      { id: "s1", name: "Leather coat", quantity: 1, item: "outfitter/leather-coat", equipped: true },
      { id: "s2", name: "Leather coat", quantity: 1, item: "outfitter/leather-coat" },
      { id: "s3", name: "Road rations", quantity: 4, item: "outfitter/road-rations" },
      // Not one of the ruleset's items: nothing to read.
      { id: "s4", name: "Lucky pebble", quantity: 1 },
      { id: "s5", name: "Hand axe", quantity: 1, item: "outfitter/hand-axe", holder: "Bram", equipped: true },
    ];
    assert.deepEqual(bag(stacks), [
      { quantity: 1, worn: true },
      { quantity: 1, worn: false },
      { quantity: 4, worn: false },
    ]);
    assert.deepEqual(bag(stacks, "Bram"), [{ quantity: 1, worn: true }], "a companion's own bag");
    assert.deepEqual(bag(stacks, "bram"), [{ quantity: 1, worn: true }], "by the name the inventory keeps");

    // Binding: an item that takes slots and binds is worn while on and bound; one that only binds
    // while bound.
    const graveBook = rulesetItemBook(gravewatch, entriesOf(gravewatch));
    const ring = (stack: Partial<GameInventoryStack>, book = graveBook) =>
      rulesetSheetItems(
        book,
        [{ id: "r", name: "Widow's ring", quantity: 1, item: "kit/widows-ring", ...stack }],
        undefined,
      )[0]?.worn;
    assert.equal(ring({}), false);
    assert.equal(ring({ equipped: true }), false, "on but not bound");
    assert.equal(ring({ bound: true }), false, "bound but not on");
    assert.equal(ring({ equipped: true, bound: true }), true);
    const slotless = parsedOrThrow(
      variant(gravewatchText, (doc) => {
        const entry = doc.catalogs
          .find((catalog: { holds?: string }) => catalog.holds === "items")
          .entries.find((each: { id: string }) => each.id === "widows-ring");
        delete entry.item.slots;
      }),
      "a ring that only binds",
    );
    const slotlessBook = rulesetItemBook(slotless, entriesOf(slotless));
    assert.equal(ring({}, slotlessBook), false);
    assert.equal(ring({ bound: true }, slotlessBook), true, "bound is enough");

    // The player's card reads the player's bag: the card named for who the chat plays as, else the
    // first.
    const cardItems = (playerName: string | null) =>
      rulesetCardItems(emberBook, stacks, ["Juno", "Bram", "Wren"], playerName);
    assert.equal(cardItems(null)("Juno").length, 3, "the first card, with nobody named");
    assert.equal(cardItems(null)("Wren").length, 0);
    assert.equal(cardItems("Wren")("Wren").length, 3, "the card named for the player");
    assert.equal(cardItems("Wren")("Juno").length, 0, "and the first card is then just a card");
    assert.equal(cardItems("Nobody")("Juno").length, 3, "a player with no card of their own");
    assert.equal(cardItems(null)("Bram").length, 1, "a companion reads their own bag");
  }

  // ── A fight keeps what each fighter held as it began, for anything it works out again ──
  {
    const coat = itemOf("leather-coat");
    const thrown = parsedOrThrow(
      variant(emberText, (doc) => {
        doc.combat.initiative.modifier = { itemStat: { from: "worn", pick: "count" } };
      }),
      "initiative off the items worn",
    );
    const encounter = createRulesetEncounter({
      definition: thrown,
      seed: 7,
      combatants: [
        {
          id: "juno",
          name: "Juno",
          side: "party",
          build: defaultRulesetSheetBuild(thrown),
          items: [{ item: coat, quantity: 1, worn: true }],
        },
      ],
    });
    const juno = rulesetCombatant(encounter, "juno")!;
    assert.equal(juno.initiativeModifier, 1, "as the fight begins");
    assert.equal(rulesetInitiativeModifierNow(thrown, thrown.combat!, juno), 1, "and every round after");
  }

  // ── In a game: a check, the Game Master's sheet block, and a fight's start ──
  {
    const RULESET_ID = "local/ember-item-stats";
    const document = variant(emberText, (doc) => (doc.id = "ember-item-stats"));
    await createGameRulesetsStorage(db).put({
      rulesetId: RULESET_ID,
      version: ember.version,
      sourceKind: "local",
      definition: JSON.stringify(document),
    });
    const junoBuild = { ...defaultRulesetSheetBuild(ember), abilities: { brawn: 12, wits: 12, heart: 10 } };
    const bramBuild = { ...defaultRulesetSheetBuild(ember), abilities: { brawn: 14, wits: 10, heart: 10 } };
    const cards = [
      { name: "Juno", rulesetSheet: { v: 1, build: junoBuild } },
      { name: "Bram", rulesetSheet: { v: 1, build: bramBuild } },
    ];
    const guardOf = (build: typeof junoBuild, items?: RulesetSheetItem[]) =>
      evaluateRulesetSheetLive(ember, build, undefined, items).derived.guard;
    const junoBare = guardOf(junoBuild);
    const bramBare = guardOf(bramBuild);

    const chats = createChatsStorage(db);
    const states = createGameStateStorage(db);
    const newGame = async (inventory: GameInventoryStack[]) => {
      const chat = await chats.create({ name: "Items on the sheet", mode: "game", characterIds: [] });
      const anchor = await chats.createMessage({ chatId: chat.id, role: "assistant", content: "[state: combat]" });
      await chats.patchMetadata(chat.id, {
        gameSetupConfig: { combatDirector: true, difficulty: "Normal" },
        gameRuleset: { id: RULESET_ID, version: ember.version, packageId: null, options: {} },
        gameCharacterCards: cards,
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
      return { chat, anchor };
    };
    // Juno, the player, wears the coat; Bram carries a second one rolled up in his pack.
    const inventory: GameInventoryStack[] = [
      { id: "s1", name: "Leather coat", quantity: 1, item: "outfitter/leather-coat", equipped: true },
      { id: "s2", name: "Leather coat", quantity: 1, item: "outfitter/leather-coat", holder: "Bram" },
    ];
    const game = await newGame(inventory);

    // A check: the sheet it rolls with reads what each card holds.
    const context = await loadSkillCheckModifierContext(db, game.chat.id);
    assert.ok(context.ruleset, "the game has a ruleset context");
    assert.equal(context.ruleset!.sheets.get("juno")?.derived.guard, junoBare + 1, "the coat the player wears");
    assert.equal(context.ruleset!.sheets.get("bram")?.derived.guard, bramBare, "one in the pack does not count");

    // The Game Master's sheet block.
    const blocks = renderGameRulesetSheetBlocks(
      ember,
      cards,
      null,
      {},
      {
        book: emberBook,
        stacks: inventory,
        playerName: null,
      },
    );
    const guardIn = (block: string) => Number(/\bGuard (-?\d+)\b/.exec(block)?.[1]);
    assert.equal(guardIn(blocks[0]!), junoBare + 1, `Juno's block: ${blocks[0]}`);
    assert.equal(guardIn(blocks[1]!), bramBare, `Bram's block: ${blocks[1]}`);
    const unread = renderGameRulesetSheetBlocks(ember, cards, null);
    assert.equal(guardIn(unread[0]!), junoBare, "with no items given, nothing is held");

    // A ruleset fight's start: the defense is the sheet's Guard, coat and all.
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
    const start = await app.inject({
      method: "POST",
      url: "/combat/start",
      payload: {
        chatId: game.chat.id,
        anchor: game.anchor.id,
        style: "ruleset",
        party: [unit("juno", "Juno", "player"), unit("bram", "Bram", "player")],
        enemies: [unit("wolf", "Wolf", "enemy")],
      },
    });
    assert.equal(start.statusCode, 200, start.body);
    const session = start.json().session as DirectedCombatView;
    const defense = (id: string) => session.ruleset!.combatants.find((combatant) => combatant.id === id)?.defense;
    assert.equal(defense("juno"), junoBare + 1, "the player's worn coat");
    assert.equal(defense("bram"), bramBare, "Bram's coat is in his pack");
  }

  console.log(
    "Ruleset item stats: import checks, the 1.52 gate, every pick and filter, worn and whose, and checks, the Game Master's block and fights reading items passed.",
  );
} finally {
  await app.close();
  await closeDB();
  rmSync(dataDir, { recursive: true, force: true });
}
