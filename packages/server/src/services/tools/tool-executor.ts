// ──────────────────────────────────────────────
// Tool Executor — Handles built-in + custom function calls
// ──────────────────────────────────────────────
import type { LLMToolCall } from "../llm/base-provider.js";
import vm from "node:vm";
import { createHash } from "node:crypto";
import { isCustomToolScriptEnabled, isWebhookLocalUrlsEnabled } from "../../config/runtime-config.js";
import { safeFetch } from "../../utils/security.js";
import { logger } from "../../lib/logger.js";
import { normalizeSpotifySearchQuery } from "../spotify/spotify.service.js";
import { appendChatSummaryEntryToMetadata } from "@marinara-engine/shared";
import { localEmbed } from "../local-embedder.js";
import type { AgentMemoryRecord } from "../storage/agents.storage.js";

export interface ToolExecutionResult {
  toolCallId: string;
  name: string;
  result: string;
  success: boolean;
}

/** A custom tool loaded from DB at execution time. */
export interface CustomToolDef {
  name: string;
  executionType: string;
  webhookUrl: string | null;
  staticResult: string | null;
  scriptBody: string | null;
}

/** Lorebook search function injected from the route layer. */
export type LorebookSearchFn = (
  query: string,
  category?: string | null,
) => Promise<Array<{ name: string; content: string; tag: string; keys: string[] }>>;

/** Spotify API credentials injected from the route layer. */
export interface SpotifyCredentials {
  accessToken: string;
}

export interface AgentMemoryStore {
  saveAgentMemory(input: {
    recordId?: string | null;
    agentConfigId: string;
    chatId: string;
    characterId?: string | null;
    memoryScope?: string | null;
    memoryType?: string | null;
    key?: string | null;
    title?: string | null;
    content: string;
    metadata?: Record<string, unknown> | null;
    embedding?: number[] | null;
    enabled?: boolean;
  }): Promise<AgentMemoryRecord>;
  listAgentMemory(
    filters?: {
      chatId?: string | null;
      characterId?: string | null;
      agentConfigId?: string | null;
      memoryScope?: string | null;
      memoryType?: string | null;
      includeInternal?: boolean;
      includeDeleted?: boolean;
      includeDisabled?: boolean;
    },
    limit?: number,
  ): Promise<AgentMemoryRecord[]>;
  getAgentMemoryRecord(id: string): Promise<AgentMemoryRecord | null>;
  softDeleteAgentMemory(id: string): Promise<AgentMemoryRecord | null>;
  searchAgentMemoryCandidates(
    filters?: {
      chatId?: string | null;
      characterId?: string | null;
      agentConfigId?: string | null;
      memoryScope?: string | null;
      memoryType?: string | null;
      includeInternal?: boolean;
      includeDeleted?: boolean;
      includeDisabled?: boolean;
    },
    limit?: number,
  ): Promise<AgentMemoryRecord[]>;
}

export type MetadataPatch = Record<string, unknown>;
export type MetadataUpdater = (current: MetadataPatch) => MetadataPatch | Promise<MetadataPatch>;
export type MetadataPatchInput = MetadataPatch | MetadataUpdater;

const MAX_APPEND_BYTES = 16 * 1024;
const MAX_CHAT_VARIABLE_KEY_LENGTH = 128;
const MAX_CHAT_VARIABLE_VALUE_BYTES = 64 * 1024;
const MAX_CHAT_VARIABLES = 256;
const SPOTIFY_TRACK_INDEX_TTL_MS = 20 * 60_000;
const SPOTIFY_TRACK_INDEX_CACHE_MAX = 24;
const SPOTIFY_TRACK_INDEX_MAX_TRACKS = 2_500;
const SPOTIFY_PLAYBACK_SETTLE_MS = 650;
const SPOTIFY_REPEAT_RETRY_DELAYS_MS = [0, 450, 900] as const;

type SpotifyTrackCandidate = {
  uri: string;
  name: string;
  artist: string;
  album: string;
  position: number;
  score?: number;
};

type SpotifyTrackIndexCacheEntry = {
  tracks: SpotifyTrackCandidate[];
  total: number;
  expiresAt: number;
  fetchedAt: number;
  truncated: boolean;
};

type SpotifyPlaybackSnapshot = {
  active: boolean;
  isPlaying: boolean;
  trackUri: string | null;
  repeatState: "off" | "track" | "context";
  deviceId: string | null;
  deviceName: string | null;
};

type SpotifyPlaybackDevice = {
  id?: string | null;
  name?: string | null;
  type?: string | null;
  is_active?: boolean;
  is_restricted?: boolean;
};

const spotifyTrackIndexCache = new Map<string, SpotifyTrackIndexCacheEntry>();

const SPOTIFY_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "for",
  "from",
  "in",
  "into",
  "is",
  "it",
  "of",
  "on",
  "or",
  "the",
  "to",
  "with",
]);

const SPOTIFY_MOOD_EXPANSIONS: Array<[RegExp, string[]]> = [
  [
    /\b(action|battle|boss|chase|combat|danger|duel|fight|war)\b/,
    ["battle", "combat", "fight", "boss", "war", "intense"],
  ],
  [/\b(calm|cozy|gentle|peace|peaceful|rest|safe|soft)\b/, ["calm", "peace", "gentle", "soft", "rest", "serene"]],
  [/\b(dark|dread|fear|horror|ominous|scary|shadow|terror)\b/, ["dark", "ominous", "shadow", "night", "horror"]],
  [/\b(grief|lonely|melancholy|sad|sorrow|tragic|tears)\b/, ["sad", "sorrow", "melancholy", "lament", "lonely"]],
  [/\b(love|romance|romantic|tender|warm)\b/, ["love", "romance", "tender", "heart", "warm"]],
  [/\b(mystery|secret|sneak|stealth|suspense|tense)\b/, ["mystery", "secret", "stealth", "tension", "suspense"]],
  [/\b(epic|heroic|triumph|victory)\b/, ["epic", "hero", "triumph", "victory", "theme"]],
];

export interface ToolExecutionContext {
  gameState?: Record<string, unknown>;
  chatId?: string;
  agentConfigId?: string;
  agentMemoryScope?: string | null;
  activeCharacters?: Array<{ id: string; name: string }>;
  chatMeta?: Record<string, unknown>;
  onUpdateMetadata?: (patch: MetadataPatchInput) => Promise<MetadataPatch>;
  customTools?: CustomToolDef[];
  searchLorebook?: LorebookSearchFn;
  spotify?: SpotifyCredentials;
  spotifyRepeatAfterPlay?: "off" | "track" | "context";
  agentMemory?: AgentMemoryStore;
}

/**
 * Execute a batch of tool calls, returning results for each.
 * Supports built-in tools and user-defined custom tools.
 */
export async function executeToolCalls(
  toolCalls: LLMToolCall[],
  context?: ToolExecutionContext,
): Promise<ToolExecutionResult[]> {
  const results: ToolExecutionResult[] = [];

  for (const call of toolCalls) {
    try {
      let args: Record<string, unknown>;
      try {
        args = JSON.parse(call.function.arguments);
      } catch {
        args = {};
      }

      const result = await executeSingleTool(call.function.name, args, context);
      results.push({
        toolCallId: call.id,
        name: call.function.name,
        result: typeof result === "string" ? result : JSON.stringify(result),
        success: true,
      });
    } catch (err) {
      results.push({
        toolCallId: call.id,
        name: call.function.name,
        result: err instanceof Error ? err.message : "Tool execution failed",
        success: false,
      });
    }
  }

  return results;
}

async function executeSingleTool(
  name: string,
  args: Record<string, unknown>,
  context?: ToolExecutionContext,
): Promise<unknown> {
  switch (name) {
    case "roll_dice":
      return rollDice(args);
    case "update_game_state":
      return updateGameState(args, context?.gameState);
    case "set_expression":
      return setExpression(args);
    case "trigger_event":
      return triggerEvent(args);
    case "search_lorebook":
      return searchLorebook(args, context?.searchLorebook);
    case "read_chat_summary":
      return readChatSummary(context?.chatMeta);
    case "append_chat_summary":
      return appendChatSummary(args, context);
    case "save_agent_memory":
      return saveAgentMemory(args, context);
    case "search_agent_memory":
      return searchAgentMemory(args, context);
    case "list_agent_memory":
      return listAgentMemory(args, context);
    case "delete_agent_memory":
      return deleteAgentMemory(args, context);
    case "read_chat_variable":
      return readChatVariable(args, context?.chatMeta);
    case "write_chat_variable":
      return writeChatVariable(args, context);
    case "spotify_get_current_playback":
      return spotifyGetCurrentPlayback(args, context?.spotify);
    case "spotify_get_playlists":
      return spotifyGetPlaylists(args, context?.spotify);
    case "spotify_get_playlist_tracks":
      return spotifyGetPlaylistTracks(args, context?.spotify);
    case "spotify_search":
      return spotifySearch(args, context?.spotify);
    case "spotify_play":
      return spotifyPlay(args, context?.spotify, context?.spotifyRepeatAfterPlay);
    case "spotify_set_volume":
      return spotifySetVolume(args, context?.spotify);
    default: {
      // Try custom tools
      const custom = context?.customTools?.find((t) => t.name === name);
      if (custom) return executeCustomTool(custom, args);
      return {
        error: `Unknown tool: ${name}`,
        available: [
          "roll_dice",
          "update_game_state",
          "set_expression",
          "trigger_event",
          "search_lorebook",
          "read_chat_summary",
          "append_chat_summary",
          "save_agent_memory",
          "search_agent_memory",
          "list_agent_memory",
          "delete_agent_memory",
          "read_chat_variable",
          "write_chat_variable",
          "spotify_get_current_playback",
          "spotify_get_playlists",
          "spotify_get_playlist_tracks",
          "spotify_search",
          "spotify_play",
          "spotify_set_volume",
        ],
      };
    }
  }
}

// ── Custom Tool Execution ──

async function executeCustomTool(tool: CustomToolDef, args: Record<string, unknown>): Promise<unknown> {
  logger.info("[custom-tools] Executing %s custom tool %s", tool.executionType, tool.name);
  switch (tool.executionType) {
    case "static":
      return { result: tool.staticResult ?? "OK", tool: tool.name, args };

    case "webhook": {
      if (!tool.webhookUrl) return { error: "No webhook URL configured" };
      try {
        const allowLocal = isWebhookLocalUrlsEnabled();
        const res = await safeFetch(tool.webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tool: tool.name, arguments: args }),
          signal: AbortSignal.timeout(10_000),
          policy: {
            allowLocal,
            allowedProtocols: allowLocal ? ["https:", "http:"] : ["https:"],
            flagName: "WEBHOOK_LOCAL_URLS_ENABLED",
          },
          maxResponseBytes: 512 * 1024,
        });
        const text = await res.text();
        try {
          return JSON.parse(text);
        } catch {
          return { result: text };
        }
      } catch (err) {
        return { error: `Webhook call failed: ${err instanceof Error ? err.message : "unknown"}` };
      }
    }

    case "script": {
      if (!isCustomToolScriptEnabled()) {
        return {
          error: "Script custom tools are disabled. Set CUSTOM_TOOL_SCRIPT_ENABLED=true to allow local code execution.",
        };
      }
      if (!tool.scriptBody) return { error: "No script body configured" };
      try {
        // Sandboxed execution using vm.runInNewContext
        // The script only has access to the explicitly provided sandbox objects
        const sandbox = {
          args,
          JSON: { parse: JSON.parse, stringify: JSON.stringify },
          Math,
          String,
          Number,
          Date,
          Array,
          parseInt,
          parseFloat,
          isNaN,
          isFinite,
          console: { log: () => {} },
        };
        const result = vm.runInNewContext(`"use strict"; (function() { ${tool.scriptBody} })()`, sandbox, {
          timeout: 5000,
          breakOnSigint: true,
        });
        return result ?? { result: "OK" };
      } catch (err) {
        return { error: `Script error: ${err instanceof Error ? err.message : "unknown"}` };
      }
    }

    default:
      return { error: `Unknown execution type: ${tool.executionType}` };
  }
}

// ── Built-in Tool Implementations ──

function rollDice(args: Record<string, unknown>): Record<string, unknown> {
  const notation = String(args.notation ?? "1d6");
  const reason = String(args.reason ?? "");

  // Parse notation: NdS+M or NdS-M
  const match = notation.match(/^(\d+)d(\d+)([+-]\d+)?$/i);
  if (!match) {
    return { error: `Invalid dice notation: ${notation}`, hint: "Use format like 2d6, 1d20+5, 3d8-2" };
  }

  const count = parseInt(match[1]!, 10);
  const sides = parseInt(match[2]!, 10);
  const modifier = match[3] ? parseInt(match[3], 10) : 0;

  if (count < 1 || count > 100 || sides < 2 || sides > 1000) {
    return { error: "Dice values out of range (1-100 dice, 2-1000 sides)" };
  }

  const rolls: number[] = [];
  for (let i = 0; i < count; i++) {
    rolls.push(Math.floor(Math.random() * sides) + 1);
  }
  const sum = rolls.reduce((a, b) => a + b, 0);
  const total = sum + modifier;

  return {
    notation,
    rolls,
    sum,
    modifier,
    total,
    reason,
    display: `🎲 ${notation}${reason ? ` (${reason})` : ""}: [${rolls.join(", ")}]${modifier ? ` ${modifier > 0 ? "+" : ""}${modifier}` : ""} = **${total}**`,
  };
}

function updateGameState(args: Record<string, unknown>, _gameState?: Record<string, unknown>): Record<string, unknown> {
  // Returns the update instruction — the client/agent pipeline applies it
  return {
    applied: true,
    update: {
      type: args.type,
      target: args.target,
      key: args.key,
      value: args.value,
      description: args.description ?? "",
    },
    display: `📊 ${args.type}: ${args.target} — ${args.key} → ${args.value}`,
  };
}

function setExpression(args: Record<string, unknown>): Record<string, unknown> {
  return {
    applied: true,
    characterName: args.characterName,
    expression: args.expression,
    display: `🎭 ${args.characterName}: expression → ${args.expression}`,
  };
}

function readChatSummary(chatMeta?: Record<string, unknown>): Record<string, unknown> {
  const summary = typeof chatMeta?.summary === "string" ? chatMeta.summary : "";
  return { summary };
}

function normalizeChatVariableKey(args: Record<string, unknown>): { key: string } | { error: string } {
  if (typeof args.key !== "string") {
    return { error: "chat variable key must be a non-empty string" };
  }
  const key = args.key.trim();
  if (!key) {
    return { error: "chat variable key must be a non-empty string" };
  }
  if (key.length > MAX_CHAT_VARIABLE_KEY_LENGTH) {
    return { error: `chat variable key must be ${MAX_CHAT_VARIABLE_KEY_LENGTH} characters or fewer` };
  }
  return { key };
}

function normalizeAgentVariables(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const variables: Record<string, string> = {};
  for (const [key, rawValue] of Object.entries(value)) {
    if (!key || typeof rawValue !== "string") continue;
    variables[key] = rawValue;
  }
  return variables;
}

function readChatVariable(args: Record<string, unknown>, chatMeta?: Record<string, unknown>): Record<string, unknown> {
  const keyResult = normalizeChatVariableKey(args);
  if ("error" in keyResult) return { error: keyResult.error };
  const variables = normalizeAgentVariables(chatMeta?.agentVariables);
  const exists = Object.prototype.hasOwnProperty.call(variables, keyResult.key);
  return { key: keyResult.key, value: variables[keyResult.key] ?? "", exists };
}

function sanitizePersistedSummaryText(text: string): string {
  return text
    .replace(/&(amp|lt|gt);/g, (_match, entity: string) => {
      switch (entity) {
        case "amp":
          return "&";
        case "lt":
          return "<";
        case "gt":
          return ">";
        default:
          return _match;
      }
    })
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function utf8ByteLength(text: string): number {
  return Buffer.byteLength(text, "utf8");
}

function trimToUtf8Bytes(text: string, maxBytes: number, fromStart = false): string {
  if (maxBytes <= 0) return "";
  if (utf8ByteLength(text) <= maxBytes) return text;

  let low = 0;
  let high = text.length;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    const candidate = fromStart ? text.slice(text.length - mid) : text.slice(0, mid);
    if (utf8ByteLength(candidate) <= maxBytes) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }

  const trimmed = fromStart ? text.slice(text.length - low) : text.slice(0, low);
  return fromStart ? trimmed.replace(/^[\uDC00-\uDFFF]/, "") : trimmed.replace(/[\uD800-\uDBFF]$/, "");
}

async function appendChatSummary(
  args: Record<string, unknown>,
  context?: ToolExecutionContext,
): Promise<Record<string, unknown>> {
  if (typeof args.text !== "string") {
    return { error: "append_chat_summary requires non-empty text" };
  }
  const text = args.text.trim();
  if (!text) {
    return { error: "append_chat_summary requires non-empty text" };
  }
  const sanitizedText = trimToUtf8Bytes(sanitizePersistedSummaryText(text), MAX_APPEND_BYTES).trim();
  if (!sanitizedText) {
    return { error: "append_chat_summary exceeds per-append size limit" };
  }
  if (!context?.onUpdateMetadata) {
    return { error: "Chat metadata updates are not available in this context" };
  }

  const updated = await context.onUpdateMetadata((currentMeta) => {
    const existingSummary =
      typeof currentMeta.summary === "string" ? sanitizePersistedSummaryText(currentMeta.summary.trim()) : null;
    const result = appendChatSummaryEntryToMetadata(
      { ...currentMeta, summary: existingSummary },
      {
        kind: "rolling",
        origin: "automated",
        sourceMode: "agent",
        content: sanitizedText,
        enabled: true,
      },
    );
    return { summary: result.summary, summaryEntries: result.entries };
  });
  return { summary: typeof updated.summary === "string" ? updated.summary : sanitizedText };
}

type AgentMemoryOwnership = {
  chatId: string;
  agentConfigId: string;
  characterId?: string;
  memoryScope?: string | null;
};

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asBoolean(value: unknown): boolean {
  return value === true || value === "true";
}

function asLimit(value: unknown, fallback: number, max: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(Math.floor(parsed), max));
}

function asMetadata(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function resolveCharacterId(args: Record<string, unknown>, context?: ToolExecutionContext): string | undefined {
  const requestedName = asString(args.characterName);
  if (!requestedName) return undefined;
  const match = context?.activeCharacters?.find((character) => character.name.toLowerCase() === requestedName.toLowerCase());
  if (!match) {
    throw new Error(`Unknown active character for agent memory: ${requestedName}`);
  }
  return match.id;
}

function resolveAgentMemoryOwnership(
  args: Record<string, unknown>,
  context?: ToolExecutionContext,
): AgentMemoryOwnership {
  if (!context?.agentMemory) {
    throw new Error("Agent memory storage is not available in this context");
  }
  if (!context.chatId) {
    throw new Error("Agent memory tools require a current chat");
  }
  if (!context.agentConfigId) {
    throw new Error("Agent memory tools require an executing agent identity");
  }
  return {
    chatId: context.chatId,
    agentConfigId: context.agentConfigId,
    characterId: resolveCharacterId(args, context),
    memoryScope: asString(context.agentMemoryScope),
  };
}

function scopedAgentMemoryFilters(ownership: AgentMemoryOwnership): {
  agentConfigId?: string;
  memoryScope?: string;
} {
  return ownership.memoryScope
    ? { memoryScope: ownership.memoryScope }
    : { agentConfigId: ownership.agentConfigId };
}

function canAccessAgentMemoryRecord(record: AgentMemoryRecord, ownership: AgentMemoryOwnership): boolean {
  if (record.chatId !== ownership.chatId) return false;
  if (ownership.memoryScope) return record.memoryScope === ownership.memoryScope;
  return record.agentConfigId === ownership.agentConfigId;
}

function publicAgentMemoryRecord(record: AgentMemoryRecord, includeContent = true): Record<string, unknown> {
  return {
    id: record.id,
    memoryType: record.memoryType,
    key: record.key,
    title: record.title,
    ...(includeContent ? { content: record.content } : {}),
    metadata: record.metadata,
    ownership: {
      chat: Boolean(record.chatId),
      character: Boolean(record.characterId),
      agent: Boolean(record.agentConfigId),
    },
    enabled: record.enabled,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

async function saveAgentMemory(
  args: Record<string, unknown>,
  context?: ToolExecutionContext,
): Promise<Record<string, unknown>> {
  const content = asString(args.content);
  if (!content) return { error: "save_agent_memory requires non-empty content" };
  const ownership = resolveAgentMemoryOwnership(args, context);
  const semanticIndex = asBoolean(args.semanticIndex);
  const recordId = asString(args.recordId);
  if (recordId) {
    const existing = await context!.agentMemory!.getAgentMemoryRecord(recordId);
    if (existing && !canAccessAgentMemoryRecord(existing, ownership)) {
      return { saved: false, error: "Agent memory record is not owned by the executing agent in this chat" };
    }
  }
  let embedding: number[] | null = null;

  if (semanticIndex) {
    const vectors = await localEmbed([content]);
    embedding = vectors?.[0] ?? null;
  }

  const record = await context!.agentMemory!.saveAgentMemory({
    recordId,
    agentConfigId: ownership.agentConfigId,
    chatId: ownership.chatId,
    characterId: ownership.characterId ?? null,
    memoryScope: ownership.memoryScope,
    memoryType: asString(args.memoryType) ?? "general",
    key: asString(args.key),
    title: asString(args.title),
    content,
    metadata: asMetadata(args.metadata),
    embedding,
  });

  return {
    saved: true,
    semanticIndexed: Boolean(embedding),
    record: publicAgentMemoryRecord(record),
    note: semanticIndex && !embedding ? "Semantic indexing was requested, but the local embedder is unavailable." : undefined,
  };
}

function literalScore(record: AgentMemoryRecord, query: string): number {
  const q = query.toLowerCase();
  const haystack = [record.title, record.content, record.memoryType, record.key].filter(Boolean).join("\n").toLowerCase();
  return haystack.includes(q) ? 1 : 0;
}

function fuzzyScore(record: AgentMemoryRecord, query: string): number {
  const tokens = query.toLowerCase().split(/\W+/).filter((token) => token.length >= 2);
  if (tokens.length === 0) return 0;
  const haystack = [record.title, record.content, record.memoryType, record.key].filter(Boolean).join(" ").toLowerCase();
  const matches = tokens.filter((token) => haystack.includes(token)).length;
  return matches / tokens.length;
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let aMag = 0;
  let bMag = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i]! * b[i]!;
    aMag += a[i]! * a[i]!;
    bMag += b[i]! * b[i]!;
  }
  if (aMag === 0 || bMag === 0) return 0;
  return dot / (Math.sqrt(aMag) * Math.sqrt(bMag));
}

async function searchAgentMemory(
  args: Record<string, unknown>,
  context?: ToolExecutionContext,
): Promise<Record<string, unknown>> {
  const query = asString(args.query);
  if (!query) return { error: "search_agent_memory requires non-empty query" };
  const ownership = resolveAgentMemoryOwnership(args, context);
  const mode = asString(args.mode) ?? "literal";
  const limit = asLimit(args.limit, 10, 50);
  const candidates = await context!.agentMemory!.searchAgentMemoryCandidates(
    {
      chatId: ownership.chatId,
      ...scopedAgentMemoryFilters(ownership),
      characterId: ownership.characterId,
      memoryType: asString(args.memoryType),
      includeInternal: false,
    },
    100,
  );

  let scored: Array<{ record: AgentMemoryRecord; score: number }> = [];
  if (mode === "semantic") {
    const vectors = await localEmbed([query]);
    const queryVector = vectors?.[0] ?? null;
    if (!queryVector) {
      return { query, mode, results: [], count: 0, error: "Semantic search is unavailable because embeddings are not available." };
    }
    scored = candidates
      .filter((record) => record.embedding)
      .map((record) => ({ record, score: cosineSimilarity(queryVector, record.embedding!) }))
      .filter((entry) => entry.score > 0);
    if (scored.length === 0) {
      return { query, mode, results: [], count: 0, note: "No semantically indexed agent memory records matched." };
    }
  } else if (mode === "fuzzy") {
    scored = candidates
      .map((record) => ({ record, score: fuzzyScore(record, query) }))
      .filter((entry) => entry.score > 0);
  } else {
    scored = candidates
      .map((record) => ({ record, score: literalScore(record, query) }))
      .filter((entry) => entry.score > 0);
  }

  const results = scored
    .sort((a, b) => b.score - a.score || b.record.updatedAt.localeCompare(a.record.updatedAt))
    .slice(0, limit)
    .map((entry) => ({ ...publicAgentMemoryRecord(entry.record), score: entry.score }));

  return { query, mode, results, count: results.length };
}

async function listAgentMemory(
  args: Record<string, unknown>,
  context?: ToolExecutionContext,
): Promise<Record<string, unknown>> {
  const ownership = resolveAgentMemoryOwnership(args, context);
  const limit = asLimit(args.limit, 20, 100);
  const records = await context!.agentMemory!.listAgentMemory(
    {
      chatId: ownership.chatId,
      ...scopedAgentMemoryFilters(ownership),
      characterId: ownership.characterId,
      memoryType: asString(args.memoryType),
      includeInternal: false,
    },
    limit,
  );
  const includeContent = args.includeContent !== false;
  return { records: records.map((record) => publicAgentMemoryRecord(record, includeContent)), count: records.length };
}

async function deleteAgentMemory(
  args: Record<string, unknown>,
  context?: ToolExecutionContext,
): Promise<Record<string, unknown>> {
  const recordId = asString(args.recordId);
  if (!recordId) return { error: "delete_agent_memory requires recordId" };
  const ownership = resolveAgentMemoryOwnership(args, context);
  const record = await context!.agentMemory!.getAgentMemoryRecord(recordId);
  if (!record || record.deletedAt || !record.enabled) return { deleted: false, error: "Agent memory record not found" };
  if (!canAccessAgentMemoryRecord(record, ownership)) {
    return { deleted: false, error: "Agent memory record is not owned by the executing agent in this chat" };
  }
  if (ownership.characterId !== undefined && record.characterId !== ownership.characterId) {
    return { deleted: false, error: "Agent memory record is not owned by the selected character" };
  }
  const deleted = await context!.agentMemory!.softDeleteAgentMemory(recordId);
  return { deleted: Boolean(deleted?.deletedAt), recordId };
}

async function writeChatVariable(
  args: Record<string, unknown>,
  context?: ToolExecutionContext,
): Promise<Record<string, unknown>> {
  const keyResult = normalizeChatVariableKey(args);
  if ("error" in keyResult) return { error: keyResult.error };
  if (typeof args.value !== "string") {
    return { error: "write_chat_variable requires a string value" };
  }
  if (!context?.onUpdateMetadata) {
    return { error: "Chat metadata updates are not available in this context" };
  }

  const existingVariables = normalizeAgentVariables(context.chatMeta?.agentVariables);
  const existed = Object.prototype.hasOwnProperty.call(existingVariables, keyResult.key);
  if (!existed && Object.keys(existingVariables).length >= MAX_CHAT_VARIABLES) {
    return { error: `chat variable limit reached (${MAX_CHAT_VARIABLES})` };
  }

  const value = trimToUtf8Bytes(args.value, MAX_CHAT_VARIABLE_VALUE_BYTES);
  const updated = await context.onUpdateMetadata((currentMeta) => {
    const variables = normalizeAgentVariables(currentMeta.agentVariables);
    return { agentVariables: { ...variables, [keyResult.key]: value } };
  });
  const variables = normalizeAgentVariables(updated.agentVariables);
  return {
    key: keyResult.key,
    value: variables[keyResult.key] ?? value,
    replaced: existed,
    truncated: value !== args.value,
    bytes: utf8ByteLength(value),
  };
}

function triggerEvent(args: Record<string, unknown>): Record<string, unknown> {
  return {
    applied: true,
    eventType: args.eventType,
    description: args.description,
    involvedCharacters: args.involvedCharacters ?? [],
    display: `⚡ Event (${args.eventType}): ${args.description}`,
  };
}

async function searchLorebook(
  args: Record<string, unknown>,
  searchFn?: LorebookSearchFn,
): Promise<Record<string, unknown>> {
  const query = String(args.query ?? "");
  const category = args.category ? String(args.category) : null;

  if (!searchFn) {
    return {
      query,
      category,
      results: [],
      note: "Lorebook search is not available in this context.",
    };
  }

  const results = await searchFn(query, category);
  return {
    query,
    category,
    results,
    count: results.length,
  };
}

// ── Spotify Tool Implementations ──

async function spotifyGetCurrentPlayback(
  _args: Record<string, unknown>,
  creds?: SpotifyCredentials,
): Promise<Record<string, unknown>> {
  if (!creds?.accessToken) {
    return { error: "Spotify not configured. Please connect Spotify in the Spotify DJ agent settings." };
  }

  try {
    const res = await fetch("https://api.spotify.com/v1/me/player", {
      headers: { Authorization: `Bearer ${creds.accessToken}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (res.status === 204) {
      const fallbackDevice = await findAvailableSpotifyPlaybackDevice(creds.accessToken);
      return {
        active: false,
        isPlaying: false,
        track: null,
        device: fallbackDevice
          ? {
              id: fallbackDevice.deviceId,
              name: fallbackDevice.deviceName,
              type: fallbackDevice.deviceType,
              available: true,
            }
          : null,
        note: fallbackDevice
          ? "No active Spotify playback, but an available Spotify device can be targeted by spotify_play."
          : "No active Spotify playback device.",
      };
    }
    if (!res.ok) {
      const body = await res.text();
      return { error: `Spotify playback failed (${res.status}): ${body.slice(0, 200)}` };
    }
    const data = (await res.json()) as {
      is_playing?: boolean;
      progress_ms?: number | null;
      repeat_state?: string;
      item?: {
        uri?: string;
        name?: string;
        artists?: Array<{ name?: string }>;
        album?: { name?: string };
        duration_ms?: number;
      } | null;
      device?: { id?: string | null; name?: string; type?: string; volume_percent?: number | null } | null;
    };
    const track = data.item
      ? {
          uri: data.item.uri ?? null,
          name: data.item.name ?? "Unknown track",
          artist: (data.item.artists ?? [])
            .map((artist) => artist.name)
            .filter(Boolean)
            .join(", "),
          album: data.item.album?.name ?? null,
          durationMs: data.item.duration_ms ?? null,
        }
      : null;
    return {
      active: true,
      isPlaying: data.is_playing === true,
      repeat: normalizeSpotifyRepeatState(data.repeat_state),
      progressMs: data.progress_ms ?? null,
      track,
      device: data.device
        ? {
            id: data.device.id ?? null,
            name: data.device.name ?? "Spotify device",
            type: data.device.type ?? null,
            volume: data.device.volume_percent ?? null,
          }
        : null,
    };
  } catch (err) {
    return { error: `Spotify playback failed: ${err instanceof Error ? err.message : "unknown"}` };
  }
}

async function spotifyGetPlaylists(
  args: Record<string, unknown>,
  creds?: SpotifyCredentials,
): Promise<Record<string, unknown>> {
  if (!creds?.accessToken) {
    return { error: "Spotify not configured. Please add your Spotify access token in the Spotify DJ agent settings." };
  }
  const limit = Math.min(Number(args.limit ?? 20), 50);

  try {
    const res = await fetch(
      `https://api.spotify.com/v1/me/playlists?${new URLSearchParams({ limit: String(limit) })}`,
      {
        headers: { Authorization: `Bearer ${creds.accessToken}` },
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!res.ok) {
      const body = await res.text();
      return { error: `Spotify API error (${res.status}): ${body.slice(0, 200)}` };
    }
    const data = (await res.json()) as {
      items?: Array<{ id: string; name: string; uri: string; tracks: { total: number }; description: string }>;
    };
    const playlists = (data.items ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      uri: p.uri,
      trackCount: p.tracks.total,
      description: (p.description || "").slice(0, 100),
    }));
    return {
      playlists,
      count: playlists.length,
      hint: "Use spotify_get_playlist_tracks with a playlist ID to browse tracks, or use playlistId='liked' for Liked Songs.",
    };
  } catch (err) {
    return { error: `Spotify playlists failed: ${err instanceof Error ? err.message : "unknown"}` };
  }
}

function clampNumber(value: unknown, fallback: number, min: number, max: number): number {
  const num = Number(value ?? fallback);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(min, Math.min(max, Math.round(num)));
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeSpotifyRepeatState(value: unknown): "off" | "track" | "context" {
  return value === "track" || value === "context" ? value : "off";
}

async function fetchSpotifyPlaybackSnapshot(accessToken: string): Promise<SpotifyPlaybackSnapshot | null> {
  const res = await fetch("https://api.spotify.com/v1/me/player", {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);
  if (!res || res.status === 204 || !res.ok) return null;

  const data = (await res.json()) as {
    is_playing?: boolean;
    repeat_state?: string;
    item?: { uri?: string | null } | null;
    device?: { id?: string | null; name?: string | null } | null;
  };

  return {
    active: true,
    isPlaying: data.is_playing === true,
    trackUri: typeof data.item?.uri === "string" ? data.item.uri : null,
    repeatState: normalizeSpotifyRepeatState(data.repeat_state),
    deviceId: typeof data.device?.id === "string" ? data.device.id : null,
    deviceName: typeof data.device?.name === "string" ? data.device.name : null,
  };
}

async function findAvailableSpotifyPlaybackDevice(
  accessToken: string,
): Promise<{ deviceId: string; deviceName: string; deviceType: string | null } | null> {
  const res = await fetch("https://api.spotify.com/v1/me/player/devices", {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);
  if (!res || !res.ok) return null;

  const data = (await res.json().catch(() => null)) as { devices?: SpotifyPlaybackDevice[] } | null;
  const devices = data?.devices ?? [];
  const pick = (predicate: (device: SpotifyPlaybackDevice) => boolean) =>
    devices.find(
      (device) =>
        typeof device.id === "string" &&
        device.id.trim().length > 0 &&
        device.is_restricted !== true &&
        predicate(device),
    );
  const candidate =
    pick((device) => device.is_active === true) ??
    pick((device) => device.name !== "Marinara Engine") ??
    pick((device) => device.name === "Marinara Engine");
  if (!candidate?.id) return null;

  return {
    deviceId: candidate.id,
    deviceName: candidate.name ?? "Spotify device",
    deviceType: candidate.type ?? null,
  };
}

async function waitForSpotifyPlayback(
  accessToken: string,
  expectedTrackUri?: string,
): Promise<SpotifyPlaybackSnapshot | null> {
  let latest: SpotifyPlaybackSnapshot | null = null;
  for (const delay of [0, SPOTIFY_PLAYBACK_SETTLE_MS, SPOTIFY_PLAYBACK_SETTLE_MS] as const) {
    if (delay > 0) await wait(delay);
    latest = await fetchSpotifyPlaybackSnapshot(accessToken);
    if (!expectedTrackUri || latest?.trackUri === expectedTrackUri) return latest;
  }
  return latest;
}

function spotifyTrackCacheKey(creds: SpotifyCredentials, playlistId: string): string {
  const digest = createHash("sha256").update(creds.accessToken).digest("hex").slice(0, 12);
  return `${digest}:${playlistId}`;
}

function pruneSpotifyTrackCache() {
  while (spotifyTrackIndexCache.size > SPOTIFY_TRACK_INDEX_CACHE_MAX) {
    const oldest = spotifyTrackIndexCache.keys().next().value as string | undefined;
    if (!oldest) return;
    spotifyTrackIndexCache.delete(oldest);
  }
}

function normalizeSpotifyText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function buildSpotifyCandidateTokens(query: string): string[] {
  const normalized = normalizeSpotifyText(query);
  const tokens = new Set(
    normalized
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length > 1 && !SPOTIFY_STOP_WORDS.has(token)),
  );

  for (const [pattern, expansions] of SPOTIFY_MOOD_EXPANSIONS) {
    if (pattern.test(normalized)) {
      expansions.forEach((term) => tokens.add(term));
    }
  }

  return Array.from(tokens);
}

function hashFraction(value: string): number {
  const hex = createHash("sha256").update(value).digest("hex").slice(0, 8);
  return Number.parseInt(hex, 16) / 0xffffffff;
}

function scoreSpotifyCandidate(track: SpotifyTrackCandidate, phrase: string, tokens: string[]): number {
  const name = normalizeSpotifyText(track.name);
  const artist = normalizeSpotifyText(track.artist);
  const album = normalizeSpotifyText(track.album);
  const haystack = `${name} ${artist} ${album}`;
  let score = 0;

  if (phrase && haystack.includes(phrase)) score += 35;
  for (const token of tokens) {
    if (name.includes(token)) score += 8;
    if (album.includes(token)) score += 4;
    if (artist.includes(token)) score += 2;
  }

  // Stable tiny jitter keeps equally scored tracks varied without random churn.
  return score + hashFraction(`${track.uri}:${phrase}`) * 0.01;
}

function sampleSpotifyTracksEvenly(
  tracks: SpotifyTrackCandidate[],
  count: number,
  seed: string,
): SpotifyTrackCandidate[] {
  if (tracks.length <= count) return tracks;
  const start = Math.floor(hashFraction(seed) * Math.max(1, Math.floor(tracks.length / count)));
  const step = tracks.length / count;
  const sampled: SpotifyTrackCandidate[] = [];
  const seen = new Set<string>();

  for (let i = 0; sampled.length < count && i < count * 3; i++) {
    const index = Math.min(tracks.length - 1, Math.floor(start + i * step) % tracks.length);
    const track = tracks[index];
    if (track && !seen.has(track.uri)) {
      sampled.push(track);
      seen.add(track.uri);
    }
  }

  for (const track of tracks) {
    if (sampled.length >= count) break;
    if (!seen.has(track.uri)) {
      sampled.push(track);
      seen.add(track.uri);
    }
  }

  return sampled;
}

function selectSpotifyTrackCandidates(args: {
  tracks: SpotifyTrackCandidate[];
  query: string;
  limit: number;
  playlistId: string;
}): { candidates: SpotifyTrackCandidate[]; mode: string; tokens: string[] } {
  const phrase = normalizeSpotifyText(args.query);
  const tokens = buildSpotifyCandidateTokens(args.query);
  if (tokens.length === 0) {
    return {
      candidates: sampleSpotifyTracksEvenly(args.tracks, args.limit, `${args.playlistId}:balanced`),
      mode: "balanced_sample",
      tokens,
    };
  }

  const scored = args.tracks
    .map((track) => ({ ...track, score: scoreSpotifyCandidate(track, phrase, tokens) }))
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const strong = scored.filter((track) => (track.score ?? 0) >= 2);
  const selected: SpotifyTrackCandidate[] = strong.slice(0, Math.max(0, Math.floor(args.limit * 0.8)));
  const seen = new Set(selected.map((track) => track.uri));
  const reserve = args.limit - selected.length;

  if (reserve > 0) {
    const fallback = sampleSpotifyTracksEvenly(
      args.tracks.filter((track) => !seen.has(track.uri)),
      reserve,
      `${args.playlistId}:${phrase}:fallback`,
    );
    selected.push(...fallback);
  }

  return {
    candidates: selected.slice(0, args.limit),
    mode: strong.length > 0 ? "scored_candidates" : "balanced_sample",
    tokens,
  };
}

type SpotifyTrackInner = {
  uri?: string;
  name?: string;
  artists?: Array<{ name?: string }>;
  album?: { name?: string };
};

function mapSpotifyTrackItems(
  items: Array<{
    track?: SpotifyTrackInner | null;
    item?: SpotifyTrackInner | null;
  }>,
  offset: number,
): SpotifyTrackCandidate[] {
  return items
    .map((item, index) => {
      const track = item.track ?? item.item;
      if (!track?.uri?.startsWith("spotify:track:")) return null;
      return {
        uri: track.uri,
        name: track.name || "Unknown track",
        artist:
          (track.artists ?? [])
            .map((a) => a.name)
            .filter(Boolean)
            .join(", ") || "Unknown artist",
        album: track.album?.name || "Unknown album",
        position: offset + index + 1,
      };
    })
    .filter((track): track is SpotifyTrackCandidate => Boolean(track));
}

async function fetchSpotifyTrackIndex(
  playlistId: string,
  creds: SpotifyCredentials,
): Promise<SpotifyTrackIndexCacheEntry & { cacheStatus: "hit" | "miss" }> {
  const cacheKey = spotifyTrackCacheKey(creds, playlistId);
  const cached = spotifyTrackIndexCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return { ...cached, cacheStatus: "hit" };
  }

  const tracks: SpotifyTrackCandidate[] = [];
  let offset = 0;
  let total = 0;
  let fetchedItems = 0;
  const batchSize = playlistId === "liked" ? 50 : 100;

  while (offset < SPOTIFY_TRACK_INDEX_MAX_TRACKS) {
    const pageSize = Math.min(batchSize, SPOTIFY_TRACK_INDEX_MAX_TRACKS - offset);
    const endpoint =
      playlistId === "liked"
        ? `https://api.spotify.com/v1/me/tracks?${new URLSearchParams({ limit: String(pageSize), offset: String(offset) })}`
        : `https://api.spotify.com/v1/playlists/${encodeURIComponent(playlistId)}/items?${new URLSearchParams({ limit: String(pageSize), offset: String(offset) })}`;
    const res = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${creds.accessToken}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Spotify API error (${res.status}): ${body.slice(0, 200)}`);
    }
    const data = (await res.json()) as {
      items?: Array<{ track?: SpotifyTrackInner | null; item?: SpotifyTrackInner | null }>;
      total?: number;
      next?: string | null;
    };
    const items = data.items ?? [];
    total = typeof data.total === "number" ? data.total : Math.max(total, offset + items.length);
    fetchedItems = offset + items.length;
    tracks.push(...mapSpotifyTrackItems(items, offset));

    if (!data.next || items.length === 0 || items.length < pageSize) break;
    offset += items.length;
  }

  const entry: SpotifyTrackIndexCacheEntry = {
    tracks,
    total: total || tracks.length,
    expiresAt: Date.now() + SPOTIFY_TRACK_INDEX_TTL_MS,
    fetchedAt: Date.now(),
    truncated: fetchedItems >= SPOTIFY_TRACK_INDEX_MAX_TRACKS && fetchedItems < total,
  };
  spotifyTrackIndexCache.set(cacheKey, entry);
  pruneSpotifyTrackCache();
  return { ...entry, cacheStatus: "miss" };
}

async function spotifyGetPlaylistTracks(
  args: Record<string, unknown>,
  creds?: SpotifyCredentials,
): Promise<Record<string, unknown>> {
  if (!creds?.accessToken) {
    return { error: "Spotify not configured. Please add your Spotify access token in the Spotify DJ agent settings." };
  }
  const playlistId = String(args.playlistId ?? "");

  if (!playlistId) {
    return {
      error: "playlistId is required. Use 'liked' for Liked Songs, or a playlist ID from spotify_get_playlists.",
    };
  }

  try {
    const hasExplicitOffset = args.offset !== undefined && args.offset !== null;
    if (!hasExplicitOffset) {
      const index = await fetchSpotifyTrackIndex(playlistId, creds);
      const query = [args.query, args.mood, args.scene].filter((part) => typeof part === "string").join(" ");
      const candidateLimit = clampNumber(args.candidateLimit ?? args.limit ?? 60, 60, 1, 80);
      const selection = selectSpotifyTrackCandidates({
        tracks: index.tracks,
        query,
        limit: candidateLimit,
        playlistId,
      });

      return {
        playlistId,
        tracks: selection.candidates,
        count: selection.candidates.length,
        total: index.total,
        indexedTrackCount: index.tracks.length,
        cacheStatus: index.cacheStatus,
        candidateMode: selection.mode,
        query: query || null,
        matchedTokens: selection.tokens,
        truncated: index.truncated,
        hint: "Server indexed the playlist and returned only selected candidates. Pick 3-5 URIs from this shortlist; do not request every page unless you truly need manual browsing.",
      };
    }

    // Explicit offset keeps the old raw page mode for manual browsing.
    const limit = clampNumber(args.limit ?? 30, 30, 1, 50);
    const offset = clampNumber(args.offset ?? 0, 0, 0, Number.MAX_SAFE_INTEGER);
    const url =
      playlistId === "liked"
        ? `https://api.spotify.com/v1/me/tracks?${new URLSearchParams({ limit: String(limit), offset: String(offset) })}`
        : `https://api.spotify.com/v1/playlists/${encodeURIComponent(playlistId)}/items?${new URLSearchParams({ limit: String(limit), offset: String(offset) })}`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${creds.accessToken}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      const body = await res.text();
      return { error: `Spotify API error (${res.status}): ${body.slice(0, 200)}` };
    }
    const data = (await res.json()) as {
      items?: Array<{ track?: SpotifyTrackInner | null; item?: SpotifyTrackInner | null }>;
      total?: number;
    };
    const tracks = mapSpotifyTrackItems(data.items ?? [], offset);
    return {
      playlistId,
      tracks,
      count: tracks.length,
      total: data.total ?? tracks.length,
      offset,
      pageMode: true,
    };
  } catch (err) {
    return { error: `Spotify playlist tracks failed: ${err instanceof Error ? err.message : "unknown"}` };
  }
}

async function spotifySearch(
  args: Record<string, unknown>,
  creds?: SpotifyCredentials,
): Promise<Record<string, unknown>> {
  if (!creds?.accessToken) {
    return { error: "Spotify not configured. Please add your Spotify access token in the Spotify DJ agent settings." };
  }
  const query = normalizeSpotifySearchQuery(args.query);
  const limit = Math.min(Number(args.limit ?? 5), 20);

  try {
    const res = await fetch(
      `https://api.spotify.com/v1/search?${new URLSearchParams({ q: query, type: "track", limit: String(limit) })}`,
      {
        headers: { Authorization: `Bearer ${creds.accessToken}` },
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!res.ok) {
      const body = await res.text();
      return { error: `Spotify API error (${res.status}): ${body.slice(0, 200)}` };
    }
    const data = (await res.json()) as {
      tracks?: {
        items?: Array<{ uri: string; name: string; artists: Array<{ name: string }>; album: { name: string } }>;
      };
    };
    const tracks = (data.tracks?.items ?? []).map((t) => ({
      uri: t.uri,
      name: t.name,
      artist: t.artists.map((a) => a.name).join(", "),
      album: t.album.name,
    }));
    return { query, tracks, count: tracks.length };
  } catch (err) {
    return { error: `Spotify search failed: ${err instanceof Error ? err.message : "unknown"}` };
  }
}

async function spotifyPlay(
  args: Record<string, unknown>,
  creds?: SpotifyCredentials,
  repeatAfterPlay?: "off" | "track" | "context",
): Promise<Record<string, unknown>> {
  if (!creds?.accessToken) {
    return { error: "Spotify not configured. Please add your Spotify access token in the Spotify DJ agent settings." };
  }
  const reason = String(args.reason ?? "");

  // Support both single `uri` and array `uris`
  let uris: string[] = [];
  if (Array.isArray(args.uris)) {
    uris = (args.uris as string[]).filter((u) => typeof u === "string" && u.startsWith("spotify:"));
  }
  if (args.uri && typeof args.uri === "string" && args.uri.startsWith("spotify:")) {
    // If single uri is provided, prepend it (avoid duplicates)
    if (!uris.includes(args.uri)) uris.unshift(args.uri);
  }
  if (uris.length === 0) {
    return { error: "No valid Spotify URIs provided" };
  }

  try {
    // If it's a single playlist URI, use context_uri
    const firstUri = uris[0]!;
    const singleTrackUri = uris.length === 1 && firstUri.startsWith("spotify:track:");
    const beforePlayback = await fetchSpotifyPlaybackSnapshot(creds.accessToken);
    const fallbackDevice = beforePlayback?.deviceId
      ? null
      : await findAvailableSpotifyPlaybackDevice(creds.accessToken);
    const targetDeviceId = beforePlayback?.deviceId ?? fallbackDevice?.deviceId ?? null;
    const targetDeviceName = beforePlayback?.deviceName ?? fallbackDevice?.deviceName ?? null;
    if (!targetDeviceId) {
      return {
        error:
          "No Spotify device is available. Enable the Spotify mini player in Settings, or open Spotify on another device, then try again.",
      };
    }
    const playQuery = targetDeviceId ? `?${new URLSearchParams({ device_id: targetDeviceId }).toString()}` : "";

    if (singleTrackUri && repeatAfterPlay === "track") {
      await applySpotifyRepeatAfterPlay(creds.accessToken, "off", targetDeviceId);
    }

    if (uris.length === 1 && !firstUri.startsWith("spotify:track:")) {
      const body = { context_uri: firstUri };
      const res = await fetch(`https://api.spotify.com/v1/me/player/play${playQuery}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${creds.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok && res.status !== 204) {
        const text = await res.text();
        return { error: `Spotify play failed (${res.status}): ${text.slice(0, 200)}` };
      }
      const repeat = await applySpotifyRepeatAfterPlay(creds.accessToken, repeatAfterPlay, targetDeviceId);
      const current = await waitForSpotifyPlayback(creds.accessToken);
      return {
        applied: true,
        uris,
        reason,
        repeat,
        repeatState: current?.repeatState ?? repeat ?? null,
        currentUri: current?.trackUri ?? null,
        device: current?.deviceName ?? targetDeviceName,
        display: `🎵 Now playing playlist: ${firstUri}${reason ? ` — ${reason}` : ""}`,
      };
    }

    // For track URIs, pass them all as a queue
    const body = { uris, position_ms: 0 };
    const res = await fetch(`https://api.spotify.com/v1/me/player/play${playQuery}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${creds.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok && res.status !== 204) {
      const text = await res.text();
      return { error: `Spotify play failed (${res.status}): ${text.slice(0, 200)}` };
    }
    if (singleTrackUri) await wait(SPOTIFY_PLAYBACK_SETTLE_MS);
    let repeat = await applySpotifyRepeatAfterPlay(creds.accessToken, repeatAfterPlay, targetDeviceId);
    let current = await waitForSpotifyPlayback(creds.accessToken, singleTrackUri ? firstUri : undefined);
    if (singleTrackUri && repeatAfterPlay === "track" && current?.repeatState !== "track") {
      repeat = await applySpotifyRepeatAfterPlay(creds.accessToken, "track", targetDeviceId, 3);
      current = await waitForSpotifyPlayback(creds.accessToken, firstUri);
    }
    return {
      applied: true,
      uris,
      reason,
      repeat,
      repeatState: current?.repeatState ?? repeat ?? null,
      currentUri: current?.trackUri ?? null,
      device: current?.deviceName ?? targetDeviceName,
      queued: uris.length,
      display: `🎵 Queued ${uris.length} tracks${reason ? ` — ${reason}` : ""}`,
    };
  } catch (err) {
    return { error: `Spotify play failed: ${err instanceof Error ? err.message : "unknown"}` };
  }
}

async function applySpotifyRepeatAfterPlay(
  accessToken: string,
  repeatAfterPlay?: "off" | "track" | "context",
  deviceId?: string | null,
  attempts = 1,
): Promise<"off" | "track" | "context" | null> {
  if (!repeatAfterPlay) return null;

  for (let i = 0; i < attempts; i++) {
    const delay = SPOTIFY_REPEAT_RETRY_DELAYS_MS[Math.min(i, SPOTIFY_REPEAT_RETRY_DELAYS_MS.length - 1)] ?? 0;
    if (delay > 0) await wait(delay);
    const params = new URLSearchParams({ state: repeatAfterPlay });
    if (deviceId) params.set("device_id", deviceId);
    const res = await fetch(`https://api.spotify.com/v1/me/player/repeat?${params.toString()}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      signal: AbortSignal.timeout(10_000),
    }).catch(() => null);

    if (res && (res.ok || res.status === 204)) return repeatAfterPlay;
  }
  return null;
}

async function spotifySetVolume(
  args: Record<string, unknown>,
  creds?: SpotifyCredentials,
): Promise<Record<string, unknown>> {
  if (!creds?.accessToken) {
    return { error: "Spotify not configured. Please add your Spotify access token in the Spotify DJ agent settings." };
  }
  const volume = Math.max(0, Math.min(100, Number(args.volume ?? 50)));
  const reason = String(args.reason ?? "");

  try {
    const res = await fetch(`https://api.spotify.com/v1/me/player/volume?volume_percent=${volume}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${creds.accessToken}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok && res.status !== 204) {
      const text = await res.text();
      return { error: `Spotify volume failed (${res.status}): ${text.slice(0, 200)}` };
    }
    return { applied: true, volume, reason, display: `🔊 Volume → ${volume}%${reason ? ` (${reason})` : ""}` };
  } catch (err) {
    return { error: `Spotify volume failed: ${err instanceof Error ? err.message : "unknown"}` };
  }
}
