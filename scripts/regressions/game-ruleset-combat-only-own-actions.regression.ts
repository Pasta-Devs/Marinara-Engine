/**
 * A behavior's `only` keeping the condition's own actions (Capability API 1.601): 5e's Wind Walk,
 * "The only actions a creature can take in this form are the Dash action or to revert to its normal
 * form".
 *
 *   - `behavior.actions: true`: walking, Dash and the condition's revert are offered; a spell is not.
 *   - Without it, the revert is filtered out with the rest.
 *   - Refused without `only` or without actions of its own; the install gate.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createRulesetEncounter,
  parseRulesetDefinition,
  rowsFromCatalogEntry,
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetDefinition,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-only-own-actions-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 601);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const spell = (id: string, label: string, mechanics: Record<string, unknown>) => ({
    id,
    label,
    rows: [{ list: "spells", values: { name: label, level: 0, prepared: true } }],
    mechanics: { budget: "action", ...mechanics },
  });
  const spells = [
    spell("spark", "Spark", {
      kind: "attack",
      targets: "enemy",
      range: 60,
      autoHit: true,
      amount: { flat: 1 },
      damageType: "fire",
    }),
    spell("revert", "Revert", { kind: "utility", targets: "self", endsCondition: "wind_walking" }),
  ];
  const behavior = { only: ["move", "dash"], actions: true };
  const document = (rule: Record<string, unknown> = behavior, actions: string[] | null = ["spells/revert"]) => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: spells });
    doc.sheet.live.conditions.push({ id: "wind_walking", label: "Wind Walking" });
    doc.combat.conditions.push({
      condition: "wind_walking",
      effects: [],
      behavior: rule,
      ...(actions ? { actions } : {}),
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
  const menu = (definition: RulesetDefinition) => {
    const entries = definition.catalogs!.find((catalog) => catalog.id === "spells")!.entries! as RulesetCatalogEntry[];
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        {
          id: "mage",
          name: "Mage",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 10, con: 14, int: 18, wis: 10, cha: 10 },
            fields: { level: 11, ac: 12, speed: 30, hp_max: 60, spellcasting_ability: "int" },
            lists: {
              spells: entries
                .filter((entry) => entry.id === "spark")
                .flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((one) => one.row)),
            },
          }),
          live: {},
          catalogs: { spells: entries },
        },
        {
          id: "wolf",
          name: "Wolf",
          side: "enemy",
          block: {
            health: 20,
            defense: 5,
            initiativeModifier: 0,
            speed: 30,
            actions: [],
          } as unknown as RulesetStatBlock,
        },
      ],
    });
    state.order = ["mage", "wolf"];
    state.turn = 0;
    rulesetCombatant(state, "mage")!.tracked.push({ condition: "wind_walking", rounds: 600 });
    return rulesetCombatOptions(definition, state, "mage").map((option) => option.label);
  };

  // ── Dash and the revert, never Spark ──
  {
    const labels = menu(parsed(document()));
    assert.ok(labels.includes("Revert"), labels.join(", "));
    assert.ok(
      labels.some((label) => /dash/i.test(label)),
      labels.join(", "),
    );
    assert.ok(!labels.includes("Spark"));
  }
  // ── Without `actions`, the revert goes with the rest ──
  {
    const labels = menu(parsed(document({ only: ["move", "dash"] })));
    assert.ok(!labels.includes("Revert") && !labels.includes("Spark"));
  }

  // ── Refusals ──
  refused(document({ actions: true }), /"actions" keeps the condition's own actions through "only", so it has both/);
  refused(document(behavior, null), /"actions" keeps the condition's own actions through "only", so it has both/);

  // ── The install gate ──
  {
    const gate =
      "A ruleset with a behavior that keeps its condition's own actions (behavior.actions) requires schemaVersion 2 and capabilityApi 1.601 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(600) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(601) as never, document()), gate);
  }

  console.log(
    "Only, with its own actions: Dash and Wind Walk's revert offered, a spell not; refusals; gated at 1.601.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
