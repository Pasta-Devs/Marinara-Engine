// ──────────────────────────────────────────────
// Zustand Store: Chess Board (turn-game #2)
// ──────────────────────────────────────────────
// Holds the live, per-viewer chess snapshot pushed by the server
// (turn_game_state_patch SSE, dispatched by gameType) or fetched on mount.
// chatId-guarded so a background chat's game can never paint over the visible
// board. Synchronous only — all async lives in use-chess.ts.
import { create } from "zustand";
import type { ChessPublicView } from "@marinara-engine/shared";

export type ChessBoardSnapshot = ChessPublicView & { chatId: string };

interface ChessGameStore {
  current: ChessBoardSnapshot | null;
  /** Chat whose setup modal is open (null = closed). Driven by the /chess command. */
  setupChatId: string | null;
  /** Replace the board with a fresh server snapshot for a chat. */
  setChess: (view: ChessPublicView, chatId: string) => void;
  /** Clear the board (optionally only if it belongs to a given chat). */
  clearChess: (chatId?: string) => void;
  /** Open the game-setup modal for a chat. */
  openSetup: (chatId: string) => void;
  closeSetup: () => void;
  reset: () => void;
}

export const useChessGameStore = create<ChessGameStore>((set) => ({
  current: null,
  setupChatId: null,
  setChess: (view, chatId) => set({ current: { ...view, chatId } }),
  clearChess: (chatId) =>
    set((state) => (!chatId || state.current?.chatId === chatId ? { current: null } : {})),
  openSetup: (chatId) => set({ setupChatId: chatId }),
  closeSetup: () => set({ setupChatId: null }),
  reset: () => set({ current: null, setupChatId: null }),
}));
