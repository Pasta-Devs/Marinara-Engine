// ──────────────────────────────────────────────
// New chats are drafts until their setup finishes
//
// Home's Roleplay/Game buttons, the Chats "+", the omnibar and a character's
// Chat button all make the chat first (the setup wizard edits a real chat), so
// the chat carries `setupPending` until the wizard finishes. A draft that is
// left untouched (another chat, Home, a reload that lands elsewhere) is removed
// by the server, which refuses anything the player wrote in or a game that was
// built. A draft the player made choices in is never removed on the way out: it
// is kept as "Setup not finished" and its setup opens again (user panel 3, PG4).
// ──────────────────────────────────────────────
import { useEffect } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import type { Chat } from "@marinara-engine/shared";
import { toast } from "sonner";
import { i18n } from "../localization/i18n";
import { api } from "../lib/api-client";
import { showChoiceDialog } from "../lib/app-dialogs";
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

/** True for a chat that was kept with its setup unfinished (see `keepSetupForLater`). */
export function isSetupKeptForLater(chat: Pick<Chat, "metadata"> | null | undefined): boolean {
  return chat?.metadata?.setupUnfinished === true;
}

// ── Has the player made choices in this draft? ──
// An open wizard answers for its own chat; a closed one may have left its choices in this browser.
const inputProbes = new Map<string, () => boolean>();

/** An open setup wizard says whether the player has made choices in it. Returns the unregister function. */
export function registerSetupInputProbe(chatId: string, probe: () => boolean): () => void {
  inputProbes.set(chatId, probe);
  return () => {
    if (inputProbes.get(chatId) === probe) inputProbes.delete(chatId);
  };
}

/** The game wizard keeps its choices per chat in this browser (see GameSetupWizard). */
export const gameSetupDraftKey = (chatId: string) => `marinara-game-setup-draft:${chatId}`;

function storedGameDraftHasInput(chatId: string): boolean {
  try {
    const stored = JSON.parse(localStorage.getItem(gameSetupDraftKey(chatId)) ?? "null") as {
      step?: unknown;
      gameName?: unknown;
    } | null;
    if (!stored) return false;
    return (
      (typeof stored.step === "number" && stored.step > 0) ||
      (typeof stored.gameName === "string" && stored.gameName.trim().length > 0)
    );
  } catch {
    return false;
  }
}

/** Whether leaving this draft would throw away choices the player made. */
export function setupDraftHasInput(chat: Pick<Chat, "id" | "mode" | "metadata"> | null | undefined): boolean {
  if (!chat) return false;
  const probe = inputProbes.get(chat.id);
  if (probe) {
    try {
      if (probe()) return true;
    } catch {
      /* a wizard mid-unmount: fall back to what it stored */
    }
  }
  if (chat.mode !== "game") return false;
  // A Create world that failed already made the game: that is never an untouched draft.
  if (typeof chat.metadata?.gameId === "string" && chat.metadata.gameId) return true;
  return storedGameDraftHasInput(chat.id);
}

/**
 * Keeps a draft the player made choices in: it stays in the chat list as "Setup not finished" and its
 * setup opens again when it is opened. Never removed by the draft janitor after this.
 */
export async function keepSetupForLater(queryClient: QueryClient, chatId: string): Promise<boolean> {
  try {
    await api.patch(`/chats/${chatId}/metadata`, { setupPending: null, setupUnfinished: true });
  } catch {
    return false;
  }
  useChatStore.getState().clearPendingNewChatSetup(chatId);
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: chatKeys.detail(chatId) }),
    queryClient.invalidateQueries({ queryKey: chatKeys.list() }),
    queryClient.invalidateQueries({ queryKey: homeFeedKeys.all }),
  ]);
  return true;
}

export type LeaveSetupChoice = "continue" | "later" | "discard";

/**
 * One question for leaving either setup wizard (user panel 3, PN1/PN5). Closing it with ×, Esc or the
 * backdrop means "Keep setting up", so a second click to "get out" never throws work away.
 */
export async function askLeaveSetup(kind: "game" | "chat"): Promise<LeaveSetupChoice> {
  const game = kind === "game";
  const choice = await showChoiceDialog({
    title: game
      ? i18n.t("game.setupDraft.leaveTitle", { defaultValue: "Leave game setup?" })
      : i18n.t("chat.wizard.leaveTitle", { defaultValue: "Leave chat setup?" }),
    message: game
      ? i18n.t("game.setupDraft.leaveMessage", {
          defaultValue:
            'Its world hasn\'t been built yet. Keep it for later to find it in your chats as "Setup not finished", or discard it and your choices.',
        })
      : i18n.t("chat.wizard.leaveMessage", {
          defaultValue:
            'Its setup isn\'t finished. Keep it for later to find it in your chats as "Setup not finished", or discard it.',
        }),
    layout: "row",
    hideCancel: true,
    choices: [
      {
        key: "continue",
        label: i18n.t("game.setupDraft.keepSettingUp", { defaultValue: "Keep setting up" }),
      },
      { key: "later", label: i18n.t("setupDraft.keepForLater", { defaultValue: "Keep for later" }) },
      {
        key: "discard",
        label: game
          ? i18n.t("game.setupDraft.discard", { defaultValue: "Discard game" })
          : i18n.t("chat.wizard.discardDraft", { defaultValue: "Discard chat" }),
        tone: "destructive",
      },
    ],
  });
  return choice === "later" || choice === "discard" ? choice : "continue";
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
  if (chat && chat.metadata?.setupPending !== true && chat.metadata?.setupUnfinished !== true) return;
  try {
    await api.patch(`/chats/${chatId}/metadata`, { setupPending: null, setupUnfinished: null });
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
      // Choices made: keep it, and say where it went (user panel 3, PG4: Ctrl+K deleted a filled-in game).
      if (setupDraftHasInput(chat)) {
        const isGame = chat?.mode === "game";
        void keepSetupForLater(queryClient, left).then((kept) => {
          if (!kept) return;
          toast.info(
            isGame
              ? i18n.t("game.setupDraft.keptOnLeave", {
                  defaultValue: 'Game setup kept for later. It\'s in your chats as "Setup not finished".',
                })
              : i18n.t("chat.wizard.keptOnLeave", {
                  defaultValue: 'Chat setup kept for later. It\'s in your chats as "Setup not finished".',
                }),
            {
              duration: 8000,
              action: {
                label: i18n.t("setupDraft.open", { defaultValue: "Open" }),
                onClick: () => useChatStore.getState().setActiveChatId(left),
              },
            },
          );
        });
        return;
      }
      // Untouched: nothing to lose, so it just goes (the same as the roleplay wizard, no toast).
      void discardUnfinishedSetup(queryClient, left);
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
      // A draft with choices (a closed tab, a browser restart) is kept, never cleared as stale.
      if (setupDraftHasInput(chat)) void keepSetupForLater(queryClient, chat.id);
      else void discardUnfinishedSetup(queryClient, chat.id);
    }
  }, [chats, queryClient]);
}
