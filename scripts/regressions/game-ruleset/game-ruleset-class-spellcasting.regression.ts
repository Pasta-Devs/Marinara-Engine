/** Each class keeps its spellcasting numbers (1.108), from a builder pick through a rolled fight. */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  applyRulesetBuilder,
  applyRulesetCombatChoice,
  createRulesetEncounter,
  defaultRulesetSheetBuild,
  evaluateRulesetSheet,
  parseRulesetDefinition,
  renderRulesetSheetBlock,
  resolveRulesetAbilityValues,
  rulesetCombatant,
  rulesetCombatOptions,
  type RulesetDefinition,
  type RulesetSheetBuild,
} from "../../../packages/shared/src/index.js";
import { rulesetRowSpellcastingText } from "../../../packages/client/src/lib/ruleset-sheet-view.js";

const read = (path: string) => readFileSync(new URL(`../../../${path}`, import.meta.url), "utf8");
const messages = JSON.parse(read("packages/client/src/localization/locales/en.json"));
const t = ((key: string, params: Record<string, unknown>) => {
  assert.ok(messages[key], key);
  return messages[key].replace(/\{\{(\w+)\}\}/g, (_: string, name: string) => String(params[name]));
}) as Parameters<typeof rulesetRowSpellcastingText>[5];
const parsed = (doc: unknown): RulesetDefinition => {
  const result = parseRulesetDefinition(doc);
  assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
  return result.definition;
};
const document = JSON.parse(read("docs/development/ruleset-5e-2014.example.json"));
const spellList = document.sheet.lists.find((list: { id: string }) => list.id === "spells");
spellList.columns.push({ id: "class", label: "Class", type: "text", maxLength: 80, default: "wizard" });
for (const [name, ability] of [
  ["cleric", "wis"],
  ["wizard", "int"],
]) {
  document.sheet.derived.push(
    {
      id: `spell_attack_${name}`,
      label: `${name} attack`,
      op: "sum",
      of: [{ derived: "proficiency_bonus" }, { abilityMod: ability }],
    },
    { id: `spell_dc_${name}`, label: `${name} DC`, op: "sum", of: [{ const: 8 }, { derived: `spell_attack_${name}` }] },
  );
}
const spells = {
  id: "spells",
  label: "Spells",
  feeds: ["spells"],
  entries: ["cleric", "wizard", "unmarked", "unknown"].flatMap((name) =>
    ["attack", "save"].map((kind) => ({
      id: `${name}-${kind}`,
      label: `${name} ${kind}`,
      rows: [
        {
          list: "spells",
          values: {
            name: `${name} ${kind}`,
            level: 0,
            prepared: true,
            ...(name === "unknown" ? { class: "sorcerer" } : {}),
            ...(["cleric", "wizard"].includes(name) ? { class: "other", prepared: false, level: 1 } : {}),
          },
        },
      ],
      mechanics: {
        kind: "attack",
        amount: { flat: 4 },
        ...(kind === "attack" ? { attackRoll: true } : { save: { save: "dex_save", onSuccess: "half" } }),
      },
    })),
  ),
};
document.catalogs.push(spells);
document.sheet.builder = {
  steps: ["cleric", "wizard", "unmarked", "unknown"].map((name) => ({
    id: name,
    label: name,
    kind: "catalog",
    catalog: "spells",
    min: 2,
    max: 2,
    ...(["cleric", "wizard"].includes(name) ? { stamp: { class: name, prepared: true, level: 0 } } : {}),
  })),
};
document.combat.abilities[0].byColumn = {
  column: "class",
  values: Object.fromEntries(
    ["cleric", "wizard"].map((name) => [
      name,
      {
        toHit: { derived: `spell_attack_${name}` },
        saveDifficulty: { derived: `spell_dc_${name}` },
      },
    ]),
  ),
};
const dataDir = mkdtempSync(join(tmpdir(), "marinara-class-spellcasting-"));
process.env.DATA_DIR = dataDir;
process.env.MARINARA_DATA_DIR = dataDir;
try {
  const { getCapabilityPackageInstallIssue } =
    await import("../../../packages/server/src/services/capability-packages/package-manager.service.js");
  const definition = parsed(document);
  const catalogs = { spells: definition.catalogs!.find((catalog) => catalog.id === "spells")!.entries! };
  const blank = defaultRulesetSheetBuild(definition);
  const base: RulesetSheetBuild = {
    ...blank,
    abilities: { ...blank.abilities, wis: 18, int: 14, cha: 10 },
    fields: { ...blank.fields, level: 5, spellcasting_ability: "cha" },
  };
  const picks = Object.fromEntries(
    ["cleric", "wizard", "unmarked", "unknown"].map((name) => [name, [`${name}-attack`, `${name}-save`]]),
  );
  const added = applyRulesetBuilder(definition, base, { picks }, catalogs);
  const build = added.build;
  const rows = build.lists.spells!;
  assert.equal(rows.length, 8);
  assert.deepEqual(
    rows.map((row) => row.class),
    ["cleric", "cleric", "wizard", "wizard", undefined, undefined, "sorcerer", "sorcerer"],
  );
  assert.equal(rows[0]!.prepared, true);
  assert.equal(rows[0]!.level, 0);
  const edited = structuredClone(build);
  edited.lists.spells![0]!.class = "wizard";
  assert.equal(
    applyRulesetBuilder(definition, edited, added.state, catalogs).build.lists.spells![0]!.class,
    "wizard",
    "free edits survive a builder pass",
  );
  const preexisting = applyRulesetBuilder(definition, edited, { picks }, catalogs);
  assert.equal(preexisting.build.lists.spells![0]!.class, "wizard", "a row the player already held is not stamped");
  const changedRow = { ...rows[0]!, class: "wizard" };
  assert.equal(
    rulesetRowSpellcastingText(definition, edited, "spells", changedRow, evaluateRulesetSheet(definition, edited), t),
    "Spell attack +5 · Save DC 13",
  );
  assert.ok(
    renderRulesetSheetBlock(definition, { name: "Caster", build: edited }, {}, catalogs).includes(
      "cleric attack (attack +5, save DC 13)",
    ),
  );
  const unpicked = applyRulesetBuilder(
    definition,
    build,
    { ...added.state, picks: { ...picks, cleric: [] } },
    catalogs,
  );
  assert.equal(unpicked.build.lists.spells!.length, 6);
  const repicked = applyRulesetBuilder(definition, unpicked.build, { ...unpicked.state, picks }, catalogs);
  assert.equal(repicked.build.lists.spells!.at(-1)!.class, "cleric");

  const source = definition.combat!.abilities![0]!;
  const evaluated = evaluateRulesetSheet(definition, build);
  const expected = [
    [7, 15],
    [7, 15],
    [5, 13],
    [5, 13],
    [3, 11],
    [3, 11],
    [3, 11],
    [3, 11],
  ];
  const summary = renderRulesetSheetBlock(definition, { name: "Caster", build }, {}, catalogs);
  rows.forEach((row, index) => {
    const [attack, dc] = expected[index]!;
    const values = resolveRulesetAbilityValues(definition, build, source, row, evaluated);
    assert.deepEqual([values.toHit, values.saveDifficulty], [attack, dc]);
    assert.equal(
      rulesetRowSpellcastingText(definition, build, "spells", row, evaluated, t),
      `Spell attack +${attack} · Save DC ${dc}`,
    );
    assert.ok(summary.includes(`${row.name} (attack +${attack}, save DC ${dc})`), summary);
  });
  const partial = { ...source, byColumn: { column: "class", values: { cleric: { toHit: { const: 0 } } } } };
  assert.deepEqual(resolveRulesetAbilityValues(definition, build, partial, rows[0]!, evaluated), {
    toHit: 0,
    toHitRef: { const: 0 },
    saveDifficulty: 11,
  });
  assert.equal(resolveRulesetAbilityValues(definition, build, source, { class: "toString" }, evaluated).toHit, 3);
  for (const value of [true, 1]) {
    assert.equal(
      resolveRulesetAbilityValues(
        definition,
        build,
        { ...source, byColumn: { column: "class", values: { [String(value)]: { toHit: { const: 9 } } } } },
        { class: value },
        evaluated,
      ).toHit,
      9,
    );
  }

  const fight = (rules = definition, sheet = build) => {
    let initiative = 0;
    return createRulesetEncounter({
      definition: rules,
      seed: 1,
      roller: () => (initiative++ === 0 ? 20 : 1),
      combatants: [
        { id: "caster", name: "Caster", side: "party", build: sheet, live: {}, catalogs },
        {
          id: "target",
          name: "Target",
          side: "enemy",
          block: { health: 100, defense: 15, initiativeModifier: 0, saves: { dex_save: 0 }, actions: [] },
        },
      ],
    });
  };
  const state = fight();
  const actions = rulesetCombatant(state, "caster")!.actions;
  rows.forEach((row, index) => {
    const [attack, dc] = expected[index]!;
    const option = rulesetCombatOptions(definition, state, "caster").find((option) => option.label === row.name)!;
    assert.ok(option, String(row.name));
    const action = actions.find((action) => action.id === option.id)!;
    assert.equal(action.saveDifficulty, dc);
    assert.equal(option.forecast!.averageDamage, 4);
    const result = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "caster", optionId: option.id, targetIds: ["target"] },
      () => 10,
    );
    assert.ok(!result.events.some((event) => event.type === "refused"));
    if (index % 2 === 0) {
      assert.equal(option.forecast!.hitChance, (21 + attack! - 15) / 20);
      const roll = result.events.find((event) => event.type === "attack")!;
      assert.ok(roll && roll.type === "attack");
      assert.deepEqual([roll.modifier, roll.total], [attack, 10 + attack!]);
    } else {
      assert.equal(action.save!.difficulty, dc);
      const roll = result.events.find((event) => event.type === "save")!;
      assert.ok(roll && roll.type === "save");
      assert.deepEqual([roll.difficulty, roll.total, roll.success], [dc, 10, false]);
    }
  });
  assert.equal(
    rulesetCombatant(fight(definition, edited), "caster")!.actions[0]!.toHit,
    5,
    "free class edits reach combat",
  );

  // Adjustments scoped to an ability follow the selected reference as well as its number.
  const adjustedDoc = structuredClone(document);
  adjustedDoc.combat.abilities[0].byColumn.values.cleric.toHit = { abilityMod: "wis" };
  adjustedDoc.resolution.adjust = [{ value: { const: 2 }, abilities: ["wis"] }];
  const adjusted = parsed(adjustedDoc);
  assert.equal(rulesetCombatant(fight(adjusted), "caster")!.actions[0]!.toHit, 6);

  const legacyDoc = structuredClone(document);
  delete legacyDoc.combat.abilities[0].byColumn;
  for (const step of legacyDoc.sheet.builder.steps) delete step.stamp;
  const legacy = parsed(legacyDoc);
  assert.ok(
    rulesetCombatant(fight(legacy), "caster")!.actions.every(
      (action) => action.toHit === undefined || action.toHit === 3,
    ),
  );
  assert.equal(rulesetRowSpellcastingText(legacy, build, "spells", rows[0]!, evaluated, t), "");
  assert.ok(!renderRulesetSheetBlock(legacy, { name: "Caster", build }, {}, catalogs).includes("(attack"));
  assert.equal(applyRulesetBuilder(legacy, base, { picks }, catalogs).build.lists.spells![0]!.class, "other");

  const refused = (edit: (doc: any) => void, pattern: RegExp) => {
    const doc = structuredClone(document);
    edit(doc);
    const result = parseRulesetDefinition(doc);
    assert.ok(!result.ok, `must refuse ${pattern}`);
    assert.match(result.issues.join("; "), pattern);
  };
  refused((doc) => (doc.sheet.builder.steps[0].stamp = {}), /1 to 4/);
  refused(
    (doc) =>
      (doc.sheet.builder.steps[0].stamp = { class: "cleric", prepared: true, level: 0, ritual: false, notes: "x" }),
    /1 to 4/,
  );
  refused((doc) => (doc.sheet.builder.steps[0].stamp = { absent: "cleric" }), /Unknown column/);
  refused((doc) => (doc.sheet.builder.steps[0].stamp.class = []), /stamp/);
  refused(
    (doc) => doc.catalogs.find((catalog: any) => catalog.id === "spells").feeds.push("features"),
    /Unknown column/,
  );
  refused((doc) => (doc.combat.abilities[0].byColumn.column = "absent"), /Unknown column/);
  refused((doc) => (doc.combat.abilities[0].byColumn.values = {}), /1 to 20/);
  refused(
    (doc) =>
      (doc.combat.abilities[0].byColumn.values = Object.fromEntries(Array.from({ length: 21 }, (_, i) => [i, {}]))),
    /1 to 20/,
  );
  refused((doc) => (doc.combat.abilities[0].byColumn.values.cleric.toHit = { derived: "absent" }), /Unknown derived/);
  refused(
    (doc) => (doc.combat.abilities[0].byColumn.values.cleric.saveDifficulty = { field: "absent" }),
    /Unknown field/,
  );
  refused((doc) => (doc.combat.abilities[0].byColumn.values.cleric.extra = 1), /Unrecognized key/);
  refused((doc) => (doc.combat.abilities[0].byColumn.extra = 1), /Unrecognized key/);
  refused((doc) => delete doc.catalogs.find((catalog: any) => catalog.id === "spells").feeds, /Unknown column|feeds/);
  refused((doc) => (doc.sheet.builder.steps[0].stamp = { "bad-key": "cleric" }), /stamp/);
  const limits = structuredClone(document);
  limits.sheet.builder.steps[0].stamp.notes = "Class spell";
  limits.combat.abilities[0].byColumn.values = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [i, {}]));
  parsed(limits);

  const manifest = (minor: number) => ({
    schemaVersion: 2,
    capabilityApi: { major: 1, minor },
    builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
    id: "class-spellcasting",
    name: "Class spellcasting",
    version: "0.1.0",
    description: "Class spellcasting.",
    engine: { min: "2.4.6", maxExclusive: "4.0.0" },
    kind: ["ruleset"],
    entrypoints: {},
    contributions: { assets: { paths: ["ruleset.json"] } },
    files: [{ path: "ruleset.json", sha256: "0".repeat(64), bytes: 10 }],
    permissions: [],
    restartRequired: false,
  });
  for (const key of ["stamp", "byColumn"]) {
    const doc = structuredClone(document);
    if (key === "stamp") delete doc.combat.abilities[0].byColumn;
    else for (const step of doc.sheet.builder.steps) delete step.stamp;
    const issue =
      "A ruleset whose classes cast with their own spellcasting ability requires schemaVersion 2 and capabilityApi 1.108 or newer";
    assert.equal(getCapabilityPackageInstallIssue(manifest(107) as any, doc), issue);
    assert.equal(getCapabilityPackageInstallIssue(manifest(108) as any, doc), null);
    const missing = manifest(108) as any;
    delete missing.capabilityApi;
    assert.match(getCapabilityPackageInstallIssue(missing, doc) ?? "", /requires schemaVersion 2/);
    assert.match(
      getCapabilityPackageInstallIssue({ ...manifest(108), schemaVersion: 1 } as any, doc) ?? "",
      /requires schemaVersion 2/,
    );
  }
  assert.equal(getCapabilityPackageInstallIssue(manifest(107) as any, legacyDoc), null);

  // The emitted schema retains the bounds Zod implements as refinements.
  const schema = JSON.parse(read("docs/extending/ruleset.schema.json"));
  const nodes: any[] = [];
  const visit = (node: any) => {
    if (node && typeof node === "object") {
      nodes.push(node);
      Object.values(node).forEach(visit);
    }
  };
  visit(schema);
  const stamp = nodes.find((node) => node.properties?.stamp)?.properties.stamp;
  assert.deepEqual([stamp.minProperties, stamp.maxProperties], [1, 4]);
  const values = nodes.find((node) => node.properties?.byColumn)?.properties.byColumn.properties.values;
  assert.deepEqual([values.minProperties, values.maxProperties], [1, 20]);
  const editor = read("packages/client/src/components/rulesets/RulesetSheetEditor.tsx");
  assert.match(editor, /rulesetRowSpellcastingText\(definition, build, list.id, row, evaluated, t\)/);
  assert.match(editor, /\{spellcasting\}/);
  console.log("Class spellcasting: builder, sheet, prompt, forecast, rolls, refusals and 1.108 gate passed.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
