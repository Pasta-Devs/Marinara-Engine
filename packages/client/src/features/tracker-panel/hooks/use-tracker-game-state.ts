import { useCallback, useEffect, useState } from "react";
import type { GameState } from "@marinara-engine/shared";
import { api } from "../../../lib/api-client";
import { useGameStateStore } from "../../../stores/game-state.store";

type TrackerGameStateLoadStatus = "idle" | "loading" | "loaded" | "error";

export function useTrackerGameState(activeChatId: string | null) {
  const currentGameState = useGameStateStore((s) =>
    activeChatId && s.current?.chatId === activeChatId ? s.current : null,
  );
  const gameStateRefreshing = useGameStateStore((s) => s.isRefreshing);
  const setGameState = useGameStateStore((s) => s.setGameState);
  const [loadResult, setLoadResult] = useState<{
    chatId: string;
    status: Exclude<TrackerGameStateLoadStatus, "idle">;
  } | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const retryGameState = useCallback(() => setLoadAttempt((attempt) => attempt + 1), []);

  useEffect(() => {
    if (!activeChatId) {
      setLoadResult(null);
      return;
    }

    const existing = useGameStateStore.getState().current;
    if (existing?.chatId === activeChatId) {
      setLoadResult({ chatId: activeChatId, status: "loaded" });
      return;
    }

    let cancelled = false;
    setLoadResult({ chatId: activeChatId, status: "loading" });
    api
      .get<GameState | null>(`/chats/${activeChatId}/game-state`)
      .then((state) => {
        if (!cancelled) {
          setGameState(state ?? null);
          setLoadResult({ chatId: activeChatId, status: "loaded" });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setGameState(null);
          setLoadResult({ chatId: activeChatId, status: "error" });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeChatId, loadAttempt, setGameState]);

  const gameStateLoadStatus: TrackerGameStateLoadStatus = !activeChatId
    ? "idle"
    : currentGameState
      ? "loaded"
      : loadResult?.chatId === activeChatId
        ? loadResult.status
        : "loading";

  return {
    currentGameState,
    gameStateRefreshing,
    gameStateLoadStatus,
    retryGameState,
  };
}
