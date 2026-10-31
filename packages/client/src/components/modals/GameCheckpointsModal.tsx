// ──────────────────────────────────────────────
// Checkpoints — a game's saved rewind points, newest first, with Load and Delete.
// Opened from Game controls (next to Edit game data). The State Editor takes one
// before each save, so an edit can always be undone.
// ──────────────────────────────────────────────
import { useCallback, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation as useUiTranslation } from "react-i18next";
import { toast } from "sonner";
import { AlertTriangle, Flag, History, Loader2, Trash2 } from "lucide-react";
import type { GameCheckpoint, GameState } from "@marinara-engine/shared";
import { Modal } from "../ui/Modal";
import { api } from "../../lib/api-client";
import { showConfirmDialog } from "../../lib/app-dialogs";
import { chatKeys } from "../../hooks/use-chats";
import { gameKeys } from "../../hooks/use-game";
import { useGameStateStore } from "../../stores/game-state.store";
import { GAME_CHECKPOINT_LOADED_EVENT } from "../../lib/game-checkpoint-events";

interface GameCheckpointsModalProps {
  open: boolean;
  onClose: () => void;
  chatId: string;
  /** The newest checkpoint of this kind is marked as the one to go back to (a fight's start, after a
   *  party fell in it). */
  highlight?: GameCheckpoint["triggerType"];
}

/** The app's own language, not the browser's: a player who picks a language sees its dates. */
function useWhen() {
  const { i18n } = useUiTranslation();
  return useMemo(
    () => new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium", timeStyle: "short" }),
    [i18n.language],
  );
}

export function GameCheckpointsModal({ open, onClose, chatId, highlight }: GameCheckpointsModalProps) {
  const { t: localizeUi } = useUiTranslation();
  const qc = useQueryClient();
  /** The checkpoint a load or delete is running for; both buttons wait while it does. */
  const [busyId, setBusyId] = useState<string | null>(null);
  const queryKey = useMemo(() => ["game-checkpoints", chatId] as const, [chatId]);
  const when = useWhen();
  const checkpoints = useQuery({
    queryKey,
    queryFn: () => api.get<GameCheckpoint[]>(`/game/${chatId}/checkpoints`),
    enabled: open && !!chatId,
    staleTime: 0,
  });

  const load = useCallback(
    async (checkpoint: GameCheckpoint) => {
      const confirmed = await showConfirmDialog({
        title: localizeUi("ui.game.checkpoints.loadTitle", { label: checkpoint.label }),
        message: localizeUi("ui.game.checkpoints.loadMessage"),
        confirmLabel: localizeUi("ui.game.checkpoints.load"),
        cancelLabel: localizeUi("ui.game.checkpoints.cancel"),
      });
      if (!confirmed) return;
      setBusyId(checkpoint.id);
      try {
        await api.post("/game/checkpoint/load", { chatId, checkpointId: checkpoint.id });
        window.dispatchEvent(new Event(GAME_CHECKPOINT_LOADED_EVENT));
      } catch (error) {
        toast.error(error instanceof Error ? error.message : localizeUi("ui.game.checkpoints.loadFailed"));
        setBusyId(null);
        return;
      }
      // The load landed on the server: whatever the game-state read does, the chat, its messages and the
      // game surface's caches are stale now, so they reload either way.
      void qc.invalidateQueries({ queryKey: chatKeys.all });
      void qc.invalidateQueries({ queryKey: gameKeys.all });
      try {
        // The tracker the game surface draws: it only fetches one when the store holds none for this chat,
        // so the restored one has to be put there here.
        const restored = await api.get<GameState | null>(`/chats/${chatId}/game-state`);
        useGameStateStore.getState().setGameState(restored);
        toast.success(localizeUi("ui.game.checkpoints.loaded"));
        onClose();
      } catch {
        // Its own failure is not the load's, but the tracker shown is the pre-load one: say so, and clear
        // it rather than keep showing it; the next turn writes the restored game's state, and reopening
        // the chat fetches it.
        useGameStateStore.getState().setGameState(null);
        toast.warning(localizeUi("ui.game.checkpoints.loadedStale"));
        onClose();
      } finally {
        setBusyId(null);
      }
    },
    [chatId, localizeUi, onClose, qc],
  );

  const remove = useCallback(
    async (checkpoint: GameCheckpoint) => {
      const confirmed = await showConfirmDialog({
        title: localizeUi("ui.game.checkpoints.deleteTitle", { label: checkpoint.label }),
        message: localizeUi("ui.game.checkpoints.deleteMessage"),
        confirmLabel: localizeUi("ui.game.checkpoints.delete"),
        cancelLabel: localizeUi("ui.game.checkpoints.cancel"),
        tone: "destructive",
      });
      if (!confirmed) return;
      setBusyId(checkpoint.id);
      try {
        await api.delete(`/game/checkpoint/${checkpoint.id}?chatId=${chatId}`);
        void qc.invalidateQueries({ queryKey });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : localizeUi("ui.game.checkpoints.deleteFailed"));
      } finally {
        setBusyId(null);
      }
    },
    [chatId, localizeUi, qc, queryKey],
  );

  const rows = checkpoints.data ?? [];
  const marked = highlight ? rows.find((row) => row.triggerType === highlight)?.id : undefined;

  return (
    <Modal open={open} onClose={onClose} title={localizeUi("ui.game.checkpoints.title")} width="max-w-xl">
      <div className="flex max-h-[min(70dvh,36rem)] flex-col gap-2 overflow-y-auto">
        {checkpoints.isPending ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-[var(--muted-foreground)]">
            <Loader2 size="1rem" className="animate-spin" />
            {localizeUi("ui.game.checkpoints.loading")}
          </div>
        ) : checkpoints.isError ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-[var(--muted-foreground)]">
            <AlertTriangle size="1rem" />
            {localizeUi("ui.game.checkpoints.readFailed")}
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center text-sm text-[var(--muted-foreground)]">
            <History size="1.25rem" />
            {localizeUi("ui.game.checkpoints.empty")}
          </div>
        ) : (
          rows.map((checkpoint) => (
            <div
              key={checkpoint.id}
              className={`flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg px-3 py-2.5 ${
                checkpoint.id === marked
                  ? "ring-2 ring-[var(--marinara-app-accent-static)]"
                  : "ring-1 ring-[var(--border)]"
              }`}
              ref={checkpoint.id === marked ? (node) => node?.scrollIntoView({ block: "nearest" }) : undefined}
            >
              <Flag size="0.875rem" className="shrink-0 text-[var(--marinara-app-accent-static)]" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm text-[var(--foreground)]">
                  {checkpoint.label}
                  {checkpoint.id === marked ? (
                    <span className="ml-2 text-xs text-[var(--marinara-app-accent-static)]">
                      {localizeUi("ui.game.checkpoints.suggested")}
                    </span>
                  ) : null}
                </div>
                <div className="truncate text-xs text-[var(--muted-foreground)]">
                  {localizeUi(`ui.game.checkpoints.triggers.${checkpoint.triggerType}`)} ·{" "}
                  {when.format(new Date(checkpoint.createdAt))}
                  {checkpoint.location ? (
                    <>
                      {" · "}
                      {checkpoint.location}
                    </>
                  ) : null}
                </div>
              </div>
              <button
                type="button"
                onClick={() => void load(checkpoint)}
                disabled={busyId !== null}
                className="inline-flex min-h-8 items-center gap-1 rounded-md bg-[var(--secondary)] px-2.5 text-xs font-medium text-[var(--foreground)] ring-1 ring-[var(--border)] hover:bg-[var(--accent)]"
              >
                <History size="0.75rem" />
                {localizeUi("ui.game.checkpoints.load")}
              </button>
              <button
                type="button"
                onClick={() => void remove(checkpoint)}
                disabled={busyId !== null}
                aria-label={localizeUi("ui.game.checkpoints.delete")}
                title={localizeUi("ui.game.checkpoints.delete")}
                className="inline-flex size-8 items-center justify-center rounded-md text-[var(--muted-foreground)] hover:bg-[var(--destructive)]/15 hover:text-[var(--destructive)]"
              >
                <Trash2 size="0.875rem" />
              </button>
            </div>
          ))
        )}
      </div>
    </Modal>
  );
}
