// ──────────────────────────────────────────────
// ChessBoard — live, interactive chess board (conversation mode)
// ──────────────────────────────────────────────
// A real React component driven by the chess-game store (fed by
// turn_game_state_patch SSE + an initial fetch). Renders the 8×8 board with
// hand-authored inline SVG pieces (no image assets), click-to-move with
// legal-target highlighting from the server's publicView, a promotion picker,
// and check / last-move highlights. The board flips when the human plays black.
import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import type { ChessBoardSquare, ChessPieceLetter, PromotionPiece } from "@marinara-engine/shared";
import { useChatStore } from "../../stores/chat.store";
import { useChessGameStore } from "../../stores/chess-game.store";
import { useChessMove, useChessState, useResignChess } from "../../hooks/use-chess";

interface Props {
  chatId: string;
}

// Classic muted board tones — readable on light and dark app themes alike
// (piece colors are hardcoded too, matching UnoBoard's fixed card palette).
const LIGHT_SQUARE = "#ebecd0";
const DARK_SQUARE = "#739552";

const PIECE_NAMES: Record<ChessPieceLetter, string> = {
  p: "pawn",
  n: "knight",
  b: "bishop",
  r: "rook",
  q: "queen",
  k: "king",
};

const PIECE_VALUES: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9 };

// ── hand-authored piece silhouettes (viewBox 0 0 45 45) ─────────────────────

function pieceShapes(kind: ChessPieceLetter): React.ReactNode {
  switch (kind) {
    case "p":
      return (
        <>
          <circle cx="22.5" cy="13" r="5.5" />
          <path d="M18.5 17.5 C16 23 15.5 27 16.5 32 L28.5 32 C29.5 27 29 23 26.5 17.5 Z" />
          <path d="M12.5 36.5 C12.5 33.5 16 32 22.5 32 C29 32 32.5 33.5 32.5 36.5 L32.5 38.5 L12.5 38.5 Z" />
        </>
      );
    case "r":
      return (
        <>
          <path d="M13 10 L17 10 L17 13.5 L20.5 13.5 L20.5 10 L24.5 10 L24.5 13.5 L28 13.5 L28 10 L32 10 L32 17 L29.5 20 L29.5 30 L32 33 L13 33 L15.5 30 L15.5 20 L13 17 Z" />
          <path d="M11.5 36.5 C11.5 34.5 15 33 22.5 33 C30 33 33.5 34.5 33.5 36.5 L33.5 38.5 L11.5 38.5 Z" />
        </>
      );
    case "n":
      return (
        <>
          <path d="M15.5 32 C15.5 24 17.5 19.5 21 16.5 L19.5 10.5 L24 13.5 C29.5 15 32.5 20.5 32.5 27 L32.5 32 Z" />
          <path d="M21 16.5 C18 18 15 21.5 13.5 25 L16.5 26.5 C17.5 24 19 21.5 21.5 20 Z" />
          <path d="M12 36.5 C12 34 15.5 32.5 22.5 32.5 C29.5 32.5 33 34 33 36.5 L33 38.5 L12 38.5 Z" />
        </>
      );
    case "b":
      return (
        <>
          <circle cx="22.5" cy="8.5" r="2.5" />
          <path d="M22.5 11.5 C27.5 16 30 20 30 24.5 C30 29 26.5 31.5 22.5 31.5 C18.5 31.5 15 29 15 24.5 C15 20 17.5 16 22.5 11.5 Z" />
          <path d="M12.5 36.5 C12.5 34 16 32.5 22.5 32.5 C29 32.5 32.5 34 32.5 36.5 L32.5 38.5 L12.5 38.5 Z" />
        </>
      );
    case "q":
      return (
        <>
          <circle cx="10" cy="14" r="2.4" />
          <circle cx="22.5" cy="10.5" r="2.4" />
          <circle cx="35" cy="14" r="2.4" />
          <path d="M11 17 L15.5 32.5 L29.5 32.5 L34 17 L28.5 23 L22.5 13.5 L16.5 23 Z" />
          <path d="M12.5 37 C12.5 34.5 16 33 22.5 33 C29 33 32.5 34.5 32.5 37 L32.5 38.5 L12.5 38.5 Z" />
        </>
      );
    case "k":
      return (
        <>
          <path d="M21 7 L24 7 L24 10 L27 10 L27 13 L24 13 L24 16 L21 16 L21 13 L18 13 L18 10 L21 10 Z" />
          <path d="M22.5 16.5 C28.5 16.5 32 20.5 32 25 C32 29 29.5 32.5 26 32.5 L19 32.5 C15.5 32.5 13 29 13 25 C13 20.5 16.5 16.5 22.5 16.5 Z" />
          <path d="M12.5 37 C12.5 34.5 16 33 22.5 33 C29 33 32.5 34.5 32.5 37 L32.5 38.5 L12.5 38.5 Z" />
        </>
      );
  }
}

export function ChessPiece({
  kind,
  color,
  className,
}: {
  kind: ChessPieceLetter;
  color: "w" | "b";
  className?: string;
}) {
  const fill = color === "w" ? "#f8f8f2" : "#3b3f45";
  const stroke = color === "w" ? "#44444a" : "#111418";
  return (
    <svg
      viewBox="0 0 45 45"
      className={className ?? "h-full w-full"}
      role="img"
      aria-label={`${color === "w" ? "white" : "black"} ${PIECE_NAMES[kind]}`}
      fill={fill}
      stroke={stroke}
      strokeWidth="1.6"
      strokeLinejoin="round"
    >
      {pieceShapes(kind)}
    </svg>
  );
}

// ── helpers ──────────────────────────────────────────────────────────────────

/** Algebraic square name for a chess.js board index (row 0 = rank 8, col 0 = file a). */
function squareName(row: number, col: number): string {
  return `${String.fromCharCode(97 + col)}${8 - row}`;
}

function materialEdge(capturedByYou: ChessPieceLetter[], capturedByThem: ChessPieceLetter[]): number {
  const sum = (arr: ChessPieceLetter[]) => arr.reduce((acc, p) => acc + (PIECE_VALUES[p] ?? 0), 0);
  return sum(capturedByYou) - sum(capturedByThem);
}

/** The last few plies with move numbers, e.g. "12. Nf3 Nc6 13. Bb5". */
function sanStrip(sanHistory: string[], maxPlies: number): string {
  const total = sanHistory.length;
  if (total === 0) return "";
  const start = Math.max(0, total - maxPlies);
  const parts: string[] = [];
  for (let i = start; i < total; i++) {
    const san = sanHistory[i]!;
    const moveNo = Math.floor(i / 2) + 1;
    if (i % 2 === 0) parts.push(`${moveNo}. ${san}`);
    else if (i === start) parts.push(`${moveNo}. … ${san}`);
    else parts.push(san);
  }
  return parts.join(" ");
}

const DRAW_TEXT: Record<string, string> = {
  stalemate: "stalemate",
  insufficient_material: "insufficient material",
  threefold_repetition: "threefold repetition",
  fifty_move_rule: "the fifty-move rule",
};

const PROMOTION_CHOICES: PromotionPiece[] = ["q", "r", "b", "n"];

// ── component ─────────────────────────────────────────────────────────────────

export function ChessBoard({ chatId }: Props) {
  const current = useChessGameStore((s) => s.current);
  const streaming = useChatStore((s) => s.isStreaming);
  const streamingChatId = useChatStore((s) => s.streamingChatId);
  const isStreaming = streaming && streamingChatId === chatId;
  const move = useChessMove(chatId);
  const resign = useResignChess(chatId);

  // Hydrate the board on mount / chat switch (no-op if no active game).
  const active = !!current && current.chatId === chatId;
  useChessState(active ? null : chatId);

  const [selected, setSelected] = useState<string | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<{ from: string; to: string } | null>(null);
  useEffect(() => {
    setSelected(null);
    setPendingPromotion(null);
  }, [chatId]);

  const view = active ? current : null;
  const disabled = isStreaming || move.isPending || resign.isPending;
  const isMyTurn = !!view && view.status !== "finished" && view.currentSeatId === view.yourSeatId;

  // Legal targets grouped by origin square — drives selection + target dots.
  const targetsByFrom = useMemo(() => {
    const map = new Map<string, Array<{ to: string; promotion?: PromotionPiece }>>();
    for (const m of view?.legalMovesForYou ?? []) {
      const list = map.get(m.from) ?? [];
      list.push({ to: m.to, ...(m.promotion ? { promotion: m.promotion } : {}) });
      map.set(m.from, list);
    }
    return map;
  }, [view]);

  const selectedTargets = useMemo(() => {
    if (!selected) return new Set<string>();
    return new Set((targetsByFrom.get(selected) ?? []).map((t) => t.to));
  }, [selected, targetsByFrom]);

  // The checked king's square (side to move), for the red check ring.
  const checkSquare = useMemo(() => {
    if (!view?.check || view.status === "finished") return null;
    const toMoveColor = view.seats.find((s) => s.seatId === view.currentSeatId)?.color;
    const letter = toMoveColor === "black" ? "b" : "w";
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const sq = view.board[r]?.[c];
        if (sq && sq.type === "k" && sq.color === letter) return squareName(r, c);
      }
    }
    return null;
  }, [view]);

  if (!view) return null;

  const flipped = view.yourColor === "black";
  const yourLetter = view.yourColor === "black" ? "b" : "w";

  const submitMove = (from: string, to: string, promotion?: PromotionPiece) => {
    if (disabled) return;
    setSelected(null);
    setPendingPromotion(null);
    move.mutate({ move: { type: "move", from, to, ...(promotion ? { promotion } : {}) } });
  };

  const onSquareClick = (square: string, piece: ChessBoardSquare | null) => {
    if (!isMyTurn || disabled) return;
    if (selected && selectedTargets.has(square)) {
      // Promotion if any legal move on this (from, to) pair carries a promotion piece.
      const needsPromotion = (targetsByFrom.get(selected) ?? []).some((t) => t.to === square && t.promotion);
      if (needsPromotion) return setPendingPromotion({ from: selected, to: square });
      return submitMove(selected, square);
    }
    if (piece && piece.color === yourLetter && targetsByFrom.has(square)) {
      return setSelected(selected === square ? null : square);
    }
    setSelected(null);
  };

  const you = view.seats.find((s) => s.seatId === view.yourSeatId) ?? null;
  const opponent = view.seats.find((s) => s.seatId !== view.yourSeatId) ?? null;
  const currentSeat = view.seats.find((s) => s.seatId === view.currentSeatId) ?? null;
  const winner = view.winnerSeatId ? view.seats.find((s) => s.seatId === view.winnerSeatId) : null;
  const strip = sanStrip(view.sanHistory, 6);

  const seatChip = (seat: typeof you, capturedRow: ChessPieceLetter[], edge: number) =>
    seat && (
      <div
        className={`flex items-center gap-1.5 rounded-lg px-1.5 py-1 ${
          seat.isCurrent ? "bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]/40" : "ring-1 ring-[var(--border)]"
        }`}
      >
        <span
          className="inline-block h-3 w-3 rounded-full ring-1 ring-black/30"
          style={{ background: seat.color === "white" ? "#f8f8f2" : "#3b3f45" }}
          title={seat.color}
        />
        <div className="leading-tight">
          <div className="flex items-center gap-1 text-xs font-medium text-[var(--foreground)]">
            {seat.displayName}
            {seat.seatId === view.yourSeatId && (
              <span className="text-[0.6rem] font-semibold text-[var(--muted-foreground)]">(you)</span>
            )}
          </div>
          <div className="flex h-4 items-center gap-0.5">
            {capturedRow.map((p, i) => (
              <span key={`${p}-${i}`} className="h-4 w-4 opacity-80">
                <ChessPiece kind={p} color={seat.color === "white" ? "b" : "w"} />
              </span>
            ))}
            {edge > 0 && <span className="text-[0.65rem] font-semibold text-[var(--muted-foreground)]">+{edge}</span>}
          </div>
        </div>
      </div>
    );

  return (
    <div className="mx-2 mb-1 rounded-xl border border-[var(--border)] bg-[var(--card)] p-2 shadow-sm">
      {/* Header: seats + status + resign */}
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-[var(--muted-foreground)]">
        <span className="font-semibold text-[var(--foreground)]">Chess</span>
        {seatChip(
          opponent,
          opponent?.color === "white" ? view.capturedByWhite : view.capturedByBlack,
          opponent
            ? materialEdge(
                opponent.color === "white" ? view.capturedByWhite : view.capturedByBlack,
                opponent.color === "white" ? view.capturedByBlack : view.capturedByWhite,
              )
            : 0,
        )}
        {seatChip(
          you,
          you?.color === "white" ? view.capturedByWhite : view.capturedByBlack,
          you
            ? materialEdge(
                you.color === "white" ? view.capturedByWhite : view.capturedByBlack,
                you.color === "white" ? view.capturedByBlack : view.capturedByWhite,
              )
            : 0,
        )}
        <div className="ml-auto flex items-center gap-2">
          {view.status !== "finished" && (
            <span className={isMyTurn ? "font-semibold text-[var(--primary)] animate-pulse" : ""}>
              {isMyTurn ? (view.check ? "Your turn — check!" : "Your turn") : `${currentSeat?.displayName ?? "…"} is thinking…`}
            </span>
          )}
          <button
            type="button"
            onClick={() => {
              if (window.confirm("Resign and end this game?")) resign.mutate();
            }}
            className="rounded p-1 text-[var(--muted-foreground)] hover:bg-[var(--muted)] active:scale-90"
            title="Resign"
            aria-label="Resign and end game"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Finished banner */}
      {view.status === "finished" && (
        <div className="mb-2 rounded-lg bg-[var(--primary)]/10 px-3 py-2 text-center text-sm font-semibold text-[var(--primary)]">
          {winner
            ? `${winner.displayName} wins by checkmate! 🏆`
            : view.drawReason
              ? `Draw — ${DRAW_TEXT[view.drawReason] ?? view.drawReason}`
              : "Game over"}
        </div>
      )}

      {/* Board */}
      <div className="mx-auto grid w-full max-w-[22rem] grid-cols-8 overflow-hidden rounded-lg ring-1 ring-black/25">
        {Array.from({ length: 64 }, (_, i) => {
          const rIdx = Math.floor(i / 8);
          const cIdx = i % 8;
          const row = flipped ? 7 - rIdx : rIdx;
          const col = flipped ? 7 - cIdx : cIdx;
          const square = squareName(row, col);
          const piece = view.board[row]?.[col] ?? null;
          const isLight = (row + col) % 2 === 0;
          const isSelected = selected === square;
          const isTarget = selectedTargets.has(square);
          const isLastMove = view.lastMove?.from === square || view.lastMove?.to === square;
          const isCheck = checkSquare === square;
          const clickable =
            isMyTurn && !disabled && (isTarget || (piece?.color === yourLetter && targetsByFrom.has(square)));
          return (
            <button
              key={square}
              type="button"
              onClick={() => onSquareClick(square, piece)}
              className={`relative aspect-square w-full p-0 ${clickable ? "cursor-pointer" : "cursor-default"}`}
              style={{ background: isLight ? LIGHT_SQUARE : DARK_SQUARE }}
              aria-label={`${square}${piece ? `, ${piece.color === "w" ? "white" : "black"} ${PIECE_NAMES[piece.type]}` : ""}${isTarget ? ", legal move" : ""}`}
            >
              {isLastMove && <span className="absolute inset-0 bg-yellow-300/35" />}
              {isSelected && <span className="absolute inset-0 ring-2 ring-inset ring-yellow-500" />}
              {isCheck && <span className="absolute inset-0 ring-2 ring-inset ring-red-500" />}
              {piece && (
                <span className="absolute inset-0 p-[6%]">
                  <ChessPiece kind={piece.type} color={piece.color} />
                </span>
              )}
              {isTarget &&
                (piece ? (
                  <span className="absolute inset-0 ring-4 ring-inset ring-black/25" />
                ) : (
                  <span className="absolute left-1/2 top-1/2 h-[28%] w-[28%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/25" />
                ))}
              {cIdx === 0 && (
                <span className="absolute left-0.5 top-0 text-[0.55rem] font-semibold" style={{ color: isLight ? DARK_SQUARE : LIGHT_SQUARE }}>
                  {8 - row}
                </span>
              )}
              {rIdx === 7 && (
                <span className="absolute bottom-0 right-0.5 text-[0.55rem] font-semibold" style={{ color: isLight ? DARK_SQUARE : LIGHT_SQUARE }}>
                  {String.fromCharCode(97 + col)}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Promotion picker */}
      {pendingPromotion && (
        <div className="mt-2 flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--muted)]/40 p-2">
          <span className="text-xs text-[var(--muted-foreground)]">Promote to:</span>
          {PROMOTION_CHOICES.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => submitMove(pendingPromotion.from, pendingPromotion.to, p)}
              className="h-9 w-9 rounded-lg bg-[var(--background)] ring-1 ring-[var(--border)] transition-transform hover:scale-110"
              aria-label={`Promote to ${PIECE_NAMES[p]}`}
            >
              <ChessPiece kind={p} color={yourLetter} />
            </button>
          ))}
          <button
            type="button"
            onClick={() => setPendingPromotion(null)}
            className="ml-auto text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            aria-label="Cancel promotion"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Move ticker */}
      {(view.lastAction || strip) && (
        <div className="mt-1.5 flex items-baseline gap-2 text-[0.7rem] text-[var(--muted-foreground)]">
          {view.lastAction && view.status !== "finished" && (
            <span className="truncate">
              {view.seats.find((s) => s.seatId === view.lastAction!.seatId)?.displayName ?? "—"}{" "}
              {view.lastAction.summary}
            </span>
          )}
          {strip && <span className="ml-auto truncate font-mono">{strip}</span>}
        </div>
      )}
    </div>
  );
}
