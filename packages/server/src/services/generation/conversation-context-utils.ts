export function hasConversationSchedules(value: unknown): value is Record<string, any> {
  return !!value && typeof value === "object" && Object.keys(value as Record<string, unknown>).length > 0;
}

export function parsePromptPresetChoices(value: unknown): Record<string, string | string[]> | null {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const choices = parsed as Record<string, unknown>;
    const isValid = Object.values(choices).every(
      (choice) => typeof choice === "string" || (Array.isArray(choice) && choice.every((item) => typeof item === "string")),
    );
    return isValid ? (choices as Record<string, string | string[]>) : null;
  } catch {
    return null;
  }
}

export function areConversationSchedulesEnabled(meta: Record<string, any>): boolean {
  if (typeof meta.conversationSchedulesEnabled === "boolean") return meta.conversationSchedulesEnabled;
  return hasConversationSchedules(meta.characterSchedules);
}

export function getEnabledConversationSchedules(meta: Record<string, any>): Record<string, any> {
  return areConversationSchedulesEnabled(meta) && hasConversationSchedules(meta.characterSchedules)
    ? meta.characterSchedules
    : {};
}
