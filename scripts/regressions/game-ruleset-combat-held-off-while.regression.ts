/**
 * Conditions held off while others hold (Capability API 1.528).
 *
 *   - Cloak of Displacement: its displacement does nothing while its wearer is restrained, or another
 *     condition stops them acting or moving (stunned, grappled), and holds again once that ends.
 *   - Refusals and the install gate.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createRulesetEncounter,
  parseRulesetDefinition,
  rulesetActiveConditions,
  rulesetCombatant,
  supportedCapabilityApi,
  type RulesetDefinition,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-held-off-while-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 528);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const document = (heldOffWhile: unknown = { conditions: ["restrained"], effects: ["cannot-act", "speed-zero"] }) => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.live.conditions.push({ id: "displaced", label: "Displaced" });
    doc.combat.conditions.push({
      condition: "displaced",
      effects: ["attacks-against-disadvantage"],
      heldOffWhile,
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
  const block = {
    health: 20,
    defense: 12,
    initiativeModifier: 0,
    speed: 30,
    actions: [],
  } as unknown as RulesetStatBlock;
  const state = createRulesetEncounter({
    definition,
    seed: 1,
    roller: () => 10,
    combatants: [
      { id: "rogue", name: "Rogue", side: "party", block },
      { id: "foe", name: "Foe", side: "enemy", block },
    ],
  });
  const rogue = rulesetCombatant(state, "rogue")!;
  rogue.tracked.push({ condition: "displaced", rounds: null });
  const displaced = () =>
    rulesetActiveConditions(definition, definition.combat!, rogue, state).some((one) => one.condition === "displaced");
  assert.ok(displaced(), "on by itself");
  for (const holding of ["restrained", "stunned", "grappled", "incapacitated"]) {
    rogue.tracked.push({ condition: holding, rounds: 1 });
    assert.ok(!displaced(), `held off while ${holding}`);
    rogue.tracked = rogue.tracked.filter((one) => one.condition !== holding);
    assert.ok(displaced(), `back once ${holding} ends`);
  }
  rogue.tracked.push({ condition: "poisoned", rounds: 1 });
  assert.ok(displaced(), "poisoned holds nothing off");

  // ── Refusals ──
  refused(document({}), /Say what holds it off/);
  refused(document({ conditions: ["nowhere"] }), /Unknown condition "nowhere"/);
  refused(document({ conditions: ["displaced"] }), /held off by others, not itself/);
  refused(document({ effects: ["sparkles"] }), /Invalid option|sparkles/);

  // ── The install gate ──
  {
    const gate =
      "A ruleset whose conditions are held off while their holder holds others or does what they name (heldOffWhile) requires schemaVersion 2 and capabilityApi 1.528 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(527) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(528) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(527) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "Held off while: Cloak of Displacement does nothing while its wearer is restrained, stunned, grappled or incapacitated, and holds again after; gated at 1.528.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
