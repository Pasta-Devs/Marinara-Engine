import type { AgentContext, AgentDebugEntry } from "../contracts/types/agent";

export type AgentRuntimeDebugEntry = Omit<AgentDebugEntry, "timestamp"> & { timestamp?: number };

export interface AgentRuntimeDebugLogger {
  enabled: boolean;
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  isLevelEnabled: (_level: string) => boolean;
  emit: (entry: AgentRuntimeDebugEntry) => void;
}

type ConsoleLevel = "debug" | "info" | "warn" | "error";

const MAX_DEBUG_STRING_LENGTH = 4_000;
const MAX_DEBUG_ARRAY_ITEMS = 24;
const MAX_DEBUG_OBJECT_KEYS = 48;
const MAX_DEBUG_DEPTH = 4;

function truncateDebugString(value: string): string {
  if (value.length <= MAX_DEBUG_STRING_LENGTH) return value;
  return `${value.slice(0, MAX_DEBUG_STRING_LENGTH)}\n\n[debug output truncated before UI dispatch: ${value.length - MAX_DEBUG_STRING_LENGTH} more characters]`;
}

function compactDebugValue(value: unknown, depth = 0): unknown {
  if (typeof value === "string") return truncateDebugString(value);
  if (!value || typeof value !== "object") return value;
  if (depth >= MAX_DEBUG_DEPTH) return "[debug output truncated before UI dispatch: nested value]";
  if (Array.isArray(value)) {
    const compacted = value.slice(0, MAX_DEBUG_ARRAY_ITEMS).map((item) => compactDebugValue(item, depth + 1));
    if (value.length > MAX_DEBUG_ARRAY_ITEMS) {
      compacted.push(`[debug output truncated before UI dispatch: ${value.length - MAX_DEBUG_ARRAY_ITEMS} more items]`);
    }
    return compacted;
  }

  const entries = Object.entries(value as Record<string, unknown>);
  const compacted: Record<string, unknown> = {};
  for (const [key, item] of entries.slice(0, MAX_DEBUG_OBJECT_KEYS)) {
    compacted[key] = compactDebugValue(item, depth + 1);
  }
  if (entries.length > MAX_DEBUG_OBJECT_KEYS) {
    compacted.__truncated = `${entries.length - MAX_DEBUG_OBJECT_KEYS} more keys`;
  }
  return compacted;
}

function compactDebugArgs(args: unknown[]): unknown[] {
  return args.map((arg) => compactDebugValue(arg));
}

function compactDebugEntry(entry: AgentRuntimeDebugEntry): AgentRuntimeDebugEntry {
  return {
    ...entry,
    args: entry.args ? compactDebugArgs(entry.args) : undefined,
    results: entry.results?.map((result) => compactDebugValue(result) as never),
    toolCall: entry.toolCall
      ? {
          ...entry.toolCall,
          arguments: truncateDebugString(entry.toolCall.arguments),
        }
      : undefined,
    toolResult: entry.toolResult
      ? {
          ...entry.toolResult,
          result: truncateDebugString(entry.toolResult.result),
        }
      : undefined,
  };
}

function writeConsole(level: ConsoleLevel, args: unknown[]) {
  if (typeof console === "undefined") return;
  const target = typeof console[level] === "function" ? console[level] : console.log;
  if (typeof target === "function") target.apply(console, args);
}

function isAgentRuntimeDebugEnabled(context: Pick<AgentContext, "debugMode">): boolean {
  return context.debugMode === true;
}

export function createAgentRuntimeDebug(context: AgentContext): AgentRuntimeDebugLogger {
  const enabled = isAgentRuntimeDebugEnabled(context);

  const log = (level: ConsoleLevel, args: unknown[]) => {
    if (!enabled) return;
    writeConsole(level, compactDebugArgs(args));
  };

  return {
    enabled,
    debug: (...args: unknown[]) => log("debug", args),
    info: (...args: unknown[]) => log("info", args),
    warn: (...args: unknown[]) => log("warn", args),
    error: (...args: unknown[]) => log("error", args),
    isLevelEnabled: () => enabled,
    emit: (entry: AgentRuntimeDebugEntry) => {
      if (!enabled) return;
      context.debugSink?.({
        ...compactDebugEntry(entry),
        timestamp: entry.timestamp ?? Date.now(),
      });
    },
  };
}
