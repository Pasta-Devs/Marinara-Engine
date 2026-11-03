// ──────────────────────────────────────────────
// Routes: Setup-stage opening ("scene") for a roleplay chat that has not started
// ──────────────────────────────────────────────
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { LOCAL_SIDECAR_CONNECTION_ID, readChatFollowsMain, readChatModelOverride } from "@marinara-engine/shared";
import { isDebugAgentsEnabled } from "../config/runtime-config.js";
import { logDebugOverride, logger } from "../lib/logger.js";
import { resolveChatConnectionOrFallback } from "../services/generation/connection-resolution.js";
import { createLLMProvider } from "../services/llm/provider-registry.js";
import { getLocalSidecarProvider } from "../services/llm/local-sidecar.js";
import type { ChatMessage } from "../services/llm/base-provider.js";
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

function parseMeta(value: unknown): Record<string, unknown> {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
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

  /** What happened in this character's most recent earlier chat: its stored summary, else its last messages. */
  async function recapOfLastChat(chatId: string, characterIds: string[]): Promise<string | null> {
    const overlap = new Set(characterIds);
    const earlier = (await chats.list())
      .filter((c) => c.id !== chatId && c.mode === "roleplay" && parseIds(c.characterIds).some((id) => overlap.has(id)))
      .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    for (const candidate of earlier) {
      const messages = await chats.listMessages(candidate.id);
      if (!messages.some((m) => m.role === "user")) continue;
      const meta = parseMeta(candidate.metadata);
      if (typeof meta.summary === "string" && meta.summary.trim()) return meta.summary.trim();
      const days = Object.entries(parseMeta(meta.daySummaries))
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-7)
        .map(([, entry]) => (entry as { summary?: unknown })?.summary)
        .filter((text): text is string => typeof text === "string" && !!text.trim());
      if (days.length) return days.join("\n");
      return messages
        .slice(-CONTINUE_TAIL_MESSAGES)
        .map((m) => `${m.role === "user" ? "User" : "Character"}: ${m.content.slice(0, CONTINUE_TAIL_CHARS)}`)
        .join("\n\n");
    }
    return null;
  }

  // Replaces the stage greeting with a freshly written one. The old greetings stay as the other swipes, so the
  // Opening picker can switch back.
  app.post<{ Params: { id: string } }>("/:id/setup-greeting", async (req, reply) => {
    const body = bodySchema.safeParse(req.body ?? {});
    if (!body.success) return reply.status(400).send({ error: "Invalid request", details: body.error.flatten() });

    const chat = await chats.getById(req.params.id);
    if (!chat) return reply.status(404).send({ error: "Chat not found" });
    if (chat.mode !== "roleplay") return reply.status(400).send({ error: "Only roleplay chats have a setup stage" });
    const messages = await chats.listMessages(chat.id);
    if (chatHasStarted(messages, chat.metadata, chat.mode)) {
      return reply.status(409).send({ error: "This chat has already started" });
    }
    const greeting = messages.find((m) => m.role === "assistant");
    if (!greeting) return reply.status(400).send({ error: "This chat has no opening message to replace" });

    let recap: string | null = null;
    if (body.data.mode === "continue") {
      recap = await recapOfLastChat(chat.id, parseIds(chat.characterIds));
      if (!recap) return reply.status(400).send({ error: "There is no earlier chat with this character" });
    }

    // Same Model rules as a normal turn: the chat's own Model (or its catalog pick), a random-pool draw, or Main.
    let connectionId = chat.connectionId || null;
    if (connectionId === "random") {
      const pool = await connections.listRandomPool();
      if (!pool.length) return reply.status(400).send({ error: "No connections are marked for the random pool" });
      connectionId = pool[Math.floor(Math.random() * pool.length)]!.id;
    }
    const conn = await resolveChatConnectionOrFallback(
      connections,
      connectionId,
      undefined,
      readChatModelOverride(chat),
      readChatFollowsMain(chat),
    );
    if (!conn) return reply.status(400).send({ error: "No API connection configured for this chat" });
    const baseUrl = resolveBaseUrl(conn);
    if (!baseUrl) return reply.status(400).send({ error: "No base URL configured for this connection" });

    // The assembled prompt a real turn would send: card, persona, preset, lorebooks, macros resolved.
    const preview = await forwardPromptPreview(app, req, { chatId: chat.id });
    const assembled = preview.body.prompt?.messages;
    if (preview.statusCode >= 400 || !assembled?.length) {
      return reply.status(502).send({ error: "The opening could not be prepared" });
    }

    const brief = {
      line: `The user describes the scene they want to start in: "${body.data.idea}". Write the opening message of the roleplay set in that scene.`,
      surprise:
        "Invent a fresh, specific opening scene that suits the character and the world above. Do not repeat the opening message above.",
      continue: `Pick up where the last chat with this character left off. What happened so far:\n${recap}\n\nWrite the opening message of a new session that follows on from it.`,
    }[body.data.mode];
    const prompt = [
      ...(assembled as ChatMessage[]),
      {
        role: "user" as const,
        content: `${brief}\n\nWrite only the character's opening message, in the same voice, format and language as the existing opening message above. Do not speak or act for the user. Do not add notes.`,
      },
    ];

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
    const params = preview.body.parameters ?? {};
    const abort = new AbortController();
    // The request stream is already closed once the body is read; the reply is what notices the client leaving.
    reply.raw.on("close", () => {
      if (!reply.raw.writableFinished) abort.abort();
    });
    try {
      const result = await provider.chatComplete(prompt, {
        model: conn.model,
        temperature: typeof params.temperature === "number" ? params.temperature : 1,
        maxTokens: Math.min(typeof params.maxTokens === "number" ? params.maxTokens : 2048, MAX_GREETING_TOKENS),
        signal: abort.signal,
      });
      const text = (result.content ?? "").trim();
      logDebugOverride(debug, "[setup-greeting] response for chat %s:\n%s", chat.id, text);
      if (!text) return reply.status(502).send({ error: "The model returned an empty opening" });
      // Non-silent: the new swipe becomes the shown one and the earlier greetings stay as swipes.
      const swipe = await chats.addSwipe(greeting.id, text, false);
      return { messageId: greeting.id, swipeIndex: swipe.index, content: text };
    } catch (err) {
      if (abort.signal.aborted) return reply;
      logger.error(err, "[setup-greeting] Generation failed for chat %s", chat.id);
      return reply.status(502).send({ error: err instanceof Error ? err.message : "Generation failed" });
    }
  });
}
