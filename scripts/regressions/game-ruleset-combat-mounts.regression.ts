/**
 * Mounted combat (Capability API 1.496).
 *
 *   - Mounting a willing creature of its side beside it, a size larger, for half its speed; the rider
 *     goes where the mount walks and walks no way of its own; getting down costs half its speed.
 *   - A controlled mount takes its turn straight after its rider's, moving and taking only Dash,
 *     Disengage and Dodge; one that already had its turn this round waits; `mountIndependent` acts as
 *     it will.
 *   - A mount knocked prone throws its rider unless they make the save; a mount that drops parts them.
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
  RULESET_DISMOUNT_OPTION,
  RULESET_MOUNT_OPTION_PREFIX,
  RULESET_MOVE_OPTION,
  rulesetCombatant,
  rulesetCombatOptions,
  supportedCapabilityApi,
  type RulesetCombatChoice,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-mounts-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 496);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const mounts = {
    larger: 1,
    controlled: { standard: ["dash", "disengage", "dodge"] },
    fall: { save: "dex_save", difficulty: 10, applies: "prone", when: ["prone"] },
  };
  const fiveE = (rule: Record<string, unknown> | null = mounts): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.combat.sizes = {
      order: [
        { id: "small", label: "Small" },
        { id: "medium", label: "Medium" },
        { id: "large", label: "Large" },
      ],
      default: "medium",
    };
    if (rule) doc.combat.mounts = rule;
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
  const block = (size: string, speed: number, extra: Record<string, unknown> = {}): RulesetStatBlock =>
    ({
      health: 30,
      defense: 10,
      initiativeModifier: 0,
      speed,
      size,
      saves: { dex_save: 0 },
      actions: [
        { id: "kick", name: "Kick", budget: "action", toHit: 5, reach: 5, damage: { count: 0, sides: 0, flat: 3 } },
      ],
      ...extra,
    }) as unknown as RulesetStatBlock;
  let d20 = 15;
  const roll = (sides: number) => (sides === 20 ? d20 : 1);
  const fight = (
    use: RulesetDefinition = definition,
    horse: Record<string, unknown> = {},
    order = ["knight", "horse", "goblin"],
  ): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition: use,
      seed: 1,
      roller: roll,
      combatants: [
        { id: "knight", name: "Knight", side: "party", block: block("medium", 30) },
        { id: "horse", name: "Horse", side: "party", block: block("large", 60, horse) },
        { id: "pony", name: "Pony", side: "party", block: block("medium", 40) },
        { id: "goblin", name: "Goblin", side: "enemy", block: block("small", 30) },
      ],
      board: {
        grid: { width: 14, height: 3, tiles: Array.from({ length: 3 }, () => Array(14).fill("plains")) } as never,
        placements: { knight: { x: 1, y: 1 }, horse: { x: 2, y: 1 }, pony: { x: 1, y: 0 }, goblin: { x: 12, y: 1 } },
      },
    });
    state.order = [...order, "pony"];
    state.turn = 0;
    return state;
  };
  const who = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)!;
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const step = (state: RulesetEncounterState, choice: Partial<RulesetCombatChoice> & { actorId: string }) => {
    state.turn = state.order.indexOf(choice.actorId);
    const taken = applyRulesetCombatChoice(definition, state, { optionId: "end-turn", targetIds: [], ...choice }, roll);
    assert.deepEqual(of(taken.events, "refused"), [], JSON.stringify(of(taken.events, "refused")));
    return taken;
  };
  const ids = (state: RulesetEncounterState, id: string) =>
    rulesetCombatOptions(definition, state, id).map((one) => one.id);
  const mountId = `${RULESET_MOUNT_OPTION_PREFIX}horse`;

  // ── Mounting: a larger creature of their side, not one their own size ──
  let mounted: RulesetEncounterState;
  {
    const state = fight();
    const offered = ids(state, "knight");
    assert.ok(offered.includes(mountId), offered.join(", "));
    assert.ok(!offered.includes(`${RULESET_MOUNT_OPTION_PREFIX}pony`), "the pony is no larger");
    const taken = step(state, { actorId: "knight", optionId: mountId });
    mounted = taken.state;
    assert.deepEqual(of(taken.events, "mount"), [{ type: "mount", riderId: "knight", mountId: "horse" }]);
    assert.equal(who(mounted, "knight").mountedOn, "horse");
    assert.deepEqual([who(mounted, "knight").x, who(mounted, "knight").y], [2, 1], "up on the horse");
    assert.equal(who(mounted, "knight").movementLeft, 3, "half of six cells");
    // Riding, they walk no way of their own: only getting down.
    const now = ids(mounted, "knight");
    assert.ok(!now.includes(RULESET_MOVE_OPTION) && now.includes(RULESET_DISMOUNT_OPTION), now.join(", "));
    assert.deepEqual(mounted.order.slice(0, 2), ["knight", "horse"]);
  }

  // ── The controlled horse: moves, dashes, and carries its rider; no kicking ──
  {
    mounted.turn = mounted.order.indexOf("horse");
    who(mounted, "horse").movementLeft = 12;
    who(mounted, "horse").movement = 12;
    const horse = ids(mounted, "horse");
    assert.ok(horse.includes(RULESET_MOVE_OPTION), horse.join(", "));
    assert.ok(horse.includes("standard:dash") && horse.includes("standard:dodge"), horse.join(", "));
    assert.ok(!horse.includes("kick") && !horse.includes("standard:help"), horse.join(", "));
    const rode = step(mounted, { actorId: "horse", optionId: RULESET_MOVE_OPTION, to: { x: 8, y: 1 } });
    assert.deepEqual([who(rode.state, "knight").x, who(rode.state, "knight").y], [8, 1], "the rider comes along");
    // Getting down beside it, for half their speed.
    const knight = who(rode.state, "knight");
    knight.movementLeft = 6;
    const down = step(rode.state, { actorId: "knight", optionId: RULESET_DISMOUNT_OPTION });
    assert.equal(who(down.state, "knight").mountedOn, undefined);
    assert.equal(who(down.state, "horse").riddenBy, undefined);
    assert.equal(who(down.state, "knight").movementLeft, 3);
    assert.ok(Math.abs(who(down.state, "knight").x! - 8) <= 2, "set down beside the horse");
  }

  // ── Mounted after its own turn this round, it waits for the next ──
  {
    const state = fight(definition, {}, ["horse", "knight", "goblin"]);
    const taken = step(state, { actorId: "knight", optionId: mountId });
    assert.deepEqual(taken.state.order.slice(0, 2), ["knight", "horse"]);
    assert.equal(who(taken.state, "horse").mountWaits, taken.state.round);
    taken.state.turn = 1;
    assert.deepEqual(ids(taken.state, "horse"), ["end-turn"]);
  }

  // ── An intelligent mount acts as it will ──
  {
    const state = fight(definition, { mountIndependent: true });
    const taken = step(state, { actorId: "knight", optionId: mountId });
    assert.equal(who(taken.state, "horse").mountControlled, undefined);
    taken.state.turn = 1;
    assert.ok(ids(taken.state, "horse").includes("kick"), ids(taken.state, "horse").join(", "));
    assert.deepEqual(taken.state.order.slice(0, 2), ["knight", "horse"], "its turn stays its own");
  }

  // ── Knocked prone, the horse throws its rider unless they make the save ──
  {
    d20 = 5;
    const state = structuredClone(mounted);
    who(state, "horse").tracked.push({ condition: "prone", rounds: null });
    const thrown = step(state, { actorId: "goblin" });
    assert.equal(who(thrown.state, "knight").mountedOn, undefined);
    assert.deepEqual(
      of(thrown.events, "mount").map((one) => [one.off, one.fell]),
      [[true, true]],
    );
    assert.ok(
      who(thrown.state, "knight").tracked.some((one) => one.condition === "prone"),
      "lands prone",
    );
    d20 = 15;
    const kept = structuredClone(mounted);
    who(kept, "horse").tracked.push({ condition: "prone", rounds: null });
    const landed = step(kept, { actorId: "goblin" });
    assert.equal(who(landed.state, "knight").mountedOn, undefined, "down off a fallen horse");
    assert.ok(!who(landed.state, "knight").tracked.some((one) => one.condition === "prone"), "on their feet");
  }

  // ── A mount that drops parts them ──
  {
    const state = structuredClone(mounted);
    who(state, "horse").health!.value = 1;
    who(state, "goblin").x = 3;
    who(state, "goblin").y = 0;
    const dropped = step(state, { actorId: "goblin", optionId: "kick", targetIds: ["horse"] });
    assert.ok(who(dropped.state, "horse").down || who(dropped.state, "horse").defeated);
    assert.equal(who(dropped.state, "knight").mountedOn, undefined);
  }

  // ── Refusals ──
  refused(fiveE({ larger: 0 }), /larger/);
  refused(fiveE({ larger: 1, controlled: { standard: ["fly"] } }), /standard/);

  // ── The install gate ──
  {
    const gate =
      "A ruleset whose combatants ride one another (combat mounts, mountIndependent) requires schemaVersion 2 and capabilityApi 1.496 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(495) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(496) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(495) as never, fiveE(null)), gate);
  }

  console.log(
    "Mounts: a knight mounts a larger horse for half their speed and rides where it walks; a controlled horse moves after its rider, dashing or dodging only; one that already acted waits; an intelligent one acts as it will; knocked prone it throws its rider unless they save; gated at 1.496.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
