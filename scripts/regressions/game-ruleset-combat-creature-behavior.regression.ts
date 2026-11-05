/**
 * How a creature goes about a fight, as its own data says (Capability API 1.763).
 *
 *   - `behavior` on `combat`, a creature type and a stat block, merged key by key, the creature's own
 *     winning; its temperament and role over the dealt ones, unless the Game Master gave one.
 *   - `targets`: casters, whoever hurt it; `pack`: whoever a friend stands beside.
 *   - `opens`: its opener on its first turn, and only once.
 *   - `ambush`: a bestiary creature keeps still out of reach and springs once its prey comes close.
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
  defaultRulesetSheetBuild,
  parseRulesetDefinition,
  rulesetCombatant,
  rulesetCombatantBehavior,
  rulesetCombatantRole,
  rulesetEncounterSummary,
  supportedCapabilityApi,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-creature-behavior-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");
const { createCombatDirector } = await import("../../packages/server/src/services/game/combat-director.service.js");
const {
  commandRulesetCombatDirector,
  createRulesetFight,
  directedRulesetView,
  pickRulesetChoice,
  rulesetDirectorStage,
  syncRulesetCombatants,
} = await import("../../packages/server/src/services/game/ruleset-combat-director.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 763);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const fiveE = (edit?: (doc: Record<string, any>) => void): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    edit?.(doc);
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
  const lurkerEntry = (doc: Record<string, any>) =>
    doc.catalogs
      .find((one: { holds?: string }) => one.holds === "creatures")
      .entries.find((one: { id: string }) => one.id === "thorn-lurker").creature;

  // ── Merged key by key ──
  const definition = parsed(
    fiveE((doc) => {
      doc.combat.behavior = { targets: ["nearest"], temperament: "disciplined" };
      doc.combat.creatureTypes = {
        types: [{ id: "beast", label: "Beast", behavior: { pack: true, temperament: "reckless" } }],
      };
      lurkerEntry(doc).behavior = { temperament: "cautious", ambush: true };
    }),
  );
  const combat = definition.combat!;
  const block = (actions: unknown[], extra: Record<string, unknown> = {}): RulesetStatBlock =>
    ({
      health: 60,
      defense: 12,
      initiativeModifier: 0,
      speed: 30,
      abilities: { str: 10, dex: 10, con: 10, int: 12, wis: 10, cha: 10 },
      actions,
      ...extra,
    }) as unknown as RulesetStatBlock;
  const bolt = {
    id: "bolt",
    name: "Bolt",
    budget: "action",
    toHit: 6,
    range: { normal: 90 },
    damage: { count: 2, sides: 6, flat: 0 },
  };
  const smash = {
    id: "smash",
    name: "Smash",
    budget: "action",
    toHit: 6,
    reach: 1,
    damage: { count: 3, sides: 10, flat: 5 },
  };
  const spark = {
    id: "spark",
    name: "Spark",
    budget: "action",
    range: { normal: 60 },
    save: { save: "dex_save", difficulty: 12, onSuccess: "half" },
    damage: { count: 1, sides: 6, flat: 0 },
  };
  const warding = {
    id: "warding",
    name: "Warding",
    budget: "action",
    self: true,
    concentration: true,
    applies: [{ condition: "blessed", duration: { rounds: 10 } }],
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
  const fight = (
    blocks: Record<string, { side: "party" | "enemy"; block: RulesetStatBlock; at: { x: number; y: number } }>,
  ) => {
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
    return { encounter, state };
  };
  {
    const { encounter } = fight({
      wolf: {
        side: "enemy",
        block: block([bolt], { type: "beast", behavior: { role: "skirmisher" } }),
        at: { x: 2, y: 2 },
      },
      hero: { side: "party", block: block([smash]), at: { x: 9, y: 2 } },
    });
    assert.deepEqual(rulesetCombatantBehavior(definition, rulesetCombatant(encounter, "wolf")!), {
      targets: ["nearest"],
      temperament: "reckless",
      pack: true,
      role: "skirmisher",
    });
    assert.deepEqual(rulesetCombatantBehavior(definition, rulesetCombatant(encounter, "hero")!), {
      targets: ["nearest"],
      temperament: "disciplined",
    });
  }

  // ── With no role of its own, one read off what it can do (not every creature a bruiser) ──
  {
    const { encounter } = fight({
      archer: { side: "enemy", block: block([bolt]), at: { x: 2, y: 2 } },
      brute: { side: "enemy", block: block([smash]), at: { x: 3, y: 2 } },
      priest: {
        side: "enemy",
        block: block([
          smash,
          { id: "mend", name: "Mend", budget: "action", targets: "ally", heal: { count: 1, sides: 8, flat: 2 } },
        ]),
        at: { x: 4, y: 2 },
      },
      hero: { side: "party", block: block([smash]), at: { x: 9, y: 2 } },
    });
    assert.equal(rulesetCombatantRole(rulesetCombatant(encounter, "archer")!), "marksman");
    assert.equal(rulesetCombatantRole(rulesetCombatant(encounter, "brute")!), "bruiser");
    assert.equal(rulesetCombatantRole(rulesetCombatant(encounter, "priest")!), "supporter");
    // A class feature or a torch from a catalog is no spell: a fighter with Second Wind is no caster.
    const brute = rulesetCombatant(encounter, "brute")!;
    const feature = { ...brute.actions[0]!, id: "second_wind", catalog: "features", damage: undefined };
    brute.actions = [...brute.actions, feature];
    assert.equal(rulesetCombatantRole(brute), "bruiser", "a catalog feature");
    // Nor a spell only a condition would give it: 5e's Potion of Animal Friendship,
    // on every combatant's list and offered only while drunk.
    const potion = { ...feature, id: "granted:animal_friend:spells/animal-friendship", components: ["verbal"] };
    brute.actions = [...brute.actions, { ...potion, whileHolds: "animal_friend", applies: [{ condition: "charmed" }] }];
    assert.equal(rulesetCombatantRole(brute), "bruiser", "a spell a potion would give");
    brute.actions = brute.actions.filter((action) => action.id !== potion.id);
    brute.actions = [...brute.actions, { ...feature, id: "bolt_spell", components: ["verbal"] }];
    assert.equal(rulesetCombatantRole(brute), "spellcaster", "a spell cast with words");
  }

  // ── Roles read off what it does (combat AI A2): no dragon a bulwark for its armour ──
  {
    const { encounter } = fight({
      dragon: { side: "enemy", block: block([smash], { defense: 19, legendaryResistance: 3 }), at: { x: 2, y: 2 } },
      plated: { side: "enemy", block: block([smash], { defense: 19 }), at: { x: 3, y: 2 } },
      guardian: {
        side: "enemy",
        block: block([
          smash,
          {
            id: "shield",
            name: "Shield",
            budget: "reaction",
            reaction: { on: "hit", for: "ally", within: 5, at: "target" },
          },
        ]),
        at: { x: 4, y: 2 },
      },
      knight: {
        side: "enemy",
        block: block([
          smash,
          { id: "parry", name: "Parry", budget: "reaction", reaction: { on: "hit", blow: "melee" } },
        ]),
        at: { x: 5, y: 2 },
      },
      goblin: {
        side: "enemy",
        block: block([
          smash,
          { id: "nimble", name: "Nimble Escape", budget: "bonus", standard: { actions: ["disengage", "hide"] } },
        ]),
        at: { x: 6, y: 2 },
      },
      hero: { side: "party", block: block([smash]), at: { x: 9, y: 2 } },
    });
    const role = (id: string) => rulesetCombatantRole(rulesetCombatant(encounter, id)!, definition, encounter);
    assert.equal(role("dragon"), "solo");
    assert.equal(role("plated"), "bruiser", "armour alone makes nobody a bulwark");
    assert.equal(role("guardian"), "bulwark");
    assert.equal(role("knight"), "bulwark");
    assert.equal(role("goblin"), "skirmisher");
    // 5e's own Parry puts a condition on it worth +2 AC for the one attack: still a bulwark. One that
    // puts anything else on itself is not turning a blow aside.
    const knight = rulesetCombatant(encounter, "knight")!;
    const parry = knight.actions.find((action) => action.id === "parry")!;
    parry.applies = [{ condition: "parrying", duration: { rounds: 1 } }] as never;
    assert.equal(role("knight"), "bulwark", "a Parry written as a condition");
    parry.applies = [{ condition: "blessed", duration: { rounds: 1 } }] as never;
    assert.equal(role("knight"), "bruiser", "a reaction that blesses itself");
    // Feet much quicker than its side's, on blows no harder than theirs.
    const quick = rulesetCombatant(encounter, "plated")!;
    quick.speed = 60;
    assert.equal(role("plated"), "skirmisher");
    assert.equal(rulesetCombatantRole(quick), "bruiser", "with no fight to read its side from");
  }

  // ── In and out again (combat AI A4): a goblin strikes and slips away; a brute stands ──
  {
    const nimble = {
      id: "nimble",
      name: "Nimble Escape",
      budget: "bonus",
      standard: { actions: ["disengage", "hide"] },
    };
    const strikes = (actions: unknown[]) => {
      const { encounter, state } = fight({
        goblin: { side: "enemy", block: block(actions), at: { x: 8, y: 2 } },
        hero: { side: "party", block: block([smash], { health: 200 }), at: { x: 9, y: 2 } },
      });
      state.rulesetFight = { encounter, events: [], eventSeq: 0, controllers: { hero: "manual" }, bosses: [] } as never;
      syncRulesetCombatants(definition, state);
      state.stage = rulesetDirectorStage(state);
      assert.ok(commandRulesetCombatDirector(definition, state, { type: "continue" }).ok);
      const after = state.rulesetFight!.encounter;
      const goblin = rulesetCombatant(after, "goblin")!;
      const hero = rulesetCombatant(after, "hero")!;
      return {
        struck: state.rulesetFight!.events.some(
          (entry) => entry.event.type === "attack" && "actorId" in entry.event && entry.event.actorId === "goblin",
        ),
        gap: Math.max(Math.abs(goblin.x! - hero.x!), Math.abs(goblin.y! - hero.y!)),
        hit: hero.health!.value < 200,
      };
    };
    const goblin = strikes([smash, nimble]);
    assert.ok(goblin.struck, "the goblin strikes");
    assert.ok(goblin.gap > 1, `and is gone again: ${goblin.gap}`);
    const brute = strikes([smash]);
    assert.ok(brute.struck);
    assert.equal(brute.gap, 1, "a brute stands and fights");
  }

  // ── A bodyguard (combat AI A5): it goes at whoever is on the caster it keeps, not the one beside it ──
  {
    const scene = (behavior?: Record<string, unknown>) =>
      fight({
        guard: { side: "enemy", block: block([smash], behavior ? { behavior } : {}), at: { x: 5, y: 2 } },
        mage: { side: "enemy", block: block([{ ...bolt, components: ["verbal"] }]), at: { x: 2, y: 6 } },
        near: { side: "party", block: block([smash]), at: { x: 8, y: 2 } },
        onMage: { side: "party", block: block([smash]), at: { x: 2, y: 7 } },
      });
    // Patient, so not drawn to whoever stands beside its friends as a disciplined one is (T1).
    const free = scene({ temperament: "patient" });
    assert.equal(pickRulesetChoice(definition, free.state, free.encounter, "guard")?.choice.targetIds[0], "near");
    const kept = scene({ guards: ["casters"] });
    assert.equal(
      pickRulesetChoice(definition, kept.state, kept.encounter, "guard")?.choice.targetIds[0],
      "onMage",
      "the one on its charge",
    );
    // A standing order, so a mindless one keeps it too (a Shield Guardian, a zombie).
    const golem = scene({ guards: ["casters"] });
    rulesetCombatant(golem.encounter, "guard")!.block!.mind = "mindless" as never;
    assert.equal(
      pickRulesetChoice(definition, golem.state, golem.encounter, "guard")?.choice.targetIds[0],
      "onMage",
      "a mindless guard too",
    );
    // Nobody of the kind it keeps: it fights as it would.
    const alone = scene({ guards: ["healers"], temperament: "patient" });
    assert.equal(pickRulesetChoice(definition, alone.state, alone.encounter, "guard")?.choice.targetIds[0], "near");
    // Strayed eight squares off its charge, it does not walk to six to strike a foe out there
    // (re-test 14): closer than before is still off the leash.
    const strayed = fight({
      guard: { side: "enemy", block: block([smash], { behavior: { guards: ["casters"] } }), at: { x: 10, y: 2 } },
      mage: { side: "enemy", block: block([{ ...bolt, components: ["verbal"] }]), at: { x: 2, y: 2 } },
      rogue: { side: "party", block: block([smash]), at: { x: 8, y: 4 } },
    });
    const chosen = pickRulesetChoice(definition, strayed.state, strayed.encounter, "guard");
    assert.notEqual(chosen?.choice.targetIds[0], "rogue", JSON.stringify(chosen?.choice));
  }

  // ── A leader (combat AI A6): it opens with what helps its side, and steadies those running ──
  {
    const cry = {
      id: "cry",
      name: "Battle Cry",
      budget: "action",
      targets: "ally",
      targetCount: 3,
      range: { normal: 30 },
      applies: [{ condition: "parrying", duration: { rounds: 10 } }],
    };
    const scene = (leader: boolean) =>
      fight({
        chief: {
          side: "enemy",
          block: block([smash, cry], leader ? { leader: true } : {}),
          at: { x: 3, y: 3 },
        },
        left: { side: "enemy", block: block([smash]), at: { x: 3, y: 4 } },
        right: { side: "enemy", block: block([smash]), at: { x: 4, y: 3 } },
        hero: { side: "party", block: block([smash]), at: { x: 9, y: 3 } },
      });
    const led = scene(true);
    assert.equal(
      pickRulesetChoice(definition, led.state, led.encounter, "chief")?.option.id,
      "cry",
      "it rallies first",
    );
    const plain = scene(false);
    assert.notEqual(pickRulesetChoice(definition, plain.state, plain.encounter, "chief")?.option.id, "cry");
    // 5e's Leadership: a condition on the knight itself whose aura reaches its friends for a minute.
    const aura = parsed(
      fiveE((doc) => {
        doc.sheet.live.conditions.push({ id: "led", label: "Led" }, { id: "leading", label: "Leading" });
        doc.combat.conditions.push(
          { condition: "led", modifiers: [{ to: "attacks", flat: 2 }] },
          { condition: "leading", auras: [{ distance: 30, side: "allies", conditions: ["led"] }] },
        );
      }),
    );
    const leadership = {
      id: "leadership",
      name: "Leadership",
      budget: "action",
      self: true,
      applies: [{ condition: "leading", duration: { rounds: 10 } }],
    };
    {
      const { encounter, state } = fight({
        chief: { side: "enemy", block: block([smash, leadership], { leader: true }), at: { x: 3, y: 3 } },
        left: { side: "enemy", block: block([smash]), at: { x: 3, y: 4 } },
        hero: { side: "party", block: block([smash]), at: { x: 9, y: 3 } },
      });
      assert.equal(
        pickRulesetChoice(aura, state, encounter, "chief")?.option.id,
        "leadership",
        "a leader opens with an aura for its side",
      );
    }

    const morale = parsed(
      fiveE((doc) => {
        doc.combat.morale = { check: { roll: "2d6" }, on: ["hurt"] };
      }),
    );
    const { encounter, state } = fight({
      chief: { side: "enemy", block: block([smash], { leader: true }), at: { x: 3, y: 3 } },
      near: { side: "enemy", block: block([smash]), at: { x: 5, y: 5 } },
      far: { side: "enemy", block: block([smash]), at: { x: 14, y: 9 } },
      hero: { side: "party", block: block([smash]), at: { x: 14, y: 0 } },
    });
    for (const id of ["near", "far"]) {
      const one = rulesetCombatant(encounter, id)!;
      one.routed = true;
      one.moraleChecked = ["hurt"];
    }
    state.rulesetFight = { encounter, events: [], eventSeq: 0, controllers: { hero: "manual" }, bosses: [] } as never;
    syncRulesetCombatants(morale, state);
    state.stage = rulesetDirectorStage(state);
    assert.ok(commandRulesetCombatDirector(morale, state, { type: "continue" }).ok);
    const after = state.rulesetFight!.encounter;
    assert.equal(rulesetCombatant(after, "near")!.routed, undefined, "the one near it stops running");
    assert.deepEqual(rulesetCombatant(after, "near")!.moraleChecked, [], "and checks again");
    assert.equal(rulesetCombatant(after, "far")!.routed, true, "one too far off runs on");
  }

  // ── Fliers keep out of reach (combat AI A7): one that shoots goes up; a bruiser stays down ──
  {
    const high = parsed(
      fiveE((doc) => {
        doc.combat.elevation = { levelHeight: 5 };
      }),
    );
    const aloft = (
      behavior: Record<string, unknown>,
      {
        actions = [bolt],
        extra = {},
        health,
      }: { actions?: unknown[]; extra?: Record<string, unknown>; health?: number } = {},
    ) => {
      const blocks = {
        harpy: {
          side: "enemy" as const,
          block: block(actions as never, { speeds: { fly: 40 }, behavior, ...extra }),
          at: { x: 2, y: 2 },
        },
        hero: { side: "party" as const, block: block([smash]), at: { x: 12, y: 2 } },
      };
      const encounter = createRulesetEncounter({
        definition: high,
        seed: 1,
        roller: () => 10,
        combatants: Object.entries(blocks).map(([id, one]) => ({ id, name: id, side: one.side, block: one.block })),
        board: {
          grid: { width: 16, height: 10, tiles: Array.from({ length: 10 }, () => Array(16).fill("plains")) },
          placements: Object.fromEntries(Object.entries(blocks).map(([id, one]) => [id, one.at])),
        } as never,
      });
      encounter.order = ["harpy", "hero"];
      encounter.turn = 0;
      if (health !== undefined)
        rulesetCombatant(encounter, "harpy")!.health = {
          ...rulesetCombatant(encounter, "harpy")!.health!,
          value: health,
        };
      const state = createCombatDirector({
        id: "fight",
        anchor: "anchor",
        style: "ruleset",
        party: [unit("hero", "player")],
        enemies: [unit("harpy", "enemy")],
        gm: false,
        difficulty: "normal",
        seed: 3,
      } as never);
      state.rulesetFight = { encounter, events: [], eventSeq: 0, controllers: { hero: "manual" }, bosses: [] } as never;
      syncRulesetCombatants(high, state);
      state.stage = rulesetDirectorStage(state);
      assert.ok(commandRulesetCombatDirector(high, state, { type: "continue" }).ok);
      return rulesetCombatant(state.rulesetFight!.encounter, "harpy")!.altitude;
    };
    assert.ok((aloft({ temperament: "disciplined", role: "marksman" }) ?? 0) > 0, "a shooter takes to the air");
    assert.equal(aloft({ temperament: "disciplined", role: "bruiser" }), undefined, "a bruiser stays down");
    // A proud legend near its end takes to the sky (combat AI T5), even with nothing to shoot.
    const legend = { actions: [smash], extra: { legendaryResistance: 3 } };
    assert.ok((aloft({ temperament: "arrogant" }, { ...legend, health: 5 }) ?? 0) > 0, "a beaten legend flies off");
    assert.equal(aloft({ temperament: "arrogant" }, legend), undefined, "unhurt, it stays to fight");
    assert.equal(aloft({ temperament: "cautious" }, { ...legend, health: 5 }), undefined, "only a proud one");
    assert.equal(aloft({ temperament: "arrogant" }, { actions: [smash], health: 5 }), undefined, "only a legend");
  }

  // ── Turned by what happens (combat AI T7): its data's shift, once, as its turn starts ──
  {
    const { encounter, state } = fight({
      brute: {
        side: "enemy",
        block: block([smash], { behavior: { temperament: "patient", shifts: [{ on: "bloodied", to: "reckless" }] } }),
        at: { x: 3, y: 3 },
      },
      hero: { side: "party", block: block([smash]), at: { x: 12, y: 3 } },
    });
    rulesetCombatant(encounter, "brute")!.health = { ...rulesetCombatant(encounter, "brute")!.health!, value: 20 };
    state.rulesetFight = { encounter, events: [], eventSeq: 0, controllers: { hero: "manual" }, bosses: [] } as never;
    syncRulesetCombatants(definition, state);
    state.stage = rulesetDirectorStage(state);
    assert.ok(commandRulesetCombatDirector(definition, state, { type: "continue" }).ok);
    const brute = state.enemies.find((one) => one.id === "brute")!;
    assert.equal(brute.tactics?.adjective, "reckless", "bloodied, it turns reckless");
    assert.equal(brute.tactics?.shifted, true);
    syncRulesetCombatants(definition, state);
    assert.equal(rulesetCombatant(state.rulesetFight!.encounter, "brute")!.temperament, "reckless", "and stays so");
    assert.equal(pickRulesetChoice(definition, state, state.rulesetFight!.encounter, "brute") !== undefined, true);
    assert.equal(brute.tactics?.adjective, "reckless", "its data's temperament no longer wins");
  }

  // ── Cruel (combat AI T3): it strikes the fallen only where the game allows it ──
  {
    const prey = (temperament: string, allowed: boolean) => {
      const { encounter, state } = fight({
        ghoul: { side: "enemy", block: block([smash], { behavior: { temperament } }), at: { x: 5, y: 2 } },
        fallen: { side: "party", block: block([smash]), at: { x: 6, y: 2 } },
        other: { side: "party", block: block([smash]), at: { x: 8, y: 2 } },
      });
      const fallen = rulesetCombatant(encounter, "fallen")!;
      fallen.down = true;
      fallen.dying = true as never;
      fallen.health = { ...fallen.health!, value: 0 };
      if (allowed) state.cruel = true;
      state.rulesetFight = { encounter, events: [], eventSeq: 0, controllers: {}, bosses: [] } as never;
      syncRulesetCombatants(definition, state);
      return pickRulesetChoice(definition, state, encounter, "ghoul")?.choice.targetIds[0];
    };
    assert.equal(prey("cruel", true), "fallen", "the game allows it: it finishes the fallen");
    assert.equal(prey("cruel", false), "other", "the game does not: it leaves them be");
    assert.equal(prey("opportunistic", true), "other", "only a cruel one");
  }

  // ── Far better up close (re-test 15): it shoots while it cannot reach, then walks in ──
  {
    const potShot = (actions: unknown[], dormant?: string) => {
      const { encounter, state } = fight({
        knight: { side: "enemy", block: block(actions), at: { x: 2, y: 4 } },
        brom: { side: "party", block: block([smash]), at: { x: 12, y: 4 } },
      });
      const lent = rulesetCombatant(encounter, "knight")!.actions.find((one) => one.id === dormant);
      if (lent) lent.whileHolds = "flame-blade" as never;
      state.rulesetFight = { encounter, events: [], eventSeq: 0, controllers: { brom: "manual" }, bosses: [] } as never;
      syncRulesetCombatants(definition, state);
      state.stage = rulesetDirectorStage(state);
      assert.ok(commandRulesetCombatDirector(definition, state, { type: "continue" }).ok);
      const fought = state.rulesetFight!;
      const shot = fought.events.some(
        (one) =>
          "actorId" in one.event && one.event.actorId === "knight" && JSON.stringify(one.event).includes('"bolt"'),
      );
      return { shot, x: rulesetCombatant(fought.encounter, "knight")!.x! };
    };
    const knight = potShot([smash, bolt]);
    assert.ok(knight.shot, "out of reach, it shoots");
    assert.ok(knight.x > 2, `and then walks in (stood at ${knight.x})`);
    assert.equal(
      potShot([{ ...smash, damage: { count: 1, sides: 4, flat: 0 } }, bolt]).x,
      2,
      "an archer keeps its spot",
    );
    // A goblin archer carries a Flame Blade strike it has not called up (re-test 16): no blade yet.
    const blade = { ...smash, id: "blade-strike", damage: { count: 3, sides: 6, flat: 0 } };
    const goblin = potShot(
      [
        { ...smash, damage: { count: 1, sides: 6, flat: 2 } },
        { ...bolt, damage: { count: 1, sides: 6, flat: 2 } },
        blade,
      ],
      "blade-strike",
    );
    assert.ok(goblin.shot, "the goblin shoots");
    assert.equal(goblin.x, 2, "and keeps its spot, whatever blade it might call up later");
    // A scout's two Longbow shots against its two Shortswords (re-test 17): each counted twice.
    const shortsword = { ...smash, id: "shortsword", damage: { count: 1, sides: 6, flat: 2 } };
    const longbow = { ...bolt, damage: { count: 1, sides: 8, flat: 2 } };
    const scout = potShot([
      shortsword,
      longbow,
      { id: "multi-melee", name: "Multiattack", budget: "action", sequence: [{ action: "shortsword", times: 2 }] },
      { id: "multi-ranged", name: "Multiattack", budget: "action", sequence: [{ action: "bolt", times: 2 }] },
    ]);
    assert.ok(scout.shot, "the scout shoots");
    assert.equal(scout.x, 2, "and keeps its spot");
  }

  // ── Honourable (combat AI T6): whoever fights it first, and never one running from it ──
  {
    const duel = (temperament: string, set: (encounter: RulesetEncounterState) => void) => {
      const { encounter, state } = fight({
        knight: { side: "enemy", block: block([smash], { behavior: { temperament } }), at: { x: 5, y: 2 } },
        a: { side: "party", block: block([smash]), at: { x: 6, y: 2 } },
        b: { side: "party", block: block([smash]), at: { x: 4, y: 2 } },
      });
      set(encounter);
      state.rulesetFight = { encounter, events: [], eventSeq: 0, controllers: {}, bosses: [] } as never;
      syncRulesetCombatants(definition, state);
      return pickRulesetChoice(definition, state, encounter, "knight")?.choice.targetIds[0];
    };
    const hurtBy = (id: string) => (encounter: RulesetEncounterState) =>
      (rulesetCombatant(encounter, "knight")!.harmedBy = id);
    assert.equal(duel("honourable", hurtBy("a")), "a", "the one that hurt it");
    assert.equal(duel("honourable", hurtBy("b")), "b", "whichever that was");
    assert.equal(
      duel("honourable", (encounter) => {
        hurtBy("a")(encounter);
        rulesetCombatant(encounter, "a")!.routed = true;
      }),
      "b",
      "never one running from it",
    );
    // Before honourable opponents alone, the party may give itself up, and is taken alive.
    const surrender = (temperament: string) => {
      const { encounter, state } = fight({
        hero: { side: "party", block: block([smash]), at: { x: 4, y: 2 } },
        knight: { side: "enemy", block: block([smash], { behavior: { temperament } }), at: { x: 5, y: 2 } },
      });
      state.rulesetFight = {
        encounter,
        events: [],
        eventSeq: 0,
        controllers: { hero: "manual" },
        bosses: [],
        adjustments: [],
      } as never;
      syncRulesetCombatants(definition, state);
      state.stage = rulesetDirectorStage(state);
      return { state, view: directedRulesetView(definition, state) };
    };
    const yielding = surrender("honourable");
    assert.equal(yielding.view?.canYield, true, "offered");
    assert.ok(commandRulesetCombatDirector(definition, yielding.state, { type: "yield" }).ok);
    assert.equal(yielding.state.outcome, "defeat");
    assert.equal(yielding.state.summary?.yielded, true, "taken alive");
    const fierce = surrender("reckless");
    assert.equal(fierce.view?.canYield, undefined, "not before one that would not take it");
    assert.equal(fierce.view?.yieldRefusedBy, undefined, "and no word of it where honour never was");
    assert.equal(yielding.view?.yieldRefusedBy, undefined);
    // One that was honourable and turned (bloodied, methodical) is named as why (laptop 2026-10-30).
    const turned = surrender("honourable");
    const knight = turned.state.enemies!.find((unit) => unit.id === "knight")!;
    knight.tactics = { ...knight.tactics!, adjective: "methodical", shifted: true, shiftedFrom: "honourable" };
    const turnedView = directedRulesetView(definition, turned.state);
    assert.equal(turnedView?.canYield, undefined);
    assert.deepEqual(turnedView?.yieldRefusedBy, [
      rulesetCombatant(turned.state.rulesetFight!.encounter, "knight")!.name,
    ]);
    assert.equal(commandRulesetCombatDirector(definition, fierce.state, { type: "yield" }).ok, false);
    assert.equal(fierce.state.outcome, undefined);
  }

  // ── Hungry (combat AI T8): its prey in hand, it drags them off away from the rest ──
  {
    const dragging = parsed(
      fiveE((doc) => {
        doc.combat.conditions.find((one: { condition: string }) => one.condition === "grappled").dragged = {
          unlessSmaller: 2,
        };
      }),
    );
    const feast = (
      temperament: string,
      how: { friendAt?: { x: number; y: number }; preyDown?: boolean; preyHealth?: number } = {},
    ) => {
      // A crocodile's own Bite against somebody with a great deal of health (re-test 16).
      const bite = how.preyHealth ? { ...smash, toHit: 4, damage: { count: 1, sides: 10, flat: 2 } } : smash;
      const blocks = {
        croc: { side: "enemy" as const, block: block([bite], { behavior: { temperament } }), at: { x: 6, y: 4 } },
        prey: {
          side: "party" as const,
          block: block([smash], how.preyHealth ? { health: how.preyHealth } : {}),
          at: { x: 7, y: 4 },
        },
        friend: { side: "party" as const, block: block([smash]), at: how.friendAt ?? { x: 3, y: 4 } },
      };
      const encounter = createRulesetEncounter({
        definition: dragging,
        seed: 1,
        roller: () => 10,
        combatants: Object.entries(blocks).map(([id, one]) => ({ id, name: id, side: one.side, block: one.block })),
        board: {
          grid: { width: 16, height: 10, tiles: Array.from({ length: 10 }, () => Array(16).fill("plains")) },
          placements: Object.fromEntries(Object.entries(blocks).map(([id, one]) => [id, one.at])),
        } as never,
      });
      encounter.order = ["croc", "prey", "friend"];
      encounter.turn = 0;
      rulesetCombatant(encounter, "prey")!.tracked.push({ condition: "grappled", rounds: null, source: "croc" });
      if (how.preyDown) {
        const prey = rulesetCombatant(encounter, "prey")!;
        prey.down = true;
        prey.health = { ...prey.health!, value: 0 };
      }
      const state = createCombatDirector({
        id: "fight",
        anchor: "anchor",
        style: "ruleset",
        party: [unit("prey", "player"), unit("friend", "player")],
        enemies: [unit("croc", "enemy")],
        gm: false,
        difficulty: "normal",
        seed: 3,
      } as never);
      state.rulesetFight = { encounter, events: [], eventSeq: 0, controllers: {}, bosses: [] } as never;
      syncRulesetCombatants(dragging, state);
      state.stage = rulesetDirectorStage(state);
      // Only the croc's own turn.
      state.rulesetFight!.controllers = { prey: "manual", friend: "manual" } as never;
      assert.ok(commandRulesetCombatDirector(dragging, state, { type: "continue" }).ok);
      const after = state.rulesetFight!.encounter;
      // Its prey comes along, so the prey never gets a strike at it for leaving.
      assert.ok(!state.rulesetFight!.events.some((one) => one.event.type === "window"), "no strike from its prey");
      const own = state.rulesetFight!.events.find(
        (one) => "actorId" in one.event && one.event.actorId === "croc" && "optionId" in one.event,
      )?.event as { optionId?: string } | undefined;
      return {
        croc: rulesetCombatant(after, "croc")!.x!,
        prey: rulesetCombatant(after, "prey")!.x!,
        held: rulesetCombatant(after, "prey")!.tracked.some((one) => one.condition === "grappled"),
        did: own?.optionId,
      };
    };
    const fed = feast("hungry");
    assert.ok(fed.croc > 6, "it drags its prey off, away from the friend");
    assert.ok(fed.prey > 7, "and the prey with it");
    assert.equal(feast("patient").croc, 6, "one that is not stays to fight");
    // Out of the rest's walk already, it stays and feeds; with its prey down, it drags it no more
    // (re-test 15: a crocodile hauling a stable victim in circles for twenty-five rounds).
    assert.equal(feast("hungry", { friendAt: { x: 15, y: 9 } }).croc, 6, "far enough already");
    assert.ok(feast("hungry", { preyDown: true }).croc <= 6, "the fallen are not hauled off");
    // Re-test 16: it lets go of the fallen for the one still standing, and bites what it holds
    // rather than wrestling it, however much of them there is to bite through.
    assert.equal(feast("hungry", { preyDown: true }).held, false, "it lets go of the fallen");
    assert.equal(feast("patient", { preyDown: true }).held, false, "any holder does");
    const tough = feast("hungry", { friendAt: { x: 15, y: 9 }, preyHealth: 900 });
    assert.equal(tough.did, "smash", "it bites the one it holds");
    assert.equal(tough.held, true, "and keeps hold of them");
    assert.equal(feast("patient", { friendAt: { x: 15, y: 9 }, preyHealth: 900 }).did, "smash", "any holder bites");
  }

  // ── Keeping its ground (combat AI T4): no further than its territory, unless shot at from afar ──
  {
    const guard = (behavior: Record<string, unknown>, harmed?: boolean, extra: Record<string, unknown> = {}) => {
      const { encounter, state } = fight({
        golem: { side: "enemy", block: block([smash], { behavior, ...extra }), at: { x: 3, y: 3 } },
        hero: { side: "party", block: block([bolt]), at: { x: 12, y: 3 } },
      });
      if (harmed) rulesetCombatant(encounter, "golem")!.harmedBy = "hero";
      state.rulesetFight = { encounter, events: [], eventSeq: 0, controllers: { hero: "manual" }, bosses: [] } as never;
      syncRulesetCombatants(definition, state);
      state.stage = rulesetDirectorStage(state);
      assert.ok(commandRulesetCombatDirector(definition, state, { type: "continue" }).ok);
      return rulesetCombatant(state.rulesetFight!.encounter, "golem")!.x!;
    };
    assert.ok(guard({ temperament: "territorial", territory: 2 }) <= 5, "it stays on its ground");
    assert.ok(guard({ temperament: "patient" }) > 5, "one that is not walks on");
    assert.ok(guard({ temperament: "territorial", territory: 2 }, true) > 5, "shot at from afar, it gives chase");
    // A standing order, so a mindless golem keeps it too.
    assert.ok(
      guard({ temperament: "territorial", territory: 2 }, false, { mind: "mindless" }) <= 5,
      "a mindless one too",
    );
    assert.ok(guard({ pack: true }, false, { mind: "mindless" }) > 5, "and a mindless one without walks on");
  }

  // ── Its temperament and role, unless the Game Master gave one ──
  {
    const scene = () =>
      fight({
        sly: {
          side: "enemy",
          block: block([bolt], { behavior: { temperament: "cautious", role: "marksman" } }),
          at: { x: 2, y: 2 },
        },
        hero: { side: "party", block: block([smash]), at: { x: 9, y: 2 } },
      });
    const own = scene();
    pickRulesetChoice(definition, own.state, own.encounter, "sly");
    assert.equal(own.state.enemies[0]!.tactics?.adjective, "cautious");
    assert.equal(own.state.enemies[0]!.tactics?.role, "marksman");
    const told = scene();
    told.state.enemies[0]!.aiHints = { proficiency: "master", temperament: "reckless" };
    pickRulesetChoice(definition, told.state, told.encounter, "sly");
    assert.notEqual(told.state.enemies[0]!.tactics?.adjective, "cautious", "the Game Master's word wins");
  }

  // ── Whom it goes for ──
  {
    // A frail fighter and a sturdy caster, both in range: left to itself it shoots the frail one.
    const scene = (behavior?: Record<string, unknown>) =>
      fight({
        archer: { side: "enemy", block: block([bolt], behavior ? { behavior } : {}), at: { x: 2, y: 4 } },
        fighter: { side: "party", block: block([smash], { health: 20 }), at: { x: 9, y: 3 } },
        mage: { side: "party", block: block([warding, bolt]), at: { x: 9, y: 6 } },
      });
    const shot = (behavior?: Record<string, unknown>, before?: (encounter: RulesetEncounterState) => void) => {
      const { encounter, state } = scene(behavior);
      state.enemies[0]!.tactics = {
        version: 1,
        seed: 0,
        category: "unknown",
        proficiency: "master",
        role: "marksman",
        adjective: "disciplined",
      };
      before?.(encounter);
      return pickRulesetChoice(definition, state, encounter, "archer")?.targetId;
    };
    assert.equal(shot(), "fighter", "the frail one, left to itself");
    assert.equal(shot({ targets: ["casters"] }), "mage", "a caster first");
    assert.equal(
      shot({ targets: ["attacker"] }, (encounter) => {
        rulesetCombatant(encounter, "archer")!.harmedBy = "mage";
      }),
      "mage",
      "whoever hurt it",
    );
    // A pack hunter goes for whoever its friend is already beside.
    const pack = fight({
      wolf: { side: "enemy", block: block([bolt], { behavior: { pack: true } }), at: { x: 2, y: 4 } },
      packmate: { side: "enemy", block: block([smash]), at: { x: 10, y: 6 } },
      fighter: { side: "party", block: block([smash], { health: 20 }), at: { x: 9, y: 3 } },
      mage: { side: "party", block: block([warding, bolt]), at: { x: 9, y: 6 } },
    });
    pack.state.enemies[0]!.tactics = {
      version: 1,
      seed: 0,
      category: "unknown",
      proficiency: "master",
      role: "skirmisher",
      adjective: "disciplined",
    };
    assert.equal(
      pickRulesetChoice(definition, pack.state, pack.encounter, "wolf")?.targetId,
      "mage",
      "the pack's prey",
    );
  }

  // ── Its opener, once ──
  {
    const { encounter, state } = fight({
      drake: { side: "enemy", block: block([smash, spark], { behavior: { opens: ["spark"] } }), at: { x: 5, y: 4 } },
      hero: { side: "party", block: block([smash]), at: { x: 6, y: 4 } },
    });
    state.enemies[0]!.tactics = {
      version: 1,
      seed: 0,
      category: "unknown",
      proficiency: "master",
      role: "bruiser",
      adjective: "disciplined",
    };
    assert.equal(pickRulesetChoice(definition, state, encounter, "drake")?.option.id, "spark", "it opens with it");
    assert.equal(state.enemies[0]!.tactics?.opened, true);
    assert.equal(pickRulesetChoice(definition, state, encounter, "drake")?.option.id, "smash", "and then fights");
  }

  // ── Lying in wait ──
  {
    const creaturesId = (definition.catalogs ?? []).find((catalog) => catalog.holds === "creatures")!.id;
    const bestiary = Object.fromEntries(
      (definition.catalogs ?? []).flatMap((catalog) =>
        catalog.holds === "creatures" && catalog.entries ? [[catalog.id, catalog.entries]] : [],
      ),
    );
    const hero = defaultRulesetSheetBuild(definition);
    hero.fields = { ...hero.fields, hp_max: 40 };
    const built = createRulesetFight({
      definition,
      seed: 3,
      positioned: true,
      party: [{ id: "ada", name: "Ada" }],
      enemies: [{ id: "lurker", name: "Lurker", creature: `${creaturesId}/thorn-lurker` }],
      cards: [{ name: "Ada", rulesetSheet: { v: 1, build: hero } }],
      playerName: null,
      live: {},
      items: () => [],
      partyCatalogs: {},
      bestiary,
    } as never);
    assert.ok(built.ok, built.ok ? "" : (built as { error: string }).error);
    const director = createCombatDirector({
      id: "fight",
      anchor: "anchor",
      style: "ruleset",
      party: [{ ...unit("ada", "player"), hp: 30, maxHp: 30 }],
      enemies: [{ ...unit("lurker", "enemy"), hp: 30, maxHp: 30 }],
      gm: false,
      difficulty: "normal",
      seed: 3,
    } as never);
    director.rulesetFight = (built as { fight: never }).fight;
    const encounter = director.rulesetFight!.encounter;
    const lurker = rulesetCombatant(encounter, "lurker")!;
    assert.equal(lurker.block?.behavior?.ambush, true, "the bestiary's behavior reaches the fight");
    const ada = rulesetCombatant(encounter, "ada")!;
    const grid = encounter.board!.grid!;
    assert.ok(grid.width >= 10, `a board wide enough to lie in wait on: ${grid.width}`);
    ada.x = 0;
    ada.y = 0;
    lurker.x = grid.width - 1;
    lurker.y = grid.height - 1;
    syncRulesetCombatants(definition, director);
    director.stage = rulesetDirectorStage(director);
    // Ada's own turns, played by nobody but the player; `walk` moves her first.
    const theirs: RulesetCombatEvent[] = [];
    const round = (walk?: { x: number; y: number }) => {
      for (let guard = 0; guard < 6 && !director.outcome; guard++) {
        const now = director.rulesetFight!.encounter;
        if (rulesetEncounterSummary(definition, now).outcome !== "ongoing") return;
        if (now.order[now.turn] === "ada") {
          if (walk) {
            const her = rulesetCombatant(now, "ada")!;
            her.x = walk.x;
            her.y = walk.y;
            walk = undefined;
          }
          const step = applyRulesetCombatChoice(
            definition,
            now,
            { actorId: "ada", optionId: "end-turn", targetIds: [] },
            () => 10,
          );
          theirs.push(...step.events);
          director.rulesetFight!.encounter = step.state;
          syncRulesetCombatants(definition, director);
          director.stage = rulesetDirectorStage(director);
          if (guard > 0) return;
          continue;
        }
        assert.ok(commandRulesetCombatDirector(definition, director, { type: "continue" }).ok);
      }
    };
    const where = () => {
      const one = rulesetCombatant(director.rulesetFight!.encounter, "lurker")!;
      return { x: one.x, y: one.y };
    };
    const start = where();
    round();
    round();
    assert.deepEqual(where(), start, "it keeps still while its prey is far off");
    const all = () => [...director.rulesetFight!.events.map((entry) => entry.event), ...theirs];
    assert.ok(
      !all().some(
        (event) =>
          (event.type === "attack" || event.type === "damage") && "actorId" in event && event.actorId === "lurker",
      ),
      "and strikes nobody",
    );
    // Ada walks up beside it: it springs.
    round({ x: start.x! - 1, y: start.y! });
    round();
    const sprung = director.enemies.find((one) => one.id === "lurker")!.tactics?.sprung;
    assert.equal(sprung, true, `it sprang: ${JSON.stringify(all().map((event) => event.type))}`);
  }

  // ── Refused ──
  refused(
    fiveE((doc) => (doc.combat.behavior = {})),
    /Say something about how it fights/,
  );
  refused(
    fiveE((doc) => (doc.combat.behavior = { targets: ["casters", "casters"] })),
    /Name each once/,
  );
  refused(
    fiveE((doc) => (doc.combat.behavior = { temperament: "mindless" })),
    /temperament/,
  );
  refused(
    fiveE((doc) => (doc.combat.behavior = { flees: true })),
    /flees|Unrecognized/,
  );
  refused(
    fiveE((doc) => (lurkerEntry(doc).behavior = { targets: ["the-tasty-one"] })),
    /targets/,
  );

  // ── The install gate ──
  {
    const gate =
      "A ruleset with how a creature goes about a fight (a behavior saying its temperament, role, targets, openers, pack or ambush) requires schemaVersion 2 and capabilityApi 1.763 or newer";
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
    const wolfish = fiveE((doc) => (lurkerEntry(doc).behavior = { pack: true }));
    assert.equal(getCapabilityPackageInstallIssue(manifest(762) as never, wolfish), gate, "a creature's own");
    assert.equal(
      getCapabilityPackageInstallIssue(
        manifest(762) as never,
        fiveE((doc) => (doc.combat.behavior = { targets: ["weakest"] })),
      ),
      gate,
      "the ruleset's",
    );
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(763) as never, wolfish), gate);
    assert.notEqual(
      getCapabilityPackageInstallIssue(manifest(762) as never, fiveE()),
      gate,
      "a condition's behavior is not one",
    );
    const solo =
      'A ruleset with a creature that fights a side alone (a behavior whose role is "solo") requires schemaVersion 2 and capabilityApi 1.776 or newer';
    const dragonish = fiveE((doc) => (lurkerEntry(doc).behavior = { role: "solo" }));
    assert.equal(getCapabilityPackageInstallIssue(manifest(775) as never, dragonish), solo);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(776) as never, dragonish), solo);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(775) as never, wolfish), solo);
    const guarding =
      "A ruleset with a bodyguard (a behavior's guards) requires schemaVersion 2 and capabilityApi 1.777 or newer";
    const guardish = fiveE((doc) => (lurkerEntry(doc).behavior = { guards: ["casters"] }));
    assert.equal(getCapabilityPackageInstallIssue(manifest(776) as never, guardish), guarding);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(777) as never, guardish), guarding);
    const fanatic =
      'A ruleset with a fanatic (a behavior whose temperament is "fanatical") requires schemaVersion 2 and capabilityApi 1.778 or newer';
    const zealous = fiveE((doc) => (lurkerEntry(doc).behavior = { temperament: "fanatical" }));
    assert.equal(getCapabilityPackageInstallIssue(manifest(777) as never, zealous), fanatic);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(778) as never, zealous), fanatic);
    const turning =
      "A ruleset with a creature whose temperament turns (a behavior's shifts) requires schemaVersion 2 and capabilityApi 1.779 or newer";
    const turns = fiveE((doc) => (lurkerEntry(doc).behavior = { shifts: [{ on: "bloodied", to: "reckless" }] }));
    assert.equal(getCapabilityPackageInstallIssue(manifest(778) as never, turns), turning);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(779) as never, turns), turning);
    const proud =
      'A ruleset with an arrogant creature (a behavior whose temperament is "arrogant") requires schemaVersion 2 and capabilityApi 1.780 or newer';
    const lofty = fiveE((doc) => (lurkerEntry(doc).behavior = { temperament: "arrogant" }));
    assert.equal(getCapabilityPackageInstallIssue(manifest(779) as never, lofty), proud);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(780) as never, lofty), proud);
    const ground =
      'A ruleset with a territorial creature (a behavior whose temperament is "territorial", or with a territory) requires schemaVersion 2 and capabilityApi 1.781 or newer';
    const keeps = fiveE((doc) => (lurkerEntry(doc).behavior = { temperament: "territorial", territory: 3 }));
    assert.equal(getCapabilityPackageInstallIssue(manifest(780) as never, keeps), ground);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(781) as never, keeps), ground);
    refused(
      fiveE((doc) => (lurkerEntry(doc).behavior = { territory: 0 })),
      /territory/,
    );
    const vicious =
      'A ruleset with a cruel creature (a behavior whose temperament is "cruel") requires schemaVersion 2 and capabilityApi 1.782 or newer';
    const cruel = fiveE((doc) => (lurkerEntry(doc).behavior = { temperament: "cruel" }));
    assert.equal(getCapabilityPackageInstallIssue(manifest(781) as never, cruel), vicious);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(782) as never, cruel), vicious);
    const fair =
      'A ruleset with an honourable creature (a behavior whose temperament is "honourable") requires schemaVersion 2 and capabilityApi 1.783 or newer';
    const knightly = fiveE((doc) => (lurkerEntry(doc).behavior = { temperament: "honourable" }));
    assert.equal(getCapabilityPackageInstallIssue(manifest(782) as never, knightly), fair);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(783) as never, knightly), fair);
    const ravenous =
      'A ruleset with a hungry creature (a behavior whose temperament is "hungry") requires schemaVersion 2 and capabilityApi 1.784 or newer';
    const hungry = fiveE((doc) => (lurkerEntry(doc).behavior = { temperament: "hungry" }));
    assert.equal(getCapabilityPackageInstallIssue(manifest(783) as never, hungry), ravenous);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(784) as never, hungry), ravenous);
    const grows = fiveE((doc) => (lurkerEntry(doc).behavior = { shifts: [{ on: "ally-down", to: "arrogant" }] }));
    assert.equal(getCapabilityPackageInstallIssue(manifest(779) as never, grows), proud);
    refused(
      fiveE(
        (doc) =>
          (lurkerEntry(doc).behavior = {
            shifts: [
              { on: "bloodied", to: "reckless" },
              { on: "bloodied", to: "cautious" },
            ],
          }),
      ),
      /Name each trigger once/,
    );
    refused(
      fiveE((doc) => (lurkerEntry(doc).behavior = { guards: ["casters", "casters"] })),
      /Name each once/,
    );
  }

  // A Multiattack's second swing at the one its first dropped turns on the one beside them (re-test 14),
  // and one chosen while already down is struck as chosen.
  {
    const multi = {
      id: "multi",
      name: "Multiattack",
      budget: "action",
      sequence: [{ action: "smash", times: 2 }],
    };
    const swings = (downAlready = false) => {
      const { encounter } = fight({
        knight: { side: "enemy", block: block([smash, multi]), at: { x: 4, y: 4 } },
        brom: { side: "party", block: block([smash], { health: 20 }), at: { x: 5, y: 4 } },
        squire: { side: "party", block: block([smash]), at: { x: 4, y: 5 } },
      });
      if (downAlready) rulesetCombatant(encounter, "brom")!.down = true;
      const step = applyRulesetCombatChoice(
        definition,
        encounter,
        { actorId: "knight", optionId: "multi", targetIds: ["brom"] },
        () => 10,
      );
      return step.events
        .filter((event): event is Extract<RulesetCombatEvent, { type: "attack" }> => event.type === "attack")
        .map((event) => event.targetId);
    };
    assert.deepEqual(swings(), ["brom", "squire"], "the second swing on the squire");
    assert.deepEqual(swings(true), ["brom", "brom"], "as chosen");
  }

  console.log(
    "Combat behavior: merged from the ruleset, the type and the creature; its temperament and role; casters, attackers and a pack's prey first; its opener once; an ambusher keeps still and springs; roles read off what it does; bodyguards stay by their charge; a leader rallies; a temperament turns once; a proud legend flies off; a territorial one keeps its ground; a cruel one strikes the fallen only where the game allows; an honourable one fights fair; a hungry one drags its prey off, and stops; a holder lets go of the fallen and bites the one it holds; a shooter far better up close walks in, a blade not yet called up aside; a strayed bodyguard walks back; a Multiattack turns from the one it dropped; refused and gated at 1.763, 1.776, 1.777, 1.778, 1.779, 1.780, 1.781, 1.782, 1.783 and 1.784.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
