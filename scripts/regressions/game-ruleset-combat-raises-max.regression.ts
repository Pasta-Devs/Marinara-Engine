/**
 * Raising the health maximum (Capability API 1.473).
 *
 *   - Aid: a sheet's maximum and health raised by 5 on its 2nd-level cost and 5 more a step higher;
 *     healed back up to the raised maximum; the raise falls away with the condition, outside the
 *     fight too.
 *   - Heroes' Feast on a stat block: 2d10 rolled once, raising the maximum and health, and gone
 *     once the condition runs out.
 *   - Refusals and the install gate.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  advanceRulesetTurn,
  applyRulesetCombatChoice,
  applyRulesetSheetOp,
  createRulesetEncounter,
  parseRulesetDefinition,
  readRulesetLive,
  rowsFromCatalogEntry,
  rulesetCombatant,
  rulesetCombatHealth,
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-raises-max-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 473);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const spell = (id: string, label: string, level: number, mechanics: Record<string, unknown>) =>
    ({
      id,
      label,
      rows: [{ list: "spells", values: { name: label, level, prepared: true } }],
      mechanics,
    }) as unknown as RulesetCatalogEntry;
  const aid = (raisesMax: Record<string, unknown> = { flat: 5, perStep: 5 }) =>
    spell("aid", "Aid", 2, {
      kind: "buff",
      targets: "ally",
      range: 30,
      autoHit: true,
      cost: [{ pool: "slots_2", amount: 1 }],
      applies: [{ condition: "aided", duration: { rounds: 1000 }, raisesMax }],
    });
  const feast = spell("feast", "Feast", 1, {
    kind: "buff",
    targets: "ally",
    range: 30,
    autoHit: true,
    cost: [{ pool: "slots_1", amount: 1 }],
    applies: [{ condition: "feasted", duration: { rounds: 1 }, raisesMax: { dice: "2d10" } }],
  });
  const fiveE = (raisesMax?: Record<string, unknown>): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.live.conditions.push({ id: "aided", label: "Aided" }, { id: "feasted", label: "Feasted" });
    doc.combat.conditions.push({ condition: "aided", effects: [] }, { condition: "feasted", effects: [] });
    doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: [aid(raisesMax), feast] });
    return doc;
  };
  const parsed = (document: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(document);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const refused = (document: unknown, pattern: RegExp) => {
    const result = parseRulesetDefinition(document);
    assert.equal(result.ok, false, `should be refused: ${pattern}`);
    if (!result.ok) assert.match(result.issues.join("; "), pattern);
  };
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const definition = parsed(fiveE());
  const entries = [aid(), feast];
  const roll = (sides: number) => (sides === 20 ? 10 : sides === 10 ? 7 : 3);
  const fight = () => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: roll,
      combatants: [
        {
          id: "cleric",
          name: "Cleric",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 10, con: 14, int: 10, wis: 16, cha: 10 },
            fields: {
              level: 9,
              ac: 12,
              speed: 30,
              hp_max: 60,
              spellcasting_ability: "wis",
              slots_max_1: 4,
              slots_max_2: 3,
              slots_max_3: 3,
            },
            lists: { spells: entries.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)) },
          }),
          catalogs: { spells: entries },
        },
        {
          id: "hound",
          name: "Hound",
          side: "party",
          block: { health: 40, defense: 12, initiativeModifier: 0, speed: 40, actions: [] } as never,
        },
        {
          id: "ogre",
          name: "Ogre",
          side: "enemy",
          block: { health: 60, defense: 10, initiativeModifier: 0, speed: 30, actions: [] } as never,
        },
      ],
    });
    state.order = ["cleric", "hound", "ogre"];
    state.turn = 0;
    return state;
  };
  const cast = (state: RulesetEncounterState, label: string, targetId: string, payWith?: string) => {
    state.turn = state.order.indexOf("cleric");
    rulesetCombatant(state, "cleric")!.budgets.action = 1;
    const option = rulesetCombatOptions(definition, state, "cleric").find((one) => one.label === label);
    assert.ok(option, `no ${label}`);
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "cleric", optionId: option.id, targetIds: [targetId], ...(payWith ? { payWith } : {}) },
      roll,
    );
    assert.deepEqual(of(step.events, "refused"), [], JSON.stringify(of(step.events, "refused")));
    return step;
  };
  const health = (state: RulesetEncounterState, id: string) => {
    const { value, max } = rulesetCombatHealth(definition, definition.combat!, rulesetCombatant(state, id)!);
    return [value, max];
  };

  // ── Aid on a sheet ──
  {
    const step = cast(fight(), "Aid", "cleric");
    assert.deepEqual(health(step.state, "cleric"), [65, 65], "a 2nd-level slot: 5 more");
    assert.deepEqual(
      of(step.events, "raisedMax").map((one) => [one.targetId, one.amount]),
      [["cleric", 5]],
    );
    const higher = cast(fight(), "Aid", "cleric", "slots_3");
    assert.deepEqual(health(higher.state, "cleric"), [70, 70], "a 3rd: 10 more");
    // Hurt, then healed back up to the raised maximum.
    const cleric = rulesetCombatant(step.state, "cleric")!;
    const sheet = cleric.sheet!;
    const hurt = applyRulesetSheetOp(definition, sheet.build, sheet.live, { op: "damage", pool: "hp", amount: 20 });
    assert.ok(hurt.ok);
    const healed = applyRulesetSheetOp(definition, sheet.build, hurt.live, { op: "restore", pool: "hp", amount: 30 });
    assert.ok(healed.ok);
    const pool = (live: unknown) =>
      readRulesetLive(definition, sheet.build, live).pools.find((one) => one.key === "hp")!;
    assert.deepEqual([pool(healed.live).value, pool(healed.live).max], [65, 65], "healed up to the raise");
    // The condition gone, outside the fight, the raise goes with it.
    const ended = applyRulesetSheetOp(definition, sheet.build, healed.live, {
      op: "condition",
      condition: "aided",
      active: false,
    });
    assert.ok(ended.ok);
    assert.deepEqual([pool(ended.live).value, pool(ended.live).max], [60, 60], "back to the maximum it had");
    assert.equal(ended.live.raised, undefined, "and nothing kept of it");
    // Put on again, the new raise replaces the old.
    const again = cast(step.state, "Aid", "cleric", "slots_3");
    assert.deepEqual(health(again.state, "cleric"), [70, 70], "10 in place of 5");
  }

  // ── Heroes' Feast on a stat block ──
  {
    const step = cast(fight(), "Feast", "hound");
    assert.deepEqual(health(step.state, "hound"), [54, 54], "2d10 rolled once: 14 more");
    // Its round runs out as the hound's turn ends.
    let state = step.state;
    state.turn = state.order.indexOf("cleric");
    state = advanceRulesetTurn(definition, state, roll).state;
    assert.equal(state.order[state.turn], "hound");
    state = advanceRulesetTurn(definition, state, roll).state;
    assert.equal(
      rulesetCombatant(state, "hound")!.tracked.some((one) => one.condition === "feasted"),
      false,
      "run out",
    );
    assert.deepEqual(health(state, "hound"), [40, 40], "the maximum falls back, and health with it");
  }

  // ── Refusals ──
  refused(fiveE({ perStep: 5 }), /"raisesMax" names dice, a flat amount, or both/);

  // ── The install gate ──
  {
    const gate =
      "A ruleset whose conditions raise their holder's health maximum (raisesMax) requires schemaVersion 2 and capabilityApi 1.473 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(472) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(473) as never, fiveE()), gate);
  }

  console.log(
    "Raises max: Aid raises a sheet's maximum and health by its slot, healed up to it and gone with the condition; Heroes' Feast's 2d10 on a stat block; gated at 1.473.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
