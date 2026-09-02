/**
 * An OpenAI-compatible provider pointed at the utility slot's llama-server.
 *
 * Deliberately its own provider rather than a reuse of the main sidecar's: that one
 * is bound to the main process and its config, and borrowing it would couple the two
 * slots together — the thing this whole feature exists to avoid.
 */
import { OpenAIProvider } from "../llm/providers/openai.provider.js";
import type { BaseLLMProvider } from "../llm/base-provider.js";
import { utilitySidecarService } from "./utility-sidecar.service.js";
import { logger } from "../../lib/logger.js";

/** Model name reported to llama-server; it serves whatever single model it loaded. */
export const UTILITY_SIDECAR_MODEL = "utility-sidecar";

/**
 * Prefix for the synthetic connection id a utility-routed agent reports.
 *
 * Distinct from the main sidecar's id so `isLocalSidecarConnectionId` keeps answering
 * false for it, and so the UI can tell the two slots apart when it names the connection
 * that answered.
 */
export const UTILITY_SIDECAR_CONNECTION_PREFIX = "utility-sidecar:";

let cached: { baseUrl: string; provider: BaseLLMProvider } | null = null;

/**
 * The provider for the utility slot, starting the process if it is not up yet.
 *
 * Started on demand rather than at boot, the way the main sidecar's provider does it:
 * a selected model that has not been used yet should not be holding memory, and an
 * engine restart should not silently hand the agent back to a paid connection.
 *
 * Returns null rather than throwing when the slot cannot serve, so the caller falls
 * back to the agent's own connection instead of failing the run. The reason is left
 * in the slot's status for the UI to show.
 */
export async function getUtilitySidecarProvider(): Promise<BaseLLMProvider | null> {
  let status = utilitySidecarService.getStatus();
  if (!status.ready) {
    try {
      status = await utilitySidecarService.ensureRunning();
    } catch (error) {
      logger.warn(error, "[utility-sidecar] Could not start the slot; falling back to the agent connection");
      return null;
    }
  }
  if (!status.ready || !status.baseUrl) return null;
  const existing = cached;
  if (existing && existing.baseUrl === status.baseUrl) return existing.provider;
  const provider = new OpenAIProvider(`${status.baseUrl}/v1`, "sk-local");
  cached = { baseUrl: status.baseUrl, provider };
  return provider;
}

/** The generation settings a utility-slot run uses, minus the provider wrapper. */
export interface UtilitySidecarAgentEntry {
  connectionId: string;
  provider: BaseLLMProvider;
  model: string;
  customParameters: Record<string, unknown>;
  temperature: number;
  enabledParameters: { temperature: boolean };
  suppressModelParameters: boolean;
  maxOutputTokens: null;
  maxParallelJobs: number;
  enableCaching: boolean;
  anthropicExtendedCacheTtl: boolean;
  cachingAtDepth: number;
}

/**
 * The connection entry for an agent the utility slot serves, or null when it doesn't.
 *
 * Both agent paths — the retry-agents route and the main generation resolver — call
 * this so the precedence rule is stated once rather than drifting between two copies.
 */
export async function buildUtilitySidecarEntry(agentType: string): Promise<UtilitySidecarAgentEntry | null> {
  if (!utilitySidecarService.servesAgent(agentType)) return null;
  const provider = await getUtilitySidecarProvider();
  if (!provider) return null;
  return {
    connectionId: `${UTILITY_SIDECAR_CONNECTION_PREFIX}${agentType}`,
    provider,
    model: UTILITY_SIDECAR_MODEL,
    customParameters: {},
    // An extractor is graded on fidelity, not variety.
    temperature: 0,
    enabledParameters: { temperature: true },
    suppressModelParameters: false,
    maxOutputTokens: null,
    // One local process holding one model: serialise rather than thrash it.
    maxParallelJobs: 1,
    enableCaching: false,
    anthropicExtendedCacheTtl: false,
    cachingAtDepth: 5,
  };
}
