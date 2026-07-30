export const NOODLER_ONBOARDING_PRESELECT_THRESHOLD = 8;

export function defaultNoodlerOnboardingSelection(accountIds: string[]): string[] {
  return accountIds.length <= NOODLER_ONBOARDING_PRESELECT_THRESHOLD ? [...accountIds] : [];
}
