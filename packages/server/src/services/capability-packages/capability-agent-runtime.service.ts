import type { AgentContext, AgentResult } from "@marinara-engine/shared";
import { logger } from "../../lib/logger.js";
import type { AgentExecConfig } from "../agents/agent-executor.js";
import { withDeadline } from "./capability-prompt-context.service.js";
import { getCapabilityService } from "./capability-service-registry.service.js";

const SERVICE_PREFIX = "agent-runtime:";

export function assertCapabilityAgentRuntimeServiceRegistration(
  packageId: string,
  permissions: readonly string[],
  key: string,
): void {
  if (!key.startsWith(SERVICE_PREFIX)) return;
  if (!permissions.includes("agent-runtime")) {
    throw new Error(`Capability package ${packageId} must declare the "agent-runtime" permission`);
  }
  if (key !== `${SERVICE_PREFIX}${packageId}`) {
    throw new Error(`Capability package ${packageId} cannot register an agent runtime for another package`);
  }
}

export interface CapabilityAgentRuntimeService {
  prepareContext?(input: { agent: AgentExecConfig; context: AgentContext }): Promise<unknown> | unknown;
  finalizeResult?(input: {
    agent: AgentExecConfig;
    context: AgentContext;
    preparedContext: unknown;
    result: AgentResult;
  }): Promise<AgentResult> | AgentResult;
}

function runtimeFor(agentType: string): CapabilityAgentRuntimeService | null {
  return getCapabilityService<CapabilityAgentRuntimeService>(`${SERVICE_PREFIX}${agentType}`);
}

export function shouldDeferCapabilityAgentResult(agentType: string, finalized = false): boolean {
  return !finalized && typeof runtimeFor(agentType)?.finalizeResult === "function";
}

export async function prepareCapabilityAgentContexts(
  agents: AgentExecConfig[],
  context: AgentContext,
): Promise<AgentContext> {
  const prepared: Record<string, unknown> = {};
  for (const agent of agents) {
    const runtime = runtimeFor(agent.type);
    if (!runtime?.prepareContext) continue;
    try {
      const value = await withDeadline(
        runtime.prepareContext({ agent, context }),
        `agent-runtime prepareContext ${agent.type}`,
      );
      if (value !== null && value !== undefined) prepared[agent.type] = value;
    } catch (error) {
      logger.warn(error, "Capability agent context preparation failed for %s", agent.type);
    }
  }
  if (Object.keys(prepared).length === 0) return context;
  return {
    ...context,
    memory: {
      ...context.memory,
      _capabilityAgentContexts: prepared,
    },
  };
}

export async function finalizeCapabilityAgentResults(
  results: AgentResult[],
  agents: AgentExecConfig[],
  context: AgentContext,
): Promise<AgentResult[]> {
  const agentById = new Map(agents.map((agent) => [agent.id, agent]));
  const prepared = context.memory._capabilityAgentContexts;
  const preparedByType =
    prepared && typeof prepared === "object" && !Array.isArray(prepared) ? (prepared as Record<string, unknown>) : {};

  return Promise.all(
    results.map(async (result) => {
      const agent = agentById.get(result.agentId);
      const runtime = agent ? runtimeFor(agent.type) : null;
      if (!agent || !runtime?.finalizeResult) return result;
      try {
        return await withDeadline(
          runtime.finalizeResult({
            agent,
            context,
            preparedContext: preparedByType[agent.type],
            result,
          }),
          `agent-runtime finalizeResult ${agent.type}`,
        );
      } catch (error) {
        logger.warn(error, "Capability agent result finalization failed for %s", agent.type);
        return {
          ...result,
          success: false,
          error: error instanceof Error ? error.message : "Capability agent result validation failed",
        };
      }
    }),
  );
}
