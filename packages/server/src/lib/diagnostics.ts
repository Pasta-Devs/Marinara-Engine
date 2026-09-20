import type { DiagnosticReference } from "@marinara-engine/shared";
import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

export interface DiagnosticContext {
  requestId?: string;
  operationId?: string;
  operation?: string;
  stage?: string;
  chatId?: string;
  messageId?: string;
  jobId?: string;
  provider?: string;
  model?: string;
  connectionId?: string;
  attempt?: number;
}

const contexts = new AsyncLocalStorage<DiagnosticContext>();
const references = new WeakMap<object, DiagnosticReference>();
const MAX_TEXT = 2_000;
const SECRET_KEYS =
  /(?:authorization|cookie|password|passwd|secret|api[_-]?key|access[_-]?key|private[_-]?key|credential|jwt|bearer|token)/i;
const SECRET_QUERY = /([?&](?:token|key|secret|password|passwd|authorization|api[_-]?key|access[_-]?token)=)[^&#\s]*/gi;

export function getDiagnosticContext(): DiagnosticContext {
  return { ...(contexts.getStore() ?? {}) };
}

export function withDiagnosticContext<T>(context: DiagnosticContext, work: () => T): T {
  return contexts.run({ ...getDiagnosticContext(), ...context }, work);
}

function errorName(error: unknown) {
  return error instanceof Error
    ? error.name
    : typeof error === "object" && error
      ? String((error as any).name ?? "")
      : "";
}
function statusOf(error: unknown) {
  const s = (error as any)?.statusCode ?? (error as any)?.status;
  return Number.isInteger(s) ? s : undefined;
}
function causeOf(error: unknown): unknown {
  return error && typeof error === "object" ? (error as any).cause : undefined;
}

function classify(error: unknown, explicit?: string, depth = 0): string {
  if (explicit) return explicit;
  const name = errorName(error).toLowerCase();
  const code = String((error as any)?.code ?? "").toUpperCase();
  const status = statusOf(error) ?? statusOf(causeOf(error));
  if (name.includes("abort") || name.includes("cancel") || code === "ABORT_ERR") return "ME_CANCELLED";
  if (name.includes("timeout") || code.includes("TIMEOUT") || code === "ETIMEDOUT") return "ME_TIMEOUT";
  if (code === "ECONNREFUSED" || code === "ECONNRESET" || code === "ENOTFOUND" || name.includes("network"))
    return "ME_NETWORK";
  if (status === 401 || status === 403) return "ME_AUTH";
  if (status === 429 || code.includes("RATE")) return "ME_RATE_LIMIT";
  if (name.includes("provider") || name.includes("llmhttp")) return "ME_PROVIDER_ERROR";
  if (status !== undefined) return "ME_HTTP_ERROR";
  if (name.includes("validation") || name === "zoderror") return "ME_VALIDATION";
  if (name.includes("session") && name.includes("review")) return "ME_SESSION_REVIEW";
  if (
    name.includes("storage") ||
    code.startsWith("SQLITE") ||
    ["EACCES", "ENOENT", "ENOSPC", "EROFS", "EIO", "EPERM"].includes(code)
  )
    return "ME_STORAGE";
  if (name.includes("provider") || ((error as any)?.provider && !status)) return "ME_PROVIDER_ERROR";
  if (depth < 4 && causeOf(error) && causeOf(error) !== error) return classify(causeOf(error), undefined, depth + 1);
  return "ME_INTERNAL";
}

export function sanitizeDiagnosticText(text: string, limit = MAX_TEXT): string {
  let value = String(text).replace(SECRET_QUERY, "$1[REDACTED]");
  value = value.replace(/([?&][^=\s]+)=([^&#\s]*)/g, (all, key) =>
    /token|secret|key|password|auth|credential/i.test(key) ? `${key}=[REDACTED]` : all,
  );
  value = value.replace(/(https?:\/\/)([^\s/@]+):([^\s/@]+)@/gi, "$1[REDACTED]:[REDACTED]@");
  value = value.replace(/\b(?:sk|rk)-[A-Za-z0-9_-]{12,}\b/g, "[REDACTED_KEY]");
  value = value.replace(/\b(?:gh[pousr]_|github_pat_)[A-Za-z0-9_]{10,}\b/gi, "[REDACTED_GITHUB_TOKEN]");
  value = value.replace(/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, "[REDACTED_JWT]");
  value = value.replace(
    /(["'](?:token|secret|apiKey|api_key|accessKey|password|authorization)["']\s*:\s*["'])[^"']+(["'])/gi,
    "$1[REDACTED]$2",
  );
  value = value.replace(/\b(Bearer|Basic)\s+[^\s,;]+/gi, "$1 [REDACTED]");
  value = value.replace(/((?:api[_-]?key|token|secret|password|authorization)\s*[:=]\s*)[^\s,;]+/gi, "$1[REDACTED]");
  value = value.replace(/data:[^\s;,]+;base64,[A-Za-z0-9+/=]+/gi, "[REDACTED_MEDIA]");
  value = value.replace(
    /(["']?(?:access[_-]?token|refresh[_-]?token|client[_-]?secret|private[_-]?key|cookie|set-cookie|x-admin-secret)["']?\s*[:=]\s*)(?:"(?:\\.|[^"\\])*"|'[^']*'|[^\s,;}]+)/gi,
    "$1[REDACTED]",
  );
  return value.length > limit ? `${value.slice(0, limit)}…[TRUNCATED]` : value;
}

export function sanitizeDiagnosticValue(
  value: unknown,
  depth = 0,
  seen = new WeakSet<object>(),
  debug = false,
): unknown {
  if (depth > 5) return "[TRUNCATED]";
  if (typeof value === "string") return sanitizeDiagnosticText(value, debug ? 128_000 : 8_000);
  if (value === null || typeof value !== "object") return typeof value === "bigint" ? String(value) : value;
  if (seen.has(value)) return "[CIRCULAR]";
  seen.add(value);
  if (value instanceof Error) {
    const result: Record<string, unknown> = { name: value.name, message: sanitizeDiagnosticText(value.message) };
    for (const key of ["code", "status", "statusCode", "providerCode", "retryAfterMs"]) {
      const item = (value as any)[key];
      if (item !== undefined && (typeof item === "string" || typeof item === "number" || typeof item === "boolean"))
        result[key] = typeof item === "string" ? sanitizeDiagnosticText(item) : item;
    }
    if (value.stack) result.stack = sanitizeDiagnosticText(value.stack, 8_000);
    if (value.cause) result.cause = sanitizeDiagnosticValue(value.cause, depth + 1, seen, debug);
    return result;
  }
  if (Array.isArray(value))
    return value.slice(0, 32).map((item) => sanitizeDiagnosticValue(item, depth + 1, seen, debug));
  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value).slice(0, 64)) {
    const numericCount = /(?:tokens|tokenCount)$/i.test(key) && typeof item === "number";
    const payload =
      /^(headers?|body|query|cookies?|media|response|rawJson|images?|files?)$/i.test(key) ||
      (!debug && /^(prompt|messages|content)$/i.test(key));
    result[key] =
      (!numericCount && SECRET_KEYS.test(key)) || payload
        ? "[REDACTED]"
        : sanitizeDiagnosticValue(
            typeof item === "string" && /^(url|originalUrl)$/i.test(key) ? item.split(/[?#]/, 1)[0] : item,
            depth + 1,
            seen,
            debug,
          );
  }
  return result;
}

export function createDiagnostic(error: unknown, context?: DiagnosticContext, code?: string): DiagnosticReference {
  const supplied = { ...getDiagnosticContext(), ...(context ?? {}) };
  if (error && (typeof error === "object" || typeof error === "function")) {
    const previous = references.get(error);
    if (previous) return previous;
  }
  const reference: DiagnosticReference = {
    code: classify(error, code),
    errorId: randomUUID(),
    ...(supplied.requestId ? { requestId: supplied.requestId } : {}),
    ...(supplied.operation ? { operation: supplied.operation } : {}),
    ...(supplied.stage ? { stage: supplied.stage } : {}),
  };
  if (error && (typeof error === "object" || typeof error === "function")) references.set(error, reference);
  return reference;
}

export function formatDiagnosticError(error: unknown, reference: DiagnosticReference): string {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "Unexpected error";
  return `${sanitizeDiagnosticText(message)} (code=${reference.code}, reference=${reference.errorId})`;
}

export function diagnosticDetails(error: unknown): unknown {
  return sanitizeDiagnosticValue(error);
}
