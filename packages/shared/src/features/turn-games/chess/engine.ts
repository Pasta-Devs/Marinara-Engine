// ──────────────────────────────────────────────
// Chess — deterministic engine (server-authoritative)
// ──────────────────────────────────────────────
// Pure functions over ChessState, with move legality delegated to chess.js.
// The single source of truth for legality, turn order, and game end. The LLM
// only proposes SAN moves (validated here) and narrates the engine-confirmed
// result; it never adjudicates rules. Chess has no randomness beyond the
// deterministic color assignment derived from the setup seed, and no hidden
// information — both players (and spectators) see the full board.
//
// IMPORTANT: `state.sanHistory` is the source of truth and every board-
// dependent method replays it from the start position. `state.fen` is a cache
// for O(1) reads (currentSeat/isTerminal run on hot server paths). Never
// rebuild a position from FEN alone — that silently breaks threefold-
// repetition and fifty-move draw detection.

import { Chess, type Move } from "chess.js";
import type {
  GameEvent,
  ModelTurnView,
  MoveResult,
  Seat,
  TerminalResult,
  TurnGameEngine,
} from "../engine.types.js";
import { CHESS_TOOL_MANIFESTS } from "./tools.js";
import {
  CHESS_LOG_CAP,
  CHESS_MAX_PLAYERS,
  CHESS_MIN_PLAYERS,
  DEFAULT_CHESS_CONFIG,
  chessConfigSchema,
  type ChessColor,
  type ChessConfig,
  type ChessDrawReason,
  type ChessMove,
  type ChessPieceLetter,
  type ChessPublicSeat,
  type ChessPublicView,
  type ChessState,
  type PromotionPiece,
} from "./types.js";

// ── small helpers ───────────────────────────────────────────────────────────

function clone(state: ChessState): ChessState {
  return JSON.parse(JSON.stringify(state)) as ChessState;
}

const PIECE_NAMES: Record<string, string> = {
  p: "pawn",
  n: "knight",
  b: "bishop",
  r: "rook",
  q: "queen",
  k: "king",
};

const PIECE_VALUES: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9 };

function pieceName(letter: string | undefined): string {
  return (letter && PIECE_NAMES[letter]) || "piece";
}

function nameOf(state: ChessState, seatId: string): string {
  return state.seatNames[seatId] ?? seatId;
}

/** Replay the full move history onto a fresh board. History is engine-authored,
 * so failures are unreachable in practice; stop replaying defensively if one occurs. */
function replay(state: ChessState): Chess {
  const c = new Chess();
  for (const san of state.sanHistory) {
    try {
      c.move(san);
    } catch {
      break;
    }
  }
  return c;
}

/** Side to move, parsed from the cached FEN (O(1), no replay). */
function sideToMove(state: ChessState): "w" | "b" {
  return state.fen.split(" ")[1] === "b" ? "b" : "w";
}

function moveNumberFromFen(fen: string): number {
  const n = Number.parseInt(fen.split(" ")[5] ?? "1", 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function seatForColor(state: ChessState, color: "w" | "b"): string {
  return color === "w" ? state.whiteSeatId : state.blackSeatId;
}

function colorOfSeat(state: ChessState, seatId: string): ChessColor | null {
  if (seatId === state.whiteSeatId) return "white";
  if (seatId === state.blackSeatId) return "black";
  return null;
}

function record(state: ChessState, event: GameEvent): void {
  state.log.push(event);
  if (state.log.length > CHESS_LOG_CAP) state.log.splice(0, state.log.length - CHESS_LOG_CAP);
}

function setLast(state: ChessState, seatId: string, summary: string): void {
  state.lastAction = { seatId, summary };
}

/** Normalize model-flavored SAN: strip move numbers and annotations, fix castling zeros. */
function normalizeSan(raw: string): string {
  let san = raw.trim();
  san = san.replace(/^\d+\.+\s*/, "");
  san = san.replace(/[!?]+$/, "");
  if (/^[0o]-[0o]-[0o]/i.test(san)) san = `O-O-O${san.slice(5)}`;
  else if (/^[0o]-[0o]/i.test(san)) san = `O-O${san.slice(3)}`;
  return san.trim();
}

function toChessMove(m: Move): ChessMove {
  return {
    type: "move",
    san: m.san,
    from: m.from,
    to: m.to,
    ...(m.promotion ? { promotion: m.promotion as PromotionPiece } : {}),
  };
}

/** Material point balance from the FEN placement field (positive = white ahead). */
function materialBalance(fen: string): number {
  const placement = fen.split(" ")[0] ?? "";
  let balance = 0;
  for (const ch of placement) {
    const lower = ch.toLowerCase();
    const value = PIECE_VALUES[lower];
    if (!value) continue;
    balance += ch === lower ? -value : value;
  }
  return balance;
}

function materialLine(state: ChessState): string {
  const balance = materialBalance(state.fen);
  if (balance === 0) return "Material is even.";
  const ahead = balance > 0 ? nameOf(state, state.whiteSeatId) : nameOf(state, state.blackSeatId);
  const points = Math.abs(balance);
  return `${ahead} is up ${points} point${points === 1 ? "" : "s"} of material.`;
}

/** The last `maxPlies` moves formatted with move numbers, e.g. "12. Nf3 Nc6 13. Bb5". */
function recentMovesLine(state: ChessState, maxPlies: number): string {
  const total = state.sanHistory.length;
  if (total === 0) return "";
  const start = Math.max(0, total - maxPlies);
  const parts: string[] = [];
  for (let i = start; i < total; i++) {
    const san = state.sanHistory[i]!;
    const moveNo = Math.floor(i / 2) + 1;
    if (i % 2 === 0) parts.push(`${moveNo}. ${san}`);
    else if (i === start) parts.push(`${moveNo}. … ${san}`);
    else parts.push(san);
  }
  return parts.join(" ");
}

/** The last `max` human-readable game events, oldest→newest. */
function recentPlayLines(state: ChessState, max: number): string[] {
  return state.log
    .filter((e) => e.type !== "game_started" && typeof e.message === "string" && e.message.trim().length > 0)
    .slice(-max)
    .map((e) => `  • ${e.message}`);
}

function drawReasonText(reason: ChessDrawReason): string {
  switch (reason) {
    case "stalemate":
      return "stalemate";
    case "insufficient_material":
      return "insufficient material";
    case "threefold_repetition":
      return "threefold repetition";
    case "fifty_move_rule":
      return "the fifty-move rule";
  }
}

function enumerateLegalMoves(state: ChessState, seatId: string): ChessMove[] {
  if (state.status === "finished") return [];
  if (seatForColor(state, sideToMove(state)) !== seatId) return [];
  return replay(state).moves({ verbose: true }).map(toChessMove);
}

// ── move resolution ─────────────────────────────────────────────────────────

/** Try the proposed move on the board. Returns the applied verbose move or null.
 * chess.js `.move()` THROWS on illegal input, so every call is wrapped. */
function tryApply(c: Chess, move: ChessMove): Move | null {
  if (typeof move.san === "string" && move.san.trim()) {
    try {
      return c.move(normalizeSan(move.san));
    } catch {
      /* fall through to from/to */
    }
  }
  if (typeof move.from === "string" && move.from && typeof move.to === "string" && move.to) {
    // Default promotions to queen so a board UI that skipped the picker still works;
    // retry without the field in case the library rejects it as extraneous.
    try {
      return c.move({ from: move.from, to: move.to, promotion: move.promotion ?? "q" });
    } catch {
      try {
        return c.move({ from: move.from, to: move.to });
      } catch {
        return null;
      }
    }
  }
  return null;
}

function describeAttempt(move: ChessMove): string {
  if (move.san && move.san.trim()) return move.san.trim();
  if (move.from && move.to) return `${move.from}-${move.to}${move.promotion ? `=${move.promotion.toUpperCase()}` : ""}`;
  return "(no move given)";
}

function moveFlavor(state: ChessState, seatId: string, made: Move): string {
  const name = nameOf(state, seatId);
  if (made.flags.includes("k")) return `${name} castles kingside (O-O).`;
  if (made.flags.includes("q")) return `${name} castles queenside (O-O-O).`;
  let text = `${name} plays ${made.san}`;
  if (made.captured) {
    text += `, capturing a ${pieceName(made.captured)}`;
    if (made.flags.includes("e")) text += " en passant";
  }
  if (made.promotion) text += `, promoting to a ${pieceName(made.promotion)}`;
  return `${text}.`;
}

// ── prompt builders ─────────────────────────────────────────────────────────

function buildBoardSummary(state: ChessState, seatId: string, c: Chess): string {
  const yourColor = colorOfSeat(state, seatId) ?? "white";
  const oppSeatId = seatId === state.whiteSeatId ? state.blackSeatId : state.whiteSeatId;
  const oppColor = yourColor === "white" ? "black" : "white";
  const lines: string[] = [];
  lines.push(
    `Chess — move ${moveNumberFromFen(state.fen)}. You are ${nameOf(state, seatId)}, playing ${yourColor}. ` +
      `Your opponent is ${nameOf(state, oppSeatId)} (${oppColor}).`,
  );
  lines.push(`Position (FEN): ${state.fen}`);
  lines.push(c.ascii());
  lines.push(`Material: ${materialLine(state)}`);
  const recent = recentMovesLine(state, 6);
  if (recent) lines.push(`Recent moves: ${recent}`);
  if (state.check) lines.push("You are IN CHECK — your move must get your king out of check.");
  return lines.join("\n");
}

function buildInstructions(sanList: string[]): string {
  return (
    `Legal moves (SAN): ${sanList.join(", ")}\n` +
    `Call chess_move with exactly ONE of these strings as "san" — copy it verbatim. ` +
    `Any other move is illegal and a fallback move will be chosen for you.`
  );
}

/** Hand-free board summary for injecting game awareness into other (free-chat) prompts. */
function buildSpectatorSummary(state: ChessState): string {
  const white = nameOf(state, state.whiteSeatId);
  const black = nameOf(state, state.blackSeatId);
  if (state.status === "finished") {
    const lines: string[] = [];
    if (state.winnerSeatId) {
      const winner = nameOf(state, state.winnerSeatId);
      const loser = state.winnerSeatId === state.whiteSeatId ? black : white;
      lines.push(`The chess game just finished — ${winner} defeated ${loser} by checkmate.`);
    } else if (state.drawReason) {
      lines.push(
        `The chess game between ${white} (white) and ${black} (black) just ended in a draw by ${drawReasonText(state.drawReason)}.`,
      );
    } else {
      lines.push(`The chess game between ${white} and ${black} just ended.`);
    }
    const plays = recentPlayLines(state, 6);
    if (plays.length) lines.push("How it ended:", ...plays);
    return lines.join("\n");
  }
  const lines: string[] = [
    `A game of chess is in progress at the table: ${white} (white) vs ${black} (black), move ${moveNumberFromFen(state.fen)}.`,
    materialLine(state),
  ];
  if (state.lastMove) lines.push(`Last move: ${nameOf(state, state.lastMove.seatId)} played ${state.lastMove.san}.`);
  const toMove = seatForColor(state, sideToMove(state));
  lines.push(`${nameOf(state, toMove)} is thinking about their move${state.check ? " — and is in check" : ""}.`);
  return lines.join("\n");
}

// ── deterministic fallback ──────────────────────────────────────────────────

/** A deterministic, never-embarrassing legal move: mate-in-1 > best capture > check > first
 * in SAN order. Pure in the state (probes run on the local replay instance). */
function pickFallback(state: ChessState): ChessMove {
  const c = replay(state);
  const moves = [...c.moves({ verbose: true })].sort((a, b) => (a.san < b.san ? -1 : a.san > b.san ? 1 : 0));
  if (moves.length === 0) {
    // Unreachable while the game is active; a rejectable sentinel keeps the contract total.
    return { type: "move", san: "" };
  }
  for (const m of moves) {
    c.move(m.san);
    const mate = c.isCheckmate();
    c.undo();
    if (mate) return toChessMove(m);
  }
  let bestCapture: Move | null = null;
  for (const m of moves) {
    if (!m.captured) continue;
    if (!bestCapture || (PIECE_VALUES[m.captured] ?? 0) > (PIECE_VALUES[bestCapture.captured ?? ""] ?? 0)) {
      bestCapture = m;
    }
  }
  if (bestCapture) return toChessMove(bestCapture);
  const check = moves.find((m) => m.san.includes("+"));
  if (check) return toChessMove(check);
  return toChessMove(moves[0]!);
}

// ── the engine object ───────────────────────────────────────────────────────

export const chessEngine: TurnGameEngine<ChessState, ChessMove, ChessConfig, ChessPublicView> = {
  gameType: "chess",
  schemaVersion: 1,
  label: "Chess",
  minPlayers: CHESS_MIN_PLAYERS,
  maxPlayers: CHESS_MAX_PLAYERS,

  defaultConfig() {
    return { ...DEFAULT_CHESS_CONFIG };
  },

  normalizeConfig(config) {
    const direct = chessConfigSchema.safeParse(config);
    if (direct.success) return direct.data;
    const merged = { ...DEFAULT_CHESS_CONFIG, ...(config && typeof config === "object" ? (config as object) : {}) };
    const reparsed = chessConfigSchema.safeParse(merged);
    return reparsed.success ? reparsed.data : { ...DEFAULT_CHESS_CONFIG };
  },

  setup(config, seats: Seat[], seed) {
    const humanSeat = seats.find((s) => s.kind === "human") ?? seats[0]!;
    const otherSeat = seats.find((s) => s.seatId !== humanSeat.seatId) ?? seats[seats.length - 1]!;
    const humanIsWhite =
      config.humanColor === "white" ? true : config.humanColor === "black" ? false : Math.abs(seed) % 2 === 0;
    const whiteSeat = humanIsWhite ? humanSeat : otherSeat;
    const blackSeat = humanIsWhite ? otherSeat : humanSeat;

    const seatNames: Record<string, string> = {};
    for (const s of seats) seatNames[s.seatId] = s.displayName;

    const state: ChessState = {
      config,
      sanHistory: [],
      fen: new Chess().fen(),
      whiteSeatId: whiteSeat.seatId,
      blackSeatId: blackSeat.seatId,
      seatNames,
      seats: seats.map((s) => ({ seatId: s.seatId, displayName: s.displayName, kind: s.kind })),
      status: "active",
      winnerSeatId: null,
      drawReason: null,
      check: false,
      seed,
      lastMove: null,
      lastAction: null,
      log: [],
    };

    record(state, {
      type: "game_started",
      message: `${whiteSeat.displayName} has the white pieces, ${blackSeat.displayName} has black. ${whiteSeat.displayName} moves first.`,
    });
    return state;
  },

  currentSeat(state) {
    return state.status === "finished" ? null : seatForColor(state, sideToMove(state));
  },

  interruptibleSeats() {
    return [];
  },

  legalMoves(state, seatId) {
    return enumerateLegalMoves(state, seatId);
  },

  applyMove(state, seatId, move): MoveResult<ChessState, ChessMove> {
    if (state.status === "finished") {
      return { ok: false, error: "The game is already over.", legalMoves: [] };
    }
    if (seatForColor(state, sideToMove(state)) !== seatId) {
      return { ok: false, error: "It's not your turn.", legalMoves: [] };
    }
    if (!move || move.type !== "move") {
      return { ok: false, error: "Unknown move.", legalMoves: enumerateLegalMoves(state, seatId) };
    }

    const c = replay(state);
    const made = tryApply(c, move);
    if (!made) {
      return {
        ok: false,
        error: `Illegal move "${describeAttempt(move)}". Choose one of the legal moves.`,
        legalMoves: replay(state).moves({ verbose: true }).map(toChessMove),
      };
    }

    const s = clone(state);
    const events: GameEvent[] = [];
    s.sanHistory.push(made.san);
    s.fen = c.fen();
    s.check = c.inCheck();
    s.lastMove = { from: made.from, to: made.to, san: made.san, seatId };
    setLast(s, seatId, `plays ${made.san}`);

    events.push({
      type: "move_played",
      seatId,
      message: moveFlavor(s, seatId, made),
      data: {
        san: made.san,
        from: made.from,
        to: made.to,
        ...(made.captured ? { captured: made.captured } : {}),
        ...(made.promotion ? { promotion: made.promotion } : {}),
      },
    });

    const opponentSeatId = seatId === s.whiteSeatId ? s.blackSeatId : s.whiteSeatId;
    if (c.isCheckmate()) {
      s.status = "finished";
      s.winnerSeatId = seatId;
      events.push({
        type: "checkmate",
        seatId,
        message: `Checkmate! ${nameOf(s, seatId)} defeats ${nameOf(s, opponentSeatId)}.`,
      });
      events.push({ type: "game_over", seatId, message: `${nameOf(s, seatId)} wins the chess game.` });
    } else if (c.isStalemate()) {
      s.status = "finished";
      s.drawReason = "stalemate";
    } else if (c.isThreefoldRepetition()) {
      s.status = "finished";
      s.drawReason = "threefold_repetition";
    } else if (c.isInsufficientMaterial()) {
      s.status = "finished";
      s.drawReason = "insufficient_material";
    } else if (c.isDraw()) {
      // Stalemate / repetition / material are handled above, so this is the fifty-move rule.
      s.status = "finished";
      s.drawReason = "fifty_move_rule";
    } else if (s.check) {
      events.push({ type: "check", seatId: opponentSeatId, message: `${nameOf(s, opponentSeatId)} is in check!` });
    }

    if (s.drawReason) {
      events.push({ type: "draw", message: `The game is a draw by ${drawReasonText(s.drawReason)}.` });
      events.push({ type: "game_over", message: "The chess game ends in a draw." });
    }

    for (const e of events) record(s, e);
    return { ok: true, state: s, events };
  },

  isTerminal(state): TerminalResult {
    return state.status === "finished"
      ? { done: true, ...(state.winnerSeatId ? { winnerSeatId: state.winnerSeatId } : {}) }
      : { done: false };
  },

  describeForModel(state, seatId): ModelTurnView<ChessMove> {
    const c = replay(state);
    const isYourTurn = state.status !== "finished" && seatForColor(state, sideToMove(state)) === seatId;
    const legal = isYourTurn ? c.moves({ verbose: true }) : [];
    return {
      boardSummary: buildBoardSummary(state, seatId, c),
      legalMoves: legal.map(toChessMove),
      // The runner injects ONLY boardSummary + instructions into the move prompt,
      // so the legal SAN list must ride here or the model plays blind.
      instructions: buildInstructions(legal.map((m) => m.san)),
    };
  },

  spectatorSummary(state): string {
    return buildSpectatorSummary(state);
  },

  publicView(state, viewerSeatId): ChessPublicView {
    const c = replay(state);
    const currentSeatId = state.status === "finished" ? null : seatForColor(state, sideToMove(state));
    const seats: ChessPublicSeat[] = state.seats.map((s) => ({
      seatId: s.seatId,
      displayName: s.displayName,
      color: colorOfSeat(state, s.seatId) ?? "white",
      kind: s.kind,
      isCurrent: currentSeatId === s.seatId,
    }));

    const capturedByWhite: ChessPieceLetter[] = [];
    const capturedByBlack: ChessPieceLetter[] = [];
    for (const m of c.history({ verbose: true })) {
      if (!m.captured) continue;
      if (m.color === "w") capturedByWhite.push(m.captured as ChessPieceLetter);
      else capturedByBlack.push(m.captured as ChessPieceLetter);
    }

    const legalMovesForYou =
      viewerSeatId && viewerSeatId === currentSeatId
        ? c.moves({ verbose: true }).map((m) => ({
            from: m.from as string,
            to: m.to as string,
            san: m.san,
            ...(m.promotion ? { promotion: m.promotion as PromotionPiece } : {}),
          }))
        : [];

    return {
      gameType: "chess",
      status: state.status,
      fen: state.fen,
      board: c
        .board()
        .map((row) => row.map((sq) => (sq ? { type: sq.type as ChessPieceLetter, color: sq.color } : null))),
      seats,
      currentSeatId,
      winnerSeatId: state.winnerSeatId,
      drawReason: state.drawReason,
      yourSeatId: viewerSeatId,
      yourColor: viewerSeatId ? colorOfSeat(state, viewerSeatId) : null,
      check: state.check,
      lastMove: state.lastMove,
      legalMovesForYou,
      capturedByWhite,
      capturedByBlack,
      sanHistory: [...state.sanHistory],
      moveNumber: moveNumberFromFen(state.fen),
      lastAction: state.lastAction,
      config: state.config,
      recentLog: state.log.slice(-8),
    };
  },

  pickFallbackMove(state) {
    return pickFallback(state);
  },

  toolManifests() {
    return [...CHESS_TOOL_MANIFESTS];
  },

  parseToolCall(name, args) {
    if (name !== "chess_move") return null;
    const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v.trim() : undefined);
    const san = str(args.san) ?? str(args.move) ?? str(args.notation);
    const from = str(args.from);
    const to = str(args.to);
    const promotionRaw = str(args.promotion)?.toLowerCase();
    const promotion =
      promotionRaw && ["q", "r", "b", "n"].includes(promotionRaw.charAt(0))
        ? (promotionRaw.charAt(0) as PromotionPiece)
        : undefined;
    // Best-effort: an empty/garbage call still returns a move that applyMove will
    // reject, so the runner's deterministic fallback kicks in (per the contract).
    return {
      type: "move",
      ...(san ? { san } : {}),
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
      ...(promotion ? { promotion } : {}),
    };
  },
};
