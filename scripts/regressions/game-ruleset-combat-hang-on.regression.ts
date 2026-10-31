/**
 * Hanging on at 1 instead of dropping to 0 (Capability API 1.400).
 *
 *   - A creature's save against the blow: Undead Fortitude, DC 5 + the damage, never against
 *     radiant or a critical hit.
 *   - The blow's size: a boar's Relentless, 7 or less, once.
 *   - A condition on a sheet spending a pool: Relentless Endurance, once until the pool refills.
 *   - A condition's save that grows each time, tallied on the sheet: Relentless Rage, DC 10 then 15.
 *   - A level's hang-on, the log line with no count, refusals and the install gate.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyRulesetCombatChoice,
  createRulesetEncounter,
  parseRulesetDefinition,
  rulesetCombatant,
  rulesetCombatHealth,
  readRulesetLive,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCombatChoice,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-hang-on-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 400);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const zombie = {
    id: "zombie",
    label: "Zombie",
    creature: {
      health: 5,
      defense: 8,
      initiativeModifier: 0,
      speed: 20,
      tier: "cr_1_4",
      saves: { con_save: 3 },
      hangsOn: {
        save: { save: "con_save", difficulty: 5, plusDamage: true },
        notFrom: ["radiant"],
        notCritical: true,
        label: "Undead Fortitude",
      },
      actions: [{ id: "slam", name: "Slam", budget: "action", toHit: 3, damage: { flat: 4 }, reach: 5 }],
    },
  };
  const document = (edit: (doc: Record<string, any>) => void = () => {}) => {
    const doc = JSON.parse(fiveEText);
    doc.catalogs.find((catalog: { holds?: string }) => catalog.holds === "creatures").entries.push(zombie);
    doc.sheet.live.pools.push(
      { id: "relentless_endurance", label: "Relentless Endurance", max: { const: 1 } },
      { id: "relentless_rage", label: "Relentless Rage", max: { const: 5 } },
    );
    doc.sheet.live.conditions.push(
      { id: "half_orc", label: "Relentless Endurance" },
      { id: "raging", label: "Raging" },
    );
    doc.combat.conditions.push(
      { condition: "half_orc", effects: [], hangsOn: { spends: "relentless_endurance" } },
      {
        condition: "raging",
        effects: [],
        hangsOn: { save: { save: "con_save", difficulty: 10, raisedBy: 5, tally: "relentless_rage" } },
      },
    );
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
  const definition = parsed(document());
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const blaster = (amount: number, type: string): RulesetStatBlock => ({
    health: 100,
    defense: 10,
    initiativeModifier: 0,
    speed: 30,
    actions: [
      { name: "Blast", budget: "action", toHit: 30, damage: { count: 0, sides: 0, flat: amount, type }, reach: 120 },
    ],
  });
  const who = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)!;
  const health = (state: RulesetEncounterState, id: string) =>
    rulesetCombatHealth(definition, definition.combat!, who(state, id)).value;

  // ── Creatures: Undead Fortitude and Relentless ──
  {
    const fight = (foe: RulesetStatBlock, hero: RulesetStatBlock, roll: () => number) => {
      const state = createRulesetEncounter({
        definition,
        seed: 1,
        roller: roll,
        combatants: [
          { id: "hero", name: "Hero", side: "enemy", block: hero },
          { id: "foe", name: "Foe", side: "enemy", block: foe },
        ],
      });
      who(state, "hero").side = "party";
      state.order = ["hero", "foe"];
      state.turn = 0;
      return state;
    };
    const blast = (state: RulesetEncounterState, roll: () => number = () => 10) => {
      const taken = applyRulesetCombatChoice(
        definition,
        state,
        { actorId: "hero", optionId: who(state, "hero").actions[0]!.id, targetIds: ["foe"] },
        roll,
      );
      assert.deepEqual(of(taken.events, "refused"), [], JSON.stringify(taken.events));
      return taken;
    };
    const zombieBlock = zombie.creature as unknown as RulesetStatBlock;
    // 8 slashing: DC 13, and 10 + 3 makes it.
    const made = blast(fight(zombieBlock, blaster(8, "slashing"), () => 10));
    assert.deepEqual(
      of(made.events, "save").map((one) => [one.save, one.difficulty, one.success]),
      [["con_save", 13, true]],
    );
    assert.deepEqual(of(made.events, "hangsOn"), [{ type: "hangsOn", actorId: "foe", label: "Undead Fortitude" }]);
    assert.equal(health(made.state, "foe"), 1);
    assert.ok(!who(made.state, "foe").defeated);
    // As often as the save holds: 1 more slashing is DC 6.
    who(made.state, "hero").budgets.action = 1;
    const again = blast(made.state);
    assert.equal(of(again.events, "hangsOn").length, 1, "no count of uses");
    // 20: DC 25, missed, and it is out.
    const missed = blast(fight(zombieBlock, blaster(20, "slashing"), () => 10));
    assert.equal(of(missed.events, "save")[0]?.difficulty, 25);
    assert.deepEqual(of(missed.events, "hangsOn"), []);
    assert.ok(who(missed.state, "foe").defeated);
    // Radiant: no save at all.
    const radiant = blast(fight(zombieBlock, blaster(8, "radiant"), () => 10));
    assert.deepEqual(of(radiant.events, "save"), []);
    assert.ok(who(radiant.state, "foe").defeated);
    // A critical hit: no save, however well it would have gone.
    const critical = blast(
      fight(zombieBlock, blaster(8, "slashing"), () => 20),
      () => 20,
    );
    assert.ok(of(critical.events, "damage").some((one) => one.critical));
    assert.deepEqual(of(critical.events, "hangsOn"), []);
    assert.ok(who(critical.state, "foe").defeated);
    // A boar's Relentless: 7 or less, once a fight.
    const boar = { ...zombieBlock, hangsOn: { uses: 1, dealtAtMost: 7 } } as RulesetStatBlock;
    const small = blast(fight(boar, blaster(7, "piercing"), () => 10));
    assert.deepEqual(of(small.events, "hangsOn"), [{ type: "hangsOn", actorId: "foe", left: 0 }]);
    who(small.state, "hero").budgets.action = 1;
    assert.ok(who(blast(small.state).state, "foe").defeated, "once only");
    assert.ok(who(blast(fight(boar, blaster(8, "piercing"), () => 10)).state, "foe").defeated, "8 is too much");
  }

  // ── Sheets: Relentless Endurance, Relentless Rage, and a level ──
  {
    const barbarian = (amount: number, conditions: string[], live: Record<string, unknown> = {}) => {
      const state = createRulesetEncounter({
        definition,
        seed: 1,
        roller: () => 10,
        combatants: [
          {
            id: "orc",
            name: "Orc",
            side: "party",
            build: rulesetSheetBuildSchema.parse({
              abilities: { str: 16, dex: 10, con: 16, int: 10, wis: 10, cha: 10 },
              fields: { level: 11, ac: 14, speed: 30, hp_max: 100 },
            }),
            live,
          },
          { id: "dummy", name: "Dummy", side: "enemy", block: blaster(amount, "slashing") },
        ],
      });
      for (const condition of conditions) who(state, "orc").tracked.push({ condition, rounds: null } as never);
      state.order = ["dummy", "orc"];
      state.turn = 0;
      return state;
    };
    const strike = (state: RulesetEncounterState) => {
      who(state, "dummy").budgets.action = 1;
      const choice: RulesetCombatChoice = {
        actorId: "dummy",
        optionId: who(state, "dummy").actions[0]!.id,
        targetIds: ["orc"],
      };
      const taken = applyRulesetCombatChoice(definition, state, choice, () => 10);
      assert.deepEqual(of(taken.events, "refused"), [], JSON.stringify(taken.events));
      return taken;
    };
    const pool = (state: RulesetEncounterState, key: string) =>
      (who(state, "orc").sheet!.live as { pools?: Record<string, { value: number }> }).pools?.[key]?.value;
    // Relentless Endurance: at 1, its pool spent, and down the next time.
    const endured = strike(barbarian(110, ["half_orc"]));
    assert.deepEqual(of(endured.events, "hangsOn"), [{ type: "hangsOn", actorId: "orc" }]);
    assert.equal(health(endured.state, "orc"), 1);
    assert.ok(!who(endured.state, "orc").down);
    assert.equal(pool(endured.state, "relentless_endurance"), 0);
    const spent = strike(endured.state);
    assert.deepEqual(of(spent.events, "hangsOn"), []);
    assert.ok(who(spent.state, "orc").down, "the pool is empty");
    // Already spent before the fight: nothing.
    const empty = strike(barbarian(110, ["half_orc"], { pools: { relentless_endurance: { value: 0 } } }));
    assert.ok(who(empty.state, "orc").down);
    // Relentless Rage: DC 10, made with 10 + 3; then DC 15, missed.
    const raged = strike(barbarian(110, ["raging"]));
    assert.deepEqual(
      of(raged.events, "save").map((one) => [one.difficulty, one.success]),
      [[10, true]],
    );
    assert.equal(health(raged.state, "orc"), 1);
    assert.equal(pool(raged.state, "relentless_rage"), 4, "one tallied");
    const second = strike(raged.state);
    assert.deepEqual(
      of(second.events, "save").map((one) => [one.difficulty, one.success]),
      [[15, false]],
    );
    assert.ok(who(second.state, "orc").down);
    // Tallied before the fight (two since the last rest): DC 20 from the start.
    const tallied = strike(barbarian(110, ["raging"], { pools: { relentless_rage: { value: 3 } } }));
    assert.equal(of(tallied.events, "save")[0]?.difficulty, 20);
    // A level's: exhaustion 1 hangs on once.
    const levelled = parsed(
      document((doc) => {
        doc.combat.levels[0].hangsOn = { uses: 1, label: "Grit" };
      }),
    );
    const state = barbarian(110, []);
    const orc = who(state, "orc");
    orc.sheet!.live = { ...orc.sheet!.live, tracks: { ...(orc.sheet!.live as any).tracks, exhaustion: 1 } } as never;
    const gritted = applyRulesetCombatChoice(
      levelled,
      state,
      { actorId: "dummy", optionId: who(state, "dummy").actions[0]!.id, targetIds: ["orc"] },
      () => 10,
    );
    assert.deepEqual(of(gritted.events, "hangsOn"), [{ type: "hangsOn", actorId: "orc", label: "Grit", left: 0 }]);
  }

  /** The rows the half-orc's and the barbarian's features write, and the hang-ons that name them. */
  const rowsEdit = (doc: Record<string, any>) => {
    // The rows the half-orc's and the barbarian's features write.
    doc.catalogs.push({
      id: "traits",
      label: "Traits",
      feeds: ["counters"],
      entries: [
        {
          id: "relentless-endurance",
          label: "Relentless Endurance",
          rows: [{ list: "counters", values: { name: "Relentless Endurance", max: 1, recharge: "long" } }],
        },
        {
          id: "relentless-rage",
          label: "Relentless Rage",
          rows: [{ list: "counters", values: { name: "Relentless Rage", max: 5, recharge: "short" } }],
        },
      ],
    });
    doc.sheet.live.conditions.push(
      { id: "endurance_row", label: "Relentless Endurance" },
      { id: "rage_feat", label: "Relentless Rage" },
    );
    doc.combat.conditions.push(
      { condition: "endurance_row", effects: [], hangsOn: { spends: "Relentless Endurance" } },
      {
        condition: "rage_feat",
        effects: [],
        hangsOn: {
          whileHolding: ["raging"],
          save: { save: "con_save", difficulty: 10, raisedBy: 5, tally: "Relentless Rage" },
        },
      },
    );
    // The rage condition itself no longer hangs on: the feature's does, while it holds.
    delete doc.combat.conditions.find((one: { condition: string }) => one.condition === "raging").hangsOn;
  };

  // ── A list row's pool, and only while raging (1.404) ──
  {
    const rows = parsed(document(rowsEdit));
    const orc = (amount: number, conditions: string[], counters: Array<Record<string, unknown>>) => {
      const state = createRulesetEncounter({
        definition: rows,
        seed: 1,
        roller: () => 10,
        combatants: [
          {
            id: "orc",
            name: "Orc",
            side: "party",
            build: rulesetSheetBuildSchema.parse({
              abilities: { str: 16, dex: 10, con: 16, int: 10, wis: 10, cha: 10 },
              fields: { level: 11, ac: 14, speed: 30, hp_max: 100 },
              lists: { counters },
            }),
            live: {},
          },
          { id: "dummy", name: "Dummy", side: "enemy", block: blaster(amount, "slashing") },
        ],
      });
      for (const condition of conditions) who(state, "orc").tracked.push({ condition, rounds: null } as never);
      state.order = ["dummy", "orc"];
      state.turn = 0;
      return state;
    };
    const strike = (state: RulesetEncounterState) => {
      who(state, "dummy").budgets.action = 1;
      const taken = applyRulesetCombatChoice(
        rows,
        state,
        { actorId: "dummy", optionId: who(state, "dummy").actions[0]!.id, targetIds: ["orc"] },
        () => 10,
      );
      assert.deepEqual(of(taken.events, "refused"), [], JSON.stringify(taken.events));
      return taken;
    };
    const row = (state: RulesetEncounterState, name: string) => {
      const sheet = who(state, "orc").sheet!;
      return readRulesetLive(rows, sheet.build, sheet.live).pools.find((one) => one.listId && one.label === name)
        ?.value;
    };
    const rowHealth = (state: RulesetEncounterState) =>
      rulesetCombatHealth(rows, rows.combat!, who(state, "orc")).value;
    // Relentless Endurance off the half-orc's counter row.
    const endured = strike(orc(110, ["endurance_row"], [{ name: "Relentless Endurance", max: 1, recharge: "long" }]));
    assert.deepEqual(of(endured.events, "hangsOn"), [{ type: "hangsOn", actorId: "orc" }]);
    assert.equal(rowHealth(endured.state), 1);
    assert.equal(row(endured.state, "Relentless Endurance"), 0, "the row's use spent");
    assert.ok(who(strike(endured.state).state, "orc").down, "and down the next time");
    // Relentless Rage: only while raging, its tally a counter row.
    const rageRow = [{ name: "Relentless Rage", max: 5, recharge: "short" }];
    const calm = strike(orc(110, ["rage_feat"], rageRow));
    assert.deepEqual(of(calm.events, "save"), [], "not raging: no save at all");
    assert.ok(who(calm.state, "orc").down);
    const raged = strike(orc(110, ["rage_feat", "raging"], rageRow));
    assert.deepEqual(
      of(raged.events, "save").map((one) => [one.difficulty, one.success]),
      [[10, true]],
    );
    assert.equal(row(raged.state, "Relentless Rage"), 4, "one tallied on the row");
    const second = strike(raged.state);
    assert.deepEqual(
      of(second.events, "save").map((one) => [one.difficulty, one.success]),
      [[15, false]],
    );
    // A row name nothing could hold is refused where no list keeps pools.
    refused(
      document((doc) => {
        doc.combat.conditions.at(-1).hangsOn = { spends: "Relentless Resolve" };
      }),
      /Unknown pool "Relentless Resolve"/,
    );
    refused(
      document((doc) => {
        doc.combat.conditions.at(-1).hangsOn = { uses: 1, whileHolding: ["furious"] };
      }),
      /Unknown condition "furious"/,
    );
  }

  // ── Rows written by catalogs in files of their own (1.405): checked once the files are beside it ──
  {
    const { readRulesetPackageFile } = await import("../../packages/server/src/services/game/ruleset-package-file.js");
    for (const fault of [false, true]) {
      const doc = document(rowsEdit);
      if (fault) doc.combat.conditions.at(-2).hangsOn = { spends: "Relentless Resolve" };
      const traits = doc.catalogs.find((catalog: { id: string }) => catalog.id === "traits");
      const file = JSON.stringify({ schemaVersion: 1, catalog: "traits", entries: traits.entries });
      delete traits.entries;
      traits.asset = "catalogs/traits.json";
      // Read on its own, the ruleset file cannot see the rows and takes the names on trust.
      parsed(doc);
      const documents = { "ruleset.json": JSON.stringify(doc), "catalogs/traits.json": file };
      const declared = {
        schemaVersion: 2,
        capabilityApi: { major: 1, minor: 405 },
        builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
        id: "ruleset-rows",
        name: "Rows",
        version: "0.1.0",
        description: "Rows.",
        engine: { min: "2.4.6", maxExclusive: "4.0.0" },
        kind: ["ruleset"],
        entrypoints: {},
        contributions: { assets: { paths: Object.keys(documents) } },
        files: Object.entries(documents).map(([path, text]) => ({
          path,
          bytes: Buffer.byteLength(text),
          sha256: createHash("sha256").update(text).digest("hex"),
        })),
        permissions: [],
        restartRequired: false,
      };
      const result = readRulesetPackageFile({
        format: "marinara-ruleset",
        version: 1,
        manifest: declared,
        files: Object.fromEntries(
          Object.entries(documents).map(([path, text]) => [path, Buffer.from(text).toString("base64")]),
        ),
      });
      assert.equal(result.ok, !fault, JSON.stringify(result));
      if (!result.ok) assert.match(result.issues.join("; "), /Unknown pool "Relentless Resolve"/);
      // And installed as a capability package, its catalog file beside it.
      const installed = getCapabilityPackageInstallIssue(
        declared as never,
        doc,
        new Map([["catalogs/traits.json", JSON.parse(file)]]),
      );
      if (fault) assert.match(installed ?? "", /Unknown pool "Relentless Resolve"/);
      else assert.doesNotMatch(installed ?? "", /Unknown pool/);
    }
  }

  // ── Refusals ──
  {
    const onZombie = (hangsOn: unknown) =>
      document((doc) => {
        doc.catalogs
          .find((catalog: { holds?: string }) => catalog.holds === "creatures")
          .entries.at(-1).creature.hangsOn = hangsOn;
      });
    refused(onZombie({ label: "Forever" }), /or it would work every time/);
    refused(onZombie({ spends: "relentless_endurance" }), /A creature has no sheet to spend/);
    refused(
      onZombie({ save: { save: "con_save", difficulty: 5, raisedBy: 5, tally: "relentless_rage" } }),
      /A creature has no sheet to keep "tally" on/,
    );
    refused(onZombie({ uses: 1, notFrom: ["holy"] }), /Unknown damage type "holy"/);
    refused(
      document((doc) => {
        doc.combat.conditions.at(-1).hangsOn = { spends: "nowhere" };
      }),
      /Unknown pool "nowhere"/,
    );
    refused(
      document((doc) => {
        doc.combat.conditions.at(-1).hangsOn = { save: { save: "luck_save", difficulty: 10 } };
      }),
      /Unknown save "luck_save"/,
    );
    refused(
      document((doc) => {
        doc.combat.conditions.at(-1).hangsOn = { save: { save: "con_save", difficulty: 10, tally: "relentless_rage" } };
      }),
      /"tally" counts what "raisedBy" raises/,
    );
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset that hangs on at 1 from a condition or a level, or on a save or the blow's own terms, requires schemaVersion 2 and capabilityApi 1.400 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(396) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(400) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(396) as never, JSON.parse(fiveEText)), gate);
    // A creature's 1.320 hang-on alone is not 1.400's.
    const hourglass = JSON.parse(fiveEText);
    hourglass.catalogs
      .find((catalog: { holds?: string }) => catalog.holds === "creatures")
      .entries.push({ ...zombie, creature: { ...zombie.creature, hangsOn: { uses: 1, extraTurn: true } } });
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(396) as never, hourglass), gate); // A list row's pool, or whileHolding: 1.404.
    const later =
      "A ruleset that hangs on at 1 off a list row's pool or only while holding a condition, or with a shape's saves and checks the better of two, requires schemaVersion 2 and capabilityApi 1.404 or newer";
    const rowSpend = document((doc) => {
      doc.combat.conditions.at(-1).hangsOn = { spends: "Relentless Endurance" };
    });
    assert.equal(getCapabilityPackageInstallIssue(manifest(403) as never, rowSpend), later);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(404) as never, rowSpend), later);
    assert.notEqual(
      getCapabilityPackageInstallIssue(manifest(403) as never, document()),
      later,
      "pool ids are 1.400's",
    );
    const holding = document((doc) => {
      doc.combat.conditions.at(-1).hangsOn.whileHolding = ["raging"];
    });
    assert.equal(getCapabilityPackageInstallIssue(manifest(403) as never, holding), later);
  }

  console.log(
    "Hanging on at 1: Undead Fortitude's save against the blow, never radiant or critical; Relentless by the blow's size; Relentless Endurance off a pool; Relentless Rage's growing save tallied on the sheet; a level's; gated at 1.400.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
