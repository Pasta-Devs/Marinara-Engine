import type { DiceRollResult } from "@marinara-engine/shared";

/**
 * Narrow an untrusted payload — a stored message extra or a `tool_result` SSE frame — to a
 * roll the dice card can actually draw. Lives outside the card component so hooks can reuse
 * it without pulling the renderer in.
 */
export function isDiceRollResult(value: unknown): value is DiceRollResult {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<DiceRollResult>;
  return (
    typeof candidate.notation === "string" &&
    Array.isArray(candidate.rolls) &&
    candidate.rolls.every((roll) => Number.isFinite(roll)) &&
    Number.isFinite(candidate.modifier) &&
    Number.isFinite(candidate.total)
  );
}
