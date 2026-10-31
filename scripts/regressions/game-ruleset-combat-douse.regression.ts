/**
 * Ending somebody else's condition with a check (Capability API 1.518).
 *
 *   - A creature on fire, its `checkEnds` open to anybody: a friend next to it spends their action on
 *     the check and puts it out; one further off is offered nothing; its holder still may.
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
  supportedCapabilityApi,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-douse-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 518);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const flask = (checkEnds: Record<string, unknown>) => ({
    id: "flask",
    name: "Flask",
    budget: "action",
    reach: 30,
    toHit: 30,
    damage: { count: 1, sides: 4, flat: 0 },
    applies: [{ condition: "on_fire", duration: "until-dispelled", checkEnds }],
  });
  const douse = { check: "agility", difficulty: 10, by: "any" };
  const document = (): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.live.conditions.push({ id: "on_fire", label: "On Fire" });
    doc.combat.conditions.push({ condition: "on_fire", effects: [] });
    return doc;
  };
  const parsed = (doc: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(doc);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const definition = parsed(document());
  assert.ok(definition.combat!.checks?.some((one) => one.id === "agility"));
  const block = (actions: unknown[] = []): RulesetStatBlock =>
    ({
      health: 40,
      defense: 10,
      initiativeModifier: 0,
      speed: 30,
      checks: { agility: 0 },
      actions,
    }) as unknown as RulesetStatBlock;
  const fight = (): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        { id: "burning", name: "Burning", side: "party", block: block() },
        { id: "friend", name: "Friend", side: "party", block: block() },
        { id: "far", name: "Far", side: "party", block: block() },
        { id: "foe", name: "Foe", side: "enemy", block: block() },
      ],
      board: {
        grid: { width: 12, height: 1, tiles: [Array(12).fill("plains")] } as never,
        placements: { burning: { x: 1, y: 0 }, friend: { x: 2, y: 0 }, far: { x: 6, y: 0 }, foe: { x: 11, y: 0 } },
      },
    });
    state.order = ["friend", "far", "burning", "foe"];
    state.turn = 0;
    rulesetCombatant(state, "burning")!.tracked.push({
      condition: "on_fire",
      rounds: null,
      source: "foe",
      checkEnds: douse as never,
    });
    return state;
  };
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const burning = (state: RulesetEncounterState) =>
    rulesetCombatant(state, "burning")!.tracked.some((one) => one.condition === "on_fire");

  // ── A friend next to it puts it out ──
  {
    const state = fight();
    const option = rulesetCombatOptions(definition, state, "friend").find(
      (one) => one.id === "checkends:burning:on_fire",
    );
    assert.ok(option, "offered to the one next to it");
    assert.equal(option.label, "End On Fire on Burning");
    const doused = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "friend", optionId: option.id, targetIds: [] },
      () => 12,
    );
    const ended = of(doused.events, "checkEnded")[0];
    assert.ok(ended, JSON.stringify(doused.events));
    assert.equal(ended.actorId, "friend");
    assert.equal(ended.holderId, "burning");
    assert.equal(ended.success, true);
    assert.equal(burning(doused.state), false, "out");
    assert.equal(rulesetCombatant(doused.state, "friend")!.budgets.action, 0, "their own action spent");
    // A low roll leaves it burning.
    const missed = applyRulesetCombatChoice(
      definition,
      fight(),
      { actorId: "friend", optionId: option.id, targetIds: [] },
      () => 3,
    );
    assert.equal(of(missed.events, "checkEnded")[0]?.success, false);
    assert.equal(burning(missed.state), true);
  }
  // ── Too far off, nothing; its holder still may ──
  {
    const state = fight();
    state.turn = 1;
    assert.ok(!rulesetCombatOptions(definition, state, "far").some((one) => one.id.startsWith("checkends:burning")));
    state.turn = 2;
    assert.ok(rulesetCombatOptions(definition, state, "burning").some((one) => one.id === "checkends:on_fire"));
    // Not open to anybody: only its holder.
    const own = fight();
    rulesetCombatant(own, "burning")!.tracked[0]!.checkEnds = { check: "agility", difficulty: 10 };
    assert.ok(!rulesetCombatOptions(definition, own, "friend").some((one) => one.id.startsWith("checkends:")));
  }

  // ── Refusals: "any" is the only one open to others ──
  {
    const doc = document();
    const withFlask = parsed({
      ...doc,
      combat: { ...doc.combat },
    });
    assert.ok(withFlask);
    const refused = parseRulesetDefinition(
      (() => {
        const one = document();
        one.catalogs.push({
          id: "bestiary-x",
          label: "X",
          holds: "creatures",
          entries: [{ id: "x", label: "X", creature: { ...block([flask({ ...douse, by: "some" })]) } }],
        });
        return one;
      })(),
    );
    assert.equal(refused.ok, false);
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset whose conditions anybody next to their holder may end with a check (checkEnds by any) requires schemaVersion 2 and capabilityApi 1.518 or newer";
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
    const doc = document();
    doc.catalogs.push({
      id: "gear",
      label: "Gear",
      holds: "items",
      entries: [
        {
          id: "fire",
          label: "Alchemist's Fire",
          item: {
            category: "gear",
            attack: { onHit: [{ condition: "on_fire", atLeast: 0, checkEnds: douse }] },
          },
        },
      ],
    });
    assert.equal(getCapabilityPackageInstallIssue(manifest(517) as never, doc), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(518) as never, doc), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(517) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "Douse: a friend next to a burning creature puts it out with their own check and action, one further off is offered nothing, its holder still may; gated at 1.518.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
