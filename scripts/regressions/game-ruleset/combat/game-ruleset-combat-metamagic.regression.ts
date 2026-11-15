/**
 * Metamagic (Capability API 1.253).
 *
 *   - An entry's `alters`: never on a menu, offered with each spell it fits and paid for with its
 *     own uses as the spell is cast. One per spell unless it `joins` another.
 *   - Careful, Distant, Empowered, Extended, Heightened, Quickened, Subtle and Twinned Spell, each
 *     only on a spell it has something to change on, and a spell only Quickened or Subtle makes
 *     castable now offered with `alterNeeded`.
 *   - Refusals, import refusals and the install gate.
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

const dataDir = mkdtempSync(join(tmpdir(), "marinara-metamagic-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 248);
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
  const offered = (state: RulesetEncounterState, label: string) =>
    (optionOf(state, label)?.alters ?? []).map((one) => one.label).sort();

  // ── Offered only where they fit, never on their own ──
  {
    const state = fight();
    assert.ok(!optionOf(state, "Careful Spell"), "never on the menu itself");
    assert.deepEqual(offered(state, "Bolt"), ["Distant Spell", "Empowered Spell", "Quickened Spell", "Twinned Spell"]);
    assert.deepEqual(offered(state, "Swift"), ["Distant Spell", "Twinned Spell"], "already a bonus action");
    assert.deepEqual(offered(state, "Hold"), [
      "Careful Spell",
      "Distant Spell",
      "Extended Spell",
      "Heightened Spell",
      "Quickened Spell",
      "Subtle Spell",
      "Twinned Spell",
    ]);
    assert.deepEqual(offered(state, "Burst"), [
      "Careful Spell",
      "Distant Spell",
      "Heightened Spell",
      "Quickened Spell",
    ]);
    const twin = optionOf(state, "Bolt")!.alters!.find((one) => one.label === "Twinned Spell")!;
    assert.equal(twin.cost, 1);
    assert.equal(twin.perLevel, true);
    assert.equal(twin.twins, true);
    assert.equal(optionOf(state, "Firebolt")!.alters!.find((one) => one.label === "Twinned Spell")!.cost, 1);
    assert.equal(optionOf(state, "Bolt")!.alters!.find((one) => one.label === "Quickened Spell")!.cost, 2);
    assert.equal(optionOf(state, "Bolt")!.alters!.find((one) => one.label === "Empowered Spell")!.joins, true);
  }

  // ── Twinned: a second target, at the spell's level in points ──
  {
    refusedWith(cast(fight(), "Bolt", [], { targetIds: ["a", "b"] }), "bad-target");
    const step = ok(cast(fight(), "Bolt", ["Twinned Spell"], { targetIds: ["a", "b"] }));
    assert.deepEqual(
      of(step.events, "damage")
        .map((one) => one.targetId)
        .sort(),
      ["a", "b"],
    );
    assert.equal(points(step.state), 4, "a 1st-level spell twinned costs one");
    const altered = of(step.events, "altered");
    assert.deepEqual(
      altered.map((one) => [one.label, one.alters]),
      [["Bolt", ["Twinned Spell"]]],
    );
    const higher = ok(cast(fight(), "Bolt", ["Twinned Spell"], { targetIds: ["a", "b"], payWith: "slots_3" }));
    assert.equal(points(higher.state), 2, "cast with a 3rd-level slot, three");
    const cantrip = ok(cast(fight(), "Firebolt", ["Twinned Spell"], { targetIds: ["a", "b"] }));
    assert.equal(points(cantrip.state), 4, "a cantrip, one");
    // Given back after: the spell is one target again on the next turn's menu.
    assert.equal(who(step.state, "sorc").actions.find((one) => one.label === "Bolt")!.targets.count, 1);
  }

  // ── Distant: twice the range, and a touch at 30 feet ──
  {
    const far = { placements: { b: { x: 20, y: 7 } } };
    refusedWith(cast(fight(far), "Bolt", [], { targetIds: ["b"] }), "out-of-reach");
    ok(cast(fight(far), "Bolt", ["Distant Spell"], { targetIds: ["b"] }));
    refusedWith(cast(fight(), "Touch", [], { targetIds: ["a"] }), "out-of-reach");
    const touched = ok(
      cast(fight({ placements: { a: { x: 7, y: 7 } } }), "Touch", ["Distant Spell"], { targetIds: ["a"] }),
    );
    assert.equal(of(touched.events, "damage").length, 1);
    refusedWith(cast(fight(), "Touch", ["Distant Spell"], { targetIds: ["a"] }), "out-of-reach");
  }

  // ── Empowered: the low dice thrown again, and it joins another ──
  {
    d10s = [1, 2, 9, 8];
    const step = ok(cast(fight(), "Bolt", ["Empowered Spell"], { targetIds: ["a"] }));
    assert.equal(of(step.events, "damage")[0]!.amount, 17, "1 and 2 thrown again as 9 and 8");
    d10s = [1, 7, 9];
    const one = ok(cast(fight(), "Bolt", ["Empowered Spell"], { targetIds: ["a"] }));
    assert.equal(of(one.events, "damage")[0]!.amount, 16, "only the die below its average");
    d10s = [];
    const both = ok(cast(fight(), "Bolt", ["Twinned Spell", "Empowered Spell"], { targetIds: ["a", "b"] }));
    assert.equal(points(both.state), 3, "one each");
    refusedWith(cast(fight(), "Bolt", ["Twinned Spell", "Distant Spell"], { targetIds: ["a"] }), "bad-alter");
  }

  // ── Extended and Heightened ──
  {
    d20s = [1];
    const step = ok(cast(fight(), "Hold", ["Extended Spell"], { targetIds: ["a"] }));
    assert.equal(who(step.state, "a").tracked.find((one) => one.condition === "held")?.rounds, 20, "twice as long");
    d20s = [1];
    const plain = ok(cast(fight(), "Hold", [], { targetIds: ["a"] }));
    assert.equal(who(plain.state, "a").tracked.find((one) => one.condition === "held")?.rounds, 10);
    d20s = [20, 1];
    const high = ok(cast(fight(), "Hold", ["Heightened Spell"], { targetIds: ["a"] }));
    const save = of(high.events, "save")[0]!;
    assert.equal(save.mode, "disadvantage");
    assert.equal(save.success, false, "the 20 is not kept");
    assert.equal(points(high.state), 2, "three points");
  }

  // ── Careful: allies it catches make the save outright ──
  {
    d20s = [1, 1, 1];
    const step = ok(cast(fight(), "Burst", ["Careful Spell"], { at: { x: 10, y: 7 } }));
    const saves = of(step.events, "save");
    assert.equal(saves.find((one) => one.actorId === "ally")?.success, true);
    assert.equal(saves.find((one) => one.actorId === "ally")?.automatic, true);
    assert.equal(saves.find((one) => one.actorId === "a")?.success, false, "a foe is not spared");
    d20s = [1, 1, 1];
    const plain = ok(cast(fight(), "Burst", [], { at: { x: 10, y: 7 } }));
    assert.equal(of(plain.events, "save").find((one) => one.actorId === "ally")?.success, false);
  }

  // ── Quickened: a bonus action, and castable once the action is spent ──
  {
    const state = fight();
    const step = ok(cast(state, "Bolt", ["Quickened Spell"], { targetIds: ["a"] }));
    assert.equal(who(step.state, "sorc").budgets.bonus, 0);
    assert.equal(who(step.state, "sorc").budgets.action, 1);
    const spent = fight();
    who(spent, "sorc").budgets.action = 0;
    const option = optionOf(spent, "Bolt");
    assert.ok(option, "offered with the action spent");
    assert.equal(option.budget, "bonus");
    assert.equal(option.alterNeeded, metaId(spent, "Quickened Spell"));
    refusedWith(cast(spent, "Bolt", [], { targetIds: ["a"] }), "bad-alter");
    ok(cast(spent, "Bolt", ["Quickened Spell"], { targetIds: ["a"] }));
    refusedWith(cast(spent, "Bolt", ["Distant Spell"], { targetIds: ["a"] }), "bad-alter");
  }

  // ── Subtle: under a gag, and nobody answers it ──
  {
    const gagged = fight();
    who(gagged, "sorc").tracked.push({ condition: "gagged", rounds: null });
    assert.equal(optionOf(gagged, "Hold")?.alterNeeded, metaId(gagged, "Subtle Spell"));
    d20s = [1];
    ok(cast(gagged, "Hold", ["Subtle Spell"], { targetIds: ["a"] }));
    const counter = {
      extra: [
        {
          id: "mage",
          name: "Mage",
          side: "enemy",
          block: { sheet: sheet(false), actions: [] },
        } as RulesetCombatantInput,
      ],
    };
    const seen = fight(counter);
    seen.order = ["sorc", "mage", "ally", "a", "b"];
    const loud = ok(cast(seen, "Hold", [], { targetIds: ["a"] }));
    assert.ok(loud.state.window, "a cast seen is answered");
    // Answered and let through, it lands as it was altered: Extended still twice as long.
    const held = ok(cast(seen, "Hold", ["Extended Spell"], { targetIds: ["a"] }));
    assert.ok(held.state.window, "an extended one is answered");
    d20s = [1];
    const through = ok(
      applyRulesetCombatChoice(
        definition,
        held.state,
        { actorId: "mage", optionId: RULESET_PASS_OPTION, targetIds: [], window: held.state.window!.id },
        roll,
      ),
    );
    assert.equal(who(through.state, "a").tracked.find((one) => one.condition === "held")?.rounds, 20);
    assert.equal(
      who(held.state, "sorc").actions.find((one) => one.label === "Hold")!.alteredWith,
      undefined,
      "the spell is given back unaltered while the window waits",
    );
    d20s = [1];
    const quiet = ok(cast(seen, "Hold", ["Subtle Spell"], { targetIds: ["a"] }));
    assert.equal(quiet.state.window, undefined, "a subtle one is not");
    assert.ok(who(quiet.state, "a").tracked.some((one) => one.condition === "held"));
  }

  // ── Refusals ──
  {
    refusedWith(cast(fight(), "Bolt", ["Careful Spell"], { targetIds: ["a"] }), "bad-alter");
    // Refused after it was altered: the fight comes back exactly as it was handed in.
    const handed = fight();
    const refused = cast(handed, "Bolt", ["Twinned Spell"], { targetIds: ["a", "a2"] });
    refusedWith(refused, "bad-target");
    assert.equal(refused.state, handed);
    const state = fight();
    const option = optionOf(state, "Bolt")!;
    refusedWith(
      applyRulesetCombatChoice(
        definition,
        state,
        { actorId: "sorc", optionId: option.id, targetIds: ["a"], alters: ["nothing"] },
        roll,
      ),
      "bad-alter",
    );
    const poor = fight();
    const sorc = who(poor, "sorc");
    sorc.sheet!.live = { pools: { "counters:sorcery points": { value: 2 } } };
    refusedWith(cast(poor, "Hold", ["Heightened Spell"], { targetIds: ["a"] }), "insufficient");
    assert.equal(points(poor), 2, "nothing spent");
  }

  // ── Import refusals ──
  {
    const refused = (edit: (doc: Record<string, any>) => void, pattern: RegExp) => {
      const result = parseRulesetDefinition(fiveE(edit));
      assert.equal(result.ok, false);
      if (!result.ok)
        assert.ok(
          result.issues.some((issue) => pattern.test(issue)),
          result.issues.join("; "),
        );
    };
    const entry = (doc: Record<string, any>, id: string) =>
      doc.catalogs
        .find((one: { id: string }) => one.id === "sorcery")
        .entries.find((one: { id: string }) => one.id === id).mechanics;
    refused((doc) => (entry(doc, "careful").alters = { catalogs: ["spells"] }), /"alters" changes something/);
    refused((doc) => (entry(doc, "careful").kind = "buff"), /"alters" is on a "utility" entry/);
    refused((doc) => (entry(doc, "careful").alters.catalogs = ["runes"]), /Unknown catalog "runes"/);
    refused((doc) => (entry(doc, "quickened").alters.budget.to = "free"), /Unknown budget "free"/);
    refused((doc) => (entry(doc, "subtle").alters.drops = ["material"]), /Unknown component "material"/);
    refused((doc) => (entry(doc, "heightened").usesSpentByLevel = true), /"usesSpentByLevel" prices an entry/);
    refused(
      (doc) => Object.assign(entry(doc, "careful"), { alters: undefined, usesSpentByLevel: true }),
      /"usesSpentByLevel" prices an entry/,
    );
    refused((doc) => (entry(doc, "careful").alters.spares = { abilityMod: "luck" }), /luck/);
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
      "A ruleset with entries that change how another is used requires schemaVersion 2 and capabilityApi 1.253 or newer";
    const without = JSON.parse(fiveEText);
    const issue = (minor: number, document: unknown, files?: unknown) =>
      getCapabilityPackageInstallIssue(manifest(minor) as never, document, files as never);
    for (const extra of [{ mechanics: { alters: { catalogs: ["spells"] } } }, { usesSpentByLevel: true }]) {
      const document = structuredClone(without);
      document.extra = { entry: extra };
      assert.equal(issue(252, document), gate, JSON.stringify(extra));
      assert.notEqual(issue(253, document), gate);
    }
    assert.notEqual(issue(252, without), gate);
    assert.equal(issue(252, without, new Map([["sorcery.json", { entries: sorcery }]])), gate);
  }

  console.log(
    "Ruleset Metamagic: offered with the spells it fits and paid in Sorcery Points; Careful, Distant, Empowered, Extended, Heightened, Quickened, Subtle and Twinned each change the cast; gated at 1.253.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
