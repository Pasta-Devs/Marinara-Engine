/**
 * A teleport with a strike before or after it (Capability API 1.280).
 *
 *   - A creature's teleport may name one of its own actions as `strike`: a blink dog's "Before or
 *     after teleporting, the dog can make one bite attack." Teleporting lets the bite follow for
 *     nothing, once; the menu also offers "Bite, then Teleport", on the teleport's budget, which lets
 *     the teleport follow for nothing, once. Neither chains into a third.
 *   - The strike made first spends the teleport's uses (and its own) as the teleport would.
 *   - Off a board a teleport goes nowhere, so nothing is paired.
 *   - The director teleports a dog too slow to walk there in and bites in the same turn.
 *   - Import refusals and the install gate.
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
  rulesetCombatOptions,
  RULESET_MOVE_OPTION,
  rulesetSheetBuildSchema,
  rulesetWindowOptions,
  supportedCapabilityApi,
  type RulesetCombatChoice,
  type RulesetCombatStep,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../../../packages/shared/src/index.js";
import type { TacticalGrid } from "../../../../packages/shared/src/features/tactical-combat/types.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-teleport-strike-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../../../packages/server/src/services/capability-packages/package-manager.service.js");
const { createCombatDirector } = await import("../../../../packages/server/src/services/game/combat-director.service.js");
const { commandRulesetCombatDirector, createRulesetFight, rulesetDirectorStage, syncRulesetCombatants } =
  await import("../../../../packages/server/src/services/game/ruleset-combat-director.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 275);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    edit(doc);
    return doc;
  };
  const parsed = (document: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(document);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const refusedDoc = (edit: (doc: Record<string, any>) => void, message: RegExp) => {
    const result = parseRulesetDefinition(fiveE(edit));
    assert.equal(result.ok, false, `expected a refusal matching ${message}`);
    assert.ok(
      !result.ok && result.issues.some((issue) => message.test(issue)),
      !result.ok ? result.issues.join("; ") : "",
    );
  };
  const definition = parsed(fiveE());
  const bite = {
    id: "bite",
    name: "Bite",
    budget: "action",
    toHit: 4,
    reach: 5,
    damage: { count: 1, sides: 6, flat: 1 },
  };
  const blink = (extra: Record<string, unknown> = {}) => ({
    id: "blink",
    name: "Teleport",
    budget: "action",
    teleport: { distance: 40, seen: true, strike: "bite" },
    ...extra,
  });
  const block = (actions: unknown[]): RulesetStatBlock =>
    ({ health: 22, defense: 13, initiativeModifier: 3, speed: 40, actions }) as unknown as RulesetStatBlock;
  const grid: TacticalGrid = {
    width: 20,
    height: 15,
    tiles: Array.from({ length: 15 }, () => Array.from({ length: 20 }, () => "plains")),
  };
  const build = rulesetSheetBuildSchema.parse({
    abilities: { str: 10, dex: 10, con: 14, int: 10, wis: 10, cha: 10 },
    fields: { level: 5, ac: 12, speed: 30, hp_max: 60 },
  });
  const fight = (
    options: { dog?: { x: number; y: number }; board?: false; actions?: unknown[] } = {},
  ): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        { id: "hero", name: "Hero", side: "party", build, live: {} },
        { id: "dog", name: "Dog", side: "enemy", block: block(options.actions ?? [bite, blink()]) },
      ],
      ...(options.board === false
        ? {}
        : { board: { grid, placements: { hero: { x: 2, y: 7 }, dog: options.dog ?? { x: 8, y: 7 } } } }),
    });
    state.order = ["hero", "dog"];
    state.turn = 1;
    return state;
  };
  const roll = () => 10;
  const who = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)!;
  const refused = (step: RulesetCombatStep) => step.events.find((one) => one.type === "refused");
  const optionOf = (state: RulesetEncounterState, label: string) =>
    rulesetCombatOptions(definition, state, "dog").find((one) => one.label === label);
  const go = (state: RulesetEncounterState, label: string, extra: Partial<RulesetCombatChoice>) => {
    const option = optionOf(state, label);
    assert.ok(option, `the dog has no ${label}`);
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "dog", optionId: option.id, targetIds: [], ...extra },
      roll,
    );
    assert.equal(refused(step), undefined, JSON.stringify(refused(step)));
    return step;
  };
  const hits = (step: RulesetCombatStep) =>
    step.events.filter((one) => one.type === "attack" && one.actorId === "dog" && one.targetId === "hero").length;

  // ── The menu: Bite, Teleport, and Bite then Teleport on the teleport's budget ──
  {
    const state = fight();
    const first = optionOf(state, "Bite, then Teleport");
    assert.ok(first, "the bite before the teleport is offered");
    assert.equal(first!.budget, "action");
    assert.deepEqual(first!.targets, { side: "enemy", count: 1 });
    assert.ok(optionOf(state, "Teleport")?.teleport, "and the teleport, with its cells");
    assert.ok(optionOf(state, "Bite"), "and the plain bite");
  }

  // ── Teleport, then the bite for nothing, once ──
  {
    const state = fight();
    const ported = go(state, "Teleport", { at: { x: 3, y: 7 } });
    assert.deepEqual({ x: who(ported.state, "dog").x, y: who(ported.state, "dog").y }, { x: 3, y: 7 });
    assert.equal(who(ported.state, "dog").budgets.action, 0, "the teleport spent the action");
    const after = optionOf(ported.state, "Bite");
    assert.ok(after, "the bite follows");
    assert.equal(after!.budget, undefined, "for nothing");
    assert.equal(after!.followUp, true);
    assert.equal(optionOf(ported.state, "Bite, then Teleport"), undefined, "no bite first with the action spent");
    assert.equal(optionOf(ported.state, "Teleport"), undefined, "and no second teleport");
    const bitten = go(ported.state, "Bite", { targetIds: ["hero"] });
    assert.equal(hits(bitten), 1, "the bite is made");
    assert.equal(optionOf(bitten.state, "Bite"), undefined, "once");
    assert.equal(optionOf(bitten.state, "Teleport"), undefined, "and it does not lead back to the teleport");
    // A bite not taken on the dog's own turn is not had later, out of it: walked away from, it is an
    // opportunity attack on the reaction, not the bite its teleport let follow.
    const ended = applyRulesetCombatChoice(
      definition,
      ported.state,
      {
        actorId: "dog",
        optionId: rulesetCombatOptions(definition, ported.state, "dog").find((one) => one.kind === "end-turn")!.id,
        targetIds: [],
      },
      roll,
    );
    assert.deepEqual(who(ended.state, "dog").flags.followUps, [{ id: "bite" }], "still owed until its next turn");
    const walked = applyRulesetCombatChoice(
      definition,
      ended.state,
      { actorId: "hero", optionId: RULESET_MOVE_OPTION, targetIds: [], to: { x: 2, y: 11 } },
      roll,
    );
    assert.equal(refused(walked), undefined, JSON.stringify(refused(walked)));
    assert.deepEqual(walked.state.window?.waiting, ["dog"], "the dog may strike at the walk");
    const answer = rulesetWindowOptions(definition, walked.state, "dog").find((one) => one.label === "Bite");
    assert.ok(answer, "with its bite");
    assert.equal(answer!.budget, "reaction", "on its reaction");
    assert.equal(answer!.followUp, undefined);
  }

  // ── The bite first, then the teleport for nothing, once ──
  {
    const state = fight({ dog: { x: 3, y: 7 } });
    const bitten = go(state, "Bite, then Teleport", { targetIds: ["hero"] });
    assert.equal(hits(bitten), 1, "the bite is made");
    assert.equal(who(bitten.state, "dog").budgets.action, 0, "on the action");
    const after = optionOf(bitten.state, "Teleport");
    assert.ok(after?.teleport?.cells.length, "the teleport follows, with where it may go");
    assert.equal(after!.budget, undefined, "for nothing");
    assert.equal(optionOf(bitten.state, "Bite"), undefined, "no second bite");
    const ported = go(bitten.state, "Teleport", { at: { x: 10, y: 4 } });
    assert.deepEqual({ x: who(ported.state, "dog").x, y: who(ported.state, "dog").y }, { x: 10, y: 4 });
    assert.equal(optionOf(ported.state, "Teleport"), undefined, "once");
    assert.equal(optionOf(ported.state, "Bite"), undefined, "and it does not lead back to the bite");
  }

  // ── The bite first spends the teleport's uses ──
  {
    const state = fight({ dog: { x: 3, y: 7 }, actions: [bite, blink({ uses: { per: "encounter", count: 1 } })] });
    const bitten = go(state, "Bite, then Teleport", { targetIds: ["hero"] });
    assert.equal(who(bitten.state, "dog").uses.blink, 0, "the teleport's one use is gone");
    // Its follow-up was paid for with the bite, so it spends no use of its own.
    const ported = go(bitten.state, "Teleport", { at: { x: 10, y: 4 } });
    assert.equal(ported.events.filter((event) => event.type === "uses").length, 0, "nothing more is spent");
    const dog = who(ported.state, "dog");
    // A turn later, nothing that teleports is left.
    dog.budgets.action = 1;
    dog.flags = {};
    assert.equal(optionOf(ported.state, "Teleport"), undefined, "no teleport left");
    assert.equal(optionOf(ported.state, "Bite, then Teleport"), undefined, "nor the bite before one");
    assert.ok(optionOf(ported.state, "Bite"), "the bite alone still is");
  }

  // ── Off a board nothing is paired ──
  {
    const plain = fight({ board: false });
    assert.equal(optionOf(plain, "Bite, then Teleport"), undefined);
    assert.ok(optionOf(plain, "Bite"));
  }

  // ── The director: a dog too slow to walk there teleports in and bites in the same turn ──
  {
    const withDog = parsed(
      fiveE((doc) => {
        const creatures = doc.catalogs.find((one: { holds?: string }) => one.holds === "creatures");
        const dog = structuredClone(creatures.entries.find((one: { id: string }) => one.id === "thorn-lurker"));
        dog.id = "blinker";
        dog.label = "Blinker";
        dog.creature.speed = 5;
        dog.creature.actions = [{ ...bite, damage: { dice: "1d6", flat: 1 } }, blink()];
        creatures.entries.push(dog);
      }),
    );
    const bestiary = Object.fromEntries(
      (withDog.catalogs ?? []).flatMap((catalog) =>
        catalog.holds === "creatures" && catalog.entries ? [[catalog.id, catalog.entries]] : [],
      ),
    );
    const creaturesId = (withDog.catalogs ?? []).find((catalog) => catalog.holds === "creatures")!.id;
    const built = createRulesetFight({
      definition: withDog,
      seed: 3,
      positioned: true,
      party: [{ id: "ada", name: "Ada" }],
      enemies: [{ id: "dog", name: "Blinker", creature: `${creaturesId}/blinker` }],
      cards: [{ name: "Ada", rulesetSheet: { v: 1, build: defaultRulesetSheetBuild(withDog) } }],
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
      enemies: [unit("dog", "Blinker", "enemy")],
      gm: false,
      difficulty: "normal",
      seed: 3,
    } as never);
    state.rulesetFight = (built as { fight: never }).fight;
    const encounter = state.rulesetFight!.encounter;
    assert.ok(encounter.board, "fought on a board");
    // Six cells apart, so walking will not do and a teleport will.
    const dog = rulesetCombatant(encounter, "dog")!;
    const ada = rulesetCombatant(encounter, "ada")!;
    const grid = encounter.board!.grid;
    const spot = (() => {
      for (let y = 0; y < grid.height; y++)
        for (let x = 0; x < grid.width; x++) {
          const tile = String(grid.tiles[y]?.[x] ?? "");
          if (Math.max(Math.abs(x - ada.x!), Math.abs(y - ada.y!)) === 6 && !/wall|water|tree|rock|cliff/.test(tile))
            return { x, y };
        }
      return null;
    })();
    assert.ok(spot, "somewhere six cells off");
    dog.x = spot!.x;
    dog.y = spot!.y;
    syncRulesetCombatants(withDog, state);
    state.stage = rulesetDirectorStage(state);
    assert.ok(commandRulesetCombatDirector(withDog, state, { type: "control", unitId: "ada", controller: "ai" }).ok);
    const said = () => state.rulesetFight!.events.map((entry) => entry.event);
    for (let guard = 0; guard < 8 && !state.outcome; guard++) {
      assert.ok(commandRulesetCombatDirector(withDog, state, { type: "continue" }).ok);
    }
    // Its first turn: in by teleport, then the bite, on the one action.
    const kinds = said()
      .filter((event) => "actorId" in event && event.actorId === "dog")
      .map((event) => event.type);
    const first = kinds.slice(0, kinds.indexOf("turn", 1) === -1 ? undefined : kinds.indexOf("turn", 1));
    assert.ok(first.includes("teleported"), JSON.stringify(first));
    assert.ok(first.indexOf("attack") > first.indexOf("teleported"), JSON.stringify(first));
  }

  // ── Import refusals ──
  {
    const withCreature = (actions: unknown[]) => (doc: Record<string, any>) => {
      doc.catalogs.push({
        id: "beasts",
        label: "Beasts",
        holds: "creatures",
        entries: [
          {
            id: "d",
            label: "D",
            // A creature writes its dice as text.
            creature: {
              ...block(actions.map((one) => (one === bite ? { ...bite, damage: { dice: "1d6", flat: 1 } } : one))),
              tier: "cr_0",
            },
          },
        ],
      });
    };
    parsed(fiveE(withCreature([bite, blink()])));
    refusedDoc(withCreature([blink()]), /Unknown action "bite"/);
    refusedDoc(
      withCreature([bite, blink({ teleport: { distance: 40, strike: "blink" } })]),
      /A teleport's strike is another action, not the teleport itself/,
    );
    refusedDoc(
      withCreature([
        bite,
        { id: "pair", name: "Pair", budget: "action", sequence: [{ action: "bite", times: 2 }] },
        blink({ teleport: { distance: 40, strike: "pair" } }),
      ]),
      /"pair" is a reaction, a sequence, a teleport or bought with points, so it is no teleport's strike/,
    );
    refusedDoc(
      withCreature([
        bite,
        { id: "hop", name: "Hop", budget: "bonus", teleport: { distance: 10 } },
        blink({ teleport: { distance: 40, strike: "hop" } }),
      ]),
      /"hop" is a reaction, a sequence, a teleport or bought with points/,
    );
    refusedDoc((doc) => {
      doc.catalogs.push({
        id: "x",
        label: "X",
        feeds: ["spells"],
        entries: [
          {
            id: "m",
            label: "M",
            rows: [{ list: "spells", values: { name: "M", level: 2, prepared: true } }],
            mechanics: { kind: "utility", teleport: { distance: 30, strike: "bite" } },
          },
        ],
      });
    }, /A teleport's strike is one of a creature's own actions, so only a creature's teleport names one/);
    refusedDoc((doc) => {
      doc.items = { categories: [{ id: "gear", label: "Gear" }] };
      doc.catalogs.push({
        id: "gear",
        label: "Gear",
        holds: "items",
        entries: [
          {
            id: "c",
            label: "Cape",
            item: {
              category: "gear",
              use: { budget: "action", kind: "utility", teleport: { distance: 30, strike: "x" } },
            },
          },
        ],
      });
    }, /A teleport's strike is one of a creature's own actions, so only a creature's teleport names one/);
  }

  // ── The install gate ──
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
      "A ruleset with a creature's teleport that strikes before or after it requires schemaVersion 2 and capabilityApi 1.280 or newer";
    const doc = fiveE((one) => {
      one.catalogs.push({
        id: "x",
        label: "X",
        entries: [{ id: "dog", label: "Dog", creature: { actions: [bite, blink()] } }],
      });
    });
    assert.equal(getCapabilityPackageInstallIssue(manifest(279) as never, doc), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(280) as never, doc), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(279) as never, fiveE()), gate, "the plain 5e example");
  }

  console.log(
    "Ruleset teleport strikes: a blink dog bites after its teleport or before it, once, on one action, sharing the teleport's uses, and nothing is paired off a board.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
