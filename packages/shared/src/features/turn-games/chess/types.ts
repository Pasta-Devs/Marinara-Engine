// ──────────────────────────────────────────────
// Chess — State, Moves, Config
// ──────────────────────────────────────────────

import { z } from "zod";
import type { GameEvent } from "../engine.types.js";

export type ChessColor = "white" | "black";
export type PromotionPiece = "q" | "r" | "b" | "n";
export type ChessPieceLetter = "p" | "n" | "b" | "r" | "q" | "k";

export interface ChessConfig {
  /** Which color the human plays. "random" resolves deterministically from the setup seed. */
  humanColor: ChessColor | "random";
}

export type ChessDrawReason =
  | "stalemate"
  | "insufficient_material"
  | "threefold_repetition"
  | "fifty_move_rule";

/**
 * The single move type. The model proposes SAN (e.g. "Nf3", "O-O", "e8=Q");
 * the board UI submits `from`/`to` squares (+ `promotion` when promoting).
 * The engine tries `san` first, then falls back to `from`/`to`.
 */
export interface ChessMove {
  type: "move";
  /** Standard Algebraic Notation, e.g. "e4", "Nxf7", "O-O-O", "e8=Q+". */
  san?: string;
  /** Origin square in algebraic coordinates, e.g. "e2". */
  from?: string;
  /** Destination square, e.g. "e4". */
  to?: string;
  /** Piece to promote to when a pawn reaches the last rank (defaults to queen). */
  promotion?: PromotionPiece;
}

export type ChessStatus = "active" | "finished";

export interface ChessState {
  config: ChessConfig;
  /**
   * Source of truth for the position. Every board-dependent method replays this
   * from the standard start; `fen` below is strictly a cache. Replaying the full
   * history (never rebuilding from FEN) is what keeps threefold-repetition and
   * fifty-move detection correct.
   */
  sanHistory: string[];
  /** Cached FEN of the current position (refreshed by setup/applyMove). */
  fen: string;
  whiteSeatId: string;
  blackSeatId: string;
  seatNames: Record<string, string>;
  seats: Array<{ seatId: string; displayName: string; kind: "human" | "bot" }>;
  status: ChessStatus;
  /** Set on checkmate (and never for draws). */
  winnerSeatId: string | null;
  drawReason: ChessDrawReason | null;
  /** Cached: the side to move is in check (refreshed by applyMove). */
  check: boolean;
  /** The setup seed (resolves "random" color; kept for reproducibility). */
  seed: number;
  lastMove: { from: string; to: string; san: string; seatId: string } | null;
  /** A short summary of the most recent resolved action (for the board). */
  lastAction: { seatId: string; summary: string } | null;
  /** Capped ring buffer of recent events (newest last) for the board log. */
  log: GameEvent[];
}

// ── Public (per-viewer) view rendered by the client board ───────────────────

export interface ChessPublicSeat {
  seatId: string;
  displayName: string;
  color: ChessColor;
  kind: "human" | "bot";
  isCurrent: boolean;
}

export interface ChessBoardSquare {
  type: ChessPieceLetter;
  color: "w" | "b";
}

export interface ChessPublicView {
  gameType: "chess";
  status: ChessStatus;
  fen: string;
  /** 8×8 in chess.js `.board()` order: row 0 = rank 8, column 0 = file a. */
  board: Array<Array<ChessBoardSquare | null>>;
  seats: ChessPublicSeat[];
  currentSeatId: string | null;
  winnerSeatId: string | null;
  drawReason: ChessDrawReason | null;
  yourSeatId: string | null;
  yourColor: ChessColor | null;
  /** The side to move is in check. */
  check: boolean;
  lastMove: { from: string; to: string; san: string; seatId: string } | null;
  /** Populated only when the viewer IS the current seat — drives click-to-move. */
  legalMovesForYou: Array<{ from: string; to: string; san: string; promotion?: PromotionPiece }>;
  /** Piece letters captured BY each color, in capture order (e.g. ["p", "p", "n"]). */
  capturedByWhite: ChessPieceLetter[];
  capturedByBlack: ChessPieceLetter[];
  sanHistory: string[];
  /** Full-move number (from the FEN). */
  moveNumber: number;
  lastAction: { seatId: string; summary: string } | null;
  config: ChessConfig;
  recentLog: GameEvent[];
}

// ── Zod schemas (validate untrusted config + move payloads at the boundary) ──

export const chessConfigSchema = z.object({
  humanColor: z.enum(["white", "black", "random"]),
});

export const chessMoveSchema: z.ZodType<ChessMove> = z.object({
  type: z.literal("move"),
  san: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  promotion: z.enum(["q", "r", "b", "n"]).optional(),
});

export const DEFAULT_CHESS_CONFIG: ChessConfig = {
  humanColor: "random",
};

export const CHESS_MIN_PLAYERS = 2;
export const CHESS_MAX_PLAYERS = 2;
export const CHESS_LOG_CAP = 24;
