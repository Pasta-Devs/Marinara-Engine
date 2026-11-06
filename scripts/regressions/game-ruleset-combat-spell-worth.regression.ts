/**
 * What the Engine reads a spell or an ability to be worth by what it puts on whom it lands on.
 *
 *   - A paralysing hold goes on the most dangerous opponent, never on one already held or one that
 *     cannot be held; a condition worth nothing is not cast at all.
 *   - Healing is worth what is missing: no Second Wind at 35 of 44.
 *   - Healing a friend waits for a wound worth a turn, and a limited heal for below half.
 *   - A weakness is used, an immunity not wasted on, a regeneration stopped: by what a flask deals
 *     only to what its target is, and by the burning it leaves.
 *   - Oil that makes fire hurt more is thrown only where a fire will follow.
 *   - Walking up to throw is as dangerous as every blow the foes there make, a Multiattack whole.
 *   - A Counterspell is worth what it stops: a blast at the party far more than a flick.
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
  rulesetCombatant,
  rulesetHitChances,
  rulesetWindowOptions,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-spell-worth-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { createCombatDirector } = await import("../../packages/server/src/services/game/combat-director.service.js");
const { pickRulesetChoice, rankRulesetChoices, rulesetEffectWorth, rulesetStoppedWorth } =
  await import("../../packages/server/src/services/game/ruleset-combat-director.service.js");

try {
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const parsed = (document: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(document);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const definition = parsed(JSON.parse(fiveEText));
  const combat = definition.combat!;
  const block = (actions: unknown[], extra: Record<string, unknown> = {}): RulesetStatBlock =>
    ({
      health: 60,
      defense: 12,
      initiativeModifier: 0,
      speed: 30,
      abilities: { str: 10, dex: 10, con: 10, int: 16, wis: 10, cha: 10 },
      actions,
      ...extra,
    }) as unknown as RulesetStatBlock;
  const hold = {
    id: "hold",
    name: "Hold",
    budget: "action",
    range: { normal: 90 },
    save: { save: "wis_save", difficulty: 16, onSuccess: "negates" },
    applies: [{ condition: "paralyzed", duration: { rounds: 10 } }],
  };
  const flick = {
    id: "flick",
    name: "Flick",
    budget: "action",
    toHit: 6,
    range: { normal: 90 },
    damage: { count: 1, sides: 2, flat: 0 },
  };
  const smash = {
    id: "smash",
    name: "Smash",
    budget: "action",
    toHit: 8,
    reach: 1,
    damage: { count: 3, sides: 10, flat: 5 },
  };
  const poke = {
    id: "poke",
    name: "Poke",
    budget: "action",
    toHit: 2,
    reach: 1,
    damage: { count: 1, sides: 2, flat: 0 },
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
    aiHints: { proficiency: "master" as const, temperament: "disciplined" as const },
  });
  const fight = (
    blocks: Record<string, { side: "party" | "enemy"; block: RulesetStatBlock; at: { x: number; y: number } }>,
  ) => {
    const encounter: RulesetEncounterState = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: Object.entries(blocks).map(([id, one]) => ({ id, name: id, side: one.side, block: one.block })),
      board: {
        grid: { width: 14, height: 8, tiles: Array.from({ length: 8 }, () => Array(14).fill("plains")) },
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
    return { encounter, state };
  };

  // ── A hold goes on the one that matters, and only where it can take ──
  {
    const scene = (bruteExtra: Record<string, unknown> = {}) =>
      fight({
        mage: { side: "enemy", block: block([hold, flick]), at: { x: 2, y: 4 } },
        brute: { side: "party", block: block([smash], bruteExtra), at: { x: 10, y: 3 } },
        weakling: { side: "party", block: block([poke]), at: { x: 10, y: 5 } },
      });
    const { encounter, state } = scene();
    const picked = pickRulesetChoice(definition, state, encounter, "mage");
    assert.equal(picked?.option.id, "hold", JSON.stringify(picked?.choice));
    assert.equal(picked?.targetId, "brute", "the dangerous one");
    // One that cannot be paralysed is never held: the hold goes elsewhere, or the flick does.
    const immune = scene({ conditionImmunities: ["paralyzed"] });
    const other = pickRulesetChoice(definition, immune.state, immune.encounter, "mage");
    assert.ok(!(other?.option.id === "hold" && other.targetId === "brute"), JSON.stringify(other?.choice));
    // Nobody can be held: it flicks.
    const nobody = fight({
      mage: { side: "enemy", block: block([hold, flick]), at: { x: 2, y: 4 } },
      golem: { side: "party", block: block([smash], { conditionImmunities: ["paralyzed"] }), at: { x: 10, y: 3 } },
    });
    assert.equal(pickRulesetChoice(definition, nobody.state, nobody.encounter, "mage")?.option.id, "flick");
  }

  // ── Healing is worth what is missing: no Second Wind for a scratch ──
  {
    const mend = { id: "mend", name: "Mend", budget: "action", self: true, heal: { count: 1, sides: 10, flat: 5 } };
    const at = (value: number) => {
      const { encounter, state } = fight({
        brom: { side: "enemy", block: block([smash, mend], { health: 44 }), at: { x: 5, y: 4 } },
        foe: { side: "party", block: block([poke]), at: { x: 6, y: 4 } },
      });
      const brom = rulesetCombatant(encounter, "brom")!;
      brom.health = { ...brom.health!, value };
      // A steady fighter, not a reckless one that never stops to mend.
      state.enemies[0]!.tactics = {
        version: 1,
        seed: 0,
        category: "unknown",
        proficiency: "master",
        role: "bruiser",
        adjective: "disciplined",
      };
      return pickRulesetChoice(definition, state, encounter, "brom")?.option.id;
    };
    assert.equal(at(35), "smash", "at 35 of 44 it fights");
    assert.equal(at(8), "mend", "at 8 of 44 it mends");
  }

  // ── A flask is kept rather than thrown at poor odds; a bow costs nothing to miss (re-test 2026-10-24) ──
  {
    const flask = {
      id: "flask",
      name: "Flask",
      budget: "action",
      toHit: 4,
      range: { normal: 20 },
      damage: { count: 2, sides: 6, flat: 0, type: "fire" },
      uses: { per: "day", count: 2 },
    };
    const sling = {
      id: "sling",
      name: "Sling",
      budget: "action",
      toHit: 4,
      range: { normal: 30 },
      damage: { count: 1, sides: 6, flat: 2 },
    };
    const picks = (mode: "normal" | "disadvantage") => {
      const { encounter, state } = fight({
        pip: {
          side: "enemy",
          block: block([flask, sling], { health: 38 }),
          at: { x: mode === "normal" ? 5 : 7, y: 4 },
        },
        brute: { side: "party", block: block([poke], { health: 60, defense: 15 }), at: { x: 8, y: 4 } },
      });
      rulesetCombatant(encounter, "pip")!.movementLeft = 0;
      const chance = rulesetHitChances(definition, encounter, "pip", "flask", ["brute"]).brute!;
      return { chance, id: pickRulesetChoice(definition, state, encounter, "pip")?.option.id };
    };
    const fair = picks("normal");
    const poor = picks("disadvantage");
    assert.ok(poor.chance < 0.5 && fair.chance >= 0.5, `odds: ${fair.chance} then ${poor.chance}`);
    assert.equal(fair.id, "flask", "at even odds the flask, worth a little more");
    assert.equal(poor.id, "sling", "beside it, at disadvantage, the sling and the flask kept");
  }

  // ── Nor thrown at poor odds with the bonus action, at the one that hurt it (re-test 2026-10-24: Fast
  // Hands flasks thrown at disadvantage beside a troll its friend was fighting, 14 of 16) ──
  {
    const flask = {
      id: "flask",
      name: "Flask",
      budget: "bonus",
      toHit: 4,
      range: { normal: 20 },
      damage: { count: 2, sides: 6, flat: 0, type: "fire" },
      uses: { per: "day", count: 2 },
    };
    // And one that only sets something up, a net thrown to hold them (re-test 2026-10-24: oil).
    const net = {
      id: "flask",
      name: "Net",
      budget: "bonus",
      toHit: 4,
      range: { normal: 20 },
      applies: [{ condition: "restrained", duration: { rounds: 1 } }],
      uses: { per: "day", count: 2 },
    };
    const throws = (mode: "normal" | "disadvantage", thrown: Record<string, unknown> = flask) => {
      const { encounter, state } = fight({
        pip: { side: "party", block: block([thrown], { health: 38 }), at: { x: mode === "normal" ? 5 : 7, y: 4 } },
        troll: { side: "enemy", block: block([poke], { health: 84, defense: 15 }), at: { x: 8, y: 4 } },
        brom: { side: "party", block: block([poke], { health: 44 }), at: { x: 9, y: 4 } },
      });
      const pip = rulesetCombatant(encounter, "pip")!;
      pip.movementLeft = 0;
      // Its action spent on its rapier already: the bonus action is all it has left.
      pip.budgets.action = 0;
      const chance = rulesetHitChances(definition, encounter, "pip", "flask", ["troll"]).troll!;
      return { chance, id: pickRulesetChoice(definition, state, encounter, "pip")?.option.id };
    };
    const fair = throws("normal");
    const poor = throws("disadvantage");
    assert.ok(poor.chance < 0.5 && fair.chance >= 0.5, `odds: ${fair.chance} then ${poor.chance}`);
    assert.equal(fair.id, "flask", "at even odds it throws");
    assert.notEqual(poor.id, "flask", "beside it, at disadvantage, it keeps the flask");
    assert.equal(throws("normal", net).id, "flask", "a net at even odds, thrown");
    assert.notEqual(throws("disadvantage", net).id, "flask", "and kept at poor odds");
  }

  // ── At 2 health beside what could fell it, mending itself beats a heavy blow (re-test 2026-10-24) ──
  {
    const potion = {
      id: "potion",
      name: "Potion",
      budget: "action",
      self: true,
      heal: { count: 2, sides: 4, flat: 2 },
    };
    const rays = {
      id: "rays",
      name: "Rays",
      budget: "action",
      toHit: 7,
      range: { normal: 120 },
      damage: { count: 6, sides: 6, flat: 0, type: "fire" },
    };
    const maul = {
      id: "maul",
      name: "Maul",
      budget: "action",
      toHit: 6,
      reach: 1,
      damage: { count: 2, sides: 6, flat: 4 },
    };
    const { encounter, state } = fight({
      elara: { side: "enemy", block: block([rays, potion], { health: 27 }), at: { x: 5, y: 4 } },
      priest: { side: "party", block: block([maul], { health: 27 }), at: { x: 6, y: 4 } },
    });
    const elara = rulesetCombatant(encounter, "elara")!;
    elara.health = { ...elara.health!, value: 2 };
    state.enemies[0]!.tactics = {
      version: 1,
      seed: 0,
      category: "unknown",
      proficiency: "master",
      role: "spellcaster",
      adjective: "disciplined",
    };
    assert.equal(pickRulesetChoice(definition, state, encounter, "elara")?.option.id, "potion");
  }

  // ── Mending a friend waits for a wound worth a turn (I2): never at 85% ──
  {
    const cure = {
      id: "cure",
      name: "Cure",
      budget: "action",
      targets: "ally",
      range: { normal: 30 },
      heal: { count: 2, sides: 8, flat: 3 },
    };
    const at = (value: number, mends: Record<string, unknown> = cure, also: Record<string, unknown> = flick) => {
      const { encounter, state } = fight({
        priest: { side: "enemy", block: block([also, mends]), at: { x: 2, y: 4 } },
        knight: { side: "enemy", block: block([poke]), at: { x: 3, y: 4 } },
        foe: { side: "party", block: block([poke]), at: { x: 10, y: 4 } },
      });
      const knight = rulesetCombatant(encounter, "knight")!;
      knight.health = { ...knight.health!, value };
      return pickRulesetChoice(definition, state, encounter, "priest");
    };
    assert.notEqual(at(51)?.option.id, "cure", "at 51 of 60 the friend is left be");
    const hurt = at(15);
    assert.equal(hurt?.option.id, "cure", "at 15 of 60 it mends");
    assert.equal(hurt?.targetId, "knight");
    // A limited one waits for below half (I2 re-test 2026-10-23: potions drunk at 26 of 38).
    // Above half it is given only when nothing better is on offer.
    const potion = { ...cure, id: "potion", uses: { per: "day", count: 2 } };
    const bolt = { ...flick, id: "bolt", damage: { count: 1, sides: 10, flat: 0 } };
    assert.equal(at(36, potion, bolt)?.option.id, "bolt", "a limited mend kept at 36 of 60");
    assert.equal(at(36, cure, bolt)?.option.id, "cure", "where an unlimited one is given");
    // Not even with nothing better on offer (laptop 2026-10-26: a potion fed at 21 of 31, nobody down).
    assert.notEqual(at(36, potion)?.option.id, "potion", "not even with nothing better on offer");
    // Barely scratched, not even then (laptop playtest 2026-10-24: a potion drunk at 34 of 44).
    assert.notEqual(at(50, potion)?.option.id, "potion", "at 50 of 60 it is kept whatever else there is");
    assert.equal(at(26, potion, bolt)?.option.id, "potion", "and given at 26 of 60");
  }

  // ── A weakness is used, an immunity not wasted on, a regeneration stopped (I1) ──
  {
    const burn = {
      id: "burn",
      name: "Burn",
      budget: "action",
      toHit: 6,
      range: { normal: 90 },
      damage: { count: 1, sides: 10, flat: 0, type: "fire" },
    };
    const chill = {
      id: "chill",
      name: "Chill",
      budget: "action",
      toHit: 6,
      range: { normal: 90 },
      damage: { count: 1, sides: 10, flat: 1, type: "cold" },
    };
    const pick = (extra: Record<string, unknown>) => {
      const { encounter, state } = fight({
        mage: { side: "enemy", block: block([burn, chill]), at: { x: 2, y: 4 } },
        beast: { side: "party", block: block([poke], extra), at: { x: 10, y: 4 } },
      });
      return pickRulesetChoice(definition, state, encounter, "mage")?.option.id;
    };
    assert.equal(pick({}), "chill", "the harder blow, all else alike");
    assert.equal(pick({ vulnerable: ["fire"] }), "burn", "fire where fire hurts double");
    assert.equal(pick({ resist: ["cold"] }), "burn", "not cold where cold is halved");
    assert.equal(pick({ immune: ["cold"] }), "burn", "never cold where it does nothing");
    assert.equal(pick({ regenerates: { flat: 10, stoppedBy: ["fire"] } }), "burn", "fire where it stops regrowth");

    // Re-test 2026-10-23: what a flask deals only to what its target is, and a burning that deals
    // nothing on the hit but stops regrowth after, are both worth throwing where they bite.
    combat.conditions = [
      ...(combat.conditions ?? []),
      { condition: "sticky_fire", harms: { dice: "1d4", type: "fire" } },
    ] as typeof combat.conditions;
    combat.creatureTypes = { types: [{ id: "undead", label: "Undead" }], tags: [] } as typeof combat.creatureTypes;
    const holy = {
      id: "holy",
      name: "Holy",
      budget: "action",
      toHit: 6,
      range: { normal: 90 },
      damage: {
        count: 0,
        sides: 0,
        flat: 0,
        type: "radiant",
        plus: [{ count: 2, sides: 6, flat: 0, type: "radiant", targetIs: { types: ["undead"] } }],
      },
    };
    const flask = {
      id: "flask",
      name: "Flask",
      budget: "action",
      toHit: 6,
      range: { normal: 90 },
      damage: { count: 0, sides: 0, flat: 0, type: "fire" },
      applies: [{ condition: "sticky_fire", duration: "until-dispelled" }],
    };
    const thrown = (actions: unknown[], extra: Record<string, unknown>) => {
      const { encounter, state } = fight({
        mage: { side: "enemy", block: block(actions), at: { x: 2, y: 4 } },
        beast: { side: "party", block: block([poke], extra), at: { x: 10, y: 4 } },
      });
      const picked = pickRulesetChoice(definition, state, encounter, "mage");
      return picked?.option.id;
    };
    assert.equal(thrown([holy, chill], {}), "chill", "nothing of it reaches a living beast");
    assert.equal(thrown([holy, chill], { type: "undead" }), "holy", "its radiant on the undead");
    assert.equal(thrown([flask, chill], {}), "chill", "a little burning, all else alike");
    assert.equal(
      thrown([flask, chill], { regenerates: { flat: 10, stoppedBy: ["acid", "fire"] } }),
      "flask",
      "a burning that stops regrowth",
    );
  }

  // ── A short throw is not worth walking into reach of a pack's whole Multiattack (I1b) ──
  {
    const fire = {
      id: "fire",
      name: "Fire",
      budget: "action",
      toHit: 5,
      range: { normal: 20 },
      damage: { count: 1, sides: 4, flat: 0, type: "fire" },
    };
    const bow = {
      id: "bow",
      name: "Bow",
      budget: "action",
      toHit: 5,
      range: { normal: 80, long: 320 },
      damage: { count: 1, sides: 6, flat: 3, type: "piercing" },
    };
    const bite = {
      id: "bite",
      name: "Bite",
      budget: "action",
      toHit: 7,
      reach: 1,
      damage: { count: 1, sides: 6, flat: 4 },
    };
    const claw = {
      id: "claw",
      name: "Claw",
      budget: "action",
      toHit: 7,
      reach: 1,
      damage: { count: 2, sides: 6, flat: 4 },
    };
    const multiattack = {
      id: "multiattack",
      name: "Multiattack",
      budget: "action",
      sequence: [
        { action: "bite", times: 1 },
        { action: "claw", times: 2 },
      ],
    };
    const troll = (at: { x: number; y: number }, actions: unknown[]) => ({
      side: "party" as const,
      block: block(actions, { health: 84, regenerates: { flat: 10, stoppedBy: ["acid", "fire"] } }),
      at,
    });
    // The danger of walking up to throw, as the trolls would strike there: each with all it has.
    const walkUp = (actions: unknown[]) => {
      const { encounter, state } = fight({
        thrower: { side: "enemy", block: block([fire, bow], { health: 38 }), at: { x: 1, y: 4 } },
        troll0: troll({ x: 11, y: 3 }, actions),
        troll1: troll({ x: 11, y: 5 }, actions),
      });
      const ranked = rankRulesetChoices(definition, state, encounter, "thrower", 400);
      return Math.max(
        ...ranked.filter((one) => one.candidate.action.option.id === "fire").map((one) => one.candidate.risk ?? 0),
      );
    };
    const blows = walkUp([bite, claw, multiattack]);
    const one = walkUp([bite, claw]);
    assert.ok(blows > one * 2, `a Multiattack counts every blow of it: ${blows} against ${one}`);

    // Walking up to throw, it throws from out of a troll's long reach, not from inside it (I1b
    // re-test 2026-10-24: 10 of 12 throws made from within a troll's reach).
    const dart = { ...fire, id: "dart", name: "Dart", range: { normal: 25 } };
    const longClaw = { ...claw, reach: 10 };
    const { encounter, state } = fight({
      thrower: { side: "enemy", block: block([dart], { health: 38 }), at: { x: 3, y: 4 } },
      troll0: troll({ x: 11, y: 4 }, [bite, longClaw]),
    });
    const picked = pickRulesetChoice(definition, state, encounter, "thrower");
    assert.equal(picked?.option.id, "dart", "it throws");
    assert.ok(picked?.to, "it walks up first");
    const gap = Math.max(Math.abs(picked.to.x - 11), Math.abs(picked.to.y - 4));
    assert.ok(gap > 2, `out of the claw's reach: ${JSON.stringify(picked.to)}`);
    // And a throw from inside that reach is read as clearly riskier than the same throw a step
    // outside it, not as "a walk away" alike.
    const riskAt = (gapWanted: number) =>
      Math.max(
        ...rankRulesetChoices(definition, state, encounter, "thrower", 400)
          .filter(
            (one) =>
              one.candidate.action.option.id === "dart" &&
              one.candidate.action.to &&
              Math.max(Math.abs(one.candidate.action.to.x - 11), Math.abs(one.candidate.action.to.y - 4)) === gapWanted,
          )
          .map((one) => one.candidate.risk ?? 0),
      );
    assert.ok(riskAt(2) > riskAt(3) * 1.2, `inside the reach ${riskAt(2)} against outside ${riskAt(3)}`);

    // Standing up for a friend a troll is on is worth less to one the trolls could fell in a turn
    // than to one who can take it (I1b re-test 2026-10-24: Pip walked into two trolls to stand up
    // for Brom, every fight).
    const stab = {
      id: "stab",
      name: "Stab",
      budget: "action",
      toHit: 5,
      reach: 1,
      damage: { count: 1, sides: 8, flat: 3 },
    };
    const standsUp = (health: number) => {
      const { encounter, state } = fight({
        rogue: { side: "enemy", block: block([stab], { health }), at: { x: 3, y: 4 } },
        fighter: { side: "enemy", block: block([stab], { health: 120 }), at: { x: 8, y: 4 } },
        troll0: troll({ x: 9, y: 4 }, [bite, longClaw]),
        troll1: troll({ x: 9, y: 5 }, [bite, longClaw]),
      });
      return Math.max(
        ...rankRulesetChoices(definition, state, encounter, "rogue", 400)
          .filter((one) => one.candidate.action.option.id === "stab")
          .map((one) => one.candidate.protection ?? 0),
      );
    };
    assert.ok(standsUp(38) < standsUp(400) * 0.75, `frail ${standsUp(38)} against sturdy ${standsUp(400)}`);
  }

  // ── A hazard is laid where the other side will walk into it (I3 re-test 2026-10-23) ──
  {
    const caltrops = {
      id: "caltrops",
      label: "Caltrops",
      kind: "attack",
      budget: "action",
      targets: { side: "enemy", count: 1 },
      range: { normal: 1 },
      area: { shape: "box", size: 1 },
      save: { save: "dex_save", difficulty: 15, onSuccess: "negates" },
      damage: { count: 0, sides: 0, flat: 1, type: "piercing" },
      applies: [{ condition: "restrained", duration: "until-dispelled" }],
      zone: { rounds: 100, triggers: ["enter"], atCast: false },
    };
    const laid = (wolves: Array<{ x: number; y: number }>) => {
      const { encounter, state } = fight({
        rogue: { side: "enemy", block: block([flick]), at: { x: 2, y: 4 } },
        friend: { side: "enemy", block: block([poke]), at: { x: 2, y: 5 } },
        ...Object.fromEntries(
          wolves.map((at, index) => [
            `wolf${index}`,
            { side: "party" as const, block: block([poke], { speed: 40 }), at },
          ]),
        ),
      });
      rulesetCombatant(encounter, "rogue")!.actions.push(caltrops as never);
      return pickRulesetChoice(definition, state, encounter, "rogue");
    };
    const charging = laid([
      { x: 9, y: 4 },
      { x: 10, y: 3 },
      { x: 10, y: 5 },
    ]);
    assert.equal(charging?.option.id, "caltrops", "laid before a charging pack");
    // Somewhere the pack will cross before it reaches the rogue, never under a wolf already there.
    assert.ok((charging?.choice.at?.x ?? 99) <= 5, `in its way: ${JSON.stringify(charging?.choice.at)}`);
    assert.notEqual(laid([{ x: 3, y: 4 }])?.option.id, "caltrops", "not once the pack is at grips");
    // Nor before foes that shoot from where they stand: they never walk in (AI pass 2026-10-24: oil and
    // caltrops laid before two mages eleven squares off).
    const shooters = (() => {
      const bolt = { ...flick, id: "bolt", name: "Bolt", range: { normal: 120 } };
      const { encounter, state } = fight({
        rogue: { side: "enemy", block: block([flick]), at: { x: 2, y: 4 } },
        friend: { side: "enemy", block: block([poke]), at: { x: 2, y: 5 } },
        mage0: { side: "party", block: block([poke, bolt], { speed: 40 }), at: { x: 9, y: 4 } },
        mage1: { side: "party", block: block([poke, bolt], { speed: 40 }), at: { x: 10, y: 3 } },
        mage2: { side: "party", block: block([poke, bolt], { speed: 40 }), at: { x: 10, y: 5 } },
      });
      rulesetCombatant(encounter, "rogue")!.actions.push(caltrops as never);
      return pickRulesetChoice(definition, state, encounter, "rogue");
    })();
    assert.notEqual(shooters?.option.id, "caltrops", `not before shooters: ${JSON.stringify(shooters?.choice)}`);
    // Never on the ground its own side walks first, out toward slower foes (re-test 2026-10-23: the
    // party stepped on its own caltrops four squares ahead of it).
    const slow = (() => {
      const { encounter, state } = fight({
        rogue: { side: "enemy", block: block([flick]), at: { x: 1, y: 4 } },
        friend: { side: "enemy", block: block([poke]), at: { x: 6, y: 4 } },
        goblin0: { side: "party", block: block([poke]), at: { x: 13, y: 4 } },
        goblin1: { side: "party", block: block([poke]), at: { x: 13, y: 3 } },
      });
      rulesetCombatant(encounter, "rogue")!.actions.push({ ...caltrops, range: { normal: 10 } } as never);
      return pickRulesetChoice(definition, state, encounter, "rogue");
    })();
    if (slow?.option.id === "caltrops")
      assert.ok((slow.choice.at?.x ?? 0) >= 7, `not before its own fighter: ${JSON.stringify(slow.choice.at)}`);
  }

  // ── Oil is worth throwing only where a fire will follow ──
  {
    combat.conditions = [
      ...(combat.conditions ?? []),
      { condition: "oiled", modifiers: [{ to: "damage-taken", damageType: "fire", flat: 5 }] },
    ] as typeof combat.conditions;
    const rapier = {
      id: "rapier",
      name: "Rapier",
      budget: "action",
      toHit: 5,
      reach: 1,
      damage: { count: 1, sides: 8, flat: 3, type: "piercing" },
    };
    const oil = {
      id: "oil",
      name: "Lamp oil",
      budget: "action",
      toHit: 5,
      range: { normal: 20 },
      applies: [{ condition: "oiled", duration: { rounds: 10 } }],
    };
    const torch = {
      id: "torch",
      name: "Torch",
      budget: "action",
      toHit: 5,
      reach: 1,
      damage: { count: 1, sides: 4, flat: 0, type: "fire" },
    };
    const pick = (withFire: boolean) => {
      const { encounter, state } = fight({
        vex: { side: "enemy", block: block([rapier, oil]), at: { x: 5, y: 4 } },
        ...(withFire ? { torcher: { side: "enemy" as const, block: block([torch]), at: { x: 5, y: 2 } } } : {}),
        foe: { side: "party", block: block([poke]), at: { x: 6, y: 4 } },
      });
      state.enemies.find((one) => one.id === "vex")!.tactics = {
        version: 1,
        seed: 0,
        category: "unknown",
        proficiency: "master",
        role: "skirmisher",
        adjective: "methodical",
      };
      const vex = rulesetCombatant(encounter, "vex")!;
      const worth = rulesetEffectWorth(
        definition,
        combat,
        encounter,
        vex,
        vex.actions.find((action) => action.id === "oil"),
        rulesetCombatant(encounter, "foe")!,
      );
      return { worth, picked: pickRulesetChoice(definition, state, encounter, "vex")?.option.id };
    };
    const dry = pick(false);
    assert.equal(dry.worth, 0, "no fire on its side: oil does nothing worth a turn");
    assert.notEqual(dry.picked, "oil", "so it stays in the pack");
    assert.ok((pick(true).worth ?? 0) > 0, "a torch beside it: oil is worth something");
  }

  // ── Help held on its own side is not cast again, nor let go for other help; and what only adds to
  // ability checks is worth nothing in a fight (cloud caster bosses 2026-10-26: a priest's legendary
  // Guidance cast on itself three times a round, and over its Bless) ──
  {
    definition.combat!.conditions!.push({ condition: "guided", modifiers: [{ to: "checks", dice: "1d4" }] } as never);
    const ward = {
      id: "ward",
      name: "Ward",
      budget: "action",
      targets: "ally",
      range: { normal: 30 },
      applies: [{ condition: "parrying", duration: { rounds: 10 } }],
      concentration: true,
    };
    const guide = { ...ward, id: "guide", name: "Guide", applies: [{ condition: "guided", duration: { rounds: 10 } }] };
    const { encounter, state } = fight({
      priest: { side: "enemy", block: block([ward, guide, flick]), at: { x: 2, y: 4 } },
      knight: { side: "enemy", block: block([poke]), at: { x: 3, y: 4 } },
      foe: { side: "party", block: block([poke]), at: { x: 10, y: 4 } },
    });
    const priest = rulesetCombatant(encounter, "priest")!;
    const guideAction = priest.actions.find((one) => one.label === "Guide")!;
    assert.ok(
      !(
        (rulesetEffectWorth(
          definition,
          combat,
          encounter,
          priest,
          guideAction,
          rulesetCombatant(encounter, "knight")!,
        ) ?? 0) > 0
      ),
      "a die on ability checks does nothing in a fight",
    );
    const wardId = priest.actions.find((one) => one.label === "Ward")!.id;
    priest.concentrating = { actionId: wardId, label: "Ward" } as never;
    rulesetCombatant(encounter, "knight")!.tracked.push({
      condition: "parrying",
      rounds: 10,
      source: "priest",
      concentration: true,
      action: [wardId],
    } as never);
    const ranked = rankRulesetChoices(definition, state, encounter, "priest", 50).map(
      (one) => one.candidate.action.option.label,
    );
    assert.ok(!ranked.includes("Ward") && !ranked.includes("Guide"), `the ward is kept: ${ranked.join(", ")}`);
    definition.combat!.conditions!.pop();
  }

  // ── A Counterspell is worth what it stops ──
  {
    const counter = {
      id: "counter",
      name: "Counter",
      budget: "reaction",
      range: { normal: 120 },
      reaction: { on: "aimed", cancels: true },
    };
    const blast = {
      id: "blast",
      name: "Blast",
      budget: "action",
      range: { normal: 150 },
      area: { shape: "burst", size: 20 },
      save: { save: "dex_save", difficulty: 15, onSuccess: "half" },
      damage: { count: 8, sides: 6, flat: 0 },
    };
    const worth = (optionId: string, choice: Record<string, unknown>) => {
      const { encounter } = fight({
        caster: { side: "enemy", block: block([blast, flick]), at: { x: 2, y: 4 } },
        mage: { side: "party", block: block([counter, flick]), at: { x: 10, y: 3 } },
        fighter: { side: "party", block: block([smash]), at: { x: 10, y: 5 } },
      });
      encounter.order = ["caster", "mage", "fighter"];
      const step = applyRulesetCombatChoice(
        definition,
        encounter,
        { actorId: "caster", optionId, targetIds: [], ...choice },
        () => 10,
      );
      assert.equal(step.state.window?.kind, "reaction", JSON.stringify(step.events.slice(-3)));
      assert.deepEqual(step.state.window?.waiting, ["mage"]);
      assert.ok(rulesetWindowOptions(definition, step.state, "mage").some((one) => one.id === "counter"));
      return rulesetStoppedWorth(definition, combat, step.state, rulesetCombatant(step.state, "mage")!);
    };
    const small = worth("flick", { targetIds: ["mage"] });
    const big = worth("blast", { at: { x: 10, y: 4 } });
    assert.ok(big > 0.8, `a blast over the party is worth stopping: ${big}`);
    assert.ok(small < 0.1, `a flick is not: ${small}`);

    // A creature's Counterspell, written as one it casts on itself and aimed back at the cast, is
    // taken against the blast and let go against the flick, by a reckless caster as by any other.
    const own = {
      ...counter,
      targets: { side: "self", count: 0 },
      reaction: { on: "aimed", at: "source", cancels: true },
    };
    const answer = (optionId: string, choice: Record<string, unknown>) => {
      const { encounter, state } = fight({
        caster: { side: "enemy", block: block([blast, flick]), at: { x: 2, y: 4 } },
        mage: { side: "party", block: block([own, flick]), at: { x: 10, y: 3 } },
        fighter: { side: "party", block: block([smash]), at: { x: 10, y: 5 } },
      });
      state.party.find((one) => one.id === "mage")!.aiHints = { proficiency: "master", temperament: "reckless" };
      encounter.order = ["caster", "mage", "fighter"];
      const step = applyRulesetCombatChoice(
        definition,
        encounter,
        { actorId: "caster", optionId, targetIds: [], ...choice },
        () => 10,
      );
      const menu = rulesetWindowOptions(definition, step.state, "mage");
      return pickRulesetChoice(definition, state, step.state, "mage", menu)?.choice.optionId;
    };
    assert.equal(answer("blast", { at: { x: 10, y: 4 } }), "counter", "the blast is stopped");
    assert.notEqual(answer("flick", { targetIds: ["mage"] }), "counter", "the flick is let through");

    // Priced by the level of what it stops: a 3rd-level answer is thrown at a cantrip only to keep
    // its thrower alive, and at a 3rd-level blast whenever the blast is worth it.
    const zap = {
      id: "zap",
      name: "Zap",
      budget: "action",
      toHit: 20,
      range: { normal: 90 },
      damage: { count: 3, sides: 10, flat: 10 },
    };
    const priced = (optionId: string, choice: Record<string, unknown>, health: number) => {
      const { encounter, state } = fight({
        caster: { side: "enemy", block: block([blast, zap]), at: { x: 2, y: 4 } },
        mage: { side: "party", block: block([own, flick]), at: { x: 10, y: 3 } },
        fighter: { side: "party", block: block([smash]), at: { x: 10, y: 5 } },
      });
      state.party.find((one) => one.id === "mage")!.aiHints = { proficiency: "master", temperament: "disciplined" };
      const mage = rulesetCombatant(encounter, "mage")!;
      mage.health = { ...mage.health!, value: health };
      mage.actions.find((action) => action.id === "counter")!.castLevel = 3;
      rulesetCombatant(encounter, "caster")!.actions.find((action) => action.id === "blast")!.castLevel = 3;
      encounter.order = ["caster", "mage", "fighter"];
      const step = applyRulesetCombatChoice(
        definition,
        encounter,
        { actorId: "caster", optionId, targetIds: [], ...choice },
        () => 10,
      );
      const menu = rulesetWindowOptions(definition, step.state, "mage");
      return pickRulesetChoice(definition, state, step.state, "mage", menu)?.choice.optionId;
    };
    assert.notEqual(priced("zap", { targetIds: ["mage"] }, 40), "counter", "a cantrip it lives through is let by");
    assert.equal(priced("zap", { targetIds: ["mage"] }, 20), "counter", "a cantrip that would kill it is stopped");
    assert.equal(priced("blast", { at: { x: 10, y: 4 } }, 60), "counter", "the 3rd-level blast is stopped");
    // A stat block's answer of no level but only so many uses is as dear (laptop 2026-10-25: a
    // battle-mage's Counterspell thrown at a Fire Bolt it would have lived through).
    {
      const { encounter, state } = fight({
        caster: { side: "enemy", block: block([zap]), at: { x: 2, y: 4 } },
        mage: { side: "party", block: block([{ ...own, uses: { count: 1, per: "day" } }, flick]), at: { x: 10, y: 3 } },
        fighter: { side: "party", block: block([smash]), at: { x: 10, y: 5 } },
      });
      state.party.find((one) => one.id === "mage")!.aiHints = { proficiency: "master", temperament: "disciplined" };
      const mage = rulesetCombatant(encounter, "mage")!;
      // Out of reach of the most the zap can roll (40).
      mage.health = { value: 50, max: 60, temp: 0 };
      encounter.order = ["caster", "mage", "fighter"];
      const step = applyRulesetCombatChoice(
        definition,
        encounter,
        { actorId: "caster", optionId: "zap", targetIds: ["mage"] },
        () => 10,
      );
      const menu = rulesetWindowOptions(definition, step.state, "mage");
      assert.ok(
        menu.some((one) => one.id === "counter"),
        "it may answer",
      );
      assert.notEqual(pickRulesetChoice(definition, state, step.state, "mage", menu)?.choice.optionId, "counter");
    }
    // Held down itself weighs half again what holding a friend does.
    const holding = (target: string) => {
      const { encounter } = fight({
        caster: { side: "enemy", block: block([hold]), at: { x: 2, y: 4 } },
        mage: { side: "party", block: block([counter, flick]), at: { x: 10, y: 3 } },
        fighter: { side: "party", block: block([smash]), at: { x: 10, y: 5 } },
      });
      encounter.order = ["caster", "mage", "fighter"];
      const step = applyRulesetCombatChoice(
        definition,
        encounter,
        { actorId: "caster", optionId: "hold", targetIds: [target] },
        () => 10,
      );
      return rulesetStoppedWorth(definition, combat, step.state, rulesetCombatant(step.state, "mage")!);
    };
    const self = holding("mage");
    const friend = holding("fighter");
    assert.ok(self > friend * 1.2, `held itself ${self}, a friend held ${friend}`);
  }

  // ── A blast over its own side is never worth one nearly dead foe ──
  {
    const fireball = {
      id: "fireball",
      name: "Fireball",
      budget: "action",
      range: { normal: 150 },
      area: { shape: "burst", size: 20 },
      save: { save: "dex_save", difficulty: 15, onSuccess: "half" },
      damage: { count: 8, sides: 6, flat: 0 },
    };
    const { encounter, state } = fight({
      mage: { side: "enemy", block: block([fireball, flick]), at: { x: 2, y: 4 } },
      other: { side: "enemy", block: block([flick]), at: { x: 9, y: 4 } },
      cleric: { side: "party", block: block([poke]), at: { x: 10, y: 4 } },
      fighter: { side: "party", block: block([smash]), at: { x: 13, y: 0 } },
    });
    const cleric = rulesetCombatant(encounter, "cleric")!;
    cleric.health = { ...cleric.health!, value: 3 };
    const picked = pickRulesetChoice(definition, state, encounter, "mage");
    const at = picked?.choice.at;
    assert.ok(
      picked?.option.id !== "fireball" || !at || Math.max(Math.abs(at.x - 9), Math.abs(at.y - 4)) > 4,
      `no Fireball over its friend to finish one at 3 health: ${JSON.stringify(picked?.choice)}`,
    );
  }

  // ── Never an area over a friend at grips with the foes, harm or hold (laptop 2026-10-25: a
  // Hypnotic Pattern and a Call Lightning over the fighter beside the Alpha) ──
  for (const area of [
    {
      id: "blast",
      name: "Blast",
      budget: "action",
      range: { normal: 150 },
      area: { shape: "burst", size: 20 },
      save: { save: "dex_save", difficulty: 15, onSuccess: "half" },
      damage: { count: 8, sides: 6, flat: 0 },
    },
    {
      id: "pattern",
      name: "Pattern",
      budget: "action",
      range: { normal: 120 },
      area: { shape: "burst", size: 20 },
      save: { save: "wis_save", difficulty: 16, onSuccess: "negates" },
      applies: [{ condition: "paralyzed", duration: { rounds: 10 } }],
    },
  ]) {
    const { encounter, state } = fight({
      mage: { side: "enemy", block: block([area, flick]), at: { x: 2, y: 4 } },
      guard: { side: "enemy", block: block([smash]), at: { x: 10, y: 4 } },
      brute: { side: "party", block: block([smash]), at: { x: 11, y: 4 } },
      second: { side: "party", block: block([smash]), at: { x: 11, y: 3 } },
      third: { side: "party", block: block([smash]), at: { x: 12, y: 5 } },
    });
    const picked = pickRulesetChoice(definition, state, encounter, "mage");
    assert.notEqual(picked?.option.id, area.id, `no ${area.name} over its guard: ${JSON.stringify(picked?.choice)}`);
  }

  // ── A held hold over two is not let go to hold one (laptop 2026-10-25: a Hypnotic Pattern on
  // two wolves dropped, and a new slot spent, to cast it again on the duelist alone) ──
  {
    const pattern = {
      id: "pattern",
      name: "Pattern",
      budget: "action",
      range: { normal: 120 },
      area: { shape: "burst", size: 10 },
      save: { save: "wis_save", difficulty: 16, onSuccess: "negates" },
      applies: [{ condition: "paralyzed", duration: { rounds: 10 } }],
      concentration: true,
    };
    const single = { ...hold, id: "single", name: "Single", concentration: true };
    const { encounter, state } = fight({
      mage: { side: "enemy", block: block([pattern, single, flick]), at: { x: 2, y: 4 } },
      wolf1: { side: "party", block: block([smash]), at: { x: 10, y: 1 } },
      wolf2: { side: "party", block: block([smash]), at: { x: 11, y: 1 } },
      duelist: { side: "party", block: block([smash]), at: { x: 9, y: 6 } },
    });
    const mage = rulesetCombatant(encounter, "mage")!;
    const patternId = mage.actions.find((one) => one.label === "Pattern")!.id;
    mage.concentrating = { actionId: patternId, label: "Pattern", targets: ["wolf1", "wolf2"] } as never;
    for (const id of ["wolf1", "wolf2"])
      rulesetCombatant(encounter, id)!.tracked.push({ condition: "paralyzed", rounds: 10, sourceId: "mage" } as never);
    const picked = pickRulesetChoice(definition, state, encounter, "mage");
    assert.ok(
      picked?.option.label !== "Pattern" && picked?.option.label !== "Single",
      `the two held are kept: ${picked?.option.label} ${JSON.stringify(picked?.choice)}`,
    );
    // ── Nor cast again over itself while it holds one, whoever else it would catch (cloud caster
    // re-test 2026-10-25: Hypnotic Pattern cast over its own pattern in five rounds of seven) ──
    for (const id of ["wolf1", "wolf2"]) rulesetCombatant(encounter, id)!.tracked = [];
    mage.concentrating = { actionId: patternId, label: "Pattern" } as never;
    rulesetCombatant(encounter, "wolf1")!.tracked.push({
      condition: "paralyzed",
      rounds: 10,
      source: "mage",
      concentration: true,
      action: [patternId],
    } as never);
    const again = pickRulesetChoice(definition, state, encounter, "mage");
    assert.notEqual(again?.option.label, "Pattern", `not cast over itself: ${JSON.stringify(again?.choice)}`);
    // ── Nor any other held spell, which would let them go just the same (cloud caster re-test
    // 2026-10-26: Greater Invisibility cast over a Hypnotic Pattern still holding two) ──
    const held = rankRulesetChoices(definition, state, encounter, "mage", 50).map(
      (one) => one.candidate.action.option.label,
    );
    assert.ok(
      !held.includes("Pattern") && !held.includes("Single"),
      `no held spell over one that holds a foe: ${held.join(", ")}`,
    );
    // ── What one threw off before is worth half as much cast at it again by the same caster, each
    // time (laptop pass 5 2026-10-26: Hold Person cast four times at one who saved each time) ──
    delete (mage as { concentrating?: unknown }).concentrating;
    rulesetCombatant(encounter, "wolf1")!.tracked = [];
    const singleId = mage.actions.find((one) => one.label === "Single")!.id;
    const setupOn = () =>
      rankRulesetChoices(definition, state, encounter, "mage", 50).find(
        (one) => one.candidate.action.option.label === "Single" && one.candidate.targetId === "duelist",
      )?.candidate.setup ?? 0;
    const fresh = setupOn();
    assert.ok(fresh > 0, "a hold on the duelist is worth something");
    rulesetCombatant(encounter, "duelist")!.shookOff = { [`mage/${singleId}`]: 2 };
    assert.ok(Math.abs(setupOn() - fresh / 4) < 1e-9, `thrown off twice, a quarter: ${setupOn()} of ${fresh}`);
  }

  console.log(
    "Spell worth: a hold goes on the most dangerous opponent and never on one that cannot be held; healing is worth what is missing; oil waits for a fire; a Counterspell is worth what it stops.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
