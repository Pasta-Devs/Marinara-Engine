import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  TRANSLATOR_DEFAULTS_SETTINGS_KEY,
  normalizeTranslatorSettings,
  type AppSettingsResponse,
  type Chat,
} from "@marinara-engine/shared";
import { api } from "../lib/api-client";
import { waitForPendingChatMetadataSaves } from "../lib/chat-metadata-save-barrier";

const queryKey = ["app-settings", TRANSLATOR_DEFAULTS_SETTINGS_KEY] as const;
const path = `/app-settings/${TRANSLATOR_DEFAULTS_SETTINGS_KEY}`;

export function useTranslatorDefaults() {
  return useQuery({
    queryKey,
    queryFn: async () => Boolean((await api.get<AppSettingsResponse>(path)).value),
  });
}

/** Save the latest persisted translator choices; null forgets only the new-chat defaults. */
export function useSaveTranslatorDefaults() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (chatId: string | null) => {
      let value = "";
      if (chatId) {
        await waitForPendingChatMetadataSaves(chatId);
        const chat = await api.get<Chat>(`/chats/${chatId}`);
        value = JSON.stringify(normalizeTranslatorSettings(chat.metadata));
      }
      await api.put(path, { value });
      return Boolean(value);
    },
    onSuccess: (saved) => qc.setQueryData(queryKey, saved),
  });
}
