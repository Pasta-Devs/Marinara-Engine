/**
 * What the class re-test found the AI still never did, or did wrong (cloud class re-test 2026-10-24).
 *
 *   - A burst that turns only one kind of creature (Turn the Unholy) is weighed by those it may take,
 *     not the friends it is read out around, and the turns it takes from them count as a hold's do.
 *   - A heal paid in as many uses as its user chooses (Lay on Hands) is weighed at the uses that heal
 *     its target, not at one.
 *   - A dodge an ability grants on another budget (Patient Defense) is taken by a hurt one beside its
 *     foes once its action is spent; never by a whole one.
 *   - Twinned: a cantrip sent at two foes for a point, both struck.
 *   - A self-buff whose condition leaves a level of a track as it ends (Frenzy's exhaustion) costs more
 *     than the same one without.
 *   - An area that lowers its holders' defense is never cast over its own side as support (Slow).
 *   - A summons held is not let go for a lesser held spell, nor for a held blow worth less than it.
 *   - A potion that ends on its drinker's next attack is worth one blow, not an hour of them.
 *   - A spell that grows with its slot is cast from the lowest slot that drops its target, and an
 *     aura that harms the foes in it is not let go for a buff (laptop playtest 2026-10-24).
 *   - A held buff is not cast again over itself, and nothing is paid for on its own side while every
 *     foe is sealed away (cloud batch 2026-10-25).
 *   - A form held is not turned back from on its first turn to strike harder in its own shape.
 *   - A hold on the strongest foe is not traded for one on a lesser foe, and a rage is not entered
 *     with nothing to strike this turn (cloud AI fights 2026-10-25).
 *   - A creature called after the fight began is weighed like any other, not handed the first thing
 *     on its menu, and a bolt along a line is not thrown through a friend (cloud AI fights 2026-10-25).
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  RULESET_SHAPE_REVERT_ID,
  applyRulesetCombatChoice,
  createRulesetEncounter,
  parseRulesetDefinition,
  rowsFromCatalogEntry,
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetGap,
  rulesetSheetBuildSchema,
  type RulesetCatalogEntry,
  type RulesetCombatAction,
  type RulesetCombatantInput,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";
import { rulesetTakeShape } from "../../packages/shared/src/features/ruleset-combat/shape.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-ai-class-retest-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { createCombatDirector } = await import("../../packages/server/src/services/game/combat-director.service.js");
const { commandRulesetCombatDirector, pickRulesetChoice, rankRulesetChoices, rulesetEffectWorth } =
  await import("../../packages/server/src/services/game/ruleset-combat-director.service.js");

try {
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const features = [
    {
      id: "lay-on-hands",
      label: "Lay on Hands",
      rows: [
        { list: "features", values: { name: "Lay on Hands" } },
        { list: "counters", values: { name: "Lay on Hands", max: 25, recharge: "long" } },
      ],
      mechanics: {
        kind: "heal",
        targets: "ally",
        range: 0,
        amount: { flat: 1 },
        usesOf: "Lay on Hands",
        usesChosen: true,
      },
    },
    {
      id: "ki",
      label: "Ki",
      rows: [
        { list: "features", values: { name: "Ki" } },
        { list: "counters", values: { name: "Ki", max: 4, recharge: "short" } },
      ],
      mechanics: { kind: "utility", usesOf: "Ki", standard: { actions: ["dodge"], budget: "bonus" } },
    },
    {
      id: "points",
      label: "Font of Magic",
      rows: [
        { list: "features", values: { name: "Font of Magic" } },
        { list: "counters", values: { name: "Sorcery Points", max: 5, recharge: "long" } },
      ],
    },
    {
      id: "twinned",
      label: "Twinned Spell",
      rows: [{ list: "features", values: { name: "Twinned Spell" } }],
      mechanics: {
        kind: "utility",
        usesOf: "Sorcery Points",
        usesSpentByLevel: true,
        alters: { catalogs: ["spells"], twins: true },
      },
    },
  ] as unknown as RulesetCatalogEntry[];
  const spells = [
    {
      id: "firebolt",
      label: "Firebolt",
      rows: [{ list: "spells", values: { name: "Firebolt", level: 0, prepared: true } }],
      mechanics: { kind: "attack", autoHit: true, damageType: "fire", range: 120, amount: { dice: "2d10" } },
    },
  ] as unknown as RulesetCatalogEntry[];
  const doc = JSON.parse(fiveEText) as Record<string, any>;
  Object.assign(
    doc.combat.abilities.find((one: { list: string }) => one.list === "features"),
    { saveDifficulty: { derived: "spell_save_dc" }, toHit: { derived: "spell_attack" } },
  );
  doc.catalogs.push(
    { id: "classes", label: "Classes", feeds: ["features", "counters"], entries: features },
    { id: "spells", label: "Spells", feeds: ["spells"], entries: spells },
  );
  doc.combat.creatureTypes = {
    types: ["humanoid", "undead"].map((id) => ({ id, label: id })),
    default: "humanoid",
  };
  // Turned: nothing but walking away, ended by any harm; slowed: a defense lowered; frenzied: a level
  // of exhaustion as it ends.
  doc.sheet.live.conditions.push(
    { id: "turned", label: "Turned" },
    { id: "slowed", label: "Slowed" },
    { id: "warded", label: "Warded" },
    { id: "frenzied", label: "Frenzied" },
    { id: "fierce", label: "Fierce" },
    { id: "unseen", label: "Unseen" },
    { id: "tame", label: "Tame" },
    { id: "sphered", label: "Sphered" },
    { id: "beast_shaped", label: "Beast shape" },
    { id: "laughing", label: "Laughing" },
    { id: "furious", label: "Furious" },
  );
  doc.combat.conditions.push(
    {
      condition: "turned",
      effects: ["cannot-react"],
      behavior: { only: ["move", "dash"], moves: "away" },
      endsWhen: ["damaged"],
    },
    { condition: "slowed", effects: [], modifiers: [{ to: "defense", flat: -2 }] },
    { condition: "warded", effects: [], modifiers: [{ to: "defense", flat: 1 }] },
    {
      condition: "frenzied",
      effects: [],
      modifiers: [{ to: "damage", flat: 4 }],
      onEnd: { tracks: [{ track: "exhaustion", by: 1 }] },
    },
    { condition: "fierce", effects: [], modifiers: [{ to: "damage", flat: 4 }] },
    // 5e's invisible as the SRD data writes it: not seen.
    { condition: "unseen", unseen: {} },
    // A familiar's: it harms nobody.
    { condition: "tame", effects: ["cannot-harm"] },
    // Resilient Sphere's: nothing reaches in or out.
    { condition: "sphered", effects: [], sealed: {} },
    // Wild Shape's: a form taken, turned back from as a bonus action.
    { condition: "beast_shaped", effects: [], shape: { revert: "bonus" } },
    { condition: "laughing", effects: [] },
    // Rage's: it comes off as a turn ends with nobody struck.
    { condition: "furious", effects: [], modifiers: [{ to: "damage", flat: 2 }], endsIdle: true },
  );
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
  const poke = {
    id: "poke",
    name: "Poke",
    budget: "action",
    toHit: 4,
    reach: 5,
    damage: { count: 1, sides: 4, flat: 0 },
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
  const rows = (list: string) =>
    features.flatMap((entry) =>
      rowsFromCatalogEntry("classes", entry).flatMap((one) => (one.list === list ? [one.row] : [])),
    );
  const sheet = (fields: Record<string, unknown>, extra: { spells?: boolean } = {}) =>
    rulesetSheetBuildSchema.parse({
      abilities: { str: 14, dex: 14, con: 14, int: 10, wis: 12, cha: 16 },
      fields: { level: 5, ac: 15, speed: 30, hp_max: 40, spellcasting_ability: "cha", ...fields },
      lists: {
        attacks: [],
        features: rows("features"),
        counters: rows("counters"),
        ...(extra.spells
          ? { spells: spells.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((one) => one.row)) }
          : {}),
      },
    });
  type Placed = RulesetCombatantInput & { at: { x: number; y: number } };
  const fight = (placed: Placed[], controllers: Record<string, string> = {}) => {
    const encounter: RulesetEncounterState = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: placed.map(({ at: _at, ...one }) => one),
      board: {
        grid: { width: 16, height: 10, tiles: Array.from({ length: 10 }, () => Array(16).fill("plains")) },
        placements: Object.fromEntries(placed.map((one) => [one.id, one.at])),
      } as never,
    });
    encounter.order = placed.map((one) => one.id);
    encounter.turn = 0;
    const state = createCombatDirector({
      id: "fight",
      anchor: "anchor",
      style: "ruleset",
      party: placed.filter((one) => one.side === "party").map((one) => unit(one.id, "player")),
      enemies: placed.filter((one) => one.side === "enemy").map((one) => unit(one.id, "enemy")),
      gm: false,
      difficulty: "normal",
      seed: 3,
    } as never);
    state.rulesetFight = { encounter, events: [], eventSeq: 0, controllers, bosses: [], adjustments: [] } as never;
    return { encounter, state };
  };
  const ranked = (scene: ReturnType<typeof fight>, actorId: string) =>
    rankRulesetChoices(definition, scene.state, scene.encounter, actorId, 400);
  const sheetOf = (id: string, build: ReturnType<typeof sheet>, at: { x: number; y: number }, hp?: number): Placed => ({
    id,
    name: id,
    side: "party",
    build,
    live: hp === undefined ? {} : { pools: { hp: { value: hp } } },
    catalogs: { classes: features, spells },
    at,
  });

  // ── Turning only the undead, around its maker and its friends ──
  {
    const turn = {
      id: "turn",
      name: "Turn",
      budget: "action",
      targets: "any",
      area: { shape: "burst", size: 6 },
      targetTypes: { is: { types: ["undead"] } },
      save: { save: "wis_save", difficulty: 15 },
      saveDifficulty: 15,
      applies: [{ condition: "turned", duration: { rounds: 10 } }],
    };
    const dead = (id: string, at: { x: number; y: number }): Placed => ({
      id,
      name: id,
      side: "enemy",
      block: block([smash], { type: "undead", health: 22 }),
      at,
    });
    const scene = fight([
      { id: "mira", name: "mira", side: "party", block: block([poke, turn]), at: { x: 2, y: 5 } },
      { id: "ada", name: "ada", side: "party", block: block([smash]), at: { x: 2, y: 4 } },
      dead("z1", { x: 3, y: 5 }),
      dead("z2", { x: 3, y: 4 }),
      dead("z3", { x: 4, y: 6 }),
    ]);
    const choice = pickRulesetChoice(definition, scene.state, scene.encounter, "mira");
    assert.equal(choice?.option.id, "turn", `three undead turned beat a poke: ${choice?.option.id}`);
    assert.ok((choice?.denies ?? 0) > 0, "worth the blows it keeps off");
  }

  // ── Healing in as many uses as heal them ──
  {
    const scene = fight(
      [
        sheetOf("pal", sheet({ level: 5 }), { x: 2, y: 5 }),
        sheetOf("ada", sheet({ level: 5 }), { x: 3, y: 5 }, 6),
        { id: "orc", name: "orc", side: "enemy", block: block([smash]), at: { x: 12, y: 5 } },
      ],
      { ada: "manual" },
    );
    const hands = ranked(scene, "pal").find((one) => one.candidate.action.option.label === "Lay on Hands");
    assert.ok(hands, "on offer to a friend at 6 of 40");
    assert.ok((hands.candidate.healing ?? 0) > 0.5, `weighed at the points that heal her: ${hands.candidate.healing}`);
  }

  // ── Never a slot or a use on a creature somebody called (laptop playtest 2026-10-25: Wren spent two
  //    1st level slots healing the Draft Horses she had conjured) ──
  {
    const scene = fight(
      [
        sheetOf("pal", sheet({ level: 5 }), { x: 2, y: 5 }),
        sheetOf("ada", sheet({ level: 5 }), { x: 3, y: 5 }, 6),
        { id: "orc", name: "orc", side: "enemy", block: block([smash]), at: { x: 12, y: 5 } },
      ],
      { ada: "manual" },
    );
    rulesetCombatant(scene.encounter, "ada")!.calledBy = "pal";
    assert.ok(
      !ranked(scene, "pal").some((one) => one.candidate.action.option.label === "Lay on Hands"),
      "no Lay on Hands on a called creature",
    );
  }

  // ── A granted dodge, hurt and beside its foes with its action spent ──
  {
    const scene = (hp: number) => {
      const made = fight([
        sheetOf("mei", sheet({ level: 5 }), { x: 4, y: 5 }, hp),
        { id: "o1", name: "o1", side: "enemy", block: block([smash]), at: { x: 5, y: 5 } },
        { id: "o2", name: "o2", side: "enemy", block: block([smash]), at: { x: 5, y: 4 } },
      ]);
      rulesetCombatant(made.encounter, "mei")!.budgets.action = 0;
      return made;
    };
    const low = scene(8);
    const dodged = pickRulesetChoice(definition, low.state, low.encounter, "mei");
    assert.equal(dodged?.option.id, "standard:dodge@bonus", `hurt, it dodges: ${dodged?.option.id}`);
    // Dodging already, it does not dodge again (laptop party A: Patient Defense, then the Dodge).
    const again = scene(8);
    rulesetCombatant(again.encounter, "mei")!.flags.dodging = true;
    assert.notEqual(
      pickRulesetChoice(definition, again.state, again.encounter, "mei")?.option.id,
      "standard:dodge@bonus",
    );
    const whole = scene(40);
    assert.notEqual(
      pickRulesetChoice(definition, whole.state, whole.encounter, "mei")?.option.id,
      "standard:dodge@bonus",
      "whole, it does not",
    );
  }

  // ── One that can harm nobody keeps out of the fight (laptop party A 2026-10-25: the owl) ──
  {
    const scene = fight(
      [
        { id: "owl", name: "owl", side: "party", block: block([poke], { health: 1, speed: 60 }), at: { x: 2, y: 5 } },
        // Ada fights alone, where a guard would go to her.
        sheetOf("ada", sheet({ level: 5 }), { x: 10, y: 5 }),
        { id: "orc", name: "orc", side: "enemy", block: block([smash]), at: { x: 11, y: 5 } },
      ],
      { owl: "ai" },
    );
    rulesetCombatant(scene.encounter, "owl")!.tracked.push({ condition: "tame" } as never);
    assert.ok(commandRulesetCombatDirector(definition, scene.state, { type: "continue" }).ok);
    const owl = rulesetCombatant(scene.state.rulesetFight!.encounter, "owl")!;
    assert.deepEqual([owl.x, owl.y], [2, 5], "it stays where it is");
    assert.ok(
      scene.state.rulesetFight!.events.some(
        (one) => one.event.type === "reasoning" && one.event.reasons.some((reason) => reason.why === "harmless"),
      ),
      "and says why",
    );
  }

  // ── A cast of many rounds is not begun in a fight (re-test 2026-10-24: Animate Dead's 10) ──
  {
    const doom = { id: "doom", name: "Doom", budget: "action", toHit: 10, reach: 5, damage: { count: 10, sides: 10 } };
    const scene = (rounds: number) => {
      const made = fight([
        { id: "lich", name: "lich", side: "enemy", block: block([doom, poke]), at: { x: 4, y: 5 } },
        { id: "foe", name: "foe", side: "party", block: block([smash]), at: { x: 5, y: 5 } },
      ]);
      rulesetCombatant(made.encounter, "lich")!.actions.find((one) => one.id === "doom")!.castingRounds = rounds;
      return pickRulesetChoice(definition, made.state, made.encounter, "lich")?.option.id;
    };
    assert.equal(scene(1), "doom", "a cast of a round is weighed");
    assert.notEqual(scene(10), "doom", "one of ten rounds is not");
  }

  // ── Held helpless, its turn says it could not act (cloud AI fights 2026-10-25: "risk") ──
  {
    const scene = fight([
      { id: "o1", name: "o1", side: "enemy", block: block([smash]), at: { x: 5, y: 5 } },
      sheetOf("mei", sheet({ level: 5 }), { x: 4, y: 5 }),
    ]);
    rulesetCombatant(scene.encounter, "o1")!.tracked.push({ condition: "paralyzed", rounds: null });
    assert.ok(commandRulesetCombatDirector(definition, scene.state, { type: "continue" }).ok);
    const said = scene.state.rulesetFight!.events.flatMap((entry) => {
      const event = entry.event as { type: string; actorId?: string; reasons?: Array<{ why: string }> };
      return event.type === "reasoning" && event.actorId === "o1" ? event.reasons!.map((one) => one.why) : [];
    });
    assert.deepEqual(said, ["cannotAct"]);
  }
  // ── Caught unaware, the same (laptop playtest 2026-10-25: a surprised Serath "nothing worth the price") ──
  {
    const scene = fight([
      { id: "o1", name: "o1", side: "enemy", block: block([smash]), at: { x: 5, y: 5 } },
      sheetOf("mei", sheet({ level: 5 }), { x: 4, y: 5 }),
    ]);
    rulesetCombatant(scene.encounter, "o1")!.surprised = true;
    assert.ok(commandRulesetCombatDirector(definition, scene.state, { type: "continue" }).ok);
    const said = scene.state.rulesetFight!.events.flatMap((entry) => {
      const event = entry.event as { type: string; actorId?: string; reasons?: Array<{ why: string }> };
      return event.type === "reasoning" && event.actorId === "o1" ? event.reasons!.map((one) => one.why) : [];
    });
    assert.deepEqual(said, ["cannotAct"]);
    // In danger where it stands, too (laptop playtest 2026-10-25: a surprised High Priest's first turn
    // read "worth the danger it puts itself in").
    const ringed = fight([
      { id: "o1", name: "o1", side: "enemy", block: block([smash], { health: 6 }), at: { x: 5, y: 5 } },
      sheetOf("mei", sheet({ level: 5 }), { x: 4, y: 5 }),
      sheetOf("kai", sheet({ level: 5 }), { x: 6, y: 5 }),
      sheetOf("ren", sheet({ level: 5 }), { x: 5, y: 4 }),
    ]);
    rulesetCombatant(ringed.encounter, "o1")!.surprised = true;
    assert.ok(commandRulesetCombatDirector(definition, ringed.state, { type: "continue" }).ok);
    const ringedSaid = ringed.state.rulesetFight!.events.flatMap((entry) => {
      const event = entry.event as { type: string; actorId?: string; reasons?: Array<{ why: string }> };
      return event.type === "reasoning" && event.actorId === "o1" ? event.reasons!.map((one) => one.why) : [];
    });
    assert.deepEqual(ringedSaid, ["cannotAct"]);
  }

  // ── Twinned: one point, two foes ──
  {
    const scene = fight(
      [
        sheetOf("sera", sheet({ level: 5 }, { spells: true }), { x: 1, y: 5 }),
        { id: "o1", name: "o1", side: "enemy", block: block([smash], { health: 30 }), at: { x: 9, y: 4 } },
        { id: "o2", name: "o2", side: "enemy", block: block([smash], { health: 30 }), at: { x: 9, y: 6 } },
      ],
      { sera: "ai" },
    );
    const choice = pickRulesetChoice(definition, scene.state, scene.encounter, "sera");
    assert.equal(choice?.option.label, "Firebolt");
    assert.equal(choice?.choice.alters?.length, 1, `twinned: ${JSON.stringify(choice?.choice)}`);
    assert.deepEqual([...(choice?.choice.targetIds ?? [])].sort(), ["o1", "o2"]);
    assert.ok(commandRulesetCombatDirector(definition, scene.state, { type: "continue" }).ok);
    const struck = scene.state
      .rulesetFight!.events.map((entry) => entry.event as { type: string; sourceId?: string; targetId?: string })
      .filter((event) => event.type === "damage" && event.sourceId === "sera")
      .map((event) => event.targetId)
      .sort();
    assert.deepEqual(struck, ["o1", "o2"], "both struck");
  }

  // ── A self-buff that leaves exhaustion behind costs more than one that does not ──
  {
    const buff = (id: string, condition: string) => ({
      id,
      name: id,
      budget: "bonus",
      self: true,
      applies: [{ condition, duration: { rounds: 10 } }],
    });
    const scene = fight([
      {
        id: "brak",
        name: "brak",
        side: "party",
        block: block([smash, buff("frenzy", "frenzied"), buff("fury", "fierce")]),
        at: { x: 4, y: 5 },
      },
      { id: "o1", name: "o1", side: "enemy", block: block([smash]), at: { x: 5, y: 5 } },
    ]);
    const cost = (id: string) =>
      ranked(scene, "brak").find((one) => one.candidate.action.option.id === id)?.candidate.cost ?? 0;
    assert.ok(cost("frenzy") > cost("fury") + 0.4, `exhaustion is a price: ${cost("frenzy")} vs ${cost("fury")}`);
  }

  // ── A defense lowered is no support for its own side ──
  {
    const slow = {
      id: "slow",
      name: "Slow",
      budget: "action",
      range: { normal: 60 },
      targets: "enemy",
      area: { shape: "burst", size: 2 },
      save: { save: "wis_save", difficulty: 15 },
      saveDifficulty: 15,
      applies: [{ condition: "slowed", duration: { rounds: 10 } }],
    };
    const scene = fight([
      { id: "mira", name: "mira", side: "party", block: block([poke, slow]), at: { x: 2, y: 5 } },
      { id: "ada", name: "ada", side: "party", block: block([smash]), at: { x: 4, y: 5 } },
      { id: "bo", name: "bo", side: "party", block: block([smash]), at: { x: 4, y: 6 } },
      { id: "orc", name: "orc", side: "enemy", block: block([smash]), at: { x: 15, y: 0 } },
    ]);
    const support = ranked(scene, "mira").filter(
      (one) => one.candidate.action.option.id === "slow" && (one.candidate.support ?? 0) > 0,
    );
    assert.equal(support.length, 0, "never weighed as support over the party");
  }

  // ── A pattern that holds whoever it catches, never over a friend at grips (laptop party A) ──
  {
    const pattern = {
      id: "pattern",
      name: "Pattern",
      budget: "action",
      range: { normal: 60 },
      targets: "any",
      area: { shape: "burst", size: 1 },
      save: { save: "wis_save", difficulty: 15 },
      saveDifficulty: 15,
      applies: [{ condition: "incapacitated", duration: { rounds: 10 } }],
    };
    const scene = fight([
      { id: "mira", name: "mira", side: "party", block: block([poke, pattern]), at: { x: 2, y: 5 } },
      { id: "ada", name: "ada", side: "party", block: block([smash]), at: { x: 8, y: 5 } },
      { id: "orc", name: "orc", side: "enemy", block: block([smash]), at: { x: 9, y: 5 } },
    ]);
    const held = ranked(scene, "mira").filter((one) => one.candidate.action.option.id === "pattern");
    const catches = (at: { x: number; y: number } | undefined, cell: { x: number; y: number }) =>
      !!at && Math.max(Math.abs(at.x - cell.x), Math.abs(at.y - cell.y)) <= 1;
    assert.ok(held.length > 0, "cast where it catches the orc alone");
    assert.ok(
      held.every((one) => !catches(one.candidate.action.choice.at, { x: 8, y: 5 })),
      `never over Ada: ${JSON.stringify(held.map((one) => one.candidate.action.choice.at))}`,
    );
  }

  // ── A summons held, not let go for a lesser held spell ──
  {
    const call = {
      id: "call",
      label: "Call",
      kind: "utility",
      budget: "action",
      concentration: true,
      targets: { side: "self", count: 0 },
      calls: {
        block: block(
          [{ id: "bite", name: "Bite", budget: "action", toHit: 6, reach: 5, damage: { count: 0, sides: 0, flat: 7 } }],
          {
            health: 15,
          },
        ),
        name: "Wolf",
        creature: { catalogId: "creatures", entryId: "wolf" },
        count: { count: 0, sides: 0, flat: 4 },
        rounds: 10,
      },
    } as unknown as RulesetCombatAction;
    const ward = {
      id: "ward",
      label: "Ward",
      kind: "ability",
      budget: "action",
      concentration: true,
      targets: { side: "ally", count: 1 },
      applies: [{ condition: "warded", duration: { rounds: 10 } }],
    } as unknown as RulesetCombatAction;
    const scene = fight([
      { id: "mira", name: "mira", side: "party", block: block([poke]), at: { x: 2, y: 5 } },
      { id: "ada", name: "ada", side: "party", block: block([smash]), at: { x: 3, y: 5 } },
      { id: "orc", name: "orc", side: "enemy", block: block([smash], { health: 60 }), at: { x: 9, y: 5 } },
    ]);
    const mira = rulesetCombatant(scene.encounter, "mira")!;
    mira.actions.push(call, ward);
    const called = applyRulesetCombatChoice(
      definition,
      scene.encounter,
      { actorId: "mira", optionId: "call", targetIds: [] },
      () => 10,
    );
    assert.ok(!called.refused, JSON.stringify(called.refused));
    const next = called.state;
    assert.equal(next.combatants.filter((one) => one.calledBy === "mira").length, 4, "four wolves");
    rulesetCombatant(next, "mira")!.budgets.action = 1;
    (scene.state.rulesetFight as { encounter: RulesetEncounterState }).encounter = next;
    const choice = pickRulesetChoice(definition, scene.state, next, "mira");
    assert.notEqual(choice?.option.id, "ward", "the wolves are kept");
    assert.ok(
      rulesetCombatOptions(definition, next, "mira").some((one) => one.id === "ward"),
      "the ward was on offer",
    );
    // Nor for a held blow worth less than the wolves, though more than the price a caster's
    // weights put on a spell (cloud class re-test round 2: eight creatures for a Hold Person).
    const storm = {
      id: "storm",
      label: "Storm",
      kind: "attack",
      budget: "action",
      concentration: true,
      autoHit: true,
      targets: { side: "enemy", count: 1 },
      range: 120,
      damage: { count: 0, sides: 0, flat: 18, type: "lightning" },
    } as unknown as RulesetCombatAction;
    rulesetCombatant(next, "mira")!.actions.push(storm);
    assert.notEqual(
      pickRulesetChoice(definition, scene.state, next, "mira")?.option.id,
      "storm",
      "the wolves are kept",
    );
    // Nor for a hold on the foe (cloud AI fights 2026-10-25: five Draft Horses sent away for a Hold
    // Person on the Assassin, who saved).
    const hold = {
      id: "hold",
      label: "Hold",
      kind: "ability",
      budget: "action",
      concentration: true,
      targets: { side: "enemy", count: 1 },
      range: 60,
      save: { save: "wis_save", difficulty: 14, onSuccess: "negates" },
      applies: [{ condition: "paralyzed", duration: { rounds: 10 } }],
    } as unknown as RulesetCombatAction;
    rulesetCombatant(next, "mira")!.actions.splice(-1, 1, hold);
    assert.notEqual(pickRulesetChoice(definition, scene.state, next, "mira")?.option.id, "hold", "the wolves are kept");
  }

  // ── A bolt along a line is not thrown through a friend (cloud AI fights 2026-10-25: a Javelin of
  //    Lightning's bolt through Vex and the called horses) ──
  {
    const javelin = {
      id: "jav",
      name: "Javelin",
      budget: "action",
      toHit: 6,
      reach: 60,
      damage: { count: 1, sides: 6, flat: 2 },
    };
    const thrown = (vexAt: { x: number; y: number }) => {
      const scene = fight([
        { id: "grak", name: "grak", side: "party", block: block([javelin]), at: { x: 2, y: 5 } },
        { id: "vex", name: "vex", side: "party", block: block([poke]), at: vexAt },
        { id: "orc", name: "orc", side: "enemy", block: block([smash]), at: { x: 9, y: 5 } },
      ]);
      rulesetCombatant(scene.encounter, "grak")!.actions.find((one) => one.id === "jav")!.modes = [
        {
          id: "bolt",
          label: "Bolt",
          plus: [{ count: 4, sides: 6, flat: 0, type: "lightning" }],
          line: {
            amount: { count: 4, sides: 6, flat: 0 },
            type: "lightning",
            save: { save: "dex_save", difficulty: 13, onSuccess: "half" },
          },
        },
      ];
      return pickRulesetChoice(definition, scene.state, scene.encounter, "grak");
    };
    const clear = thrown({ x: 5, y: 8 });
    assert.equal(
      clear?.choice.mode,
      "bolt",
      `with nobody of its own between, the bolt: ${JSON.stringify(clear?.choice)}`,
    );
    const through = thrown({ x: 5, y: 5 });
    assert.ok(
      through?.option.id === "jav" && through.choice.mode !== "bolt",
      `a friend between, it throws the plain javelin: ${JSON.stringify(through?.choice)}`,
    );
  }
  // ── A creature called after the fight began is weighed, not handed the first thing it could do
  //    (cloud AI fights 2026-10-25: Draft Horses idled two cells from the Gladiator) ──
  {
    const call = {
      id: "call",
      label: "Call",
      kind: "utility",
      budget: "action",
      concentration: true,
      targets: { side: "self", count: 0 },
      calls: {
        block: block(
          [
            { id: "nip", name: "Nip", budget: "action", toHit: 6, reach: 5, damage: { count: 0, sides: 0, flat: 1 } },
            { id: "bite", name: "Bite", budget: "action", toHit: 6, reach: 5, damage: { count: 0, sides: 0, flat: 7 } },
          ],
          { health: 15 },
        ),
        name: "Wolf",
        creature: { catalogId: "creatures", entryId: "wolf" },
        count: { count: 0, sides: 0, flat: 1 },
        rounds: 10,
      },
    } as unknown as RulesetCombatAction;
    const scene = fight([
      { id: "mira", name: "mira", side: "party", block: block([poke]), at: { x: 2, y: 5 } },
      { id: "orc", name: "orc", side: "enemy", block: block([smash]), at: { x: 5, y: 5 } },
    ]);
    rulesetCombatant(scene.encounter, "mira")!.actions.push(call);
    const called = applyRulesetCombatChoice(
      definition,
      scene.encounter,
      { actorId: "mira", optionId: "call", targetIds: [] },
      () => 10,
    );
    assert.ok(!called.refused, JSON.stringify(called.refused));
    const wolf = called.state.combatants.find((one) => one.calledBy === "mira")!;
    assert.ok(wolf, "a wolf is called");
    assert.ok(
      ![...scene.state.party, ...scene.state.enemies].some((unit) => unit.id === wolf.id),
      "the wolf has no unit of its own",
    );
    (scene.state.rulesetFight as { encounter: RulesetEncounterState }).encounter = called.state;
    assert.ok(called.state.order.includes(wolf.id), "the wolf takes turns");
    called.state.turn = called.state.order.indexOf(wolf.id);
    const choice = pickRulesetChoice(definition, scene.state, called.state, wolf.id);
    assert.equal(choice?.option.id, "bite", `the wolf walks up and bites, not nips: ${JSON.stringify(choice?.choice)}`);
    assert.ok(choice?.to ?? choice?.choice.to, "after a walk");
  }

  // ── A hold on the strongest foe is kept, not traded for a hold on a lesser one (cloud AI fights
  //    2026-10-25: a Hold Person on the paralysed Gladiator let go to hold a Bandit) ──
  {
    const hold = {
      id: "hold",
      label: "Hold",
      kind: "ability",
      budget: "action",
      concentration: true,
      targets: { side: "enemy", count: 1 },
      range: 60,
      save: { save: "wis_save", difficulty: 14, onSuccess: "negates" },
      applies: [{ condition: "paralyzed", duration: { rounds: 10 } }],
    } as unknown as RulesetCombatAction;
    const scene = fight([
      { id: "mira", name: "mira", side: "party", block: block([poke]), at: { x: 2, y: 5 } },
      { id: "ada", name: "ada", side: "party", block: block([smash]), at: { x: 3, y: 5 } },
      { id: "boss", name: "boss", side: "enemy", block: block([smash, smash], { health: 100 }), at: { x: 9, y: 5 } },
      { id: "thug", name: "thug", side: "enemy", block: block([poke], { health: 14 }), at: { x: 9, y: 7 } },
    ]);
    rulesetCombatant(scene.encounter, "mira")!.actions.push(hold);
    const cast = applyRulesetCombatChoice(
      definition,
      scene.encounter,
      { actorId: "mira", optionId: "hold", targetIds: ["boss"] },
      () => 10,
    );
    assert.ok(!cast.refused, JSON.stringify(cast.refused));
    const next = cast.state;
    assert.ok(
      rulesetCombatant(next, "boss")!.tracked.some((one) => one.condition === "paralyzed"),
      "the boss is held",
    );
    rulesetCombatant(next, "mira")!.budgets.action = 1;
    (scene.state.rulesetFight as { encounter: RulesetEncounterState }).encounter = next;
    const choice = pickRulesetChoice(definition, scene.state, next, "mira");
    assert.ok(
      !(choice?.option.id === "hold" && choice.choice.targetIds.includes("thug")),
      `the boss stays held: ${JSON.stringify(choice)}`,
    );
  }

  // ── Rage is not entered when nothing this turn can strike a foe: it ends with the turn (cloud AI
  //    fights 2026-10-25: a Frenzy entered for a one-cell step) ──
  {
    const fury = {
      id: "fury",
      label: "Fury",
      kind: "ability",
      budget: "bonus",
      targets: { side: "self", count: 0 },
      applies: [{ condition: "furious", duration: { rounds: 10 } }],
    } as unknown as RulesetCombatAction;
    const far = fight([
      { id: "grak", name: "grak", side: "party", block: block([smash]), at: { x: 0, y: 0 } },
      { id: "orc", name: "orc", side: "enemy", block: block([smash]), at: { x: 15, y: 9 } },
    ]);
    rulesetCombatant(far.encounter, "grak")!.actions.push(fury);
    assert.ok(
      rulesetCombatOptions(definition, far.encounter, "grak").some((one) => one.id === "fury"),
      "fury is on offer",
    );
    assert.ok(
      ranked(far, "grak").every((one) => one.candidate.action.option.id !== "fury"),
      "no fury with nobody in reach",
    );
    const near = fight([
      { id: "grak", name: "grak", side: "party", block: block([smash]), at: { x: 2, y: 5 } },
      { id: "orc", name: "orc", side: "enemy", block: block([smash]), at: { x: 3, y: 5 } },
    ]);
    rulesetCombatant(near.encounter, "grak")!.actions.push(fury);
    assert.ok(
      ranked(near, "grak").some((one) => one.candidate.action.option.id === "fury"),
      "fury beside a foe",
    );
    // Already furious, raging again puts on nothing new: what goes with the fury (its damage) is
    // the fury's own (laptop playtest 2026-10-25: Ulfgar raged again while raging).
    const again = fight([
      { id: "grak", name: "grak", side: "party", block: block([smash]), at: { x: 2, y: 5 } },
      { id: "orc", name: "orc", side: "enemy", block: block([smash]), at: { x: 3, y: 5 } },
    ]);
    const grak = rulesetCombatant(again.encounter, "grak")!;
    grak.actions.push({
      ...fury,
      applies: [
        { condition: "furious", duration: { rounds: 10 } },
        { condition: "fierce", duration: { rounds: 10 }, endsWith: "furious" },
      ],
    } as unknown as RulesetCombatAction);
    grak.tracked.push({ condition: "furious", source: "grak", rounds: 9 } as never);
    const choices = ranked(again, "grak");
    assert.equal(choices.find((one) => one.candidate.action.option.id === "fury")?.candidate.setup ?? 0, 0);
    assert.notEqual(choices[0]?.candidate.action.option.id, "fury", "no fury while furious");
    // Nor another way into it while it holds, a foe in reach or not (laptop playtest 2026-10-25:
    // Ulfgar, raging by Frenzy, raged again in round 4, and the rage ended with the turn).
    for (const at of [
      { x: 3, y: 5 },
      { x: 15, y: 9 },
    ]) {
      const held = fight([
        { id: "grak", name: "grak", side: "party", block: block([smash]), at: { x: 2, y: 5 } },
        { id: "orc", name: "orc", side: "enemy", block: block([smash]), at },
      ]);
      const raging = rulesetCombatant(held.encounter, "grak")!;
      raging.actions.push(
        { ...fury, id: "frenzy", label: "Frenzy" } as unknown as RulesetCombatAction,
        {
          ...fury,
          id: "rage",
          label: "Rage",
          applies: [
            { condition: "furious", duration: { rounds: 10 } },
            { condition: "fierce", duration: { rounds: 10 }, endsWith: "furious" },
          ],
        } as unknown as RulesetCombatAction,
      );
      raging.tracked.push({ condition: "furious", source: "grak", rounds: 8 } as never);
      raging.stirred = true as never;
      const picked = pickRulesetChoice(definition, held.state, held.encounter, "grak");
      assert.ok(!["frenzy", "rage"].includes(picked?.option.id ?? ""), `no rage again: ${picked?.option.id}`);
    }
  }

  // ── A spell that grows with its slot is cast from the lowest slot that drops its target (laptop
  //    playtest 2026-10-24: a Guiding Bolt from a 3rd-level slot at a wolf, four 1st-level slots free) ──
  {
    const lance = {
      id: "lance",
      label: "Lance",
      rows: [{ list: "spells", values: { name: "Lance", level: 1, prepared: true } }],
      mechanics: {
        kind: "attack",
        autoHit: true,
        range: 120,
        amount: { dice: "4d6" },
        damageType: "radiant",
        cost: [{ pool: "slots_1", amount: 1 }],
        perCostStep: { dice: "1d6" },
      },
    } as unknown as RulesetCatalogEntry;
    const build = rulesetSheetBuildSchema.parse({
      abilities: { str: 10, dex: 10, con: 14, int: 10, wis: 16, cha: 10 },
      fields: {
        level: 5,
        ac: 16,
        speed: 30,
        hp_max: 38,
        spellcasting_ability: "wis",
        slots_max_1: 4,
        slots_max_2: 3,
        slots_max_3: 2,
      },
      lists: { spells: rowsFromCatalogEntry("spells", lance).map((one) => one.row) },
    });
    const paid = (health: number) => {
      const scene = fight([
        {
          id: "hessa",
          name: "hessa",
          side: "party",
          build,
          live: {},
          catalogs: { spells: [lance] },
          at: { x: 2, y: 5 },
        },
        { id: "wolf", name: "wolf", side: "enemy", block: block([poke], { health }), at: { x: 8, y: 5 } },
        { id: "wolf2", name: "wolf2", side: "enemy", block: block([poke], { health: 11 }), at: { x: 9, y: 2 } },
      ]);
      const choice = pickRulesetChoice(definition, scene.state, scene.encounter, "hessa");
      assert.ok(choice?.option.label.startsWith("Lance"), JSON.stringify(choice));
      return choice!.choice.payWith ?? "slots_1";
    };
    assert.equal(paid(11), "slots_1", "4d6 drops a wolf at 11: the 1st-level slot");
    // One that grows no bigger, with no 1st-level slot left, comes out of the least slot that can pay
    // (laptop 2026-10-25: an Entangle from a 3rd-level slot with 2nd-level ones free).
    const flat = {
      ...lance,
      id: "flat",
      label: "Flat",
      rows: [{ list: "spells", values: { name: "Flat", level: 1, prepared: true } }],
      mechanics: { ...(lance as unknown as { mechanics: Record<string, unknown> }).mechanics, perCostStep: undefined },
    } as unknown as RulesetCatalogEntry;
    const empty = rulesetSheetBuildSchema.parse({
      ...build,
      fields: { ...build.fields, slots_max_1: 0 },
      lists: { spells: rowsFromCatalogEntry("spells", flat).map((one) => one.row) },
    });
    const scene = fight([
      {
        id: "hessa",
        name: "hessa",
        side: "party",
        build: empty,
        live: {},
        catalogs: { spells: [flat] },
        at: { x: 2, y: 5 },
      },
      { id: "wolf", name: "wolf", side: "enemy", block: block([poke], { health: 11 }), at: { x: 8, y: 5 } },
    ]);
    const ways = ranked(scene, "hessa").filter(
      (one) => one.candidate.action.option.id.includes("flat") || one.candidate.action.option.label.startsWith("Flat"),
    );
    assert.ok(ways.length > 0, "it is offered");
    assert.deepEqual(
      [...new Set(ways.map((one) => one.candidate.action.choice.payWith))],
      ["slots_2"],
      JSON.stringify(ways.map((one) => one.candidate.action.option.label)),
    );
  }

  // ── A heal comes out of the least slot that pays for it, grown or not (cloud caster re-test
  //    2026-10-26: Healing Word from 8th, 5th and 4th level slots with 2nd and 3rd left, and from a
  //    2nd with a 1st left) ──
  {
    const mend = {
      id: "mend",
      label: "Mend",
      rows: [{ list: "spells", values: { name: "Mend", level: 1, prepared: true } }],
      mechanics: {
        kind: "heal",
        targets: "ally",
        range: 60,
        amount: { dice: "3d8" },
        cost: [{ pool: "slots_1", amount: 1 }],
        perCostStep: { dice: "1d8" },
      },
    } as unknown as RulesetCatalogEntry;
    const paidFrom = (first: number) => {
      const healer = rulesetSheetBuildSchema.parse({
        abilities: { str: 10, dex: 10, con: 14, int: 10, wis: 16, cha: 10 },
        fields: {
          level: 9,
          ac: 16,
          speed: 30,
          hp_max: 60,
          spellcasting_ability: "wis",
          slots_max_1: first,
          slots_max_2: 3,
          slots_max_3: 3,
          slots_max_4: 3,
          slots_max_5: 1,
        },
        lists: { spells: rowsFromCatalogEntry("spells", mend).map((one) => one.row) },
      });
      // Whose side it is changes nothing: the rule is the heal's.
      for (const side of ["party"] as const) {
        const scene = fight([
          {
            id: "priest",
            name: "priest",
            side,
            build: healer,
            live: {},
            catalogs: { spells: [mend] },
            at: { x: 2, y: 5 },
          },
          { id: "hurt", name: "hurt", side, block: block([poke], { health: 30 }), at: { x: 3, y: 5 } },
          {
            id: "foe",
            name: "foe",
            side: side === "party" ? "enemy" : "party",
            block: block([poke], { health: 11 }),
            at: { x: 12, y: 5 },
          },
        ]);
        const hurt = rulesetCombatant(scene.encounter, "hurt")!;
        hurt.health = { ...hurt.health!, value: 3 };
        const ways = ranked(scene, "priest").filter((one) => one.candidate.action.option.label.startsWith("Mend"));
        assert.ok(ways.length > 0, "it is offered");
        assert.deepEqual(
          [...new Set(ways.map((one) => one.candidate.action.choice.payWith ?? "slots_1"))],
          [first > 0 ? "slots_1" : "slots_2"],
          `${side}: ${JSON.stringify(ways.map((one) => one.candidate.action.option.label))}`,
        );
      }
    };
    paidFrom(4);
    paidFrom(0);
  }

  // ── One that grows every second step is never paid one step up for nothing (cloud pass
  //    2026-10-25: a Spiritual Weapon out of a 3rd-level slot, every 2nd-level one free) ──
  {
    const every = {
      id: "every",
      label: "Every",
      rows: [{ list: "spells", values: { name: "Every", level: 1, prepared: true } }],
      mechanics: {
        kind: "attack",
        autoHit: true,
        range: 120,
        amount: { dice: "1d8" },
        damageType: "force",
        cost: [{ pool: "slots_1", amount: 1 }],
        perCostStep: { dice: "1d8" },
        perCostStepsEvery: 2,
      },
    } as unknown as RulesetCatalogEntry;
    const sheet = rulesetSheetBuildSchema.parse({
      abilities: { str: 10, dex: 10, con: 14, int: 10, wis: 16, cha: 10 },
      fields: {
        level: 5,
        ac: 16,
        speed: 30,
        hp_max: 38,
        spellcasting_ability: "wis",
        slots_max_1: 4,
        slots_max_2: 3,
        slots_max_3: 2,
      },
      lists: { spells: rowsFromCatalogEntry("spells", every).map((one) => one.row) },
    });
    const scene = fight([
      {
        id: "hessa",
        name: "hessa",
        side: "party",
        build: sheet,
        live: {},
        catalogs: { spells: [every] },
        at: { x: 2, y: 5 },
      },
      { id: "wolf", name: "wolf", side: "enemy", block: block([poke], { health: 40 }), at: { x: 8, y: 5 } },
    ]);
    const pools = ranked(scene, "hessa")
      .filter((one) => one.candidate.action.option.label.startsWith("Every"))
      .map((one) => one.candidate.action.choice.payWith ?? "slots_1");
    assert.ok(pools.includes("slots_3"), `a 3rd-level slot adds a step: ${pools.join(", ")}`);
    assert.ok(!pools.includes("slots_2"), `a 2nd-level slot adds nothing: ${pools.join(", ")}`);
  }

  // ── An aura held that harms the foes in it, not let go for a buff (laptop playtest 2026-10-24:
  //    Spirit Guardians around the goblins dropped for a Bless) ──
  {
    const triggers = ["enter", "turn-start"];
    const guardians = {
      id: "guardians",
      label: "Guardians",
      kind: "attack",
      budget: "action",
      concentration: true,
      autoHit: true,
      targets: { side: "enemy", count: 0 },
      area: { shape: "burst", size: 15 },
      damage: { count: 3, sides: 8, flat: 0 },
      zone: { rounds: 100, triggers, anchor: "caster" },
    } as unknown as RulesetCombatAction;
    const rally = {
      id: "rally",
      label: "Rally",
      kind: "ability",
      budget: "action",
      concentration: true,
      targets: { side: "ally", count: 3 },
      range: 30,
      applies: [{ condition: "fierce", duration: { rounds: 10 } }],
    } as unknown as RulesetCombatAction;
    const orc = (id: string, at: { x: number; y: number }): Placed => ({
      id,
      name: id,
      side: "enemy",
      block: block([poke], { health: 20 }),
      at,
    });
    const scene = fight([
      { id: "mira", name: "mira", side: "party", block: block([poke]), at: { x: 5, y: 5 } },
      { id: "ada", name: "ada", side: "party", block: block([smash]), at: { x: 4, y: 4 } },
      { id: "bram", name: "bram", side: "party", block: block([smash]), at: { x: 4, y: 6 } },
      { id: "cid", name: "cid", side: "party", block: block([smash]), at: { x: 4, y: 5 } },
      orc("o1", { x: 6, y: 5 }),
      orc("o2", { x: 6, y: 4 }),
      orc("o3", { x: 6, y: 6 }),
    ]);
    const mira = rulesetCombatant(scene.encounter, "mira")!;
    mira.actions.push(guardians, rally);
    mira.concentrating = { actionId: "guardians", label: "Guardians" } as never;
    mira.zones = [{ actionId: "guardians", label: "Guardians", rounds: 100, anchor: "caster", triggers } as never];
    assert.ok(
      rulesetCombatOptions(definition, scene.encounter, "mira").some((one) => one.id === "rally"),
      "the rally is on offer",
    );
    assert.notEqual(
      pickRulesetChoice(definition, scene.state, scene.encounter, "mira")?.option.id,
      "rally",
      "the aura is kept",
    );
    // With nobody in it, the old price stands: a strong enough buff may still take its place.
    for (const id of ["o1", "o2", "o3"]) rulesetCombatant(scene.encounter, id)!.x = 15;
    const empty = ranked(scene, "mira").find((one) => one.candidate.action.option.id === "rally");
    const full = (() => {
      for (const [id, y] of [
        ["o1", 5],
        ["o2", 4],
        ["o3", 6],
      ] as const) {
        const one = rulesetCombatant(scene.encounter, id)!;
        one.x = 6;
        one.y = y;
      }
      return ranked(scene, "mira").find((one) => one.candidate.action.option.id === "rally");
    })();
    assert.ok(empty && full && full.score < empty.score, "dearer to let go of with foes in it");
    // One that may be moved onto a foe is dear to let go of though nobody stands in it now (laptop
    // playtest 2026-10-25: Wren let her Moonbeam go in round 2 for Conjure Animals).
    const beam = {
      ...guardians,
      id: "beam",
      label: "Beam",
      area: { shape: "burst", size: 5 },
      zone: { rounds: 10, triggers, move: { budget: "action", distance: 60 } },
    } as unknown as RulesetCombatAction;
    mira.actions.push(beam);
    mira.concentrating = { actionId: "beam", label: "Beam" } as never;
    const corner = (x: number, y: number) =>
      [
        { actionId: "beam", label: "Beam", rounds: 10, anchor: "point", at: { x, y }, cells: [{ x, y }], triggers },
      ] as never;
    mira.zones = corner(0, 0);
    const stuck = ranked(scene, "mira").find((one) => one.candidate.action.option.id === "rally");
    mira.zones = corner(0, 9);
    const unmoved = (() => {
      const saved = beam.zone!.move;
      delete (beam.zone as { move?: unknown }).move;
      const out = ranked(scene, "mira").find((one) => one.candidate.action.option.id === "rally");
      (beam.zone as { move?: unknown }).move = saved;
      return out;
    })();
    assert.ok(stuck && unmoved && stuck.score < unmoved.score, "a beam that can be moved onto a foe is kept");
  }

  // ── A lasting area that harms whoever is in it each turn is worth more than one round of its harm
  //    (laptop playtest 2026-10-25: a druid with Moonbeam cast only cantrips) ──
  {
    const flash = {
      id: "flash",
      name: "Flash",
      budget: "action",
      range: { normal: 60 },
      targets: "enemy",
      area: { shape: "burst", size: 1 },
      save: { save: "con_save", difficulty: 13 },
      saveDifficulty: 13,
      damage: { count: 2, sides: 10, flat: 0 },
    };
    const beam = {
      ...flash,
      id: "beam",
      name: "Beam",
      concentration: true,
      zone: { rounds: 10, triggers: ["enter", "turn-start"], anchor: "point", atCast: false },
    };
    const scene = fight([
      { id: "mira", name: "mira", side: "party", block: block([poke, beam, flash]), at: { x: 2, y: 5 } },
      { id: "o1", name: "o1", side: "enemy", block: block([poke], { health: 40 }), at: { x: 8, y: 5 } },
    ]);
    const damageOf = (id: string) =>
      Math.max(
        0,
        ...ranked(scene, "mira")
          .filter((one) => one.candidate.action.option.id === id)
          .map((one) => one.candidate.damage ?? 0),
      );
    assert.ok(damageOf("flash") > 0, "the plain burst is weighed");
    assert.ok(damageOf("beam") > 1.5 * damageOf("flash"), `${damageOf("beam")} against ${damageOf("flash")}`);
  }

  // ── A potion that ends on the next attack: worth one blow, so a fighter beside its foe strikes ──
  {
    const potion = {
      id: "potion",
      label: "Potion of Invisibility",
      kind: "buff",
      budget: "action",
      targets: { side: "self", count: 0 },
      applies: [{ condition: "unseen", duration: { rounds: 600 }, endsWhenHolder: { attacks: true } }],
      itemUse: { consumes: true },
    } as unknown as RulesetCombatAction;
    const scene = fight([
      { id: "pip", name: "pip", side: "party", block: block([smash]), at: { x: 4, y: 5 } },
      { id: "orc", name: "orc", side: "enemy", block: block([smash]), at: { x: 5, y: 5 } },
      { id: "orc2", name: "orc2", side: "enemy", block: block([smash]), at: { x: 5, y: 6 } },
    ]);
    rulesetCombatant(scene.encounter, "pip")!.actions.push(potion);
    const pick = pickRulesetChoice(definition, scene.state, scene.encounter, "pip");
    assert.notEqual(pick?.option.id, "potion", "the potion is not drunk for one blow at advantage");
  }

  // ── A held buff is not cast again over itself, nor any paid buff while every foe is sealed away
  //    (cloud batch 2026-10-25: Bless cast again on the same three, and over a Resilient Sphere) ──
  {
    const bless = {
      id: "bless",
      label: "Bless",
      rows: [{ list: "spells", values: { name: "Bless", level: 1, prepared: true } }],
      mechanics: {
        kind: "buff",
        targets: "ally",
        count: 3,
        range: 30,
        budget: "action",
        concentration: true,
        cost: [{ pool: "slots_1", amount: 1 }],
        applies: [{ condition: "fierce", duration: { rounds: 10 } }],
      },
    } as unknown as RulesetCatalogEntry;
    const build = rulesetSheetBuildSchema.parse({
      abilities: { str: 10, dex: 10, con: 14, int: 10, wis: 16, cha: 10 },
      fields: { level: 5, ac: 15, speed: 30, hp_max: 40, spellcasting_ability: "wis", slots_max_1: 4 },
      lists: { attacks: [], spells: rowsFromCatalogEntry("spells", bless).map((one) => one.row) },
    });
    const scene = () =>
      fight([
        { id: "mira", name: "mira", side: "party", build, live: {}, catalogs: { spells: [bless] }, at: { x: 2, y: 5 } },
        { id: "ada", name: "ada", side: "party", block: block([smash]), at: { x: 3, y: 4 } },
        { id: "bram", name: "bram", side: "party", block: block([smash]), at: { x: 3, y: 6 } },
        { id: "orc", name: "orc", side: "enemy", block: block([smash]), at: { x: 9, y: 5 } },
      ]);
    const blessing = (one: ReturnType<typeof fight>) =>
      ranked(one, "mira").find((entry) => entry.candidate.action.option.label === "Bless");
    const fresh = scene();
    const first = blessing(fresh);
    assert.ok(first, "Bless is weighed");
    const again = scene();
    const mira = rulesetCombatant(again.encounter, "mira")!;
    const blessId = mira.actions.find((one) => one.label === "Bless")!.id;
    mira.concentrating = { actionId: blessId, label: "Bless", targets: ["mira", "ada"] } as never;
    for (const id of ["mira", "ada"])
      rulesetCombatant(again.encounter, id)!.tracked.push({
        condition: "fierce",
        rounds: 10,
        sourceId: "mira",
      } as never);
    const held = blessing(again);
    assert.ok(!held || held.score < first.score, "a Bless held is not worth casting again");
    assert.notEqual(pickRulesetChoice(definition, again.state, again.encounter, "mira")?.option.label, "Bless");
    // Every foe sealed away: nothing paid for on its own side.
    const sealed = scene();
    rulesetCombatant(sealed.encounter, "orc")!.tracked.push({
      condition: "sphered",
      rounds: 10,
      sourceId: "mira",
    } as never);
    assert.equal(blessing(sealed), undefined, "no Bless while the only foe is sealed in a sphere");
  }

  // ── Sealed in a sphere, a burst it throws is worth nothing to it (cloud batch 2026-10-26: a mage in a
  //    Bead of Force's sphere cast Fireball twice at a party it could not reach) ──
  {
    const burst = {
      id: "burst",
      name: "Burst",
      budget: "action",
      targets: "enemy",
      range: 60,
      area: { shape: "burst", size: 2 },
      save: { save: "dex_save", difficulty: 15 },
      saveDifficulty: 15,
      damage: { count: 8, sides: 6, flat: 0 },
    };
    const scene = fight([
      { id: "ada", name: "ada", side: "party", block: block([smash]), at: { x: 2, y: 5 } },
      { id: "bram", name: "bram", side: "party", block: block([smash]), at: { x: 2, y: 6 } },
      { id: "mage", name: "mage", side: "enemy", block: block([burst]), at: { x: 9, y: 5 } },
    ]);
    scene.encounter.turn = 2;
    const bursts = () =>
      ranked(scene, "mage").filter(
        (one) => one.candidate.action.option.id === "burst" && (one.candidate.damage ?? 0) > 0,
      );
    assert.ok(bursts().length > 0, "free, it is worth throwing");
    rulesetCombatant(scene.encounter, "mage")!.tracked.push({
      condition: "sphered",
      rounds: 10,
      sourceId: "ada",
    } as never);
    assert.equal(bursts().length, 0, "sealed in, it reaches nobody");
  }

  // ── A form kept from before the fight is not turned back from on its first turn to strike harder
  //    in its own (cloud probes 2026-10-25: a druid's Wolf let go at once for Conjure Animals) ──
  {
    const storm = {
      id: "storm",
      name: "Storm",
      budget: "action",
      toHit: 8,
      reach: 5,
      damage: { count: 3, sides: 8, flat: 2 },
    };
    const bite = {
      id: "bite",
      name: "Bite",
      budget: "action",
      toHit: 4,
      reach: 5,
      damage: { count: 2, sides: 4, flat: 2 },
    };
    const scene = fight([
      { id: "rowan", name: "rowan", side: "party", block: block([storm]), at: { x: 4, y: 5 } },
      { id: "orc", name: "orc", side: "enemy", block: block([smash]), at: { x: 5, y: 5 } },
    ]);
    const rowan = rulesetCombatant(scene.encounter, "rowan")!;
    const rule = definition.combat!.conditions!.find((one) => one.condition === "beast_shaped")!.shape!;
    assert.ok(
      rulesetTakeShape(
        definition,
        scene.encounter,
        rowan,
        "beast_shaped",
        rule,
        { name: "Wolf", block: block([bite], { health: 11 }) } as never,
        () => 4,
      ),
    );
    rowan.tracked.push({ condition: "beast_shaped", rounds: 600, source: "rowan" } as never);
    const choices = () => ranked(scene, "rowan").map((one) => one.candidate.action.option.id);
    assert.ok(choices().includes(RULESET_SHAPE_REVERT_ID), "turning back is on offer");
    assert.notEqual(
      pickRulesetChoice(definition, scene.state, scene.encounter, "rowan")?.option.id,
      RULESET_SHAPE_REVERT_ID,
    );
    // Nearly spent, the form still has its holder's own health behind it: it goes on biting rather
    // than hiding or dodging (cloud batch 2026-10-25: a kept Wolf at 2 of 5 hid, then dodged).
    rowan.shape!.health!.value = 2;
    // As a beast thinks: it minds itself once it is hurt.
    (scene.state.party.find((unit) => unit.id === "rowan") as { tactics?: unknown }).tactics = { mind: "instinct" };
    const pick = pickRulesetChoice(definition, scene.state, scene.encounter, "rowan");
    assert.equal(pick?.option.id, "bite", JSON.stringify(pick?.option.id));
  }

  // ── One who heals does not walk up for a blow worth next to nothing (cloud neutral pass 2026-10-26:
  //    a Doctor out of First Aid crossed the board 25 times to punch for 1d3) ──
  {
    const fist = {
      id: "fist",
      name: "Fist",
      budget: "action",
      toHit: 1,
      reach: 5,
      damage: { count: 1, sides: 3, flat: 0 },
    };
    const mend = {
      id: "mend",
      name: "Mend",
      budget: "action",
      targets: "ally",
      heal: { count: 1, sides: 8, flat: 3 },
    };
    const walked = (actions: unknown[]) => {
      const scene = fight(
        [
          { id: "doc", name: "doc", side: "party", block: block(actions), at: { x: 1, y: 5 } },
          { id: "orc", name: "orc", side: "enemy", block: block([smash]), at: { x: 9, y: 5 } },
        ],
        { doc: "ai" },
      );
      assert.ok(commandRulesetCombatDirector(definition, scene.state, { type: "continue" }).ok);
      const doc = rulesetCombatant(scene.state.rulesetFight!.encounter, "doc")!;
      return doc.x !== 1 || doc.y !== 5;
    };
    assert.equal(walked([fist]), true, "a fighter walks up");
    assert.equal(walked([fist, mend]), false, "one who heals keeps back");
  }

  // ── A party half held helpless is not finished off through the held at a usual table (laptop pass 6
  //    2026-10-26: ghoul paralysis and a Hold Person wiped a party in a Moderate fight) ──
  {
    const scene = fight([
      { id: "pell", name: "pell", side: "party", block: block([poke]), at: { x: 5, y: 5 } },
      { id: "fen", name: "fen", side: "party", block: block([poke]), at: { x: 6, y: 4 } },
      { id: "orc", name: "orc", side: "enemy", block: block([smash]), at: { x: 6, y: 5 } },
    ]);
    rulesetCombatant(scene.encounter, "pell")!.tracked.push({
      condition: "paralyzed",
      rounds: 10,
      sourceId: "orc",
    } as never);
    scene.encounter.turn = 2;
    const struck = () => pickRulesetChoice(definition, scene.state, scene.encounter, "orc")?.targetId;
    assert.equal(struck(), "fen", "the one still free");
    scene.state.difficulty = "hard" as never;
    assert.equal(struck(), "pell", "a hard table's foe takes the critical");
    // A cruel one at a usual table eases off too (laptop interim 2026-10-26: the SRD's cruel ghouls).
    scene.state.difficulty = "normal" as never;
    rulesetCombatant(scene.encounter, "orc")!.temperament = "cruel" as never;
    assert.equal(struck(), "fen", "a cruel foe at a usual table");
  }
  // With only the held in reach, it walks for the one still free rather than strike the held.
  {
    const scene = fight([
      { id: "pell", name: "pell", side: "party", block: block([poke]), at: { x: 5, y: 5 } },
      { id: "fen", name: "fen", side: "party", block: block([poke]), at: { x: 11, y: 5 } },
      { id: "orc", name: "orc", side: "enemy", block: block([smash]), at: { x: 4, y: 5 } },
    ]);
    rulesetCombatant(scene.encounter, "pell")!.tracked.push({
      condition: "paralyzed",
      rounds: 10,
      sourceId: "orc",
    } as never);
    scene.encounter.turn = 2;
    const before = rulesetCombatant(scene.encounter, "orc")!;
    const gap = rulesetGap(before, rulesetCombatant(scene.encounter, "fen"));
    assert.ok(commandRulesetCombatDirector(definition, scene.state, { type: "continue" }).ok);
    const after = scene.state.rulesetFight!.encounter;
    assert.ok(rulesetGap(rulesetCombatant(after, "orc"), rulesetCombatant(after, "fen")) < gap, "it walked for fen");
  }

  // ── Nothing put on a hero already down is worth anything (cloud re-test 2026-10-26: a legendary
  //    Frightening Gaze spent twice on an unconscious hero) ──
  {
    const gaze = {
      id: "gaze",
      name: "Gaze",
      budget: "action",
      applies: [{ condition: "slowed", duration: "instant" }],
    };
    const scene = fight([
      { id: "pell", name: "pell", side: "party", block: block([poke]), at: { x: 5, y: 5 } },
      { id: "orc", name: "orc", side: "enemy", block: block([smash, gaze]), at: { x: 6, y: 5 } },
    ]);
    const orc = rulesetCombatant(scene.encounter, "orc")!;
    const pell = rulesetCombatant(scene.encounter, "pell")!;
    const action = orc.actions.find((one) => one.id === "gaze")!;
    assert.ok((rulesetEffectWorth(definition, definition.combat!, scene.encounter, orc, action, pell) ?? 0) > 0);
    pell.down = true;
    assert.equal(rulesetEffectWorth(definition, definition.combat!, scene.encounter, orc, action, pell), 0);
  }

  // ── A thinking foe goes for the healer first (Alyssa 2026-10-26: "No point in focusing Ulfgar if a
  //    Cleric is just going to Healing Word him every round and pick him right back up") ──
  {
    const mend = {
      id: "mend",
      name: "Mend",
      budget: "action",
      targets: "ally",
      heal: { count: 1, sides: 8, flat: 3 },
    };
    const struck = (mind: string, heals = true) => {
      const scene = fight([
        { id: "pell", name: "pell", side: "party", block: block([poke], { defense: 8 }), at: { x: 5, y: 5 } },
        { id: "clr", name: "clr", side: "party", block: block(heals ? [poke, mend] : [poke]), at: { x: 6, y: 4 } },
        { id: "orc", name: "orc", side: "enemy", block: block([smash]), at: { x: 6, y: 5 } },
      ]);
      (scene.state.enemies.find((one) => one.id === "orc") as { tactics?: unknown }).tactics = { mind };
      scene.encounter.turn = 2;
      return pickRulesetChoice(definition, scene.state, scene.encounter, "orc")?.targetId;
    };
    assert.equal(struck("instinct"), "pell", "a beast hits whom it hits best");
    assert.equal(struck("genius"), "clr", "a genius hits the healer");
    assert.equal(struck("genius", false), "pell", "with no healer, whom it hits best");
  }

  // ── What ends with another put on with it lasts as that one does: Hideous Laughter's incapacitated,
  //    as long as its laughing (laptop 2026-10-25: a Counterspell let it go at its own caster) ──
  {
    const scene = fight([
      { id: "vyre", name: "vyre", side: "party", block: block([poke]), at: { x: 2, y: 5 } },
      { id: "orc", name: "orc", side: "enemy", block: block([smash]), at: { x: 6, y: 5 } },
    ]);
    const vyre = rulesetCombatant(scene.encounter, "vyre")!;
    const orc = rulesetCombatant(scene.encounter, "orc")!;
    const spell = (applies: unknown[]) =>
      ({
        id: "x",
        label: "x",
        kind: "debuff",
        budget: "action",
        targets: { side: "enemy", count: 1 },
        applies,
      }) as unknown as RulesetCombatAction;
    const laughter = spell([
      { condition: "laughing", duration: "until-save" },
      { condition: "incapacitated", duration: "instant", endsWith: "laughing" },
    ]);
    const held = spell([{ condition: "incapacitated", duration: "until-save" }]);
    const worth = (action: RulesetCombatAction) =>
      rulesetEffectWorth(definition, definition.combat!, scene.encounter, vyre, action, orc) ?? 0;
    assert.ok(worth(laughter) > 0, "incapacitated for as long as the laughing is worth something");
    assert.ok(Math.abs(worth(laughter) - worth(held)) < 1e-9, "as much as the same held until a save");
  }

  console.info(
    "AI class re-test: turning by kind, chosen-use heals, granted dodges, twinned, exhaustion priced, no Slow as support, held summons kept, a one-blow potion kept, a called creature weighed, no bolt through a friend.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
