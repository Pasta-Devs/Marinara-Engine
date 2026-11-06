/**
 * What a creature's blow does to whoever it drops (Capability API 1.677).
 *
 *   - `onFell` on a creature action: a giant spider's bite that drops a character leaves them stable,
 *     poisoned and paralyzed. A blow that drops nobody, or lands on somebody already down, does none
 *     of it.
 *   - Import refusals, and the install gate.
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
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-on-fell-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 677);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const document = () => JSON.parse(fiveEText) as Record<string, any>;
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
  const onFell = {
    stabilizes: true,
    applies: [
      { condition: "poisoned", duration: { rounds: 600 } },
      { condition: "paralyzed", duration: "instant", endsWith: "poisoned" },
    ],
  };
  const bite = (flat: number) => ({
    id: "bite",
    name: "Bite",
    budget: "action",
    toHit: 30,
    damage: { count: 0, sides: 8, flat },
    onFell,
  });
  const fight = (flat: number) => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        {
          id: "spider",
          name: "Giant Spider",
          side: "enemy",
          block: {
            health: 30,
            defense: 10,
            initiativeModifier: 0,
            speed: 30,
            actions: [bite(flat)],
          } as unknown as RulesetStatBlock,
        },
        {
          id: "hero",
          name: "Hero",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
            fields: { level: 1, ac: 12, speed: 30, hp_max: 30 },
          }),
          live: {},
        },
        // Somebody still standing, so the fight goes on.
        {
          id: "other",
          name: "Other",
          side: "party",
          block: {
            health: 30,
            defense: 10,
            initiativeModifier: 0,
            speed: 30,
            actions: [],
          } as unknown as RulesetStatBlock,
        },
      ],
    });
    state.order = ["spider", "hero", "other"];
    state.turn = 0;
    return state;
  };
  const hero = (state: RulesetEncounterState) => rulesetCombatant(state, "hero")!;
  const holds = (state: RulesetEncounterState) =>
    hero(state)
      .tracked.map((one) => one.condition)
      .sort();
  const strike = (state: RulesetEncounterState) => {
    state.turn = 0;
    const spider = rulesetCombatant(state, "spider")!;
    spider.budgets = { ...spider.budgets, action: 1 };
    spider.spent = [];
    const option = rulesetCombatOptions(definition, state, "spider").find((one) => one.label === "Bite")!;
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "spider", optionId: option.id, targetIds: ["hero"] },
      () => 10,
    );
    assert.equal(
      step.events.find((one) => one.type === "refused"),
      undefined,
    );
    return step;
  };

  // ── Dropped: stable, poisoned and paralyzed ──
  {
    const step = strike(fight(32));
    const state = step.state;
    assert.ok(hero(state).down, "down");
    assert.ok(!hero(state).defeated, "not dead");
    assert.equal(hero(state).stable, true, "stable");
    assert.ok(step.events.some((one) => one.type === "stabilized" && one.targetId === "hero"));
    assert.deepEqual(holds(state), ["paralyzed", "poisoned", "unconscious"]);
  }
  // ── Left standing: none of it ──
  {
    const state = strike(fight(5)).state;
    assert.ok(!hero(state).down);
    assert.deepEqual(holds(state), []);
  }
  // ── Already down: none of it again ──
  {
    let state = strike(fight(32)).state;
    hero(state).tracked = [];
    state = strike(state).state;
    assert.deepEqual(holds(state), []);
  }

  // ── Refusals ──
  {
    const withCreature = (action: Record<string, unknown>, edit: (doc: Record<string, any>) => void = () => {}) => {
      const doc = document();
      doc.catalogs
        .find((one: { holds?: string }) => one.holds === "creatures")
        .entries[0].creature.actions.push(action);
      edit(doc);
      return doc;
    };
    const entry = (fell: unknown) => ({
      id: "bite",
      name: "Bite",
      budget: "action",
      toHit: 5,
      damage: { dice: "1d8", flat: 3, type: "piercing" },
      onFell: fell,
    });
    parsed(withCreature(entry(onFell)));
    refused(withCreature(entry({})), /"onFell" stabilizes, applies, or both/);
    refused(
      withCreature(entry({ applies: [{ condition: "nosuch", duration: "instant" }] })),
      /Unknown condition "nosuch"/,
    );
    refused(
      withCreature(entry({ stabilizes: true }), (doc) => delete doc.combat.dying),
      /Steadying the dying needs a combat block with a dying rule/,
    );
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset with a creature's blow that does something to whoever it drops (onFell) requires schemaVersion 2 and capabilityApi 1.677 or newer";
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
    const withBite = document();
    withBite.catalogs
      .find((one: { holds?: string }) => one.holds === "creatures")
      .entries[0].creature.actions.push({
        id: "bite",
        name: "Bite",
        budget: "action",
        toHit: 5,
        damage: { dice: "1d8", flat: 3, type: "piercing" },
        onFell,
      });
    assert.equal(getCapabilityPackageInstallIssue(manifest(676) as never, withBite), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(677) as never, withBite), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(676) as never, document()), gate);
  }

  console.log(
    "onFell: a blow that drops somebody leaves them stable with its conditions, and only then; gated at 1.677.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
