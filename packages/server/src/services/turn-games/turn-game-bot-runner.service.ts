// ──────────────────────────────────────────────
// Turn-Game Bot Runner (LLM narration + auto-play)
// ──────────────────────────────────────────────
// Drives the bot seats of an active turn-game, one at a time in engine seat
// order, until it becomes the human's turn or the game ends. Each bot:
//   1. is shown the engine-authored board + legal moves,
//   2. proposes a move via a restricted tool call (validated by the engine;
//      an illegal/missing move falls back to a deterministic legal move so a
//      bot can never stall the table),
//   3. narrates the engine-confirmed outcome in character.
// State + narration are persisted per move; group_turn / message_saved /
// turn_game_state_patch SSE events stream into the client's open generate request.
//
// Invoked from the /api/generate handler ONLY when input.turnGameBots is set,
// so it can never affect a normal conversation/roleplay generation.
import type { FastifyReply } from "fastify";
import { BUILT_IN_THINKING_TAG_PAIRS } from "@marinara-engine/shared";
import type { DB } from "../../db/connection.js";
import { logDebugOverride, logger } from "../../lib/logger.js";
import { isDebugAgentsEnabled } from "../../config/runtime-config.js";
import type { BaseLLMProvider, ChatMessage, LLMToolDefinition } from "../llm/base-provider.js";
import { createLLMProvider } from "../llm/provider-registry.js";
import { extractLeadingThinkingBlocks } from "../llm/inline-thinking.js";
import { trySendSseEvent } from "../../routes/generate/sse.js";
import { createCharactersStorage } from "../storage/characters.storage.js";
import { createChatsStorage } from "../storage/chats.storage.js";
import { createGameEngineStateStorage } from "../storage/game-engine-state.storage.js";
import { getActiveTurnGame, loadTurnGameForDrain } from "./turn-game-runner.service.js";

const MAX_BOT_TURNS = 100;
const HUMAN_FALLBACK_SEAT = "human";

/** The non-null shape `getActiveTurnGame` / `loadTurnGameForDrain` resolve to. */
type ActiveTurnGame = NonNullable<Awaited<ReturnType<typeof getActiveTurnGame>>>;

interface RunBotTurnsArgs {
  db: DB;
  chatId: string;
  // The already-resolved chat connection (decrypted key) + base URL from the generate handler.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  conn?: any;
  baseUrl?: string;
  reply: FastifyReply;
  signal?: AbortSignal;
  /** Test/override hooks — production passes conn+baseUrl and builds the provider here. */
  provider?: BaseLLMProvider;
  model?: string;
}

function truncate(value: unknown, max: number): string {
  const text = typeof value === "string" ? value : "";
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

/** Map a model-supplied display name on a move onto the matching seatId. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveSeatRefs(move: any, state: { seatOrder?: string[]; seatNames: Record<string, string> }): any {
  if (!move || typeof move !== "object") return move;
  const map = (ref: unknown): unknown => {
    if (typeof ref !== "string" || !ref) return ref;
    if (state.seatOrder?.includes(ref)) return ref;
    const lower = ref.toLowerCase();
    for (const [seatId, name] of Object.entries(state.seatNames)) {
      if (String(name).toLowerCase() === lower) return seatId;
    }
    return ref;
  };
  if ((move.type === "play" || move.type === "play_drawn") && move.swapTargetSeatId) {
    return { ...move, swapTargetSeatId: map(move.swapTargetSeatId) };
  }
  if (move.type === "call_out" && move.targetSeatId) {
    return { ...move, targetSeatId: map(move.targetSeatId) };
  }
  return move;
}

async function buildPersonaBlock(
  characters: ReturnType<typeof createCharactersStorage>,
  seatId: string,
  fallbackName: string,
): Promise<string> {
  try {
    const row = await characters.getById(seatId);
    if (row?.data) {
      const data = JSON.parse(row.data) as { name?: unknown; description?: unknown; personality?: unknown };
      const name = typeof data.name === "string" && data.name.trim() ? data.name.trim() : fallbackName;
      return [
        `You are ${name}.`,
        data.description ? `About you: ${truncate(data.description, 700)}` : "",
        data.personality ? `Your personality: ${truncate(data.personality, 500)}` : "",
      ]
        .filter(Boolean)
        .join("\n");
    }
  } catch {
    // best-effort persona — fall through
  }
  return `You are ${fallbackName}.`;
}

async function buildRecentContext(
  chats: ReturnType<typeof createChatsStorage>,
  chatId: string,
  seatNames: Record<string, string>,
): Promise<string> {
  try {
    const messages = await chats.listMessages(chatId);
    const tail = messages.slice(-4);
    const lines = tail
      .map((m: { role: string; characterId: string | null; content: string }) => {
        const who = m.role === "user" ? "You" : seatNames[m.characterId ?? ""] ?? "Someone";
        const text = truncate(m.content, 200);
        return text ? `${who}: ${text}` : "";
      })
      .filter(Boolean);
    return lines.join("\n");
  } catch {
    return "";
  }
}

/**
 * Drain any dealer-narration events an engine has queued on `active.state` (e.g.
 * poker's hand-start / street-deal / showdown / blinds-up / game-over milestones)
 * and persist the queue-cleared snapshot. Game-agnostic: engines that don't
 * implement `drainAnnouncements` (UNO, chess) make this a no-op via the optional-
 * method guard below, so nothing about their behavior changes.
 *
 * When the engine names a dealer character (`announcerCharacterId`), the queued
 * events are voiced as ONE short in-character line and persisted as a real
 * assistant message (mirroring the move loop's narration persistence exactly,
 * including its message-save-failure fallback). A silent "house" dealer
 * (`announcerCharacterId` returns null) still drains + persists the state and
 * pushes the board patch — it just never creates a message.
 *
 * STALL-GUARD NOTE: this is called at the very top of every loop iteration,
 * before the loop's `lastSignature` stall-detection signature is computed. That
 * is safe from a live-lock: draining clears `pendingAnnouncements`, which is
 * itself part of the state the signature hashes, so the FIRST drain after a
 * move always changes the signature (queue: [...] -> []) and the loop proceeds
 * normally. `drainAnnouncements` is idempotent once the queue is empty — it
 * returns `null` and this function no-ops — so a second consecutive iteration
 * on the same (already-drained) state reproduces the SAME signature as before,
 * which is exactly what should trip the stall guard for a genuinely stuck seat.
 * Draining can therefore never itself be the cause of an infinite loop; it can
 * only ever make the existing stall guard fire one iteration later than before.
 */
async function drainAndVoiceAnnouncements(args: {
  chatId: string;
  active: ActiveTurnGame;
  humanSeatId: string;
  chats: ReturnType<typeof createChatsStorage>;
  characters: ReturnType<typeof createCharactersStorage>;
  engineStorage: ReturnType<typeof createGameEngineStateStorage>;
  provider: BaseLLMProvider;
  model: string;
  reply: FastifyReply;
  turnIndex: number;
  signal?: AbortSignal;
}): Promise<{ state: unknown } | null> {
  const { chatId, active, humanSeatId, chats, characters, engineStorage, provider, model, reply, turnIndex, signal } = args;
  const { engine, state } = active;

  if (typeof engine.drainAnnouncements !== "function") return null;
  const drained = engine.drainAnnouncements(state);
  if (!drained) return null;

  const { state: nextState, announcements } = drained;
  const eventSummary = announcements
    .map((e: { message?: string }) => e.message)
    .filter(Boolean)
    .join(" ");

  const dealerCharId =
    typeof engine.announcerCharacterId === "function" ? engine.announcerCharacterId(nextState) : null;

  let dealerLine = "";
  if (dealerCharId && eventSummary) {
    const seatNames = (nextState as { seatNames?: Record<string, string> }).seatNames ?? {};
    let fallbackName = seatNames[dealerCharId] ?? dealerCharId;
    if (!seatNames[dealerCharId]) {
      try {
        const row = await characters.getById(dealerCharId);
        if (row?.data) {
          const data = JSON.parse(row.data) as { name?: unknown };
          if (typeof data.name === "string" && data.name.trim()) fallbackName = data.name.trim();
        }
      } catch {
        // best-effort — fall back to the id
      }
    }

    // Whose-turn marker before the voiced dealer line, matching the loop's
    // existing group_turn marker for bot moves.
    trySendSseEvent(reply, {
      type: "group_turn",
      data: { characterId: dealerCharId, characterName: fallbackName, index: turnIndex },
    });

    const persona = await buildPersonaBlock(characters, dealerCharId, fallbackName);
    dealerLine = await narrateAnnouncements(provider, model, persona, engine.label, eventSummary, signal);
  }
  if (!dealerLine) dealerLine = eventSummary;

  if (dealerCharId && dealerLine) {
    const saved = await chats.createMessage({ chatId, role: "assistant", characterId: dealerCharId, content: dealerLine });
    if (saved) {
      await engineStorage.create({
        chatId,
        messageId: saved.id,
        swipeIndex: saved.activeSwipeIndex ?? 0,
        gameType: engine.gameType,
        schemaVersion: engine.schemaVersion,
        state: JSON.stringify(nextState),
        committed: true,
      });
      trySendSseEvent(reply, { type: "message_saved", data: saved });
    } else {
      // Persistence of the dealer message failed — still advance engine state so
      // the queue doesn't grow unbounded and the game keeps moving.
      await engineStorage.create({
        chatId,
        messageId: "",
        swipeIndex: 0,
        gameType: engine.gameType,
        schemaVersion: engine.schemaVersion,
        state: JSON.stringify(nextState),
        committed: true,
      });
    }
  } else {
    // Silent house dealer (or nothing worth saying) — persist the drained state
    // with no message, single-live-row idiom.
    await engineStorage.create({
      chatId,
      messageId: "",
      swipeIndex: 0,
      gameType: engine.gameType,
      schemaVersion: engine.schemaVersion,
      state: JSON.stringify(nextState),
      committed: true,
    });
  }

  // Push the redacted human-perspective board so the client clears
  // hasPendingAnnouncements and sees the drained state live.
  trySendSseEvent(reply, { type: "turn_game_state_patch", data: engine.publicView(nextState, humanSeatId) });
  return { state: nextState };
}

/**
 * Run every pending bot seat for the chat's active turn-game. No-ops if there
 * is no active game or it is currently the human's turn.
 */
export async function runTurnGameBotTurns(args: RunBotTurnsArgs): Promise<void> {
  const { db, chatId, conn, baseUrl, reply, signal } = args;

  const chats = createChatsStorage(db);
  const chat = await chats.getById(chatId);
  if (!chat) return;
  const humanSeatId = chat.personaId || HUMAN_FALLBACK_SEAT;

  const provider =
    args.provider ??
    (conn && baseUrl
      ? createLLMProvider(conn.provider, baseUrl, conn.apiKey, conn.maxContext, conn.openrouterProvider, conn.maxTokensOverride)
      : null);
  if (!provider) {
    logger.warn("[turn-game] no LLM provider available for chat %s; skipping bot turns", chatId);
    return;
  }
  const model = args.model ?? conn?.model ?? "";
  const characters = createCharactersStorage(db);
  const engineStorage = createGameEngineStateStorage(db);

  // Track the prior board so a degenerate engine that stops advancing the seat
  // can't silently burn the whole turn cap (and so we can tell a real "paused at
  // the cap" exit from a normal "handed back to the human" exit below).
  let lastSignature = "";
  let turn = 0;
  for (; turn < MAX_BOT_TURNS; turn++) {
    if (signal?.aborted) break;

    let active = await getActiveTurnGame(db, chatId);
    if (!active) break; // no game, or game finished

    // Drain + voice any dealer announcements queued on this state BEFORE deciding
    // whose turn it is. This must run even when control is about to go straight
    // back to the human — e.g. a street-closing move BY the human queues a
    // "Flop: ..." announcement but leaves currentSeat pointed at the human, so
    // draining here (not after the human-turn break below) is what gets it
    // voiced. See drainAndVoiceAnnouncements' doc comment for why this can't
    // create a live-lock with the stall guard below.
    const drained = await drainAndVoiceAnnouncements({
      chatId,
      active,
      humanSeatId,
      chats,
      characters,
      engineStorage,
      provider,
      model,
      reply,
      turnIndex: turn,
      signal,
    });
    if (drained) active = { ...active, state: drained.state };

    const { engine, state } = active;
    const seatId = engine.currentSeat(state);
    if (!seatId || seatId === humanSeatId) break; // hand control back to the human

    // Defensive stop: if the board is byte-identical to the previous iteration,
    // the engine isn't advancing (a fallback move should always change state).
    // Break rather than spin the rest of the cap on a stuck seat.
    const signature = JSON.stringify(state);
    if (signature === lastSignature) {
      logger.warn("[turn-game] board not advancing for chat %s (seat %s still to act); stopping bot loop", chatId, seatId);
      break;
    }
    lastSignature = signature;

    const seatName = state.seatNames?.[seatId] ?? seatId;

    // Announce whose turn it is (reuses the established multi-actor marker).
    // Non-critical marker — use the swallowing variant so a client disconnect
    // can't throw and abort the bot-turn loop (matches the other emits below).
    trySendSseEvent(reply, { type: "group_turn", data: { characterId: seatId, characterName: seatName, index: turn } });

    // ── Ask the bot for a move ──
    const view = engine.describeForModel(state, seatId);
    const tools: LLMToolDefinition[] = engine.toolManifests().map((t) => ({
      type: "function",
      function: { name: t.name, description: t.description, parameters: t.parameters as unknown as Record<string, unknown> },
    }));
    const persona = await buildPersonaBlock(characters, seatId, seatName);
    const recent = await buildRecentContext(chats, chatId, state.seatNames ?? {});

    const moveMessages: ChatMessage[] = [
      {
        role: "system",
        content:
          `${persona}\n\nYou are playing a friendly game of ${engine.label}. Choose exactly ONE legal move by calling the matching tool.\n` +
          `Play AS this character, not as a game engine: let your personality, mood, and skill decide the move. ` +
          `A bold or hot-headed character attacks and takes risks; a cautious one plays safe and holds strong cards back; ` +
          `a cunning one sets traps and saves the best play for the perfect moment; a playful or scatterbrained one may ` +
          `pick a whimsical, suboptimal move. Grudges and table talk matter too — it is perfectly in character to target ` +
          `whoever just wronged you. When several legal moves are reasonable, pick the one THIS character would actually ` +
          `choose, not necessarily the objectively strongest.\n` +
          `Never invent cards or board state. Follow the tool descriptions and the board instructions exactly. ` +
          `Call the tool ONLY — do not write any words, reasoning, or narration; your spoken reaction is handled separately.`,
      },
      { role: "system", content: `${view.boardSummary}\n\n${view.instructions ?? ""}` },
      ...(recent ? [{ role: "user" as const, content: `Recent table talk:\n${recent}` }] : []),
      { role: "user", content: "It's your turn. Make your move now by calling a tool." },
    ];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let proposed: any = null;
    try {
      const res = await provider.chatComplete(moveMessages, {
        model,
        tools,
        temperature: 0.6,
        maxTokens: 220,
        ...(signal ? { signal } : {}),
      });
      // Take the first tool call the engine recognizes. Engine-agnostic: no per-game
      // tool-name list — parseToolCall returns null for any tool the engine doesn't own.
      for (const call of res.toolCalls) {
        let parsedArgs: Record<string, unknown> = {};
        try {
          parsedArgs = JSON.parse(call.function.arguments || "{}");
        } catch {
          parsedArgs = {};
        }
        const raw = engine.parseToolCall(call.function.name, parsedArgs);
        if (raw) {
          proposed = resolveSeatRefs(raw, state);
          break;
        }
      }
    } catch (err) {
      if (signal?.aborted) break;
      logger.warn(err, "[turn-game] bot %s move generation failed; using fallback", seatId);
    }

    // ── Apply (engine-authoritative) with deterministic fallback ──
    let applied = proposed ? engine.applyMove(state, seatId, proposed) : { ok: false as const };
    if (!applied || !applied.ok) {
      const fallback = engine.pickFallbackMove(state, seatId);
      applied = engine.applyMove(state, seatId, fallback);
    }
    if (!applied || !applied.ok) {
      logger.error("[turn-game] no legal move for bot %s in chat %s; aborting bot loop", seatId, chatId);
      break;
    }

    const nextState = applied.state;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const events: Array<{ message?: string }> = (applied.events as any) ?? [];
    const eventSummary = events
      .map((e) => e.message)
      .filter(Boolean)
      .join(" ");

    // ── Narration: a natural in-character turn — may banter with the table AND flavor the move ──
    let narration = await narrateOutcome(provider, model, persona, seatName, engine.label, eventSummary, recent, signal);
    if (!narration) narration = eventSummary || `${seatName} makes a move.`;

    // ── Persist narration message + per-message engine snapshot ──
    const saved = await chats.createMessage({ chatId, role: "assistant", characterId: seatId, content: narration });
    if (saved) {
      await engineStorage.create({
        chatId,
        messageId: saved.id,
        swipeIndex: saved.activeSwipeIndex ?? 0,
        gameType: engine.gameType,
        schemaVersion: engine.schemaVersion,
        state: JSON.stringify(nextState),
        committed: true,
      });
      trySendSseEvent(reply, { type: "message_saved", data: saved });
    } else {
      // Persistence of the message failed — still advance engine state so the game continues.
      await engineStorage.create({
        chatId,
        messageId: "",
        swipeIndex: 0,
        gameType: engine.gameType,
        schemaVersion: engine.schemaVersion,
        state: JSON.stringify(nextState),
        committed: true,
      });
    }

    // Push the redacted human-perspective board so the client updates live.
    trySendSseEvent(reply, { type: "turn_game_state_patch", data: engine.publicView(nextState, humanSeatId) });
  }

  // Final drain: a showdown/game_over (or any other) announcement queued by the
  // LAST bot move in the loop above never gets its own top-of-loop iteration —
  // once the game finishes, `getActiveTurnGame` returns null and the loop breaks
  // BEFORE draining; an aborted signal can likewise break the loop right after a
  // queueing move was persisted. Load unconditionally (finished games included,
  // via loadTurnGameForDrain) and drain once more so nothing is left stranded in
  // the queue. Idempotent/cheap when there's nothing to drain.
  const finalActive = await loadTurnGameForDrain(db, chatId);
  if (finalActive) {
    await drainAndVoiceAnnouncements({
      chatId,
      active: finalActive,
      humanSeatId,
      chats,
      characters,
      engineStorage,
      provider,
      model,
      reply,
      turnIndex: turn,
      signal,
    });
  }

  // Reaching the cap (rather than handing control back / finishing / aborting)
  // means a bot is still on seat after MAX_BOT_TURNS consecutive bot moves —
  // effectively unreachable in real UNO (a finite deck can't skip the human that
  // many times in a row). Surface it instead of stalling silently. We deliberately
  // do NOT auto-retrigger another bot generate here: that would reintroduce the
  // unbounded cross-request loop the cap exists to bound. The human can resume the
  // game with any move, which re-fires the bot loop through the normal path.
  if (turn >= MAX_BOT_TURNS && !signal?.aborted) {
    logger.warn(
      "[turn-game] bot loop hit MAX_BOT_TURNS (%d) for chat %s with a bot still to act; pausing until the human plays",
      MAX_BOT_TURNS,
      chatId,
    );
  }
}

/**
 * Reasoning models can emit their chain-of-thought inline in `content` (e.g. a
 * leading `<think>` block) instead of a provider-native thinking channel. The
 * generation pipeline strips these before persisting; narration must too, or
 * the reasoning gets saved verbatim as the character's table talk. When the
 * closing tag never arrived (maxTokens ran out mid-thought), extraction leaves
 * the opening tag at the front — everything after it is reasoning, so the line
 * is unusable and we return "" to let the caller's fallback run.
 * Exported for tests.
 */
export function stripInlineThinking(raw: string): string {
  const trimmed = extractLeadingThinkingBlocks(raw).content.trim();
  const lower = trimmed.toLocaleLowerCase();
  if (BUILT_IN_THINKING_TAG_PAIRS.some((pair) => lower.startsWith(pair.open.toLocaleLowerCase()))) return "";
  return trimmed;
}

async function narrateOutcome(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  provider: any,
  model: string,
  persona: string,
  name: string,
  gameLabel: string,
  eventSummary: string,
  recent: string,
  signal?: AbortSignal,
): Promise<string> {
  const did = eventSummary.startsWith(`${name} `) ? eventSummary.slice(name.length + 1) : eventSummary || "made your move";
  try {
    const messages: ChatMessage[] = [
      {
        role: "system",
        content:
          `${persona}\n\n` +
          `You are playing ${gameLabel} with friends. Speak ONE short, natural line as ${name}, fully in character. ` +
          `You may react to the table talk and/or to your own move — like a real person at the table (a quip, a taunt, a groan, a little flourish). ` +
          `Hard rules: do NOT reveal your hand or any hidden information, do NOT recite the board state, and do NOT explain the rules or your strategy. ` +
          `Reply with the spoken line ONLY — no reasoning, no preamble, no notes about what you are doing. Just talk.`,
      },
      ...(recent ? [{ role: "user" as const, content: `Recent table talk:\n${recent}` }] : []),
      { role: "user", content: `(You just ${did}.) Say your one line.` },
    ];
    // maxTokens leaves headroom for reasoning models that think before the line;
    // stripInlineThinking removes what they emit inline.
    const res = await provider.chatComplete(messages, { model, temperature: 0.9, maxTokens: 300, ...(signal ? { signal } : {}) });
    return stripInlineThinking(res.content ?? "");
  } catch {
    return "";
  }
}

/** Voice a batch of queued dealer-announcement events as ONE short in-character line. */
async function narrateAnnouncements(
  provider: BaseLLMProvider,
  model: string,
  persona: string,
  gameLabel: string,
  eventSummary: string,
  signal?: AbortSignal,
): Promise<string> {
  try {
    const messages: ChatMessage[] = [
      {
        role: "system",
        content:
          `${persona}\n\n` +
          `You are the dealer at this table's game of ${gameLabel}. Announce the following to the table in ONE ` +
          `short line, fully in character — you may add flourish, teasing, or ceremony, but every fact below must ` +
          `come through accurately. Reply with the announcement ONLY — no reasoning, no preamble. Facts: ${eventSummary}`,
      },
    ];
    // Prompt visibility for the new dealer-narration call: honors DEBUG_AGENTS
    // (elevated via logDebugOverride so it shows even at the default warn level).
    logDebugOverride(
      isDebugAgentsEnabled(),
      "[turn-game] dealer announcement prompt (model %s): %s",
      model,
      messages[0]?.content ?? "",
    );
    const res = await provider.chatComplete(messages, {
      model,
      temperature: 0.85,
      maxTokens: 300,
      ...(signal ? { signal } : {}),
    });
    return stripInlineThinking(res.content ?? "");
  } catch {
    return "";
  }
}
