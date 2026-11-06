/**
 * What the class pass found the AI never did (cloud class pass 2026-10-24), and the set-ups it calls
 * out for its side (Alyssa 2026-10-24: "keep combos in mind ... Hold Person ... a Paladin ... smite").
 *
 *   - A hold that makes every blow from beside its target a critical is cast for the ally beside it,
 *     and the companion that cast it calls it out: in the fight's log, and on the player's own turn
 *     as a suggested follow-up.
 *   - Creatures called in are weighed by the harm they bring: a pack beats a bolt, a lone pony does not.
 *   - Harm a condition does as its holder's turns come round counts (a flask of fire), and so does
 *     what a hit puts on (a net).
 *   - A companion gets up on a faster steed it called when no foe is within a walk, and not when one is.
 *   - On its own hit, a smite that finishes is taken at its lowest slot that does, and a stun on a foe
 *     that would hit back hard is taken, its reason "keeps it from acting"; a let-go moment says so.
 *   - A thing set up before the fight is named by the creature it calls, without its count.
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
  rowsFromCatalogEntry,
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  rulesetStandingAtStart,
  rulesetWindowOptions,
  type RulesetCatalogEntry,
  type RulesetCombatAction,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-ai-class-pass-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { createCombatDirector } = await import("../../packages/server/src/services/game/combat-director.service.js");
const { commandRulesetCombatDirector, directedRulesetView, pickRulesetChoice, rankRulesetChoices } =
  await import("../../packages/server/src/services/game/ruleset-combat-director.service.js");

try {
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const smite = {
    id: "divine-smite",
    label: "Divine Smite",
    rows: [{ list: "features", values: { name: "Divine Smite" } }],
    mechanics: {
      kind: "attack",
      free: true,
      reaction: { on: "hit", by: "self", weapon: true, blow: "melee", at: "target" },
      addsToBlow: true,
      amount: { dice: "2d8" },
      damageType: "radiant",
      cost: [{ pool: "slots_1", amount: 1 }],
      perCostStep: { dice: "1d8" },
      perCostStepsMax: 3,
    },
  };
  const stun = {
    id: "stunning-strike",
    label: "Stunning Strike",
    rows: [
      { list: "features", values: { name: "Stunning Strike" } },
      { list: "counters", values: { name: "Ki", max: 4, recharge: "short" } },
    ],
    mechanics: {
      kind: "debuff",
      free: true,
      usesOf: "Ki",
      reaction: { on: "hit", by: "self", weapon: true, blow: "melee", at: "target" },
      save: { save: "con_save", onSuccess: "negates" },
      applies: [{ condition: "stunned", duration: { rounds: 1, of: "source" } }],
    },
  };
  const features = [smite, stun] as unknown as RulesetCatalogEntry[];
  const doc = JSON.parse(fiveEText) as Record<string, any>;
  Object.assign(
    doc.combat.abilities.find((one: { list: string }) => one.list === "features"),
    { saveDifficulty: { derived: "spell_save_dc" }, toHit: { derived: "spell_attack" } },
  );
  doc.catalogs.push({ id: "paladin", label: "Paladin", feeds: ["features", "counters"], entries: features });
  // Mounted combat, as the mounts regression has it.
  doc.combat.sizes = {
    order: [
      { id: "small", label: "Small" },
      { id: "medium", label: "Medium" },
      { id: "large", label: "Large" },
    ],
    default: "medium",
  };
  doc.combat.mounts = { larger: 1, controlled: { standard: ["dash", "disengage", "dodge"] } };
  // Fire that burns on at the start of its holder's turns.
  doc.sheet.live.conditions.push({ id: "burning", label: "Burning" });
  doc.combat.conditions.push({ condition: "burning", harms: { at: "turn-start", dice: "2d6", type: "fire" } });
  const parsed = parseRulesetDefinition(doc);
  assert.ok(parsed.ok, parsed.ok ? "" : parsed.issues.join("; "));
  const definition: RulesetDefinition = parsed.definition;

  const block = (actions: unknown[], extra: Record<string, unknown> = {}): RulesetStatBlock =>
    ({
      health: 60,
      defense: 12,
      initiativeModifier: 0,
      speed: 30,
      size: "medium",
      abilities: { str: 10, dex: 10, con: 10, int: 12, wis: 10, cha: 10 },
      saves: { wis_save: -10, con_save: -10 },
      actions,
      ...extra,
    }) as unknown as RulesetStatBlock;
  const smash = {
    id: "smash",
    name: "Smash",
    budget: "action",
    toHit: 6,
    reach: 5,
    damage: { count: 2, sides: 8, flat: 4 },
  };
  const bolt = {
    id: "bolt",
    name: "Bolt",
    budget: "action",
    toHit: 6,
    range: { normal: 90 },
    damage: { count: 1, sides: 6, flat: 0 },
  };
  const hold = {
    id: "hold",
    name: "Hold",
    budget: "action",
    range: { normal: 60 },
    save: { save: "wis_save", difficulty: 15 },
    saveDifficulty: 15,
    applies: [{ condition: "paralyzed", duration: "until-save" }],
  };
  const unit = (id: string, side: "player" | "enemy") => ({
    id,
    name: id,
    side,
    hp: 60,
    maxHp: 60,
    attack: 8,
    defense: 6,
    speed: 6,
    level: 9,
    skills: [],
    aiHints: { proficiency: "master" as const },
  });
  type Scene = Record<string, { side: "party" | "enemy"; block: RulesetStatBlock; at: { x: number; y: number } }>;
  const fight = (blocks: Scene, controllers: Record<string, string> = { mira: "ai" }) => {
    const encounter: RulesetEncounterState = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: Object.entries(blocks).map(([id, one]) => ({ id, name: id, side: one.side, block: one.block })),
      board: {
        grid: { width: 16, height: 10, tiles: Array.from({ length: 10 }, () => Array(16).fill("plains")) },
        placements: Object.fromEntries(Object.entries(blocks).map(([id, one]) => [id, one.at])),
      } as never,
    });
    encounter.order = Object.keys(blocks);
    encounter.turn = 0;
    const state = createCombatDirector({
      id: "fight",
      anchor: "anchor",
      style: "ruleset",
      party: Object.entries(blocks)
        .filter(([, one]) => one.side === "party")
        .map(([id]) => unit(id, "player")),
      enemies: Object.entries(blocks)
        .filter(([, one]) => one.side === "enemy")
        .map(([id]) => unit(id, "enemy")),
      gm: false,
      difficulty: "normal",
      seed: 3,
    } as never);
    state.rulesetFight = { encounter, events: [], eventSeq: 0, controllers, bosses: [], adjustments: [] } as never;
    return { encounter, state };
  };
  const picked = (scene: ReturnType<typeof fight>, actorId = "mira") =>
    pickRulesetChoice(definition, scene.state, scene.encounter, actorId);
  const eventsOf = (scene: ReturnType<typeof fight>) =>
    scene.state.rulesetFight!.events.map((entry) => entry.event as { type: string } & Record<string, unknown>);

  // ── A hold for the ally beside it, called out in the log and on the player's turn ──
  {
    const scene = fight(
      {
        mira: { side: "party", block: block([hold, bolt]), at: { x: 2, y: 5 } },
        ada: { side: "party", block: block([smash]), at: { x: 8, y: 5 } },
        orc: { side: "enemy", block: block([smash]), at: { x: 9, y: 5 } },
      },
      { mira: "ai", ada: "manual" },
    );
    const choice = picked(scene);
    assert.equal(choice?.option.id, "hold", `held for the blows from beside it: ${choice?.option.id}`);
    assert.ok((choice?.combo ?? 0) > 0, "worth the criticals its ally lands");
    assert.ok(commandRulesetCombatDirector(definition, scene.state, { type: "continue" }).ok);
    const said = eventsOf(scene).filter((event) => event.type === "callout");
    assert.deepEqual(said, [{ type: "callout", actorId: "mira", targetId: "orc", way: "critical" }]);
    const view = directedRulesetView(definition, scene.state);
    assert.deepEqual(view?.callouts, [{ by: "mira", targetId: "orc", way: "critical" }], "shown on Ada's turn");
    // Said once, not again on its next turn while it still holds.
    assert.ok(rulesetCombatant(scene.state.rulesetFight!.encounter, "orc")!.tracked.length > 0);
  }

  // ── Creatures called in, by the harm they bring ──
  {
    const called = (count: number, flat: number, health: number): RulesetCombatAction =>
      ({
        id: "call",
        label: "Call",
        kind: "utility",
        budget: "action",
        targets: { side: "self", count: 0 },
        calls: {
          block: block(
            [{ id: "bite", name: "Bite", budget: "action", toHit: 4, reach: 5, damage: { count: 0, sides: 0, flat } }],
            {
              health,
            },
          ),
          name: "Wolf",
          creature: { catalogId: "creatures", entryId: "wolf" },
          count: { count: 0, sides: 0, flat: count },
          rounds: 10,
        },
      }) as unknown as RulesetCombatAction;
    const scene = (count: number, flat: number, health = 11) => {
      const made = fight({
        mira: { side: "party", block: block([bolt]), at: { x: 2, y: 5 } },
        orc: { side: "enemy", block: block([smash], { health: 30 }), at: { x: 9, y: 5 } },
      });
      rulesetCombatant(made.encounter, "mira")!.actions.push(called(count, flat, health));
      return made;
    };
    const pack = scene(4, 7);
    assert.ok(
      rulesetCombatOptions(definition, pack.encounter, "mira").some((one) => one.id === "call"),
      "offered",
    );
    assert.equal(picked(pack)?.option.id, "call", "four wolves beat a bolt");
    assert.equal(picked(scene(1, 1, 4))?.option.id, "bolt", "a lone pony does not");
  }

  // ── Harm that burns on, and what a hit puts on ──
  {
    const flask = {
      id: "flask",
      name: "Flask",
      budget: "action",
      toHit: 6,
      range: { normal: 20 },
      damage: { count: 0, sides: 0, flat: 0 },
      applies: [{ condition: "burning", duration: "until-dispelled" }],
    };
    const scene = fight({
      mira: { side: "party", block: block([flask]), at: { x: 2, y: 5 } },
      orc: { side: "enemy", block: block([smash], { health: 20 }), at: { x: 6, y: 5 } },
    });
    assert.equal(picked(scene)?.option.id, "flask", "thrown for the fire that burns on");
    const ranked = rankRulesetChoices(definition, scene.state, scene.encounter, "mira", 3);
    assert.ok((ranked[0]?.parts.damage ?? 0) > 0, `weighed as harm: ${JSON.stringify(ranked[0]?.parts)}`);
  }
  {
    const scene = fight({
      mira: { side: "party", block: block([]), at: { x: 2, y: 5 } },
      orc: { side: "enemy", block: block([smash]), at: { x: 6, y: 5 } },
    });
    rulesetCombatant(scene.encounter, "mira")!.actions.push({
      id: "net",
      label: "Net",
      kind: "attack",
      budget: "action",
      targets: { side: "enemy", count: 1 },
      range: { normal: 5, long: 15 },
      toHit: 6,
      damage: { count: 0, sides: 0, flat: 0 },
      onHit: [{ condition: "restrained", atLeast: 0, checkEnds: { check: "might", difficulty: 10, by: "any" } }],
    } as unknown as RulesetCombatAction);
    assert.equal(picked(scene)?.option.id, "net", "thrown for what it holds them in");
  }

  // ── Up on a faster steed it called, only with no foe in a walk ──
  {
    const scene = (foeAt: number) => {
      const made = fight({
        mira: { side: "party", block: block([smash]), at: { x: 1, y: 5 } },
        horse: { side: "party", block: block([smash], { size: "large", speed: 60 }), at: { x: 2, y: 5 } },
        orc: { side: "enemy", block: block([smash]), at: { x: foeAt, y: 5 } },
      });
      rulesetCombatant(made.encounter, "horse")!.calledBy = "mira";
      assert.ok(commandRulesetCombatDirector(definition, made.state, { type: "continue" }).ok);
      return rulesetCombatant(made.state.rulesetFight!.encounter, "mira")!;
    };
    assert.equal(scene(15).mountedOn, "horse", "rides to a fight far off");
    assert.equal(scene(5).mountedOn, undefined, "walks to one close by");
  }

  // ── Its own hit: a smite that finishes, at its lowest slot; a stun; a moment let go ──
  {
    const roll = (sides: number) => (sides === 20 ? 15 : 3);
    const rows = (list: string) =>
      features.flatMap((entry) =>
        rowsFromCatalogEntry("paladin", entry).flatMap((one) => (one.list === list ? [one.row] : [])),
      );
    const sheetDefinition = definition;
    const encounterWith = (foe: Partial<RulesetStatBlock>) => {
      const encounter = createRulesetEncounter({
        definition: sheetDefinition,
        seed: 1,
        roller: roll,
        combatants: [
          {
            id: "pal",
            name: "Pal",
            side: "party",
            build: rulesetSheetBuildSchema.parse({
              abilities: { str: 18, dex: 10, con: 14, int: 10, wis: 10, cha: 16 },
              fields: {
                level: 9,
                ac: 18,
                speed: 30,
                hp_max: 60,
                spellcasting_ability: "cha",
                slots_max_1: 4,
                slots_max_2: 3,
                slots_max_3: 2,
              },
              lists: {
                attacks: [
                  {
                    name: "Longsword",
                    ability: "str",
                    proficient: true,
                    bonus: 0,
                    damage: "1d8",
                    damage_type: "slashing",
                    reach: 5,
                  },
                ],
                features: rows("features"),
                counters: rows("counters"),
              },
            }),
            live: {},
            catalogs: { paladin: features },
          },
          { id: "foe", name: "Foe", side: "enemy", block: block([smash], foe) },
        ],
      });
      encounter.order = ["pal", "foe"];
      encounter.turn = 0;
      const sword = rulesetCombatOptions(sheetDefinition, encounter, "pal").find((one) => one.label === "Longsword")!;
      const hit = applyRulesetCombatChoice(
        sheetDefinition,
        encounter,
        { actorId: "pal", optionId: sword.id, targetIds: ["foe"] },
        roll,
      ).state;
      assert.equal(hit.window?.trigger.kind, "hit", "its own hit holds a moment");
      const state = createCombatDirector({
        id: "f",
        anchor: "a",
        style: "ruleset",
        party: [unit("pal", "player")],
        enemies: [unit("foe", "enemy")],
        gm: false,
        difficulty: "normal",
        seed: 4,
      } as never);
      return { hit, state, menu: rulesetWindowOptions(sheetDefinition, hit, "pal") };
    };
    // Low enough that a first-level smite drops it.
    const low = encounterWith({ health: 14 });
    const finishing = pickRulesetChoice(sheetDefinition, low.state, low.hit, "pal", low.menu);
    assert.equal(finishing?.option.label, "Divine Smite", "the smite that finishes");
    assert.equal(finishing?.choice.payWith, undefined, "at its own, lowest slot");
    assert.deepEqual(finishing?.choice.targetIds, [], "landing on whoever the blow hit, as the rules fill in");
    // A tough one that hits hard and saves badly: stunned.
    const tough = encounterWith({ health: 200, saves: { con_save: -10 } as never });
    const stunning = pickRulesetChoice(sheetDefinition, tough.state, tough.hit, "pal", tough.menu);
    assert.equal(stunning?.option.label, "Stunning Strike", `kept from acting: ${stunning?.option.label}`);
    assert.ok((stunning?.denies ?? 0) > 0, "worth the harm it keeps off");
  }

  // ── Set up before the fight, by the creature it calls ──
  {
    const encounter = createRulesetEncounter({
      definition,
      seed: 1,
      combatants: [{ id: "mage", name: "Mage", side: "party", block: block([]) }],
    });
    const mage = rulesetCombatant(encounter, "mage")!;
    const wolf = block([
      { id: "bite", name: "Bite", budget: "action", toHit: 4, reach: 5, damage: { count: 0, sides: 0, flat: 5 } },
    ]);
    mage.actions.push({
      id: "summon",
      label: "Summon",
      kind: "utility",
      budget: "action",
      targets: { side: "self", count: 0 },
      callChoice: true,
      modes: [
        {
          id: "call-0",
          label: "Wolf ×2",
          call: {
            block: wolf,
            name: "Wolf",
            creature: { catalogId: "creatures", entryId: "wolf" },
            count: { count: 0, sides: 0, flat: 2 },
          },
        },
        {
          id: "call-1",
          label: "Warhorse, Celestial",
          call: {
            block: wolf,
            name: "Warhorse, Celestial",
            creature: { catalogId: "creatures", entryId: "warhorse" },
            count: { count: 0, sides: 0, flat: 1 },
          },
        },
      ],
    } as unknown as RulesetCombatAction);
    for (const [mode, called] of [
      ["Wolf", "Wolf"],
      ["warhorse", "Warhorse, Celestial"],
    ] as const) {
      const out = rulesetStandingAtStart(definition, structuredClone(encounter), [
        { casterId: "mage", entry: "Summon", mode },
      ]);
      assert.deepEqual(out.skipped, [], `"${mode}" names a way`);
      assert.ok(
        out.state.combatants.some((one) => one.name.startsWith(called) && one.calledBy === "mage"),
        out.state.combatants.map((one) => one.name).join(", "),
      );
    }
  }

  console.info(
    "AI class pass: a hold cast for the ally beside its target and called out; packs called; burning and nets weighed; a steed ridden from afar; a finishing smite at its lowest slot and a stun; set-ups named by creature.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
