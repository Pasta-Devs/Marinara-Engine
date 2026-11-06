/**
 * Another amount dealt instead to what it names (Capability API 1.629): 5e's Horn of Blasting,
 * "Creatures and objects made of glass or crystal have disadvantage on the saving throw and take 10d6
 * thunder damage instead of 5d6."
 *
 *   - A glass creature rolls its save twice (`save.modes`, 1.185) and takes 10d6, anybody else 5d6.
 *   - Refused against an unknown tag or with no amount.
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
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-horn-blasting-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 629);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const document = (amountAgainst: unknown = { is: { tags: ["glass", "crystal"] }, amount: { dice: "10d6" } }) => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.combat.creatureTypes = {
      types: [{ id: "humanoid", label: "Humanoid" }],
      tags: [
        { id: "glass", label: "Glass" },
        { id: "crystal", label: "Crystal" },
      ],
    };
    doc.items = { categories: [{ id: "gear", label: "Gear" }] };
    doc.catalogs.push({
      id: "kit",
      label: "Kit",
      holds: "items",
      entries: [
        {
          id: "horn",
          label: "Horn of Blasting",
          item: {
            category: "gear",
            use: {
              kind: "attack",
              budget: "action",
              label: "Blast",
              area: { shape: "burst", size: 30, around: true },
              friendlyFire: false,
              amount: { dice: "5d6" },
              damageType: "thunder",
              save: {
                save: "con_save",
                onSuccess: "half",
                modes: [{ is: { tags: ["glass", "crystal"] }, mode: "disadvantage" }],
              },
              saveDifficulty: 15,
              amountAgainst,
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
  const horn = definition.catalogs!.find((catalog) => catalog.id === "kit")!.entries![0]!.item!;
  const goblin = (tags?: string[]): RulesetStatBlock =>
    ({
      health: 80,
      defense: 12,
      initiativeModifier: 0,
      speed: 30,
      actions: [],
      ...(tags ? { tags } : {}),
    }) as unknown as RulesetStatBlock;
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
          fields: { level: 5, ac: 13, speed: 30, hp_max: 30 },
        }),
        items: [{ item: horn, quantity: 1, worn: false, name: "Horn of Blasting" }],
      },
      { id: "flesh", name: "Goblin", side: "enemy", block: goblin() },
      { id: "glass", name: "Glass Golem", side: "enemy", block: goblin(["glass"]) },
    ],
  });
  state.order = ["bard", "flesh", "glass"];
  state.turn = 0;
  const option = rulesetCombatOptions(definition, state, "bard").find((one) => one.label.includes("Blast"));
  assert.ok(
    option,
    rulesetCombatOptions(definition, state, "bard")
      .map((one) => one.label)
      .join(", "),
  );
  // Every d20 a 14, so a plain save fails by one and the glass golem's two dice fail too; every d6 a 3.
  const step = applyRulesetCombatChoice(
    definition,
    state,
    { actorId: "bard", optionId: option.id, targetIds: [] },
    (sides: number) => (sides === 20 ? 14 : 3),
  );
  assert.equal(
    step.events.find((one) => one.type === "refused"),
    undefined,
    JSON.stringify(step.events),
  );
  const saveOf = (id: string) =>
    step.events.find(
      (one): one is Extract<RulesetCombatEvent, { type: "save" }> => one.type === "save" && one.actorId === id,
    )!;
  assert.equal(saveOf("flesh").rolls.length, 1);
  assert.equal(saveOf("glass").rolls.length, 2, "glass rolls with disadvantage");
  const dealt = (id: string) =>
    step.events
      .filter(
        (one): one is Extract<RulesetCombatEvent, { type: "damage" }> => one.type === "damage" && one.targetId === id,
      )
      .reduce((sum, one) => sum + one.amount, 0);
  assert.equal(dealt("flesh"), 15, "5d6");
  assert.equal(dealt("glass"), 30, "10d6 instead");

  // ── Refusals ──
  refused(document({ is: { tags: ["stone"] }, amount: { dice: "10d6" } }), /stone/);
  refused(document({ is: { tags: ["glass"] }, amount: {} }), /amountAgainst/);

  // ── The install gate ──
  {
    const gate =
      "A ruleset with an entry dealing another amount to what it names (amountAgainst) requires schemaVersion 2 and capabilityApi 1.629 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(628) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(629) as never, document()), gate);
  }

  console.log("Horn of Blasting: glass saves at disadvantage and takes 10d6 instead of 5d6; gated at 1.629.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
