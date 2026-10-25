import type { MutationFilters } from "@tanstack/react-query";

export const CHAT_PRESET_APPLY_MUTATION_KEY = ["chat-presets", "apply"] as const;

/** Matches a profile being applied to this chat (see useApplyChatPreset). */
export function chatPresetApplyFilters(chatId: string): MutationFilters {
  return {
    mutationKey: CHAT_PRESET_APPLY_MUTATION_KEY,
    predicate: (mutation) => (mutation.state.variables as { chatId?: string } | undefined)?.chatId === chatId,
  };
}

export type WizardApplyHold = { chatId: string; waiting: boolean };

/**
 * Whether a chat's setup wizard waits for a profile apply. Only an apply already running when the wizard first shows
 * for this chat (the new chat's starred profile) holds it; once that ends, a later apply (a profile picked inside the
 * wizard) never unmounts it. A failed apply ends the wait too.
 */
export function nextWizardApplyHold(
  previous: WizardApplyHold | null,
  chatId: string,
  applying: boolean,
): WizardApplyHold {
  if (!previous || previous.chatId !== chatId) return { chatId, waiting: applying };
  return previous.waiting && !applying ? { chatId, waiting: false } : previous;
}
