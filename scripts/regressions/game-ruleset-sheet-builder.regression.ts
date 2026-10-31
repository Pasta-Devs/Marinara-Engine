/**
 * The guided builder (Capability API 1.86): `sheet.builder.steps` and a catalog entry's `grants`.
 *
 *   - The keys read, and a builder that names what the ruleset does not have is refused.
 *   - Picks apply what they grant (score increases, chosen increases, training, field values, rows,
 *     the step's field) and unpicking takes it back, a subrace with its race.
 *   - The methods: point buy within its budget, an array or rolls handed out one value to a score,
 *     manual entry; increases go on top.
 *   - An edit made in the full form survives until the builder's own answer changes.
 *   - Each step's remaining choices; gated inline and in a catalog file.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  applyRulesetBuilder,
  defaultRulesetSheetBuild,
  parseRulesetDefinition,
  readRulesetBuilderState,
  rulesetBuilderAbilitySlots,
  rulesetBuilderBaseScores,
  rulesetBuilderCatalogIds,
  rulesetBuilderChoiceKey,
  rulesetBuilderOptions,
  rulesetBuilderRemaining,
  rulesetBuilderShownFields,
  rulesetBuilderTrainedSlots,
  rulesetCatalogEntryIssues,
  rulesetPointBuySpent,
  rulesetBuilderMethod,
  rulesetBuilderStepCount,
  rulesetBuilderPickAdded,
  rulesetBuilderPicks,
  rulesetBuilderEntrySlots,
  rulesetSheetBuildIsBlank,
  type RulesetBuilderState,
  type RulesetCatalogEntriesById,
  type RulesetDefinition,
  type RulesetSheetBuild,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-sheet-builder-"));
process.env.DATA_DIR = dataDir;
process.env.MARINARA_DATA_DIR = dataDir;
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
const fiveEText = read("../../docs/development/ruleset-5e-2014.example.json");

const races = {
  id: "races",
  label: "Races",
  feeds: ["features"],
  filters: [{ id: "parent", label: "Race", type: "text" }],
  entries: [
    {
      id: "dwarf",
      label: "Dwarf",
      summary: "Stout and hardy.",
      rows: [{ list: "features", values: { name: "Darkvision", text: "See in the dark." } }],
      grants: { abilities: { add: { con: 2 } } },
    },
    { id: "hill-dwarf", label: "Hill Dwarf", filters: { parent: "dwarf" }, grants: { abilities: { add: { wis: 1 } } } },
    {
      id: "half-elf",
      label: "Half-Elf",
      grants: {
        abilities: { add: { cha: 2 }, choose: [{ count: 2, amount: 1, except: ["cha"] }] },
        trained: { choose: [{ what: "skills", count: 2 }] },
      },
    },
  ],
};
const classes = {
  id: "classes",
  label: "Classes",
  entries: [
    {
      id: "fighter",
      label: "Fighter",
      grants: {
        trained: {
          saves: ["str_save", "con_save"],
          choose: [{ what: "skills", count: 2, from: ["acrobatics", "athletics", "perception", "survival"] }],
        },
        sets: { hit_die: "d10" },
      },
    },
    {
      id: "wizard",
      label: "Wizard",
      grants: { trained: { saves: ["int_save", "wis_save"] }, sets: { hit_die: "d6", level: 1 } },
    },
  ],
};
const steps = [
  { id: "race", label: "Race", kind: "catalog", catalog: "races", field: "race", filters: {} },
  {
    id: "subrace",
    label: "Subrace",
    kind: "catalog",
    catalog: "races",
    min: 0,
    within: { step: "race", filter: "parent" },
  },
  { id: "class", label: "Class", kind: "catalog", catalog: "classes", field: "class" },
  { id: "level", label: "Level", kind: "fields", fields: ["level", "background"] },
  {
    id: "scores",
    label: "Ability Scores",
    kind: "abilities",
    methods: {
      pointBuy: {
        budget: 27,
        costs: [
          [8, 0],
          [9, 1],
          [10, 2],
          [11, 3],
          [12, 4],
          [13, 5],
          [14, 7],
          [15, 9],
        ],
      },
      standardArray: [15, 14, 13, 12, 10, 8],
      roll: { count: 4, sides: 6, keep: 3 },
      manual: true,
    },
  },
  { id: "skills", label: "Proficiencies", kind: "trained" },
];

const variant = (edit: (doc: Record<string, any>) => void = () => {}) => {
  const doc = JSON.parse(fiveEText) as Record<string, any>;
  // A race offers subraces by a filter, so the race step offers only the ones without a parent; the
  // test reads them with `filters: {}` and checks `within` on its own.
  doc.catalogs.push(structuredClone(races), structuredClone(classes));
  doc.sheet.builder = { tier: "proficient", steps: structuredClone(steps) };
  edit(doc);
  return doc;
};
const parsed = (doc: unknown): RulesetDefinition => {
  const result = parseRulesetDefinition(doc);
  assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
  return result.definition;
};
const refused = (edit: (doc: Record<string, any>) => void, pattern: RegExp) => {
  const result = parseRulesetDefinition(variant(edit));
  assert.equal(result.ok, false, `refused: ${pattern}`);
  assert.ok(
    !result.ok && result.issues.some((issue) => pattern.test(issue)),
    `${pattern} in ${!result.ok && result.issues.join("; ")}`,
  );
};

try {
  const definition = parsed(variant());
  const catalogs: RulesetCatalogEntriesById = Object.fromEntries(
    (definition.catalogs ?? []).map((catalog) => [catalog.id, catalog.entries ?? []]),
  );
  assert.deepEqual(rulesetBuilderCatalogIds(definition), ["races", "classes"]);

  // ── Bigger catalogs and bounded manual scores (1.110) ──
  const biggerCatalogDoc = variant((doc) => Object.assign(doc.sheet.builder.steps[0], { min: 40, max: 40 }));
  const biggerCatalog = parsed(biggerCatalogDoc);
  const biggerStep = biggerCatalog.sheet.builder!.steps[0]!;
  assert.ok(biggerStep.kind === "catalog");
  assert.deepEqual(rulesetBuilderStepCount(biggerCatalog, biggerStep), { min: 40, max: 40 });
  // Up to 60 since 1.768: a wizard's spellbook at 20th level.
  assert.equal(
    parsed(variant((doc) => Object.assign(doc.sheet.builder.steps[0], { min: 60, max: 60 }))).sheet.builder!.steps[0]!
      .kind,
    "catalog",
  );
  refused(
    (doc) => Object.assign(doc.sheet.builder.steps[0], { min: 61, max: 60 }),
    /Too big: expected number to be <=60/,
  );
  refused((doc) => (doc.sheet.builder.steps[0].max = 61), /Too big: expected number to be <=60/);
  const manualDoc = variant((doc) => (doc.sheet.builder.steps[4].methods.manual = { min: 8, max: 15 }));
  const boundedManual = parsed(manualDoc);
  const typed: RulesetBuilderState = { method: "manual", base: { str: 100, dex: -100, con: 12 } };
  assert.deepEqual(rulesetBuilderBaseScores(boundedManual, typed), { str: 15, dex: 8, con: 12 });
  const boundedBuild = applyRulesetBuilder(
    boundedManual,
    defaultRulesetSheetBuild(boundedManual),
    {
      ...typed,
      picks: { race: ["dwarf"] },
    },
    catalogs,
  );
  assert.deepEqual(
    [boundedBuild.build.abilities.str, boundedBuild.build.abilities.dex, boundedBuild.build.abilities.con],
    [15, 8, 14],
    "manual bounds hold the base before grants",
  );
  assert.deepEqual(rulesetBuilderBaseScores(definition, typed), typed.base, "manual true keeps its existing behavior");
  assert.deepEqual(
    rulesetBuilderBaseScores(boundedManual, { ...typed, method: "pointBuy" }),
    rulesetBuilderBaseScores(definition, { ...typed, method: "pointBuy" }),
    "manual bounds do not change point buy",
  );
  parsed(variant((doc) => (doc.sheet.builder.steps[4].methods.manual = { min: -100, max: 1000 })));
  for (const bounds of [
    { min: -101, max: 15 },
    { min: 8, max: 1001 },
    { min: 8.5, max: 15 },
    { min: 8, max: 15.5 },
  ]) {
    refused((doc) => (doc.sheet.builder.steps[4].methods.manual = bounds), /manual/);
  }
  refused((doc) => (doc.sheet.builder.steps[4].methods.manual = { min: 16, max: 15 }), /min at most max/);

  // ── More derived values (1.111) and builder steps (1.112) ──
  const derivedDoc = variant((doc) => {
    while (doc.sheet.derived.length < 400) {
      doc.sheet.derived.push({
        id: `extra_${doc.sheet.derived.length}`,
        label: "Extra",
        op: "sum",
        of: [{ const: 1 }],
      });
    }
  });
  assert.equal(parsed(derivedDoc).sheet.derived.length, 400);
  const tooManyDerived = structuredClone(derivedDoc);
  tooManyDerived.sheet.derived.push({ id: "one_more", label: "Extra", op: "sum", of: [{ const: 1 }] });
  assert.equal(parsed(tooManyDerived).sheet.derived.length, 401, "401 derived values since 1.729");
  while (tooManyDerived.sheet.derived.length < 801) {
    tooManyDerived.sheet.derived.push({
      id: `more_${tooManyDerived.sheet.derived.length}`,
      label: "Extra",
      op: "sum",
      of: [{ const: 1 }],
    });
  }
  assert.equal(parseRulesetDefinition(tooManyDerived).ok, false, "801 derived values are refused");
  const moreStepsDoc = variant((doc) => {
    while (doc.sheet.builder.steps.length < 32) {
      doc.sheet.builder.steps.push({
        id: `extra_${doc.sheet.builder.steps.length}`,
        label: "Extra",
        kind: "fields",
        fields: ["level"],
      });
    }
  });
  assert.equal(parsed(moreStepsDoc).sheet.builder!.steps.length, 32, "32 builder steps since 1.768");
  const tooManySteps = structuredClone(moreStepsDoc);
  tooManySteps.sheet.builder.steps.push({ id: "one_too_many", label: "Extra", kind: "fields", fields: ["level"] });
  assert.equal(parseRulesetDefinition(tooManySteps).ok, false, "33 builder steps are refused");

  // ── What is refused ──
  refused((doc) => (doc.sheet.builder.steps[0].catalog = "nope"), /No catalog of rows "nope"/);
  refused((doc) => (doc.sheet.builder.steps[0].catalog = "creatures"), /No catalog of rows "creatures"/);
  refused((doc) => (doc.sheet.builder.steps[0].field = "level"), /No text or enum field "level"/);
  refused((doc) => (doc.sheet.builder.steps[1].within.step = "class"), /No catalog step "class" before/);
  refused((doc) => (doc.sheet.builder.steps[1].within.filter = "nope"), /No text or tags filter "nope"/);
  refused((doc) => (doc.sheet.builder.steps[0].filters = { nope: "x" }), /Unknown filter "nope"/);
  refused((doc) => (doc.sheet.builder.steps[0].min = 3), /at most its max/);
  refused((doc) => doc.sheet.builder.steps[3].fields.push("nope"), /Unknown field "nope"/);
  refused((doc) => (doc.sheet.builder.steps[3].optional = ["xp"]), /"xp" is not one of this step's fields/);
  {
    const optional = parsed(variant((doc) => (doc.sheet.builder.steps[3].optional = ["background"])));
    assert.equal(
      rulesetBuilderRemaining(optional, defaultRulesetSheetBuild(optional), {}, {}).level,
      0,
      "an optional field is not waited on",
    );
  }
  refused((doc) => doc.sheet.builder.steps[4].methods.standardArray.pop(), /one value to each of the 6 scores/);
  refused((doc) => doc.sheet.builder.steps.push({ ...doc.sheet.builder.steps[4], id: "again" }), /one step/);
  refused((doc) => (doc.sheet.builder.steps[4].methods = {}), /offers a method/);
  refused(
    (doc) =>
      (doc.sheet.builder.steps[4].methods.pointBuy.costs = [
        [8, 0],
        [10, 2],
      ]),
    /one score at a time/,
  );
  refused((doc) => (doc.sheet.builder.steps[4].methods.roll.keep = 5), /keeps at most/);
  refused(
    (doc) => doc.sheet.builder.steps.push({ id: "gear", label: "Gear", kind: "startingGear" }),
    /no starting gear/,
  );
  refused((doc) => (doc.sheet.builder.tier = "none"), /not a tier above untrained/);
  refused(
    (doc) =>
      doc.sheet.builder.steps.push({
        id: "own",
        label: "Own",
        kind: "trained",
        choose: [{ what: "saves", count: 1, from: ["nope"] }],
      }),
    /Unknown save "nope"/,
  );
  refused((doc) => (doc.sheet.builder.steps[1].id = "race"), /Duplicate builder step id "race"/);
  // Grants, inline (an asset file's entries go through the same checks).
  const grantRefused = (grants: unknown, pattern: RegExp) =>
    refused(
      (doc) => (doc.catalogs.find((c: { id: string }) => c.id === "classes").entries[0].grants = grants),
      pattern,
    );
  grantRefused({ abilities: { add: { luck: 1 } } }, /Unknown ability "luck"/);
  grantRefused({ abilities: { choose: [{ count: 6, amount: 1, except: ["cha"] }] } }, /Only 5 scores are left/);
  grantRefused({ trained: { skills: ["nope"] } }, /Unknown skill "nope"/);
  grantRefused({ trained: { saves: ["str_save"], tier: "none" } }, /not a tier above untrained/);
  grantRefused({ trained: { choose: [{ what: "saves", count: 1, from: ["athletics"] }] } }, /Unknown save "athletics"/);
  grantRefused({ sets: { hit_die: "d20" } }, /cannot hold "d20"/);
  grantRefused({ sets: { level: 99 } }, /cannot hold 99/);
  grantRefused({ sets: { nope: 1 } }, /Unknown field "nope"/);
  refused(
    (doc) => delete doc.catalogs.find((c: { id: string }) => c.id === "classes").entries[0].grants,
    /exactly one of "rows", "creature" or "item", or only "grants"/,
  );
  refused(
    (doc) =>
      (doc.catalogs.find((c: { holds?: string }) => c.holds === "creatures").entries[0].grants = {
        sets: { level: 1 },
      }),
    /Only an entry for a sheet grants/,
  );
  assert.deepEqual(
    rulesetCatalogEntryIssues(
      definition,
      definition.catalogs!.find((c) => c.id === "classes")!,
      [{ id: "x", label: "X", grants: { sets: { hit_die: "d3" } } }],
    ).map((issue) => issue.message),
    ['Field "hit_die" cannot hold "d3"'],
    "a catalog file's entries are checked the same way",
  );

  // ── Picks apply and unpicking takes back ──
  const raceStep = definition.sheet.builder!.steps[0]!;
  const subStep = definition.sheet.builder!.steps[1]!;
  assert.ok(raceStep.kind === "catalog" && subStep.kind === "catalog");
  let build: RulesetSheetBuild = defaultRulesetSheetBuild(definition);
  let state: RulesetBuilderState = {};
  const apply = (next: RulesetBuilderState) => {
    const out = applyRulesetBuilder(definition, build, next, catalogs);
    build = out.build;
    state = out.state;
  };
  assert.deepEqual(
    rulesetBuilderOptions(definition, subStep, {}, catalogs).map((entry) => entry.id),
    [],
    "no subrace before a race",
  );
  apply({ picks: { race: ["dwarf"] } });
  assert.equal(build.abilities.con, 12, "a dwarf's constitution +2");
  assert.equal(build.fields.race, "Dwarf", "the step writes its field");
  assert.equal(build.lists.features?.filter((row) => row._catalog === "races/dwarf").length, 1, "its rows");
  assert.deepEqual(
    rulesetBuilderOptions(definition, subStep, state, catalogs).map((entry) => entry.id),
    ["hill-dwarf"],
    "a subrace by its race",
  );
  apply({ ...state, picks: { ...state.picks, subrace: ["hill-dwarf"] } });
  assert.equal(build.abilities.wis, 11);
  apply({ ...state });
  assert.equal(build.abilities.con, 12, "applying again changes nothing");
  assert.equal(build.lists.features?.filter((row) => row._catalog === "races/dwarf").length, 1, "rows never twice");
  apply({ ...state, picks: { ...state.picks, race: ["half-elf"] } });
  assert.equal(build.abilities.con, 10, "the dwarf's increase is taken back");
  assert.equal(build.abilities.wis, 10, "and the subrace's, whose race went");
  assert.equal(build.abilities.cha, 12);
  assert.equal(build.fields.race, "Half-Elf");
  assert.equal(
    build.lists.features?.some((row) => row._catalog === "races/dwarf"),
    false,
    "its rows go",
  );

  // A chosen increase, never twice and never one the choice excepts.
  const [abilitySlot] = rulesetBuilderAbilitySlots(definition, state, catalogs);
  assert.ok(abilitySlot);
  assert.equal(abilitySlot.stepId, "scores", "shown at the abilities step");
  assert.deepEqual(abilitySlot.from, ["str", "dex", "con", "int", "wis"]);
  apply({ ...state, abilityChoices: { [abilitySlot.key]: ["dex", "dex", "cha", "int", "str"] } });
  assert.deepEqual(
    [build.abilities.dex, build.abilities.int, build.abilities.str, build.abilities.cha],
    [11, 11, 10, 12],
  );

  // Class: saves, a field, a skill choice at the trained step.
  apply({ ...state, picks: { ...state.picks, class: ["fighter"] } });
  assert.equal(build.saves.str_save, "proficient");
  assert.equal(build.fields.hit_die, "d10");
  assert.equal(build.fields.class, "Fighter");
  const fighterSlot = rulesetBuilderTrainedSlots(definition, state, catalogs).find(
    (slot) => slot.entry?.id === "fighter",
  );
  assert.ok(fighterSlot);
  assert.equal(fighterSlot.stepId, "skills");
  apply({ ...state, trainedChoices: { [fighterSlot.key]: ["athletics", "arcana", "perception"] } });
  assert.equal(build.skills.athletics, "proficient");
  assert.equal(build.skills.perception, "proficient");
  assert.equal(build.skills.arcana, undefined, "only from the class's list");

  // An edit in the full form survives until the builder's answer for it changes.
  build = {
    ...build,
    fields: { ...build.fields, hit_die: "d12" },
    skills: { ...build.skills, athletics: "expertise" },
  };
  apply({ ...state, method: "manual" });
  assert.equal(build.fields.hit_die, "d12", "a field edit survives an unrelated step");
  apply({ ...state, picks: { ...state.picks, class: ["wizard"] } });
  assert.equal(build.fields.hit_die, "d6", "and goes when the pick changes");
  assert.equal(build.skills.athletics, "expertise", "a tier raised by hand is the player's");
  assert.equal(build.skills.perception, undefined, "the builder's own is taken back");
  assert.equal(build.saves.str_save, undefined);
  assert.equal(build.saves.int_save, "proficient");
  apply({ ...state, picks: { ...state.picks, race: [], class: [] } });
  assert.equal(build.fields.race, undefined, "no race, no field");
  assert.equal(build.abilities.cha, 10);

  // ── The methods ──
  const scoreStep = definition.sheet.builder!.steps[4]!;
  assert.ok(scoreStep.kind === "abilities");
  const ids = ["str", "dex", "con", "int", "wis", "cha"];
  build = defaultRulesetSheetBuild(definition);
  state = {};
  let left = rulesetBuilderRemaining(definition, build, state, catalogs);
  assert.deepEqual(left, { race: 1, subrace: 0, class: 1, level: 1, scores: 1, skills: 0 }, "background is empty");
  apply({ method: "pointBuy" });
  assert.deepEqual(
    ids.map((id) => build.abilities[id]),
    [8, 8, 8, 8, 8, 8],
    "point buy starts at the lowest",
  );
  assert.equal(rulesetPointBuySpent(scoreStep.methods.pointBuy!, build.abilities, ids), 0);
  apply({ ...state, base: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 }, picks: { race: ["dwarf"] } });
  assert.equal(
    rulesetPointBuySpent(scoreStep.methods.pointBuy!, { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 }, ids),
    27,
  );
  assert.equal(build.abilities.con, 15, "bought 13, +2 from the race");
  left = rulesetBuilderRemaining(definition, build, state, catalogs);
  assert.equal(left.scores, 0, "the budget is spent");
  assert.equal(left.race, 0);
  build = { ...build, abilities: { ...build.abilities, int: 17 } };
  apply({ ...state });
  assert.equal(build.abilities.int, 17, "a score typed in the full form survives");
  apply({ ...state, base: { ...state.base, int: 13 } });
  assert.equal(build.abilities.int, 13, "until the builder's own answer for it changes");
  apply({ ...state, base: { ...state.base, int: 12, str: 14 } });
  assert.equal(rulesetBuilderRemaining(definition, build, state, catalogs).scores, 1, "points left over");
  apply({ ...state, base: { ...state.base, str: 16 } });
  assert.equal(build.abilities.str, 15, "off the table, the nearest score on it");
  assert.equal(rulesetBuilderRemaining(definition, build, state, catalogs).scores, 0);
  // The array: one value to one score, a second claim is no claim.
  apply({ ...state, method: "standardArray", assign: { str: 0, dex: 0, con: 2 } });
  assert.equal(build.abilities.str, 15);
  assert.equal(build.abilities.con, 15, "13 +2");
  assert.equal(rulesetBuilderRemaining(definition, build, state, catalogs).scores, 4);
  // Rolls.
  apply({ ...state, method: "roll", rolled: [17, 9], assign: { str: 1, dex: 0 } });
  assert.deepEqual([build.abilities.str, build.abilities.dex], [9, 17]);
  assert.equal(rulesetBuilderRemaining(definition, build, state, catalogs).scores, 4);
  // A method the step does not offer reads as none.
  assert.equal(rulesetBuilderRemaining(definition, build, { method: "nope" as never }, catalogs).scores, 1);

  // The trained step's own choice counts there.
  const own = parsed(
    variant((doc) => (doc.sheet.builder.steps[5].choose = [{ what: "skills", count: 1, from: ["stealth"] }])),
  );
  const ownSlot = rulesetBuilderTrainedSlots(own, {}, catalogs);
  assert.equal(ownSlot[0]?.key, rulesetBuilderChoiceKey("skills", null, 0));
  assert.equal(rulesetBuilderRemaining(own, defaultRulesetSheetBuild(own), {}, catalogs).skills, 1);
  // Without a trained or abilities step, a grant's choices are shown where the entry was picked.
  const lean = parsed(variant((doc) => doc.sheet.builder.steps.splice(4, 2)));
  const leanState = { picks: { race: ["half-elf"] } };
  assert.equal(rulesetBuilderRemaining(lean, defaultRulesetSheetBuild(lean), leanState, catalogs).race, 4);

  // The state is read tolerantly.
  assert.deepEqual(readRulesetBuilderState({ builder: "nonsense" }), {});
  assert.deepEqual(readRulesetBuilderState(undefined), {});
  assert.deepEqual(readRulesetBuilderState({ builder: { method: "manual", extra: 1 } }), { method: "manual" });

  // ── Only what the builder wrote is taken back ──
  {
    const fresh = () => defaultRulesetSheetBuild(definition);
    // A skill trained by hand before a pick that grants it stays when the pick goes.
    let b: RulesetSheetBuild = { ...fresh(), saves: { str_save: "proficient" } };
    let st: RulesetBuilderState = {};
    ({ build: b, state: st } = applyRulesetBuilder(definition, b, { picks: { class: ["fighter"] } }, catalogs));
    ({ build: b, state: st } = applyRulesetBuilder(definition, b, { ...st, picks: { class: [] } }, catalogs));
    assert.equal(b.saves.str_save, "proficient", "a save the player trained stays theirs");
    assert.equal(b.saves.con_save, undefined, "the one the builder trained goes");
    // A field the player had already set to the granted value stays.
    b = { ...fresh(), fields: { ...fresh().fields, hit_die: "d10" } };
    ({ build: b, state: st } = applyRulesetBuilder(definition, b, { picks: { class: ["fighter"] } }, catalogs));
    ({ build: b, state: st } = applyRulesetBuilder(definition, b, { ...st, picks: { class: [] } }, catalogs));
    assert.equal(b.fields.hit_die, "d10");
    // A row the player added from the catalog stays.
    const own = { name: "Darkvision", text: "See in the dark.", _catalog: "races/dwarf" };
    b = { ...fresh(), lists: { features: [own] } };
    ({ build: b, state: st } = applyRulesetBuilder(definition, b, { picks: { race: ["dwarf"] } }, catalogs));
    assert.equal(b.lists.features?.length, 1, "never twice");
    ({ build: b, state: st } = applyRulesetBuilder(definition, b, { ...st, picks: { race: [] } }, catalogs));
    assert.equal(b.lists.features?.length, 1, "and the player's row stays");
    // A full list takes no rows, and the pick's rows come once there is room.
    const small = parsed(
      variant((doc) => (doc.sheet.lists.find((list: { id: string }) => list.id === "features").maxItems = 1)),
    );
    b = { ...defaultRulesetSheetBuild(small), lists: { features: [{ name: "Tough", text: "" }] } };
    ({ build: b, state: st } = applyRulesetBuilder(small, b, { picks: { race: ["dwarf"] } }, catalogs));
    assert.equal(b.lists.features?.length, 1);
    b = { ...b, lists: { features: [] } };
    ({ build: b, state: st } = applyRulesetBuilder(small, b, { ...st }, catalogs));
    assert.equal(b.lists.features?.[0]?._catalog, "races/dwarf", "tried again once there is room");
    // A score near its top takes back only what it was raised by.
    b = { ...fresh(), abilities: { ...fresh().abilities, con: 29 } };
    ({ build: b, state: st } = applyRulesetBuilder(definition, b, { picks: { race: ["dwarf"] } }, catalogs));
    assert.equal(b.abilities.con, 30);
    ({ build: b, state: st } = applyRulesetBuilder(definition, b, { ...st, picks: { race: [] } }, catalogs));
    assert.equal(b.abilities.con, 29);
    // Typed by hand, then bought: the nearest score on the table.
    ({ build: b, state: st } = applyRulesetBuilder(
      definition,
      fresh(),
      { method: "manual", base: { str: 17, dex: 3 } },
      catalogs,
    ));
    ({ build: b, state: st } = applyRulesetBuilder(definition, b, { ...st, method: "pointBuy" }, catalogs));
    assert.deepEqual([b.abilities.str, b.abilities.dex], [15, 8]);
    // A race with no subraces leaves nothing to choose, even at a step that asks for one.
    const asks = parsed(variant((doc) => (doc.sheet.builder.steps[1].min = 1)));
    assert.equal(rulesetBuilderRemaining(asks, fresh(), { picks: { race: ["half-elf"] } }, catalogs).subrace, 0);
    assert.equal(rulesetBuilderRemaining(asks, fresh(), { picks: { race: ["dwarf"] } }, catalogs).subrace, 1);
    // One entry picked at two steps grants once.
    const twice = parsed(
      variant((doc) =>
        doc.sheet.builder.steps.splice(1, 0, {
          id: "again",
          label: "Again",
          kind: "catalog",
          catalog: "races",
          min: 0,
        }),
      ),
    );
    ({ build: b } = applyRulesetBuilder(twice, fresh(), { picks: { race: ["dwarf"], again: ["dwarf"] } }, catalogs));
    assert.equal(b.abilities.con, 12);
    // A step takes no more than its max.
    ({ build: b } = applyRulesetBuilder(definition, fresh(), { picks: { race: ["dwarf", "half-elf"] } }, catalogs));
    assert.equal(b.fields.race, "Dwarf");
    assert.equal(b.abilities.cha, 10);
    // A character made without the builder: described, it is not changed by picking what it is.
    const made: RulesetSheetBuild = {
      ...fresh(),
      abilities: { ...fresh().abilities, con: 12 },
      fields: { ...fresh().fields, level: 5, hit_die: "d6", race: "Dwarf", class: "Wizard" },
      saves: { int_save: "proficient", wis_save: "proficient" },
    };
    ({ build: b, state: st } = applyRulesetBuilder(
      definition,
      made,
      { describing: true, picks: { race: ["dwarf"], class: ["wizard"] } },
      catalogs,
    ));
    assert.deepEqual(b, made, "describing changes nothing");
    ({ build: b, state: st } = applyRulesetBuilder(definition, b, { ...st, describing: false }, catalogs));
    assert.deepEqual(b, made, "and neither does ending it");
    ({ build: b, state: st } = applyRulesetBuilder(
      definition,
      b,
      { ...st, picks: { ...st.picks, race: [] } },
      catalogs,
    ));
    assert.equal(b.abilities.con, 10, "a described pick is taken back like any other");
    assert.equal(b.fields.race, undefined);
    assert.equal(b.fields.level, 5, "a level typed in is never written over");
    // Not described: a class still never writes over a level the player typed.
    ({ build: b } = applyRulesetBuilder(
      definition,
      { ...fresh(), fields: { ...fresh().fields, level: 5 } },
      { picks: { class: ["wizard"] } },
      catalogs,
    ));
    assert.equal(b.fields.level, 5);
    assert.equal(b.fields.hit_die, "d6", "a blank field is the builder's to fill");
    // A value the builder answers for, changed in its own step, goes when the pick that asked for it does.
    ({ build: b, state: st } = applyRulesetBuilder(definition, fresh(), { picks: { class: ["wizard"] } }, catalogs));
    assert.equal(st.applied?.fields.level, 1, "the blank level the class asks for is the builder's");
    b = { ...b, fields: { ...b.fields, level: 3 } };
    st = { ...st, applied: { ...st.applied!, fields: { ...st.applied!.fields, level: 3 } } };
    ({ build: b } = applyRulesetBuilder(definition, b, { ...st, picks: { class: ["fighter"] } }, catalogs));
    assert.equal(b.fields.level, undefined, "taken back with the class");
    assert.equal(rulesetSheetBuildIsBlank(definition, fresh()), true);
    assert.equal(rulesetSheetBuildIsBlank(definition, made), false);
    // One unreadable key costs only itself.
    assert.deepEqual(readRulesetBuilderState({ builder: { method: "manual", picks: "nope", rolled: [12] } }), {
      method: "manual",
      rolled: [12],
    });
  }
  refused((doc) => (doc.sheet.builder.steps[4].abilities = ["str", "str"]), /named twice/);
  refused((doc) => (doc.sheet.builder.steps[4].methods.standardArray[0] = 40), /40 is outside a score's bounds/);
  refused((doc) => (doc.sheet.builder.steps[4].methods.pointBuy.budget = 60), /more than buying every score up/);
  refused(
    (doc) => (doc.sheet.builder.steps[4].methods.roll = { count: 4, sides: 20, keep: 2 }),
    /outside a score's bounds/,
  );
  refused((doc) => doc.catalogs.push({ id: "empty", label: "Empty", entries: [] }), /names the lists it "feeds"/);

  // ── 1.87: a default method, and a step limited by a sheet value ──
  {
    const safe = parsed(
      variant((doc) => {
        doc.sheet.builder.steps[4].default = "pointBuy";
        doc.catalogs
          .find((c: { id: string }) => c.id === "races")
          .filters.push({ id: "tier", label: "Tier", type: "number" });
        const entries = doc.catalogs.find((c: { id: string }) => c.id === "races").entries;
        entries.find((e: { id: string }) => e.id === "hill-dwarf").filters.tier = 3;
        doc.sheet.builder.steps[1].upTo = { filter: "tier", value: { field: "level" } };
      }),
    );
    const blank = defaultRulesetSheetBuild(safe);
    const catalogs: RulesetCatalogEntriesById = Object.fromEntries(
      (safe.catalogs ?? []).map((catalog) => [catalog.id, catalog.entries ?? []]),
    );
    // A new character starts on point buy; one being described does not.
    assert.equal(rulesetBuilderMethod(safe, { made: "builder" }), "pointBuy");
    assert.equal(rulesetBuilderMethod(safe, { made: "builder", describing: true }), undefined);
    assert.equal(rulesetBuilderMethod(safe, { describing: false }), undefined, "nor one the builder did not start");
    assert.equal(
      rulesetBuilderMethod(safe, { describing: false, method: "manual" }),
      "manual",
      "the player's own wins",
    );
    let { build: b, state: st } = applyRulesetBuilder(safe, blank, { describing: false }, catalogs);
    assert.equal(st.made, "builder", "a blank sheet is the builder's");
    assert.equal(st.method, "pointBuy", "and keeps the method it starts on");
    assert.deepEqual(
      ["str", "dex", "con", "int", "wis", "cha"].map((id) => b.abilities[id]),
      [8, 8, 8, 8, 8, 8],
      "the scores read as point buy from the start",
    );
    assert.equal(rulesetBuilderRemaining(safe, b, st, catalogs).scores, 1);
    // A subrace of tier 3 is offered from level 3.
    const subStep = safe.sheet.builder!.steps[1]!;
    assert.ok(subStep.kind === "catalog");
    const offered = (level: number) =>
      rulesetBuilderOptions(safe, subStep, { picks: { race: ["dwarf"] } }, catalogs, {
        ...b,
        fields: { ...b.fields, level },
      }).map((entry) => entry.id);
    assert.deepEqual(offered(1), []);
    assert.deepEqual(offered(3), ["hill-dwarf"]);
    assert.deepEqual(
      rulesetBuilderOptions(safe, subStep, { picks: { race: ["dwarf"] } }, catalogs).map((entry) => entry.id),
      ["hill-dwarf"],
      "no limit without a sheet to read",
    );
    // A pick made at level 3 counts for nothing at level 1, and is kept.
    ({ build: b, state: st } = applyRulesetBuilder(
      safe,
      { ...b, fields: { ...b.fields, level: 3 } },
      { ...st, picks: { race: ["dwarf"], subrace: ["hill-dwarf"] } },
      catalogs,
    ));
    assert.equal(b.abilities.wis, 9);
    ({ build: b, state: st } = applyRulesetBuilder(safe, { ...b, fields: { ...b.fields, level: 1 } }, st, catalogs));
    assert.equal(b.abilities.wis, 8);
    assert.deepEqual(st.picks?.subrace, ["hill-dwarf"]);
    // A described character never takes the default, so ending describing keeps its scores.
    const typedIn: RulesetSheetBuild = {
      ...blank,
      abilities: { str: 16, dex: 14, con: 15, int: 10, wis: 12, cha: 8 },
      fields: { ...blank.fields, race: "Dwarf" },
    };
    let d = applyRulesetBuilder(safe, typedIn, { describing: true, picks: { race: ["dwarf"] } }, catalogs);
    d = applyRulesetBuilder(safe, d.build, { ...d.state, describing: false }, catalogs);
    assert.deepEqual(d.build.abilities, typedIn.abilities, "Done keeps a described character's scores");
    d = applyRulesetBuilder(safe, d.build, { ...d.state, picks: { race: [] } }, catalogs);
    assert.equal(d.build.abilities.con, 13, "and a later change still takes back what was described");
    // A pick that changes what upTo reads settles in one change.
    const vet = parsed(
      variant((doc) => {
        doc.catalogs
          .find((c: { id: string }) => c.id === "races")
          .filters.push({ id: "tier", label: "Tier", type: "number" });
        doc.catalogs
          .find((c: { id: string }) => c.id === "races")
          .entries.find((e: { id: string }) => e.id === "hill-dwarf").filters.tier = 3;
        doc.catalogs
          .find((c: { id: string }) => c.id === "classes")
          .entries.push({
            id: "vet",
            label: "Veteran",
            grants: { sets: { level: 3 } },
          });
        doc.sheet.builder.steps[1].upTo = { filter: "tier", value: { field: "level" } };
      }),
    );
    const vetCatalogs: RulesetCatalogEntriesById = Object.fromEntries(
      (vet.catalogs ?? []).map((catalog) => [catalog.id, catalog.entries ?? []]),
    );
    let v = applyRulesetBuilder(
      vet,
      defaultRulesetSheetBuild(vet),
      { picks: { race: ["dwarf"], class: ["vet"] } },
      vetCatalogs,
    );
    assert.equal(v.build.fields.level, 3);
    v = applyRulesetBuilder(
      vet,
      v.build,
      { ...v.state, picks: { ...v.state.picks, subrace: ["hill-dwarf"] } },
      vetCatalogs,
    );
    assert.equal(v.build.abilities.wis, 11);
    v = applyRulesetBuilder(vet, v.build, { ...v.state, picks: { ...v.state.picks, class: [] } }, vetCatalogs);
    assert.equal(v.build.fields.level, undefined, "the level the class set goes with it");
    assert.equal(v.build.abilities.wis, 10, "the subrace above the new level gives nothing back at once");
    assert.equal(v.state.applied?.increases.wis, undefined);
    // Describing keeps a value the player changed in the builder's own step.
    const plain = defaultRulesetSheetBuild(definition);
    const e = applyRulesetBuilder(
      definition,
      { ...plain, fields: { ...plain.fields, hit_die: "d12" } },
      {
        describing: true,
        picks: { class: ["wizard"] },
        applied: { increases: {}, scores: {}, skills: {}, saves: {}, fields: { hit_die: "d12" }, rows: [] },
      },
      catalogs,
    );
    assert.equal(e.state.applied?.fields.hit_die, "d12");
    // Entries without the filter always pass.
    const raceStep = safe.sheet.builder!.steps[0]!;
    assert.ok(raceStep.kind === "catalog");
    assert.deepEqual(
      rulesetBuilderOptions(safe, { ...raceStep, upTo: { filter: "tier", value: { const: 0 } } }, {}, catalogs, b).map(
        (entry) => entry.id,
      ),
      ["dwarf", "half-elf"],
    );
  }
  refused((doc) => (doc.sheet.builder.steps[4].default = "nope"), /Invalid option: expected one of/);
  refused((doc) => {
    delete doc.sheet.builder.steps[4].methods.manual;
    doc.sheet.builder.steps[4].default = "manual";
  }, /"manual" is not one of this step's methods/);
  refused(
    (doc) => (doc.sheet.builder.steps[1].upTo = { filter: "parent", value: { const: 1 } }),
    /No number filter "parent"/,
  );
  refused(
    (doc) => (doc.sheet.builder.steps[1].upTo = { filter: "nope", value: { const: 1 } }),
    /No number filter "nope"/,
  );
  refused((doc) => {
    doc.catalogs
      .find((c: { id: string }) => c.id === "races")
      .filters.push({ id: "tier", label: "Tier", type: "number" });
    doc.sheet.builder.steps[1].upTo = { filter: "tier", value: { derived: "nope" } };
  }, /nope/);

  // ── 1.90: a step's count read off the sheet ──
  {
    const counted = parsed(
      variant((doc) => {
        Object.assign(doc.sheet.builder.steps[0], { min: 0, max: 3, countFrom: { field: "level" } });
      }),
    );
    const countCatalogs: RulesetCatalogEntriesById = Object.fromEntries(
      (counted.catalogs ?? []).map((catalog) => [catalog.id, catalog.entries ?? []]),
    );
    const raceStep = counted.sheet.builder!.steps[0]!;
    assert.ok(raceStep.kind === "catalog");
    const at = (level: number, build = defaultRulesetSheetBuild(counted)) => ({
      ...build,
      fields: { ...build.fields, level },
    });
    assert.deepEqual(rulesetBuilderStepCount(counted, raceStep, at(2)), { min: 2, max: 2 });
    assert.deepEqual(rulesetBuilderStepCount(counted, raceStep, at(9)), { min: 3, max: 3 }, "never above max");
    assert.deepEqual(rulesetBuilderStepCount(counted, raceStep, at(-4)), { min: 0, max: 0 });
    assert.deepEqual(rulesetBuilderStepCount(counted, raceStep), { min: 0, max: 3 }, "no sheet, its own min and max");
    const picks = { race: ["dwarf", "half-elf"] };
    let c = applyRulesetBuilder(counted, at(0), { method: "manual", picks }, countCatalogs);
    assert.equal(rulesetBuilderRemaining(counted, c.build, c.state, countCatalogs).race, 0);
    assert.equal(c.build.abilities.con, 10, "a count of 0 takes nothing");
    c = applyRulesetBuilder(counted, at(2, c.build), c.state, countCatalogs);
    assert.deepEqual([c.build.abilities.con, c.build.abilities.cha], [12, 12], "both count at 2");
    c = applyRulesetBuilder(counted, at(1, c.build), c.state, countCatalogs);
    assert.deepEqual(
      [c.build.abilities.con, c.build.abilities.cha],
      [12, 10],
      "the later pick counts for nothing at 1",
    );
    assert.deepEqual(c.state.picks?.race, ["dwarf", "half-elf"], "and is kept");
    c = applyRulesetBuilder(counted, at(3, c.build), { ...c.state, picks: { race: ["dwarf"] } }, countCatalogs);
    assert.equal(rulesetBuilderRemaining(counted, c.build, c.state, countCatalogs).race, 2, "the count is waited on");
  }
  refused((doc) => (doc.sheet.builder.steps[0].countFrom = { derived: "nope" }), /nope/);

  // ── 1.91: entries of another catalog to choose ──
  const tongues = (doc: Record<string, any>) => {
    doc.catalogs.push({
      id: "tongues",
      label: "Languages",
      feeds: ["features"],
      filters: [{ id: "type", label: "Type", type: "text" }],
      entries: [
        {
          id: "common",
          label: "Common",
          filters: { type: "standard" },
          rows: [{ list: "features", values: { name: "Common" } }],
        },
        {
          id: "elvish",
          label: "Elvish",
          filters: { type: "standard" },
          rows: [{ list: "features", values: { name: "Elvish" } }],
        },
        {
          id: "abyssal",
          label: "Abyssal",
          filters: { type: "exotic" },
          rows: [{ list: "features", values: { name: "Abyssal" } }],
        },
      ],
    });
    doc.sheet.builder.steps.push({ id: "languages", label: "Languages", kind: "choices", catalog: "tongues" });
    const raceEntries = doc.catalogs.find((c: { id: string }) => c.id === "races").entries;
    raceEntries.find((e: { id: string }) => e.id === "dwarf").grants.entries = {
      choose: [{ catalog: "tongues", count: 1, filters: { type: "standard" } }],
    };
    doc.catalogs
      .find((c: { id: string }) => c.id === "classes")
      .entries.find((e: { id: string }) => e.id === "fighter").grants.entries = {
      choose: [{ catalog: "tongues", count: 2, ids: ["elvish", "abyssal"] }],
    };
  };
  {
    const chosen = parsed(variant(tongues));
    const tongueCatalogs: RulesetCatalogEntriesById = Object.fromEntries(
      (chosen.catalogs ?? []).map((catalog) => [catalog.id, catalog.entries ?? []]),
    );
    assert.deepEqual(
      rulesetBuilderCatalogIds(chosen),
      ["races", "classes", "tongues"],
      "a choices step loads its catalog",
    );
    const names = (build: RulesetSheetBuild) => (build.lists.features ?? []).map((row) => row.name);
    let c = applyRulesetBuilder(
      chosen,
      defaultRulesetSheetBuild(chosen),
      { picks: { race: ["dwarf"] } },
      tongueCatalogs,
    );
    const [dwarfSlot] = rulesetBuilderEntrySlots(chosen, c.state, tongueCatalogs, c.build);
    assert.deepEqual(
      { stepId: dwarfSlot!.stepId, from: dwarfSlot!.from, count: dwarfSlot!.count },
      { stepId: "languages", from: ["common", "elvish"], count: 1 },
      "a standard language, chosen at the Languages step",
    );
    assert.equal(rulesetBuilderRemaining(chosen, c.build, c.state, tongueCatalogs).languages, 1);
    const dwarfKey = dwarfSlot!.key;
    c = applyRulesetBuilder(chosen, c.build, { ...c.state, entryChoices: { [dwarfKey]: ["abyssal"] } }, tongueCatalogs);
    assert.ok(!names(c.build).includes("Abyssal"), "an exotic language is not the dwarf's to choose");
    c = applyRulesetBuilder(chosen, c.build, { ...c.state, entryChoices: { [dwarfKey]: ["elvish"] } }, tongueCatalogs);
    assert.ok(names(c.build).includes("Elvish"));
    assert.equal(rulesetBuilderRemaining(chosen, c.build, c.state, tongueCatalogs).languages, 0);
    // A second grant offers only its ids, and not what the first already holds.
    c = applyRulesetBuilder(
      chosen,
      c.build,
      { ...c.state, picks: { ...c.state.picks, class: ["fighter"] } },
      tongueCatalogs,
    );
    const fighterSlot = rulesetBuilderEntrySlots(chosen, c.state, tongueCatalogs, c.build).find(
      (slot) => slot.entry?.id === "fighter",
    )!;
    assert.deepEqual(fighterSlot.from, ["abyssal"], "its ids, less Elvish, which the dwarf holds");
    c = applyRulesetBuilder(
      chosen,
      c.build,
      { ...c.state, entryChoices: { ...c.state.entryChoices, [fighterSlot.key]: ["elvish", "abyssal"] } },
      tongueCatalogs,
    );
    assert.deepEqual(
      rulesetBuilderEntrySlots(chosen, c.state, tongueCatalogs, c.build).find((slot) => slot.key === fighterSlot.key)!
        .chosen,
      ["abyssal"],
      "Elvish is the dwarf's",
    );
    assert.deepEqual(
      names(c.build)
        .filter((name) => ["Elvish", "Abyssal"].includes(name ?? ""))
        .sort(),
      ["Abyssal", "Elvish"],
    );
    assert.equal(
      rulesetBuilderRemaining(chosen, c.build, c.state, tongueCatalogs).languages,
      0,
      "the fighter waits on nothing it cannot choose",
    );
    // Unpicking the race frees Elvish for the fighter's own choice; unpicking both takes them back.
    c = applyRulesetBuilder(chosen, c.build, { ...c.state, picks: { ...c.state.picks, race: [] } }, tongueCatalogs);
    assert.deepEqual(
      names(c.build)
        .filter((name) => ["Elvish", "Abyssal"].includes(name ?? ""))
        .sort(),
      ["Abyssal", "Elvish"],
    );
    assert.equal(rulesetBuilderRemaining(chosen, c.build, c.state, tongueCatalogs).languages, 0);
    c = applyRulesetBuilder(chosen, c.build, { ...c.state, picks: { ...c.state.picks, class: [] } }, tongueCatalogs);
    assert.deepEqual(
      names(c.build).filter((name) => ["Elvish", "Abyssal"].includes(name ?? "")),
      [],
    );
    // An entry that writes no rows is never offered: choosing it would change nothing.
    const rowless = parsed(
      variant((doc) => {
        tongues(doc);
        doc.catalogs
          .find((each: { id: string }) => each.id === "tongues")
          .entries.push({ id: "silence", label: "Silence", grants: { sets: { hit_die: "d6" } } });
        doc.catalogs
          .find((each: { id: string }) => each.id === "races")
          .entries.find((e: { id: string }) => e.id === "dwarf").grants.entries.choose[0] = {
          catalog: "tongues",
          count: 1,
        };
      }),
    );
    const rowlessCatalogs: RulesetCatalogEntriesById = Object.fromEntries(
      (rowless.catalogs ?? []).map((catalog) => [catalog.id, catalog.entries ?? []]),
    );
    const quiet = applyRulesetBuilder(
      rowless,
      defaultRulesetSheetBuild(rowless),
      { picks: { race: ["dwarf"] } },
      rowlessCatalogs,
    );
    assert.ok(
      !rulesetBuilderEntrySlots(rowless, quiet.state, rowlessCatalogs, quiet.build)[0]!.from.includes("silence"),
    );
  }
  refused((doc) => {
    tongues(doc);
    doc.sheet.builder.steps.pop();
  }, /No builder "choices" step for catalog "tongues"/);
  refused(
    (doc) => doc.sheet.builder.steps.push({ id: "spoken", label: "Spoken", kind: "choices", catalog: "nope" }),
    /No catalog of rows "nope"/,
  );
  refused((doc) => {
    tongues(doc);
    doc.catalogs
      .find((c: { id: string }) => c.id === "races")
      .entries.find((e: { id: string }) => e.id === "dwarf").grants.entries.choose[0].filters = { nope: "x" };
  }, /Unknown filter "nope" of catalog "tongues"/);

  // ── 1.93: a score choice that repeats (an ability score improvement) ──
  {
    const improved = parsed(
      variant((doc) => {
        doc.catalogs
          .find((c: { id: string }) => c.id === "classes")
          .entries.find((e: { id: string }) => e.id === "fighter").grants.abilities = {
          choose: [{ count: 2, amount: 1, repeat: true }],
        };
      }),
    );
    const asiCatalogs: RulesetCatalogEntriesById = Object.fromEntries(
      (improved.catalogs ?? []).map((catalog) => [catalog.id, catalog.entries ?? []]),
    );
    const start = { method: "manual" as const, base: { str: 15, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } };
    let a = applyRulesetBuilder(
      improved,
      defaultRulesetSheetBuild(improved),
      { ...start, picks: { class: ["fighter"] } },
      asiCatalogs,
    );
    const [slot] = rulesetBuilderAbilitySlots(improved, a.state, asiCatalogs, a.build);
    assert.equal(slot!.repeat, true);
    assert.equal(rulesetBuilderRemaining(improved, a.build, a.state, asiCatalogs).scores, 2);
    a = applyRulesetBuilder(
      improved,
      a.build,
      { ...a.state, abilityChoices: { [slot!.key]: ["str", "str"] } },
      asiCatalogs,
    );
    assert.equal(a.build.abilities.str, 17, "+2 to one score");
    assert.equal(rulesetBuilderRemaining(improved, a.build, a.state, asiCatalogs).scores, 0);
    a = applyRulesetBuilder(
      improved,
      a.build,
      { ...a.state, abilityChoices: { [slot!.key]: ["str", "dex"] } },
      asiCatalogs,
    );
    assert.deepEqual([a.build.abilities.str, a.build.abilities.dex], [16, 11], "or +1 to two");
    a = applyRulesetBuilder(
      improved,
      a.build,
      { ...a.state, abilityChoices: { [slot!.key]: ["str", "str", "str"] } },
      asiCatalogs,
    );
    assert.equal(a.build.abilities.str, 17, "never more than the count");
    // Without repeat, a score named twice counts once, as always.
    const once = parsed(
      variant((doc) => {
        doc.catalogs
          .find((c: { id: string }) => c.id === "classes")
          .entries.find((e: { id: string }) => e.id === "fighter").grants.abilities = {
          choose: [{ count: 2, amount: 1 }],
        };
      }),
    );
    const onceCatalogs: RulesetCatalogEntriesById = Object.fromEntries(
      (once.catalogs ?? []).map((catalog) => [catalog.id, catalog.entries ?? []]),
    );
    let o = applyRulesetBuilder(
      once,
      defaultRulesetSheetBuild(once),
      { ...start, picks: { class: ["fighter"] } },
      onceCatalogs,
    );
    const [onceSlot] = rulesetBuilderAbilitySlots(once, o.state, onceCatalogs, o.build);
    o = applyRulesetBuilder(
      once,
      o.build,
      { ...o.state, abilityChoices: { [onceSlot!.key]: ["str", "str"] } },
      onceCatalogs,
    );
    assert.equal(o.build.abilities.str, 16);
    // A repeating choice may ask for more than the open scores: one is enough, and the badge waits on
    // every pick of it.
    const narrow = parsed(
      variant((doc) => {
        doc.catalogs
          .find((c: { id: string }) => c.id === "classes")
          .entries.find((e: { id: string }) => e.id === "fighter").grants.abilities = {
          choose: [{ count: 4, amount: 1, repeat: true, except: ["dex", "con", "int", "wis", "cha"] }],
        };
      }),
    );
    const narrowCatalogs: RulesetCatalogEntriesById = Object.fromEntries(
      (narrow.catalogs ?? []).map((catalog) => [catalog.id, catalog.entries ?? []]),
    );
    const n = applyRulesetBuilder(
      narrow,
      defaultRulesetSheetBuild(narrow),
      { ...start, picks: { class: ["fighter"] } },
      narrowCatalogs,
    );
    assert.equal(rulesetBuilderRemaining(narrow, n.build, n.state, narrowCatalogs).scores, 4);
  }

  // ── 1.96: a score choice with a cap ──
  {
    const capped = (doc: Record<string, any>) => {
      doc.catalogs
        .find((c: { id: string }) => c.id === "classes")
        .entries.find((e: { id: string }) => e.id === "fighter").grants.abilities = {
        choose: [{ count: 2, amount: 1, repeat: true, upTo: 16 }],
      };
    };
    const cap = parsed(variant(capped));
    const capCatalogs: RulesetCatalogEntriesById = Object.fromEntries(
      (cap.catalogs ?? []).map((catalog) => [catalog.id, catalog.entries ?? []]),
    );
    const base = { str: 15, dex: 10, con: 15, int: 10, wis: 10, cha: 10 };
    const pick = (choices: string[], races: string[] = []) => {
      const first = applyRulesetBuilder(
        cap,
        defaultRulesetSheetBuild(cap),
        { method: "manual", base, picks: { class: ["fighter"], race: races } },
        capCatalogs,
      );
      const [slot] = rulesetBuilderAbilitySlots(cap, first.state, capCatalogs, first.build);
      assert.equal(slot!.upTo, 16);
      return applyRulesetBuilder(
        cap,
        first.build,
        { ...first.state, abilityChoices: { [slot!.key]: choices } },
        capCatalogs,
      );
    };
    assert.equal(pick(["str", "str"]).build.abilities.str, 16, "15 + 2 stops at 16");
    assert.equal(pick(["dex", "dex"]).build.abilities.dex, 12, "10 + 2 is under the cap");
    assert.equal(pick(["con", "con"], ["dwarf"]).build.abilities.con, 17, "the dwarf's +2 counts first: 17 is past 16");
    // Taking it back takes back only what it gave.
    const given = pick(["str", "str"]);
    const back = applyRulesetBuilder(cap, given.build, { ...given.state, picks: { class: [] } }, capCatalogs);
    assert.equal(back.build.abilities.str, 15);
    // A described character with Strength 16 already: the choice is read as having given all it could
    // (2, from 14), as an uncapped choice is, so 2 go when it is unpicked.
    const plain = defaultRulesetSheetBuild(cap);
    const described = { ...plain, abilities: { ...plain.abilities, str: 16 } };
    let d = applyRulesetBuilder(cap, described, { describing: true, picks: { class: ["fighter"] } }, capCatalogs);
    const [dSlot] = rulesetBuilderAbilitySlots(cap, d.state, capCatalogs, d.build);
    d = applyRulesetBuilder(
      cap,
      d.build,
      { ...d.state, abilityChoices: { [dSlot!.key]: ["str", "str"] } },
      capCatalogs,
    );
    assert.equal(d.build.abilities.str, 16, "describing changes nothing");
    d = applyRulesetBuilder(cap, d.build, { ...d.state, describing: false }, capCatalogs);
    d = applyRulesetBuilder(cap, d.build, { ...d.state, picks: { class: [] } }, capCatalogs);
    assert.equal(d.build.abilities.str, 14);
    // Described at 17, past the cap of 16: the choice cannot have given anything, so nothing goes.
    const high = { ...plain, abilities: { ...plain.abilities, str: 17 } };
    let h = applyRulesetBuilder(cap, high, { describing: true, picks: { class: ["fighter"] } }, capCatalogs);
    const [hSlot] = rulesetBuilderAbilitySlots(cap, h.state, capCatalogs, h.build);
    h = applyRulesetBuilder(
      cap,
      h.build,
      { ...h.state, abilityChoices: { [hSlot!.key]: ["str", "str"] } },
      capCatalogs,
    );
    h = applyRulesetBuilder(cap, h.build, { ...h.state, describing: false }, capCatalogs);
    h = applyRulesetBuilder(cap, h.build, { ...h.state, picks: { class: [] } }, capCatalogs);
    assert.equal(h.build.abilities.str, 17);
  }
  refused((doc) => {
    doc.catalogs
      .find((c: { id: string }) => c.id === "classes")
      .entries.find((e: { id: string }) => e.id === "fighter").grants.abilities = {
      choose: [{ count: 2, amount: 1, upTo: 0 }],
    };
  }, /upTo|greater than or equal to 1/);

  // ── 1.99: entries a step offers only while the sheet allows ──
  {
    const gated = parsed(
      variant((doc) => {
        doc.catalogs
          .find((c: { id: string }) => c.id === "classes")
          .entries.find((e: { id: string }) => e.id === "wizard").offeredWhen = {
          abilityMod: "int",
        };
      }),
    );
    const gatedCatalogs: RulesetCatalogEntriesById = Object.fromEntries(
      (gated.catalogs ?? []).map((catalog) => [catalog.id, catalog.entries ?? []]),
    );
    const classStep = gated.sheet.builder!.steps[2]!;
    assert.ok(classStep.kind === "catalog");
    const at = (int: number) => {
      const plain = defaultRulesetSheetBuild(gated);
      return { ...plain, abilities: { ...plain.abilities, int } };
    };
    const offered = (int: number) =>
      rulesetBuilderOptions(gated, classStep, {}, gatedCatalogs, at(int)).map((entry) => entry.id);
    assert.deepEqual(offered(10), ["fighter"], "Int 10: modifier 0, no wizard");
    assert.deepEqual(offered(12), ["fighter", "wizard"], "Int 12: modifier 1");
    assert.deepEqual(
      rulesetBuilderOptions(gated, classStep, {}, gatedCatalogs).map((entry) => entry.id),
      ["fighter", "wizard"],
      "no sheet, no gate",
    );
    // Picked while allowed, then the sheet falls: it counts for nothing and is kept.
    let g = applyRulesetBuilder(
      gated,
      at(12),
      {
        method: "manual",
        base: { str: 10, dex: 10, con: 10, int: 12, wis: 10, cha: 10 },
        picks: { class: ["wizard"] },
      },
      gatedCatalogs,
    );
    assert.equal(g.build.fields.hit_die, "d6");
    g = applyRulesetBuilder(gated, g.build, { ...g.state, base: { ...g.state.base!, int: 10 } }, gatedCatalogs);
    assert.notEqual(g.build.fields.hit_die, "d6", "the wizard's grants go");
    assert.deepEqual(g.state.picks?.class, ["wizard"], "and the pick is kept");
  }
  refused((doc) => {
    doc.catalogs.find((c: { id: string }) => c.id === "classes").entries[0].offeredWhen = { derived: "nope" };
  }, /nope/);
  // An entry whose own pick changes what decides it would offer itself, take itself back and offer
  // itself again: refused, whether directly or through a derived value or a field its pick sets.
  refused((doc) => {
    const wizard = doc.catalogs
      .find((c: { id: string }) => c.id === "classes")
      .entries.find((e: { id: string }) => e.id === "wizard");
    wizard.offeredWhen = { abilityMod: "int" };
    wizard.grants.abilities = { add: { int: -2 } };
  }, /offeredWhen reads "int", which picking this entry changes/);
  refused((doc) => {
    const wizard = doc.catalogs
      .find((c: { id: string }) => c.id === "classes")
      .entries.find((e: { id: string }) => e.id === "wizard");
    wizard.offeredWhen = { field: "level" };
  }, /offeredWhen reads "level", which picking this entry changes/);
  refused((doc) => {
    const wizard = doc.catalogs
      .find((c: { id: string }) => c.id === "classes")
      .entries.find((e: { id: string }) => e.id === "wizard");
    wizard.offeredWhen = { derived: "proficiency_bonus" };
  }, /offeredWhen reads "level", which picking this entry changes/);
  // A skill modifier reads the proficiency bonus, so it reads the level the pick sets.
  refused((doc) => {
    const wizard = doc.catalogs
      .find((c: { id: string }) => c.id === "classes")
      .entries.find((e: { id: string }) => e.id === "wizard");
    wizard.offeredWhen = { skillMod: "arcana" };
  }, /offeredWhen reads "level", which picking this entry changes/);

  // ── 1.94: entries a step keeps one of ──
  const grouped = (doc: Record<string, any>) => {
    Object.assign(doc.sheet.builder.steps[0], { min: 0, max: 3 });
    const raceEntries = doc.catalogs.find((c: { id: string }) => c.id === "races").entries;
    raceEntries.find((e: { id: string }) => e.id === "dwarf").exclusive = "folk";
    raceEntries.find((e: { id: string }) => e.id === "half-elf").exclusive = "folk";
  };
  {
    const one = parsed(variant(grouped));
    const oneCatalogs: RulesetCatalogEntriesById = Object.fromEntries(
      (one.catalogs ?? []).map((catalog) => [catalog.id, catalog.entries ?? []]),
    );
    const raceStep = one.sheet.builder!.steps[0]!;
    assert.ok(raceStep.kind === "catalog");
    assert.deepEqual(
      rulesetBuilderPickAdded(raceStep, ["dwarf", "hill-dwarf"], "half-elf", oneCatalogs),
      ["hill-dwarf", "half-elf"],
      "a pick of the group replaces the other",
    );
    assert.deepEqual(rulesetBuilderPickAdded(raceStep, ["dwarf"], "hill-dwarf", oneCatalogs), ["dwarf", "hill-dwarf"]);
    // Stored with both, only the latest of the group counts.
    const both = applyRulesetBuilder(
      one,
      defaultRulesetSheetBuild(one),
      { method: "manual", picks: { race: ["dwarf", "half-elf"] } },
      oneCatalogs,
    );
    assert.deepEqual(
      rulesetBuilderPicks(one, "race", both.state, oneCatalogs, both.build).map((entry) => entry.id),
      ["half-elf"],
    );
    assert.equal(both.build.abilities.con, 10, "the dwarf's increase is not given");
    assert.equal(both.build.abilities.cha, 12);
  }
  refused((doc) => {
    grouped(doc);
    doc.catalogs.find((c: { id: string }) => c.id === "races").entries[0].exclusive = "Bad Group";
  }, /exclusive/);

  // ── 1.100: an exclusive entry is judged without its group's picks ──
  {
    // The dwarf is offered only with Charisma 12 or more; the half-elf, in the same group, gives Charisma
    // +2. Picking the dwarf drops the half-elf, so the half-elf's +2 must not be what offers it.
    const judged = parsed(
      variant((doc) => {
        grouped(doc);
        doc.catalogs
          .find((c: { id: string }) => c.id === "races")
          .entries.find((e: { id: string }) => e.id === "dwarf").offeredWhen = { abilityMod: "cha" };
      }),
    );
    const judgedCatalogs: RulesetCatalogEntriesById = Object.fromEntries(
      (judged.catalogs ?? []).map((catalog) => [catalog.id, catalog.entries ?? []]),
    );
    const raceStep = judged.sheet.builder!.steps[0]!;
    assert.ok(raceStep.kind === "catalog");
    const made = (cha: number, race: string[]) =>
      applyRulesetBuilder(
        judged,
        defaultRulesetSheetBuild(judged),
        { method: "manual", base: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha }, picks: { race } },
        judgedCatalogs,
      );
    const offered = (m: ReturnType<typeof made>) =>
      rulesetBuilderOptions(judged, raceStep, m.state, judgedCatalogs, m.build).map((entry) => entry.id);
    const halfElf = made(10, ["half-elf"]);
    assert.equal(halfElf.build.abilities.cha, 12, "the half-elf's +2");
    assert.ok(!offered(halfElf).includes("dwarf"), "Charisma 12 only from the half-elf it would drop: no dwarf");
    const fromHalfElf = made(10, ["half-elf", "dwarf"]);
    assert.deepEqual(
      rulesetBuilderPicks(judged, "race", fromHalfElf.state, judgedCatalogs, fromHalfElf.build).map((e) => e.id),
      ["half-elf"],
      "stored after the half-elf, the dwarf counts for nothing and the half-elf keeps its place",
    );
    const born = made(12, ["half-elf"]);
    assert.ok(offered(born).includes("dwarf"), "Charisma 12 of its own: the dwarf is offered");
    const swapped = made(12, ["half-elf", "dwarf"]);
    assert.deepEqual(
      rulesetBuilderPicks(judged, "race", swapped.state, judgedCatalogs, swapped.build).map((e) => e.id),
      ["dwarf"],
    );
    assert.equal(swapped.build.abilities.con, 12, "and the dwarf's +2 Constitution is given");
    assert.equal(swapped.build.abilities.cha, 12, "the half-elf's +2 taken back");
    // An entry outside the group still reads the sheet as it stands.
    const hill = parsed(
      variant((doc) => {
        grouped(doc);
        doc.catalogs
          .find((c: { id: string }) => c.id === "races")
          .entries.find((e: { id: string }) => e.id === "hill-dwarf").offeredWhen = { abilityMod: "cha" };
      }),
    );
    const hillCatalogs: RulesetCatalogEntriesById = Object.fromEntries(
      (hill.catalogs ?? []).map((catalog) => [catalog.id, catalog.entries ?? []]),
    );
    const hillMade = applyRulesetBuilder(
      hill,
      defaultRulesetSheetBuild(hill),
      {
        method: "manual",
        base: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
        picks: { race: ["half-elf"] },
      },
      hillCatalogs,
    );
    assert.ok(
      rulesetBuilderOptions(hill, hill.sheet.builder!.steps[0] as never, hillMade.state, hillCatalogs, hillMade.build)
        .map((entry) => entry.id)
        .includes("hill-dwarf"),
      "an entry of no group reads the half-elf's Charisma 12",
    );
  }

  // ── 1.104: a skill choice never offers what the picks already train ──
  {
    // The dwarf trains Perception outright; the hill dwarf offers one skill at expertise.
    const taught = parsed(
      variant((doc) => {
        const raceEntries = doc.catalogs.find((c: { id: string }) => c.id === "races").entries;
        raceEntries.find((e: { id: string }) => e.id === "dwarf").grants.trained = { skills: ["perception"] };
        raceEntries.find((e: { id: string }) => e.id === "hill-dwarf").grants.trained = {
          tier: "expertise",
          choose: [{ what: "skills", count: 1, from: ["perception", "athletics"] }],
        };
      }),
    );
    const taughtCatalogs: RulesetCatalogEntriesById = Object.fromEntries(
      (taught.catalogs ?? []).map((catalog) => [catalog.id, catalog.entries ?? []]),
    );
    const base = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
    const made = (st: RulesetBuilderState) =>
      applyRulesetBuilder(taught, defaultRulesetSheetBuild(taught), { method: "manual", base, ...st }, taughtCatalogs);
    const slotOf = (m: ReturnType<typeof made>, entry: string) =>
      rulesetBuilderTrainedSlots(taught, m.state, taughtCatalogs, m.build).find((slot) => slot.entry?.id === entry)!;
    const dwarfFighter = made({ picks: { race: ["dwarf"], class: ["fighter"] } });
    const fighterKey = slotOf(dwarfFighter, "fighter").key;
    assert.deepEqual(
      slotOf(dwarfFighter, "fighter").from,
      ["acrobatics", "athletics", "survival"],
      "the dwarf's Perception is not the fighter's to offer",
    );
    const twice = made({
      picks: { race: ["dwarf"], class: ["fighter"] },
      trainedChoices: { [fighterKey]: ["perception", "athletics"] },
    });
    assert.deepEqual(slotOf(twice, "fighter").chosen, ["athletics"], "a stored Perception counts for nothing");
    assert.equal(
      rulesetBuilderRemaining(taught, twice.build, twice.state, taughtCatalogs).skills,
      1,
      "and the step asks for another",
    );
    assert.equal(twice.build.skills.perception, "proficient", "still the dwarf's");
    // Two choices: the earlier keeps what it holds, the later is not offered it.
    const halfElf = made({ picks: { race: ["half-elf"], class: ["fighter"] } });
    const halfElfKey = slotOf(halfElf, "half-elf").key;
    const both = made({
      picks: { race: ["half-elf"], class: ["fighter"] },
      trainedChoices: { [halfElfKey]: ["athletics", "stealth"], [fighterKey]: ["athletics", "survival"] },
    });
    assert.deepEqual(slotOf(both, "half-elf").chosen, ["athletics", "stealth"]);
    assert.deepEqual(slotOf(both, "fighter").chosen, ["survival"], "the half-elf's Athletics is the half-elf's");
    assert.ok(!slotOf(both, "fighter").from.includes("athletics"));
    assert.ok(!slotOf(both, "half-elf").from.includes("survival"), "and the fighter's Survival is the fighter's");
    // A choice at a higher tier still offers what a lower one trains.
    const hill = made({ picks: { race: ["dwarf"], subrace: ["hill-dwarf"] } });
    const hillSlot = slotOf(hill, "hill-dwarf");
    assert.deepEqual(hillSlot.from, ["athletics", "perception"], "expertise in the dwarf's Perception is offered");
    const expert = made({
      picks: { race: ["dwarf"], subrace: ["hill-dwarf"] },
      trainedChoices: { [hillSlot.key]: ["perception"] },
    });
    assert.equal(expert.build.skills.perception, "expertise");
    // An earlier choice at a higher tier keeps a later, lower one from offering the same skill.
    const both2 = made({
      picks: { race: ["dwarf"], subrace: ["hill-dwarf"], class: ["fighter"] },
      trainedChoices: { [hillSlot.key]: ["athletics"] },
    });
    assert.ok(!slotOf(both2, "fighter").from.includes("athletics"), "expertise in Athletics already");
    assert.equal(both2.build.skills.athletics, "expertise");
  }

  // ── 1.105: a choice that builds on training offers only what is already trained ──
  {
    // The hill dwarf's expertise choice is held to skills already proficient.
    const expertDoc = (held: string | null = "proficient") =>
      variant((doc) => {
        const raceEntries = doc.catalogs.find((c: { id: string }) => c.id === "races").entries;
        raceEntries.find((e: { id: string }) => e.id === "dwarf").grants.trained = { skills: ["perception"] };
        raceEntries.find((e: { id: string }) => e.id === "hill-dwarf").grants.trained = {
          tier: "expertise",
          choose: [{ what: "skills", count: 2, ...(held ? { held } : {}) }],
        };
      });
    const expertise = parsed(expertDoc());
    const expertiseCatalogs: RulesetCatalogEntriesById = Object.fromEntries(
      (expertise.catalogs ?? []).map((catalog) => [catalog.id, catalog.entries ?? []]),
    );
    const base = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
    const made = (st: RulesetBuilderState) =>
      applyRulesetBuilder(
        expertise,
        defaultRulesetSheetBuild(expertise),
        { method: "manual", base, ...st },
        expertiseCatalogs,
      );
    const slotOf = (m: ReturnType<typeof made>, entry: string) =>
      rulesetBuilderTrainedSlots(expertise, m.state, expertiseCatalogs, m.build).find(
        (slot) => slot.entry?.id === entry,
      )!;
    const alone = made({ picks: { race: ["dwarf"], subrace: ["hill-dwarf"] } });
    assert.deepEqual(slotOf(alone, "hill-dwarf").from, ["perception"], "only the dwarf's own Perception");
    assert.equal(slotOf(alone, "hill-dwarf").held, "proficient");
    const picks = { race: ["dwarf"], subrace: ["hill-dwarf"], class: ["fighter"] };
    const fighter = made({ picks });
    const fighterKey = slotOf(fighter, "fighter").key;
    const hillKey = slotOf(fighter, "hill-dwarf").key;
    const trained = made({ picks, trainedChoices: { [fighterKey]: ["athletics", "survival"] } });
    assert.deepEqual(
      slotOf(trained, "hill-dwarf").from,
      ["athletics", "perception", "survival"],
      "and what the fighter's choice trains",
    );
    const doubled = made({
      picks,
      trainedChoices: { [fighterKey]: ["athletics", "survival"], [hillKey]: ["athletics", "stealth"] },
    });
    assert.deepEqual(slotOf(doubled, "hill-dwarf").chosen, ["athletics"], "a stored Stealth counts for nothing");
    assert.equal(doubled.build.skills.athletics, "expertise");
    assert.notEqual(doubled.build.skills.stealth, "expertise");
    assert.deepEqual(slotOf(doubled, "fighter").chosen, ["athletics", "survival"], "the expertise leaves them be");
    assert.ok(slotOf(doubled, "fighter").from.includes("athletics"));
    // Without `held`, any skill, as before.
    const open = parsed(expertDoc(null));
    const openCatalogs: RulesetCatalogEntriesById = Object.fromEntries(
      (open.catalogs ?? []).map((catalog) => [catalog.id, catalog.entries ?? []]),
    );
    const anyState = applyRulesetBuilder(
      open,
      defaultRulesetSheetBuild(open),
      { method: "manual", base, picks: { race: ["dwarf"], subrace: ["hill-dwarf"] } },
      openCatalogs,
    );
    assert.ok(
      rulesetBuilderTrainedSlots(open, anyState.state, openCatalogs, anyState.build).find(
        (slot) => slot.entry?.id === "hill-dwarf",
      )!.from.length > 1,
    );
    // Import: `held` is a tier below the choice's own.
    for (const [held, pattern] of [
      ["expertise", /is not below the tier this choice trains to/],
      ["none", /is not a tier above untrained/],
      ["mastery", /is not a tier above untrained/],
    ] as const) {
      const result = parseRulesetDefinition(expertDoc(held));
      assert.equal(result.ok, false, held);
      if (!result.ok)
        assert.ok(
          result.issues.some((issue) => pattern.test(issue)),
          result.issues.join("; "),
        );
    }
  }

  // ── 1.106: a choice an entry grants holds its options to their offeredWhen ──
  {
    const gated = parsed(
      variant((doc) => {
        tongues(doc);
        const languages = doc.catalogs.find((c: { id: string }) => c.id === "tongues");
        languages.entries.find((e: { id: string }) => e.id === "elvish").offeredWhen = { field: "level" };
      }),
    );
    const gatedCatalogs: RulesetCatalogEntriesById = Object.fromEntries(
      (gated.catalogs ?? []).map((catalog) => [catalog.id, catalog.entries ?? []]),
    );
    const gatedId = "elvish";
    const base = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
    const at = (level: number) => {
      const start = defaultRulesetSheetBuild(gated);
      const sheet = { ...start, fields: { ...start.fields, level } };
      const made = applyRulesetBuilder(
        gated,
        sheet,
        { method: "manual", base, picks: { race: ["dwarf"] } },
        gatedCatalogs,
      );
      return rulesetBuilderEntrySlots(gated, made.state, gatedCatalogs, {
        ...made.build,
        fields: { ...made.build.fields, level },
      });
    };
    assert.ok(
      at(1).some((slot) => slot.from.includes(gatedId)),
      "offered while the sheet allows",
    );
    assert.ok(
      at(0).every((slot) => !slot.from.includes(gatedId)),
      "not while it reads 0",
    );
  }

  // ── 1.107: fields shown by the sheet, and number fields held to a total ──
  const shownFieldsDoc = variant((doc) => {
    doc.sheet.builder.steps[3].shownWhen = { background: { field: "xp" } };
  });
  const totalFieldsDoc = variant((doc) => {
    Object.assign(doc.sheet.builder.steps[3], {
      fields: ["level", "xp", "background"],
      optional: ["background"],
      total: { fields: ["level", "xp"], max: 20 },
    });
  });
  {
    const shown = parsed(shownFieldsDoc);
    const step = shown.sheet.builder!.steps[3]!;
    assert.ok(step.kind === "fields");
    const start = defaultRulesetSheetBuild(shown);
    const hidden = { ...start, fields: { ...start.fields, background: "", xp: 0 } };
    assert.deepEqual(rulesetBuilderShownFields(shown, step, hidden), ["level"]);
    assert.equal(rulesetBuilderRemaining(shown, hidden, {}, {}).level, 0, "hidden fields are not waited on");
    const visible = { ...hidden, fields: { ...hidden.fields, xp: 1 } };
    assert.deepEqual(rulesetBuilderShownFields(shown, step, visible), ["level", "background"]);
    assert.equal(rulesetBuilderRemaining(shown, visible, {}, {}).level, 1, "shown again when the ref reads above 0");
    const filled = { ...hidden, fields: { ...hidden.fields, background: "Sage" } };
    assert.deepEqual(rulesetBuilderShownFields(shown, step, filled), ["level"]);
    assert.equal(filled.fields.background, "Sage", "hiding keeps the value");
    assert.deepEqual(
      rulesetBuilderShownFields(definition, definition.sheet.builder!.steps[3] as typeof step, start),
      ["level", "background"],
      "without shownWhen the existing fields stay shown",
    );

    const totaled = parsed(totalFieldsDoc);
    const blank = defaultRulesetSheetBuild(totaled);
    const at = (xp: number) => ({ ...blank, fields: { ...blank.fields, level: 10, xp } });
    assert.equal(rulesetBuilderRemaining(totaled, at(11), {}, {}).level, 1, "an over-limit total waits on one fix");
    assert.equal(rulesetBuilderRemaining(totaled, at(10), {}, {}).level, 0, "at the maximum is done");
    const hiddenTotalDoc = structuredClone(totalFieldsDoc);
    hiddenTotalDoc.sheet.builder.steps[3].shownWhen = { xp: { const: 0 } };
    const hiddenTotal = parsed(hiddenTotalDoc);
    assert.equal(rulesetBuilderRemaining(hiddenTotal, at(11), {}, {}).level, 1, "hidden values still count in totals");
    refused(
      (doc) => (doc.sheet.builder.steps[3].shownWhen = { xp: { field: "level" } }),
      /"xp" is not one of this step's fields/,
    );
    refused((doc) => (doc.sheet.builder.steps[3].shownWhen = { background: { field: "nope" } }), /nope/);
    refused(
      (doc) => (doc.sheet.builder.steps[3].total = { fields: ["level"], max: 20 }),
      /total\.fields: Too small: expected array to have >=2 items/,
    );
    refused(
      (doc) => (doc.sheet.builder.steps[3].total = { fields: ["level", "background"], max: 20 }),
      /No number field "background"/,
    );
    refused(
      (doc) => (doc.sheet.builder.steps[3].total = { fields: ["level", "xp"], max: 20 }),
      /"xp" is not one of this step's fields/,
    );
    refused(
      (doc) => (doc.sheet.builder.steps[3].total = { fields: ["level", "level"], max: 20 }),
      /"level" is named twice/,
    );
  }

  // ── The gate ──
  const manifest = (minor: number, paths = ["ruleset.json"]) => ({
    schemaVersion: 2,
    capabilityApi: { major: 1, minor },
    builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
    id: "ruleset-builder",
    name: "Builder",
    version: "0.1.0",
    description: "A packaged ruleset with a guided builder.",
    engine: { min: "2.4.6", maxExclusive: "4.0.0" },
    kind: ["ruleset"],
    entrypoints: {},
    contributions: { assets: { paths } },
    files: [{ path: "ruleset.json", sha256: "0".repeat(64), bytes: 10 }],
    permissions: [],
    restartRequired: false,
  });
  const issue = (minor: number, doc: Record<string, any>, files?: Map<string, unknown>, paths?: string[]) =>
    getCapabilityPackageInstallIssue(manifest(minor, paths) as any, doc, files as any);
  for (const doc of [shownFieldsDoc, totalFieldsDoc]) {
    assert.match(issue(106, doc) ?? "", /1\.107/);
    assert.equal(issue(107, doc), null);
  }
  assert.match(issue(109, biggerCatalogDoc) ?? "", /more than 20 entries.*1\.110/);
  assert.equal(issue(110, biggerCatalogDoc), null);
  const maxOnly = variant((doc) => (doc.sheet.builder.steps[0].max = 21));
  assert.match(issue(109, maxOnly) ?? "", /more than 20 entries.*1\.110/);
  assert.equal(issue(110, maxOnly), null);
  // Read the raw min independently too, even when import would refuse min above max.
  const minOnly = variant((doc) => (doc.sheet.builder.steps[0].min = 21));
  assert.match(issue(109, minOnly) ?? "", /more than 20 entries.*1\.110/);
  assert.equal(issue(110, minOnly), null);
  assert.match(issue(109, manualDoc) ?? "", /bounds manual scores.*1\.110/);
  assert.equal(issue(110, manualDoc), null);
  assert.match(issue(110, derivedDoc) ?? "", /more than 240 derived values.*1\.111/);
  assert.equal(issue(111, derivedDoc), null);
  const oldDerivedLimit = structuredClone(derivedDoc);
  oldDerivedLimit.sheet.derived.length = 240;
  assert.equal(issue(110, oldDerivedLimit), null, "240 derived values need no new minor");
  // Up to 800 since 1.729, which 5e's armor training outgrew.
  const mostDerived = structuredClone(derivedDoc);
  mostDerived.sheet.derived.push({ id: "extra_400", label: "Extra", op: "sum", of: [{ const: 1 }] });
  assert.match(issue(728, mostDerived) ?? "", /more than 400 derived values.*1\.729/);
  assert.doesNotMatch(issue(729, mostDerived) ?? "", /derived values/);
  assert.doesNotMatch(issue(728, derivedDoc) ?? "", /1\.729/, "400 derived values need no new minor");
  const steps24 = structuredClone(moreStepsDoc);
  steps24.sheet.builder.steps.length = 24;
  assert.match(issue(111, steps24) ?? "", /more than 16 builder steps.*1\.112/);
  assert.equal(issue(112, steps24), null);
  // Up to 32 steps and 60 entries a catalog step since 1.768.
  assert.match(issue(767, moreStepsDoc) ?? "", /more than 24 builder steps.*1\.768/);
  assert.equal(issue(768, moreStepsDoc), null);
  const spellbook = variant((doc) => Object.assign(doc.sheet.builder.steps[0], { min: 0, max: 44 }));
  assert.match(issue(767, spellbook) ?? "", /more than 40 entries.*1\.768/);
  assert.equal(issue(768, spellbook), null);
  assert.doesNotMatch(issue(767, biggerCatalogDoc) ?? "", /1\.768/, "40 entries need no new minor");
  const oldStepsLimit = structuredClone(moreStepsDoc);
  oldStepsLimit.sheet.builder.steps.length = 16;
  assert.equal(issue(111, oldStepsLimit), null, "16 steps need no new minor");
  assert.equal(
    issue(
      105,
      variant((doc) => Object.assign(doc.sheet.builder.steps[0], { min: 20, max: 20 })),
    ),
    null,
    "20 picks and manual true need no new minor",
  );
  const withBuilder = variant((doc) => {
    // Builder alone: classes with plain rows, races without grants.
    doc.catalogs = doc.catalogs.filter((c: { id: string }) => c.id !== "races" && c.id !== "classes");
    doc.sheet.builder.steps = [doc.sheet.builder.steps[3]];
  });
  assert.match(issue(85, withBuilder) ?? "", /guided builder.*1\.86/);
  assert.equal(issue(86, withBuilder), null);
  const grantsOnly = variant((doc) => {
    delete doc.sheet.builder;
    doc.catalogs = doc.catalogs.filter((c: { id: string }) => c.id !== "classes");
  });
  assert.match(issue(85, grantsOnly) ?? "", /1\.86/);
  assert.equal(issue(86, grantsOnly), null);
  const filed = variant((doc) => {
    delete doc.sheet.builder;
    doc.catalogs = doc.catalogs.filter((c: { id: string }) => c.id !== "classes");
    const raceCatalog = doc.catalogs.find((c: { id: string }) => c.id === "races");
    raceCatalog.asset = "catalogs/races.json";
    delete raceCatalog.entries;
  });
  const files = new Map<string, unknown>([["catalogs/races.json", { entries: races.entries }]]);
  const paths = ["ruleset.json", "catalogs/races.json"];
  assert.match(issue(85, filed, files, paths) ?? "", /1\.86/);
  assert.equal(issue(86, filed, files, paths), null);
  const defaulted = variant((doc) => (doc.sheet.builder.steps[4].default = "pointBuy"));
  assert.match(issue(86, defaulted) ?? "", /starts on a method.*1\.87/);
  assert.equal(issue(87, defaulted), null);
  const limited = variant((doc) => {
    doc.catalogs
      .find((c: { id: string }) => c.id === "races")
      .filters.push({ id: "tier", label: "Tier", type: "number" });
    doc.sheet.builder.steps[1].upTo = { filter: "tier", value: { field: "level" } };
  });
  assert.match(issue(86, limited) ?? "", /1\.87/);
  assert.equal(issue(87, limited), null);
  const countedDoc = variant((doc) =>
    Object.assign(doc.sheet.builder.steps[0], { max: 3, countFrom: { field: "level" } }),
  );
  assert.match(issue(89, countedDoc) ?? "", /count off the sheet.*1\.90/);
  assert.equal(issue(90, countedDoc), null);
  const choosingDoc = variant(tongues);
  assert.match(issue(90, choosingDoc) ?? "", /catalog entries to choose.*1\.91/);
  assert.equal(issue(91, choosingDoc), null);
  const heldDoc = variant((doc) => {
    doc.catalogs
      .find((c: { id: string }) => c.id === "races")
      .entries.find((e: { id: string }) => e.id === "hill-dwarf").grants.trained = {
      tier: "expertise",
      choose: [{ what: "skills", count: 2, held: "proficient" }],
    };
  });
  assert.match(issue(104, heldDoc) ?? "", /build on training already held.*1\.105/);
  assert.equal(issue(105, heldDoc), null);
  const choiceStepOnly = variant((doc) => {
    tongues(doc);
    for (const catalog of doc.catalogs)
      for (const entry of catalog.entries ?? []) if (entry.grants) delete entry.grants.entries;
  });
  assert.match(issue(90, choiceStepOnly) ?? "", /1\.91/, "a choices step alone is 1.91's");
  const twoUses = variant((doc) => {
    const raceCatalog = doc.catalogs.find((c: { id: string }) => c.id === "races");
    raceCatalog.feeds.push("counters");
    raceCatalog.entries
      .find((e: { id: string }) => e.id === "dwarf")
      .rows.push(
        {
          list: "counters",
          values: { name: "Stone Song", max: 0, recharge: "long" },
          scaled: {
            max: {
              from: { field: "level" },
              table: [
                [1, 0],
                [3, 1],
              ],
            },
          },
        },
        {
          list: "counters",
          values: { name: "Deep Song", max: 0, recharge: "long" },
          scaled: {
            max: {
              from: { field: "level" },
              table: [
                [1, 0],
                [5, 1],
              ],
            },
          },
        },
      );
  });
  assert.ok(parseRulesetDefinition(twoUses).ok, "two scaled rows under two names parse");
  assert.match(issue(91, twoUses) ?? "", /scales a row beside others of its list.*1\.92/);
  assert.equal(issue(92, twoUses), null);
  const besideOne = variant((doc) => {
    const raceCatalog = doc.catalogs.find((c: { id: string }) => c.id === "races");
    raceCatalog.feeds.push("counters");
    raceCatalog.entries
      .find((e: { id: string }) => e.id === "dwarf")
      .rows.push(
        {
          list: "counters",
          values: { name: "Stone Song", max: 0, recharge: "long" },
          scaled: {
            max: {
              from: { field: "level" },
              table: [
                [1, 0],
                [3, 1],
              ],
            },
          },
        },
        { list: "counters", values: { name: "Deep Song", max: 1, recharge: "long" } },
      );
  });
  assert.match(issue(91, besideOne) ?? "", /1\.92/, "one scaled row beside an unscaled one is 1.92's too");
  assert.equal(issue(92, besideOne), null);
  const repeating = variant((doc) => {
    doc.catalogs
      .find((c: { id: string }) => c.id === "classes")
      .entries.find((e: { id: string }) => e.id === "fighter").grants.abilities = {
      choose: [{ count: 2, amount: 1, repeat: true }],
    };
  });
  assert.match(issue(92, repeating) ?? "", /score choice that repeats.*1\.93/);
  assert.equal(issue(93, repeating), null);
  const exclusiveDoc = variant(grouped);
  assert.match(issue(93, exclusiveDoc) ?? "", /exclusive of each other.*1\.94/);
  assert.equal(issue(94, exclusiveDoc), null);
  const cappedDoc = variant((doc) => {
    doc.catalogs
      .find((c: { id: string }) => c.id === "classes")
      .entries.find((e: { id: string }) => e.id === "fighter").grants.abilities = {
      choose: [{ count: 2, amount: 1, repeat: true, upTo: 20 }],
    };
  });
  assert.match(issue(95, cappedDoc) ?? "", /score choice with a cap.*1\.96/);
  assert.equal(issue(96, cappedDoc), null);
  const offeredDoc = variant((doc) => {
    doc.catalogs.find((c: { id: string }) => c.id === "classes").entries[0].offeredWhen = { const: 1 };
  });
  assert.match(issue(98, offeredDoc) ?? "", /offered only while the sheet allows.*1\.99/);
  assert.equal(issue(99, offeredDoc), null);
  assert.equal(issue(86, variant()), null, "a 1.86 builder is still 1.86's");
  assert.equal(issue(79, JSON.parse(fiveEText)), null, "an older package still validates");

  console.log("Ruleset builder: steps, grants, methods, take-backs, remaining choices and the 1.86 gate.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
