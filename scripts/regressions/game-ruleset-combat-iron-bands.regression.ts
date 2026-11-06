/**
 * A check out of a condition that spends its item or bars more tries (Capability API 1.636): 5e's Iron
 * Bands of Binding, "On a success, the item is destroyed ... If the check fails, any further attempts
 * made by that creature automatically fail until 24 hours have elapsed."
 *
 *   - Escaped: the bands are spent for good.
 *   - Failed: its tries are not offered for a day.
 *   - The command word lets it go (a further use with `targetHolds.fromSelf` and `ends`).
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
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-iron-bands-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 636);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const document = (checkEnds: Record<string, unknown> = { spendsItem: true, failedRetryAfter: 14400 }) => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.items = { categories: [{ id: "gear", label: "Gear" }] };
    doc.catalogs.push({
      id: "kit",
      label: "Kit",
      holds: "items",
      entries: [
        {
          id: "bands",
          label: "Iron Bands of Binding",
          item: {
            category: "gear",
            use: {
              kind: "debuff",
              budget: "action",
              label: "Bind",
              targets: "enemy",
              range: 60,
              save: { save: "dex_save", onSuccess: "negates" },
              saveDifficulty: 17,
              applies: [
                {
                  condition: "restrained",
                  duration: { rounds: 14400 },
                  checkEnds: { check: "might", difficulty: 20, ...checkEnds },
                },
              ],
            },
            moreUses: [
              {
                label: "Release",
                use: {
                  kind: "buff",
                  budget: "bonus",
                  targets: "enemy",
                  range: 60,
                  targetHolds: { fromSelf: ["restrained"] },
                  ends: { conditions: ["restrained"] },
                },
              },
            ],
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
  const bands = definition.catalogs!.find((catalog) => catalog.id === "kit")!.entries![0]!.item!;
  /** The ogre bound, its turn up. */
  const bound = () => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        {
          id: "bard",
          name: "Bard",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 14, con: 12, int: 10, wis: 10, cha: 16 },
            fields: { level: 5, ac: 13, speed: 30, hp_max: 40 },
          }),
          items: [{ item: bands, quantity: 1, worn: false, name: "Iron Bands of Binding" }],
        },
        {
          id: "ogre",
          name: "Ogre",
          side: "enemy",
          block: {
            health: 59,
            defense: 11,
            initiativeModifier: -1,
            speed: 40,
            actions: [],
          } as unknown as RulesetStatBlock,
        },
      ],
    });
    state.order = ["bard", "ogre"];
    state.turn = 0;
    const bind = rulesetCombatOptions(definition, state, "bard").find((one) => one.label.includes("Bind"))!;
    assert.ok(bind);
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "bard", optionId: bind.id, targetIds: ["ogre"] },
      () => 2,
    );
    assert.ok(held(step.state), JSON.stringify(step.events));
    step.state.turn = 1;
    rulesetCombatant(step.state, "ogre")!.budgets.action = 1;
    return step.state;
  };
  const held = (state: RulesetEncounterState) =>
    rulesetCombatConditions(definition, rulesetCombatant(state, "ogre")!).includes("restrained");
  const tryOf = (state: RulesetEncounterState) =>
    rulesetCombatOptions(definition, state, "ogre").find((one) => one.label.startsWith("Try to end"));
  const escape = (state: RulesetEncounterState, d20: number) =>
    applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "ogre", optionId: tryOf(state)!.id, targetIds: [] },
      () => d20,
    );
  const bardOffered = (state: RulesetEncounterState, label: string) => {
    const copy = structuredClone(state);
    copy.turn = 0;
    const bard = rulesetCombatant(copy, "bard")!;
    bard.budgets.action = 1;
    bard.budgets.bonus = 1;
    return rulesetCombatOptions(definition, copy, "bard").some((one) => one.label.includes(label));
  };

  // ── Escaped: the bands are destroyed ──
  {
    const step = escape(bound(), 20);
    assert.ok(!held(step.state));
    assert.deepEqual(
      step.events.find((one) => one.type === "itemSpent"),
      { type: "itemSpent", actorId: "bard", label: "Iron Bands of Binding" },
    );
    assert.ok(!bardOffered(step.state, "Bind"), "gone for good");
  }

  // ── Failed: no more tries for a day ──
  {
    const state = bound();
    assert.ok(tryOf(state));
    const step = escape(state, 1);
    assert.ok(held(step.state));
    const later = structuredClone(step.state);
    later.round += 10;
    rulesetCombatant(later, "ogre")!.budgets.action = 1;
    assert.equal(tryOf(later), undefined, "barred");
    later.round += 14400;
    assert.ok(tryOf(later), "a day on, again");
    assert.ok(bardOffered(step.state, "Bind"), "still whole");
  }

  // ── Let go on the command word ──
  {
    const state = bound();
    state.turn = 0;
    rulesetCombatant(state, "bard")!.budgets.bonus = 1;
    const release = rulesetCombatOptions(definition, state, "bard").find((one) => one.label.includes("Release"))!;
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "bard", optionId: release.id, targetIds: ["ogre"] },
      () => 10,
    );
    assert.ok(!held(step.state));
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset with a check out of a condition that spends its item or bars more tries (checkEnds.spendsItem, checkEnds.failedRetryAfter) requires schemaVersion 2 and capabilityApi 1.636 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(635) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(636) as never, document()), gate);
  }

  console.log(
    "Iron Bands: an escape spends them, a failed one bars more tries for a day, the command word lets go; gated at 1.636.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
