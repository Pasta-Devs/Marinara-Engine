/**
 * An item use that may backfire on its user (Capability API 1.630): 5e's Horn of Blasting, "Each use
 * of the horn's magic has a 20 percent chance of causing the horn to explode. The explosion deals 10d6
 * fire damage to the blower and destroys the horn."
 *
 *   - Over its chance on the d100, nothing happens to its user.
 *   - At or under it, its user takes 10d6 fire, the horn is gone and offered no more, and the blast
 *     still goes off; with `instead`, the blast does not.
 *   - Refused with no amount.
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

const dataDir = mkdtempSync(join(tmpdir(), "marinara-backfires-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 630);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const document = (
    backfires: Record<string, unknown> = { chance: 20, amount: { dice: "10d6" }, damageType: "fire", destroys: true },
  ) => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
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
              save: { save: "con_save", onSuccess: "half" },
              saveDifficulty: 15,
              backfires,
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
  const goblin = (): RulesetStatBlock =>
    ({ health: 80, defense: 12, initiativeModifier: 0, speed: 30, actions: [] }) as unknown as RulesetStatBlock;
  const blow = (definition: RulesetDefinition, d100: number) => {
    const horn = definition.catalogs!.find((catalog) => catalog.id === "kit")!.entries![0]!.item!;
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
            fields: { level: 5, ac: 13, speed: 30, hp_max: 80 },
          }),
          items: [{ item: horn, quantity: 1, worn: false, name: "Horn of Blasting" }],
        },
        { id: "goblin", name: "Goblin", side: "enemy", block: goblin() },
      ],
    });
    state.order = ["bard", "goblin"];
    state.turn = 0;
    const options = () => rulesetCombatOptions(definition, state, "bard").filter((one) => one.label.includes("Blast"));
    const option = options()[0];
    assert.ok(
      option,
      rulesetCombatOptions(definition, state, "bard")
        .map((one) => one.label)
        .join(", "),
    );
    // Every d20 a 5, so the goblin fails; every d6 a 3.
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "bard", optionId: option.id, targetIds: [] },
      (sides: number) => (sides === 100 ? d100 : sides === 20 ? 5 : 3),
    );
    assert.equal(
      step.events.find((one) => one.type === "refused"),
      undefined,
      JSON.stringify(step.events),
    );
    const dealt = (id: string) =>
      step.events
        .filter(
          (one): one is Extract<RulesetCombatEvent, { type: "damage" }> => one.type === "damage" && one.targetId === id,
        )
        .reduce((sum, one) => sum + one.amount, 0);
    const after = structuredClone(step.state);
    after.turn = 0;
    rulesetCombatant(after, "bard")!.budgets.action = 1;
    const again = rulesetCombatOptions(definition, after, "bard").some((one) => one.label.includes("Blast"));
    return { step, dealt, again };
  };
  const definition = parsed(document());

  // ── Over its chance: nothing to its user ──
  {
    const { step, dealt, again } = blow(definition, 21);
    assert.equal(
      step.events.find((one) => one.type === "backfired"),
      undefined,
    );
    assert.equal(dealt("bard"), 0);
    assert.equal(dealt("goblin"), 15, "5d6");
    assert.ok(again, "still there");
  }

  // ── At its chance: it explodes, and the blast still goes off ──
  {
    const { step, dealt, again } = blow(definition, 20);
    assert.deepEqual(
      step.events.find((one) => one.type === "backfired"),
      {
        type: "backfired",
        actorId: "bard",
        label: step.events.find((one) => one.type === "backfired")!.label,
        roll: 20,
        destroyed: true,
      },
    );
    assert.equal(dealt("bard"), 30, "10d6 fire to the blower");
    const fire = step.events.find(
      (one): one is Extract<RulesetCombatEvent, { type: "damage" }> => one.type === "damage" && one.targetId === "bard",
    );
    assert.equal(fire?.damageType, "fire");
    assert.equal(dealt("goblin"), 15, "the blast still goes off");
    assert.ok(!again, "the horn is gone");
  }

  // ── With instead, the blast does not go off ──
  {
    const instead = parsed(document({ chance: 20, amount: { dice: "10d6" }, damageType: "fire", instead: true }));
    const { dealt, again } = blow(instead, 3);
    assert.equal(dealt("bard"), 30);
    assert.equal(dealt("goblin"), 0);
    assert.ok(again, "not destroyed");
  }

  // ── Refusals ──
  refused(document({ chance: 20, amount: {} }), /backfires/);

  // ── The install gate ──
  {
    const gate =
      "A ruleset with an item use that may backfire on its user (use.backfires) requires schemaVersion 2 and capabilityApi 1.630 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(629) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(630) as never, document()), gate);
  }

  console.log("Horn of Blasting: glass saves at disadvantage and takes 10d6 instead of 5d6; gated at 1.629.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
