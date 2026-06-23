import { BUILT_IN_TOOLS, DEFAULT_AGENT_TOOLS, customAgentHasCapability } from "@marinara-engine/shared";
import type { AgentContext } from "@marinara-engine/shared";
import type { LLMToolDefinition } from "../llm/base-provider.js";
import type { ResolvedAgent } from "../agents/agent-pipeline.js";
import {
  executeToolCalls,
  type CustomToolDef,
  type CustomToolHiddenContext,
  type MetadataPatch,
  type MetadataPatchInput,
  type ToolExecutionContext,
} from "../tools/tool-executor.js";
import { resolveSpotifyCredentials, spotifyHasScope } from "../spotify/spotify.service.js";
import { logger } from "../../lib/logger.js";
import {
  agentWriteApprovalRequired,
  buildLorebookWriteApprovalProposal,
} from "../../routes/generate/agent-write-approval.js";
import {
  readSpotifyNumberField,
  readSpotifyPlaybackTrackUri,
  readSpotifyStringField,
  readSpotifyTrackUris,
  rememberSpotifyCandidateTracks,
  type SpotifyRuntimeAgent,
} from "./spotify-agent-runtime.js";
import { resolveSpotifyToolAvailabilityRequest } from "./spotify-tool-availability.js";

type CustomToolsStore = {
  listEnabled(): Promise<
    Array<{
      name: string;
      description: string;
      parametersSchema: unknown;
      executionType: string;
      webhookUrl: string | null;
      staticResult: string | null;
      scriptBody: string | null;
      includeHiddenContext?: string | boolean | number | null;
    }>
  >;
};

type ChatsStore = {
  getMessage(id: string): Promise<{ id: string; chatId: string; role: string } | null>;
  updateMessageContent(id: string, content: string): Promise<unknown>;
  patchMetadata(
    chatId: string,
    patcher: (currentMeta: Record<string, unknown>) => Promise<Record<string, unknown>> | Record<string, unknown>,
  ): Promise<{ metadata?: unknown } | null>;
};

type LorebooksStore = {
  listActiveEntries(args: Record<string, unknown>): Promise<any[]>;
  getById(id: string): Promise<any | null>;
  listEntries(lorebookId: string): Promise<any[]>;
  createEntry(entry: Record<string, unknown>): Promise<any>;
  updateEntry(id: string, entry: Record<string, unknown>): Promise<any>;
};

type AgentsStore = unknown;

type ResolveGenerationToolsArgs = {
  requestBody: Record<string, unknown>;
  chatId: string;
  chatMetadata: Record<string, unknown>;
  chats: ChatsStore;
  agentsStore: AgentsStore;
  customToolsStore: CustomToolsStore;
  lorebooksStore: LorebooksStore;
  resolvedAgents: ResolvedAgent[];
  enabledConfigs: any[];
  promptCharacterIds: string[];
  personaId: string | null;
  activeLorebookIds: string[];
  excludedLorebookIds: string[];
  excludedSourceAgentIds: string[];
  gameState: unknown;
  gameSpotifyMusicEnabled: boolean;
  agentContext: AgentContext;
  emitMetadataPatch(patch: Record<string, unknown>): void;
};

export type ResolvedGenerationTools = {
  enableChatTools: boolean;
  chatResolvedToolNames: Set<string>;
  toolDefs: LLMToolDefinition[] | undefined;
  baseToolExecutionContext: ToolExecutionContext;
  updateChatMetadataForTools: (patchOrUpdater: MetadataPatchInput) => Promise<MetadataPatch>;
};

const AGENT_ONLY_TOOL_NAMES = new Set([
  "save_lorebook_entry",
  "read_chat_summary",
  "append_chat_summary",
  "read_chat_variable",
  "write_chat_variable",
  "edit_chat_message",
]);

function parseExtra(extra: unknown): Record<string, unknown> {
  if (!extra) return {};
  try {
    return typeof extra === "string" ? JSON.parse(extra) : (extra as Record<string, unknown>);
  } catch {
    return {};
  }
}

function parseSettings(settings: unknown): Record<string, unknown> {
  if (!settings) return {};
  if (typeof settings === "string") {
    try {
      const parsed = JSON.parse(settings);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return typeof settings === "object" && !Array.isArray(settings) ? (settings as Record<string, unknown>) : {};
}

function booleanText(value: unknown): boolean {
  return value === true || value === "true" || value === "1" || value === 1;
}

function stringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof raw === "string") out[key] = raw;
  }
  return out;
}

function joinNonEmpty(parts: Array<string | undefined>): string {
  return parts.filter((part): part is string => typeof part === "string" && part.trim().length > 0).join("\n");
}

function buildCustomToolHiddenContext(args: {
  requestBody: Record<string, unknown>;
  chatId: string;
  chatMetadata: Record<string, unknown>;
  promptCharacterIds: string[];
  personaId: string | null;
  agentContext: AgentContext;
  gameState: unknown;
}): CustomToolHiddenContext {
  const characters = args.agentContext.characters.map((character) => ({
    id: character.id,
    name: character.name,
  }));
  const characterNamesById = new Map(characters.map((character) => [character.id, character.name]));
  const requestedCharacterId =
    typeof args.requestBody.forCharacterId === "string" && args.requestBody.forCharacterId.trim()
      ? args.requestBody.forCharacterId.trim()
      : null;
  const primaryCharacterId =
    requestedCharacterId && args.promptCharacterIds.includes(requestedCharacterId)
      ? requestedCharacterId
      : (args.promptCharacterIds[0] ?? null);
  const characterIds = args.promptCharacterIds;
  const characterNames = characterIds.map((id) => characterNamesById.get(id) ?? id);
  const personaName = args.agentContext.persona?.name ?? null;
  const primaryCharacterName = primaryCharacterId ? (characterNamesById.get(primaryCharacterId) ?? null) : null;
  const primaryCharacter =
    (primaryCharacterId ? args.agentContext.characters.find((character) => character.id === primaryCharacterId) : null) ??
    args.agentContext.characters[0] ??
    null;
  const personaFields = args.agentContext.persona
    ? joinNonEmpty([
        args.agentContext.persona.description,
        args.agentContext.persona.personality,
        args.agentContext.persona.backstory,
        args.agentContext.persona.appearance,
        args.agentContext.persona.scenario,
      ])
    : "";
  const lastInput =
    [...args.agentContext.recentMessages].reverse().find((message) => message.role === "user")?.content ?? "";
  const now = new Date();

  return {
    chatId: args.chatId,
    chatMode: args.agentContext.chatMode,
    personaId: args.personaId,
    personaName,
    characterId: primaryCharacterId,
    characterName: primaryCharacterName,
    characterIds,
    characterNames,
    characters,
    variables: stringRecord(args.chatMetadata.agentVariables),
    macros: {
      chatId: args.chatId,
      chatMode: args.agentContext.chatMode,
      personaId: args.personaId,
      user: personaName ?? "",
      userName: personaName ?? "",
      persona: personaFields,
      characterId: primaryCharacterId ?? "",
      characterName: primaryCharacterName ?? "",
      char: primaryCharacterName ?? "",
      charName: primaryCharacterName ?? "",
      characters: characterNames.join(", "),
      description: primaryCharacter?.description ?? "",
      personality: primaryCharacter?.personality ?? "",
      backstory: primaryCharacter?.backstory ?? "",
      appearance: primaryCharacter?.appearance ?? "",
      scenario: primaryCharacter?.scenario ?? "",
      example: primaryCharacter?.mesExample ?? "",
      charSysInfo: primaryCharacter?.systemPrompt ?? "",
      charPostHistory: primaryCharacter?.postHistoryInstructions ?? "",
      input: lastInput,
      date: now.toISOString().slice(0, 10),
      time: now.toTimeString().slice(0, 5),
      datetime: now.toISOString(),
      isotime: now.toISOString(),
      weekday: now.toLocaleDateString("en-US", { weekday: "long" }),
    },
    recentMessages: args.agentContext.recentMessages.map((message) => ({
      id: message.id ?? null,
      role: message.role,
      characterId: message.characterId ?? null,
    })),
    gameState: args.gameState ?? null,
  };
}

function validateToolSchema(schema: unknown): Record<string, unknown> {
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
    throw new Error("parametersSchema must be a JSON object");
  }

  const schemaObject = schema as Record<string, unknown>;
  const schemaType = schemaObject.type;
  const schemaProperties = schemaObject.properties;
  const schemaRequired = schemaObject.required;

  if (schemaType !== undefined && schemaType !== "object") {
    throw new Error('parametersSchema root "type" must be "object"');
  }
  if (
    schemaProperties !== undefined &&
    (!schemaProperties || typeof schemaProperties !== "object" || Array.isArray(schemaProperties))
  ) {
    throw new Error('parametersSchema "properties" must be an object');
  }
  if (schemaType === undefined && (!schemaProperties || typeof schemaProperties !== "object")) {
    throw new Error('parametersSchema must define root "type": "object" or include object "properties"');
  }
  if (
    schemaRequired !== undefined &&
    (!Array.isArray(schemaRequired) || schemaRequired.some((entry) => typeof entry !== "string"))
  ) {
    throw new Error('parametersSchema "required" must be an array of strings');
  }

  return schemaObject;
}

async function loadToolDefinitions(args: {
  customToolsStore: CustomToolsStore;
  resolveTools: boolean;
  enableChatTools: boolean;
  activeToolIds: string[];
}): Promise<{ toolDefs: LLMToolDefinition[] | undefined; allToolDefs: LLMToolDefinition[]; customToolDefs: CustomToolDef[] }> {
  let toolDefs: LLMToolDefinition[] | undefined;
  const allToolDefs: LLMToolDefinition[] = [];
  const customToolDefs: CustomToolDef[] = [];

  if (!args.resolveTools) return { toolDefs, allToolDefs, customToolDefs };

  const registeredToolSources = new Map<string, "built-in" | "custom">();

  for (const tool of BUILT_IN_TOOLS) {
    const existingSource = registeredToolSources.get(tool.name);
    if (existingSource) {
      throw new Error(`Duplicate tool name "${tool.name}" from built-in tool collides with existing ${existingSource} tool`);
    }
    registeredToolSources.set(tool.name, "built-in");
    allToolDefs.push({
      type: "function" as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters as unknown as Record<string, unknown>,
      },
    });
  }

  const enabledCustomTools = await args.customToolsStore.listEnabled();
  for (const customTool of enabledCustomTools) {
    const existingSource = registeredToolSources.get(customTool.name);
    if (existingSource) {
      logger.warn(
        '[tools] Skipping custom tool "%s" because it collides with existing %s tool',
        customTool.name,
        existingSource,
      );
      continue;
    }
    registeredToolSources.set(customTool.name, "custom");

    try {
      const parsedSchema =
        typeof customTool.parametersSchema === "string"
          ? JSON.parse(customTool.parametersSchema)
          : customTool.parametersSchema;
      const schemaObject = validateToolSchema(parsedSchema);

      customToolDefs.push({
        name: customTool.name,
        executionType: customTool.executionType,
        webhookUrl: customTool.webhookUrl,
        staticResult: customTool.staticResult,
        scriptBody: customTool.scriptBody,
        includeHiddenContext: booleanText(customTool.includeHiddenContext),
      });

      allToolDefs.push({
        type: "function" as const,
        function: {
          name: customTool.name,
          description: customTool.description,
          parameters: schemaObject,
        },
      });
    } catch (error) {
      registeredToolSources.delete(customTool.name);
      logger.warn(
        error,
        '[tools] Skipping custom tool "%s" with invalid parameter schema: %s',
        customTool.name,
        String(customTool.parametersSchema),
      );
    }
  }

  if (args.enableChatTools) {
    const hasToolFilter = args.activeToolIds.length > 0;
    toolDefs = hasToolFilter
      ? allToolDefs.filter(
          (toolDef) =>
            args.activeToolIds.includes(toolDef.function.name) && !AGENT_ONLY_TOOL_NAMES.has(toolDef.function.name),
        )
      : allToolDefs.filter((toolDef) => !AGENT_ONLY_TOOL_NAMES.has(toolDef.function.name));
  }

  return { toolDefs, allToolDefs, customToolDefs };
}

function resolveAgentWritableLorebookId(agentSettings: Record<string, unknown>): string | null {
  const enabledTools = Array.isArray(agentSettings.enabledTools) ? agentSettings.enabledTools : [];
  const lorebookWriteEnabled =
    agentSettings.lorebookWriteEnabled === true || enabledTools.includes("save_lorebook_entry");
  if (!lorebookWriteEnabled) return null;
  for (const key of ["writableLorebookId", "targetLorebookId"]) {
    const value = agentSettings[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  const writableIds = agentSettings.writableLorebookIds;
  if (Array.isArray(writableIds)) {
    const first = writableIds.find((value): value is string => typeof value === "string" && value.trim().length > 0);
    if (first) return first.trim();
  }
  return null;
}

function createLorebookEntryWriter(
  lorebooksStore: LorebooksStore,
  agent: ResolvedAgent,
  agentSettings: Record<string, unknown>,
  options: { requireApproval: boolean; chatId: string },
) {
  const writableLorebookId = resolveAgentWritableLorebookId(agentSettings);
  if (!writableLorebookId) return undefined;

  return async (entry: {
    name: string;
    content: string;
    description?: string;
    keys: string[];
    tag?: string;
    mode: "create" | "replace" | "append";
  }) => {
    // When agent write-approval is required, never write inline — surface a proposal
    // envelope (mirroring the structured lorebook_update gate) so the user approves
    // the write before it touches the lorebook DB.
    if (options.requireApproval) {
      return {
        requiresApproval: true,
        approval: buildLorebookWriteApprovalProposal({
          chatId: options.chatId,
          agentType: agent.type,
          agentName: agent.name ?? agent.type,
          updates: [
            {
              action: entry.mode === "create" ? "create" : "update",
              name: entry.name,
              content: entry.content,
              description: entry.description ?? "",
              keys: entry.keys,
              tag: entry.tag ?? "",
              mode: entry.mode,
            },
          ],
          preferredTargetLorebookId: writableLorebookId,
          writableLorebookIds: [writableLorebookId],
        }),
      };
    }

    const targetLorebook = await lorebooksStore.getById(writableLorebookId);
    if (!targetLorebook) {
      return { error: "Selected lorebook is no longer available.", lorebookId: writableLorebookId };
    }

    const existingEntries = await lorebooksStore.listEntries(writableLorebookId);
    const normalizedName = entry.name.trim().toLocaleLowerCase();
    const existing = existingEntries.find(
      (candidate: any) =>
        typeof candidate.name === "string" && candidate.name.trim().toLocaleLowerCase() === normalizedName,
    ) as any;
    const keys = Array.from(new Set(entry.keys.map((key) => key.trim()).filter(Boolean)));

    if (!existing || entry.mode === "create") {
      const created = await lorebooksStore.createEntry({
        lorebookId: writableLorebookId,
        name: entry.name,
        content: entry.content,
        description: entry.description ?? "",
        keys,
        tag: entry.tag ?? "",
        enabled: true,
        constant: false,
        selective: false,
        position: 0,
        depth: 4,
        role: "system",
      });
      return {
        applied: true,
        action: "created",
        lorebookId: writableLorebookId,
        lorebookName: (targetLorebook as any).name,
        entryId: (created as any)?.id ?? null,
        name: entry.name,
        sourceAgentId: agent.id,
      };
    }

    const existingContent = typeof existing.content === "string" ? existing.content : "";
    const nextContent =
      entry.mode === "append" && existingContent.trim()
        ? existingContent.includes(entry.content)
          ? existingContent
          : `${existingContent.trim()}\n\n${entry.content}`
        : entry.content;
    const existingKeys = Array.isArray(existing.keys)
      ? existing.keys.filter((key: unknown): key is string => typeof key === "string")
      : [];
    const updated = await lorebooksStore.updateEntry(existing.id, {
      content: nextContent,
      description: entry.description ?? existing.description ?? "",
      keys: Array.from(new Set([...existingKeys, ...keys])),
      ...(entry.tag !== undefined ? { tag: entry.tag } : {}),
      enabled: true,
    });
    return {
      applied: true,
      action: entry.mode === "append" ? "appended" : "replaced",
      lorebookId: writableLorebookId,
      lorebookName: (targetLorebook as any).name,
      entryId: (updated as any)?.id ?? existing.id,
      name: entry.name,
      sourceAgentId: agent.id,
    };
  };
}

function resetSpotifyAgentRuntime(agent: ResolvedAgent): void {
  const spotifyAgent = agent as SpotifyRuntimeAgent;
  spotifyAgent.__spotifyToolCalls = new Set<string>();
  spotifyAgent.__spotifyPlayApplied = false;
  spotifyAgent.__spotifyPlayError = null;
  spotifyAgent.__spotifyToolError = null;
  spotifyAgent.__spotifyPlaybackPending = false;
  spotifyAgent.__spotifyPlayUris = [];
  spotifyAgent.__spotifyCandidateTracks = [];
  spotifyAgent.__spotifyCurrentAfterPlayUri = null;
  spotifyAgent.__spotifyPlayDisplay = null;
  spotifyAgent.__spotifyPlayReason = null;
  spotifyAgent.__spotifyQueued = null;
  spotifyAgent.__spotifyDevice = null;
}

export async function resolveGenerationTools({
  requestBody,
  chatId,
  chatMetadata,
  chats,
  agentsStore,
  customToolsStore,
  lorebooksStore,
  resolvedAgents,
  enabledConfigs,
  promptCharacterIds,
  personaId,
  activeLorebookIds,
  excludedLorebookIds,
  excludedSourceAgentIds,
  gameState,
  gameSpotifyMusicEnabled,
  agentContext,
  emitMetadataPatch,
}: ResolveGenerationToolsArgs): Promise<ResolvedGenerationTools> {
  const enableChatTools = requestBody.enableTools === true || chatMetadata.enableTools === true;
  const enableAgentTools = resolvedAgents.some((agent) => {
    const agentSettings = parseSettings(agent.settings);
    return (
      (Array.isArray(agentSettings.enabledTools) && agentSettings.enabledTools.length > 0) ||
      (agent.type === "spotify" && (DEFAULT_AGENT_TOOLS.spotify?.length ?? 0) > 0)
    );
  });
  const activeToolIds: string[] = Array.isArray(chatMetadata.activeToolIds)
    ? (chatMetadata.activeToolIds as string[])
    : [];
  const { allToolDefs, customToolDefs, ...loadedTools } = await loadToolDefinitions({
    customToolsStore,
    resolveTools: enableChatTools || enableAgentTools,
    enableChatTools,
    activeToolIds,
  });
  let toolDefs = loadedTools.toolDefs;

  const resolvedToolNames = new Set(allToolDefs.map((toolDef) => toolDef.function.name));
  const chatResolvedToolNames = new Set((toolDefs ?? []).map((toolDef) => toolDef.function.name));
  const spotifyToolNames = new Set(DEFAULT_AGENT_TOOLS.spotify ?? []);
  const agentResolvedSpotifyToolGroups = resolvedAgents.map((agent) => {
    const agentSettings = parseSettings(agent.settings);
    const agentEnabledNames = Array.isArray(agentSettings.enabledTools) ? (agentSettings.enabledTools as string[]) : [];
    return agentEnabledNames.filter((name) => resolvedToolNames.has(name));
  });
  const spotifyAvailabilityRequest = resolveSpotifyToolAvailabilityRequest({
    enableChatTools,
    hasChatToolFilter: activeToolIds.length > 0,
    chatResolvedToolNames,
    agentResolvedToolNameGroups: agentResolvedSpotifyToolGroups,
    spotifyToolNames,
  });
  const spotifyAgentId =
    resolvedAgents.find((agent) => agent.type === "spotify" && !agent.id.startsWith("builtin:"))?.id ??
    enabledConfigs.find((cfg: any) => cfg.type === "spotify")?.id ??
    null;
  const spotifyCredentials = spotifyAvailabilityRequest.needsSpotifyCredentials
    ? await resolveSpotifyCredentials(agentsStore as any, { agentId: spotifyAgentId, refreshSkewMs: 60_000 })
    : null;
  if (spotifyCredentials && !("accessToken" in spotifyCredentials)) {
    logger.debug("[spotify] credentials unavailable for tool execution: %s", spotifyCredentials.error);
  }
  const spotifyCreds =
    spotifyCredentials && "accessToken" in spotifyCredentials
      ? { accessToken: spotifyCredentials.accessToken }
      : undefined;
  const spotifyToolsAvailable = Boolean(
    spotifyCredentials &&
      "accessToken" in spotifyCredentials &&
      spotifyHasScope(spotifyCredentials.scopes, "user-modify-playback-state"),
  );
  if (!spotifyToolsAvailable && toolDefs) {
    const beforeCount = toolDefs.length;
    toolDefs = toolDefs.filter((toolDef) => !spotifyToolNames.has(toolDef.function.name));
    if (beforeCount !== toolDefs.length && spotifyAvailabilityRequest.shouldLogUnavailableToolOmission) {
      logger.debug("[spotify] Omitted unavailable Spotify tools from main generation");
    }
  }

  const searchLorebookForTools = async (query: string, category?: string | null) => {
    const entries = await lorebooksStore.listActiveEntries({
      chatId,
      characterIds: promptCharacterIds,
      personaId,
      activeLorebookIds,
      excludedLorebookIds,
      excludedSourceAgentIds,
    });
    const normalizedQuery = query.toLowerCase();
    return entries
      .filter((entry: any) => {
        const nameMatch = typeof entry.name === "string" && entry.name.toLowerCase().includes(normalizedQuery);
        const contentMatch = typeof entry.content === "string" && entry.content.toLowerCase().includes(normalizedQuery);
        const keyMatch =
          Array.isArray(entry.keys) &&
          entry.keys.some((key: unknown) => typeof key === "string" && key.toLowerCase().includes(normalizedQuery));
        const categoryMatch = !category || entry.tag === category;
        return categoryMatch && (nameMatch || contentMatch || keyMatch);
      })
      .slice(0, 20)
      .map((entry: any) => ({
        name: entry.name,
        content: entry.content,
        tag: entry.tag,
        keys: entry.keys as string[],
      }));
  };

  const updateChatMetadataForTools = async (patchOrUpdater: MetadataPatchInput): Promise<MetadataPatch> => {
    let emittedPatch: Record<string, unknown> = {};
    const updatedChat = await chats.patchMetadata(chatId, async (currentMeta) => {
      const patch = typeof patchOrUpdater === "function" ? await patchOrUpdater({ ...currentMeta }) : patchOrUpdater;
      emittedPatch = patch;
      return patch;
    });
    const hasUpdatedMetadata = updatedChat && Object.prototype.hasOwnProperty.call(updatedChat, "metadata");
    const updatedMeta = hasUpdatedMetadata ? parseExtra(updatedChat.metadata) : { ...chatMetadata, ...emittedPatch };
    if (hasUpdatedMetadata) {
      for (const key of Object.keys(chatMetadata)) {
        if (!(key in updatedMeta)) {
          delete chatMetadata[key];
        }
      }
    }
    Object.assign(chatMetadata, updatedMeta);
    agentContext.chatSummary =
      typeof chatMetadata.summary === "string" && chatMetadata.summary.trim() ? chatMetadata.summary.trim() : null;
    emitMetadataPatch(emittedPatch);
    return updatedMeta;
  };

  const replaceChatMessageContent = async (input: {
    messageId: string;
    content: string;
    reason?: string;
  }): Promise<Record<string, unknown>> => {
    const message = await chats.getMessage(input.messageId);
    if (!message || message.chatId !== chatId) {
      return { error: "Message not found in this chat.", messageId: input.messageId };
    }
    if (message.role !== "user" && message.role !== "assistant") {
      return { error: "Only user or assistant messages can be edited.", messageId: input.messageId };
    }
    await chats.updateMessageContent(input.messageId, input.content);
    return {
      applied: true,
      messageId: input.messageId,
      role: message.role,
      reason: input.reason ?? null,
    };
  };

  const baseToolExecutionContext: ToolExecutionContext = {
    gameState: gameState ? (gameState as Record<string, unknown>) : undefined,
    hiddenContext: buildCustomToolHiddenContext({
      requestBody,
      chatId,
      chatMetadata,
      promptCharacterIds,
      personaId,
      agentContext,
      gameState,
    }),
    customTools: customToolDefs,
    spotify: spotifyCreds,
    spotifyRepeatAfterPlay: gameSpotifyMusicEnabled ? "track" : undefined,
    searchLorebook: searchLorebookForTools,
    chatMeta: chatMetadata,
    onUpdateMetadata: updateChatMetadataForTools,
  };

  for (const agent of resolvedAgents) {
    if (agent.toolContext) continue;

    const agentSettings = parseSettings(agent.settings);
    let agentEnabledNames = Array.isArray(agentSettings.enabledTools) ? (agentSettings.enabledTools as string[]) : [];
    // YouTube-mode Music DJ has no tools by design (pure-JSON); only backfill the
    // Spotify tools when the agent is actually in Spotify mode.
    if (
      agent.type === "spotify" &&
      agentSettings.musicProvider !== "youtube" &&
      agentSettings.musicPlayerSource !== "youtube" &&
      agentSettings.musicProvider !== "custom" &&
      agentSettings.musicPlayerSource !== "custom" &&
      agentEnabledNames.length === 0
    ) {
      agentEnabledNames = [...spotifyToolNames];
      agent.settings = { ...agentSettings, enabledTools: agentEnabledNames };
    }
    if (agentEnabledNames.length === 0) continue;

    const allowSpotifyAgentTools = agent.type === "spotify";
    const agentTools = allToolDefs.filter(
      (toolDef) =>
        agentEnabledNames.includes(toolDef.function.name) &&
        (toolDef.function.name !== "edit_chat_message" || customAgentHasCapability(agentSettings, "edit_messages")) &&
        (spotifyToolsAvailable || !spotifyToolNames.has(toolDef.function.name) || allowSpotifyAgentTools),
    );
    if (agentTools.length === 0) continue;

    const allowedToolNames = new Set(agentTools.map((toolDef) => toolDef.function.name));
    const saveLorebookEntry = createLorebookEntryWriter(lorebooksStore, agent, agentSettings, {
      requireApproval: agentWriteApprovalRequired(chatMetadata),
      chatId,
    });
    const replaceChatMessageContentForAgent = customAgentHasCapability(agentSettings, "edit_messages")
      ? replaceChatMessageContent
      : undefined;
    if (agent.type === "spotify") {
      resetSpotifyAgentRuntime(agent);
    }

    agent.toolContext = {
      tools: agentTools,
      executeToolCall: async (call) => {
        if (agent.type === "spotify") {
          ((agent as SpotifyRuntimeAgent).__spotifyToolCalls ??= new Set<string>()).add(call.function.name);
        }
        if (!allowedToolNames.has(call.function.name)) {
          return JSON.stringify({
            error: `Tool not allowed for agent ${agent.type}: ${call.function.name}`,
            allowed: Array.from(allowedToolNames),
          });
        }
        const results = await executeToolCalls([call], {
          ...baseToolExecutionContext,
          saveLorebookEntry,
          replaceChatMessageContent: replaceChatMessageContentForAgent,
        });
        const result = results[0]?.result ?? "Tool execution failed";
        if (agent.type === "spotify" && call.function.name === "spotify_play") {
          try {
            const parsed = JSON.parse(result) as Record<string, unknown>;
            const spotifyAgent = agent as SpotifyRuntimeAgent;
            if (typeof parsed.error === "string") {
              spotifyAgent.__spotifyToolError = parsed.error;
            }
            if (parsed.applied === true) {
              spotifyAgent.__spotifyPlayApplied = true;
              spotifyAgent.__spotifyPlayError = null;
              spotifyAgent.__spotifyPlaybackPending = parsed.playbackPending === true;
              spotifyAgent.__spotifyPlayUris = readSpotifyTrackUris(parsed);
              spotifyAgent.__spotifyCurrentAfterPlayUri = readSpotifyPlaybackTrackUri(parsed);
              spotifyAgent.__spotifyPlayDisplay = readSpotifyStringField(parsed, "display") || null;
              spotifyAgent.__spotifyPlayReason = readSpotifyStringField(parsed, "reason") || null;
              spotifyAgent.__spotifyQueued = readSpotifyNumberField(parsed, "queued");
              spotifyAgent.__spotifyDevice = readSpotifyStringField(parsed, "device") || null;
            } else if (typeof parsed.error === "string") {
              spotifyAgent.__spotifyPlayError = parsed.error;
            }
          } catch {
            (agent as SpotifyRuntimeAgent).__spotifyPlayError = "spotify_play returned an unparseable response";
            // Leave the raw tool result for the model; downstream fallback can now stop instead of replaying.
          }
        } else if (agent.type === "spotify" && spotifyToolNames.has(call.function.name)) {
          try {
            const parsed = JSON.parse(result) as Record<string, unknown>;
            rememberSpotifyCandidateTracks(agent as SpotifyRuntimeAgent, parsed);
            if (typeof parsed.error === "string") {
              (agent as SpotifyRuntimeAgent).__spotifyToolError = parsed.error;
            }
          } catch {
            // Non-JSON Spotify tool results are passed through to the model unchanged.
          }
        }
        return result;
      },
    };
  }

  return {
    enableChatTools,
    chatResolvedToolNames,
    toolDefs,
    baseToolExecutionContext,
    updateChatMetadataForTools,
  };
}
