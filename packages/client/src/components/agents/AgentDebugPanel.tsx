// ──────────────────────────────────────────────
// Component: Agent Debug Panel
// ──────────────────────────────────────────────
// Collapsible overlay showing agent batch diagnostics.
// Only renders when debug mode is enabled in settings.
// ──────────────────────────────────────────────
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bug, ChevronDown, ChevronUp, X, CheckCircle2, XCircle, Clock, Wrench, FileText } from "lucide-react";
import { useAgentStore } from "../../stores/agent.store";
import { useUIStore } from "../../stores/ui.store";
import { cn } from "../../lib/utils";

export function AgentDebugPanel() {
  const debugMode = useUIStore((s) => s.debugMode);
  const debugLog = useAgentStore((s) => s.debugLog);
  const lastResults = useAgentStore((s) => s.lastResults);
  const clearDebugLog = useAgentStore((s) => s.clearDebugLog);
  const [collapsed, setCollapsed] = useState(true);

  // Show panel if debug mode is on and we have debug entries OR agent results
  const hasResults = lastResults.size > 0;
  if (!debugMode || (debugLog.length === 0 && !hasResults)) return null;

  // Group entries by phase pattern: setup phases and result phases
  const setupEntries = debugLog.filter((e) => e.agents && !e.results);
  const resultEntries = debugLog.filter((e) => e.results);
  const toolEntries = debugLog.filter((e) => e.toolCall || e.toolResult);
  const callEntries = debugLog.filter((e) => e.agentCall);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="fixed bottom-20 left-4 z-50 w-80 max-w-[calc(100vw-2rem)]"
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
              {/* Agent model calls */}
              {callEntries.map((entry, i) => {
                const call = entry.agentCall!;
                const payload =
                  call.stage === "request" || call.stage === "retry_request"
                    ? formatAgentCallMessages(call.messages)
                    : call.responsePreview || call.response || call.error || "";
                return (
                  <div key={`agent-call-${i}`} className="rounded-md bg-[var(--muted)]/30 p-2">
                    <div className="mb-1 flex items-center gap-1.5 font-semibold text-cyan-400">
                      <FileText size="0.75rem" className="shrink-0" />
                      <span>{formatAgentCallStage(call.stage)}</span>
                      <span className="truncate font-medium text-[var(--foreground)]">{call.agentName}</span>
                    </div>
                    <div className="mb-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[0.625rem] text-[var(--muted-foreground)]">
                      <span className="truncate">{call.model}</span>
                      <span>{call.messageCount} msg</span>
                      <span>{call.maxTokens.toLocaleString()} max</span>
                      {call.round != null && <span>round {call.round}</span>}
                      {call.durationMs != null && <span>{(call.durationMs / 1000).toFixed(1)}s</span>}
                      {formatAgentCallTokens(call) && <span>{formatAgentCallTokens(call)}</span>}
                      {call.batchedAgentTypes?.length ? <span>batch: {call.batchedAgentTypes.join(", ")}</span> : null}
                    </div>
                    {payload && (
                      <pre className="max-h-28 overflow-y-auto whitespace-pre-wrap break-words rounded bg-black/10 p-1.5 font-mono text-[0.6875rem] leading-snug text-[var(--muted-foreground)]">
                        {payload.length > 2500 ? `${payload.slice(0, 2500)}...` : payload}
                      </pre>
                    )}
                  </div>
                );
              })}

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
                    <div className="mb-1 flex items-center gap-1.5 font-semibold text-[var(--muted-foreground)]">
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

              {/* Fallback: show lastResults when no debug log entries */}
              {callEntries.length === 0 && resultEntries.length === 0 && toolEntries.length === 0 && lastResults.size > 0 && (
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

function formatAgentCallStage(stage: string): string {
  switch (stage) {
    case "request":
      return "Prompt";
    case "response":
      return "Response";
    case "retry_request":
      return "Retry Prompt";
    case "retry_response":
      return "Retry Response";
    case "error":
      return "Error";
    default:
      return stage;
  }
}

function formatAgentCallTokens(call: {
  promptTokens?: number;
  completionTokens?: number;
  reasoningTokens?: number;
  totalTokens?: number;
}): string {
  const parts = [
    call.promptTokens != null ? `p ${call.promptTokens.toLocaleString()}` : null,
    call.completionTokens != null ? `c ${call.completionTokens.toLocaleString()}` : null,
    call.reasoningTokens != null ? `r ${call.reasoningTokens.toLocaleString()}` : null,
    call.totalTokens != null ? `t ${call.totalTokens.toLocaleString()}` : null,
  ].filter(Boolean);
  return parts.join(" / ");
}

function formatAgentCallMessages(messages?: Array<{ role: string; content: string; name?: string }>): string {
  if (!messages?.length) return "";
  return messages.map((message) => `[${message.role}${message.name ? `:${message.name}` : ""}]\n${message.content}`).join("\n\n");
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
