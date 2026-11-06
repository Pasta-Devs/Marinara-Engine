/**
 * A duration rolled in dice (Capability API 1.625): 5e's Potion of Growth, "1d4 hours", as
 * `{"rounds": 600, "times": "1d4"}`.
 *
 *   - Put on, it lasts its rounds times what the dice roll then.
 *   - Refused past a day at the most the dice can roll; the install gate.
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
  type RulesetDefinition,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-duration-times-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 625);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const document = (duration: Record<string, unknown> = { rounds: 600, times: "1d4" }) => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.live.conditions.push({ id: "enlarged", label: "Enlarged" });
    doc.combat.conditions.push({ condition: "enlarged", effects: [] });
    doc.items = { categories: [{ id: "gear", label: "Gear" }] };
    doc.catalogs.push({
      id: "kit",
      label: "Kit",
      holds: "items",
      entries: [
        {
          id: "growth",
          label: "Potion of Growth",
          item: {
            category: "gear",
            use: {
              kind: "buff",
              budget: "action",
              label: "Drink",
              targets: "self",
              consumes: true,
              applies: [{ condition: "enlarged", duration }],
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
  const potion = definition.catalogs!.find((catalog) => catalog.id === "kit")!.entries![0]!.item!;
  const drink = (d4: number) => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        {
          id: "drinker",
          name: "Drinker",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 14, con: 12, int: 10, wis: 10, cha: 10 },
            fields: { level: 5, ac: 14, speed: 30, hp_max: 30 },
          }),
          items: [{ item: potion, quantity: 1, name: "Potion of Growth" }],
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
    state.order = ["drinker", "wolf"];
    state.turn = 0;
    const option = rulesetCombatOptions(definition, state, "drinker").find((one) => /Drink/.test(one.label));
    assert.ok(option);
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "drinker", optionId: option.id, targetIds: ["drinker"] },
      (sides: number) => (sides === 4 ? d4 : 10),
    );
    return rulesetCombatant(step.state, "drinker")!.tracked.find((entry) => entry.condition === "enlarged")?.rounds;
  };

  // ── Its rounds times the roll ──
  assert.equal(drink(3), 1800);
  assert.equal(drink(1), 600);

  // ── Refusals ──
  refused(document({ rounds: 6000, times: "1d4" }), /no more than a day/);
  assert.ok(parseRulesetDefinition(document({ rounds: 3600, times: "1d4" })).ok, "a day exactly");

  // ── The install gate ──
  {
    const gate =
      "A ruleset with a duration rolled in dice (duration.times) requires schemaVersion 2 and capabilityApi 1.625 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(624) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(625) as never, document()), gate);
  }

  console.log("duration times: a Potion of Growth lasts 600 rounds times its 1d4; refused past a day; gated at 1.625.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
