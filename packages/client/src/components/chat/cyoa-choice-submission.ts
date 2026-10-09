import type { PendingSpatialTransition } from "@marinara-engine/shared";

interface CyoaChoiceImpersonationOptions {
  presetId?: string | null;
  connectionId?: string | null;
  blockAgents?: boolean;
  promptTemplate?: string;
}

export function buildCyoaChoiceSubmissionPayload(input: {
  chatId: string;
  text: string;
  pendingSpatialTransition?: PendingSpatialTransition | null;
  impersonation?: CyoaChoiceImpersonationOptions;
}) {
  const promptTemplate = input.impersonation?.promptTemplate?.trim();
  return {
    chatId: input.chatId,
    connectionId: null,
    userMessage: input.text,
    ...(input.pendingSpatialTransition ? { pendingSpatialTransition: input.pendingSpatialTransition } : {}),
    ...(input.impersonation
      ? {
          impersonate: true as const,
          ...(input.impersonation.presetId ? { impersonatePresetId: input.impersonation.presetId } : {}),
          ...(input.impersonation.connectionId ? { impersonateConnectionId: input.impersonation.connectionId } : {}),
          ...(input.impersonation.blockAgents ? { impersonateBlockAgents: true as const } : {}),
          ...(promptTemplate ? { impersonatePromptTemplate: promptTemplate } : {}),
        }
      : {}),
  };
}

/** Appends a choice to the composer draft, separated from existing text by a blank line. */
export function appendCyoaChoiceToDraft(draft: string, text: string) {
  const existing = draft.trimEnd();
  return existing ? `${existing}\n\n${text}` : text;
}

export type CyoaChoiceAction = "add" | "impersonate" | "send";

/** Which path a clicked CYOA choice takes. Adding to the message box takes priority over impersonating. */
export function resolveCyoaChoiceAction(settings: { addToMessage: boolean; impersonate: boolean }): CyoaChoiceAction {
  if (settings.addToMessage) return "add";
  return settings.impersonate ? "impersonate" : "send";
}
