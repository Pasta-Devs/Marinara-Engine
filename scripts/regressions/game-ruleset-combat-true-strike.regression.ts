/**
 * Advantage for whoever put a condition on, spent by their attack (Capability API 1.502).
 *
 *   - `fromSource` on an attacks-taken mode: only its source's attacks at the holder roll twice.
 *   - `endsAfter: "attacked-by-source"`: another's attack leaves it on, its source's takes it off.
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
  rulesetAttackMode,
  rulesetCombatant,
  supportedCapabilityApi,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-true-strike-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 502);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const struck = { to: "attacks-taken", mode: "advantage", fromSource: true };
  const fiveE = (modifier: Record<string, unknown> = struck): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.live.conditions.push({ id: "true_struck", label: "True Strike" });
    doc.combat.conditions.push({ condition: "true_struck", effects: [], modifiers: [modifier] });
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
  const definition = parsed(fiveE());
  const block = (): RulesetStatBlock =>
    ({
      health: 60,
      defense: 30,
      initiativeModifier: 0,
      speed: 30,
      actions: [
        { id: "stab", name: "Stab", budget: "action", toHit: 4, damage: { count: 1, sides: 4, flat: 0 }, reach: 5 },
      ],
    }) as unknown as RulesetStatBlock;
  const fight = (turn: number): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        { id: "caster", name: "Caster", side: "party", block: block() },
        { id: "friend", name: "Friend", side: "party", block: block() },
        { id: "ogre", name: "Ogre", side: "enemy", block: block() },
      ],
      board: {
        grid: { width: 5, height: 3, tiles: Array.from({ length: 3 }, () => Array(5).fill("plains")) } as never,
        placements: { caster: { x: 1, y: 1 }, friend: { x: 3, y: 1 }, ogre: { x: 2, y: 1 } },
      },
    });
    state.order = ["caster", "friend", "ogre"];
    state.turn = turn;
    rulesetCombatant(state, "ogre")!.tracked.push({
      condition: "true_struck",
      rounds: 1,
      source: "caster",
      endsAfter: "attacked-by-source",
    });
    return state;
  };
  const who = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)!;
  const mode = (state: RulesetEncounterState, from: string) =>
    rulesetAttackMode(definition, definition.combat!, who(state, from), who(state, "ogre"), {
      state,
      optionId: "stab",
    });
  const strike = (state: RulesetEncounterState, from: string) =>
    applyRulesetCombatChoice(definition, state, { actorId: from, optionId: "stab", targetIds: ["ogre"] }, () => 5);
  const holds = (state: RulesetEncounterState) =>
    who(state, "ogre").tracked.some((one) => one.condition === "true_struck");

  // ── Only its source rolls twice ──
  {
    const state = fight(0);
    assert.equal(mode(state, "caster"), "advantage");
    assert.equal(mode(state, "friend"), "normal");
  }

  // ── Another's attack leaves it on; its source's takes it off ──
  {
    const byFriend = strike(fight(1), "friend");
    const attack = byFriend.events.find(
      (one): one is Extract<RulesetCombatEvent, { type: "attack" }> => one.type === "attack",
    )!;
    assert.equal(attack.mode, "normal", JSON.stringify(byFriend.events));
    assert.ok(holds(byFriend.state), "the friend's attack does not spend it");
    const byCaster = strike(fight(0), "caster");
    const own = byCaster.events.find(
      (one): one is Extract<RulesetCombatEvent, { type: "attack" }> => one.type === "attack",
    )!;
    assert.equal(own.mode, "advantage");
    assert.ok(!holds(byCaster.state), "the caster's spends it, hit or miss");
  }

  // ── Refusals ──
  refused(fiveE({ to: "attacks-taken", flat: 2, fromSource: true }), /fromSource/);
  refused(fiveE({ to: "attacks", mode: "advantage", fromSource: true }), /fromSource/);
  {
    const doc = fiveE();
    doc.catalogs[0].entries[0].mechanics = {
      kind: "debuff",
      applies: [{ condition: "true_struck", duration: { rounds: 1 }, endsAfter: "attacked-by-anyone" }],
    };
    refused(doc, /endsAfter/);
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset whose conditions answer only their source's attacks (endsAfter attacked-by-source, fromSource on attacks-taken) requires schemaVersion 2 and capabilityApi 1.502 or newer";
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
    const only = JSON.parse(fiveEText) as Record<string, any>;
    only.combat.conditions[0].modifiers = [struck];
    assert.equal(getCapabilityPackageInstallIssue(manifest(501) as never, only), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(502) as never, only), gate);
    assert.equal(
      getCapabilityPackageInstallIssue(
        manifest(501) as never,
        JSON.parse(fiveEText),
        new Map([
          ["catalogs/spells.json", { entries: [{ mechanics: { applies: [{ endsAfter: "attacked-by-source" }] } }] }],
        ]),
      ),
      gate,
    );
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(501) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "True Strike: only the condition's source attacks its holder with advantage, and only its attack spends it; gated at 1.502.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
