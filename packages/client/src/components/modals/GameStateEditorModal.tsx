// ──────────────────────────────────────────────
// Game State Editor — the State Editor opened on a roleplay chat's current
// game state (what the tracker agents read back as <current_game_state>).
// ──────────────────────────────────────────────
import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { AlertTriangle, History, Loader2, RefreshCw } from "lucide-react";
import { useQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { useTranslation as useUiTranslation } from "react-i18next";
import { toast } from "sonner";
import type { GameState, Message } from "@marinara-engine/shared";
import { Modal } from "../ui/Modal";
import { StateEditor } from "../ui/state-editor/StateEditor";
import { api } from "../../lib/api-client";
import { showConfirmDialog } from "../../lib/app-dialogs";
import {
  buildGameStateEditorPatch,
  buildGameStateEditorSections,
  findGameStateSectionsChangedSince,
} from "../../lib/state-editor/game-state-editor-source";
import type { StateEditorChange } from "../../lib/state-editor/state-editor.types";
import { chatKeys } from "../../hooks/use-chats";
import { useChatStore } from "../../stores/chat.store";
import { useGameStateStore } from "../../stores/game-state.store";

interface GameStateEditorModalProps {
  open: boolean;
  onClose: () => void;
  chatId: string;
}

/** Section ids are agent types ("world-state"); localization keys are camelCase. */
const toKeySegment = (id: string) => id.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());

const sameTurn = (left: GameState, right: GameState) =>
  left.messageId === right.messageId && left.swipeIndex === right.swipeIndex;

/** Lands queued tracker-panel edits first, so the editor never shows (or overwrites) a stale copy. */
async function fetchFreshGameState(chatId: string): Promise<GameState | null> {
  await useGameStateStore.getState().flushPatch?.();
  return api.get<GameState | null>(`/chats/${chatId}/game-state`);
}

const EXCERPT_LENGTH = 60;

/** One line of the message's text, so the snapshot can be matched to what's on screen. */
function messageExcerpt(content: string): string {
  const flat = content.replace(/\s+/g, " ").trim();
  return flat.length > EXCERPT_LENGTH ? `${flat.slice(0, EXCERPT_LENGTH).trimEnd()}…` : flat;
}

/** Chat order, as the chat view sorts loaded pages: oldest first. */
function compareByCursor(left: Message, right: Message): number {
  return (
    left.createdAt.localeCompare(right.createdAt) ||
    (left.rowid ?? 0) - (right.rowid ?? 0) ||
    left.id.localeCompare(right.id)
  );
}

interface SnapshotMessageInfo {
  message: Message;
  /** The #N the chat shows beside the message, when the total count is known. */
  number: number | null;
  isLatest: boolean;
}

/**
 * Finds the snapshot's message among the messages the chat already loaded. Pages load newest first,
 * so everything after it is loaded too and its #N is the total minus the loaded messages after it.
 */
function findSnapshotMessage(
  pages: Message[][] | undefined,
  totalCount: number | undefined,
  messageId: string,
): SnapshotMessageInfo | null {
  const loaded = (pages ?? []).flat().sort(compareByCursor);
  const index = loaded.findIndex((item) => item.id === messageId);
  if (index < 0) return null;
  const newerCount = loaded.length - 1 - index;
  return {
    message: loaded[index]!,
    number: typeof totalCount === "number" && totalCount >= loaded.length ? totalCount - newerCount : null,
    isLatest: newerCount === 0,
  };
}

/**
 * Names the snapshot being edited: every message swipe keeps its own game state, so "which turn is
 * this?" is the first thing to check before saving.
 */
function SnapshotLabel({ chatId, snapshot }: { chatId: string; snapshot: GameState }) {
  const { t: localizeUi } = useUiTranslation();
  const qc = useQueryClient();
  // Subscribe to the chat's message caches, so the label fills in if they load after the snapshot.
  const messagesKey = useMemo(() => chatKeys.messages(chatId), [chatId]);
  const countKey = useMemo(() => chatKeys.messageCount(chatId), [chatId]);
  const subscribe = useCallback((onChange: () => void) => qc.getQueryCache().subscribe(onChange), [qc]);
  const pages = useSyncExternalStore(subscribe, () => qc.getQueryData<InfiniteData<Message[]>>(messagesKey)?.pages);
  const totalCount = useSyncExternalStore(subscribe, () => qc.getQueryData<{ count: number }>(countKey)?.count);
  const info = useMemo(
    () => (snapshot.messageId ? findSnapshotMessage(pages, totalCount, snapshot.messageId) : null),
    [pages, snapshot.messageId, totalCount],
  );

  if (!snapshot.messageId) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]">
        <History size="0.8125rem" className="shrink-0" />
        {localizeUi("ui.stateEditor.gameState.snapshot.chatLevel")}
      </p>
    );
  }
  const swipe = Number.isInteger(snapshot.swipeIndex) && snapshot.swipeIndex >= 0 ? snapshot.swipeIndex + 1 : 1;
  const swipeCount = info?.message.swipeCount && info.message.swipeCount > 1 ? info.message.swipeCount : null;
  const swipeText = swipeCount
    ? localizeUi("ui.stateEditor.gameState.snapshot.swipeOf", { swipe, total: swipeCount })
    : localizeUi("ui.stateEditor.gameState.snapshot.swipe", { swipe });
  const messageText = info?.number
    ? localizeUi("ui.stateEditor.gameState.snapshot.messageNumber", { number: info.number })
    : localizeUi("ui.stateEditor.gameState.snapshot.message");
  const excerpt = info ? messageExcerpt(info.message.content) : "";
  return (
    <div
      title={localizeUi("ui.stateEditor.gameState.snapshot.messageId", { id: snapshot.messageId })}
      className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--muted-foreground)]"
    >
      <span className="inline-flex shrink-0 items-center gap-1.5">
        <History size="0.8125rem" className="shrink-0" />
        {localizeUi("ui.stateEditor.gameState.snapshot.editing")}
        <span className="font-medium text-[var(--foreground)]">
          {messageText} · {swipeText}
        </span>
      </span>
      {info?.isLatest ? (
        <span className="shrink-0 rounded-full bg-[var(--primary)]/15 px-1.5 py-px text-[0.625rem] font-semibold text-[var(--primary)] ring-1 ring-[var(--primary)]/30">
          {localizeUi("ui.stateEditor.gameState.snapshot.latest")}
        </span>
      ) : null}
      {excerpt ? <span className="min-w-0 basis-full truncate italic sm:basis-auto sm:flex-1">“{excerpt}”</span> : null}
    </div>
  );
}

export function GameStateEditorModal({ open, onClose, chatId }: GameStateEditorModalProps) {
  const { t: localizeUi } = useUiTranslation();
  const qc = useQueryClient();
  const queryKey = useMemo(() => ["state-editor", "game-state", chatId] as const, [chatId]);
  const gameStateQuery = useQuery({
    queryKey,
    queryFn: () => fetchFreshGameState(chatId),
    enabled: open && !!chatId,
    staleTime: 0,
    gcTime: 0,
    // The loaded snapshot is the drafts' baseline: only Reload or a save may replace it.
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  /** Why the open snapshot can't be saved over: another turn is current, or a section moved underneath. */
  const [stale, setStale] = useState<"turn" | "sections" | null>(null);
  const [editorKey, setEditorKey] = useState(0);
  const dirtyRef = useRef(false);

  const snapshot = gameStateQuery.data ?? null;
  const sections = useMemo(
    () =>
      snapshot
        ? buildGameStateEditorSections(snapshot, (id, part) =>
            localizeUi(`ui.stateEditor.gameState.sections.${toKeySegment(id)}.${part}`),
          )
        : [],
    [localizeUi, snapshot],
  );

  const handleDirtyChange = useCallback((dirty: boolean) => {
    dirtyRef.current = dirty;
  }, []);

  const requestClose = useCallback(async () => {
    if (dirtyRef.current) {
      const confirmed = await showConfirmDialog({
        title: localizeUi("ui.stateEditor.discard.title"),
        message: localizeUi("ui.stateEditor.discard.closeMessage"),
        confirmLabel: localizeUi("ui.stateEditor.discard.confirm"),
        cancelLabel: localizeUi("ui.stateEditor.discard.cancel"),
        tone: "destructive",
      });
      if (!confirmed) return;
    }
    onClose();
  }, [localizeUi, onClose]);

  const reload = useCallback(async () => {
    setStale(null);
    dirtyRef.current = false;
    setEditorKey((key) => key + 1);
    await gameStateQuery.refetch();
  }, [gameStateQuery]);

  const save = useCallback(
    async (changes: StateEditorChange[]) => {
      if (!snapshot) throw new Error(localizeUi("ui.stateEditor.gameState.noState"));
      // Build the patch from a fresh copy so concurrent tracker or agent updates to other fields survive.
      const fresh = await fetchFreshGameState(chatId);
      if (!fresh || !sameTurn(fresh, snapshot)) {
        setStale("turn");
        throw new Error(localizeUi("ui.stateEditor.gameState.turnMovedOn"));
      }
      const moved = findGameStateSectionsChangedSince(snapshot, fresh, changes);
      if (moved.length > 0) {
        setStale("sections");
        const labels = moved.map((id) => sections.find((item) => item.id === id)?.label ?? id);
        throw new Error(localizeUi("ui.stateEditor.gameState.sectionsChanged", { sections: labels.join(", ") }));
      }
      const result = buildGameStateEditorPatch(fresh, changes);
      if ("error" in result) {
        const section = sections.find((item) => item.id === result.sectionId);
        const message = result.error ?? localizeUi("ui.stateEditor.gameState.unknownSection");
        throw new Error(section ? `${section.label}: ${message}` : message);
      }
      // Aim at the exact snapshot row, like the tracker panel's own patcher.
      await api.patch(`/chats/${chatId}/game-state`, {
        ...result.patch,
        manual: true,
        ...(fresh.messageId ? { messageId: fresh.messageId } : {}),
        ...(fresh.messageId && Number.isInteger(fresh.swipeIndex) && fresh.swipeIndex >= 0
          ? { swipeIndex: fresh.swipeIndex }
          : {}),
      });
      const saved = await api.get<GameState | null>(`/chats/${chatId}/game-state`);
      qc.setQueryData(queryKey, saved);
      void qc.invalidateQueries({ queryKey: ["agent-suite", "game-state", chatId] });
      if (useChatStore.getState().activeChatId === chatId) useGameStateStore.getState().setGameState(saved);
      toast.success(localizeUi("ui.stateEditor.gameState.saved"));
    },
    [chatId, localizeUi, qc, queryKey, sections, snapshot],
  );

  return (
    <Modal
      open={open}
      onClose={() => void requestClose()}
      title={localizeUi("ui.stateEditor.gameState.title")}
      width="max-w-5xl"
      mobileFullscreen
      panelClassName="sm:h-[min(90dvh,52rem)]"
      contentClassName="flex flex-col p-0! overflow-hidden!"
    >
      {gameStateQuery.isPending ? (
        <div className="flex flex-1 items-center justify-center gap-2 py-16 text-sm text-[var(--muted-foreground)]">
          <Loader2 size="1rem" className="animate-spin" />
          {localizeUi("ui.stateEditor.gameState.loading")}
        </div>
      ) : gameStateQuery.isError ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center text-sm text-[var(--muted-foreground)]">
          <AlertTriangle size="1.25rem" className="text-[var(--marinara-app-accent-static)]" />
          {localizeUi("ui.stateEditor.gameState.loadFailed")}
          <button
            type="button"
            onClick={() => void reload()}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-[var(--secondary)] px-3 text-xs font-medium text-[var(--foreground)] ring-1 ring-[var(--border)] hover:bg-[var(--accent)]"
          >
            <RefreshCw size="0.875rem" />
            {localizeUi("ui.stateEditor.gameState.reload")}
          </button>
        </div>
      ) : !snapshot ? (
        <p className="flex flex-1 items-center justify-center px-6 py-16 text-center text-sm text-[var(--muted-foreground)]">
          {localizeUi("ui.stateEditor.gameState.noState")}
        </p>
      ) : (
        <StateEditor
          key={editorKey}
          sections={sections}
          onSave={save}
          onDirtyChange={handleDirtyChange}
          reviewSubtitle={(count) => localizeUi("ui.stateEditor.gameState.reviewSubtitle", { count })}
          notice={
            <div className="flex flex-col gap-2">
              <SnapshotLabel chatId={chatId} snapshot={snapshot} />
              {stale ? (
                <div
                  role="alert"
                  className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg bg-[var(--marinara-app-accent-static)]/10 px-3 py-2 text-xs text-[var(--marinara-app-accent-static)] ring-1 ring-[var(--marinara-app-accent-static)]/30"
                >
                  <AlertTriangle size="0.875rem" className="shrink-0" />
                  <span className="min-w-0 flex-1">
                    {localizeUi(
                      stale === "turn"
                        ? "ui.stateEditor.gameState.turnMovedOnNotice"
                        : "ui.stateEditor.gameState.sectionsChangedNotice",
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => void reload()}
                    className="inline-flex min-h-8 items-center gap-1 rounded-md bg-[var(--secondary)] px-2.5 font-medium text-[var(--foreground)] ring-1 ring-[var(--border)] hover:bg-[var(--accent)]"
                  >
                    <RefreshCw size="0.75rem" />
                    {localizeUi("ui.stateEditor.gameState.reload")}
                  </button>
                </div>
              ) : null}
            </div>
          }
        />
      )}
    </Modal>
  );
}
