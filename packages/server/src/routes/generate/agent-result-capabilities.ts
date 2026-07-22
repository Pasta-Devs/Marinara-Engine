import { customAgentHasCapability, type AgentResult } from "@marinara-engine/shared";

import type { ResolvedAgent } from "../../services/agents/agent-pipeline.js";

export function findResultAgent(result: AgentResult, agents: ResolvedAgent[]): ResolvedAgent | null {
  return agents.find((agent) => agent.id === result.agentId || agent.type === result.agentType) ?? null;
}

export function isAbortLikeError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

export function shouldAutomaticallyRetryAgentResult(result: Pick<AgentResult, "success" | "error">): boolean {
  if (result.success) return false;
  return !/\b(?:timed?\s*out|timeout|etimedout|deadline exceeded)\b/i.test(result.error ?? "");
}

export function customAgentCanApplyResult(
  result: AgentResult,
  agents: ResolvedAgent[],
  builtInAgentTypes: Set<string>,
  capability: Parameters<typeof customAgentHasCapability>[1],
): boolean {
  if (builtInAgentTypes.has(result.agentType)) return true;
  const agent = findResultAgent(result, agents);
  return agent ? customAgentHasCapability(agent.settings, capability) : false;
}

export function customAgentCanEmitResult(
  result: AgentResult,
  agents: ResolvedAgent[],
  builtInAgentTypes: Set<string>,
): boolean {
  if (builtInAgentTypes.has(result.agentType)) return true;
  switch (result.type) {
    case "text_rewrite":
      return customAgentCanApplyResult(result, agents, builtInAgentTypes, "edit_messages");
    case "lorebook_update":
      return (
        customAgentCanApplyResult(result, agents, builtInAgentTypes, "edit_lorebooks") ||
        customAgentCanApplyResult(result, agents, builtInAgentTypes, "create_lorebooks")
      );
    case "game_state_update":
    case "character_tracker_update":
    case "persona_stats_update":
    case "custom_tracker_update":
    case "quest_update":
      return customAgentCanApplyResult(result, agents, builtInAgentTypes, "edit_trackers");
    case "image_prompt":
      return customAgentCanApplyResult(result, agents, builtInAgentTypes, "trigger_image_generation");
    case "prompt_patch":
      return customAgentCanApplyResult(result, agents, builtInAgentTypes, "edit_main_prompt");
    case "frontend_theme_update":
      return customAgentCanApplyResult(result, agents, builtInAgentTypes, "change_frontend_styling");
    default:
      return true;
  }
}
