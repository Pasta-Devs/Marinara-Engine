/** A summoned weapon strikes on later turns, keeping its cast's payment level (Capability API 1.122). */
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
  rulesetOptionTargets,
  rulesetSheetBuildSchema,
  rulesetWindowOptions,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatEvent,
  type RulesetCombatRoller,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";
import type { TacticalGrid } from "../../packages/shared/src/features/tactical-combat/types.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-summons-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const summons = { budget: "bonus", rounds: 2, move: 20, reach: 5 };
  const weapon = (edit: Record<string, unknown> = {}): RulesetCatalogEntry =>
    ({
      id: "spiritual-weapon",
      label: "Spiritual Weapon",
      rows: [{ list: "spells", values: { name: "Spiritual Weapon", level: 2, prepared: true } }],
      mechanics: {
        kind: "attack",
        budget: "bonus",
        attackRoll: true,
        range: 60,
        amount: { dice: "1d8" },
        amountAdd: { abilityModFromField: "spellcasting_ability" },
        damageType: "force",
        cost: [{ pool: "slots_2", amount: 1 }],
        perCostStep: { dice: "1d8" },
        summons,
        ...edit,
      },
    }) as RulesetCatalogEntry;
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: [weapon()] });
    edit(doc);
    return doc;
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
      `${what}: ${parsed.issues.join("; ")}`,
    );
  };
  const definition = parsedOrThrow(fiveE(), "the 5e example with a summoned weapon");
  const dice = (...faces: number[]): RulesetCombatRoller => {
    let index = 0;
    return (sides) => {
      assert.ok(index < faces.length, `the script ran out of dice (a d${sides} was asked for)`);
      const face = faces[index++]!;
      assert.ok(face >= 1 && face <= sides, `${face} is a face of d${sides}`);
      return face;
    };
  };
  type EventOf<T extends RulesetCombatEvent["type"]> = Extract<RulesetCombatEvent, { type: T }>;
  const eventsOf = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T): EventOf<T>[] =>
    events.filter((event): event is EventOf<T> => event.type === type);
  const outcomes = (events: RulesetCombatEvent[]) => eventsOf(events, "summon").map((event) => event.outcome);
  const hurt = (events: RulesetCombatEvent[]) => eventsOf(events, "damage").map((event) => event.dealt);
  const line = (): TacticalGrid => ({ width: 30, height: 1, tiles: [Array.from({ length: 30 }, () => "plains")] });
  const snag: RulesetStatBlock = {
    health: 300,
    defense: 13,
    initiativeModifier: -10,
    speed: 30,
    actions: [{ id: "claw", name: "Claw", budget: "action", toHit: 4, damage: { count: 1, sides: 6, flat: 0 } }],
  } as RulesetStatBlock;
  const fight = (entry = weapon(), board = true, rules = definition): RulesetEncounterState =>
    createRulesetEncounter({
      definition: rules,
      seed: 1,
      roller: () => 10,
      ...(board ? { board: { grid: line(), placements: { corwin: { x: 0, y: 0 }, snag: { x: 4, y: 0 } } } } : {}),
      combatants: [
        {
          id: "corwin",
          name: "Corwin",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 20, con: 10, int: 16, wis: 16, cha: 10 },
            fields: {
              level: 7,
              ac: 12,
              speed: 30,
              hp_max: 30,
              spellcasting_ability: "wis",
              slots_max_2: 3,
              slots_max_3: 3,
              slots_max_4: 3,
            },
            lists: { spells: rowsFromCatalogEntry("spells", entry).map((row) => row.row) },
          }),
          live: {},
          catalogs: { spells: [entry] },
        },
        { id: "snag", name: "Snag", side: "enemy", block: snag },
      ],
    });
  const caster = (state: RulesetEncounterState) => rulesetCombatant(state, "corwin")!;
  const cast = (state: RulesetEncounterState, payWith?: string, faces = [15, 4], rules = definition) => {
    const option = rulesetCombatOptions(rules, state, "corwin").find(
      (one) => one.label === "Spiritual Weapon" && !one.id.startsWith("summon:"),
    );
    assert.ok(option, "the spell is offered");
    return applyRulesetCombatChoice(
      rules,
      state,
      { actorId: "corwin", optionId: option.id, targetIds: ["snag"], ...(payWith ? { payWith } : {}) },
      dice(...faces),
    );
  };
  const strikeOption = (state: RulesetEncounterState) =>
    rulesetCombatOptions(definition, state, "corwin").find((one) => one.id.startsWith("summon:"));
  const strike = (state: RulesetEncounterState, faces = [15, 4]) => {
    const option = strikeOption(state);
    assert.ok(option, "the summon can strike");
    return applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "corwin", optionId: option.id, targetIds: ["snag"] },
      dice(...faces),
    );
  };
  const endTurn = (state: RulesetEncounterState, actorId: string, ...faces: number[]) => {
    assert.equal(state.order[state.turn], actorId);
    return applyRulesetCombatChoice(
      definition,
      state,
      { actorId, optionId: "end-turn", targetIds: [] },
      dice(...faces),
    );
  };
  const nextTurn = (state: RulesetEncounterState) => endTurn(endTurn(state, "corwin").state, "snag").state;

  // The cast strikes once. Its own turn costs no duration; the later strike costs no slot.
  {
    const initial = fight();
    assert.equal(caster(initial).summons, undefined, "older fights need no summon record");
    const made = cast(initial);
    assert.deepEqual(hurt(made.events), [7]);
    assert.equal(eventsOf(made.events, "attack").length, 1);
    assert.deepEqual(outcomes(made.events), ["appeared"]);
    const actionId = caster(made.state).actions[0]!.id;
    assert.deepEqual(caster(made.state).summons, [
      { actionId, label: "Spiritual Weapon", budget: "bonus", rounds: 2, move: 4, reach: 1, at: { x: 3, y: 0 } },
    ]);
    assert.equal(strikeOption(made.state), undefined, "casting spent the bonus budget");
    assert.equal(caster(initial).summons, undefined, "the input state is unchanged");
    const next = nextTurn(JSON.parse(JSON.stringify(made.state)));
    assert.equal(caster(next).summons![0]!.rounds, 2, "the cast turn does not count, including after a save");
    const option = strikeOption(next)!;
    assert.equal(option.id, `summon:${actionId}`);
    assert.equal(option.label, "Spiritual Weapon");
    assert.equal(option.budget, "bonus");
    assert.deepEqual(option.targets, { side: "enemy", count: 1 });
    const live = structuredClone(caster(next).sheet!.live);
    rulesetCombatant(next, "snag")!.x = 8;
    next.board!.grid.tiles[0]![5] = "wall";
    assert.deepEqual(
      rulesetOptionTargets(definition, next, "corwin", option),
      ["snag"],
      "walls do not stop the weapon",
    );
    const struck = strike(next);
    assert.deepEqual(hurt(struck.events), [7]);
    assert.deepEqual(outcomes(struck.events), ["struck"]);
    assert.equal(eventsOf(struck.events, "attack").length, 1);
    assert.deepEqual(caster(struck.state).summons![0]!.at, { x: 7, y: 0 });
    assert.equal(caster(struck.state).summons!.length, 1);
    assert.equal(caster(struck.state).summons![0]!.rounds, 2);
    assert.deepEqual(caster(struck.state).sheet!.live, live);
    assert.deepEqual(eventsOf(struck.events, "spend"), []);
    assert.equal(caster(struck.state).budgets.bonus, 0);
    const firstEnd = endTurn(struck.state, "corwin");
    assert.equal(caster(firstEnd.state).summons![0]!.rounds, 1);
    const lastTurn = endTurn(firstEnd.state, "snag").state;
    assert.ok(strikeOption(lastTurn));
    const ended = endTurn(lastTurn, "corwin");
    assert.equal(caster(ended.state).summons, undefined);
    assert.deepEqual(outcomes(ended.events), ["ended"]);
    assert.equal(strikeOption(endTurn(ended.state, "snag").state), undefined);
  }

  // Range comes from the weapon, not its caster; no board means any standing enemy.
  {
    const state = nextTurn(cast(fight()).state);
    rulesetCombatant(state, "snag")!.x = 9;
    assert.equal(strikeOption(state), undefined, "beyond four movement cells and one reach cell");
    const refusedStrike = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "corwin", optionId: `summon:${caster(state).summons![0]!.actionId}`, targetIds: ["snag"] },
      dice(),
    );
    assert.equal(eventsOf(refusedStrike.events, "refused").length, 1);
    const unpositioned = nextTurn(cast(fight(weapon(), false)).state);
    assert.equal(caster(unpositioned).summons![0]!.at, undefined);
    assert.deepEqual(hurt(strike(unpositioned).events), [7]);
    rulesetCombatant(unpositioned, "snag")!.down = true;
    assert.equal(strikeOption(unpositioned), undefined, "only standing enemies");
    const fixed = nextTurn(cast(fight(weapon({ summons: { budget: "action", rounds: 1 } }))).state);
    assert.equal(strikeOption(fixed)!.budget, "action");
    rulesetCombatant(fixed, "snag")!.x = 5;
    assert.equal(strikeOption(fixed), undefined, "omitted movement is zero and reach is one cell");
  }

  // Recasting replaces one record; a missed first attack still summons.
  {
    const made = cast(nextTurn(cast(fight()).state));
    assert.deepEqual(outcomes(made.events), ["ended", "appeared"]);
    assert.equal(caster(made.state).summons!.length, 1);
    assert.equal(caster(nextTurn(made.state)).summons![0]!.rounds, 2);
    const missed = cast(fight(), undefined, [1]);
    assert.deepEqual(hurt(missed.events), []);
    assert.deepEqual(outcomes(missed.events), ["appeared"]);
  }

  // A higher pool's damage remains on every strike; no later sheet payment is attempted.
  {
    const made = cast(fight(), "slots_4", [15, 4, 5, 6]);
    assert.deepEqual(hurt(made.events), [18]);
    assert.equal(caster(made.state).summons![0]!.payWith, "slots_4");
    const next = nextTurn(made.state);
    caster(next).sheet!.live.pools = { ...caster(next).sheet!.live.pools, slots_2: 0, slots_3: 0, slots_4: 0 };
    assert.deepEqual(hurt(strike(next, [15, 4, 5, 6]).events), [18]);
  }

  // Each reaction moment is reopened; nothing appears before the last one closes.
  const answerAction = (on: "used" | "aimed" | "hit" | "harmed", cancels = false) => ({
    id: "answer",
    kind: "ability" as const,
    label: "Answer",
    budget: "reaction",
    range: { normal: 20 },
    targets: { side: "self" as const, count: 0 },
    reaction: { on, at: "self" as const, ...(cancels ? { cancels: true as const } : {}) },
  });
  const pass = (state: RulesetEncounterState, faces: number[]) =>
    applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "snag", optionId: "pass", targetIds: [], window: state.window!.id },
      dice(...faces),
    );
  for (const on of ["used", "aimed", "hit", "harmed"] as const) {
    const state = fight();
    rulesetCombatant(state, "snag")!.actions.push(answerAction(on));
    const before = on === "used" || on === "aimed" ? [] : on === "hit" ? [15] : [15, 4];
    const after = on === "used" || on === "aimed" ? [15, 4] : on === "hit" ? [4] : [];
    const held = cast(state, undefined, before);
    assert.equal(held.state.window?.trigger.kind, on);
    assert.equal(caster(held.state).summons, undefined, `${on}: no weapon while reactions wait`);
    const made = pass(JSON.parse(JSON.stringify(held.state)), after);
    assert.deepEqual(outcomes(made.events), ["appeared"]);
    if (on === "used") {
      // A later strike is no use of the spell: nothing answers it as one (no Counterspell for it).
      const struck = strike(nextTurn(made.state), after);
      assert.equal(struck.state.window, undefined, "a strike opens no used moment");
      assert.deepEqual(outcomes(struck.events), ["struck"]);
      continue;
    }
    const again = strike(nextTurn(made.state), before);
    assert.equal(again.state.window?.trigger.kind, on, `later strikes reopen ${on}`);
    const struck = pass(again.state, after);
    assert.deepEqual(outcomes(struck.events), ["struck"]);
    assert.equal(caster(struck.state).summons!.length, 1);
  }
  for (const on of ["used", "aimed"] as const) {
    const state = fight();
    rulesetCombatant(state, "snag")!.actions.push(answerAction(on, true));
    const held = cast(state, undefined, []);
    const answer = rulesetWindowOptions(definition, held.state, "snag").find((one) => one.id === "answer")!;
    assert.ok(answer);
    const cancelled = applyRulesetCombatChoice(
      definition,
      held.state,
      { actorId: "snag", optionId: answer.id, targetIds: [], window: held.state.window!.id },
      dice(),
    );
    assert.equal(caster(cancelled.state).summons, undefined);
    assert.deepEqual(hurt(cancelled.events), []);
    assert.deepEqual(outcomes(cancelled.events), []);
    assert.equal(eventsOf(cancelled.events, "cancelled").length, 1);
  }

  // Defeat removes non-concentration summons, and losing concentration removes only its own.
  {
    const state = cast(fight()).state;
    const holder = caster(state);
    holder.side = "enemy";
    rulesetCombatant(state, "snag")!.side = "party";
    rulesetCombatant(state, "snag")!.actions[0]!.damage = { count: 0, sides: 0, flat: 100 };
    rulesetCombatant(state, "snag")!.x = 1;
    const turn = endTurn(state, "corwin").state;
    const dead = applyRulesetCombatChoice(
      definition,
      turn,
      { actorId: "snag", optionId: rulesetCombatant(turn, "snag")!.actions[0]!.id, targetIds: ["corwin"] },
      dice(15),
    );
    assert.equal(caster(dead.state).defeated, true);
    assert.equal(caster(dead.state).summons, undefined);
    assert.deepEqual(outcomes(dead.events), ["ended"]);
    const held = cast(fight(weapon({ concentration: true }))).state;
    const next = nextTurn(held);
    const struck = strike(next);
    assert.equal(caster(struck.state).summons!.length, 1, "a strike does not replace concentration");
    assert.deepEqual(eventsOf(struck.events, "concentration"), []);
    const enemyTurn = endTurn(struck.state, "corwin").state;
    rulesetCombatant(enemyTurn, "snag")!.x = 1;
    const lost = applyRulesetCombatChoice(
      definition,
      enemyTurn,
      { actorId: "snag", optionId: rulesetCombatant(enemyTurn, "snag")!.actions[0]!.id, targetIds: ["corwin"] },
      dice(15, 4, 1),
    );
    assert.equal(caster(lost.state).concentrating, null);
    assert.equal(caster(lost.state).summons, undefined);
    assert.deepEqual(outcomes(lost.events), ["ended"]);
  }

  // Losing concentration in the last reaction window leaves nothing to appear afterwards.
  {
    const state = fight(weapon({ concentration: true }));
    rulesetCombatant(state, "snag")!.actions.push({
      ...answerAction("harmed"),
      targets: { side: "enemy", count: 1 },
      reaction: { on: "harmed", at: "source" },
      damage: { count: 0, sides: 0, flat: 1 },
    });
    const held = cast(state);
    assert.equal(held.state.window?.trigger.kind, "harmed");
    const lost = applyRulesetCombatChoice(
      definition,
      held.state,
      {
        actorId: "snag",
        optionId: "answer",
        targetIds: ["corwin"],
        window: held.state.window!.id,
      },
      dice(1),
    );
    assert.equal(caster(lost.state).concentrating, null);
    assert.equal(caster(lost.state).summons, undefined);
    assert.deepEqual(outcomes(lost.events), []);
  }

  // Placement skips occupied cells and walls beside the target.
  for (const occupied of [false, true]) {
    const state = fight();
    state.board!.grid = { width: 30, height: 3, tiles: [line().tiles[0]!, line().tiles[0]!, line().tiles[0]!] };
    caster(state).y = 1;
    rulesetCombatant(state, "snag")!.y = 1;
    if (occupied) {
      const ally = structuredClone(caster(state));
      ally.id = "ally";
      ally.x = 3;
      ally.y = 0;
      state.combatants.push(ally);
    } else state.board!.grid.tiles[0]![3] = "wall";
    assert.deepEqual(caster(cast(state).state).summons![0]!.at, { x: 4, y: 0 });
  }

  // A later strike counts towards a condition's attack cap just as the original attack does.
  {
    const slow = parsedOrThrow(
      fiveE((doc) => {
        doc.sheet.live.conditions.push({ id: "slowed", label: "Slowed" });
        doc.combat.conditions.push({ condition: "slowed", attacksPerTurn: 1 });
      }),
      "a condition that caps attacks",
    );
    const state = nextTurn(cast(fight()).state);
    caster(state).tracked.push({ condition: "slowed", rounds: null });
    const option = rulesetCombatOptions(slow, state, "corwin").find((one) => one.id.startsWith("summon:"))!;
    assert.ok(option);
    const struck = applyRulesetCombatChoice(
      slow,
      state,
      { actorId: "corwin", optionId: option.id, targetIds: ["snag"] },
      dice(15, 4),
    );
    assert.equal(caster(struck.state).flags.attacks, 1);
    caster(struck.state).budgets.bonus = 1;
    assert.equal(
      rulesetCombatOptions(slow, struck.state, "corwin").some((one) => one.id.startsWith("summon:")),
      false,
    );
  }

  // A party member's death saves can end it too; an older action still has no summon bookkeeping.
  {
    const state = cast(fight()).state;
    const ally = structuredClone(caster(state));
    ally.id = "ally";
    ally.summons = undefined;
    ally.x = 20;
    state.combatants.push(ally);
    caster(state).down = true;
    caster(state).dying = true;
    caster(state).sheet!.live.tracks = { death_save_failures: 2 };
    const enemyTurn = endTurn(state, "corwin").state;
    const dead = endTurn(enemyTurn, "snag", 2);
    assert.equal(caster(dead.state).defeated, true);
    assert.equal(caster(dead.state).summons, undefined);
    assert.deepEqual(outcomes(dead.events), ["ended"]);
    const old = cast(fight(weapon({ summons: undefined })));
    assert.deepEqual(hurt(old.events), [7]);
    assert.equal(caster(old.state).summons, undefined);
    assert.deepEqual(outcomes(old.events), []);
    assert.equal(caster(nextTurn(old.state)).summons, undefined);
  }

  // Import refuses each unsupported shape and cross-checks the economy.
  const documentWith = (edit: Record<string, unknown>) =>
    fiveE((doc) => {
      doc.catalogs.at(-1).entries = [weapon(edit)];
    });
  for (const kind of ["heal", "buff", "debuff", "utility", "rider"])
    refused(documentWith({ kind }), /Only an attack that targets enemies/, kind);
  for (const targets of ["self", "ally", "any"])
    refused(documentWith({ targets }), /Only an attack that targets enemies/, targets);
  parsedOrThrow(documentWith({ targets: "enemy" }), "explicit enemy targets");
  for (const rounds of [0, 101, 1.5])
    refused(documentWith({ summons: { ...summons, rounds } }), /rounds/, `rounds ${rounds}`);
  for (const key of ["move", "reach"])
    for (const value of [0, -1, Infinity])
      refused(documentWith({ summons: { ...summons, [key]: value } }), new RegExp(key), `${key} ${value}`);
  for (const key of ["budget", "rounds"]) {
    const shape: Record<string, unknown> = { ...summons };
    delete shape[key];
    refused(documentWith({ summons: shape }), new RegExp(key), `missing ${key}`);
  }
  refused(documentWith({ summons: { ...summons, budget: "nothing" } }), /Unknown budget "nothing"/, "unknown budget");
  refused(documentWith({ summons: { ...summons, budget: "bad budget" } }), /budget/, "invalid budget id");
  refused(documentWith({ summons: { ...summons, extra: 1 } }), /extra/, "strict summon");
  refused(
    fiveE((doc) => {
      delete doc.combat;
    }),
    /Unknown budget "bonus"/,
    "no economy",
  );
  parsedOrThrow(
    documentWith({ summons: { budget: "bonus", rounds: 100, move: 0.5, reach: 0.5 } }),
    "positive fractional distances and the duration ceiling",
  );

  // Both inline and file catalogs require 1.122, including manifest v1.
  const manifest = (minor: number) => ({
    schemaVersion: 2,
    capabilityApi: { major: 1, minor },
    builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
    id: "ruleset-summons",
    name: "Summons",
    version: "0.1.0",
    description: "A ruleset with summoned weapons.",
    engine: { min: "2.4.6", maxExclusive: "4.0.0" },
    kind: ["ruleset"],
    entrypoints: {},
    contributions: { assets: { paths: ["ruleset.json", "spells.json"] } },
    files: [{ path: "ruleset.json", sha256: "0".repeat(64), bytes: 10 }],
    permissions: [],
    restartRequired: false,
  });
  const gate =
    "A ruleset whose spells leave something behind that strikes on later turns requires schemaVersion 2 and capabilityApi 1.122 or newer";
  assert.equal(supportedCapabilityApi.major, 1);
  assert.ok(supportedCapabilityApi.minor >= 117);
  for (const file of [false, true]) {
    const doc = fiveE();
    const catalogs = new Map<string, unknown>();
    if (file) {
      const header = doc.catalogs.at(-1);
      catalogs.set("spells.json", { entries: header.entries });
      delete header.entries;
      header.asset = "spells.json";
    }
    assert.equal(getCapabilityPackageInstallIssue(manifest(121) as any, doc, catalogs), gate);
    assert.equal(getCapabilityPackageInstallIssue(manifest(122) as any, doc, catalogs), null);
    assert.match(
      getCapabilityPackageInstallIssue({ ...manifest(121), schemaVersion: 1 } as any, doc, catalogs) ?? "",
      /requires schemaVersion 2/,
    );
  }
  assert.equal(getCapabilityPackageInstallIssue(manifest(121) as any, JSON.parse(fiveEText)), null);
  // The editor exposes the same shape and its attack-only restriction.
  const schema = JSON.parse(
    readFileSync(fileURLToPath(new URL("../../docs/extending/ruleset.schema.json", import.meta.url)), "utf8"),
  );
  let found = 0;
  const visit = (node: any) => {
    if (!node || typeof node !== "object") return;
    if (node.properties?.summons) {
      found++;
      const summon = node.properties.summons;
      // No budget for one that strikes by itself as its summoner's turn starts (1.539).
      assert.deepEqual(summon.required, ["rounds"]);
      assert.equal(summon.additionalProperties, false);
      assert.equal(summon.properties.rounds.type, "integer");
      assert.equal(summon.properties.rounds.minimum, 1);
      // 100 rounds unless it strikes by itself (1.539), checked past the schema: up to a day.
      assert.equal(summon.properties.rounds.maximum, 14400);
      for (const key of ["move", "reach"]) assert.equal(summon.properties[key].exclusiveMinimum, 0);
      assert.deepEqual(node.allOf.find((rule: any) => rule.if?.required?.[0] === "summons").then.properties, {
        kind: { const: "attack" },
        targets: { const: "enemy" },
      });
    }
    Object.values(node).forEach(visit);
  };
  visit(schema);
  assert.ok(found > 0, "the editor includes summons");

  // The weapon strikes from its own square, as a swing: a foe beside its caster is no reason for
  // disadvantage, at the cast or later, and it is struck from beside the target wherever the caster
  // stands.
  {
    const near = fight();
    rulesetCombatant(near, "snag")!.x = 1;
    const made = cast(near);
    const first = eventsOf(made.events, "attack")[0]!;
    assert.notEqual(first.mode, "disadvantage", JSON.stringify(first));
    assert.ok(!(first.why?.down ?? []).includes("@crowded"), JSON.stringify(first));
    assert.deepEqual(caster(made.state).summons![0]!.at, { x: 2, y: 0 }, "it appears beside the target");
    assert.equal(caster(made.state).x, 0, "its caster has not moved");
    const later = strike(nextTurn(JSON.parse(JSON.stringify(made.state))));
    const second = eventsOf(later.events, "attack")[0]!;
    assert.notEqual(second.mode, "disadvantage", JSON.stringify(second));
    assert.equal(caster(later.state).x, 0);
    assert.equal(caster(later.state).actions[0]!.range?.normal !== undefined, true, "the cast keeps its range");
  }
  console.log(
    "Summons: later budget-only strikes, movement, duration, reactions, defeat, concentration, upcasts and import, struck from the summons' own square, gated at 1.122.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
