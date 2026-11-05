/**
 * Choices on the sheet, and values off it on attacks, checks and saves (Capability API 1.429).
 *
 *   - Foe Slayer: the Wisdom modifier onto an attack against a favored enemy that falls short, or
 *     onto its damage when it hits without it, once on each of the ranger's turns; nothing against
 *     an enemy they did not choose.
 *   - Elemental Affinity: the Charisma modifier on a spell of the ancestry's damage type only, and
 *     resistance to that type from a condition reading the same choice.
 *   - Natural Explorer: the proficiency bonus again on an Intelligence or Wisdom check with a skill
 *     the ranger is proficient in, out of a fight and in one.
 *   - Refusals and the install gate.
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
  rollRulesetCheckModifiers,
  rowsFromCatalogEntry,
  rulesetCheckEffects,
  rulesetCombatant,
  rulesetCombatHide,
  rulesetCombatOptions,
  rulesetConditionModifiers,
  rulesetContextualItems,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";
import type { TacticalGrid } from "../../packages/shared/src/features/tactical-combat/types.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-sheet-choices-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 429);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const foeSlayer = {
    to: "attacks",
    add: { abilityMod: "wis" },
    rescue: true,
    oncePer: "own-turn",
    orDamage: true,
    atTypesIn: ["favored_enemies"],
  };
  const explorer = {
    to: "checks",
    abilities: ["int", "wis"],
    proficient: true,
    add: { derived: "proficiency_bonus" },
  };
  const spell = (id: string, label: string, damageType: string) => ({
    id,
    label,
    rows: [{ list: "spells", values: { name: label, level: 0, prepared: true } }],
    mechanics: { kind: "attack", autoHit: true, targets: "enemy", range: 60, damageType, amount: { flat: 5 } },
  });
  const spells = [
    spell("bolt", "Fire Bolt", "fire"),
    spell("frost", "Ray of Frost", "cold"),
  ] as unknown as RulesetCatalogEntry[];
  const sorcerer = [
    {
      id: "affinity",
      label: "Elemental Affinity",
      rows: [{ list: "features", values: { name: "Elemental Affinity" } }],
      mechanics: {
        kind: "utility",
        amends: [{ catalogs: ["spells"], damageTypeIn: "draconic_damage_type", damageOnce: { abilityMod: "cha" } }],
      },
    },
  ] as unknown as RulesetCatalogEntry[];
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.fields.push(
      { id: "favored_enemies", label: "Favored enemies", type: "text", maxLength: 200 },
      { id: "draconic_damage_type", label: "Draconic damage type", type: "text", maxLength: 40 },
    );
    doc.sheet.derived.push({ id: "ranger_level", label: "Ranger level", op: "sum", of: [{ field: "level" }] });
    doc.sheet.live.conditions.push({ id: "draconic_resist", label: "Draconic resistance" });
    doc.combat.creatureTypes = {
      types: [
        { id: "undead", label: "Undead" },
        { id: "beast", label: "Beast" },
        { id: "humanoid", label: "Humanoid" },
      ],
      tags: [{ id: "orc", label: "Orc" }],
      default: "humanoid",
    };
    doc.combat.levels = [
      ...(doc.combat.levels ?? []),
      { derived: "ranger_level", at: 20, modifiers: [structuredClone(foeSlayer)] },
      { derived: "ranger_level", at: 10, modifiers: [structuredClone(explorer)] },
    ];
    doc.combat.conditions.push({ condition: "draconic_resist", effects: [], resistIn: ["draconic_damage_type"] });
    doc.catalogs.push(
      { id: "spells", label: "Spells", feeds: ["spells"], entries: structuredClone(spells) },
      { id: "sorcerer", label: "Sorcerer", feeds: ["features"], entries: structuredClone(sorcerer) },
      {
        id: "ranger",
        label: "Ranger",
        feeds: ["features"],
        entries: [
          {
            id: "explorer",
            label: "Natural Explorer",
            rows: [{ list: "features", values: { name: "Natural Explorer" } }],
            mechanics: { kind: "utility", contextual: { modifiers: [structuredClone(explorer)] } },
          },
        ],
      },
    );
    edit(doc);
    return doc;
  };
  const parsed = (document: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(document);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const refused = (document: unknown, pattern: RegExp) => {
    const result = parseRulesetDefinition(document);
    assert.equal(result.ok, false, `should be refused: ${pattern}`);
    if (!result.ok) assert.match(result.issues.join("; "), pattern);
  };
  const definition = parsed(fiveE());
  const block = (type: string, defense: number, tags?: string[]): RulesetStatBlock =>
    ({
      health: 200,
      defense,
      initiativeModifier: 0,
      speed: 30,
      type,
      ...(tags ? { tags } : {}),
      actions: [
        {
          id: "flame",
          name: "Flame",
          budget: "action",
          toHit: 30,
          range: 30,
          damage: { count: 0, sides: 0, flat: 10, type: "fire" },
        },
      ],
    }) as unknown as RulesetStatBlock;
  const grid = (): TacticalGrid => ({
    width: 20,
    height: 12,
    tiles: Array.from({ length: 12 }, () => Array(20).fill("plains")),
  });
  // A d20 of 10, every other die a 3.
  const roll = (sides: number) => (sides === 20 ? 10 : 3);
  const spellRows = spells.flatMap((entry) =>
    rowsFromCatalogEntry("spells", entry).flatMap((one) => (one.list === "spells" ? [one.row] : [])),
  );
  const featureRows = sorcerer.flatMap((entry) =>
    rowsFromCatalogEntry("sorcerer", entry).flatMap((one) => (one.list === "features" ? [one.row] : [])),
  );
  const fight = (defense: number, type = "undead", level = 20, tags?: string[]): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: roll,
      combatants: [
        {
          id: "ranger",
          name: "Ranger",
          side: "party",
          // Strength 16 and proficiency 6 make the greataxe +9; Wisdom 16 is +3.
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 16, dex: 12, con: 14, int: 8, wis: 16, cha: 8 },
            skills: { survival: "proficient" },
            fields: { level, ac: 15, speed: 30, hp_max: 90, favored_enemies: "Undead, orc" },
            lists: {
              attacks: [{ name: "Greataxe", ability: "str", proficient: true, bonus: 0, damage: "1d12", reach: 5 }],
            },
          }),
          live: {},
        },
        {
          id: "sorcerer",
          name: "Sorcerer",
          side: "party",
          // Charisma 16 is +3.
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 8, dex: 12, con: 14, int: 10, wis: 10, cha: 16 },
            fields: {
              level: 6,
              ac: 12,
              speed: 30,
              hp_max: 40,
              spellcasting_ability: "cha",
              draconic_damage_type: "Fire",
            },
            lists: { spells: spellRows, features: featureRows },
          }),
          live: { conditions: ["draconic_resist"] },
          catalogs: { spells, sorcerer },
        },
        { id: "foe", name: "Foe", side: "enemy", block: block(type, defense, tags) },
      ],
      board: {
        grid: grid(),
        placements: { ranger: { x: 5, y: 5 }, sorcerer: { x: 5, y: 7 }, foe: { x: 6, y: 5 } },
      },
    });
    state.order = state.combatants.map((one) => one.id);
    state.turn = 0;
    return state;
  };
  const who = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)!;
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const act = (state: RulesetEncounterState, actorId: string, label: string, targetIds: string[]) => {
    state.turn = state.order.indexOf(actorId);
    who(state, actorId).budgets.action = 1;
    const option = rulesetCombatOptions(definition, state, actorId).find((one) => one.label === label);
    assert.ok(
      option,
      `${actorId} can ${label}: ${rulesetCombatOptions(definition, state, actorId).map((one) => one.label)}`,
    );
    const step = applyRulesetCombatChoice(definition, state, { actorId, optionId: option.id, targetIds }, roll);
    assert.equal(of(step.events, "refused").length, 0, JSON.stringify(of(step.events, "refused")));
    return step;
  };
  const swing = (state: RulesetEncounterState) => {
    const step = act(state, "ranger", "Greataxe", ["foe"]);
    const attack = of(step.events, "attack")[0]!;
    const dealt = of(step.events, "damage").reduce((sum, one) => sum + one.amount, 0);
    return { step, attack, dealt };
  };

  // ── Foe Slayer ──
  {
    // 10 + 9 is 19, two short of 21: the Wisdom modifier makes it a hit, and the damage is the axe's.
    const short = swing(fight(21));
    assert.equal(short.attack.outcome, "hit", JSON.stringify(short.attack));
    assert.equal(short.attack.total, 22);
    assert.equal(short.dealt, 3 + 3, "spent on the roll, not again on the damage");
    // The same turn again: spent, so short is a miss.
    const again = swing(short.step.state);
    assert.equal(again.attack.outcome, "miss", "once a turn");
    // A hit without it: the Wisdom modifier on its damage instead, once.
    const hit = swing(fight(15));
    assert.equal(hit.attack.total, 19, "nothing on a roll that hit anyway");
    assert.equal(hit.dealt, 3 + 3 + 3);
    const second = swing(hit.step.state);
    assert.equal(second.dealt, 3 + 3, "once a turn");
    // Their next turn, it is back.
    hit.step.state.round += 1;
    assert.equal(swing(hit.step.state).dealt, 3 + 3 + 3, "back on the next turn");
    // A creature they did not choose: nothing.
    assert.equal(swing(fight(21, "beast")).attack.outcome, "miss");
    assert.equal(swing(fight(15, "beast")).dealt, 3 + 3);
    // Chosen by a tag, written as it is labelled.
    assert.equal(swing(fight(15, "humanoid", 20, ["orc"])).dealt, 3 + 3 + 3, "an orc by its tag");
    // Not before 20th level.
    assert.equal(swing(fight(15, "undead", 19)).dealt, 3 + 3);
  }

  // ── Elemental Affinity ──
  {
    const fire = act(fight(15), "sorcerer", "Fire Bolt", ["foe"]);
    assert.equal(
      of(fire.events, "damage").reduce((sum, one) => sum + one.amount, 0),
      5 + 3,
      "the ancestry's type",
    );
    const cold = act(fight(15), "sorcerer", "Ray of Frost", ["foe"]);
    assert.equal(
      of(cold.events, "damage").reduce((sum, one) => sum + one.amount, 0),
      5,
      "never another type",
    );
    const state = fight(15);
    assert.ok(rulesetCombatHide(definition, who(state, "sorcerer"), state).resist.includes("fire"));
    const flame = act(state, "foe", "Flame", ["sorcerer"]);
    assert.equal(
      of(flame.events, "damage")
        .filter((one) => one.targetId === "sorcerer")
        .reduce((sum, one) => sum + (one.dealt ?? one.amount), 0),
      5,
      "half the fire, by the type the sheet chose",
    );
  }

  // ── Natural Explorer ──
  {
    // Applied by name (apply=): offered on a check with a skill they are proficient in only.
    const rangerEntries = definition.catalogs!.find((one) => one.id === "ranger")!.entries;
    const holder = (skills: Record<string, string>) =>
      rulesetSheetBuildSchema.parse({
        abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 16, cha: 10 },
        skills,
        fields: { level: 20 },
        lists: {
          features: rangerEntries.flatMap((entry) =>
            rowsFromCatalogEntry("ranger", entry).flatMap((one) => (one.list === "features" ? [one.row] : [])),
          ),
        },
      });
    const applied = (skills: Record<string, string>) =>
      rulesetContextualItems(definition, holder(skills), { ranger: rangerEntries }, ["Natural Explorer"], {
        type: "skill",
        id: "survival",
        label: "Survival",
        ability: "wis",
      }).map((item) => item.name);
    assert.deepEqual(applied({ survival: "proficient" }), ["Natural Explorer"], "applied by name");
    assert.deepEqual(applied({}), [], "not on a skill they are not proficient in");
    const source = { name: "Natural Explorer", modifiers: [explorer] } as never;
    const survival = { type: "skill", id: "survival", label: "Survival", ability: "wis" } as const;
    const proficient = rulesetCheckEffects([source], survival, true);
    assert.equal(proficient.modifiers.length, 1);
    assert.equal(
      rollRulesetCheckModifiers(
        proficient.modifiers,
        () => 1,
        () => 6,
      ).total,
      6,
      "the bonus off the sheet",
    );
    assert.equal(rulesetCheckEffects([source], survival, false).modifiers.length, 0, "only where proficient");
    const athletics = { type: "skill", id: "athletics", label: "Athletics", ability: "str" } as const;
    assert.equal(rulesetCheckEffects([source], athletics, true).modifiers.length, 0, "only Intelligence or Wisdom");
    // In a fight, off the level, by the skill rolled.
    const state = fight(15);
    const ranger = who(state, "ranger");
    const reads = (skill: string) =>
      rulesetConditionModifiers(
        definition,
        definition.combat!,
        ranger,
        "checks",
        state,
        skill,
        undefined,
        "wis",
      ).filter(({ modifier }) => modifier.proficient).length;
    assert.equal(reads("survival"), 1);
    assert.equal(reads("perception"), 0, "not a skill they are proficient in");
  }

  // ── Refusals ──
  {
    const level = (modifier: Record<string, unknown>) =>
      fiveE((doc) => {
        doc.combat.levels.at(-2).modifiers = [{ ...foeSlayer, ...modifier }];
      });
    refused(level({ atTypesIn: ["nothing_here"] }), /Unknown field "nothing_here"/);
    refused(level({ atTypesIn: ["level"] }), /"level" is a number field; a choice is text or enum/);
    refused(level({ rescue: undefined }), /"orDamage" moves a held-back change/);
    refused(level({ orDamage: undefined, rescue: undefined }), /"oncePer" counts the damage the holder deals/);
    refused(
      level({
        to: "saves",
        orDamage: undefined,
        oncePer: undefined,
        atTypesIn: undefined,
        rescue: undefined,
        proficient: true,
      }),
      /"proficient" narrows checks/,
    );
    refused(
      fiveE((doc) => {
        doc.combat.conditions.at(-1).resistIn = ["nothing_here"];
      }),
      /Unknown field "nothing_here"/,
    );
    refused(
      fiveE((doc) => {
        doc.catalogs.find((one: { id: string }) => one.id === "sorcerer").entries[0].mechanics.amends[0].damageTypeIn =
          "nothing_here";
      }),
      /Unknown field "nothing_here"/,
    );
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset whose changes read choices on the sheet (atTypesIn, resistIn, damageTypeIn), come once a turn or onto damage (oncePer, orDamage), narrow to proficient checks (proficient) or add a value off the sheet to attacks, checks or saves (add) requires schemaVersion 2 and capabilityApi 1.429 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(428) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(429) as never, fiveE()), gate);
    const resistOnly = fiveE((doc) => {
      doc.combat.levels.splice(-2, 2);
      doc.catalogs.splice(-3, 3);
    });
    assert.equal(getCapabilityPackageInstallIssue(manifest(428) as never, resistOnly), gate, "resistIn alone");
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(428) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "Sheet choices: Foe Slayer turns a near miss on a favored enemy into a hit or adds to its damage, once a turn, never on another; Elemental Affinity adds to the ancestry's type only and resists it; Natural Explorer adds the proficiency bonus to proficient Intelligence and Wisdom checks; gated at 1.429.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
