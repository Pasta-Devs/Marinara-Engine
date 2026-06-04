import { Suspense, lazy, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, Sparkles } from "lucide-react";
import { cn } from "../../../../shared/lib/utils";
import type { AgentFailure } from "../../../../shared/lib/agent-failures";
import { useAgentStore } from "../../../../shared/stores/agent.store";
import { useCustomAgentRuns, type AgentConfigRow } from "../../../catalog/agents/index";
import { useUIStore } from "../../../../shared/stores/ui.store";
import type { Message } from "../../../../engine/contracts/types/chat";

const ACTIONS_DROPDOWN_WIDTH_PX = 288;

const RoleplayHUDActionsMenu = lazy(async () =>
  import("./RoleplayHUDActionsMenu").then((module) => ({ default: module.RoleplayHUDActionsMenu })),
);

function DeferredActionsFallback({ isAgentProcessing }: { isAgentProcessing: boolean }) {
  return (
    <div className="px-3 py-4 text-center text-[0.625rem] text-[var(--muted-foreground)]/60">
      {isAgentProcessing ? "Loading agent activity…" : "Loading actions…"}
    </div>
  );
}

function customAgentRunIdentity(run: { agentType?: string | null; agentId?: string | null; id?: string | null }): string {
  return run.agentType?.trim() || run.agentId?.trim() || run.id?.trim() || "custom-agent";
}

interface ActionsGroupProps {
  chatId: string;
  injectionSourceMessages?: Message[];
  agentConfigs?: AgentConfigRow[];
  isVertical: boolean;
  agentsOpen: boolean;
  setAgentsOpen: (v: boolean) => void;
  isAgentProcessing: boolean;
  isGenerationBusy: boolean;
  thoughtBubbles: Array<{ agentId: string; agentName: string; content: string; timestamp: number }>;
  clearThoughtBubbles: () => void;
  dismissThoughtBubble: (i: number) => void;
  enabledAgentTypes: Set<string>;
  clearGameState: () => void;
  onRetriggerTrackers?: () => void;
  onRetryFailedAgents?: () => void;
  onRetryAgent?: (agentType: string) => void;
  failedAgentTypes: string[];
  failedAgentFailures: AgentFailure[];
  showInjectionsTab?: boolean;
  showSecretPlotTab?: boolean;
}

export function ActionsGroup({
  chatId,
  injectionSourceMessages,
  agentConfigs,
  isVertical: _isVertical,
  agentsOpen,
  setAgentsOpen,
  isAgentProcessing,
  isGenerationBusy,
  thoughtBubbles,
  clearThoughtBubbles,
  dismissThoughtBubble,
  enabledAgentTypes,
  clearGameState,
  onRetriggerTrackers,
  onRetryFailedAgents,
  onRetryAgent,
  failedAgentTypes,
  failedAgentFailures,
  showInjectionsTab,
  showSecretPlotTab,
}: ActionsGroupProps) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const echoChamberOpen = useUIStore((s) => s.echoChamberOpen);
  const toggleEchoChamber = useUIStore((s) => s.toggleEchoChamber);
  const echoMessages = useAgentStore((s) => s.echoMessages);
  const showEcho = enabledAgentTypes.has("echo-chamber");
  const { data: customAgentRuns = [], isLoading: customAgentRunsLoading } = useCustomAgentRuns(chatId, agentsOpen);

  const updatePosition = useCallback(() => {
    if (!agentsOpen || !btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const maxH = 320;
    const padding = 8;
    const desiredTop = rect.bottom + 4 + maxH > window.innerHeight ? rect.top - maxH - 4 : rect.bottom + 4;
    const maxTop = Math.max(padding, window.innerHeight - maxH - padding);
    const top = Math.min(Math.max(desiredTop, padding), maxTop);
    const maxLeft = Math.max(padding, window.innerWidth - ACTIONS_DROPDOWN_WIDTH_PX - padding);
    const left = Math.min(Math.max(rect.left, padding), maxLeft);
    setPos({ top, left });
  }, [agentsOpen]);

  // Position with fixed layout to avoid overflow clipping.
  useLayoutEffect(updatePosition, [updatePosition]);

  useEffect(() => {
    if (!agentsOpen) return;
    let frame = 0;
    const scheduleUpdate = () => {
      if (frame) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        updatePosition();
      });
    };
    window.addEventListener("resize", scheduleUpdate);
    window.addEventListener("scroll", scheduleUpdate, true);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", scheduleUpdate);
      window.removeEventListener("scroll", scheduleUpdate, true);
    };
  }, [agentsOpen, updatePosition]);

  // Close on outside click or Escape
  useEffect(() => {
    if (!agentsOpen) return;
    const handler = (e: MouseEvent) => {
      if (btnRef.current?.contains(e.target as Node) || dropdownRef.current?.contains(e.target as Node)) return;
      setAgentsOpen(false);
    };
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAgentsOpen(false);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", keyHandler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", keyHandler);
    };
  }, [agentsOpen, setAgentsOpen]);

  // Badge count — unique agent types that produced results
  const generatedAgentIds = new Set([
    ...thoughtBubbles.map((bubble) => bubble.agentId),
    ...customAgentRuns.map(customAgentRunIdentity),
  ]);
  if (echoMessages.length > 0 && !generatedAgentIds.has("echo-chamber")) generatedAgentIds.add("echo-chamber");
  const generatedAgentCount = generatedAgentIds.size;

  // ── Shared dropdown portal (used by both desktop & mobile) ──
  const dropdownContent =
    agentsOpen &&
    pos &&
    createPortal(
      <div
        ref={dropdownRef}
        className="fixed w-72 max-w-[calc(100vw-1rem)] max-h-80 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--popover)] backdrop-blur-xl shadow-xl z-[9999] animate-message-in dark:border-foreground/10 dark:bg-black/80"
        style={{ top: pos.top, left: pos.left }}
      >
        <Suspense fallback={<DeferredActionsFallback isAgentProcessing={isAgentProcessing} />}>
          <RoleplayHUDActionsMenu
            chatId={chatId}
            injectionSourceMessages={injectionSourceMessages}
            isAgentProcessing={isAgentProcessing}
            isGenerationBusy={isGenerationBusy}
            thoughtBubbles={thoughtBubbles}
            clearThoughtBubbles={clearThoughtBubbles}
            dismissThoughtBubble={dismissThoughtBubble}
            customAgentRuns={customAgentRuns}
            customAgentRunsLoading={customAgentRunsLoading}
            agentConfigs={agentConfigs}
            enabledAgentTypes={enabledAgentTypes}
            showEcho={showEcho}
            echoChamberOpen={echoChamberOpen}
            toggleEchoChamber={toggleEchoChamber}
            echoMessageCount={echoMessages.length}
            clearGameState={clearGameState}
            onRetriggerTrackers={onRetriggerTrackers}
            onRetryFailedAgents={onRetryFailedAgents}
            onRetryAgent={onRetryAgent}
            failedAgentTypes={failedAgentTypes}
            failedAgentFailures={failedAgentFailures}
            onClose={() => setAgentsOpen(false)}
            showInjectionsTab={showInjectionsTab}
            showSecretPlotTab={showSecretPlotTab}
          />
        </Suspense>
      </div>,
      document.body,
    );

  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={() => setAgentsOpen(!agentsOpen)}
        className={cn(
          "group flex items-center gap-1.5 md:gap-1 rounded-lg border border-[var(--border)] bg-[var(--card)]/80 backdrop-blur-md px-2 py-1.5 md:px-2 md:py-2 md:h-10 transition-all hover:bg-[var(--card)] dark:border-foreground/10 dark:bg-black/40 dark:hover:bg-black/60 cursor-pointer select-none",
          agentsOpen && "bg-[var(--card)] border-[var(--border)] dark:bg-black/60 dark:border-foreground/20",
        )}
        title={`Agents & Actions${generatedAgentCount > 0 ? ` - ${generatedAgentCount} generated` : ""}${
          failedAgentTypes.length > 0 ? ` - ${failedAgentTypes.length} failed` : ""
        }`}
      >
        {isAgentProcessing ? (
          <Loader2
            size="0.875rem"
            strokeWidth={2.5}
            className="shrink-0 animate-spin text-foreground/75 transition-colors group-hover:text-foreground/80"
          />
        ) : (
          <Sparkles
            size="0.875rem"
            strokeWidth={2.5}
            className={cn(
              "shrink-0 transition-colors group-hover:text-foreground/75",
              agentsOpen ? "text-foreground/75" : "text-foreground/55",
            )}
          />
        )}
        {generatedAgentCount > 0 && (
          <span className="hidden md:flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-foreground/15 px-1 text-[0.5rem] font-bold text-foreground/80 ring-1 ring-foreground/10">
            {generatedAgentCount}
          </span>
        )}
        {failedAgentTypes.length > 0 && (
          <span className="flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-amber-500/80 px-1 text-[0.5rem] font-bold text-foreground">
            {failedAgentTypes.length}
          </span>
        )}
      </button>
      {dropdownContent}
    </div>
  );
}
