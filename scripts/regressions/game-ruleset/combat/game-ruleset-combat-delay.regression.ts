/**
 * What a slowing condition holds over to its holder's next turn (Capability API 1.120): 5e's Slow.
 *
 *   - `delays: { catalogs, budget, chance }` on a combat condition: an action out of those catalogs,
 *     paid with that budget, rolls the die; at `atLeast` or more it waits.
 *   - As its maker's next turn begins it is completed with the same budget and lands; unable to act,
 *     it is lost. What it cost stays spent.
 *   - Anything else (a weapon, another budget, below the number) goes off as made.
 *   - Import and the install gate (1.120).
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
  rowsFromCatalogEntry,
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  type RulesetCatalogEntry,
  type RulesetCombatantInput,
  type RulesetCombatEvent,
  type RulesetCombatRoller,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-delay-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");

const { getCapabilityPackageInstallIssue } =
  await import("../../../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    edit(doc);
    return doc;
  };
  const slowing = { catalogs: ["spells"], budget: "action", chance: { sides: 20, atLeast: 11 } };
  const bolt = {
    id: "bolt",
    label: "Bolt",
    rows: [{ list: "spells", values: { name: "Bolt", level: 1, prepared: true } }],
    mechanics: { kind: "attack", autoHit: true, amount: { flat: 4 }, damageType: "fire" },
  } as unknown as RulesetCatalogEntry;
  const withSlow = (doc: Record<string, any>, delays: Record<string, unknown> = slowing) => {
    doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: [bolt] });
    doc.sheet.live.conditions.push({ id: "slowed", label: "Slowed" });
    doc.combat.conditions.push({ condition: "slowed", delays });
  };
  const parsedOrThrow = (document: unknown, what: string): RulesetDefinition => {
    const parsed = parseRulesetDefinition(document);
    assert.ok(parsed.ok, `${what} must import cleanly: ${parsed.ok ? "" : parsed.issues.join("; ")}`);
    return parsed.definition;
  };
  const refused = (document: unknown, pattern: RegExp, what: string) => {
    const parsed = parseRulesetDefinition(document);
    assert.equal(parsed.ok, false, `${what}: the file should be refused`);
    if (parsed.ok) return;
    assert.ok(
      parsed.issues.some((issue) => pattern.test(issue)),
      `${what}: expected ${pattern}, got ${parsed.issues.join("; ")}`,
    );
  };
  const definition = parsedOrThrow(fiveE(withSlow), "the 5e example with Slow");
  const dice = (...faces: number[]): RulesetCombatRoller => {
    let index = 0;
    return (sides) => {
      assert.ok(index < faces.length, `the script ran out of dice (a d${sides} was asked for)`);
      return faces[index++]!;
    };
  };
  type EventOf<T extends RulesetCombatEvent["type"]> = Extract<RulesetCombatEvent, { type: T }>;
  const eventsOf = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T): EventOf<T>[] =>
    events.filter((event): event is EventOf<T> => event.type === type);

  const snag: RulesetStatBlock = {
    health: 60,
    defense: 13,
    initiativeModifier: -10,
    speed: 30,
    actions: [{ id: "claw", name: "Claw", budget: "action", toHit: 4, damage: { count: 1, sides: 6, flat: 0 } }],
  } as RulesetStatBlock;
  /** Corwin first, slowed, with a bolt and a longsword; then Snag. */
  const fight = (): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        {
          id: "corwin",
          name: "Corwin",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 16, dex: 20, con: 10, int: 10, wis: 16, cha: 10 },
            fields: { level: 3, ac: 12, speed: 30, hp_max: 30 },
            lists: {
              spells: rowsFromCatalogEntry("spells", bolt).map((row) => row.row),
              attacks: [
                {
                  name: "Longsword",
                  ability: "str",
                  proficient: true,
                  bonus: 0,
                  damage: "1d8",
                  damage_type: "slashing",
                },
              ],
            },
          }),
          live: {},
          catalogs: { spells: [bolt] },
        },
        { id: "snag", name: "Snag", side: "enemy", block: snag } as RulesetCombatantInput,
      ],
    });
    rulesetCombatant(state, "corwin")!.tracked.push({ condition: "slowed", rounds: null });
    return state;
  };
  const use = (state: RulesetEncounterState, label: string, ...faces: number[]) => {
    const option = rulesetCombatOptions(definition, state, "corwin").find((one) => one.label === label);
    assert.ok(option, `Corwin has ${label}`);
    return applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "corwin", optionId: option.id, targetIds: ["snag"] },
      dice(...faces),
    );
  };
  const endTurn = (state: RulesetEncounterState, actorId: string, ...faces: number[]) => {
    assert.equal(state.order[state.turn], actorId, `it is ${actorId}'s turn`);
    return applyRulesetCombatChoice(
      definition,
      state,
      { actorId, optionId: "end-turn", targetIds: [] },
      dice(...faces),
    );
  };
  const snagHurt = (events: RulesetCombatEvent[]) =>
    eventsOf(events, "damage")
      .filter((event) => event.targetId === "snag")
      .map((event) => event.dealt);

  // ── Below the number: it goes off at once ──
  {
    const now = use(fight(), "Bolt", 10);
    assert.deepEqual(eventsOf(now.events, "delay"), [
      { type: "delay", actorId: "corwin", label: "Bolt", outcome: "now", roll: 10, needed: 11 },
    ]);
    assert.deepEqual(snagHurt(now.events), [4]);
    assert.equal(rulesetCombatant(now.state, "corwin")!.delayed, undefined);
  }

  // ── At it: held, then completed as the next turn begins ──
  {
    const held = use(fight(), "Bolt", 11);
    assert.deepEqual(
      eventsOf(held.events, "delay").map((event) => event.outcome),
      ["held"],
    );
    assert.deepEqual(snagHurt(held.events), [], "nothing lands yet");
    const corwin = rulesetCombatant(held.state, "corwin")!;
    assert.equal(corwin.delayed?.label, "Bolt");
    assert.equal(corwin.delayed?.budget, "action");
    assert.equal(corwin.budgets.action, 0, "the action it was made with is spent");
    const snagsTurn = endTurn(held.state, "corwin");
    assert.deepEqual(snagHurt(snagsTurn.events), []);
    const next = endTurn(snagsTurn.state, "snag");
    assert.deepEqual(
      eventsOf(next.events, "delay").map((event) => event.outcome),
      ["completed"],
    );
    assert.deepEqual(snagHurt(next.events), [4], "it lands as Corwin's next turn begins");
    assert.equal(rulesetCombatant(next.state, "corwin")!.budgets.action, 0, "completing it takes that turn's action");
    assert.equal(rulesetCombatant(next.state, "corwin")!.delayed, undefined);
  }

  // Daze skips the next turn before a delayed action can complete (1.147 + 1.120).
  {
    const held = use(fight(), "Bolt", 11);
    const snagsTurn = endTurn(held.state, "corwin");
    rulesetCombatant(snagsTurn.state, "corwin")!.dazed = {};
    const skipped = endTurn(snagsTurn.state, "snag");
    assert.deepEqual(eventsOf(skipped.events, "skip"), [{ type: "skip", actorId: "corwin", reason: "daze" }]);
    assert.deepEqual(eventsOf(skipped.events, "delay"), []);
    assert.deepEqual(snagHurt(skipped.events), []);
    assert.equal(rulesetCombatant(skipped.state, "corwin")!.delayed?.label, "Bolt");
    assert.equal(rulesetCombatant(skipped.state, "corwin")!.dazed, undefined);
    const resumed = endTurn(skipped.state, "snag");
    assert.deepEqual(
      eventsOf(resumed.events, "delay").map((event) => event.outcome),
      ["completed"],
    );
    assert.deepEqual(snagHurt(resumed.events), [4]);
    assert.equal(rulesetCombatant(resumed.state, "corwin")!.delayed, undefined);
  }

  // ── Unable to act, it is lost ──
  {
    const held = use(fight(), "Bolt", 15);
    const snagsTurn = endTurn(held.state, "corwin");
    rulesetCombatant(snagsTurn.state, "corwin")!.tracked.push({ condition: "stunned", rounds: null });
    const next = endTurn(snagsTurn.state, "snag");
    assert.deepEqual(eventsOf(next.events, "delay"), [
      { type: "delay", actorId: "corwin", label: "Bolt", outcome: "lost" },
    ]);
    assert.deepEqual(snagHurt(next.events), []);
    assert.equal(rulesetCombatant(next.state, "corwin")!.delayed, undefined, "and not tried again");
  }

  // ── A weapon is not slowed, and nor is anything without the condition ──
  {
    const swung = use(fight(), "Longsword", 15, 3);
    assert.deepEqual(eventsOf(swung.events, "delay"), [], "no die for a weapon");
    assert.equal(eventsOf(swung.events, "attack").length, 1, "it is swung at once");
    assert.equal(rulesetCombatant(swung.state, "corwin")!.delayed, undefined);
    const quick = fight();
    rulesetCombatant(quick, "corwin")!.tracked = [];
    const free = use(quick, "Bolt");
    assert.deepEqual(eventsOf(free.events, "delay"), []);
    assert.deepEqual(snagHurt(free.events), [4]);
    // Slowed only on another budget: the action is not.
    const other = parsedOrThrow(
      fiveE((doc) => withSlow(doc, { ...slowing, budget: "bonus" })),
      "Slow on bonus",
    );
    const state = createRulesetEncounter({ ...fightInput(), definition: other });
    rulesetCombatant(state, "corwin")!.tracked.push({ condition: "slowed", rounds: null });
    const option = rulesetCombatOptions(other, state, "corwin").find((one) => one.label === "Bolt")!;
    const made = applyRulesetCombatChoice(
      other,
      state,
      { actorId: "corwin", optionId: option.id, targetIds: ["snag"] },
      dice(),
    );
    assert.deepEqual(eventsOf(made.events, "delay"), []);
  }

  // ── Import ──
  {
    refused(
      fiveE((doc) => withSlow(doc, { ...slowing, chance: { sides: 20, atLeast: 21 } })),
      /more than its die can show/,
      "a number the die never shows",
    );
    refused(
      fiveE((doc) => withSlow(doc, { ...slowing, catalogs: ["scrolls"] })),
      /Unknown catalog "scrolls"/,
      "a catalog",
    );
    refused(
      fiveE((doc) => withSlow(doc, { ...slowing, budget: "nothing" })),
      /nothing/,
      "a budget",
    );
  }

  // ── The install gate: 1.120 ──
  {
    const manifest = (minor: number) => ({
      schemaVersion: 2,
      capabilityApi: { major: 1, minor },
      builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
      id: "ruleset-slow",
      name: "Slow",
      version: "0.1.0",
      description: "A packaged ruleset whose Slow delays spells.",
      engine: { min: "2.4.6", maxExclusive: "4.0.0" },
      kind: ["ruleset"],
      entrypoints: {},
      contributions: { assets: { paths: ["ruleset.json"] } },
      files: [{ path: "ruleset.json", sha256: "0".repeat(64), bytes: 10 }],
      permissions: [],
      restartRequired: false,
    });
    const gate = /hold what their holder uses.*capabilityApi 1\.120/;
    const issue = (minor: number, doc: Record<string, any>) =>
      getCapabilityPackageInstallIssue(manifest(minor) as any, doc);
    assert.match(
      issue(
        119,
        fiveE((doc) => withSlow(doc)),
      ) ?? "",
      gate,
    );
    assert.doesNotMatch(
      issue(
        120,
        fiveE((doc) => withSlow(doc)),
      ) ?? "",
      gate,
    );
    assert.doesNotMatch(issue(119, fiveE()) ?? "", gate, "the example as shipped asks nothing new");
  }

  console.log("Delay: a slowed caster's spell waits for their next turn, or is lost, gated at 1.120.");

  function fightInput() {
    const state = fight();
    return {
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        {
          id: "corwin",
          name: "Corwin",
          side: "party" as const,
          build: rulesetCombatant(state, "corwin")!.sheet!.build,
          live: {},
          catalogs: { spells: [bolt] },
        },
        { id: "snag", name: "Snag", side: "enemy", block: snag } as RulesetCombatantInput,
      ],
    };
  }
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
