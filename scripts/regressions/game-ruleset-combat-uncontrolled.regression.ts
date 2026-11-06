/**
 * A target under nobody else's control (Capability API 1.633): 5e's Pipes of the Sewers, "a swarm of
 * rats that isn't under another creature's control".
 *
 *   - A swarm nobody called, the piper's own, a wild one and one turned on its caller may be swayed;
 *     a vampire's may not.
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
  rulesetOptionTargets,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetDefinition,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-uncontrolled-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 633);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const document = (): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.live.conditions.push({ id: "piped", label: "Piped" });
    doc.combat.conditions.push({ condition: "piped", effects: [] });
    doc.catalogs.push({
      id: "spells",
      label: "Spells",
      feeds: ["spells"],
      entries: [
        {
          id: "sway",
          label: "Sway",
          rows: [{ list: "spells", values: { name: "Sway", level: 0, prepared: true } }],
          mechanics: {
            kind: "debuff",
            targets: "enemy",
            budget: "action",
            range: 30,
            targetTypes: { uncontrolled: true },
            applies: [{ condition: "piped", duration: { rounds: 600 } }],
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
  const definition = parsed(document());
  const entries = definition.catalogs!.find((catalog) => catalog.id === "spells")!.entries! as RulesetCatalogEntry[];
  const swarm = (id: string) => ({
    id,
    name: id,
    side: "enemy" as const,
    block: { health: 24, defense: 10, initiativeModifier: 0, speed: 30, actions: [] } as unknown as RulesetStatBlock,
  });
  const state = createRulesetEncounter({
    definition,
    seed: 1,
    roller: () => 10,
    combatants: [
      {
        id: "piper",
        name: "Piper",
        side: "party",
        build: rulesetSheetBuildSchema.parse({
          abilities: { str: 10, dex: 10, con: 14, int: 10, wis: 10, cha: 16 },
          fields: { level: 5, ac: 12, speed: 30, hp_max: 40 },
          lists: { spells: entries.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((one) => one.row)) },
        }),
        live: {},
        catalogs: { spells: entries },
      },
      swarm("vampire"),
      swarm("free"),
      swarm("mine"),
      swarm("theirs"),
      swarm("wild"),
      swarm("turned"),
    ],
  });
  state.order = ["piper", "vampire", "free", "mine", "theirs", "wild", "turned"];
  state.turn = 0;
  const of = (id: string) => rulesetCombatant(state, id)!;
  of("mine").calledBy = "piper";
  of("theirs").calledBy = "vampire";
  of("wild").calledBy = "vampire";
  of("wild").calledWild = {};
  of("turned").calledBy = "vampire";
  of("turned").calledTurned = true;
  const option = rulesetCombatOptions(definition, state, "piper").find((one) => one.label === "Sway")!;
  assert.ok(option, "no Sway");
  assert.deepEqual(rulesetOptionTargets(definition, state, "piper", option).sort(), [
    "free",
    "mine",
    "turned",
    "vampire",
    "wild",
  ]);

  // ── The install gate ──
  {
    const gate =
      "A ruleset with a target test for a creature under nobody else's control (targetTypes.uncontrolled) requires schemaVersion 2 and capabilityApi 1.633 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(632) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(633) as never, document()), gate);
  }

  console.log(
    "targetTypes.uncontrolled: an uncalled, own, wild or turned swarm may be swayed, a vampire's may not; gated at 1.633.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
