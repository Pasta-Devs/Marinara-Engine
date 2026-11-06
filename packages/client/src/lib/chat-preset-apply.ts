import type { MutationFilters } from "@tanstack/react-query";
import type { ChatPresetSettings } from "@marinara-engine/shared";

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

/**
 * "Save into profile": the chat's current settings, but the profile keeps its own persona and
 * lorebooks. It keeps its own background too; a profile without one takes the chat's.
 */
export function saveIntoProfileSettings(snapshot: ChatPresetSettings, own: ChatPresetSettings): ChatPresetSettings {
  const metadata = { ...snapshot.metadata } as Record<string, unknown>;
  if (own.metadata?.background !== undefined) metadata.background = own.metadata.background;
  return {
    ...snapshot,
    metadata: metadata as ChatPresetSettings["metadata"],
    ...(own.personaId ? { personaId: own.personaId } : {}),
    ...(own.lorebookIds?.length ? { lorebookIds: own.lorebookIds } : {}),
  };
}
