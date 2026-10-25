import { useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api, requestTimeoutSignal } from "../lib/api-client";
import { useChatStore } from "../stores/chat.store";
import { chatKeys } from "./use-chats";
import { homeFeedKeys } from "./use-home-feed";

/** Never route wizard cancellation through the unconditional chat delete mutation. */
export function useDiscardNewChatSetup() {
  const queryClient = useQueryClient();
  const pending = useRef(new Map<string, Promise<boolean>>());
  const discard = useCallback(
    (chatId: string): Promise<boolean> => {
      const existing = pending.current.get(chatId);
      if (existing) return existing;
      const initialChat = useChatStore.getState().pendingNewChatSetups[chatId];
      if (initialChat?.id !== chatId) return Promise.resolve(false);
      const work = (async () => {
        const mutations = queryClient.getMutationCache();
        const saving = () =>
          mutations.getAll().some((mutation) => {
            const variables = mutation.state.variables as { id?: string; chatId?: string } | undefined;
            return mutation.state.status === "pending" && (variables?.id === chatId || variables?.chatId === chatId);
          });
        // A just-blurred name or a still-applying profile must finish before the comparison.
        if (saving()) {
          const settled = await new Promise<boolean>((resolve) => {
            const timer = setTimeout(() => {
              unsubscribe();
              resolve(false);
            }, 5_000);
            const unsubscribe = mutations.subscribe(() => {
              if (!saving()) {
                clearTimeout(timer);
                unsubscribe();
                resolve(true);
              }
            });
          });
          // A stalled or offline save must not trap the wizard or make uncertain state safe to delete.
          // Keep its baseline so a later cancellation can retry after the save settles.
          if (!settled) return false;
        }
        // Another cleanup can retire this pending draft while an automatic save completes.
        const baseline = useChatStore.getState().pendingNewChatSetups[chatId];
        if (baseline?.id !== chatId || baseline.createdAt !== initialChat.createdAt) return false;
        const { deleted } = await api.post<{ deleted: boolean }>(
          `/chats/${chatId}/discard-empty-setup`,
          { initialChat: baseline },
          { signal: requestTimeoutSignal(10_000) },
        );
        if (useChatStore.getState().pendingNewChatSetups[chatId] === baseline) {
          useChatStore.getState().clearPendingNewChatSetup(chatId);
        }
        if (deleted) {
          if (useChatStore.getState().activeChatId === chatId) useChatStore.getState().setActiveChatId(null);
          queryClient.removeQueries({ queryKey: chatKeys.detail(chatId), exact: true });
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: chatKeys.list() }),
            queryClient.invalidateQueries({ queryKey: homeFeedKeys.all }),
          ]);
        }
        return deleted;
      })().finally(() => {
        pending.current.delete(chatId);
      });
      pending.current.set(chatId, work);
      return work;
    },
    [queryClient],
  );
  return discard;
}
