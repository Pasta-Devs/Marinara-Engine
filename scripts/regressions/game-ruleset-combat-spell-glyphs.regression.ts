/**
 * Spell glyphs (Capability API 1.454).
 *
 *   - Glyph of Warding cast at 3rd level with a spell stored: its caster's own spells of the 1st to
 *     the 3rd level are offered, both are paid for, and whoever sets it off takes the stored spell in
 *     place of its runes; one with an area is centred on them.
 *   - A spell higher than the glyph's level is refused; with none stored it does its own runes.
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

const dataDir = mkdtempSync(join(tmpdir(), "marinara-spell-glyphs-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 454);
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
  const glyph = spell("glyph", { ...glyphMechanics({ stores: true }), cost: [{ pool: "slots_3", amount: 1 }] }, 3);
  const harm = (more: Record<string, unknown> = {}) => ({
    kind: "attack",
    targets: "enemy",
    range: 60,
    amount: { flat: 10 },
    damageType: "cold",
    save: { save: "dex_save", onSuccess: "half" },
    ...more,
  });
  const spells = [
    glyph,
    spell("bolt", harm({ cost: [{ pool: "slots_1", amount: 1 }] })),
    spell("burst", harm({ area: { shape: "burst", size: 10 }, cost: [{ pool: "slots_1", amount: 1 }] })),
    spell("big", harm({ cost: [{ pool: "slots_5", amount: 1 }] }), 5),
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
              slots_max_3: 3,
              slots_max_5: 1,
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
  const placements = { a: { x: 13, y: 7 }, b: { x: 14, y: 7 } };
  const glyphOption = (state: RulesetEncounterState) =>
    rulesetCombatOptions(definition, state, "mage").find((one) => one.label === "Glyph")!;
  const store = (label: string | undefined) => {
    const state = fight({ placements });
    const option = glyphOption(state);
    const mode = label ? option.modes?.find((one) => one.label === label)?.id : undefined;
    if (label) assert.ok(mode, `no ${label} to store: ${JSON.stringify(option.modes)}`);
    return applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "mage", optionId: option.id, targetIds: [], at: { x: 10, y: 7 }, ...(mode ? { mode } : {}) },
      roll,
    );
  };

  // ── What it may store ──
  {
    const option = glyphOption(fight({ placements }));
    assert.deepEqual(option.modes?.map((one) => one.label).sort(), ["Big", "Bolt", "Burst"], "its caster's own spells");
  }

  // ── A bolt stored ──
  {
    const step = store("Bolt");
    assert.equal(refused(step), undefined, JSON.stringify(refused(step)));
    assert.deepEqual(
      step.events
        .filter((one) => one.type === "spend")
        .map((one) => (one as { pool: string }).pool)
        .sort(),
      ["slots_1", "slots_3"],
      "paid for both",
    );
    assert.equal(who(step.state, "mage").zones?.[0]?.stored !== undefined, true, "the bolt is in it");
    const tripped = walk(structuredClone(step.state), "b", { x: 11, y: 7 });
    assert.equal(zoneEvents(tripped.events, "detonated").length, 1, "B sets it off");
    assert.equal(hp(tripped.state, "b"), 90, "the bolt at B");
    assert.equal(hp(tripped.state, "a"), 100, "and not the runes over A");
    assert.equal(who(tripped.state, "mage").zones, undefined, "gone");
    assert.equal(tripped.events.filter((one) => one.type === "spend").length, 0, "costing nothing as it goes off");
  }

  // ── A burst stored: centred on whoever set it off ──
  {
    const step = store("Burst");
    assert.equal(refused(step), undefined, JSON.stringify(refused(step)));
    const tripped = walk(structuredClone(step.state), "b", { x: 11, y: 7 });
    assert.equal(hp(tripped.state, "b"), 90, "B");
    assert.equal(hp(tripped.state, "a"), 90, "A, ten feet from B");
    assert.equal(
      hp(tripped.state, "mage"),
      rulesetCombatHealth(definition, definition.combat!, who(step.state, "mage")).value,
      "not its caster, far off",
    );
  }

  // ── Too high a spell for the slot ──
  {
    const step = store("Big");
    assert.equal(refused(step)?.type, "refused", "a 5th-level spell in a 3rd-level glyph");
  }

  // ── Nothing stored: its own runes ──
  {
    const step = store(undefined);
    assert.equal(refused(step), undefined);
    const tripped = walk(structuredClone(step.state), "b", { x: 11, y: 7 });
    assert.equal(hp(tripped.state, "b"), 80);
    assert.equal(hp(tripped.state, "a"), 80);
  }

  // ── Refusals ──
  {
    const result = parseRulesetDefinition(
      fiveE((doc) => {
        doc.catalogs.push({
          id: "spells",
          label: "Spells",
          feeds: ["spells"],
          entries: [
            spell("bad", {
              ...glyphMechanics(),
              zone: { rounds: 10, triggers: [], detonates: { touched: true, stores: true } },
            }),
          ],
        });
      }),
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.issues.join("; "), /"stores" casts what it holds/);
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset whose glyphs store one of their caster's own entries (detonates stores) requires schemaVersion 2 and capabilityApi 1.454 or newer";
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
    const plainGlyph = fiveE((doc) => {
      doc.catalogs.push({
        id: "spells",
        label: "Spells",
        feeds: ["spells"],
        entries: [spell("glyph", glyphMechanics(), 3)],
      });
    });
    assert.equal(getCapabilityPackageInstallIssue(manifest(453) as never, withGlyph), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(454) as never, withGlyph), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(453) as never, plainGlyph), gate);
  }

  console.log(
    "Spell glyphs: a stored spell paid for with the glyph is cast at whoever sets it off, or centred on them; too high a spell is refused; gated at 1.454.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
