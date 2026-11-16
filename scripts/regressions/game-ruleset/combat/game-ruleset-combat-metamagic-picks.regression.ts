/**
 * Metamagic as its user picks it (Capability API 1.254).
 *
 *   - Empowered throws again the lowest of ALL a spell's damage dice: its own, its clauses', and on
 *     a critical hit the extra ones, never more than it rerolls in all.
 *   - Careful spares the ones of its user's side they pick (`spares`), none if they pick none, and
 *     the pick holds through a window that answers the cast.
 *   - Refusals.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  RULESET_PASS_OPTION,
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

const dataDir = mkdtempSync(join(tmpdir(), "marinara-metamagic-picks-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");

try {
  assert.ok(supportedCapabilityApi.minor >= 249);
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

  // ── Empowered: the lowest of all its dice, its clauses' too ──
  {
    // Its own 4 and 2, the clause's 1 and 3: the 1, the 2 and the 3 are thrown again.
    d10s = [4, 2, 1, 3, 10, 9, 8];
    const step = ok(cast(fight(), "Frost", ["Empowered Spell"], { targetIds: ["a"] }));
    const dealt = of(step.events, "damage").map((one) => one.amount);
    assert.deepEqual(dealt, [13, 18], "4 + 9 of its own, 10 + 8 of the clause");
    d10s = [4, 2, 1, 3];
    const plain = ok(cast(fight(), "Frost", [], { targetIds: ["a"] }));
    assert.deepEqual(
      of(plain.events, "damage").map((one) => one.amount),
      [6, 4],
    );
    // Three dice in all, never three of each: high dice of its own leave the clause's low ones.
    d10s = [9, 9, 1, 2, 10, 10];
    const clause = ok(cast(fight(), "Frost", ["Empowered Spell"], { targetIds: ["a"] }));
    assert.deepEqual(
      of(clause.events, "damage").map((one) => one.amount),
      [18, 20],
    );
  }

  // ── Empowered on a critical hit: what is left of it goes to the extra dice ──
  {
    const state = fight();
    d20s = [20];
    d10s = [1, 2, 9, 9, 3, 4, 10];
    const step = ok(cast(state, "Ray", ["Empowered Spell"], { targetIds: ["a"] }));
    const hit = of(step.events, "damage")[0]!;
    assert.equal(hit.critical, true);
    assert.equal(hit.amount, 32, "1 and 2 thrown again as 9 and 9, then the critical's 3 as 10");
  }

  // ── Each target an attack rolls for is a hit of its own, whichever of its dice it rolls ──
  {
    const state = fight();
    who(state, "b").block!.type = "plant";
    d20s = [15, 15];
    // At A: its own 9 and 9, the clause's 9 and 9. At B, a plant: its own at their most, the
    // clause's thrown afresh as 8 and 8.
    d10s = [9, 9, 9, 9, 8, 8];
    const step = ok(cast(state, "Thorn", ["Twinned Spell", "Empowered Spell"], { targetIds: ["a", "b"] }));
    assert.deepEqual(
      of(step.events, "damage").map((one) => `${one.targetId} ${one.amount}`),
      ["a 18", "a 18", "b 20", "b 16"],
    );
  }

  // Three more of the sorcerer's side round the burst's middle, so it catches four.
  const crowd = {
    extra: ["p1", "p2", "p3"].map(
      (id) =>
        ({ id, name: id.toUpperCase(), side: "party", build: sheet(false, []), live: {} }) as RulesetCombatantInput,
    ),
    placements: { p1: { x: 10, y: 6 }, p2: { x: 11, y: 6 }, p3: { x: 10, y: 8 } },
  };

  // ── Careful: its user picks who is spared ──
  {
    const saved = (step: ReturnType<typeof cast>) =>
      of(step.events, "save")
        .filter((one) => one.automatic)
        .map((one) => one.actorId)
        .sort();
    d20s = Array(8).fill(1);
    const picked = ok(cast(fight(crowd), "Burst", ["Careful Spell"], { at: { x: 10, y: 7 }, spares: ["p3", "p1"] }));
    assert.deepEqual(saved(picked), ["p1", "p3"], "the two picked");
    assert.equal(of(picked.events, "save").find((one) => one.actorId === "ally")?.success, false, "not the rest");
    d20s = Array(8).fill(1);
    const none = ok(cast(fight(crowd), "Burst", ["Careful Spell"], { at: { x: 10, y: 7 }, spares: [] }));
    assert.deepEqual(saved(none), [], "none picked, none spared");
    assert.equal(points(none.state), 4, "and still paid for");
    d20s = Array(8).fill(1);
    const first = ok(cast(fight(crowd), "Burst", ["Careful Spell"], { at: { x: 10, y: 7 } }));
    assert.equal(saved(first).length, 3, "left out, the first three it catches");
    // Picked, and held for a window that answers the cast: it lands with the same pick.
    const counter = {
      extra: [
        ...crowd.extra,
        {
          id: "mage",
          name: "Mage",
          side: "enemy",
          block: { sheet: sheet(false), actions: [] },
        } as RulesetCombatantInput,
      ],
      placements: { ...crowd.placements, mage: { x: 2, y: 8 } },
    };
    const seen = fight(counter);
    seen.order = ["sorc", "mage", "ally", "p1", "p2", "p3", "a", "b"];
    const held = ok(cast(seen, "Burst", ["Careful Spell"], { at: { x: 10, y: 7 }, spares: ["p2"] }));
    assert.ok(held.state.window, "answered");
    d20s = Array(8).fill(1);
    const through = ok(
      applyRulesetCombatChoice(
        definition,
        held.state,
        { actorId: "mage", optionId: RULESET_PASS_OPTION, targetIds: [], window: held.state.window!.id },
        roll,
      ),
    );
    assert.deepEqual(saved(through), ["p2"], "the pick holds through the window");
  }

  // ── Refusals ──
  {
    const at = { x: 10, y: 7 };
    refusedWith(cast(fight(), "Burst", [], { at, spares: ["ally"] }), "bad-alter");
    refusedWith(cast(fight(), "Frost", ["Empowered Spell"], { targetIds: ["a"], spares: ["ally"] }), "bad-alter");
    refusedWith(cast(fight(), "Frost", ["Empowered Spell"], { targetIds: ["a"], spares: [] }), "bad-alter");
    ok(cast(fight(), "Frost", ["Empowered Spell"], { targetIds: ["a"] }));
    refusedWith(cast(fight(), "Burst", ["Careful Spell"], { at, spares: ["a"] }), "bad-alter");
    refusedWith(cast(fight(), "Burst", ["Careful Spell"], { at, spares: ["ally", "ally"] }), "bad-alter");
    refusedWith(
      cast(fight(crowd), "Burst", ["Careful Spell"], { at, spares: ["ally", "p1", "p2", "p3"] }),
      "bad-alter",
    );
    refusedWith(cast(fight(), "Burst", ["Careful Spell"], { at, spares: ["nobody"] }), "bad-alter");
    const handed = fight();
    const refused = cast(handed, "Burst", ["Careful Spell"], { at, spares: ["a"] });
    assert.equal(refused.state, handed, "the fight as it was handed in");
  }

  console.log(
    "Ruleset Metamagic picks: Empowered rerolls the lowest of all a spell's damage dice, a critical's too; Careful spares who its user picks, through a window; refusals.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
