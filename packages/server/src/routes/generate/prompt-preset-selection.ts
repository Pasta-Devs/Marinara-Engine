export type PromptPresetCandidateSource = "impersonate" | "request" | "connection" | "chat";

export interface PromptPresetCandidate {
  id: string;
  source: PromptPresetCandidateSource;
}

export type PromptPresetChoices = Record<string, string | string[]>;

function asNonEmptyString(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const id = (value as { id?: unknown }).id;
    if (typeof id === "string") {
      const trimmed = id.trim();
      return trimmed ? trimmed : null;
    }
  }
  return null;
}

function pushUnique(
  candidates: PromptPresetCandidate[],
  seen: Set<string>,
  id: string | null,
  source: PromptPresetCandidateSource,
) {
  if (!id || seen.has(id)) return;
  candidates.push({ id, source });
  seen.add(id);
}

export function supportsConnectionPromptPresetOverride(chatMode: unknown): boolean {
  return chatMode === "roleplay";
}

export function buildGenerationPromptPresetCandidates(args: {
  chatMode: unknown;
  chatPromptPresetId?: unknown;
  connectionPromptPresetId?: unknown;
  impersonate?: boolean;
  impersonatePromptPresetId?: unknown;
  requestPromptPresetId?: unknown;
}): PromptPresetCandidate[] {
  const candidates: PromptPresetCandidate[] = [];
  const seen = new Set<string>();

  if (args.impersonate) {
    pushUnique(candidates, seen, asNonEmptyString(args.impersonatePromptPresetId), "impersonate");
  }
  pushUnique(candidates, seen, asNonEmptyString(args.requestPromptPresetId), "request");

  if (supportsConnectionPromptPresetOverride(args.chatMode)) {
    pushUnique(candidates, seen, asNonEmptyString(args.connectionPromptPresetId), "connection");
  }

  pushUnique(candidates, seen, asNonEmptyString(args.chatPromptPresetId), "chat");
  return candidates;
}

export function resolveGenerationPromptPresetChoices(args: {
  presetSource: PromptPresetCandidateSource | null;
  selectedPresetDiffersFromChat: boolean;
  presetDefaultChoices: PromptPresetChoices;
  chatPresetChoices: PromptPresetChoices;
}): PromptPresetChoices {
  if (args.selectedPresetDiffersFromChat && args.presetSource !== "chat") {
    return args.presetDefaultChoices;
  }
  return { ...args.presetDefaultChoices, ...args.chatPresetChoices };
}
