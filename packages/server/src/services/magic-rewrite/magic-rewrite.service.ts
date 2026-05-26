import { PROVIDERS } from "@marinara-engine/shared";
import { z } from "zod";
import type { DB } from "../../db/connection.js";
import type { ChatMessage } from "../llm/base-provider.js";
import { createLLMProvider } from "../llm/provider-registry.js";
import { createConnectionsStorage } from "../storage/connections.storage.js";

export const magicRewriteSchema = z.object({
  text: z.string().default(""),
  instruction: z.string().default(""),
});

export type MagicRewriteInput = z.infer<typeof magicRewriteSchema>;

export type MagicRewriteResult = {
  text: string;
  finishReason: string | null | undefined;
  usage: unknown;
};

export class MagicRewriteConfigError extends Error {
  readonly statusCode = 400;
}

const REWRITE_SYSTEM_PROMPT = `You are a rewriting assistant for roleplay, fiction, and worldbuilding content.
Rewrite or generate the requested text according to the user's instructions.
Return ONLY the rewritten text -- no explanations, no markdown fences, no preamble.`;

function resolveBaseUrl(conn: { provider: string; baseUrl: string | null }): string {
  if (conn.baseUrl) return conn.baseUrl;
  if (conn.provider === "claude_subscription") return "claude-agent-sdk://local";
  if (conn.provider === "openai_chatgpt") return "openai-chatgpt://codex-auth";
  const providerDef = PROVIDERS[conn.provider as keyof typeof PROVIDERS];
  return providerDef?.defaultBaseUrl ?? "";
}

function buildRewriteMessages(input: MagicRewriteInput): ChatMessage[] {
  const hasSourceText = input.text.trim().length > 0;
  const instruction =
    input.instruction.trim() ||
    (hasSourceText ? "Improve this text while preserving its meaning." : "Generate suitable content.");

  return [
    { role: "system", content: REWRITE_SYSTEM_PROMPT },
    {
      role: "user",
      content: hasSourceText
        ? `Instruction:\n${instruction}\n\n---\n\nText to rewrite:\n${input.text}`
        : `Instruction:\n${instruction}\n\n---\n\nNo source text was provided; generate new content from the instruction.`,
    },
  ];
}

export async function generateMagicRewrite(db: DB, input: MagicRewriteInput): Promise<MagicRewriteResult> {
  const connections = createConnectionsStorage(db);

  // Resolve connection: default chat -> default agent.
  const defaultChat = await connections.getDefault();
  const conn = defaultChat ? await connections.getWithKey(defaultChat.id) : await connections.getDefaultForAgents();

  if (!conn) {
    throw new MagicRewriteConfigError("No default agent connection configured");
  }

  if (conn.provider === "image_generation") {
    throw new MagicRewriteConfigError("Default connection is an image generation provider");
  }

  const baseUrl = resolveBaseUrl(conn);
  if (!baseUrl) {
    throw new MagicRewriteConfigError("No base URL configured for the default connection");
  }

  const provider = createLLMProvider(
    conn.provider,
    baseUrl,
    conn.apiKey,
    conn.maxContext,
    conn.openrouterProvider,
    conn.maxTokensOverride,
    conn.claudeFastMode === "true",
  );

  const result = await provider.chatComplete(buildRewriteMessages(input), {
    model: conn.model,
    temperature: 0.7,
    maxTokens: 4000,
    stream: false,
    enableCaching: conn.enableCaching === "true",
    cachingAtDepth: conn.cachingAtDepth,
  });

  return {
    text: result.content?.trim() ?? "",
    finishReason: result.finishReason,
    usage: result.usage ?? null,
  };
}
