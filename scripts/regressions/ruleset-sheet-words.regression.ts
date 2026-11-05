/** Capability API 1.378: a ruleset's own words on its sheet, menu and cards. A combat modifier's
 *  `label` said in place of the composed phrase, a pool's `unit` and `units`, a list's `display`, a
 *  text field hidden by a derived value, a condition left out of the picker, a track shown once
 *  moved, an item toggle's labels, an item use's title, creature traits to 1200 letters, and the
 *  gate that asks for 1.378. */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createRulesetEncounter,
  defaultRulesetSheetBuild,
  isRulesetTextHidden,
  parseRulesetDefinition,
  rulesetItemEffectFacts,
  rulesetItemEffectText,
  rowsFromCatalogEntry,
  rulesetBuilderEntryHeld,
  rulesetCombatOptions,
  rulesetForecastsByTarget,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetDefinition,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";
import { rulesetMenuGroups } from "../../packages/client/src/lib/ruleset-combat-menu.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-sheet-words-"));
const previous = { DATA_DIR: process.env.DATA_DIR, MARINARA_DATA_DIR: process.env.MARINARA_DATA_DIR };
process.env.DATA_DIR = dataDir;
process.env.MARINARA_DATA_DIR = dataDir;
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

const baseText = readFileSync(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url), "utf8");
const fixture = (edit: (doc: Record<string, any>) => void = () => {}) => {
  const doc = JSON.parse(baseText) as Record<string, any>;
  edit(doc);
  return doc;
};
const parse = (doc: unknown): RulesetDefinition => {
  const result = parseRulesetDefinition(doc);
  assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
  return result.definition;
};
const issuesOf = (doc: unknown) => {
  const result = parseRulesetDefinition(doc);
  return result.ok ? "" : result.issues.join("; ");
};
const list = (doc: Record<string, any>, id: string) => doc.sheet.lists.find((one: { id: string }) => one.id === id);

try {
  assert.ok(supportedCapabilityApi.minor >= 378);

  const words = fixture((doc) => {
    doc.sheet.live.pools[1].unit = "hit die";
    doc.sheet.live.pools[1].units = "hit dice";
    list(doc, "spells").display = {
      tab: "Spells",
      by: { column: "level", labels: ["Cantrips", "1st level", "2nd level"] },
      mark: "prepared",
    };
    doc.sheet.live.text[0].hideWhen = { derived: "spell_save_dc", equals: 0 };
    doc.sheet.live.conditions[1].pickable = false;
    doc.sheet.live.tracks[2].showWhenSet = true;
    doc.sheet.derived[4].signed = true;
    doc.combat.conditions[13].modifiers[0].label = "advantage on saves against being charmed";
    doc.catalogs[0].entries[0].creature.traits = [{ name: "Weaknesses", text: "w".repeat(1100) }];
  });
  const definition = parse(words);
  assert.equal(definition.sheet.live.pools[1]!.units, "hit dice");
  assert.equal(definition.sheet.lists.find((one) => one.id === "spells")!.display?.by?.labels[0], "Cantrips");
  assert.equal(definition.sheet.live.conditions[1]!.pickable, false);
  assert.equal(definition.sheet.live.tracks[2]!.showWhenSet, true);

  // A modifier's own label is the whole phrase a card says.
  const modifier = definition.combat!.conditions![13]!.modifiers![0]!;
  const facts = rulesetItemEffectFacts(definition, { modifiers: [modifier] });
  assert.equal(facts.length, 1);
  assert.equal(rulesetItemEffectText(facts[0]!), "advantage on saves against being charmed");

  // A text field hidden by a derived value.
  const build = defaultRulesetSheetBuild(definition);
  const text = definition.sheet.live.text[0]!;
  assert.equal(isRulesetTextHidden(text, build, definition, { spell_save_dc: 0 }), true);
  assert.equal(isRulesetTextHidden(text, build, definition, { spell_save_dc: 13 }), false);
  assert.equal(isRulesetTextHidden({}, build, definition, {}), false);

  // What the schema refuses.
  assert.match(
    issuesOf(fixture((doc) => (list(doc, "spells").display = { by: { column: "name", labels: ["A"] } }))),
    /Must name a number column/,
  );
  assert.match(
    issuesOf(fixture((doc) => (list(doc, "spells").display = { mark: "level" }))),
    /Must name a yes-or-no column/,
  );
  assert.match(
    issuesOf(fixture((doc) => (doc.sheet.live.text[0].hideWhen = { derived: "nothing_here", equals: 0 }))),
    /Unknown derived value "nothing_here"/,
  );
  assert.match(
    issuesOf(fixture((doc) => (doc.sheet.live.text[0].hideWhen = { derived: "spell_save_dc", equals: 0, in: [1] }))),
    /exactly one of/,
  );
  assert.match(
    issuesOf(fixture((doc) => (doc.sheet.live.text[0].hideWhen = { derived: "spell_save_dc" }))),
    /exactly one of/,
  );
  {
    // The published schema says the same: a derived comparison names one way to compare.
    const schemaText = readFileSync(new URL("../../docs/extending/ruleset.schema.json", import.meta.url), "utf8");
    const derivedHides: Array<Record<string, any>> = [];
    JSON.parse(schemaText, (_key, value) => {
      if (value?.type === "object" && value.properties?.derived && value.properties?.notEquals)
        derivedHides.push(value);
      return value;
    });
    assert.ok(derivedHides.length > 0, "the schema carries a derived hideWhen");
    for (const node of derivedHides) {
      assert.deepEqual(
        node.oneOf?.map((one: { required: string[] }) => one.required[0]),
        ["equals", "notEquals", "in"],
      );
    }
  }
  assert.ok(
    issuesOf(
      fixture((doc) => (doc.catalogs[0].entries[0].creature.traits = [{ name: "Long", text: "w".repeat(1300) }])),
    ),
    "a trait over 1200 letters",
  );

  // ── Spells under the list's own heading on the combat menu ──
  const spell = (id: string, label: string, level: number) => ({
    id,
    label,
    rows: [{ list: "spells", values: { name: label, level, prepared: true } }],
    mechanics: {
      kind: "attack",
      autoHit: true,
      damageType: "fire",
      range: 60,
      amount: { flat: 3 },
      ...(level > 0 ? { cost: [{ pool: `slots_${level}`, amount: 1 }] } : {}),
    },
  });
  const spells = [
    spell("bolt", "Bolt", 1),
    spell("spark", "Spark", 0),
    spell("flare", "Flare", 1),
  ] as unknown as RulesetCatalogEntry[];
  const caster = (display: boolean) => {
    const doc = fixture((doc) => {
      doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: structuredClone(spells) });
      if (display)
        list(doc, "spells").display = { tab: "Spells", by: { column: "level", labels: ["Cantrips", "1st level"] } };
    });
    const ruleset = parse(doc);
    const state = createRulesetEncounter({
      definition: ruleset,
      seed: 1,
      roller: () => 10,
      combatants: [
        {
          id: "mage",
          name: "Mage",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 8, dex: 10, con: 14, int: 16, wis: 10, cha: 10 },
            fields: { level: 3, ac: 12, speed: 30, hp_max: 20, spellcasting_ability: "int", slots_max_1: 4 },
            lists: {
              spells: spells.flatMap((entry) =>
                rowsFromCatalogEntry("spells", entry).flatMap((one) => (one.list === "spells" ? [one.row] : [])),
              ),
            },
          }),
          live: {},
          catalogs: { spells },
        },
        {
          id: "foe",
          name: "Foe",
          side: "enemy",
          block: {
            health: 30,
            defense: 5,
            initiativeModifier: -5,
            speed: 30,
            actions: [],
          } as unknown as RulesetStatBlock,
        },
      ],
    });
    return rulesetMenuGroups(rulesetCombatOptions(ruleset, state, "mage") as never);
  };
  const plain = caster(false);
  assert.ok(
    plain.some((group) => group.key === "ability" && group.options.some((option) => option.label === "Bolt")),
    "with no display a spell sits under its kind's own heading",
  );
  const shown = caster(true);
  const headings = shown.map((group) => [
    group.labelKey,
    group.labelValues?.sub,
    group.options.map((one) => one.label),
  ]);
  const cantrips = shown.findIndex((group) => group.labelValues?.sub === "Cantrips");
  const first = shown.findIndex((group) => group.labelValues?.sub === "1st level");
  assert.ok(cantrips >= 0 && first > cantrips, JSON.stringify(headings));
  assert.deepEqual(
    shown[cantrips]!.options.map((one) => one.label),
    ["Spark"],
  );
  assert.deepEqual(shown[first]!.options.map((one) => one.label).sort(), ["Bolt", "Flare"]);
  assert.equal(shown[first]!.labelKey, "game.combat.ruleset.group.listedSplit");
  assert.equal(shown[first]!.labelValues?.tab, "Spells");
  assert.ok(!shown.some((group) => group.key === "ability" && group.options.some((one) => one.label === "Bolt")));

  // ── Odds against each target ──
  {
    const ruleset = parse(fixture());
    const foe = (id: string, defense: number) => ({
      id,
      name: id,
      side: "enemy" as const,
      block: { health: 30, defense, initiativeModifier: -5, speed: 30, actions: [] } as unknown as RulesetStatBlock,
    });
    const state = createRulesetEncounter({
      definition: ruleset,
      seed: 1,
      roller: () => 10,
      combatants: [
        {
          id: "fighter",
          name: "Fighter",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 16, dex: 10, con: 14, int: 8, wis: 10, cha: 10 },
            fields: { level: 3, ac: 16, speed: 30, hp_max: 28 },
            lists: {
              attacks: [
                { name: "Longsword", ability: "str", proficient: true, damage: "1d8", damage_type: "slashing" },
              ],
            },
          }),
          live: {},
        },
        foe("soft", 8),
        foe("hard", 20),
      ],
    });
    const sword = rulesetCombatOptions(ruleset, state, "fighter").find((option) => option.label === "Longsword");
    assert.ok(sword?.forecast?.hitChance !== undefined, "the sword is forecast");
    const odds = rulesetForecastsByTarget(ruleset, state, "fighter", sword!.id, ["soft", "hard", "nobody"]);
    assert.deepEqual(Object.keys(odds).sort(), ["hard", "soft"]);
    assert.ok(odds.soft!.hitChance! > odds.hard!.hitChance!, "an easier target is likelier hit");
    assert.deepEqual(rulesetForecastsByTarget(ruleset, state, "fighter", "no-such-option", ["soft"]), {});
    // A lair option's id carries its prefix, and still finds the action behind it.
    assert.deepEqual(rulesetForecastsByTarget(ruleset, state, "fighter", `lair>${sword!.id}`, ["soft", "hard"]), {
      soft: odds.soft,
      hard: odds.hard,
    });
  }

  // ── What the builder offers as already known ──
  const tongue = {
    id: "dwarvish",
    label: "Dwarvish",
    rows: [{ list: "proficiencies", values: { name: "Dwarvish" } }],
  } as unknown as RulesetCatalogEntry;
  const held = (rows: unknown[]) =>
    rulesetBuilderEntryHeld(
      definition,
      rulesetSheetBuildSchema.parse({ lists: { proficiencies: rows } }),
      "languages",
      tongue,
    );
  assert.equal(held([]), false);
  assert.equal(held([{ name: " dwarvish " }]), true, "written by the race, matched by name");
  assert.equal(held([{ name: "Elvish", _catalog: "languages/dwarvish" }]), true, "or by the entry's own mark");
  assert.equal(held([{ name: "Elvish" }]), false);
  {
    // A row that writes more than its name is held only by its own mark.
    const fuller = {
      id: "dwarvish",
      label: "Dwarvish",
      rows: [{ list: "proficiencies", values: { name: "Dwarvish", note: "a script of runes" } }],
    } as unknown as RulesetCatalogEntry;
    const heldFuller = (rows: unknown[]) =>
      rulesetBuilderEntryHeld(
        definition,
        rulesetSheetBuildSchema.parse({ lists: { proficiencies: rows } }),
        "languages",
        fuller,
      );
    assert.equal(heldFuller([{ name: "Dwarvish" }]), false, "a hand-typed row of the same name");
    assert.equal(heldFuller([{ name: "Dwarvish", _catalog: "languages/dwarvish" }]), true);
  }
  assert.equal(
    rulesetBuilderEntryHeld(definition, build, "languages", { id: "none", label: "None" } as RulesetCatalogEntry),
    false,
    "an entry that writes nothing is never held",
  );

  // ── The gate ──
  const gate = /capabilityApi 1\.378 or newer/;
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
  const issueAt = (minor: number, doc: unknown, catalogs?: Map<string, unknown>) =>
    getCapabilityPackageInstallIssue(manifest(minor) as never, doc as never, catalogs as never) ?? "";
  assert.doesNotMatch(issueAt(377, fixture()), gate, "the example asks for nothing new");
  assert.match(issueAt(377, words), gate);
  assert.doesNotMatch(issueAt(378, words), gate);
  for (const edit of [
    (doc: Record<string, any>) => (doc.sheet.live.pools[1].unit = "hit die"),
    (doc: Record<string, any>) => (list(doc, "spells").display = { tab: "Spells" }),
    (doc: Record<string, any>) => (doc.sheet.live.text[0].hideWhen = { derived: "spell_save_dc", equals: 0 }),
    (doc: Record<string, any>) => (doc.sheet.live.conditions[1].pickable = false),
    (doc: Record<string, any>) => (doc.sheet.live.tracks[2].showWhenSet = true),
    (doc: Record<string, any>) => (doc.sheet.derived[4].signed = true),
    (doc: Record<string, any>) => (doc.combat.conditions[13].modifiers[0].label = "says so"),
    (doc: Record<string, any>) =>
      (doc.catalogs[0].entries[0].creature.traits = [{ name: "Long", text: "w".repeat(401) }]),
  ]) {
    assert.match(issueAt(377, fixture(edit)), gate);
  }
  // A trait of 400 letters, the old ceiling, still installs below 1.378.
  assert.doesNotMatch(
    issueAt(
      377,
      fixture((doc) => (doc.catalogs[0].entries[0].creature.traits = [{ name: "Long", text: "w".repeat(400) }])),
    ),
    gate,
  );
  // An item toggle's labels and an item use's title in a catalog file ask for 1.378 as well.
  const items = (item: Record<string, unknown>) =>
    new Map([["catalogs/items.json", { id: "items", entries: [{ id: "lantern", ...item }] }]]);
  assert.match(issueAt(377, fixture(), items({ toggle: { onLabel: "Raise the hood" } })), gate);
  assert.match(issueAt(377, fixture(), items({ use: { title: "Scatter ball bearings" } })), gate);
  assert.doesNotMatch(issueAt(378, fixture(), items({ use: { title: "Scatter ball bearings" } })), gate);

  console.log("Ruleset sheet words: labels, units, list display, hidden text, the picker, tracks, traits, the gate.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}
