/**
 * Creatures called into a fight (Capability API 1.325).
 *
 *   - `calls` on a creature's action: Jars Burst calls two hounds beside the Owed on its own turn;
 *     they are on its side, named one by one, set down where there is room, and take their turns
 *     at their own initiative.
 *   - With an `area`, they appear where it is aimed: Shelves Lean, a lair action, calls 1d4 among
 *     the fallen shelves, and the turn the lair's count came between goes on as it was.
 *   - `"initiative": "after"` puts their turns right after their caller's.
 *   - A creature nobody can find calls nobody; refused shapes; the install gate.
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
  type RulesetCatalogEntriesById,
  type RulesetCombatChoice,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
} from "../../../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-calls-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../../../packages/server/src/services/capability-packages/package-manager.service.js");
const { rulesetController } =
  await import("../../../../packages/server/src/services/game/ruleset-combat-director.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 325);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const jars = {
    id: "jars",
    name: "Jars Burst",
    budget: "action",
    calls: { creature: "creatures/cinder-hound", count: { flat: 2 } },
  };
  const shelves = {
    id: "shelves",
    name: "Shelves Lean",
    budget: "action",
    lair: true,
    range: 120,
    area: { shape: "burst", size: 5, friendlyFire: false },
    calls: { creature: "creatures/cinder-hound", count: { dice: "1d4" } },
  };
  const bell = {
    id: "bell",
    name: "The Bell",
    budget: "action",
    calls: { creature: "creatures/cinder-hound", count: { flat: 2 }, initiative: "after" },
  };
  const hush = { id: "hush", name: "Hush", budget: "action", lair: true, calls: { ...bell.calls } };
  const lost = {
    id: "lost",
    name: "Nobody Comes",
    budget: "action",
    calls: { creature: "creatures/nobody", count: { flat: 1 } },
  };
  const owed = {
    id: "the-owed",
    label: "The Owed",
    creature: {
      health: 200,
      defense: 15,
      initiativeModifier: 0,
      speed: 30,
      tier: "cr_5",
      actions: [jars, shelves, bell, hush, lost],
    },
  };
  const withOwed = (edit: (doc: Record<string, any>) => void = () => {}) => {
    const doc = JSON.parse(fiveEText);
    doc.catalogs.find((catalog: { holds?: string }) => catalog.holds === "creatures").entries.push(owed);
    edit(doc);
    return doc;
  };
  const parsed = (doc: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(doc);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const definition = parsed(withOwed());
  const bestiary: RulesetCatalogEntriesById = {
    creatures: definition.catalogs!.find((catalog) => catalog.holds === "creatures")!.entries!,
  };
  const build = rulesetSheetBuildSchema.parse({
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    fields: { level: 5, ac: 12, speed: 30, hp_max: 50 },
  });
  // A d20 shows 10, anything smaller its most.
  const roll = (sides: number) => Math.min(sides, 10);
  const fight = (): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: roll,
      bestiary,
      combatants: [
        { id: "ada", name: "Ada", side: "party", build, live: {} },
        { id: "bo", name: "Bo", side: "party", build, live: {} },
        { id: "owed", name: "The Owed", side: "enemy", creature: { catalogId: "creatures", entryId: "the-owed" } },
      ],
      board: {
        grid: { width: 16, height: 10, tiles: Array.from({ length: 10 }, () => Array(16).fill("plains")) },
        placements: { ada: { x: 2, y: 2 }, bo: { x: 2, y: 6 }, owed: { x: 12, y: 4 } },
      },
      inLair: ["owed"],
    });
    for (const one of state.combatants) one.initiative = { ada: 22, owed: 21, bo: 5 }[one.id]!;
    state.order = ["ada", "owed", "bo"];
    state.turn = 0;
    return state;
  };
  const who = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)!;
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const step = (state: RulesetEncounterState, choice: RulesetCombatChoice) => {
    const taken = applyRulesetCombatChoice(definition, state, choice, roll);
    assert.deepEqual(of(taken.events, "refused"), [], JSON.stringify(taken.events));
    return taken;
  };
  const end = (state: RulesetEncounterState) =>
    step(state, { actorId: state.order[state.turn]!, optionId: "end-turn", targetIds: [] });
  /** Lets a window that is open go by. */
  const pass = (state: RulesetEncounterState) =>
    state.window
      ? step(state, {
          actorId: state.window.waiting[0]!,
          optionId: RULESET_PASS_OPTION,
          targetIds: [],
          window: state.window.id,
        }).state
      : state;
  const own = (state: RulesetEncounterState, id: string) => {
    state.turn = state.order.indexOf("owed");
    const option = rulesetCombatOptions(definition, state, "owed").find((one) => one.id === id);
    assert.ok(option, `${id}: ${rulesetCombatOptions(definition, state, "owed").map((one) => one.id)}`);
    return step(state, { actorId: "owed", optionId: id, targetIds: [] });
  };
  const near = (a: { x?: number; y?: number }, b: { x?: number; y?: number }) =>
    Math.max(Math.abs(a.x! - b.x!), Math.abs(a.y! - b.y!));

  // ── Jars Burst: two hounds beside the Owed, at their own initiative ──
  {
    const burst = own(fight(), "jars");
    const state = burst.state;
    const [called] = of(burst.events, "called");
    assert.deepEqual(called?.ids, ["called-1", "called-2"]);
    assert.equal(called?.label, "Jars Burst");
    const hounds = called!.ids.map((id) => who(state, id));
    assert.deepEqual(
      hounds.map((one) => [one.name, one.side, one.calledBy, one.initiative]),
      [
        ["Cinder Hound 1", "enemy", "owed", 11],
        ["Cinder Hound 2", "enemy", "owed", 11],
      ],
    );
    for (const hound of hounds) {
      assert.equal(near(hound, who(state, "owed")), 1, "beside the Owed");
      assert.ok(
        hound.actions.some((one) => one.id === "sear_bite"),
        "with their own blows",
      );
      assert.ok(hound.health!.max > 0);
      assert.deepEqual(hound.creature, { catalogId: "creatures", entryId: "cinder-hound" }, "drawn as itself");
    }
    assert.notDeepEqual([hounds[0]!.x, hounds[0]!.y], [hounds[1]!.x, hounds[1]!.y], "never on one cell");
    // 21, then 11 and 11, then 5: the Owed's turn goes on.
    assert.deepEqual(state.order, ["ada", "owed", "called-1", "called-2", "bo"]);
    assert.equal(state.order[state.turn], "owed");
    // The lair's count between the Owed's 21 and the hounds' 11 goes by.
    let next = pass(end(state).state);
    assert.equal(next.order[next.turn], "called-1", "the first hound's turn comes next");
    next = end(next).state;
    assert.equal(next.order[next.turn], "called-2");
    // Called by a slower caller, their count has passed: the caller's turn goes on, theirs is next round's.
    const slow = fight();
    who(slow, "owed").initiative = 3;
    slow.order = ["ada", "bo", "owed"];
    const late = own(slow, "jars");
    assert.deepEqual(late.state.order, ["ada", "called-1", "called-2", "bo", "owed"]);
    assert.equal(late.state.order[late.state.turn], "owed");
    const round2 = end(late.state).state;
    assert.equal(round2.round, 2);
    assert.equal(round2.order[round2.turn], "ada");
    // A turn put in after Bo's (the Hourglass's, 1.320) stays after Bo's.
    const put = fight();
    put.order = ["ada", "owed", "bo", "ada"];
    put.interjected = 3;
    const around = own(put, "jars");
    assert.deepEqual(around.state.order, ["ada", "owed", "called-1", "called-2", "bo", "ada"]);
    assert.equal(around.state.interjected, 5);
    // On whichever side calls them.
    const turned = fight();
    who(turned, "owed").side = "party";
    const friends = own(turned, "jars");
    assert.deepEqual(
      of(friends.events, "called")[0]!.ids.map((id) => who(friends.state, id).side),
      ["party", "party"],
    );
    // The Engine plays them, unless the player takes them.
    const fightState = { controllers: {}, bosses: [] } as unknown as Parameters<typeof rulesetController>[1];
    const hound = who(friends.state, "called-1");
    assert.equal(rulesetController({} as never, fightState, hound), "ai");
    assert.equal(rulesetController({} as never, fightState, who(friends.state, "ada")), "manual");
    assert.equal(
      rulesetController({} as never, { ...fightState, controllers: { "called-1": "manual" } }, hound),
      "manual",
    );
    // Called again, the names go on.
    const later = structuredClone(state);
    who(later, "owed").budgets.action = 1;
    const again = own(later, "jars");
    assert.deepEqual(
      of(again.events, "called")[0]!.ids.map((id) => who(again.state, id).name),
      ["Cinder Hound 3", "Cinder Hound 4"],
    );
  }

  // ── Shelves Lean: a lair action calling 1d4 where it is aimed ──
  {
    let state = fight();
    state = end(state).state;
    // 21 to 5 passes the lair's 20: its window, before Bo's turn.
    state = end(state).state;
    assert.equal(state.window?.kind, "signature");
    assert.ok(rulesetWindowOptions(definition, state, "owed").some((one) => one.id === "lair>shelves"));
    const leaned = step(state, {
      actorId: "owed",
      optionId: "lair>shelves",
      targetIds: [],
      at: { x: 5, y: 4 },
      window: state.window!.id,
    });
    state = leaned.state;
    const ids = of(leaned.events, "called")[0]!.ids;
    assert.equal(ids.length, 4, "a d4 thrown at its most");
    for (const id of ids) assert.ok(near(who(state, id), { x: 5, y: 4 }) <= 1, "among the shelves");
    // Their 11 comes before Bo's 5, which this round's turn has not passed: they act this round.
    assert.deepEqual(state.order, ["ada", "owed", ...ids, "bo"]);
    if (state.window) {
      state = step(state, {
        actorId: "owed",
        optionId: RULESET_PASS_OPTION,
        targetIds: [],
        window: state.window.id,
      }).state;
    }
    assert.equal(state.order[state.turn], ids[0], "the turn after the Owed's is the first called's");
  }

  // ── The Bell: right after the Owed; a lair call made after Bo's count waits for next round ──
  {
    const rung = own(fight(), "bell");
    assert.deepEqual(rung.state.order, ["ada", "owed", "called-1", "called-2", "bo"]);
    assert.equal(who(rung.state, "called-1").initiative, 21);
    // Ada's count is 22, the lair's 20: called after the Owed at 21, the hound's place comes before
    // the turn now going on (Bo's), so it is next round's.
    let state = fight();
    state.combatants.find((one) => one.id === "bo")!.initiative = 21;
    for (const one of state.combatants) if (one.id === "owed") one.initiative = 25;
    state.order = ["owed", "ada", "bo"];
    state.turn = 0;
    state = end(state).state;
    state = end(state).state;
    assert.equal(state.order[state.turn], "bo");
    state = end(state).state;
    assert.equal(state.window?.kind, "signature", "the lair's count, as Bo's turn ends");
    const hushed = step(state, {
      actorId: "owed",
      optionId: "lair>hush",
      targetIds: [],
      window: state.window!.id,
    });
    state = hushed.state;
    assert.deepEqual(state.order, ["owed", "called-1", "called-2", "ada", "bo"]);
    if (state.window) {
      state = step(state, {
        actorId: "owed",
        optionId: RULESET_PASS_OPTION,
        targetIds: [],
        window: state.window.id,
      }).state;
    }
    assert.equal(state.round, 2);
    assert.equal(state.order[state.turn], "owed", "round 2 starts with the Owed");
    state = end(state).state;
    assert.equal(state.order[state.turn], "called-1", "then the hound");
  }

  // ── A creature nobody can find calls nobody ──
  {
    const state = fight();
    assert.equal(
      who(state, "owed").actions.find((one) => one.id === "lost")?.calls,
      undefined,
      "found nowhere, it calls nobody",
    );
  }

  // ── Refused shapes ──
  {
    const refused = (calls: Record<string, unknown>, pattern: RegExp) => {
      const read = parseRulesetDefinition(
        withOwed((doc) => {
          const entry = doc.catalogs
            .find((catalog: { holds?: string }) => catalog.holds === "creatures")
            .entries.find((one: { id: string }) => one.id === "the-owed");
          entry.creature.actions = [{ ...jars, calls }];
        }),
      );
      assert.equal(read.ok, false, JSON.stringify(calls));
      if (!read.ok)
        assert.ok(
          read.issues.some((issue) => pattern.test(issue)),
          read.issues.join("; "),
        );
    };
    refused({ creature: "cinder-hound", count: { flat: 1 } }, /"<catalogId>\/<entryId>"/);
    refused({ creature: "creatures/cinder-hound", count: { flat: 0 } }, /at least one creature/);
    refused({ creature: "creatures/cinder-hound", count: {} }, /at least one creature/);
    refused({ creature: "creatures/cinder-hound", count: { flat: 1 }, initiative: "first" }, /initiative/);
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset with a creature action that calls creatures into the fight requires schemaVersion 2 and capabilityApi 1.325 or newer";
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
    const caller = JSON.parse(fiveEText);
    caller.catalogs
      .find((catalog: { holds?: string }) => catalog.holds === "creatures")
      .entries[0].creature.actions.push(structuredClone(jars));
    assert.equal(getCapabilityPackageInstallIssue(manifest(324) as never, caller), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(325) as never, caller), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(324) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "Calls: Jars Burst's hounds beside the Owed, Shelves Lean's where aimed, the Bell's right after it, and nobody for a creature found nowhere.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
