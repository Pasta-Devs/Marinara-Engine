import type { CombatSkill } from "@marinara-engine/shared";

/** A Classic Marinara skill's damage or healing right now, from the user's own stats, for its button. */
export function marinaraSkillEstimateLabel(
  skill: CombatSkill,
  localizeUi: (key: string, options?: Record<string, unknown>) => string,
): string | null {
  const estimate = skill.estimate;
  if (!estimate) return null;
  const range = estimate.min === estimate.max ? `${estimate.max}` : `${estimate.min}–${estimate.max}`;
  const text = localizeUi(
    estimate.kind === "heal" ? "game.combat.marinara.estimate.heal" : "game.combat.marinara.estimate.damage",
    { range },
  );
  const hits = estimate.hits && estimate.hits > 1 ? ` ×${estimate.hits}` : "";
  const crit = estimate.critMax
    ? ` ${localizeUi("game.combat.marinara.estimate.crit", { amount: estimate.critMax })}`
    : "";
  return `${text}${hits}${crit}`;
}
