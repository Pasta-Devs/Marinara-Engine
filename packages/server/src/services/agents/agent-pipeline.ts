// ──────────────────────────────────────────────
// Agent Pipeline — Phase Orchestration (Batched)
// ──────────────────────────────────────────────
// Coordinates the 3 agent phases around the main generation:
//   1. pre_generation  → inject context before the LLM call
//   2. parallel        → fire alongside the main generation (no mainResponse)
//   3. post_processing → analyze/modify the completed response (has mainResponse)
//
// Agents that share the same provider+model are BATCHED into a
// single LLM call to reduce total requests. Agents with different
// connections are grouped separately and run in parallel.
// ──────────────────────────────────────────────
import type { AgentResult, AgentContext } from "@marinara-engine/shared";
import type { BaseLLMProvider } from "../llm/base-provider.js";
import {
  executeAgent,
  executeAgentBatch,
  resolveAgentResultType,
  type AgentExecConfig,
  type AgentToolContext,
} from "./agent-executor.js";
import { logger } from "../../lib/logger.js";
import { createAgentConcurrencyLimiter, settleAgentJobsWithConcurrencyLimit } from "./agent-concurrency.js";
import { getCustomLorebookReadBehindMessages } from "../../routes/generate/lorebook-keeper-utils.js";
export { settleAgentJobsWithConcurrencyLimit } from "./agent-concurrency.js";

/** A fully resolved agent ready for execution. */
export interface ResolvedAgent extends AgentExecConfig {
  provider: BaseLLMProvider;
  model: string;
  /** Maximum number of same-connection agent LLM jobs that may run in parallel. */
  maxParallelJobs?: number;
  /** Optional tool context for agents that need function calling (e.g., Spotify). */
  toolContext?: AgentToolContext;
  /** Request-local context identity used to keep incompatible agent batches separate. */
  batchContextKey?: string;
}

export interface AgentInjection {
  agentType: string;
  agentName?: string;
  text: string;
}

export type AgentContextResolver = (
  agent: AgentExecConfig,
  context: AgentContext,
) => AgentContext | Promise<AgentContext>;

export type AgentPhaseContextPreparer = (
  agents: AgentExecConfig[],
  context: AgentContext,
) => AgentContext | Promise<AgentContext>;

/** Callback fired whenever an agent produces a result. */
export type AgentResultCallback = (result: AgentResult) => void;

// ──────────────────────────────────────────────
// Grouping — batch agents by (provider instance, model)
// ──────────────────────────────────────────────

interface AgentGroup {
  provider: BaseLLMProvider;
  model: string;
  maxParallelJobs: number;
  agents: ResolvedAgent[];
}

export const AGENT_PHASE_MAX_CONCURRENT_GROUPS = 8;
const AGENT_GROUP_MAX_CONCURRENT_TOOL_CALLS = 4;

export function normalizeAgentMaxParallelJobs(value: unknown): number {
  const numeric = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(numeric) || numeric < 1) return 1;
  return Math.max(1, Math.min(16, Math.trunc(numeric)));
}

/**
 * Group agents by shared provider, model, and compatible request context so they can be batched.
 */
function groupByProviderModel(agents: ResolvedAgent[]): AgentGroup[] {
  const groups = new Map<string, AgentGroup>();

  for (const agent of agents) {
    // Two agents share a group only when their provider, model, and resolved context are compatible.
    const key = `${providerKey(agent.provider)}::${agent.model}::${agentBatchDataKey(agent)}`;
    let group = groups.get(key);
    if (!group) {
      group = {
        provider: agent.provider,
        model: agent.model,
        maxParallelJobs: normalizeAgentMaxParallelJobs(agent.maxParallelJobs),
        agents: [],
      };
      groups.set(key, group);
    } else {
      group.maxParallelJobs = Math.max(group.maxParallelJobs, normalizeAgentMaxParallelJobs(agent.maxParallelJobs));
    }
    group.agents.push(agent);
  }

  return Array.from(groups.values());
}

function splitGroupForParallelJobs(group: AgentGroup): AgentGroup[] {
  const jobCount = Math.min(normalizeAgentMaxParallelJobs(group.maxParallelJobs), group.agents.length);
  if (jobCount <= 1) return [group];

  const chunks = Array.from({ length: jobCount }, () => [] as ResolvedAgent[]);
  for (let index = 0; index < group.agents.length; index++) {
    chunks[index % jobCount]!.push(group.agents[index]!);
  }

  return chunks
    .filter((agents) => agents.length > 0)
    .map((agents) => ({
      provider: group.provider,
      model: group.model,
      maxParallelJobs: group.maxParallelJobs,
      agents,
    }));
}

// Simple provider identity via a WeakMap-backed counter
const providerIds = new WeakMap<BaseLLMProvider, number>();
let nextProviderId = 0;
function providerKey(provider: BaseLLMProvider): number {
  let id = providerIds.get(provider);
  if (id === undefined) {
    id = nextProviderId++;
    providerIds.set(provider, id);
  }
  return id;
}

function agentBatchDataKey(agent: ResolvedAgent): string {
  const batchContextKey = agent.batchContextKey ?? "default-context";
  if (agent.phase !== "post_processing") return batchContextKey;
  const readBehind = getCustomLorebookReadBehindMessages(agent.settings);
  return [
    getAgentBatchLane(agent),
    agent.settings.includePreGenInjections === true ? "pre-gen" : "no-pre-gen",
    agent.settings.includeParallelResults === true ? "parallel" : "no-parallel",
    `read-behind-${readBehind}`,
    batchContextKey,
  ].join(":");
}

/**
 * Rewrite agents edit the assistant transcript and must never share an LLM
 * request with tracker or other post-processing work. Built-in rewrite agents
 * may still be combined into their dedicated editor call before this stage.
 */
export function getAgentBatchLane(agent: Pick<ResolvedAgent, "phase" | "type" | "settings">): "rewrite" | "standard" {
  return agent.phase === "post_processing" && resolveAgentResultType(agent) === "text_rewrite" ? "rewrite" : "standard";
}

function buildAgentContext(agent: ResolvedAgent, context: AgentContext): AgentContext {
  if (agent.phase !== "post_processing") {
    return {
      ...context,
      preGenInjections: undefined,
      parallelResults: undefined,
    };
  }

  return {
    ...context,
    preGenInjections: agent.settings.includePreGenInjections === true ? (context.preGenInjections ?? []) : undefined,
    parallelResults: agent.settings.includeParallelResults === true ? (context.parallelResults ?? []) : undefined,
  };
}

/**
 * Execute a group of agents — batch if >1, single if 1.
 * Tool-using agents are extracted from batches and run individually.
 * Returns results and fires the onResult callback per agent.
 */
async function executeGroup(
  group: AgentGroup,
  context: AgentContext,
  runWithConnectionLimit: <R>(job: () => Promise<R>) => Promise<R>,
  onResult?: AgentResultCallback,
  resolveAgentContext?: AgentContextResolver,
): Promise<AgentResult[]> {
  const groupContext = resolveAgentContext
    ? await resolveAgentContext(group.agents[0]!, buildAgentContext(group.agents[0]!, context))
    : buildAgentContext(group.agents[0]!, context);
  // Separate tool-using agents (can't be batched) from regular agents. Spotify always
  // returns one JSON intent; deterministic host-side playback runs after parsing.
  const toolAgents = group.agents.filter((a) => shouldUseToolsDuringAgentExecution(a));
  const batchAgents = group.agents.filter((a) => !shouldUseToolsDuringAgentExecution(a));

  logger.debug("[agent-pipeline] executeGroup: %d batchable, %d tool-using %j", batchAgents.length, toolAgents.length, {
    batch: batchAgents.map((a) => a.type),
    tools: toolAgents.map((a) => a.type),
  });

  // Safe callback wrapper — errors in the callback (e.g. writing to a
  // closed SSE stream) must never crash the group and silently drop results.
  const safeOnResult = (result: AgentResult) => {
    try {
      onResult?.(result);
    } catch {
      /* swallow */
    }
  };

  const batchResultsPromise =
    batchAgents.length > 0
      ? executeAgentBatch(
          batchAgents,
          groupContext,
          group.provider,
          group.model,
          resolveAgentContext,
          runWithConnectionLimit,
        ).then((results) => {
          for (const result of results) {
            safeOnResult(result);
          }
          return results;
        })
      : Promise.resolve([] as AgentResult[]);
  if (toolAgents.length > AGENT_GROUP_MAX_CONCURRENT_TOOL_CALLS) {
    logger.warn(
      "[agent-pipeline] Limiting %d tool-using agent request(s) to %d concurrent request(s)",
      toolAgents.length,
      AGENT_GROUP_MAX_CONCURRENT_TOOL_CALLS,
    );
  }
  const toolResultsPromise = settleAgentJobsWithConcurrencyLimit(
    toolAgents,
    AGENT_GROUP_MAX_CONCURRENT_TOOL_CALLS,
    (agent) =>
      (resolveAgentContext
        ? Promise.resolve(resolveAgentContext(agent, buildAgentContext(agent, context)))
        : Promise.resolve(buildAgentContext(agent, context))
      )
        .then((agentContext) =>
          runWithConnectionLimit(() =>
            executeAgent(agent, agentContext, agent.provider, agent.model, agent.toolContext),
          ),
        )
        .then((result) => {
          safeOnResult(result);
          return result;
        }),
  ).then((settled) =>
    settled.map((entry, index) => {
      if (entry.status === "fulfilled") return entry.value;

      const agent = toolAgents[index]!;
      logger.error(entry.reason, "[agent-pipeline] Tool agent FAILED for %s", agent.type);
      const errorResult: AgentResult = {
        agentId: agent.id,
        agentType: agent.type,
        type: "context_injection",
        data: null,
        tokensUsed: 0,
        durationMs: 0,
        success: false,
        error: entry.reason instanceof Error ? entry.reason.message : "Tool agent execution failed",
      };
      safeOnResult(errorResult);
      return errorResult;
    }),
  );

  const [batchResults, toolResults] = await Promise.all([batchResultsPromise, toolResultsPromise]);
  return [...batchResults, ...toolResults];
}

export function shouldUseToolsDuringAgentExecution(agent: ResolvedAgent): boolean {
  if (!agent.toolContext?.tools.length) return false;
  return agent.type !== "spotify";
}

/**
 * Execute all agents for a given phase, grouped + batched.
 */
async function executePhase(
  agents: ResolvedAgent[],
  phase: string,
  context: AgentContext,
  onResult?: AgentResultCallback,
  resolveAgentContext?: AgentContextResolver,
): Promise<AgentResult[]> {
  const phaseAgents = agents.filter((a) => a.phase === phase);
  if (phaseAgents.length === 0) return [];

  const groups = groupByProviderModel(phaseAgents).flatMap(splitGroupForParallelJobs);
  const connectionLimits = new Map<number, number>();
  for (const group of groups) {
    const key = providerKey(group.provider);
    connectionLimits.set(key, Math.min(connectionLimits.get(key) ?? group.maxParallelJobs, group.maxParallelJobs));
  }
  const connectionLimiters = new Map(
    Array.from(connectionLimits, ([key, limit]) => [key, createAgentConcurrencyLimiter(limit)]),
  );

  logger.debug(
    '[agent-pipeline] Phase "%s": %d agents → %d job group(s) %j',
    phase,
    phaseAgents.length,
    groups.length,
    groups.map((g) => `[${g.agents.map((a) => a.type).join(", ")}] (model: ${g.model})`),
  );

  if (groups.length > AGENT_PHASE_MAX_CONCURRENT_GROUPS) {
    logger.warn(
      '[agent-pipeline] Phase "%s": limiting %d job groups to %d concurrent agent request group(s)',
      phase,
      groups.length,
      AGENT_PHASE_MAX_CONCURRENT_GROUPS,
    );
  }

  const settled = await settleAgentJobsWithConcurrencyLimit(groups, AGENT_PHASE_MAX_CONCURRENT_GROUPS, (group) =>
    executeGroup(group, context, connectionLimiters.get(providerKey(group.provider))!, onResult, resolveAgentContext),
  );

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
export async function runPreGenerationAgents(
  agents: ResolvedAgent[],
  context: AgentContext,
  onResult?: AgentResultCallback,
  agentTypeFilter?: (agentType: string) => boolean,
  resolveAgentContext?: AgentContextResolver,
): Promise<AgentInjection[]> {
  const filtered = agentTypeFilter ? agents.filter((a) => agentTypeFilter(a.type)) : agents;
  const results = await executePhase(filtered, "pre_generation", context, onResult, resolveAgentContext);

  const injections: AgentInjection[] = [];
  for (const result of results) {
    if (!result.success) continue;

    // Director and context-injection agents produce text to inject.
    if (result.type === "director_event") {
      const text =
        typeof result.data === "string"
          ? result.data
          : typeof (result.data as any)?.direction === "string"
            ? (result.data as any).direction
            : typeof (result.data as any)?.text === "string"
              ? (result.data as any).text
              : "";
      const agentName = agents.find((agent) => agent.type === result.agentType)?.name;
      if (text.trim()) injections.push({ agentType: result.agentType, agentName, text: text.trim() });
      continue;
    }

    if (result.type === "context_injection") {
      const text = typeof result.data === "string" ? result.data : ((result.data as any)?.text ?? "");
      const agentName = agents.find((agent) => agent.type === result.agentType)?.name;
      if (text) injections.push({ agentType: result.agentType, agentName, text });
    }
  }

  return injections;
}

/**
 * Run post-processing agents (batched per provider+model).
 * Returns all results for the caller to apply.
 */
export async function runPostProcessingAgents(
  agents: ResolvedAgent[],
  context: AgentContext,
  onResult?: AgentResultCallback,
  resolveAgentContext?: AgentContextResolver,
): Promise<AgentResult[]> {
  return executePhase(agents, "post_processing", context, onResult, resolveAgentContext);
}

/**
 * Run parallel-phase agents (batched per provider+model).
 */
export async function runParallelAgents(
  agents: ResolvedAgent[],
  context: AgentContext,
  onResult?: AgentResultCallback,
  resolveAgentContext?: AgentContextResolver,
): Promise<AgentResult[]> {
  return executePhase(agents, "parallel", context, onResult, resolveAgentContext);
}

// ──────────────────────────────────────────────
// Full Pipeline (convenience wrapper)
// ──────────────────────────────────────────────

export interface AgentPipelineResult {
  /** Text snippets injected before generation (from pre-gen agents) */
  contextInjections: string[];
  /** All agent results from every phase */
  allResults: AgentResult[];
}

/**
 * Run ALL enabled agents across the full pipeline.
 * Call `preGenerate` before generating, fire `runParallel` concurrently
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
  resolveAgentContext?: AgentContextResolver,
  preparePostContext?: AgentPhaseContextPreparer,
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
      const injections = await runPreGenerationAgents(
        agents,
        baseContext,
        wrappedOnResult,
        agentTypeFilter,
        resolveAgentContext,
      );
      preGenerationInjections.push(...injections);
      return injections;
    },

    /**
     * Phase 2: Run parallel agents alongside the main generation.
     * Called concurrently with the main LLM call — agents use the
     * base context without mainResponse (since it doesn't exist yet).
     */
    async runParallel(): Promise<AgentResult[]> {
      const results = await runParallelAgents(agents, baseContext, wrappedOnResult, resolveAgentContext);
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

      const preparedContext = preparePostContext
        ? await preparePostContext(
            agents.filter((agent) => agent.phase === "post_processing"),
            fullContext,
          )
        : fullContext;
      return runPostProcessingAgents(agents, preparedContext, wrappedOnResult, resolveAgentContext);
    },

    /** All results collected so far. */
    get results() {
      return allResults;
    },
  };
}
