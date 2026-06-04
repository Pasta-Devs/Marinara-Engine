import type { AgentContext, AgentResult } from "../../contracts/types/agent";
import type { LorebookEntry } from "../../contracts/types/lorebook";
import type { BaseLLMProvider } from "../../generation-core/llm/base-provider.js";
import { createAgentRuntimeDebug } from "../debug.js";
import {
  executeAgent,
  executeAgentBatch,
  type AgentExecConfig,
  type AgentToolContext,
} from "../executor/agent-executor.js";
import { executeKnowledgeRetrieval } from "../knowledge/knowledge-retrieval.js";
import { executeKnowledgeRouter, type KnowledgeRouterCandidateOptions } from "../knowledge/knowledge-router.js";

/** A fully resolved agent ready for execution. */
export interface ResolvedAgent extends AgentExecConfig {
  provider: BaseLLMProvider;
  model: string;
  /** Maximum number of concurrent agent LLM jobs allowed for this connection. */
  maxParallelJobs: number;
  /** Optional tool context for agents that need function calling (e.g., Spotify). */
  toolContext?: AgentToolContext;
  /** Source material selected for Knowledge Retrieval. */
  knowledgeSourceMaterial?: string;
  /** Candidate lorebook entries selected for Knowledge Router. */
  knowledgeRouterEntries?: LorebookEntry[];
  /** Router scan/semantic options derived from the current generation context. */
  knowledgeRouterOptions?: KnowledgeRouterCandidateOptions;
}

export interface AgentInjection {
  agentType: string;
  agentName?: string;
  text: string;
}

/** Callback fired whenever an agent produces a result. */
export type AgentResultCallback = (result: AgentResult) => void;

// ──────────────────────────────────────────────
// Grouping — batch agents by (connection, model)
// ──────────────────────────────────────────────

interface AgentGroup {
  connectionKey: string;
  provider: BaseLLMProvider;
  model: string;
  maxParallelJobs: number;
  agents: ResolvedAgent[];
}

function postProcessingDataAccessKey(agent: ResolvedAgent): string {
  if (agent.phase !== "post_processing") return "turn-data:off";
  return [
    `pre:${agent.settings.includePreGenInjections === true ? "1" : "0"}`,
    `parallel:${agent.settings.includeParallelResults === true ? "1" : "0"}`,
  ].join(":");
}

function normalizeMaxParallelJobs(value: unknown): number {
  const parsed = typeof value === "number" && Number.isFinite(value) ? Math.trunc(value) : 1;
  return Math.max(1, Math.min(16, parsed));
}

function groupByProviderModel(agents: ResolvedAgent[]): AgentGroup[] {
  const groups = new Map<string, AgentGroup>();

  for (const agent of agents) {
    const maxParallelJobs = normalizeMaxParallelJobs(agent.maxParallelJobs);
    const connectionKey = agent.connectionId ?? "default";
    const key = `${connectionKey}::${agent.model}::${postProcessingDataAccessKey(agent)}::jobs:${maxParallelJobs}`;
    let group = groups.get(key);
    if (!group) {
      group = {
        connectionKey,
        provider: agent.provider,
        model: agent.model,
        maxParallelJobs,
        agents: [],
      };
      groups.set(key, group);
    }
    group.agents.push(agent);
  }

  return Array.from(groups.values()).flatMap(splitGroupByMaxParallelJobs);
}

function splitGroupByMaxParallelJobs(group: AgentGroup): AgentGroup[] {
  const jobCount = Math.min(group.maxParallelJobs, group.agents.length);
  if (jobCount <= 1) return [group];

  const chunks = Array.from({ length: jobCount }, () => [] as ResolvedAgent[]);
  group.agents.forEach((agent, index) => {
    chunks[index % jobCount]!.push(agent);
  });

  return chunks
    .filter((agents) => agents.length > 0)
    .map((agents) => ({
      connectionKey: group.connectionKey,
      provider: group.provider,
      model: group.model,
      maxParallelJobs: group.maxParallelJobs,
      agents,
    }));
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = [];
  let nextIndex = 0;
  const workerCount = Math.max(1, Math.min(limit, items.length));

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      try {
        results[index] = { status: "fulfilled", value: await mapper(items[index]!) };
      } catch (error) {
        results[index] = { status: "rejected", reason: error };
      }
    }
  }

  await Promise.all(Array.from({ length: workerCount }, worker));
  return results;
}

function buildAgentContext(agentOrAgents: ResolvedAgent | ResolvedAgent[], context: AgentContext): AgentContext {
  const agents = Array.isArray(agentOrAgents) ? agentOrAgents : [agentOrAgents];
  if (!agents.some((agent) => agent.phase === "post_processing")) {
    return {
      ...context,
      preGenInjections: undefined,
      parallelResults: undefined,
    };
  }

  const includePreGenInjections = agents.some((agent) => agent.settings.includePreGenInjections === true);
  const includeParallelResults = agents.some((agent) => agent.settings.includeParallelResults === true);

  return {
    ...context,
    preGenInjections: includePreGenInjections ? (context.preGenInjections ?? []) : undefined,
    parallelResults: includeParallelResults ? (context.parallelResults ?? []) : undefined,
  };
}

function shouldExecuteIndividually(agent: ResolvedAgent): boolean {
  return (
    agent.type === "expression" ||
    agent.type === "echo-chamber" ||
    agent.type === "illustrator" ||
    agent.type === "spotify" ||
    agent.type === "knowledge-retrieval" ||
    agent.type === "knowledge-router" ||
    Boolean(agent.toolContext?.tools.length)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function getAgentResultText(data: unknown): string {
  if (typeof data === "string") return data;
  if (isRecord(data) && typeof data.text === "string") return data.text;
  return "";
}

async function executeResolvedAgent(agent: ResolvedAgent, context: AgentContext): Promise<AgentResult> {
  const agentContext = buildAgentContext(agent, context);
  if (agent.type === "knowledge-retrieval") {
    return executeKnowledgeRetrieval(
      agent,
      agentContext,
      agent.provider,
      agent.model,
      agent.knowledgeSourceMaterial ?? "",
    );
  }
  if (agent.type === "knowledge-router") {
    return executeKnowledgeRouter(
      agent,
      agentContext,
      agent.provider,
      agent.model,
      agent.knowledgeRouterEntries ?? [],
      agent.knowledgeRouterOptions,
    );
  }
  return executeAgent(agent, agentContext, agent.provider, agent.model, agent.toolContext);
}

/**
 * Execute a group of agents — batch if >1, single if 1.
 * Tool-using agents are extracted from batches and run individually.
 * Returns results and fires the onResult callback per agent.
 */
async function executeGroup(
  group: AgentGroup,
  context: AgentContext,
  onResult?: AgentResultCallback,
): Promise<AgentResult[]> {
  const logger = createAgentRuntimeDebug(context);
  const groupContext = buildAgentContext(group.agents, context);
  // Separate tool-using agents (can't be batched) from regular agents
  const individualAgents = group.agents.filter(shouldExecuteIndividually);
  const batchAgents = group.agents.filter((agent) => !shouldExecuteIndividually(agent));
  const toolAgentTypes = individualAgents.filter((agent) => agent.toolContext?.tools.length).map((agent) => agent.type);

  logger.debug(
    "[agent-pipeline] executeGroup: %d batchable, %d individual %j",
    batchAgents.length,
    individualAgents.length,
    {
      batch: batchAgents.map((a) => a.type),
      tools: toolAgentTypes,
      individual: individualAgents.map((a) => a.type),
    },
  );

  // Safe callback wrapper — errors in the callback (e.g. writing to a
  // closed SSE stream) must never crash the group and silently drop results.
  const safeOnResult = (result: AgentResult) => {
    try {
      onResult?.(result);
    } catch {
      /* swallow */
    }
  };

  const allResults: AgentResult[] = [];

  // Run regular agents as a batch
  if (batchAgents.length > 0) {
    const batchResults = await executeAgentBatch(batchAgents, groupContext, group.provider, group.model);
    for (const result of batchResults) {
      safeOnResult(result);
    }
    allResults.push(...batchResults);
  }

  // Run agents that need isolated prompts, source material, or tool loops individually.
  for (const agent of individualAgents) {
    const result = await executeResolvedAgent(agent, context);
    safeOnResult(result);
    allResults.push(result);
  }

  return allResults;
}

/**
 * Execute all agents for a given phase, grouped + batched.
 */
async function executePhase(
  agents: ResolvedAgent[],
  phase: string,
  context: AgentContext,
  onResult?: AgentResultCallback,
): Promise<AgentResult[]> {
  const phaseAgents = agents.filter((a) => a.phase === phase);
  if (phaseAgents.length === 0) return [];

  const logger = createAgentRuntimeDebug(context);
  const groups = groupByProviderModel(phaseAgents);
  logger.emit({
    level: "debug",
    phase,
    message: "phase-groups",
    args: [phaseAgents.length, groups.length],
  });

  logger.debug(
    '[agent-pipeline] Phase "%s": %d agents → %d job group(s) %j',
    phase,
    phaseAgents.length,
    groups.length,
    groups.map((g) => `[${g.agents.map((a) => a.type).join(", ")}] (model: ${g.model})`),
  );

  // Run groups in parallel across connections, while each connection honors its
  // configured agent LLM job cap.
  const groupsByConnection = new Map<string, Array<{ group: AgentGroup; index: number }>>();
  for (let index = 0; index < groups.length; index += 1) {
    const group = groups[index]!;
    const connectionGroups = groupsByConnection.get(group.connectionKey) ?? [];
    connectionGroups.push({ group, index });
    groupsByConnection.set(group.connectionKey, connectionGroups);
  }

  const settled: PromiseSettledResult<AgentResult[]>[] = [];
  await Promise.all(
    Array.from(groupsByConnection.values()).map((connectionGroups) =>
      mapWithConcurrency(
        connectionGroups,
        Math.max(...connectionGroups.map(({ group }) => group.maxParallelJobs)),
        async ({ group, index }) => {
          try {
            const result = await executeGroup(group, context, onResult);
            settled[index] = { status: "fulfilled", value: result };
            return result;
          } catch (error) {
            settled[index] = { status: "rejected", reason: error };
            throw error;
          }
        },
      ),
    ),
  );
  for (let index = 0; index < groups.length; index += 1) {
    if (!settled[index]) {
      settled[index] = { status: "rejected", reason: new Error("Agent group execution was not scheduled.") };
    }
  }

  const results: AgentResult[] = [];
  for (let i = 0; i < settled.length; i++) {
    const entry = settled[i]!;
    if (entry.status === "fulfilled") {
      results.push(...entry.value);
    } else {
      // Group rejected — log and produce error results so they're visible
      const group = groups[i]!;
      if (entry.reason instanceof Error) {
        logger.error(
          entry.reason,
          '[agent-pipeline] Group REJECTED in phase "%s": [%s]',
          phase,
          group.agents.map((a) => a.type).join(", "),
        );
      } else {
        logger.error(
          '[agent-pipeline] Group REJECTED in phase "%s": [%s] %s',
          phase,
          group.agents.map((a) => a.type).join(", "),
          String(entry.reason),
        );
      }
      logger.emit({
        level: "error",
        phase,
        message: "group-error",
        args: [group.agents.map((a) => a.type).join(", "), String(entry.reason)],
      });
      for (const agent of group.agents) {
        const errorResult: AgentResult = {
          agentId: agent.id,
          agentType: agent.type,
          type: "context_injection",
          data: null,
          tokensUsed: 0,
          durationMs: 0,
          success: false,
          error: entry.reason instanceof Error ? entry.reason.message : "Agent group execution failed",
        };
        try {
          onResult?.(errorResult);
        } catch {
          /* swallow */
        }
        results.push(errorResult);
      }
    }
  }
  return results;
}

// ──────────────────────────────────────────────
// Phase Runners
// ──────────────────────────────────────────────

/**
 * Run pre-generation agents (batched per provider+model).
 * Returns text snippets to inject into the main prompt.
 */
async function runPreGenerationAgents(
  agents: ResolvedAgent[],
  context: AgentContext,
  onResult?: AgentResultCallback,
  agentTypeFilter?: (agentType: string) => boolean,
): Promise<AgentInjection[]> {
  const filtered = agentTypeFilter ? agents.filter((a) => agentTypeFilter(a.type)) : agents;
  const results = await executePhase(filtered, "pre_generation", context, onResult);

  const injections: AgentInjection[] = [];
  for (const result of results) {
    if (!result.success) continue;

    // prose-guardian & director produce text to inject
    if (result.type === "context_injection" || result.type === "director_event") {
      const text = getAgentResultText(result.data);
      const agentName = agents.find((agent) => agent.type === result.agentType)?.name;
      if (text) injections.push({ agentType: result.agentType, agentName, text });
    }
    // prompt_review is informational — the onResult callback streams it
  }

  return injections;
}

/**
 * Run post-processing agents (batched per provider+model).
 * Returns all results for the caller to apply.
 */
async function runPostProcessingAgents(
  agents: ResolvedAgent[],
  context: AgentContext,
  onResult?: AgentResultCallback,
): Promise<AgentResult[]> {
  return executePhase(agents, "post_processing", context, onResult);
}

/**
 * Run parallel-phase agents (batched per provider+model).
 */
async function runParallelAgents(
  agents: ResolvedAgent[],
  context: AgentContext,
  onResult?: AgentResultCallback,
): Promise<AgentResult[]> {
  return executePhase(agents, "parallel", context, onResult);
}

// ──────────────────────────────────────────────
// Full Pipeline (convenience wrapper)
// ──────────────────────────────────────────────

/**
 * Run ALL enabled agents across the full pipeline.
 * Call `runPreGeneration` before generating, fire `runParallel` concurrently
 * with the main generation, then call `postGenerate` after the response is
 * complete, passing the final response text.
 *
 * Within each phase, agents that share the same provider+model are
 * batched into a single LLM call.
 */
export function createAgentPipeline(
  agents: ResolvedAgent[],
  baseContext: AgentContext,
  onResult?: AgentResultCallback,
) {
  const allResults: AgentResult[] = [];
  const preGenerationInjections: AgentInjection[] = [];
  const parallelPhaseResults: AgentResult[] = [];

  const wrappedOnResult: AgentResultCallback = (result) => {
    allResults.push(result);
    onResult?.(result);
  };

  return {
    /**
     * Phase 1: Run pre-generation agents.
     * Returns context injection strings to prepend to the prompt.
     */
    async preGenerate(agentTypeFilter?: (agentType: string) => boolean): Promise<AgentInjection[]> {
      const injections = await runPreGenerationAgents(agents, baseContext, wrappedOnResult, agentTypeFilter);
      preGenerationInjections.push(...injections);
      return injections;
    },

    /**
     * Phase 2: Run parallel agents alongside the main generation.
     * Called concurrently with the main LLM call — agents use the
     * base context without mainResponse (since it doesn't exist yet).
     */
    async runParallel(): Promise<AgentResult[]> {
      const results = await runParallelAgents(agents, baseContext, wrappedOnResult);
      parallelPhaseResults.push(...results);
      return results;
    },

    /**
     * Phase 3: Run post-processing agents after the main response.
     * Must be called after the main response is available.
     */
    async postGenerate(
      mainResponse: string,
      options: { preGenInjections?: AgentInjection[]; parallelResults?: AgentResult[] } = {},
    ): Promise<AgentResult[]> {
      const fullContext: AgentContext = {
        ...baseContext,
        mainResponse,
        preGenInjections: options.preGenInjections ?? preGenerationInjections,
        parallelResults: options.parallelResults ?? parallelPhaseResults,
      };

      return runPostProcessingAgents(agents, fullContext, wrappedOnResult);
    },

    /** All results collected so far. */
    get results() {
      return allResults;
    },
  };
}
