/**
 * Lair timing (Capability API 1.327).
 *
 *   - `actedOnly` on a creature's action: only somebody who has taken their turn this round may be
 *     picked (the Hour Bell); before the fight's very first turn, nobody has.
 *   - A condition's duration `untilLair`: off as whoever put it on next comes to their lair's count.
 *   - `brokenNextLair` on a concentration action: broken, its lair's next action is that one and no
 *     other (Father Ivo's Litany of Keeping, the shelves leaning); taken, the choice is free again.
 *   - Refused shapes, and the install gate.
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
  rulesetActedThisRound,
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetOpenLairWindow,
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

const dataDir = mkdtempSync(join(tmpdir(), "marinara-lair-timing-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 327);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const bell = {
    id: "bell",
    name: "The Hour Bell",
    budget: "action",
    lair: true,
    range: 120,
    autoHit: true,
    actedOnly: true,
    applies: [{ condition: "frightened", duration: { rounds: 10, untilLair: true } }],
  };
  const shelves = {
    id: "shelves",
    name: "Shelves Lean",
    budget: "action",
    lair: true,
    range: 120,
    autoHit: true,
    damage: { flat: 1, type: "bludgeoning" },
  };
  const litany = {
    id: "litany",
    name: "Litany of Keeping",
    budget: "bonus",
    self: true,
    concentration: true,
    applies: [{ condition: "invisible", duration: { rounds: 100 } }],
    brokenNextLair: "shelves",
  };
  const ivo = {
    id: "father-ivo",
    label: "Father Ivo",
    creature: {
      health: 200,
      defense: 10,
      initiativeModifier: 0,
      speed: 30,
      tier: "cr_5",
      saves: { con_save: -30 },
      actions: [bell, shelves, litany],
    },
  };
  const cat = {
    id: "cat",
    label: "Cat",
    creature: {
      health: 20,
      defense: 10,
      initiativeModifier: 0,
      speed: 40,
      tier: "cr_0",
      actions: [
        { id: "claw", name: "Claw", budget: "action", reach: 5, autoHit: true, damage: { flat: 4, type: "slashing" } },
      ],
    },
  };
  const withIvo = (edit: (doc: Record<string, any>) => void = () => {}) => {
    const doc = JSON.parse(fiveEText);
    doc.catalogs.find((catalog: { holds?: string }) => catalog.holds === "creatures").entries.push(ivo, cat);
    edit(doc);
    return doc;
  };
  const parsed = (doc: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(doc);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const definition = parsed(withIvo());
  const bestiary: RulesetCatalogEntriesById = {
    creatures: definition.catalogs!.find((catalog) => catalog.holds === "creatures")!.entries!,
  };
  const build = rulesetSheetBuildSchema.parse({
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    fields: { level: 5, ac: 12, speed: 30, hp_max: 50 },
  });
  const roll = (sides: number) => Math.min(sides, 10);
  const counts = { ada: 22, ivo: 21, cat: 21, bo: 5 };
  const fight = (initiative: Partial<typeof counts> = {}): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: roll,
      bestiary,
      combatants: [
        { id: "ada", name: "Ada", side: "party", build, live: {} },
        { id: "bo", name: "Bo", side: "party", build, live: {} },
        { id: "ivo", name: "Father Ivo", side: "enemy", creature: { catalogId: "creatures", entryId: "father-ivo" } },
        { id: "cat", name: "Cat", side: "enemy", creature: { catalogId: "creatures", entryId: "cat" } },
      ],
      board: {
        grid: { width: 16, height: 10, tiles: Array.from({ length: 10 }, () => Array(16).fill("plains")) },
        placements: { ada: { x: 2, y: 2 }, bo: { x: 2, y: 6 }, ivo: { x: 12, y: 4 }, cat: { x: 11, y: 4 } },
      },
      inLair: ["ivo"],
    });
    // The cat fights for the party, to break Ivo's concentration.
    rulesetCombatant(state, "cat")!.side = "party";
    const set = { ...counts, ...initiative };
    for (const one of state.combatants) one.initiative = set[one.id as keyof typeof counts];
    state.order = [...state.combatants].sort((a, b) => b.initiative - a.initiative).map((one) => one.id);
    state.turn = 0;
    return state;
  };
  const who = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)!;
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const apply = (state: RulesetEncounterState, choice: RulesetCombatChoice) =>
    applyRulesetCombatChoice(definition, state, choice, roll);
  const step = (state: RulesetEncounterState, choice: RulesetCombatChoice) => {
    const taken = apply(state, choice);
    assert.deepEqual(of(taken.events, "refused"), [], JSON.stringify(taken.events));
    return taken;
  };
  const end = (state: RulesetEncounterState) =>
    step(state, { actorId: state.order[state.turn]!, optionId: "end-turn", targetIds: [] });
  const lairIds = (state: RulesetEncounterState) =>
    rulesetWindowOptions(definition, state, "ivo")
      .filter((one) => one.id.startsWith("lair>"))
      .map((one) => one.id)
      .sort();
  const frightened = (state: RulesetEncounterState, id: string) =>
    who(state, id).tracked.some((entry) => entry.condition === "frightened");

  // ── The Hour Bell: only at whoever has acted this round, until the next lair action ──
  {
    // Ada 22, Ivo and the cat 21, the lair's 20, Bo 5.
    let state = fight();
    assert.deepEqual(state.order, ["ada", "ivo", "cat", "bo"]);
    assert.ok(rulesetActedThisRound(state, "ada"), "the first turn is going on");
    assert.ok(!rulesetActedThisRound(state, "bo"));
    state = end(state).state;
    state = end(state).state;
    state = end(state).state;
    assert.equal(state.window?.kind, "signature", "the lair's count, before Bo's turn");
    assert.deepEqual(lairIds(state), ["lair>bell", "lair>shelves"]);
    const bellAt = (targetIds: string[]) =>
      apply(state, { actorId: "ivo", optionId: "lair>bell", targetIds, window: state.window!.id });
    assert.equal(of(bellAt(["bo"]).events, "refused").length, 1, "Bo has not acted this round");
    const rung = bellAt(["ada"]);
    assert.deepEqual(of(rung.events, "refused"), [], JSON.stringify(rung.events));
    state = rung.state;
    assert.ok(frightened(state, "ada"));
    assert.equal(who(state, "ada").tracked.find((entry) => entry.condition === "frightened")?.untilLair, true);
    if (state.window) {
      state = step(state, {
        actorId: "ivo",
        optionId: RULESET_PASS_OPTION,
        targetIds: [],
        window: state.window.id,
      }).state;
    }
    // Bo's turn, round 2's Ada, Ivo and the cat: still frightened.
    assert.equal(state.order[state.turn], "bo");
    state = end(state).state;
    assert.equal(state.round, 2);
    assert.deepEqual(state.acted, ["ada"], "afresh as the round turns");
    state = end(state).state;
    state = end(state).state;
    assert.ok(frightened(state, "ada"), "until the lair's count");
    const counted = end(state);
    assert.equal(counted.state.window?.kind, "signature");
    assert.ok(!frightened(counted.state, "ada"), "off as the lair's count comes");
    assert.ok(
      of(counted.events, "condition").some(
        (one) => one.targetId === "ada" && one.condition === "frightened" && !one.active,
      ),
    );
  }

  // ── Before the very first turn, nobody has acted ──
  {
    const early = rulesetOpenLairWindow(definition, fight({ ada: 15, ivo: 12, cat: 11, bo: 5 }));
    assert.equal(early.window?.kind, "signature", "the lair's count comes before everybody's");
    assert.ok(!rulesetActedThisRound(early, "ada"), "Ada's turn has not begun");
    const rung = apply(early, { actorId: "ivo", optionId: "lair>bell", targetIds: ["ada"], window: early.window!.id });
    assert.equal(of(rung.events, "refused").length, 1);
  }

  // ── The Litany broken: Shelves Lean next, and only it ──
  {
    let state = fight();
    state = end(state).state;
    // Ivo's turn: the Litany.
    assert.equal(state.order[state.turn], "ivo");
    state = step(state, { actorId: "ivo", optionId: "litany", targetIds: [] }).state;
    assert.equal(who(state, "ivo").concentrating?.actionId, "litany");
    state = end(state).state;
    // The cat's claw breaks it: a Constitution save of -30.
    assert.equal(state.order[state.turn], "cat");
    const clawed = step(state, { actorId: "cat", optionId: "claw", targetIds: ["ivo"] });
    state = clawed.state;
    assert.equal(who(state, "ivo").concentrating, null, JSON.stringify(clawed.events));
    assert.equal(who(state, "ivo").lair?.next, "shelves");
    state = end(state).state;
    assert.equal(state.window?.kind, "signature");
    assert.deepEqual(lairIds(state), ["lair>shelves"], "only the shelves");
    state = step(state, {
      actorId: "ivo",
      optionId: "lair>shelves",
      targetIds: ["bo"],
      window: state.window!.id,
    }).state;
    assert.equal(who(state, "ivo").lair?.next, undefined, "taken, the choice is free again");
    // Ended by Ivo's own choice, nothing is forced.
    let again = fight();
    again = end(again).state;
    again = step(again, { actorId: "ivo", optionId: "litany", targetIds: [] }).state;
    who(again, "ivo").budgets.bonus = 1;
    again = step(again, { actorId: "ivo", optionId: "litany", targetIds: [] }).state;
    assert.equal(who(again, "ivo").lair?.next, undefined, "a Litany begun again is not a broken one");
  }

  // ── Refused shapes, and the gate ──
  {
    const refused = (edit: (actions: Record<string, unknown>[]) => void, pattern: RegExp) => {
      const read = parseRulesetDefinition(
        withIvo((doc) => {
          const entry = doc.catalogs
            .find((catalog: { holds?: string }) => catalog.holds === "creatures")
            .entries.find((one: { id: string }) => one.id === "father-ivo");
          edit(entry.creature.actions);
        }),
      );
      assert.equal(read.ok, false);
      if (!read.ok)
        assert.ok(
          read.issues.some((issue) => pattern.test(issue)),
          read.issues.join("; "),
        );
    };
    refused((actions) => {
      actions[2] = { ...litany, brokenNextLair: "litany" };
    }, /"litany" is not one of its lair actions/);
    refused((actions) => {
      const { concentration: _held, ...loose } = litany;
      actions[2] = loose;
    }, /held by its concentration/);
    const gate =
      "A ruleset with a creature action only at whoever has acted this round, a broken concentration that picks the next lair action, or a condition lasting until the next lair action requires schemaVersion 2 and capabilityApi 1.327 or newer";
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
    const only = (action: Record<string, unknown>) => {
      const doc = JSON.parse(fiveEText);
      doc.catalogs
        .find((catalog: { holds?: string }) => catalog.holds === "creatures")
        .entries[0].creature.actions.push(action);
      return doc;
    };
    const { applies: _applies, ...bare } = bell;
    for (const doc of [
      only({ ...bare, lair: undefined }),
      only({
        ...shelves,
        lair: undefined,
        applies: [{ condition: "frightened", duration: { rounds: 1, untilLair: true } }],
      }),
      withIvo(),
    ]) {
      assert.equal(getCapabilityPackageInstallIssue(manifest(326) as never, doc), gate);
      assert.notEqual(getCapabilityPackageInstallIssue(manifest(327) as never, doc), gate);
    }
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(326) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "Lair timing: the Hour Bell only at who has acted, until the next lair action; the Litany broken leaves only the shelves.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
