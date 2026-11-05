/**
 * Harming nobody, and fleeing a point (Capability API 1.457).
 *
 *   - Hopelessness (`cannot-harm`): no attack offered, other actions still are, and no strike at
 *     somebody leaving its reach.
 *   - Fear (`from: "point"`): put on by an area, it flees where the area was aimed, not its caster.
 *   - Import refusals, and the install gate.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  advanceRulesetTurn,
  applyRulesetCombatChoice,
  createRulesetEncounter,
  parseRulesetDefinition,
  rowsFromCatalogEntry,
  rulesetCombatant,
  rulesetCombatHealth,
  rulesetCombatOptions,
  rulesetReachableCells,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  RULESET_MOVE_OPTION,
  type RulesetCatalogEntry,
  type RulesetCombatCell,
  type RulesetCombatEvent,
  type RulesetCombatStep,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";
import type { TacticalGrid } from "../../packages/shared/src/features/tactical-combat/types.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-hopeless-fear-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 457);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.live.conditions.push({ id: "hopeless", label: "Hopeless" }, { id: "fled", label: "Fled" });
    doc.combat.conditions.push(
      { condition: "hopeless", effects: ["cannot-harm"] },
      { condition: "fled", effects: [], behavior: { moves: "away", from: "point" } },
    );
    edit(doc);
    return doc;
  };
  const parsed = (document: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(document);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const spell = (id: string, mechanics: Record<string, unknown>, level = 1) =>
    ({
      id,
      label: id[0]!.toUpperCase() + id.slice(1),
      rows: [{ list: "spells", values: { name: id[0]!.toUpperCase() + id.slice(1), level, prepared: true } }],
      mechanics,
    }) as unknown as RulesetCatalogEntry;
  // Glyph of Warding's explosive runes, small: 20 fire to everybody within 20 feet, a Dex save for half.
  const glyphMechanics = (detonates: Record<string, unknown> = {}, zone: Record<string, unknown> = {}) => ({
    kind: "attack",
    area: { shape: "burst", size: 5 },
    range: 150,
    amount: { flat: 20 },
    damageType: "fire",
    save: { save: "dex_save", onSuccess: "half" },
    zone: { rounds: 1000, triggers: [], detonates: { entered: true, within: 20, ...detonates }, ...zone },
  });
  // Fear, small: a burst whose failed save makes its target flee where it was aimed.
  const spells = [
    spell("scare", {
      kind: "debuff",
      targets: "enemy",
      area: { shape: "burst", size: 10 },
      range: 150,
      save: { save: "dex_save", onSuccess: "negates" },
      applies: [{ condition: "fled", duration: { rounds: 10 } }],
    }),
  ];
  const definition = parsed(
    fiveE((doc) => {
      doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: spells });
    }),
  );
  const block = (extra: Partial<RulesetStatBlock> = {}): RulesetStatBlock => ({
    health: 100,
    defense: 5,
    initiativeModifier: 0,
    speed: 30,
    saves: { dex_save: -10 },
    actions: [{ name: "Claw", budget: "action", toHit: 4, damage: { count: 1, sides: 4, flat: 0 } }],
    ...extra,
  });
  const grid = (): TacticalGrid => ({
    width: 24,
    height: 15,
    tiles: Array.from({ length: 15 }, () => Array(24).fill("plains")),
  });
  // A d20 shows 10; every damage die shows 3.
  const roll = (sides: number) => (sides === 20 ? 10 : 3);
  const fight = (
    options: {
      placements?: Record<string, { x: number; y: number }>;
      a?: Partial<RulesetStatBlock>;
      b?: Partial<RulesetStatBlock>;
    } = {},
  ): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: roll,
      bestiary: { spells },
      combatants: [
        {
          id: "mage",
          name: "Mage",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 10, con: 14, int: 10, wis: 16, cha: 10 },
            fields: {
              level: 9,
              ac: 12,
              speed: 30,
              hp_max: 60,
              spellcasting_ability: "wis",
              slots_max_1: 9,
            },
            lists: { spells: spells.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)) },
          }),
          catalogs: { spells },
        },
        { id: "a", name: "A", side: "enemy", block: block(options.a) },
        { id: "b", name: "B", side: "enemy", block: block(options.b) },
      ],
      board: {
        grid: grid(),
        placements: { mage: { x: 2, y: 7 }, a: { x: 10, y: 7 }, b: { x: 20, y: 7 }, ...options.placements },
      },
    });
    state.order = state.combatants.map((one) => one.id);
    state.turn = 0;
    return state;
  };
  const who = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)!;
  const hp = (state: RulesetEncounterState, id: string) =>
    rulesetCombatHealth(definition, definition.combat!, who(state, id)).value;
  const refused = (step: RulesetCombatStep) => step.events.find((one) => one.type === "refused");
  const cast = (
    state: RulesetEncounterState,
    label: string,
    choice: { at?: RulesetCombatCell; targetIds?: string[] },
  ) => {
    const option = rulesetCombatOptions(definition, state, "mage").find((one) => one.label === label);
    assert.ok(option, `the mage has no ${label}`);
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "mage", optionId: option.id, targetIds: choice.targetIds ?? [], ...choice },
      roll,
    );
    assert.equal(refused(step), undefined, JSON.stringify(refused(step)));
    return step;
  };
  const untilTurnOf = (state: RulesetEncounterState, id: string, events: RulesetCombatEvent[] = []) => {
    let next = state;
    do {
      const step = advanceRulesetTurn(definition, next, roll);
      events.push(...step.events);
      next = step.state;
    } while (next.order[next.turn] !== id);
    return next;
  };
  const zoneEvents = (events: RulesetCombatEvent[], outcome: string) =>
    events.filter((one) => one.type === "zone" && one.outcome === outcome);

  const walk = (state: RulesetEncounterState, id: string, to: RulesetCombatCell) => {
    state.turn = state.order.indexOf(id);
    return applyRulesetCombatChoice(
      definition,
      state,
      { actorId: id, optionId: RULESET_MOVE_OPTION, targetIds: [], to },
      roll,
    );
  };
  const hopeless = (state: RulesetEncounterState, id: string) => {
    who(state, id).tracked.push({ condition: "hopeless", rounds: 10 } as never);
    return state;
  };

  // ── Hopelessness: no harm to anybody ──
  {
    const state = fight({ placements: { a: { x: 3, y: 7 }, b: { x: 16, y: 7 } } });
    who(state, "mage").movementLeft = 6;
    state.turn = state.order.indexOf("a");
    who(state, "a").budgets.action = 1;
    const offered = (one: RulesetEncounterState) =>
      rulesetCombatOptions(definition, one, "a").map((option) => option.label);
    assert.ok(offered(state).includes("Claw"), "A claws as ever");
    const despairing = hopeless(structuredClone(state), "a");
    assert.ok(!offered(despairing).includes("Claw"), "not while hopeless");
    assert.ok(offered(despairing).includes("dodge"), "but may still dodge");
    // Nor strikes at the mage walking out of its reach.
    const away = (one: RulesetEncounterState) =>
      rulesetReachableCells(definition, one, "mage").find((cell) => cell.x === 2 && cell.y === 4)!;
    assert.deepEqual(away(state).provokes, ["a"], "walking off provokes A");
    assert.deepEqual(away(despairing).provokes, [], "not a hopeless A");
  }

  // ── Fear: fleeing the glyph, not the mage ──
  {
    const state = fight({ placements: { mage: { x: 20, y: 7 }, a: { x: 3, y: 3 }, b: { x: 14, y: 7 } } });
    const step = cast(state, "Scare", { at: { x: 12, y: 7 } });
    const tracked = who(step.state, "b").tracked.find((one) => one.condition === "fled");
    assert.deepEqual(tracked?.at, { x: 12, y: 7 }, "put on from where it was aimed");
    who(step.state, "b").movementLeft = 6;
    const cells = rulesetReachableCells(definition, step.state, "b");
    assert.ok(cells.length > 0, "somewhere to flee to");
    assert.ok(
      cells.every((cell) => Math.max(Math.abs(cell.x - 12), Math.abs(cell.y - 7)) > 2),
      "every stop further from the glyph",
    );
    assert.ok(
      cells.some((cell) => cell.x > 14),
      "even toward the mage",
    );
  }

  // ── Refusals ──
  {
    const result = parseRulesetDefinition(
      fiveE((doc) => {
        doc.combat.conditions.find((one: { condition: string }) => one.condition === "fled").behavior = {
          from: "point",
          only: ["move"],
        };
      }),
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.issues.join("; "), /"from" says where/);
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset whose conditions keep their holder from harming anybody (cannot-harm) or measure a behavior from a point (from) requires schemaVersion 2 and capabilityApi 1.457 or newer";
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
    const onlyHopeless = fiveE((doc) => {
      doc.combat.conditions = doc.combat.conditions.filter((one: { condition: string }) => one.condition !== "fled");
      doc.sheet.live.conditions = doc.sheet.live.conditions.filter((one: { id: string }) => one.id !== "fled");
    });
    const onlyFled = fiveE((doc) => {
      doc.combat.conditions.find((one: { condition: string }) => one.condition === "hopeless").effects = [];
    });
    assert.equal(getCapabilityPackageInstallIssue(manifest(456) as never, onlyHopeless), gate);
    assert.equal(getCapabilityPackageInstallIssue(manifest(456) as never, onlyFled), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(457) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(456) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "Hopeless and fear: cannot-harm takes every harm off the menu and every opportunity strike, and a fear measured from its point flees the glyph; gated at 1.457.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
