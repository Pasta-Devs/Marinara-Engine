// ──────────────────────────────────────────────
// Routes: Magic Rewrite
//
// Generates AI-assisted rewrites of editor text
// using the user's instruction. Falls back through
// the existing default chat/agent connections.
// ──────────────────────────────────────────────
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { PROVIDERS } from "@marinara-engine/shared";
import { createConnectionsStorage } from "../services/storage/connections.storage.js";
import { createLLMProvider } from "../services/llm/provider-registry.js";
import type { ChatMessage } from "../services/llm/base-provider.js";
import { logger } from "../lib/logger.js";

const magicRewriteSchema = z.object({
  text: z.string().default(""),
  instruction: z.string().default(""),
});

const REWRITE_SYSTEM_PROMPT = `You are a rewriting assistant for roleplay, fiction, and worldbuilding content.
Rewrite or generate the requested text according to the user's instructions.
Return ONLY the rewritten text — no explanations, no markdown fences, no preamble.`;

function resolveBaseUrl(conn: { provider: string; baseUrl: string | null }): string {
  if (conn.baseUrl) return conn.baseUrl;
  if (conn.provider === "claude_subscription") return "claude-agent-sdk://local";
  if (conn.provider === "openai_chatgpt") return "openai-chatgpt://codex-auth";
  const providerDef = PROVIDERS[conn.provider as keyof typeof PROVIDERS];
  return providerDef?.defaultBaseUrl ?? "";
}

export async function magicRewriteRoutes(app: FastifyInstance) {
  const connections = createConnectionsStorage(app.db);

  app.post("/generate", async (req, reply) => {
    const parsed = magicRewriteSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid request", details: parsed.error.issues });
    }
    const input = parsed.data;

    // Resolve connection: default chat → default agent
    const defaultChat = await connections.getDefault();
    const conn = defaultChat
      ? await connections.getWithKey(defaultChat.id)
      : await connections.getDefaultForAgents();

    if (!conn) {
      return reply.status(400).send({ error: "No default agent connection configured" });
    }

    if (conn.provider === "image_generation") {
      return reply.status(400).send({ error: "Default connection is an image generation provider" });
    }

    const baseUrl = resolveBaseUrl(conn);
    if (!baseUrl) {
      return reply.status(400).send({ error: "No base URL configured for the default connection" });
    }

    const hasSourceText = input.text.trim().length > 0;
    const instruction = input.instruction.trim() || (hasSourceText ? "Improve this text while preserving its meaning." : "Generate suitable content.");

    const messages: ChatMessage[] = [
      { role: "system", content: REWRITE_SYSTEM_PROMPT },
      {
        role: "user",
        content: hasSourceText
          ? `Instruction:\n${instruction}\n\n---\n\nText to rewrite:\n${input.text}`
          : `Instruction:\n${instruction}\n\n---\n\nNo source text was provided; generate new content from the instruction.`,
      },
    ];

    try {
      const provider = createLLMProvider(
        conn.provider,
        baseUrl,
        conn.apiKey,
        conn.maxContext,
        conn.openrouterProvider,
        conn.maxTokensOverride,
        conn.claudeFastMode === "true",
      );

      const result = await provider.chatComplete(messages, {
        model: conn.model,
        temperature: 0.7,
        maxTokens: 4000,
        stream: false,
        enableCaching: conn.enableCaching === "true",
        cachingAtDepth: conn.cachingAtDepth,
      });

      return { text: result.content?.trim() ?? "", finishReason: result.finishReason, usage: result.usage ?? null };
    } catch (error) {
      logger.error(error, "Magic Rewrite generation failed");
      return reply.status(500).send({ error: "Magic Rewrite generation failed" });
    }
  });
}
