// ──────────────────────────────────────────────
// Agent activity: what the chat's agents did, with Stop, Retry failed,
// Re-run trackers and Clear trackers
//
// One component for every surface (the Tracker window, the Tracker Panel and
// Chat Settings). It needs only the chat id; the host draws the frame around it.
// ──────────────────────────────────────────────
import { useEffect, useMemo, useRef } from "react";
import type { Message } from "@marinara-engine/shared";
import { useAgentConfigs, useCustomAgentRuns } from "../../hooks/use-agents";
import { useAdvancedMemoryStatus } from "../../hooks/use-advanced-memory";
import {
  stopChatAgents,
  useCachedChatMessages,
  useChatAgentRuns,
  useClearTrackers,
} from "../../hooks/use-agent-activity";
import { selectUnseenAgentFailureCount, useAgentStore } from "../../stores/agent.store";
import { useUIStore } from "../../stores/ui.store";
import { cn } from "../../lib/utils";
import { RoleplayHUDActionsMenu } from "../chat/RoleplayHUDActionsMenu";

export interface AgentActivitySectionProps {
  chatId: string;
  /** The chat's messages, oldest first, when the host has them; otherwise the loaded transcript is used. */
  messages?: Message[];
  /** Runs after Clear or Re-run, so a host popover can close. */
  onAction?: () => void;
  className?: string;
  /** Match the Tracker Panel's compact rows and surfaces when embedded there. */
  trackerPanel?: boolean;
}

export function AgentActivitySection({
  chatId,
  messages,
  onAction,
  className,
  trackerPanel,
}: AgentActivitySectionProps) {
  const runs = useChatAgentRuns(chatId);
  const advancedMemoryEnabled = runs.meta.advancedMemory?.enabled === true;
  const { data: advancedMemoryStatus } = useAdvancedMemoryStatus(chatId, advancedMemoryEnabled);
  const { data: agentConfigs } = useAgentConfigs();
  const { data: customAgentRuns = [], isLoading: customAgentRunsLoading } = useCustomAgentRuns(chatId);
  const thoughtBubbles = useAgentStore((s) => s.thoughtBubbles);
  const dismissThoughtBubble = useAgentStore((s) => s.dismissThoughtBubble);
  const clearThoughtBubbles = useAgentStore((s) => s.clearThoughtBubbles);
  const showInjectionsTab = useUIStore((s) => s.debugMode);
  const cachedMessages = useCachedChatMessages(chatId);
  const clearTrackers = useClearTrackers(chatId);
  const memoryActive = advancedMemoryStatus?.settings.enabled && advancedMemoryStatus.job.id;
  const stopAgents = useMemo(() => () => stopChatAgents(chatId), [chatId]);
  const rootRef = useRef<HTMLDivElement>(null);
  const unseenFailures = useAgentStore((s) => selectUnseenAgentFailureCount(s, chatId) > 0);

  // Failures count as seen once this section is on screen, which clears the icon's dot (#7322).
  useEffect(() => {
    const root = rootRef.current;
    if (!unseenFailures || !root) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) useAgentStore.getState().markFailedAgentsSeen(chatId);
    });
    observer.observe(root);
    return () => observer.disconnect();
  }, [chatId, unseenFailures]);

  return (
    <div ref={rootRef} data-component="AgentActivitySection" className={cn("min-w-0", className)}>
      <RoleplayHUDActionsMenu
        trackerPanel={trackerPanel}
        chatId={chatId}
        advancedMemoryStatus={memoryActive ? advancedMemoryStatus : undefined}
        injectionSourceMessages={messages ?? cachedMessages}
        isAgentProcessing={runs.isAgentProcessing}
        isGenerationBusy={runs.busy}
        thoughtBubbles={thoughtBubbles}
        clearThoughtBubbles={clearThoughtBubbles}
        dismissThoughtBubble={dismissThoughtBubble}
        customAgentRuns={customAgentRuns}
        customAgentRunsLoading={customAgentRunsLoading}
        agentConfigs={agentConfigs}
        enabledAgentTypes={runs.enabledAgentTypes}
        clearGameState={clearTrackers}
        onRetriggerTrackers={runs.rerunTrackers}
        onRetryFailedAgents={runs.retryFailedAgents}
        onStopAgents={stopAgents}
        failedAgentTypes={runs.failedAgentTypes}
        failedAgentFailures={runs.failedAgentFailures}
        onClose={() => onAction?.()}
        showInjectionsTab={showInjectionsTab}
      />
    </div>
  );
}
