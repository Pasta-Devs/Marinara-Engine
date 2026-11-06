/** Damage dealt and taken on attack hits (Capability API 1.133): 5e's Favor, Rage, Ray and Mark. */
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
  rulesetCombatOptions,
  rulesetItemEffectFacts,
  rulesetItemEffectText,
  rulesetSheetBuildSchema,
  renderRulesetSheetBlock,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatEvent,
  type RulesetCombatRoller,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetSheetItem,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-damage-modifiers-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 128);
  const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
  const fiveE = read("../../docs/development/ruleset-5e-2014.example.json");
  const modifiers: Record<string, any> = {
    favor: { to: "damage", attacks: "weapon", dice: "1d4", damageType: "radiant" },
    rage: { to: "damage", attacks: "weapon", blow: "melee", ability: "str", flat: 2 },
    ray: { to: "damage", attacks: "weapon", ability: "str", times: 0.5 },
    mark: { to: "damage-taken", attacks: "weapon", fromSource: true, dice: "1d6" },
    hex: { to: "damage-taken", fromSource: true, dice: "1d6", damageType: "necrotic" },
    curse: { to: "damage-taken", fromSource: true, dice: "1d8", damageType: "necrotic", alsoUnrolled: true },
  };
  const spell = (id: string, mechanics: Record<string, unknown>): RulesetCatalogEntry =>
    ({
      id,
      label: id,
      rows: [{ list: "spells", values: { name: id, level: 1, prepared: true } }],
      mechanics: { range: 60, ...mechanics },
    }) as RulesetCatalogEntry;
  const spells = [
    spell("bolt", { kind: "attack", attackRoll: true, amount: { flat: 8 }, damageType: "fire" }),
    spell("save", { kind: "attack", amount: { flat: 8 }, save: { save: "dex_save", onSuccess: "half" } }),
    spell("automatic", { kind: "attack", autoHit: true, amount: { flat: 8 } }),
    ...["mark", "hex", "curse"].map((id) =>
      spell(id, { kind: "debuff", autoHit: true, applies: [{ condition: id, duration: { rounds: 4 } }] }),
    ),
  ];
  const document = (edit: (doc: any) => void = () => {}) => {
    const doc = JSON.parse(fiveE);
    for (const [id, modifier] of Object.entries(modifiers)) {
      doc.sheet.live.conditions.push({ id, label: id });
      doc.combat.conditions.push({ condition: id, modifiers: [structuredClone(modifier)] });
    }
    doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: structuredClone(spells) });
    doc.items = { categories: [{ id: "gear", label: "Gear" }] };
    edit(doc);
    return doc;
  };
  const parse = (doc: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(doc);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const definition = parse(document());
  const build = rulesetSheetBuildSchema.parse({
    abilities: { str: 18, dex: 20, con: 10, int: 16, wis: 10, cha: 10 },
    fields: { level: 3, ac: 12, speed: 30, hp_max: 100, spellcasting_ability: "int" },
    lists: {
      attacks: [
        { name: "Sword", ability: "str", proficient: true, damage: "1d8", damage_type: "slashing", reach: 5 },
        { name: "Bow", ability: "str", proficient: true, damage: "1d8", damage_type: "piercing", range: 60 },
        { name: "Dex", ability: "dex", proficient: true, damage: "1d8", damage_type: "piercing" },
      ],
      spells: spells.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)),
    },
  });
  const fight = (condition?: string, rules = definition, items?: RulesetSheetItem[]) => {
    const state = createRulesetEncounter({
      definition: rules,
      seed: 1,
      roller: () => 10,
      combatants: [
        {
          id: "hero",
          name: "Hero",
          side: "party",
          build,
          live: { conditions: condition ? [condition] : [] },
          catalogs: { spells },
          items,
        },
        {
          id: "target",
          name: "Target",
          side: "enemy",
          block: {
            health: 100,
            defense: 12,
            initiativeModifier: 0,
            actions: [{ id: "bite", name: "Bite", budget: "action", toHit: 5, damage: { flat: 8 } }],
          },
        },
        {
          id: "third",
          name: "Third",
          side: "enemy",
          block: {
            health: 100,
            defense: 12,
            initiativeModifier: 0,
            actions: [{ id: "bite", name: "Bite", budget: "action", toHit: 5, damage: { flat: 8 } }],
          },
        },
      ],
    });
    state.turn = state.order.indexOf("hero");
    return state;
  };
  const who = (state: RulesetEncounterState, id = "hero") => rulesetCombatant(state, id)!;
  const dice = (...faces: number[]): RulesetCombatRoller => {
    let index = 0;
    return (sides) => {
      assert.ok(index < faces.length, `script exhausted at d${sides}`);
      const face = faces[index++]!;
      assert.ok(face >= 1 && face <= sides, `${face} is a d${sides} face`);
      return face;
    };
  };
  const use = (
    state: RulesetEncounterState,
    label: string,
    faces: number[],
    rules = definition,
    actorId = "hero",
    targetId = "target",
  ) => {
    state.turn = state.order.indexOf(actorId);
    who(state, actorId).budgets.action = 1;
    const option = rulesetCombatOptions(rules, state, actorId).find((one) => one.label === label);
    assert.ok(option, `no ${label}: ${rulesetCombatOptions(rules, state, actorId).map((one) => one.label)}`);
    const step = applyRulesetCombatChoice(
      rules,
      state,
      { actorId, optionId: option.id, targetIds: [targetId] },
      dice(...faces),
    );
    assert.deepEqual(
      step.events.filter((one) => one.type === "refused"),
      [],
      JSON.stringify(step.events),
    );
    return step;
  };
  const damage = (events: RulesetCombatEvent[]) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: "damage" }> => one.type === "damage");
  const dealt = (events: RulesetCombatEvent[]) => damage(events).reduce((total, one) => total + one.dealt, 0);
  const average = (state: RulesetEncounterState, label = "Sword", rules = definition) =>
    rulesetCombatOptions(rules, state, "hero").find((one) => one.label === label)?.forecast?.averageDamage;
  const marked = (condition = "mark") => use(fight(), condition, []).state;

  // Own conditions: hit, miss, spell/save/automatic exclusions, range and selected ability.
  assert.equal(dealt(use(fight(), "Sword", [10, 4]).events), 8);
  assert.equal(dealt(use(fight("favor"), "Sword", [10, 4, 3]).events), 11, "Divine Favor");
  assert.equal(dealt(use(fight("favor"), "Sword", [1]).events), 0, "a miss rolls no added dice");
  assert.equal(dealt(use(fight("favor"), "bolt", [10]).events), 8, "Favor excludes spell attacks");
  assert.equal(dealt(use(fight("rage"), "Sword", [10, 4]).events), 10, "Rage");
  // The example's range column is range_normal.
  const ranged = fight("rage");
  who(ranged).actions.find((one) => one.label === "Bow")!.range = { normal: 12 };
  delete who(ranged).actions.find((one) => one.label === "Bow")!.reach;
  assert.equal(dealt(use(ranged, "Bow", [10, 4]).events), 8, "Rage excludes ranged");
  assert.equal(dealt(use(fight("rage"), "Dex", [10, 4]).events), 9, "Rage excludes Dex");
  assert.equal(dealt(use(fight("ray"), "Sword", [10, 5]).events), 4, "Ray halves and rounds down");
  assert.equal(dealt(use(fight("ray"), "Dex", [10, 4]).events), 9, "Ray excludes Dex weapons");
  assert.equal(average(fight("favor")), 11, "menu includes Favor");
  assert.equal(average(fight("rage")), 10.5, "menu includes Rage");
  assert.equal(average(fight("ray")), 4.25, "menu includes Ray");
  const unrestricted = parse(
    document((doc) => {
      doc.combat.conditions.find((one: any) => one.condition === "favor").modifiers[0].attacks = "any";
    }),
  );
  assert.equal(
    dealt(use(fight("favor", unrestricted), "save", [1], unrestricted).events),
    8,
    "save damage gets no modifier",
  );
  assert.equal(
    dealt(use(fight("favor", unrestricted), "automatic", [], unrestricted).events),
    8,
    "automatic hits get no modifier",
  );
  assert.equal(average(fight("favor", unrestricted), "save", unrestricted), 8);

  // Target-bound sources come from a real applies, survive JSON, and never promise menu damage.
  const mark = JSON.parse(JSON.stringify(marked())) as RulesetEncounterState;
  assert.equal(who(mark, "target").tracked.find((one) => one.condition === "mark")?.source, "hero");
  assert.equal(dealt(use(mark, "Sword", [10, 4, 5]).events), 13, "Hunter's Mark");
  assert.equal(average(mark), 8.5, "menu omits target modifiers");
  assert.equal(dealt(use(marked(), "bolt", [10]).events), 8, "Mark excludes spells");
  const third = marked();
  who(third, "third").side = "party";
  assert.equal(dealt(use(third, "Bite", [10], definition, "third").events), 8, "third party cannot use mark");
  const sourceless = marked();
  delete who(sourceless, "target").tracked[0]!.source;
  assert.equal(dealt(use(sourceless, "Sword", [10, 4]).events), 8, "source is required");
  assert.equal(dealt(use(marked("hex"), "bolt", [10, 5]).events), 13, "Hex includes spell attacks");
  // With no attack roll too (1.471): Bestow Curse's "your attacks and spells".
  assert.equal(dealt(use(marked("hex"), "save", [1]).events), 8, "Hex excludes save spells");
  assert.equal(dealt(use(marked("curse"), "save", [1, 5]).events), 13, "a curse counts on a save spell");
  assert.equal(dealt(use(marked("curse"), "automatic", [5]).events), 13, "and on one that simply lands");
  assert.equal(dealt(use(marked("curse"), "Sword", [10, 4, 5]).events), 13, "and on attack hits");
  assert.equal(dealt(use(marked("curse"), "save", [20, 5]).events), 9, "saved: half the spell's, all the curse's");

  // Critical dice, separate damage types, same-type additions and multipliers before resistance.
  const critical = use(fight("favor"), "Sword", [20, 4, 4, 3, 3]);
  assert.equal(dealt(critical.events), 18, "critical doubles the extra d4");
  assert.deepEqual(damage(critical.events).at(-1)?.rolls, [3, 3]);
  const resist = fight("favor");
  who(resist, "target").block!.resist = ["radiant"];
  assert.equal(dealt(use(resist, "Sword", [10, 4, 3]).events), 9, "radiant resistance touches only added type");
  const rageResist = fight("rage");
  who(rageResist, "target").block!.resist = ["slashing"];
  assert.equal(dealt(use(rageResist, "Sword", [10, 5]).events), 5, "same-type flat joins hit before resistance");
  const rayResist = fight("ray");
  who(rayResist, "target").block!.resist = ["slashing"];
  assert.equal(dealt(use(rayResist, "Sword", [10, 5]).events), 2, "Ray stacks before resistance");
  const compound = fight("favor");
  who(compound).actions.find((one) => one.label === "Sword")!.damage!.plus = [
    { count: 0, sides: 0, flat: 3, type: "fire" },
  ];
  assert.equal(dealt(use(compound, "Sword", [10, 4, 3]).events), 14, "added once with two clauses");
  const compoundRay = fight("ray");
  who(compoundRay).actions.find((one) => one.label === "Sword")!.damage!.plus = [{ count: 0, sides: 0, flat: 3 }];
  assert.equal(dealt(use(compoundRay, "Sword", [10, 5]).events), 6, "times halves whole 12, not clauses separately");
  const doubled = parse(
    document((doc) => {
      doc.combat.conditions.find((one: any) => one.condition === "ray").modifiers[0].times = 2;
    }),
  );
  assert.equal(dealt(use(fight("ray", doubled), "Sword", [10, 4], doubled).events), 16, "times doubles");

  // Levels and both worn/carried items use the same sources. Finesse selects Dex's better bonus.
  const levelRules = parse(document((doc) => (doc.combat.levels[0].modifiers = [modifiers.favor])));
  const level = fight(undefined, levelRules);
  who(level).sheet!.live.tracks = { exhaustion: 1 };
  assert.equal(dealt(use(level, "Sword", [10, 4, 3], levelRules).events), 11, "level damage");
  for (const worn of [false, true]) {
    const item: RulesetSheetItem = {
      name: "Charm",
      quantity: 1,
      worn,
      item: { category: "gear", [worn ? "worn" : "carried"]: { modifiers: [modifiers.favor] } },
    };
    assert.equal(dealt(use(fight(undefined, definition, [item]), "Sword", [10, 4, 3]).events), 11, `item worn=${worn}`);
  }
  const weapon: RulesetSheetItem = {
    name: "Rapier",
    quantity: 1,
    worn: true,
    item: {
      category: "gear",
      attack: {
        budget: "action",
        toHit: { abilities: ["str", "dex"] },
        damage: { dice: "1d8", abilities: ["str", "dex"] },
      },
    },
  };
  const finesse = fight("ray", definition, [weapon]);
  assert.equal(who(finesse).actions.find((one) => one.label === "Rapier")?.ability, "dex");
  assert.equal(dealt(use(finesse, "Rapier", [10, 4]).events), 9, "finesse Dex escapes Ray");
  // Held, a weapon the sheet also lists is offered once, as the held one: its better of two abilities,
  // never the row's Strength beside it.
  const listedAndHeld = fight(undefined, definition, [{ ...weapon, name: "Sword" }]);
  const swords = who(listedAndHeld).actions.filter((one) => one.label === "Sword");
  assert.equal(swords.length, 1, "one Sword, not the row and the held one");
  assert.equal(swords[0]!.ability, "dex");
  assert.equal(
    dealt(use(fight("favor", definition, [weapon]), "Rapier", [10, 4, 3]).events),
    12,
    "item weapon qualifies for Favor",
  );
  const creature = fight();
  who(creature, "third").side = "party";
  who(creature, "third").tracked.push({ condition: "favor", rounds: null });
  assert.equal(
    dealt(use(creature, "Bite", [10, 3], definition, "third").events),
    11,
    "stat-block weapon qualifies for Favor",
  );
  const creatureRay = fight();
  who(creatureRay, "third").side = "party";
  who(creatureRay, "third").tracked.push({ condition: "ray", rounds: null });
  assert.equal(
    dealt(use(creatureRay, "Bite", [10], definition, "third").events),
    8,
    "stat-block action has no ability",
  );

  // No new keys is the old arithmetic, including two amounts and a critical.
  const legacy = parse(JSON.parse(fiveE));
  const unchanged = fight(undefined, legacy);
  who(unchanged).actions.find((one) => one.label === "Sword")!.damage!.plus = [{ count: 0, sides: 0, flat: 3 }];
  assert.equal(dealt(use(unchanged, "Sword", [20, 4, 4], legacy).events), 15);

  // Import rejects every narrowing key on all old targets, and unknown ability ids everywhere.
  for (const to of ["defense", "attacks", "saves", "checks", "speed", "health-max"]) {
    for (const [key, value] of Object.entries({
      attacks: "weapon",
      blow: "melee",
      ability: "str",
      damageType: "radiant",
      fromSource: true,
    })) {
      // Attacks are narrowed by ability since 1.188 (game-ruleset-combat-ability-narrowing).
      if (key === "ability" && to === "attacks") continue;
      // Attacks are narrowed by kind of attack and blow since 1.247 (game-ruleset-combat-reckless).
      if ((key === "attacks" || key === "blow") && to === "attacks") continue;
      // Defense is narrowed by blow since 1.509 (game-ruleset-combat-arrow-catching).
      if (key === "blow" && to === "defense") continue;
      const doc = document((one) => {
        one.combat.conditions.at(-1).modifiers = [
          { to, ...(to === "health-max" ? { times: 0.5 } : { flat: 2 }), [key]: value },
        ];
      });
      const result = parseRulesetDefinition(doc);
      assert.equal(result.ok, false, `${key} refused on ${to}`);
      if (!result.ok) assert.ok(result.issues.some((one) => one.includes(key)));
    }
  }
  for (const bad of [
    { to: "damage", fromSource: true, flat: 2 },
    { to: "damage", ability: "missing", flat: 2 },
    { to: "damage", times: 3 },
  ]) {
    assert.equal(
      parseRulesetDefinition(
        document((doc) => {
          doc.combat.conditions.at(-1).modifiers = [bad];
        }),
      ).ok,
      false,
    );
  }
  const editor = JSON.parse(read("../../docs/extending/ruleset.schema.json"));
  let nodes = 0;
  const walk = (node: any): void => {
    if (!node || typeof node !== "object") return;
    if (node.properties?.to && node.properties?.times && node.properties?.flat) {
      nodes++;
      assert.ok(node.properties.to.enum.includes("damage-taken"));
      assert.ok(node.properties.attacks.enum.includes("weapon"));
      assert.ok(
        node.allOf.some(
          (one: any) =>
            one.if?.required?.includes("fromSource") &&
            one.then.properties.to.enum.join() === "damage-taken,attacks-taken",
        ),
      );
    }
    Object.values(node).forEach(walk);
  };
  walk(editor);
  assert.ok(nodes > 0);

  // Human-readable own summaries keep the restrictions; the sheet prompt never promises a mark.
  const facts = rulesetItemEffectFacts(definition, { modifiers: [modifiers.rage, modifiers.ray, modifiers.mark] });
  assert.match(facts.map(rulesetItemEffectText).join("; "), /melee, using Strength/);
  assert.match(facts.map(rulesetItemEffectText).join("; "), /half damage dealt/);
  assert.match(facts.map(rulesetItemEffectText).join("; "), /from the condition's source only/);
  assert.match(
    renderRulesetSheetBlock(definition, { name: "Hero", build }, { conditions: ["rage"] }),
    /\+2 damage dealt/,
  );
  assert.doesNotMatch(renderRulesetSheetBlock(definition, { name: "Hero", build }, { conditions: ["mark"] }), /1d6/);

  // The projection consumed by both the battle UI and the boss prompt carries named source facts.
  const { directedRulesetView } =
    await import("../../packages/server/src/services/game/ruleset-combat-director.service.js");
  const projected = directedRulesetView(definition, {
    style: "ruleset",
    rulesetFight: { encounter: fight("rage"), controllers: {}, bosses: [], events: [], adjustments: [] },
  } as any)!;
  assert.match(JSON.stringify(projected.combatants.find((one) => one.id === "hero")?.damageModifiers), /Strength/);
  assert.match(JSON.stringify(projected.combatants.find((one) => one.id === "hero")?.damageModifiers), /melee/);
  const incoming = directedRulesetView(definition, {
    style: "ruleset",
    rulesetFight: { encounter: marked(), controllers: {}, bosses: [], events: [], adjustments: [] },
  } as any)!;
  assert.match(JSON.stringify(incoming.combatants.find((one) => one.id === "target")?.damageModifiers), /fromSource/);

  const manifest = (minor: number, schemaVersion = 2) => ({
    schemaVersion,
    capabilityApi: { major: 1, minor },
    builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
    id: "damage-modifiers",
    name: "Damage modifiers",
    version: "0.1.0",
    description: "Damage modifiers",
    engine: { min: "2.4.6", maxExclusive: "4.0.0" },
    kind: ["ruleset"],
    entrypoints: {},
    contributions: { assets: { paths: ["ruleset.json", "catalogs/items.json"] } },
    files: ["ruleset.json", "catalogs/items.json"].map((path) => ({ path, sha256: "0".repeat(64), bytes: 10 })),
    permissions: [],
    restartRequired: false,
  });
  const gate = "A ruleset whose modifiers change damage requires schemaVersion 2 and capabilityApi 1.133 or newer";
  for (const to of ["damage", "damage-taken"]) {
    for (const where of ["condition", "level", "worn", "carried", "otherwise"]) {
      for (const file of where === "condition" || where === "level" ? [false] : [false, true]) {
        const doc = JSON.parse(fiveE);
        const documents = new Map<string, unknown>();
        const modifier = { to, flat: 2 };
        if (where === "condition") doc.combat.conditions[0].modifiers = [modifier];
        else if (where === "level") doc.combat.levels[0].modifiers = [modifier];
        else {
          doc.items = { categories: [{ id: "gear", label: "Gear" }] };
          const effect = { modifiers: [modifier] };
          const item = {
            category: "gear",
            ...(where === "otherwise"
              ? { requires: [{ value: { abilityScore: "str" }, atLeast: 15, otherwise: effect }] }
              : { [where]: effect }),
          };
          const entries = [{ id: "charm", label: "Charm", item }];
          doc.catalogs.push({
            id: "items",
            label: "Items",
            holds: "items",
            ...(file ? { asset: "catalogs/items.json" } : { entries }),
          });
          if (file) documents.set("catalogs/items.json", { entries });
        }
        parse(doc);
        assert.equal(
          getCapabilityPackageInstallIssue(manifest(132) as any, doc, documents),
          gate,
          `${where} file=${file}`,
        );
        assert.equal(getCapabilityPackageInstallIssue(manifest(133) as any, doc, documents), null);
        assert.match(
          getCapabilityPackageInstallIssue(manifest(133, 1) as any, doc, documents) ?? "",
          /requires schemaVersion 2/,
        );
      }
    }
  }
  assert.equal(getCapabilityPackageInstallIssue(manifest(132) as any, JSON.parse(fiveE)), null);
  {
    const gate455 =
      "A ruleset whose damage changes count with no attack roll too (alsoUnrolled) requires schemaVersion 2 and capabilityApi 1.471 or newer";
    const doc = document();
    assert.equal(getCapabilityPackageInstallIssue(manifest(470) as any, doc), gate455);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(471) as any, doc), gate455);
  }
  console.info(
    "Damage modifiers: hit filters, source-bound marks, criticals, typed resistance, once per hit, forecasts, summaries and 1.133 gate.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
