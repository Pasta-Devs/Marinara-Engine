import type { DiceRollResult, SkillCheckResult } from "@marinara-engine/shared";

export type Tone = "critical-success" | "success" | "failure" | "critical-failure";

/** How a roleplay `[roll:]` card is tinted: not at all, by the server's verdict, or by it plus natural crits. */
export type RollOutcomeToneMode = "off" | "outcome" | "outcome-crits";

export const TONE_ACCENT: Record<Tone, string> = {
  "critical-success": "oklch(0.82 0.15 86)",
  success: "oklch(0.72 0.16 158)",
  failure: "oklch(0.68 0.18 20)",
  "critical-failure": "oklch(0.60 0.22 20)",
};

/** The sides of the first die in a notation ("2d6+3" -> 6), or 0 when it has none. */
export function parseDiceSides(notation: string): number {
  const match = notation.trim().match(/^(?:\d+)?d(\d+)/i);
  return match ? Number.parseInt(match[1]!, 10) : 0;
}

/** The tone of a skill check card. */
export function skillCheckTone(
  result: Pick<SkillCheckResult, "symbols" | "success" | "criticalSuccess" | "criticalFailure">,
): Tone {
  return result.symbols
    ? result.success
      ? "success"
      : "failure"
    : result.criticalSuccess
      ? "critical-success"
      : result.criticalFailure
        ? "critical-failure"
        : result.success
          ? "success"
          : "failure";
}

/** A missing setting means "outcome", so chats made before the setting existed are tinted. */
export function normalizeRollOutcomeToneMode(value: unknown): RollOutcomeToneMode {
  return value === "off" || value === "outcome-crits" ? value : "outcome";
}

/** The tone of a plain roll. Only the server's `success` verdict counts; a roll without one has no tone. */
export function rollTone(
  roll: Pick<DiceRollResult, "notation" | "rolls" | "success">,
  mode: RollOutcomeToneMode,
): Tone | undefined {
  if (mode === "off" || typeof roll.success !== "boolean") return undefined;
  if (mode === "outcome-crits" && roll.rolls.length === 1) {
    const sides = parseDiceSides(roll.notation);
    const natural = roll.rolls[0];
    if (sides > 1 && natural === sides) return "critical-success";
    if (sides > 1 && natural === 1) return "critical-failure";
  }
  return roll.success ? "success" : "failure";
}
