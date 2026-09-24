// ──────────────────────────────────────────────
// OpenAI Responses (and ChatGPT) prompt-cache diagnostics
// ──────────────────────────────────────────────
// One line per Responses request (hashes of each request field and of the input, item counts by kind),
// per-item batches with a running prefix hash, and one line per provider result with the reported cached
// input tokens, so two consecutive requests can be compared to find what broke the cache. Only hashes,
// lengths, counts and provider identifiers are logged, never prompt text.
//
// Every line is debug. MARINARA_CACHE_DIAGNOSTICS=1 raises them to info (read per call, no restart).
import { createHash, randomUUID } from "node:crypto";

import { logger } from "../../../lib/logger.js";
import { cacheDiagnosticsLevel } from "./claude-cache-diagnostics.js";

type ResponsesUsageLike = {
  input_tokens?: unknown;
  output_tokens?: unknown;
  total_tokens?: unknown;
  input_tokens_details?: { cached_tokens?: unknown };
  attribution?: {
    request_fields?: {
      instructions?: {
        input_tokens?: unknown;
        cached_tokens?: unknown;
        cache_write_tokens?: unknown;
        output_tokens?: unknown;
      };
    };
  };
};

type ResponseMetadataLike = {
  id?: unknown;
  model?: unknown;
  service_tier?: unknown;
  status?: unknown;
};

type RequestAttempt = {
  cacheRequestId: string;
  bodyFingerprint: string;
  serializedBody: string;
  baseLog: Record<string, unknown>;
  /** Date.now() when the attempt began; the HTTP result and transport lines carry elapsedMs from it. */
  startedAt: number;
};

const MAX_INPUT_ITEMS = 512;
const INPUT_BATCH_SIZE = 24;
const MAX_RESPONSE_ID_LENGTH = 256;
const MAX_MODEL_LENGTH = 128;
const ALLOWED_SERVICE_TIERS = new Set(["auto", "default", "flex", "priority", "scale"]);
const ALLOWED_STATUSES = new Set(["completed", "incomplete", "failed", "in_progress", "queued", "cancelled"]);

function hashSerialized(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function hashValue(value: unknown): string {
  return hashSerialized(value === undefined ? "<missing>" : JSON.stringify(value));
}

function boundedString(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string" || value.length === 0) return undefined;
  return value.slice(0, maxLength);
}

function safeIdentifier(value: unknown, maxLength: number): string | undefined {
  const bounded = boundedString(value, maxLength);
  return bounded && /^[A-Za-z0-9._:/-]+$/u.test(bounded) ? bounded : undefined;
}

function integerOrUndefined(value: unknown): number | undefined {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
}

function inputItemKind(item: unknown): string {
  const record = item && typeof item === "object" && !Array.isArray(item) ? (item as Record<string, unknown>) : {};
  const type = typeof record.type === "string" ? record.type : undefined;
  const role = typeof record.role === "string" ? record.role : undefined;
  const candidate = type ?? role ?? "";
  return [
    "function_call",
    "function_call_output",
    "message",
    "reasoning",
    "user",
    "assistant",
    "system",
    "tool",
  ].includes(candidate)
    ? candidate
    : "unknown";
}

function inputItemSummary(item: unknown, index: number, prefixHash: string): Record<string, unknown> {
  return {
    index,
    kind: inputItemKind(item),
    itemHash: hashValue(item),
    prefixHash,
  };
}

function responseString(value: unknown, maxLength: number, allowed?: Set<string>): string | undefined {
  const bounded = boundedString(value, maxLength);
  if (!bounded) return undefined;
  if (allowed && !allowed.has(bounded)) return undefined;
  return bounded;
}

export function beginResponsesRequestAttempt(
  body: Record<string, unknown>,
  route: "chatResponses" | "chatCompleteResponses",
): RequestAttempt {
  const detailLevel = cacheDiagnosticsLevel();
  if (!logger.isLevelEnabled(detailLevel)) {
    return { cacheRequestId: "", bodyFingerprint: "", serializedBody: "", baseLog: {}, startedAt: Date.now() };
  }
  const serializedBody = JSON.stringify(body);
  const input = Array.isArray(body.input) ? body.input : [];
  const retainedInput = input.slice(0, MAX_INPUT_ITEMS);
  const prefixHashes: string[] = [];
  let previous = hashSerialized("<input>");
  for (const item of retainedInput) {
    previous = hashSerialized(`${previous}\n${JSON.stringify(item)}`);
    prefixHashes.push(previous);
  }

  const fieldNames = [
    "instructions",
    "input",
    "tools",
    "tool_choice",
    "parallel_tool_calls",
    "reasoning",
    "text",
    "service_tier",
    "model",
    "prompt_cache_key",
  ] as const;
  const fieldFingerprints = Object.fromEntries(fieldNames.map((name) => [name, hashValue(body[name])]));
  const requestShape = Object.fromEntries(
    Object.keys(body)
      .filter((key) => key !== "instructions" && key !== "input")
      .sort()
      .map((key) => [key, hashValue(body[key])]),
  );
  const requestFields = {
    instructions: typeof body.instructions === "string" ? body.instructions.length : undefined,
    input: input.length,
    tools: Array.isArray(body.tools) ? body.tools.length : undefined,
  };
  // Aggregates for the one info line per attempt: how many input items of each kind.
  const inputKinds: Record<string, number> = {};
  for (const item of retainedInput) {
    const kind = inputItemKind(item);
    inputKinds[kind] = (inputKinds[kind] ?? 0) + 1;
  }
  const baseLog: Record<string, unknown> = {
    cacheRequestId: randomUUID(),
    route,
    bodyFingerprint: hashSerialized(serializedBody),
    fieldFingerprints,
    requestShapeFingerprint: hashValue(requestShape),
    inputCount: input.length,
    inputOmittedCount: Math.max(0, input.length - retainedInput.length),
    inputAggregateHash: hashValue(input),
    requestFields,
    inputKinds,
    inputBatchCount: Math.ceil(retainedInput.length / INPUT_BATCH_SIZE),
    requestedModel: safeIdentifier(body.model, MAX_MODEL_LENGTH),
    requestedServiceTier: responseString(body.service_tier, 32, ALLOWED_SERVICE_TIERS),
  };
  logger[detailLevel](baseLog, "OpenAI Responses request attempt");

  for (let start = 0; start < retainedInput.length && logger.isLevelEnabled(detailLevel); start += INPUT_BATCH_SIZE) {
    const entries = retainedInput
      .slice(start, start + INPUT_BATCH_SIZE)
      .map((item, offset) => inputItemSummary(item, start + offset, prefixHashes[start + offset]!));
    logger[detailLevel](
      {
        cacheRequestId: baseLog.cacheRequestId,
        bodyFingerprint: baseLog.bodyFingerprint,
        inputBatchIndex: Math.floor(start / INPUT_BATCH_SIZE),
        inputBatchCount: Math.ceil(retainedInput.length / INPUT_BATCH_SIZE),
        inputItems: entries,
      },
      "OpenAI Responses request input batch",
    );
  }

  return {
    cacheRequestId: baseLog.cacheRequestId as string,
    bodyFingerprint: baseLog.bodyFingerprint as string,
    serializedBody,
    baseLog,
    startedAt: Date.now(),
  };
}

export function logResponsesProviderEvent(
  attempt: RequestAttempt,
  event: "completed" | "incomplete" | "failed" | "nonstream",
  response: ResponseMetadataLike,
  usage?: ResponsesUsageLike,
): void {
  const level = cacheDiagnosticsLevel();
  if (!attempt.cacheRequestId || !logger.isLevelEnabled(level)) return;
  logger[level](
    {
      cacheRequestId: attempt.cacheRequestId,
      bodyFingerprint: attempt.bodyFingerprint,
      providerEvent: event,
      responseId: safeIdentifier(response.id, MAX_RESPONSE_ID_LENGTH),
      returnedModel: safeIdentifier(response.model, MAX_MODEL_LENGTH),
      returnedServiceTier: responseString(response.service_tier, 32, ALLOWED_SERVICE_TIERS),
      returnedStatus: responseString(response.status, 32, ALLOWED_STATUSES),
      usage: usage
        ? {
            inputTokens: integerOrUndefined(usage.input_tokens),
            outputTokens: integerOrUndefined(usage.output_tokens),
            totalTokens: integerOrUndefined(usage.total_tokens),
            cachedInputTokens: integerOrUndefined(usage.input_tokens_details?.cached_tokens),
            instructionInputTokens: integerOrUndefined(usage.attribution?.request_fields?.instructions?.input_tokens),
            instructionCachedTokens: integerOrUndefined(usage.attribution?.request_fields?.instructions?.cached_tokens),
            instructionCacheWriteTokens: integerOrUndefined(
              usage.attribution?.request_fields?.instructions?.cache_write_tokens,
            ),
            instructionOutputTokens: integerOrUndefined(usage.attribution?.request_fields?.instructions?.output_tokens),
          }
        : undefined,
    },
    "OpenAI Responses provider event",
  );
}
