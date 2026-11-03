import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api-client";
import { useUIStore } from "../stores/ui.store";
import { chatKeys } from "./use-chats";

export type StageGreetingMode = "line" | "surprise" | "continue";

/** Writes a new opening message for the setup stage; the server adds it as the shown swipe of the greeting. */
export function useStageGreeting(chatId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { mode: StageGreetingMode; idea?: string }) =>
      api.post<{ messageId: string; swipeIndex: number; content: string }>(`/chats/${chatId}/setup-greeting`, {
        ...input,
        debugMode: useUIStore.getState().debugMode,
      }),
    onSuccess: ({ messageId }) => {
      qc.invalidateQueries({ queryKey: chatKeys.messages(chatId) });
      qc.invalidateQueries({ queryKey: [...chatKeys.all, "swipes", messageId] });
    },
  });
}

/** The welcome-back recap for an older chat. It reads the chat and writes nothing. */
export function useStageRecap(chatId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["chat-welcome-recap", chatId],
    queryFn: () =>
      api.post<{ recap: string }>(`/chats/${chatId}/setup-greeting`, {
        mode: "recap",
        debugMode: useUIStore.getState().debugMode,
      }),
    enabled,
    staleTime: Infinity,
    retry: false,
  });
}
