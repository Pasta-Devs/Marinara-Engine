/**
 * A breath is an area its targets save against, back on a recharge, however its creature came to be.
 *
 *   - An invented foe's action named a breath (laptop playtest 2026-10-26: Cindermaw, an invented young
 *     red dragon, rolled its Rot Breath to hit one hero every round for five rounds), or written as a
 *     cone, a line or an area, is built as the bestiary's breaths are: the shape, size, save, recharge
 *     and reach off a board of the bestiary's area action nearest it, at its own tier's difficulty.
 *     Built from a tier, from a proposed block, and with nothing in the bestiary to read; said in a
 *     line the notes read back.
 *   - A blow at one stays one, and a proposed action with an area of its own keeps it.
 *   - A bestiary dragon's Fire Breath (the SRD Young Red Dragon) plays as one for a level 4 party: as it
 *     is, as a boss whose points buy its own actions (never the breath), and as the lesser one of its
 *     kind the budget sends in its place.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyRulesetCombatChoice,
  defaultRulesetSheetBuild,
  parseRulesetDefinition,
  readRulesetFightNote,
  rulesetBudgetStandIns,
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetEncounterBudget,
  type RulesetCatalogEntriesById,
  type RulesetDefinition,
  type RulesetEncounterState,
  rulesetAverageDamage,
  rulesetWrittenArea,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-invented-breath-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { createRulesetFight } =
  await import("../../packages/server/src/services/game/ruleset-combat-director.service.js");

try {
  const text = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  // The SRD 5.1 scale up to CR 10, each rung's experience, and SRD 5.2's budget per character.
  const XP: Record<string, number> = {
    cr_0: 10,
    cr_1_8: 25,
    cr_1_4: 50,
    cr_1_2: 100,
    cr_1: 200,
    cr_2: 450,
    cr_3: 700,
    cr_4: 1100,
    cr_5: 1800,
    cr_6: 2300,
    cr_7: 2900,
    cr_8: 3900,
    cr_9: 5000,
    cr_10: 5900,
  };
  const higher = [
    {
      id: "cr_6",
      label: "CR 6",
      health: [65, 136],
      defense: 15,
      toHit: 7,
      damagePerRound: [20, 45],
      saveDifficulty: 15,
    },
    {
      id: "cr_7",
      label: "CR 7",
      health: [110, 157],
      defense: 17,
      toHit: 7,
      damagePerRound: [22, 50],
      saveDifficulty: 15,
    },
    {
      id: "cr_8",
      label: "CR 8",
      health: [110, 172],
      defense: 17,
      toHit: 7,
      damagePerRound: [22, 55],
      saveDifficulty: 15,
    },
    {
      id: "cr_9",
      label: "CR 9",
      health: [133, 200],
      defense: 18,
      toHit: 10,
      damagePerRound: [32, 56],
      saveDifficulty: 16,
    },
    {
      id: "cr_10",
      label: "CR 10",
      health: [133, 200],
      defense: 18,
      toHit: 10,
      damagePerRound: [39, 56],
      saveDifficulty: 17,
    },
  ];
  // The SRD's own entries (Open5e srd-2014, as the 5e package ships them).
  const youngRed = {
    id: "young-red-dragon",
    label: "Young Red Dragon",
    creature: {
      type: "dragon",
      health: { dice: "17d10+85" },
      defense: 18,
      speed: 40,
      initiativeModifier: 0,
      abilities: { str: 23, dex: 10, con: 21, int: 14, wis: 11, cha: 19 },
      saves: { dex_save: 4, con_save: 9, wis_save: 4, cha_save: 8 },
      immune: ["fire"],
      tier: "cr_10",
      actions: [
        {
          id: "multiattack",
          name: "Multiattack",
          budget: "action",
          sequence: [
            { action: "bite", times: 1 },
            { action: "claw", times: 2 },
          ],
        },
        {
          id: "bite",
          name: "Bite",
          budget: "action",
          toHit: 10,
          reach: 10,
          damage: { dice: "2d10", flat: 6, type: "piercing", plus: [{ dice: "1d6", type: "fire" }] },
        },
        {
          id: "claw",
          name: "Claw",
          budget: "action",
          toHit: 10,
          reach: 5,
          damage: { dice: "2d6", flat: 6, type: "slashing" },
        },
        {
          id: "fire_breath",
          name: "Fire Breath",
          budget: "action",
          damage: { dice: "16d6", type: "fire" },
          save: { save: "dex_save", difficulty: 17, onSuccess: "half" },
          targetCount: 3,
          area: { shape: "cone", size: 30 },
          recharge: { dice: { count: 1, sides: 6 }, from: 5 },
        },
      ],
    },
  };
  const wyrmling = {
    id: "red-dragon-wyrmling",
    label: "Red Dragon Wyrmling",
    creature: {
      type: "dragon",
      health: { dice: "10d8+30" },
      defense: 17,
      speed: 30,
      initiativeModifier: 0,
      abilities: { str: 19, dex: 10, con: 17, int: 12, wis: 11, cha: 15 },
      saves: { dex_save: 2, con_save: 5, wis_save: 2, cha_save: 4 },
      immune: ["fire"],
      tier: "cr_4",
      actions: [
        {
          id: "bite",
          name: "Bite",
          budget: "action",
          toHit: 6,
          reach: 5,
          damage: { dice: "1d10", flat: 4, type: "piercing", plus: [{ dice: "1d6", type: "fire" }] },
        },
        {
          id: "fire_breath",
          name: "Fire Breath",
          budget: "action",
          damage: { dice: "7d6", type: "fire" },
          save: { save: "dex_save", difficulty: 13, onSuccess: "half" },
          targetCount: 3,
          area: { shape: "cone", size: 15 },
          recharge: { dice: { count: 1, sides: 6 }, from: 5 },
        },
      ],
    },
  };
  const doc = JSON.parse(text) as Record<string, any>;
  doc.combat.threat.tiers.push(...structuredClone(higher));
  for (const tier of doc.combat.threat.tiers) tier.worth = XP[tier.id];
  doc.combat.threat.budget = {
    level: ["level"],
    steps: [
      { id: "low", label: "Low" },
      { id: "moderate", label: "Moderate" },
      { id: "high", label: "High" },
    ],
    byLevel: [
      { level: 1, worth: [50, 75, 100] },
      { level: 2, worth: [100, 150, 200] },
      { level: 3, worth: [150, 225, 400] },
      { level: 4, worth: [250, 375, 500] },
      { level: 5, worth: [500, 750, 1100] },
    ],
  };
  // Of a kind, so the budget sends a lesser dragon in a great one's place.
  doc.combat.creatureTypes = {
    types: ["dragon", "humanoid"].map((id) => ({ id, label: id })),
    field: "race",
    default: "humanoid",
  };
  doc.catalogs.find((one: Record<string, any>) => one.id === "creatures").entries.push(youngRed, wyrmling);
  const result = parseRulesetDefinition(doc);
  assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
  const definition: RulesetDefinition = result.definition;
  const bestiary: RulesetCatalogEntriesById = Object.fromEntries(
    (definition.catalogs ?? []).filter((one) => one.holds === "creatures").map((one) => [one.id, one.entries ?? []]),
  );

  // Four level 4 heroes, every die but the d20 its lowest: a recharge's d6 never brings a breath back.
  const names = ["Mirelle Dawnsong", "Brom", "Ilsa", "Tavi"];
  const card = (name: string) => {
    const build = defaultRulesetSheetBuild(definition);
    build.fields.level = 4;
    return { name, rulesetSheet: { v: 1, build } };
  };
  const party = names.map((name) => ({ id: name.split(" ")[0]!.toLowerCase(), name }));
  const roller = (sides: number) => (sides === 20 ? 10 : 1);
  const fight = (enemies: any[], options: { bestiary?: RulesetCatalogEntriesById; budget?: boolean } = {}) => {
    const built = createRulesetFight({
      definition,
      seed: 7,
      party,
      enemies,
      cards: names.map(card),
      playerName: null,
      live: null,
      partyCatalogs: {},
      bestiary: options.bestiary ?? bestiary,
      ...(options.budget ? { budget: { difficulty: "normal" as const } } : {}),
    });
    assert.ok(built.ok, built.ok ? "" : built.error);
    return built.fight;
  };
  const action = (state: RulesetEncounterState, id: string, label: string) =>
    rulesetCombatant(state, id)!.actions.find((one) => one.label === label);
  /** An area its targets save against for half, back on 5 or 6 on a d6, never rolled to hit. */
  const isBreath = (state: RulesetEncounterState, id: string, label: string, save: string, difficulty: number) => {
    const breath = action(state, id, label);
    assert.ok(breath, `${id} has ${label}`);
    assert.equal(breath.toHit, undefined, `${label} rolls no attack`);
    assert.deepEqual(
      { save: breath.save?.save, difficulty: breath.save?.difficulty, onSuccess: breath.save?.onSuccess },
      { save, difficulty, onSuccess: "half" },
      label,
    );
    assert.ok(breath.area, `${label} lands in an area`);
    assert.deepEqual(breath.recharge, { dice: { count: 1, sides: 6 }, from: 5 }, label);
    return breath;
  };
  /** Its turn: the breath at as many of the party as it reaches, then whether it is on the menu again. */
  const breathe = (state: RulesetEncounterState, id: string, label: string) => {
    const now = structuredClone(state);
    now.turn = now.order.indexOf(id);
    const option = rulesetCombatOptions(definition, now, id).find((one) => one.label === label);
    assert.ok(option, `${label} is on ${id}'s menu`);
    const targets = party.map((one) => one.id).slice(0, option.targets.count);
    const step = applyRulesetCombatChoice(
      definition,
      now,
      { actorId: id, optionId: option.id, targetIds: targets },
      roller,
    );
    assert.equal(
      step.events.find((one) => one.type === "refused"),
      undefined,
      JSON.stringify(step.events.slice(0, 3)),
    );
    assert.equal(
      step.events.filter((one) => one.type === "attack" && one.actorId === id).length,
      0,
      `${label} is no attack roll`,
    );
    const saves = step.events.filter((one) => one.type === "save" && one.sourceId === id);
    assert.equal(saves.length, targets.length, `each of ${targets.join(", ")} saves against ${label}`);
    assert.ok(rulesetCombatant(step.state, id)!.spent.length > 0, `${label} is spent`);
    return step.state;
  };
  const notes = (adjustments: string[]) =>
    adjustments.filter((line) => readRulesetFightNote(line)?.key === "writtenArea");

  // ── Cindermaw, built from its tier: Rot Breath is the bestiary's nearest breath, the Bite a bite ──
  {
    const made = fight([
      { id: "cindermaw", name: "Cindermaw", tier: "cr_4", attacks: [{ name: "Bite" }, { name: "Rot Breath" }] },
    ]);
    const breath = isBreath(made.encounter, "cindermaw", "Rot Breath", "dex_save", 13);
    // The Red Dragon Wyrmling's, at CR 4: a 15-foot cone (three squares), three caught off a board.
    assert.equal(breath.area!.shape, "cone");
    assert.equal(breath.targets.count, 3);
    assert.notEqual(action(made.encounter, "cindermaw", "Bite")!.toHit, undefined, "the bite still rolls to hit");
    // Built at its tier's round for one, it reaches two: half of what the bite deals.
    const bite = rulesetAverageDamage(action(made.encounter, "cindermaw", "Bite")!.damage!);
    // Rolled, as the wyrmling's breath is, never the tier's flat number (cloud re-test 2026-10-26).
    assert.ok(breath.damage!.count > 0 && breath.damage!.sides === 6, JSON.stringify(breath.damage));
    assert.ok(
      rulesetAverageDamage(breath.damage!) <= bite / 2 + 1,
      `${rulesetAverageDamage(breath.damage!)} vs ${bite}`,
    );
    const said = notes(made.adjustments);
    assert.deepEqual(said, [
      'Cindermaw: "Rot Breath" was written as a breath or an area, so it lands in an area against a save and comes back on a recharge.',
    ]);
    assert.equal(readRulesetFightNote(said[0]!)?.of, "Cindermaw");
    const after = breathe(made.encounter, "cindermaw", "Rot Breath");
    // Its next turn, the d6 rolled a 1: no breath, only its bite.
    const next = applyRulesetCombatChoice(
      definition,
      after,
      { actorId: "cindermaw", optionId: "end-turn", targetIds: [] },
      roller,
    ).state;
    next.turn = next.order.indexOf("cindermaw");
    assert.equal(
      rulesetCombatOptions(definition, next, "cindermaw").find((one) => one.label === "Rot Breath"),
      undefined,
      "spent until it recharges",
    );
  }

  // ── Written as a cone or a line, or marked an area, by its writer's words ──
  {
    const made = fight([
      {
        id: "salamander",
        name: "Ash Salamander",
        tier: "cr_2",
        attacks: [
          { name: "Searing Spray", description: "a cone of burning oil" },
          { name: "Lightning Lash", description: "lightning in a line" },
          { name: "Cinder Storm", area: true },
          { name: "Tail Slap", description: "a heavy tail" },
        ],
      },
    ]);
    assert.equal(isBreath(made.encounter, "salamander", "Searing Spray", "dex_save", 12).area!.shape, "cone");
    assert.equal(isBreath(made.encounter, "salamander", "Lightning Lash", "dex_save", 12).area!.shape, "line");
    isBreath(made.encounter, "salamander", "Cinder Storm", "dex_save", 12);
    assert.notEqual(action(made.encounter, "salamander", "Tail Slap")!.toHit, undefined);
    assert.equal(action(made.encounter, "salamander", "Tail Slap")!.save, undefined);
    assert.equal(notes(made.adjustments).length, 3);
    // A line only as a shape, never a line of soldiers.
    assert.equal(rulesetWrittenArea({ name: "Tail Sweep", description: "knocks down a line of soldiers" }), null);
    assert.equal(rulesetWrittenArea({ name: "Spark", description: "a 30-foot line of fire" })?.shape, "line");
  }

  // ── A proposed block: its breath written as a blow is made one; an area of its own is kept ──
  {
    const made = fight([
      {
        id: "cindermaw",
        name: "Cindermaw",
        attacks: [{ name: "Bite" }, { name: "Rot Breath" }],
        proposed: {
          tier: "cr_4",
          health: 80,
          defense: 15,
          initiativeModifier: 0,
          actions: [
            {
              id: "bite",
              name: "Bite",
              budget: "action",
              toHit: 7,
              damage: { dice: "2d10", flat: 4, type: "piercing" },
            },
            {
              id: "rot_breath",
              name: "Rot Breath",
              budget: "action",
              toHit: 7,
              damage: { dice: "4d6", type: "necrotic" },
            },
            {
              id: "ash_cloud",
              name: "Ash Breath",
              budget: "action",
              damage: { dice: "2d6", type: "fire" },
              save: { save: "con_save", difficulty: 12, onSuccess: "half" },
              area: { shape: "burst", size: 10 },
              range: 30,
            },
          ],
        },
      },
    ]);
    const breath = isBreath(made.encounter, "cindermaw", "Rot Breath", "dex_save", 13);
    assert.equal(breath.damage?.type, "necrotic", "its own damage");
    // Half of it, as it reaches more than one (laptop re-test 2026-10-26: 37 to each of three heroes).
    assert.deepEqual([breath.damage?.count, breath.damage?.sides, breath.damage?.flat], [2, 6, 0]);
    const own = action(made.encounter, "cindermaw", "Ash Breath")!;
    assert.equal(own.save?.save, "con_save", "an area written as one is left as written");
    assert.equal(own.area?.shape, "burst");
    assert.equal(own.recharge, undefined);
    assert.equal(notes(made.adjustments).length, 1, made.adjustments.join("; "));
    breathe(made.encounter, "cindermaw", "Rot Breath");
  }

  // ── Nothing in the bestiary to read: a cone of three squares, two caught, back on a 5 or 6 ──
  {
    const made = fight([{ id: "cindermaw", name: "Cindermaw", tier: "cr_4", attacks: [{ name: "Rot Breath" }] }], {
      bestiary: {},
    });
    const breath = isBreath(made.encounter, "cindermaw", "Rot Breath", definition.sheet.saves[0]!.id, 13);
    assert.equal(breath.area!.shape, "cone");
    assert.equal(breath.targets.count, 2);
  }

  // ── The SRD Young Red Dragon for a level 4 party ──
  {
    // As it is (a story's fight, never swapped): counted, never moved, its Fire Breath its own.
    const asIs = fight([{ id: "dragon", name: "Young Red Dragon", creature: "creatures/young-red-dragon" }], {
      budget: true,
    });
    assert.ok(
      asIs.adjustments.some((line) => /worth 5900, more than this party's Moderate budget of 1500/.test(line)),
      asIs.adjustments.join("; "),
    );
    assert.equal(notes(asIs.adjustments).length, 0, "a bestiary breath is said nothing of");
    const fire = isBreath(asIs.encounter, "dragon", "Fire Breath", "dex_save", 17);
    assert.equal(fire.targets.count, 3);
    breathe(asIs.encounter, "dragon", "Fire Breath");

    // As a boss with points: it buys its own actions with them, never a second breath.
    const boss = fight(
      [{ id: "dragon", name: "Young Red Dragon", creature: "creatures/young-red-dragon", boss: true, points: 3 }],
      { budget: true },
    );
    isBreath(boss.encounter, "dragon", "Fire Breath", "dex_save", 17);
    const bought = rulesetCombatant(boss.encounter, "dragon")!.actions.filter((one) => one.signature);
    assert.ok(
      bought.length > 0 && bought.every((one) => !one.recharge && !one.area),
      JSON.stringify(bought.map((one) => one.label)),
    );
    breathe(boss.encounter, "dragon", "Fire Breath");

    // Far beyond the party: the lesser one of its kind the budget sends breathes as the bestiary has it.
    const budget = rulesetEncounterBudget(definition, [4, 4, 4, 4], "normal")!;
    const swapped = rulesetBudgetStandIns(
      definition,
      bestiary,
      [{ id: "dragon", name: "Cindermaw", creature: "creatures/young-red-dragon" }],
      budget,
    );
    assert.deepEqual(
      swapped.enemies.map((one) => [one.id, one.name, one.creature]),
      [["dragon", "Red Dragon Wyrmling", "creatures/red-dragon-wyrmling"]],
    );
    const sent = fight(swapped.enemies, { budget: true });
    isBreath(sent.encounter, "dragon", "Fire Breath", "dex_save", 13);
    breathe(sent.encounter, "dragon", "Fire Breath");
  }

  console.log("An invented breath, and a bestiary one at level 4, land in an area against a save and recharge.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
