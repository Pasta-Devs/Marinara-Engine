/** Typed hides from conditions, levels, sheet rows and items (Capability API 1.132).
 *  Real blows prove the sources and their exceptions; the sheet and battle projection tell the same story. */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyRulesetCombatChoice,
  createRulesetEncounter,
  parseRulesetDefinition,
  renderRulesetSheetBlock,
  rowsFromCatalogEntry,
  rulesetCheckSources,
  rulesetCombatant,
  rulesetCombatConditions,
  rulesetCombatHide,
  rulesetCombatOptions,
  rulesetHideLines,
  rulesetTagWords,
  rulesetItemFacts,
  rulesetItemPromptFacts,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetSheetItem,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-typed-hides-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");
const { directedRulesetView } =
  await import("../../packages/server/src/services/game/ruleset-combat-director.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 127);
  const original = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const hide = { type: "bludgeoning", except: ["magical"] };
  const armor: RulesetSheetItem = {
    name: "Armor of invulnerability",
    quantity: 1,
    worn: true,
    item: { category: "armor", worn: { resist: [hide] } },
  };
  const spells: RulesetCatalogEntry[] = ["brave", "frightened"].map(
    (condition) =>
      ({
        id: condition,
        label: condition,
        rows: [{ list: "spells", values: { name: condition, level: 0, prepared: true } }],
        mechanics: { kind: "buff", targets: "self", applies: [{ condition, duration: { rounds: 3 } }] },
      }) as RulesetCatalogEntry,
  );
  const document = (edit: (doc: Record<string, any>) => void = () => {}) => {
    const doc = JSON.parse(original);
    doc.items = {
      categories: [{ id: "armor", label: "Armor" }],
      tags: [
        { id: "magical", label: "Magical" },
        { id: "silvered", label: "Silvered" },
      ],
    };
    doc.sheet.lists.push({
      id: "traits",
      label: "Traits",
      section: "combat",
      maxItems: 20,
      columns: [
        { id: "name", label: "Name", type: "text", maxLength: 80 },
        { id: "resistance", label: "Resistance", type: "text", maxLength: 200 },
        { id: "immunity", label: "Immunity", type: "text", maxLength: 200 },
        { id: "vulnerability", label: "Vulnerability", type: "text", maxLength: 200 },
        { id: "conditions", label: "Condition immunities", type: "enum", values: ["frightened", "poisoned"] },
      ],
    });
    doc.sheet.live.conditions.push(
      { id: "stoneskin", label: "Stoneskin" },
      { id: "brave", label: "Brave" },
      { id: "energy", label: "Protection from Energy" },
    );
    doc.combat.conditions.push(
      { condition: "stoneskin", resist: [hide] },
      { condition: "brave", conditionImmunities: ["frightened"] },
      { condition: "energy", resist: ["fire"] },
    );
    doc.combat.levels.push({ derived: "proficiency_bonus", at: 3, resist: ["poison"] });
    doc.combat.sheetHides = [
      { list: "traits", column: "resistance", kind: "resist" },
      { list: "traits", column: "immunity", kind: "immune" },
      { list: "traits", column: "vulnerability", kind: "vulnerable" },
      { list: "traits", column: "conditions", kind: "conditionImmunities" },
    ];
    doc.catalogs.push({ id: "wards", label: "Wards", feeds: ["spells"], entries: spells });
    doc.catalogs.push({
      id: "armor",
      label: "Armor",
      holds: "items",
      entries: [{ id: "invulnerability", label: armor.name, item: armor.item }],
    });
    const copy = structuredClone(doc);
    edit(copy);
    return copy;
  };
  const parsed = (doc: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(doc);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const definition = parsed(document());
  const fight = (
    options: {
      conditions?: string[];
      rows?: Record<string, string>[];
      level?: number;
      items?: RulesetSheetItem[];
      plain?: boolean;
    } = {},
    rules = definition,
  ) => {
    const state = createRulesetEncounter({
      definition: rules,
      seed: 5,
      roller: () => 10,
      combatants: [
        {
          id: "club",
          name: "Club",
          side: "enemy",
          block: {
            health: 80,
            defense: 10,
            initiativeModifier: 10,
            actions: [
              ...["bludgeoning", "poison", "fire"].map((type) => ({
                id: type,
                name: type,
                budget: "action",
                toHit: 10,
                damage: { flat: 8, type },
              })),
              {
                id: "magical",
                name: "magical",
                budget: "action",
                toHit: 10,
                damage: { flat: 8, type: "bludgeoning", qualities: ["magical"] },
              },
            ],
          },
        },
        options.plain
          ? {
              id: "holder",
              name: "Holder",
              side: "enemy",
              block: { health: 80, defense: 10, initiativeModifier: 0, actions: [] },
            }
          : {
              id: "holder",
              name: "Holder",
              side: "party",
              build: rulesetSheetBuildSchema.parse({
                abilities: { str: 10, dex: 10, con: 10, int: 16, wis: 10, cha: 10 },
                fields: { level: options.level ?? 1, ac: 10, hp_max: 80, speed: 30, spellcasting_ability: "int" },
                lists: {
                  traits: options.rows ?? [],
                  spells: spells.flatMap((entry) => rowsFromCatalogEntry("wards", entry).map((row) => row.row)),
                },
              }),
              live: { conditions: options.conditions ?? [] },
              items: options.items,
              catalogs: { wards: spells },
            },
      ],
    });
    who(state).side = "party";
    if (options.plain)
      rulesetCombatant(state, "holder")!.tracked = (options.conditions ?? []).map((condition) => ({
        condition,
        rounds: null,
      }));
    return state;
  };
  const who = (state: RulesetEncounterState) => rulesetCombatant(state, "holder")!;
  const use = (state: RulesetEncounterState, actorId: string, label: string, rules = definition) => {
    state.turn = state.order.indexOf(actorId);
    rulesetCombatant(state, actorId)!.budgets.action = 1;
    const option = rulesetCombatOptions(rules, state, actorId).find((entry) => entry.label === label);
    assert.ok(option, `${actorId} can use ${label}`);
    const step = applyRulesetCombatChoice(
      rules,
      state,
      { actorId, optionId: option.id, targetIds: ["holder"] },
      () => 10,
    );
    assert.equal(
      step.events.some((event) => event.type === "refused"),
      false,
      JSON.stringify(step.events),
    );
    return step;
  };
  const harm = (state: RulesetEncounterState, kind = "bludgeoning", rules = definition) => {
    const step = use(state, "club", kind, rules);
    const damage = step.events.find((event) => event.type === "damage");
    assert.ok(damage, "the club lands");
    return damage.dealt;
  };

  // Stoneskin on a sheet AND a plain creature, and Protection from Energy.
  for (const plain of [false, true]) {
    assert.equal(harm(fight({ conditions: ["stoneskin"], plain })), 4);
    assert.equal(harm(fight({ conditions: ["stoneskin"], plain }), "magical"), 8);
    assert.equal(harm(fight({ conditions: ["energy"], plain }), "fire"), 4);
  }
  // Proficiency reaches 3 at character level 5; at level 4 it is still 2.
  assert.equal(harm(fight({ level: 4 }), "poison"), 8);
  assert.equal(harm(fight({ level: 5 }), "poison"), 4);
  const trackRules = parsed(
    document((doc) => {
      doc.combat.levels.find((entry: any) => entry.track === "exhaustion" && entry.at === 1).resist = ["poison"];
    }),
  );
  const tracked = fight({ plain: true }, trackRules);
  who(tracked).tracks = { exhaustion: 1 };
  assert.equal(harm(tracked, "poison", trackRules), 4);
  who(tracked).tracks.exhaustion = 0;
  assert.equal(harm(tracked, "poison", trackRules), 8);

  // Every typed field is carried by both condition and level mappings, including immunity exceptions.
  for (const place of ["conditions", "levels"] as const) {
    for (const [kind, expected] of [
      ["resist", 4],
      ["vulnerable", 16],
      ["immune", 0],
    ] as const) {
      const rules = parsed(
        document((doc) => {
          const effect = doc.combat[place].at(-1);
          delete effect.resist;
          effect[kind] = kind === "vulnerable" ? ["bludgeoning"] : [hide];
        }),
      );
      const options = place === "conditions" ? { conditions: ["energy"] } : { level: 5 };
      assert.equal(harm(fight(options, rules), "bludgeoning", rules), expected, `${place}/${kind}`);
      if (kind !== "vulnerable") assert.equal(harm(fight(options, rules), "magical", rules), 8);
    }
  }
  const allResistRules = parsed(
    document((doc) => {
      doc.combat.conditions.at(-1).effects = ["resist-all"];
    }),
  );
  assert.equal(
    harm(fight({ conditions: ["energy"], rows: [{ vulnerability: "fire" }] }, allResistRules), "fire", allResistRules),
    8,
  );

  const dwarf = fight({ rows: [{ name: "Dwarf", resistance: "  POISON , , unknown " }] });
  assert.equal(harm(dwarf, "poison"), 4);
  assert.equal(harm(dwarf, "fire"), 8);
  const rows = who(dwarf).sheet!.build.lists.traits!;
  rows.push({ name: "Fire ancestry", resistance: "fire" });
  assert.equal(harm(dwarf, "fire"), 4);
  assert.deepEqual(rulesetCombatHide(definition, who(dwarf)).resist, ["poison", "fire"]);
  rows.pop();
  assert.equal(harm(dwarf, "fire"), 8);
  rows.push({ resistance: "Bludgeoning EXCEPT Magical Silvered" });
  assert.equal(harm(dwarf), 4);
  assert.equal(harm(dwarf, "magical"), 8);
  assert.equal(harm(fight({ rows: [{ immunity: "bludgeoning except magical" }] })), 0);
  assert.equal(harm(fight({ rows: [{ immunity: "bludgeoning except magical" }] }), "magical"), 8);
  // Any run of spaces or tabs separates the words.
  assert.equal(harm(fight({ rows: [{ immunity: "bludgeoning\t except \tmagical" }] })), 0);
  assert.equal(harm(fight({ rows: [{ immunity: "bludgeoning\t except \tmagical" }] }), "magical"), 8);
  assert.equal(harm(fight({ rows: [{ resistance: `bludgeoning${"\t".repeat(3_900)}x` }] })), 8);
  assert.equal(harm(fight({ rows: [{ vulnerability: "fire" }] }), "fire"), 16);
  assert.equal(harm(fight({ rows: [{ resistance: "fire", vulnerability: "fire" }] }), "fire"), 8);
  assert.equal(harm(fight({ conditions: ["energy"], rows: [{ immunity: "fire", vulnerability: "fire" }] }), "fire"), 0);
  assert.equal(harm(fight({ items: [armor] })), 4);
  assert.equal(harm(fight({ items: [armor] }), "magical"), 8);
  assert.equal(harm(fight({ items: [{ ...armor, worn: false }] })), 8);
  assert.equal(
    harm(fight({ items: [{ ...armor, worn: false, item: { category: "armor", carried: { immune: [hide] } } }] })),
    0,
  );
  assert.equal(
    harm(
      fight({ items: [{ ...armor, worn: false, item: { category: "armor", carried: { immune: [hide] } } }] }),
      "magical",
    ),
    8,
  );

  // Gaining an immunity removes the existing condition, then prevents applying it again.
  let protectedState = use(fight({ conditions: ["frightened"] }), "holder", "brave");
  assert.ok(
    protectedState.events.some(
      (event) => event.type === "condition" && event.condition === "frightened" && event.reason === "immune",
    ),
  );
  assert.ok(!rulesetCombatConditions(definition, who(protectedState.state)).includes("frightened"));
  protectedState = use(protectedState.state, "holder", "frightened");
  assert.ok(protectedState.events.some((event) => event.type === "condition" && event.reason === "immune"));
  assert.ok(!rulesetCombatConditions(definition, who(protectedState.state)).includes("frightened"));
  const sheetWard = use(fight({ rows: [{ conditions: "FRIGHTENED" }] }), "holder", "frightened");
  assert.ok(!rulesetCombatConditions(definition, who(sheetWard.state)).includes("frightened"));
  const levelWardRules = parsed(
    document((doc) => {
      doc.combat.levels.at(-1).conditionImmunities = ["frightened"];
    }),
  );
  const levelWard = use(
    fight({ level: 5, conditions: ["frightened"] }, levelWardRules),
    "holder",
    "frightened",
    levelWardRules,
  );
  assert.ok(!rulesetCombatConditions(levelWardRules, who(levelWard.state)).includes("frightened"));

  // A track the creature is immune to contributes neither damage nor condition defenses.
  const immuneTrackRules = parsed(
    document((doc) => {
      doc.combat.levels[0].conditionImmunities = ["frightened"];
    }),
  );
  const immuneTrack = fight({ plain: true }, immuneTrackRules);
  who(immuneTrack).tracks = { exhaustion: 1 };
  who(immuneTrack).block!.conditionImmunities = ["exhaustion"];
  assert.ok(!rulesetCombatHide(immuneTrackRules, who(immuneTrack)).conditionImmunities.includes("frightened"));

  // Old definitions keep their plain damage and creature hides.
  const old = parsed(JSON.parse(original));
  assert.equal(harm(fight({ plain: true }, old), "bludgeoning", old), 8);
  const legacy = fight({ plain: true }, old);
  who(legacy).block!.resist = [hide];
  assert.equal(harm(legacy, "bludgeoning", old), 4);
  assert.equal(harm(legacy, "magical", old), 8);

  // The sheet, item detail, GM block and battle projection list the real sources and exceptions.
  const visible = fight({
    conditions: ["stoneskin", "brave"],
    level: 5,
    rows: [{ resistance: "fire" }],
    items: [armor],
  });
  const sheet = who(visible).sheet!;
  const lines = rulesetHideLines(definition, rulesetCheckSources(definition, sheet.build, sheet.live, sheet.items));
  for (const word of ["bludgeoning (not from magical)", "poison", "fire", "Frightened"])
    assert.ok(lines.join("; ").includes(word), word);
  const prompt = renderRulesetSheetBlock(
    definition,
    { name: "Holder", build: sheet.build },
    sheet.live,
    {},
    sheet.items,
  );
  for (const word of ["bludgeoning (not from magical)", "poison", "fire", "Frightened"])
    assert.ok(prompt.includes(word), word);
  assert.match(rulesetItemPromptFacts(rulesetItemFacts(definition, armor.item)), /bludgeoning except magical/);
  // Several tags read as words, by the ruleset's labels where it gives them (ship readiness 2026-10-25).
  assert.equal(rulesetTagWords(undefined, ["magic_weapon", "silvered"]), "magic weapon or silvered");
  assert.equal(rulesetTagWords(undefined, ["a", "b", "c"]), "a, b or c");
  const view = directedRulesetView(definition, {
    style: "ruleset",
    party: [],
    enemies: [],
    rulesetFight: { encounter: visible, events: [], eventSeq: 0, controllers: {}, adjustments: [], bosses: [] },
  } as any)!;
  assert.deepEqual(
    view.combatants.find((entry) => entry.id === "holder")!.hides,
    rulesetCombatHide(definition, who(visible), visible),
  );

  // Render the real sheet and battle status, so removing their defense lists is a regression too.
  const clientRequire = createRequire(new URL("../../packages/client/package.json", import.meta.url));
  const React = clientRequire("react");
  // The Node regression host compiles JSX in classic mode; the client uses the automatic runtime.
  Object.assign(globalThis, { React });
  const { createElement } = React;
  const { renderToStaticMarkup } = clientRequire("react-dom/server");
  const { I18nextProvider } = await import("../../packages/client/node_modules/react-i18next/dist/es/index.js");
  // The sheet loads the catalogs its rows point at (2026-10-24), so it renders under a query client.
  const { QueryClient, QueryClientProvider } =
    await import("../../packages/client/node_modules/@tanstack/react-query/build/modern/index.js");
  const queryClient = new QueryClient();
  const i18n = clientRequire("i18next").createInstance();
  await i18n.init({
    lng: "en",
    resources: {
      en: {
        translation: JSON.parse(
          readFileSync(new URL("../../packages/client/src/localization/locales/en.json", import.meta.url), "utf8"),
        ),
      },
    },
  });
  const { GameRulesetSheet } = await import("../../packages/client/src/components/game/GameRulesetSheet.js");
  const { RulesetCombatStatus } = await import("../../packages/client/src/components/game/RulesetCombatStatus.js");
  for (const component of [
    createElement(GameRulesetSheet, {
      definition,
      cardName: "Holder",
      envelope: { build: sheet.build },
      live: sheet.live,
      items: sheet.items,
      readOnly: true,
    }),
    createElement(RulesetCombatStatus, { definition, view }),
  ]) {
    const html = renderToStaticMarkup(
      createElement(QueryClientProvider, { client: queryClient }, createElement(I18nextProvider, { i18n }, component)),
    );
    for (const word of ["bludgeoning (not from magical)", "Resists:", "Condition immunities: Frightened"])
      assert.ok(html.includes(word), `rendered defenses include ${word}`);
  }

  // A list longer than a short sheet value must not lose its last defense in the prompt.
  const longRules = parsed(
    document((doc) => {
      delete doc.combat.damageTypes;
    }),
  );
  const longBuild = structuredClone(sheet.build);
  longBuild.lists.traits = [
    { resistance: Array.from({ length: 12 }, (_, index) => `damage-word-${index}`).join(", ") },
  ];
  assert.match(renderRulesetSheetBlock(longRules, { name: "Holder", build: longBuild }, {}), /damage-word-11/);
  assert.deepEqual(rulesetItemFacts(definition, armor.item).worn[0]!.except, [["magical"]]);

  const refused = (edit: (doc: Record<string, any>) => void, pattern: RegExp) => {
    const result = parseRulesetDefinition(document(edit));
    assert.equal(result.ok, false, "invalid definitions are refused");
    if (!result.ok) assert.match(result.issues.join("; "), pattern);
  };
  refused((doc) => {
    doc.combat.sheetHides[0].list = "missing";
  }, /Unknown list/);
  refused((doc) => {
    doc.combat.sheetHides[0].column = "missing";
  }, /text or enum column/);
  refused((doc) => {
    doc.combat.sheetHides[0] = { list: "spells", column: "level", kind: "resist" };
  }, /text or enum column/);
  refused((doc) => {
    doc.sheet.lists.at(-1).columns.at(-1).values = ["not-a-condition"];
  }, /Unknown condition/);
  for (const place of ["conditions", "levels", "items"]) {
    for (const kind of ["resist", "immune", "vulnerable", "conditionImmunities"]) {
      refused((doc) => {
        const effect = place === "items" ? doc.catalogs.at(-1).entries[0].item.worn : doc.combat[place].at(-1);
        effect[kind] = ["unknown"];
      }, /Unknown (damage type|condition)/);
    }
    refused((doc) => {
      const effect = place === "items" ? doc.catalogs.at(-1).entries[0].item.worn : doc.combat[place].at(-1);
      effect.resist = [{ type: "fire", except: ["unknown"] }];
    }, /Unknown item tag/);
  }
  refused((doc) => {
    doc.combat.conditions.at(-1).resist = [];
  }, /resist: Too small: expected array to have >=1 items/);
  refused((doc) => {
    doc.combat.levels.at(-1).immune = Array(31).fill("fire");
  }, /immune: Too big: expected array to have <=30 items/);
  refused((doc) => {
    doc.combat.sheetHides = Array(9).fill(doc.combat.sheetHides[0]);
  }, /sheetHides: Too big: expected array to have <=8 items/);
  parsed(
    document((doc) => {
      delete doc.combat.damageTypes;
      doc.combat.conditions.at(-1).resist = ["free-word"];
    }),
  );
  parsed(
    document((doc) => {
      doc.combat.sheetHides = [];
    }),
  );

  const manifest = (minor: number) => ({
    schemaVersion: 2,
    capabilityApi: { major: 1, minor },
    builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
    id: "ruleset-typed-hides",
    name: "Typed hides",
    version: "0.1.0",
    description: "Typed defenses.",
    engine: { min: "2.4.6", maxExclusive: "4.0.0" },
    kind: ["ruleset"],
    entrypoints: {},
    contributions: { assets: { paths: ["ruleset.json", "catalogs/armor.json"] } },
    files: ["ruleset.json", "catalogs/armor.json"].map((path) => ({ path, sha256: "0".repeat(64), bytes: 10 })),
    permissions: [],
    restartRequired: false,
  });
  const gate =
    "A ruleset whose conditions, levels, sheet or items with exceptions keep harm off requires schemaVersion 2 and capabilityApi 1.132 or newer";
  for (const place of ["conditions", "levels", "sheetHides", "worn", "carried"]) {
    for (const kind of place === "conditions" || place === "levels"
      ? ["resist", "immune", "vulnerable", "conditionImmunities"]
      : ["resist", "immune"]) {
      for (const file of place === "worn" || place === "carried" ? [false, true] : [false]) {
        const doc = JSON.parse(original);
        if (place === "conditions" || place === "levels")
          doc.combat[place][0][kind] = [kind === "conditionImmunities" ? "frightened" : "fire"];
        else if (place === "sheetHides") doc.combat.sheetHides = [];
        else {
          doc.items = document().items;
          doc.catalogs.push({
            id: "armor",
            label: "Armor",
            holds: "items",
            entries: [{ id: "ward", label: "Ward", item: { category: "armor", [place]: { [kind]: [hide] } } }],
          });
        }
        parsed(doc);
        const documents = new Map<string, unknown>();
        if (file) {
          const catalog = doc.catalogs.at(-1);
          documents.set("catalogs/armor.json", { entries: catalog.entries });
          delete catalog.entries;
          catalog.asset = "catalogs/armor.json";
        }
        assert.equal(
          getCapabilityPackageInstallIssue(manifest(131) as any, doc, documents),
          gate,
          `${place}/${kind}/${file}`,
        );
        assert.equal(getCapabilityPackageInstallIssue(manifest(132) as any, doc, documents), null);
      }
    }
  }
  assert.equal(getCapabilityPackageInstallIssue(manifest(131) as any, JSON.parse(original)), null);
  const oldItem = document((doc) => {
    delete doc.combat.sheetHides;
    for (const place of ["conditions", "levels"])
      for (const effect of doc.combat[place])
        for (const kind of ["resist", "immune", "vulnerable", "conditionImmunities"]) delete effect[kind];
    doc.catalogs.at(-1).entries[0].item.worn.resist = ["fire"];
  });
  assert.equal(
    getCapabilityPackageInstallIssue(manifest(131) as any, oldItem),
    null,
    "plain item words stay at their old minor",
  );
  console.info("Typed hides: all sources, exceptions, immunity endings, lists, imports and the 1.132 gate passed.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
