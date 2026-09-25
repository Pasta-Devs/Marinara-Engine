import { ENEMY_AI_VARIATION, type GameDifficulty } from "./combat-conditions.js";
import { z } from "zod";
import type { CombatSkill, CombatStatusEffect } from "../types/game.js";

export const COMBAT_ADJECTIVES = [
  "mindless",
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
] as const;
export const combatAiHintsSchema = z.object({
  category: z.enum(["beast", "monstrosity", "other", "unknown"]).optional(),
  proficiency: z.enum(["novice", "trained", "veteran", "master"]).optional(),
  temperament: z.enum(COMBAT_ADJECTIVES).optional(),
});
export const combatTacticsSchema = z
  .object({
    version: z.literal(1),
    seed: z.number().int().min(0).max(0xffffffff),
    category: z.enum(["beast", "monstrosity", "other", "unknown"]),
    proficiency: z.enum(["novice", "trained", "veteran", "master"]),
    role: z.enum(["bruiser", "bulwark", "skirmisher", "marksman", "spellcaster", "supporter", "controller"]),
    adjective: z.enum(COMBAT_ADJECTIVES),
    targetId: z.string().max(256).optional(),
    holds: z.number().int().min(0).max(2).optional(),
  })
  .superRefine((value, ctx) => {
    if ((value.category === "beast" || value.category === "monstrosity") && value.adjective !== "mindless") {
      ctx.addIssue({ code: "custom", path: ["adjective"], message: "Beasts and Monstrosities must be Mindless." });
    }
  });
export type CombatTactics = z.infer<typeof combatTacticsSchema>;
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
}

/** Domain-separated deterministic choices, independent of combat rolls. */
export function combatAiHash(value: string): number {
  let hash = 2166136261;
  for (const c of value) hash = Math.imul(hash ^ c.charCodeAt(0), 16777619);
  return hash >>> 0;
}

export function assignCombatTactics(unit: AiCombatant, seed: number): CombatTactics {
  const hints = combatAiHintsSchema.parse(unit.aiHints ?? {});
  if (unit.tactics) {
    const saved = combatTacticsSchema.parse(unit.tactics);
    if ((hints.category === "beast" || hints.category === "monstrosity") && saved.adjective !== "mindless")
      throw new Error("Beasts and Monstrosities must be Mindless.");
    return saved;
  }
  const skills = unit.skills ?? [];
  const support = skills.some((s) => s.type === "heal" || s.type === "buff");
  const control = skills.some((s) => s.type === "debuff");
  const role: CombatTactics["role"] = support
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
  const proficiency =
    hints.proficiency ??
    (unit.level >= 15 ? "master" : unit.level >= 8 ? "veteran" : unit.level >= 3 ? "trained" : "novice");
  const competence = ["novice", "trained", "veteran", "master"].indexOf(proficiency) / 3;
  const suited: Record<CombatTactics["role"], readonly CombatTactics["adjective"][]> = {
    bruiser: ["reckless", "disciplined", "opportunistic"],
    bulwark: ["protective", "patient", "disciplined"],
    skirmisher: ["opportunistic", "cautious", "coordinated"],
    marksman: ["patient", "cautious", "coordinated"],
    spellcaster: ["methodical", "cautious", "disciplined"],
    supporter: ["supportive", "protective", "coordinated"],
    controller: ["methodical", "coordinated", "disciplined"],
  };
  const weighted = COMBAT_ADJECTIVES.filter((a) => a !== "mindless" && (a !== "supportive" || support)).map(
    (adjective) => ({
      adjective,
      weight:
        1 + (suited[role].includes(adjective) ? 2 + 4 * competence : 0) + (hints.temperament === adjective ? 8 : 0),
    }),
  );
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
  const category = hints.category ?? "unknown";
  if (category === "beast" || category === "monstrosity" || hints.temperament === "mindless") adjective = "mindless";
  return { version: 1, seed: seed >>> 0, category, proficiency, role, adjective };
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
  hold?: boolean;
}

export function combatAiScoreNoise(
  profile: CombatTactics,
  id: string,
  turn: number | string,
  index: number,
  difficulty: GameDifficulty = "normal",
): number {
  const variation = profile.proficiency === "novice" ? 0.12 : profile.proficiency === "trained" ? 0.07 : 0.02;
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
): T {
  if (!candidates.length) throw new Error("AI needs at least one legal action.");
  const profile = unit.tactics!;
  const adjective = profile.adjective;
  const wounded = unit.hp / Math.max(1, unit.maxHp) < 0.35;
  const weights = {
    damage: adjective === "reckless" ? 2 : 1,
    finish: adjective === "opportunistic" ? 3 : 0.5,
    healing: adjective === "supportive" ? 4 : adjective === "reckless" ? 0.4 : 1.5,
    support: adjective === "supportive" ? 1.2 : 0.35,
    setup: adjective === "methodical" ? 1.6 : 0.2,
    risk:
      adjective === "reckless" ? 0.05 : adjective === "cautious" ? 2 : adjective === "cowardly" && wounded ? 5 : 0.6,
    cost: adjective === "reckless" ? 0 : adjective === "cautious" ? 0.6 : 0.2,
    protection: adjective === "protective" ? 2 : 0,
    coordination: adjective === "coordinated" ? 1.5 : 0,
  };
  const scores = candidates
    .map((candidate, i) => {
      let score =
        (candidate.damage ?? 0) * weights.damage +
        (candidate.finish ?? 0) * weights.finish +
        (candidate.healing ?? 0) * weights.healing +
        (candidate.support ?? 0) * weights.support +
        (candidate.setup ?? 0) * weights.setup -
        (candidate.risk ?? 0) * weights.risk -
        (candidate.cost ?? 0) * weights.cost +
        (candidate.protection ?? 0) * weights.protection +
        (candidate.coordination ?? 0) * weights.coordination;
      if (adjective === "methodical" && profile.targetId !== undefined && candidate.targetId === profile.targetId)
        score += 0.35;
      if (candidate.hold && (profile.holds ?? 0) < 1) {
        if (adjective === "patient") score += 0.65;
        if (adjective === "cowardly" && wounded) score += 0.8;
      }
      score += combatAiScoreNoise(profile, unit.id, turn, i, difficulty);
      return { candidate, score };
    })
    .sort((a, b) => b.score - a.score);
  const chosen = scores[0]!.candidate;
  profile.holds = chosen.hold ? Math.min(2, (profile.holds ?? 0) + 1) : 0;
  if (chosen.targetId) profile.targetId = chosen.targetId;
  return chosen.action;
}
