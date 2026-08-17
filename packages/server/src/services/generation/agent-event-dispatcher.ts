import type { AgentResult } from "@marinara-engine/shared";
import type { ResolvedAgent } from "../agents/agent-pipeline.js";
import { shouldDeferSpotifyAgentEvent } from "./spotify-agent-runtime.js";

export type AgentResultOwnership = {
  chatId: string;
  messageId: string | null;
  swipeIndex: number | null;
  generationId: string;
};

export function shouldDeferExpressionAgentEvent(result: AgentResult): boolean {
  return result.success && result.agentType === "expression" && result.type === "sprite_change";
}

export function createAgentEventDispatcher({
  resolvedAgents,
  sendEvent,
  getOwnership,
}: {
  resolvedAgents: ResolvedAgent[];
  sendEvent(payload: Record<string, unknown>): void;
  getOwnership?: (result: AgentResult) => AgentResultOwnership;
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
        ...(getOwnership?.(result) ?? {}),
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
