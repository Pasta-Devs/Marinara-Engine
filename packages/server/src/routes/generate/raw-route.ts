import type { FastifyInstance } from "fastify";
import { randomUUID } from "crypto";
import { z } from "zod";
import {
  LOCAL_SIDECAR_CONNECTION_ID,
  isClaudeAdaptiveOnlyNoSamplingModel,
  resolveProviderReasoningEffort,
  type ChatMLMessage,
  type GenerationParameterSendMap,
} from "@marinara-engine/shared";
import { createConnectionsStorage } from "../../services/storage/connections.storage.js";
import { createLLMProvider } from "../../services/llm/provider-registry.js";
import { withConnectionFallbackProvider } from "../../services/llm/connection-fallback-provider.js";
import { getLocalSidecarProvider, LOCAL_SIDECAR_MODEL } from "../../services/llm/local-sidecar.js";
import { yieldToEventLoop, type BaseLLMProvider, type ChatMessage } from "../../services/llm/base-provider.js";
import { mergeAdjacentMessages } from "../../services/prompt/merger.js";
import {
  fitMessagesForModelAccess,
  mergeModelContextLimit,
  resolveModelAccessPolicy,
  resolveStoredModelContextLimit,
} from "../../services/generation/model-access-policy.js";
import { resolveMemoryRecallEmbeddingSource } from "../../services/memory-recall-embedding.js";
import { logger } from "../../lib/logger.js";
import { sendSseEvent, startSseKeepalive, startSseReply } from "./sse.js";
import { createReplyFallbackNotifier } from "./fallback-notification.js";
import {
  createLocalSidecarGenerationConnection,
  mergeCustomParameters,
  normalizeServiceTier,
  parseStoredGenerationParameters,
  resolveBaseUrl,
  resolveProviderTopK,
} from "./generate-route-utils.js";

const rawMessageSchema = z
  .object({
    role: z.enum(["system", "user", "assistant"]),
    content: z.string().max(500_000),
    images: z.array(z.string().min(1)).max(32).optional(),
    files: z
      .array(
        z.object({
          type: z.string().min(1).max(200),
          data: z.string().min(1),
          filename: z.string().max(500).optional(),
        }),
      )
      .max(16)
      .optional(),
    providerMetadata: z.record(z.unknown()).optional(),
  })
  .strict();

const rawParametersSchema = z
  .object({
    temperature: z.number().min(0).max(5).optional(),
    maxTokens: z.number().int().min(1).max(200_000).optional(),
    maxContext: z.number().int().min(1).optional(),
    topP: z.number().min(0).max(1).optional(),
    topK: z.number().int().min(0).max(10_000).optional(),
    minP: z.number().min(0).max(1).optional(),
    frequencyPenalty: z.number().min(-2).max(2).optional(),
    presencePenalty: z.number().min(-2).max(2).optional(),
    reasoningEffort: z.enum(["low", "medium", "high", "xhigh", "maximum"]).nullable().optional(),
    verbosity: z.enum(["low", "medium", "high"]).nullable().optional(),
    serviceTier: z.enum(["flex", "priority"]).nullable().optional(),
    customParameters: z.record(z.unknown()).optional(),
    enabledParameters: z.record(z.boolean()).optional(),
  })
  .strict();

const rawGenerateBodySchema = z
  .object({
    connectionId: z.string().trim().min(1),
    messages: z.array(rawMessageSchema).min(1).max(200),
    parameters: rawParametersSchema.optional(),
    streaming: z.boolean().optional(),
    returnPrompt: z.boolean().optional(),
    runId: z.string().trim().min(1).max(200).optional(),
  })
  .strict();

const rawAbortBodySchema = z
  .object({
    runId: z.string().trim().min(1),
    connectionId: z.string().trim().min(1).optional(),
  })
  .strict();

const rawEmbeddingsBodySchema = z
  .object({
    connectionId: z.string().trim().min(1),
    input: z.union([z.string().min(1).max(500_000), z.array(z.string().min(1).max(500_000)).min(1).max(256)]),
  })
  .strict();

type RawParameters = z.infer<typeof rawParametersSchema>;

function isAbortError(error: unknown): boolean {
  return !!error && typeof error === "object" && (error as { name?: unknown }).name === "AbortError";
}

function normalizeReasoningEffort(args: {
  provider: string;
  model: string;
  reasoningEffort: "low" | "medium" | "high" | "xhigh" | "maximum" | null;
}): "low" | "medium" | "high" | "xhigh" | "max" | null {
  return resolveProviderReasoningEffort(args);
}

export async function registerRawRoute(app: FastifyInstance) {
  const connections = createConnectionsStorage(app.db);
  const activeRawRuns = new Map<string, { abortController: AbortController; connectionId: string }>();

  app.post("/raw/abort", async (req, reply) => {
    const body = rawAbortBodySchema.parse(req.body ?? {});
    const entry = activeRawRuns.get(body.runId);
    if (!entry) return reply.send({ aborted: false, reason: "No active raw generation for this runId" });
    if (body.connectionId && body.connectionId !== entry.connectionId) {
      return reply.status(400).send({ error: "connectionId does not match the active raw generation" });
    }
    entry.abortController.abort();
    activeRawRuns.delete(body.runId);
    return reply.send({ aborted: true });
  });

  app.post("/raw", async (req, reply) => {
    const body = rawGenerateBodySchema.parse(req.body ?? {});
    const conn =
      body.connectionId === LOCAL_SIDECAR_CONNECTION_ID
        ? createLocalSidecarGenerationConnection()
        : await connections.getWithKey(body.connectionId);
    if (!conn) return reply.status(404).send({ error: "Connection not found" });
    if (!conn.model) return reply.status(400).send({ error: "Connection does not have a chat model configured" });

    const baseUrl = resolveBaseUrl(conn);
    if (!baseUrl) return reply.status(400).send({ error: "No base URL configured for this connection" });

    const modelAccessPolicy = resolveModelAccessPolicy({
      provider: conn.provider,
      model: conn.model,
      maxContext: conn.maxContext,
    });
    const { suppressModelParameters, connectionMaxContext } = modelAccessPolicy;
    let effectiveMaxContext = modelAccessPolicy.effectiveMaxContext;

    let temperature: number | undefined = 1;
    let maxTokens = 2048;
    let topP: number | undefined = 1;
    let topK = 0;
    let minP = 0;
    let frequencyPenalty = 0;
    let presencePenalty = 0;
    let reasoningEffort: "low" | "medium" | "high" | "xhigh" | "maximum" | null = null;
    let verbosity: "low" | "medium" | "high" | null = null;
    let serviceTier: "flex" | "priority" | null = null;
    let customParameters: Record<string, unknown> = {};
    let enabledParameters: GenerationParameterSendMap | undefined;

    const applyParameterOverrides = (params: RawParameters | ReturnType<typeof parseStoredGenerationParameters>) => {
      if (!params) return;
      if (params.temperature !== undefined) temperature = params.temperature;
      if (params.maxTokens !== undefined) maxTokens = params.maxTokens;
      if (params.topP !== undefined) topP = params.topP;
      if (params.topK !== undefined) topK = params.topK;
      if (params.minP !== undefined) minP = params.minP;
      if (params.frequencyPenalty !== undefined) frequencyPenalty = params.frequencyPenalty;
      if (params.presencePenalty !== undefined) presencePenalty = params.presencePenalty;
      if (params.reasoningEffort !== undefined) reasoningEffort = params.reasoningEffort;
      if (params.verbosity !== undefined) verbosity = params.verbosity;
      if (params.serviceTier !== undefined) serviceTier = normalizeServiceTier(params.serviceTier);
      if (params.customParameters) customParameters = mergeCustomParameters(customParameters, params.customParameters);
      if (params.enabledParameters) enabledParameters = { ...enabledParameters, ...params.enabledParameters };
    };

    const connectionParams = parseStoredGenerationParameters(conn.defaultParameters);
    applyParameterOverrides(connectionParams);
    if (connectionParams) {
      effectiveMaxContext = mergeModelContextLimit(
        modelAccessPolicy,
        effectiveMaxContext,
        resolveStoredModelContextLimit(modelAccessPolicy, connectionParams),
      );
    }
    applyParameterOverrides(body.parameters ?? null);
    if (body.parameters?.maxContext !== undefined) {
      effectiveMaxContext = mergeModelContextLimit(modelAccessPolicy, effectiveMaxContext, body.parameters.maxContext);
    }

    const providerTopK = resolveProviderTopK(topK);
    const resolvedEffort = normalizeReasoningEffort({
      provider: conn.provider,
      model: conn.model,
      reasoningEffort,
    });
    const enableThinking = !!resolvedEffort;

    const modelLower = conn.model.toLowerCase();
    const isClaudeNoSampling = isClaudeAdaptiveOnlyNoSamplingModel(modelLower);
    if (isClaudeNoSampling) {
      temperature = undefined;
      topP = undefined;
      topK = 0;
      frequencyPenalty = 0;
      presencePenalty = 0;
    }

    const isClaudeTemperatureOnly =
      !isClaudeNoSampling &&
      (/claude-(opus|sonnet)-4-[56]/.test(modelLower) || /claude-(opus|sonnet)-4\.[56]/.test(modelLower));
    if (isClaudeTemperatureOnly) {
      topP = undefined;
      topK = 0;
      frequencyPenalty = 0;
      presencePenalty = 0;
    }

    const primaryProvider: BaseLLMProvider =
      body.connectionId === LOCAL_SIDECAR_CONNECTION_ID
        ? (getLocalSidecarProvider() as BaseLLMProvider)
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
          );
    const fallbackConnection = await connections.getFallbackForMain();
    const provider = withConnectionFallbackProvider({
      primary: primaryProvider,
      primaryConnectionId: body.connectionId,
      fallbackConnection,
      fallbackBaseUrl: fallbackConnection ? resolveBaseUrl(fallbackConnection) : "",
      category: "main",
      onFallback: createReplyFallbackNotifier(reply),
    });

    const normalizedMessages: ChatMLMessage[] = body.messages.map((message) => ({
      role: message.role,
      content: message.content.replace(/\n([ \t]*\n){2,}/g, "\n\n"),
      ...(message.images?.length ? { images: message.images } : {}),
      ...(message.files?.length ? { files: message.files } : {}),
      ...(message.providerMetadata ? { providerMetadata: message.providerMetadata } : {}),
    }));
    const fit = fitMessagesForModelAccess({
      messages: mergeAdjacentMessages(normalizedMessages) as ChatMessage[],
      policy: { ...modelAccessPolicy, effectiveMaxContext },
      maxTokens,
    });
    const providerMessages = fit.messages;
    const maxTokensForSend = fit.maxTokensForSend;

    if (body.returnPrompt) {
      return reply.send({
        prompt: {
          messages: providerMessages.map((message) => ({
            role: message.role,
            content: message.content,
            ...(message.images?.length ? { images: message.images } : {}),
            ...(message.files?.length ? { files: message.files } : {}),
            ...(message.providerMetadata ? { providerMetadata: message.providerMetadata } : {}),
          })),
        },
        parameters: {
          provider: conn.provider,
          model: conn.model,
          temperature: suppressModelParameters ? undefined : temperature,
          maxTokens: maxTokensForSend,
          maxContext: suppressModelParameters ? undefined : (effectiveMaxContext ?? connectionMaxContext),
          topP: suppressModelParameters ? undefined : topP,
          topK: suppressModelParameters ? undefined : providerTopK,
          frequencyPenalty: suppressModelParameters ? undefined : frequencyPenalty || undefined,
          presencePenalty: suppressModelParameters ? undefined : presencePenalty || undefined,
          minP: minP || undefined,
          enableThinking: suppressModelParameters ? undefined : enableThinking || undefined,
          reasoningEffort: suppressModelParameters ? undefined : resolvedEffort || undefined,
          verbosity: verbosity || undefined,
          serviceTier: serviceTier || undefined,
          customParameters: Object.keys(customParameters).length > 0 ? customParameters : undefined,
          suppressModelParameters: suppressModelParameters || undefined,
        },
      });
    }

    const abortController = new AbortController();
    const runId = body.runId || randomUUID();
    activeRawRuns.set(runId, { abortController, connectionId: body.connectionId });

    const onClose = () => {
      abortController.abort();
      activeRawRuns.delete(runId);
    };
    req.raw.on("close", onClose);

    const runOptions = {
      model: conn.model,
      temperature,
      maxTokens: maxTokensForSend,
      maxContext: suppressModelParameters ? undefined : (effectiveMaxContext ?? connectionMaxContext),
      topP,
      topK: providerTopK,
      frequencyPenalty: frequencyPenalty || undefined,
      presencePenalty: presencePenalty || undefined,
      minP: minP || undefined,
      enableThinking,
      reasoningEffort: resolvedEffort ?? undefined,
      verbosity: verbosity ?? undefined,
      serviceTier,
      customParameters,
      enabledParameters,
      suppressModelParameters,
      signal: abortController.signal,
    };

    if (body.streaming) {
      startSseReply(reply, { "X-Accel-Buffering": "no" });
      const stopKeepalive = startSseKeepalive(reply);
      sendSseEvent(reply, { type: "raw_started", data: { runId } });

      const STREAM_CHUNK = 6;
      const STREAM_CHUNK_YIELD_EVERY = 64;
      let chunksSinceYield = 0;
      let full = "";
      const sendTokenTextChunked = async (text: string) => {
        for (let i = 0; i < text.length; i += STREAM_CHUNK) {
          sendSseEvent(reply, { type: "token", data: text.slice(i, i + STREAM_CHUNK) });
          chunksSinceYield += 1;
          if (chunksSinceYield % STREAM_CHUNK_YIELD_EVERY === 0) await yieldToEventLoop();
        }
      };

      try {
        const result = await provider.chatComplete(providerMessages, {
          ...runOptions,
          onToken: async (chunk) => {
            full += chunk;
            await sendTokenTextChunked(chunk);
          },
        });
        if (result.content && !full.endsWith(result.content)) {
          full += result.content;
          await sendTokenTextChunked(result.content);
        }
        sendSseEvent(reply, { type: "result", data: { content: full || result.content || "" } });
        sendSseEvent(reply, { type: "done", data: "" });
      } catch (err) {
        if (abortController.signal.aborted || isAbortError(err)) {
          sendSseEvent(reply, { type: "aborted", data: "" });
        } else {
          logger.error(err, "[raw] Streaming generation failed");
          sendSseEvent(reply, { type: "error", data: err instanceof Error ? err.message : "Raw generation failed" });
        }
        sendSseEvent(reply, { type: "done", data: "" });
      } finally {
        req.raw.off("close", onClose);
        activeRawRuns.delete(runId);
        stopKeepalive();
        reply.raw.end();
      }
      return;
    }

    reply.header("x-raw-runid", runId);
    try {
      const result = await provider.chatComplete(providerMessages, runOptions);
      return reply.send({
        content: (result.content ?? "").trimEnd(),
        runId,
      });
    } catch (err) {
      if (abortController.signal.aborted || isAbortError(err)) {
        return reply.send({ aborted: true, runId });
      }
      logger.error(err, "[raw] Generation failed");
      return reply.status(500).send({ error: err instanceof Error ? err.message : "Raw generation failed", runId });
    } finally {
      req.raw.off("close", onClose);
      activeRawRuns.delete(runId);
    }
  });

  app.post("/raw/embeddings", async (req, reply) => {
    const body = rawEmbeddingsBodySchema.parse(req.body ?? {});
    const texts = Array.isArray(body.input) ? body.input : [body.input];
    const abortController = new AbortController();
    let completed = false;
    const onClose = () => {
      if (!completed) abortController.abort();
    };
    reply.raw.on("close", onClose);

    try {
      const embeddings =
        body.connectionId === LOCAL_SIDECAR_CONNECTION_ID
          ? await getLocalSidecarProvider().embed(texts, LOCAL_SIDECAR_MODEL, abortController.signal)
          : await (async () => {
              const activeConnection = await connections.getWithKey(body.connectionId);
              if (!activeConnection) {
                throw new Error("Connection not found");
              }
              const source = await resolveMemoryRecallEmbeddingSource(app.db, {
                connectionId: body.connectionId,
                activeConnection,
              });
              if (!source) {
                throw new Error("Connection does not have an embedding model/source configured");
              }
              const vectors = await source.embed(texts, abortController.signal);
              if (!vectors) throw new Error("Embedding source failed");
              return vectors;
            })();

      if (embeddings.length !== texts.length || embeddings.some((embedding) => embedding.length === 0)) {
        return reply.status(502).send({
          error: `Embedding request returned ${embeddings.length}/${texts.length} usable vectors.`,
        });
      }

      return {
        object: "list",
        data: embeddings.map((embedding, index) => ({
          object: "embedding",
          embedding,
          index,
        })),
      };
    } catch (err) {
      if (abortController.signal.aborted || isAbortError(err)) {
        return reply.send({ aborted: true });
      }
      logger.warn(err, "[raw] Embedding request failed");
      const message = err instanceof Error ? err.message : "Raw embedding request failed";
      return reply.status(message === "Connection not found" ? 404 : message.includes("configured") ? 400 : 502).send({
        error: message,
      });
    } finally {
      completed = true;
      reply.raw.off("close", onClose);
    }
  });
}
