// ──────────────────────────────────────────────
// Turn-Game Framework — Engine Contract
// ──────────────────────────────────────────────
// A registry-driven abstraction for deterministic, turn-based games played
// inside a conversation-mode chat (UNO is the first implementation). Each game
// implements `TurnGameEngine` as a set of PURE functions over its own state.
// The engine is the single source of truth for legality, turn order, and win
// conditions; the LLM only proposes moves (validated here) and narrates the
// engine-confirmed outcome. See packages/shared/src/features/turn-games/uno.
//
// Adding a new game = one folder under turn-games/<gameType>/ exporting an
// engine that satisfies this contract, then `pnpm build:shared` regenerates
// the registry. No server route, SSE channel, or DB table changes are needed —
// the runner and persistence layer are game-agnostic.

import type { ToolDefinition } from "../function-calls/tool-definitions.js";

/** Who occupies a seat at the table. */
export type SeatKind = "human" | "bot";

/**
 * A player position. Seats map 1:1 onto conversation participants: the human
 * seat is the active persona; bot seats are the chat's character cards. The
 * dynamic 1-vs-N case is automatic — N is simply the number of bot seats.
 */
export interface Seat {
  /** Stable id. For bots this is the characterId; for the human, the personaId or "human". */
  seatId: string;
  kind: SeatKind;
  /** Character card id (bot seats only). */
  characterId?: string;
  /** Persona id (human seat only). */
  personaId?: string;
  displayName: string;
}

/**
 * A discrete thing that happened during a move, used for (a) the transcript
 * crumb, (b) a narration hint to the LLM, and (c) board animations. Engines
 * emit these from `applyMove`.
 */
export interface GameEvent {
  /** Engine-defined event kind, e.g. "card_played", "skip", "reverse", "draw", "uno_called", "game_over". */
  type: string;
  /** Seat the event is about, when applicable. */
  seatId?: string;
  /** Human-readable one-liner (drives narration + transcript). */
  message: string;
  /** Optional structured payload for the renderer. */
  data?: Record<string, unknown>;
}

/** Result of attempting a move. Engines never throw on illegal input — they return `ok: false`. */
export type MoveResult<TState, TMove> =
  | { ok: true; state: TState; events: GameEvent[] }
  | { ok: false; error: string; legalMoves: TMove[] };

/**
 * What the model is told on a given seat's turn. Engine-authored so prose can
 * never contradict the board: the move is resolved first, then the model is
 * asked only to narrate `boardSummary` + the chosen move.
 */
export interface ModelTurnView<TMove> {
  /** Plain-text board state from this seat's perspective (top card, hand, counts, direction, whose turn). */
  boardSummary: string;
  /** The complete set of legal moves for this seat right now. */
  legalMoves: TMove[];
  /** Extra per-turn guidance appended to the prompt (optional). */
  instructions?: string;
}

/** Terminal-state report. */
export interface TerminalResult {
  done: boolean;
  winnerSeatId?: string;
}

/**
 * The contract every turn-based game implements. Generics:
 *   TState  — the full, server-private game state (persisted as JSON).
 *   TMove   — the discriminated move union.
 *   TConfig — house-rule / setup configuration.
 *   TPublic — the per-viewer redacted state the client board renders.
 *
 * IMPORTANT: every method must be a pure function of its inputs. All randomness
 * flows through the injected seed stored in `TState`, so deals are reproducible
 * and message edits / regenerations rewind correctly.
 */
export interface TurnGameEngine<TState, TMove, TConfig, TPublic = unknown> {
  readonly gameType: string;
  readonly schemaVersion: number;
  readonly label: string;
  readonly minPlayers: number;
  readonly maxPlayers: number;
  /**
   * True when seats hold private information other players must not learn
   * (e.g. UNO hands); false for open-information games (e.g. chess). Drives
   * how freely a seated character may talk about their own position in chat.
   */
  readonly hiddenInformation: boolean;

  /** The default house-rule config (used when the UI sends nothing). */
  defaultConfig(): TConfig;
  /** Normalize / clamp an untrusted config object from the client. */
  normalizeConfig(config: unknown): TConfig;

  /** Deal the opening position. `seed` makes the shuffle reproducible. */
  setup(config: TConfig, seats: Seat[], seed: number): TState;

  /** Whose turn it is, or `null` once the game is finished. */
  currentSeat(state: TState): string | null;

  /** Every legal move for `seatId` in the current state (empty if it isn't their turn / they can't act). */
  legalMoves(state: TState, seatId: string): TMove[];
  /** Apply a move. Returns the next state + events, or an error + the legal set. */
  applyMove(state: TState, seatId: string, move: TMove): MoveResult<TState, TMove>;

  isTerminal(state: TState): TerminalResult;

  /** Prompt surface for the model on `seatId`'s turn. */
  describeForModel(state: TState, seatId: string): ModelTurnView<TMove>;
  /** Render surface for the client. `viewerSeatId === null` = spectator (all hands hidden). */
  publicView(state: TState, viewerSeatId: string | null): TPublic;

  /**
   * A short, hand-free board summary for injecting game awareness into OTHER
   * prompts — e.g. so characters can reference the game naturally when the user
   * chats mid-game. Reveals no private hands.
   */
  spectatorSummary(state: TState): string;

  /**
   * Like `spectatorSummary`, but from `seatId`'s own perspective: includes that
   * seat's OWN private information (their hand, their color, their last move)
   * so a seated character can talk about the game they are actually playing.
   * Other seats' hidden information stays redacted. Must fall back to the
   * spectator text when `seatId` isn't seated in this game.
   */
  participantSummary(state: TState, seatId: string): string;

  /** A deterministic legal move, so a misbehaving bot can never stall the game. */
  pickFallbackMove(state: TState, seatId: string): TMove;

  /** Tool definitions exposed to the model for this game's moves. */
  toolManifests(): ToolDefinition[];
  /**
   * Map a raw tool call (name + parsed args) onto a typed move. Returns `null`
   * if the tool name is not one of this engine's move tools. Invalid args
   * should still return a best-effort move that `applyMove` will reject.
   */
  parseToolCall(name: string, args: Record<string, unknown>): TMove | null;

  /**
   * OPTIONAL. The character that should voice this game's narration events
   * (e.g. a poker dealer announcing blinds and street deals), or `null` for a
   * silent/house narrator. Games without a narrator concept simply omit this
   * method — the runner treats a missing method the same as always returning
   * `null`. Purely a narration hint; it must never affect rules or dealing.
   */
  announcerCharacterId?(state: TState): string | null;

  /**
   * OPTIONAL. Drain any narration events an engine has queued on `state`
   * (e.g. "Hand #3 — blinds 20/40", "Flop: A♥ T♦ 4♣ — pot 240") since they
   * were last drained. Returns `null` when the queue is empty, otherwise the
   * queue-cleared state plus the events, in the order they were queued. The
   * runner calls this after every move and, when `announcerCharacterId` names
   * a character, voices the returned events in that character's persona.
   * Games without queued narration simply omit this method.
   */
  drainAnnouncements?(state: TState): { state: TState; announcements: GameEvent[] } | null;
}

/** A game engine with its generics erased — for registry storage and runner glue. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyTurnGameEngine = TurnGameEngine<any, any, any, any>;

/** The discriminated envelope persisted for any game, so the runner stays game-agnostic. */
export interface TurnGameEnvelope<TState = unknown> {
  gameType: string;
  schemaVersion: number;
  state: TState;
}
