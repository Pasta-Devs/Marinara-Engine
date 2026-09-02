// ──────────────────────────────────────────────
// React Query: Professor Mari attached workspace context (#5073)
// ──────────────────────────────────────────────
// The reference context (chat-history slices) a user attaches to a Mari
// workspace conversation. Backed by /professor-mari/workspace/context.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api-client";

export interface MariWorkspaceContextItem {
  id: string;
  chatId: string;
  kind: string;
  label: string;
  sourceChatId: string;
  content: string;
  tokenEstimate: number;
  createdAt: string;
}

export interface AddMariWorkspaceContextInput {
  chatId: string;
  kind?: "chat_history";
  label: string;
  sourceChatId?: string;
  content: string;
  tokenEstimate?: number;
}

export const mariWorkspaceContextKeys = {
  all: ["mari-workspace-context"] as const,
  list: (chatId: string) => [...mariWorkspaceContextKeys.all, "list", chatId] as const,
};

export function useMariWorkspaceContext(chatId: string | null | undefined) {
  return useQuery({
    queryKey: mariWorkspaceContextKeys.list(chatId ?? ""),
    queryFn: async () => {
      const res = await api.get<{ context: MariWorkspaceContextItem[] }>(
        `/professor-mari/workspace/context?chatId=${encodeURIComponent(chatId!)}`,
      );
      return res.context;
    },
    enabled: !!chatId,
    staleTime: 30_000,
  });
}

export function useAddMariWorkspaceContext() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: AddMariWorkspaceContextInput) => {
      const res = await api.post<{ ok: boolean; item: MariWorkspaceContextItem }>(
        "/professor-mari/workspace/context",
        input,
      );
      return res.item;
    },
    onSuccess: (item) => qc.invalidateQueries({ queryKey: mariWorkspaceContextKeys.list(item.chatId) }),
  });
}

export function useRemoveMariWorkspaceContext(chatId: string) {
  const qc = useQueryClient();
  return useMutation({
    // The wire-level chatId is the item row's owning workspace chat (#5615):
    // it lets the server scope the lookup to one chat's storage instead of
    // loading every chat's. The hook's ambient chatId stays for the cache key.
    mutationFn: async ({ id, chatId: ownerChatId }: { id: string; chatId: string }) => {
      await api.delete(`/professor-mari/workspace/context/${id}?chatId=${encodeURIComponent(ownerChatId)}`);
      return id;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: mariWorkspaceContextKeys.list(chatId) }),
  });
}
