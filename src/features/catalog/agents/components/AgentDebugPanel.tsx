// ──────────────────────────────────────────────
// Component: Agent Debug Panel
// ──────────────────────────────────────────────
// Collapsible overlay showing agent batch diagnostics.
// Only renders when debug mode is enabled in settings.
// ──────────────────────────────────────────────
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bug, ChevronDown, ChevronUp, X, CheckCircle2, XCircle, Clock, FileText, Wrench } from "lucide-react";
import { useAgentStore } from "../../../../shared/stores/agent.store";
import { useUIStore } from "../../../../shared/stores/ui.store";
import { cn } from "../../../../shared/lib/utils";

export function AgentDebugPanel() {
  const debugMode = useUIStore((s) => s.debugMode);
  const debugLog = useAgentStore((s) => s.debugLog);
  const lastResults = useAgentStore((s) => s.lastResults);
  const clearDebugLog = useAgentStore((s) => s.clearDebugLog);
  const [collapsed, setCollapsed] = useState(true);
  const groupedEntries = useMemo(
    () => ({
      setup: debugLog.filter((e) => e.agents && !e.results),
      results: debugLog.filter((e) => e.results),
      tools: debugLog.filter((e) => e.toolCall || e.toolResult),
      details: debugLog.filter((e) => !e.agents && !e.results && !e.toolCall && !e.toolResult),
    }),
    [debugLog],
  );

  // Show panel if debug mode is on and we have debug entries OR agent results
  const hasResults = lastResults.size > 0;
  if (!debugMode || (debugLog.length === 0 && !hasResults)) return null;

  // Group entries by phase pattern: setup phases and result phases
  const setupEntries = groupedEntries.setup;
  const resultEntries = groupedEntries.results;
  const toolEntries = groupedEntries.tools;
  const detailEntries = groupedEntries.details;

  // Dock bottom-right to clear the main editor content pane. Use a tall bottom
  // offset so this sits above the AgentThoughtBubbles overlay (bottom-20 right-4)
  // and the two bottom-right panels do not overlap.
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="fixed bottom-96 right-4 z-50 w-80 max-w-[calc(100vw-2rem)]"
    >
      {/* Header */}
      <div
        className={cn(
          "flex items-center gap-2 rounded-t-lg bg-[var(--card)] px-3 py-2 border border-[var(--border)] border-b-0",
          "shadow-lg shadow-black/20 cursor-pointer",
          collapsed && "rounded-b-lg border-b",
        )}
        onClick={() => setCollapsed(!collapsed)}
      >
        <Bug size="0.875rem" className="shrink-0 text-amber-500" />
        <span className="flex-1 text-xs font-medium text-[var(--foreground)]">
          Agent Debug
          <span className="ml-1.5 text-[var(--muted-foreground)]">
            ({debugLog.length} event{debugLog.length !== 1 ? "s" : ""})
          </span>
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setCollapsed(!collapsed);
          }}
          className="rounded p-0.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
        >
          {collapsed ? <ChevronUp size="0.875rem" /> : <ChevronDown size="0.875rem" />}
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            clearDebugLog();
          }}
          className="rounded p-0.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          title="Clear debug log"
        >
          <X size="0.875rem" />
        </button>
      </div>

      {/* Content */}
      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden rounded-b-lg border border-t-0 border-[var(--border)] bg-[var(--card)] shadow-lg shadow-black/20"
          >
            <div className="max-h-72 overflow-y-auto p-2 flex flex-col gap-2 text-xs">
              {/* Batch setup info */}
              {setupEntries.map((entry, i) => (
                <div key={`setup-${i}`} className="rounded-md bg-[var(--muted)]/30 p-2">
                  <div className="font-semibold text-amber-500 mb-1">
                    {formatPhase(entry.phase)}
                    {entry.batchMaxTokens != null && (
                      <span className="ml-2 font-normal text-[var(--muted-foreground)]">
                        batch max: {entry.batchMaxTokens.toLocaleString()} tokens
                      </span>
                    )}
                  </div>
                  {entry.agents && (
                    <div className="flex flex-col gap-0.5">
                      {entry.agents.map((a) => (
                        <div key={a.type} className="flex items-center gap-1.5 text-[var(--muted-foreground)]">
                          <span className="text-[var(--foreground)] font-medium">{a.name}</span>
                          <span className="opacity-60">·</span>
                          <span className="truncate opacity-70">{a.model}</span>
                          <span className="opacity-60">·</span>
                          <span className="opacity-70">{a.maxTokens.toLocaleString()}t</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {/* Results from debug log */}
              {resultEntries.map((entry, i) => (
                <div key={`result-${i}`} className="rounded-md bg-[var(--muted)]/30 p-2">
                  <div className="font-semibold text-blue-400 mb-1">Results</div>
                  <div className="flex flex-col gap-0.5">
                    {entry.results!.map((r) => (
                      <div key={r.agentType} className="flex items-center gap-1.5">
                        {r.success ? (
                          <CheckCircle2 size="0.75rem" className="shrink-0 text-emerald-500" />
                        ) : (
                          <XCircle size="0.75rem" className="shrink-0 text-red-500" />
                        )}
                        <span className={cn("font-medium", r.success ? "text-[var(--foreground)]" : "text-red-400")}>
                          {r.agentType}
                        </span>
                        <span className="flex items-center gap-0.5 text-[var(--muted-foreground)]">
                          <Clock size="0.625rem" />
                          {(r.durationMs / 1000).toFixed(1)}s
                        </span>
                        {r.tokensUsed > 0 && (
                          <span className="text-[var(--muted-foreground)]">{r.tokensUsed.toLocaleString()}t</span>
                        )}
                        {r.error && (
                          <span className="truncate text-red-400" title={r.error}>
                            {r.error}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {/* Tool calls/results */}
              {toolEntries.map((entry, i) => {
                const call = entry.toolCall;
                const result = entry.toolResult;
                const name = call?.name ?? result?.name ?? "unknown_tool";
                const payload = call?.arguments ?? result?.result ?? "";
                const blocked = call?.allowed === false;
                const failed = result ? !result.success : blocked;

                return (
                  <div key={`tool-${i}`} className="rounded-md bg-[var(--muted)]/30 p-2">
                    <div className="mb-1 flex items-center gap-1.5 font-semibold text-violet-400">
                      <Wrench size="0.75rem" className="shrink-0" />
                      <span>{call ? "Tool Call" : "Tool Result"}</span>
                      <span className={cn("truncate font-medium", failed && "text-red-400")}>{name}</span>
                      {result &&
                        (result.success ? (
                          <CheckCircle2 size="0.75rem" className="shrink-0 text-emerald-500" />
                        ) : (
                          <XCircle size="0.75rem" className="shrink-0 text-red-500" />
                        ))}
                      {blocked && <span className="text-red-400">denied</span>}
                    </div>
                    {payload && (
                      <pre className="max-h-24 overflow-y-auto whitespace-pre-wrap break-words rounded bg-black/10 p-1.5 font-mono text-[0.6875rem] leading-snug text-[var(--muted-foreground)]">
                        {payload}
                      </pre>
                    )}
                  </div>
                );
              })}

              {/* Prompt, response, and lifecycle details */}
              {detailEntries.map((entry, i) => (
                <div key={`detail-${i}`} className="rounded-md bg-[var(--muted)]/30 p-2">
                  <div className="mb-1 flex items-center gap-1.5 font-semibold text-cyan-400">
                    <FileText size="0.75rem" className="shrink-0" />
                    <span>{formatDebugMessage(entry.message)}</span>
                    {entry.level && <span className="text-[var(--muted-foreground)]">{entry.level}</span>}
                  </div>
                  <div className="mb-1 text-[var(--muted-foreground)]">{formatPhase(entry.phase)}</div>
                  {entry.args && entry.args.length > 0 && (
                    <pre className="max-h-24 overflow-y-auto whitespace-pre-wrap break-words rounded bg-black/10 p-1.5 font-mono text-[0.6875rem] leading-snug text-[var(--muted-foreground)]">
                      {formatDebugArgs(entry.args)}
                    </pre>
                  )}
                </div>
              ))}

              {/* Fallback: show lastResults when no debug log entries */}
              {resultEntries.length === 0 &&
                toolEntries.length === 0 &&
                detailEntries.length === 0 &&
                lastResults.size > 0 && (
                  <div className="rounded-md bg-[var(--muted)]/30 p-2">
                    <div className="font-semibold text-blue-400 mb-1">Last Agent Results</div>
                    <div className="flex flex-col gap-0.5">
                      {Array.from(lastResults.entries()).map(([type, r]) => (
                        <div key={type} className="flex items-center gap-1.5">
                          {r.success ? (
                            <CheckCircle2 size="0.75rem" className="shrink-0 text-emerald-500" />
                          ) : (
                            <XCircle size="0.75rem" className="shrink-0 text-red-500" />
                          )}
                          <span className={cn("font-medium", r.success ? "text-[var(--foreground)]" : "text-red-400")}>
                            {r.agentType}
                          </span>
                          <span className="flex items-center gap-0.5 text-[var(--muted-foreground)]">
                            <Clock size="0.625rem" />
                            {(r.durationMs / 1000).toFixed(1)}s
                          </span>
                          {r.error && (
                            <span className="truncate text-red-400" title={r.error}>
                              {r.error}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function formatDebugMessage(message?: string): string {
  if (!message) return "Debug Event";
  return message
    .split("-")
    .filter(Boolean)
    .map((part) => part[0]!.toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDebugArgs(args: unknown[]): string {
  return args
    .map((arg) => {
      if (typeof arg === "string") return arg;
      try {
        return JSON.stringify(arg, null, 2);
      } catch {
        return String(arg);
      }
    })
    .join("\n\n");
}

function formatPhase(phase: string): string {
  switch (phase) {
    case "pre_generation":
      return "Pre-Generation";
    case "post_generation":
      return "Post-Generation";
    case "post_generation_results":
      return "Results";
    case "retry":
      return "Retry";
    default:
      return phase;
  }
}
