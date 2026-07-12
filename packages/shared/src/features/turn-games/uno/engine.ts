// ──────────────────────────────────────────────
// UNO — deterministic engine (server-authoritative)
// ──────────────────────────────────────────────
// Pure functions over UnoState. The single source of truth for legality, turn
// order, and win conditions. The LLM only proposes moves (validated here) and
// narrates the engine-confirmed result; it never enforces rules or shuffles.
// All randomness flows through the seeded RNG so deals replay identically.

import type { GameEvent, ModelTurnView, MoveResult, Seat, TerminalResult, TurnGameEngine } from "../engine.types.js";
import { buildStandardDeck, isWildValue } from "./deck.js";
import { deterministicShuffle } from "./rng.js";
import { UNO_TOOL_MANIFESTS } from "./tools.js";
import {
  DEFAULT_UNO_CONFIG,
  UNO_LOG_CAP,
  UNO_MAX_PLAYERS,
  UNO_MIN_PLAYERS,
  unoConfigSchema,
  type UnoCard,
  type UnoCardFace,
  type UnoColor,
  type UnoConfig,
  type UnoMove,
  type UnoPublicSeat,
  type UnoPublicView,
  type UnoState,
} from "./types.js";

// ── small helpers ───────────────────────────────────────────────────────────

function clone(state: UnoState): UnoState {
  return JSON.parse(JSON.stringify(state)) as UnoState;
}

function cap(s: string): string {
  return s.length ? s[0]!.toUpperCase() + s.slice(1) : s;
}

const VALUE_LABELS: Record<string, string> = {
  skip: "Skip",
  reverse: "Reverse",
  draw2: "Draw Two",
  wild: "Wild",
  wild4: "Wild Draw Four",
};

export function cardLabel(card: UnoCard): string {
  const colorPart = card.color === "wild" ? "" : `${cap(card.color)} `;
  const value = VALUE_LABELS[card.value] ?? card.value;
  return `${colorPart}${value}`.trim();
}

function nameOf(state: UnoState, seatId: string): string {
  return state.seatNames[seatId] ?? seatId;
}

function topCard(state: UnoState): UnoCard | null {
  return state.discardPile.length ? state.discardPile[state.discardPile.length - 1]! : null;
}

function currentSeatId(state: UnoState): string {
  return state.seatOrder[state.turnIndex]!;
}

function stepIndex(state: UnoState, steps: number): number {
  const n = state.seatOrder.length;
  return (((state.turnIndex + state.direction * steps) % n) + n) % n;
}

function advance(state: UnoState, steps = 1): void {
  state.turnIndex = stepIndex(state, steps);
}

/** Resolve a hand card by exact id (board UI) or by face (model tool call). */
function findHandCard(hand: UnoCard[], cardId?: string, face?: UnoCardFace): UnoCard | null {
  if (cardId) return hand.find((c) => c.id === cardId) ?? null;
  if (face) return hand.find((c) => c.color === face.color && c.value === face.value) ?? null;
  return null;
}

/** Playable ignoring any pending draw penalty: matches active color, top value, or is a wild. */
function isNormallyPlayable(card: UnoCard, state: UnoState): boolean {
  const top = topCard(state);
  if (!top) return true;
  if (card.color === "wild") return true;
  if (card.color === state.activeColor) return true;
  if (card.value === top.value) return true;
  return false;
}

/** A draw card that may be stacked onto the current pending penalty (same type only). */
function isStackable(card: UnoCard, state: UnoState): boolean {
  if (state.pendingDraw <= 0 || !state.config.stacking) return false;
  if (state.pendingDrawType === "draw2") return card.value === "draw2";
  if (state.pendingDrawType === "wild4") return card.value === "wild4";
  return false;
}

function record(state: UnoState, event: GameEvent): void {
  state.log.push(event);
  if (state.log.length > UNO_LOG_CAP) state.log.splice(0, state.log.length - UNO_LOG_CAP);
}

function setLast(state: UnoState, seatId: string, summary: string): void {
  state.lastAction = { seatId, summary };
}

function fail(error: string): MoveResult<UnoState, UnoMove> {
  return { ok: false, error, legalMoves: [] };
}

/** Reshuffle the discard (minus its top) back into the draw pile when it runs dry. */
function reshuffleIfEmpty(state: UnoState): void {
  if (state.drawPile.length > 0) return;
  if (state.discardPile.length <= 1) return;
  const top = state.discardPile[state.discardPile.length - 1]!;
  const rest = state.discardPile.slice(0, -1);
  state.drawPile = deterministicShuffle(rest, state.seed, state.rngCursor++);
  state.discardPile = [top];
}

/** Draw up to `n` cards into a seat's hand (reshuffling as needed). Returns what was drawn. */
function drawN(state: UnoState, seatId: string, n: number): UnoCard[] {
  const drawn: UnoCard[] = [];
  const hand = state.hands[seatId];
  if (!hand) return drawn;
  for (let i = 0; i < n; i++) {
    if (state.drawPile.length === 0) reshuffleIfEmpty(state);
    const card = state.drawPile.pop();
    if (!card) break;
    hand.push(card);
    drawn.push(card);
  }
  if (hand.length !== 1) state.mustCallUno[seatId] = false;
  return drawn;
}

function refreshUnoVuln(state: UnoState, seatId: string): void {
  const len = state.hands[seatId]?.length ?? 0;
  state.mustCallUno[seatId] = len === 1 && state.config.unoPenalty > 0;
}

// ── 7-0 effects ──────────────────────────────────────────────────────────────

function applySevenSwap(state: UnoState, seatId: string, targetId: string, events: GameEvent[]): void {
  const a = state.hands[seatId];
  const b = state.hands[targetId];
  if (!a || !b) return;
  state.hands[seatId] = b;
  state.hands[targetId] = a;
  refreshUnoVuln(state, seatId);
  refreshUnoVuln(state, targetId);
  events.push({
    type: "seven_swap",
    seatId,
    message: `${nameOf(state, seatId)} swaps hands with ${nameOf(state, targetId)}.`,
    data: { targetSeatId: targetId },
  });
}

function applyZeroRotate(state: UnoState, events: GameEvent[]): void {
  const order = state.seatOrder;
  const n = order.length;
  const dir = state.direction;
  const oldHands = order.map((s) => state.hands[s]!);
  for (let i = 0; i < n; i++) {
    const fromIdx = (((i - dir) % n) + n) % n;
    state.hands[order[i]!] = oldHands[fromIdx]!;
  }
  for (const s of order) refreshUnoVuln(state, s);
  events.push({ type: "zero_rotate", message: `Everyone passes their hand in the play direction (0 played).` });
}

// ── card effect + turn advancement ────────────────────────────────────────────

function applyCardEffectAndAdvance(
  state: UnoState,
  seatId: string,
  card: UnoCard,
  opts: { swapTargetSeatId?: string },
  events: GameEvent[],
): void {
  switch (card.value) {
    case "skip": {
      const skipped = state.seatOrder[stepIndex(state, 1)]!;
      events.push({ type: "skip", seatId: skipped, message: `${nameOf(state, skipped)} is skipped.` });
      advance(state, 2);
      break;
    }
    case "reverse": {
      state.direction = (state.direction * -1) as 1 | -1;
      events.push({ type: "reverse", message: `Play direction reversed.` });
      // With two players a reverse acts as a skip: the player goes again.
      advance(state, state.seatOrder.length === 2 ? 2 : 1);
      break;
    }
    case "draw2": {
      state.pendingDraw += 2;
      state.pendingDrawType = "draw2";
      advance(state, 1);
      events.push({
        type: "draw_pending",
        seatId: currentSeatId(state),
        message: `${nameOf(state, currentSeatId(state))} now faces +${state.pendingDraw}.`,
      });
      break;
    }
    case "wild4": {
      state.pendingDraw += 4;
      state.pendingDrawType = "wild4";
      advance(state, 1);
      events.push({
        type: "draw_pending",
        seatId: currentSeatId(state),
        message: `${nameOf(state, currentSeatId(state))} now faces +${state.pendingDraw}.`,
      });
      break;
    }
    case "wild": {
      advance(state, 1);
      break;
    }
    case "7": {
      if (state.config.sevenZero && opts.swapTargetSeatId) applySevenSwap(state, seatId, opts.swapTargetSeatId, events);
      advance(state, 1);
      break;
    }
    case "0": {
      if (state.config.sevenZero) applyZeroRotate(state, events);
      advance(state, 1);
      break;
    }
    default: {
      advance(state, 1);
      break;
    }
  }
}

/** Resolve a fully-validated play of `card` from `seatId`. Mutates `state`. */
function applyCardPlay(
  state: UnoState,
  seatId: string,
  card: UnoCard,
  opts: { declaredColor?: UnoColor; sayUno?: boolean; swapTargetSeatId?: string },
  events: GameEvent[],
): MoveResult<UnoState, UnoMove> {
  const hand = state.hands[seatId];
  if (!hand) return fail("You are not seated in this game.");
  const idx = hand.findIndex((c) => c.id === card.id);
  if (idx < 0) return fail("That card isn't in your hand.");

  hand.splice(idx, 1);
  state.discardPile.push(card);
  const isWild = card.color === "wild";
  const newColor: UnoColor = isWild ? opts.declaredColor! : (card.color as UnoColor);
  state.activeColor = newColor;
  const playedLabel = `${cardLabel(card)}${isWild ? ` (color → ${cap(newColor)})` : ""}`;
  events.push({
    type: "card_played",
    seatId,
    message: `${nameOf(state, seatId)} played ${playedLabel}.`,
    data: { card, color: newColor },
  });

  // Win is resolved before any action / 7-0 effect.
  if (hand.length === 0) {
    state.status = "finished";
    state.winnerSeatId = seatId;
    state.mustCallUno[seatId] = false;
    state.drawnCardId = null;
    state.turnCount += 1;
    setLast(state, seatId, `won with ${cardLabel(card)}`);
    events.push({ type: "game_over", seatId, message: `${nameOf(state, seatId)} plays their last card and wins!` });
    return { ok: true, state, events };
  }

  // UNO declaration tracking.
  if (hand.length === 1) {
    if (opts.sayUno) {
      state.mustCallUno[seatId] = false;
      events.push({ type: "uno_called", seatId, message: `${nameOf(state, seatId)} calls UNO!` });
    } else {
      state.mustCallUno[seatId] = state.config.unoPenalty > 0;
    }
  } else {
    state.mustCallUno[seatId] = false;
  }

  applyCardEffectAndAdvance(state, seatId, card, { swapTargetSeatId: opts.swapTargetSeatId }, events);

  state.turnCount += 1;
  state.status = "awaiting_move";
  state.drawnCardId = null;
  setLast(state, seatId, `played ${cardLabel(card)}`);
  return { ok: true, state, events };
}

/** Shared validation for play / play_drawn / jump_in, then resolve. */
function resolvePlay(
  state: UnoState,
  seatId: string,
  card: UnoCard,
  move: Extract<UnoMove, { type: "play" | "play_drawn" | "jump_in" }>,
  events: GameEvent[],
): MoveResult<UnoState, UnoMove> {
  const hand = state.hands[seatId];
  if (!hand) return fail("You are not seated in this game.");
  const isWild = card.color === "wild";
  if (isWild && !move.declaredColor) {
    return fail("Declare a color (red, yellow, green, or blue) when you play a wild card.");
  }
  const willWin = hand.length === 1;
  const swapTargetSeatId = move.type === "play" || move.type === "play_drawn" ? move.swapTargetSeatId : undefined;
  if (state.config.sevenZero && card.value === "7" && !willWin) {
    if (!swapTargetSeatId || swapTargetSeatId === seatId || !state.seatOrder.includes(swapTargetSeatId)) {
      return fail("Playing a 7 (7-0 rule) requires choosing another player to swap hands with.");
    }
  }
  return applyCardPlay(
    state,
    seatId,
    card,
    { declaredColor: move.declaredColor, sayUno: move.sayUno, swapTargetSeatId },
    events,
  );
}

// ── per-move handlers (operate on the already-cloned state) ───────────────────

function handlePlay(
  state: UnoState,
  seatId: string,
  move: Extract<UnoMove, { type: "play" }>,
  events: GameEvent[],
): MoveResult<UnoState, UnoMove> {
  const hand = state.hands[seatId];
  if (!hand) return fail("You are not seated in this game.");
  if (state.status === "awaiting_post_draw") {
    // After a voluntary draw the only playable card is the one just drawn. The
    // model selects by face (color+value), so a hand holding duplicate faces
    // could otherwise resolve to the wrong copy and be rejected — match the
    // request against the drawn card directly and play that exact card.
    const drawn = state.drawnCardId ? hand.find((c) => c.id === state.drawnCardId) : null;
    const matchesDrawn =
      !!drawn &&
      (move.cardId
        ? move.cardId === drawn.id
        : !move.card || (move.card.color === drawn.color && move.card.value === drawn.value));
    if (!drawn || !matchesDrawn) return fail("After drawing you may only play the card you drew, or pass.");
    state.status = "awaiting_move";
    state.drawnCardId = null;
    return resolvePlay(state, seatId, drawn, move, events);
  }

  const card = findHandCard(hand, move.cardId, move.card);
  if (!card) return fail("That card isn't in your hand.");

  if (state.pendingDraw > 0) {
    if (!isStackable(card, state)) {
      const stackHint = state.config.stacking
        ? ` or stack a matching ${state.pendingDrawType === "wild4" ? "Wild Draw Four" : "Draw Two"}`
        : "";
      return fail(`You must resolve the +${state.pendingDraw}: draw it${stackHint}.`);
    }
    return resolvePlay(state, seatId, card, move, events);
  }
  if (!isNormallyPlayable(card, state)) {
    return fail(`${cardLabel(card)} doesn't match the active color (${cap(state.activeColor)}) or the top card.`);
  }
  return resolvePlay(state, seatId, card, move, events);
}

function handlePlayDrawn(
  state: UnoState,
  seatId: string,
  move: Extract<UnoMove, { type: "play_drawn" }>,
  events: GameEvent[],
): MoveResult<UnoState, UnoMove> {
  if (state.status !== "awaiting_post_draw" || !state.drawnCardId) {
    return fail("You can only play a drawn card right after voluntarily drawing.");
  }
  const hand = state.hands[seatId];
  if (!hand) return fail("You are not seated in this game.");
  const card = hand.find((c) => c.id === state.drawnCardId);
  if (!card) return fail("The drawn card is no longer in your hand.");
  if (!isNormallyPlayable(card, state)) return fail("The drawn card isn't playable.");
  state.status = "awaiting_move";
  state.drawnCardId = null;
  return resolvePlay(state, seatId, card, move, events);
}

function handleDraw(state: UnoState, seatId: string, events: GameEvent[]): MoveResult<UnoState, UnoMove> {
  // Calling draw while a penalty is pending resolves the penalty.
  if (state.pendingDraw > 0) return handleDrawPenalty(state, seatId, events);

  let lastDrawn: UnoCard | null = null;
  let playable = false;
  if (state.config.drawToMatch) {
    // Draw until a playable card appears (or both piles are exhausted).
    for (let guard = 0; guard < 200; guard++) {
      const [c] = drawN(state, seatId, 1);
      if (!c) break;
      lastDrawn = c;
      if (isNormallyPlayable(c, state)) {
        playable = true;
        break;
      }
    }
  } else {
    const [c] = drawN(state, seatId, 1);
    lastDrawn = c ?? null;
    playable = !!c && isNormallyPlayable(c, state);
  }

  events.push({
    type: "draw",
    seatId,
    message: `${nameOf(state, seatId)} draws ${state.config.drawToMatch ? "until a playable card" : "a card"}.`,
  });
  setLast(state, seatId, "drew a card");

  if (lastDrawn && playable) {
    state.drawnCardId = lastDrawn.id;
    state.status = "awaiting_post_draw";
    return { ok: true, state, events };
  }
  state.drawnCardId = null;
  state.status = "awaiting_move";
  advance(state, 1);
  state.turnCount += 1;
  return { ok: true, state, events };
}

function handlePass(state: UnoState, _seatId: string, events: GameEvent[]): MoveResult<UnoState, UnoMove> {
  if (state.status !== "awaiting_post_draw") return fail("There's nothing to pass on — play or draw.");
  const drawn = state.drawnCardId ? state.hands[_seatId]?.find((c) => c.id === state.drawnCardId) : null;
  if (state.config.forcePlay && drawn && isNormallyPlayable(drawn, state)) {
    return fail("Force-play is on: you must play the card you just drew.");
  }
  state.drawnCardId = null;
  state.status = "awaiting_move";
  advance(state, 1);
  state.turnCount += 1;
  events.push({ type: "pass", seatId: _seatId, message: `${nameOf(state, _seatId)} keeps the card and passes.` });
  return { ok: true, state, events };
}

function handleDrawPenalty(state: UnoState, seatId: string, events: GameEvent[]): MoveResult<UnoState, UnoMove> {
  if (state.pendingDraw <= 0) return fail("There is no draw penalty to take.");
  const n = state.pendingDraw;
  drawN(state, seatId, n);
  state.pendingDraw = 0;
  state.pendingDrawType = null;
  state.status = "awaiting_move";
  advance(state, 1);
  state.turnCount += 1;
  events.push({ type: "draw", seatId, message: `${nameOf(state, seatId)} draws ${n} card${n === 1 ? "" : "s"}.` });
  setLast(state, seatId, `drew +${n}`);
  return { ok: true, state, events };
}

function handleJumpIn(
  state: UnoState,
  seatId: string,
  move: Extract<UnoMove, { type: "jump_in" }>,
  events: GameEvent[],
): MoveResult<UnoState, UnoMove> {
  if (!state.config.jumpIn) return fail("The jump-in rule is off.");
  if (state.pendingDraw > 0) return fail("You can't jump in while a draw penalty is pending.");
  const hand = state.hands[seatId];
  if (!hand) return fail("You are not seated in this game.");
  const top = topCard(state);
  if (!top) return fail("No card to jump on.");
  const card = findHandCard(hand, move.cardId, move.card);
  if (!card) return fail("That card isn't in your hand.");
  if (card.color === "wild" || card.color !== top.color || card.value !== top.value) {
    return fail("Jump-in requires a card identical to the top card (same color and value).");
  }
  // 7-0: a jump-in can't carry a swap target, so a non-winning 7 jump-in is
  // rejected server-side (it would otherwise skip the mandatory hand swap).
  if (state.config.sevenZero && card.value === "7" && hand.length !== 1) {
    return fail("You can't jump in with a 7 while the 7-0 rule is on.");
  }
  state.turnIndex = state.seatOrder.indexOf(seatId);
  events.push({ type: "jump_in", seatId, message: `${nameOf(state, seatId)} jumps in with ${cardLabel(card)}!` });
  return resolvePlay(state, seatId, card, move, events);
}

function handleCallOut(
  state: UnoState,
  seatId: string,
  move: Extract<UnoMove, { type: "call_out" }>,
  events: GameEvent[],
): MoveResult<UnoState, UnoMove> {
  const target = move.targetSeatId;
  if (target === seatId) return fail("You can't catch yourself.");
  if (!state.seatOrder.includes(target)) return fail("Unknown player.");
  if (!state.mustCallUno[target] || (state.hands[target]?.length ?? 0) !== 1) {
    return fail("That player can't be caught right now.");
  }
  const penalty = state.config.unoPenalty;
  drawN(state, target, penalty);
  state.mustCallUno[target] = false;
  events.push({
    type: "uno_caught",
    seatId: target,
    message: `${nameOf(state, target)} forgot to say UNO and draws ${penalty}! (caught by ${nameOf(state, seatId)})`,
    data: { caughtBy: seatId },
  });
  setLast(state, seatId, `caught ${nameOf(state, target)}`);
  return { ok: true, state, events };
}

function handleDeclareUno(state: UnoState, seatId: string, events: GameEvent[]): MoveResult<UnoState, UnoMove> {
  if ((state.hands[seatId]?.length ?? 0) !== 1) return fail("You can only call UNO when you hold exactly one card.");
  state.mustCallUno[seatId] = false;
  events.push({ type: "uno_called", seatId, message: `${nameOf(state, seatId)} calls UNO!` });
  return { ok: true, state, events };
}

// ── legal-move enumeration ────────────────────────────────────────────────────

const ALL_COLORS: readonly UnoColor[] = ["red", "yellow", "green", "blue"];

/** Append the out-of-turn catch options for `seatId` (available on or off turn). */
function pushCatchMoves(state: UnoState, seatId: string, moves: UnoMove[]): void {
  for (const target of state.seatOrder) {
    if (target !== seatId && state.mustCallUno[target] && (state.hands[target]?.length ?? 0) === 1) {
      moves.push({ type: "call_out", targetSeatId: target });
    }
  }
}

/** Expand a playable card into directly-applicable moves (color variants for wilds, swap targets for 7s). */
function expandPlay(state: UnoState, seatId: string, card: UnoCard, kind: "play" | "play_drawn"): UnoMove[] {
  const out: UnoMove[] = [];
  const isWild = card.color === "wild";
  const willWin = (state.hands[seatId]?.length ?? 0) === 1;
  const needsSwap = state.config.sevenZero && card.value === "7" && !willWin;
  const colorVariants: Array<UnoColor | undefined> = isWild ? [...ALL_COLORS] : [undefined];
  const swapTargets: Array<string | undefined> = needsSwap ? state.seatOrder.filter((s) => s !== seatId) : [undefined];
  for (const declaredColor of colorVariants) {
    for (const swapTargetSeatId of swapTargets) {
      if (kind === "play") {
        out.push({ type: "play", cardId: card.id, declaredColor, swapTargetSeatId });
      } else {
        out.push({ type: "play_drawn", declaredColor, swapTargetSeatId });
      }
    }
  }
  return out;
}

/** Every directly-applicable legal move for `seatId` in the current state. */
function enumerateLegalMoves(state: UnoState, seatId: string): UnoMove[] {
  if (state.status === "finished") return [];
  const moves: UnoMove[] = [];
  const hand = state.hands[seatId] ?? [];
  const isCurrent = currentSeatId(state) === seatId;

  // Standalone UNO declaration (allowed whenever you're at one unsafe card).
  if (hand.length === 1 && state.mustCallUno[seatId]) moves.push({ type: "declare_uno" });

  if (!isCurrent) {
    if (state.config.jumpIn && state.pendingDraw === 0) {
      const top = topCard(state);
      if (top && top.color !== "wild") {
        for (const c of hand) {
          if (c.color !== "wild" && c.color === top.color && c.value === top.value) {
            // A 7 under the 7-0 rule needs a swap target, which a jump-in can't
            // carry — so it's only applicable when it's the winning (last) card.
            if (state.config.sevenZero && c.value === "7" && hand.length !== 1) continue;
            moves.push({ type: "jump_in", cardId: c.id });
          }
        }
      }
    }
    pushCatchMoves(state, seatId, moves);
    return moves;
  }

  if (state.status === "awaiting_post_draw") {
    const drawn = state.drawnCardId ? hand.find((c) => c.id === state.drawnCardId) : undefined;
    const drawnPlayable = !!drawn && isNormallyPlayable(drawn, state);
    if (drawn && drawnPlayable) moves.push(...expandPlay(state, seatId, drawn, "play_drawn"));
    if (!(state.config.forcePlay && drawnPlayable)) moves.push({ type: "pass" });
    pushCatchMoves(state, seatId, moves);
    return moves;
  }

  if (state.pendingDraw > 0) {
    moves.push({ type: "draw_penalty" });
    if (state.config.stacking) {
      for (const c of hand) {
        if (isStackable(c, state)) moves.push(...expandPlay(state, seatId, c, "play"));
      }
    }
  } else {
    for (const c of hand) {
      if (isNormallyPlayable(c, state)) moves.push(...expandPlay(state, seatId, c, "play"));
    }
    moves.push({ type: "draw" });
  }
  pushCatchMoves(state, seatId, moves);
  return moves;
}

// ── fallback bot AI (never stalls; reasonable heuristics) ─────────────────────

function colorCounts(hand: UnoCard[]): Record<UnoColor, number> {
  const counts: Record<UnoColor, number> = { red: 0, yellow: 0, green: 0, blue: 0 };
  for (const c of hand) {
    if (c.color !== "wild") counts[c.color] += 1;
  }
  return counts;
}

function dominantColor(hand: UnoCard[]): UnoColor {
  const counts = colorCounts(hand);
  let best: UnoColor = "red";
  for (const color of ALL_COLORS) {
    if (counts[color] > counts[best]) best = color;
  }
  return best;
}

function cardScore(card: UnoCard): number {
  switch (card.value) {
    case "wild4":
      return 1; // hoard wilds
    case "wild":
      return 2;
    case "draw2":
      return 9;
    case "skip":
      return 8;
    case "reverse":
      return 7;
    default:
      return 5; // number cards
  }
}

function pickFallback(state: UnoState, seatId: string): UnoMove {
  const moves = enumerateLegalMoves(state, seatId);
  const hand = state.hands[seatId] ?? [];

  // Out-of-turn: the only legal moves are optional interrupts — call_out,
  // declare_uno, and jump_in (exactly what enumerateLegalMoves returns here).
  // `draw` is NOT legal out of turn, so never fall back to it. pickFallbackMove
  // must return a *legal* move, so prefer the passive interrupts (catch a
  // careless opponent, then declare if vulnerable), then a jump-in, then any
  // remaining legal move. If there is no legal interrupt the seat simply has
  // nothing to do out of turn; production only requests a fallback for the seat
  // whose turn it is, so the final sentinel is defensive and never reached.
  if (currentSeatId(state) !== seatId) {
    return (
      moves.find((m) => m.type === "call_out") ??
      moves.find((m) => m.type === "declare_uno") ??
      moves.find((m) => m.type === "jump_in") ??
      moves[0] ?? { type: "declare_uno" }
    );
  }

  if (state.status === "awaiting_post_draw") {
    const play = moves.find((m) => m.type === "play_drawn");
    return play ?? moves.find((m) => m.type === "pass") ?? { type: "pass" };
  }

  if (state.pendingDraw > 0) {
    const stack = moves.find((m) => m.type === "play");
    return stack ?? { type: "draw_penalty" };
  }

  // Choose the best play by score; prefer matching the dominant color; declare UNO if going to one.
  const plays = moves.filter((m): m is Extract<UnoMove, { type: "play" }> => m.type === "play");
  if (plays.length > 0) {
    const dom = dominantColor(hand);
    let best = plays[0]!;
    let bestScore = -Infinity;
    for (const move of plays) {
      const card = hand.find((c) => c.id === move.cardId);
      if (!card) continue;
      let score = cardScore(card);
      if (card.color === "wild" && move.declaredColor !== dom) score -= 1; // prefer wild variant that declares dominant color
      if (card.color !== "wild" && card.color === state.activeColor) score += 0.5;
      if (score > bestScore) {
        bestScore = score;
        best = move;
      }
    }
    const goingToOne = hand.length === 2;
    return { ...best, ...(goingToOne ? { sayUno: true } : {}) };
  }

  return moves.find((m) => m.type === "draw") ?? { type: "draw" };
}

// ── prompt + view builders ────────────────────────────────────────────────────

function buildBoardSummary(state: UnoState, seatId: string): string {
  const hand = state.hands[seatId] ?? [];
  const top = topCard(state);
  const lines: string[] = [];
  lines.push(`Top card: ${top ? cardLabel(top) : "—"} — active color is ${cap(state.activeColor)}.`);
  lines.push(`Play direction: ${state.direction === 1 ? "clockwise" : "counter-clockwise"}.`);
  if (state.pendingDraw > 0) {
    lines.push(
      `A +${state.pendingDraw} penalty is stacked on you. Draw it with draw_card` +
        (state.config.stacking
          ? `, or play a matching ${state.pendingDrawType === "wild4" ? "Wild Draw Four" : "Draw Two"} to stack it.`
          : "."),
    );
  }
  lines.push("Table:");
  for (const s of state.seatOrder) {
    const here = s === currentSeatId(state) ? " (your turn)" : "";
    const uno = state.mustCallUno[s] ? " — at 1 card, hasn't said UNO" : "";
    lines.push(`  • ${nameOf(state, s)}: ${state.hands[s]?.length ?? 0} cards${uno}${here}`);
  }
  lines.push(`Your hand: ${hand.length ? hand.map(cardLabel).join(", ") : "(empty)"}.`);
  if (state.status === "awaiting_post_draw" && state.drawnCardId) {
    const drawn = hand.find((c) => c.id === state.drawnCardId);
    if (drawn)
      lines.push(`You just drew ${cardLabel(drawn)} — it's the only card you may play right now (or pass to keep it).`);
  }
  const plays = recentPlayLines(state, 5);
  if (plays.length) lines.push("What just happened:", ...plays);
  return lines.join("\n");
}

function buildInstructions(state: UnoState, seatId: string): string {
  const parts: string[] = [];
  const hand = state.hands[seatId] ?? [];
  if (state.status === "awaiting_post_draw") {
    parts.push(
      "You just drew (see 'You just drew …' above). Either play_card with that exact card or pass_turn to keep it.",
    );
  } else if (state.pendingDraw > 0) {
    parts.push(
      "Resolve the draw penalty: draw_card to take it" +
        (state.config.stacking ? ", or stack a matching draw card with play_card." : "."),
    );
  } else {
    parts.push("Play a legal card with play_card, or draw_card if you cannot or choose not to play.");
  }
  if (hand.length === 2) {
    parts.push("If this play leaves you with one card, set say_uno=true (or call_uno).");
  }
  if (hand.some((card) => card.color === "wild")) {
    const counts = colorCounts(hand);
    const heldColors = ALL_COLORS.filter((color) => counts[color] > 0)
      .map((color) => `${cap(color)} ${counts[color]}`)
      .join(", ");
    parts.push(
      heldColors
        ? `If you play a Wild, choose declared_color from the colored cards left in your hand (${heldColors}); prefer your most-held color, and do not simply repeat the current ${cap(state.activeColor)} unless it is tied for strongest.`
        : "If you play a Wild with no colored cards left, choose any declared_color.",
    );
  }
  parts.push("Then narrate your move briefly, in character.");
  return parts.join(" ");
}

/** The last `max` human-readable game events (excluding the deal), oldest→newest. */
function recentPlayLines(state: UnoState, max: number): string[] {
  return state.log
    .filter((e) => e.type !== "deal" && typeof e.message === "string" && e.message.trim().length > 0)
    .slice(-max)
    .map((e) => `  • ${e.message}`);
}

/** Hand-free board summary for injecting game awareness into other (free-chat) prompts. */
function buildSpectatorSummary(state: UnoState): string {
  if (state.status === "finished") {
    const winner = state.winnerSeatId ? nameOf(state, state.winnerSeatId) : null;
    const standings = [...state.seatOrder]
      .sort((a, b) => (state.hands[a]?.length ?? 0) - (state.hands[b]?.length ?? 0))
      .map((s) => `${nameOf(state, s)} (${state.hands[s]?.length ?? 0} left)`)
      .join(", ");
    const lines: string[] = [
      `The game of UNO just finished${winner ? ` — ${winner} emptied their hand first and won` : ""}.`,
      `Final hands (fewer cards is better): ${standings}.`,
    ];
    const plays = recentPlayLines(state, 6);
    if (plays.length) lines.push("How it played out:", ...plays);
    return lines.join("\n");
  }
  const top = topCard(state);
  const lines: string[] = ["A game of UNO is in progress at the table."];
  lines.push(
    `Top card: ${top ? cardLabel(top) : "—"} (active color: ${cap(state.activeColor)}). ` +
      `Play direction: ${state.direction === 1 ? "clockwise" : "counter-clockwise"}.`,
  );
  if (state.pendingDraw > 0) {
    lines.push(`A +${state.pendingDraw} draw penalty is currently stacked on the next player.`);
  }
  lines.push(
    "Card counts: " +
      state.seatOrder.map((s) => `${nameOf(state, s)} has ${state.hands[s]?.length ?? 0}`).join(", ") +
      ".",
  );
  lines.push(`It is currently ${nameOf(state, currentSeatId(state))}'s turn.`);
  const plays = recentPlayLines(state, 6);
  if (plays.length) lines.push("Recent plays:", ...plays);
  return lines.join("\n");
}

/** Seat-aware variant of the spectator summary: adds the seat's OWN hand and
 * most recent action (it's their information to know); other hands stay hidden. */
function buildParticipantSummary(state: UnoState, seatId: string): string {
  const base = buildSpectatorSummary(state);
  if (!state.seatOrder.includes(seatId)) return base;
  const lines: string[] = [base, `You are ${nameOf(state, seatId)} in this game.`];
  if (state.status !== "finished") {
    const hand = state.hands[seatId] ?? [];
    lines.push(`Your hand (only you can see it): ${hand.length ? hand.map(cardLabel).join(", ") : "(empty)"}.`);
    if (currentSeatId(state) === seatId) lines.push("It is YOUR turn to act.");
  }
  const lastOwn = [...state.log]
    .reverse()
    .find(
      (e) => e.seatId === seatId && e.type !== "deal" && typeof e.message === "string" && e.message.trim().length > 0,
    );
  if (lastOwn) lines.push(`Your most recent action: ${lastOwn.message}`);
  return lines.join("\n");
}

// ── the engine object ──────────────────────────────────────────────────────────

export const unoEngine: TurnGameEngine<UnoState, UnoMove, UnoConfig, UnoPublicView> = {
  gameType: "uno",
  schemaVersion: 1,
  label: "UNO",
  minPlayers: UNO_MIN_PLAYERS,
  maxPlayers: UNO_MAX_PLAYERS,
  hiddenInformation: true,

  defaultConfig() {
    return { ...DEFAULT_UNO_CONFIG };
  },

  normalizeConfig(config) {
    const direct = unoConfigSchema.safeParse(config);
    if (direct.success) return direct.data;
    const merged = { ...DEFAULT_UNO_CONFIG, ...(config && typeof config === "object" ? (config as object) : {}) };
    const reparsed = unoConfigSchema.safeParse(merged);
    return reparsed.success ? reparsed.data : { ...DEFAULT_UNO_CONFIG };
  },

  setup(config, seats: Seat[], seed) {
    const seatOrder = seats.map((s) => s.seatId);
    const seatNames: Record<string, string> = {};
    const hands: Record<string, UnoCard[]> = {};
    const mustCallUno: Record<string, boolean> = {};
    for (const s of seats) {
      seatNames[s.seatId] = s.displayName;
      hands[s.seatId] = [];
      mustCallUno[s.seatId] = false;
    }

    let cursor = 0;
    const drawPile = deterministicShuffle(buildStandardDeck(), seed, cursor++);

    for (let i = 0; i < config.startingHandSize; i++) {
      for (const s of seatOrder) {
        const card = drawPile.pop();
        if (card) hands[s]!.push(card);
      }
    }

    // First discard: take the first non-wild card from the top; wilds slide to the bottom.
    const setAside: UnoCard[] = [];
    let startCard: UnoCard | undefined;
    while (drawPile.length) {
      const card = drawPile.pop()!;
      if (!isWildValue(card.value)) {
        startCard = card;
        break;
      }
      setAside.push(card);
    }
    if (setAside.length) drawPile.unshift(...setAside);
    // Deck always contains plenty of colored cards; this is defensive.
    if (!startCard) startCard = { id: "fallback-red-0", color: "red", value: "0" };

    const state: UnoState = {
      config,
      seatOrder,
      seatNames,
      drawPile,
      discardPile: [startCard],
      activeColor: startCard.color as UnoColor,
      hands,
      turnIndex: 0,
      direction: 1,
      pendingDraw: 0,
      pendingDrawType: null,
      mustCallUno,
      drawnCardId: null,
      status: "awaiting_move",
      seed,
      rngCursor: cursor,
      turnCount: 0,
      lastAction: null,
      log: [],
    };

    // First-card effects (applied to the opening player).
    switch (startCard.value) {
      case "skip":
        state.turnIndex = stepIndex(state, 1);
        break;
      case "reverse":
        state.direction = -1;
        state.turnIndex = seatOrder.length - 1;
        break;
      case "draw2":
        state.pendingDraw = 2;
        state.pendingDrawType = "draw2";
        break;
      default:
        break;
    }

    record(state, {
      type: "deal",
      message: `Dealt ${config.startingHandSize} cards to ${seatOrder.length} players. Opening card: ${cardLabel(startCard)}.`,
    });
    return state;
  },

  currentSeat(state) {
    return state.status === "finished" ? null : currentSeatId(state);
  },

  interruptibleSeats(state) {
    if (state.status === "finished") return [];
    const cur = currentSeatId(state);
    const out: string[] = [];
    for (const s of state.seatOrder) {
      if (s === cur) continue;
      if (enumerateLegalMoves(state, s).some((m) => m.type === "jump_in" || m.type === "call_out")) out.push(s);
    }
    return out;
  },

  legalMoves(state, seatId) {
    return enumerateLegalMoves(state, seatId);
  },

  applyMove(state, seatId, move) {
    if (state.status === "finished") return fail("The game is already over.");
    const s = clone(state);
    const events: GameEvent[] = [];

    let result: MoveResult<UnoState, UnoMove>;
    switch (move.type) {
      case "jump_in":
        result = handleJumpIn(s, seatId, move, events);
        break;
      case "call_out":
        result = handleCallOut(s, seatId, move, events);
        break;
      case "declare_uno":
        result = handleDeclareUno(s, seatId, events);
        break;
      default: {
        if (currentSeatId(s) !== seatId) {
          return { ok: false, error: "It's not your turn.", legalMoves: enumerateLegalMoves(state, seatId) };
        }
        switch (move.type) {
          case "play":
            result = handlePlay(s, seatId, move, events);
            break;
          case "play_drawn":
            result = handlePlayDrawn(s, seatId, move, events);
            break;
          case "draw":
            result = handleDraw(s, seatId, events);
            break;
          case "pass":
            result = handlePass(s, seatId, events);
            break;
          case "draw_penalty":
            result = handleDrawPenalty(s, seatId, events);
            break;
          default:
            result = fail("Unknown move.");
        }
      }
    }

    if (!result.ok) {
      // Recompute the legal set from the untouched original state.
      return { ok: false, error: result.error, legalMoves: enumerateLegalMoves(state, seatId) };
    }
    for (const e of events) record(s, e);
    return { ok: true, state: s, events };
  },

  isTerminal(state): TerminalResult {
    return state.status === "finished"
      ? { done: true, ...(state.winnerSeatId ? { winnerSeatId: state.winnerSeatId } : {}) }
      : { done: false };
  },

  describeForModel(state, seatId): ModelTurnView<UnoMove> {
    // The internal `draw_penalty` move has no model-facing tool: the bot resolves a
    // pending +2/+4 with `draw_card` (-> { type: "draw" }, which handleDraw routes to
    // the penalty). Surface it to the model as `draw` so the legal-move list stays
    // consistent with the available tools and the instruction text. The UI keeps the
    // distinct draw_penalty action via publicView's `yourActions.canDrawPenalty`.
    const legalMoves = enumerateLegalMoves(state, seatId).map((m) =>
      m.type === "draw_penalty" ? ({ type: "draw" } as UnoMove) : m,
    );
    return {
      boardSummary: buildBoardSummary(state, seatId),
      legalMoves,
      instructions: buildInstructions(state, seatId),
    };
  },

  spectatorSummary(state): string {
    return buildSpectatorSummary(state);
  },

  participantSummary(state, seatId): string {
    return buildParticipantSummary(state, seatId);
  },

  publicView(state, viewerSeatId): UnoPublicView {
    const top = topCard(state);
    const seats: UnoPublicSeat[] = state.seatOrder.map((s) => ({
      seatId: s,
      displayName: nameOf(state, s),
      handCount: state.hands[s]?.length ?? 0,
      vulnerable: !!state.mustCallUno[s],
      isCurrent: state.status !== "finished" && currentSeatId(state) === s,
    }));

    let yourHand: UnoPublicView["yourHand"] = [];
    const yourActions = { canDraw: false, canDrawPenalty: false, canPass: false, mustDeclareUno: false };
    const jumpInSet = new Set<string>();
    const catchSet = new Set<string>();

    if (viewerSeatId && state.hands[viewerSeatId]) {
      const moves = enumerateLegalMoves(state, viewerSeatId);
      const playableIds = new Set<string>();
      let drawnPlayable = false;
      for (const m of moves) {
        if (m.type === "play" && m.cardId) playableIds.add(m.cardId);
        else if (m.type === "play_drawn") drawnPlayable = true;
        else if (m.type === "jump_in" && m.cardId) jumpInSet.add(m.cardId);
        else if (m.type === "call_out") catchSet.add(m.targetSeatId);
        else if (m.type === "draw") yourActions.canDraw = true;
        else if (m.type === "draw_penalty") yourActions.canDrawPenalty = true;
        else if (m.type === "pass") yourActions.canPass = true;
      }
      const hand = state.hands[viewerSeatId]!;
      yourHand = hand.map((card) => ({
        card,
        playable:
          playableIds.has(card.id) ||
          (drawnPlayable && state.status === "awaiting_post_draw" && state.drawnCardId === card.id),
      }));
      yourActions.mustDeclareUno = hand.length === 1 && !!state.mustCallUno[viewerSeatId];
    }

    return {
      gameType: "uno",
      status: state.status,
      activeColor: state.activeColor,
      topCard: top,
      direction: state.direction,
      pendingDraw: state.pendingDraw,
      drawPileCount: state.drawPile.length,
      seats,
      currentSeatId: state.status === "finished" ? null : currentSeatId(state),
      winnerSeatId: state.winnerSeatId ?? null,
      yourSeatId: viewerSeatId,
      yourHand,
      yourActions,
      catchableSeatIds: [...catchSet],
      jumpInCardIds: [...jumpInSet],
      lastAction: state.lastAction,
      config: state.config,
      recentLog: state.log.slice(-8),
    };
  },

  pickFallbackMove(state, seatId) {
    return pickFallback(state, seatId);
  },

  toolManifests() {
    return [...UNO_TOOL_MANIFESTS];
  },

  parseToolCall(name, args) {
    const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v.trim() : undefined);
    const face = (): UnoCardFace | undefined => {
      const color = str(args.color);
      const value = str(args.value);
      if (!color || !value) return undefined;
      return { color, value } as UnoCardFace;
    };
    const declared = (): UnoColor | undefined => {
      const c = str(args.declared_color);
      return c === "red" || c === "yellow" || c === "green" || c === "blue" ? c : undefined;
    };
    switch (name) {
      case "play_card":
        return {
          type: "play",
          ...(face() ? { card: face() } : {}),
          ...(declared() ? { declaredColor: declared() } : {}),
          ...(args.say_uno === true ? { sayUno: true } : {}),
          ...(str(args.swap_target) ? { swapTargetSeatId: str(args.swap_target) } : {}),
        };
      case "draw_card":
        return { type: "draw" };
      case "pass_turn":
        return { type: "pass" };
      case "call_uno":
        return { type: "declare_uno" };
      case "catch_uno":
        return { type: "call_out", targetSeatId: str(args.target) ?? "" };
      case "jump_in":
        return { type: "jump_in", ...(face() ? { card: face() } : {}) };
      default:
        return null;
    }
  },
};
