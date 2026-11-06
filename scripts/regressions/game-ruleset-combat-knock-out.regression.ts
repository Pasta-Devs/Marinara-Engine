/**
 * Knocking out (Capability API 1.720): 5e's knocking a creature out with a melee attack.
 *
 *   - `dying.knockOut`: a character's free switch, once a turn, to pull their blows.
 *   - While on, a melee blow that drops somebody knocks them out: stable and alive, never dying or
 *     slain; a character in the rule's condition too; an opponent out of the fight, marked in the
 *     summary and the Game Master's recap.
 *   - A ranged blow, or one not pulled, drops them as always; massive damage still kills.
 *   - The log line, import refusals and the install gate.
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
  rulesetCombatConditions,
  rulesetCombatOptions,
  rulesetEncounterSummary,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-knock-out-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 720);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}) => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.combat.dying.knockOut = { blow: "melee", condition: "unconscious" };
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
  // Every d20 a 15 (a hit, never a critical one), every other die a 3.
  const roll = (sides: number) => (sides === 20 ? 15 : 3);
  const brute = (bonus: number, health = 60): RulesetStatBlock =>
    ({
      health,
      defense: 12,
      initiativeModifier: 0,
      speed: 30,
      actions: [
        { id: "club", name: "Club", budget: "action", toHit: 6, damage: { count: 1, sides: 6, flat: bonus }, reach: 5 },
        {
          id: "sling",
          name: "Sling",
          budget: "action",
          toHit: 6,
          damage: { count: 1, sides: 6, flat: bonus },
          range: 30,
        },
      ],
    }) as unknown as RulesetStatBlock;
  const fight = (definition: RulesetDefinition) => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: roll,
      combatants: [
        {
          id: "hero",
          name: "Hero",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
            fields: { level: 3, ac: 12, speed: 30, hp_max: 20 },
          }),
          live: { pools: { hp: { value: 20 } } },
        },
        // Somebody still standing, so the fight goes on while the hero is down.
        { id: "squire", name: "Squire", side: "party", block: brute(30) },
        { id: "thug", name: "Thug", side: "enemy", block: brute(17) },
        { id: "bandit", name: "Bandit", side: "enemy", block: brute(0, 5) },
        { id: "ogre", name: "Ogre", side: "enemy", block: brute(37) },
      ],
    });
    state.order = ["hero", "squire", "thug", "bandit", "ogre"];
    return state;
  };
  const who = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)!;
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const hit = (
    definition: RulesetDefinition,
    state: RulesetEncounterState,
    by: string,
    target: string,
    label = "Club",
  ) => {
    state.turn = state.order.indexOf(by);
    who(state, by).budgets.action = 1;
    const option = rulesetCombatOptions(definition, state, by).find((one) => one.label === label);
    assert.ok(option, `no ${label} for ${by}`);
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: by, optionId: option.id, targetIds: [target] },
      roll,
    );
    assert.deepEqual(of(step.events, "refused"), [], JSON.stringify(step.events));
    return step;
  };
  const definition = parsed(fiveE());

  // ── The switch: free, once a turn, on and off ──
  {
    const state = fight(definition);
    state.turn = 0;
    const knock = rulesetCombatOptions(definition, state, "hero").find((one) => one.label === "Knock out");
    assert.ok(knock, "the hero may pull their blows");
    assert.equal(knock.budget, undefined, "for nothing");
    assert.equal(knock.on, false, "off until it is turned on, so the menu offers to turn it on");
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "hero", optionId: knock.id, targetIds: [] },
      roll,
    );
    assert.deepEqual(
      of(step.events, "switch").map((one) => one.on),
      [true],
    );
    assert.equal(who(step.state, "hero").knocksOut, true);
    const next = structuredClone(step.state);
    who(next, "hero").flags.knockOutSwitched = undefined;
    assert.equal(
      rulesetCombatOptions(definition, next, "hero").find((one) => one.label === "Knock out")?.on,
      true,
      "and on once it is",
    );
    // Switched back once the same turn, so a misclick is undone; then not again until next turn.
    const back = rulesetCombatOptions(definition, step.state, "hero").find((one) => one.label === "Knock out");
    assert.equal(back?.on, true, "offered again the same turn, to turn it back off");
    const undone = applyRulesetCombatChoice(
      definition,
      step.state,
      { actorId: "hero", optionId: back!.id, targetIds: [] },
      roll,
    );
    assert.equal(who(undone.state, "hero").knocksOut, undefined, "off again");
    assert.ok(
      !rulesetCombatOptions(definition, undone.state, "hero").some((one) => one.label === "Knock out"),
      "once a turn, and once back",
    );
    assert.ok(
      !rulesetCombatOptions(parsed(JSON.parse(fiveEText)), fight(parsed(JSON.parse(fiveEText))), "hero").some(
        (one) => one.label === "Knock out",
      ),
      "only where the ruleset has it",
    );
  }

  // ── A pulled melee blow knocks a character out: stable, unconscious, not dying ──
  {
    const state = fight(definition);
    who(state, "thug").knocksOut = true;
    const step = hit(definition, state, "thug", "hero");
    assert.deepEqual(of(step.events, "knockedOut"), [{ type: "knockedOut", actorId: "hero", sourceId: "thug" }]);
    const hero = who(step.state, "hero");
    assert.equal(hero.down, true);
    assert.equal(hero.stable, true);
    assert.ok(!hero.dying && !hero.defeated);
    assert.ok(rulesetCombatConditions(definition, hero).includes("unconscious"));
    // Not pulled, or ranged: dying as always.
    const plain = hit(definition, fight(definition), "thug", "hero");
    assert.deepEqual(of(plain.events, "knockedOut"), []);
    assert.equal(who(plain.state, "hero").dying, true);
    const ranged = fight(definition);
    who(ranged, "thug").knocksOut = true;
    const shot = hit(definition, ranged, "thug", "hero", "Sling");
    assert.deepEqual(of(shot.events, "knockedOut"), []);
    assert.equal(who(shot.state, "hero").dying, true);
  }

  // ── An opponent knocked out is beaten alive, and the summary says so ──
  {
    const state = fight(definition);
    who(state, "squire").knocksOut = true;
    const step = hit(definition, state, "squire", "bandit");
    assert.equal(of(step.events, "knockedOut").length, 1);
    assert.deepEqual(of(step.events, "defeated"), []);
    const bandit = who(step.state, "bandit");
    assert.equal(bandit.defeated, true);
    assert.equal(bandit.knockedOut, true);
    assert.ok(rulesetCombatConditions(definition, bandit).includes("unconscious"));
    const summary = rulesetEncounterSummary(definition, step.state);
    assert.equal(summary.enemies.find((one) => one.id === "bandit")!.knockedOut, true);
    assert.equal(summary.enemies.find((one) => one.id === "thug")!.knockedOut, undefined);
    const slain = hit(definition, fight(definition), "squire", "bandit");
    assert.equal(of(slain.events, "defeated").length, 1);
    assert.ok(!who(slain.state, "bandit").knockedOut);
  }

  // ── Massive damage still kills ──
  {
    const massive = parsed(fiveE((doc) => (doc.combat.dying.instantDeath = "overflow-at-least-max")));
    const state = fight(massive);
    who(state, "ogre").knocksOut = true;
    const step = hit(massive, state, "ogre", "hero");
    assert.deepEqual(of(step.events, "knockedOut"), []);
    assert.equal(of(step.events, "massiveDeath").length, 1);
  }

  // ── Refusals and the install gate ──
  {
    refused(
      fiveE((doc) => (doc.combat.dying.knockOut = { blow: "melee", condition: "nowhere" })),
      /Unknown condition "nowhere"/,
    );
    refused(
      fiveE((doc) => (doc.combat.dying.knockOut = { blow: "ranged" })),
      /knockOut/,
    );
    const gate =
      "A ruleset with knocking out by a melee blow (combat.dying.knockOut) requires schemaVersion 2 and capabilityApi 1.720 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(719) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(720) as never, fiveE()), gate);
  }

  console.log(
    "Knocking out: a free switch once a turn; a pulled melee blow leaves the fallen stable and unconscious, an opponent beaten alive; ranged, unpulled and massive blows as always; gated at 1.720.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
