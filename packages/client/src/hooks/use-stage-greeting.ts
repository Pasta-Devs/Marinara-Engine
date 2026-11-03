import { useMutation, useQueryClient } from "@tanstack/react-query";
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
