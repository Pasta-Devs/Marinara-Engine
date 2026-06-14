import {
  BUILT_IN_AGENTS,
  DEFAULT_AGENT_TOOLS,
  getDefaultAgentPrompt,
  getDefaultBuiltInAgentSettings,
  isAgentConfigDeleted,
  LOCAL_SIDECAR_CONNECTION_ID,
  resolveAgentPromptTemplate,
} from "@marinara-engine/shared";
import type { BaseLLMProvider } from "../llm/base-provider.js";
import { createLLMProvider } from "../llm/provider-registry.js";
import { getLocalSidecarProvider, LOCAL_SIDECAR_MODEL } from "../llm/local-sidecar.js";
import { sidecarModelService } from "../sidecar/sidecar-model.service.js";
import type { ResolvedAgent } from "../agents/agent-pipeline.js";
import { logger } from "../../lib/logger.js";
import {
  buildDefaultAgentConnectionWarning,
  buildLocalSidecarUnavailableWarning,
  resolveAgentConnectionId,
  type AgentConnectionWarning,
} from "../../routes/generate/agent-connection-guards.js";

type ConnectionsStore = {
  getWithKey(id: string): Promise<any | null>;
  getDefaultForAgents(): Promise<any | null>;
};

type AgentsStore = {
  getByType(type: string): Promise<any | null>;
};

type ResolveAgentPipelineAgentsArgs = {
  agentsStore: AgentsStore;
  connections: ConnectionsStore;
  configuredAgents: any[];
  chatId: string;
  chatMode: string;
  chatMetadata: Record<string, unknown>;
  chatEnableAgents: boolean;
  hasPerChatAgentList: boolean;
  perChatAgentSet: Set<string>;
  agentPromptTemplateSelections: Record<string, string>;
  characterIds: string[];
  impersonate: boolean;
  regenerateMessageId?: string | null;
  chatProvider: BaseLLMProvider;
  chatModel: string;
  chatMaxParallelJobs: number;
  resolveBaseUrl(connection: { baseUrl: string | null; provider: string }): string;
};

type AgentProviderCacheEntry = {
  provider: BaseLLMProvider;
  model: string;
  maxParallelJobs: number;
};

export type ResolvedAgentPipelineAgents = {
  enabledConfigs: any[];
  resolvedAgents: ResolvedAgent[];
  agentConnectionWarnings: AgentConnectionWarning[];
  responseOrchestratorSelectorAgent: ResolvedAgent | null;
  responseOrchestratorSelectorUnavailable: boolean;
};

function resolveAgentRuntimePhase(agentType: string, configuredPhase: string): string {
  if (agentType === "echo-chamber") return "parallel";
  return configuredPhase;
}

function parseAgentSettings(settings: unknown): Record<string, unknown> {
  if (!settings) return {};
  if (typeof settings === "string") {
    try {
      const parsed = JSON.parse(settings) as unknown;
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
    } catch (error) {
      logger.warn(error, "[generate] Ignoring malformed agent settings JSON");
      return {};
    }
  }
  return typeof settings === "object" && !Array.isArray(settings) ? (settings as Record<string, unknown>) : {};
}

async function resolveAgentConnectionProvider(args: {
  connections: ConnectionsStore;
  agentProviderCache: Map<string, AgentProviderCacheEntry>;
  connectionId: string | null;
  fallbackProvider: BaseLLMProvider;
  fallbackModel: string;
  fallbackMaxParallelJobs: number;
  resolveBaseUrl(connection: { baseUrl: string | null; provider: string }): string;
}): Promise<AgentProviderCacheEntry> {
  if (!args.connectionId) {
    return {
      provider: args.fallbackProvider,
      model: args.fallbackModel,
      maxParallelJobs: args.fallbackMaxParallelJobs,
    };
  }

  const cached = args.agentProviderCache.get(args.connectionId);
  if (cached) return cached;

  const agentConn = await args.connections.getWithKey(args.connectionId);
  if (agentConn) {
    const agentBaseUrl = args.resolveBaseUrl(agentConn);
    if (agentBaseUrl) {
      const resolved = {
        provider: createLLMProvider(
          agentConn.provider,
          agentBaseUrl,
          agentConn.apiKey,
          agentConn.maxContext,
          agentConn.openrouterProvider,
          agentConn.maxTokensOverride,
        ),
        model: agentConn.model,
        maxParallelJobs: Number(agentConn.maxParallelJobs) || 1,
      };
      args.agentProviderCache.set(args.connectionId, resolved);
      return resolved;
    }
  }

  return {
    provider: args.fallbackProvider,
    model: args.fallbackModel,
    maxParallelJobs: args.fallbackMaxParallelJobs,
  };
}

export async function resolveAgentPipelineAgents({
  agentsStore,
  connections,
  configuredAgents,
  chatId,
  chatMode,
  chatMetadata,
  chatEnableAgents,
  hasPerChatAgentList,
  perChatAgentSet,
  agentPromptTemplateSelections,
  characterIds,
  impersonate,
  regenerateMessageId,
  chatProvider,
  chatModel,
  chatMaxParallelJobs,
  resolveBaseUrl,
}: ResolveAgentPipelineAgentsArgs): Promise<ResolvedAgentPipelineAgents> {
  const deletedBuiltInTypes = new Set(
    configuredAgents
      .filter((agent) => BUILT_IN_AGENTS.some((builtIn) => builtIn.id === agent.type))
      .filter((agent) => isAgentConfigDeleted(agent.settings))
      .map((agent) => agent.type as string),
  );
  const enabledConfigs = configuredAgents.filter((agent) => !isAgentConfigDeleted(agent.settings));
  const resolvedAgents: ResolvedAgent[] = [];
  const agentProviderCache = new Map<string, AgentProviderCacheEntry>();
  const localSidecarAvailableForTrackers =
    sidecarModelService.getConfig().useForTrackers && sidecarModelService.getConfiguredModelRef() !== null;

  if (localSidecarAvailableForTrackers) {
    agentProviderCache.set(LOCAL_SIDECAR_CONNECTION_ID, {
      provider: getLocalSidecarProvider(),
      model: LOCAL_SIDECAR_MODEL,
      maxParallelJobs: 1,
    });
  }

  const defaultAgentConn = await connections.getDefaultForAgents();
  if (defaultAgentConn) {
    const defaultAgentBaseUrl = resolveBaseUrl(defaultAgentConn);
    if (defaultAgentBaseUrl) {
      agentProviderCache.set(defaultAgentConn.id, {
        provider: createLLMProvider(
          defaultAgentConn.provider,
          defaultAgentBaseUrl,
          defaultAgentConn.apiKey,
          defaultAgentConn.maxContext,
          defaultAgentConn.openrouterProvider,
          defaultAgentConn.maxTokensOverride,
        ),
        model: defaultAgentConn.model,
        maxParallelJobs: Number(defaultAgentConn.maxParallelJobs) || 1,
      });
    }
  }

  const agentConnectionWarnings: AgentConnectionWarning[] = [];
  const skippedLocalSidecarAgents: string[] = [];
  const defaultAgentConnectionAgents: string[] = [];
  let responseOrchestratorSelectorAgent: ResolvedAgent | null = null;
  let responseOrchestratorSelectorUnavailable = false;

  for (const cfg of enabledConfigs) {
    if (hasPerChatAgentList && !perChatAgentSet.has(cfg.type)) continue;

    const settings = parseAgentSettings(cfg.settings);
    if (cfg.type === "spotify" && (!Array.isArray(settings.enabledTools) || settings.enabledTools.length === 0)) {
      settings.enabledTools = DEFAULT_AGENT_TOOLS.spotify ?? [];
    }
    const selectedPromptTemplate = resolveAgentPromptTemplate({
      agentType: cfg.type as string,
      promptTemplate: cfg.promptTemplate as string,
      fallbackPromptTemplate: getDefaultAgentPrompt(cfg.type as string),
      settings,
      selectedPromptTemplateId: agentPromptTemplateSelections[cfg.type as string] ?? null,
    });

    const effectiveConnectionId = resolveAgentConnectionId({
      requestedConnectionId: cfg.connectionId as string | null,
      defaultAgentConnectionId: defaultAgentConn?.id ?? null,
      localSidecarAvailable: localSidecarAvailableForTrackers,
    });

    if (effectiveConnectionId === "skip-local-sidecar") {
      skippedLocalSidecarAgents.push(cfg.name ?? cfg.type);
      logger.warn(
        "[generate] Skipping agent %s for chat %s because Local Model was requested but the sidecar is unavailable",
        cfg.type,
        chatId,
      );
      continue;
    }

    if (defaultAgentConn && effectiveConnectionId === defaultAgentConn.id) {
      defaultAgentConnectionAgents.push(cfg.name ?? cfg.type);
    }

    const resolvedProvider = await resolveAgentConnectionProvider({
      connections,
      agentProviderCache,
      connectionId: effectiveConnectionId,
      fallbackProvider: chatProvider,
      fallbackModel: chatModel,
      fallbackMaxParallelJobs: chatMaxParallelJobs,
      resolveBaseUrl,
    });

    resolvedAgents.push({
      id: cfg.id,
      type: cfg.type,
      name: cfg.name,
      phase: resolveAgentRuntimePhase(cfg.type as string, cfg.phase as string),
      promptTemplate: selectedPromptTemplate,
      connectionId: effectiveConnectionId,
      settings,
      provider: resolvedProvider.provider,
      model: resolvedProvider.model,
      maxParallelJobs: resolvedProvider.maxParallelJobs,
    });
  }

  if (skippedLocalSidecarAgents.length > 0) {
    agentConnectionWarnings.push(buildLocalSidecarUnavailableWarning(skippedLocalSidecarAgents));
  }

  const resolvedTypes = new Set(resolvedAgents.map((agent) => agent.type));
  const builtInFallbacks =
    chatEnableAgents && hasPerChatAgentList
      ? BUILT_IN_AGENTS.filter((agent) => {
          if (resolvedTypes.has(agent.id)) return false;
          if (deletedBuiltInTypes.has(agent.id)) return false;
          if (agent.id === "chat-summary") return false;
          return perChatAgentSet.has(agent.id);
        })
      : [];

  for (const builtIn of builtInFallbacks) {
    const builtInCached = defaultAgentConn ? agentProviderCache.get(defaultAgentConn.id) : null;
    if (defaultAgentConn) {
      defaultAgentConnectionAgents.push(builtIn.name);
    }
    const builtInSettings = getDefaultBuiltInAgentSettings(builtIn.id);
    if (
      builtIn.id === "spotify" &&
      (!Array.isArray(builtInSettings.enabledTools) || builtInSettings.enabledTools.length === 0)
    ) {
      builtInSettings.enabledTools = DEFAULT_AGENT_TOOLS.spotify ?? [];
    }
    const selectedPromptTemplate = resolveAgentPromptTemplate({
      agentType: builtIn.id,
      promptTemplate: "",
      fallbackPromptTemplate: getDefaultAgentPrompt(builtIn.id),
      settings: builtInSettings,
      selectedPromptTemplateId: agentPromptTemplateSelections[builtIn.id] ?? null,
    });

    resolvedAgents.push({
      id: `builtin:${builtIn.id}`,
      type: builtIn.id,
      name: builtIn.name,
      phase: resolveAgentRuntimePhase(builtIn.id, builtIn.phase),
      promptTemplate: selectedPromptTemplate,
      connectionId: defaultAgentConn?.id ?? null,
      settings: builtInSettings,
      provider: builtInCached?.provider ?? chatProvider,
      model: builtInCached?.model ?? chatModel,
      maxParallelJobs: builtInCached?.maxParallelJobs ?? chatMaxParallelJobs,
    });
  }

  const selectorGroupResponseOrder = (chatMetadata.groupResponseOrder as string) ?? "sequential";
  const selectorGroupChatMode =
    chatMode === "conversation"
      ? selectorGroupResponseOrder === "manual"
        ? "individual"
        : "merged"
      : ((chatMetadata.groupChatMode as string) ?? "merged");
  const shouldResolveResponseOrchestratorSelector =
    !impersonate &&
    !regenerateMessageId &&
    characterIds.length > 1 &&
    selectorGroupChatMode === "individual" &&
    selectorGroupResponseOrder === "smart";

  if (shouldResolveResponseOrchestratorSelector) {
    const resolvedResponseOrchestratorAgent = resolvedAgents.find((agent) => agent.type === "response-orchestrator");
    if (resolvedResponseOrchestratorAgent) {
      responseOrchestratorSelectorAgent = resolvedResponseOrchestratorAgent;
    } else {
      const storedResponseOrchestratorConfig = await agentsStore.getByType("response-orchestrator");
      const cfg =
        storedResponseOrchestratorConfig ??
        (defaultAgentConn ? (BUILT_IN_AGENTS.find((agent) => agent.id === "response-orchestrator") ?? null) : null);

      if (cfg) {
        const settings =
          "settings" in cfg && cfg.settings
            ? parseAgentSettings(cfg.settings)
            : getDefaultBuiltInAgentSettings("response-orchestrator");
        const selectedPromptTemplate = resolveAgentPromptTemplate({
          agentType: "response-orchestrator",
          promptTemplate: "promptTemplate" in cfg ? String(cfg.promptTemplate ?? "") : "",
          fallbackPromptTemplate: getDefaultAgentPrompt("response-orchestrator"),
          settings,
          selectedPromptTemplateId: agentPromptTemplateSelections["response-orchestrator"] ?? null,
        });
        const requestedConnectionId = "connectionId" in cfg ? (cfg.connectionId as string | null) : null;
        const effectiveConnectionId = resolveAgentConnectionId({
          requestedConnectionId,
          defaultAgentConnectionId: defaultAgentConn?.id ?? null,
          localSidecarAvailable: localSidecarAvailableForTrackers,
        });

        if (effectiveConnectionId === "skip-local-sidecar") {
          responseOrchestratorSelectorUnavailable = true;
          if (!skippedLocalSidecarAgents.some((agentName) => agentName === "Response Orchestrator")) {
            agentConnectionWarnings.push(buildLocalSidecarUnavailableWarning(["Response Orchestrator"]));
          }
          logger.warn(
            "[group-smart] Skipping Response Orchestrator Local Model override for chat %s because the sidecar is unavailable",
            chatId,
          );
        } else {
          if (defaultAgentConn && effectiveConnectionId === defaultAgentConn.id) {
            defaultAgentConnectionAgents.push("Response Orchestrator");
          }
          const resolvedProvider = await resolveAgentConnectionProvider({
            connections,
            agentProviderCache,
            connectionId: effectiveConnectionId,
            fallbackProvider: chatProvider,
            fallbackModel: chatModel,
            fallbackMaxParallelJobs: chatMaxParallelJobs,
            resolveBaseUrl,
          });

          responseOrchestratorSelectorAgent = {
            id: "id" in cfg ? String(cfg.id) : "builtin:response-orchestrator",
            type: "response-orchestrator",
            name: "name" in cfg ? String(cfg.name) : "Response Orchestrator",
            phase: "phase" in cfg ? String(cfg.phase) : "pre_generation",
            promptTemplate: selectedPromptTemplate,
            connectionId: effectiveConnectionId,
            settings,
            provider: resolvedProvider.provider,
            model: resolvedProvider.model,
            maxParallelJobs: resolvedProvider.maxParallelJobs,
          };
        }
      }
    }
  }

  if (defaultAgentConn && defaultAgentConnectionAgents.length > 0) {
    agentConnectionWarnings.push(
      buildDefaultAgentConnectionWarning({
        agentNames: defaultAgentConnectionAgents,
        connectionName: defaultAgentConn.name,
        model: defaultAgentConn.model,
      }),
    );
  }

  logger.info(
    "[generate] Resolved %d agents for chat %s (enableAgents=%s, perChatList=%s, activeIds=[%s]): %s",
    resolvedAgents.length,
    chatId,
    chatEnableAgents,
    hasPerChatAgentList,
    Array.from(perChatAgentSet).join(","),
    resolvedAgents.map((agent) => `${agent.type}(${agent.phase})`).join(", "),
  );

  return {
    enabledConfigs,
    resolvedAgents,
    agentConnectionWarnings,
    responseOrchestratorSelectorAgent,
    responseOrchestratorSelectorUnavailable,
  };
}
