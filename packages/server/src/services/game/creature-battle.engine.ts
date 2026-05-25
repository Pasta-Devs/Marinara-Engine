// ──────────────────────────────────────────────
// Creature Battler — Deterministic Rule Engine
// ──────────────────────────────────────────────
import type {
  CreatureInstance,
  CreatureMove,
  CreatureType,
  CreatureAction,
} from "@marinara-engine/shared";

const TYPE_CHART: Record<CreatureType, Partial<Record<CreatureType, number>>> = {
  Normal:   { Rock: 0.5, Ghost: 0, Steel: 0.5 },
  Fire:     { Fire: 0.5, Water: 0.5, Grass: 2, Ice: 2, Bug: 2, Rock: 0.5, Dragon: 0.5, Steel: 2 },
  Water:    { Fire: 2, Water: 0.5, Grass: 0.5, Ground: 2, Rock: 2, Dragon: 0.5 },
  Grass:    { Fire: 0.5, Water: 2, Grass: 0.5, Poison: 0.5, Ground: 2, Flying: 0.5, Bug: 0.5, Rock: 2, Dragon: 0.5, Steel: 0.5 },
  Electric: { Water: 2, Grass: 0.5, Electric: 0.5, Ground: 0, Flying: 2, Dragon: 0.5 },
  Ice:      { Fire: 0.5, Water: 0.5, Grass: 2, Ice: 0.5, Ground: 2, Flying: 2, Dragon: 2, Steel: 0.5 },
  Fighting: { Normal: 2, Ice: 2, Poison: 0.5, Flying: 0.5, Psychic: 0.5, Bug: 0.5, Rock: 2, Ghost: 0, Dark: 2, Steel: 2, Fairy: 0.5 },
  Poison:   { Grass: 2, Poison: 0.5, Ground: 0.5, Rock: 0.5, Ghost: 0.5, Steel: 0, Fairy: 2 },
  Ground:   { Fire: 2, Electric: 2, Grass: 0.5, Poison: 2, Flying: 0, Bug: 0.5, Rock: 2, Steel: 2 },
  Flying:   { Electric: 0.5, Grass: 2, Fighting: 2, Bug: 2, Rock: 0.5, Steel: 0.5 },
  Psychic:  { Fighting: 2, Poison: 2, Psychic: 0.5, Dark: 0, Steel: 0.5 },
  Bug:      { Fire: 0.5, Grass: 2, Fighting: 0.5, Poison: 0.5, Flying: 0.5, Psychic: 2, Ghost: 0.5, Dark: 2, Steel: 0.5, Fairy: 0.5 },
  Rock:     { Fire: 2, Ice: 2, Fighting: 0.5, Ground: 0.5, Flying: 2, Bug: 2, Steel: 0.5 },
  Ghost:    { Normal: 0, Psychic: 2, Ghost: 2, Dark: 0.5 },
  Dragon:   { Dragon: 2, Steel: 0.5, Fairy: 0 },
  Dark:     { Fighting: 0.5, Psychic: 2, Ghost: 2, Dark: 0.5, Fairy: 0.5 },
  Steel:    { Fire: 0.5, Water: 0.5, Electric: 0.5, Ice: 2, Rock: 2, Steel: 0.5, Fairy: 2 },
  Fairy:    { Fire: 0.5, Fighting: 2, Poison: 0.5, Dragon: 2, Dark: 2, Steel: 0.5 },
};

export function getTypeEffectiveness(
  attackType: CreatureType,
  defenderTypes: CreatureType[],
): number {
  let multiplier = 1;
  for (const defType of defenderTypes) {
    const val = TYPE_CHART[attackType]?.[defType];
    if (val !== undefined) multiplier *= val;
  }
  return multiplier;
}

export function calculateDamage(
  attacker: CreatureInstance,
  defender: CreatureInstance,
  move: CreatureMove,
): { damage: number; effectiveness: number } {
  if (move.category === "Status" || !move.power) {
    return { damage: 0, effectiveness: 1 };
  }

  const effectiveness = getTypeEffectiveness(move.type, defender.types as CreatureType[]);
  const level = attacker.level;
  const power = move.power;
  const attackStat = move.category === "Physical" ? attacker.stats.attack : attacker.stats.spAttack;
  const defenseStat = move.category === "Physical" ? defender.stats.defense : defender.stats.spDefense;

  const base = Math.floor(
    (((2 * level) / 5 + 2) * power * (attackStat / defenseStat)) / 50 + 2,
  );

  const damage = Math.max(1, Math.floor(base * effectiveness));
  return { damage, effectiveness };
}

export function resolveTurnOrder(
  creatures: CreatureInstance[],
  actions: Map<string, CreatureAction>,
): CreatureInstance[] {
  return [...creatures].sort((a, b) => {
    const aAction = actions.get(a.id);
    const bAction = actions.get(b.id);

    // Priority: switch > item > move
    const prio = (act?: CreatureAction) =>
      act?.type === "switch" ? 3 : act?.type === "item" ? 2 : 1;
    const pa = prio(aAction);
    const pb = prio(bAction);
    if (pa !== pb) return pb - pa;

    // Speed tiebreaker (higher speed acts first)
    return b.stats.speed - a.stats.speed;
  });
}

export function applyStatus(
  creature: CreatureInstance,
  status: CreatureInstance["status"],
): CreatureInstance {
  return { ...creature, status };
}

export function gainExperience(
  creature: CreatureInstance,
  amount: number,
): CreatureInstance {
  const newExp = (creature.experience ?? 0) + amount;
  return { ...creature, experience: newExp };
}

export function checkEvolution(creature: CreatureInstance): string | null {
  // Placeholder — real evolution rules would live here
  if ((creature.experience ?? 0) > 1000 && !creature.evolutionTarget) {
    return creature.evolutionTarget ?? null;
  }
  return null;
}
