/**
 * Shape changes (Capability API 1.392).
 *
 *   - `mechanics.forms` with a condition's `shape`: Wild Shape offers each form it may take as a mode,
 *     capped by `upTo.at` off its user's sheet and kept off flying ones by `without`. The form's
 *     actions, defense and speed take the place of the druid's own, with a way back on the bonus
 *     action; a blow past the form's health ends the shape and the rest carries on to their own.
 *   - Polymorph on a creature: `upTo.targetLevel` refuses a form above its own number; held by
 *     concentration, the shape ends when it breaks.
 *   - Forms read from a catalog (1.401): `from` with `filters` and `notFilters`.
 *   - Beast Spells and Archdruid (1.435): a level whose `shapeKeeps` names a whole catalog keeps the
 *     druid's spells in any shape from 18th level, and one whose `waives` names components keeps a
 *     gag from stopping them at 20th.
 *   - Refused shapes; the install gates.
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
  rulesetCombatConditions,
  rulesetCombatHealth,
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogEntriesById,
  type RulesetCatalogEntry,
  type RulesetCombatChoice,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-shapes-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");
const { createCombatDirector } = await import("../../packages/server/src/services/game/combat-director.service.js");
const { pickRulesetChoice } =
  await import("../../packages/server/src/services/game/ruleset-combat-director.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 392);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const beast = (id: string, label: string, cr: number, extra: Record<string, unknown>) => ({
    id,
    label,
    filters: { challenge: `CR ${cr}`, kind: "Beast", places: ["Forest"], cr },
    creature: {
      health: 30,
      defense: 14,
      initiativeModifier: 0,
      speed: 50,
      abilities: { str: 17, dex: 15, con: 15, int: 3, wis: 12, cha: 7 },
      tier: "cr_1",
      actions: [
        {
          id: "maul",
          name: "Maul",
          budget: "action",
          toHit: 5,
          damage: { dice: "2d6", flat: 3, type: "piercing" },
          reach: 5,
        },
      ],
      ...extra,
    },
  });
  const wolf = beast("dire-wolf", "Dire Wolf", 1, {});
  const eagle = beast("giant-eagle", "Giant Eagle", 1, { speed: 10, speeds: { fly: 80 } });
  const wildShape = (forms: Record<string, unknown>) => ({
    id: "wild-shape",
    label: "Wild Shape",
    rows: [{ list: "spells", values: { name: "Wild Shape", level: 0, prepared: true } }],
    mechanics: {
      kind: "buff",
      targets: "self",
      budget: "action",
      applies: [{ condition: "wild_shaped", duration: { rounds: 600 } }],
      forms,
    },
  });
  const polymorph = {
    id: "polymorph",
    label: "Polymorph",
    rows: [{ list: "spells", values: { name: "Polymorph", level: 4, prepared: true } }],
    mechanics: {
      kind: "debuff",
      targets: "enemy",
      range: 60,
      budget: "action",
      concentration: true,
      save: { save: "wis_save", onSuccess: "negates" },
      applies: [{ condition: "polymorphed", duration: { rounds: 600 } }],
      forms: {
        into: ["creatures/dire-wolf", "creatures/hollow-sentinel"],
        upTo: { filter: "cr", targetLevel: { field: "level" } },
      },
    },
  };
  const wolfOnly = wildShape({
    into: ["creatures/dire-wolf", "creatures/giant-eagle", "creatures/hollow-sentinel"],
    upTo: { filter: "cr", at: { const: 1 } },
    without: [{ speed: "fly" }],
  });
  const document = (entries: unknown[], edit: (doc: Record<string, any>) => void = () => {}) => {
    const doc = JSON.parse(fiveEText);
    const creatures = doc.catalogs.find((catalog: { holds?: string }) => catalog.holds === "creatures");
    creatures.filters.push({ id: "cr", label: "Challenge rating", type: "number" });
    for (const [id, cr] of [
      ["thorn-lurker", 0.5],
      ["cinder-hound", 1],
      ["grave-piper", 2],
      ["hollow-sentinel", 3],
      ["toll-sergeant", 5],
    ] as const) {
      creatures.entries.find((one: { id: string }) => one.id === id).filters.cr = cr;
    }
    creatures.entries.push(wolf, eagle);
    doc.sheet.live.conditions.push(
      { id: "wild_shaped", label: "Wild Shape" },
      { id: "polymorphed", label: "Polymorphed" },
    );
    doc.combat.conditions.push(
      {
        condition: "wild_shaped",
        effects: [],
        shape: { keepsSaves: ["wis_save"], keeps: ["polymorph"], revert: "bonus" },
      },
      { condition: "polymorphed", effects: [], shape: {} },
    );
    doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries });
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
    if (!result.ok)
      assert.ok(
        result.issues.some((issue) => pattern.test(issue)),
        result.issues.join("; "),
      );
  };

  // Each die shows what is queued for it, then 10.
  let queued: number[] = [];
  const roll = (sides: number) => Math.min(sides, queued.shift() ?? 10);
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);

  const fight = (
    definition: RulesetDefinition,
    entries: RulesetCatalogEntry[],
    level = 8,
    /** Proficiencies, and a better Dexterity, for `betterOf` (1.405). */
    trained?: { saves: Record<string, string>; skills: Record<string, string>; dex: number },
  ) => {
    const bestiary: RulesetCatalogEntriesById = {
      creatures: definition.catalogs!.find((catalog) => catalog.holds === "creatures")!.entries!,
    };
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: roll,
      bestiary,
      combatants: [
        {
          id: "druid",
          name: "Druid",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: trained?.dex ?? 12, con: 14, int: 10, wis: 18, cha: 10 },
            fields: { level, ac: 12, speed: 30, hp_max: 40 },
            ...(trained ? { saves: trained.saves, skills: trained.skills } : {}),
            lists: { spells: entries.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)) },
          }),
          live: {},
          catalogs: { spells: entries },
        },
        {
          id: "brute",
          name: "Brute",
          side: "enemy",
          block: {
            health: 100,
            defense: 10,
            initiativeModifier: 0,
            speed: 30,
            actions: [
              {
                id: "smash",
                label: "Smash",
                kind: "attack",
                budget: "action",
                toHit: 30,
                damage: { flat: 35, type: "bludgeoning" },
              },
            ],
          },
        },
        {
          id: "piper",
          name: "Grave Piper",
          side: "enemy",
          creature: { catalogId: "creatures", entryId: "grave-piper" },
        },
      ],
      board: {
        grid: { width: 10, height: 1, tiles: [Array(10).fill("plains")], elevation: [Array(10).fill(0)] },
        placements: { druid: { x: 3, y: 0 }, brute: { x: 4, y: 0 }, piper: { x: 6, y: 0 } },
      },
    });
    state.order = ["druid", "brute", "piper"];
    state.turn = 0;
    return state;
  };
  const health = (definition: RulesetDefinition, one: Parameters<typeof rulesetCombatHealth>[2]) =>
    rulesetCombatHealth(definition, definition.combat!, one);
  const who = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)!;
  const step = (definition: RulesetDefinition, state: RulesetEncounterState, choice: RulesetCombatChoice) => {
    const taken = applyRulesetCombatChoice(definition, state, choice, roll);
    assert.deepEqual(of(taken.events, "refused"), [], JSON.stringify(taken.events));
    return taken;
  };
  const optionFor = (definition: RulesetDefinition, state: RulesetEncounterState, actor: string, label: string) => {
    const option = rulesetCombatOptions(definition, state, actor).find((one) => one.label === label);
    assert.ok(option, `${label}: ${rulesetCombatOptions(definition, state, actor).map((one) => one.label)}`);
    return option;
  };

  // ── Wild Shape: the forms it may take, and what taking one changes ──
  {
    const definition = parsed(document([wolfOnly, polymorph]));
    const entries = definition.catalogs!.find((catalog) => catalog.id === "spells")!.entries! as RulesetCatalogEntry[];
    let state = fight(definition, entries);
    const druid = who(state, "druid");
    const ownActions = druid.actions.map((one) => one.id);
    const ownDefense = druid.defense;
    const ownSaves = structuredClone(druid.saves);
    const option = optionFor(definition, state, "druid", "Wild Shape");
    // CR 1 at most and nothing that flies: the wolf, not the eagle or the sentinel.
    assert.deepEqual(
      option.modes?.map((one) => one.id),
      ["form-creatures-dire-wolf"],
    );
    const taken = step(definition, state, {
      actorId: "druid",
      optionId: option.id,
      targetIds: ["druid"],
      mode: "form-creatures-dire-wolf",
    });
    state = taken.state;
    const shaped = of(taken.events, "shaped");
    assert.equal(shaped.length, 1, JSON.stringify(taken.events));
    assert.equal(shaped[0]!.form, "Dire Wolf");
    const wolfDruid = who(state, "druid");
    assert.ok(rulesetCombatConditions(definition, wolfDruid).includes("wild_shaped"));
    assert.equal(wolfDruid.shape?.name, "Dire Wolf");
    assert.equal(wolfDruid.defense, 14, "the wolf's hide");
    assert.ok(
      wolfDruid.actions.some((one) => one.id === "maul"),
      "the wolf's own bite",
    );
    assert.ok(
      wolfDruid.actions.some((one) => one.entry === "spells/polymorph"),
      "what it keeps",
    );
    assert.ok(!wolfDruid.actions.some((one) => one.label === "Wild Shape"), "not what it does not keep");
    assert.ok(
      wolfDruid.actions.some((one) => one.id === "shape:revert"),
      "a way back",
    );
    assert.equal(wolfDruid.saves.wis_save, ownSaves.wis_save, "its own wisdom save, kept");
    // Where the druid is proficient (1.404, 1.405), the better of the wolf's own and the wolf's ability
    // with the druid's proficiency (+3 at 8th level); everything else the wolf's, a better Dexterity
    // of the druid's own included.
    {
      const better = parsed(
        document([wolfOnly, polymorph], (doc) => {
          doc.combat.conditions.find((one: { condition: string }) => one.condition === "wild_shaped").shape.betterOf =
            true;
        }),
      );
      const betterEntries = better.catalogs!.find((catalog) => catalog.id === "spells")!
        .entries! as RulesetCatalogEntry[];
      const start = fight(better, betterEntries, 8, {
        saves: { con_save: "proficient" },
        skills: { athletics: "proficient", acrobatics: "none" },
        dex: 18,
      });
      const own = structuredClone(who(start, "druid"));
      assert.equal(own.saves.dex_save, 4, "Dex 18, not proficient");
      const turned = step(better, start, {
        actorId: "druid",
        optionId: optionFor(better, start, "druid", "Wild Shape").id,
        targetIds: ["druid"],
        mode: "form-creatures-dire-wolf",
      });
      const shaped = who(turned.state, "druid");
      assert.equal(shaped.saves.con_save, 2 + 3, "the wolf's Con 15 with the druid's proficiency");
      assert.equal(shaped.saves.dex_save, wolfDruid.saves.dex_save, "the wolf's Dexterity save, not the druid's +4");
      assert.equal(shaped.saves.str_save, wolfDruid.saves.str_save, "not proficient: the wolf's");
      assert.equal(shaped.saves.wis_save, own.saves.wis_save, "kept: its own");
      assert.equal(shaped.checks?.might, 3 + 3, "Athletics: the wolf's Str 17 with the druid's proficiency");
      assert.equal(shaped.checks?.agility, wolfDruid.checks?.agility, "Acrobatics, not proficient: the wolf's");
    }
    assert.deepEqual(wolfDruid.creature, { catalogId: "creatures", entryId: "dire-wolf" }, "drawn as the wolf");
    assert.deepEqual(health(definition, wolfDruid), { value: 30, max: 30, temp: 0 }, "the wolf's health");

    // A blow of 35 at the wolf's 30: the shape ends, and 5 carries on to the druid's 40.
    {
      const hit = structuredClone(state);
      hit.turn = 1;
      who(hit, "brute").budgets.action = 1;
      const struck = step(definition, hit, { actorId: "brute", optionId: "smash", targetIds: ["druid"] });
      const back = who(struck.state, "druid");
      assert.equal(back.shape, undefined, "the shape ends");
      assert.ok(of(struck.events, "shaped").some((one) => one.gone && one.reason === "damage"));
      assert.ok(!rulesetCombatConditions(definition, back).includes("wild_shaped"), "and what held it");
      assert.equal(health(definition, back)!.value, 35, "the rest carries on");
      assert.equal(back.defense, ownDefense);
      assert.deepEqual(
        back.actions.map((one) => one.id),
        ownActions,
        "its own actions back",
      );
      assert.equal(back.creature, undefined, "drawn as itself");
    }
    // A smaller blow stays in the form.
    {
      const hit = structuredClone(state);
      hit.turn = 1;
      who(hit, "brute").budgets.action = 1;
      who(hit, "brute").actions[0]!.damage = { flat: 10, type: "bludgeoning" } as never;
      const struck = step(definition, hit, { actorId: "brute", optionId: "smash", targetIds: ["druid"] });
      const still = who(struck.state, "druid");
      assert.equal(still.shape?.health?.value, 20);
      assert.equal(health(definition, still)!.value, 20);
    }
    // The way back, on the bonus action.
    {
      const revert = rulesetCombatOptions(definition, state, "druid").find((one) => one.id === "shape:revert");
      assert.ok(revert, "offered on the bonus action");
      const back = step(definition, state, { actorId: "druid", optionId: "shape:revert", targetIds: [] });
      const druidBack = who(back.state, "druid");
      assert.equal(druidBack.shape, undefined);
      assert.ok(!rulesetCombatConditions(definition, druidBack).includes("wild_shaped"));
      assert.equal(druidBack.defense, ownDefense);
      assert.equal(health(definition, druidBack)!.value, 40, "their own health, untouched");
      assert.equal(druidBack.budgets.bonus, 0, "the bonus action spent");
    }
    // `unless`: flying once it reads above 0.
    {
      const flier = parsed(
        document([
          wildShape({
            into: ["creatures/dire-wolf", "creatures/giant-eagle"],
            upTo: { filter: "cr", at: { const: 1 } },
            without: [{ speed: "fly", unless: { field: "level" } }],
          }),
        ]),
      );
      const flierEntries = flier.catalogs!.find((catalog) => catalog.id === "spells")!
        .entries! as RulesetCatalogEntry[];
      assert.deepEqual(
        optionFor(flier, fight(flier, flierEntries), "druid", "Wild Shape").modes?.map((one) => one.id),
        ["form-creatures-dire-wolf", "form-creatures-giant-eagle"],
      );
      // A cap nothing reaches leaves nothing to take, and nothing is offered.
      const none = parsed(
        document([wildShape({ into: ["creatures/hollow-sentinel"], upTo: { filter: "cr", at: { const: 1 } } })]),
      );
      const noneEntries = none.catalogs!.find((catalog) => catalog.id === "spells")!.entries! as RulesetCatalogEntry[];
      assert.ok(
        !rulesetCombatOptions(none, fight(none, noneEntries), "druid").some((one) => one.label === "Wild Shape"),
      );
    }
  }

  // ── Polymorph on a creature: capped by its own number, held by concentration ──
  {
    const definition = parsed(document([polymorph]));
    const entries = definition.catalogs!.find((catalog) => catalog.id === "spells")!.entries! as RulesetCatalogEntry[];
    const state = fight(definition, entries);
    assert.deepEqual(who(state, "piper").ranks, { cr: 2 });
    const option = optionFor(definition, state, "druid", "Polymorph");
    assert.deepEqual(
      option.modes?.map((one) => one.id),
      ["form-creatures-dire-wolf", "form-creatures-hollow-sentinel"],
    );
    // CR 3 for a CR 2 piper: refused.
    queued = [1];
    const tooBig = applyRulesetCombatChoice(
      definition,
      structuredClone(state),
      { actorId: "druid", optionId: option.id, targetIds: ["piper"], mode: "form-creatures-hollow-sentinel" },
      roll,
    );
    assert.ok(
      of(tooBig.events, "shaped").some((one) => one.refused),
      JSON.stringify(tooBig.events),
    );
    assert.equal(who(tooBig.state, "piper").shape, undefined);
    assert.ok(!rulesetCombatConditions(definition, who(tooBig.state, "piper")).includes("polymorphed"));
    // The wolf, on a failed save.
    queued = [1];
    const turned = step(definition, structuredClone(state), {
      actorId: "druid",
      optionId: option.id,
      targetIds: ["piper"],
      mode: "form-creatures-dire-wolf",
    });
    queued = [];
    const piper = who(turned.state, "piper");
    assert.equal(piper.shape?.name, "Dire Wolf");
    assert.deepEqual(
      piper.actions.filter((one) => !one.id.startsWith("contest:")).map((one) => one.id),
      ["maul"],
      "only the wolf's, and no way back",
    );
    // A saved one stays itself.
    queued = [20];
    const saved = step(definition, structuredClone(state), {
      actorId: "druid",
      optionId: option.id,
      targetIds: ["piper"],
      mode: "form-creatures-dire-wolf",
    });
    queued = [];
    assert.equal(who(saved.state, "piper").shape, undefined);
    // Concentration broken: a hit on the druid, and a failed save.
    const later = structuredClone(turned.state);
    later.turn = 1;
    who(later, "brute").budgets.action = 1;
    queued = [10, 1];
    const broken = step(definition, later, { actorId: "brute", optionId: "smash", targetIds: ["druid"] });
    queued = [];
    const piperBack = who(broken.state, "piper");
    assert.equal(piperBack.shape, undefined, "the piper is itself again");
    assert.ok(piperBack.actions.some((one) => one.id === "bone_rap"));
    assert.deepEqual(piperBack.creature, { catalogId: "creatures", entryId: "grave-piper" });
  }

  // ── Beast Spells and Archdruid (1.435) ──
  {
    const archdruid = (doc: Record<string, any>) => {
      doc.combat.components = [
        { id: "verbal", label: "Verbal" },
        { id: "somatic", label: "Somatic" },
      ];
      doc.sheet.live.conditions.push({ id: "gagged", label: "Gagged" });
      doc.combat.conditions.push({ condition: "gagged", effects: [], forbids: { components: ["verbal"] } });
      for (const [id, at] of [
        ["beast_spells", 18],
        ["archdruid", 20],
      ] as const) {
        doc.sheet.derived.push({
          id,
          label: id,
          op: "stepTable",
          from: { field: "level" },
          table: [
            [0, 0],
            [at, 1],
          ],
        });
      }
      doc.combat.levels = [
        ...(doc.combat.levels ?? []),
        { derived: "beast_spells", at: 1, shapeKeeps: ["spells/*"] },
        { derived: "archdruid", at: 1, waives: ["verbal", "somatic"] },
      ];
    };
    const spoken = { ...polymorph, mechanics: { ...polymorph.mechanics, components: ["verbal", "somatic"] } };
    const definition = parsed(document([wolfOnly, spoken], archdruid));
    const entries = definition.catalogs!.find((catalog) => catalog.id === "spells")!.entries! as RulesetCatalogEntry[];
    const shapedAt = (level: number) => {
      const start = fight(definition, entries, level);
      const option = optionFor(definition, start, "druid", "Wild Shape");
      const taken = step(definition, start, {
        actorId: "druid",
        optionId: option.id,
        targetIds: ["druid"],
        mode: "form-creatures-dire-wolf",
      });
      return who(taken.state, "druid");
    };
    assert.ok(!shapedAt(17).actions.some((one) => one.label === "Wild Shape"), "only what the shape keeps");
    assert.ok(
      shapedAt(18).actions.some((one) => one.label === "Wild Shape"),
      "every spell of the catalog, from 18th level",
    );
    const gagged = (level: number) => {
      const state = fight(definition, entries, level);
      who(state, "druid").tracked.push({ condition: "gagged", rounds: null });
      return rulesetCombatOptions(definition, state, "druid").some((one) => one.label === "Polymorph");
    };
    assert.equal(gagged(19), false, "a gag stops a spoken spell");
    assert.equal(gagged(20), true, "but not one whose words are waived");
    // Only the druid's own spells (1.437): a wizard's stays behind in the shape, and stays gagged.
    {
      const scoped = (doc: Record<string, any>) => {
        archdruid(doc);
        doc.sheet.lists
          .find((list: { id: string }) => list.id === "spells")
          .columns.push({ id: "class", label: "Class", type: "text", maxLength: 40 });
        for (const level of doc.combat.levels.slice(-2)) {
          level.rowsWhere = { list: "spells", column: "class", is: ["druid"] };
        }
      };
      const druidRow = (entry: Record<string, any>) => ({
        ...entry,
        rows: entry.rows.map((row: Record<string, any>) => ({ ...row, values: { ...row.values, class: "Druid" } })),
      });
      const shield = {
        id: "shield",
        label: "Shield",
        rows: [{ list: "spells", values: { name: "Shield", level: 1, prepared: true, class: "Wizard" } }],
        mechanics: { kind: "buff", targets: "self", budget: "action", components: ["verbal", "somatic"] },
      };
      const scopedDefinition = parsed(document([druidRow(wolfOnly), druidRow(spoken), shield], scoped));
      const scopedEntries = scopedDefinition.catalogs!.find((catalog) => catalog.id === "spells")!
        .entries! as RulesetCatalogEntry[];
      const start = fight(scopedDefinition, scopedEntries, 20);
      const option = optionFor(scopedDefinition, start, "druid", "Wild Shape");
      const wolf = who(
        step(scopedDefinition, start, {
          actorId: "druid",
          optionId: option.id,
          targetIds: ["druid"],
          mode: "form-creatures-dire-wolf",
        }).state,
        "druid",
      );
      assert.ok(
        wolf.actions.some((one) => one.label === "Wild Shape"),
        "a druid spell, kept",
      );
      assert.ok(!wolf.actions.some((one) => one.label === "Shield"), "a wizard spell, not");
      const gag = fight(scopedDefinition, scopedEntries, 20);
      who(gag, "druid").tracked.push({ condition: "gagged", rounds: null });
      const labels = rulesetCombatOptions(scopedDefinition, gag, "druid").map((one) => one.label);
      assert.ok(labels.includes("Polymorph"), "a druid spell's words waived");
      assert.ok(!labels.includes("Shield"), "a wizard spell's not");
      // A row with no cell for the column reads its default (1.438): spells the builder added from a
      // catalog carry no class, and 5e's column says "any".
      {
        const defaulted = (doc: Record<string, any>) => {
          scoped(doc);
          const spellList = doc.sheet.lists.find((list: { id: string }) => list.id === "spells");
          spellList.columns.at(-1).default = "any";
          for (const level of doc.combat.levels.slice(-2)) level.rowsWhere.is = ["druid", "any"];
        };
        const plain = parsed(document([wolfOnly, spoken, shield], defaulted));
        const plainEntries = plain.catalogs!.find((catalog) => catalog.id === "spells")!
          .entries! as RulesetCatalogEntry[];
        const gagged = fight(plain, plainEntries, 20);
        who(gagged, "druid").tracked.push({ condition: "gagged", rounds: null });
        const heard = rulesetCombatOptions(plain, gagged, "druid").map((one) => one.label);
        assert.ok(heard.includes("Polymorph"), "a classless row reads the default and is waived");
        assert.ok(!heard.includes("Shield"), "a row saying Wizard is not");
      }
      refused(
        document([wolfOnly], (doc) => {
          archdruid(doc);
          doc.combat.levels.at(-1).rowsWhere = { list: "spells", column: "nope", is: ["Druid"] };
        }),
        /List "spells" has no column "nope"/,
      );
      const gate421 =
        "A ruleset whose conditions or levels narrow what they keep or waive to some rows (rowsWhere) requires schemaVersion 2 and capabilityApi 1.437 or newer";
      const manifest421 = (minor: number) => ({
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
      const narrowed = document([druidRow(wolfOnly)], scoped);
      assert.equal(getCapabilityPackageInstallIssue(manifest421(436) as never, narrowed), gate421);
      assert.notEqual(getCapabilityPackageInstallIssue(manifest421(437) as never, narrowed), gate421);
    }
    refused(
      document([wolfOnly], (doc) => {
        archdruid(doc);
        doc.combat.levels.at(-1).waives = ["material"];
      }),
      /Unknown component "material"/,
    );
    const gate =
      "A ruleset whose conditions or levels keep actions in any shape (shapeKeeps) or waive components (waives) requires schemaVersion 2 and capabilityApi 1.435 or newer";
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
    const withLevels = document([wolfOnly, spoken], archdruid);
    assert.equal(getCapabilityPackageInstallIssue(manifest(434) as never, withLevels), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(435) as never, withLevels), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(434) as never, document([wolfOnly])), gate);
  }

  // ── Refused shapes ──
  {
    refused(
      document([
        {
          ...wolfOnly,
          mechanics: { ...wolfOnly.mechanics, applies: [{ condition: "prone", duration: { rounds: 1 } }] },
        },
      ]),
      /names a condition with "shape"/,
    );
    refused(
      document([wolfOnly], (doc) => {
        doc.combat.conditions.find((one: { condition: string }) => one.condition === "wild_shaped").shape.revert =
          "nope";
      }),
      /Unknown budget "nope"/,
    );
    refused(
      document([wolfOnly], (doc) => {
        doc.combat.conditions.find((one: { condition: string }) => one.condition === "wild_shaped").shape.keepsSaves = [
          "luck",
        ];
      }),
      /Unknown save "luck"/,
    );
    refused(document([wildShape({ into: ["dire-wolf"] })]), /<catalogId>\/<entryId>/);
    refused(
      document([wildShape({ into: ["creatures/dire-wolf"], upTo: { filter: "cr" } })]),
      /reads "at", "targetLevel" or both/,
    );
    refused(
      document([], (doc) => {
        doc.catalogs
          .find((catalog: { holds?: string }) => catalog.holds === "creatures")
          .entries[0].creature.actions.push({
            id: "change",
            name: "Change Shape",
            budget: "action",
            applies: [{ condition: "wild_shaped", duration: { rounds: 600 } }],
            forms: { into: ["creatures/dire-wolf"], upTo: { filter: "cr", at: { const: 1 } } },
          });
      }),
      /A creature has no sheet to read "at" off/,
    );
  }

  // ── Forms read from a catalog (1.401): every beast, or everything but constructs and undead ──
  {
    const modesOf = (forms: Record<string, unknown>) => {
      const definition = parsed(document([wildShape(forms)]));
      const entries = definition.catalogs!.find((catalog) => catalog.id === "spells")!
        .entries! as RulesetCatalogEntry[];
      return optionFor(definition, fight(definition, entries), "druid", "Wild Shape").modes?.map((one) => one.id);
    };
    // Wild Shape: the beasts, capped at 1 and kept off flying.
    assert.deepEqual(
      modesOf({
        from: { catalog: "creatures", filters: { kind: "Beast" } },
        upTo: { filter: "cr", at: { const: 1 } },
        without: [{ speed: "fly" }],
      }),
      ["form-creatures-cinder-hound", "form-creatures-dire-wolf"],
    );
    // Shapechange: anything but a construct or an undead, any of a list, matched without case.
    assert.deepEqual(modesOf({ from: { catalog: "creatures", notFilters: { kind: ["construct", "Undead"] } } }), [
      "form-creatures-thorn-lurker",
      "form-creatures-cinder-hound",
      "form-creatures-toll-sergeant",
      "form-creatures-dire-wolf",
      "form-creatures-giant-eagle",
    ]);
    // A list-valued filter matches any of its own: found in ruins.
    assert.deepEqual(
      modesOf({ from: { catalog: "creatures", filters: { places: "Ruins", kind: ["Beast", "Undead"] } } }),
      ["form-creatures-cinder-hound", "form-creatures-grave-piper"],
    );
    // Named ones first, each once.
    assert.deepEqual(
      modesOf({ into: ["creatures/giant-eagle"], from: { catalog: "creatures", filters: { kind: "Beast" } } }),
      ["form-creatures-giant-eagle", "form-creatures-cinder-hound", "form-creatures-dire-wolf"],
    );
    refused(document([wildShape({ upTo: { filter: "cr", at: { const: 1 } } })]), /read "from" a catalog/);
    // Gated at 1.401; named forms alone stay 1.392's.
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
      "A ruleset with shape forms read from a catalog requires schemaVersion 2 and capabilityApi 1.401 or newer";
    const reading = document([wildShape({ from: { catalog: "creatures", filters: { kind: "Beast" } } })]);
    assert.equal(getCapabilityPackageInstallIssue(manifest(400) as never, reading), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(401) as never, reading), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(400) as never, document([wolfOnly])), gate);
  }

  // ── Taken by the Engine once its slots are spent, or hurt (laptop pass 6 2026-10-26: a druid 4 with
  //    Wild Shape on offer every turn of six never took it) ──
  {
    const thunderClap = {
      id: "thunder-clap",
      label: "Thunder Clap",
      rows: [{ list: "spells", values: { name: "Thunder Clap", level: 1, prepared: true } }],
      mechanics: {
        kind: "attack",
        targets: "enemy",
        range: 60,
        budget: "action",
        attackRoll: true,
        amount: { dice: "6d8" },
        damageType: "thunder",
        cost: [{ pool: "slots_1", amount: 1 }],
      },
    };
    const definition = parsed(document([wolfOnly, thunderClap]));
    const entries = definition.catalogs!.find((catalog) => catalog.id === "spells")!.entries! as RulesetCatalogEntry[];
    const scene = (slots: number, hurt?: number, on = definition, wet = false, list = entries) => {
      const encounter = fight(on, list, 8);
      // The foes' side of the board under water, the druid on the shore.
      if (wet)
        encounter.board!.grid.tiles[0] = encounter.board!.grid.tiles[0]!.map((tile, x) => (x >= 4 ? "water" : tile));
      const druid = who(encounter, "druid");
      druid.sheet!.build.fields.slots_max_1 = slots;
      druid.sheet!.build.fields.spellcasting_ability = "wis";
      if (hurt !== undefined) druid.sheet!.live = { pools: { hp: { value: hurt } } } as never;
      const unit = (id: string, side: "player" | "enemy") => ({
        id,
        name: id,
        side,
        hp: 40,
        maxHp: 40,
        attack: 8,
        defense: 6,
        speed: 6,
        level: 8,
        skills: [],
        aiHints: { proficiency: "master" as const },
      });
      const state = createCombatDirector({
        id: "fight",
        anchor: "anchor",
        style: "ruleset",
        party: [unit("druid", "player")],
        enemies: [unit("brute", "enemy"), unit("piper", "enemy")],
        gm: false,
        difficulty: "normal",
        seed: 3,
      } as never);
      state.rulesetFight = {
        encounter,
        events: [],
        eventSeq: 0,
        controllers: {},
        bosses: [],
        adjustments: [],
      } as never;
      return pickRulesetChoice(on, state, encounter, "druid")?.option.label;
    };
    assert.equal(scene(2), "Thunder Clap", "with slots, it casts");
    assert.match(scene(0) ?? "", /^Wild Shape/, "out of slots, it takes the form");
    assert.match(scene(2, 15) ?? "", /^Wild Shape/, "hurt, it takes the form's health before its own");
    // Where the foes are in water the walking body cannot cross, the form that swims is the one taken
    // (laptop 2026-10-30: two water fights, the Warhorse every time); on dry ground, the wolf.
    const shark = beast("reef-shark", "Reef Shark", 1, { health: 22, speed: 20, speeds: { swim: 40 } });
    const sea = wildShape({
      into: ["creatures/dire-wolf", "creatures/reef-shark"],
      upTo: { filter: "cr", at: { const: 1 } },
      without: [{ speed: "fly" }],
    });
    const seaDefinition = parsed(
      document([sea], (doc) =>
        doc.catalogs.find((catalog: { holds?: string }) => catalog.holds === "creatures").entries.push(shark),
      ),
    );
    const seaEntries = seaDefinition.catalogs!.find((catalog) => catalog.id === "spells")!
      .entries! as RulesetCatalogEntry[];
    assert.equal(
      scene(0, undefined, seaDefinition, false, seaEntries),
      "Wild Shape (Dire Wolf)",
      "the stronger form on land",
    );
    assert.equal(
      scene(0, undefined, seaDefinition, true, seaEntries),
      "Wild Shape (Reef Shark)",
      "the one that swims to them",
    );
    // A form that only swims is not taken on dry ground (laptop pass 6 2026-10-26: a Swarm of Quippers
    // on land).
    const swimmer = parsed(
      document([wolfOnly, thunderClap], (doc) => {
        const wolfEntry = doc.catalogs
          .find((catalog: { holds?: string }) => catalog.holds === "creatures")
          .entries.find((one: { id: string }) => one.id === "dire-wolf");
        wolfEntry.creature = { ...wolfEntry.creature, speed: 0, speeds: { swim: 40 } };
      }),
    );
    assert.doesNotMatch(scene(0, 15, swimmer) ?? "", /^Wild Shape/, "no swimmer's form on land");
  }

  // ── The install gate ──
  {
    const gate = "A ruleset with shape changes requires schemaVersion 2 and capabilityApi 1.392 or newer";
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
    const shaper = document([wolfOnly]);
    assert.equal(getCapabilityPackageInstallIssue(manifest(378) as never, shaper), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(392) as never, shaper), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(378) as never, JSON.parse(fiveEText)), gate);
    // A condition with a shape, on its own, needs it too.
    const held = JSON.parse(fiveEText);
    held.combat.conditions.push({ condition: "prone", effects: [], shape: {} });
    assert.equal(getCapabilityPackageInstallIssue(manifest(378) as never, held), gate);
  }

  console.log(
    "Shapes: Wild Shape's wolf with the druid's own wisdom, the rest of a blow past it, the way back; Polymorph capped by the piper's own number and ended with concentration; Beast Spells keeps the spells in shape and Archdruid waives their words.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
