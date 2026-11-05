/** Capability API 1.151: bounded, reversible guided choices, planted answers and import refusals. */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  applyRulesetBuilder,
  defaultRulesetSheetBuild,
  parseRulesetDefinition,
  readRulesetBuilderState,
  rulesetBuilderAbilitySlots,
  rulesetBuilderTrainedSlots,
  rulesetBuilderEntrySlots,
  rulesetBuilderPicks,
  rulesetBuilderPickReason,
  rulesetBuilderRemaining,
  rulesetBuilderStepVisible,
  rulesetCatalogEntryIssues,
  type RulesetDefinition,
  type RulesetBuilderState,
  type RulesetCatalogEntriesById,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-builder-choices-"));
const previous = { DATA_DIR: process.env.DATA_DIR, MARINARA_DATA_DIR: process.env.MARINARA_DATA_DIR };
process.env.DATA_DIR = dataDir;
process.env.MARINARA_DATA_DIR = dataDir;
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");
const base = () =>
  JSON.parse(readFileSync(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url), "utf8"));
const parse = (doc: unknown) => {
  const result = parseRulesetDefinition(doc);
  assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
  return result.definition;
};
const catalogsOf = (definition: RulesetDefinition): RulesetCatalogEntriesById =>
  Object.fromEntries((definition.catalogs ?? []).map((catalog) => [catalog.id, catalog.entries ?? []]));
const refuse = (doc: unknown, message: RegExp) => {
  const result = parseRulesetDefinition(doc);
  assert.ok(
    !result.ok && result.issues.some((issue) => message.test(issue)),
    result.ok ? "unexpectedly accepted" : result.issues.join("; "),
  );
};
const row = (id: string, filters: Record<string, string | number> = {}) => ({
  id,
  label: id,
  filters,
  rows: [{ list: "features", values: { name: id } }],
});
const fixture = () => {
  const doc = base();
  doc.sheet.fields.push({ id: "choice_count", label: "Choices", type: "number", min: 0, max: 20, default: 2 });
  doc.sheet.derived.push({ id: "trained_count", label: "Training count", op: "sum", of: [{ field: "choice_count" }] });
  doc.catalogs.push({
    id: "origins",
    label: "Origins",
    entries: [
      {
        id: "human",
        label: "Human",
        grants: {
          abilities: {
            choose: [
              { id: "restricted", count: 1, amount: 2, from: ["str", "dex"] },
              {
                id: "free_boost",
                count: 1,
                amount: 2,
                from: ["str", "dex", "con"],
                excludeChoices: ["background/restricted"],
              },
            ],
          },
          trained: {
            skills: ["athletics"],
            choose: [
              {
                id: "background_skill",
                what: "skills",
                count: 1,
                from: ["athletics", "perception"],
                onDuplicate: "replace",
              },
            ],
          },
        },
      },
    ],
  });
  doc.sheet.builder = {
    tier: "proficient",
    steps: [
      { id: "counts", label: "Counts", kind: "fields", fields: ["choice_count"] },
      { id: "background", label: "Background", kind: "catalog", catalog: "origins" },
      {
        id: "career",
        label: "Career",
        kind: "trained",
        choose: [{ id: "skills", what: "skills", count: 1, from: ["acrobatics", "survival"] }],
      },
      {
        id: "human",
        label: "Non-career ranks",
        kind: "trained",
        choose: [
          {
            id: "noncareer",
            what: "skills",
            count: 1,
            max: 3,
            countFrom: { derived: "trained_count" },
            only: "untrained",
            tier: "expertise",
            excludeChoices: ["career/skills"],
          },
        ],
      },
      {
        id: "subrace",
        label: "Subrace",
        kind: "catalog",
        catalog: "origins",
        filters: {},
        requiredWhen: { field: "choice_count" },
        when: { field: "choice_count" },
      },
    ],
  };
  return doc;
};

try {
  // PF2e boosts remain distinct; duplicate training opens a separately saved replacement.
  const doc = fixture();
  const definition = parse(doc);
  const catalogs = catalogsOf(definition);
  const planted: RulesetBuilderState = {
    picks: { background: ["human"] },
    abilityChoices: { "background/human/restricted": ["str"], "background/human/free_boost": ["str"] },
    trainedChoices: {
      "background/human/background_skill": ["athletics"],
      "background/human/background_skill/replacement": ["perception"],
      "career//skills": ["acrobatics"],
      "human//noncareer": ["acrobatics", "survival", "stealth"],
    },
  };
  let result = applyRulesetBuilder(definition, defaultRulesetSheetBuild(definition), planted, catalogs);
  assert.equal(result.build.abilities.str, 12, "an excluded boost grants nothing");
  assert.deepEqual(result.state.abilityChoices, planted.abilityChoices, "invalid answers retained");
  const boosts = rulesetBuilderAbilitySlots(definition, result.state, catalogs, result.build);
  assert.equal(boosts[1]!.disabled!.str, "excluded");
  assert.deepEqual(boosts[1]!.chosen, []);
  assert.equal(result.build.skills.athletics, "proficient");
  assert.equal(result.build.skills.perception, "proficient");
  assert.equal(result.build.skills.acrobatics, "proficient");
  assert.equal(result.build.skills.survival, "expertise");
  assert.equal(result.build.skills.stealth, "expertise");
  const slots = rulesetBuilderTrainedSlots(definition, result.state, catalogs, result.build);
  assert.deepEqual(slots.find((slot) => slot.replacement)?.chosen, ["perception"]);
  assert.equal(slots.find((slot) => slot.key === "human//noncareer")!.disabled!.acrobatics, "trained");
  assert.deepEqual(
    applyRulesetBuilder(definition, result.build, readRulesetBuilderState({ builder: result.state }), catalogs),
    result,
    "reopen does not award again",
  );
  const manual = {
    ...result.build,
    abilities: { ...result.build.abilities, str: 17 },
    skills: { ...result.build.skills, perception: "expertise" },
  };
  const unchanged = applyRulesetBuilder(definition, manual, result.state, catalogs);
  assert.equal(unchanged.build.abilities.str, 17);
  assert.equal(unchanged.build.skills.perception, "expertise", "manual tier survives");
  const unpicked = applyRulesetBuilder(definition, result.build, { ...result.state, picks: {} }, catalogs);
  assert.equal(unpicked.build.skills.athletics, undefined);
  assert.equal(unpicked.build.skills.perception, undefined);
  assert.equal(unpicked.build.abilities.str, 10);
  assert.deepEqual(unpicked.state.trainedChoices, planted.trainedChoices);
  const described = applyRulesetBuilder(definition, result.build, { ...planted, describing: true }, catalogs);
  assert.deepEqual(described.build, result.build);
  assert.deepEqual(
    applyRulesetBuilder(definition, described.build, { ...described.state, describing: false }, catalogs).build,
    described.build,
  );

  // A career change deactivates downstream answers without losing them; repair uses the same key.
  result = applyRulesetBuilder(
    definition,
    result.build,
    { ...result.state, trainedChoices: { ...result.state.trainedChoices, "career//skills": ["survival"] } },
    catalogs,
  );
  assert.equal(result.build.skills.survival, "proficient");
  assert.equal(result.state.trainedChoices!["human//noncareer"]![1], "survival");
  assert.deepEqual(
    rulesetBuilderTrainedSlots(definition, result.state, catalogs, result.build).find(
      (slot) => slot.key === "human//noncareer",
    )!.chosen,
    ["acrobatics", "stealth"],
  );
  const decreased = applyRulesetBuilder(
    definition,
    { ...result.build, fields: { ...result.build.fields, choice_count: 1 } },
    result.state,
    catalogs,
  );
  assert.equal(decreased.build.skills.stealth, undefined, "excess count becomes inactive");
  assert.equal(decreased.state.trainedChoices!["human//noncareer"]!.length, 3);
  const hidden = { ...result.build, fields: { ...result.build.fields, choice_count: 0 } };
  assert.equal(rulesetBuilderStepVisible(definition, definition.sheet.builder!.steps[4]!, hidden), false);
  assert.equal(rulesetBuilderRemaining(definition, hidden, result.state, catalogs).subrace, 0);
  assert.equal(rulesetBuilderRemaining(definition, result.build, result.state, catalogs).subrace, 1);
  const required = fixture();
  delete required.sheet.builder.steps[4].when;
  const requiredDef = parse(required);
  assert.equal(rulesetBuilderStepVisible(requiredDef, requiredDef.sheet.builder!.steps[4]!, hidden), true);
  assert.equal(
    rulesetBuilderRemaining(requiredDef, hidden, result.state, catalogs).subrace,
    0,
    "requiredWhen changes badges only",
  );
  const hiddenPick = applyRulesetBuilder(
    definition,
    hidden,
    { ...result.state, picks: { subrace: ["human"] } },
    catalogs,
  );
  assert.deepEqual(hiddenPick.state.picks, { subrace: ["human"] });
  assert.deepEqual(rulesetBuilderPicks(definition, "subrace", hiddenPick.state, catalogs, hiddenPick.build), []);

  const countedBoostDoc = fixture();
  countedBoostDoc.catalogs.at(-1).entries[0].grants.abilities.choose[0] = {
    id: "restricted",
    count: 1,
    max: 3,
    countFrom: { field: "choice_count" },
    amount: 1,
    from: ["str", "dex", "con"],
  };
  const countedBoostDef = parse(countedBoostDoc);
  const countedBoost = applyRulesetBuilder(
    countedBoostDef,
    defaultRulesetSheetBuild(countedBoostDef),
    { picks: { background: ["human"] }, abilityChoices: { "background/human/restricted": ["str", "dex", "con"] } },
    catalogsOf(countedBoostDef),
  );
  assert.equal(countedBoost.build.abilities.str, 11);
  assert.equal(countedBoost.build.abilities.dex, 11);
  assert.equal(countedBoost.build.abilities.con, 10);
  assert.deepEqual(countedBoost.state.abilityChoices!["background/human/restricted"], ["str", "dex", "con"]);
  countedBoostDoc.catalogs.at(-1).entries[0].grants.abilities.choose.unshift({ id: "inserted", count: 1, amount: 1 });
  const reordered = parse(countedBoostDoc);
  assert.deepEqual(
    applyRulesetBuilder(reordered, countedBoost.build, countedBoost.state, catalogsOf(reordered)).build,
    countedBoost.build,
    "stable choice IDs survive inserting another slot",
  );

  // Fate: one +4, two +3, three +2 and four +1, with each skill chosen once.
  const fate = base();
  fate.resolution.proficiencyTiers.push(
    ...[1, 2, 3, 4].map((rating) => ({ id: `rating_${rating}`, label: `Rating ${rating}`, flat: rating })),
  );
  const skillIds = fate.sheet.skills
    .filter((skill: { id: string }) => !skill.id.includes("_"))
    .slice(0, 10)
    .map((skill: { id: string }) => skill.id);
  fate.catalogs.push({
    id: "ratings",
    label: "Ratings",
    filters: [
      { id: "rating", label: "Rating", type: "number" },
      { id: "skill", label: "Skill", type: "text" },
    ],
    entries: skillIds.flatMap((id: string) =>
      [1, 2, 3, 4].map((rating) => ({
        ...row(`${id}-${rating}`, { rating, skill: id }),
        grants: { trained: { skills: [id], tier: `rating_${rating}` } },
      })),
    ),
    feeds: ["features"],
  });
  fate.sheet.builder = {
    steps: [
      {
        id: "ratings",
        label: "Ratings",
        kind: "catalog",
        catalog: "ratings",
        min: 10,
        max: 10,
        quotas: [1, 2, 3, 4].map((value) => ({ filter: "rating", value, min: 5 - value, max: 5 - value })),
        distinctBy: "skill",
      },
    ],
  };
  const fateDef = parse(fate);
  const fateCatalogs = catalogsOf(fateDef);
  const fateStep = fateDef.sheet.builder!.steps[0]!;
  assert.ok(fateStep.kind === "catalog");
  const ratings = [4, 3, 3, 2, 2, 2, 1, 1, 1, 1];
  const fateState = { picks: { ratings: skillIds.map((id: string, index: number) => `${id}-${ratings[index]}`) } };
  const rated = applyRulesetBuilder(fateDef, defaultRulesetSheetBuild(fateDef), fateState, fateCatalogs);
  assert.equal(rulesetBuilderRemaining(fateDef, rated.build, rated.state, fateCatalogs).ratings, 0);
  assert.deepEqual(
    skillIds.map((id: string) => rated.build.skills[id]),
    ratings.map((rating) => `rating_${rating}`),
  );
  assert.equal(
    rulesetBuilderPickReason(fateDef, fateStep, rated.state, fateCatalogs, rated.build, `${skillIds[1]}-4`),
    "distinct",
  );
  const badFate = { picks: { ratings: [`${skillIds[0]}-4`, `${skillIds[1]}-4`, `${skillIds[0]}-3`] } };
  assert.equal(rulesetBuilderPicks(fateDef, "ratings", badFate, fateCatalogs, rated.build).length, 1);
  assert.ok(rulesetBuilderRemaining(fateDef, rated.build, badFate, fateCatalogs).ratings! > 0);

  // Genesys: removing a supporting talent deactivates higher tiers, and restoring it repairs them.
  const pyramid = base();
  pyramid.catalogs.push({
    id: "talents",
    label: "Talents",
    feeds: ["features"],
    filters: [{ id: "tier", label: "Tier", type: "number" }],
    entries: [
      row("a", { tier: 1 }),
      row("b", { tier: 1 }),
      row("c", { tier: 1 }),
      row("d", { tier: 2 }),
      row("e", { tier: 2 }),
      row("f", { tier: 3 }),
    ],
  });
  pyramid.sheet.builder = {
    steps: [
      {
        id: "talents",
        label: "Talents",
        kind: "catalog",
        catalog: "talents",
        min: 6,
        max: 6,
        quotaBelow: { filter: "tier" },
      },
    ],
  };
  const pyramidDef = parse(pyramid);
  const pyramidCatalogs = catalogsOf(pyramidDef);
  const all = ["f", "e", "d", "c", "b", "a"];
  const built = applyRulesetBuilder(
    pyramidDef,
    defaultRulesetSheetBuild(pyramidDef),
    { picks: { talents: all } },
    pyramidCatalogs,
  );
  assert.equal(built.build.lists.features!.length, 6);
  const removed = applyRulesetBuilder(
    pyramidDef,
    built.build,
    { ...built.state, picks: { talents: all.filter((id) => id !== "a") } },
    pyramidCatalogs,
  );
  assert.deepEqual(
    rulesetBuilderPicks(pyramidDef, "talents", removed.state, pyramidCatalogs, removed.build).map((entry) => entry.id),
    ["e", "c", "b"],
  );
  assert.equal(removed.build.lists.features!.length, 3);
  assert.ok(removed.state.picks!.talents!.includes("f"));
  assert.equal(
    applyRulesetBuilder(pyramidDef, removed.build, { ...removed.state, picks: { talents: all } }, pyramidCatalogs).build
      .lists.features!.length,
    6,
  );

  // Row choices share quotas and counted slots without recursively applying their grants.
  const entriesDoc = fixture();
  entriesDoc.catalogs.push({
    id: "gifts",
    label: "Gifts",
    feeds: ["features"],
    filters: [{ id: "origin", label: "Origin", type: "text" }],
    entries: [
      { ...row("gift-a", { origin: "sun" }), grants: { abilities: { add: { str: 9 } } } },
      row("gift-b", { origin: "sun" }),
      row("gift-c", { origin: "moon" }),
    ],
  });
  entriesDoc.catalogs.at(-2).entries[0].grants.entries = {
    choose: [
      {
        id: "gifts",
        catalog: "gifts",
        count: 1,
        max: 3,
        countFrom: { field: "choice_count" },
        distinctBy: "origin",
        quotas: [{ filter: "origin", value: "sun", min: 1, max: 1 }],
      },
    ],
  };
  entriesDoc.sheet.builder.steps.push({ id: "gifts", label: "Gifts", kind: "choices", catalog: "gifts" });
  const entriesDef = parse(entriesDoc);
  const entriesCatalogs = catalogsOf(entriesDef);
  const gifts = applyRulesetBuilder(
    entriesDef,
    defaultRulesetSheetBuild(entriesDef),
    { picks: { background: ["human"] }, entryChoices: { "background/human/gifts": ["gift-a", "gift-b", "gift-c"] } },
    entriesCatalogs,
  );
  assert.equal(gifts.build.abilities.str, 10);
  assert.deepEqual(rulesetBuilderEntrySlots(entriesDef, gifts.state, entriesCatalogs, gifts.build)[0]!.chosen, [
    "gift-a",
    "gift-c",
  ]);
  assert.equal(gifts.build.lists.features!.length, 2);
  const missing = { ...entriesCatalogs, gifts: [] };
  assert.ok(
    rulesetBuilderRemaining(entriesDef, gifts.build, gifts.state, missing).gifts! >= 2,
    "missing content never looks complete",
  );

  const expertiseDoc = fixture();
  expertiseDoc.sheet.builder.steps = [
    {
      id: "expertise",
      label: "Expertise",
      kind: "trained",
      choose: [{ id: "rank", what: "skills", count: 1, only: "trained", tier: "expertise" }],
    },
  ];
  const expertiseDef = parse(expertiseDoc);
  const manualTraining = { ...defaultRulesetSheetBuild(expertiseDef), skills: { perception: "proficient" } };
  const expertiseState = { describing: true, trainedChoices: { "expertise//rank": ["perception"] } };
  const upgradedTraining = applyRulesetBuilder(
    expertiseDef,
    manualTraining,
    { ...expertiseState, describing: false },
    catalogsOf(expertiseDef),
  );
  assert.equal(
    upgradedTraining.build.skills.perception,
    "expertise",
    "trained-only choices can upgrade existing training",
  );
  assert.deepEqual(
    applyRulesetBuilder(expertiseDef, upgradedTraining.build, upgradedTraining.state, catalogsOf(expertiseDef)),
    upgradedTraining,
    "reopening does not award the upgrade again",
  );
  assert.equal(
    applyRulesetBuilder(
      expertiseDef,
      upgradedTraining.build,
      { ...upgradedTraining.state, trainedChoices: {} },
      catalogsOf(expertiseDef),
    ).build.skills.perception,
    "proficient",
    "unpick restores baseline training",
  );
  const manualTier = { ...upgradedTraining.build, skills: { perception: "half" } };
  assert.equal(
    applyRulesetBuilder(expertiseDef, manualTier, upgradedTraining.state, catalogsOf(expertiseDef)).build.skills
      .perception,
    "half",
    "later manual edits still survive",
  );

  const describedTraining = applyRulesetBuilder(expertiseDef, manualTraining, expertiseState, catalogsOf(expertiseDef));
  assert.deepEqual(
    rulesetBuilderTrainedSlots(
      expertiseDef,
      describedTraining.state,
      catalogsOf(expertiseDef),
      describedTraining.build,
    )[0]!.chosen,
    ["perception"],
  );
  const finishedTraining = applyRulesetBuilder(
    expertiseDef,
    describedTraining.build,
    { ...describedTraining.state, describing: false },
    catalogsOf(expertiseDef),
  );
  assert.deepEqual(finishedTraining.build, manualTraining, "described manual training survives eligibility checks");
  assert.deepEqual(
    applyRulesetBuilder(
      expertiseDef,
      finishedTraining.build,
      { ...finishedTraining.state, trainedChoices: {} },
      catalogsOf(expertiseDef),
    ).build,
    manualTraining,
  );

  const replacementDoc = base();
  replacementDoc.sheet.builder = {
    tier: "proficient",
    steps: [
      {
        id: "training",
        label: "Training",
        kind: "trained",
        choose: [{ id: "new", what: "skills", count: 1, only: "untrained" }],
      },
    ],
  };
  const replacementDef = parse(replacementDoc);
  const trackedManual = applyRulesetBuilder(
    replacementDef,
    { ...defaultRulesetSheetBuild(replacementDef), skills: { perception: "proficient" } },
    {},
    {},
  );
  const manuallyRemoved = applyRulesetBuilder(
    replacementDef,
    { ...trackedManual.build, skills: { perception: "none" } },
    trackedManual.state,
    {},
  );
  const givenAgain = applyRulesetBuilder(
    replacementDef,
    manuallyRemoved.build,
    { ...manuallyRemoved.state, trainedChoices: { "training//new": ["perception"] } },
    {},
  );
  assert.equal(givenAgain.build.skills.perception, "proficient");
  assert.deepEqual(applyRulesetBuilder(replacementDef, givenAgain.build, givenAgain.state, {}), givenAgain);
  const removedAgain = applyRulesetBuilder(
    replacementDef,
    givenAgain.build,
    { ...givenAgain.state, trainedChoices: {} },
    {},
  );
  assert.equal(
    removedAgain.build.skills.perception,
    undefined,
    "unpick cannot resurrect manually removed training from an old snapshot",
  );

  // Merged 1.104 ownership is resolved before a 1.151 exclusion reads a named choice.
  const mergedTrainingDoc = base();
  mergedTrainingDoc.sheet.builder = {
    tier: "proficient",
    steps: [
      { id: "first", label: "First", kind: "trained", choose: [{ id: "skill", what: "skills", count: 1 }] },
      { id: "second", label: "Second", kind: "trained", choose: [{ id: "skill", what: "skills", count: 1 }] },
      {
        id: "third",
        label: "Third",
        kind: "trained",
        choose: [{ id: "skill", what: "skills", count: 1, tier: "expertise", excludeChoices: ["second/skill"] }],
      },
    ],
  };
  const mergedTrainingDef = parse(mergedTrainingDoc);
  const mergedTraining = applyRulesetBuilder(
    mergedTrainingDef,
    defaultRulesetSheetBuild(mergedTrainingDef),
    {
      trainedChoices: {
        "first//skill": ["acrobatics"],
        "second//skill": ["acrobatics", "survival"],
        "third//skill": ["survival", "stealth"],
      },
    },
    {},
  );
  const mergedSlots = rulesetBuilderTrainedSlots(mergedTrainingDef, mergedTraining.state, {}, mergedTraining.build);
  assert.deepEqual(mergedSlots[1]!.chosen, ["survival"]);
  assert.deepEqual(mergedSlots[2]!.chosen, ["stealth"]);
  assert.equal(mergedSlots[2]!.disabled!.survival, "excluded");

  // A named, counted Expertise choice keeps its lower training and restores saved picks on growth.
  const heldDoc = fixture();
  heldDoc.catalogs.at(-1).entries[0].grants.trained = {
    skills: ["athletics", "perception"],
    choose: [
      {
        id: "expert",
        what: "skills",
        count: 1,
        countFrom: { field: "choice_count" },
        max: 3,
        tier: "expertise",
        held: "proficient",
      },
    ],
  };
  heldDoc.sheet.builder.steps = heldDoc.sheet.builder.steps.slice(0, 3);
  const heldDef = parse(heldDoc);
  const heldCatalogs = catalogsOf(heldDef);
  const held = applyRulesetBuilder(
    heldDef,
    defaultRulesetSheetBuild(heldDef),
    {
      picks: { background: ["human"] },
      trainedChoices: { "background/human/expert": ["athletics", "perception", "stealth"] },
    },
    heldCatalogs,
  );
  const heldSlot = rulesetBuilderTrainedSlots(heldDef, held.state, heldCatalogs, held.build)[0]!;
  assert.deepEqual(heldSlot.chosen, ["athletics", "perception"]);
  assert.ok(!heldSlot.from.includes("stealth"));
  const heldShrunk = applyRulesetBuilder(
    heldDef,
    {
      ...held.build,
      fields: { ...held.build.fields, choice_count: 1 },
    },
    held.state,
    heldCatalogs,
  );
  assert.equal(heldShrunk.build.skills.perception, "proficient");
  assert.deepEqual(heldShrunk.state.trainedChoices, held.state.trainedChoices);
  assert.equal(
    applyRulesetBuilder(
      heldDef,
      {
        ...heldShrunk.build,
        fields: { ...heldShrunk.build.fields, choice_count: 2 },
      },
      heldShrunk.state,
      heldCatalogs,
    ).build.skills.perception,
    "expertise",
  );

  const invalidHeldDoc = structuredClone(heldDoc);
  invalidHeldDoc.catalogs.at(-1).entries[0].grants.trained.choose[0].held = "expertise";
  refuse(invalidHeldDoc, /is not below the tier/);
  const ownHeldDoc = base();
  ownHeldDoc.sheet.builder = {
    tier: "expertise",
    steps: [
      {
        id: "expert",
        label: "Expert",
        kind: "trained",
        choose: [{ what: "skills", count: 1, held: "proficient" }],
      },
    ],
  };
  parse(ownHeldDoc);
  const invalidOwnHeldDoc = structuredClone(ownHeldDoc);
  invalidOwnHeldDoc.sheet.builder.steps[0].choose[0].held = "expertise";
  refuse(invalidOwnHeldDoc, /is not below the tier/);

  // Entry offeredWhen still gates named, counted choices with distinctness and quotas.
  const gatedGiftsDoc = structuredClone(entriesDoc);
  gatedGiftsDoc.catalogs.at(-1).entries[0].offeredWhen = { field: "xp" };
  const gatedGiftsDef = parse(gatedGiftsDoc);
  const gatedGifts = applyRulesetBuilder(
    gatedGiftsDef,
    defaultRulesetSheetBuild(gatedGiftsDef),
    {
      picks: { background: ["human"] },
      entryChoices: { "background/human/gifts": ["gift-a", "gift-c"] },
    },
    catalogsOf(gatedGiftsDef),
  );
  const gatedGiftSlot = rulesetBuilderEntrySlots(
    gatedGiftsDef,
    gatedGifts.state,
    catalogsOf(gatedGiftsDef),
    gatedGifts.build,
  )[0]!;
  assert.deepEqual(gatedGiftSlot.chosen, ["gift-c"]);
  assert.ok(!gatedGiftSlot.from.includes("gift-a"));
  assert.equal(gatedGiftSlot.missing, 1);
  assert.deepEqual(gatedGifts.state.entryChoices!["background/human/gifts"], ["gift-a", "gift-c"]);

  // Strict objects, reference types, declared maxima, tier mappings and forward-only dependencies.
  for (const [edit, message] of [
    [(doc: any) => (doc.sheet.builder.steps[3].choose[0].max = undefined), /declares its maximum/],
    [(doc: any) => (doc.sheet.builder.steps[3].choose[0].countFrom = { field: "race" }), /number/],
    [
      (doc: any) => (doc.sheet.builder.steps[3].choose[0].only = "sometimes"),
      /choose\.0\.only: Invalid option: expected one of "any"\|"trained"\|"untrained"/,
    ],
    [(doc: any) => (doc.sheet.builder.steps[3].choose[0].tier = "missing"), /offered tier/],
    [(doc: any) => (doc.sheet.builder.steps[3].choose[0].excludeChoices = ["human/noncareer"]), /No earlier choice/],
    [(doc: any) => (doc.sheet.builder.steps[2].choose[0].excludeChoices = ["human/noncareer"]), /No earlier choice/],
    [(doc: any) => (doc.sheet.builder.steps[3].when = { live: "hp" }), /live|Unrecognized/],
    [(doc: any) => (doc.sheet.builder.steps[3].when = { skillMod: "stealth" }), /earlier steps/],
    [(doc: any) => (doc.sheet.builder.steps[3].choose[0].predicate = "true"), /Unrecognized/],
    [
      (doc: any) => (doc.catalogs.at(-1).entries[0].grants.abilities.choose[1].id = "restricted"),
      /Duplicate builder choice/,
    ],
  ] as const) {
    const refusedDoc = fixture();
    edit(refusedDoc);
    refuse(refusedDoc, message);
  }
  for (const [edit, message] of [
    [(doc: any) => (doc.sheet.builder.steps[0].quotas[0].min = 11), /quota/],
    [(doc: any) => (doc.sheet.builder.steps[0].quotas[0].value = "four"), /filter/],
    [(doc: any) => (doc.sheet.builder.steps[0].distinctBy = "unknown"), /distinctness/],
    [(doc: any) => (doc.sheet.builder.steps[0].quotaBelow = { filter: "skill" }), /number filter/],
    [
      (doc: any) =>
        (doc.sheet.builder.steps[0].quotas = Array(13).fill({ filter: "rating", value: 1, min: 0, max: 1 })),
      /12/,
    ],
  ] as const) {
    const refusedDoc = structuredClone(fate);
    edit(refusedDoc);
    refuse(refusedDoc, message);
  }
  const fileDef = structuredClone(definition);
  const origins = fileDef.catalogs!.find((catalog) => catalog.id === "origins")!;
  const fileEntries = origins.entries!;
  delete origins.entries;
  origins.asset = "catalogs/origins.json";
  assert.deepEqual(
    rulesetCatalogEntryIssues(fileDef, origins, fileEntries),
    [],
    "catalog-file choices validated with their source entries",
  );
  const badFile = structuredClone(fileEntries);
  badFile[0]!.grants!.abilities!.choose![1]!.excludeChoices = ["background/nope"];
  assert.ok(
    rulesetCatalogEntryIssues(fileDef, origins, badFile).some((issue) => /No earlier choice/.test(issue.message)),
  );

  const conditionalFileDoc = base();
  conditionalFileDoc.catalogs.push({ id: "origins", label: "Origins", asset: "catalogs/origins.json" });
  conditionalFileDoc.sheet.builder = {
    steps: [
      { id: "details", label: "Details", kind: "fields", fields: ["xp"] },
      { id: "origin", label: "Origin", kind: "catalog", catalog: "origins", when: { field: "xp" } },
    ],
  };
  const conditionalFileDef = parse(conditionalFileDoc);
  const conditionalHeader = conditionalFileDef.catalogs!.find((catalog) => catalog.id === "origins")!;
  assert.deepEqual(
    rulesetCatalogEntryIssues(conditionalFileDef, conditionalHeader, [
      { id: "human", label: "Human", grants: { abilities: { add: { str: 2 } } } },
    ]),
    [],
  );
  assert.ok(
    rulesetCatalogEntryIssues(conditionalFileDef, conditionalHeader, [
      { id: "human", label: "Human", grants: { sets: { xp: 0 } } },
    ]).some((issue) => /earlier steps/.test(issue.message)),
    "a file cannot change the value that enables its own step",
  );
  const hiddenHostDoc = fixture();
  hiddenHostDoc.sheet.builder.steps[2].when = { skillMod: "perception" };
  refuse(hiddenHostDoc, /earlier steps/);
  const overlap = structuredClone(fate);
  overlap.sheet.builder.steps[0].quotas = Array(12).fill({ filter: "rating", value: 4, min: 1, max: 1 });
  parse(overlap); // One pick may satisfy several quotas, so their minima are not added together.

  const manifest = (minor: number) => ({
    schemaVersion: 2,
    capabilityApi: { major: 1, minor },
    builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
    id: "builder-choices",
    name: "Builder choices",
    version: "1.0.0",
    description: "Choice proof",
    engine: { min: "2.4.6", maxExclusive: "4.0.0" },
    kind: ["ruleset"],
    entrypoints: {},
    contributions: { assets: { paths: ["ruleset.json", "catalogs/origins.json"] } },
    files: [{ path: "ruleset.json", sha256: "0".repeat(64), bytes: 10 }],
    permissions: [],
    restartRequired: false,
  });
  const issue = (minor: number, doc: unknown, files?: Map<string, unknown>) =>
    getCapabilityPackageInstallIssue(manifest(minor) as any, doc, files);
  assert.match(issue(150, doc) ?? "", /1\.151/);
  assert.equal(issue(151, doc), null);
  const filed = base();
  filed.catalogs.push({ id: "origins", label: "Origins", asset: "catalogs/origins.json" });
  assert.match(issue(150, filed, new Map([["catalogs/origins.json", { entries: fileEntries }]])) ?? "", /1\.151/);
  assert.equal(issue(151, filed, new Map([["catalogs/origins.json", { entries: fileEntries }]])), null);
  assert.equal(issue(150, base()), null, "older rulesets remain compatible");
  assert.match(issue(104, ownHeldDoc) ?? "", /1\.105/);
  assert.equal(issue(105, ownHeldDoc), null);
  console.log("game-ruleset-builder-choices: passed");
} finally {
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  rmSync(dataDir, { recursive: true, force: true });
}
