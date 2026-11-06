/**
 * Attacks against a holder at disadvantage only from those who see them (Capability API 1.655):
 * 5e's Robe of Scintillating Colors.
 *
 *   - `whenSeen` beside `attacks-against-disadvantage`: an attacker who sees the holder rolls with
 *     disadvantage, one who does not rolls as usual; without `whenSeen` everybody is at disadvantage.
 *   - What import refuses, and the install gate.
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
  supportedCapabilityApi,
  type RulesetDefinition,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-seen-against-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 655);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const document = (whenSeen = true) => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.live.conditions.push({ id: "scintillating", label: "Scintillating Colors" });
    doc.combat.conditions.push({
      condition: "scintillating",
      effects: ["attacks-against-disadvantage"],
      ...(whenSeen ? { whenSeen: true } : {}),
    });
    return doc;
  };
  const parsed = (doc: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(doc);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const block = {
    health: 30,
    defense: 10,
    initiativeModifier: 0,
    speed: 30,
    actions: [{ id: "club", name: "Club", budget: "action", toHit: 4, damage: { flat: 3 }, reach: 5 }],
  } as unknown as RulesetStatBlock;
  const mode = (definition: RulesetDefinition, hidden: boolean) => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        { id: "ogre", name: "Ogre", side: "enemy", block },
        { id: "wizard", name: "Wizard", side: "party", block },
      ],
    });
    const wizard = rulesetCombatant(state, "wizard")!;
    wizard.tracked.push({ condition: "scintillating", rounds: 10 } as never);
    if (hidden) wizard.hiding = { from: ["ogre"] } as never;
    return rulesetAttackMode(definition, definition.combat!, rulesetCombatant(state, "ogre")!, wizard, {
      state,
      optionId: "club",
    });
  };

  const robe = parsed(document());
  assert.equal(mode(robe, false), "disadvantage", "seen: dazzled");
  assert.equal(mode(robe, true), "normal", "unseen: nothing to dazzle");
  const plain = parsed(document(false));
  assert.equal(mode(plain, true), "disadvantage", "without whenSeen, everybody");

  // ── What import refuses ──
  {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.live.conditions.push({ id: "scintillating", label: "Scintillating Colors" });
    doc.combat.conditions.push({ condition: "scintillating", effects: ["speed-zero"], whenSeen: true });
    const result = parseRulesetDefinition(doc);
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.issues.join("; "), /whenSeen/);
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset with attacks against a holder at disadvantage only from those who see them (whenSeen beside attacks-against-disadvantage) requires schemaVersion 2 and capabilityApi 1.655 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(654) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(655) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(654) as never, document(false)), gate);
  }

  console.log("Seen against: a Robe of Scintillating Colors dazzles only who sees it; gated at 1.655.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
