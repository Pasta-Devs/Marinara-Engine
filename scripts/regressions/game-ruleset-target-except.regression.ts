/**
 * Target tests with an exception (Capability API 1.530).
 *
 *   - A net's "no effect on creatures that are formless": `except` turns away whoever it passes,
 *     beside the rest of the test or alone.
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
  rulesetCombatant,
  rulesetTargetIs,
  supportedCapabilityApi,
  type RulesetDefinition,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-target-except-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 530);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const document = (targetIs: unknown = { types: ["beast", "ooze"], except: { tags: ["formless"] } }) => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.combat.creatureTypes = {
      types: ["beast", "humanoid", "ooze"].map((id) => ({ id, label: id })),
      tags: [{ id: "formless", label: "Formless" }],
      default: "humanoid",
    };
    doc.sheet.live.conditions.push({ id: "netted", label: "Netted" });
    doc.combat.conditions.push({ condition: "netted", effects: ["speed-zero"] });
    doc.catalogs.push({
      id: "nets",
      label: "Nets",
      feeds: ["spells"],
      entries: [
        {
          id: "net",
          label: "Net",
          rows: [{ list: "spells", values: { name: "Net", level: 1, prepared: true } }],
          mechanics: { kind: "debuff", applies: [{ condition: "netted", duration: { rounds: 10 }, targetIs }] },
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
  const block = (type: string, tags?: string[]) =>
    ({
      health: 10,
      defense: 10,
      initiativeModifier: 0,
      actions: [],
      type,
      ...(tags ? { tags } : {}),
    }) as unknown as RulesetStatBlock;
  const state = createRulesetEncounter({
    definition,
    seed: 1,
    roller: () => 10,
    combatants: [
      { id: "wolf", name: "Wolf", side: "enemy", block: block("beast") },
      { id: "ooze", name: "Ooze", side: "enemy", block: block("ooze", ["formless"]) },
      { id: "guard", name: "Guard", side: "party", block: block("humanoid") },
    ],
  });
  const is = (id: string, test: Parameters<typeof rulesetTargetIs>[2]) =>
    rulesetTargetIs(definition, rulesetCombatant(state, id)!, test);
  const net = { types: ["beast", "ooze"], except: { tags: ["formless"] } };
  assert.equal(is("wolf", net), true);
  assert.equal(is("ooze", net), false, "formless");
  assert.equal(is("guard", net), false, "not a beast or ooze");
  const alone = { except: { tags: ["formless"] } };
  assert.equal(is("guard", alone), true, "anybody else");
  assert.equal(is("ooze", alone), false);

  // ── Refusals ──
  refused(document({ except: {} }), /What a target test excepts names/);
  refused(document({ except: { tags: ["shiny"] } }), /Unknown creature tag "shiny"/);
  refused(document({ except: { except: { tags: ["formless"] } } }), /Unrecognized key|except/);

  // ── The install gate ──
  {
    const gate =
      "A ruleset with a target test that excepts what it is never (targetIs except) requires schemaVersion 2 and capabilityApi 1.530 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(529) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(530) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(529) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "Target except: a net passes a wolf, never a formless ooze; except alone passes anybody else; gated at 1.530.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
