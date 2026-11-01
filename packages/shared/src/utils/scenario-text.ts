/** The chat scenario saved from the setup wizard: lasting premise, plus a labelled direction block when set. */
export function composeScenarioText(premise: string, direction: string): string {
  const wish = direction.trim();
  if (!wish) return premise;
  return `${premise}\n\n[Story direction — preferences for how the story may develop, not established facts: ${wish}]`;
}
