import {
  BUILT_IN_AGENTS,
  DEFAULT_AGENT_TOOLS,
  getDefaultAgentPrompt,
  getBuiltInAgentDefaultPrompt,
  getDefaultBuiltInAgentSettings,
  isBuiltInAgentRuntimeDisabled,
  isAgentConfigDeleted,
  isRetiredBuiltInAgentId,
  LOCAL_SIDECAR_CONNECTION_ID,
  mergeBuiltInAgentSettings,
  normalizeAgentPhaseValue,
  resolveAgentPromptTemplate,
  findKnownModel,
  type APIProvider,
} from "@marinara-engine/shared";
import type { BaseLLMProvider } from "../llm/base-provider.js";
import { createLLMProvider } from "../llm/provider-registry.js";
import { getLocalSidecarProvider, LOCAL_SIDECAR_MODEL } from "../llm/local-sidecar.js";
import { sidecarModelService } from "../sidecar/sidecar-model.service.js";
import type { ResolvedAgent } from "../agents/agent-pipeline.js";
import { logger } from "../../lib/logger.js";
import {
  buildAgentConnectionUnavailableWarning,
  buildDefaultAgentConnectionWarning,
  buildLocalSidecarUnavailableWarning,
  resolveAgentConnectionId,
  type AgentConnectionWarning,
} from "../../routes/generate/agent-connection-guards.js";
import { parseStoredGenerationParameters } from "../../routes/generate/generate-route-utils.js";
import { applyTextRewriteAgentChatSettings, normalizeProseGuardianPromptTemplate } from "./prose-guardian-settings.js";
import { applyKnowledgeAgentChatSettings } from "./knowledge-agent-settings.js";
import { withConnectionFallbackProvider, type FallbackConnection } from "../llm/connection-fallback-provider.js";
import type { GenerationFallbackNotifier } from "./fallback-notification.js";

type ConnectionsStore = {
  getWithKey(id: string): Promise<any | null>;
  getDefaultForAgents(): Promise<any | null>;
  getFallbackForAgents(): Promise<any | null>;
};

type ResolveAgentPipelineAgentsArgs = {
  connections: ConnectionsStore;
  configuredAgents: any[];
  chatId: string;
  chatEnableAgents: boolean;
  hasPerChatAgentList: boolean;
  perChatAgentSet: Set<string>;
  agentPromptTemplateSelections: Record<string, string>;
  chatProvider: BaseLLMProvider;
  chatConnectionId: string;
  chatModel: string;
  chatCustomParameters: Record<string, unknown>;
  chatMaxOutputTokens: number | null;
  chatMaxParallelJobs: number;
  chatEnableCaching: boolean;
  chatAnthropicExtendedCacheTtl: boolean;
  chatCachingAtDepth: number;
  activeMusicPlayerSource?: "spotify" | "youtube" | "custom" | null;
  chatMetadata?: Record<string, unknown>;
  onFallback?: GenerationFallbackNotifier;
  resolveBaseUrl(connection: { baseUrl: string | null; provider: string }): string;
};

type AgentProviderCacheEntry = {
  provider: BaseLLMProvider;
  model: string;
  customParameters: Record<string, unknown>;
  maxOutputTokens: number | null;
  maxParallelJobs: number;
  enableCaching: boolean;
  anthropicExtendedCacheTtl: boolean;
  cachingAtDepth: number;
};

type AgentConnectionResolution = {
  entry: AgentProviderCacheEntry | null;
  unavailableReason?: string;
  connectionName?: string;
};

function readTrimmedString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function resolveAgentConnectionRequest(args: {
  agentType: string;
  configuredConnectionId: string | null | undefined;
  defaultAgentConnectionId: string | null | undefined;
  chatMetadata?: Record<string, unknown>;
  localSidecarAvailable: boolean;
}): string | null | "skip-local-sidecar" {
  if (args.agentType !== "illustrator") {
    return resolveAgentConnectionId({
      requestedConnectionId: args.configuredConnectionId,
      defaultAgentConnectionId: args.defaultAgentConnectionId,
      localSidecarAvailable: args.localSidecarAvailable,
    });
  }

  const promptConnectionId = readTrimmedString(args.chatMetadata?.illustratorPromptConnectionId);
  const configuredConnectionId = readTrimmedString(args.configuredConnectionId);
  const requestedConnectionId = promptConnectionId ?? configuredConnectionId;

  return resolveAgentConnectionId({
    requestedConnectionId,
    defaultAgentConnectionId: promptConnectionId ? null : configuredConnectionId ? args.defaultAgentConnectionId : null,
    localSidecarAvailable: args.localSidecarAvailable,
  });
}

export type ResolvedAgentPipelineAgents = {
  enabledConfigs: any[];
  resolvedAgents: ResolvedAgent[];
  agentConnectionWarnings: AgentConnectionWarning[];
};

function resolveAgentRuntimePhase(_agentType: string, configuredPhase: string): string {
  return normalizeAgentPhaseValue(configuredPhase);
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

function resolveAgentSettings(agentType: string, settings: unknown): Record<string, unknown> {
  const parsed = parseAgentSettings(settings);
  if (!BUILT_IN_AGENTS.some((agent) => agent.id === agentType)) return parsed;
  return mergeBuiltInAgentSettings(agentType, parsed);
}

function applyMusicPlayerSourceToMusicDjSettings(
  settings: Record<string, unknown>,
  activeMusicPlayerSource: "spotify" | "youtube" | "custom" | null | undefined,
): Record<string, unknown> {
  if (!activeMusicPlayerSource) return settings;
  return {
    ...settings,
    musicProvider: activeMusicPlayerSource,
    musicPlayerSource: activeMusicPlayerSource,
    enabledTools: activeMusicPlayerSource === "spotify" ? (DEFAULT_AGENT_TOOLS.spotify ?? []) : [],
  };
}

function getAgentFallbackPrompt(agentType: string, settings: Record<string, unknown>): string {
  if (agentType === "spotify" && (settings.musicProvider === "youtube" || settings.musicPlayerSource === "youtube")) {
    return getDefaultAgentPrompt("youtube");
  }
  if (agentType === "spotify" && (settings.musicProvider === "custom" || settings.musicPlayerSource === "custom")) {
    return getDefaultAgentPrompt("local-music");
  }
  return getBuiltInAgentDefaultPrompt(agentType) || getDefaultAgentPrompt(agentType);
}

function resolveConnectionCustomParameters(connection: { defaultParameters?: unknown }): Record<string, unknown> {
  return parseStoredGenerationParameters(connection.defaultParameters)?.customParameters ?? {};
}

function resolveConnectionMaxOutputTokens(connection: { provider: string; model: string }): number | null {
  const knownModel = findKnownModel(connection.provider as APIProvider, connection.model.trim());
  return knownModel?.maxOutput && knownModel.maxOutput > 0 ? Math.floor(knownModel.maxOutput) : null;
}

async function resolveAgentConnectionProvider(args: {
  connections: ConnectionsStore;
  agentProviderCache: Map<string | null, AgentProviderCacheEntry>;
  connectionId: string | null;
  fallbackProvider: BaseLLMProvider;
  fallbackModel: string;
  fallbackCustomParameters: Record<string, unknown>;
  fallbackMaxOutputTokens: number | null;
  fallbackMaxParallelJobs: number;
  fallbackEnableCaching: boolean;
  fallbackAnthropicExtendedCacheTtl: boolean;
  fallbackCachingAtDepth: number;
  fallbackConnection: FallbackConnection | null;
  primaryConnectionId: string;
  onFallback?: GenerationFallbackNotifier;
  resolveBaseUrl(connection: { baseUrl: string | null; provider: string }): string;
}): Promise<AgentConnectionResolution> {
  const cached = args.agentProviderCache.get(args.connectionId);
  if (cached) return { entry: cached };

  if (!args.connectionId) {
    const provider = withConnectionFallbackProvider({
      primary: args.fallbackProvider,
      primaryConnectionId: args.primaryConnectionId,
      fallbackConnection: args.fallbackConnection,
      fallbackBaseUrl: args.fallbackConnection ? args.resolveBaseUrl(args.fallbackConnection) : "",
      category: "agents",
      onFallback: args.onFallback,
    });
    const resolved = {
      provider,
      model: args.fallbackModel,
      customParameters: args.fallbackCustomParameters,
      maxOutputTokens: args.fallbackMaxOutputTokens,
      maxParallelJobs: args.fallbackMaxParallelJobs,
      enableCaching: args.fallbackEnableCaching,
      anthropicExtendedCacheTtl: args.fallbackAnthropicExtendedCacheTtl,
      cachingAtDepth: args.fallbackCachingAtDepth,
    };
    args.agentProviderCache.set(args.connectionId, resolved);
    return { entry: resolved };
  }

  const agentConn = await args.connections.getWithKey(args.connectionId);
  if (!agentConn) {
    return { entry: null, unavailableReason: "the configured connection was deleted" };
  }

  const model = typeof agentConn.model === "string" ? agentConn.model.trim() : "";
  if (!model) {
    return {
      entry: null,
      unavailableReason: "no model is selected",
      connectionName: agentConn.name,
    };
  }

  const agentBaseUrl = args.resolveBaseUrl(agentConn);
  if (!agentBaseUrl) {
    return {
      entry: null,
      unavailableReason: "the Base URL is empty or cannot be resolved",
      connectionName: agentConn.name,
    };
  }

  const primaryProvider = createLLMProvider(
    agentConn.provider,
    agentBaseUrl,
    agentConn.apiKey,
    agentConn.maxContext,
    agentConn.openrouterProvider,
    agentConn.maxTokensOverride,
    agentConn.claudeFastMode === "true",
    agentConn.treatAsLocalEndpoint === "true",
    agentConn.defaultParameters,
  );
  const resolved = {
    provider: withConnectionFallbackProvider({
      primary: primaryProvider,
      primaryConnectionId: agentConn.id,
      fallbackConnection: args.fallbackConnection,
      fallbackBaseUrl: args.fallbackConnection ? args.resolveBaseUrl(args.fallbackConnection) : "",
      category: "agents",
      onFallback: args.onFallback,
    }),
    model,
    customParameters: resolveConnectionCustomParameters(agentConn),
    maxOutputTokens: resolveConnectionMaxOutputTokens({ provider: agentConn.provider, model }),
    maxParallelJobs: Number(agentConn.maxParallelJobs) || 1,
    enableCaching: agentConn.enableCaching === "true",
    anthropicExtendedCacheTtl: agentConn.anthropicExtendedCacheTtl === "true",
    cachingAtDepth: Number(agentConn.cachingAtDepth) || 5,
  };
  args.agentProviderCache.set(args.connectionId, resolved);
  return { entry: resolved };
}

export async function resolveAgentPipelineAgents({
  connections,
  configuredAgents,
  chatId,
  chatEnableAgents,
  hasPerChatAgentList,
  perChatAgentSet,
  agentPromptTemplateSelections,
  chatProvider,
  chatConnectionId,
  chatModel,
  chatCustomParameters,
  chatMaxOutputTokens,
  chatMaxParallelJobs,
  chatEnableCaching,
  chatAnthropicExtendedCacheTtl,
  chatCachingAtDepth,
  activeMusicPlayerSource,
  chatMetadata,
  onFallback,
  resolveBaseUrl,
}: ResolveAgentPipelineAgentsArgs): Promise<ResolvedAgentPipelineAgents> {
  const deletedBuiltInTypes = new Set(
    configuredAgents
      .filter((agent) => BUILT_IN_AGENTS.some((builtIn) => builtIn.id === agent.type))
      .filter((agent) => isAgentConfigDeleted(agent.settings))
      .map((agent) => agent.type as string),
  );
  const enabledConfigs = configuredAgents.filter(
    (agent) =>
      !isAgentConfigDeleted(agent.settings) &&
      !isBuiltInAgentRuntimeDisabled(agent.type as string) &&
      !isRetiredBuiltInAgentId(agent.type as string),
  );
  const resolvedAgents: ResolvedAgent[] = [];
  const agentProviderCache = new Map<string | null, AgentProviderCacheEntry>();
  const localSidecarAvailableForTrackers =
    sidecarModelService.getConfig().useForTrackers && sidecarModelService.getConfiguredModelRef() !== null;

  if (localSidecarAvailableForTrackers) {
    agentProviderCache.set(LOCAL_SIDECAR_CONNECTION_ID, {
      provider: getLocalSidecarProvider(),
      model: LOCAL_SIDECAR_MODEL,
      customParameters: {},
      maxOutputTokens: null,
      maxParallelJobs: 1,
      enableCaching: false,
      anthropicExtendedCacheTtl: false,
      cachingAtDepth: 5,
    });
  }

  const agentConnectionWarnings: AgentConnectionWarning[] = [];
  const skippedLocalSidecarAgents: string[] = [];
  const defaultAgentConnectionAgents: string[] = [];
  const unavailableConnectionWarnings = new Map<
    string,
    { reason: string; connectionName?: string; agentNames: string[] }
  >();
  const addUnavailableConnectionWarning = (
    agentName: string,
    resolution: Pick<AgentConnectionResolution, "unavailableReason" | "connectionName">,
  ) => {
    const reason = resolution.unavailableReason ?? "the connection is unavailable";
    const key = `${resolution.connectionName ?? ""}:${reason}`;
    const existing = unavailableConnectionWarnings.get(key);
    if (existing) {
      existing.agentNames.push(agentName);
    } else {
      unavailableConnectionWarnings.set(key, {
        reason,
        connectionName: resolution.connectionName,
        agentNames: [agentName],
      });
    }
  };
  const defaultAgentConn = await connections.getDefaultForAgents();
  const fallbackAgentConn = await connections.getFallbackForAgents();
  for (const cfg of enabledConfigs) {
    if (hasPerChatAgentList && !perChatAgentSet.has(cfg.type)) continue;

    let settings = resolveAgentSettings(cfg.type as string, cfg.settings);
    if (cfg.type === "spotify") {
      settings = applyMusicPlayerSourceToMusicDjSettings(settings, activeMusicPlayerSource);
    }
    settings = applyTextRewriteAgentChatSettings(cfg.type as string, settings, chatMetadata);
    settings = applyKnowledgeAgentChatSettings(cfg.type as string, settings, chatMetadata);
    if (
      cfg.type === "spotify" &&
      settings.musicProvider !== "youtube" &&
      settings.musicPlayerSource !== "youtube" &&
      settings.musicProvider !== "custom" &&
      settings.musicPlayerSource !== "custom" &&
      (!Array.isArray(settings.enabledTools) || settings.enabledTools.length === 0)
    ) {
      settings.enabledTools = DEFAULT_AGENT_TOOLS.spotify ?? [];
    }
    if (
      cfg.type !== "spotify" &&
      BUILT_IN_AGENTS.some((agent) => agent.id === cfg.type) &&
      !Array.isArray(settings.enabledTools) &&
      (DEFAULT_AGENT_TOOLS[cfg.type as string]?.length ?? 0) > 0
    ) {
      settings.enabledTools = [...DEFAULT_AGENT_TOOLS[cfg.type as string]!];
    }
    let selectedPromptTemplate = resolveAgentPromptTemplate({
      agentType: cfg.type as string,
      promptTemplate: normalizeProseGuardianPromptTemplate(cfg.type as string, cfg.promptTemplate),
      fallbackPromptTemplate: getAgentFallbackPrompt(cfg.type as string, settings),
      settings,
      selectedPromptTemplateId: agentPromptTemplateSelections[cfg.type as string] ?? null,
    });
    const effectiveConnectionId = resolveAgentConnectionRequest({
      agentType: cfg.type as string,
      configuredConnectionId: cfg.connectionId as string | null,
      defaultAgentConnectionId: defaultAgentConn?.id ?? null,
      chatMetadata,
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

    const resolvedProvider = await resolveAgentConnectionProvider({
      connections,
      agentProviderCache,
      connectionId: effectiveConnectionId,
      fallbackProvider: chatProvider,
      fallbackModel: chatModel,
      fallbackCustomParameters: chatCustomParameters,
      fallbackMaxOutputTokens: chatMaxOutputTokens,
      fallbackMaxParallelJobs: chatMaxParallelJobs,
      fallbackEnableCaching: chatEnableCaching,
      fallbackAnthropicExtendedCacheTtl: chatAnthropicExtendedCacheTtl,
      fallbackCachingAtDepth: chatCachingAtDepth,
      fallbackConnection: fallbackAgentConn,
      primaryConnectionId: effectiveConnectionId ?? chatConnectionId,
      onFallback,
      resolveBaseUrl,
    });
    if (!resolvedProvider.entry) {
      addUnavailableConnectionWarning(cfg.name ?? cfg.type, resolvedProvider);
      logger.warn(
        "[generate] Skipping agent %s for chat %s because its connection is unavailable: %s",
        cfg.type,
        chatId,
        resolvedProvider.unavailableReason ?? "unknown reason",
      );
      continue;
    }

    if (defaultAgentConn && effectiveConnectionId === defaultAgentConn.id) {
      defaultAgentConnectionAgents.push(cfg.name ?? cfg.type);
    }

    resolvedAgents.push({
      id: cfg.id,
      type: cfg.type,
      name: cfg.name,
      phase: resolveAgentRuntimePhase(cfg.type as string, cfg.phase as string),
      promptTemplate: selectedPromptTemplate,
      connectionId: effectiveConnectionId,
      settings,
      provider: resolvedProvider.entry.provider,
      model: resolvedProvider.entry.model,
      customParameters: resolvedProvider.entry.customParameters,
      maxOutputTokens: resolvedProvider.entry.maxOutputTokens,
      maxParallelJobs: resolvedProvider.entry.maxParallelJobs,
      enableCaching: resolvedProvider.entry.enableCaching,
      anthropicExtendedCacheTtl: resolvedProvider.entry.anthropicExtendedCacheTtl,
      cachingAtDepth: resolvedProvider.entry.cachingAtDepth,
    });
  }

  const resolvedTypes = new Set(resolvedAgents.map((agent) => agent.type));
  const builtInFallbacks =
    chatEnableAgents && hasPerChatAgentList
      ? BUILT_IN_AGENTS.filter((agent) => {
          if (resolvedTypes.has(agent.id)) return false;
          if (deletedBuiltInTypes.has(agent.id)) return false;
          if (isBuiltInAgentRuntimeDisabled(agent.id)) return false;
          return perChatAgentSet.has(agent.id);
        })
      : [];

  for (const builtIn of builtInFallbacks) {
    const builtInConnectionId = resolveAgentConnectionRequest({
      agentType: builtIn.id,
      configuredConnectionId: null,
      defaultAgentConnectionId: defaultAgentConn?.id ?? null,
      chatMetadata,
      localSidecarAvailable: localSidecarAvailableForTrackers,
    });

    if (builtInConnectionId === "skip-local-sidecar") {
      skippedLocalSidecarAgents.push(builtIn.name);
      logger.warn(
        "[generate] Skipping built-in agent %s for chat %s because Local Model was requested but the sidecar is unavailable",
        builtIn.id,
        chatId,
      );
      continue;
    }

    const builtInConnection = await resolveAgentConnectionProvider({
      connections,
      agentProviderCache,
      connectionId: builtInConnectionId,
      fallbackProvider: chatProvider,
      fallbackModel: chatModel,
      fallbackCustomParameters: chatCustomParameters,
      fallbackMaxOutputTokens: chatMaxOutputTokens,
      fallbackMaxParallelJobs: chatMaxParallelJobs,
      fallbackEnableCaching: chatEnableCaching,
      fallbackAnthropicExtendedCacheTtl: chatAnthropicExtendedCacheTtl,
      fallbackCachingAtDepth: chatCachingAtDepth,
      fallbackConnection: fallbackAgentConn,
      primaryConnectionId: builtInConnectionId ?? chatConnectionId,
      onFallback,
      resolveBaseUrl,
    });
    if (!builtInConnection.entry) {
      addUnavailableConnectionWarning(builtIn.name, builtInConnection);
      logger.warn(
        "[generate] Skipping built-in agent %s for chat %s because its connection is unavailable: %s",
        builtIn.id,
        chatId,
        builtInConnection.unavailableReason ?? "unknown reason",
      );
      continue;
    }
    if (defaultAgentConn && builtInConnectionId === defaultAgentConn.id)
      defaultAgentConnectionAgents.push(builtIn.name);
    let builtInSettings = getDefaultBuiltInAgentSettings(builtIn.id);
    if (builtIn.id === "spotify") {
      builtInSettings = applyMusicPlayerSourceToMusicDjSettings(builtInSettings, activeMusicPlayerSource);
    }
    builtInSettings = applyTextRewriteAgentChatSettings(builtIn.id, builtInSettings, chatMetadata);
    builtInSettings = applyKnowledgeAgentChatSettings(builtIn.id, builtInSettings, chatMetadata);
    if (
      builtIn.id === "spotify" &&
      builtInSettings.musicProvider !== "youtube" &&
      builtInSettings.musicPlayerSource !== "youtube" &&
      builtInSettings.musicProvider !== "custom" &&
      builtInSettings.musicPlayerSource !== "custom" &&
      (!Array.isArray(builtInSettings.enabledTools) || builtInSettings.enabledTools.length === 0)
    ) {
      builtInSettings.enabledTools = DEFAULT_AGENT_TOOLS.spotify ?? [];
    }
    if (
      builtIn.id !== "spotify" &&
      !Array.isArray(builtInSettings.enabledTools) &&
      (DEFAULT_AGENT_TOOLS[builtIn.id]?.length ?? 0) > 0
    ) {
      builtInSettings.enabledTools = [...DEFAULT_AGENT_TOOLS[builtIn.id]!];
    }
    let selectedPromptTemplate = resolveAgentPromptTemplate({
      agentType: builtIn.id,
      promptTemplate: "",
      fallbackPromptTemplate: getAgentFallbackPrompt(builtIn.id, builtInSettings),
      settings: builtInSettings,
      selectedPromptTemplateId: agentPromptTemplateSelections[builtIn.id] ?? null,
    });
    resolvedAgents.push({
      id: `builtin:${builtIn.id}`,
      type: builtIn.id,
      name: builtIn.name,
      phase: resolveAgentRuntimePhase(builtIn.id, builtIn.phase),
      promptTemplate: selectedPromptTemplate,
      connectionId: builtInConnectionId,
      settings: builtInSettings,
      provider: builtInConnection.entry.provider,
      model: builtInConnection.entry.model,
      customParameters: builtInConnection.entry.customParameters,
      maxOutputTokens: builtInConnection.entry.maxOutputTokens,
      maxParallelJobs: builtInConnection.entry.maxParallelJobs,
      enableCaching: builtInConnection.entry.enableCaching,
      anthropicExtendedCacheTtl: builtInConnection.entry.anthropicExtendedCacheTtl,
      cachingAtDepth: builtInConnection.entry.cachingAtDepth,
    });
  }

  // Smart group response selection is hidden runtime infrastructure now. It uses
  // the main generation provider directly instead of resolving a public agent.

  if (skippedLocalSidecarAgents.length > 0) {
    agentConnectionWarnings.push(buildLocalSidecarUnavailableWarning(skippedLocalSidecarAgents));
  }

  for (const warning of unavailableConnectionWarnings.values()) {
    agentConnectionWarnings.push(buildAgentConnectionUnavailableWarning(warning));
  }

  if (defaultAgentConn && defaultAgentConnectionAgents.length > 0) {
    agentConnectionWarnings.push(
      buildDefaultAgentConnectionWarning({
        agentNames: defaultAgentConnectionAgents,
        connectionId: defaultAgentConn.id,
        connectionName: defaultAgentConn.name,
        model: String(defaultAgentConn.model ?? "").trim(),
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
  };
}
