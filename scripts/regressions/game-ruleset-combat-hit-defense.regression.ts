/**
 * Defense against an attacker that has hit, and opportunity attacks only (Capability API 1.430).
 *
 *   - Multiattack Defense: after a creature hits the ranger, its later attacks that turn meet 4 more
 *     defense; another creature's do not, and the next turn it is gone.
 *   - Escape the Horde: an opportunity attack at the ranger is made with disadvantage, a claw on the
 *     foe's own turn is not.
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
  rulesetWindowOptions,
  RULESET_PASS_OPTION,
  supportedCapabilityApi,
  type RulesetCombatChoice,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";
import type { TacticalGrid } from "../../packages/shared/src/features/tactical-combat/types.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-hit-defense-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 430);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.derived.push({ id: "ranger_level", label: "Ranger level", op: "sum", of: [{ field: "level" }] });
    doc.combat.levels = [
      ...(doc.combat.levels ?? []),
      {
        derived: "ranger_level",
        at: 7,
        modifiers: [
          { to: "defense", flat: 4, afterHitBy: true },
          { to: "attacks-taken", mode: "disadvantage", opportunity: true },
        ],
      },
    ];
    edit(doc);
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
      health: 200,
      defense: 10,
      initiativeModifier: 0,
      speed: 30,
      actions: [
        { id: "claw", name: "Claw", budget: "action", toHit: 6, reach: 5, damage: { count: 0, sides: 0, flat: 1 } },
      ],
    }) as unknown as RulesetStatBlock;
  const grid = (): TacticalGrid => ({
    width: 20,
    height: 12,
    tiles: Array.from({ length: 12 }, () => Array(20).fill("plains")),
  });
  // A d20 of 10: a claw comes to 16 against the ranger's 15.
  const roll = (sides: number) => (sides === 20 ? 10 : 3);
  const fight = (level = 7): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: roll,
      combatants: [
        {
          id: "ranger",
          name: "Ranger",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 14, dex: 14, con: 14, int: 8, wis: 14, cha: 8 },
            fields: { level, ac: 15, speed: 30, hp_max: 200 },
          }),
          live: {},
        },
        { id: "foe", name: "Foe", side: "enemy", block: block() },
        { id: "other", name: "Other", side: "enemy", block: block() },
      ],
      board: {
        grid: grid(),
        placements: { ranger: { x: 5, y: 5 }, foe: { x: 6, y: 5 }, other: { x: 5, y: 6 } },
      },
    });
    state.order = state.combatants.map((one) => one.id);
    return state;
  };
  const who = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)!;
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const act = (state: RulesetEncounterState, actorId: string, label: string, choice: Partial<RulesetCombatChoice>) => {
    state.turn = state.order.indexOf(actorId);
    who(state, actorId).budgets.action = 1;
    const option = rulesetCombatOptions(definition, state, actorId).find((one) => one.label === label);
    assert.ok(option, `${actorId} can ${label}`);
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId, optionId: option.id, targetIds: [], ...choice },
      roll,
    );
    assert.equal(of(step.events, "refused").length, 0, JSON.stringify(of(step.events, "refused")));
    return step;
  };
  let current: RulesetEncounterState;
  const claw = (actorId = "foe") => {
    const step = act(current, actorId, "Claw", { targetIds: ["ranger"] });
    current = step.state;
    return of(step.events, "attack")[0]!;
  };

  // ── Multiattack Defense ──
  {
    current = fight();
    const first = claw();
    assert.deepEqual([first.defense, first.outcome], [15, "hit"]);
    const second = claw();
    assert.deepEqual([second.defense, second.outcome], [19, "miss"], "4 more against the one that hit");
    // Another creature, in its own turn, meets the ranger's own 15.
    assert.equal(claw("other").defense, 15, "not against another");
    // The foe's next turn: gone.
    current.round += 1;
    assert.equal(claw().defense, 15, "for the rest of the turn only");
    // Not before 7th level.
    current = fight(6);
    claw();
    assert.equal(claw().defense, 15);
  }

  // ── Escape the Horde ──
  {
    current = fight();
    assert.equal(claw().mode, "normal", "a claw on the foe's own turn");
    const walk = (level: number) => {
      const walking = fight(level);
      walking.turn = 0;
      const move = rulesetCombatOptions(definition, walking, "ranger").find((one) => one.label === "Move");
      assert.ok(move);
      let step = applyRulesetCombatChoice(
        definition,
        walking,
        { actorId: "ranger", optionId: move.id, targetIds: [], to: { x: 2, y: 5 } },
        roll,
      );
      const events = [...step.events];
      // Each foe it walks away from takes the strike it is offered.
      for (let guard = 0; step.state.window && guard < 10; guard++) {
        const window = step.state.window;
        const asking = window.waiting[0]!;
        const option = rulesetWindowOptions(definition, step.state, asking)[0];
        step = applyRulesetCombatChoice(
          definition,
          step.state,
          { actorId: asking, optionId: option?.id ?? RULESET_PASS_OPTION, targetIds: [], window: window.id },
          roll,
        );
        events.push(...step.events);
      }
      assert.equal(step.state.window, undefined);
      const strikes = of(events, "attack").filter((one) => one.targetId === "ranger");
      assert.ok(strikes.length >= 1, JSON.stringify(events.map((one) => one.type)));
      return strikes;
    };
    const strikes = walk(7);
    for (const strike of strikes) assert.equal(strike.mode, "disadvantage", "an opportunity attack");
    for (const strike of walk(6)) assert.equal(strike.mode, "normal", "not before 7th level");
  }

  // ── Refusals ──
  {
    const level = (modifier: Record<string, unknown>) =>
      fiveE((doc) => {
        doc.combat.levels.at(-1).modifiers = [modifier];
      });
    refused(level({ to: "attacks", flat: 4, afterHitBy: true }), /"afterHitBy" narrows defense/);
    refused(level({ to: "attacks", mode: "disadvantage", opportunity: true }), /"opportunity" narrows attacks-taken/);
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset whose defense changes count only against an attacker that has hit already (afterHitBy) or whose attacks-taken changes count only on opportunity attacks (opportunity) requires schemaVersion 2 and capabilityApi 1.430 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(429) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(430) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(429) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "Hit defense: Multiattack Defense adds 4 against a creature that hit already this turn, not another, gone the next turn; Escape the Horde gives opportunity attacks disadvantage, not a claw on the foe's turn; gated at 1.430.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
