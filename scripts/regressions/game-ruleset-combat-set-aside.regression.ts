/**
 * Called creatures set aside (Capability API 1.533).
 *
 *   - Antimagic Field's "summoned creatures disappear": a wolf called by a spell, standing where the
 *     field is cast, is out of the fight while it covers it, never counted as fallen, and back where
 *     it stood once the field is gone. One called by no spell stays.
 *   - Refusals and the install gate.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyRulesetCombatChoice,
  createRulesetEncounter,
  parseRulesetDefinition,
  rowsFromCatalogEntry,
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetEncounterOutcome,
  rulesetItemBook,
  rulesetSheetBuildSchema,
  RULESET_MOVE_OPTION,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatChoice,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetSheetItem,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-set-aside-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 533);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const spell = (id: string, mechanics: Record<string, unknown>) =>
    ({
      id,
      label: id[0]!.toUpperCase() + id.slice(1),
      rows: [{ list: "spells", values: { name: id[0]!.toUpperCase() + id.slice(1), level: 1, prepared: true } }],
      mechanics: { kind: "attack", autoHit: true, damageType: "fire", range: 120, amount: { flat: 5 }, ...mechanics },
    }) as unknown as RulesetCatalogEntry;
  const field = (zone: Record<string, unknown> = {}) =>
    spell("field", {
      kind: "utility",
      area: { shape: "burst", size: 10 },
      range: 60,
      amount: undefined,
      zone: {
        rounds: 100,
        triggers: [],
        suppresses: { catalogs: ["spells"], tags: ["magical"], setsAsideCalled: true },
        forbids: { casts: ["spells"] },
        ...zone,
      },
    });
  const bolt = spell("bolt", {});
  const document = (zone: Record<string, unknown> = {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.live.conditions.push({ id: "blessed", label: "Blessed" }, { id: "warded", label: "Warded" });
    doc.combat.conditions.push(
      { condition: "blessed", effects: ["own-attacks-advantage"] },
      { condition: "warded", effects: ["attacks-against-disadvantage"] },
    );
    doc.items = {
      categories: [{ id: "gear", label: "Gear" }],
      tags: [{ id: "magical", label: "Magical" }],
      slots: [
        { id: "hand", label: "Hand", count: 2 },
        { id: "finger", label: "Finger", count: 2 },
      ],
    };
    doc.catalogs.push(
      { id: "spells", label: "Spells", feeds: ["spells"], entries: [field(zone), bolt] },
      {
        id: "gear",
        label: "Gear",
        holds: "items",
        entries: [
          {
            id: "sword",
            label: "Sword +1",
            item: {
              category: "gear",
              tags: ["magical"],
              slots: { hand: 1 },
              attack: { budget: "action", toHit: { bonus: 1 }, damage: { dice: "1d8", bonus: 1, type: "slashing" } },
            },
          },
          {
            id: "ring",
            label: "Ring",
            item: { category: "gear", tags: ["magical"], slots: { finger: 1 }, worn: { keepsOn: ["warded"] } },
          },
          {
            id: "wand",
            label: "Wand",
            item: {
              category: "gear",
              tags: ["magical"],
              use: { kind: "heal", targets: "self", budget: "action", amount: { flat: 3 } },
            },
          },
        ],
      },
    );
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
  const spells = definition.catalogs!.find((one) => one.id === "spells")!.entries!;
  const book = rulesetItemBook(definition, {
    gear: definition.catalogs!.find((one) => one.id === "gear")!.entries!,
  });
  const itemOf = (id: string, worn: boolean): RulesetSheetItem => ({
    item: book.itemOf(`gear/${id}`)!.entry.item!,
    quantity: 1,
    worn,
    name: id,
  });
  const build = (more: Record<string, unknown> = {}) =>
    rulesetSheetBuildSchema.parse({
      abilities: { str: 10, dex: 10, con: 14, int: 10, wis: 16, cha: 10 },
      fields: { level: 5, ac: 12, speed: 30, hp_max: 60, spellcasting_ability: "wis" },
      ...more,
    });
  const block = (): RulesetStatBlock =>
    ({ health: 100, defense: 1, initiativeModifier: 0, speed: 30, actions: [] }) as unknown as RulesetStatBlock;
  const fight = (knightAt: { x: number; y: number }, foeAt: { x: number; y: number }): RulesetEncounterState => {
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
        },
        {
          id: "knight",
          name: "Knight",
          side: "party",
          build: build(),
          items: [itemOf("sword", true), itemOf("ring", true), itemOf("wand", false)],
        },
        { id: "foe", name: "Foe", side: "enemy", block: block() },
        { id: "wolf", name: "Wolf", side: "party", block: block() },
        { id: "hound", name: "Hound", side: "party", block: block() },
      ],
      board: {
        grid: { width: 30, height: 5, tiles: Array.from({ length: 5 }, () => Array(30).fill("plains")) } as never,
        placements: {
          mage: { x: 1, y: 2 },
          knight: knightAt,
          foe: foeAt,
          wolf: { x: 10, y: 2 },
          hound: { x: 11, y: 2 },
        },
      },
    });
    state.order = ["mage", "knight", "foe", "wolf", "hound"];
    state.turn = 0;
    // Called by the mage's spell, and by nothing that is one.
    Object.assign(rulesetCombatant(state, "wolf")!, { calledBy: "mage", calledFrom: "spells" });
    Object.assign(rulesetCombatant(state, "hound")!, { calledBy: "mage", calledFrom: "gear" });
    // A spell's blessing on the knight.
    rulesetCombatant(state, "knight")!.tracked.push({
      condition: "blessed",
      rounds: 10,
      source: "mage",
      catalog: "spells",
    });
    // The field, cast around (10, 2).
    const option = rulesetCombatOptions(definition, state, "mage").find((one) => one.label === "Field")!;
    const cast = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "mage", optionId: option.id, targetIds: [], at: { x: 10, y: 2 } },
      () => 10,
    );
    assert.ok(!cast.events.some((one) => one.type === "refused"), JSON.stringify(cast.events));
    cast.state.turn = 1;
    return cast.state;
  };
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const state = fight({ x: 20, y: 2 }, { x: 25, y: 2 });
  const wolf = rulesetCombatant(state, "wolf")!;
  assert.equal(wolf.away?.setAside, true, "set aside inside the field");
  assert.equal(wolf.defeated, true);
  assert.equal(rulesetCombatant(state, "hound")!.away, undefined, "called by no spell, it stays");
  assert.equal(rulesetEncounterOutcome(state), "ongoing");
  // The field gone, it is back where it stood as the next thing happens.
  rulesetCombatant(state, "mage")!.zones = [];
  const moved = applyRulesetCombatChoice(
    definition,
    state,
    { actorId: "knight", optionId: RULESET_MOVE_OPTION, targetIds: [], to: { x: 19, y: 2 } } as RulesetCombatChoice,
    () => 10,
  );
  assert.equal(of(moved.events, "refused").length, 0, JSON.stringify(moved.events));
  const back = rulesetCombatant(moved.state, "wolf")!;
  assert.equal(back.away, undefined, "back");
  assert.equal(back.defeated, false);
  assert.deepEqual({ x: back.x, y: back.y }, { x: 10, y: 2 });
  assert.ok(of(moved.events, "returned").some((one) => one.targetId === "wolf"));

  // ── Refusals ──
  refusedDoc(document({ suppresses: { tags: ["magical"], setsAsideCalled: true } }), /names them/);

  // ── The install gate ──
  {
    const gate =
      "A ruleset with a zone that sets aside creatures called into it (suppresses setsAsideCalled) requires schemaVersion 2 and capabilityApi 1.533 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(532) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(533) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(532) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "Set aside: a wolf a spell called disappears inside an antimagic field, counted as no loss, and is back where it stood once the field is gone; one called by no spell stays; gated at 1.533.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
