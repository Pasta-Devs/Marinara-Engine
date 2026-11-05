/**
 * A condition lasting longer for each step of higher cost paid (Capability API 1.447).
 *
 *   - Primeval Awareness: ten rounds on a 1st-level slot, twenty on a 2nd, thirty on a 3rd.
 *   - Without `perStep`, a higher slot changes nothing.
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
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatEvent,
  type RulesetDefinition,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-duration-per-step-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 447);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const awareness = (duration: Record<string, unknown>) => ({
    id: "primeval-awareness",
    label: "Primeval Awareness",
    rows: [{ list: "spells", values: { name: "Primeval Awareness", level: 1, prepared: true } }],
    mechanics: {
      kind: "buff",
      targets: "self",
      budget: "action",
      cost: [{ pool: "slots_1", amount: 1 }],
      applies: [{ condition: "primeval", duration }],
    },
  });
  const fiveE = (duration: Record<string, unknown> = { rounds: 10, perStep: 10 }): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.live.conditions.push({ id: "primeval", label: "Primeval Awareness" });
    doc.combat.conditions.push({ condition: "primeval", effects: [] });
    doc.catalogs.push({ id: "ranger", label: "Ranger", feeds: ["spells"], entries: [awareness(duration)] });
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
  const lasts = (definition: RulesetDefinition, payWith: string | undefined) => {
    const entries = definition.catalogs!.find((catalog) => catalog.id === "ranger")!.entries! as RulesetCatalogEntry[];
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        {
          id: "ranger",
          name: "Ranger",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 12, dex: 16, con: 14, int: 10, wis: 14, cha: 8 },
            fields: {
              level: 9,
              ac: 15,
              speed: 30,
              hp_max: 70,
              spellcasting_ability: "wis",
              slots_max_1: 4,
              slots_max_2: 3,
              slots_max_3: 2,
            },
            lists: { spells: entries.flatMap((entry) => rowsFromCatalogEntry("ranger", entry).map((one) => one.row)) },
          }),
          live: {},
          catalogs: { ranger: entries },
        },
        {
          id: "wolf",
          name: "Wolf",
          side: "enemy",
          block: { health: 11, defense: 13, initiativeModifier: 0, speed: 40, actions: [] } as never,
        },
      ],
    });
    state.order = ["ranger", "wolf"];
    state.turn = 0;
    const option = rulesetCombatOptions(definition, state, "ranger").find((one) => one.label === "Primeval Awareness");
    assert.ok(
      option,
      rulesetCombatOptions(definition, state, "ranger")
        .map((one) => one.label)
        .join(", "),
    );
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "ranger", optionId: option.id, targetIds: ["ranger"], ...(payWith ? { payWith } : {}) },
      () => 10,
    );
    assert.deepEqual(of(step.events, "refused"), [], JSON.stringify(of(step.events, "refused")));
    return rulesetCombatant(step.state, "ranger")!.tracked.find((one) => one.condition === "primeval")?.rounds;
  };

  // ── Primeval Awareness ──
  {
    const definition = parsed(fiveE());
    assert.equal(lasts(definition, undefined), 10, "a 1st-level slot: a minute");
    assert.equal(lasts(definition, "slots_2"), 20, "a 2nd: two");
    assert.equal(lasts(definition, "slots_3"), 30, "a 3rd: three");
    const flat = parsed(fiveE({ rounds: 10 }));
    assert.equal(lasts(flat, "slots_3"), 10, "without perStep, as it was");
  }

  // ── Refusals ──
  refused(fiveE({ rounds: 10, perStep: 0 }), /perStep/);

  // ── The install gate ──
  {
    const gate =
      "A ruleset whose conditions last longer for each step of higher cost paid (perStep) requires schemaVersion 2 and capabilityApi 1.447 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(446) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(447) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(446) as never, fiveE({ rounds: 10 })), gate);
  }

  console.log(
    "Duration per step: Primeval Awareness lasts a minute per level of the slot spent, and a duration without perStep is unchanged; gated at 1.447.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
