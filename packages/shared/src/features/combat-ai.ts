import { ENEMY_AI_VARIATION, type GameDifficulty } from "./combat-conditions.js";
import { z } from "zod";
import type { CombatSkill, CombatStatusEffect } from "../types/game.js";

import {
  COMBAT_MINDS,
  COMBAT_ROLES,
  COMBAT_TEMPERAMENTS,
  COMBAT_NAMED_TEMPERAMENTS,
  COMBAT_SHIFT_TRIGGERS,
  combatMindWithHint,
  type CombatShiftTrigger,
  type CombatTemperament,
  type CombatMind,
} from "./combat-minds.js";
export {
  COMBAT_MINDS,
  combatMindWithHint,
  COMBAT_ROLES,
  COMBAT_TEMPERAMENTS,
  COMBAT_NAMED_TEMPERAMENTS,
  COMBAT_SHIFT_TRIGGERS,
  type CombatShiftTrigger,
  type CombatMind,
  type CombatRole,
  type CombatTemperament,
} from "./combat-minds.js";
export const COMBAT_ADJECTIVES = ["mindless", ...COMBAT_TEMPERAMENTS] as const;
/** The temperaments an animal's nature may have: none that plans. */
const INSTINCT_ADJECTIVES: readonly (typeof COMBAT_ADJECTIVES)[number][] = [
  "reckless",
  "cautious",
  "opportunistic",
  "protective",
  "cowardly",
  "coordinated",
];
/** A mind written as its temperament, or a temperament as its mind, moved where it belongs (laptop
 *  playtest 2026-10-25: temperament "cunning", and mind "disciplined"), in any case. */
function combatAiHintsSorted(input: unknown): unknown {
  if (!input || typeof input !== "object" || Array.isArray(input)) return input;
  const hints = { ...(input as Record<string, unknown>) };
  const word = (value: unknown) => (typeof value === "string" ? value.trim().toLowerCase() : value);
  const minds: readonly unknown[] = COMBAT_MINDS;
  const tempers: readonly unknown[] = COMBAT_ADJECTIVES;
  const mind = word(hints.mind);
  const temperament = word(hints.temperament);
  if (mind !== undefined) hints.mind = mind;
  if (temperament !== undefined) hints.temperament = temperament;
  if (!tempers.includes(temperament) && minds.includes(temperament)) {
    if (hints.mind === undefined || !minds.includes(mind)) hints.mind = temperament;
    delete hints.temperament;
  }
  if (!minds.includes(mind) && tempers.includes(mind)) {
    if (hints.temperament === undefined || !tempers.includes(temperament)) hints.temperament = mind;
    if (hints.mind === mind) delete hints.mind;
  }
  return hints;
}
// A word it does not know at all is left out, and the Engine deals its own (laptop playtest
// 2026-10-25: a temperament "cunning" refused a whole fight).
export const combatAiHintsSchema = z.preprocess(
  combatAiHintsSorted,
  z.object({
    category: z.enum(["beast", "monstrosity", "other", "unknown"]).optional().catch(undefined),
    proficiency: z.enum(["novice", "trained", "veteran", "master"]).optional().catch(undefined),
    temperament: z.enum(COMBAT_ADJECTIVES).optional().catch(undefined),
    /** Its mind, where the story says what the creature's own data cannot: one dominated, one enraged. */
    mind: z.enum(COMBAT_MINDS).optional().catch(undefined),
    /** A named individual of the story rather than a nameless foe (combat AI P9): one the Game Master
     *  may play itself, as it plays a boss. */
    named: z.boolean().optional(),
    /** How steady it is when a fight turns against it, on the old games' 2 to 12 morale scale: 2 breaks
     *  at the first scare, 12 never does. Read off its mind and temperament when absent. */
    morale: z.number().int().min(2).max(12).optional().catch(undefined),
    /** Its side follows it (a bandit chief, a pack's alpha): its fall shakes the rest. */
    leader: z.boolean().optional().catch(undefined),
    /** What turns its temperament into another, once (combat AI T7): a proud one methodical once
     *  bloodied, a desperate one reckless once cornered. The first that happens wins. */
    shifts: z
      .array(z.object({ on: z.enum(COMBAT_SHIFT_TRIGGERS), to: z.enum(COMBAT_TEMPERAMENTS) }).strict())
      .min(1)
      .max(4)
      .optional()
      .catch(undefined),
    /** Its temperament is a party member's own, kept from fight to fight (see `gameCardTemperament`):
     *  it fights with exactly that one, never a draw that only leans toward it. */
    kept: z.literal(true).optional().catch(undefined),
  }),
);
export const combatTacticsSchema = z
  .object({
    version: z.literal(1),
    seed: z.number().int().min(0).max(0xffffffff),
    category: z.enum(["beast", "monstrosity", "other", "unknown"]),
    proficiency: z.enum(["novice", "trained", "veteran", "master"]),
    role: z.enum(COMBAT_ROLES),
    adjective: z.enum(COMBAT_ADJECTIVES),
    targetId: z.string().max(256).optional(),
    holds: z.number().int().min(0).max(2).optional(),
    /** Its mind (see `COMBAT_MINDS`); one saved before minds were read is played as `tactical`. */
    mind: z.enum(COMBAT_MINDS).optional(),
    /** It has made its opening move (a ruleset creature's `behavior.opens`, 1.763). */
    opened: z.literal(true).optional(),
    /** It lay in wait and has sprung (a ruleset creature's `behavior.ambush`, 1.763). */
    sprung: z.literal(true).optional(),
    /** Its role was read off what its ruleset sheet or block can do (1.763). */
    roleRead: z.literal(true).optional(),
    /** Its temperament has turned, as its `shifts` say (combat AI T7): it turns only once. */
    shifted: z.literal(true).optional(),
    /** The temperament it had before it turned: a proud one stays proud enough to fly off. */
    shiftedFrom: z.enum(COMBAT_ADJECTIVES).optional(),
    /** Where a territorial one stood when the fight began: the ground it keeps (combat AI T4). */
    home: z.object({ x: z.number().int(), y: z.number().int() }).strict().optional(),
    /** Turns in a row it spent dodging, getting away or hiding: two, and it fights again, so two
     *  careful sides never stare at each other all fight. */
    wary: z.number().int().min(0).max(99).optional(),
  })
  .superRefine((value, ctx) => {
    // A mindless creature has no temperament but its own, and nothing else is mindless.
    if ((value.mind === "mindless") !== (value.adjective === "mindless") && value.mind !== undefined) {
      ctx.addIssue({ code: "custom", path: ["adjective"], message: "Only a mindless creature is Mindless." });
    }
  });
export type CombatTactics = z.infer<typeof combatTacticsSchema>;

/** How an arrogant combatant turns when it names no `shifts` of its own (combat AI T5). */
export const COMBAT_ARROGANT_SHIFTS: ReadonlyArray<{ on: CombatShiftTrigger; to: CombatTemperament }> = [
  { on: "bloodied", to: "methodical" },
  { on: "ally-down", to: "methodical" },
];

/**
 * Turns a combatant's temperament as its `shifts` say (combat AI T7): the first of them whose
 * trigger has happened, once a fight, and never a mindless one's. The temperament it turned to.
 */
export function shiftCombatTemperament(
  tactics: CombatTactics | undefined,
  shifts: ReadonlyArray<{ on: CombatShiftTrigger; to: CombatTemperament }> | undefined,
  happened: (trigger: CombatShiftTrigger) => boolean,
): CombatTemperament | undefined {
  if (!tactics || tactics.shifted || tactics.adjective === "mindless") return undefined;
  // An arrogant one gets serious once bloodied or once one of its own falls (combat AI T5).
  const list = shifts?.length ? shifts : tactics.adjective === "arrogant" ? COMBAT_ARROGANT_SHIFTS : undefined;
  const shift = list?.find((one) => happened(one.on));
  if (!shift) return undefined;
  tactics.shiftedFrom = tactics.adjective;
  tactics.adjective = shift.to;
  tactics.shifted = true;
  return shift.to;
}
/**
 * Where a companion the Engine plays stands in a fight, as its player orders: `guard` the leader (a
 * companion's default), `follow` the leader onto whoever they are attacking, `protect` one friend
 * (`protectId`), `hold` its ground, stay `back` out of harm's way, or `retreat` from the fight.
 */
/** `free` fights on its own: whoever it judges best, anywhere on the board, with nobody to stay by
 *  (laptop playtest 2026-10-25). `guard` stays the default. */
export const COMBAT_POSTURES = ["guard", "follow", "free", "protect", "hold", "back", "retreat"] as const;
export type CombatPosture = (typeof COMBAT_POSTURES)[number];
/** A companion's standing orders: its posture, and whether it keeps its best for when it matters
 *  (`conserve`), heals and helps before anything else (`heal`), and beats opponents without killing
 *  them (`spare`). */
export const combatOrdersSchema = z
  .object({
    posture: z.enum(COMBAT_POSTURES).optional(),
    protectId: z.string().min(1).max(256).optional(),
    conserve: z.boolean().optional(),
    heal: z.boolean().optional(),
    spare: z.boolean().optional(),
  })
  .strict()
  .refine((orders) => (orders.posture === "protect") === (orders.protectId !== undefined), {
    message: "Protect names whom, and only protect does.",
    path: ["protectId"],
  });
export type CombatOrders = z.infer<typeof combatOrdersSchema>;
export type CombatAiHints = z.infer<typeof combatAiHintsSchema>;
export type CombatController = "manual" | "ai";

export interface AiCombatant {
  id: string;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  speed: number;
  level: number;
  mp?: number;
  maxMp?: number;
  skills?: CombatSkill[];
  statusEffects?: CombatStatusEffect[];
  combatClass?: string;
  tactics?: CombatTactics;
  aiHints?: CombatAiHints;
  /** Its player's standing orders, for a companion the Engine plays. */
  orders?: CombatOrders;
}

/** Domain-separated deterministic choices, independent of combat rolls. */
export function combatAiHash(value: string): number {
  let hash = 2166136261;
  for (const c of value) hash = Math.imul(hash ^ c.charCodeAt(0), 16777619);
  return hash >>> 0;
}

/**
 * A combatant's profile, made once and kept. `mind` is what its own data says it is (a ruleset's
 * creature, see `rulesetCombatantMind`); the Game Master's hint wins over it only where it puts less
 * thought in it (`combatMindWithHint`), and with neither an animal (`category` beast) is `instinct`
 * and anything else plays as `tactical`.
 */
export function assignCombatTactics(
  unit: AiCombatant,
  seed: number,
  mind?: CombatMind,
  /** What it is for, where its own data says (a ruleset's creature, combat AI A3): its temperament is
   *  drawn with it, not with a guess from its Engine class. */
  roled?: CombatTactics["role"],
): CombatTactics {
  const hints = combatAiHintsSchema.parse(unit.aiHints ?? {});
  if (unit.tactics) return combatTacticsSchema.parse(unit.tactics);
  const minded: CombatMind =
    combatMindWithHint(hints.mind ?? (hints.temperament === "mindless" ? "mindless" : undefined), mind) ??
    (hints.category === "beast" ? "instinct" : "tactical");
  const skills = unit.skills ?? [];
  const support = skills.some((s) => s.type === "heal" || s.type === "buff");
  const control = skills.some((s) => s.type === "debuff");
  // A boss fights a side alone (combat AI A2).
  const role: CombatTactics["role"] = roled
    ? roled
    : (unit as { boss?: unknown }).boss
      ? "solo"
      : support
        ? "supporter"
        : control
          ? "controller"
          : unit.combatClass === "mage"
            ? "spellcaster"
            : unit.combatClass === "archer"
              ? "marksman"
              : unit.combatClass === "knight"
                ? "bulwark"
                : unit.combatClass === "rogue"
                  ? "skirmisher"
                  : skills.some((s) => s.element && s.type === "attack")
                    ? "spellcaster"
                    : "bruiser";
  const trained =
    hints.proficiency ??
    (unit.level >= 15 ? "master" : unit.level >= 8 ? "veteran" : unit.level >= 3 ? "trained" : "novice");
  // A genius is never less than a veteran at it.
  const proficiency: CombatTactics["proficiency"] =
    minded === "genius" && (trained === "novice" || trained === "trained") ? "veteran" : trained;
  const competence = ["novice", "trained", "veteran", "master"].indexOf(proficiency) / 3;
  const suited: Record<CombatTactics["role"], readonly CombatTactics["adjective"][]> = {
    bruiser: ["reckless", "disciplined", "opportunistic"],
    bulwark: ["protective", "patient", "disciplined"],
    skirmisher: ["opportunistic", "cautious", "coordinated"],
    marksman: ["patient", "cautious", "coordinated"],
    spellcaster: ["methodical", "cautious", "disciplined"],
    supporter: ["supportive", "protective", "coordinated"],
    controller: ["methodical", "coordinated", "disciplined"],
    solo: ["methodical", "disciplined", "opportunistic"],
  };
  const weighted = COMBAT_ADJECTIVES.filter(
    (a) =>
      a !== "mindless" &&
      (!(COMBAT_NAMED_TEMPERAMENTS as readonly string[]).includes(a) || hints.temperament === a) &&
      (a !== "supportive" || support || role === "supporter") &&
      (minded !== "instinct" || INSTINCT_ADJECTIVES.includes(a)),
  ).map((adjective) => ({
    adjective,
    weight: 1 + (suited[role].includes(adjective) ? 2 + 4 * competence : 0) + (hints.temperament === adjective ? 8 : 0),
  }));
  let draw =
    (combatAiHash(`assignment:${seed}:${unit.id}`) / 0x100000000) * weighted.reduce((sum, p) => sum + p.weight, 0);
  let adjective: CombatTactics["adjective"] = "disciplined";
  for (const p of weighted) {
    draw -= p.weight;
    if (draw < 0) {
      adjective = p.adjective;
      break;
    }
  }
  // A party member's own temperament is theirs in every fight, not a lean (Alyssa 2026-10-31).
  if (hints.kept && hints.temperament && hints.temperament !== "mindless") adjective = hints.temperament;
  const category = hints.category ?? "unknown";
  if (minded === "mindless") adjective = "mindless";
  return { version: 1, seed: seed >>> 0, category, proficiency, role, adjective, mind: minded };
}

/**
 * The temperaments a player character or companion may have. Fanatical, territorial and hungry are
 * for foes only; arrogant, cruel and honourable are open to the party where their description says so
 * (Alyssa 2026-10-31).
 */
export const COMBAT_PARTY_TEMPERAMENTS = [
  "reckless",
  "cautious",
  "opportunistic",
  "protective",
  "supportive",
  "disciplined",
  "cowardly",
  "patient",
  "methodical",
  "coordinated",
  "arrogant",
  "cruel",
  "honourable",
] as const satisfies readonly CombatTemperament[];
export type CombatPartyTemperament = (typeof COMBAT_PARTY_TEMPERAMENTS)[number];

/** A party temperament as a model or an editor wrote it, in any case and either spelling of honourable. */
export function readPartyTemperament(value: unknown): CombatPartyTemperament | undefined {
  if (typeof value !== "string") return undefined;
  const word = value.trim().toLowerCase();
  const spelled = word === "honorable" ? "honourable" : word;
  return (COMBAT_PARTY_TEMPERAMENTS as readonly string[]).includes(spelled)
    ? (spelled as CombatPartyTemperament)
    : undefined;
}

/**
 * A party member's temperament as their game card keeps it: `current` is the one they fight with and
 * the story may change, `initial` the one they started the game with, which decides their secondary
 * class tree and never changes. A card from before either was kept has neither.
 */
export function gameCardTemperament(
  card: Record<string, unknown> | null | undefined,
): { current: CombatPartyTemperament; initial: CombatPartyTemperament } | null {
  const current = readPartyTemperament(card?.temperament);
  const initial = readPartyTemperament(card?.temperamentInitial) ?? current;
  return current && initial ? { current, initial } : null;
}

/**
 * The temperament a party member is given when nothing about them says one: drawn once for the game
 * from its id and their name, so every fight draws the same one until it is kept on their card.
 */
export function partyTemperamentFallback(gameId: string, name: string): CombatPartyTemperament {
  const allowed = COMBAT_PARTY_TEMPERAMENTS.filter(
    // Nothing known says they would run or that they heal: those two are read, never dealt.
    (one) =>
      !(COMBAT_NAMED_TEMPERAMENTS as readonly string[]).includes(one) && one !== "supportive" && one !== "cowardly",
  );
  const key = name.trim().toLowerCase();
  return allowed[combatAiHash(`party-temperament:${gameId}:${key}`) % allowed.length]!;
}

/** A party member's fight hints with their own temperament kept, over whatever the fight's setup gave. */
export function withKeptTemperament(
  hints: CombatAiHints | undefined,
  temperament: CombatPartyTemperament,
): CombatAiHints {
  return { ...hints, temperament, kept: true };
}

/** Mode adapters enumerate only actions their resolver can actually execute. */
export interface CombatAiCandidate<T> {
  action: T;
  targetId?: string;
  damage?: number;
  finish?: number;
  healing?: number;
  support?: number;
  setup?: number;
  risk?: number;
  cost?: number;
  protection?: number;
  coordination?: number;
  /** What its own data says it goes for first (a ruleset creature's `behavior`, 1.763). */
  focus?: number;
  hold?: boolean;
}

export function combatAiScoreNoise(
  profile: CombatTactics,
  id: string,
  turn: number | string,
  index: number,
  difficulty: GameDifficulty = "normal",
): number {
  const trained = profile.proficiency === "novice" ? 0.12 : profile.proficiency === "trained" ? 0.07 : 0.02;
  // What it is adds to how well it was trained: an animal's choices wander, a genius's do not.
  const variation =
    profile.mind === "instinct"
      ? trained + 0.06
      : profile.mind === "cunning"
        ? trained + 0.03
        : profile.mind === "genius"
          ? trained / 2
          : trained;
  return (
    (variation * ENEMY_AI_VARIATION[difficulty] * combatAiHash(`${index}:decision:${profile.seed}:${id}:${turn}`)) /
    0x100000000
  );
}

export function chooseCombatCandidate<T>(
  unit: AiCombatant,
  candidates: CombatAiCandidate<T>[],
  turn: number,
  difficulty: GameDifficulty = "normal",
  /** Its standing orders: its own unless its caller worked out a companion's default. */
  orders: CombatOrders | undefined = unit.orders,
): T {
  return chooseRankedCombatCandidate(unit, candidates, turn, difficulty, orders).candidate.action;
}

/** `chooseCombatCandidate`'s pick with how it was scored, for a log that says why it was made. Keeps
 *  the unit's memory of its pick exactly as `chooseCombatCandidate` does. */
export function chooseRankedCombatCandidate<T>(
  unit: AiCombatant,
  candidates: CombatAiCandidate<T>[],
  turn: number,
  difficulty: GameDifficulty = "normal",
  orders: CombatOrders | undefined = unit.orders,
): RankedCombatCandidate<T> {
  if (!candidates.length) throw new Error("AI needs at least one legal action.");
  const profile = unit.tactics!;
  const chosen = rankCombatCandidates(unit, candidates, turn, difficulty, orders)[0]!;
  profile.holds = chosen.candidate.hold ? Math.min(2, (profile.holds ?? 0) + 1) : 0;
  if (chosen.candidate.targetId) profile.targetId = chosen.candidate.targetId;
  return chosen;
}

/** One candidate as `rankCombatCandidates` scored it. */
export interface RankedCombatCandidate<T> {
  candidate: CombatAiCandidate<T>;
  score: number;
  parts: CombatAiScoreParts;
}

/** What each weighed part of a candidate added to its score, after the unit's weights. */
export type CombatAiScoreParts = Partial<
  Record<
    "damage" | "finish" | "healing" | "support" | "setup" | "risk" | "cost" | "protection" | "coordination" | "focus",
    number
  >
>;

/** What a turn must stand to gain for its wavering to be felt in full: about a third of a foe. */
const COMBAT_AI_FULL_STAKES = 0.4;
/** How close to the best gain on the table a blow must come to count as alike (re-test 13). */
const COMBAT_AI_ALIKE = 0.97;

/**
 * Every candidate scored the way `chooseCombatCandidate` scores it, best first, with what each part
 * added: the Engine's own reading of the turn, which a Game Master playing the same unit is shown as
 * suggestions. Changes nothing on the unit.
 */
export function rankCombatCandidates<T>(
  unit: AiCombatant,
  candidates: CombatAiCandidate<T>[],
  turn: number,
  difficulty: GameDifficulty = "normal",
  orders: CombatOrders | undefined = unit.orders,
): Array<RankedCombatCandidate<T>> {
  const profile = unit.tactics!;
  const adjective = profile.adjective;
  const wounded = unit.hp / Math.max(1, unit.maxHp) < 0.35;
  const weights = {
    // A fanatic (T2) gives no thought to its own skin, as a reckless one does.
    damage: adjective === "reckless" || adjective === "fanatical" ? 2 : 1,
    // A cruel one (T3) finishes whoever it can, and likes to see them held down or afraid.
    // An honourable one (T6) takes no joy in the kill.
    finish:
      adjective === "opportunistic" || adjective === "cruel"
        ? 3
        : adjective === "hungry"
          ? 2
          : adjective === "honourable"
            ? 0.2
            : 0.5,
    healing: adjective === "supportive" ? 4 : adjective === "reckless" ? 0.4 : 1.5,
    support: adjective === "supportive" ? 1.2 : 0.35,
    // An arrogant one (T5) sets nothing up and keeps its best for a foe worth it.
    // A hungry one (T8) takes hold of its prey.
    setup:
      adjective === "methodical"
        ? 1.6
        : adjective === "hungry"
          ? 1
          : adjective === "cruel"
            ? 0.8
            : adjective === "arrogant"
              ? 0.05
              : 0.2,
    risk:
      adjective === "reckless" || adjective === "fanatical"
        ? 0.05
        : adjective === "arrogant"
          ? 0.2
          : adjective === "cautious"
            ? 2
            : adjective === "cowardly" && wounded
              ? 5
              : 0.6,
    cost: adjective === "reckless" ? 0 : adjective === "arrogant" ? 2 : adjective === "cautious" ? 0.6 : 0.2,
    protection: adjective === "protective" ? 2 : adjective === "fanatical" ? 1 : 0,
    // A disciplined one keeps formation (T1): it goes where its side is going.
    coordination: adjective === "coordinated" ? 1.5 : adjective === "disciplined" ? 1 : 0,
    focus: 1,
  };
  // What it is bends how it weighs things. A mindless creature knows only to hit; an animal drags down
  // the weakest and minds its own hide once hurt; a genius never ignores the danger it stands in.
  if (profile.mind === "mindless")
    Object.assign(weights, {
      finish: 0,
      healing: 0,
      support: 0,
      setup: 0,
      risk: 0,
      cost: 0,
      protection: 0,
      coordination: 0,
      focus: 0,
    });
  else if (profile.mind === "instinct") {
    weights.finish *= 2;
    weights.setup = Math.min(weights.setup, 0.1);
    if (wounded) weights.risk = Math.max(weights.risk, 3);
  } else if (profile.mind === "genius") weights.risk = Math.max(weights.risk, 0.8);
  // What it is for bends it too (combat AI A1): a bulwark stands up for its friends, a skirmisher
  // picks off and flanks, a marksman keeps out of harm, a caster keeps its best for when it matters
  // and sets up, a controller holds people down, a supporter backs its friends, and one that fights a side alone
  // spends everything it has and does not mind a blow.
  if (profile.mind !== "mindless") {
    if (profile.role === "bulwark") weights.protection = Math.max(weights.protection, 1.5);
    else if (profile.role === "skirmisher") {
      weights.coordination = Math.max(weights.coordination, 0.6);
      weights.finish *= 1.3;
    } else if (profile.role === "marksman") weights.risk = Math.max(weights.risk * 1.5, 0.9);
    else if (profile.role === "spellcaster") weights.cost = Math.max(weights.cost, 0.4);
    else if (profile.role === "controller") weights.setup = Math.max(weights.setup, 1.2);
    else if (profile.role === "supporter") weights.support = Math.max(weights.support, 0.8);
    else if (profile.role === "solo") {
      // Save an arrogant one (T5), which holds its best back until the fight proves worth it. It still
      // minds a little what it spends, so a bigger slot buys what it is worth and no more (cloud
      // archetypes 2026-10-25: a legendary priest cast 13 Healing Words out of its 6th to 3rd level
      // slots, the biggest first, as each was free to it).
      if (adjective !== "arrogant") weights.cost = Math.min(weights.cost, 0.15);
      weights.damage *= 1.2;
      weights.risk = Math.min(weights.risk, 0.4);
    }
  }
  // What its player told it: keep the best for later, heal first, beat without killing, keep out of
  // harm's way, or get out of the fight.
  if (orders?.conserve) weights.cost = Math.max(weights.cost, 1.2);
  if (orders?.heal) {
    weights.healing *= 2.5;
    weights.support *= 2;
    // Healing first comes before joining its side's attack.
    weights.coordination = Math.min(weights.coordination, 0.35);
  }
  if (orders?.spare) weights.finish = 0;
  if (orders?.posture === "back") weights.risk = Math.max(weights.risk, 2.5);
  if (orders?.posture === "retreat") {
    weights.risk = Math.max(weights.risk, 5);
    weights.damage *= 0.25;
  }
  // What is on the table: the most any candidate gains. Its wavering is a share of that, so against a
  // party too sturdy for any one blow to dent, a trained captain still tells a full Multiattack from
  // two daggers thrown at disadvantage (re-test 10), as it does against a frail one.
  const gains = (candidate: CombatAiCandidate<T>) =>
    (candidate.damage ?? 0) * weights.damage +
    (candidate.finish ?? 0) * weights.finish +
    (candidate.healing ?? 0) * weights.healing +
    (candidate.support ?? 0) * weights.support +
    (candidate.setup ?? 0) * weights.setup;
  const most = Math.max(0, ...candidates.map(gains));
  const stakes = Math.min(1, Math.max(0.1, most / COMBAT_AI_FULL_STAKES));
  const scored = candidates.map((candidate) => {
    const parts: CombatAiScoreParts = {};
    // Summed in this order, as it always was: risk and cost count against it.
    let score = 0;
    for (const key of [
      "damage",
      "finish",
      "healing",
      "support",
      "setup",
      "risk",
      "cost",
      "protection",
      "coordination",
      "focus",
    ] as const) {
      const part = (candidate[key] ?? 0) * weights[key] * (key === "risk" || key === "cost" ? -1 : 1);
      score += part;
      if (part !== 0) parts[key] = part;
    }
    // Sticking with its target is worth as much as the turn is, and less for a weaker blow at them:
    // never two daggers at disadvantage past a Multiattack beside it (re-test 10).
    if (adjective === "methodical" && profile.targetId !== undefined && candidate.targetId === profile.targetId)
      score += 0.35 * stakes * (most > 0 ? Math.min(1, gains(candidate) / most) : 1);
    if (candidate.hold && orders?.posture === "retreat") score += 0.8;
    if (candidate.hold && (profile.holds ?? 0) < 1 && profile.mind !== "mindless") {
      if (adjective === "patient") score += 0.65;
      if (adjective === "cowardly" && wounded) score += 0.8;
    }
    return { candidate, score, parts };
  });
  const leading = Math.max(...scored.map((one) => one.score));
  return scored
    .map((one, i) => {
      // A blow that gains clearly less than the best one on the table, and is behind already, never
      // wavers past it (re-test 13): two daggers worth 93 hundredths of a Multiattack stay behind it.
      const gained = gains(one.candidate);
      const weaker = one.score < leading && gained > 0 && gained < most * COMBAT_AI_ALIKE;
      return weaker
        ? one
        : { ...one, score: one.score + stakes * combatAiScoreNoise(profile, unit.id, turn, i, difficulty) };
    })
    .sort((a, b) => b.score - a.score);
}
