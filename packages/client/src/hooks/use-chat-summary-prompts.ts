// ──────────────────────────────────────────────
// Hook: Global Roleplay Chat Summary prompt settings
// ──────────────────────────────────────────────
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CHAT_SUMMARY_PROMPT_SETTINGS_KEY,
  normalizeChatSummaryPromptSettings,
  type AppSettingsResponse,
  type ChatSummaryPromptSettings,
} from "@marinara-engine/shared";
import { api } from "../lib/api-client";

type ChatSummaryPromptSettingsState = ChatSummaryPromptSettings & {
  hasPersistedSettings: boolean;
};

export const chatSummaryPromptKeys = {
  settings: ["app-settings", CHAT_SUMMARY_PROMPT_SETTINGS_KEY] as const,
};

function parseSettingsValue(value: string | null): ChatSummaryPromptSettingsState {
  const hasPersistedSettings = typeof value === "string" && value.trim().length > 0;
  return { ...normalizeChatSummaryPromptSettings(value), hasPersistedSettings };
}

export function useChatSummaryPromptSettings() {
  return useQuery({
    queryKey: chatSummaryPromptKeys.settings,
    queryFn: async () => {
      const result = await api.get<AppSettingsResponse>(`/app-settings/${CHAT_SUMMARY_PROMPT_SETTINGS_KEY}`);
      return parseSettingsValue(result.value);
    },
    staleTime: 5 * 60_000,
  });
}

export function useUpdateChatSummaryPromptSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (settings: ChatSummaryPromptSettings) => {
      const normalized = normalizeChatSummaryPromptSettings(settings);
      await api.put(`/app-settings/${CHAT_SUMMARY_PROMPT_SETTINGS_KEY}`, {
        value: JSON.stringify(normalized),
      });
      return normalized;
    },
    onSuccess: (settings) => {
      qc.setQueryData(chatSummaryPromptKeys.settings, { ...settings, hasPersistedSettings: true });
    },
  });
}
