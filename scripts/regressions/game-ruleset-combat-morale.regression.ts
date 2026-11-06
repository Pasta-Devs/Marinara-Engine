/**
 * Losing heart in a fight (Capability API 1.762).
 *
 *   - A rolled check against a creature's morale score, once per trigger: broken, it runs; one at the
 *     board's edge is gone at once; one that holds is not asked again for the same thing.
 *   - A saved check: a hurt creature whose mind gives up surrenders with an opponent beside it, and
 *     the summary says so; one immune to `unlessImmune`, a mindless one and a called one never check.
 *   - The director runs a broken creature for the edge, and it gets away; on a shaped board by its
 *     outline, and one walled in with no way out fights on (2026-10-24).
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
  defaultRulesetSheetBuild,
  parseRulesetDefinition,
  rulesetCombatant,
  rulesetEncounterSummary,
  rulesetReachableCells,
  supportedCapabilityApi,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-combat-morale-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");
const { createCombatDirector } = await import("../../packages/server/src/services/game/combat-director.service.js");
const { commandRulesetCombatDirector, createRulesetFight, rulesetDirectorStage, syncRulesetCombatants } =
  await import("../../packages/server/src/services/game/ruleset-combat-director.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 762);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const fiveE = (morale?: unknown): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    if (morale !== undefined) doc.combat.morale = morale;
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
  const rolled = { check: { roll: "2d6" }, on: ["first-fall", "half-down"] };
  const saved = {
    check: { save: "wis_save", difficulty: 10 },
    on: ["leader-down", "hurt"],
    surrenders: ["cunning", "tactical", "genius"],
    unlessImmune: "frightened",
  };
  const claw = { id: "claw", name: "Claw", budget: "action", toHit: 4, damage: { count: 1, sides: 6 }, reach: 1 };
  const block = (extra: Record<string, unknown> = {}): RulesetStatBlock =>
    ({
      health: 20,
      defense: 12,
      initiativeModifier: 0,
      speed: 30,
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      actions: [claw],
      ...extra,
    }) as unknown as RulesetStatBlock;
  const hero = rulesetHero();
  function rulesetHero() {
    const build = defaultRulesetSheetBuild(parsed(fiveE()));
    build.fields = { ...build.fields, hp_max: 40 };
    return build;
  }
  /** A fight with the hero first, so ending the hero's turn starts the next creature's. */
  const fight = (
    definition: RulesetDefinition,
    creatures: Record<string, { block: RulesetStatBlock; at: { x: number; y: number }; health?: number }>,
    heroAt = { x: 1, y: 1 },
  ): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        { id: "hero", name: "Hero", side: "party", build: hero, live: {} },
        ...Object.entries(creatures).map(([id, one]) => ({ id, name: id, side: "enemy" as const, block: one.block })),
      ],
      board: {
        grid: { width: 12, height: 8, tiles: Array.from({ length: 8 }, () => Array(12).fill("plains")) },
        placements: {
          hero: heroAt,
          ...Object.fromEntries(Object.entries(creatures).map(([id, one]) => [id, one.at])),
        },
      } as never,
    });
    for (const [id, one] of Object.entries(creatures))
      if (one.health !== undefined) {
        const combatant = rulesetCombatant(state, id)!;
        combatant.health = { ...combatant.health!, value: one.health };
        if (one.health <= 0) combatant.defeated = true;
      }
    state.order = ["hero", ...Object.keys(creatures)];
    state.turn = 0;
    return state;
  };
  const endTurn = (definition: RulesetDefinition, state: RulesetEncounterState, roll: number) => {
    const actorId = state.order[state.turn]!;
    return applyRulesetCombatChoice(definition, state, { actorId, optionId: "end-turn", targetIds: [] }, () => roll);
  };
  const morale = (events: RulesetCombatEvent[]) =>
    events.filter((event): event is Extract<RulesetCombatEvent, { type: "morale" }> => event.type === "morale");

  // ── Rolled against its morale score ──
  {
    const definition = parsed(fiveE(rolled));
    // A friend has fallen: 6 + 6 is above 7, and it breaks, but in the middle of the board it runs.
    const broke = endTurn(
      definition,
      fight(definition, {
        gob: { block: block({ morale: 7 }), at: { x: 6, y: 4 } },
        dead: { block: block(), at: { x: 9, y: 5 }, health: 0 },
      }),
      6,
    );
    const checks = morale(broke.events);
    assert.equal(checks.length, 1, JSON.stringify(broke.events.map((event) => event.type)));
    assert.deepEqual(
      { trigger: checks[0]!.trigger, outcome: checks[0]!.outcome, roll: checks[0]!.roll, score: checks[0]!.score },
      { trigger: "first-fall", outcome: "flee", roll: 12, score: 7 },
    );
    const gob = rulesetCombatant(broke.state, "gob")!;
    assert.equal(gob.routed, true, "running");
    assert.equal(gob.defeated, false, "still on the board");
    assert.ok(!broke.events.some((event) => event.type === "fled"));
    // Half its side down too, by now: but it is running, and it is not asked again.
    assert.deepEqual(gob.moraleChecked, ["first-fall"]);

    // At the board's edge it is gone at once, and the fight is won.
    const gone = endTurn(
      definition,
      fight(definition, {
        gob: { block: block({ morale: 7 }), at: { x: 11, y: 4 } },
        dead: { block: block(), at: { x: 9, y: 5 }, health: 0 },
      }),
      6,
    );
    assert.ok(gone.events.some((event) => event.type === "fled" && event.actorId === "gob"));
    const left = rulesetEncounterSummary(definition, gone.state).enemies.find((one) => one.id === "gob");
    assert.equal(left?.left, true, "got away");
    assert.equal(rulesetEncounterSummary(definition, gone.state).outcome, "victory");

    // Morale 12 never breaks on 2d6; each trigger is asked once.
    let state = fight(definition, {
      gob: { block: block({ morale: 12 }), at: { x: 6, y: 4 } },
      dead: { block: block(), at: { x: 9, y: 5 }, health: 0 },
    });
    const first = endTurn(definition, state, 6);
    assert.deepEqual(
      morale(first.events).map((event) => [event.trigger, event.outcome]),
      [
        ["first-fall", "held"],
        ["half-down", "held"],
      ],
    );
    state = endTurn(definition, endTurn(definition, first.state, 6).state, 6).state;
    assert.equal(rulesetCombatant(state, "gob")!.routed, undefined);
    assert.equal(morale(endTurn(definition, first.state, 6).events).length, 0, "not asked again");

    // A fanatic never checks (combat AI T2); a disciplined one shrugs off the first of its side to
    // fall, but not half of it (T1).
    const zealous = fight(definition, {
      gob: { block: block({ morale: 7 }), at: { x: 6, y: 4 } },
      dead: { block: block(), at: { x: 9, y: 5 }, health: 0 },
    });
    rulesetCombatant(zealous, "gob")!.temperament = "fanatical";
    assert.equal(morale(endTurn(definition, zealous, 6).events).length, 0, "a fanatic");
    // As its own data says, with nobody playing it to say so.
    const written = fight(definition, {
      gob: { block: block({ morale: 7, behavior: { temperament: "fanatical" } }), at: { x: 6, y: 4 } },
      dead: { block: block(), at: { x: 9, y: 5 }, health: 0 },
    });
    assert.equal(morale(endTurn(definition, written, 6).events).length, 0, "a fanatic by its data");
    const steady = fight(definition, {
      gob: { block: block({ morale: 7 }), at: { x: 6, y: 4 } },
      dead: { block: block(), at: { x: 9, y: 5 }, health: 0 },
    });
    rulesetCombatant(steady, "gob")!.temperament = "disciplined";
    assert.deepEqual(
      morale(endTurn(definition, steady, 6).events).map((event) => event.trigger),
      ["half-down"],
      "a disciplined one",
    );

    // Nothing has happened yet: no check. No morale score and none in the ruleset: no check.
    assert.equal(
      morale(
        endTurn(definition, fight(definition, { gob: { block: block({ morale: 7 }), at: { x: 6, y: 4 } } }), 6).events,
      ).length,
      0,
    );
    assert.equal(
      morale(
        endTurn(
          definition,
          fight(definition, {
            gob: { block: block(), at: { x: 6, y: 4 } },
            dead: { block: block(), at: { x: 9, y: 5 }, health: 0 },
          }),
          6,
        ).events,
      ).length,
      0,
    );
    // The ruleset's own score stands in for one a creature lacks.
    const scored = parsed(fiveE({ ...rolled, check: { roll: "2d6", score: 5 } }));
    const fallback = morale(
      endTurn(
        scored,
        fight(scored, {
          gob: { block: block(), at: { x: 6, y: 4 } },
          dead: { block: block(), at: { x: 9, y: 5 }, health: 0 },
        }),
        3,
      ).events,
    );
    assert.deepEqual(
      fallback.map((event) => [event.outcome, event.roll, event.score]),
      [["flee", 6, 5]],
    );
  }

  // ── Saved against: giving up, and those who never check ──
  {
    const definition = parsed(fiveE(saved));
    // Hurt below half with the hero beside it: a failed Wisdom save, and a thinking creature yields.
    const yielded = endTurn(
      definition,
      fight(definition, { gob: { block: block(), at: { x: 2, y: 1 }, health: 6 } }),
      1,
    );
    assert.deepEqual(
      morale(yielded.events).map((event) => [event.trigger, event.outcome]),
      [["hurt", "surrender"]],
    );
    // A boss (steadfast) is shaken only when badly hurt: at 6 of 20 it fights on, at 4 it yields.
    const bossAt = (health: number) => {
      const state = fight(definition, { gob: { block: block(), at: { x: 2, y: 1 }, health } });
      rulesetCombatant(state, "gob")!.steadfast = true;
      return morale(endTurn(definition, state, 1).events).map((event) => [event.trigger, event.outcome]);
    };
    assert.deepEqual(bossAt(6), []);
    assert.deepEqual(bossAt(4), [["hurt", "surrender"]]);
    const summary = rulesetEncounterSummary(definition, yielded.state);
    assert.equal(summary.enemies[0]!.surrendered, true);
    assert.equal(summary.enemies[0]!.left, undefined, "gave up, not got away");
    assert.equal(summary.outcome, "victory");
    // The prisoner keeps its square (re-test 16): walked past, never stood on.
    const prisonerState = structuredClone(yielded.state);
    rulesetCombatant(prisonerState, "hero")!.movementLeft = 6;
    const walks = rulesetReachableCells(definition, prisonerState, "hero");
    assert.ok(walks.length > 0);
    assert.ok(!walks.some((cell) => cell.x === 2 && cell.y === 1), "nobody stops on a prisoner's square");
    // Nobody beside it: it runs instead.
    const ran = endTurn(definition, fight(definition, { gob: { block: block(), at: { x: 6, y: 4 }, health: 6 } }), 1);
    assert.deepEqual(
      morale(ran.events).map((event) => event.outcome),
      ["flee"],
    );
    // An animal never surrenders.
    const wolf = endTurn(
      definition,
      fight(definition, { wolf: { block: block({ mind: "instinct" }), at: { x: 2, y: 1 }, health: 6 } }),
      1,
    );
    assert.deepEqual(
      morale(wolf.events).map((event) => event.outcome),
      ["flee"],
    );
    // A good save holds.
    assert.deepEqual(
      morale(
        endTurn(definition, fight(definition, { gob: { block: block(), at: { x: 6, y: 4 }, health: 6 } }), 20).events,
      ).map((event) => event.outcome),
      ["held"],
    );
    // Its leader down.
    const leaderless = endTurn(
      definition,
      fight(definition, {
        gob: { block: block(), at: { x: 6, y: 4 } },
        chief: { block: block({ leader: true }), at: { x: 9, y: 5 }, health: 0 },
      }),
      1,
    );
    assert.deepEqual(
      morale(leaderless.events).map((event) => event.trigger),
      ["leader-down"],
    );
    // One its side follows by the story (combat AI E2), a chief no bestiary marks, falls just the same.
    const chiefless = fight(definition, {
      gob: { block: block(), at: { x: 6, y: 4 } },
      chief: { block: block(), at: { x: 9, y: 5 }, health: 0 },
    });
    assert.deepEqual(
      morale(endTurn(definition, structuredClone(chiefless), 1).events).map((event) => event.trigger),
      [],
      "a plain one down is no leader",
    );
    rulesetCombatant(chiefless, "chief")!.leader = true;
    assert.deepEqual(
      morale(endTurn(definition, chiefless, 1).events).map((event) => event.trigger),
      ["leader-down"],
    );
    // Immune to being frightened, mindless: never asked.
    for (const extra of [{ conditionImmunities: ["frightened"] }, { mind: "mindless" }]) {
      assert.equal(
        morale(
          endTurn(definition, fight(definition, { gob: { block: block(extra), at: { x: 2, y: 1 }, health: 6 } }), 1)
            .events,
        ).length,
        0,
        JSON.stringify(extra),
      );
    }
    // One of the party's own never loses heart on its own, whoever plays it (Kenhito AI K4).
    const hurt = () => fight(definition, { gob: { block: block(), at: { x: 2, y: 1 }, health: 6 } });
    assert.ok(morale(endTurn(definition, hurt(), 1).events).length > 0, "a hurt goblin of theirs is asked");
    const ours = hurt();
    rulesetCombatant(ours, "gob")!.side = "party";
    assert.equal(morale(endTurn(definition, ours, 1).events).length, 0, "one of the party's never is");
  }

  // ── The director runs a broken creature for the edge ──
  type Shape = (grid: any, ada: any, lurker: any) => void;
  const routedRun = (shape?: Shape) => {
    const definition = parsed(fiveE(rolled));
    const creaturesId = (definition.catalogs ?? []).find((catalog) => catalog.holds === "creatures")!.id;
    const bestiary = Object.fromEntries(
      (definition.catalogs ?? []).flatMap((catalog) =>
        catalog.holds === "creatures" && catalog.entries ? [[catalog.id, catalog.entries]] : [],
      ),
    );
    const built = createRulesetFight({
      definition,
      seed: 3,
      positioned: true,
      party: [{ id: "ada", name: "Ada" }],
      enemies: [{ id: "lurker", name: "Lurker", creature: `${creaturesId}/thorn-lurker` }],
      cards: [{ name: "Ada", rulesetSheet: { v: 1, build: hero } }],
      playerName: null,
      live: {},
      items: () => [],
      partyCatalogs: {},
      bestiary,
    } as never);
    assert.ok(built.ok, built.ok ? "" : (built as { error: string }).error);
    const unit = (id: string, name: string, side: "player" | "enemy") => ({
      id,
      name,
      side,
      hp: 30,
      maxHp: 30,
      attack: 8,
      defense: 6,
      speed: 6,
      level: 3,
      skills: [],
    });
    const state = createCombatDirector({
      id: "fight",
      anchor: "anchor",
      style: "ruleset",
      party: [unit("ada", "Ada", "player")],
      enemies: [unit("lurker", "Lurker", "enemy")],
      gm: false,
      difficulty: "normal",
      seed: 3,
    } as never);
    state.rulesetFight = (built as { fight: never }).fight;
    const encounter = state.rulesetFight!.encounter;
    const ada = rulesetCombatant(encounter, "ada")!;
    const lurker = rulesetCombatant(encounter, "lurker")!;
    lurker.routed = true;
    const grid = encounter.board!.grid!;
    // Beside Ada, in the middle of the board.
    ada.x = Math.floor(grid.width / 2);
    ada.y = Math.floor(grid.height / 2);
    lurker.x = ada.x + 1;
    lurker.y = ada.y;
    shape?.(grid, ada, lurker);
    syncRulesetCombatants(definition, state);
    state.stage = rulesetDirectorStage(state);
    // Ada stands and watches, played by nobody but the player. Ending her turn starts the lurker's.
    const hers: RulesetCombatEvent[] = [];
    for (let guard = 0; guard < 12 && !state.outcome; guard++) {
      const now = state.rulesetFight!.encounter;
      if (rulesetEncounterSummary(definition, now).outcome !== "ongoing") break;
      if (now.order[now.turn] === "ada") {
        const step = applyRulesetCombatChoice(
          definition,
          now,
          { actorId: "ada", optionId: "end-turn", targetIds: [] },
          () => 10,
        );
        hers.push(...step.events);
        state.rulesetFight!.encounter = step.state;
        syncRulesetCombatants(definition, state);
        state.stage = rulesetDirectorStage(state);
        continue;
      }
      assert.ok(commandRulesetCombatDirector(definition, state, { type: "continue" }).ok);
    }
    const events = [...state.rulesetFight!.events.map((entry) => entry.event), ...hers];
    return { events, lurker: rulesetCombatant(state.rulesetFight!.encounter, "lurker")!, grid };
  };
  {
    const { events } = routedRun();
    const types = events.map((event) => event.type);
    const away = events.findIndex((event) => event.type === "standard" && event.actorId === "lurker");
    assert.ok(away >= 0, `it got away from Ada first: ${JSON.stringify(types)}`);
    assert.ok(
      events.some(
        (event) =>
          event.type === "reasoning" && event.actorId === "lurker" && event.reasons.some((one) => one.why === "routed"),
      ),
      `and said why (D4): ${JSON.stringify(types)}`,
    );
    assert.ok(
      events.some((event) => event.type === "fled" && event.actorId === "lurker"),
      `and ran off the board: ${JSON.stringify(types)}`,
    );
  }

  // ── Cornered: with no way left to the edge it fights on (laptop re-test 2026-10-24) ──
  {
    const { events } = routedRun((grid, ada, lurker) => {
      // A ring of wall round the two of them: nobody walks out.
      for (let y = ada.y - 2; y <= ada.y + 2; y++)
        for (let x = ada.x - 2; x <= lurker.x + 2; x++)
          if (y === ada.y - 2 || y === ada.y + 2 || x === ada.x - 2 || x === lurker.x + 2) grid.tiles[y][x] = "wall";
    });
    const reasons = events.flatMap((event) =>
      event.type === "reasoning" && event.actorId === "lurker" ? event.reasons.map((one) => one.why) : [],
    );
    assert.ok(reasons.includes("cornered"), `it says it has no way out: ${JSON.stringify(reasons)}`);
    assert.ok(!reasons.includes("routed"), `and does not run on the spot: ${JSON.stringify(reasons)}`);
    assert.ok(!events.some((event) => event.type === "fled" && event.actorId === "lurker"), "nor gets away");
    assert.ok(
      !events.some(
        (event) => event.type === "standard" && event.actorId === "lurker" && /dash/i.test(JSON.stringify(event)),
      ),
      "nor dashes where it stands",
    );
  }

  // ── A shaped board: its outline is an edge, and the way out is walked round to ──
  {
    const { events } = routedRun((grid, ada, lurker) => {
      // Everything but a passage three squares high lies off the map: its rows above and below the
      // lurker's are its outline, a step away, where the board's sides are far.
      grid.outside = Array.from({ length: grid.height }, (_, y) =>
        Array.from({ length: grid.width }, (_, x) => !(Math.abs(y - ada.y) <= 1 && x >= ada.x - 3)),
      );
      for (let y = 0; y < grid.height; y++)
        for (let x = 0; x < grid.width; x++) if (grid.outside[y][x]) grid.tiles[y][x] = "wall";
      assert.ok(lurker.x < grid.width - 2, "the sides are no nearer than the outline");
    });
    assert.ok(
      events.some((event) => event.type === "fled" && event.actorId === "lurker"),
      `it leaves by the board's outline: ${JSON.stringify(events.map((event) => event.type))}`,
    );
  }

  // ── Caught unaware, helpless, half down unanswered (1.775) ──
  {
    const definition = parsed(fiveE({ check: { roll: "2d6" }, on: ["surprised", "helpless"] }));
    const caught = fight(definition, { gob: { block: block({ morale: 7 }), at: { x: 6, y: 4 } } });
    assert.equal(morale(endTurn(definition, structuredClone(caught), 6).events).length, 0, "nothing has happened");
    rulesetCombatant(caught, "gob")!.surprised = true;
    assert.deepEqual(
      morale(endTurn(definition, caught, 6).events).map((event) => [event.trigger, event.outcome]),
      [["surprised", "flee"]],
    );
    // Out of reach of its claws is not helpless: it can walk up to them (the a63 layout, a bandit
    // starting far off the party, routed by a failed check before anybody moved).
    assert.equal(
      morale(
        endTurn(definition, fight(definition, { gob: { block: block({ morale: 2 }), at: { x: 11, y: 7 } } }), 6).events,
      ).length,
      0,
      "a walk away is not helpless",
    );
    // Its claws gone, nothing left to it but a grapple or a shove.
    assert.deepEqual(
      morale(
        endTurn(
          definition,
          fight(definition, { gob: { block: block({ morale: 7, actions: [] }), at: { x: 2, y: 1 } } }),
          6,
        ).events,
      ).map((event) => event.trigger),
      ["helpless"],
    );
    const unanswered = parsed(fiveE({ check: { roll: "2d6" }, on: ["half-down"], halfDownUnanswered: true }));
    const half = {
      gob: { block: block({ morale: 7 }), at: { x: 6, y: 4 } },
      dead: { block: block(), at: { x: 9, y: 5 }, health: 0 },
    };
    assert.deepEqual(
      morale(endTurn(unanswered, fight(unanswered, half), 6).events).map((event) => event.trigger),
      ["half-down"],
    );
    // The party has lost somebody too: half down is answered, and no check.
    const answered = fight(unanswered, half);
    answered.combatants.push({ ...structuredClone(rulesetCombatant(answered, "hero")!), id: "ally", down: true });
    assert.equal(morale(endTurn(unanswered, answered, 6).events).length, 0);
  }

  // ── Refused ──
  refused(fiveE({ ...saved, halfDownUnanswered: true }), /"halfDownUnanswered" goes with "on" naming "half-down"/);
  refused(fiveE({ ...saved, check: { save: "courage", difficulty: 10 } }), /Unknown save "courage"/);
  refused(fiveE({ ...saved, unlessImmune: "fearless" }), /Unknown condition "fearless"/);
  refused(fiveE({ ...rolled, hurtBelow: 0.3 }), /"hurtBelow" goes with "on" naming "hurt"/);
  refused(fiveE({ ...rolled, on: ["first-fall", "first-fall"] }), /Name each once/);
  refused(fiveE({ ...rolled, on: ["routed"] }), /on/);

  // ── The install gate ──
  {
    const gate =
      "A ruleset with losing heart in a fight (combat.morale, or a creature's morale score or leader) requires schemaVersion 2 and capabilityApi 1.762 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(761) as never, fiveE(saved)), gate);
    const scored = fiveE();
    scored.catalogs.find((one: { holds?: string }) => one.holds === "creatures").entries[0].creature.morale = 8;
    assert.equal(getCapabilityPackageInstallIssue(manifest(761) as never, scored), gate, "a morale score alone");
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(762) as never, fiveE(saved)), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(761) as never, fiveE()), gate);
    const gate759 =
      "A ruleset whose fighters lose heart when surprised or helpless (combat.morale.on), or only when half down unanswered (combat.morale.halfDownUnanswered), requires schemaVersion 2 and capabilityApi 1.775 or newer";
    for (const newer of [
      { ...saved, on: ["hurt", "surprised"] },
      { ...saved, on: ["helpless"] },
      { ...rolled, halfDownUnanswered: true },
    ]) {
      assert.equal(
        getCapabilityPackageInstallIssue(manifest(774) as never, fiveE(newer)),
        gate759,
        JSON.stringify(newer),
      );
      assert.notEqual(getCapabilityPackageInstallIssue(manifest(775) as never, fiveE(newer)), gate759);
    }
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(774) as never, fiveE(saved)), gate759);

    // ── Kinds that never give themselves up (1.785) ──
    const typed = (morale: unknown) => {
      const doc = fiveE(morale);
      doc.combat.creatureTypes = {
        types: [
          { id: "humanoid", label: "Humanoid" },
          { id: "undead", label: "Undead" },
        ],
      };
      return doc;
    };
    const stubborn = { ...saved, neverSurrender: ["undead"] };
    const definition = parsed(typed(stubborn));
    // A thinking ghoul hurt beside the hero fails its save and flees; a goblin beside it still yields.
    const outcomeOf = (type: string) =>
      morale(
        endTurn(definition, fight(definition, { gob: { block: block({ type }), at: { x: 2, y: 1 }, health: 6 } }), 1)
          .events,
      ).map((event) => event.outcome);
    assert.deepEqual(outcomeOf("undead"), ["flee"], "the undead never surrender");
    assert.deepEqual(outcomeOf("humanoid"), ["surrender"], "a goblin still does");
    refused(typed({ ...saved, neverSurrender: ["fiend"] }), /Unknown creature type "fiend"/);
    refused(typed({ ...saved, neverSurrender: ["undead", "undead"] }), /Name each once/);
    const gate769 =
      "A ruleset with creature types that never surrender (combat.morale.neverSurrender) requires schemaVersion 2 and capabilityApi 1.785 or newer";
    assert.equal(getCapabilityPackageInstallIssue(manifest(784) as never, typed(stubborn)), gate769);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(785) as never, typed(stubborn)), gate769);
  }

  console.log(
    "Combat morale: a broken goblin runs and gets away off the edge, one that holds is not asked again, a hurt thinker beside the hero surrenders, the fearless and the mindless never check; the director runs it off the board; surprised, helpless and half down unanswered (1.775); the undead never surrender (1.785); gated at 1.762, 1.775 and 1.785.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
