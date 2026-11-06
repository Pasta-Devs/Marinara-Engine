/**
 * A catalog entry's long range, and a caught missile thrown back with a die of its own (Capability
 * API 1.420).
 *
 *   - Deflect Missiles' throw back reaches 20 feet and 60 long.
 *   - The missile counts as a monk weapon: Martial Arts' die in place of the arrow's 1d8 where it is
 *     the better (a d10 at 17th level), the arrow's own where it is not (a d4 at 3rd).
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
  readRulesetLive,
  rowsFromCatalogEntry,
  RULESET_PASS_OPTION,
  rulesetCombatant,
  rulesetCombatHealth,
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  rulesetWindowOptions,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCatalogItem,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetSheetItem,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-thrown-die-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 420);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const throwBack = (reaction: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) =>
    ({
      id: "throw-back",
      label: "Throw Back",
      rows: [
        { list: "features", values: { name: "Throw Back" } },
        { list: "counters", values: { name: "Ki", max: 3, recharge: "short" } },
      ],
      mechanics: {
        kind: "attack",
        attackRoll: true,
        targets: "enemy",
        range: 20,
        longRange: 60,
        amount: { dice: "1d4" },
        amountAdd: { abilityMod: "dex" },
        free: true,
        usesOf: "Ki",
        throwsCaught: {
          die: {
            from: { field: "level" },
            table: [
              [1, 4],
              [5, 6],
              [11, 8],
              [17, 10],
            ],
          },
        },
        reaction: { on: "caught", freeSlot: "hand", ...reaction },
        ...extra,
      },
    }) as unknown as RulesetCatalogEntry;
  const features = [throwBack()];
  const document = (edit: (doc: Record<string, any>) => void = () => {}) => {
    const doc = JSON.parse(fiveEText);
    doc.items = { categories: [{ id: "gear", label: "Gear" }], slots: [{ id: "hand", label: "Hand", count: 2 }] };
    doc.sheet.derived.push({
      id: "deflect_missiles",
      label: "Deflect Missiles",
      op: "sum",
      of: [{ abilityMod: "dex" }, { field: "level" }],
    });
    doc.sheet.live.conditions.push({ id: "deflecting", label: "Deflecting" });
    doc.combat.conditions.push({
      condition: "deflecting",
      effects: [],
      modifiers: [
        { to: "damage-taken", blow: "ranged", dice: "1d10", add: { derived: "deflect_missiles" }, minus: true },
      ],
    });
    doc.catalogs.push({
      id: "monk",
      label: "Monk",
      feeds: ["features", "counters"],
      entries: structuredClone(features),
    });
    edit(doc);
    return doc;
  };
  const parsed = (doc: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(doc);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const refused = (doc: unknown, pattern: RegExp) => {
    const result = parseRulesetDefinition(doc);
    assert.equal(result.ok, false, `should be refused: ${pattern}`);
    if (!result.ok) assert.match(result.issues.join("; "), pattern);
  };
  const definition = parsed(document());
  const rows = (list: string) =>
    features.flatMap((entry) =>
      rowsFromCatalogEntry("monk", entry).flatMap((one) => (one.list === list ? [one.row] : [])),
    );
  const block = (): RulesetStatBlock => ({
    health: 40,
    defense: 12,
    initiativeModifier: 0,
    speed: 30,
    actions: [
      {
        id: "arrow",
        name: "Arrow",
        budget: "action",
        toHit: 20,
        damage: { count: 1, sides: 8, flat: 2, type: "piercing" },
        range: { normal: 80 },
      },
      {
        id: "heavy",
        name: "Heavy Arrow",
        budget: "action",
        toHit: 20,
        damage: { count: 0, sides: 0, flat: 30, type: "piercing" },
        range: { normal: 80 },
      },
    ],
  });
  const torch = (): RulesetSheetItem =>
    ({
      name: "Torch",
      quantity: 1,
      worn: true,
      item: { category: "gear", slots: { hand: 1 } } as unknown as RulesetCatalogItem,
    }) as RulesetSheetItem;
  // Every d20 a 15, every other die its top face.
  const faces = (sides: number) => (sides === 20 ? 15 : sides);
  const fight = (items: RulesetSheetItem[] = [], level = 3): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: faces,
      combatants: [
        { id: "archer", name: "Archer", side: "enemy", block: block() },
        {
          id: "monk",
          name: "Monk",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 16, con: 12, int: 10, wis: 14, cha: 8 },
            fields: { level, ac: 12, speed: 40, hp_max: 40 },
            lists: { features: rows("features"), counters: rows("counters") },
          }),
          live: {},
          items,
          catalogs: { monk: features },
        },
      ],
    });
    state.order = ["archer", "monk"];
    state.turn = 0;
    rulesetCombatant(state, "monk")!.tracked.push({
      condition: "deflecting",
      rounds: null,
      endsAfter: "attacked",
    } as never);
    return state;
  };
  const who = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)!;
  const health = (state: RulesetEncounterState, id: string) =>
    rulesetCombatHealth(definition, definition.combat!, who(state, id)).value;
  const ki = (state: RulesetEncounterState) => {
    const monk = who(state, "monk");
    return readRulesetLive(definition, monk.sheet!.build, monk.sheet!.live).pools.find((pool) =>
      pool.label.includes("Ki"),
    )?.value;
  };
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const shoot = (state: RulesetEncounterState, label = "Arrow") => {
    const option = rulesetCombatOptions(definition, state, "archer").find((one) => one.label === label);
    assert.ok(option, `no ${label}`);
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "archer", optionId: option.id, targetIds: ["monk"] },
      faces,
    );
    assert.equal(of(step.events, "refused").length, 0, JSON.stringify(of(step.events, "refused")));
    return step;
  };

  // ── Its reach: 20 feet and 60 long, four cells and twelve ──
  {
    const action = who(fight(), "monk").actions.find((one) => one.label === "Throw Back");
    assert.ok(action, "the throw back is the monk's");
    assert.deepEqual(action.range, { normal: 4, long: 12 });
    assert.deepEqual(action.throwsCaught, { sides: 4 });
    assert.deepEqual(who(fight([], 17), "monk").actions.find((one) => one.label === "Throw Back")?.throwsCaught, {
      sides: 10,
    });
  }

  // ── Thrown back: the arrow's 1d8 at 3rd level, Martial Arts' d10 at 17th ──
  {
    const throwAt = (level: number) => {
      const shot = shoot(fight([], level));
      const window = shot.state.window;
      assert.equal(window?.trigger.kind, "caught", JSON.stringify(shot.events));
      const option = rulesetWindowOptions(definition, shot.state, "monk").find((one) => one.label === "Throw Back");
      assert.ok(option, "the throw back is offered");
      const thrown = applyRulesetCombatChoice(
        definition,
        shot.state,
        { actorId: "monk", optionId: option.id, targetIds: [], window: window!.id },
        faces,
      );
      assert.equal(of(thrown.events, "refused").length, 0, JSON.stringify(of(thrown.events, "refused")));
      return of(thrown.events, "damage").map((one) => [one.targetId, one.dealt, one.damageType]);
    };
    assert.deepEqual(throwAt(3), [["archer", 8 + 3, "piercing"]], "a d4 is worse than the arrow's d8");
    assert.deepEqual(throwAt(17), [["archer", 10 + 3, "piercing"]], "a d10 is better");
    void health;
    void ki;
  }

  // ── Refusals ──
  {
    const withThrow = (entry: RulesetCatalogEntry) =>
      document((doc) => {
        doc.catalogs.at(-1).entries = [entry];
      });
    refused(withThrow(throwBack({}, { longRange: 10 })), /"longRange" is further than a "range" above 0/);
    refused(withThrow(throwBack({}, { range: undefined })), /"longRange" is further than a "range" above 0/);
    refused(
      withThrow(throwBack({}, { throwsCaught: { die: { from: { derived: "nothing_here" }, table: [[1, 4]] } } })),
      /nothing_here/,
    );
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset whose catalog entries carry a long range (longRange) or throw a caught missile back with a die of their own (throwsCaught die) requires schemaVersion 2 and capabilityApi 1.420 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(419) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(420) as never, document()), gate);
    const onlyLong = document((doc) => {
      doc.catalogs.at(-1).entries = [throwBack({}, { throwsCaught: true })];
    });
    assert.equal(getCapabilityPackageInstallIssue(manifest(419) as never, onlyLong), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(419) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "Thrown die: the throw back reaches 20 feet and 60 long; Martial Arts' die in place of the arrow's where it is the better, the arrow's own where not; gated at 1.420.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
