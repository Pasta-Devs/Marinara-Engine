// ──────────────────────────────────────────────
// Component: Floating Agent Thought Bubbles
// ──────────────────────────────────────────────
// Compact floating indicator that appears during/after generation
// to show agent activity without requiring the Agents panel open.
// ──────────────────────────────────────────────
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles, ChevronDown, ChevronUp, X } from "lucide-react";
import { useAgentStore } from "../../stores/agent.store";
import { cn } from "../../lib/utils";

export function AgentThoughtBubbles({ enabledAgentTypes }: { enabledAgentTypes?: Set<string> }) {
  const allThoughtBubbles = useAgentStore((s) => s.thoughtBubbles);
  const isProcessing = useAgentStore((s) => s.isProcessing);
  const dismissThoughtBubble = useAgentStore((s) => s.dismissThoughtBubble);
  const clearThoughtBubbles = useAgentStore((s) => s.clearThoughtBubbles);
  const [collapsed, setCollapsed] = useState(false);

  // Filter bubbles to only agents active in the current chat
  const thoughtBubbles = enabledAgentTypes
    ? allThoughtBubbles.filter((b) => enabledAgentTypes.has(b.agentId))
    : allThoughtBubbles;

  if (thoughtBubbles.length === 0 && !isProcessing) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="fixed bottom-20 right-4 z-50 w-72 max-w-[calc(100vw-2rem)]"
    >
      {/* Header bar */}
      <div
        className={cn(
          "flex items-center gap-2 rounded-t-lg bg-[var(--card)] px-3 py-2 border border-[var(--border)] border-b-0",
          "shadow-lg shadow-black/20",
          collapsed && "rounded-b-lg border-b",
        )}
      >
        <Sparkles size="0.875rem" className="shrink-0 text-[var(--primary)]" />
        <span className="flex-1 text-xs font-medium text-[var(--foreground)]">
          Agents
          {isProcessing && (
            <span className="ml-1.5 text-[var(--muted-foreground)]">
              <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.5, repeat: Infinity }}>
                thinking…
              </motion.span>
            </span>
          )}
        </span>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="rounded p-0.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
        >
          {collapsed ? <ChevronUp size="0.875rem" /> : <ChevronDown size="0.875rem" />}
        </button>
        {thoughtBubbles.length > 0 && (
          <button
            onClick={clearThoughtBubbles}
            className="rounded p-0.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            title="Dismiss all"
          >
            <X size="0.875rem" />
          </button>
        )}
      </div>

      {/* Bubble list */}
      <AnimatePresence>
        {!collapsed && thoughtBubbles.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden rounded-b-lg border border-t-0 border-[var(--border)] bg-[var(--card)] shadow-lg shadow-black/20"
          >
            <div className="max-h-48 overflow-y-auto p-2 flex flex-col gap-1.5">
              {thoughtBubbles.map((bubble, i) => (
                <motion.div
                  key={`${bubble.agentId}-${bubble.timestamp}`}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="relative rounded-md bg-[var(--primary)]/8 p-2 text-xs"
                >
                  <button
                    onClick={() => dismissThoughtBubble(i)}
                    className="absolute right-1 top-1 rounded text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                  >
                    <X size="0.75rem" />
                  </button>
                  <div className="pr-4">
                    <span className="font-semibold text-[var(--primary)]">{bubble.agentName}</span>
                    <p className="mt-0.5 whitespace-pre-wrap text-[var(--muted-foreground)] leading-relaxed">
                      {bubble.content}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
