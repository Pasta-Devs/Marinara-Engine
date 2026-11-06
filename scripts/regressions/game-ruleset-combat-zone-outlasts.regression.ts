/**
 * Zones that outlast their caster (Capability API 1.456).
 *
 *   - Glyph of Warding: its caster smashed out of the fight, it stays (a plain zone beside it ends),
 *     is still set off by whoever walks in, and counts its rounds down as each round ends.
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

const dataDir = mkdtempSync(join(tmpdir(), "marinara-zone-outlasts-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 456);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
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
  const glyph = spell("glyph", glyphMechanics({}, { rounds: 3, outlasts: true }));
  const plainGlyph = spell("plainglyph", glyphMechanics({}, { rounds: 3 }));
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
        {
          id: "a",
          name: "A",
          side: "party",
          block: block({
            actions: [{ name: "Smash", budget: "action", toHit: 30, damage: { count: 1, sides: 4, flat: 500 } }],
            ...options.a,
          } as never),
        },
        { id: "b", name: "B", side: "party", block: block(options.b) },
        // Somebody left on the mage's side, so the fight goes on.
        { id: "c", name: "C", side: "enemy", block: block() },
      ],
      board: {
        grid: grid(),
        placements: {
          mage: { x: 2, y: 7 },
          a: { x: 10, y: 7 },
          b: { x: 20, y: 7 },
          c: { x: 22, y: 13 },
          ...options.placements,
        },
      },
    });
    // A caster who dies at 0, on the other side: a cult mage.
    rulesetCombatant(state, "mage")!.side = "enemy";
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
  const placements = { a: { x: 3, y: 7 }, b: { x: 14, y: 7 } };
  // A smashes the mage out of the fight.
  const smash = (state: RulesetEncounterState) => {
    state.turn = state.order.indexOf("a");
    const option = rulesetCombatOptions(definition, state, "a").find((one) => one.label === "Smash");
    assert.ok(option, "A has no Smash");
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "a", optionId: option.id, targetIds: ["mage"] },
      roll,
    );
    assert.equal(refused(step), undefined, JSON.stringify(refused(step)));
    assert.ok(who(step.state, "mage").defeated, "the mage is out");
    return step;
  };
  const labels = (state: RulesetEncounterState) => (who(state, "mage").zones ?? []).map((one) => one.label).sort();

  // ── Glyph of Warding outlasts its caster ──
  {
    const first = cast(fight({ placements }), "Glyph", { at: { x: 10, y: 7 } });
    who(first.state, "mage").budgets.action = 1;
    const both = cast(first.state, "Plainglyph", { at: { x: 10, y: 3 } });
    assert.deepEqual(labels(both.state), ["Glyph", "Plainglyph"]);
    const out = smash(both.state);
    assert.deepEqual(labels(out.state), ["Glyph"], "the plain one ends with its caster; the glyph stays");
    assert.deepEqual(
      zoneEvents(out.events, "ended").map((one) => (one as { label: string }).label),
      ["Plainglyph"],
    );
    // Still set off by whoever walks in.
    const tripped = walk(structuredClone(out.state), "b", { x: 11, y: 7 });
    assert.equal(refused(tripped), undefined, JSON.stringify(refused(tripped)));
    assert.equal(zoneEvents(tripped.events, "detonated").length, 1, "it still goes off");
    assert.equal(hp(tripped.state, "b"), 80);
    // Its rounds counting down as each round ends, it ends in time.
    const events: RulesetCombatEvent[] = [];
    let later = out.state;
    for (let i = 0; i < 4 && who(later, "mage").zones; i += 1) later = untilTurnOf(later, "a", events);
    assert.equal(who(later, "mage").zones, undefined, "gone after its rounds");
    assert.equal(zoneEvents(events, "ended").length, 1);
    assert.equal(zoneEvents(events, "detonated").length, 0, "untripped, it never went off");
  }

  // ── Refusals ──
  {
    const refusedDoc = (mechanics: Record<string, unknown>, pattern: RegExp) => {
      const result = parseRulesetDefinition(
        fiveE((doc) => {
          doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: [spell("bad", mechanics)] });
        }),
      );
      assert.equal(result.ok, false, `should be refused: ${pattern}`);
      if (!result.ok) assert.match(result.issues.join("; "), pattern);
    };
    refusedDoc({ ...glyphMechanics({}, { outlasts: true }), concentration: true }, /held by concentration/);
    refusedDoc(
      {
        kind: "attack",
        area: { shape: "burst", size: 10 },
        amount: { flat: 5 },
        damageType: "fire",
        zone: { rounds: 10, triggers: ["turn-start"], anchor: "caster", outlasts: true },
      },
      /around its caster/,
    );
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset whose zones outlast their caster (outlasts) requires schemaVersion 2 and capabilityApi 1.456 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(455) as never, withGlyph), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(456) as never, withGlyph), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(455) as never, plain), gate);
  }

  console.log(
    "Zone outlasts: a glyph stays when its caster is out of the fight, still goes off, and ends with its rounds; gated at 1.456.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
