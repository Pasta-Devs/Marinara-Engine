import { useCallback } from "react";
import { useAgentStore } from "../../../../shared/stores/agent.store";
import { useChatStore } from "../../../../shared/stores/chat.store";
import { useGenerate } from "../../generation/index";
import { TRACKER_AGENT_TYPE_IDS } from "../../world-state/index";

export function useTrackerRerun({
  activeChatId,
  enabledAgentTypes,
  gameStateRefreshing,
}: {
  activeChatId: string | null;
  enabledAgentTypes: Set<string>;
  gameStateRefreshing: boolean;
}) {
  const streamingChatId = useChatStore((s) => s.streamingChatId);
  const isStreamingGlobal = useChatStore((s) => s.isStreaming);
  const isAgentProcessing = useAgentStore((s) => s.isProcessing);
  const { retryAgents } = useGenerate();
  const isStreaming = isStreamingGlobal && streamingChatId === activeChatId;
  const trackerRetryBusy = isAgentProcessing || isStreaming || gameStateRefreshing;

  const rerunTracker = useCallback(
    async (agentType: string) => {
      if (
        !activeChatId ||
        trackerRetryBusy ||
        !TRACKER_AGENT_TYPE_IDS.has(agentType) ||
        !enabledAgentTypes.has(agentType)
      ) {
        return;
      }
      try {
        await retryAgents(activeChatId, [agentType]);
      } catch (error) {
        console.warn("Failed to re-run tracker agents.", error);
      }
    },
    [activeChatId, enabledAgentTypes, retryAgents, trackerRetryBusy],
  );

  return { rerunTracker, trackerRetryBusy };
}
