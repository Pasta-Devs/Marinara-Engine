import type { ConversationStatusOverride } from "@marinara-engine/shared";

export interface SmartGroupCandidatePromptData {
  id: string;
  name: string;
  talkativeness: number;
  status?: string;
  activity?: string;
  personality?: string;
  description?: string;
}

export function formatSmartGroupCandidates(
  candidates: SmartGroupCandidatePromptData[],
  useCandidateBlocks: boolean,
): string {
  return candidates
    .map((candidate) => {
      const fields = [
        `id: ${candidate.id}`,
        `name: ${candidate.name}`,
        `talkativeness: ${candidate.talkativeness}%`,
        candidate.status !== undefined ? `current status: ${candidate.status}` : null,
        candidate.activity ? `current activity: ${candidate.activity}` : null,
        candidate.personality ? `personality: ${candidate.personality}` : null,
        candidate.description ? `description: ${candidate.description}` : null,
      ].filter((field): field is string => field !== null);

      if (useCandidateBlocks) return ["<candidate>", ...fields, "</candidate>"].join("\n");
      return fields.map((field, index) => `${index === 0 ? "- " : "  "}${field}`).join("\n");
    })
    .join("\n\n");
}

export function hasConversationSchedules(value: unknown): value is Record<string, any> {
  return !!value && typeof value === "object" && Object.keys(value as Record<string, unknown>).length > 0;
}

export function parseConversationStatusOverrides(value: unknown): Record<string, ConversationStatusOverride> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter(([, override]) => {
      if (!override || typeof override !== "object" || Array.isArray(override)) return false;
      const typedOverride = override as Record<string, unknown>;
      const status = typedOverride.status;
      const createdAt = typedOverride.createdAt;
      return (
        (status === "online" || status === "idle" || status === "dnd" || status === "offline") &&
        typeof createdAt === "string" &&
        createdAt.length > 0
      );
    }),
  ) as Record<string, ConversationStatusOverride>;
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
