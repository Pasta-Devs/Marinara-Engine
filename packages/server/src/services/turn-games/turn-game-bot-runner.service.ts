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
import type { DB } from "../../db/connection.js";
import { logger } from "../../lib/logger.js";
import type { BaseLLMProvider, ChatMessage, LLMToolDefinition } from "../llm/base-provider.js";
import { createLLMProvider } from "../llm/provider-registry.js";
import { trySendSseEvent } from "../../routes/generate/sse.js";
import { createCharactersStorage } from "../storage/characters.storage.js";
import { createChatsStorage } from "../storage/chats.storage.js";
import { createGameEngineStateStorage } from "../storage/game-engine-state.storage.js";
import { getActiveTurnGame } from "./turn-game-runner.service.js";

const MAX_BOT_TURNS = 100;
const HUMAN_FALLBACK_SEAT = "human";

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

    const active = await getActiveTurnGame(db, chatId);
    if (!active) break; // no game, or game finished
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
          `${persona}\n\nYou are playing a friendly game of ${engine.label}. Choose exactly ONE legal move by calling the matching tool. ` +
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
          `Hard rules: do NOT reveal your hand or any hidden information, do NOT recite the board state, and do NOT explain the rules or your strategy. Just talk.`,
      },
      ...(recent ? [{ role: "user" as const, content: `Recent table talk:\n${recent}` }] : []),
      { role: "user", content: `(You just ${did}.) Say your one line.` },
    ];
    const res = await provider.chatComplete(messages, { model, temperature: 0.9, maxTokens: 100, ...(signal ? { signal } : {}) });
    return (res.content ?? "").trim();
  } catch {
    return "";
  }
}
