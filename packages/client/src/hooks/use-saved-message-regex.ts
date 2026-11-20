// ──────────────────────────────────────────────
// Hook: run "Change the saved message" regex scripts on an edited message
// ──────────────────────────────────────────────
import { useCallback } from "react";
import { useApplyRegex } from "./use-apply-regex";
import { useChat } from "./use-chats";
import { useCharacters, usePersonas } from "./use-characters";
import { createInputMacroResolverForChat } from "../lib/chat-macros";

type EditedMessage = { role: string; characterId?: string | null } | null | undefined;

/**
 * Like SillyTavern, scripts that change the saved message also run when a message is edited, so an
 * older message picks them up once it is edited. Returns the text to save.
 */
export function useSavedMessageRegex(chatId: string | null) {
  const { applyToSavedMessage, hasSavedMessageScripts } = useApplyRegex();
  const { data: chat } = useChat(chatId);
  const { data: characters } = useCharacters();
  const { data: personas } = usePersonas();

  return useCallback(
    (message: EditedMessage, content: string) => {
      if (!hasSavedMessageScripts || !message || message.role === "system") return content;
      const resolveMacros = createInputMacroResolverForChat(
        chat,
        characters as Array<{ id: string; data: unknown }> | undefined,
        personas,
        content,
      );
      return applyToSavedMessage(content, message.role === "user" ? "user_input" : "ai_output", {
        resolveMacros,
        characterId: message.characterId ?? null,
      });
    },
    [applyToSavedMessage, characters, chat, hasSavedMessageScripts, personas],
  );
}
