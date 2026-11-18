import { z } from "zod";
import { combatInterruptFields, combatBossSchema } from "../features/combat-director.js";
import { COMBAT_START_PLACES } from "../features/ruleset-combat/deploy.js";
import { combatTacticsSchema, combatAiHintsSchema, combatOrdersSchema } from "../features/combat-ai.js";
import { MARINARA_DAMAGE_TYPES, MARINARA_ARCHETYPES, type MarinaraArchetype } from "../features/marinara-classes.js";

/** How many events a session keeps. A screen prints the tail and asks for nothing older, so the
 *  ledger row stays small however long a fight runs.
 *  ponytail: a fixed window. A fight that needs its whole history on screen wants the events in
 *  their own paged store, which is the upgrade path. Enough for a long fight whole (laptop playtest
 *  2026-10-25: a ten-round fight kept only its last seven rounds at 200). */
export const RULESET_COMBAT_EVENT_LIMIT = 600;
/** How many of the AI's reasons a session keeps beside them, newest first. */
export const RULESET_COMBAT_REASON_LIMIT = 60;

/** The most rounds anything in a fight counts down from. */
export const COMBAT_DIRECTOR_MOST_ROUNDS = 100;

const resourcePools = (v: { hp: number; maxHp: number; mp?: number; maxMp?: number }) =>
  v.hp <= v.maxHp && (v.mp ?? 0) <= (v.maxMp ?? v.mp ?? 0);

/** The most power an item's effect is read at. */
export const COMBAT_DIRECTOR_MOST_POWER = 100;

export const combatDirectorKeySchema = z
  .string()
  .min(1)
  .max(256)
  .refine((v) => !["__proto__", "constructor", "prototype"].includes(v));

export const combatDirectorNumSchema = z.number().finite().min(0).max(1000000);

/** A count of rounds carried in from the story: a potion that lasts an hour is 600 of them. More than
 *  a fight's most is the rest of the fight, never a reason to refuse the fight. */
export const combatDirectorRoundsSchema = z
  .number()
  .int()
  .min(0)
  .transform((value) => Math.min(value, COMBAT_DIRECTOR_MOST_ROUNDS));

export const combatDirectorSlotsSchema = z.record(z.string().regex(/^[1-9]$/), z.number().int().min(0).max(100));

export const combatDirectorSkillSchema = z.object({
  id: combatDirectorKeySchema,
  name: z.string().min(1).max(200),
  // A word the Engine has none of is an attack, never a refused fight (laptop playtest 2026-10-25).
  type: z.enum(["attack", "heal", "buff", "debuff"]).catch("attack"),
  mpCost: combatDirectorNumSchema,
  power: combatDirectorNumSchema.max(20),
  cooldown: combatDirectorRoundsSchema.optional(),
  description: z.string().max(3000).optional(),
  element: z.string().max(100).optional(),
  statusEffect: z.string().max(200).optional(),
  ...combatInterruptFields,
});

export const combatDirectorDirectedCombatantFieldsSchema = z.object({
  id: combatDirectorKeySchema,
  name: z.string().min(1).max(200),
  side: z.enum(["player", "enemy"]),
  /** Caught unaware as the fight begins: a ruleset fight reads it (1.237), and elsewhere an opponent caught so checks its morale first (combat AI E1). */
  surprised: z.boolean().optional(),
  /** Fights in its own lair (1.315): read by a ruleset fight only. */
  inLair: z.boolean().optional(),
  /** Where the Game Master starts it on the board (2026-10-24): read by a ruleset fight only. */
  start: z.enum(COMBAT_START_PLACES).optional().catch(undefined),
  /** What it set up before the fight, standing as it begins (1.462): read by a ruleset fight only. */
  standing: z
    .array(
      z
        .object({
          entry: z.string().min(1).max(200),
          at: z.enum(["self", "between"]).optional().catch(undefined),
          stores: z.string().min(1).max(200).optional(),
          on: z.array(z.string().min(1).max(200)).max(12).optional(),
          kind: z.string().min(1).max(80).optional(),
          mode: z.string().min(1).max(200).optional(),
          into: z.string().min(1).max(200).optional(),
          spares: z.array(z.string().min(1).max(80)).max(8).optional(),
          tag: z.string().min(1).max(80).optional(),
          kinds: z.array(z.string().min(1).max(80)).max(16).optional(),
        })
        .strict(),
    )
    .max(6)
    .optional(),
  hp: combatDirectorNumSchema,
  maxHp: combatDirectorNumSchema.min(1),
  mp: combatDirectorNumSchema.optional(),
  maxMp: combatDirectorNumSchema.optional(),
  attack: combatDirectorNumSchema,
  defense: combatDirectorNumSchema,
  speed: combatDirectorNumSchema,
  level: combatDirectorNumSchema.min(1),
  boss: combatBossSchema.optional(),
  spellSlots: combatDirectorSlotsSchema.optional(),
  skills: z.array(combatDirectorSkillSchema).max(64).optional(),
  tactics: combatTacticsSchema.optional(),
  aiHints: combatAiHintsSchema.optional(),
  controller: z.enum(["manual", "ai"]).optional().catch(undefined),
  orders: combatOrdersSchema.optional(),
  skillCooldowns: z.record(z.string(), combatDirectorRoundsSchema).optional(),
  statusEffects: z
    .array(
      z.object({
        name: z.string().max(200),
        modifier: z.number().finite().min(-100000).max(100000),
        stat: z.enum(["hp", "attack", "defense", "speed"]).catch("attack"),
        turnsLeft: combatDirectorRoundsSchema,
      }),
    )
    .max(64)
    .optional(),
  projectile: z.boolean().optional(),
  requiresSight: z.boolean().optional(),
  combatClass: z.string().max(100).optional(),
  movementMode: z.enum(["walk", "fly", "teleport"]).optional().catch(undefined),
  // Classic Marinara (combat overhaul): what the fight's setup said of a foe (a bestiary family, a
  // tier), or on a saved unit what its screen shows. Read only by a game with Classic Marinara classes.
  marinara: z
    .object({
      family: z
        .object({
          familyId: z.string().min(1).max(80),
          tier: z.enum(["minion", "standard", "elite", "boss"]).optional().catch(undefined),
          level: z.number().int().min(1).max(30).optional().catch(undefined),
        })
        .optional()
        .catch(undefined),
      tier: z.enum(["minion", "standard", "elite", "boss"]).optional().catch(undefined),
    })
    .passthrough()
    .optional()
    .catch(undefined),
  element: z.string().max(100).optional(),
  sprite: z.string().max(3000).optional(),
});

export const combatDirectorDirectedCombatantSchema = combatDirectorDirectedCombatantFieldsSchema.refine(
  resourcePools,
  "Invalid resource pool.",
);

/** An opponent of a ruleset fight. The Engine's own numbers still ride along, because the recap,
 *  the journal and the client's own end-of-battle path read them; what the fight is RESOLVED by is
 *  the creature, the tier or the proposal beside them, and the server decides which. */
export const combatDirectorRulesetOpponentSchema = combatDirectorDirectedCombatantFieldsSchema
  .extend({
    creature: z.string().min(1).max(200).optional(),
    /** What an invented one is, by the ruleset's creature type id. */
    creatureType: z.string().min(1).max(80).optional(),
    tier: combatDirectorKeySchema.optional(),
    /** A stat block in the shared creature form. Checked when the fight is built, so a malformed
     *  one costs its opponent its proposal rather than costing the whole battle. */
    proposed: z.unknown().optional(),
    /** What the Game Master gave it to have on it (1.795): the ruleset's items, one a line, by name
     *  or reference; read when the fight is built, and one it has no such item of is told. */
    carrying: z.array(z.string().min(1).max(200)).max(16).optional(),
  })
  .refine(resourcePools, "Invalid resource pool.");

export const combatDirectorCoordSchema = z.object({
  x: z.number().int().min(0).max(63),
  y: z.number().int().min(0).max(63),
});

export const combatDirectorItemEffectSchema = z.object({
  name: combatDirectorKeySchema,
  target: z.enum(["self", "ally", "enemy", "any"]).catch("any"),
  type: z.enum(["heal", "damage", "buff", "debuff", "status", "utility"]).catch("utility"),
  description: z.string().max(3000),
  // An item's power past the most a fight reads is that most, as a long duration is.
  power: combatDirectorNumSchema.transform((value) => Math.min(value, COMBAT_DIRECTOR_MOST_POWER)).optional(),
  element: z.string().max(100).optional(),
  consumes: z.boolean().optional(),
  status: z
    .object({
      name: combatDirectorKeySchema,
      emoji: z.string().max(30),
      // A status carried in from the story may have run down to 0 turns; it is applied for the
      // default length, as a missing one is.
      duration: combatDirectorRoundsSchema,
      modifier: z.number().finite().min(-100000).max(100000).optional(),
      stat: z.enum(["hp", "attack", "defense", "speed"]).optional().catch(undefined),
    })
    .optional(),
});

export const combatDirectorClassicActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("item"), itemId: combatDirectorKeySchema, targetId: combatDirectorKeySchema.optional() }),
  z.object({ type: z.literal("attack"), targetId: combatDirectorKeySchema }),
  z.object({ type: z.literal("skill"), skillId: combatDirectorKeySchema, targetId: combatDirectorKeySchema }),
  z.object({ type: z.literal("defend") }),
  z.object({ type: z.literal("flee") }),
]);

export const combatDirectorTacticalActionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("attack"),
    unitId: combatDirectorKeySchema,
    targetId: combatDirectorKeySchema,
    to: combatDirectorCoordSchema.optional(),
  }),
  z.object({
    type: z.literal("skill"),
    unitId: combatDirectorKeySchema,
    skillName: z.string().max(200),
    targetId: combatDirectorKeySchema,
    to: combatDirectorCoordSchema.optional(),
  }),
  z.object({
    type: z.literal("item"),
    unitId: combatDirectorKeySchema,
    itemName: combatDirectorKeySchema,
    targetId: combatDirectorKeySchema,
    to: combatDirectorCoordSchema.optional(),
  }),
  z.object({ type: z.literal("move"), unitId: combatDirectorKeySchema, to: combatDirectorCoordSchema }),
  z.object({ type: z.literal("defend"), unitId: combatDirectorKeySchema, to: combatDirectorCoordSchema.optional() }),
  z.object({ type: z.literal("wait"), unitId: combatDirectorKeySchema, to: combatDirectorCoordSchema.optional() }),
  z.object({ type: z.literal("endTurn") }),
  z.object({ type: z.literal("flee") }),
]);

export const combatDirectorCommandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("begin"), unitId: combatDirectorKeySchema }),
  z.object({ type: z.literal("classic"), action: combatDirectorClassicActionSchema }),
  z.object({ type: z.literal("tactical"), action: combatDirectorTacticalActionSchema }),
  z.object({
    type: z.literal("ruleset"),
    optionId: combatDirectorKeySchema,
    targetIds: z.array(combatDirectorKeySchema).max(20),
    payWith: combatDirectorKeySchema.optional(),
    style: combatDirectorKeySchema.optional(),
    /** The weapon's mode, checked against the menu by the resolver. */
    mode: combatDirectorKeySchema.optional(),
    /** Where the `move` option walks to, and the cell a shape is aimed at. Both are checked against
     *  the menu by the resolver; this only bounds them to a board's own size. */
    to: combatDirectorCoordSchema.optional(),
    at: combatDirectorCoordSchema.optional(),
    /** How a wall is laid (1.177) and where further copies go (1.178), checked by the resolver. */
    toward: combatDirectorCoordSchema.optional(),
    side: z.enum(["near", "far"]).optional(),
    ring: z.boolean().optional(),
    also: z.array(combatDirectorCoordSchema).max(9).optional(),
    /** A wall's section struck at instead of a creature (1.200), checked by the resolver. */
    wall: combatDirectorCoordSchema.optional(),
    /** A lasting area ended instead of a creature (1.427), checked by the resolver. */
    dispel: z.object({ casterId: combatDirectorKeySchema, actionId: combatDirectorKeySchema }).strict().optional(),
    /** A condition struck at to cut it away (1.531), checked against the menu by the resolver. */
    cut: z.object({ holderId: combatDirectorKeySchema, condition: combatDirectorKeySchema }).strict().optional(),
    /** Which of its target's conditions it ends (1.427), checked by the resolver. */
    ends: z.array(combatDirectorKeySchema).max(16).optional(),
    /** Who goes along on a teleport (1.276), checked against the menu by the resolver. */
    carries: z.array(combatDirectorKeySchema).max(8).optional(),
    /** Whom a layered wall spares (1.492), checked against the menu by the resolver. */
    designates: z.array(combatDirectorKeySchema).max(20).optional(),
    /** The kinds its zone strikes (1.753), checked against the menu by the resolver. */
    kinds: z.array(combatDirectorKeySchema).max(40).optional(),
    /** Stored instead of done (1.524), in a place the menu offers, checked by the resolver. */
    storesIn: z
      .object({ holderId: combatDirectorKeySchema, item: z.number().int().min(0).max(500).optional() })
      .strict()
      .optional(),
    /** How many uses it spends (1.251), checked against the menu by the resolver. */
    amount: z.number().int().min(1).max(1000).optional(),
    /** How many levels up a target moved to `to` is lifted (1.565), checked by the resolver. */
    rises: z.number().int().min(0).max(100).optional(),
    /** The alterations it is used with (1.253), checked against the action by the resolver. */
    alters: z.array(z.string().min(1).max(200)).max(8).optional(),
    /** Who of its user's side it spares (1.254), checked against the alterations by the resolver. */
    spares: z.array(z.string().min(1).max(200)).max(20).optional(),
    /** Who it heightens (1.255), checked against the alterations by the resolver. */
    heightens: z.string().min(1).max(200).optional(),
  }),
  z.object({ type: z.literal("choose"), candidateId: combatDirectorKeySchema }),
  z.object({ type: z.literal("deploy"), unitId: combatDirectorKeySchema, to: combatDirectorCoordSchema }),
  z.object({ type: z.literal("deployed") }),
  z.object({ type: z.literal("continue") }),
  z.object({ type: z.literal("fallback") }),
  z.object({ type: z.literal("flee") }),
  z.object({ type: z.literal("mercy"), choice: z.enum(["spare", "finish"]) }),
  z.object({ type: z.literal("loadAmmo"), unitId: combatDirectorKeySchema, ammo: z.enum(MARINARA_DAMAGE_TYPES) }),
  z.object({
    type: z.literal("channelElement"),
    unitId: combatDirectorKeySchema,
    element: z.enum(MARINARA_DAMAGE_TYPES),
  }),
  z.object({ type: z.literal("yield") }),
  z.object({ type: z.literal("control"), unitId: combatDirectorKeySchema, controller: z.enum(["manual", "ai"]) }),
  z.object({ type: z.literal("controlCompanions"), controller: z.enum(["manual", "ai"]) }),
  /** A carried weapon or shield taken in hand, and the stack a weapon shoots first (2026-10-26), by
   *  places in the party member's items: checked against what they carry by the resolver. */
  z.object({ type: z.literal("draw"), unitId: combatDirectorKeySchema, item: z.number().int().min(0).max(10000) }),
  z.object({
    type: z.literal("ammo"),
    unitId: combatDirectorKeySchema,
    weapon: z.number().int().min(0).max(10000),
    stack: z.number().int().min(0).max(10000),
  }),
  z.object({ type: z.literal("orders"), unitId: combatDirectorKeySchema, orders: combatOrdersSchema.nullable() }),
  z.object({ type: z.literal("spends"), choose: z.boolean() }),
]);

export const combatDirectorStartSchema = z.object({
  chatId: combatDirectorKeySchema,
  anchor: combatDirectorKeySchema,
  style: z.enum(["classic", "tactical", "ruleset"]),
  party: z.array(combatDirectorDirectedCombatantSchema).min(1, "This fight has nobody on the party's side.").max(20),
  enemies: z.array(combatDirectorRulesetOpponentSchema).min(1, "This fight has nobody to fight.").max(20),
  environment: z.string().max(80).optional(),
  formation: z.string().max(80).optional(),
  battlefield: z.unknown().optional(),
  /** The board pack a ruleset fight is drawn with (1.333), by library id. */
  boardPack: z.string().max(80).optional(),
  /** Whether a ruleset fight is fought on a board, which is what the game's Tactical combat
   *  preference asks for. The ruleset still has to say what a cell is worth. */
  positioned: z.boolean().optional(),
  mechanics: z
    .array(
      z.object({
        name: combatDirectorKeySchema,
        description: z.string().max(3000),
        ownerName: z.string().max(200).optional(),
        // A trigger the Engine has none of ("charge") goes off as an attack does, never refusing the
        // fight (laptop playtest 2026-10-25).
        trigger: z.enum(["round_interval", "hp_threshold", "on_hit", "on_attack", "passive"]).catch("on_attack"),
        // 0 for a mechanic no interval drives (an hp_threshold one's `interval: 0` refused the
        // whole fight), which every reader takes as none.
        interval: combatDirectorRoundsSchema.optional(),
        hpThreshold: z.number().min(0).max(100).optional(),
        counterplay: z.string().max(3000).optional(),
        effectType: z
          .enum(["damage_all", "damage_one", "buff_self", "debuff_party", "status_party", "status_enemy"])
          .optional()
          .catch(undefined),
        power: combatDirectorNumSchema.max(20).optional(),
        element: z.string().max(100).optional(),
        status: combatDirectorItemEffectSchema.shape.status,
      }),
    )
    .max(32)
    .default([]),
  itemEffects: z.array(combatDirectorItemEffectSchema).max(200).default([]),
  /** A Classic Marinara fight's own difficulty for bestiary foes (easy to deadly). */
  encounterDifficulty: z.enum(["easy", "normal", "hard", "deadly"]).optional(),
  inventory: z
    .array(
      z.object({
        name: z.string().max(200),
        quantity: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
        description: z.string().max(2000).optional(),
      }),
    )
    .max(200)
    .default([]),
});

export const combatDirectorMarinaraProgressionSchema = z.object({
  chatId: combatDirectorKeySchema,
  name: z.string().min(1).max(200),
  classId: z.string().max(80).optional(),
  /** Their primary tree: picked before their first fight, or changed while they have not grown yet. */
  primary: z.enum(MARINARA_ARCHETYPES as unknown as [MarinaraArchetype, ...MarinaraArchetype[]]).optional(),
  /** Their Classic row; null goes back to their class's own row. */
  row: z.enum(["front", "back"]).nullable().optional(),
  carried: z.array(z.string().max(80)).max(8).optional(),
  /** Tracker companions (Alyssa 23:31): the one made active, or the one let go; outside fights only. */
  activeCompanion: z.string().min(1).max(200).optional(),
  releaseCompanion: z.string().min(1).max(200).optional(),
  /** What they wear (marinara-items.ts ids), from what the party's bags hold. */
  equipment: z
    .object({
      weapon: z.string().max(80).optional(),
      armor: z.string().max(80).optional(),
      accessories: z.array(z.string().max(80)).max(4).optional(),
    })
    .strict()
    .optional(),
});

export const combatDirectorStateSchema = z.object({ chatId: combatDirectorKeySchema, anchor: combatDirectorKeySchema });

export const combatDirectorCommandBodySchema = z.object({
  chatId: combatDirectorKeySchema,
  anchor: combatDirectorKeySchema,
  id: combatDirectorKeySchema,
  instanceId: combatDirectorKeySchema,
  revision: z.number().int().min(0),
  requestId: combatDirectorKeySchema,
  command: combatDirectorCommandSchema,
  debugMode: z.boolean().optional(),
});
