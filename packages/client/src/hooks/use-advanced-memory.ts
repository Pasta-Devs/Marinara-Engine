import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type { AdvancedMemorySettings, AdvancedMemoryStatus, Message } from "@marinara-engine/shared";
import { api } from "../lib/api-client";
import { chatKeys } from "./use-chats";

export const advancedMemoryKeys = {
  status: (chatId: string) => ["advanced-memory", chatId] as const,
  sources: (chatId: string, recordId: string) => ["advanced-memory-sources", chatId, recordId] as const,
};

export const ADVANCED_MEMORY_SETTINGS_EVENT = "marinara:advanced-memory-settings";

export function useAdvancedMemoryStatus(chatId: string, enabled = true) {
  return useQuery({
    queryKey: advancedMemoryKeys.status(chatId),
    queryFn: ({ signal }) => api.get<AdvancedMemoryStatus>(`/chats/${chatId}/advanced-memory`, { signal }),
    enabled: !!chatId && enabled,
    staleTime: 1_000,
    refetchInterval: (query) =>
      !enabled
        ? false
        : query.state.data?.job.status === "running"
          ? 1_000
          : query.state.data?.settings.enabled
            ? 5_000
            : false,
  });
}

type AdvancedMemoryAction =
  | { action: "settings"; settings: Partial<AdvancedMemorySettings> }
  | { action: "initialize"; settings?: Partial<AdvancedMemorySettings>; debugMode?: boolean }
  | { action: "cancel" | "reindex" }
  | { action: "record"; recordId: string; patch: { content?: string; enabled?: boolean } }
  | { action: "import"; envelope: unknown };

export function useAdvancedMemoryAction(chatId: string) {
  const qc = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (request: AdvancedMemoryAction) => {
      const base = `/chats/${chatId}/advanced-memory`;
      switch (request.action) {
        case "settings":
          return api.patch<AdvancedMemoryStatus>(`${base}/settings`, request.settings);
        case "record":
          return api.patch<AdvancedMemoryStatus>(`${base}/records/${request.recordId}`, request.patch);
        case "initialize":
          return api.post<AdvancedMemoryStatus>(`${base}/initialize`, {
            settings: request.settings,
            debugMode: request.debugMode,
          });
        case "import":
          return api.post<AdvancedMemoryStatus>(`${base}/import`, request.envelope);
        default:
          return api.post<AdvancedMemoryStatus>(`${base}/${request.action}`, {});
      }
    },
    onSuccess: (status) => {
      qc.setQueryData(advancedMemoryKeys.status(chatId), status);
      void qc.invalidateQueries({ queryKey: chatKeys.detail(chatId) });
      void qc.invalidateQueries({ queryKey: ["advanced-memory-sources", chatId] });
    },
    onError: (error) => toast.error(t("chat.advancedMemory.failed", { message: error.message })),
  });
}

export function useAdvancedMemorySources(chatId: string, recordId: string | null) {
  return useQuery({
    queryKey: advancedMemoryKeys.sources(chatId, recordId ?? ""),
    queryFn: ({ signal }) =>
      api.get<Message[]>(`/chats/${chatId}/advanced-memory/records/${recordId}/sources`, { signal }),
    enabled: !!chatId && !!recordId,
    staleTime: 0,
  });
}

export function useAdvancedMemoryKnowledgeMessages(chatId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["advanced-memory-knowledge-messages", chatId],
    queryFn: ({ signal }) => api.get<Message[]>(`/chats/${chatId}/messages`, { signal }),
    enabled: !!chatId && enabled,
    staleTime: 0,
  });
}

export function useExportAdvancedMemory(chatId: string) {
  const { t } = useTranslation();
  return useMutation({
    mutationFn: () => api.download(`/chats/${chatId}/advanced-memory/export`, `advanced-memory-${chatId}.json`),
    onError: (error) => toast.error(t("chat.advancedMemory.failed", { message: error.message })),
  });
}
