/**
 * Storing a spell to cast later (Capability API 1.524).
 *
 *   - A mage stores a 3rd-level bolt in a worn Ring of Spell Storing instead of casting it: paid
 *     for, nothing done. Cast from the ring later it costs nothing and uses the mage's numbers, once.
 *   - What does not fit the levels left is refused; a ring not worn offers nothing.
 *   - The ring's stack keeps what it holds after the fight, and the next fight reads it.
 *   - A shield guardian beside the mage takes one spell and casts it itself.
 *   - Stored before the fight (`standing` with `into`). Refusals and the install gate.
 *   - Found holding some (1.576, `stores.found`): each stack's rolled levels drawn from its list,
 *     the same at every reading, until a fight changes them; emptied, it stays empty.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyRulesetCombatChoice,
  applyRulesetFightItemChanges,
  createRulesetEncounter,
  parseRulesetDefinition,
  rowsFromCatalogEntry,
  rulesetCombatant,
  rulesetFightItemChanges,
  rulesetStandingAtStart,
  rulesetCombatHealth,
  rulesetCombatOptions,
  rulesetItemBook,
  rulesetFoundStored,
  rulesetSheetItems,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetSheetItem,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-stores-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 524);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const spell = (id: string, mechanics: Record<string, unknown>, level: number) =>
    ({
      id,
      label: id[0]!.toUpperCase() + id.slice(1),
      rows: [{ list: "spells", values: { name: id[0]!.toUpperCase() + id.slice(1), level, prepared: true } }],
      mechanics: {
        kind: "attack",
        damageType: "fire",
        range: 120,
        amount: { flat: 5 },
        save: { save: "wis_save", onSuccess: "negates" },
        cost: [{ pool: `slots_${level}`, amount: 1 }],
        ...mechanics,
      },
    }) as unknown as RulesetCatalogEntry;
  const spells = [
    spell("bolt", {}, 3),
    spell("great", {}, 7),
    spell("burst", { area: { shape: "burst", size: 5 } }, 3),
  ];
  const document = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.items = { categories: [{ id: "gear", label: "Gear" }], slots: [{ id: "hand", label: "Hand", count: 2 }] };
    doc.catalogs.push(
      { id: "spells", label: "Spells", feeds: ["spells"], entries: spells },
      {
        id: "gear",
        label: "Gear",
        holds: "items",
        entries: [
          {
            id: "ring",
            label: "Ring of Spell Storing",
            item: { category: "gear", stack: 1, slots: { hand: 1 }, stores: { catalogs: ["spells"], levels: 5 } },
          },
        ],
      },
    );
    edit(doc);
    return doc;
  };
  const parsed = (doc: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(doc);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const refusedDoc = (doc: unknown, pattern: RegExp) => {
    const result = parseRulesetDefinition(doc);
    assert.equal(result.ok, false, `should be refused: ${pattern}`);
    if (!result.ok) assert.match(result.issues.join("; "), pattern);
  };
  const definition = parsed(document());
  const book = rulesetItemBook(definition, {
    gear: definition.catalogs!.find((one) => one.id === "gear")!.entries!,
  });
  const ring = (more: Partial<RulesetSheetItem> = {}): RulesetSheetItem => ({
    item: book.itemOf("gear/ring")!.entry.item!,
    quantity: 1,
    worn: true,
    name: "Ring of Spell Storing",
    stack: { id: "s1", ref: "gear/ring" },
    ...more,
  });
  const build = (more: Record<string, unknown> = {}) =>
    rulesetSheetBuildSchema.parse({
      abilities: { str: 10, dex: 10, con: 14, int: 10, wis: 16, cha: 10 },
      fields: {
        level: 13,
        ac: 12,
        speed: 30,
        hp_max: 60,
        spellcasting_ability: "wis",
        slots_max_3: 4,
        slots_max_7: 1,
      },
      ...more,
    });
  const guardianBlock = {
    health: 80,
    defense: 17,
    initiativeModifier: -50,
    speed: 30,
    actions: [],
    stores: { catalogs: ["spells"], levels: 4, count: 1 },
  } as unknown as RulesetStatBlock;
  const fight = (items: RulesetSheetItem[], guardian = false): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      bestiary: { spells },
      combatants: [
        {
          id: "mage",
          name: "Mage",
          side: "party",
          build: build({
            lists: { spells: spells.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)) },
          }),
          live: {},
          catalogs: { spells },
          items,
        },
        {
          id: "foe",
          name: "Foe",
          side: "enemy",
          block: {
            health: 100,
            defense: 5,
            initiativeModifier: 0,
            speed: 30,
            actions: [],
          } as unknown as RulesetStatBlock,
        },
        ...(guardian ? [{ id: "guard", name: "Guardian", side: "party" as const, block: guardianBlock }] : []),
      ],
      board: {
        grid: { width: 20, height: 5, tiles: Array.from({ length: 5 }, () => Array(20).fill("plains")) } as never,
        placements: { mage: { x: 2, y: 2 }, foe: { x: 10, y: 2 }, guard: { x: 3, y: 2 } },
      },
    });
    state.order = ["mage", "foe", ...(guardian ? ["guard"] : [])];
    state.turn = 0;
    return state;
  };
  const hp = (state: RulesetEncounterState) =>
    rulesetCombatHealth(definition, definition.combat!, rulesetCombatant(state, "foe")!).value;
  const option = (state: RulesetEncounterState, who: string, label: string) =>
    rulesetCombatOptions(definition, state, who).find((one) => one.label === label);
  const choose = (state: RulesetEncounterState, who: string, label: string, more: Record<string, unknown>) => {
    const offered = option(state, who, label);
    assert.ok(offered, `no ${label} for ${who}`);
    return applyRulesetCombatChoice(
      definition,
      state,
      { actorId: who, optionId: offered.id, targetIds: [], ...more },
      () => 10,
    );
  };
  const again = (state: RulesetEncounterState, who: string) => {
    state.turn = state.order.indexOf(who);
    rulesetCombatant(state, who)!.budgets.action = 1;
    return state;
  };
  const spends = (step: { events: RulesetCombatEvent[] }) => step.events.filter((one) => one.type === "spend").length;

  // ── Stored in a worn ring, cast from it later ──
  {
    const state = fight([ring()]);
    const bolt = option(state, "mage", "Bolt");
    assert.deepEqual(bolt?.storesIn, [{ holderId: "mage", item: 0, label: "Ring of Spell Storing", room: 5 }]);
    const stored = choose(state, "mage", "Bolt", { storesIn: { holderId: "mage", item: 0 } });
    const said = stored.events.find(
      (one): one is Extract<RulesetCombatEvent, { type: "stored" }> => one.type === "stored",
    );
    assert.ok(said, JSON.stringify(stored.events));
    assert.deepEqual([said.by, said.level, said.holderId], ["Ring of Spell Storing", 3, "mage"]);
    assert.equal(spends(stored), 1, "a 3rd-level slot paid");
    assert.equal(hp(stored.state), 100, "nothing done now");
    // A second does not fit the two levels left.
    const second = option(again(structuredClone(stored.state), "mage"), "mage", "Bolt");
    assert.deepEqual(second?.storesIn?.[0]?.room, 2);
    const refused = applyRulesetCombatChoice(
      definition,
      again(structuredClone(stored.state), "mage"),
      { actorId: "mage", optionId: second!.id, targetIds: [], storesIn: { holderId: "mage", item: 0 } },
      () => 10,
    );
    assert.equal(refused.events[0]?.type, "refused");
    // Cast from the ring: nothing paid, the mage's numbers, once.
    const ready = again(stored.state, "mage");
    const cast = choose(ready, "mage", "Ring of Spell Storing: Bolt", { targetIds: ["foe"] });
    assert.ok(!cast.events.some((one) => one.type === "refused"), JSON.stringify(cast.events));
    assert.equal(spends(cast), 0, "cast for nothing");
    assert.equal(hp(cast.state), 95);
    const save = cast.events.find((one): one is Extract<RulesetCombatEvent, { type: "save" }> => one.type === "save");
    assert.equal(
      save?.difficulty,
      rulesetCombatant(state, "mage")!.actions.find((one) => one.label === "Bolt")!.save!.difficulty,
    );
    assert.equal(option(again(cast.state, "mage"), "mage", "Ring of Spell Storing: Bolt"), undefined, "once");
    // What the ring holds is kept on its stack.
    const changes = rulesetFightItemChanges(undefined, stored.state);
    assert.deepEqual(
      changes[0]?.storedEntries?.map((one) => [one.entry, one.label, one.level]),
      [["spells/bolt", "Bolt", 3]],
    );
    const stacks = applyRulesetFightItemChanges(
      [{ id: "s1", name: "Ring of Spell Storing", item: "gear/ring", quantity: 1, equipped: true }],
      changes,
    );
    assert.equal(stacks?.stacks[0]?.storedEntries?.[0]?.entry, "spells/bolt");
    const emptied = applyRulesetFightItemChanges(stacks!.stacks, rulesetFightItemChanges(stored.state, cast.state));
    assert.deepEqual(emptied?.stacks[0]?.storedEntries, [], "cast, it holds nothing, and says so (1.576)");
  }
  // ── Too high a level; a ring not worn ──
  {
    const state = fight([ring()]);
    const great = option(state, "mage", "Great");
    const refused = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "mage", optionId: great!.id, targetIds: [], storesIn: { holderId: "mage", item: 0 } },
      () => 10,
    );
    assert.equal(refused.events[0]?.type, "refused", "a 7th does not fit five levels");
    const loose = fight([
      ring({ worn: false, storedEntries: [{ entry: "spells/bolt", level: 3, saveDifficulty: 30 }] }),
    ]);
    assert.equal(option(loose, "mage", "Ring of Spell Storing: Bolt"), undefined, "only while worn");
    assert.ok(option(loose, "mage", "Bolt")?.storesIn?.length, "stored into while only carried");
  }
  // ── The next fight reads what the stack holds ──
  {
    const state = fight([ring({ storedEntries: [{ entry: "spells/bolt", level: 3, saveDifficulty: 30 }] })]);
    const cast = choose(state, "mage", "Ring of Spell Storing: Bolt", { targetIds: ["foe"] });
    const save = cast.events.find((one): one is Extract<RulesetCombatEvent, { type: "save" }> => one.type === "save");
    assert.equal(save?.difficulty, 30, "its caster's difficulty");
    assert.equal(hp(cast.state), 95);
  }
  // ── A shield guardian beside the mage ──
  {
    const state = fight([], true);
    const bolt = option(state, "mage", "Bolt");
    assert.deepEqual(bolt?.storesIn, [{ holderId: "guard", label: "Guardian", room: 4 }]);
    const stored = choose(state, "mage", "Bolt", { storesIn: { holderId: "guard" } });
    assert.ok(stored.events.some((one) => one.type === "stored"));
    assert.equal(option(again(structuredClone(stored.state), "mage"), "mage", "Bolt")?.storesIn, undefined, "one only");
    const cast = choose(again(stored.state, "guard"), "guard", "Guardian: Bolt", { targetIds: ["foe"] });
    assert.ok(!cast.events.some((one) => one.type === "refused"), JSON.stringify(cast.events));
    assert.equal(hp(cast.state), 95);
  }
  // ── Stored before the fight ──
  {
    const { state, skipped } = rulesetStandingAtStart(definition, fight([ring()]), [
      { casterId: "mage", entry: "Bolt", into: "Ring of Spell Storing" },
    ]);
    assert.deepEqual(skipped, []);
    assert.ok(option(state, "mage", "Ring of Spell Storing: Bolt"), "stored as it starts");
    const none = rulesetStandingAtStart(definition, fight([ring()]), [
      { casterId: "mage", entry: "Great", into: "Ring of Spell Storing" },
    ]);
    assert.equal(none.skipped.length, 1, "a 7th does not fit");
  }

  // ── Refusals ──
  refusedDoc(
    document((doc) => (doc.catalogs.at(-1).entries[0].item.stores.catalogs = ["prayers"])),
    /Unknown catalog "prayers"/,
  );

  // ── The install gate ──
  {
    const gate =
      "A ruleset whose items or creatures store entries to be cast later (stores) requires schemaVersion 2 and capabilityApi 1.524 or newer";
    const manifest = (minor: number) => ({
      schemaVersion: 2,
      capabilityApi: { major: 1, minor },
      id: "fivee",
      name: "5e",
      version: "1.0.0",
      kind: ["ruleset"],
      entrypoints: {},
      contributions: { assets: { paths: ["ruleset.json"] } },
      files: [{ path: "ruleset.json", sha256: "0".repeat(64), bytes: 10 }],
      permissions: [],
      restartRequired: false,
    });
    assert.equal(getCapabilityPackageInstallIssue(manifest(523) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(524) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(523) as never, JSON.parse(fiveEText)), gate);
  }

  // ── Found holding some (1.576) ──
  {
    const found = {
      levels: "1d6-1",
      from: [
        { entry: "spells/bolt", level: 3, label: "Bolt" },
        { entry: "spells/great", level: 1, label: "Spark" },
        { entry: "spells/great", level: 2, label: "Flare" },
      ],
    };
    const doc = document((one) => (one.catalogs.at(-1).entries[0].item.stores.found = found));
    const withFound = parsed(doc);
    const foundBook = rulesetItemBook(withFound, {
      gear: withFound.catalogs!.find((one) => one.id === "gear")!.entries!,
    });
    const stores = foundBook.itemOf("gear/ring")!.entry.item!.stores!;
    const draws = Array.from({ length: 40 }, (_, at) => rulesetFoundStored(stores, `ring-${at}`));
    for (const held of draws) {
      const levels = held.reduce((total, one) => total + one.level, 0);
      assert.ok(levels <= 5, JSON.stringify(held));
    }
    assert.ok(
      draws.some((held) => held.length === 0),
      "a 1d6 - 1 can come up empty",
    );
    assert.ok(new Set(draws.map((held) => JSON.stringify(held))).size > 3, "stacks differ");
    assert.deepEqual(rulesetFoundStored(stores, "ring-7"), draws[7], "the same again");
    const at = draws.findIndex((held) => held.length > 0);
    const sheet = rulesetSheetItems(
      foundBook,
      [{ id: `ring-${at}`, name: "Ring of Spell Storing", item: "gear/ring", quantity: 1, equipped: true }],
      undefined,
    );
    assert.deepEqual(sheet[0]!.storedEntries, draws[at], "a sheet reads what it was found holding");
    const kept = rulesetSheetItems(
      foundBook,
      [
        {
          id: `ring-${at}`,
          name: "Ring of Spell Storing",
          item: "gear/ring",
          quantity: 1,
          equipped: true,
          storedEntries: [],
        },
      ],
      undefined,
    );
    assert.deepEqual(kept[0]!.storedEntries, [], "emptied, it stays empty");
    refusedDoc(
      document(
        (one) =>
          (one.catalogs.at(-1).entries[0].item.stores.found = { ...found, from: [{ entry: "prayers/x", level: 1 }] }),
      ),
      /"prayers\/x" is not of a catalog it stores/,
    );
    const gate =
      "A ruleset with an item found holding stored entries (stores.found) requires schemaVersion 2 and capabilityApi 1.576 or newer";
    const manifest = (minor: number) => ({
      schemaVersion: 2,
      capabilityApi: { major: 1, minor },
      id: "fivee",
      name: "5e",
      version: "1.0.0",
      kind: ["ruleset"],
      entrypoints: {},
      contributions: { assets: { paths: ["ruleset.json"] } },
      files: [{ path: "ruleset.json", sha256: "0".repeat(64), bytes: 10 }],
      permissions: [],
      restartRequired: false,
    });
    assert.equal(getCapabilityPackageInstallIssue(manifest(575) as never, doc), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(576) as never, doc), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(575) as never, document()), gate);
  }

  console.log(
    "Spell storing: a bolt stored in a worn ring is paid for and cast from it later for nothing with its caster's numbers, once; what does not fit is refused; the stack keeps it; a shield guardian holds one; stored before the fight; gated at 1.524.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
