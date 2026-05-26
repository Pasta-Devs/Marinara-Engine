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

function writeConsole(level: ConsoleLevel, args: unknown[]) {
  if (typeof console === "undefined") return;
  const target = typeof console[level] === "function" ? console[level] : console.log;
  if (typeof target === "function") target.apply(console, args);
}

export function isAgentRuntimeDebugEnabled(context: Pick<AgentContext, "debugMode">): boolean {
  return context.debugMode === true;
}

export function createAgentRuntimeDebug(context: AgentContext): AgentRuntimeDebugLogger {
  const enabled = isAgentRuntimeDebugEnabled(context);

  const log = (level: ConsoleLevel, args: unknown[]) => {
    if (!enabled) return;
    writeConsole(level, args);
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
        ...entry,
        timestamp: entry.timestamp ?? Date.now(),
      });
    },
  };
}
