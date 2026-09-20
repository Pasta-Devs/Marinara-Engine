const STORAGE_KEY = "marinara-client-diagnostics-v1";
const MAX_QUEUE_ITEMS = 24;
const MAX_QUEUE_BYTES = 12 * 1024;
const MAX_STORED_BYTES = 24 * 1024;
const MAX_MESSAGE_LENGTH = 1_200;
const MAX_STACK_LENGTH = 4_000;
const MAX_PATH_LENGTH = 512;
const queuedFingerprints = new Set<string>();
let memoryQueue: ClientDiagnosticRecord[] = [];
let storageUnavailable = false;
let diagnosticSender: ((record: ClientDiagnosticRecord, signal: AbortSignal) => Promise<boolean>) | null = null;
let flushPromise: Promise<void> | null = null;
let installed = false;

export type ClientDiagnosticKind = "error" | "unhandledrejection" | "react" | "network";

export type ClientDiagnosticInput = {
  kind: ClientDiagnosticKind;
  message: string;
  stack?: string;
  path?: string;
  clientEventId?: string;
};

export type ClientDiagnosticRecord = {
  kind: ClientDiagnosticKind;
  message: string;
  stack?: string;
  path?: string;
  clientEventId: string;
};

function boundedText(value: unknown, maxLength: number): string {
  return String(value ?? "")
    .replace(/\p{Cc}/gu, (character) => (["\n", "\r", "\t"].includes(character) ? character : " "))
    .replace(/(?:bearer\s+|basic\s+)[a-z0-9._~+/=-]+/gi, "[redacted credential]")
    .replace(
      /((?:["']?(?:api[_-]?key|access[_-]?token|refresh[_-]?token|authorization|password|secret|client[_-]?secret|token)["']?)\s*[=:]\s*)(?:"[^"]*"|'[^']*'|[^\s,;}]+)/gi,
      "$1[redacted]",
    )
    .replace(/\b(?:sk-[a-z0-9_-]{12,}|eyJ[a-z0-9_-]+\.[a-z0-9_-]+\.[a-z0-9_-]+)\b/gi, "[redacted credential]")
    .replace(/\b(?:gh[pousr]_|github_pat_)[a-z0-9_]{10,}\b/gi, "[redacted credential]")
    .replace(
      /([?&](?:api[_-]?key|access[_-]?token|refresh[_-]?token|authorization|password|secret|key))=[^&#\s]*/gi,
      "$1=[redacted]",
    )
    .replace(/(https?:\/\/)([^/@\s]+):([^/@\s]+)@/gi, "$1[redacted]@")
    .slice(0, maxLength);
}

export function sanitizeClientPath(value: unknown): string | undefined {
  const raw = boundedText(value, MAX_PATH_LENGTH);
  if (!raw) return undefined;
  try {
    const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost";
    const url = new URL(raw, origin);
    return `${url.pathname}`.slice(0, MAX_PATH_LENGTH) || "/";
  } catch {
    const fallbackPath = raw.split(/[?#]/, 1)[0] ?? "";
    return fallbackPath.slice(0, MAX_PATH_LENGTH) || "/";
  }
}

export function sanitizeClientDiagnostic(input: ClientDiagnosticInput): ClientDiagnosticRecord {
  const kind: ClientDiagnosticKind =
    input.kind === "error" || input.kind === "unhandledrejection" || input.kind === "react" || input.kind === "network"
      ? input.kind
      : "error";
  const message = boundedText(input.message, MAX_MESSAGE_LENGTH) || "Unknown client error";
  const stack = input.stack ? boundedText(input.stack, MAX_STACK_LENGTH).replace(/[?#][^\s)\]]*/g, "") : undefined;
  const path = sanitizeClientPath(input.path);
  return {
    kind,
    message,
    ...(stack ? { stack } : {}),
    ...(path ? { path } : {}),
    clientEventId:
      typeof input.clientEventId === "string" && /^[A-Za-z0-9._:-]{1,80}$/.test(input.clientEventId)
        ? input.clientEventId
        : createClientEventId(),
  };
}

function createClientEventId(): string {
  try {
    return globalThis.crypto.randomUUID();
  } catch {
    return `client-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

function byteLength(value: string): number {
  return typeof TextEncoder === "function" ? new TextEncoder().encode(value).byteLength : value.length;
}

function readQueue(): ClientDiagnosticRecord[] {
  if (storageUnavailable) return memoryQueue;
  try {
    const stored = localStorage.getItem(STORAGE_KEY) || "[]";
    if (byteLength(stored) > MAX_STORED_BYTES) return memoryQueue;
    const parsed = JSON.parse(stored);
    const queue = Array.isArray(parsed)
      ? parsed
          .filter(
            (item): item is ClientDiagnosticRecord =>
              item && typeof item === "object" && typeof item.kind === "string" && typeof item.message === "string",
          )
          .map((item) => sanitizeClientDiagnostic(item))
      : [];
    memoryQueue = queue.slice(-MAX_QUEUE_ITEMS);
    return memoryQueue;
  } catch {
    storageUnavailable = true;
    return memoryQueue;
  }
}

function writeQueue(queue: ClientDiagnosticRecord[]) {
  memoryQueue = queue.slice(-MAX_QUEUE_ITEMS);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(memoryQueue));
  } catch {
    // Storage is optional. The bounded memory queue remains usable.
    storageUnavailable = true;
  }
}

function fingerprint(record: ClientDiagnosticRecord): string {
  return `${record.kind}|${record.message}|${record.path || ""}|${(record.stack || "").slice(0, 240)}`;
}

function enqueue(record: ClientDiagnosticRecord) {
  const key = fingerprint(record);
  if (queuedFingerprints.has(key)) return;
  const queue = readQueue();
  if (queue.some((item) => fingerprint(item) === key)) return;
  queue.push(record);
  while (queue.length > MAX_QUEUE_ITEMS || byteLength(JSON.stringify(queue)) > MAX_QUEUE_BYTES) queue.shift();
  writeQueue(queue);
  queuedFingerprints.add(key);
  while (queuedFingerprints.size > MAX_QUEUE_ITEMS * 2)
    queuedFingerprints.delete(queuedFingerprints.values().next().value!);
}

async function flushQueue() {
  if (flushPromise) return flushPromise;
  flushPromise = (async () => {
    if (typeof navigator !== "undefined" && navigator.onLine === false) return;
    const queue = readQueue();
    if (!diagnosticSender) return;
    for (const record of queue) {
      let sent = false;
      const controller = new AbortController();
      let timeout = 0;
      const timeoutPromise = new Promise<boolean>((resolve) => {
        timeout = window.setTimeout(() => {
          controller.abort();
          resolve(false);
        }, 8_000);
      });
      try {
        sent = await Promise.race([diagnosticSender(record, controller.signal), timeoutPromise]);
      } catch {
        sent = false;
      } finally {
        clearTimeout(timeout);
      }
      if (!sent) break;
      const current = readQueue().filter((item) => item.clientEventId !== record.clientEventId);
      writeQueue(current);
    }
  })().finally(() => {
    flushPromise = null;
  });
  return flushPromise;
}

export function reportClientDiagnostic(input: ClientDiagnosticInput): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  const record = sanitizeClientDiagnostic(input);
  enqueue(record);
  return flushQueue();
}

export function configureClientDiagnosticSender(
  sender: (record: ClientDiagnosticRecord, signal: AbortSignal) => Promise<boolean>,
) {
  diagnosticSender = sender;
  return flushQueue();
}

function errorDetails(value: unknown): { message: string; stack?: string } {
  if (value instanceof Error) return { message: value.message, stack: value.stack };
  if (typeof value === "string") return { message: value };
  try {
    return { message: JSON.stringify(value) || String(value) };
  } catch {
    return { message: String(value) };
  }
}

export function installClientDiagnostics() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  window.addEventListener("error", (event) => {
    const errorEvent = event as ErrorEvent;
    const details = errorDetails(errorEvent.error || errorEvent.message);
    void reportClientDiagnostic({ kind: "error", ...details, path: window.location.pathname });
  });
  window.addEventListener("unhandledrejection", (event) => {
    const details = errorDetails(event.reason);
    void reportClientDiagnostic({ kind: "unhandledrejection", ...details, path: window.location.pathname });
  });
  window.addEventListener("online", () => void flushQueue());
  void flushQueue();
}

export function reportReactRecovery(error: unknown, componentStack?: string) {
  const details = errorDetails(error);
  return reportClientDiagnostic({
    kind: "react",
    ...details,
    stack: [details.stack, componentStack].filter(Boolean).join("\n"),
    path: typeof window !== "undefined" ? window.location.pathname : undefined,
  });
}
