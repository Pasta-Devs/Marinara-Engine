// ──────────────────────────────────────────────
// Claude (Subscription) prompt-cache diagnostics
// ──────────────────────────────────────────────
// Why did a turn miss the cache? One line per SDK request (the system prompt split at the cache boundary,
// hashed), one per init and one per result (reported cache reads and writes, 5m and 1h buckets), plus
// per-message batches with a running prefix hash, so two consecutive requests can be compared to find the
// first message that changed. Only hashes, lengths and counts are logged, never prompt text.
//
// Every line is debug. MARINARA_CACHE_DIAGNOSTICS=1 raises them to info (read per call, no restart).
import { createHash, randomUUID } from "node:crypto";

import { logger } from "../../../lib/logger.js";
import { SDK_VERSION } from "./claude-subscription/jsonl-entries.js";

const MAX_MESSAGES = 512;
const BATCH_SIZE = 24;
const CLAUDE_SYSTEM_PROMPT_DYNAMIC_BOUNDARY = "__SYSTEM_PROMPT_DYNAMIC_BOUNDARY__";

type DiagnosticMessage = {
  role?: unknown;
  content?: unknown;
  providerMetadata?: Record<string, unknown>;
  images?: unknown;
  files?: unknown;
  tool_calls?: unknown;
  tool_call_id?: unknown;
};

export type ClaudeCacheDiagnosticAttempt = {
  cacheRequestId: string;
  /** Date.now() when the attempt began; gives the failure line its elapsedMs. */
  startedAt?: number;
};

/** Diagnostic lines are debug unless MARINARA_CACHE_DIAGNOSTICS=1 (read per call). */
export function cacheDiagnosticsLevel(): "info" | "debug" {
  return process.env.MARINARA_CACHE_DIAGNOSTICS === "1" ? "info" : "debug";
}

function hash(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(value ?? null), "utf8")
    .digest("hex");
}

function bounded(value: unknown, max = 128): string | undefined {
  if (typeof value !== "string" || value.length === 0) return undefined;
  return value.length <= max && /^[A-Za-z0-9._:/-]+$/u.test(value) ? value : undefined;
}

function nonNegativeInteger(value: unknown): number | undefined {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
}

function safeStatus(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 100 && value <= 599 ? value : null;
}

function messageContent(message: DiagnosticMessage) {
  return {
    role: message.role,
    content: message.content,
    images: message.images,
    files: message.files,
    tool_calls: message.tool_calls,
    tool_call_id: message.tool_call_id,
  };
}

function messageSummary(message: DiagnosticMessage, index: number, prefixHash: string) {
  const content = typeof message.content === "string" ? message.content : "";
  const role = ["system", "user", "assistant", "tool"].includes(String(message.role)) ? message.role : "unknown";
  return {
    index,
    role,
    contentLength: content.length,
    messageHash: hash(messageContent(message)),
    metadataHash: hash(message.providerMetadata ?? null),
    prefixHash,
  };
}

function safeOptions(options: Record<string, unknown>): Record<string, unknown> {
  const allowed = [
    "model",
    "thinking",
    "effort",
    "maxTurns",
    "permissionMode",
    "allowDangerouslySkipPermissions",
    "settingSources",
    "skills",
    "settings",
    "betas",
    "fallbackModel",
    "outputFormat",
    "taskBudget",
    "maxBudgetUsd",
    "maxThinkingTokens",
  ];
  const selected: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in options) selected[key] = options[key];
  }
  return selected;
}

function systemSummary(systemPrompt: unknown) {
  const systems = Array.isArray(systemPrompt)
    ? systemPrompt.filter((value): value is string => typeof value === "string")
    : typeof systemPrompt === "string"
      ? [systemPrompt]
      : [];
  const boundary = systems.indexOf(CLAUDE_SYSTEM_PROMPT_DYNAMIC_BOUNDARY);
  const staticMessages = boundary >= 0 ? systems.slice(0, boundary) : systems;
  const dynamic = boundary >= 0 ? systems.slice(boundary + 1) : [];
  return {
    systemCount: systems.length,
    staticCount: staticMessages.length,
    staticLength: staticMessages.reduce((n, message) => n + message.length, 0),
    staticHash: hash(staticMessages),
    dynamicCount: dynamic.length,
    dynamicLength: dynamic.reduce((n, message) => n + message.length, 0),
    dynamicHash: hash(dynamic),
    dynamicBoundaryIndex: boundary,
  };
}

export function beginClaudeCacheDiagnostic(
  messages: readonly DiagnosticMessage[],
  sdkOptions: Record<string, unknown>,
  info: {
    requestedModel: unknown;
    path: "resume" | "direct" | "fold";
    sessionHash?: string | null;
    systemPrompt?: unknown;
  },
): ClaudeCacheDiagnosticAttempt {
  const cacheRequestId = randomUUID();
  const startedAt = Date.now();
  const detailLevel = cacheDiagnosticsLevel();
  // Hashing a long prompt costs time: skip all of it when the lines would not be written.
  if (!logger.isLevelEnabled(detailLevel)) return { cacheRequestId, startedAt };
  try {
    const retained = messages.slice(0, MAX_MESSAGES);
    const prefixHashes: string[] = [];
    let previous = hash("<messages>");
    for (const message of retained) {
      previous = hash({ previous, message: messageContent(message) });
      prefixHashes.push(previous);
    }
    const base = {
      cacheRequestId,
      observationBoundary: "sdk-input",
      messageScope: "pre-sdk-provider-messages",
      sdkVersion: SDK_VERSION,
      requestedModel: bounded(info.requestedModel),
      effectiveModel: bounded(sdkOptions.model),
      sdkPath: info.path,
      sessionHash: info.sessionHash ? hash(info.sessionHash) : null,
      inputCount: messages.length,
      inputOmittedCount: Math.max(0, messages.length - retained.length),
      inputAggregateHash: hash(messages.map((message) => messageSummary(message, 0, "").messageHash)),
      sdkOptionsFingerprint: hash(safeOptions(sdkOptions)),
      sdkIdentity: {
        cwdHash: typeof sdkOptions.cwd === "string" ? hash(sdkOptions.cwd) : null,
        resumeHash: typeof sdkOptions.resume === "string" ? hash(sdkOptions.resume) : null,
        hasSessionStore: !!sdkOptions.sessionStore,
      },
      system: systemSummary(info.systemPrompt),
    };
    logger[detailLevel](base, "Claude SDK request attempt");
    for (let start = 0; start < retained.length && logger.isLevelEnabled(detailLevel); start += BATCH_SIZE) {
      logger[detailLevel](
        {
          cacheRequestId,
          observationBoundary: "sdk-input",
          inputBatchIndex: Math.floor(start / BATCH_SIZE),
          inputBatchCount: Math.ceil(retained.length / BATCH_SIZE),
          inputMessages: retained
            .slice(start, start + BATCH_SIZE)
            .map((message, offset) => messageSummary(message, start + offset, prefixHashes[start + offset]!)),
        },
        "Claude SDK request input batch",
      );
    }
    return { cacheRequestId, startedAt };
  } catch {
    try {
      logger.warn(
        { cacheRequestId, observationBoundary: "sdk-input", diagnosticsAvailable: false },
        "Claude SDK diagnostic preparation or logging failed",
      );
    } catch {
      /* diagnostics never block generation */
    }
    return { cacheRequestId, startedAt };
  }
}

export function logClaudeCacheResult(attempt: ClaudeCacheDiagnosticAttempt, result: Record<string, unknown>): void {
  try {
    const usage = result.usage && typeof result.usage === "object" ? (result.usage as Record<string, unknown>) : null;
    const modelUsage = result.modelUsage && typeof result.modelUsage === "object" ? result.modelUsage : null;
    const creation =
      usage?.cache_creation && typeof usage.cache_creation === "object"
        ? (usage.cache_creation as Record<string, unknown>)
        : null;
    const level = cacheDiagnosticsLevel();
    if (!logger.isLevelEnabled(level)) return;
    logger[level](
      {
        cacheRequestId: attempt.cacheRequestId,
        observationBoundary: "sdk-input",
        messageScope: "pre-sdk-provider-messages",
        providerEvent: "result",
        sessionHash: typeof result.session_id === "string" ? hash(result.session_id) : null,
        subtype: bounded(result.subtype, 64),
        isError: result.is_error === true ? true : result.is_error === false ? false : null,
        returnedModels:
          modelUsage && !Array.isArray(modelUsage)
            ? Object.keys(modelUsage)
                .slice(0, 16)
                .map((model) => bounded(model, 128))
                .filter(Boolean)
            : [],
        apiErrorStatus: safeStatus(result.api_error_status),
        terminalReason: bounded(result.terminal_reason, 128) ?? null,
        assistantError: bounded(result.error, 64) ?? null,
        usage: usage
          ? {
              inputTokens: nonNegativeInteger(usage.input_tokens) ?? null,
              outputTokens: nonNegativeInteger(usage.output_tokens) ?? null,
              cachedInputTokens: nonNegativeInteger(usage.cache_read_input_tokens) ?? null,
              cacheWriteInputTokens: nonNegativeInteger(usage.cache_creation_input_tokens) ?? null,
              ephemeral5mInputTokens: nonNegativeInteger(creation?.ephemeral_5m_input_tokens) ?? null,
              ephemeral1hInputTokens: nonNegativeInteger(creation?.ephemeral_1h_input_tokens) ?? null,
            }
          : null,
      },
      "Claude SDK provider result",
    );
  } catch {
    // Diagnostics must never change provider behavior.
  }
}

export function logClaudeCacheInit(attempt: ClaudeCacheDiagnosticAttempt, init: Record<string, unknown>): void {
  try {
    const tools = Array.isArray(init.tools) ? init.tools : [];
    const mcpServers = Array.isArray(init.mcp_servers) ? init.mcp_servers : [];
    const level = cacheDiagnosticsLevel();
    if (!logger.isLevelEnabled(level)) return;
    logger[level](
      {
        cacheRequestId: attempt.cacheRequestId,
        observationBoundary: "sdk-input",
        providerEvent: "init",
        sessionHash: typeof init.session_id === "string" ? hash(init.session_id) : null,
        returnedModel: bounded(init.model, 128) ?? null,
        claudeCodeVersion: bounded(init.claude_code_version, 64) ?? null,
        toolCount: tools.length,
        mcpServerCount: mcpServers.length,
      },
      "Claude SDK init diagnostic",
    );
  } catch {
    // Diagnostics must never change provider behavior.
  }
}

export function logClaudeCacheFailure(attempt: ClaudeCacheDiagnosticAttempt, error: unknown): void {
  try {
    const record = error && typeof error === "object" ? (error as Record<string, unknown>) : {};
    const level = cacheDiagnosticsLevel();
    if (!logger.isLevelEnabled(level)) return;
    logger[level](
      {
        cacheRequestId: attempt.cacheRequestId,
        observationBoundary: "sdk-input",
        providerEvent: "failure",
        errorName: error instanceof Error ? (bounded(error.name, 128) ?? "Error") : typeof error,
        httpStatus: safeStatus(record.status) ?? safeStatus(record.api_error_status),
        terminalReason: bounded(record.terminal_reason, 128) ?? null,
        ...(attempt.startedAt !== undefined ? { elapsedMs: Date.now() - attempt.startedAt } : {}),
      },
      "Claude SDK provider failure",
    );
  } catch {
    // Diagnostics must never change provider behavior.
  }
}
