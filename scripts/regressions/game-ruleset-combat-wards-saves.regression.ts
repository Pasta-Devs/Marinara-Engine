/**
 * Wards, saves, monster spellcasting and scrolls (Capability API 1.181).
 *
 *   - `zone.wards.by: "base"`: a spell is kept out by its own level, however it was paid (Globe of
 *     Invulnerability); `maxLevelPerCostStep` keeps out more for each step the ward was paid up.
 *   - `save.succeeds`: immune to a damage type or a condition, or a creature of a tag, passes without
 *     rolling (Stinking Cloud); `save.against` makes it a save against poison too.
 *   - A creature's `spellcasting.components`, for the trait or one spell, in place of the entry's.
 *   - An item's `utility` use, which only leaves an area (a scroll of Silence).
 *   - Import refusals, and the install gate.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  advanceRulesetTurn,
  applyRulesetCombatChoice,
  createRulesetEncounter,
  parseRulesetDefinition,
  rowsFromCatalogEntry,
  rulesetCombatant,
  rulesetCombatConditions,
  rulesetCombatHealth,
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  rulesetWarded,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCatalogItem,
  type RulesetCombatantInput,
  type RulesetCombatCell,
  type RulesetCombatEvent,
  type RulesetCombatStep,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetSheetItem,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";
import type { TacticalGrid } from "../../packages/shared/src/features/tactical-combat/types.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-wards-saves-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 176);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
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
  const spell = (id: string, mechanics: Record<string, unknown>, level = 1) =>
    ({
      id,
      label: id[0]!.toUpperCase() + id.slice(1),
      rows: [{ list: "spells", values: { name: id[0]!.toUpperCase() + id.slice(1), level, prepared: true } }],
      mechanics: { kind: "attack", autoHit: true, damageType: "fire", ...mechanics },
    }) as unknown as RulesetCatalogEntry;
  // Globe: level 1 or lower by the spell's own level; one more for each slot it was paid above 1st.
  const globe = spell("globe", {
    kind: "utility",
    area: { shape: "burst", size: 5 },
    range: 60,
    cost: [{ pool: "slots_1", amount: 1 }],
    zone: {
      rounds: 10,
      triggers: [],
      wards: { catalogs: ["spells"], maxLevel: 1, by: "base", maxLevelPerCostStep: 1 },
    },
  });
  // The 1.179 way, by the level paid, for comparison.
  const paidGlobe = spell("paidglobe", {
    kind: "utility",
    area: { shape: "burst", size: 5 },
    range: 60,
    zone: { rounds: 10, triggers: [], wards: { catalogs: ["spells"], maxLevel: 1 } },
  });
  const sign = spell("sign", { range: 120, amount: { flat: 5 }, cost: [{ pool: "slots_1", amount: 1 }] });
  const bolt2 = spell("bolttwo", { range: 120, amount: { flat: 6 }, cost: [{ pool: "slots_2", amount: 1 }] }, 2);
  // Stinking Cloud, as it is cast: a Con save against poison, passed outright by the immune and by
  // whatever does not breathe.
  const stink = spell("stink", {
    kind: "debuff",
    area: { shape: "burst", size: 10 },
    range: 90,
    save: {
      save: "con_save",
      onSuccess: "negates",
      against: { damage: ["poison"] },
      succeeds: { immune: ["poison"], conditionImmune: ["poisoned"], is: { tags: ["nonbreathing"] } },
    },
    applies: [{ condition: "poisoned", duration: { rounds: 1 } }],
  });
  const shout = spell("shout", { range: 120, amount: { flat: 5 }, components: ["verbal"] });
  const silence = spell("silence", {
    kind: "utility",
    area: { shape: "burst", size: 10 },
    range: 120,
    zone: { rounds: 10, triggers: [], forbids: { components: ["verbal"] } },
  });
  const spells = [globe, paidGlobe, sign, bolt2, stink, shout, silence];
  const withRules = (doc: Record<string, any>) => {
    doc.items = { categories: [{ id: "gear", label: "Gear" }] };
    doc.combat.components = [
      { id: "verbal", label: "Verbal" },
      { id: "somatic", label: "Somatic" },
    ];
    doc.combat.creatureTypes = {
      types: [
        { id: "beast", label: "Beast" },
        { id: "construct", label: "Construct" },
      ],
      tags: [{ id: "nonbreathing", label: "Does not breathe" }],
    };
    // A dwarf's resilience: advantage on saves against poison.
    doc.sheet.live.conditions.push({ id: "resilient", label: "Resilient" });
    doc.combat.conditions.push({
      condition: "resilient",
      modifiers: [{ to: "saves", against: { damage: ["poison"] }, mode: "advantage" }],
    });
  };
  const definition = parsed(
    fiveE((doc) => {
      withRules(doc);
      doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: spells });
    }),
  );
  const combat = definition.combat!;
  const block = (extra: Partial<RulesetStatBlock> = {}): RulesetStatBlock => ({
    health: 100,
    defense: 5,
    initiativeModifier: 0,
    speed: 30,
    saves: { con_save: -10 },
    actions: [{ name: "Claw", budget: "action", toHit: 4, damage: { count: 1, sides: 4, flat: 0 } }],
    ...extra,
  });
  const grid = (): TacticalGrid => ({
    width: 20,
    height: 15,
    tiles: Array.from({ length: 15 }, () => Array(20).fill("plains")),
  });
  // A hag whose innate spells need no components, but whose Silence-breaking shout still needs a
  // voice; and one whose trait says nothing.
  const hag = (components: Record<string, unknown>) =>
    ({
      id: "hag",
      label: "Hag",
      creature: {
        health: 50,
        defense: 12,
        initiativeModifier: 0,
        speed: 30,
        tier: "cr_0",
        actions: [],
        spellcasting: { saveDifficulty: 13, spells: [{ entry: "spells/shout" }], ...components },
      },
    }) as unknown as RulesetCatalogEntry;
  const fight = (
    options: {
      placements?: Record<string, { x: number; y: number }>;
      a?: Partial<RulesetStatBlock>;
      b?: Partial<RulesetStatBlock>;
      items?: RulesetSheetItem[];
      mageLive?: Record<string, unknown>;
      extra?: RulesetCombatantInput[];
      beasts?: RulesetCatalogEntry[];
    } = {},
  ): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      bestiary: { spells, beasts: options.beasts ?? [] },
      combatants: [
        {
          id: "mage",
          name: "Mage",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 10, con: 14, int: 10, wis: 16, cha: 10 },
            fields: {
              level: 9,
              ac: 12,
              speed: 30,
              hp_max: 60,
              spellcasting_ability: "wis",
              slots_max_1: 9,
              slots_max_2: 3,
              slots_max_3: 3,
            },
            lists: { spells: spells.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)) },
          }),
          live: (options.mageLive ?? {}) as never,
          catalogs: { spells },
          ...(options.items ? { items: options.items } : {}),
        },
        { id: "a", name: "A", side: "enemy", block: block(options.a) },
        { id: "b", name: "B", side: "enemy", block: block(options.b) },
        ...(options.extra ?? []),
      ],
      board: {
        grid: grid(),
        placements: { mage: { x: 2, y: 7 }, a: { x: 10, y: 7 }, b: { x: 16, y: 7 }, ...options.placements },
      },
    });
    state.order = state.combatants.map((one) => one.id);
    state.turn = 0;
    return state;
  };
  const roll = () => 10;
  const optionOf = (state: RulesetEncounterState, actorId: string, label: string) =>
    rulesetCombatOptions(definition, state, actorId).find((one) => one.label === label);
  const use = (
    state: RulesetEncounterState,
    label: string,
    choice: { at?: RulesetCombatCell; targetIds?: string[]; payWith?: string },
    roller: (sides: number) => number = roll,
  ) => {
    const option = optionOf(state, "mage", label);
    assert.ok(option, `the mage has no ${label}`);
    return applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "mage", optionId: option.id, targetIds: choice.targetIds ?? [], ...choice },
      roller,
    );
  };
  const around = (state: RulesetEncounterState) => {
    let next = state;
    do next = advanceRulesetTurn(definition, next, roll).state;
    while (next.order[next.turn] !== "mage");
    return next;
  };
  const who = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)!;
  const hp = (state: RulesetEncounterState, id: string) =>
    rulesetCombatHealth(definition, combat, who(state, id)).value;
  const refused = (step: RulesetCombatStep) => step.events.find((one) => one.type === "refused");
  const saveOf = (events: RulesetCombatEvent[], id: string) => {
    const found = events.find((one) => one.type === "save" && one.actorId === id);
    assert.ok(found && found.type === "save", `no save by ${id}`);
    return found;
  };
  const actionOf = (state: RulesetEncounterState, label: string) =>
    who(state, "mage").actions.find((one) => one.label === label)!;

  // ── Globe by the spell's own level ──
  {
    const state = around(use(fight(), "Globe", { at: { x: 10, y: 7 } }).state);
    const signed = actionOf(state, "Sign");
    assert.ok(rulesetWarded(definition, state, who(state, "mage"), signed, who(state, "a")));
    assert.ok(
      rulesetWarded(definition, state, who(state, "mage"), signed, who(state, "a"), "slots_2"),
      "paid with a 2nd-level slot, Sign is still a 1st-level spell",
    );
    const upcast = use(state, "Sign", { targetIds: ["a"], payWith: "slots_2" });
    assert.ok(refused(upcast), "named behind the globe however it is paid");
    assert.ok(
      !rulesetWarded(definition, state, who(state, "mage"), actionOf(state, "Bolttwo"), who(state, "a")),
      "a 2nd-level spell gets in",
    );
    // By the level paid (1.179), the upcast gets through.
    const paid = around(use(fight(), "Paidglobe", { at: { x: 10, y: 7 } }).state);
    assert.ok(!rulesetWarded(definition, paid, who(paid, "mage"), actionOf(paid, "Sign"), who(paid, "a"), "slots_2"));
    // Paid with a 2nd-level slot, the globe keeps out 2nd-level spells too, but not 3rd.
    const raised = around(use(fight(), "Globe", { at: { x: 10, y: 7 }, payWith: "slots_2" }).state);
    assert.ok(rulesetWarded(definition, raised, who(raised, "mage"), actionOf(raised, "Bolttwo"), who(raised, "a")));
    const bolted = use(raised, "Bolttwo", { targetIds: ["a"] });
    assert.ok(refused(bolted));
    const third = { ...actionOf(raised, "Bolttwo"), innate: { level: 3, baseLevel: 3 } };
    assert.ok(!rulesetWarded(definition, raised, who(raised, "mage"), third, who(raised, "a")), "3rd level gets in");
  }

  // ── Stinking Cloud ──
  {
    const cast = (options: Parameters<typeof fight>[0]) =>
      use(fight({ placements: { a: { x: 10, y: 7 }, b: { x: 11, y: 7 } }, ...options }), "Stink", {
        at: { x: 10, y: 7 },
      });
    // An ordinary creature rolls and fails; one immune to poison passes without rolling.
    const immune = cast({ b: { immune: ["poison"] } });
    assert.equal(refused(immune), undefined);
    assert.equal(saveOf(immune.events, "a").automatic, undefined);
    assert.equal(saveOf(immune.events, "a").success, false);
    assert.ok(rulesetCombatConditions(definition, who(immune.state, "a")).includes("poisoned"));
    assert.deepEqual(
      [saveOf(immune.events, "b").automatic, saveOf(immune.events, "b").success, saveOf(immune.events, "b").rolls],
      [true, true, []],
      "immune to poison: no roll",
    );
    assert.ok(!rulesetCombatConditions(definition, who(immune.state, "b")).includes("poisoned"));
    // Immune to the poisoned condition, or a creature that does not breathe.
    const conditionImmune = cast({ b: { conditionImmunities: ["poisoned"] } });
    assert.equal(saveOf(conditionImmune.events, "b").automatic, true);
    const construct = cast({ b: { type: "construct", tags: ["nonbreathing"] } });
    assert.equal(saveOf(construct.events, "b").automatic, true);
    assert.equal(saveOf(cast({ b: { type: "beast" } }).events, "b").automatic, undefined, "a beast breathes");
  }

  // ── A save against poison, directly ──
  {
    const state = fight({
      placements: { mage: { x: 2, y: 7 }, a: { x: 10, y: 7 } },
    });
    who(state, "a").tracked.push({ condition: "resilient", rounds: null });
    const step = use(state, "Stink", { at: { x: 10, y: 7 } });
    assert.equal(saveOf(step.events, "a").rolls.length, 2, "A rolls twice against poison");
  }

  // ── A monster's innate spells, needing no components ──
  {
    const silenced = (beast: RulesetCatalogEntry) => {
      const state = fight({
        beasts: [beast],
        extra: [{ id: "hag", name: "Hag", side: "enemy", creature: { catalogId: "beasts", entryId: "hag" } }],
        placements: { hag: { x: 10, y: 8 } },
      });
      return around(use(state, "Silence", { at: { x: 10, y: 7 } }).state);
    };
    const hagOptions = (state: RulesetEncounterState) =>
      rulesetCombatOptions(definition, state, "hag").map((one) => one.label);
    // Nothing said: the entry's own verbal component, which the silence stops.
    const plain = silenced(hag({}));
    assert.deepEqual(who(plain, "hag").actions.find((one) => one.label === "Shout")?.components, ["verbal"]);
    // The trait needs none: it shouts in the silence.
    const innate = silenced(hag({ components: [] }));
    assert.equal(who(innate, "hag").actions.find((one) => one.label === "Shout")?.components, undefined);
    // One spell may say otherwise than its trait.
    const spoken = silenced(hag({ components: [], spells: [{ entry: "spells/shout", components: ["verbal"] }] }));
    assert.deepEqual(who(spoken, "hag").actions.find((one) => one.label === "Shout")?.components, ["verbal"]);
    // On the hag's own turn inside the silence.
    const turnOf = (state: RulesetEncounterState) => {
      let next = state;
      while (next.order[next.turn] !== "hag") next = advanceRulesetTurn(definition, next, roll).state;
      return next;
    };
    assert.ok(!hagOptions(turnOf(plain)).includes("Shout"), "a voice is needed and there is none");
    assert.ok(hagOptions(turnOf(innate)).includes("Shout"), "innate, it needs none");
    assert.ok(!hagOptions(turnOf(spoken)).includes("Shout"));
  }

  // ── A scroll of Silence ──
  {
    const scroll = {
      category: "gear",
      use: {
        kind: "utility",
        budget: "action",
        range: 120,
        consumes: true,
        area: { shape: "burst", size: 10 },
        zone: { rounds: 10, triggers: [], forbids: { components: ["verbal"] } },
      },
    } as unknown as RulesetCatalogItem;
    const state = fight({
      items: [{ name: "Scroll of Silence", quantity: 1, item: scroll, stack: { id: "s", ref: "gear/scroll" } }],
    });
    const option = optionOf(state, "mage", "Scroll of Silence");
    assert.ok(option, "a utility use is on the menu");
    const read = use(state, "Scroll of Silence", { at: { x: 10, y: 7 } });
    assert.equal(refused(read), undefined);
    assert.equal(who(read.state, "mage").zones?.length, 1, "the silence stands");
    assert.equal(hp(read.state, "a"), 100);
  }

  // ── Import refusals ──
  {
    const refusedDoc = (edit: (doc: Record<string, any>) => void, pattern: RegExp) => {
      const result = parseRulesetDefinition(
        fiveE((doc) => {
          withRules(doc);
          edit(doc);
        }),
      );
      assert.equal(result.ok, false, `must refuse ${pattern}`);
      if (!result.ok)
        assert.ok(
          result.issues.some((issue) => pattern.test(issue)),
          result.issues.join("; "),
        );
    };
    const withSave = (save: Record<string, unknown>) => (doc: Record<string, any>) => {
      doc.catalogs.push({
        id: "x",
        label: "X",
        feeds: ["spells"],
        entries: [spell("x", { save: { save: "con_save", onSuccess: "negates", ...save } })],
      });
    };
    refusedDoc(withSave({ succeeds: {} }), /Say who succeeds/);
    refusedDoc(withSave({ succeeds: { conditionImmune: ["sneezy"] } }), /Unknown condition "sneezy"/);
    refusedDoc(withSave({ succeeds: { immune: ["glitter"] } }), /Unknown damage type "glitter"/);
    refusedDoc(withSave({ succeeds: { is: { tags: ["gilled"] } } }), /Unknown creature tag "gilled"/);
    refusedDoc(withSave({ against: { damage: ["glitter"] } }), /Unknown damage type "glitter"/);
    refusedDoc(withSave({ against: { conditions: ["sneezy"] } }), /Unknown condition "sneezy"/);
    refusedDoc(withSave({ against: {} }), /Against names conditions, damage or qualities/);
    const withHag = (components: Record<string, unknown>) => (doc: Record<string, any>) => {
      doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: [shout] });
      doc.catalogs.push({ id: "beasts", label: "Beasts", holds: "creatures", entries: [hag(components)] });
    };
    refusedDoc(withHag({ components: ["mental"] }), /Unknown component "mental"/);
    refusedDoc(withHag({ spells: [{ entry: "spells/shout", components: ["mental"] }] }), /Unknown component "mental"/);
    refusedDoc(withHag({ components: ["verbal", "verbal"] }), /A component is named once/);
    parsed(
      fiveE((doc) => {
        withRules(doc);
        withHag({ components: [] })(doc);
      }),
    );
    const withItem = (item: Record<string, unknown>) => (doc: Record<string, any>) => {
      doc.catalogs.push({ id: "gear", label: "Gear", holds: "items", entries: [{ id: "it", label: "It", item }] });
    };
    refusedDoc(
      withItem({ category: "gear", use: { kind: "utility", budget: "action", range: 60 } }),
      /A utility use leaves an area standing/,
    );
    refusedDoc((doc) => {
      doc.catalogs.push({
        id: "x",
        label: "X",
        feeds: ["spells"],
        entries: [
          spell("x", {
            kind: "utility",
            area: { shape: "burst", size: 5 },
            zone: { rounds: 1, triggers: [], wards: { catalogs: ["spells"], maxLevel: 1, by: "cast" } },
          }),
        ],
      });
    }, /by/);
  }

  // ── The gate ──
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
      "A ruleset with wards by base level or raised by their cast, saves that say what else they are against or who passes them outright, creature spell components, or utility item uses, requires schemaVersion 2 and capabilityApi 1.181 or newer";
    const withEntries = (entries: unknown[]) =>
      fiveE((doc) => {
        doc.catalogs.push({ id: "x", label: "X", entries });
      });
    const byBase = spell("g", {
      kind: "utility",
      area: { shape: "burst", size: 5 },
      zone: { rounds: 1, triggers: [], wards: { catalogs: ["spells"], maxLevel: 1, by: "base" } },
    });
    const perStep = spell("g", {
      kind: "utility",
      area: { shape: "burst", size: 5 },
      zone: { rounds: 1, triggers: [], wards: { catalogs: ["spells"], maxLevel: 1, maxLevelPerCostStep: 1 } },
    });
    const against = spell("s", { save: { save: "con_save", onSuccess: "negates", against: { damage: ["poison"] } } });
    const succeeds = spell("s", { save: { save: "con_save", onSuccess: "negates", succeeds: { immune: ["poison"] } } });
    const docs: Array<[string, Record<string, any>]> = [
      ["by base", withEntries([byBase])],
      ["per step", withEntries([perStep])],
      ["save against", withEntries([against])],
      ["save succeeds", withEntries([succeeds])],
      ["trait components", withEntries([hag({ components: [] })])],
      ["spell components", withEntries([hag({ spells: [{ entry: "spells/shout", components: [] }] })])],
      [
        "utility use",
        withEntries([
          {
            id: "s",
            label: "S",
            item: {
              category: "gear",
              use: { kind: "utility", budget: "action", area: { shape: "burst", size: 5 }, zone: { rounds: 1 } },
            },
          },
        ]),
      ],
    ];
    for (const [label, doc] of docs) {
      assert.equal(getCapabilityPackageInstallIssue(manifest(180) as never, doc), gate, label);
      assert.notEqual(getCapabilityPackageInstallIssue(manifest(181) as never, doc), gate, label);
    }
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(180) as never, fiveE()), gate, "the plain 5e example");
  }

  console.log(
    "Ruleset wards and saves: Globe keeps spells out by their own level and grows when upcast, Stinking Cloud passes outright for the immune and the breathless and is a save against poison, innate spells can need no components, a scroll of Silence leaves its area.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
