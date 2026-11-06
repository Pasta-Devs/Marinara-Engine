/**
 * What is stored cast by itself when its moment comes (Capability API 1.569): 5e's Contingency, and a
 * shield guardian's stored spell cast at a moment set beforehand.
 *
 *   - `stores.castsOn {on: "harmed", at: "source"}`: a bolt stored in a shield guardian goes off at
 *     whoever harms it, for nothing, once, and is never offered to cast by hand.
 *   - The install gate.
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
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetSheetItem,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-stores-casts-on-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 569);
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
    stores: { catalogs: ["spells"], levels: 4, count: 1, castsOn: { on: "harmed", at: "source" } },
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

  // ── Stored in the guardian, never cast by hand; cast at the foe that harms it ──
  {
    const state = fight([], true);
    const stored = choose(state, "mage", "Bolt", { storesIn: { holderId: "guard" } });
    assert.deepEqual(
      stored.events.filter((one) => one.type === "refused"),
      [],
    );
    const ready = again(stored.state, "guard");
    assert.equal(option(ready, "guard", "Guardian: Bolt"), undefined, "never cast by hand");
    const foe = rulesetCombatant(ready, "foe")!;
    foe.actions.push({
      id: "club",
      kind: "attack",
      label: "Club",
      budget: "action",
      toHit: 20,
      targets: { side: "enemy", count: 1 },
      damage: { count: 0, sides: 6, flat: 4 },
      range: { normal: 30 },
    } as never);
    const struck = choose(again(ready, "foe"), "foe", "Club", { targetIds: ["guard"] });
    assert.deepEqual(
      struck.events.filter((one) => one.type === "refused"),
      [],
    );
    const went = struck.events.filter((one) => one.type === "storedCast");
    assert.deepEqual(
      went.map((one) => (one.type === "storedCast" ? [one.actorId, one.targetId] : [])),
      [["guard", "foe"]],
    );
    assert.equal(hp(struck.state), 95, "the bolt's 5 fire on the foe");
    // Once: a second blow sets off nothing.
    const twice = choose(again(struck.state, "foe"), "foe", "Club", { targetIds: ["guard"] });
    assert.equal(twice.events.filter((one) => one.type === "storedCast").length, 0);
    assert.equal(hp(twice.state), 95);
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset with something stored that is cast by itself when its moment comes (stores.castsOn) requires schemaVersion 2 and capabilityApi 1.569 or newer";
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
    const withCastsOn = document((doc) => {
      doc.catalogs.find((one: { id: string }) => one.id === "gear").entries[0].item.stores.castsOn = { on: "down" };
    });
    assert.equal(getCapabilityPackageInstallIssue(manifest(568) as never, withCastsOn), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(569) as never, withCastsOn), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(568) as never, document()), gate);
  }

  console.log(
    "Stores castsOn: a bolt stored in a shield guardian goes off by itself at the foe that harms it, once, never by hand; gated at 1.569.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
