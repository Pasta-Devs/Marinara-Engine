// ──────────────────────────────────────────────
// Hook: Turn-Game (Chess) API
// ──────────────────────────────────────────────
// Mirrors use-uno.ts against the same game-agnostic /turn-games REST surface.
// Reuses unoKeys' query-key root (one chat has at most one active turn-game,
// so both boards share the /state resource and invalidation stays coherent).
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError, api } from "../lib/api-client";
import { chatKeys } from "./use-chats";
import { useGenerate } from "./use-generate";
import { useChessGameStore } from "../stores/chess-game.store";
import { unoKeys } from "./use-uno";
import type { ChessConfig, ChessMove, ChessPublicView } from "@marinara-engine/shared";

interface StateResponse {
  view: ChessPublicView | { gameType?: string };
}

interface OutcomeResponse {
  ok: boolean;
  view?: ChessPublicView;
  error?: string;
  finished?: boolean;
  winnerSeatId?: string | null;
  currentSeatId?: string | null;
  legalMoves?: unknown[];
}

export interface StartChessBody {
  gameType: "chess";
  config?: Partial<ChessConfig>;
  botCharacterIds: string[];
  humanFirst?: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isChessView(view: unknown): view is ChessPublicView {
  return isRecord(view) && view.gameType === "chess";
}

/**
 * Open a generate request to drive the bot seat, but only when the resulting
 * turn belongs to the bot (not the human, and not a finished game). Fired both
 * after a human move AND right after starting — with random colors the bot can
 * draw white and must play the opening move.
 */
function maybeFireBotTurns(
  qc: ReturnType<typeof useQueryClient>,
  generate: ReturnType<typeof useGenerate>["generate"],
  chatId: string,
  res: OutcomeResponse | undefined,
): void {
  const view = res?.view;
  if (!view || res?.finished || !res?.currentSeatId || res.currentSeatId === view.yourSeatId) return;
  const chat =
    qc.getQueryData<{ connectionId?: string | null }>(chatKeys.detail(chatId)) ??
    (qc.getQueryData<Array<{ id: string; connectionId?: string | null }>>(chatKeys.list()) ?? []).find(
      (c) => c.id === chatId,
    );
  generate({ chatId, connectionId: chat?.connectionId ?? null, turnGameBots: true });
}

/** Fetch the current board for a chat (404 = no active game). Feeds the chess store
 * only when the active turn-game IS chess; other game types are left alone. */
export function useChessState(chatId: string | null) {
  return useQuery({
    queryKey: chatId ? [...unoKeys.state(chatId), "chess"] : [...unoKeys.all, "state", "none", "chess"],
    enabled: !!chatId,
    staleTime: 30_000,
    retry: false,
    queryFn: async () => {
      if (!chatId) return null;
      try {
        const res = await api.get<StateResponse>(`/turn-games/${chatId}/state`);
        if (isChessView(res?.view)) useChessGameStore.getState().setChess(res.view, chatId);
        else if (res?.view) useChessGameStore.getState().clearChess(chatId); // another game type is active
        return res;
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          useChessGameStore.getState().clearChess(chatId);
          return null;
        }
        throw err;
      }
    },
  });
}

export function useStartChess(chatId: string) {
  const qc = useQueryClient();
  const { generate } = useGenerate();
  return useMutation({
    mutationFn: (body: StartChessBody) => api.post<OutcomeResponse>(`/turn-games/${chatId}/start`, body),
    onSuccess: (res) => {
      if (isChessView(res?.view)) useChessGameStore.getState().setChess(res.view, chatId);
      qc.invalidateQueries({ queryKey: unoKeys.state(chatId) });
      // If the color draw hands the first move to the bot, kick off the bot loop.
      maybeFireBotTurns(qc, generate, chatId, res);
    },
    onError: (err: unknown) => toast.error(err instanceof Error ? err.message : "Failed to start the game"),
  });
}

export function useChessMove(chatId: string) {
  const qc = useQueryClient();
  const { generate } = useGenerate();
  return useMutation({
    mutationFn: (vars: { move: ChessMove }) => api.post<OutcomeResponse>(`/turn-games/${chatId}/move`, vars),
    onSuccess: (res) => {
      if (isChessView(res?.view)) useChessGameStore.getState().setChess(res.view, chatId);
      // Open a generate request so the server drives the bot seat over SSE.
      maybeFireBotTurns(qc, generate, chatId, res);
    },
    onError: (err: unknown) => {
      // The server returns 409 with { error, legalMoves, view } for an illegal move.
      if (err instanceof ApiError && isRecord(err.payload) && isChessView(err.payload.view)) {
        useChessGameStore.getState().setChess(err.payload.view, chatId);
      }
      toast.error(err instanceof Error ? err.message : "Illegal move");
    },
  });
}

export function useResignChess(chatId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post(`/turn-games/${chatId}/resign`, {}),
    onSuccess: () => {
      useChessGameStore.getState().clearChess(chatId);
      qc.invalidateQueries({ queryKey: unoKeys.state(chatId) });
    },
  });
}
