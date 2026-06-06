import { BUILT_IN_TOOLS, DEFAULT_AGENT_TOOLS, type ToolDefinition } from "../contracts/types/agent";
import type { IntegrationGateway } from "../capabilities/integrations";
import type { LlmToolDefinition } from "../capabilities/llm";
import type { StorageGateway } from "../capabilities/storage";
import type { LorebookEntry } from "../contracts/types/lorebook";
import type { LLMToolCall, LLMToolDefinition } from "../generation-core/llm/base-provider";
import { lorebookEntryPassesContextFilters } from "../generation-core/lorebooks/keyword-scanner";
import { appendChatSummaryEntryToMetadata } from "../shared/text/chat-summary-entries";
import { loadLorebookEntriesForActivationBatch, lorebookAppliesToContext } from "./active-lorebook-scanner";
import type { GenerationCharacterContext, GenerationPersonaContext } from "./prompt-assembly";
import {
  boolish,
  isRecord,
  newId,
  nowIso,
  parseRecord,
  readNumber,
  readString,
  type JsonRecord,
} from "./runtime-records";

/**
 * Narrow input shape consumed by tool runtime helpers.
 *
 * `GenerationAgentRuntimeInput` (in `agent-runner.ts`) extends this shape
 * structurally, so existing agent-path callers pass without change. The main
 * generation path constructs this directly from the chat record + assembly
 * output.
 */
export interface ToolRuntimeInput {
  chat: JsonRecord;
  storedMessages?: JsonRecord[];
  activatedLorebookEntries: Array<{
    id: string;
    name: string;
    content: string;
    tag: string;
    matchedKeys?: string[];
    keys?: string[];
    secondaryKeys?: string[];
  }>;
  characters: GenerationCharacterContext[];
  persona: GenerationPersonaContext | null;
  chatSummary: string | null;
  hideAutomatedSummarySourceMessages?: boolean;
}

export interface CustomToolRecord extends JsonRecord {
  name: string;
  description: string;
  parametersSchema: unknown;
  executionType: string;
  webhookUrl: string | null;
  staticResult: string | null;
  enabled: string | boolean;
}

interface ToolDeps {
  storage: StorageGateway;
  integrations: IntegrationGateway;
}

const chatMetadataQueues = new Map<string, Promise<void>>();

export function normalizeToolCall(value: unknown): LLMToolCall | null {
  if (!isRecord(value)) return null;
  const rawFunction = isRecord(value.function) ? value.function : value;
  const name = readString(rawFunction.name || value.name).trim();
  if (!name) return null;
  const rawArgs = rawFunction.arguments ?? value.arguments;
  const args = typeof rawArgs === "string" ? rawArgs : JSON.stringify(rawArgs ?? {});
  return {
    id: readString(value.id) || `tool-${name}-${Date.now().toString(36)}`,
    name,
    arguments: args,
    function: {
      name,
      arguments: args,
    },
  };
}

function parseToolParameters(value: unknown): unknown {
  if (!value) return { type: "object", properties: {} };
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return { type: "object", properties: {} };
    }
  }
  return value;
}

function customToolRecord(row: JsonRecord): CustomToolRecord | null {
  const name = readString(row.name).trim();
  if (!name || !boolish(row.enabled, false)) return null;
  const executionType = readString(row.executionType, "static");
  if (executionType !== "static" && executionType !== "webhook") return null;
  return {
    ...row,
    name,
    description: readString(row.description),
    parametersSchema: parseToolParameters(row.parametersSchema),
    executionType,
    webhookUrl: readString(row.webhookUrl).trim() || null,
    staticResult: readString(row.staticResult),
    enabled: row.enabled as string | boolean,
  };
}

export async function loadCustomTools(storage: StorageGateway): Promise<Map<string, CustomToolRecord>> {
  const tools = new Map<string, CustomToolRecord>();
  for (const row of await storage.list<JsonRecord>("custom-tools")) {
    const tool = customToolRecord(row);
    if (tool) tools.set(tool.name, tool);
  }
  return tools;
}

export function customToolDefinition(tool: CustomToolRecord): LLMToolDefinition {
  return {
    name: tool.name,
    description: tool.description || `Run custom tool ${tool.name}.`,
    parameters: tool.parametersSchema,
  };
}

export const BUILT_IN_TOOL_MAP: Map<string, ToolDefinition> = new Map(BUILT_IN_TOOLS.map((tool) => [tool.name, tool]));

export function builtInToolDefinition(name: string): LLMToolDefinition | null {
  const tool = BUILT_IN_TOOL_MAP.get(name);
  if (!tool) return null;
  return {
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
  };
}

export function stringifyToolResult(value: unknown): string {
  if (typeof value === "string") return value;
  if (isRecord(value) && typeof value.result === "string") return value.result;
  return JSON.stringify(value ?? null);
}

function toolArguments(call: LLMToolCall): JsonRecord {
  const raw = call.function?.arguments || call.arguments || "{}";
  if (typeof raw === "string") return parseRecord(raw);
  return parseRecord(raw);
}

function stringArg(args: JsonRecord, key: string, fallback = ""): string {
  return readString(args[key], fallback).trim();
}

function numberArg(args: JsonRecord, key: string, fallback: number): number {
  return readNumber(args[key], fallback);
}

function stringArrayArg(args: JsonRecord, key: string): string[] {
  const value = args[key];
  if (!Array.isArray(value)) return [];
  return value.map((item) => readString(item).trim()).filter(Boolean);
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) return false;
    seen.add(trimmed);
    return true;
  });
}

function toolError(message: string): never {
  throw new Error(message);
}

function requireChatId(input: ToolRuntimeInput): string {
  const chatId = readString(input.chat.id).trim();
  if (!chatId) toolError("Tool requires a persisted chat id.");
  return chatId;
}

function automatedSummarySourceMessageIds(input: ToolRuntimeInput): string[] {
  const seen = new Set<string>();
  return (input.storedMessages ?? [])
    .filter((message) => !hiddenFromAiRecord(message))
    .slice(-60)
    .map((message) => readString(message.id).trim())
    .filter((id) => {
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
}

function hiddenFromAiRecord(message: JsonRecord): boolean {
  const extra = parseRecord(message.extra);
  return boolish(extra.hiddenFromAI ?? extra.hiddenFromAi, false);
}

async function hideSummarySourceMessages(storage: StorageGateway, messageIds: string[]): Promise<string[]> {
  const results = await Promise.allSettled(
    messageIds.map((messageId) => storage.patchChatMessageExtra(messageId, { hiddenFromAI: true, hiddenFromAi: true })),
  );
  const hiddenIds: string[] = [];
  for (const [index, result] of results.entries()) {
    const messageId = messageIds[index];
    if (!messageId) continue;
    if (result.status === "fulfilled") {
      hiddenIds.push(messageId);
    } else {
      console.warn("[tools-runtime] Failed to hide automated summary source message", {
        messageId,
        error: result.reason,
      });
    }
  }
  return hiddenIds;
}

async function updateChatMetadata(
  storage: StorageGateway,
  input: ToolRuntimeInput,
  updater: (metadata: JsonRecord) => JsonRecord,
): Promise<JsonRecord> {
  const chatId = requireChatId(input);
  return withChatMetadataQueue(chatId, async () => {
    const latestChat = (await storage.get<JsonRecord>("chats", chatId)) ?? input.chat;
    const metadata = updater({ ...parseRecord(latestChat.metadata) });
    await storage.update("chats", chatId, { metadata });
    input.chat.metadata = metadata;
    return metadata;
  });
}

async function withChatMetadataQueue<T>(chatId: string, task: () => Promise<T>): Promise<T> {
  const previous = chatMetadataQueues.get(chatId) ?? Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const queued = previous.catch(() => undefined).then(() => gate);
  chatMetadataQueues.set(chatId, queued);
  await previous.catch(() => undefined);
  try {
    return await task();
  } finally {
    release();
    if (chatMetadataQueues.get(chatId) === queued) {
      chatMetadataQueues.delete(chatId);
    }
  }
}

function rollDiceNotation(notation: string) {
  const match = notation.trim().match(/^(\d*)d(\d+)([+-]\d+)?$/i);
  if (!match) toolError("Dice notation must look like 1d20, 2d6, or 3d8+2.");
  const count = Math.max(1, Math.min(100, Number(match[1] || "1")));
  const sides = Math.max(2, Math.min(1000, Number(match[2])));
  const modifier = Number(match[3] || "0");
  const rolls = Array.from({ length: count }, () => Math.floor(Math.random() * sides) + 1);
  return {
    notation: `${count}d${sides}${modifier === 0 ? "" : modifier > 0 ? `+${modifier}` : modifier}`,
    rolls,
    modifier,
    total: rolls.reduce((sum, value) => sum + value, 0) + modifier,
  };
}

function lorebookToolEntryPassesContext(entry: LorebookEntry, input: ToolRuntimeInput): boolean {
  return lorebookEntryPassesContextFilters(entry, {
    activeCharacterIds: input.characters.map((character) => character.id),
    activeCharacterTags: input.characters.flatMap((character) => character.tags),
    generationTriggers: ["chat", readString(input.chat.mode || input.chat.chatMode)].filter(Boolean),
  });
}

async function loadSearchableStoredLorebookEntries(
  storage: StorageGateway,
  input: ToolRuntimeInput,
): Promise<LorebookEntry[]> {
  const lorebooks = (await storage.list<JsonRecord>("lorebooks")).filter((book) =>
    lorebookAppliesToContext(book, input.chat, input.characters, input.persona),
  );
  const entriesByBook = await loadLorebookEntriesForActivationBatch(storage, lorebooks);
  return [...entriesByBook.values()].flat().filter((entry) => lorebookToolEntryPassesContext(entry, input));
}

async function searchLorebookTool(storage: StorageGateway, input: ToolRuntimeInput, args: JsonRecord) {
  const query = stringArg(args, "query").toLowerCase();
  if (!query) toolError("query is required.");
  const category = stringArg(args, "category").toLowerCase();
  const tokens = query.split(/\s+/).filter((token) => token.length > 1);
  const rows = await loadSearchableStoredLorebookEntries(storage, input);
  const storedById = new Map(rows.map((entry) => [entry.id, entry]));
  const activatedIds = new Set(input.activatedLorebookEntries.map((entry) => entry.id).filter(Boolean));
  const activated = input.activatedLorebookEntries.map((entry) => ({
    id: entry.id,
    name: storedById.get(entry.id)?.name || entry.name,
    content: storedById.get(entry.id)?.content || entry.content,
    tag: storedById.get(entry.id)?.tag || entry.tag,
    keys: uniqueStrings([
      ...(entry.matchedKeys ?? []),
      ...(entry.keys ?? []),
      ...(storedById.get(entry.id)?.keys ?? []),
    ]),
    secondaryKeys: uniqueStrings([...(entry.secondaryKeys ?? []), ...(storedById.get(entry.id)?.secondaryKeys ?? [])]),
    source: "activated",
  }));
  const stored = rows
    .filter((entry) => !activatedIds.has(entry.id))
    .map((entry) => ({
      id: entry.id,
      name: entry.name || "Lorebook entry",
      content: entry.content,
      tag: entry.tag || String(entry.position),
      keys: entry.keys,
      secondaryKeys: entry.secondaryKeys,
      source: "stored",
    }));
  const scored = [...activated, ...stored]
    .filter((entry) => {
      if (!entry.id) return false;
      if (category && !`${entry.name} ${entry.tag}`.toLowerCase().includes(category)) return false;
      return true;
    })
    .map((entry) => {
      const keyText = [...entry.keys, ...entry.secondaryKeys].join(" ");
      const haystack = `${entry.name} ${entry.tag} ${entry.content} ${keyText}`.toLowerCase();
      const score =
        (haystack.includes(query) ? 10 : 0) +
        tokens.reduce((sum, token) => sum + (haystack.includes(token) ? 1 : 0), 0);
      return { ...entry, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map((entry) => ({
      id: entry.id,
      name: entry.name,
      tag: entry.tag || null,
      source: entry.source,
      score: entry.score,
      keys: entry.keys.slice(0, 12),
      secondaryKeys: entry.secondaryKeys.slice(0, 12),
      content: entry.content.slice(0, 4000),
    }));
  return { query, entries: scored };
}

export async function executeBuiltInTool(
  deps: ToolDeps,
  input: ToolRuntimeInput,
  agent: JsonRecord,
  call: LLMToolCall,
): Promise<unknown> {
  const { storage, integrations } = deps;
  const toolName = call.function?.name || call.name;
  const args = toolArguments(call);
  const chatId = requireChatId(input);

  switch (toolName) {
    case "roll_dice": {
      const notation = stringArg(args, "notation");
      if (!notation) toolError("notation is required.");
      return { ...rollDiceNotation(notation), reason: stringArg(args, "reason") || null };
    }
    case "update_game_state": {
      const update = {
        id: newId("game_state_update"),
        createdAt: nowIso(),
        type: stringArg(args, "type"),
        target: stringArg(args, "target"),
        key: stringArg(args, "key"),
        value: stringArg(args, "value"),
        description: stringArg(args, "description"),
      };
      if (!update.type || !update.target || !update.key) toolError("type, target, and key are required.");
      const gameState = await withChatMetadataQueue(chatId, async () => {
        const latestChat = (await storage.get<JsonRecord>("chats", chatId)) ?? input.chat;
        const metadata = parseRecord(latestChat.metadata);
        const updates = Array.isArray(metadata.agentGameStateUpdates) ? metadata.agentGameStateUpdates : [];
        metadata.agentGameStateUpdates = [...updates, update].slice(-100);
        const gameState = isRecord(latestChat.gameState) ? { ...latestChat.gameState } : {};
        if (update.type === "location_change") gameState.location = update.value;
        if (update.type === "time_advance") gameState.time = update.value;
        await storage.update("chats", chatId, { metadata, gameState });
        input.chat.metadata = metadata;
        input.chat.gameState = gameState;
        return gameState;
      });
      return { success: true, update, gameState };
    }
    case "set_expression": {
      const characterName = stringArg(args, "characterName");
      const expression = stringArg(args, "expression");
      if (!characterName || !expression) toolError("characterName and expression are required.");
      const metadata = await updateChatMetadata(storage, input, (current) => {
        const expressions = parseRecord(current.agentExpressions);
        expressions[characterName] = expression;
        return { ...current, agentExpressions: expressions };
      });
      return { success: true, characterName, expression, expressions: metadata.agentExpressions };
    }
    case "trigger_event": {
      const event = {
        id: newId("agent_event"),
        createdAt: nowIso(),
        eventType: stringArg(args, "eventType"),
        description: stringArg(args, "description"),
        involvedCharacters: stringArrayArg(args, "involvedCharacters"),
      };
      if (!event.eventType || !event.description) toolError("eventType and description are required.");
      await updateChatMetadata(storage, input, (current) => {
        const events = Array.isArray(current.agentEvents) ? current.agentEvents : [];
        return { ...current, agentEvents: [...events, event].slice(-100) };
      });
      return { success: true, event };
    }
    case "search_lorebook":
      return searchLorebookTool(storage, input, args);
    case "read_chat_summary":
      return { summary: (input.chatSummary ?? readString(parseRecord(input.chat.metadata).summary)) || null };
    case "append_chat_summary": {
      const text = stringArg(args, "text");
      if (!text) toolError("text is required.");
      const now = nowIso();
      const sourceMessageIds = automatedSummarySourceMessageIds(input);
      const hiddenMessageIds = input.hideAutomatedSummarySourceMessages
        ? await hideSummarySourceMessages(storage, sourceMessageIds)
        : [];
      const appended = await withChatMetadataQueue(chatId, async () => {
        const latestChat = (await storage.get<JsonRecord>("chats", chatId)) ?? input.chat;
        const metadata = parseRecord(latestChat.metadata);
        const appended = appendChatSummaryEntryToMetadata(
          metadata,
          {
            content: text,
            origin: "automated",
            sourceMode: "agent",
            title: "Agent memory",
            messageCount: sourceMessageIds.length || undefined,
            messageIds: sourceMessageIds.length > 0 ? sourceMessageIds : undefined,
          },
          { now, createId: () => newId("summary") },
        );
        metadata.summaryEntries = appended.entries;
        metadata.summary = appended.summary;
        input.chat.metadata = metadata;
        input.chatSummary = appended.summary;
        await storage.update("chats", chatId, { metadata });
        return appended;
      });
      return { success: true, entry: appended.entry, summary: appended.summary, hiddenMessageIds };
    }
    case "read_chat_variable": {
      const key = stringArg(args, "key");
      if (!key) toolError("key is required.");
      const variables = parseRecord(parseRecord(input.chat.metadata).agentVariables);
      return { key, value: typeof variables[key] === "string" ? variables[key] : null };
    }
    case "write_chat_variable": {
      const key = stringArg(args, "key");
      const value = stringArg(args, "value");
      if (!key) toolError("key is required.");
      await updateChatMetadata(storage, input, (current) => {
        const variables = parseRecord(current.agentVariables);
        variables[key] = value;
        return { ...current, agentVariables: variables };
      });
      return { success: true, key, value };
    }
    case "spotify_get_current_playback":
      return integrations.spotify.player({ agentId: spotifyAgentId(agent) });
    case "spotify_get_playlists": {
      const limit = Math.max(1, Math.min(50, Math.trunc(numberArg(args, "limit", 20))));
      return integrations.spotify.playlists({ agentId: spotifyAgentId(agent), limit });
    }
    case "spotify_get_playlist_tracks": {
      const playlistId = stringArg(args, "playlistId");
      if (!playlistId) toolError("playlistId is required.");
      const body: JsonRecord = {
        agentId: spotifyAgentId(agent),
        playlistId,
        query: stringArg(args, "query"),
        mood: stringArg(args, "mood"),
        limit: Math.max(1, Math.min(80, Math.trunc(numberArg(args, "candidateLimit", numberArg(args, "limit", 50))))),
      };
      const offset = numberArg(args, "offset", Number.NaN);
      if (Number.isFinite(offset)) body.offset = Math.max(0, Math.trunc(offset));
      return integrations.spotify.playlistTracks(body);
    }
    case "spotify_search":
      return integrations.spotify.searchTracks({
        agentId: spotifyAgentId(agent),
        query: stringArg(args, "query"),
        limit: Math.max(1, Math.min(50, Math.trunc(numberArg(args, "limit", 10)))),
      });
    case "spotify_play": {
      const uri = stringArg(args, "uri");
      const uris = stringArrayArg(args, "uris");
      if (!uri && uris.length === 0) toolError("uri or uris is required.");
      const body: JsonRecord = { agentId: spotifyAgentId(agent) };
      if (uris.length > 0) body.uris = uris;
      else if (uri.startsWith("spotify:track:")) body.uri = uri;
      else body.contextUri = uri;
      const chatMode = readString(input.chat.mode || input.chat.chatMode).trim();
      if (chatMode === "game") body.repeatAfterPlay = "track";
      return integrations.spotify.play(body);
    }
    case "spotify_set_volume":
      return integrations.spotify.volume({
        agentId: spotifyAgentId(agent),
        volume: Math.max(0, Math.min(100, Math.trunc(numberArg(args, "volume", 50)))),
      });
    default:
      return null;
  }
}

function spotifyAgentId(agent: JsonRecord): string {
  const settings = parseRecord(agent.settings);
  return readString(settings.spotifyAgentId).trim() || readString(agent.id).trim() || "spotify";
}

/**
 * Trivial wrapper around the custom-tools integration. Extracted so the main
 * generation path and the agent path execute custom tools through identical
 * code.
 */
export async function customToolExecutor(
  integrations: IntegrationGateway,
  call: LLMToolCall,
  tool?: CustomToolRecord | null,
): Promise<string> {
  const name = call.function?.name || call.name;
  if (!tool) return stringifyToolResult({ error: `Tool not enabled for this context: ${name}` });
  return stringifyToolResult(
    await integrations.customTools.execute({
      toolName: name,
      arguments: toolArguments(call),
    }),
  );
}

// ──────────────────────────────────────────────
// Main-path metadata gating (mode-neutral)
// ──────────────────────────────────────────────

function chatToolsEnabledFor(chat: JsonRecord): boolean {
  return boolish(parseRecord(chat.metadata).enableTools, false);
}

function chatActiveToolIdsFor(chat: JsonRecord): Set<string> {
  const value = parseRecord(chat.metadata).activeToolIds;
  if (!Array.isArray(value)) return new Set();
  return new Set(value.map((item) => readString(item).trim()).filter(Boolean));
}

// ──────────────────────────────────────────────
// Main-path public API
// ──────────────────────────────────────────────

const AGENT_ONLY_TOOL_NAMES = new Set([
  "read_chat_summary",
  "append_chat_summary",
  "read_chat_variable",
  "write_chat_variable",
]);
const SPOTIFY_TOOL_NAMES = new Set(DEFAULT_AGENT_TOOLS.spotify);

export interface BuildMainToolDefinitionsArgs {
  chat: JsonRecord;
  storage: StorageGateway;
  integrations: IntegrationGateway;
  includeSpotify?: boolean;
}

export interface MainToolDefinitions {
  toolDefs: LlmToolDefinition[];
  customTools: Map<string, CustomToolRecord>;
  /**
   * Set of tool names that survived the filter and were actually advertised to
   * the model. `executeMainToolCall` enforces this allowlist at dispatch time
   * so a hallucinated or injected call to a filtered-out tool (Spotify,
   * agent-only, inactive, name-collided custom) cannot reach execution.
   */
  allowedToolNames: Set<string>;
}

/**
 * Build the tool-definition set exposed to the main character LLM call.
 *
 * Returns `null` when chat-level tools are disabled or when the filtered set is
 * empty. The result is mode-neutral — it reads `chat.metadata.enableTools` and
 * `chat.metadata.activeToolIds` and never branches on `chat.mode`.
 *
 * Filtering rules:
 *  - Agent-only tools (`read_chat_summary`, `append_chat_summary`,
 *    `read_chat_variable`, `write_chat_variable`) are excluded from the main
 *    path; they remain exposed to agents via `buildAgentToolContext`.
 *  - Spotify tools are excluded unless `includeSpotify: true` is requested
 *    (default `false` — see design §4).
 *  - Custom tools whose name collides with a built-in are dropped; the built-in
 *    wins. Mirrors staging `generate.routes.ts:5984-5990`.
 */
export async function buildMainToolDefinitions(
  args: BuildMainToolDefinitionsArgs,
): Promise<MainToolDefinitions | null> {
  if (!chatToolsEnabledFor(args.chat)) return null;
  const activeIds = chatActiveToolIdsFor(args.chat);
  const filter = (name: string): boolean => {
    if (AGENT_ONLY_TOOL_NAMES.has(name)) return false;
    if (!args.includeSpotify && SPOTIFY_TOOL_NAMES.has(name)) return false;
    if (activeIds.size === 0) return true;
    return activeIds.has(name);
  };
  const builtIns: LlmToolDefinition[] = [];
  for (const tool of BUILT_IN_TOOLS) {
    if (!filter(tool.name)) continue;
    builtIns.push({ name: tool.name, description: tool.description, parameters: tool.parameters });
  }
  const loadedCustomTools = await loadCustomTools(args.storage);
  const customTools = new Map<string, CustomToolRecord>();
  const customs: LlmToolDefinition[] = [];
  for (const tool of loadedCustomTools.values()) {
    if (!filter(tool.name)) continue;
    // Dedupe: built-in wins on name collision. Matches staging behavior.
    if (BUILT_IN_TOOL_MAP.has(tool.name)) continue;
    customTools.set(tool.name, tool);
    customs.push(customToolDefinition(tool));
  }
  if (builtIns.length === 0 && customs.length === 0) return null;
  const allowedToolNames = new Set<string>([...builtIns.map((tool) => tool.name), ...customTools.keys()]);
  return { toolDefs: [...builtIns, ...customs], customTools, allowedToolNames };
}

export interface ExecuteMainToolCallArgs {
  deps: ToolDeps;
  input: ToolRuntimeInput;
  customTools: Map<string, CustomToolRecord>;
  allowedToolNames: Set<string>;
  call: LLMToolCall;
}

/**
 * Execute a single tool call from the main character LLM stream.
 *
 * Dispatches on tool name only — built-in first (synthetic main-agent record),
 * then custom tools, then a sentinel error for unknown tools. Errors thrown by
 * the underlying executor propagate to the caller (no swallowing).
 *
 * The synthetic main-agent record matters only for Spotify tools, which are
 * filtered out of `buildMainToolDefinitions` by default. If a future change
 * lifts that exclusion, the caller MUST also supply a real Spotify-agent id
 * (or refactor `spotifyAgentId` to fall back to `""`); the synthetic `"main"`
 * literal here will NOT resolve to default credentials — the Spotify gateway
 * calls `get_required(state, "agents", "main")`, which returns 404 unless an
 * agent with that literal id exists.
 */
export async function executeMainToolCall(args: ExecuteMainToolCallArgs): Promise<string> {
  const name = args.call.function?.name || args.call.name;
  if (!args.allowedToolNames.has(name)) {
    return stringifyToolResult({ error: `Tool not enabled for this chat: ${name}` });
  }
  if (BUILT_IN_TOOL_MAP.has(name)) {
    const syntheticMainAgent: JsonRecord = { id: "main", type: "main", name: "Main Generation" };
    return stringifyToolResult(await executeBuiltInTool(args.deps, args.input, syntheticMainAgent, args.call));
  }
  if (args.customTools.has(name)) {
    return customToolExecutor(args.deps.integrations, args.call, args.customTools.get(name));
  }
  return stringifyToolResult({ error: `Unknown tool: ${name}` });
}
