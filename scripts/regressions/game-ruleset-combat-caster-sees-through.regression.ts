/**
 * What obscures for everybody but its caster (Capability API 1.609): a Staff of Swarming Insects'
 * Insect Cloud, "heavily obscured for creatures other than you".
 *
 *   - Cast and carried on its caster: the caster sees out of it; whoever is outside sees nobody in
 *     it, and nobody inside it sees out.
 *   - Without `notForCaster`, the caster is as blind in it as anybody.
 *   - Import refusal and the install gate.
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
  rulesetCanSee,
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetDefinition,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-caster-sees-through-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 609);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const cloud = (obscures: Record<string, unknown>) =>
    ({
      id: "insects",
      label: "Insect Cloud",
      rows: [{ list: "spells", values: { name: "Insect Cloud", level: 0, prepared: true } }],
      mechanics: {
        kind: "utility",
        budget: "action",
        range: 0,
        area: { shape: "burst", size: 30 },
        zone: { rounds: 100, triggers: [], anchor: "caster", obscures },
      },
    }) as unknown as RulesetCatalogEntry;
  const document = (obscures: Record<string, unknown> = { dispersed: true, notForCaster: true }) => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: [cloud(obscures)] });
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
  const fight = (definition: RulesetDefinition) => {
    const entries = definition.catalogs!.find((catalog) => catalog.id === "spells")!.entries! as RulesetCatalogEntry[];
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        {
          id: "druid",
          name: "Druid",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 10, con: 14, int: 10, wis: 18, cha: 10 },
            fields: { level: 9, ac: 12, speed: 30, hp_max: 60, spellcasting_ability: "wis" },
            lists: { spells: entries.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((one) => one.row)) },
          }),
          live: {},
          catalogs: { spells: entries },
        },
        ...["near", "far"].map((id) => ({
          id,
          name: id,
          side: "enemy" as const,
          block: { health: 20, defense: 5, initiativeModifier: 0, speed: 30, actions: [] },
        })),
      ],
      board: {
        grid: { width: 30, height: 15, tiles: Array.from({ length: 15 }, () => Array(30).fill("plains")) } as never,
        // `near` inside the cloud's 30 feet, `far` well outside it.
        placements: { druid: { x: 5, y: 7 }, near: { x: 7, y: 7 }, far: { x: 20, y: 7 } },
      },
    });
    state.order = ["druid", "near", "far"];
    state.turn = 0;
    const option = rulesetCombatOptions(definition, state, "druid").find((one) => one.label === "Insect Cloud");
    assert.ok(option, "no Insect Cloud");
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "druid", optionId: option.id, targetIds: [], at: { x: 5, y: 7 } },
      () => 10,
    );
    assert.equal((rulesetCombatant(step.state, "druid")!.zones ?? []).length, 1);
    const sees = (a: string, b: string) =>
      rulesetCanSee(definition, step.state, rulesetCombatant(step.state, a)!, rulesetCombatant(step.state, b)!);
    return sees;
  };

  // ── Its caster sees through it; nobody else does ──
  {
    const sees = fight(parsed(document()));
    assert.equal(sees("druid", "near"), true);
    assert.equal(sees("druid", "far"), true);
    assert.equal(sees("near", "druid"), false);
    assert.equal(sees("far", "druid"), false);
    assert.equal(sees("far", "near"), false);
  }
  // ── Without it, the caster is as blind in it as anybody ──
  {
    const sees = fight(parsed(document({ dispersed: true })));
    assert.equal(sees("druid", "near"), false);
    assert.equal(sees("druid", "far"), false);
  }

  // ── Refusal ──
  refused(document({ notForCaster: false }), /notForCaster/);

  // ── The install gate ──
  {
    const gate =
      "A ruleset with something that obscures for everybody but its caster (obscures.notForCaster) requires schemaVersion 2 and capabilityApi 1.609 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(608) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(609) as never, document()), gate);
  }

  console.log("Obscures for everybody but its caster: the caster sees out, nobody sees in; refusal; gated at 1.609.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
