// ──────────────────────────────────────────────
// Turn-Game Runner (game-agnostic)
// ──────────────────────────────────────────────
// Bridges the pure turn-game engines (packages/shared) to the server: resolves
// seats from a conversation chat's participants, persists engine state, and
// applies validated moves. Bot-seat generation (the LLM narration loop) is
// layered on top of this in the generation pipeline; this module is the
// deterministic core used by both the REST routes and that loop.
import { getTurnGameEngine, type AnyTurnGameEngine, type Seat } from "@marinara-engine/shared";
import type { DB } from "../../db/connection.js";
import { logger } from "../../lib/logger.js";
import { createChatsStorage } from "../storage/chats.storage.js";
import { createCharactersStorage } from "../storage/characters.storage.js";
import {
  EXPERIENCE_GAME_TYPE_PREFIX,
  createGameEngineStateStorage,
  type GameEngineStateRow,
  type GameEngineVisibleAnchor,
} from "../storage/game-engine-state.storage.js";

// Every turn-game read and wipe excludes the host-owned experience-state namespace (#5102):
// without this, a newer "experience:<id>" row shadows an active turn-game (unknown gameType →
// loadGame null → views/bot loop/commands all see "no game"), and start/resign would silently
// destroy an Experience's entire save history.
const TURN_GAME_SCOPE = { excludePrefix: EXPERIENCE_GAME_TYPE_PREFIX } as const;

export interface TurnGameStartOptions {
  gameType: string;
  config?: unknown;
  /** Which of the chat's characters play (defaults to all). */
  botCharacterIds?: string[];
  /** Explicit seat order by seatId; unspecified seats are appended. */
  seatOrder?: string[];
  /** Whether the human seat goes first (default true). */
  humanFirst?: boolean;
  /** Optional deterministic seed (defaults to random). */
  seed?: number;
}

export interface TurnGameOutcome {
  ok: boolean;
  error?: string;
  view?: unknown;
  events?: unknown[];
  legalMoves?: unknown[];
  finished?: boolean;
  winnerSeatId?: string | null;
  currentSeatId?: string | null;
}

interface LoadedGame {
  row: GameEngineStateRow;
  engine: AnyTurnGameEngine;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  state: any;
}

const HUMAN_FALLBACK_SEAT = "human";
const CHARACTER_FALLBACK_NAME = "Character";

function readTrimmedString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function humanSeatIdFromChat(chat: { personaId: string | null }): string {
  return chat.personaId || HUMAN_FALLBACK_SEAT;
}

async function resolveCharacterName(
  characters: ReturnType<typeof createCharactersStorage>,
  characterId: string,
): Promise<string> {
  try {
    const row = await characters.getById(characterId);
    if (row?.data) {
      try {
        const data = JSON.parse(row.data) as Record<string, unknown>;
        const name =
          readTrimmedString(data.name) ?? readTrimmedString(data.character_name) ?? readTrimmedString(data.displayName);
        if (name) return name;
      } catch {
        // fall through to comment/fallback below
      }
    }
    const comment = readTrimmedString((row as { comment?: unknown } | null)?.comment);
    if (comment) return comment;
  } catch {
    // best-effort — fall through to a displayable fallback
  }
  return CHARACTER_FALLBACK_NAME;
}

async function resolveSeats(
  db: DB,
  chat: { personaId: string | null; characterIds: string },
  opts: TurnGameStartOptions,
): Promise<Seat[]> {
  const personaId = chat.personaId || null;
  const characters = createCharactersStorage(db);

  // The human seat carries the persona's real name so bots reference the player
  // by name (e.g. in board summaries and narration), not the UI-only label "You".
  let humanName = "You";
  if (personaId) {
    try {
      const persona = await characters.getPersona(personaId);
      const name = (persona as { name?: unknown } | null)?.name;
      if (typeof name === "string" && name.trim()) humanName = name.trim();
    } catch {
      // best-effort — fall back to "You"
    }
  }

  const human: Seat = {
    seatId: personaId || HUMAN_FALLBACK_SEAT,
    kind: "human",
    ...(personaId ? { personaId } : {}),
    displayName: humanName,
  };

  let allCharIds: string[] = [];
  try {
    const parsed = JSON.parse(chat.characterIds || "[]");
    if (Array.isArray(parsed)) allCharIds = parsed.filter((x): x is string => typeof x === "string");
  } catch {
    allCharIds = [];
  }

  const botIds =
    opts.botCharacterIds && opts.botCharacterIds.length > 0
      ? opts.botCharacterIds.filter((id) => allCharIds.includes(id))
      : allCharIds;

  const bots: Seat[] = [];
  for (const id of botIds) {
    bots.push({ seatId: id, kind: "bot", characterId: id, displayName: await resolveCharacterName(characters, id) });
  }

  let seats = opts.humanFirst === false ? [...bots, human] : [human, ...bots];

  if (opts.seatOrder && opts.seatOrder.length > 0) {
    const bySeat = new Map(seats.map((s) => [s.seatId, s]));
    const ordered: Seat[] = [];
    for (const id of opts.seatOrder) {
      const seat = bySeat.get(id);
      if (seat) {
        ordered.push(seat);
        bySeat.delete(id);
      }
    }
    for (const seat of bySeat.values()) ordered.push(seat);
    if (ordered.length > 0) seats = ordered;
  }

  return seats;
}

// Local, dependency-free copy of the message `extra` parser (kept local for the same reason as
// resolveTurnGameAnchor: avoid a service -> route-utils dependency). `extra` may be a JSON string or
// an already-parsed object depending on the storage read path.
function parseMessageExtra(extra: unknown): Record<string, unknown> {
  if (!extra) return {};
  try {
    const parsed: unknown = typeof extra === "string" ? JSON.parse(extra) : extra;
    return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

/**
 * The (messageId, swipeIndex) of the latest visible assistant message, so editing,
 * branching, or regenerating a message rewinds the game to that point. Mirrors
 * resolveVisibleGameStateAnchor used by game mode (kept local to avoid a
 * service -> route-utils dependency), including its checkpoint-restore rule: a
 * checkpoint load inserts a `system` message marked `gameStateAnchor: "checkpoint_restore"`
 * onto which restore clones the checkpoint-time engine snapshot, so that message must be
 * an eligible anchor too or the restored game would stay invisible behind the last
 * real assistant message (#5077).
 */
async function resolveTurnGameAnchor(db: DB, chatId: string): Promise<GameEngineVisibleAnchor | null> {
  const messages = (await createChatsStorage(db).listMessages(chatId)) as Array<{
    role?: unknown;
    id?: unknown;
    activeSwipeIndex?: unknown;
    extra?: unknown;
  }>;
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]!;
    const markedRestoreAnchor =
      m.role === "system" && parseMessageExtra(m.extra).gameStateAnchor === "checkpoint_restore";
    if ((m.role !== "assistant" && !markedRestoreAnchor) || typeof m.id !== "string" || !m.id) continue;
    const swipeIndex =
      typeof m.activeSwipeIndex === "number" && Number.isInteger(m.activeSwipeIndex) && m.activeSwipeIndex >= 0
        ? m.activeSwipeIndex
        : 0;
    return { messageId: m.id, swipeIndex };
  }
  return null;
}

/**
 * Load the game for a chat. By default it selects the snapshot anchored to the
 * currently-visible message (so a message edit / branch / regeneration rewinds the
 * authoritative game state), falling back to the latest snapshot. Pass an explicit
 * `anchor` to reuse an already-resolved one; pass `null` to force the latest
 * snapshot and skip the message scan (used where rewind is irrelevant, e.g. the
 * "is a game active" check and the live bot loop).
 */
async function loadGame(db: DB, chatId: string, anchor?: GameEngineVisibleAnchor | null): Promise<LoadedGame | null> {
  const storage = createGameEngineStateStorage(db);
  // Fast path: a chat with no game pays nothing extra (no message scan).
  const latest = await storage.getLatest(chatId, TURN_GAME_SCOPE);
  if (!latest) return null;
  const resolved = anchor === undefined ? await resolveTurnGameAnchor(db, chatId) : anchor;
  const row = resolved
    ? ((await storage.getForGeneration(chatId, { visibleAnchor: resolved, gameType: TURN_GAME_SCOPE })) ?? latest)
    : latest;
  const engine = getTurnGameEngine(row.gameType);
  if (!engine) {
    logger.warn("Active game in chat %s has unknown gameType %s", chatId, row.gameType);
    return null;
  }
  try {
    return { row, engine, state: JSON.parse(row.state) };
  } catch (err) {
    logger.error(err, "Failed to parse game_engine_state for chat %s", chatId);
    return null;
  }
}

async function viewerSeatForChat(db: DB, chatId: string): Promise<string> {
  const chat = await createChatsStorage(db).getById(chatId);
  return chat ? humanSeatIdFromChat(chat) : HUMAN_FALLBACK_SEAT;
}

/** Start a new game in `chatId`. Clears any prior game for the chat. */
export async function startTurnGame(db: DB, chatId: string, opts: TurnGameStartOptions): Promise<TurnGameOutcome> {
  const engine = getTurnGameEngine(opts.gameType);
  if (!engine) return { ok: false, error: `Unknown game type: ${opts.gameType}` };

  const chats = createChatsStorage(db);
  const chat = await chats.getById(chatId);
  if (!chat) return { ok: false, error: "Chat not found." };

  // Turn-games are a conversation-mode feature end to end: the `[uno]` command,
  // the bot-turn generate gating, and the board UI all key off conversation mode.
  // Starting one in another mode would create a game that can't be advanced and
  // would leave stale game_engine_state rows behind, so reject it up front.
  if (chat.mode !== "conversation") {
    return { ok: false, error: "Turn-games can only be started in conversation mode." };
  }

  const seats = await resolveSeats(db, chat, opts);
  if (seats.length < engine.minPlayers) {
    return { ok: false, error: `${engine.label} needs at least ${engine.minPlayers} players (got ${seats.length}).` };
  }
  if (seats.length > engine.maxPlayers) {
    return { ok: false, error: `${engine.label} allows at most ${engine.maxPlayers} players (got ${seats.length}).` };
  }

  const config = engine.normalizeConfig(opts.config ?? engine.defaultConfig());
  const seed = Number.isFinite(opts.seed) ? Number(opts.seed) : Math.floor(Math.random() * 0x7fffffff);

  let state: unknown;
  try {
    state = engine.setup(config, seats, seed);
  } catch (err) {
    logger.error(err, "Turn-game setup failed for chat %s (%s)", chatId, opts.gameType);
    return { ok: false, error: "Failed to set up the game." };
  }

  const storage = createGameEngineStateStorage(db);
  await storage.deleteForChat(chatId, TURN_GAME_SCOPE);
  await storage.create({
    chatId,
    messageId: "",
    swipeIndex: 0,
    gameType: engine.gameType,
    schemaVersion: engine.schemaVersion,
    state: JSON.stringify(state),
    committed: true,
  });

  const viewer = humanSeatIdFromChat(chat);
  const terminal = engine.isTerminal(state);
  return {
    ok: true,
    view: engine.publicView(state, viewer),
    finished: terminal.done,
    winnerSeatId: terminal.winnerSeatId ?? null,
    currentSeatId: engine.currentSeat(state),
  };
}

/** Apply a move for `seatId` (defaults to the human seat). */
export async function applyTurnGameMove(
  db: DB,
  chatId: string,
  rawMove: unknown,
  seatId?: string,
): Promise<TurnGameOutcome> {
  // Resolve the visible anchor once: it both selects the state to mutate (so play
  // continues from a rewound point after an edit/branch) and anchors the resulting
  // snapshot to the latest visible message, so a later read — or a regeneration of
  // the following turn — resolves to this move's state.
  const anchor = await resolveTurnGameAnchor(db, chatId);
  const loaded = await loadGame(db, chatId, anchor);
  if (!loaded) return { ok: false, error: "No active game in this chat." };
  const { row, engine, state } = loaded;

  const viewer = seatId ?? (await viewerSeatForChat(db, chatId));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = engine.applyMove(state, viewer, rawMove as any);

  if (!result.ok) {
    return {
      ok: false,
      error: result.error,
      legalMoves: result.legalMoves,
      view: engine.publicView(state, viewer),
      currentSeatId: engine.currentSeat(state),
    };
  }

  let nextState = result.state;
  let events = result.events;
  const nextSeatId = engine.currentSeat(nextState);
  if (engine.gameType === "rock-paper-scissors" && nextSeatId && nextSeatId !== viewer) {
    const botMove = engine.pickFallbackMove(nextState, nextSeatId);
    const botResult = engine.applyMove(nextState, nextSeatId, botMove);
    if (botResult.ok) {
      nextState = botResult.state;
      events = [...(events ?? []), ...(botResult.events ?? [])];
    }
  }

  const storage = createGameEngineStateStorage(db);
  const serialized = JSON.stringify(nextState);
  if (anchor?.messageId) {
    // Anchor to the latest visible assistant message so this state is what a read
    // (or a regenerate of the following turn) resolves to.
    await storage.create({
      chatId,
      messageId: anchor.messageId,
      swipeIndex: anchor.swipeIndex,
      gameType: engine.gameType,
      schemaVersion: engine.schemaVersion,
      state: serialized,
      committed: true,
    });
  } else if (row.messageId === "") {
    // No assistant message yet (e.g. the human plays first) — keep a single live row.
    await storage.updateStateById(row.id, serialized, true, row.chatId);
  } else {
    await storage.create({
      chatId,
      messageId: "",
      swipeIndex: 0,
      gameType: engine.gameType,
      schemaVersion: engine.schemaVersion,
      state: serialized,
      committed: true,
    });
  }

  const terminal = engine.isTerminal(nextState);
  return {
    ok: true,
    view: engine.publicView(nextState, viewer),
    events,
    finished: terminal.done,
    winnerSeatId: terminal.winnerSeatId ?? null,
    currentSeatId: engine.currentSeat(nextState),
  };
}

/** Read-only board view for a viewer (defaults to the human seat). */
export async function getTurnGameView(db: DB, chatId: string, seatId?: string): Promise<unknown | null> {
  const loaded = await loadGame(db, chatId);
  if (!loaded) return null;
  const { engine, state } = loaded;
  const viewer = seatId ?? (await viewerSeatForChat(db, chatId));
  return engine.publicView(state, viewer);
}

/**
 * True when an unfinished game exists for the chat (for tool-scoping / autonomous
 * suppression / the live bot loop). Uses the latest snapshot directly — rewind is
 * irrelevant here, and skipping the message scan keeps the hot paths cheap.
 */
export async function getActiveTurnGame(db: DB, chatId: string): Promise<LoadedGame | null> {
  const loaded = await loadGame(db, chatId, null);
  if (!loaded) return null;
  return loaded.engine.isTerminal(loaded.state).done ? null : loaded;
}

/**
 * Load the chat's latest game snapshot regardless of terminal status — unlike
 * `getActiveTurnGame`, this returns a FINISHED game too. Used by the bot-turn
 * loop's post-loop announcement drain: a showdown/game_over event queued by the
 * last bot move needs to be voiced even though the game is now finished (at
 * which point `getActiveTurnGame` would return null and hide it).
 */
export async function loadTurnGameForDrain(db: DB, chatId: string): Promise<LoadedGame | null> {
  return loadGame(db, chatId, null);
}

/**
 * Load the chat's game once and return a per-seat context builder for it, so a
 * multi-character generation pays the game load (message-anchor scan + state
 * parse) once per request instead of once per responding character. Returns
 * null when no game row exists. The builder tells conversation bots about the
 * table's game so their free-chat replies are game-aware — covering both an
 * in-progress game AND one that just finished (until it's dismissed). When
 * `seatId` is one of the game's seats, the block is built from that seat's own
 * perspective (their hand / color / last move); any other viewer gets the
 * hand-free spectator text.
 */
export async function getTurnGameContextBuilder(
  db: DB,
  chatId: string,
): Promise<((seatId?: string | null) => string | null) | null> {
  const loaded = await loadGame(db, chatId);
  if (!loaded) return null;
  return (seatId?: string | null): string | null => {
    try {
      // Both engines keep seatNames keyed by seatId (the bot runner relies on the
      // same shape), so this is the cheap game-agnostic "is this viewer seated" test.
      const seated = Boolean(seatId && loaded.state?.seatNames?.[seatId]);
      const summary = seated
        ? loaded.engine.participantSummary(loaded.state, seatId!)
        : loaded.engine.spectatorSummary(loaded.state);
      if (!summary) return null;
      const finished = loaded.engine.isTerminal(loaded.state).done;
      const guidance = finished
        ? `The game is over. Stay fully in character; you may talk about how it went — react to the result, ` +
          `tease the winner, lament a bad beat, call for a rematch — drawing on the moves above. ` +
          `Don't restate these stats verbatim.`
        : seated
          ? loaded.engine.hiddenInformation
            ? `You are seated in this game — it is YOUR game: you know exactly what you played and how your hand feels. ` +
              `You may bring up your own moves, react to opponents' plays, gloat, sulk, or bluff like a real player. ` +
              `Your hand is PRIVATE — keeping it hidden is part of playing, and everyone can see how many cards you hold ` +
              `but not what they are. Whether you deflect, tease, bluff, lie, or carelessly let something slip when asked ` +
              `about your hand is up to your personality — a sharp player gives nothing away. Never recite these stats ` +
              `verbatim, and never reveal other players' hidden information.`
            : `You are seated in this game — it is YOUR game, and the board is open for everyone to see, so you may ` +
              `discuss the position and your own moves as freely as suits your character. Your PLANS, though, are ` +
              `the one thing your opponent cannot see — whether you share them honestly, deflect, or bluff and ` +
              `misdirect about your intentions when asked is up to your personality; a sharp player keeps them ` +
              `close. Never recite these stats verbatim.`
          : `You are at this table. Stay fully in character; you may reference the game naturally when it's relevant, ` +
            `but never restate these stats verbatim and never reveal anyone's specific cards.`;
      return `${summary}\n${guidance}`;
    } catch (err) {
      logger.warn(err, "Failed to build turn-game context text for chat %s", chatId);
      return null;
    }
  };
}

/**
 * One-shot convenience wrapper over getTurnGameContextBuilder for single-seat
 * callers (and tests). Prefer the builder when injecting for several
 * characters in one request.
 */
export async function getTurnGameContextText(db: DB, chatId: string, seatId?: string | null): Promise<string | null> {
  const build = await getTurnGameContextBuilder(db, chatId);
  return build ? build(seatId) : null;
}

/** End and remove the game for a chat. Experience-state rows are not the runner's to destroy. */
export async function resignTurnGame(db: DB, chatId: string): Promise<void> {
  await createGameEngineStateStorage(db).deleteForChat(chatId, TURN_GAME_SCOPE);
}
