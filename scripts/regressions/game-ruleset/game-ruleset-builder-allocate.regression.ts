/** Capability API 1.152: staged dots, priority reassignment, free ranks and preserved sheets. */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  applyRulesetBuilder,
  defaultRulesetSheetBuild,
  parseRulesetDefinition,
  readRulesetBuilderState,
  rulesetBuilderAllocations,
  rulesetBuilderRemaining,
  rulesetCatalogEntryIssues,
  type RulesetBuilderState,
  type RulesetCatalogEntriesById,
  type RulesetDefinition,
} from "../../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-builder-allocate-"));
const previous = { DATA_DIR: process.env.DATA_DIR, MARINARA_DATA_DIR: process.env.MARINARA_DATA_DIR };
process.env.DATA_DIR = dataDir;
process.env.MARINARA_DATA_DIR = dataDir;
const { getCapabilityPackageInstallIssue } =
  await import("../../../packages/server/src/services/capability-packages/package-manager.service.js");
const base = () =>
  JSON.parse(readFileSync(new URL("../../../docs/development/ruleset-5e-2014.example.json", import.meta.url), "utf8"));
const parse = (doc: unknown) => {
  const result = parseRulesetDefinition(doc);
  assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
  return result.definition;
};
const catalogsOf = (definition: RulesetDefinition): RulesetCatalogEntriesById =>
  Object.fromEntries((definition.catalogs ?? []).map((catalog) => [catalog.id, catalog.entries ?? []]));
const fixture = () => {
  const doc = base();
  doc.sheet.abilities.forEach((ability: any) => Object.assign(ability, { min: 0, max: 30, default: 1 }));
  for (const id of ["manipulation", "appearance", "wits"])
    doc.sheet.abilities.push({ id, label: id, short: id.slice(0, 3), min: 0, max: 10, default: 1 });
  doc.sheet.fields.push({ id: "virtue", label: "Virtue", type: "number", min: 0, max: 10, default: 0 });
  doc.catalogs.push({
    id: "heritages",
    label: "Heritages",
    entries: [
      { id: "first", label: "First", grants: { ratings: [{ target: { skill: "athletics" }, add: 1 }] } },
      { id: "second", label: "Second", grants: { ratings: [{ target: { skill: "athletics" }, add: 1 }] } },
      { id: "floor", label: "Floor", grants: { ratings: [{ target: { skill: "athletics" }, set: 1 }] } },
    ],
  });
  doc.sheet.builder = {
    ratingTiers: [
      { target: { skill: "athletics" }, tiers: ["none", "proficient", "expertise"] },
      { target: { save: "str_save" }, tiers: ["none", "proficient"] },
    ],
    steps: [
      { id: "heritage", label: "Heritage", kind: "catalog", catalog: "heritages", min: 0, max: 3 },
      {
        id: "dots",
        label: "Dots",
        kind: "allocate",
        priorities: [7, 5, 3],
        annotations: true,
        groups: [
          {
            id: "physical",
            label: "Physical",
            targets: ["str", "dex", "con"].map((ability) => ({ ability })),
            base: { const: 1 },
            min: 1,
            max: 5,
          },
          {
            id: "social",
            label: "Social",
            targets: ["cha", "manipulation", "appearance"].map((ability) => ({ ability })),
            base: 1,
            min: 1,
            max: 5,
          },
          {
            id: "mental",
            label: "Mental",
            targets: ["int", "wis", "wits"].map((ability) => ({ ability })),
            base: 1,
            min: 1,
            max: 5,
          },
        ],
      },
      {
        id: "ranks",
        label: "Ranks",
        kind: "allocate",
        groups: [
          {
            id: "training",
            label: "Training",
            targets: [{ skill: "athletics" }, { save: "str_save" }],
            base: 0,
            min: 0,
            max: 1,
            budget: { const: 1 },
          },
          {
            id: "virtues",
            label: "Virtues",
            targets: [{ field: "virtue" }, { bonus: "perception" }],
            base: 0,
            min: 0,
            max: 5,
            budget: { const: 3 },
          },
        ],
      },
      {
        id: "freebies",
        label: "Freebies",
        kind: "allocate",
        groups: [{ id: "extra", label: "Extra", targets: [{ ability: "str" }], min: 1, max: 7, budget: { const: 2 } }],
      },
    ],
  };
  // A rank cap may differ per target without a duplicate class pick.
  doc.sheet.builder.steps[2].groups[0].targets = [{ save: "str_save" }];
  doc.sheet.builder.steps[2].groups.push({
    id: "skills",
    label: "Skills",
    targets: [{ skill: "athletics" }],
    base: 0,
    min: 0,
    max: 2,
    budget: { const: 1 },
  });
  return doc;
};

try {
  const doc = fixture();
  const definition = parse(doc);
  const catalogs = catalogsOf(definition);
  const planted: RulesetBuilderState = {
    allocations: {
      dots: {
        priorities: { physical: 0, social: 1, mental: 2 },
        bought: { "ability/str": 4, "ability/dex": 3, "ability/cha": 3, "ability/manipulation": 2, "ability/int": 3 },
        notes: { "ability/str": "Raised in the hills" },
      },
      ranks: { bought: { "skill/athletics": 1, "save/str_save": 1, "field/virtue": 2, "bonus/perception": 1 } },
      freebies: { bought: { "ability/str": 2 } },
    },
  };
  let result = applyRulesetBuilder(definition, defaultRulesetSheetBuild(definition), planted, catalogs);
  assert.equal(result.build.abilities.str, 7, "later freebies may exceed the earlier cap of five");
  assert.equal(result.build.fields.virtue, 2);
  assert.equal(result.build.bonuses.perception, 1);
  assert.equal(result.build.skills.athletics, "proficient");
  assert.equal(result.build.saves.str_save, "proficient");
  assert.equal(rulesetBuilderRemaining(definition, result.build, result.state, catalogs).dots, 0);
  assert.deepEqual(result.state.applied?.allocations?.freebies, { "ability/str": 2 });
  assert.deepEqual(
    applyRulesetBuilder(definition, result.build, readRulesetBuilderState({ builder: result.state }), catalogs),
    result,
    "reopen is idempotent",
  );
  const initial = result;

  result = applyRulesetBuilder(
    definition,
    result.build,
    {
      ...result.state,
      allocations: {
        ...result.state.allocations,
        dots: { ...result.state.allocations!.dots, priorities: { physical: 2, social: 1, mental: 0 } },
      },
    },
    catalogs,
  );
  assert.equal(result.build.abilities.str, 3, "overspent earlier group becomes inactive; later freebies remain");
  assert.equal(result.build.abilities.dex, 1);
  assert.equal(result.state.allocations!.dots!.bought!["ability/str"], 4, "reassignment keeps paid answers");
  assert.ok(rulesetBuilderRemaining(definition, result.build, result.state, catalogs).dots! > 0);
  assert.ok(rulesetBuilderAllocations(definition, result.build, result.state, catalogs)[0]!.rows[0]!.inactive);
  result = applyRulesetBuilder(
    definition,
    result.build,
    { ...result.state, allocations: planted.allocations },
    catalogs,
  );
  assert.deepEqual(result.build, initial.build, "restoring priorities reactivates answers");

  result = applyRulesetBuilder(
    definition,
    result.build,
    { ...result.state, picks: { heritage: ["first", "second", "floor"] } },
    catalogs,
  );
  assert.equal(
    result.build.skills.athletics,
    "expertise",
    "two free ranks overlap to two; set is a floor, not a third rank",
  );
  assert.equal(
    result.state.applied?.allocations?.ranks?.["skill/athletics"],
    0,
    "a paid rank above the cap is inactive, never charged for free ranks",
  );
  assert.equal(result.state.allocations!.ranks!.bought!["skill/athletics"], 1);
  assert.deepEqual(applyRulesetBuilder(definition, result.build, result.state, catalogs), result);
  result = applyRulesetBuilder(definition, result.build, { ...result.state, picks: {} }, catalogs);
  assert.equal(result.build.skills.athletics, "proficient", "removing free ranks restores the saved paid increment");
  result = applyRulesetBuilder(
    definition,
    result.build,
    { ...result.state, allocations: { ...result.state.allocations, freebies: { bought: {} } } },
    catalogs,
  );
  assert.equal(result.build.abilities.str, 5, "undo freebies keeps the first stage");
  result = applyRulesetBuilder(definition, result.build, { ...result.state, allocations: {} }, catalogs);
  assert.equal(result.build.abilities.str, 1);
  assert.equal(result.build.fields.virtue, 0);
  assert.equal(result.build.bonuses.perception, 0);

  const fixedDoc = fixture();
  fixedDoc.sheet.builder.steps[1].groups[1].targets.pop();
  fixedDoc.sheet.builder.steps.push({
    id: "appearance",
    label: "Appearance",
    kind: "allocate",
    groups: [
      {
        id: "fixed",
        label: "Fixed",
        targets: [{ ability: "appearance" }],
        base: 0,
        min: 0,
        max: 0,
        budget: { const: 0 },
      },
    ],
  });
  const fixed = parse(fixedDoc);
  const fresh = applyRulesetBuilder(fixed, defaultRulesetSheetBuild(fixed), {}, catalogs);
  assert.equal(fresh.build.abilities.appearance, 0);
  const manual = { ...fresh.build, abilities: { ...fresh.build.abilities, appearance: 4 } };
  const kept = applyRulesetBuilder(fixed, manual, fresh.state, catalogs);
  assert.equal(kept.build.abilities.appearance, 4, "fixed creation score does not clamp a manual override");
  const appearance = rulesetBuilderAllocations(fixed, kept.build, kept.state, catalogs).at(-1)!;
  assert.equal(appearance.rows[0]!.override, 4);
  assert.equal(appearance.rows[0]!.canAdd, false);
  assert.ok(appearance.missing > 0);

  const describedBuild = {
    ...initial.build,
    abilities: { ...initial.build.abilities, str: 9 },
    skills: { athletics: "expertise" },
  };
  const described = applyRulesetBuilder(
    definition,
    describedBuild,
    { ...planted, describing: true, picks: { heritage: ["first"] } },
    catalogs,
  );
  assert.deepEqual(described.build, describedBuild, "describing never changes a sheet");
  const ended = applyRulesetBuilder(definition, described.build, { ...described.state, describing: false }, catalogs);
  assert.deepEqual(ended.build, describedBuild, "ending describing never awards again");
  assert.deepEqual(
    applyRulesetBuilder(definition, ended.build, readRulesetBuilderState({ builder: ended.state }), catalogs),
    ended,
  );
  const tolerant = readRulesetBuilderState({
    builder: { ...initial.state, allocations: { dots: { ...planted.allocations!.dots, notes: 4 } } },
  });
  assert.deepEqual(
    tolerant.allocations?.dots?.bought,
    planted.allocations!.dots!.bought,
    "bad notes do not cost purchases",
  );

  const advancedDoc = fixture();
  advancedDoc.sheet.builder.steps[3].groups[0].max = 30;
  advancedDoc.sheet.builder.steps[3].groups[0].budget = { const: 28 };
  const advanced = parse(advancedDoc);
  const maxed = { ...initial.build, abilities: { ...initial.build.abilities, str: 30 } };
  const blocked = applyRulesetBuilder(
    advanced,
    maxed,
    {
      ...initial.state,
      allocations: {
        ...initial.state.allocations,
        freebies: { bought: { "ability/str": 3 } },
      },
    },
    catalogs,
  );
  assert.equal(blocked.build.abilities.str, 30);
  assert.equal(blocked.state.applied?.allocations?.freebies?.["ability/str"], 2, "an unwritten purchase is not owned");
  const undoBlocked = applyRulesetBuilder(
    advanced,
    blocked.build,
    { ...blocked.state, allocations: planted.allocations },
    catalogs,
  );
  assert.equal(undoBlocked.build.abilities.str, 30, "undo cannot take an unwritten increment from a manual score");

  const lowered = { ...initial.build, abilities: { ...initial.build.abilities, str: 0 } };
  const undoAtFloor = applyRulesetBuilder(
    definition,
    lowered,
    {
      ...initial.state,
      allocations: {
        ...initial.state.allocations,
        freebies: { bought: {} },
      },
    },
    catalogs,
  );
  assert.equal(undoAtFloor.build.abilities.str, 0, "undo preserves a manual score at its storage floor");
  assert.equal(
    undoAtFloor.state.applied?.allocations?.freebies?.["ability/str"],
    0,
    "an unpicked stage no longer owns its dots",
  );
  const rebought = applyRulesetBuilder(
    definition,
    undoAtFloor.build,
    { ...undoAtFloor.state, allocations: planted.allocations },
    catalogs,
  );
  assert.equal(rebought.build.abilities.str, 2, "buying again moves only the newly owned dots");

  const legacyDoc = fixture();
  legacyDoc.catalogs.at(-1).entries.push({
    id: "classic",
    label: "Classic",
    grants: { trained: { skills: ["athletics"], tier: "proficient" }, abilities: { add: { str: 2 } } },
  });
  const legacy = parse(legacyDoc);
  const mixed = applyRulesetBuilder(
    legacy,
    defaultRulesetSheetBuild(legacy),
    { picks: { heritage: ["classic", "first"] } },
    catalogsOf(legacy),
  );
  assert.equal(mixed.build.skills.athletics, "expertise", "legacy training composes with a free rank");
  assert.equal(mixed.build.abilities.str, 3, "legacy ability grants compose with the allocation base");
  assert.deepEqual(applyRulesetBuilder(legacy, mixed.build, mixed.state, catalogsOf(legacy)), mixed);
  const cleared = applyRulesetBuilder(legacy, mixed.build, { ...mixed.state, picks: {} }, catalogsOf(legacy));
  assert.equal(cleared.build.skills.athletics, "none");
  assert.equal(cleared.build.abilities.str, 1);

  const unmappedDoc = structuredClone(legacyDoc);
  unmappedDoc.catalogs.at(-1).entries.at(-1).grants.trained.tier = "half";
  const unmapped = parse(unmappedDoc);
  const unmappedResult = applyRulesetBuilder(
    unmapped,
    defaultRulesetSheetBuild(unmapped),
    { picks: { heritage: ["classic", "first"] } },
    catalogsOf(unmapped),
  );
  assert.equal(
    unmappedResult.build.skills.athletics,
    "half",
    "an unmapped existing tier is preserved, never invented as rank zero",
  );
  assert.ok(
    rulesetBuilderAllocations(unmapped, unmappedResult.build, unmappedResult.state, catalogsOf(unmapped)).find(
      (group) => group.groupId === "skills",
    )?.notConfigured,
  );
  assert.deepEqual(
    applyRulesetBuilder(unmapped, unmappedResult.build, unmappedResult.state, catalogsOf(unmapped)),
    unmappedResult,
  );

  const bonusDoc = fixture();
  bonusDoc.sheet.bonusRange = { min: -2, max: 2 };
  assert.equal(parseRulesetDefinition(bonusDoc).ok, false, "allocation maxima respect the sheet bonus range");
  bonusDoc.sheet.builder.steps = [bonusDoc.sheet.builder.steps[0]];
  bonusDoc.catalogs.at(-1).entries = [
    { id: "bonus", label: "Bonus", grants: { ratings: [{ target: { bonus: "perception" }, add: 4 }] } },
  ];
  const bonusDef = parse(bonusDoc);
  const bonusCatalogs = catalogsOf(bonusDef);
  const negative = { ...defaultRulesetSheetBuild(bonusDef), bonuses: { perception: -1 } };
  const freeBonus = applyRulesetBuilder(bonusDef, negative, { picks: { heritage: ["bonus"] } }, bonusCatalogs);
  assert.equal(freeBonus.build.bonuses.perception, 2, "free grants stop at the declared bonus maximum");
  const noBonus = applyRulesetBuilder(bonusDef, freeBonus.build, { ...freeBonus.state, picks: {} }, bonusCatalogs);
  assert.equal(noBonus.build.bonuses.perception, -1, "undo restores a valid negative bonus");
  bonusDoc.sheet.bonusRange.min = 1;
  const positiveBonus = parse(bonusDoc);
  const granted = applyRulesetBuilder(
    positiveBonus,
    defaultRulesetSheetBuild(positiveBonus),
    { picks: { heritage: ["bonus"] } },
    bonusCatalogs,
  );
  assert.equal(granted.build.bonuses.perception, 2, "an absent bonus still starts from implicit zero");
  const removed = applyRulesetBuilder(positiveBonus, granted.build, { ...granted.state, picks: {} }, bonusCatalogs);
  assert.equal(
    removed.build.bonuses.perception,
    undefined,
    "undo restores an absent bonus even when explicit zero is outside the range",
  );
  bonusDoc.catalogs.at(-1).entries[0].grants.ratings[0] = { target: { bonus: "perception" }, set: 3 };
  assert.equal(parseRulesetDefinition(bonusDoc).ok, false, "set grants also respect the bonus range");

  const dynamicDoc = fixture();
  dynamicDoc.sheet.builder.steps[3].groups[0].budget = { field: "xp" };
  dynamicDoc.sheet.builder.steps[3].groups[0].min = { const: 6 };
  const dynamic = parse(dynamicDoc);
  const empty = applyRulesetBuilder(dynamic, defaultRulesetSheetBuild(dynamic), {}, catalogs);
  assert.ok(
    rulesetBuilderRemaining(dynamic, empty.build, empty.state, catalogs).freebies! > 0,
    "impossible minima get a badge with no budget",
  );
  const duplicates = fixture();
  duplicates.sheet.builder.steps[1].priorities = [3, 3, 3];
  const duplicateDef = parse(duplicates);
  const duplicateResult = applyRulesetBuilder(
    duplicateDef,
    defaultRulesetSheetBuild(duplicateDef),
    { allocations: { dots: { priorities: { physical: 0, social: 1, mental: 2 } } } },
    catalogs,
  );
  assert.deepEqual(
    rulesetBuilderAllocations(duplicateDef, duplicateResult.build, duplicateResult.state, catalogs)
      .slice(0, 3)
      .map((group) => group.budget),
    [3, 3, 3],
  );

  for (const edit of [
    (doc: any) => doc.sheet.builder.steps[1].groups.push(doc.sheet.builder.steps[1].groups[0]),
    (doc: any) => doc.sheet.builder.steps[1].groups[0].targets.push({ ability: "cha" }),
    (doc: any) => doc.sheet.builder.steps[1].priorities.pop(),
    (doc: any) => (doc.sheet.builder.steps[1].priorities[0] = -1),
    (doc: any) => (doc.sheet.builder.steps[1].groups[0].budget = { const: 7 }),
    (doc: any) => delete doc.sheet.builder.steps[3].groups[0].budget,
    (doc: any) => (doc.sheet.builder.steps[3].groups[0].budget = { abilityScore: "str" }),
    (doc: any) => {
      doc.sheet.derived.push({ id: "feedback", label: "Feedback", op: "sum", of: [{ abilityScore: "str" }] });
      doc.sheet.builder.steps[3].groups[0].budget = { derived: "feedback" };
    },
    (doc: any) => (doc.sheet.builder.steps[3].groups[0].min = { livePool: "hp" }),
    (doc: any) => (doc.sheet.builder.steps[1].groups[0].targets[0] = { ability: "str", field: "virtue" }),
    (doc: any) => (doc.sheet.builder.steps[1].groups[0].targets[0] = { field: "race" }),
    (doc: any) => (doc.sheet.builder.steps[1].groups[0].targets[0] = { ability: "missing" }),
    (doc: any) => (doc.sheet.builder.steps[1].groups[0].max = 0),
    (doc: any) => (doc.sheet.builder.steps[1].groups[0].formula = "1 + 2"),
    (doc: any) => delete doc.sheet.builder.ratingTiers,
    (doc: any) => (doc.sheet.builder.ratingTiers[0].tiers = ["proficient", "none"]),
    (doc: any) => (doc.sheet.builder.ratingTiers[0].tiers = ["none", "madeup"]),
    (doc: any) => (doc.catalogs.at(-1).entries[0].grants.ratings[0].set = 2),
    (doc: any) => (doc.catalogs.at(-1).entries[0].grants.ratings[0].target = { bonus: "madeup" }),
    (doc: any) => (doc.catalogs.at(-1).entries[0].offeredWhen = { skillMod: "athletics" }),
  ]) {
    const bad = fixture();
    edit(bad);
    assert.equal(parseRulesetDefinition(bad).ok, false, "invalid allocation contract is refused");
  }
  const peerCycle = fixture();
  const [heritageStep, dotStep] = peerCycle.sheet.builder.steps;
  peerCycle.sheet.builder.steps = [dotStep, heritageStep];
  peerCycle.catalogs.at(-1).entries = [
    {
      id: "peer",
      label: "Peer",
      offeredWhen: { abilityScore: "str" },
      grants: { ratings: [{ target: { ability: "dex" }, add: 1 }] },
    },
  ];
  assert.equal(
    parseRulesetDefinition(peerCycle).ok,
    false,
    "a conditional free grant cannot read a peer whose allocation it can deactivate",
  );

  const fileDef = structuredClone(definition);
  const header = fileDef.catalogs!.at(-1)!;
  const entries = header.entries!;
  delete header.entries;
  header.asset = "catalogs/heritages.json";
  assert.deepEqual(rulesetCatalogEntryIssues(fileDef, header, entries), []);
  const invalidEntries = structuredClone(entries);
  invalidEntries[0]!.grants!.ratings![0]!.target = { skill: "missing" };
  assert.ok(rulesetCatalogEntryIssues(fileDef, header, invalidEntries).length);

  const manifest = (minor: number) => ({
    schemaVersion: 2,
    capabilityApi: { major: 1, minor },
    builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
    id: "builder-allocate",
    name: "Builder allocation",
    version: "1.0.0",
    description: "Allocation proof",
    engine: { min: "2.4.6", maxExclusive: "4.0.0" },
    kind: ["ruleset"],
    entrypoints: {},
    contributions: { assets: { paths: ["ruleset.json", "catalogs/heritages.json"] } },
    files: [{ path: "ruleset.json", sha256: "0".repeat(64), bytes: 10 }],
    permissions: [],
    restartRequired: false,
  });
  const issue = (minor: number, doc: unknown, files?: Map<string, unknown>) =>
    getCapabilityPackageInstallIssue(manifest(minor) as any, doc, files);
  assert.match(issue(151, doc) ?? "", /1\.152/);
  assert.equal(issue(152, doc), null);
  const grantOnly = base();
  grantOnly.catalogs.push({
    id: "heritages",
    label: "Heritages",
    entries: [{ id: "first", label: "First", grants: { ratings: [{ target: { ability: "str" }, add: 1 }] } }],
  });
  assert.match(issue(151, grantOnly) ?? "", /1\.152/);
  const fileEntries = grantOnly.catalogs.at(-1).entries;
  delete grantOnly.catalogs.at(-1).entries;
  grantOnly.catalogs.at(-1).asset = "catalogs/heritages.json";
  const files = new Map([["catalogs/heritages.json", { entries: fileEntries }]]);
  assert.match(issue(151, grantOnly, files) ?? "", /1\.152/);
  assert.equal(issue(152, grantOnly, files), null);
  const mapsOnly = base();
  mapsOnly.sheet.builder = {
    steps: [{ id: "info", label: "Info", kind: "fields", fields: ["xp"] }],
    ratingTiers: doc.sheet.builder.ratingTiers,
  };
  assert.match(issue(151, mapsOnly) ?? "", /1\.152/);
  assert.equal(issue(151, base()), null);
  console.log("game-ruleset-builder-allocate: passed");
} finally {
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  rmSync(dataDir, { recursive: true, force: true });
}
