/**
 * Heightened's target and Acid Arrow (Capability API 1.255).
 *
 *   - Heightened gives the target its user picks (`heightens`) disadvantage on their first save,
 *     the pick holding through a window; left out, the first it catches.
 *   - `halfOnMiss`: an attack spell's miss still deals half its damage and puts nothing on.
 *   - An applied condition's `harmsPerCostStep`: what it harms with grows with the slot it was cast at.
 *   - Refusals, import refusals and the install gate.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  RULESET_PASS_OPTION,
  advanceRulesetTurn,
  applyRulesetCombatChoice,
  createRulesetEncounter,
  parseRulesetDefinition,
  readRulesetLive,
  rowsFromCatalogEntry,
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatantInput,
  type RulesetCombatChoice,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../../../packages/shared/src/index.js";
import type { TacticalGrid } from "../../../../packages/shared/src/features/tactical-combat/types.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-acid-arrow-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 250);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const spell = (id: string, label: string, mechanics: Record<string, unknown>, level = 1) => ({
    id,
    label,
    rows: [{ list: "spells", values: { name: label, level, prepared: true } }],
    mechanics: {
      kind: "attack",
      autoHit: true,
      damageType: "fire",
      ...(level > 0 ? { cost: [{ pool: `slots_${level}`, amount: 1 }] } : {}),
      ...mechanics,
    },
  });
  const spells = [
    spell("bolt", "Bolt", { range: 60, amount: { dice: "2d10" } }),
    spell("touch", "Touch", { range: 0, amount: { flat: 3 } }),
    spell("swift", "Swift", { range: 60, budget: "bonus", amount: { flat: 2 } }),
    spell("firebolt", "Firebolt", { range: 120, amount: { dice: "1d10" } }, 0),
    spell("frost", "Frost", { range: 60, amount: { dice: "2d10" }, plus: [{ dice: "2d10", type: "cold" }] }),
    spell("ray", "Ray", { range: 60, autoHit: false, attackRoll: true, amount: { dice: "2d10" } }),
    spell(
      "acid-arrow",
      "Acid Arrow",
      {
        range: 90,
        autoHit: false,
        attackRoll: true,
        damageType: "acid",
        amount: { dice: "4d4" },
        perCostStep: { dice: "1d4" },
        halfOnMiss: true,
        applies: [{ condition: "acid", duration: { rounds: 1 }, harmsPerCostStep: { dice: "1d4" } }],
      },
      2,
    ),
    spell("thorn", "Thorn", {
      range: 60,
      autoHit: false,
      attackRoll: true,
      amount: { dice: "2d10" },
      plus: [{ dice: "2d10", type: "cold" }],
      maxAgainst: { types: ["plant"] },
    }),
    spell("burst", "Burst", {
      range: 60,
      area: { shape: "burst", size: 10 },
      amount: { flat: 10 },
      save: { save: "dex_save", onSuccess: "half" },
    }),
    spell("hold", "Hold", {
      kind: "debuff",
      range: 60,
      save: { save: "wis_save", onSuccess: "negates" },
      applies: [{ condition: "held", duration: { rounds: 10 } }],
      components: ["verbal", "somatic"],
    }),
    {
      id: "counter",
      label: "Counter",
      rows: [{ list: "spells", values: { name: "Counter", level: 3, prepared: true } }],
      mechanics: {
        kind: "utility",
        budget: "reaction",
        cost: [{ pool: "slots_3", amount: 1 }],
        reaction: { on: "used", cancels: true, against: { catalogs: ["spells"] } },
      },
    },
  ] as unknown as RulesetCatalogEntry[];
  const meta = (id: string, label: string, alters: Record<string, unknown>, price: Record<string, unknown> = {}) => ({
    id,
    label,
    rows: [{ list: "features", values: { name: label } }],
    mechanics: { kind: "utility", usesOf: "Sorcery Points", alters: { catalogs: ["spells"], ...alters }, ...price },
  });
  const sorcery = [
    {
      id: "points",
      label: "Font of Magic",
      rows: [
        { list: "features", values: { name: "Font of Magic" } },
        { list: "counters", values: { name: "Sorcery Points", max: 5, recharge: "long" } },
      ],
    },
    meta("careful", "Careful Spell", { spares: { abilityMod: "cha" } }),
    meta("distant", "Distant Spell", { range: { times: 2, touch: 30 } }),
    meta("empowered", "Empowered Spell", { rerolls: { abilityMod: "cha" }, joins: true }),
    meta("extended", "Extended Spell", { lasts: 2 }),
    meta("heightened", "Heightened Spell", { heightens: true }, { usesSpent: 3 }),
    meta("quickened", "Quickened Spell", { budget: { from: "action", to: "bonus" } }, { usesSpent: 2 }),
    meta("subtle", "Subtle Spell", { drops: ["verbal", "somatic"] }),
    meta("twinned", "Twinned Spell", { twins: true }, { usesSpentByLevel: true }),
  ] as unknown as RulesetCatalogEntry[];
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.combat.components = [
      { id: "verbal", label: "Verbal" },
      { id: "somatic", label: "Somatic" },
    ];
    doc.combat.creatureTypes = {
      types: ["humanoid", "plant"].map((id) => ({ id, label: id })),
      default: "humanoid",
    };
    doc.sheet.live.conditions.push({ id: "acid", label: "Acid" });
    doc.combat.conditions.push({
      condition: "acid",
      effects: [],
      harms: { at: "turn-end", dice: "2d4", type: "acid" },
    });
    doc.sheet.live.conditions.push({ id: "held", label: "Held" }, { id: "gagged", label: "Gagged" });
    doc.combat.conditions.push({ condition: "gagged", effects: [], forbids: { components: ["verbal"] } });
    doc.catalogs.push(
      { id: "spells", label: "Spells", feeds: ["spells"], entries: structuredClone(spells) },
      { id: "sorcery", label: "Sorcery", feeds: ["features", "counters"], entries: structuredClone(sorcery) },
    );
    edit(doc);
    return doc;
  };
  const parsed = (document: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(document);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const definition = parsed(fiveE());
  const rows = (catalog: string, entries: RulesetCatalogEntry[], list: string) =>
    entries.flatMap((entry) =>
      rowsFromCatalogEntry(catalog, entry).flatMap((one) => (one.list === list ? [one.row] : [])),
    );
  const sheet = (withSorcery: boolean, spellList = spells) =>
    rulesetSheetBuildSchema.parse({
      // Cha 16: +3, so Careful spares three and Empowered rerolls three.
      abilities: { str: 8, dex: 10, con: 14, int: 10, wis: 10, cha: 16 },
      fields: {
        level: 9,
        ac: 12,
        speed: 30,
        hp_max: 60,
        spellcasting_ability: "cha",
        slots_max_1: 4,
        slots_max_2: 3,
        slots_max_3: 3,
      },
      lists: {
        spells: rows("spells", spellList, "spells"),
        ...(withSorcery
          ? { features: rows("sorcery", sorcery, "features"), counters: rows("sorcery", sorcery, "counters") }
          : {}),
      },
    });
  const block = (): RulesetStatBlock =>
    ({
      health: 100,
      defense: 5,
      initiativeModifier: 0,
      speed: 30,
      saves: { dex_save: 0, wis_save: 0 },
      actions: [],
    }) as unknown as RulesetStatBlock;
  const grid = (): TacticalGrid => ({
    width: 30,
    height: 15,
    tiles: Array.from({ length: 15 }, () => Array(30).fill("plains")),
  });
  // The d20s in the order they are thrown; every d10 from the queue, then 5; anything else 3.
  let d20s: number[] = [];
  let d10s: number[] = [];
  const roll = (sides: number) => (sides === 20 ? (d20s.shift() ?? 10) : sides === 10 ? (d10s.shift() ?? 5) : 3);
  const fight = (
    options: { placements?: Record<string, { x: number; y: number }>; extra?: RulesetCombatantInput[] } = {},
  ): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: roll,
      bestiary: { spells },
      combatants: [
        {
          id: "sorc",
          name: "Sorcerer",
          side: "party",
          build: sheet(true),
          live: {},
          catalogs: { spells, sorcery },
        },
        { id: "ally", name: "Ally", side: "party", build: sheet(false, []), live: {} },
        { id: "a", name: "A", side: "enemy", block: block() },
        { id: "b", name: "B", side: "enemy", block: block() },
        ...(options.extra ?? []),
      ],
      board: {
        grid: grid(),
        placements: {
          sorc: { x: 2, y: 7 },
          ally: { x: 9, y: 7 },
          a: { x: 10, y: 7 },
          b: { x: 11, y: 7 },
          ...options.placements,
        },
      },
    });
    state.order = state.combatants.map((one) => one.id);
    state.turn = 0;
    return state;
  };
  const who = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)!;
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const optionOf = (state: RulesetEncounterState, label: string) =>
    rulesetCombatOptions(definition, state, "sorc").find((one) => one.label === label);
  const metaId = (state: RulesetEncounterState, label: string) =>
    who(state, "sorc").actions.find((one) => one.label === label)!.id;
  const points = (state: RulesetEncounterState) => {
    const sorc = who(state, "sorc");
    return readRulesetLive(definition, sorc.sheet!.build, sorc.sheet!.live).pools.find(
      (one) => one.key === "counters:sorcery points",
    )?.value;
  };
  const cast = (
    state: RulesetEncounterState,
    label: string,
    alters: string[],
    choice: Partial<RulesetCombatChoice> = {},
  ) => {
    const option = optionOf(state, label);
    assert.ok(option, `no ${label}`);
    return applyRulesetCombatChoice(
      definition,
      state,
      {
        actorId: "sorc",
        optionId: option.id,
        targetIds: [],
        ...choice,
        ...(alters.length ? { alters: alters.map((one) => metaId(state, one)) } : {}),
      },
      roll,
    );
  };
  const ok = (step: ReturnType<typeof cast>) => {
    assert.equal(of(step.events, "refused").length, 0, JSON.stringify(of(step.events, "refused")));
    return step;
  };
  const refusedWith = (step: ReturnType<typeof cast>, reason: string) => {
    assert.deepEqual(
      of(step.events, "refused").map((one) => one.reason),
      [reason],
    );
  };

  const toTurnOf = (state: RulesetEncounterState, id: string) => {
    const events: RulesetCombatEvent[] = [];
    for (let guard = 0; guard < 10; guard++) {
      const step = advanceRulesetTurn(definition, state, roll);
      events.push(...step.events);
      Object.assign(state, step.state);
      if (state.order[state.turn] === id) return events;
    }
    assert.fail(`never reached ${id}`);
  };
  const harmOf = (events: RulesetCombatEvent[], target: string) =>
    of(events, "damage")
      .filter((one) => one.targetId === target)
      .map((one) => one.amount);

  // ── Heightened: its user picks who rolls at a disadvantage ──
  {
    const state = fight();
    d20s = [20, 20, 20];
    const step = ok(cast(state, "Burst", ["Heightened Spell"], { at: { x: 10, y: 7 }, heightens: "b" }));
    const saves = of(step.events, "save");
    assert.equal(saves.find((one) => one.actorId === "b")?.mode, "disadvantage", "the one picked");
    assert.notEqual(saves.find((one) => one.actorId === "a")?.mode, "disadvantage", "not the first caught");
    assert.equal(optionOf(fight(), "Burst")!.alters!.find((one) => one.label === "Heightened Spell")!.heightens, true);
    const first = fight();
    d20s = [20, 20, 20];
    const plain = ok(cast(first, "Burst", ["Heightened Spell"], { at: { x: 10, y: 7 } }));
    assert.equal(of(plain.events, "save")[0]!.mode, "disadvantage", "left out, the first it catches");
    // Picked, and held for a window that answers the cast.
    const counter = {
      extra: [
        {
          id: "mage",
          name: "Mage",
          side: "enemy",
          block: { sheet: sheet(false), actions: [] },
        } as RulesetCombatantInput,
      ],
      placements: { mage: { x: 2, y: 8 } },
    };
    const seen = fight(counter);
    seen.order = ["sorc", "mage", "ally", "a", "b"];
    const held = ok(cast(seen, "Burst", ["Heightened Spell"], { at: { x: 10, y: 7 }, heightens: "b" }));
    assert.ok(held.state.window, "answered");
    d20s = [20, 20, 20];
    const through = ok(
      applyRulesetCombatChoice(
        definition,
        held.state,
        { actorId: "mage", optionId: RULESET_PASS_OPTION, targetIds: [], window: held.state.window!.id },
        roll,
      ),
    );
    const after = of(through.events, "save");
    assert.equal(after.find((one) => one.actorId === "b")?.mode, "disadvantage", "the pick holds");
    assert.notEqual(after.find((one) => one.actorId === "a")?.mode, "disadvantage");
  }

  // ── Acid Arrow: half on a miss, and later acid that grows with the slot ──
  {
    // A hit at 2nd level: 4d4 now, and 2d4 as its next turn ends. Every d4 is a 3.
    const hit = fight();
    d20s = [15];
    const struck = ok(cast(hit, "Acid Arrow", [], { targetIds: ["a"] }));
    assert.deepEqual(harmOf(struck.events, "a"), [12]);
    assert.ok(who(struck.state, "a").tracked.some((one) => one.condition === "acid"));
    assert.equal(who(struck.state, "a").tracked.find((one) => one.condition === "acid")!.harmsMore, undefined);
    Object.assign(hit, struck.state);
    assert.deepEqual(harmOf(toTurnOf(hit, "b"), "a"), [6], "2d4 as its turn ends");
    // At 3rd level: 5d4 now, and 3d4 later.
    const high = fight();
    d20s = [15];
    const upcast = ok(cast(high, "Acid Arrow", [], { targetIds: ["a"], payWith: "slots_3" }));
    assert.deepEqual(harmOf(upcast.events, "a"), [15]);
    assert.deepEqual(who(upcast.state, "a").tracked.find((one) => one.condition === "acid")!.harmsMore, {
      count: 1,
      sides: 4,
      flat: 0,
    });
    Object.assign(high, upcast.state);
    assert.deepEqual(harmOf(toTurnOf(high, "b"), "a"), [9], "3d4 as its turn ends");
    // A miss: half of it, and nothing put on.
    const missed = fight();
    d20s = [1];
    const splash = ok(cast(missed, "Acid Arrow", [], { targetIds: ["a"], payWith: "slots_3" }));
    assert.equal(of(splash.events, "attack")[0]!.outcome, "miss");
    assert.deepEqual(harmOf(splash.events, "a"), [7], "half of 15, rounded down");
    assert.ok(!who(splash.state, "a").tracked.some((one) => one.condition === "acid"), "no later acid");
    // Without halfOnMiss a miss does nothing.
    const plainState = fight();
    d20s = [1];
    const ray = ok(cast(plainState, "Ray", [], { targetIds: ["a"] }));
    assert.deepEqual(harmOf(ray.events, "a"), []);
  }

  // ── Refusals ──
  {
    const at = { x: 10, y: 7 };
    refusedWith(cast(fight(), "Burst", [], { at, heightens: "a" }), "bad-alter");
    refusedWith(cast(fight(), "Burst", ["Careful Spell"], { at, heightens: "a" }), "bad-alter");
    refusedWith(cast(fight(), "Burst", ["Heightened Spell"], { at, heightens: "sorc" }), "bad-alter");
    refusedWith(cast(fight(), "Burst", ["Heightened Spell"], { at, heightens: "nobody" }), "bad-alter");
    refusedWith(cast(fight(), "Hold", ["Heightened Spell"], { targetIds: ["a"], heightens: "b" }), "bad-alter");
    const handed = fight();
    assert.equal(cast(handed, "Burst", ["Heightened Spell"], { at, heightens: "sorc" }).state, handed);
  }

  // ── Import refusals and the gate ──
  {
    const refused = (edit: (doc: Record<string, any>) => void, message: RegExp) => {
      const result = parseRulesetDefinition(fiveE(edit));
      assert.ok(!result.ok, `accepted: ${message}`);
      assert.match(result.issues.join("; "), message);
    };
    const arrow = (doc: Record<string, any>) =>
      doc.catalogs.find((one: any) => one.id === "spells").entries.find((one: any) => one.id === "acid-arrow")
        .mechanics;
    refused((doc) => delete arrow(doc).attackRoll, /"halfOnMiss" is on an entry that rolls to hit/);
    refused((doc) => (arrow(doc).applies[0].harmsPerCostStep = {}), /"harmsPerCostStep" names dice/);
    refused((doc) => (arrow(doc).applies[0].harmsPerCostStep = { dice: "lots" }), /harmsPerCostStep/);
    const manifest = (minor: number) => ({
      schemaVersion: 2,
      capabilityApi: { major: 1, minor },
      id: "test.5e",
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
      "A ruleset with entries dealing half on a miss, or conditions harming more at a higher cost, requires schemaVersion 2 and capabilityApi 1.255 or newer";
    const without = JSON.parse(fiveEText);
    const issue = (minor: number, document: unknown, files?: unknown) =>
      getCapabilityPackageInstallIssue(manifest(minor) as never, document, files as never);
    for (const extra of [{ mechanics: { halfOnMiss: true } }, { applies: [{ harmsPerCostStep: { dice: "1d4" } }] }]) {
      const document = structuredClone(without);
      document.extra = { entry: extra };
      assert.equal(issue(254, document), gate, JSON.stringify(extra));
      assert.notEqual(issue(255, document), gate);
    }
    assert.notEqual(issue(254, without), gate);
    assert.equal(issue(254, without, new Map([["spells.json", { entries: spells }]])), gate);
  }

  console.log(
    "Ruleset Heightened and Acid Arrow: Heightened's target is picked, through a window; Acid Arrow halves on a miss and its later acid grows with the slot; gated at 1.255.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
