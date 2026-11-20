// ──────────────────────────────────────────────
// Continue: which reply can be continued right now, and how
// ──────────────────────────────────────────────
// Each open chat sets this (ChatArea, one per split-view pane): its last message when that is an AI reply and
// nothing is generating, with the same request /continue sends. Messages read it to show Continue in ⋯, the hold
// menu and (when picked in Settings > Chatting > Message buttons) the bar under the message, without passing it
// down every message list.
import { create } from "zustand";

type ContinueTarget = { messageId: string; onContinue: (messageId: string) => void };

type ContinueMessageState = {
  byChat: Record<string, ContinueTarget>;
  set: (chatId: string, target: ContinueTarget | null) => void;
};

export const useContinueMessageStore = create<ContinueMessageState>((set) => ({
  byChat: {},
  set: (chatId, target) =>
    set((state) => {
      const byChat = { ...state.byChat };
      if (target) byChat[chatId] = target;
      else delete byChat[chatId];
      return { byChat };
    }),
}));

/** Continue for this message, or undefined when it can't be continued. */
export function useContinueMessage(chatId: string, messageId: string): (() => void) | undefined {
  const canContinue = useContinueMessageStore((state) => state.byChat[chatId]?.messageId === messageId);
  return canContinue ? () => useContinueMessageStore.getState().byChat[chatId]?.onContinue(messageId) : undefined;
}
