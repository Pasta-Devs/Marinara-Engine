/**
 * Ground that forbids teleporting (Capability API 1.467).
 *
 *   - Hallow's Extradimensional Interference: from outside, no cell inside it to teleport to; from
 *     inside, nowhere at all; one it does not work on (another kind) teleports freely.
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
  rulesetSheetBuildSchema,
  rulesetTeleportCells,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-forbids-teleport-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 467);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const spell = (id: string, label: string, mechanics: Record<string, unknown>) =>
    ({
      id,
      label,
      rows: [{ list: "spells", values: { name: label, level: 1, prepared: true } }],
      mechanics,
    }) as unknown as RulesetCatalogEntry;
  const hallow = (zone: Record<string, unknown>) =>
    spell("hallow", "Hallow", {
      kind: "utility",
      area: { shape: "burst", size: 10 },
      range: 60,
      zone: { rounds: 600, triggers: [], ...zone },
    });
  const misty = spell("misty", "Misty", { kind: "utility", teleport: { distance: 30 } });
  const fiveE = (zone: Record<string, unknown> = { forbids: { teleport: true } }): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: [hallow(zone), misty] });
    doc.combat.creatureTypes = {
      types: ["humanoid", "fiend"].map((id) => ({ id, label: id })),
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
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const block: RulesetStatBlock = {
    health: 40,
    defense: 10,
    initiativeModifier: 0,
    speed: 30,
    actions: [],
    type: "humanoid",
  } as unknown as RulesetStatBlock;
  const roll = (sides: number) => (sides === 20 ? 15 : 3);
  const setUp = (zone?: Record<string, unknown>) => {
    const definition = parsed(fiveE(zone));
    const entries = definition.catalogs!.find((catalog) => catalog.id === "spells")!.entries! as RulesetCatalogEntry[];
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: roll,
      combatants: [
        {
          id: "mage",
          name: "Mage",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 10, con: 14, int: 10, wis: 16, cha: 10 },
            fields: { level: 9, ac: 12, speed: 30, hp_max: 60, spellcasting_ability: "wis", slots_max_1: 9 },
            lists: { spells: entries.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)) },
          }),
          catalogs: { spells: entries },
        },
        { id: "thug", name: "Thug", side: "enemy", block },
      ],
      board: {
        grid: { width: 16, height: 9, tiles: Array.from({ length: 9 }, () => Array(16).fill("plains")) },
        placements: { mage: { x: 2, y: 4 }, thug: { x: 14, y: 4 } },
      },
    });
    state.order = ["mage", "thug"];
    state.turn = 0;
    rulesetCombatant(state, "mage")!.budgets.action = 1;
    const option = rulesetCombatOptions(definition, state, "mage").find((one) => one.label === "Hallow");
    assert.ok(option, "no Hallow");
    // Centred on (8,4): its cells are (6..10, 2..6).
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "mage", optionId: option.id, targetIds: [], at: { x: 8, y: 4 } },
      roll,
    );
    assert.deepEqual(of(step.events, "refused"), []);
    const cells = (s: RulesetEncounterState) => {
      const mage = rulesetCombatant(s, "mage")!;
      return new Set(
        rulesetTeleportCells(definition, s, mage, mage.actions.find((one) => one.label === "Misty")!.teleport!).map(
          (cell) => `${cell.x},${cell.y}`,
        ),
      );
    };
    return { state: step.state, cells };
  };

  // ── On everybody ──
  {
    const { state, cells } = setUp();
    const outside = cells(state);
    assert.ok(outside.size > 0, "somewhere to go");
    assert.ok(!outside.has("7,4") && !outside.has("6,2"), "never into it");
    assert.ok(outside.has("5,4"), "but beside it");
    const inside = structuredClone(state);
    Object.assign(rulesetCombatant(inside, "mage")!, { x: 8, y: 4 });
    assert.equal(cells(inside).size, 0, "nowhere out of it, nor within it");
  }

  // ── Only on fiends: the mage teleports freely ──
  {
    const { state, cells } = setUp({
      forbids: { teleport: true },
      inside: { immune: ["fire"], is: { types: ["fiend"] } },
    });
    assert.ok(cells(state).has("7,4"));
  }

  // ── Refusals ──
  refused(fiveE({ forbids: {} }), /Say what it stops: "components", "teleport", "casts" or more than one/);

  // ── The install gate ──
  {
    const gate =
      "A ruleset whose zones forbid teleporting (forbids teleport) requires schemaVersion 2 and capabilityApi 1.467 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(466) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(467) as never, fiveE()), gate);
  }

  console.log(
    "Forbids teleport: nobody it works on teleports into, out of or within it; another kind goes freely; gated at 1.467.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
