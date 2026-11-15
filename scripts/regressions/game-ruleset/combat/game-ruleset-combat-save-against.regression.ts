/** Save modifiers against conditions, damage or magic (Capability API 1.134). */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  advanceRulesetTurn,
  applyRulesetCombatChoice,
  createRulesetEncounter,
  parseRulesetDefinition,
  renderRulesetSheetBlock,
  rowsFromCatalogEntry,
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetCheckEffects,
  rulesetCheckSources,
  rulesetItemEffectFacts,
  rulesetItemEffectText,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-save-against-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 129);
  const original = JSON.parse(
    readFileSync(new URL("../../../../docs/development/ruleset-5e-2014.example.json", import.meta.url), "utf8"),
  );
  const dwarf = { to: "saves", mode: "advantage", against: { conditions: ["poisoned"], damage: ["poison"] } };
  const fey = { to: "saves", mode: "advantage", against: { conditions: ["charmed"] } };
  const gnome = {
    to: "saves",
    mode: "advantage",
    saves: ["int_save", "wis_save", "cha_save"],
    against: { magic: true },
  };
  const document = (modifier: any = dwarf) => {
    const doc = structuredClone(original);
    doc.sheet.derived.push({ id: "ancestry", label: "Ancestry", op: "sum", of: [{ field: "level" }] });
    doc.combat.levels.push({ derived: "ancestry", at: 1, modifiers: [structuredClone(modifier)] });
    return doc;
  };
  const parse = (doc: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(doc);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const build = rulesetSheetBuildSchema.parse({
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    fields: { level: 1, ac: 12, hp_max: 80, speed: 30 },
  });
  const block: RulesetStatBlock = { health: 80, defense: 12, initiativeModifier: 0, actions: [] };
  const action = (damage = "poison", save = "con_save"): RulesetStatBlock["actions"][number] => ({
    id: "breath",
    name: "Breath",
    budget: "action",
    damage: { flat: 4, type: damage },
    save: { save, difficulty: 15, onSuccess: "half" },
  });
  const fight = (rules: RulesetDefinition, blow = action(), items?: any[]) => {
    const state = createRulesetEncounter({
      definition: rules,
      seed: 1,
      roller: () => 10,
      combatants: [
        { id: "hero", name: "Hero", side: "party", build, live: {}, ...(items ? { items } : {}) },
        { id: "foe", name: "Foe", side: "enemy", block: { ...block, actions: [blow] } },
      ],
    });
    state.turn = state.order.indexOf("foe");
    return state;
  };
  const saves = (events: RulesetCombatEvent[]) => events.filter((event) => event.type === "save");
  const use = (rules: RulesetDefinition, state: RulesetEncounterState, actorId = "foe", label = "Breath") => {
    const option = rulesetCombatOptions(rules, state, actorId).find((one) => one.label === label);
    assert.ok(option, `missing ${label}`);
    const result = applyRulesetCombatChoice(
      rules,
      state,
      { actorId, optionId: option.id, targetIds: ["hero"] },
      (sides) => Math.min(5, sides),
    );
    assert.equal(
      result.events.some((event) => event.type === "refused"),
      false,
      JSON.stringify(result.events),
    );
    return result;
  };
  const mode = (rules: RulesetDefinition, blow: RulesetStatBlock["actions"][number], expected: string) => {
    const rolled = saves(use(rules, fight(rules, blow)).events)[0];
    assert.ok(rolled);
    assert.equal(rolled.mode ?? "normal", expected);
    assert.equal(rolled.rolls.length, expected === "normal" ? 1 : 2);
    return rolled;
  };
  const dwarven = parse(document());
  mode(dwarven, action(), "advantage");
  mode(dwarven, action("fire"), "normal");
  mode(dwarven, { ...action("piercing"), applies: [{ condition: "poisoned", duration: { rounds: 1 } }] }, "advantage");
  mode(
    dwarven,
    { ...action("fire"), damage: { flat: 4, type: "fire", plus: [{ flat: 2, type: "Poison" }] } },
    "advantage",
  );
  const clause = {
    ...action("fire"),
    damage: {
      flat: 4,
      type: "fire",
      plus: [{ flat: 2, type: "poison", save: { save: "con_save", difficulty: 15, onSuccess: "half" as const } }],
    },
  };
  assert.deepEqual(
    saves(use(dwarven, fight(dwarven, clause)).events).map((save) => save.mode),
    ["advantage", "advantage"],
  );

  // A condition the action would apply counts even when a successful save prevents it.
  const charm = (condition = "charmed"): RulesetStatBlock["actions"][number] => ({
    id: "breath",
    name: "Breath",
    budget: "action",
    save: { save: "wis_save", difficulty: 15, onSuccess: "negates" },
    applies: [{ condition, duration: "until-save", saveEnds: { save: "wis_save", at: "turn-end" } }],
  });
  const ancestry = parse(document(fey));
  mode(ancestry, charm(), "advantage");
  mode(ancestry, charm("frightened"), "normal");
  for (const at of ["turn-start", "turn-end", "damaged"] as const) {
    for (const repeat of at === "turn-end" ? [false, true] : [false]) {
      const doc = document(fey);
      if (repeat) doc.combat.conditions.find((one: any) => one.condition === "charmed").saveWhenDamaged = true;
      const rules = parse(doc);
      const blow = charm();
      blow.applies![0]!.saveEnds!.at = at;
      const state = use(rules, fight(rules, blow)).state;
      let events: RulesetCombatEvent[];
      if (at === "damaged" || repeat) {
        const foe = rulesetCombatant(state, "foe")!;
        foe.budgets.action = 1;
        foe.actions[0] = { ...foe.actions[0]!, applies: [], save: undefined, damage: { count: 0, sides: 0, flat: 4 } };
        events = use(rules, state).events;
      } else {
        state.turn = state.order.indexOf(at === "turn-start" ? "foe" : "hero");
        events = advanceRulesetTurn(rules, state, () => 5).events;
      }
      assert.equal(saves(events)[0]?.mode, "advantage", `end charm: ${at}, repeat=${repeat}`);
    }
  }

  // Magical creature damage and catalog spells use the same 1.101 quality. A debuff needs no damage.
  const cunning = parse(document(gnome));
  mode(
    cunning,
    { ...action("fire", "wis_save"), damage: { flat: 4, type: "fire", qualities: ["magical"] } },
    "advantage",
  );
  mode(cunning, action("poison", "wis_save"), "normal");
  mode(cunning, { ...action("fire", "dex_save"), damage: { flat: 4, qualities: ["magical"] } }, "normal");
  for (const magical of [true, false]) {
    const doc = document(gnome);
    doc.items = { categories: [{ id: "gear", label: "Gear" }], tags: [{ id: "magical", label: "Magical" }] };
    const spell = {
      id: "charm",
      label: "Charm",
      rows: [{ list: "spells", values: { name: "Charm", level: 0, prepared: true } }],
      mechanics: {
        kind: "debuff",
        ...(magical ? { qualities: ["magical"] } : {}),
        save: { save: "wis_save", onSuccess: "negates" },
        applies: [{ condition: "charmed", duration: { rounds: 1 } }],
      },
    };
    doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: [spell] });
    const rules = parse(doc);
    const entries = rules.catalogs!.at(-1)!.entries!;
    const state = createRulesetEncounter({
      definition: rules,
      seed: 1,
      roller: () => 10,
      combatants: [
        { id: "hero", name: "Hero", side: "party", build, live: {} },
        {
          id: "foe",
          name: "Caster",
          side: "party",
          build: {
            ...build,
            lists: { spells: rowsFromCatalogEntry("spells", spell as RulesetCatalogEntry).map((row) => row.row) },
          },
          live: {},
          catalogs: { spells: entries },
        },
      ],
    });
    rulesetCombatant(state, "foe")!.side = "enemy";
    state.turn = state.order.indexOf("foe");
    assert.equal(
      saves(use(rules, state, "foe", "Charm").events)[0]?.mode ?? "normal",
      magical ? "advantage" : "normal",
    );
  }
  const narrowed = parse(document({ ...dwarf, saves: ["con_save"] }));
  mode(narrowed, action("poison", "wis_save"), "normal");
  mode(narrowed, action("fire", "con_save"), "normal");
  mode(narrowed, action(), "advantage");
  const legacy = parse(document({ to: "saves", mode: "advantage" }));
  mode(legacy, action("fire"), "advantage");

  // The better face really prevents the condition; the applies still supplied its context.
  {
    const state = fight(ancestry, charm());
    const option = rulesetCombatOptions(ancestry, state, "foe").find((one) => one.label === "Breath")!;
    const faces = [2, 20];
    const step = applyRulesetCombatChoice(
      ancestry,
      state,
      { actorId: "foe", optionId: option.id, targetIds: ["hero"] },
      () => faces.shift()!,
    );
    assert.equal(saves(step.events)[0]?.success, true);
    assert.equal(rulesetCombatant(step.state, "hero")!.tracked.length, 0);
  }
  // Magic Resistance uses the same modifier on a creature sheet, with no special trait parser.
  {
    const rules = parse(document({ to: "saves", mode: "advantage", against: { magic: true } }));
    const state = createRulesetEncounter({
      definition: rules,
      seed: 1,
      roller: () => 10,
      combatants: [
        { id: "hero", name: "Resistant creature", side: "enemy", block: { sheet: build, actions: [] } },
        {
          id: "foe",
          name: "Caster",
          side: "enemy",
          block: {
            ...block,
            actions: [{ ...action("fire", "dex_save"), damage: { flat: 4, qualities: ["magical"] } }],
          },
        },
      ],
    });
    rulesetCombatant(state, "foe")!.side = "party";
    state.turn = state.order.indexOf("foe");
    assert.equal(saves(use(rules, state).events)[0]?.mode, "advantage");
  }

  // Numeric and dice changes share the same filter; unrelated rolls never get either part.
  const numbers = parse(document({ to: "saves", flat: 3, dice: "1d4", against: dwarf.against }));
  const hit = (rules: RulesetDefinition, type: string) => saves(use(rules, fight(rules, action(type))).events)[0]!;
  assert.equal(hit(numbers, "poison").total, 12);
  assert.equal(hit(numbers, "fire").total, 5);
  const concentrating = fight(dwarven);
  rulesetCombatant(concentrating, "hero")!.concentrating = { actionId: "spell", label: "Spell" };
  assert.deepEqual(
    saves(use(dwarven, concentrating).events).map((save) => save.mode ?? "normal"),
    ["advantage", "normal"],
  );
  assert.deepEqual(
    rulesetCheckEffects(rulesetCheckSources(dwarven, build, {}), {
      type: "save",
      id: "con_save",
      label: "Constitution",
    }).advantage,
    [],
  );

  // Dying uses its own dice and never consults save-against modifiers.
  {
    const state = fight(dwarven);
    const hero = rulesetCombatant(state, "hero")!;
    state.combatants.push({ ...structuredClone(hero), id: "ally" });
    state.order.push("ally");
    state.turn = (state.order.indexOf("hero") + state.order.length - 1) % state.order.length;
    hero.dying = true;
    hero.down = true;
    hero.sheet!.live = { pools: { hp: { value: 0 } } } as any;
    const step = advanceRulesetTurn(dwarven, state, () => 5);
    const event = step.events.find((one) => one.type === "dying");
    assert.ok(event);
    assert.equal(event.rolls.length, 1);
  }

  // Conditions, derived levels, item worn/carried effects and requirement penalties all use it.
  for (const source of ["condition", "worn", "carried", "otherwise"] as const) {
    const doc = structuredClone(original);
    let items: any[] | undefined;
    if (source === "condition")
      doc.combat.conditions.find((one: any) => one.condition === "charmed").modifiers = [dwarf];
    else {
      doc.items = { categories: [{ id: "gear", label: "Gear" }] };
      const item = {
        category: "gear",
        ...(source === "otherwise"
          ? { requires: [{ value: { abilityScore: "str" }, atLeast: 20, otherwise: { modifiers: [dwarf] } }] }
          : { [source]: { modifiers: [dwarf] } }),
      };
      doc.catalogs.push({
        id: "gear",
        label: "Gear",
        holds: "items",
        entries: [{ id: "charm", label: "Charm", item }],
      });
      items = [{ item, quantity: 1, name: "Charm", worn: source !== "carried" }];
    }
    const rules = parse(doc);
    const state = fight(rules, action(), items);
    if (source === "condition") rulesetCombatant(state, "hero")!.sheet!.live = { conditions: ["charmed"] };
    assert.equal(saves(use(rules, state).events)[0]?.mode, "advantage", source);
  }
  // The battle projection carries the same readable facts for sheet-derived levels.
  {
    const { directedRulesetView } =
      await import("../../../../packages/server/src/services/game/ruleset-combat-director.service.js");
    const projected = directedRulesetView(dwarven, {
      style: "ruleset",
      gm: false,
      rulesetFight: {
        encounter: fight(dwarven),
        controllers: {},
        bosses: [],
        adjustments: [],
        events: [],
        eventSeq: 0,
      },
    } as any);
    const facts = projected?.combatants.find((one) => one.id === "hero")?.saveModifiers;
    assert.ok(facts?.length);
    assert.match(facts.map(rulesetItemEffectText).join("; "), /against Poisoned or poison/);
  }
  const summary = renderRulesetSheetBlock(dwarven, { name: "Dwarf", build }, {});
  assert.match(summary, /advantage on saves against Poisoned or poison/);
  const fact = rulesetItemEffectFacts(ancestry, { modifiers: ancestry.combat!.levels!.at(-1)!.modifiers })[0]!;
  assert.equal(rulesetItemEffectText(fact), "advantage on saves against Charmed");

  // Import rejects misplaced, empty and unknown restrictions, in every modifier home.
  for (const [change, pattern] of [
    [{ ...dwarf, to: "checks" }, /against/],
    [{ ...dwarf, against: {} }, /Against/],
    [{ ...dwarf, against: { conditions: ["unknown"] } }, /Unknown condition/],
    [{ ...dwarf, against: { damage: ["unknown"] } }, /Unknown damage type/],
    [{ ...dwarf, against: { conditions: [] } }, /conditions/],
    [{ ...dwarf, against: { magic: false } }, /magic/],
  ] as const) {
    const result = parseRulesetDefinition(document(change));
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.issues.join("; "), pattern);
  }
  const manifest = (minor: number, schemaVersion = 2) => ({
    schemaVersion,
    capabilityApi: { major: 1, minor },
    builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
    id: "ruleset-save-against",
    name: "Save against",
    version: "0.1.0",
    description: "Saves against effects.",
    engine: { min: "2.4.6", maxExclusive: "4.0.0" },
    kind: ["ruleset"],
    entrypoints: {},
    contributions: { assets: { paths: ["ruleset.json", "catalogs/gear.json"] } },
    files: ["ruleset.json", "catalogs/gear.json"].map((path) => ({ path, sha256: "0".repeat(64), bytes: 10 })),
    permissions: [],
    restartRequired: false,
  });
  for (const source of ["level", "condition", "worn", "carried", "otherwise"] as const) {
    for (const external of source === "level" || source === "condition" ? [false] : [false, true]) {
      const doc = source === "level" ? document() : structuredClone(original);
      const documents = new Map<string, unknown>();
      if (source === "condition") doc.combat.conditions[0].modifiers = [dwarf];
      else if (source !== "level") {
        doc.items = { categories: [{ id: "gear", label: "Gear" }] };
        const item = {
          category: "gear",
          ...(source === "otherwise"
            ? { requires: [{ value: { abilityScore: "str" }, atLeast: 20, otherwise: { modifiers: [dwarf] } }] }
            : { [source]: { modifiers: [dwarf] } }),
        };
        const entries = [{ id: "charm", label: "Charm", item }];
        doc.catalogs.push({
          id: "gear",
          label: "Gear",
          holds: "items",
          ...(external ? { asset: "catalogs/gear.json" } : { entries }),
        });
        if (external) documents.set("catalogs/gear.json", { entries });
      }
      parse(doc);
      assert.equal(
        getCapabilityPackageInstallIssue(manifest(133) as any, doc, documents),
        "A ruleset whose save modifiers count against conditions, damage or magic requires schemaVersion 2 and capabilityApi 1.134 or newer",
        `${source}, external=${external}`,
      );
      assert.equal(getCapabilityPackageInstallIssue(manifest(134) as any, doc, documents), null);
      assert.match(
        getCapabilityPackageInstallIssue(manifest(134, 1) as any, doc, documents) ?? "",
        /requires schemaVersion 2/,
      );
    }
  }
  assert.equal(getCapabilityPackageInstallIssue(manifest(133) as any, original), null);
  const editor = JSON.parse(readFileSync(new URL("../../../../docs/extending/ruleset.schema.json", import.meta.url), "utf8"));
  let modifiers = 0;
  const walk = (node: any) => {
    if (!node || typeof node !== "object") return;
    if (node.properties?.to && node.properties?.mode && node.properties?.flat) {
      modifiers++;
      assert.ok(node.properties.against);
      assert.deepEqual(node.properties.against.allOf, [
        { anyOf: ["conditions", "damage", "magic"].map((key) => ({ required: [key] })) },
      ]);
    }
    Object.values(node).forEach(walk);
  };
  walk(editor);
  assert.ok(modifiers >= 3);
  console.info(
    "Save against: conditions, all damage clauses, magical qualities, AND scope, ending saves, sources, summaries and 1.134 gate.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
