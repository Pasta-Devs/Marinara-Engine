import type { AgentResult } from "@marinara-engine/shared";
import type { ResolvedAgent } from "../agents/agent-pipeline.js";
import { shouldDeferSpotifyAgentEvent } from "./spotify-agent-runtime.js";

export function shouldDeferExpressionAgentEvent(result: AgentResult): boolean {
  return result.success && result.agentType === "expression" && result.type === "sprite_change";
}

export function createAgentEventDispatcher({
  resolvedAgents,
  sendEvent,
}: {
  resolvedAgents: ResolvedAgent[];
  sendEvent(payload: Record<string, unknown>): void;
}) {
  const sendAgentResultEvent = (result: AgentResult) => {
    sendEvent({
      type: "agent_result",
      data: {
        agentType: result.agentType,
        agentName: resolvedAgents.find((agent) => agent.type === result.agentType)?.name ?? result.agentType,
        resultType: result.type,
        data: result.data,
        success: result.success,
        error: result.error,
        durationMs: result.durationMs,
      },
    });
  };

  const sendAgentEvent = (result: AgentResult, options: { finalized?: boolean } = {}) => {
    if (!options.finalized && (shouldDeferSpotifyAgentEvent(result) || shouldDeferExpressionAgentEvent(result))) {
      return;
    }
    sendAgentResultEvent(result);
  };

  return { sendAgentEvent, sendAgentResultEvent };
}
