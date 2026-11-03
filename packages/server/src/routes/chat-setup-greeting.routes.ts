// ──────────────────────────────────────────────
// Routes: Setup-stage opening ("scene") for a roleplay chat that has not started
// ──────────────────────────────────────────────
import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import { LOCAL_SIDECAR_CONNECTION_ID, readChatFollowsMain, readChatModelOverride } from "@marinara-engine/shared";
import { isDebugAgentsEnabled } from "../config/runtime-config.js";
import { logDebugOverride, logger } from "../lib/logger.js";
import { resolveChatConnectionOrFallback } from "../services/generation/connection-resolution.js";
import { createLLMProvider } from "../services/llm/provider-registry.js";
import { getLocalSidecarProvider } from "../services/llm/local-sidecar.js";
import type { ChatMessage, ChatOptions } from "../services/llm/base-provider.js";
import { createChatsStorage } from "../services/storage/chats.storage.js";
import { createConnectionsStorage } from "../services/storage/connections.storage.js";
import { chatHasStarted } from "./chats.routes.js";
import { forwardPromptPreview } from "./generate/prompt-preview.js";
import { resolveBaseUrl } from "./generate/generate-route-utils.js";

const bodySchema = z
  .object({
    mode: z.enum(["line", "surprise", "continue"]),
    idea: z.string().trim().max(500).optional(),
    debugMode: z.boolean().optional(),
  })
  .strict()
  .refine((body) => body.mode !== "line" || !!body.idea, { message: "A scene idea is required", path: ["idea"] });

/** Messages of the earlier chat a "continue" opening picks up from. */
const CONTINUE_TAIL_MESSAGES = 20;
const CONTINUE_TAIL_CHARS = 1500;
const MAX_GREETING_TOKENS = 4096;
/** Earlier chats looked at before giving up on a recap. */
const MAX_RECAP_CANDIDATES = 10;

function parseMeta(value: unknown): Record<string, unknown> {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** Hosted rooms have their own broadcast and generation policy; a solo write here would split host and guests. */
function isRoomChat(meta: Record<string, unknown>): boolean {
  return !!meta.multiplayer || meta.multiplayerSetup === true;
}

/** The client maps `code` to its own localized text; `error` is only for logs and API readers. */
function fail(reply: FastifyReply, status: number, code: string, error: string) {
  return reply.status(status).send({ error, code });
}

function parseIds(value: unknown): string[] {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export async function chatSetupGreetingRoutes(app: FastifyInstance) {
  const chats = createChatsStorage(app.db);
  const connections = createConnectionsStorage(app.db);

  /** What happened in this character's most recent earlier solo chat: its stored summary, else its last messages. */
  async function recapOfLastChat(chatId: string, characterIds: string[]): Promise<string | null> {
    const overlap = new Set(characterIds);
    const earlier = (await chats.list())
      .filter((c) => c.id !== chatId && c.mode === "roleplay" && parseIds(c.characterIds).some((id) => overlap.has(id)))
      .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    let scanned = 0;
    for (const candidate of earlier) {
      const meta = parseMeta(candidate.metadata);
      if (isRoomChat(meta)) continue;
      if (++scanned > MAX_RECAP_CANDIDATES) break;
      // Only the tail is read; a played chat has a user turn in it.
      const tail = await chats.listMessagesPaginated(candidate.id, CONTINUE_TAIL_MESSAGES);
      if (!tail.some((m) => m.role === "user")) continue;
      if (typeof meta.summary === "string" && meta.summary.trim()) return meta.summary.trim();
      const days = Object.entries(parseMeta(meta.daySummaries))
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-7)
        .map(([, entry]) => (entry as { summary?: unknown })?.summary)
        .filter((text): text is string => typeof text === "string" && !!text.trim());
      if (days.length) return days.join("\n");
      return tail
        .map((m) => `${m.role === "user" ? "User" : "Character"}: ${m.content.slice(0, CONTINUE_TAIL_CHARS)}`)
        .join("\n\n");
    }
    return null;
  }

  // Replaces the stage greeting with a freshly written one. The old greetings stay as the other swipes, so the
  // Opening picker can switch back.
  app.post<{ Params: { id: string } }>("/:id/setup-greeting", async (req, reply) => {
    const body = bodySchema.safeParse(req.body ?? {});
    if (!body.success) return fail(reply, 400, "invalid-request", "Invalid request");

    const chat = await chats.getById(req.params.id);
    if (!chat) return fail(reply, 404, "not-found", "Chat not found");
    if (chat.mode !== "roleplay") return fail(reply, 400, "not-roleplay", "Only roleplay chats have a setup stage");
    if (isRoomChat(parseMeta(chat.metadata))) return fail(reply, 409, "room-chat", "Room chats keep their own opening");
    const messages = await chats.listMessages(chat.id);
    if (chatHasStarted(messages, chat.metadata, chat.mode))
      return fail(reply, 409, "started", "This chat has already started");
    const greeting = messages.find((m) => m.role === "assistant");
    if (!greeting) return fail(reply, 400, "no-greeting", "This chat has no opening message to replace");

    let recap: string | null = null;
    if (body.data.mode === "continue") {
      recap = await recapOfLastChat(chat.id, parseIds(chat.characterIds));
      if (!recap) return fail(reply, 400, "no-earlier-chat", "There is no earlier chat with this character");
    }

    // Same Model rules as a normal turn: the chat's own Model (or its catalog pick), a random-pool draw, or Main.
    let connectionId = chat.connectionId || null;
    if (connectionId === "random") {
      const pool = await connections.listRandomPool();
      if (!pool.length) return fail(reply, 400, "no-model", "No connections are marked for the random pool");
      connectionId = pool[Math.floor(Math.random() * pool.length)]!.id;
    }
    const conn = await resolveChatConnectionOrFallback(
      connections,
      connectionId,
      undefined,
      readChatModelOverride(chat),
      readChatFollowsMain(chat),
    );
    if (!conn) return fail(reply, 400, "no-model", "No API connection configured for this chat");
    const baseUrl = resolveBaseUrl(conn);
    if (!baseUrl) return fail(reply, 400, "no-model", "No base URL configured for this connection");

    // The assembled prompt a real turn would send: card, persona, preset, lorebooks, macros resolved. Plain
    // history, as a real turn sends it: the preview's XML wrapping of the last message is a preview-only shim.
    const preview = await forwardPromptPreview(app, req, {
      chatId: chat.id,
      connectionId: conn.id,
      wrapLastMessage: false,
    });
    const assembled = preview.body.prompt?.messages;
    if (preview.statusCode >= 400 || !assembled?.length) {
      logger.error("[setup-greeting] Prompt preview failed for chat %s (status %d)", chat.id, preview.statusCode);
      return fail(reply, 502, "generation-failed", "The opening could not be written");
    }

    const brief = {
      line: `The user describes the scene they want to start in: "${body.data.idea}". Write the opening message of the roleplay set in that scene.`,
      surprise:
        "Invent a fresh, specific opening scene that suits the character and the world above. Do not repeat the opening message above.",
      continue: `Pick up where the last chat with this character left off. What happened so far:\n${recap}\n\nWrite the opening message of a new session that follows on from it.`,
    }[body.data.mode];
    const instruction = `${brief}\n\nWrite only the character's opening message, in the same voice, format and language as the existing opening message above. Do not speak or act for the user. Do not add notes or XML tags.`;
    const prompt = [...(assembled as ChatMessage[])];
    const lastTurn = prompt.at(-1);
    // Strict providers reject (or merge) two user turns in a row, and some presets already end on one.
    if (lastTurn?.role === "user")
      prompt[prompt.length - 1] = { ...lastTurn, content: `${lastTurn.content}\n\n${instruction}` };
    else prompt.push({ role: "user", content: instruction });

    const debug = body.data.debugMode === true || isDebugAgentsEnabled();
    logDebugOverride(
      debug,
      "[setup-greeting] prompt for chat %s (%s / %s):\n%s",
      chat.id,
      conn.provider,
      conn.model,
      JSON.stringify(prompt, null, 2),
    );

    const provider =
      conn.id === LOCAL_SIDECAR_CONNECTION_ID
        ? getLocalSidecarProvider()
        : createLLMProvider(
            conn.provider,
            baseUrl,
            conn.apiKey,
            conn.maxContext,
            conn.openrouterProvider,
            conn.maxTokensOverride,
            conn.claudeFastMode === "true",
            conn.treatAsLocalEndpoint === "true",
            conn.defaultParameters,
            conn.id,
          );
    // The preset's sampling and reasoning settings, as the generate route applies them. The Model, token cap and
    // abort signal are ours; the rest is preview bookkeeping.
    const {
      provider: _provider,
      model: _model,
      showThoughts: _show,
      assistantPrefill: _prefill,
      ...sampling
    } = (preview.body.parameters ?? {}) as Record<string, unknown>;
    const abort = new AbortController();
    // The request stream is already closed once the body is read; the reply is what notices the client leaving.
    reply.raw.on("close", () => {
      if (!reply.raw.writableFinished) abort.abort();
    });
    try {
      const sampled = sampling as Partial<ChatOptions>;
      const result = await provider.chatComplete(prompt, {
        ...sampled,
        model: conn.model,
        temperature: sampled.temperature ?? 1,
        maxTokens: Math.min(sampled.maxTokens ?? 2048, MAX_GREETING_TOKENS),
        signal: abort.signal,
      });
      const text = (result.content ?? "").trim();
      logDebugOverride(debug, "[setup-greeting] response for chat %s:\n%s", chat.id, text);
      if (!text) {
        logger.warn("[setup-greeting] Empty opening for chat %s", chat.id);
        return fail(reply, 502, "generation-failed", "The opening could not be written");
      }
      // The first message may have been sent while the model was writing; do not swap a started chat's greeting.
      const latest = await chats.getById(chat.id);
      if (!latest || chatHasStarted(await chats.listMessages(chat.id), latest.metadata, latest.mode)) {
        return fail(reply, 409, "started", "This chat has already started");
      }
      // Non-silent: the new swipe becomes the shown one and the earlier greetings stay as swipes.
      const swipe = await chats.addSwipe(greeting.id, text, false);
      return { messageId: greeting.id, swipeIndex: swipe.index, content: text };
    } catch (err) {
      if (abort.signal.aborted) return reply;
      logger.error(err, "[setup-greeting] Generation failed for chat %s", chat.id);
      return fail(reply, 502, "generation-failed", "The opening could not be written");
    }
  });
}
