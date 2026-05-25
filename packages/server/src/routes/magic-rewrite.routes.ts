// ──────────────────────────────────────────────
// Routes: Magic Rewrite
// ──────────────────────────────────────────────
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { PROVIDERS } from "@marinara-engine/shared";
import { createConnectionsStorage } from "../services/storage/connections.storage.js";
import { createLLMProvider } from "../services/llm/provider-registry.js";
import type { ChatMessage } from "../services/llm/base-provider.js";

const magicRewriteSchema = z.object({
  text: z.string().default(""),
  instruction: z.string().default(""),
  context: z.string().optional().default(""),
});

const REWRITE_SYSTEM_PROMPT = `You are a rewriting assistant for roleplay, fiction, and worldbuilding content.
Rewrite or generate the requested text according to the user's instructions.
Use any provided character, chat, and lorebook context only as reference for continuity.
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
    const input = magicRewriteSchema.parse(req.body);

    const defaultRewriteConnection = await connections.getDefaultForRewrite();
    const fallbackDefault = defaultRewriteConnection ? null : await connections.getDefault();
    const fallbackAgent = !defaultRewriteConnection && !fallbackDefault ? await connections.getDefaultForAgents() : null;
    const conn = defaultRewriteConnection
      ?? (fallbackDefault ? await connections.getWithKey(fallbackDefault.id) : null)
      ?? fallbackAgent;

    if (!conn) {
      return reply.status(400).send({ error: "No default language model connection configured" });
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

    const userParts = [
      `Instruction:\n${instruction}`,
      input.context.trim() ? `Reference context:\n${input.context.trim()}` : null,
      hasSourceText ? `Text to rewrite:\n${input.text}` : "No source text was provided; generate new content from the instruction and context.",
    ].filter(Boolean);

    const messages: ChatMessage[] = [
      { role: "system", content: REWRITE_SYSTEM_PROMPT },
      { role: "user", content: userParts.join("\n\n---\n\n") },
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
      app.log.error({ err: error }, "Magic Rewrite generation failed");
      const message = error instanceof Error ? error.message : "Magic Rewrite generation failed";
      return reply.status(500).send({ error: message });
    }
  });
}
