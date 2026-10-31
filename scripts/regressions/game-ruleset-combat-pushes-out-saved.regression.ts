/**
 * An area that pushes out whoever saved (Capability API 1.631): 5e's Bead of Force, "Creatures that
 * succeeded on the save ... are pushed away from the center of the sphere until they are no longer
 * inside it."
 *
 *   - Whoever fails stays where they are, under what it puts on.
 *   - Whoever saves is pushed straight away from where it burst until no longer inside, and no
 *     farther; one stopped by a wall goes as far as the way allows.
 *   - Refused with no area.
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
  rulesetCombatant,
  rulesetCombatConditions,
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-pushes-out-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 631);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const document = (use: Record<string, unknown> = {}) => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.items = { categories: [{ id: "gear", label: "Gear" }] };
    doc.catalogs.push({
      id: "kit",
      label: "Kit",
      holds: "items",
      entries: [
        {
          id: "bead",
          label: "Bead of Force",
          item: {
            category: "gear",
            use: {
              kind: "debuff",
              budget: "action",
              label: "Throw",
              consumes: true,
              range: 60,
              area: { shape: "burst", size: 10 },
              save: { save: "dex_save", onSuccess: "negates" },
              saveDifficulty: 15,
              applies: [{ condition: "restrained", duration: { rounds: 10 } }],
              pushesOutSaved: true,
              ...use,
            },
          },
        },
      ],
    });
    return doc;
  };
  const parsed = (doc: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(doc);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const refused = (doc: unknown, pattern: RegExp) => {
    const result = parseRulesetDefinition(doc);
    assert.equal(result.ok, false, `should be refused: ${pattern}`);
    if (!result.ok) assert.match(result.issues.join("; "), pattern);
  };
  const definition = parsed(document());
  const goblin = (): RulesetStatBlock =>
    ({ health: 80, defense: 12, initiativeModifier: 0, speed: 30, actions: [] }) as unknown as RulesetStatBlock;
  const start = (wall?: { x: number; y: number }, def = definition) => {
    const bead = def.catalogs!.find((catalog) => catalog.id === "kit")!.entries![0]!.item!;
    const tiles = Array.from({ length: 9 }, () => Array(20).fill("plains"));
    if (wall) tiles[wall.y]![wall.x] = "wall";
    const state = createRulesetEncounter({
      definition: def,
      seed: 1,
      roller: () => 10,
      combatants: [
        {
          id: "bard",
          name: "Bard",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 14, con: 12, int: 10, wis: 10, cha: 16 },
            fields: { level: 5, ac: 13, speed: 30, hp_max: 80 },
          }),
          items: [{ item: bead, quantity: 1, worn: false, name: "Bead of Force" }],
        },
        { id: "fails", name: "Slow Goblin", side: "enemy", block: goblin() },
        { id: "saves", name: "Quick Goblin", side: "enemy", block: goblin() },
      ],
      board: {
        grid: { width: 20, height: 9, tiles } as never,
        placements: { bard: { x: 2, y: 4 }, fails: { x: 10, y: 4 }, saves: { x: 11, y: 4 } },
      },
    });
    state.order = ["bard", "fails", "saves"];
    state.turn = 0;
    return state;
  };
  const throwAt = (state: RulesetEncounterState, def = definition) => {
    const option = rulesetCombatOptions(def, state, "bard").find((one) => one.label.includes("Throw"));
    assert.ok(
      option,
      rulesetCombatOptions(def, state, "bard")
        .map((one) => one.label)
        .join(", "),
    );
    // The slow goblin's d20 a 2, the quick one's a 19.
    const faces = [2, 19];
    let d20 = 0;
    const step = applyRulesetCombatChoice(
      def,
      state,
      { actorId: "bard", optionId: option.id, targetIds: [], at: { x: 10, y: 4 } },
      (sides: number) => (sides === 20 ? faces[d20++ % faces.length]! : 3),
    );
    assert.equal(
      step.events.find((one) => one.type === "refused"),
      undefined,
      JSON.stringify(step.events),
    );
    return step;
  };
  const at = (state: RulesetEncounterState, id: string) => {
    const one = rulesetCombatant(state, id)!;
    return { x: one.x, y: one.y };
  };

  // ── Whoever saves is pushed out, and no farther ──
  {
    const step = throwAt(start());
    assert.deepEqual(at(step.state, "fails"), { x: 10, y: 4 }, "failed, stays inside");
    assert.ok(
      rulesetCombatConditions(definition, rulesetCombatant(step.state, "fails")!).includes("restrained"),
      "under what it puts on",
    );
    assert.deepEqual(at(step.state, "saves"), { x: 13, y: 4 }, "pushed out of the 10-foot sphere");
    assert.ok(!rulesetCombatConditions(definition, rulesetCombatant(step.state, "saves")!).includes("restrained"));
    const pushed = step.events.find(
      (one): one is Extract<RulesetCombatEvent, { type: "pushed" }> => one.type === "pushed",
    );
    assert.equal(pushed?.targetId, "saves");
  }

  // ── A wall in the way: as far as the way allows ──
  {
    const step = throwAt(start({ x: 13, y: 4 }));
    assert.deepEqual(at(step.state, "saves"), { x: 12, y: 4 }, "stopped at the wall");
  }

  // ── Torn as it is used: only what tore it is told, never the area it was aimed at ──
  {
    const torn = parsed(document({ backfires: { chance: 100, amount: { flat: 1 }, destroys: true, instead: true } }));
    const step = throwAt(start(undefined, torn), torn);
    assert.ok(step.events.some((one) => one.type === "backfired"));
    assert.equal(
      step.events.find((one) => one.type === "area"),
      undefined,
      JSON.stringify(step.events),
    );
    assert.equal(
      step.events.find((one) => one.type === "save"),
      undefined,
    );
    assert.deepEqual(at(step.state, "saves"), { x: 11, y: 4 });
  }

  // ── Refusals ──
  refused(document({ area: undefined }), /pushesOutSaved/);

  // ── The install gate ──
  {
    const gate =
      "A ruleset with an area that pushes out whoever saved (pushesOutSaved) requires schemaVersion 2 and capabilityApi 1.631 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(630) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(631) as never, document()), gate);
  }

  console.log("Horn of Blasting: glass saves at disadvantage and takes 10d6 instead of 5d6; gated at 1.629.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
