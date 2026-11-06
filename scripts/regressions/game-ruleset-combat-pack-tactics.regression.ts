/**
 * Attacks that read who stands beside the target and how hurt it is (Capability API 1.393).
 *
 *   - A creature's `attackModes` with `allyAdjacent`: 5e's Pack Tactics, advantage while one of its
 *     allies who can act stands beside the target.
 *   - With `targetHurt`: Blood Frenzy, advantage at a target below its most health.
 *   - A rider `when` "target-hurt": Colossus Slayer's extra die on a hurt target.
 *   - A rider `oncePer` "own-turn": Divine Strike, once on each of its holder's own turns and never
 *     on a strike between them.
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
  rulesetCreatureBlock,
  rulesetWindowOptions,
  supportedCapabilityApi,
  RULESET_MOVE_OPTION,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-pack-tactics-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 393);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const creature = (id: string, extra: Record<string, unknown>) => ({
    id,
    label: id[0]!.toUpperCase() + id.slice(1),
    creature: {
      health: 20,
      defense: 12,
      initiativeModifier: 0,
      speed: 30,
      tier: "cr_1_2",
      actions: [{ id: "bite", name: "Bite", budget: "action", toHit: 4, damage: { flat: 4 }, reach: 5 }],
      ...extra,
    },
  });
  const wolf = creature("wolf", { attackModes: [{ mode: "advantage", allyAdjacent: true }] });
  const shark = creature("shark", { attackModes: [{ mode: "advantage", targetHurt: true }] });
  const ranger = creature("ranger", {
    riders: [
      {
        id: "colossus",
        name: "Colossus Slayer",
        on: "hit",
        when: ["target-hurt"],
        oncePer: "turn",
        amount: { flat: 5 },
      },
    ],
  });
  const cleric = creature("cleric", {
    riders: [{ id: "divine", name: "Divine Strike", on: "hit", oncePer: "own-turn", amount: { flat: 6 } }],
  });
  // Blood Frenzy on melee attacks only (1.402): its thrown spear never has it.
  const sahuagin = creature("sahuagin", {
    attackModes: [{ mode: "advantage", targetHurt: true, melee: true }],
    actions: [
      {
        id: "spear",
        name: "Spear",
        budget: "action",
        toHit: 3,
        damage: { flat: 4 },
        reach: 5,
        range: { normal: 20, long: 60 },
      },
    ],
  });
  const beasts = [wolf, shark, ranger, cleric, sahuagin];
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.catalogs.find((catalog: { id: string }) => catalog.id === "creatures").entries.push(...structuredClone(beasts));
    edit(doc);
    return doc;
  };
  const parsed = (document: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(document);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const refusedDoc = (document: unknown, pattern: RegExp) => {
    const result = parseRulesetDefinition(document);
    assert.equal(result.ok, false, `should be refused: ${pattern}`);
    if (!result.ok) assert.match(result.issues.join("; "), pattern);
  };
  const definition = parsed(fiveE());
  const entries = definition.catalogs!.find((catalog) => catalog.id === "creatures")!.entries!;
  const blockOf = (id: string): RulesetStatBlock =>
    rulesetCreatureBlock(
      definition,
      entries.find((entry) => entry.id === id),
    )!;
  const target: RulesetStatBlock = {
    health: 30,
    defense: 10,
    initiativeModifier: 0,
    speed: 30,
    actions: [{ id: "slap", name: "Slap", budget: "action", toHit: 0, damage: { flat: 1 }, reach: 5 }],
  };

  /** `beast` at 1,1 beside the hero at 2,1; its pack-mate wherever `mate` says, or nowhere. */
  const fight = (beast: string, mate?: { x: number; y: number }): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        { id: "hero", name: "Hero", side: "enemy", block: target },
        { id: beast, name: beast, side: "enemy", block: blockOf(beast) },
        ...(mate ? [{ id: "mate", name: "Mate", side: "enemy" as const, block: blockOf("wolf") }] : []),
      ],
      board: {
        grid: {
          width: 8,
          height: 3,
          tiles: Array.from({ length: 3 }, () => Array.from({ length: 8 }, () => "plains")),
        } as never,
        placements: { hero: { x: 2, y: 1 }, [beast]: { x: 1, y: 1 }, ...(mate ? { mate } : {}) },
      },
    });
    rulesetCombatant(state, "hero")!.side = "party";
    state.order = [beast, "hero", ...(mate ? ["mate"] : [])];
    state.turn = 0;
    return state;
  };
  const who = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)!;
  const mode = (state: RulesetEncounterState, from: string, to: string) =>
    rulesetAttackMode(definition, definition.combat!, who(state, from), who(state, to), {
      state,
      optionId: who(state, from).actions.find((action) => action.label === "Bite")?.id ?? "",
    });
  /** The walk, and the strike its reaction window offers taken. */
  const walkAway = (def: RulesetDefinition, state: RulesetEncounterState) => {
    const roll = (sides: number) => (sides === 20 ? 15 : 1);
    const held = applyRulesetCombatChoice(
      def,
      state,
      { actorId: "hero", optionId: RULESET_MOVE_OPTION, targetIds: [], to: { x: 6, y: 1 } },
      roll,
    );
    const window = held.state.window;
    assert.ok(window, JSON.stringify(held.events));
    const strike = rulesetWindowOptions(def, held.state, "cleric")[0]!;
    const taken = applyRulesetCombatChoice(
      def,
      held.state,
      { actorId: "cleric", optionId: strike.id, targetIds: [], window: window.id },
      roll,
    );
    return { ...taken, events: [...held.events, ...taken.events] };
  };
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);

  // ── Pack Tactics ──
  {
    assert.deepEqual(blockOf("wolf").attackModes, [{ mode: "advantage", allyAdjacent: true }]);
    assert.equal(mode(fight("wolf", { x: 3, y: 1 }), "wolf", "hero"), "advantage", "a pack-mate beside the hero");
    assert.equal(mode(fight("wolf", { x: 3, y: 0 }), "wolf", "hero"), "advantage", "beside, on a corner");
    assert.equal(mode(fight("wolf", { x: 6, y: 1 }), "wolf", "hero"), "normal", "a pack-mate too far off");
    assert.equal(mode(fight("wolf"), "wolf", "hero"), "normal", "alone, the wolf itself is no ally");
    const down = fight("wolf", { x: 3, y: 1 });
    who(down, "mate").down = true;
    assert.equal(mode(down, "wolf", "hero"), "normal", "a pack-mate who is down");
    const stunned = fight("wolf", { x: 3, y: 1 });
    who(stunned, "mate").tracked.push({ condition: "incapacitated", rounds: null } as never);
    assert.equal(mode(stunned, "wolf", "hero"), "normal", "a pack-mate who cannot act");
    // Only the wolf's own attacks.
    assert.equal(mode(fight("wolf", { x: 3, y: 1 }), "hero", "wolf"), "normal");
  }

  // ── Blood Frenzy ──
  {
    const state = fight("shark");
    assert.equal(mode(state, "shark", "hero"), "normal", "a hero at full health");
    who(state, "hero").health!.value = 29;
    assert.equal(mode(state, "shark", "hero"), "advantage", "one point down is enough");
  }

  // ── Blood Frenzy on melee attacks only (1.402) ──
  {
    const state = fight("sahuagin");
    who(state, "hero").health!.value = 29;
    const spear = (at: RulesetEncounterState) =>
      rulesetAttackMode(definition, definition.combat!, who(at, "sahuagin"), who(at, "hero"), {
        state: at,
        optionId: who(at, "sahuagin").actions.find((action) => action.label === "Spear")?.id ?? "",
      });
    assert.equal(spear(state), "advantage", "stabbed beside it");
    who(state, "hero").x = 4;
    assert.equal(spear(state), "normal", "thrown from 15 feet off");
  }

  // ── Colossus Slayer ──
  {
    const strike = (hurt: boolean) => {
      const state = fight("ranger");
      if (hurt) who(state, "hero").health!.value = 25;
      const result = applyRulesetCombatChoice(
        definition,
        state,
        { actorId: "ranger", optionId: who(state, "ranger").actions[0]!.id, targetIds: ["hero"] },
        (sides) => (sides === 20 ? 15 : 1),
      );
      assert.deepEqual(of(result.events, "refused"), [], JSON.stringify(result.events));
      return result;
    };
    assert.equal(of(strike(false).events, "rider").length, 0, "nothing at full health");
    const hurt = strike(true);
    assert.equal(of(hurt.events, "rider").length, 1, "the extra on a hurt target");
    assert.equal(who(hurt.state, "hero").health!.value, 25 - 4 - 5);
  }

  // ── Divine Strike: once on each of its own turns, none between ──
  {
    const state = fight("cleric");
    const own = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "cleric", optionId: who(state, "cleric").actions[0]!.id, targetIds: ["hero"] },
      (sides) => (sides === 20 ? 15 : 1),
    );
    assert.deepEqual(of(own.events, "refused"), []);
    assert.equal(of(own.events, "rider").length, 1, "on its own turn");
    // The hero's turn: walking away draws the cleric's opportunity strike, and no Divine Strike.
    const next = applyRulesetCombatChoice(
      definition,
      own.state,
      { actorId: "cleric", optionId: "end-turn", targetIds: [] },
      () => 10,
    ).state;
    assert.equal(next.order[next.turn], "hero");
    const walked = walkAway(definition, next);
    assert.equal(of(walked.events, "opportunity").length, 1, JSON.stringify(walked.events));
    assert.ok(
      of(walked.events, "attack").some((one) => one.actorId === "cleric" && one.outcome === "hit"),
      "the strike lands",
    );
    assert.equal(of(walked.events, "rider").length, 0, "not on the hero's turn");
    // The same rider once per any turn does fire there.
    const anyTurn = parsed(
      fiveE((doc) => {
        doc.catalogs
          .find((catalog: { id: string }) => catalog.id === "creatures")
          .entries.find((one: { id: string }) => one.id === "cleric").creature.riders[0].oncePer = "turn";
      }),
    );
    const anyEntries = anyTurn.catalogs!.find((catalog) => catalog.id === "creatures")!.entries!;
    const loose = createRulesetEncounter({
      definition: anyTurn,
      seed: 1,
      roller: () => 10,
      combatants: [
        { id: "hero", name: "Hero", side: "enemy", block: target },
        {
          id: "cleric",
          name: "cleric",
          side: "enemy",
          block: rulesetCreatureBlock(
            anyTurn,
            anyEntries.find((one) => one.id === "cleric"),
          )!,
        },
      ],
      board: {
        grid: {
          width: 8,
          height: 3,
          tiles: Array.from({ length: 3 }, () => Array.from({ length: 8 }, () => "plains")),
        } as never,
        placements: { hero: { x: 2, y: 1 }, cleric: { x: 1, y: 1 } },
      },
    });
    rulesetCombatant(loose, "hero")!.side = "party";
    loose.order = ["hero", "cleric"];
    loose.turn = 0;
    const looseWalk = walkAway(anyTurn, loose);
    assert.equal(of(looseWalk.events, "rider").length, 1, "once per turn, any turn");
  }

  // ── Refusals ──
  {
    const withBeast = (beast: unknown) =>
      fiveE((doc) => {
        doc.catalogs.find((catalog: { id: string }) => catalog.id === "creatures").entries.push(beast);
      });
    refusedDoc(
      withBeast(creature("odd", { attackModes: [{ mode: "advantage", allyAdjacent: false }] })),
      /attackModes/,
    );
    refusedDoc(withBeast(creature("odd", { attackModes: [{ mode: "advantage" }] })), /allyAdjacent, targetHurt, melee/);
    refusedDoc(
      withBeast(
        creature("odd", { riders: [{ id: "r", name: "R", on: "hit", oncePer: "own-round", amount: { flat: 1 } }] }),
      ),
      /oncePer/,
    );
  }

  // ── The gate ──
  {
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
    const gate =
      "A ruleset with a creature attack mode by an ally beside or a hurt target, a rider on a hurt target, or a rider once on its holder's own turn, requires schemaVersion 2 and capabilityApi 1.393 or newer";
    for (const beast of beasts.filter((one) => one !== sahuagin)) {
      const doc = JSON.parse(fiveEText) as Record<string, any>;
      doc.catalogs.find((catalog: { id: string }) => catalog.id === "creatures").entries.push(structuredClone(beast));
      assert.equal(getCapabilityPackageInstallIssue(manifest(392) as never, doc), gate, beast.id);
      assert.notEqual(getCapabilityPackageInstallIssue(manifest(393) as never, doc), gate, beast.id);
    }
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(392) as never, JSON.parse(fiveEText)), gate);
    // Melee alone is 1.402's.
    const melee = JSON.parse(fiveEText) as Record<string, any>;
    melee.catalogs
      .find((catalog: { id: string }) => catalog.id === "creatures")
      .entries.push(structuredClone(sahuagin));
    const meleeGate =
      "A ruleset with calls read from a catalog or scaled by cost, or an attack mode on melee attacks, requires schemaVersion 2 and capabilityApi 1.402 or newer";
    assert.equal(getCapabilityPackageInstallIssue(manifest(401) as never, melee), meleeGate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(402) as never, melee), meleeGate);
  }

  console.log(
    "Pack Tactics beside a standing pack-mate, Blood Frenzy at a hurt target, Colossus Slayer's extra on one, Divine Strike only on its own turn; refusals; gated at 1.393.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
