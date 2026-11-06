/**
 * Zones that seal the air or stop shots (Capability API 1.659): 5e's Cube of Force, "Gases, wind, and
 * fog can't pass through the barrier" (face 1) and "Nonliving matter can't pass through the barrier"
 * (face 2), a barrier around its user.
 *
 *   - A Fog Cloud outside stops at the cube's edge; one cast inside stays inside.
 *   - A bow shot into, out of or across it is stopped, magical or not; a spell is not, nor a shot clear
 *     of it, nor one wholly inside.
 *   - Neither needs a trigger, and a non-wall zone may block "ranged".
 *   - The install gate.
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
  rulesetSheetBuildSchema,
  rulesetShotsBlocked,
  rulesetTargetRefusal,
  rulesetZoneCells,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatAction,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-sealed-zone-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 659);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const spell = (id: string, mechanics: Record<string, unknown>) => ({
    id,
    label: id,
    rows: [{ list: "spells", values: { name: id, level: 1, prepared: true } }],
    mechanics: { kind: "utility", budget: "action", ...mechanics },
  });
  const cube = () =>
    spell("cube", {
      range: 0,
      area: { shape: "burst", size: 10 },
      zone: { rounds: 100, triggers: [], anchor: "caster", sealsAir: true, blocks: ["ranged"] },
    });
  const fog = () =>
    spell("fog", {
      range: 120,
      area: { shape: "burst", size: 10 },
      zone: { rounds: 100, triggers: [], obscures: { dispersed: true } },
    });
  const bolt = () => spell("bolt", { kind: "attack", range: 120, attackRoll: true, amount: { flat: 3 } });
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: [cube(), fog(), bolt()] });
    edit(doc);
    return doc;
  };
  const parsed = (document: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(document);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const definition = parsed(fiveE());
  const entries = definition.catalogs!.find((catalog) => catalog.id === "spells")!.entries! as RulesetCatalogEntry[];
  const block = {
    health: 50,
    defense: 10,
    initiativeModifier: 0,
    speed: 30,
    actions: [{ name: "Bow", budget: "action", toHit: 4, damage: { flat: 1 }, reach: 120 }],
  } as unknown as RulesetStatBlock;
  const fight = (): RulesetEncounterState => {
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
            abilities: { str: 10, dex: 10, con: 14, int: 16, wis: 10, cha: 10 },
            fields: { level: 9, ac: 12, speed: 30, hp_max: 60, spellcasting_ability: "int", slots_max_1: 9 },
            lists: {
              spells: entries.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)),
            },
          }),
          catalogs: { spells: entries },
        },
        { id: "giant", name: "Giant", side: "enemy", block },
      ],
      board: {
        grid: { width: 20, height: 9, tiles: Array.from({ length: 9 }, () => Array(20).fill("plains")) },
        placements: { mage: { x: 5, y: 4 }, giant: { x: 15, y: 4 } },
      },
    });
    state.order = ["mage", "giant"];
    return state;
  };
  const cast = (state: RulesetEncounterState, id: string, at?: { x: number; y: number }) => {
    state.turn = 0;
    rulesetCombatant(state, "mage")!.budgets.action = 1;
    const option = rulesetCombatOptions(definition, state, "mage").find((one) => one.label === id)!;
    assert.ok(option, id);
    const result = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "mage", optionId: option.id, targetIds: [], ...(at ? { at } : {}) },
      () => 10,
    );
    assert.deepEqual(of(result.events, "refused"), [], JSON.stringify(result.events));
    return result.state;
  };
  const key = (cell: { x: number; y: number }) => `${cell.x},${cell.y}`;
  const cellsOf = (state: RulesetEncounterState, label: string) => {
    const mage = rulesetCombatant(state, "mage")!;
    const zone = mage.zones!.find((one) => one.label === label || one.actionId.endsWith(label))!;
    assert.ok(zone, label);
    return new Set(rulesetZoneCells(state, mage, zone).map(key));
  };

  // ── Fog stops at the cube's edge, or stays in ──
  {
    const state = cast(fight(), "cube", { x: 5, y: 4 });
    const inside = cellsOf(state, "cube");
    assert.ok(inside.has("5,4") && inside.size > 1);
    const outside = cast(structuredClone(state), "fog", { x: 9, y: 4 });
    const fogOut = cellsOf(outside, "fog");
    assert.ok(fogOut.size > 0);
    assert.ok(
      [...fogOut].every((cell) => !inside.has(cell)),
      "none of it inside the cube",
    );
    const alone = cast(fight(), "fog", { x: 9, y: 4 });
    assert.ok(cellsOf(alone, "fog").size > fogOut.size, "without the cube it would have reached in");
    const within = cast(structuredClone(state), "fog", { x: 5, y: 4 });
    const fogIn = cellsOf(within, "fog");
    assert.ok(fogIn.size > 0 && [...fogIn].every((cell) => inside.has(cell)), "cast inside, it stays in");
  }

  // ── Shots from afar into, out of or across it ──
  {
    const state = cast(fight(), "cube", { x: 5, y: 4 });
    const bow = rulesetCombatant(state, "giant")!.actions.find((one) => one.label === "Bow")!;
    assert.equal(rulesetShotsBlocked(state, bow, { x: 15, y: 4 }, { x: 5, y: 4 }), true, "into it");
    assert.equal(rulesetShotsBlocked(state, bow, { x: 5, y: 4 }, { x: 15, y: 4 }), true, "out of it");
    assert.equal(rulesetShotsBlocked(state, bow, { x: 15, y: 4 }, { x: 0, y: 4 }), true, "across it");
    assert.equal(rulesetShotsBlocked(state, bow, { x: 15, y: 0 }, { x: 0, y: 0 }), false, "clear of it");
    assert.equal(rulesetShotsBlocked(state, bow, { x: 5, y: 4 }, { x: 6, y: 4 }), false, "wholly inside");
    const magical = { ...bow, qualities: ["magical"] } as RulesetCombatAction;
    assert.equal(rulesetShotsBlocked(state, magical, { x: 15, y: 4 }, { x: 5, y: 4 }), true, "magical or not");
    const spellBolt = rulesetCombatant(state, "mage")!.actions.find((one) => one.label === "bolt")!;
    assert.equal(rulesetShotsBlocked(state, spellBolt, { x: 5, y: 4 }, { x: 15, y: 4 }), false, "a spell");
    state.turn = 1;
    const bowOption = rulesetCombatOptions(definition, state, "giant").find((one) => one.label === "Bow")!;
    assert.equal(rulesetTargetRefusal(state, "giant", bowOption.id, "mage"), "no-line-of-sight");
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset with a zone that seals out gases and fog or blocks shots from afar (zone sealsAir, blocks ranged) requires schemaVersion 2 and capabilityApi 1.659 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(658) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(659) as never, fiveE()), gate);
  }

  console.log("Cube of Force: fog kept to one side of its edge, shots from afar stopped across it; gated at 1.659.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
