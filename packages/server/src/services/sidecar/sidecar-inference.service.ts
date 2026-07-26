// ──────────────────────────────────────────────
// Sidecar Local Model — Inference Service
//
// Talks to a spawned llama-server subprocess via
// its OpenAI-compatible localhost HTTP API.
// ──────────────────────────────────────────────

import { randomUUID } from "crypto";
import type { SceneAnalysis } from "@marinara-engine/shared";
import { fitMessagesToContext, llmFetch, sanitizeApiError, type ChatMessage } from "../llm/base-provider.js";
import { sidecarModelService } from "./sidecar-model.service.js";
import { sidecarProcessService } from "./sidecar-process.service.js";
import { resolveSidecarRequestModel } from "./sidecar-request-model.js";

let activeRequests = 0;

function withRequestTracking<T>(fn: () => Promise<T>): Promise<T> {
  activeRequests += 1;
  return fn().finally(() => {
    activeRequests = Math.max(0, activeRequests - 1);
  });
}

export function isInferenceBusy(): boolean {
  return activeRequests > 0;
}

const MAX_OUTPUT_TOKENS = 8192;
const SCENE_ANALYSIS_MAX_TOKENS = 4096;
const STREAM_IDLE_TIMEOUT_MS = 120_000;
const MAX_ACCUMULATED_TEXT_CHARS = 4_000_000;

type SidecarMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type SidecarChatCompletionResponse = {
  choices?: Array<{
    message?: { content?: unknown; reasoning_content?: unknown };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  timings?: {
    prompt_n?: number;
    prompt_ms?: number;
    predicted_n?: number;
    predicted_ms?: number;
  };
};

type SidecarChatCompletionChunk = {
  error?: unknown;
  choices?: Array<{
    delta?: {
      content?: unknown;
      reasoning_content?: unknown;
    };
    message?: {
      content?: unknown;
      reasoning_content?: unknown;
    };
  }>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function extractSidecarErrorMessage(parsed: Record<string, unknown>): string | null {
  const error = parsed.error;
  if (typeof error === "string") return error;
  if (isRecord(error)) {
    const message = error.message;
    if (typeof message === "string" && message.trim()) return message;
    const detail = error.detail;
    if (typeof detail === "string" && detail.trim()) return detail;
  }
  return null;
}

function normalizeResponseFormat(responseFormat?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!responseFormat) return undefined;
  if (responseFormat.type !== "json_schema") return responseFormat;

  const jsonSchema = isRecord(responseFormat.json_schema) ? responseFormat.json_schema : {};
  const schema = isRecord(jsonSchema.schema)
    ? jsonSchema.schema
    : isRecord(responseFormat.schema)
      ? responseFormat.schema
      : {};
  return {
    type: "json_schema",
    json_schema: {
      name: typeof jsonSchema.name === "string" && jsonSchema.name.trim() ? jsonSchema.name.trim() : "response",
      schema,
      strict: typeof jsonSchema.strict === "boolean" ? jsonSchema.strict : true,
    },
  };
}

function formatStreamOutput(content: string, reasoning: string): string {
  return content.trim() || reasoning.trim();
}

function isContextOverflowError(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return [
    /context\s+(window|length|size|limit|overflow)/,
    /ctx\s*(size|limit|overflow)/,
    /prompt.*(too long|too large|exceed|overflow|context)/,
    /(exceed|exceeds|exceeded|overflow).*(context|ctx|token|prompt)/,
    /too many tokens/,
    /maximum context/,
    /n_ctx/,
  ].some((pattern) => pattern.test(message));
}

function isAbortLikeError(error: unknown): boolean {
  return error instanceof Error && /aborted|abort/i.test(`${error.name} ${error.message}`);
}

function isStreamStallError(error: unknown): boolean {
  return error instanceof Error && /stalled waiting for tokens/i.test(error.message);
}

function isProviderStreamError(error: unknown): boolean {
  return error instanceof Error && error.message.startsWith("llama-server stream error:");
}

function markStreamedBeforeError(error: unknown): void {
  if (error && typeof error === "object") {
    (error as { sidecarStreamedTokens?: boolean }).sidecarStreamedTokens = true;
  }
}

function streamedBeforeError(error: unknown): boolean {
  return !!(error && typeof error === "object" && (error as { sidecarStreamedTokens?: boolean }).sidecarStreamedTokens);
}

function getRequestModel(): string {
  return resolveSidecarRequestModel(
    sidecarModelService.getResolvedBackend(),
    sidecarModelService.getConfiguredModelRef(),
  );
}

export type SidecarTestMessageOutput = {
  content: string;
  reasoning: string;
  output: string;
  nonce: string;
  nonceVerified: boolean;
  usage: {
    promptTokens: number | null;
    completionTokens: number | null;
    totalTokens: number | null;
  };
  timings: {
    promptTokens: number | null;
    promptMs: number | null;
    predictedTokens: number | null;
    predictedMs: number | null;
  };
};

function extractContentText(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    let text = "";
    for (const item of content) {
      if (typeof item !== "object" || item === null) continue;
      const part = item as Record<string, unknown>;
      if (part.type === "text" && typeof part.text === "string") {
        text += part.text;
      }
    }
    return text;
  }

  return "";
}

function extractJsonPayload<T>(raw: string): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
    if (fenced) {
      return JSON.parse(fenced) as T;
    }
    throw new Error("Sidecar returned invalid JSON");
  }
}

function extractChoiceContent(
  choice:
    | {
        delta?: { content?: unknown; reasoning_content?: unknown };
        message?: { content?: unknown; reasoning_content?: unknown };
      }
    | null
    | undefined,
): { content: string; reasoning: string } {
  return {
    content: extractContentText(choice?.delta?.content ?? choice?.message?.content),
    reasoning: extractContentText(choice?.delta?.reasoning_content ?? choice?.message?.reasoning_content),
  };
}

function getRuntimeGenerationSettings() {
  const config = sidecarModelService.getConfig();
  return {
    maxTokens: Math.max(64, Math.floor(config.maxTokens)),
    temperature: Math.min(2, Math.max(0, config.temperature)),
    topP: Math.min(1, Math.max(Number.EPSILON, config.topP)),
    topK: Math.max(0, Math.floor(config.topK)),
  };
}

async function streamChatCompletion(options: {
  messages: SidecarMessage[];
  maxTokens: number;
  responseFormat?: Record<string, unknown>;
  signal?: AbortSignal;
}): Promise<string> {
  const baseUrl = await sidecarProcessService.ensureReady();
  const backend = sidecarModelService.getResolvedBackend();
  const generation = getRuntimeGenerationSettings();
  const config = sidecarModelService.getConfig();
  const requestedMaxTokens = Math.min(Math.max(1, Math.floor(options.maxTokens)), MAX_OUTPUT_TOKENS);
  const responseFormat = normalizeResponseFormat(options.responseFormat);
  const fitted = fitMessagesToContext(options.messages as ChatMessage[], {
    maxContext: config.contextSize,
    maxTokens: requestedMaxTokens,
  });
  const fittedMessages = fitted.messages.map((message) => ({
    role: message.role as SidecarMessage["role"],
    content: typeof message.content === "string" ? message.content : "",
  }));
  const maxTokens = Math.max(1, Math.min(fitted.maxTokens ?? requestedMaxTokens, requestedMaxTokens));
  const structuredOutput = !!responseFormat;

  const send = async (sendMaxTokens: number): Promise<string> => {
    const requestBody: Record<string, unknown> = {
      model: getRequestModel(),
      stream: true,
      messages: fittedMessages,
      max_tokens: sendMaxTokens,
      temperature: structuredOutput ? 0 : generation.temperature,
      top_p: structuredOutput ? 1 : generation.topP,
      ...(!structuredOutput && generation.topK > 0 ? { top_k: generation.topK } : {}),
    };
    if (responseFormat && backend !== "mlx") {
      requestBody.response_format = responseFormat;
    }

    const response = await llmFetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
      signal: options.signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(`llama-server error ${response.status}: ${sanitizeApiError(errorText || response.statusText)}`);
    }

    if (!response.body) {
      throw new Error("llama-server returned no response body");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let content = "";
    let reasoning = "";
    let emittedText = false;
    const readChunk = async () => {
      let timeout: ReturnType<typeof setTimeout> | null = null;
      try {
        return await Promise.race([
          reader.read(),
          new Promise<never>((_, reject) => {
            timeout = setTimeout(
              () => reject(new Error("llama-server stream stalled waiting for tokens")),
              STREAM_IDLE_TIMEOUT_MS,
            );
          }),
        ]);
      } finally {
        if (timeout) clearTimeout(timeout);
      }
    };

    const truncateAccumulatedText = (): string => {
      const truncated = formatStreamOutput(content, reasoning).slice(0, MAX_ACCUMULATED_TEXT_CHARS);
      content = truncated;
      reasoning = "";
      return truncated;
    };

    const appendText = (nextContent: string, nextReasoning: string): string | null => {
      content += nextContent;
      reasoning += nextReasoning;
      if (nextContent || nextReasoning) emittedText = true;
      if (content.length + reasoning.length > MAX_ACCUMULATED_TEXT_CHARS) {
        return truncateAccumulatedText();
      }
      return null;
    };

    const readSseData = (line: string): string | null => {
      if (!line.startsWith("data:")) return null;
      return line.slice(5).trimStart();
    };

    const handlePayload = (data: string): string | null => {
      if (data === "[DONE]") {
        return formatStreamOutput(content, reasoning);
      }

      const parsed = JSON.parse(data) as SidecarChatCompletionChunk;
      const providerError = extractSidecarErrorMessage(parsed as Record<string, unknown>);
      if (providerError) throw new Error(`llama-server stream error: ${sanitizeApiError(providerError)}`);

      const choice = parsed.choices?.[0];
      if (!choice) return null;
      const extracted = extractChoiceContent(choice);
      return appendText(extracted.content, extracted.reasoning);
    };

    const flushTrailingPayload = (): string | null => {
      const trailing = readSseData(buffer.trim());
      if (trailing == null) return null;
      if (trailing === "[DONE]") return null;
      try {
        return handlePayload(trailing);
      } catch (err) {
        if (isProviderStreamError(err)) throw err;
        // Ignore malformed trailing chunk after the stream has ended.
        return null;
      }
    };

    try {
      while (true) {
        const { done, value } = await readChunk();

        buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = done ? "" : (lines.pop() ?? "");

        for (const line of lines) {
          const trimmed = line.trim();
          const data = readSseData(trimmed);
          if (data == null) continue;
          const output = handlePayload(data);
          if (output !== null) return output;
        }
        if (done) break;
      }
    } catch (err) {
      if (emittedText) markStreamedBeforeError(err);
      if (isProviderStreamError(err)) throw err;
      const partial = formatStreamOutput(content, reasoning);
      const partialIsUsable = partial && !structuredOutput && (isAbortLikeError(err) || isStreamStallError(err));
      if (partialIsUsable) return partial;
      throw err;
    } finally {
      try {
        await reader.cancel();
      } catch {
        // Already closed.
      }
    }

    const trailingOutput = flushTrailingPayload();
    if (trailingOutput !== null) return trailingOutput;
    return formatStreamOutput(content, reasoning);
  };

  try {
    return await send(maxTokens);
  } catch (err) {
    if (maxTokens > 512 && !streamedBeforeError(err) && isContextOverflowError(err)) {
      return await send(Math.max(512, Math.floor(maxTokens / 2)));
    }
    throw err;
  }
}

export async function runTestMessage(): Promise<SidecarTestMessageOutput> {
  return withRequestTracking(async () => {
    if (!sidecarModelService.getConfiguredModelRef()) {
      throw new Error("Download or select a local model before running a test message.");
    }

    const config = sidecarModelService.getConfig();
    const shouldKeepRunning = config.useForTrackers || config.useForGameScene;
    const baseUrl = await sidecarProcessService.ensureReady({ forceStart: true });
    const backend = sidecarModelService.getResolvedBackend();
    const nonce = `marinara-${randomUUID().slice(0, 8)}`;

    try {
      const body: Record<string, unknown> = {
        model: getRequestModel(),
        stream: false,
        messages: [
          {
            role: "system",
            content:
              "You are a local runtime smoke test. Follow the user's format exactly and do not omit the verification token.",
          },
          {
            role: "user",
            content: `Reply in exactly two lines.
Line 1: TOKEN ${nonce}
Line 2: one short sentence confirming that the local sidecar test succeeded.`,
          },
        ] satisfies SidecarMessage[],
        max_tokens: 48,
        temperature: 0.2,
        top_p: 0.9,
      };
      if (backend !== "mlx") {
        body.reasoning_format = "none";
        body.chat_template_kwargs = { enable_thinking: false };
      }

      const response = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(45_000),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new Error(`llama-server error ${response.status}: ${sanitizeApiError(errorText || response.statusText)}`);
      }

      const payload = (await response.json()) as SidecarChatCompletionResponse;
      const message = payload.choices?.[0]?.message;
      const content = extractContentText(message?.content).trim();
      const reasoning = extractContentText(message?.reasoning_content).trim();
      const output = content || reasoning;
      if (!output) {
        throw new Error("The local sidecar test returned an empty response.");
      }

      const nonceVerified = output.includes(nonce);
      if (!nonceVerified) {
        throw new Error("The local sidecar test returned text, but it did not echo the verification token.");
      }

      return {
        content: content.slice(0, 500),
        reasoning: reasoning.slice(0, 500),
        output: output.slice(0, 500),
        nonce,
        nonceVerified,
        usage: {
          promptTokens: payload.usage?.prompt_tokens ?? null,
          completionTokens: payload.usage?.completion_tokens ?? null,
          totalTokens: payload.usage?.total_tokens ?? null,
        },
        timings: {
          promptTokens: payload.timings?.prompt_n ?? null,
          promptMs: payload.timings?.prompt_ms ?? null,
          predictedTokens: payload.timings?.predicted_n ?? null,
          predictedMs: payload.timings?.predicted_ms ?? null,
        },
      };
    } finally {
      if (!shouldKeepRunning) {
        await sidecarProcessService.stop().catch(() => {});
      }
    }
  });
}

export async function unloadModel(): Promise<void> {
  await sidecarProcessService.unload();
}

const SCENE_ANALYSIS_SCHEMA = {
  type: "object" as const,
  properties: {
    background: { type: ["string", "null"] as const },
    music: { type: ["string", "null"] as const },
    ambient: { type: ["string", "null"] as const },
    weather: { type: ["string", "null"] as const },
    timeOfDay: { type: ["string", "null"] as const },
    musicGenre: { type: ["string", "null"] as const },
    musicIntensity: { type: ["string", "null"] as const },
    locationKind: { type: ["string", "null"] as const },
    spotifyTrack: {
      type: ["string", "null"] as const,
    },
    reputationChanges: {
      type: "array" as const,
      maxItems: 5,
      items: {
        type: "object" as const,
        properties: {
          npcName: { type: "string" as const },
          action: { type: "string" as const },
        },
        required: ["npcName", "action"] as const,
        additionalProperties: false as const,
      },
    },
    segmentEffects: {
      type: "array" as const,
      maxItems: 20,
      items: {
        type: "object" as const,
        properties: {
          segment: { type: "number" as const },
          background: { type: ["string", "null"] as const },
          music: { type: ["string", "null"] as const },
          ambient: { type: ["string", "null"] as const },
          sfx: {
            type: "array" as const,
            items: { type: "string" as const },
            maxItems: 3,
          },
          directions: {
            type: "array" as const,
            maxItems: 1,
            items: {
              type: "object" as const,
              properties: {
                effect: {
                  type: "string" as const,
                  enum: [
                    "flash",
                    "screen_shake",
                    "pulse",
                    "slow_zoom",
                    "impact_zoom",
                    "tilt",
                    "desaturate",
                    "chromatic_aberration",
                    "film_grain",
                    "rain_streaks",
                    "spotlight",
                    "focus",
                    "vignette",
                    "letterbox",
                    "color_grade",
                  ] as const,
                },
                duration: { type: "number" as const },
                intensity: { type: "number" as const },
                target: {
                  type: "string" as const,
                  enum: ["background", "content", "all"] as const,
                },
                params: {
                  type: "object" as const,
                  additionalProperties: { type: "string" as const },
                },
              },
              required: ["effect"] as const,
              additionalProperties: false as const,
            },
          },
        },
        required: ["segment"] as const,
        additionalProperties: false as const,
      },
    },
    directions: {
      type: "array" as const,
      maxItems: 8,
      items: {
        type: "object" as const,
        properties: {
          effect: {
            type: "string" as const,
            enum: [
              "fade_from_black",
              "fade_to_black",
              "flash",
              "screen_shake",
              "blur",
              "vignette",
              "letterbox",
              "color_grade",
              "focus",
              "pulse",
              "slow_zoom",
              "impact_zoom",
              "tilt",
              "desaturate",
              "chromatic_aberration",
              "film_grain",
              "rain_streaks",
              "spotlight",
            ] as const,
          },
          duration: { type: "number" as const },
          intensity: { type: "number" as const },
          target: {
            type: "string" as const,
            enum: ["background", "content", "all"] as const,
          },
          params: {
            type: "object" as const,
            additionalProperties: { type: "string" as const },
          },
        },
        required: ["effect"] as const,
        additionalProperties: false as const,
      },
    },
    illustration: {
      type: ["object", "null"] as const,
      properties: {
        segment: { type: "number" as const },
        title: { type: "string" as const },
        prompt: { type: "string" as const },
        characters: {
          type: "array" as const,
          maxItems: 6,
          items: { type: "string" as const },
        },
        reason: { type: "string" as const },
        slug: { type: "string" as const },
      },
      required: ["prompt"] as const,
      additionalProperties: false as const,
    },
  },
  additionalProperties: false as const,
  required: ["background", "music", "ambient", "weather", "timeOfDay", "reputationChanges", "segmentEffects"] as const,
};

export async function analyzeScene(systemPrompt: string, userPrompt: string, signal?: AbortSignal): Promise<SceneAnalysis> {
  return withRequestTracking(async () => {
    const raw = await streamChatCompletion({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      maxTokens: SCENE_ANALYSIS_MAX_TOKENS,
      responseFormat: {
        type: "json_schema",
        json_schema: {
          name: "scene_analysis",
          schema: SCENE_ANALYSIS_SCHEMA,
          strict: true,
        },
      },
      signal,
    });

    return extractJsonPayload<SceneAnalysis>(raw);
  });
}

export async function runTrackerPrompt(systemPrompt: string, userPrompt: string, signal?: AbortSignal): Promise<string> {
  return withRequestTracking(async () => {
    return await streamChatCompletion({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      maxTokens: MAX_OUTPUT_TOKENS,
      signal,
    });
  });
}

export async function isInferenceAvailable(): Promise<boolean> {
  if (!sidecarModelService.getConfiguredModelRef() || !sidecarModelService.isEnabled()) {
    return false;
  }

  try {
    await sidecarProcessService.syncForCurrentConfig({ suppressKnownFailure: true, allowRuntimeInstall: false });
  } catch {
    return false;
  }

  return sidecarProcessService.isReady();
}
