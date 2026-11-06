/**
 * A creature's slaying held to the low, and a failed save that drops to no health (Capability API
 * 1.678).
 *
 *   - `slaysHealthAtMost`: a solar's Slaying Longbow slays a target with 190 health or less that fails
 *     its save; one with more takes the arrow as if it had saved.
 *   - `dropsOnFailedSave` on a creature: a sea hag's Death Glare drops a character who fails to no
 *     health, dying, not dead; one who saves is untouched.
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
  rulesetCombatHealth,
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-creature-slaying-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 678);
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
  const longbow = {
    id: "longbow",
    name: "Slaying Longbow",
    budget: "action",
    toHit: 30,
    damage: { count: 0, sides: 8, flat: 10 },
    save: { save: "con_save", difficulty: 15, onSuccess: "none" },
    slaysOnFailedSave: true,
    slaysHealthAtMost: 190,
  };
  const glare = {
    id: "glare",
    name: "Death Glare",
    budget: "action",
    autoHit: true,
    save: { save: "wis_save", difficulty: 11, onSuccess: "negates" },
    dropsOnFailedSave: true,
  };
  const block = (health: number, extra: Record<string, unknown> = {}) =>
    ({ health, defense: 5, initiativeModifier: 0, speed: 30, actions: [], ...extra }) as unknown as RulesetStatBlock;
  const fight = (targetHealth: number, saves: Record<string, number>, wis = 10) => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        { id: "solar", name: "Solar", side: "enemy", block: block(243, { actions: [longbow, glare] }) },
        { id: "beast", name: "Beast", side: "party", block: block(targetHealth, { saves }) },
        {
          id: "hero",
          name: "Hero",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 10, con: 10, int: 10, wis, cha: 10 },
            fields: { level: 1, ac: 12, speed: 30, hp_max: 30 },
          }),
          live: {},
        },
        { id: "other", name: "Other", side: "party", block: block(30) },
      ],
    });
    state.order = state.combatants.map((one) => one.id);
    state.turn = 0;
    return state;
  };
  const who = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)!;
  const health = (state: RulesetEncounterState, id: string) =>
    rulesetCombatHealth(definition, definition.combat!, who(state, id)).value;
  const use = (state: RulesetEncounterState, label: string, targetId: string) => {
    const option = rulesetCombatOptions(definition, state, "solar").find((one) => one.label === label)!;
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "solar", optionId: option.id, targetIds: [targetId] },
      () => 10,
    );
    assert.equal(
      step.events.find((one) => one.type === "refused"),
      undefined,
    );
    return step.state;
  };

  // ── The longbow: 190 or fewer slain, more only hurt ──
  {
    const low = use(fight(150, { con_save: -20 }), "Slaying Longbow", "beast");
    assert.ok(who(low, "beast").defeated, "slain at 150");
    const high = use(fight(200, { con_save: -20 }), "Slaying Longbow", "beast");
    assert.ok(!who(high, "beast").defeated, "not slain at 200");
    assert.equal(health(high, "beast"), 190, "the arrow lands all the same");
    const saved = use(fight(150, { con_save: 30 }), "Slaying Longbow", "beast");
    assert.ok(!who(saved, "beast").defeated);
    assert.equal(health(saved, "beast"), 140);
  }
  // ── The glare: dropped to nothing and dying, not dead ──
  {
    const failed = use(fight(100, {}, 1), "Death Glare", "hero");
    assert.equal(health(failed, "hero"), 0);
    assert.ok(who(failed, "hero").down, "down");
    assert.ok(!who(failed, "hero").defeated, "not dead");
    const made = use(fight(100, {}, 30), "Death Glare", "hero");
    assert.equal(health(made, "hero"), 30);
  }

  // ── Refusals ──
  {
    const withCreature = (action: Record<string, unknown>) => {
      const doc = document();
      doc.catalogs
        .find((one: { holds?: string }) => one.holds === "creatures")
        .entries[0].creature.actions.push(action);
      return doc;
    };
    const bow = { ...longbow, damage: { dice: "2d8", flat: 6, type: "piercing" } };
    parsed(withCreature(bow));
    parsed(withCreature(glare));
    refused(
      withCreature({ ...bow, slaysOnFailedSave: undefined }),
      /"slaysHealthAtMost" says whom "slaysOnFailedSave" slays/,
    );
    refused(withCreature({ ...glare, save: undefined }), /"dropsOnFailedSave" follows the action's own save/);
    refused(withCreature({ ...glare, slaysOnFailedSave: true }), /slays nobody beside/);
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset with a creature's slaying held to a health, or its failed save dropping to no health (slaysHealthAtMost, dropsOnFailedSave on a creature), requires schemaVersion 2 and capabilityApi 1.678 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(677) as never, withGlare), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(678) as never, withGlare), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(677) as never, document()), gate);
  }

  console.log("Creature slaying: held to a health, and a failed save dropping to no health; gated at 1.678.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
