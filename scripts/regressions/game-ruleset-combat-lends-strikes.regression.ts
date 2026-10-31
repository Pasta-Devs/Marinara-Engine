/**
 * An attack given up for one by a called creature (Capability API 1.488).
 *
 *   - Pact of the Chain: the warlock gives up their attack for the familiar to strike with its
 *     reaction, though it may not otherwise harm; at whom the familiar can reach, not the warlock.
 *     The attack action and the familiar's reaction are spent, and it is offered no more.
 *   - Out of a strike in hand; not offered without the pact, with the reaction spent, or for an
 *     ally's familiar.
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
  rulesetOptionTargets,
  supportedCapabilityApi,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-lends-strikes-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 488);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const document = (lends: Record<string, unknown> = { budget: "reaction" }): Record<string, any> => {
    const doc = JSON.parse(fiveEText);
    doc.sheet.live.conditions.push({ id: "chain", label: "Pact of the Chain" }, { id: "meek", label: "Familiar" });
    doc.combat.conditions.push(
      { condition: "chain", effects: [], lendsStrikes: lends },
      { condition: "meek", effects: ["cannot-harm"] },
    );
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
  const definition = parsed(document());
  const block = (name: string, reach = 5): RulesetStatBlock =>
    ({
      health: 30,
      defense: 5,
      initiativeModifier: 0,
      speed: 30,
      actions: [{ id: "strike", name, budget: "action", reach, toHit: 20, damage: { flat: 3 } }],
    }) as unknown as RulesetStatBlock;
  const fight = (pact = true): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        { id: "hero", name: "Hero", side: "party", block: block("Sword") },
        { id: "owl", name: "Owl", side: "party", block: block("Talons") },
        { id: "cat", name: "Cat", side: "party", block: block("Claws") },
        { id: "goblin", name: "Goblin", side: "enemy", block: block("Scimitar") },
      ],
      board: {
        grid: { width: 12, height: 3, tiles: Array.from({ length: 3 }, () => Array(12).fill("plains")) },
        placements: { hero: { x: 0, y: 1 }, owl: { x: 8, y: 1 }, cat: { x: 10, y: 0 }, goblin: { x: 9, y: 1 } },
      },
    });
    state.order = ["hero", "owl", "cat", "goblin"];
    state.turn = 0;
    const who = (id: string) => rulesetCombatant(state, id)!;
    who("owl").calledBy = "hero";
    who("cat").calledBy = "goblin-friend";
    for (const id of ["owl", "cat"]) who(id).tracked.push({ condition: "meek", rounds: null });
    if (pact) who("hero").tracked.push({ condition: "chain", rounds: null });
    return state;
  };
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const lent = (state: RulesetEncounterState) =>
    rulesetCombatOptions(definition, state, "hero").filter((one) => one.lend);

  // ── The familiar may not harm on its own ──
  {
    const state = fight();
    state.turn = 1;
    assert.equal(
      rulesetCombatOptions(definition, state, "owl").some((one) => one.label === "Talons"),
      false,
      "cannot-harm",
    );
  }

  // ── Given up for the familiar's: at whom the owl reaches, on the owl's reaction ──
  {
    const state = fight();
    const [give, ...more] = lent(state);
    assert.ok(give, "offered");
    assert.equal(more.length, 0, "the cat is not the hero's");
    assert.equal(give.label, "Owl: Talons");
    assert.deepEqual(rulesetOptionTargets(definition, state, "hero", give), ["goblin"], "the owl's reach");
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "hero", optionId: give.id, targetIds: ["goblin"] },
      () => 10,
    );
    assert.deepEqual(of(step.events, "refused"), []);
    assert.deepEqual(
      of(step.events, "lent").map((one) => [one.actorId, one.calledId, one.label]),
      [["hero", "owl", "Talons"]],
    );
    const attack = of(step.events, "attack")[0]!;
    assert.equal(attack.actorId, "owl");
    assert.ok((rulesetCombatant(step.state, "goblin")!.health?.value ?? 30) < 30, "it hit");
    assert.equal(rulesetCombatant(step.state, "hero")!.budgets.action, 0, "the attack action is spent");
    assert.equal(rulesetCombatant(step.state, "owl")!.budgets.reaction, 0, "and the owl's reaction");
    assert.deepEqual(lent(step.state), [], "nothing more to give");
  }

  // ── Out of a strike in hand: the action stays as it was ──
  {
    const state = fight();
    const hero = rulesetCombatant(state, "hero")!;
    hero.budgets.action = 0;
    hero.strikesLeft = 1;
    const give = lent(state)[0]!;
    assert.ok(give);
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "hero", optionId: give.id, targetIds: ["goblin"] },
      () => 10,
    );
    assert.equal(rulesetCombatant(step.state, "hero")!.strikesLeft, undefined, "the strike is spent");
  }

  // ── Not offered ──
  assert.deepEqual(lent(fight(false)), [], "without the pact");
  {
    const state = fight();
    rulesetCombatant(state, "owl")!.budgets.reaction = 0;
    assert.deepEqual(lent(state), [], "with the owl's reaction spent");
    const spent = fight();
    rulesetCombatant(spent, "hero")!.budgets.action = 0;
    assert.deepEqual(lent(spent), [], "with no attack left to give");
  }

  // ── Refusals ──
  refused(document({ budget: "favour" }), /Unknown budget "favour"/);

  // ── The install gate ──
  {
    const gate =
      "A ruleset whose conditions let an attack be given up for one by a called creature (lendsStrikes) requires schemaVersion 2 and capabilityApi 1.488 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(487) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(488) as never, document()), gate);
  }

  console.log(
    "Lends strikes: Pact of the Chain gives up an attack for the familiar's, past its can't-harm, at whom it reaches, on its reaction; out of a strike in hand; not without the pact, a reaction or an attack, nor for another's familiar; gated at 1.488.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
