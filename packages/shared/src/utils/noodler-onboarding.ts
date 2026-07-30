export type NoodlerOnboardingCompletion = "declined" | "generated" | "partial" | "failed" | "zero";

/**
 * Which closing screen the onboarding wizard lands on. Profile creation and first-post generation
 * fail independently, so this stays a pure function the regression lane can pin down.
 */
export function resolveNoodlerOnboardingCompletion(input: {
  selectedCount: number;
  createdCount: number;
  createFailures: number;
  /** null when generation was never attempted: the user declined it, or nothing was created. */
  outcomes: { status: string }[] | null;
}): NoodlerOnboardingCompletion {
  if (input.createdCount === 0) return input.selectedCount === 0 ? "zero" : "failed";
  if (input.outcomes === null) return "declined";
  const generated = input.outcomes.filter((outcome) => outcome.status === "generated").length;
  if (generated === input.outcomes.length && input.createFailures === 0) return "generated";
  return generated > 0 ? "partial" : "failed";
}
