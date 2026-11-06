/**
 * Hidden zones (Capability API 1.455).
 *
 *   - A hidden Glyph of Warding: its caster's side sees it, its foes do not, until one of them finds
 *     it with a Search, whose Investigation meets the glyph's save difficulty; then their whole side
 *     sees it. One that falls short finds nothing.
 *   - One not hidden: everybody sees it.
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
  rulesetSheetBuildSchema,
  rulesetZonesShown,
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

const dataDir = mkdtempSync(join(tmpdir(), "marinara-hidden-zones-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 455);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.combat.checks.push(
      { id: "sneak", label: "Stealth", value: { skillMod: "stealth" } },
      { id: "look", label: "Perception", value: { skillMod: "perception" } },
      { id: "investigate", label: "Investigation", value: { skillMod: "investigation" } },
    );
    doc.combat.hiding = { stealth: "sneak", perception: "look" };
    doc.combat.standard.push("search");
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
  const glyph = spell("glyph", glyphMechanics({}, { hidden: { check: "investigate" } }));
  const plainGlyph = spell("plainglyph", glyphMechanics());
  const spells = [glyph, plainGlyph];
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
  const placements = { a: { x: 14, y: 7 }, b: { x: 16, y: 7 } };
  const search = (state: RulesetEncounterState, id: string) => {
    state.turn = state.order.indexOf(id);
    who(state, id).budgets.action = 1;
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: id, optionId: "standard:search", targetIds: [] },
      roll,
    );
    assert.equal(refused(step), undefined, JSON.stringify(refused(step)));
    return step;
  };

  // ── A hidden glyph ──
  {
    const step = cast(
      fight({ placements, a: { checks: { investigate: -20 } }, b: { checks: { investigate: 20 } } }),
      "Glyph",
      {
        at: { x: 10, y: 7 },
      },
    );
    assert.deepEqual(
      rulesetZonesShown(step.state).map((one) => one.label),
      ["Glyph"],
      "its caster's side sees it",
    );
    assert.deepEqual(rulesetZonesShown(step.state, "enemy"), [], "its foes do not");
    // A searches and misses it; B finds it, for both of them.
    const missed = search(structuredClone(step.state), "a");
    assert.equal(zoneEvents(missed.events, "found").length, 0, "A's Investigation falls short");
    assert.deepEqual(rulesetZonesShown(missed.state, "enemy"), []);
    const found = search(missed.state, "b");
    assert.deepEqual(
      zoneEvents(found.events, "found").map((one) => (one as { targetId?: string }).targetId),
      ["b"],
      "B finds it",
    );
    assert.deepEqual(
      rulesetZonesShown(found.state, "enemy").map((one) => one.label),
      ["Glyph"],
      "now they see it",
    );
    // Searching again throws nothing more at it.
    const again = search(found.state, "a");
    assert.equal(zoneEvents(again.events, "found").length, 0);
  }

  // ── Not hidden: everybody sees it ──
  {
    const step = cast(fight({ placements }), "Plainglyph", { at: { x: 10, y: 7 } });
    assert.deepEqual(
      rulesetZonesShown(step.state, "enemy").map((one) => one.label),
      ["Plainglyph"],
    );
  }

  // ── Refusals ──
  {
    const refusedDoc = (edit: (doc: Record<string, any>) => void, pattern: RegExp) => {
      const result = parseRulesetDefinition(fiveE(edit));
      assert.equal(result.ok, false, `should be refused: ${pattern}`);
      if (!result.ok) assert.match(result.issues.join("; "), pattern);
    };
    refusedDoc((doc) => {
      doc.catalogs.push({
        id: "spells",
        label: "Spells",
        feeds: ["spells"],
        entries: [spell("bad", glyphMechanics({}, { hidden: { check: "nosuch" } }))],
      });
    }, /Unknown check "nosuch"/);
    refusedDoc((doc) => {
      doc.combat.standard = doc.combat.standard.filter((one: string) => one !== "search");
      doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: [glyph] });
    }, /found with the "search" standard action/);
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset whose zones are hidden from their caster's foes (hidden) requires schemaVersion 2 and capabilityApi 1.455 or newer";
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
    const withGlyph = fiveE((doc) => {
      doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: [glyph] });
    });
    const plain = fiveE((doc) => {
      doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: [plainGlyph] });
    });
    assert.equal(getCapabilityPackageInstallIssue(manifest(454) as never, withGlyph), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(455) as never, withGlyph), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(454) as never, plain), gate);
  }

  console.log(
    "Hidden zones: a hidden glyph is shown only to its caster's side until a foe's Search finds it with Investigation against its save difficulty; gated at 1.455.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
