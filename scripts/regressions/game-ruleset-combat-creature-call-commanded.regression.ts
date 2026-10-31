/**
 * A creature's call commanded on a budget, striking with its caller's own attack (Capability API
 * 1.707): a solar's Flying Sword, which attacks "using the solar's own greatsword attack" on its
 * bonus action.
 *
 *   - The sword comes commanded on the bonus action, its attack the solar's greatsword's bonus to hit
 *     and damage.
 *   - Refused with an unknown budget or an action that is not its caller's attack; the install gate.
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
  rulesetStatBlockFromCreature,
  supportedCapabilityApi,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-creature-call-commanded-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 707);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const calls = (more: Record<string, unknown> = {}) => ({
    creature: "creatures/flying-sword",
    count: { flat: 1 },
    commandedWith: "bonus",
    fromCaller: { action: "greatsword" },
    endsWithCaller: true,
    ...more,
  });
  const fiveE = (callsWith: Record<string, unknown> = calls()): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    const creatures = doc.catalogs.find((one: { id: string }) => one.id === "creatures");
    creatures.entries[0].creature.actions.push(
      {
        id: "greatsword",
        name: "Greatsword",
        budget: "action",
        toHit: 15,
        damage: { dice: "4d6", flat: 8, type: "slashing" },
        reach: 5,
      },
      { id: "flying_sword", name: "Flying Sword", budget: "bonus", calls: callsWith },
    );
    creatures.entries.push({
      id: "flying-sword",
      label: "Flying Sword",
      creature: {
        health: { dice: "5d10", flat: 5 },
        defense: 19,
        tier: "cr_1_2",
        initiativeModifier: 0,
        speed: 30,
        actions: [
          {
            id: "slash",
            name: "Slash",
            budget: "action",
            toHit: 1,
            damage: { dice: "1d4", type: "slashing" },
            reach: 5,
          },
        ],
      },
    });
    return doc;
  };
  const parsed = (document: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(document);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const refused = (document: unknown, pattern: RegExp) => {
    const result = parseRulesetDefinition(document);
    assert.equal(result.ok, false, `should be refused: ${pattern}`);
    if (!result.ok) assert.match(result.issues.join("; "), pattern);
  };
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const definition = parsed(fiveE());
  const creature = definition.catalogs!.find((one) => one.id === "creatures")!.entries![0]!.creature!;
  const solar = rulesetStatBlockFromCreature(definition, creature)!;

  // ── The sword comes commanded, striking as the solar's greatsword ──
  {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        { id: "solar", name: "Solar", side: "enemy", block: { ...solar, health: 200 } },
        {
          id: "hero",
          name: "Hero",
          side: "party",
          block: {
            health: 50,
            defense: 10,
            initiativeModifier: 0,
            speed: 30,
            actions: [],
          } as unknown as RulesetStatBlock,
        },
      ],
      board: {
        grid: { width: 12, height: 8, tiles: Array.from({ length: 8 }, () => Array(12).fill("plains")) },
        placements: { solar: { x: 2, y: 3 }, hero: { x: 8, y: 3 } },
      },
    } as never);
    state.order = ["solar", "hero"];
    state.turn = 0;
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "solar", optionId: "flying_sword", targetIds: [] },
      () => 10,
    );
    assert.deepEqual(of(step.events, "refused"), [], JSON.stringify(step.events));
    const ids = of(step.events, "called").flatMap((one) => one.ids);
    assert.equal(ids.length, 1);
    const sword = rulesetCombatant(step.state, ids[0]!)!;
    assert.deepEqual(sword.calledCommand, { budget: "bonus", free: true });
    const slash = sword.actions.find((one) => one.id === "slash")!;
    assert.equal(slash.toHit, 15);
    assert.deepEqual(
      { count: slash.damage!.count, sides: slash.damage!.sides, flat: slash.damage!.flat },
      { count: 4, sides: 6, flat: 8 },
    );
  }

  // ── Refusals ──
  refused(fiveE(calls({ commandedWith: "nap" })), /Unknown budget "nap"/);
  refused(fiveE(calls({ fromCaller: { action: "flying_sword" } })), /"flying_sword" is not one of its attacks/);

  // ── The install gate ──
  {
    const gate =
      "A ruleset with a creature's call commanded on a budget or striking with its caller's attack (calls.commandedWith or calls.fromCaller on a creature) requires schemaVersion 2 and capabilityApi 1.707 or newer";
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
    const plain = fiveE(calls({ commandedWith: undefined, fromCaller: undefined }));
    assert.equal(getCapabilityPackageInstallIssue(manifest(706) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(707) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(706) as never, plain), gate);
  }

  console.log(
    "Creature call commanded: the solar's Flying Sword comes on the bonus action, striking with the greatsword's +15 and 4d6+8; gated at 1.707.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
