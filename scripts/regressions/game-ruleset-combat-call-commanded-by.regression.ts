/**
 * A creature's call commanded through one of its caller's own actions, ending as its caller is
 * incapacitated (Capability API 1.736): a chain devil's Animate Chains, which attack "when the devil
 * uses Multiattack on its turn".
 *
 *   - The chains come right after the devil and pass their turns until it makes its Multiattack.
 *   - They leave once the devil is incapacitated.
 *   - Refused with an action the creature lacks, or with `commandedWith` too; the install gate.
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
  type RulesetCombatChoice,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-call-commanded-by-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 736);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const calls = (more: Record<string, unknown> = {}) => ({
    creature: "creatures/animated-chain",
    count: { flat: 1 },
    initiative: "after",
    commandedBy: { action: "multiattack" },
    endsWithCaller: "incapacitated",
    ...more,
  });
  const fiveE = (callsWith: Record<string, unknown> = calls()): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    const creatures = doc.catalogs.find((one: { id: string }) => one.id === "creatures");
    creatures.entries[0].creature.actions.push(
      {
        id: "multiattack",
        name: "Multiattack",
        budget: "action",
        toHit: 8,
        damage: { dice: "2d6", flat: 4, type: "slashing" },
        reach: 10,
      },
      { id: "animate_chains", name: "Animate Chains", budget: "bonus", calls: callsWith },
    );
    creatures.entries.push({
      id: "animated-chain",
      label: "Animated Chain",
      creature: {
        health: 20,
        defense: 20,
        tier: "cr_1_2",
        initiativeModifier: 0,
        speed: 30,
        actions: [
          {
            id: "lash",
            name: "Lash",
            budget: "action",
            toHit: 8,
            damage: { dice: "2d6", flat: 4, type: "slashing" },
            reach: 10,
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
  const devil = rulesetStatBlockFromCreature(definition, creature)!;

  let state: RulesetEncounterState = createRulesetEncounter({
    definition,
    seed: 1,
    roller: () => 10,
    combatants: [
      { id: "devil", name: "Chain Devil", side: "enemy", block: { ...devil, health: 200 } },
      {
        id: "hero",
        name: "Hero",
        side: "party",
        block: {
          health: 500,
          defense: 10,
          initiativeModifier: 0,
          speed: 30,
          actions: [
            {
              id: "stun",
              name: "Stunning Blow",
              budget: "action",
              autoHit: true,
              damage: { count: 0, sides: 0, flat: 1 },
              applies: [{ condition: "incapacitated", duration: { rounds: 1 } }],
              reach: 5,
            },
          ],
        } as unknown as RulesetStatBlock,
      },
    ],
    board: {
      grid: { width: 12, height: 8, tiles: Array.from({ length: 8 }, () => Array(12).fill("plains")) },
      placements: { devil: { x: 2, y: 3 }, hero: { x: 3, y: 3 } },
    },
  } as never);
  state.order = ["devil", "hero"];
  state.turn = 0;
  const step = (choice: RulesetCombatChoice) => {
    const result = applyRulesetCombatChoice(definition, state, choice, () => 10);
    assert.deepEqual(of(result.events, "refused"), [], JSON.stringify(result.events));
    state = result.state;
    return result.events;
  };

  // ── The chains come right after the devil, commanded through its Multiattack ──
  const ids = of(step({ actorId: "devil", optionId: "animate_chains", targetIds: [] }), "called").flatMap(
    (one) => one.ids,
  );
  assert.equal(ids.length, 1);
  const chainId = ids[0]!;
  assert.deepEqual(rulesetCombatant(state, chainId)!.calledCommand, { action: "multiattack" });
  assert.deepEqual(state.order, ["devil", chainId, "hero"]);

  // ── Without a Multiattack, their turn passes ──
  {
    const events = step({ actorId: "devil", optionId: "end-turn" });
    assert.deepEqual(of(events, "skip"), [{ type: "skip", actorId: chainId, reason: "uncommanded" }]);
    assert.equal(state.order[state.turn], "hero");
    step({ actorId: "hero", optionId: "end-turn" });
  }

  // ── With it, they act ──
  {
    assert.equal(state.order[state.turn], "devil");
    step({ actorId: "devil", optionId: "multiattack", targetIds: ["hero"] });
    const events = step({ actorId: "devil", optionId: "end-turn" });
    assert.deepEqual(of(events, "skip"), [], JSON.stringify(events));
    assert.equal(state.order[state.turn], chainId);
    step({ actorId: chainId, optionId: "end-turn" });
  }

  // ── And the next round without it, they pass again ──
  {
    step({ actorId: "hero", optionId: "end-turn" });
    const events = step({ actorId: "devil", optionId: "end-turn" });
    assert.deepEqual(of(events, "skip"), [{ type: "skip", actorId: chainId, reason: "uncommanded" }]);
  }

  // ── The devil incapacitated, the chains leave ──
  {
    assert.equal(state.order[state.turn], "hero");
    const events = step({ actorId: "hero", optionId: "stun", targetIds: ["devil"] });
    assert.ok(
      of(events, "sentAway").some((one) => one.reason === "caller" && one.ids.includes(chainId)),
      JSON.stringify(events),
    );
    assert.ok(rulesetCombatant(state, chainId)!.dismissed);
  }

  // ── Refusals ──
  refused(fiveE(calls({ commandedBy: { action: "nap" } })), /No action "nap" of this creature's/);
  refused(fiveE(calls({ commandedWith: "bonus" })), /Commanded through an action or on a budget, not both/);

  // ── The install gate ──
  {
    const gate =
      "A ruleset with a creature's call commanded through one of its caller's actions or ending as its caller is incapacitated (calls.commandedBy, or calls.endsWithCaller \"incapacitated\" on a creature) requires schemaVersion 2 and capabilityApi 1.736 or newer";
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
    const incapacitatedOnly = fiveE(calls({ commandedBy: undefined }));
    const plain = fiveE(calls({ commandedBy: undefined, endsWithCaller: true }));
    assert.equal(getCapabilityPackageInstallIssue(manifest(735) as never, fiveE()), gate);
    assert.equal(getCapabilityPackageInstallIssue(manifest(735) as never, incapacitatedOnly), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(736) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(735) as never, plain), gate);
  }

  console.log(
    "Call commanded by: a chain devil's chains pass their turns until its Multiattack and leave as it is incapacitated; gated at 1.736.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
