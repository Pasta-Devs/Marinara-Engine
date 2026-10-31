/**
 * A glyph that stays as something else once set off (Capability API 1.453).
 *
 *   - Symbol: walked into, it goes off once and stays as a sphere of dim light for its own rounds,
 *     striking whoever enters it or ends a turn in it, and never goes off again; its rounds out, it
 *     just ends.
 *   - Without `becomes`, it is gone once set off.
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
  rulesetLightAt,
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

const dataDir = mkdtempSync(join(tmpdir(), "marinara-symbol-sphere-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 453);
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
  // Symbol, short: once set off, a 20-foot sphere of dim light for two rounds, striking again.
  const symbol = spell(
    "symbol",
    glyphMechanics({
      becomes: { size: 20, rounds: 2, triggers: ["enter", "turn-end"], lights: { bright: 0, dim: 20 } },
    }),
  );
  const spells = [glyph, symbol];
  const definition = parsed(
    fiveE((doc) => {
      doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: spells });
      doc.combat.senses = [
        { id: "darkvision", label: "Darkvision" },
        { id: "truesight", label: "Truesight" },
      ];
      doc.combat.sight = { darkness: { seeIn: ["darkvision"], pierced: ["truesight"] } };
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
        light: "dark",
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
  // B starts outside its middle, A well outside the sphere it becomes.
  const placements = { a: { x: 18, y: 7 }, b: { x: 13, y: 7 } };

  // ── Symbol ──
  {
    const step = cast(fight({ placements }), "Symbol", { at: { x: 10, y: 7 } });
    assert.equal(rulesetLightAt(definition, step.state, { x: 12, y: 7 }), "dark", "dark before it goes off");
    const tripped = walk(structuredClone(step.state), "b", { x: 11, y: 7 });
    assert.equal(refused(tripped), undefined, JSON.stringify(refused(tripped)));
    assert.equal(zoneEvents(tripped.events, "detonated").length, 1, "B sets it off");
    assert.equal(zoneEvents(tripped.events, "ended").length, 0, "and it stays");
    assert.equal(hp(tripped.state, "b"), 80, "20 fire to B");
    assert.equal(hp(tripped.state, "a"), 100, "A is out of its reach");
    const zone = who(tripped.state, "mage").zones?.[0];
    assert.ok(zone?.became, "it became its sphere");
    assert.deepEqual(zone.triggers, ["enter", "turn-end"]);
    assert.equal(zone.rounds, 2);
    assert.equal(rulesetLightAt(definition, tripped.state, { x: 12, y: 7 }), "dim", "the sphere glows");
    // A walks into the sphere: struck.
    const entered = walk(structuredClone(tripped.state), "a", { x: 14, y: 7 });
    assert.equal(hp(entered.state, "a"), 80, "A walks in and is struck");
    assert.equal(zoneEvents(entered.events, "detonated").length, 0, "it never goes off again");
    // B ends its turn in it: struck again.
    const state = structuredClone(entered.state);
    state.turn = state.order.indexOf("b");
    const ended = advanceRulesetTurn(definition, state, roll);
    assert.equal(hp(ended.state, "b"), 60, "B ends its turn in it");
    // Its own two rounds run out: it ends, going off no more.
    const events: RulesetCombatEvent[] = [];
    let later = ended.state;
    for (let i = 0; i < 3 && who(later, "mage").zones; i += 1)
      later = untilTurnOf(untilTurnOf(later, "a", events), "mage", events);
    assert.equal(who(later, "mage").zones, undefined, "gone after its rounds");
    assert.equal(zoneEvents(events, "detonated").length, 0);
    assert.equal(zoneEvents(events, "ended").length, 1);
  }

  // ── Without becomes, as it was ──
  {
    const step = cast(fight({ placements }), "Glyph", { at: { x: 10, y: 7 } });
    const tripped = walk(structuredClone(step.state), "b", { x: 11, y: 7 });
    assert.equal(who(tripped.state, "mage").zones, undefined);
  }

  // ── Refusals ──
  {
    const refusedDoc = (becomes: Record<string, unknown>, pattern: RegExp) => {
      const result = parseRulesetDefinition(
        fiveE((doc) => {
          doc.catalogs.push({
            id: "spells",
            label: "Spells",
            feeds: ["spells"],
            entries: [spell("bad", glyphMechanics({ becomes }))],
          });
        }),
      );
      assert.equal(result.ok, false, `should be refused: ${pattern}`);
      if (!result.ok) assert.match(result.issues.join("; "), pattern);
    };
    refusedDoc({ size: 20, rounds: 10, triggers: [] }, /triggers/);
    refusedDoc({ size: 0, rounds: 10, triggers: ["enter"] }, /size/);
    refusedDoc({ size: 20, rounds: 10, triggers: ["enter", "enter"] }, /named once/);
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset whose zones stay as something else once set off (detonates becomes) requires schemaVersion 2 and capabilityApi 1.453 or newer";
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
    const withSymbol = fiveE((doc) => {
      doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: [symbol] });
    });
    const withGlyph = fiveE((doc) => {
      doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: [glyph] });
    });
    assert.equal(getCapabilityPackageInstallIssue(manifest(452) as never, withSymbol), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(453) as never, withSymbol), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(452) as never, withGlyph), gate);
  }

  console.log(
    "Symbol sphere: set off, a glyph stays as a lit sphere striking whoever enters or ends a turn in it, then ends with its rounds; gated at 1.453.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
