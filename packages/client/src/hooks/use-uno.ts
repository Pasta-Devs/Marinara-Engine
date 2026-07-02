// ──────────────────────────────────────────────
// Hook: Turn-Game (UNO) API
// ──────────────────────────────────────────────
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError, api } from "../lib/api-client";
import { chatKeys } from "./use-chats";
import { useGenerate } from "./use-generate";
import { turnGameKeys } from "./turn-game-keys";
import { useUnoGameStore } from "../stores/uno-game.store";
import type { UnoConfig, UnoPublicView } from "@marinara-engine/shared";

export const unoKeys = turnGameKeys;

interface StateResponse {
  view: UnoPublicView;
}

interface OutcomeResponse {
  ok: boolean;
  view?: UnoPublicView;
  error?: string;
  finished?: boolean;
  winnerSeatId?: string | null;
  currentSeatId?: string | null;
  legalMoves?: unknown[];
}

export interface StartUnoBody {
  gameType: string;
  config?: Partial<UnoConfig>;
  botCharacterIds?: string[];
  seatOrder?: string[];
  humanFirst?: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

// The /turn-games REST surface is shared by every game type; only UNO views may
// reach the UNO store (a chess view rendered as UNO crashes the board).
function isUnoView(view: unknown): view is UnoPublicView {
  return isRecord(view) && view.gameType === "uno";
}

/**
 * Open a generate request to drive the bot seats, but only when the resulting
 * turn belongs to a bot (not the human, and not a finished game). This is the
 * single bridge that lets the server's bot loop stream into the open chat —
 * fired both after a human move AND right after dealing, since the opening card
 * (skip/reverse) or seat order can hand the first turn to a bot.
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

/** Fetch the current board for a chat (404 = no active game). Feeds the store. */
export function useUnoState(chatId: string | null) {
  return useQuery({
    queryKey: chatId ? unoKeys.state(chatId) : [...unoKeys.all, "state", "none"],
    enabled: !!chatId,
    staleTime: 30_000,
    retry: false,
    queryFn: async () => {
      if (!chatId) return null;
      try {
        const res = await api.get<StateResponse>(`/turn-games/${chatId}/state`);
        if (isUnoView(res?.view)) useUnoGameStore.getState().setUno(res.view, chatId);
        else if (res?.view) useUnoGameStore.getState().clearUno(chatId); // another game type is active
        return res;
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          useUnoGameStore.getState().clearUno(chatId);
          return null;
        }
        throw err;
      }
    },
  });
}

export function useStartUno(chatId: string) {
  const qc = useQueryClient();
  const { generate } = useGenerate();
  return useMutation({
    mutationFn: (body: StartUnoBody) => api.post<OutcomeResponse>(`/turn-games/${chatId}/start`, body),
    onSuccess: (res) => {
      if (isUnoView(res?.view)) useUnoGameStore.getState().setUno(res.view, chatId);
      qc.invalidateQueries({ queryKey: unoKeys.state(chatId) });
      // If the opening card or seat order hands the first turn to a bot, kick off the bot loop.
      maybeFireBotTurns(qc, generate, chatId, res);
    },
    onError: (err: unknown) => toast.error(err instanceof Error ? err.message : "Failed to start the game"),
  });
}

export function useUnoMove(chatId: string) {
  const qc = useQueryClient();
  const { generate } = useGenerate();
  return useMutation({
    mutationFn: (vars: { move: unknown }) => api.post<OutcomeResponse>(`/turn-games/${chatId}/move`, vars),
    onSuccess: (res) => {
      if (isUnoView(res?.view)) useUnoGameStore.getState().setUno(res.view, chatId);
      // Open a generate request so the server drives the bot seats over SSE.
      maybeFireBotTurns(qc, generate, chatId, res);
    },
    onError: (err: unknown) => {
      // The server returns 409 with { error, legalMoves, view } for an illegal move.
      if (err instanceof ApiError && isRecord(err.payload) && isUnoView(err.payload.view)) {
        useUnoGameStore.getState().setUno(err.payload.view, chatId);
      }
      toast.error(err instanceof Error ? err.message : "Illegal move");
    },
  });
}

export function useResignUno(chatId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post(`/turn-games/${chatId}/resign`, {}),
    onSuccess: () => {
      useUnoGameStore.getState().clearUno(chatId);
      qc.invalidateQueries({ queryKey: unoKeys.state(chatId) });
    },
  });
}
