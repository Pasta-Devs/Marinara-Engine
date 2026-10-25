import type { PendingSpatialTransition } from "@marinara-engine/shared";
import { getMessageBarRules } from "../../lib/message-bar-rules";

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
  /** A novel has no message of yours: the choice only steers the next passage. */
  novel?: boolean;
}) {
  if (input.novel) {
    return {
      chatId: input.chatId,
      connectionId: null,
      generationGuide: getMessageBarRules(true).guideInstruction(input.text),
      generationGuideSource: "guide" as const,
    };
  }
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

/**
 * Which path a clicked CYOA choice takes. Adding to the message box takes priority over impersonating.
 * A novel never impersonates: there is no turn of yours, so the choice is sent as guidance instead.
 */
export function resolveCyoaChoiceAction(settings: {
  addToMessage: boolean;
  impersonate: boolean;
  novel?: boolean;
}): CyoaChoiceAction {
  if (settings.addToMessage) return "add";
  return settings.impersonate && getMessageBarRules(settings.novel).impersonate ? "impersonate" : "send";
}
