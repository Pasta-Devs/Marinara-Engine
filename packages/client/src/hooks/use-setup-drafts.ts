// ──────────────────────────────────────────────
// New chats are drafts until their setup finishes
//
// Home's Roleplay/Game buttons, the Chats "+", the omnibar and a character's
// Chat button all make the chat first (the setup wizard edits a real chat), so
// the chat carries `setupPending` until the wizard finishes. A draft that is
// left (another chat, Home, a reload that lands elsewhere) is removed by the
// server, which refuses anything the player wrote in or a game that was built.
// ──────────────────────────────────────────────
import { useEffect } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import type { Chat } from "@marinara-engine/shared";
import { toast } from "sonner";
import { i18n } from "../localization/i18n";
import { api } from "../lib/api-client";
import { useChatStore } from "../stores/chat.store";
import { chatKeys } from "./use-chats";
import { homeFeedKeys } from "./use-home-feed";

/** Drafts left on another device or browser window are only cleared once they are this old. */
const STALE_DRAFT_MS = 30 * 60 * 1000;

/** True while a chat from a New chat launcher has not finished its setup. */
export function isUnfinishedSetup(chat: Pick<Chat, "mode" | "metadata"> | null | undefined): boolean {
  if (!chat || chat.metadata?.setupPending !== true) return false;
  if (chat.mode !== "game") return true;
  const status = chat.metadata.gameSessionStatus;
  return !status || status === "setup";
}

const inFlight = new Map<string, Promise<boolean>>();

/** Asks the server to remove a draft. Safe to call on any chat: anything that isn't an untouched draft is kept. */
export function discardUnfinishedSetup(queryClient: QueryClient, chatId: string): Promise<boolean> {
  const existing = inFlight.get(chatId);
  if (existing) return existing;
  const work = api
    .post<{ deleted: boolean }>(`/chats/${chatId}/discard-unfinished-setup`, {})
    .then(async ({ deleted }) => {
      if (deleted) {
        const store = useChatStore.getState();
        store.clearPendingNewChatSetup(chatId);
        if (store.setupWizardChatId === chatId) store.setSetupWizardChatId(null);
        if (store.activeChatId === chatId) store.setActiveChatId(null);
        queryClient.removeQueries({ queryKey: chatKeys.detail(chatId), exact: true });
        queryClient.setQueryData<Chat[]>(chatKeys.list(), (chats) => chats?.filter((chat) => chat.id !== chatId));
      } else {
        await queryClient.invalidateQueries({ queryKey: chatKeys.detail(chatId) });
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: chatKeys.list() }),
        queryClient.invalidateQueries({ queryKey: homeFeedKeys.all }),
      ]);
      return deleted;
    })
    .catch(() => false)
    .finally(() => inFlight.delete(chatId));
  inFlight.set(chatId, work);
  return work;
}

/** Marks a draft as set up (the wizard finished, or Skip after making choices), so it is never cleared. */
export async function finishSetupDraft(queryClient: QueryClient, chatId: string) {
  const chat = queryClient.getQueryData<Chat>(chatKeys.detail(chatId));
  if (chat && chat.metadata?.setupPending !== true) return;
  try {
    await api.patch(`/chats/${chatId}/metadata`, { setupPending: null });
  } catch {
    return;
  }
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: chatKeys.detail(chatId) }),
    queryClient.invalidateQueries({ queryKey: chatKeys.list() }),
  ]);
}

/**
 * Mounted once by the app shell. Leaving a draft removes it at once; drafts left behind
 * elsewhere (a closed window, another device) are removed once they are stale.
 */
export function useSetupDraftJanitor(chats: Chat[] | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    let previous = useChatStore.getState().activeChatId;
    return useChatStore.subscribe((state) => {
      const current = state.activeChatId;
      if (current === previous) return;
      const left = previous;
      previous = current;
      if (!left) return;
      const list = queryClient.getQueryData<Chat[]>(chatKeys.list());
      const chat =
        queryClient.getQueryData<Chat>(chatKeys.detail(left)) ?? list?.find((entry) => entry.id === left) ?? null;
      if (!isUnfinishedSetup(chat)) return;
      void discardUnfinishedSetup(queryClient, left).then((deleted) => {
        // A game draft may hold a lot of choices (or a failed Create world): say it went, so leaving never
        // looks like the game was kept (user panel 2, N1).
        if (deleted && chat?.mode === "game")
          toast.info(i18n.t("game.setupDraft.discardedOnLeave", { defaultValue: "Unfinished game discarded." }));
      });
    });
  }, [queryClient]);

  useEffect(() => {
    if (!chats?.length) return;
    const activeChatId = useChatStore.getState().activeChatId;
    const now = Date.now();
    for (const chat of chats) {
      if (chat.id === activeChatId || !isUnfinishedSetup(chat)) continue;
      const age = now - Date.parse(chat.updatedAt || chat.createdAt);
      if (Number.isFinite(age) && age < STALE_DRAFT_MS) continue;
      void discardUnfinishedSetup(queryClient, chat.id);
    }
  }, [chats, queryClient]);
}
