/**
 * Engulfing, being held inside, and sizes in a target test (Capability API 1.403).
 *
 *   - A gelatinous cube's Engulf: picked as a cell, it walks into whoever is no bigger than it holds;
 *     each saves, or takes its acid and is engulfed, inside the cube and carried along with it.
 *   - Nothing reaches the engulfed from outside, nor comes from them but at the cube.
 *   - The acid of each of the cube's own turns, a shambling mound's spared by a save.
 *   - Let out beside it once the condition ends; pushed out of its way on a save, or when it is full.
 *   - Off a board, aimed at one creature. A grapple only Medium or smaller targets take.
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
  RULESET_MOVE_OPTION,
  rulesetCombatHealth,
  rulesetCombatOptions,
  rulesetCreatureBlock,
  rulesetFootprint,
  rulesetOptionTargets,
  rulesetTargetIs,
  supportedCapabilityApi,
  type RulesetCombatEvent,
  type RulesetCombatRoller,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-engulf-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 403);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const engulfAction = (extra: Record<string, unknown> = {}) => ({
    id: "engulf",
    name: "Engulf",
    budget: "action",
    engulf: { upToSize: "large", save: { save: "dex_save", difficulty: 12 } },
    damage: { flat: 10, type: "acid" },
    applies: [{ condition: "engulfed", duration: "instant" }],
    ...extra,
  });
  const cube = {
    id: "gelatinous-cube",
    label: "Gelatinous Cube",
    creature: {
      health: 84,
      defense: 6,
      initiativeModifier: -4,
      speed: 15,
      size: "large",
      tier: "cr_2",
      actions: [engulfAction()],
    },
  };
  const document = (edit: (doc: Record<string, any>) => void = () => {}) => {
    const doc = JSON.parse(fiveEText);
    doc.catalogs.find((catalog: { holds?: string }) => catalog.holds === "creatures").entries.push(cube);
    doc.sheet.live.conditions.push({ id: "engulfed", label: "Engulfed" }, { id: "mound_engulfed", label: "Engulfed" });
    doc.combat.conditions.push(
      {
        condition: "engulfed",
        effects: ["speed-zero"],
        inside: true,
        endsWhenSourceDown: true,
        harms: { at: "source-turn-start", flat: 6, type: "acid" },
      },
      {
        condition: "mound_engulfed",
        effects: ["speed-zero"],
        inside: true,
        endsWhenSourceDown: true,
        harms: { at: "source-turn-start", flat: 13, type: "bludgeoning", save: { save: "con_save", difficulty: 14 } },
      },
    );
    doc.combat.sizes = {
      order: [
        { id: "small", label: "Small" },
        { id: "medium", label: "Medium" },
        { id: "large", label: "Large", cells: 2 },
        { id: "huge", label: "Huge", cells: 3 },
      ],
      default: "medium",
    };
    edit(doc);
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
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const who = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)!;
  const hero = (size = "medium"): RulesetStatBlock => ({
    health: 40,
    defense: 12,
    initiativeModifier: 0,
    speed: 30,
    size,
    saves: { dex_save: 0, con_save: 0 },
    actions: [
      { id: "bow", name: "Bow", budget: "action", toHit: 30, damage: { count: 0, sides: 0, flat: 5 }, reach: 120 },
    ],
  });

  const definition = parsed(document());
  const entries = definition.catalogs!.find((catalog) => catalog.id === "creatures")!.entries!;
  const cubeBlock = (def: RulesetDefinition = definition) =>
    rulesetCreatureBlock(
      def,
      def.catalogs!.find((catalog) => catalog.id === "creatures")!.entries!.find((one) => one.id === cube.id),
    )!;
  assert.ok(entries.some((one) => one.id === cube.id));
  const health = (def: RulesetDefinition, state: RulesetEncounterState, id: string) =>
    rulesetCombatHealth(def, def.combat!, who(state, id)).value;

  /** The cube at 0,1 (filling 0..1 by 1..2), heroes at 3,1 and 3,2, an archer further off. */
  const fight = (
    def: RulesetDefinition = definition,
    roller: RulesetCombatRoller = () => 1,
    heroes: Record<string, RulesetStatBlock> = { brenna: hero(), tamsin: hero() },
  ): RulesetEncounterState => {
    const places: Record<string, { x: number; y: number }> = { cube: { x: 0, y: 1 }, archer: { x: 8, y: 0 } };
    Object.keys(heroes).forEach((id, index) => (places[id] = { x: 3, y: 1 + index }));
    const state = createRulesetEncounter({
      definition: def,
      seed: 1,
      roller,
      combatants: [
        { id: "cube", name: "Cube", side: "enemy", block: cubeBlock(def) },
        ...Object.entries(heroes).map(([id, block]) => ({ id, name: id, side: "enemy" as const, block })),
        { id: "archer", name: "Archer", side: "enemy", block: hero() },
      ],
      board: {
        grid: {
          width: 10,
          height: 5,
          tiles: Array.from({ length: 5 }, () => Array.from({ length: 10 }, () => "plains")),
        } as never,
        placements: places,
      },
    });
    for (const id of [...Object.keys(heroes), "archer"]) who(state, id).side = "party";
    state.order = ["cube", ...Object.keys(heroes), "archer"];
    state.turn = 0;
    return state;
  };
  const engulfOption = (def: RulesetDefinition, state: RulesetEncounterState) =>
    rulesetCombatOptions(def, state, "cube").find((option) => option.id === who(state, "cube").actions[0]!.id);
  const engulf = (
    def: RulesetDefinition,
    state: RulesetEncounterState,
    to: { x: number; y: number },
    roller: RulesetCombatRoller,
  ) => {
    const option = engulfOption(def, state);
    assert.ok(
      option?.cells?.some((cell) => cell.x === to.x && cell.y === to.y),
      JSON.stringify(option),
    );
    const taken = applyRulesetCombatChoice(
      def,
      state,
      { actorId: "cube", optionId: option!.id, targetIds: [], to },
      roller,
    );
    assert.deepEqual(of(taken.events, "refused"), [], JSON.stringify(taken.events));
    return taken;
  };
  const endTurn = (def: RulesetDefinition, state: RulesetEncounterState, roller: RulesetCombatRoller = () => 1) => {
    const actor = state.order[state.turn]!;
    return applyRulesetCombatChoice(def, state, { actorId: actor, optionId: "end-turn", targetIds: [] }, roller);
  };

  // ── Engulf: both fail, both inside, carried along ──
  {
    const state = fight();
    const option = engulfOption(definition, state);
    assert.deepEqual(option?.targets, { side: "self", count: 0 });
    // Three cells of speed, lent for it: as far as 3,1, never through the heroes' far side.
    assert.ok(option!.cells!.some((cell) => cell.x === 3 && cell.y === 1));
    assert.ok(!option!.cells!.some((cell) => cell.x === 4));
    const taken = engulf(definition, state, { x: 2, y: 1 }, () => 1);
    const now = taken.state;
    assert.equal(who(now, "brenna").insideOf, "cube");
    assert.equal(who(now, "tamsin").insideOf, "cube");
    assert.deepEqual(
      of(taken.events, "inside").map((one) => one.targetId),
      ["brenna", "tamsin"],
    );
    assert.equal(health(definition, now, "brenna"), 30, "the engulf's own acid");
    assert.deepEqual({ x: who(now, "brenna").x, y: who(now, "brenna").y }, { x: 2, y: 1 });
    // Its own speed is its own: the walk was lent.
    assert.equal(who(now, "cube").movementLeft, who(state, "cube").movementLeft);
    // The engulfed walk nowhere, and nobody outside reaches them.
    assert.equal(
      rulesetCombatOptions(definition, { ...now, turn: 1 }, "brenna").find((one) => one.id === RULESET_MOVE_OPTION)
        ?.cells?.length ?? 0,
      0,
    );
    const archerTurn = { ...structuredClone(now), turn: 3 };
    const bow = rulesetCombatOptions(definition, archerTurn, "archer").find((one) => one.label === "Bow")!;
    const reached = rulesetOptionTargets(definition, archerTurn, "archer", bow);
    assert.ok(reached.includes("cube") && !reached.includes("brenna"), JSON.stringify(reached));
    // But they may strike at the cube itself, and only at it.
    const brennaTurn = { ...structuredClone(now), turn: 1 };
    const fromInside = rulesetOptionTargets(
      definition,
      brennaTurn,
      "brenna",
      rulesetCombatOptions(definition, brennaTurn, "brenna").find((one) => one.label === "Bow")!,
    );
    assert.deepEqual(fromInside, ["cube"]);

    // Around to the cube's next turn: its acid, then a walk carries them along.
    let next = now;
    for (let index = 0; index < 4; index++) next = endTurn(definition, next).state;
    assert.equal(next.order[next.turn], "cube");
    assert.equal(health(definition, next, "brenna"), 24, "6 acid as the cube's turn starts");
    assert.equal(health(definition, next, "tamsin"), 24);
    const walked = applyRulesetCombatChoice(
      definition,
      next,
      { actorId: "cube", optionId: RULESET_MOVE_OPTION, targetIds: [], to: { x: 4, y: 1 } },
      () => 1,
    );
    assert.deepEqual(of(walked.events, "refused"), [], JSON.stringify(walked.events));
    assert.deepEqual({ x: who(walked.state, "tamsin").x, y: who(walked.state, "tamsin").y }, { x: 4, y: 1 });

    // The cube goes down: they are let out beside it, nobody inside anything.
    const slain = structuredClone(walked.state);
    const blow = applyRulesetCombatChoice(
      definition,
      {
        ...slain,
        turn: 3,
        combatants: slain.combatants.map((one) =>
          one.id === "cube" ? { ...one, health: { ...one.health!, value: 1 } } : one,
        ),
      } as never,
      { actorId: "archer", optionId: bow.id, targetIds: ["cube"] },
      () => 20,
    );
    const out = of(blow.events, "inside").filter((one) => one.out);
    assert.deepEqual(out.map((one) => one.targetId).sort(), ["brenna", "tamsin"], JSON.stringify(blow.events));
    const cubeCells = new Set(rulesetFootprint(who(blow.state, "cube")).map((cell) => `${cell.x},${cell.y}`));
    for (const id of ["brenna", "tamsin"]) {
      assert.equal(who(blow.state, id).insideOf, undefined);
      assert.ok(!cubeCells.has(`${who(blow.state, id).x},${who(blow.state, id).y}`), "set down outside it");
    }
    assert.notDeepEqual(
      { x: who(blow.state, "brenna").x, y: who(blow.state, "brenna").y },
      { x: who(blow.state, "tamsin").x, y: who(blow.state, "tamsin").y },
    );
  }

  // ── Saved: pushed out of its way, untouched ──
  {
    const taken = engulf(definition, fight(), { x: 2, y: 1 }, () => 20);
    for (const id of ["brenna", "tamsin"]) {
      assert.equal(who(taken.state, id).insideOf, undefined);
      assert.equal(health(definition, taken.state, id), 40);
    }
    assert.equal(of(taken.events, "pushed").length, 2);
    const cubeCells = new Set(rulesetFootprint(who(taken.state, "cube")).map((cell) => `${cell.x},${cell.y}`));
    for (const id of ["brenna", "tamsin"]) {
      assert.ok(!cubeCells.has(`${who(taken.state, id).x},${who(taken.state, id).y}`));
    }
  }

  // ── Full: one inside, the other pushed out without a save ──
  {
    const one = parsed(
      document((doc) => {
        doc.catalogs
          .find((catalog: { holds?: string }) => catalog.holds === "creatures")
          .entries.find((entry: { id: string }) => entry.id === cube.id).creature.actions = [
          engulfAction({ engulf: { upToSize: "large", save: { save: "dex_save", difficulty: 12 }, atMost: 1 } }),
        ];
      }),
    );
    const taken = engulf(one, fight(one), { x: 2, y: 1 }, () => 1);
    assert.equal(who(taken.state, "brenna").insideOf, "cube");
    assert.equal(who(taken.state, "tamsin").insideOf, undefined);
    assert.equal(health(one, taken.state, "tamsin"), 40);
    assert.equal(of(taken.events, "save").filter((save) => save.actorId === "tamsin").length, 0);
  }

  // ── Too big to take in: never walked into ──
  {
    const state = fight(definition, () => 1, { brenna: hero("huge") });
    const cells = engulfOption(definition, state)!.cells!;
    assert.ok(!cells.some((cell) => cell.x === 2 && cell.y === 1), "a Huge hero stands in the way");
  }

  // ── A shambling mound's harm, spared by a save ──
  {
    const mound = parsed(
      document((doc) => {
        doc.catalogs
          .find((catalog: { holds?: string }) => catalog.holds === "creatures")
          .entries.find((entry: { id: string }) => entry.id === cube.id).creature.actions = [
          engulfAction({ applies: [{ condition: "mound_engulfed", duration: "instant" }] }),
        ];
      }),
    );
    const taken = engulf(
      mound,
      fight(mound, () => 1, { brenna: hero() }),
      { x: 2, y: 1 },
      () => 1,
    );
    let state = taken.state;
    for (let index = 0; index < 2; index++) state = endTurn(mound, state).state;
    // The cube's turn starts: a 20 saves.
    const spared = endTurn(mound, state, () => 20);
    assert.equal(spared.state.order[spared.state.turn], "cube");
    assert.equal(health(mound, spared.state, "brenna"), 30, "only the engulf's own 10");
    let again = spared.state;
    for (let index = 0; index < 2; index++) again = endTurn(mound, again).state;
    const hurt = endTurn(mound, again, () => 1);
    assert.equal(health(mound, hurt.state, "brenna"), 17, "13 on a failed save");
  }

  // ── Off a board: aimed at one creature ──
  {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 1,
      combatants: [
        { id: "cube", name: "Cube", side: "enemy", block: cubeBlock() },
        { id: "brenna", name: "Brenna", side: "enemy", block: hero() },
      ],
    });
    who(state, "brenna").side = "party";
    state.order = ["cube", "brenna"];
    state.turn = 0;
    const option = engulfOption(definition, state)!;
    assert.equal(option.cells, undefined);
    const taken = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "cube", optionId: option.id, targetIds: ["brenna"] },
      () => 1,
    );
    assert.equal(who(taken.state, "brenna").insideOf, "cube");
    assert.equal(health(definition, taken.state, "brenna"), 30);
  }

  // ── Sizes in a target test ──
  {
    const state = fight(definition, () => 1, { brenna: hero("small"), tamsin: hero("huge") });
    const test = { upToSize: "medium" };
    assert.equal(rulesetTargetIs(definition, who(state, "brenna"), test), true);
    assert.equal(rulesetTargetIs(definition, who(state, "tamsin"), test), false);
    assert.equal(rulesetTargetIs(definition, who(state, "cube"), test), false);
    assert.equal(rulesetTargetIs(definition, who(state, "cube"), { atLeastSize: "large" }), true);
    assert.equal(rulesetTargetIs(definition, who(state, "brenna"), { atLeastSize: "large" }), false);
    // Sizes and a type together: both.
    assert.equal(rulesetTargetIs(definition, who(state, "brenna"), { upToSize: "medium", types: ["undead"] }), false);
  }

  // ── Refusals ──
  {
    const withAction = (action: Record<string, unknown>) =>
      document((doc) => {
        doc.catalogs
          .find((catalog: { holds?: string }) => catalog.holds === "creatures")
          .entries.find((entry: { id: string }) => entry.id === cube.id).creature.actions = [action];
      });
    refused(
      withAction(engulfAction({ engulf: { upToSize: "titanic", save: { save: "dex_save", difficulty: 12 } } })),
      /Unknown size "titanic"/,
    );
    refused(
      withAction(engulfAction({ engulf: { upToSize: "large", save: { save: "luck_save", difficulty: 12 } } })),
      /Unknown save "luck_save"/,
    );
    refused(withAction(engulfAction({ toHit: 4 })), /no attack roll or save of its own/);
    refused(
      document((doc) => {
        delete doc.combat.sizes;
      }),
      /"upToSize" reads combat.sizes/,
    );
    refused(
      document((doc) => {
        doc.combat.conditions.at(-1).harms.save.save = "luck_save";
      }),
      /Unknown save "luck_save"/,
    );
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset with an engulf, a condition that holds its holder inside, a harm on its source's turns or spared by a save, or a target test by size requires schemaVersion 2 and capabilityApi 1.403 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(402) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(403) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(402) as never, JSON.parse(fiveEText)), gate);
    // A grapple by size alone, and a source-turn harm alone.
    const sized = JSON.parse(fiveEText);
    sized.combat.sizes = document().combat.sizes;
    sized.combat.conditions.push({ condition: "grappled_too", effects: [], harms: { at: "source-turn-end", flat: 1 } });
    assert.equal(getCapabilityPackageInstallIssue(manifest(402) as never, sized), gate);
  }

  console.log(
    "Engulf: a cube walks into whoever fits, each saving or taken inside and carried along, untouchable from outside, acid on its turns, a mound's spared by a save, let out as it falls; pushed aside on a save or when full; off a board aimed at one; sized target tests; gated at 1.403.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
