/**
 * A barrier that stops reach, and ends as it is carried over one it keeps out (Capability API
 * 1.595): 5e's Antilife Shell.
 *
 *   - `keepsOut.reach`: a kept-out creature outside cannot stab whoever stands inside with the least
 *     reach, nor strike them leaving it; a pike's reach and a shot still do. Without it they may.
 *   - `keepsOut.endsOnSweep`: its caster walking so it covers one it keeps out ends it; walking
 *     elsewhere does not.
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
  rulesetOptionTargets,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-reach-barrier-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 595);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const shellOf = (keepsOut: Record<string, unknown>, zone: Record<string, unknown> = {}) =>
    ({
      id: "shell",
      label: "Shell",
      rows: [{ list: "spells", values: { name: "Shell", level: 1, prepared: true } }],
      mechanics: {
        kind: "utility",
        area: { shape: "burst", size: 10 },
        range: 60,
        zone: { rounds: 600, anchor: "caster", triggers: [], keepsOut, ...zone },
      },
    }) as unknown as RulesetCatalogEntry;
  const shut = { is: { types: ["giant"] }, reach: true, endsOnSweep: true };
  const fiveE = (keepsOut: Record<string, unknown> = shut, zone?: Record<string, unknown>): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: [shellOf(keepsOut, zone)] });
    doc.combat.creatureTypes = {
      types: ["humanoid", "giant"].map((id) => ({ id, label: id })),
      default: "humanoid",
    };
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
  const giant = (actions: unknown[]): RulesetStatBlock =>
    ({
      health: 60,
      defense: 5,
      initiativeModifier: 0,
      speed: 30,
      type: "giant",
      actions,
    }) as unknown as RulesetStatBlock;
  const stab = {
    id: "stab",
    name: "Stab",
    budget: "action",
    toHit: 0,
    damage: { count: 1, sides: 6, flat: 0 },
    reach: 5,
  };
  const pike = {
    id: "pike",
    name: "Pike",
    budget: "action",
    toHit: 0,
    damage: { count: 1, sides: 6, flat: 0 },
    reach: 10,
  };
  const bolt = {
    id: "bolt",
    name: "Bolt",
    budget: "action",
    toHit: 0,
    damage: { count: 1, sides: 6, flat: 0 },
    range: { normal: 120 },
  };
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const setUp = (keepsOut?: Record<string, unknown>) => {
    const definition = parsed(fiveE(keepsOut));
    const entries = definition.catalogs!.find((catalog) => catalog.id === "spells")!.entries! as RulesetCatalogEntry[];
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        {
          id: "mage",
          name: "Mage",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 10, con: 14, int: 10, wis: 16, cha: 10 },
            fields: { level: 9, ac: 12, speed: 30, hp_max: 60, spellcasting_ability: "wis" },
            lists: { spells: entries.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)) },
          }),
          catalogs: { spells: entries },
        },
        {
          id: "squire",
          name: "Squire",
          side: "party",
          block: { ...giant([stab]), type: "humanoid" } as unknown as RulesetStatBlock,
        },
        { id: "brute", name: "Brute", side: "enemy", block: giant([stab, bolt]) },
        { id: "lancer", name: "Lancer", side: "enemy", block: giant([pike]) },
      ],
      board: {
        grid: { width: 20, height: 9, tiles: Array.from({ length: 9 }, () => Array(20).fill("plains")) } as never,
        placements: { mage: { x: 5, y: 4 }, squire: { x: 7, y: 4 }, brute: { x: 8, y: 4 }, lancer: { x: 8, y: 2 } },
      },
    });
    state.order = ["mage", "squire", "brute", "lancer"];
    state.turn = 0;
    // Its cells are (3..7, 2..6): the squire inside at its edge, the brute and the lancer just out.
    const option = rulesetCombatOptions(definition, state, "mage").find((one) => one.label === "Shell");
    assert.ok(option, "no Shell");
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "mage", optionId: option.id, targetIds: [], at: { x: 5, y: 4 } },
      () => 10,
    );
    assert.deepEqual(of(step.events, "refused"), [], JSON.stringify(of(step.events, "refused")));
    assert.equal(rulesetCombatant(step.state, "mage")!.zones?.length, 1, "the shell stands");
    return { definition, state: step.state };
  };
  const turnOf = (state: RulesetEncounterState, id: string) => {
    const s = structuredClone(state);
    s.turn = s.order.indexOf(id);
    const one = rulesetCombatant(s, id)!;
    one.budgets.action = 1;
    one.movementLeft = 6;
    return s;
  };
  const targetsOf = (definition: RulesetDefinition, state: RulesetEncounterState, id: string, label: string) => {
    const s = turnOf(state, id);
    const option = rulesetCombatOptions(definition, s, id).find((one) => one.label === label);
    assert.ok(option, `no ${label}`);
    return rulesetOptionTargets(definition, s, id, option);
  };
  const walk = (
    definition: RulesetDefinition,
    state: RulesetEncounterState,
    id: string,
    to: { x: number; y: number },
  ) => {
    const s = turnOf(state, id);
    const option = rulesetCombatOptions(definition, s, id).find((one) => one.kind === "move")!;
    return applyRulesetCombatChoice(definition, s, { actorId: id, optionId: option.id, targetIds: [], to }, () => 10);
  };

  // ── Reaching through ──
  {
    const { definition, state } = setUp();
    assert.ok(!targetsOf(definition, state, "brute", "Stab").includes("squire"), "no stab through it");
    assert.ok(targetsOf(definition, state, "brute", "Bolt").includes("squire"), "a shot goes through");
    assert.ok(targetsOf(definition, state, "lancer", "Pike").includes("squire"), "and a pike's reach");
    // Leaving the brute's reach inside it provokes nothing.
    const away = walk(definition, state, "squire", { x: 6, y: 4 });
    assert.equal(away.state.window, undefined, "no strike as it goes");
    assert.deepEqual(of(away.events, "opportunity"), []);
    // Without `reach`, the brute stabs, and strikes the squire leaving.
    const open = setUp({ is: { types: ["giant"] } });
    assert.ok(targetsOf(open.definition, open.state, "brute", "Stab").includes("squire"), "a plain circle");
    const provoked = walk(open.definition, open.state, "squire", { x: 6, y: 4 });
    assert.equal(provoked.state.window?.trigger.kind, "leaves-reach");
  }

  // ── Carried over one it keeps out, it ends ──
  {
    const { definition, state } = setUp();
    const west = walk(definition, state, "mage", { x: 4, y: 4 });
    assert.equal(rulesetCombatant(west.state, "mage")!.zones?.length, 1, "nobody swept: it stands");
    const east = walk(definition, state, "mage", { x: 6, y: 4 });
    assert.equal(rulesetCombatant(east.state, "mage")!.zones, undefined, "over the brute: it ends");
    assert.deepEqual(
      of(east.events, "zone").map((one) => [one.label, one.outcome]),
      [["Shell", "ended"]],
    );
    // Without `endsOnSweep`, it goes on round them.
    const kept = setUp({ is: { types: ["giant"] }, reach: true });
    const over = walk(kept.definition, kept.state, "mage", { x: 6, y: 4 });
    assert.equal(rulesetCombatant(over.state, "mage")!.zones?.length, 1);
  }

  // ── Refusals ──
  refused(
    fiveE(shut, { anchor: undefined }),
    /"endsOnSweep" ends a zone as whoever it is around moves, so it is around its caster or carried/,
  );

  // ── The install gate ──
  {
    const gate =
      "A ruleset with a barrier that stops reach or ends as it is carried over one it keeps out (keepsOut reach, endsOnSweep) requires schemaVersion 2 and capabilityApi 1.595 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(594) as never, fiveE()), gate);
    assert.equal(
      getCapabilityPackageInstallIssue(manifest(594) as never, fiveE({ is: { types: ["giant"] }, reach: true })),
      gate,
    );
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(595) as never, fiveE()), gate);
  }

  console.log(
    "Reach barrier: no stab or strike in passing through it, a shot and a pike still; carried over one it keeps out, it ends; gated at 1.595.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
