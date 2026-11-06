/** Creature types and target tests (Capability API 1.168): a slayer's extra dice against dragons,
 *  holy water's harm to fiends and undead, Animal Friendship's beasts only and Sleep's pass over the
 *  undead, with a character's type read off a field or the ruleset's default. */
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
  rulesetCombatOptions,
  rulesetCreatureKind,
  rulesetOptionTargets,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-creature-types-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 163);
  const fiveE = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const spell = (id: string, mechanics: Record<string, unknown>): RulesetCatalogEntry =>
    ({
      id,
      label: id,
      rows: [{ list: "spells", values: { name: id, level: 1, prepared: true } }],
      mechanics: { range: 60, ...mechanics },
    }) as RulesetCatalogEntry;
  const spells = [
    // Holy water, as a catalog entry: radiant only to a fiend or an undead.
    spell("holy", {
      kind: "attack",
      autoHit: true,
      amount: { flat: 1 },
      damageType: "bludgeoning",
      plus: [{ flat: 7, type: "radiant", targetIs: { types: ["fiend", "undead"] } }],
    }),
    spell("friend", {
      kind: "debuff",
      autoHit: true,
      targetTypes: { is: { types: ["beast"] } },
      applies: [{ condition: "charmed_beast", duration: { rounds: 10 } }],
    }),
    spell("sleep", {
      kind: "debuff",
      autoHit: true,
      targetCount: 3,
      targetTypes: { not: { types: ["undead"] } },
      applies: [{ condition: "asleep", duration: { rounds: 10 } }],
    }),
    // A curse that marks a devil and nothing else, though anyone may be its target.
    spell("brand", {
      kind: "debuff",
      autoHit: true,
      applies: [
        { condition: "branded", duration: { rounds: 2 }, targetIs: { tags: ["devil"] } },
        { condition: "asleep", duration: { rounds: 1 } },
      ],
    }),
  ];
  const document = (edit: (doc: any) => void = () => {}) => {
    const doc = JSON.parse(fiveE);
    doc.combat.creatureTypes = {
      types: ["beast", "dragon", "fiend", "humanoid", "undead"].map((id) => ({
        id,
        label: id[0]!.toUpperCase() + id.slice(1),
      })),
      tags: [{ id: "devil", label: "devil" }],
      field: "race",
      default: "humanoid",
    };
    for (const id of ["charmed_beast", "asleep", "branded"]) doc.sheet.live.conditions.push({ id, label: id });
    doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: structuredClone(spells) });
    edit(doc);
    return doc;
  };
  const parse = (doc: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(doc);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const definition = parse(document());
  const build = (race = "Human") =>
    rulesetSheetBuildSchema.parse({
      abilities: { str: 18, dex: 30, con: 10, int: 16, wis: 10, cha: 10 },
      fields: { level: 3, ac: 12, speed: 30, hp_max: 100, spellcasting_ability: "int", race },
      lists: {
        attacks: [
          { name: "Sword", ability: "str", proficient: true, damage: "1d8", damage_type: "slashing", reach: 5 },
        ],
        spells: spells.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)),
      },
    });
  // A slayer's bite: 3d6 more against a dragon, as a creature block carries it.
  const bite = {
    id: "bite",
    name: "Bite",
    budget: "action",
    toHit: 30,
    damage: {
      count: 0,
      sides: 0,
      flat: 4,
      type: "piercing",
      plus: [{ count: 3, sides: 6, flat: 0, type: "piercing", targetIs: { types: ["dragon"] } }],
    },
  };
  const creature = (id: string, type?: string, tags?: string[]) => ({
    id,
    name: id,
    side: "enemy" as const,
    block: {
      health: 100,
      defense: 5,
      initiativeModifier: -20,
      ...(type ? { type } : {}),
      ...(tags ? { tags } : {}),
      actions: [{ id: "claw", name: "Claw", budget: "action", toHit: 0, damage: { flat: 1 } }],
    },
  });
  const fight = (race = "Human") => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        { id: "hero", name: "Hero", side: "party", build: build(race), live: {}, catalogs: { spells } },
        {
          id: "slayer",
          name: "Slayer",
          side: "enemy",
          block: { health: 50, defense: 10, initiativeModifier: -30, actions: [bite] },
        },
        creature("wolf", "beast"),
        creature("wyrm", "dragon"),
        creature("imp", "fiend", ["devil"]),
        creature("ghoul", "undead"),
        creature("blob"),
      ],
    });
    state.turn = state.order.indexOf("hero");
    return state;
  };
  const who = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)!;
  const optionOf = (state: RulesetEncounterState, actorId: string, label: string) => {
    state.turn = state.order.indexOf(actorId);
    const option = rulesetCombatOptions(definition, state, actorId).find((one) => one.label === label);
    assert.ok(option, `no ${label}`);
    return option;
  };
  const use = (state: RulesetEncounterState, label: string, targetIds: string[], actorId = "hero") => {
    state.turn = state.order.indexOf(actorId);
    who(state, actorId).budgets.action = 1;
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId, optionId: optionOf(state, actorId, label).id, targetIds },
      (sides) => Math.min(sides, 4),
    );
    return step;
  };
  const dealt = (events: RulesetCombatEvent[], targetId: string) =>
    events
      .filter((one): one is Extract<RulesetCombatEvent, { type: "damage" }> => one.type === "damage")
      .filter((one) => one.targetId === targetId)
      .reduce((total, one) => total + one.dealt, 0);
  const has = (state: RulesetEncounterState, id: string, condition: string) =>
    rulesetCombatConditions(definition, who(state, id)).includes(condition);

  // What each one is.
  {
    const state = fight();
    assert.deepEqual(rulesetCreatureKind(definition, who(state, "imp")), { type: "fiend", tags: ["devil"] });
    assert.deepEqual(
      rulesetCreatureKind(definition, who(state, "blob")),
      { tags: [] },
      "a creature naming none is none",
    );
    assert.deepEqual(
      rulesetCreatureKind(definition, who(state, "hero")),
      { type: "humanoid", tags: [] },
      "the default",
    );
    assert.deepEqual(
      rulesetCreatureKind(definition, who(fight("undead"), "hero")),
      { type: "undead", tags: [] },
      "a character's field naming a type",
    );
  }

  // A clause dealt only to what it names, on a creature's blow: the hero is a dragon by their field.
  {
    const vs = (race: string) => dealt(use(fight(race), "Bite", ["hero"], "slayer").events, "hero");
    assert.equal(vs("Human"), 4, "no extra dice against a humanoid");
    assert.equal(vs("dragon"), 16, "3d6 more against a dragon");
    assert.equal(optionOf(fight(), "slayer", "Bite").forecast?.averageDamage, 4, "not against this target");
    assert.equal(optionOf(fight("dragon"), "slayer", "Bite").forecast?.averageDamage, 4 + 10.5, "but against a dragon");
  }

  // Holy water, as a catalog entry.
  {
    for (const [target, expected] of [
      ["wolf", 1],
      ["imp", 8],
      ["ghoul", 8],
    ] as const) {
      assert.equal(dealt(use(fight(), "holy", [target]).events, target), expected, `holy water on ${target}`);
    }
  }

  // Who may be picked or caught.
  {
    const state = fight();
    const targets = (label: string) =>
      rulesetOptionTargets(definition, state, "hero", optionOf(state, "hero", label)).sort();
    assert.deepEqual(targets("friend"), ["wolf"], "Animal Friendship: beasts only");
    assert.ok(!targets("sleep").includes("ghoul"), "Sleep passes over the undead");
    assert.ok(targets("sleep").includes("wolf") && targets("sleep").includes("blob"), "and takes anyone else");
    const refused = applyRulesetCombatChoice(
      definition,
      fight(),
      { actorId: "hero", optionId: optionOf(state, "hero", "friend").id, targetIds: ["imp"] },
      () => 4,
    );
    assert.ok(
      refused.events.some((event) => event.type === "refused"),
      "a humanoid or fiend is refused",
    );
    assert.ok(has(use(fight(), "friend", ["wolf"]).state, "wolf", "charmed_beast"));
  }

  // A condition put only on what it names; the other entries still go on.
  {
    const imp = use(fight(), "brand", ["imp"]).state;
    assert.ok(has(imp, "imp", "branded") && has(imp, "imp", "asleep"), "a devil is branded");
    const wolf = use(fight(), "brand", ["wolf"]).state;
    assert.ok(!has(wolf, "wolf", "branded") && has(wolf, "wolf", "asleep"), "a beast is not, but still sleeps");
  }

  // Import refusals.
  {
    const refused = (edit: (doc: any) => void, pattern: RegExp) => {
      const result = parseRulesetDefinition(document(edit));
      assert.ok(!result.ok, `must refuse ${pattern}`);
      assert.match(result.issues.join("; "), pattern);
    };
    const holy = (doc: any) => doc.catalogs.at(-1).entries[0].mechanics;
    refused((doc) => (holy(doc).plus[0].targetIs = { types: ["giant"] }), /Unknown creature type "giant"/);
    refused((doc) => (holy(doc).plus[0].targetIs = { tags: ["demon"] }), /Unknown creature tag "demon"/);
    refused((doc) => (holy(doc).plus[0].targetIs = {}), /names types, tags or both/);
    refused(
      (doc) => (holy(doc).targetTypes = {}),
      /"is", "not", "abilityAtMost", "abilityAtLeast", "notImmuneTo", "calledBySelf", "understands", "uncontrolled" or several/,
    );
    refused((doc) => (doc.combat.creatureTypes.default = "giant"), /Unknown creature type "giant"/);
    refused((doc) => (doc.combat.creatureTypes.field = "level"), /text or choice field/);
    refused((doc) => (doc.catalogs[0].entries[0].creature.type = "giant"), /Unknown creature type "giant"/);
    refused((doc) => {
      delete doc.combat.creatureTypes;
    }, /declares no creature types/);
  }

  // The gate.
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
      "A ruleset with creature types or target tests requires schemaVersion 2 and capabilityApi 1.168 or newer";
    assert.equal(getCapabilityPackageInstallIssue(manifest(167) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(168) as never, document()), gate);
    const bare = JSON.parse(fiveE);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(167) as never, bare), gate, "nothing without the keys");
    const typed = JSON.parse(fiveE);
    typed.catalogs[0].entries[0].creature.type = "plant";
    assert.equal(getCapabilityPackageInstallIssue(manifest(167) as never, typed), gate, "a creature's own type");
  }

  // An invented opponent is what the Game Master says it is, else what a character is (laptop party
  // A: Hold Person had nobody to hold in a cult made up for the fight).
  {
    const { createRulesetFight } =
      await import("../../packages/server/src/services/game/ruleset-combat-director.service.js");
    const built = createRulesetFight({
      definition,
      seed: 1,
      party: [{ id: "hero", name: "Hero" }],
      enemies: [
        { id: "cultist", name: "Cultist", tier: "cr_1" },
        { id: "wight", name: "Wight", tier: "cr_3", creatureType: "Undead" },
        { id: "rotter", name: "Rotting Zombie 2", tier: "cr_1" },
        // A word that ends in a one-word creature's name is that creature (laptop 2026-10-26: an
        // Archlich with a Lich's legendary actions was a Humanoid); a short one is not.
        { id: "archzombie", name: "Archzombie Vel", tier: "cr_1" },
      ],
      cards: [{ name: "Hero", rulesetSheet: { v: 1, build: build() } }],
      playerName: "Hero",
      live: {},
      partyCatalogs: {},
      bestiary: {
        creatures: [
          {
            id: "zombie",
            label: "Zombie",
            creature: { type: "undead", health: 22, defense: 8, initiativeModifier: -2, actions: [] },
          },
        ],
      },
    } as never);
    assert.ok(built.ok, built.ok ? "" : built.error);
    const kind = (id: string) =>
      rulesetCreatureKind(
        definition,
        built.fight.encounter.combatants.find((one) => one.id === id)!,
      ).type;
    assert.equal(kind("cultist"), "humanoid");
    assert.equal(kind("wight"), "undead");
    assert.equal(kind("rotter"), "undead", "a Zombie by its name");
    assert.equal(kind("archzombie"), "undead", "an Archzombie by the word its name ends in");
  }

  console.log("Creature types: slayer dice, holy water, beasts only, Sleep past the undead, gated at 1.168.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
