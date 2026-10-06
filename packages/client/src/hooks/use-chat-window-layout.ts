// ──────────────────────────────────────────────
// Per-chat window layout
//
// Each chat keeps its own window layout (places, sizes, pinned and locked state,
// popped-out drawers, phone bubble places) in `chat.metadata.windowLayout`, so chat settings profiles
// save and apply it with the rest of the chat's settings. This hook loads the open
// chat's layout into the window store and saves the user's changes back.
// ──────────────────────────────────────────────
import { useEffect, useLayoutEffect, useRef } from "react";
import type { Chat } from "@marinara-engine/shared";
import { readChatMetadata } from "../lib/chat-wizard-defaults";
import { getLegacyChatWindowLayout } from "../lib/chat-window-migration";
import {
  isEmptyWindowLayoutSnapshot,
  serializeWindowLayoutSnapshot,
  type WindowLayoutSnapshot,
} from "../lib/floating-window-layout";
import { selectWindowLayoutSnapshot, useFloatingWindowStore } from "../stores/floating-window.store";
import { useUpdateChatMetadata } from "./use-chats";

/** Moves and resizes come in bursts; save once the user stops. */
const SAVE_DELAY_MS = 400;
const EMPTY_LAYOUT = serializeWindowLayoutSnapshot(null);

/** The layout the window store shows now, as the chat stores it (none when it is all defaults). */
export function readCurrentWindowLayout(): WindowLayoutSnapshot | null {
  const snapshot = selectWindowLayoutSnapshot(useFloatingWindowStore.getState());
  return isEmptyWindowLayoutSnapshot(snapshot) ? null : snapshot;
}

/**
 * Keeps the window store in step with the open chat (`null` when closed, `undefined` while loading): its saved layout
 * replaces the previous chat's when it opens or changes elsewhere (a profile applied, another tab),
 * and the user's changes save to it after a short pause. Bad or old saved data loads as the defaults.
 */
export function useChatWindowLayout(chat: Chat | null | undefined) {
  // Queued with the chat's other settings saves, so an older layout can never land after a newer one.
  const updateMeta = useUpdateChatMetadata({ serialize: true });
  const mutateRef = useRef(updateMeta.mutate);
  mutateRef.current = updateMeta.mutate;
  const chatId = chat?.id ?? null;
  const loading = chat === undefined;
  const metadata = chat ? readChatMetadata(chat) : {};
  const legacyLayout = chat ? getLegacyChatWindowLayout(chat.mode, metadata) : null;
  const needsMigration = legacyLayout !== null;
  const savedLayout = chat ? serializeWindowLayoutSnapshot(legacyLayout ?? metadata.windowLayout) : EMPTY_LAYOUT;
  // The chat whose layout the store shows, and that layout as last loaded or saved.
  const syncedRef = useRef<{ chatId: string | null; layout: string }>({ chatId: null, layout: EMPTY_LAYOUT });
  const pendingRef = useRef<{ chatId: string; timer: ReturnType<typeof setTimeout> } | null>(null);

  const save = (targetChatId: string) => {
    const layout = readCurrentWindowLayout();
    syncedRef.current = { chatId: targetChatId, layout: serializeWindowLayoutSnapshot(layout) };
    mutateRef.current({ id: targetChatId, windowLayout: layout });
  };
  const saveRef = useRef(save);
  saveRef.current = save;

  const flushPendingSave = () => {
    const pending = pendingRef.current;
    if (!pending) return;
    clearTimeout(pending.timer);
    pendingRef.current = null;
    saveRef.current(pending.chatId);
  };
  const flushRef = useRef(flushPendingSave);
  flushRef.current = flushPendingSave;

  // Load before paint, so a chat's windows never flash in the previous chat's places.
  useLayoutEffect(() => {
    // A query's loading gap is not a closed chat. Keep its layout until the next chat is ready, so
    // pinned windows stay open and a pending move is saved to the chat that owns it.
    if (loading) return;
    const synced = syncedRef.current;
    if (synced.chatId === chatId && synced.layout === savedLayout) return;
    if (synced.chatId !== chatId) flushRef.current();
    else if (pendingRef.current) {
      // The same chat changed elsewhere (a profile applied, another tab): that layout wins.
      clearTimeout(pendingRef.current.timer);
      pendingRef.current = null;
    }
    syncedRef.current = { chatId, layout: savedLayout };
    useFloatingWindowStore.getState().hydrate(savedLayout === EMPTY_LAYOUT ? null : JSON.parse(savedLayout));
    if (needsMigration && chatId) {
      // Persist once through the same queue as later moves/docking. View-only metadata keeps chat recency intact.
      mutateRef.current({ id: chatId, windowLayout: JSON.parse(savedLayout) });
    }
  }, [chatId, savedLayout, loading, needsMigration]);

  // Save the user's changes to the chat whose layout they changed.
  useEffect(() => {
    const unsubscribe = useFloatingWindowStore.subscribe((state, previous) => {
      if (
        state.layouts === previous.layouts &&
        state.detached === previous.detached &&
        state.phoneBubbles === previous.phoneBubbles &&
        state.bubbles === previous.bubbles &&
        state.phoneMenu === previous.phoneMenu
      ) {
        return;
      }
      const { chatId: syncedChatId, layout } = syncedRef.current;
      if (!syncedChatId) return;
      if (serializeWindowLayoutSnapshot(selectWindowLayoutSnapshot(state)) === layout) {
        // Back to what the chat already has (a hydrate, or a change undone): nothing to save.
        if (pendingRef.current) clearTimeout(pendingRef.current.timer);
        pendingRef.current = null;
        return;
      }
      if (pendingRef.current) clearTimeout(pendingRef.current.timer);
      pendingRef.current = {
        chatId: syncedChatId,
        timer: setTimeout(() => {
          pendingRef.current = null;
          saveRef.current(syncedChatId);
        }, SAVE_DELAY_MS),
      };
    });
    return () => {
      unsubscribe();
      // Leaving the chat view keeps the last change.
      flushRef.current();
      syncedRef.current = { chatId: null, layout: EMPTY_LAYOUT };
    };
  }, []);
}
