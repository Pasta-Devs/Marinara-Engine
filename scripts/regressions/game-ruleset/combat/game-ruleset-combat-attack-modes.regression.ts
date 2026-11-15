/**
 * A creature's own attack rolls rolled twice where it stands (Capability API 1.293).
 *
 *   - `attackModes`: 5e's Sunlight Sensitivity, disadvantage on its attacks while it can see and
 *     stands in sunlight; a mode can also hold only in other light or on some terrain.
 *   - A catalog creature's block carries `attackModes`, and the `hiding` 1.292 gave it.
 *   - Import refusals and the install gate.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createRulesetEncounter,
  parseRulesetDefinition,
  rulesetAttackMode,
  rulesetCombatant,
  rulesetCreatureBlock,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetBoardLight,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-attack-modes-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 288);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const creature = (id: string, extra: Record<string, unknown>) => ({
    id,
    label: id[0]!.toUpperCase() + id.slice(1),
    creature: {
      health: 20,
      defense: 12,
      initiativeModifier: 0,
      speed: 30,
      tier: "cr_1_2",
      checks: { look: 0, sneak: 0 },
      actions: [{ id: "dagger", name: "Dagger", budget: "action", toHit: 4, damage: { dice: "1d4" }, reach: 5 }],
      ...extra,
    },
  });
  const sunlight = { mode: "disadvantage", sight: true, light: ["sunlight"] };
  const kobold = creature("kobold", { attackModes: [sunlight] });
  const mole = creature("mole", { attackModes: [{ mode: "advantage", terrain: ["cave"] }] });
  const cube = creature("cube", { hiding: { starts: 15 } });
  const beasts = [kobold, mole, cube];
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.combat.sight = { eyes: "sight" };
    // Eyes gone and nothing else: whatever reads sight, and only that, notices.
    doc.sheet.live.conditions.push({ id: "dazzled", label: "Dazzled" });
    doc.combat.conditions.push({ condition: "dazzled", effects: [], lacks: ["sight"] });
    doc.combat.checks.push(
      { id: "sneak", label: "Stealth", value: { skillMod: "stealth" } },
      { id: "look", label: "Perception", value: { skillMod: "perception" } },
    );
    doc.combat.hiding = { stealth: "sneak", perception: "look" };
    doc.catalogs.find((catalog: { id: string }) => catalog.id === "creatures").entries.push(...structuredClone(beasts));
    edit(doc);
    return doc;
  };
  const parsed = (document: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(document);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const refusedDoc = (document: unknown, pattern: RegExp) => {
    const result = parseRulesetDefinition(document);
    assert.equal(result.ok, false, `should be refused: ${pattern}`);
    if (!result.ok) assert.match(result.issues.join("; "), pattern);
  };
  const definition = parsed(fiveE());
  const entries = definition.catalogs!.find((catalog) => catalog.id === "creatures")!.entries!;
  const blockOf = (id: string): RulesetStatBlock =>
    rulesetCreatureBlock(
      definition,
      entries.find((entry) => entry.id === id),
    )!;

  // ── Read off the bestiary ──
  assert.deepEqual(blockOf("kobold").attackModes, [sunlight]);
  assert.deepEqual(blockOf("cube").hiding, { starts: 15 }, "1.292's hiding reaches the block");

  const hero = rulesetSheetBuildSchema.parse({
    abilities: { str: 10, dex: 14, con: 12, int: 10, wis: 10, cha: 10 },
    fields: { level: 1, ac: 12, speed: 30, hp_max: 30 },
    lists: { attacks: [{ name: "Dagger", ability: "dex", proficient: true, bonus: 0, damage: "1d4", reach: 5 }] },
  });
  const fight = (beast: string, light?: RulesetBoardLight, environment = "plains"): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        { id: "hero", name: "Hero", side: "party", build: hero, live: {} },
        { id: beast, name: beast, side: "enemy", block: blockOf(beast) },
      ],
      board: {
        grid: {
          width: 10,
          height: 10,
          tiles: Array.from({ length: 10 }, () => Array.from({ length: 10 }, () => "plains")),
        } as never,
        placements: { hero: { x: 4, y: 4 }, [beast]: { x: 5, y: 4 } },
        ...(light ? { light } : {}),
        environment,
      },
    });
    state.order = ["hero", beast];
    state.turn = 1;
    return state;
  };
  const who = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)!;
  const mode = (state: RulesetEncounterState, from: string, to: string) =>
    rulesetAttackMode(definition, definition.combat!, who(state, from), who(state, to), {
      state,
      optionId: who(state, from).actions.find((action) => action.label === "Dagger")?.id ?? "",
    });

  // ── Sunlight Sensitivity ──
  {
    assert.equal(mode(fight("kobold", "sunlight"), "kobold", "hero"), "disadvantage", "in sunlight");
    assert.equal(mode(fight("kobold", "bright"), "kobold", "hero"), "normal", "bright light that is not the sun's");
    assert.equal(mode(fight("kobold"), "kobold", "hero"), "normal", "a board that says nothing");
    assert.equal(mode(fight("kobold", "dim"), "kobold", "hero"), "normal");
    // Only its own attacks: the hero's at it are rolled as ever.
    assert.equal(mode(fight("kobold", "sunlight"), "hero", "kobold"), "normal");
    // Unable to see, the sun is nothing to it.
    const dazzled = fight("kobold", "sunlight");
    who(dazzled, "kobold").tracked.push({ condition: "dazzled", rounds: null } as never);
    assert.equal(mode(dazzled, "kobold", "hero"), "normal", "without its eyes");
    // Helped in sunlight, the two cancel out.
    const helped = fight("kobold", "sunlight");
    who(helped, "kobold").flags.helped = true;
    assert.equal(mode(helped, "kobold", "hero"), "normal", "advantage cancels it");
  }

  // ── On terrain ──
  {
    assert.equal(mode(fight("mole", undefined, "cave"), "mole", "hero"), "advantage", "in a cave");
    assert.equal(mode(fight("mole"), "mole", "hero"), "normal", "on the plains");
  }

  // ── Refusals ──
  {
    const withBeast = (beast: unknown) =>
      fiveE((doc) => {
        doc.catalogs.find((catalog: { id: string }) => catalog.id === "creatures").entries.push(beast);
      });
    refusedDoc(withBeast(creature("odd", { attackModes: [{ mode: "advantage" }] })), /says where it holds/);
    refusedDoc(withBeast(creature("odd", { attackModes: [{ mode: "twice", sight: true }] })), /attackModes/);
    refusedDoc(withBeast(creature("odd", { attackModes: [{ mode: "advantage", light: ["moon"] }] })), /light/);
    refusedDoc(withBeast(creature("odd", { attackModes: [] })), /attackModes/);
  }

  // ── The gate ──
  {
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
    const gate =
      "A ruleset with creatures whose attacks are rolled twice where they stand requires schemaVersion 2 and capabilityApi 1.293 or newer";
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.catalogs.find((catalog: { id: string }) => catalog.id === "creatures").entries.push(kobold);
    assert.equal(getCapabilityPackageInstallIssue(manifest(292) as never, doc), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(293) as never, doc), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(292) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "Attack modes: a kobold's Sunlight Sensitivity only in sunlight and while it sees, a mode on terrain, read off the bestiary with 1.292's hiding; refusals; gated at 1.293.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
