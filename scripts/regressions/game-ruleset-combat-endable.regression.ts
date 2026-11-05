/**
 * A condition its holder may take off at will (Capability API 1.622): 5e's Ring of Invisibility,
 * "until you use a bonus action to become visible again".
 *
 *   - Held, its holder is offered "End" with its label on the bonus action; taken, it comes off.
 *   - Not held, nothing is offered.
 *   - Refused on a budget the ruleset lacks; the install gate.
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
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-endable-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 622);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const document = (budget = "bonus") => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.live.conditions.push({ id: "ring_invisible", label: "Invisible (ring)" });
    doc.combat.conditions.push({ condition: "ring_invisible", effects: [], endable: { budget } });
    return doc;
  };
  const parsed = (doc: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(doc);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const definition = parsed(document());
  const fight = (): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        {
          id: "rogue",
          name: "Rogue",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 16, con: 12, int: 10, wis: 10, cha: 10 },
            fields: { level: 5, ac: 14, speed: 30, hp_max: 30 },
          }),
          live: {},
          catalogs: {},
        },
        {
          id: "wolf",
          name: "Wolf",
          side: "enemy",
          block: {
            health: 20,
            defense: 12,
            initiativeModifier: 0,
            speed: 40,
            actions: [],
          } as unknown as RulesetStatBlock,
        },
      ],
    });
    state.order = ["rogue", "wolf"];
    state.turn = 0;
    return state;
  };
  const rogue = (state: RulesetEncounterState) => rulesetCombatant(state, "rogue")!;
  const ending = (state: RulesetEncounterState) =>
    rulesetCombatOptions(definition, state, "rogue").find((one) => one.label === "End Invisible (ring)");

  // ── Not held: nothing offered ──
  assert.equal(ending(fight()), undefined);
  // ── Held: offered on the bonus action, and it comes off ──
  {
    const state = fight();
    rogue(state).tracked.push({ condition: "ring_invisible", rounds: null });
    const option = ending(state);
    assert.ok(
      option,
      rulesetCombatOptions(definition, state, "rogue")
        .map((one) => one.label)
        .join(", "),
    );
    assert.equal(option.budget, "bonus");
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "rogue", optionId: option.id, targetIds: ["rogue"] },
      () => 10,
    );
    assert.equal(
      step.events.find((one) => one.type === "refused"),
      undefined,
      JSON.stringify(step.events),
    );
    assert.ok(!rulesetCombatConditions(definition, rogue(step.state)).includes("ring_invisible"));
    assert.equal(rogue(step.state).budgets.bonus, 0);
    assert.equal(rogue(step.state).budgets.action, 1, "the action kept");
  }

  // ── Refusal ──
  {
    const result = parseRulesetDefinition(document("whim"));
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.issues.join("; "), /Unknown budget "whim"/);
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset with a condition its holder may take off at will (endable) requires schemaVersion 2 and capabilityApi 1.622 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(621) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(622) as never, document()), gate);
  }

  console.log(
    "endable: the Ring of Invisibility ended on a bonus action while held, never offered unheld; refusal; gated at 1.622.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
