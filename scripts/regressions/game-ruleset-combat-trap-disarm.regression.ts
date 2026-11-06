/**
 * Traps disarmed with a check (Capability API 1.669).
 *
 *   - A hidden glyph with `disarm` is offered to its caster's foes once found, within a cell of it.
 *   - Made, it is gone without going off; failed by less than its margin, nothing; failed by its
 *     margin or more, it goes off at whoever tried.
 *   - A `standard` grant naming `disarm` (5e's Fast Hands) pays with the bonus action.
 *   - Import refusals, and the install gate.
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
  rulesetCombatHealth,
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatCell,
  type RulesetCombatEvent,
  type RulesetCombatStep,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";
import type { TacticalGrid } from "../../packages/shared/src/features/tactical-combat/types.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-trap-disarm-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 669);
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
      { id: "tools", label: "Thieves' Tools", value: { skillMod: "sleight_of_hand" } },
    );
    doc.combat.hiding = { stealth: "sneak", perception: "look" };
    doc.combat.standard.push("search", "disarm");
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
  const trap = { check: "tools", difficulty: 15, tripsOnFailBy: 5 };
  const glyph = spell("glyph", glyphMechanics({}, { hidden: { check: "investigate" }, disarm: trap }));
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
  const zoneEvents = (events: RulesetCombatEvent[], outcome: string) =>
    events.filter((one) => one.type === "zone" && one.outcome === outcome);

  const disarms = (state: RulesetEncounterState, id: string) => {
    state.turn = state.order.indexOf(id);
    return rulesetCombatOptions(definition, state, id).filter((one) => one.disarms);
  };
  const disarm = (state: RulesetEncounterState, id: string, budget = "action") => {
    state.turn = state.order.indexOf(id);
    const option = disarms(state, id).find((one) => one.budget === budget);
    assert.ok(option, `${id} is offered no disarm for ${budget}`);
    const step = applyRulesetCombatChoice(definition, state, { actorId: id, optionId: option.id, targetIds: [] }, roll);
    assert.equal(refused(step), undefined, JSON.stringify(refused(step)));
    return step;
  };
  const glyphs = (state: RulesetEncounterState) => (who(state, "mage").zones ?? []).map((zone) => zone.label);
  // A stands beside the glyph's edge; B far off.
  const placements = { a: { x: 12, y: 7 }, b: { x: 20, y: 7 } };
  const laid = (a: Partial<RulesetStatBlock> = {}, b: Partial<RulesetStatBlock> = {}, found = true) => {
    const state = cast(fight({ placements, a, b }), "Glyph", { at: { x: 10, y: 7 } }).state;
    if (found) who(state, "mage").zones![0]!.foundBy = ["enemy"];
    return state;
  };

  // ── Hidden, it cannot be disarmed; found, whoever is within a cell may try ──
  {
    const hidden = laid({ checks: { tools: 10 } }, {}, false);
    assert.equal(disarms(hidden, "a").length, 0, "nobody disarms what they have not found");
    const found = laid({ checks: { tools: 10 } });
    const offered = disarms(found, "a");
    assert.deepEqual(
      offered.map((one) => [one.label, one.budget]),
      [["Glyph", "action"]],
    );
    assert.equal(disarms(found, "b").length, 0, "too far off");
    assert.equal(disarms(found, "mage").length, 0, "its caster's own side does not");
  }

  // ── Made: gone without going off ──
  {
    const step = disarm(laid({ checks: { tools: 10 } }), "a");
    const events = zoneEvents(step.events, "disarmed") as Array<{ targetId?: string; check?: { total: number } }>;
    assert.equal(events.length, 1);
    assert.equal(events[0]!.targetId, "a");
    assert.equal(events[0]!.check?.total, 20);
    assert.deepEqual(glyphs(step.state), [], "it is gone");
    assert.equal(zoneEvents(step.events, "detonated").length, 0, "and never went off");
    assert.equal(hp(step.state, "a"), 100);
    assert.equal(who(step.state, "a").budgets.action, 0, "the action is spent");
  }

  // ── Failed by less than five: nothing happens ──
  {
    const step = disarm(laid({ checks: { tools: 2 } }), "a");
    assert.equal(zoneEvents(step.events, "disarm-failed").length, 1);
    assert.deepEqual(glyphs(step.state), ["Glyph"], "it still stands");
    assert.equal(zoneEvents(step.events, "detonated").length, 0);
    assert.equal(hp(step.state, "a"), 100);
  }

  // ── Failed by five or more: it goes off at whoever tried ──
  {
    const step = disarm(laid({ checks: { tools: -10 } }), "a");
    assert.equal(zoneEvents(step.events, "disarm-failed").length, 1);
    assert.equal(zoneEvents(step.events, "detonated").length, 1, "it goes off");
    assert.equal(hp(step.state, "a"), 80, "20 fire, the save failed");
    assert.deepEqual(glyphs(step.state), []);
  }

  // ── Fast Hands: a grant naming disarm pays with the bonus action ──
  {
    const fast = {
      checks: { tools: 10 },
      actions: [
        { name: "Claw", budget: "action", toHit: 4, damage: { count: 1, sides: 4, flat: 0 } },
        { name: "Fast Hands", budget: "bonus", standard: { actions: ["disarm"] } },
      ],
    } as unknown as Partial<RulesetStatBlock>;
    const state = laid(fast);
    assert.deepEqual(
      disarms(state, "a")
        .map((one) => one.budget)
        .sort(),
      ["action", "bonus"],
    );
    const step = disarm(state, "a", "bonus");
    assert.equal(zoneEvents(step.events, "disarmed").length, 1);
    assert.equal(who(step.state, "a").budgets.action, 1, "the action is left");
    assert.equal(who(step.state, "a").budgets.bonus, 0);
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
        entries: [spell("bad", glyphMechanics({}, { disarm: { check: "nosuch" } }))],
      });
    }, /Unknown check "nosuch"/);
    refusedDoc((doc) => {
      doc.combat.standard = doc.combat.standard.filter((one: string) => one !== "disarm");
      doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: [glyph] });
    }, /disarmed with the "disarm" standard action/);
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset with traps disarmed with a check (zone.disarm or the disarm standard action) requires schemaVersion 2 and capabilityApi 1.669 or newer";
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
    const withTrap = fiveE((doc) => {
      doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: [glyph] });
    });
    const plain = fiveE((doc) => {
      doc.combat.standard = doc.combat.standard.filter((one: string) => one !== "disarm");
      doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: [plainGlyph] });
    });
    assert.equal(getCapabilityPackageInstallIssue(manifest(668) as never, withTrap), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(669) as never, withTrap), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(668) as never, plain), gate);
  }

  console.log(
    "Trap disarm: a found trap within a cell is offered to its caster's foes; made, it is gone unfired; failed by its margin, it goes off at whoever tried; Fast Hands pays with the bonus action; gated at 1.669.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
