/**
 * Glyphs set off by whoever enters them (Capability API 1.451).
 *
 *   - Glyph of Warding: somebody other than its caster walking into it sets it off, with no save of
 *     their own; it reaches everybody within `within` of its middle, not only its cells; its caster
 *     walking in does nothing, and its time running out just ends it.
 *   - `by`: a glyph only a fiend sets off.
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

const dataDir = mkdtempSync(join(tmpdir(), "marinara-glyphs-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 451);
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
  const glyph = spell("glyph", glyphMechanics());
  const shortGlyph = spell("shortglyph", glyphMechanics({}, { rounds: 1 }));
  const fiendGlyph = spell("fiendglyph", glyphMechanics({ by: { types: ["fiend"] } }));
  const spells = [glyph, shortGlyph, fiendGlyph];
  const definition = parsed(
    fiveE((doc) => {
      doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: spells });
      doc.combat.creatureTypes = {
        types: ["humanoid", "fiend"].map((id) => ({ id, label: id })),
        default: "humanoid",
      };
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
  const placements = { a: { x: 10, y: 9 }, b: { x: 14, y: 7 } };

  // ── Glyph of Warding ──
  {
    const step = cast(fight({ placements }), "Glyph", { at: { x: 10, y: 7 } });
    assert.equal(hp(step.state, "a"), 100, "nothing as it is cast");
    assert.ok(who(step.state, "mage").zones?.length, "it stands");
    // B walks into it: it goes off over A too, ten feet from its middle and outside its cells.
    const tripped = walk(structuredClone(step.state), "b", { x: 11, y: 7 });
    assert.equal(refused(tripped), undefined, JSON.stringify(refused(tripped)));
    assert.equal(zoneEvents(tripped.events, "detonated").length, 1, "B walks in and sets it off");
    assert.equal(hp(tripped.state, "b"), 80, "20 fire on a failed save");
    assert.equal(hp(tripped.state, "a"), 80, "A within 20 feet of it too");
    assert.equal(
      hp(tripped.state, "mage"),
      rulesetCombatHealth(definition, definition.combat!, who(step.state, "mage")).value,
    );
    assert.equal(who(tripped.state, "mage").zones, undefined, "and it is gone");
    // Its caster walking in does nothing.
    const own = walk(structuredClone(step.state), "mage", { x: 9, y: 7 });
    assert.equal(zoneEvents(own.events, "detonated").length, 0);
    assert.ok(who(own.state, "mage").zones?.length, "still there");
    // Its time running out just ends it.
    const short = cast(fight({ placements }), "Shortglyph", { at: { x: 10, y: 7 } });
    const events: RulesetCombatEvent[] = [];
    const later = untilTurnOf(untilTurnOf(short.state, "mage", events), "a", events);
    assert.equal(zoneEvents(events, "detonated").length, 0, "never set off");
    assert.equal(hp(later, "a"), 100);
    assert.equal(who(later, "mage").zones, undefined, "gone with its time");
  }

  // ── A glyph only a fiend sets off ──
  {
    const step = cast(fight({ placements, b: { type: "fiend" } as never }), "Fiendglyph", { at: { x: 10, y: 7 } });
    const human = walk(structuredClone(step.state), "a", { x: 10, y: 8 });
    assert.equal(zoneEvents(human.events, "detonated").length, 0, "a humanoid walks in: nothing");
    const fiend = walk(structuredClone(step.state), "b", { x: 11, y: 7 });
    assert.equal(zoneEvents(fiend.events, "detonated").length, 1, "the fiend sets it off");
  }

  // ── Refusals ──
  {
    const refusedDoc = (detonates: Record<string, unknown>, pattern: RegExp) => {
      const result = parseRulesetDefinition(
        fiveE((doc) => {
          doc.catalogs.push({
            id: "spells",
            label: "Spells",
            feeds: ["spells"],
            entries: [spell("bad", { ...glyphMechanics(), zone: { rounds: 10, triggers: [], detonates } })],
          });
        }),
      );
      assert.equal(result.ok, false, `should be refused: ${pattern}`);
      if (!result.ok) assert.match(result.issues.join("; "), pattern);
    };
    refusedDoc({ touched: true, by: { types: ["fiend"] } }, /"by" says who sets it off/);
    refusedDoc({ entered: true, within: 0 }, /within/);
    refusedDoc({ entered: true, by: { types: ["dragon"] } }, /creature types/);
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset whose zones go off as somebody enters them or reach past their cells (detonates entered, within) requires schemaVersion 2 and capabilityApi 1.451 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(450) as never, withGlyph), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(451) as never, withGlyph), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(450) as never, fiveE()), gate);
  }

  console.log(
    "Glyphs: set off by whoever but their caster walks in, reaching everybody within their reach, only by a fiend with by, and quiet as their time runs out; gated at 1.451.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
