/**
 * Creature saves failed badly (Capability API 1.673).
 *
 *   - A creature action's `save.failedBy {atLeast}`: a mummy's Dreadful Glare, frightened and
 *     paralyzed on a failure by 5 or more, frightened on any other failure, nothing on a success.
 *   - `failedBy.resultAtMost`: a sprite's arrow, poisoned and unconscious on a total of 5 or lower.
 *   - Refusals and the install gate.
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
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-creature-failed-by-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 673);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const glare = {
    id: "glare",
    name: "Dreadful Glare",
    budget: "action",
    reach: 5,
    autoHit: true,
    save: {
      save: "wis_save",
      difficulty: 11,
      onSuccess: "negates",
      failedBy: {
        atLeast: 5,
        applies: [
          { condition: "frightened", duration: { rounds: 1 } },
          { condition: "paralyzed", duration: { rounds: 1 } },
        ],
      },
    },
    applies: [{ condition: "frightened", duration: { rounds: 1 } }],
  };
  const arrow = {
    id: "arrow",
    name: "Sprite Arrow",
    budget: "action",
    reach: 5,
    autoHit: true,
    save: {
      save: "con_save",
      difficulty: 10,
      onSuccess: "negates",
      failedBy: {
        resultAtMost: 5,
        applies: [
          { condition: "poisoned", duration: { rounds: 10 } },
          { condition: "unconscious", duration: { rounds: 10 } },
        ],
      },
    },
    applies: [{ condition: "poisoned", duration: { rounds: 10 } }],
  };
  const parsed = (doc: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(doc);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const document = () => JSON.parse(fiveEText) as Record<string, any>;
  const definition = parsed(document());
  const block = (): RulesetStatBlock =>
    ({
      health: 50,
      defense: 10,
      initiativeModifier: 0,
      speed: 30,
      actions: [glare, arrow],
    }) as unknown as RulesetStatBlock;
  const use = (name: string, face: number) => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
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
        { id: "mummy", name: "Mummy", side: "enemy", block: block() },
      ],
    });
    state.order = ["mummy", "hero"];
    state.turn = 0;
    const option = rulesetCombatOptions(definition, state, "mummy").find((one) => one.label === name);
    assert.ok(option, `${name} is offered`);
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "mummy", optionId: option.id, targetIds: ["hero"] },
      (sides) => (sides === 20 ? face : 3),
    );
    const refused = step.events.find((one) => one.type === "refused");
    assert.equal(refused, undefined, JSON.stringify(refused));
    const save = step.events.find((one): one is Extract<RulesetCombatEvent, { type: "save" }> => one.type === "save")!;
    return {
      save,
      holds: rulesetCombatant(step.state, "hero")!
        .tracked.map((one) => one.condition)
        .sort(),
    };
  };

  // ── Dreadful Glare ──
  {
    const bad = use("Dreadful Glare", 1);
    assert.ok(bad.save.difficulty - bad.save.total >= 5, JSON.stringify(bad.save));
    assert.deepEqual(bad.holds, ["frightened", "paralyzed"]);
    const offset = bad.save.total - 1;
    const near = use("Dreadful Glare", 10 - offset);
    assert.equal(near.save.success, false);
    assert.ok(near.save.difficulty - near.save.total < 5);
    assert.deepEqual(near.holds, ["frightened"]);
    assert.deepEqual(use("Dreadful Glare", 20).holds, []);
  }

  // ── A sprite's arrow: a total of 5 or lower ──
  {
    const probe = use("Sprite Arrow", 1);
    const offset = probe.save.total - 1;
    const low = use("Sprite Arrow", 5 - offset);
    assert.equal(low.save.total, 5);
    assert.deepEqual(low.holds, ["poisoned", "unconscious"]);
    const above = use("Sprite Arrow", 6 - offset);
    assert.equal(above.save.total, 6);
    assert.equal(above.save.success, false);
    assert.deepEqual(above.holds, ["poisoned"]);
  }

  // ── Refusals ──
  {
    const withCreature = (action: Record<string, unknown>) => {
      const doc = document();
      const creatures = doc.catalogs.find((one: { holds?: string }) => one.holds === "creatures");
      creatures.entries[0].creature.actions.push(action);
      return doc;
    };
    const refused = (doc: unknown, pattern: RegExp) => {
      const result = parseRulesetDefinition(doc);
      assert.equal(result.ok, false, `should be refused: ${pattern}`);
      if (!result.ok) assert.match(result.issues.join("; "), pattern);
    };
    refused(
      withCreature({
        ...glare,
        save: { ...glare.save, failedBy: { atLeast: 5, applies: [{ condition: "nosuch", duration: { rounds: 1 } }] } },
      }),
      /Unknown condition "nosuch"/,
    );
    refused(
      withCreature({
        ...glare,
        save: { ...glare.save, failedBy: { atLeast: 5, resultAtMost: 5, applies: glare.applies } },
      }),
      /Say "atLeast" or "resultAtMost"/,
    );
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset with a creature's save failed by a margin, or a save failed by a total that low (save.failedBy on a creature, resultAtMost), requires schemaVersion 2 and capabilityApi 1.673 or newer";
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
    const withGlare = document();
    withGlare.catalogs
      .find((one: { holds?: string }) => one.holds === "creatures")
      .entries[0].creature.actions.push(glare);
    assert.equal(getCapabilityPackageInstallIssue(manifest(672) as never, withGlare), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(673) as never, withGlare), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(672) as never, document()), gate);
  }

  console.log(
    "Creature failedBy: Dreadful Glare paralyzes on a failure by 5 or more, a sprite's arrow knocks out on a total of 5 or lower; gated at 1.673.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
