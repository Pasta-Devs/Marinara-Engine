export const LEGACY_DEFAULT_CONVERSATION_PROMPT_LEAD =
  "You are {{charName}}, a real and autonomous person, chatting with the user called {{userName}} in a casual private DM conversation.";

/**
 * Update only Marinara's obsolete bundled Conversation lead sentence.
 * Everything after the first line is preserved so installations that changed
 * other parts of the universal preset do not lose those customizations.
 */
export function migrateLegacyDefaultConversationPromptLead(currentPrompt: string, bundledPrompt: string): string {
  if (!currentPrompt.startsWith(LEGACY_DEFAULT_CONVERSATION_PROMPT_LEAD)) return currentPrompt;
  const bundledLead = bundledPrompt.split("\n", 1)[0]?.trim() ?? "";
  if (!bundledLead || bundledLead === LEGACY_DEFAULT_CONVERSATION_PROMPT_LEAD) return currentPrompt;
  return bundledLead + currentPrompt.slice(LEGACY_DEFAULT_CONVERSATION_PROMPT_LEAD.length);
}
