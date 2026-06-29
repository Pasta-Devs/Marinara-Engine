// ──────────────────────────────────────────────
// Tool Executor — Handles built-in + custom function calls
// ──────────────────────────────────────────────
import type { LLMToolCall } from "../llm/base-provider.js";
import vm from "node:vm";
import { createHash } from "node:crypto";
import {
  getCustomToolTimeoutMs,
  isCustomToolScriptEnabled,
  isWebhookLocalUrlsEnabled,
} from "../../config/runtime-config.js";
import { safeFetch } from "../../utils/security.js";
import { logger } from "../../lib/logger.js";
import { normalizeSpotifySearchQuery } from "../spotify/spotify.service.js";
import { appendChatSummaryEntryToMetadata } from "@marinara-engine/shared";

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
  includeHiddenContext?: boolean;
}

export type CustomToolHiddenContext = Record<string, unknown>;

/** Lorebook search function injected from the route layer. */
export type LorebookSearchFn = (
  query: string,
  category?: string | null,
) => Promise<Array<{ name: string; content: string; tag: string; keys: string[] }>>;

/** Lorebook writer function injected from the route layer. */
export type SaveLorebookEntryFn = (entry: {
  name: string;
  content: string;
  description?: string;
  keys: string[];
  tag?: string;
  mode: "create" | "replace" | "append";
}) => Promise<Record<string, unknown>>;

/** Message replacement function injected from the route layer. */
export type ReplaceChatMessageContentFn = (input: {
  messageId: string;
  content: string;
  reason?: string;
}) => Promise<Record<string, unknown>>;

/** Spotify API credentials injected from the route layer. */
export interface SpotifyCredentials {
  accessToken: string;
}

export type MetadataPatch = Record<string, unknown>;
export type MetadataUpdater = (current: MetadataPatch) => MetadataPatch | Promise<MetadataPatch>;
export type MetadataPatchInput = MetadataPatch | MetadataUpdater;

const MAX_APPEND_BYTES = 16 * 1024;
const MAX_LOREBOOK_ENTRY_CONTENT_BYTES = 64 * 1024;
const MAX_LOREBOOK_ENTRY_DESCRIPTION_BYTES = 4 * 1024;
const MAX_LOREBOOK_ENTRY_NAME_LENGTH = 160;
const MAX_LOREBOOK_ENTRY_KEYS = 24;
const MAX_CHAT_VARIABLE_KEY_LENGTH = 128;
const MAX_CHAT_VARIABLE_VALUE_BYTES = 64 * 1024;
const MAX_CHAT_VARIABLES = 256;
const SPOTIFY_TRACK_INDEX_TTL_MS = 20 * 60_000;
const SPOTIFY_TRACK_INDEX_CACHE_MAX = 24;
const SPOTIFY_TRACK_INDEX_MAX_TRACKS = 2_500;
const SPOTIFY_TRACK_PAGE_SIZE = 50;
const SPOTIFY_RECENT_TRACK_HISTORY_LIMIT = 24;
const SPOTIFY_RECENT_TRACK_PROMPT_LIMIT = 12;
const SPOTIFY_PLAYBACK_SETTLE_MS = 650;
const SPOTIFY_PLAYBACK_VERIFY_DELAYS_MS = [0, SPOTIFY_PLAYBACK_SETTLE_MS, 900, 1500, 2500, 4000] as const;
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
  deviceType: string | null;
};

type SpotifyPlaybackDevice = {
  id?: string | null;
  name?: string | null;
  type?: string | null;
  is_active?: boolean;
  is_restricted?: boolean;
};

type SpotifyPlayRequestBody = {
  context_uri?: string;
  uris?: string[];
  position_ms?: number;
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
  chatMeta?: Record<string, unknown>;
  hiddenContext?: CustomToolHiddenContext;
  onUpdateMetadata?: (patch: MetadataPatchInput) => Promise<MetadataPatch>;
  customTools?: CustomToolDef[];
  searchLorebook?: LorebookSearchFn;
  saveLorebookEntry?: SaveLorebookEntryFn;
  replaceChatMessageContent?: ReplaceChatMessageContentFn;
  spotify?: SpotifyCredentials;
  spotifyRepeatAfterPlay?: "off" | "track" | "context";
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
    case "save_lorebook_entry":
      return saveLorebookEntry(args, context?.saveLorebookEntry);
    case "edit_chat_message":
      return editChatMessage(args, context?.replaceChatMessageContent);
    case "read_chat_summary":
      return readChatSummary(context?.chatMeta);
    case "append_chat_summary":
      return appendChatSummary(args, context);
    case "read_chat_variable":
      return readChatVariable(args, context?.chatMeta);
    case "write_chat_variable":
      return writeChatVariable(args, context);
    case "spotify_get_current_playback":
      return spotifyGetCurrentPlayback(args, context?.spotify);
    case "spotify_get_playlists":
      return spotifyGetPlaylists(args, context?.spotify);
    case "spotify_get_playlist_tracks":
      return spotifyGetPlaylistTracks(args, context?.spotify, context);
    case "spotify_search":
      return spotifySearch(args, context?.spotify);
    case "spotify_play":
      return spotifyPlay(args, context?.spotify, context);
    case "spotify_set_volume":
      return spotifySetVolume(args, context?.spotify);
    default: {
      // Try custom tools
      const custom = context?.customTools?.find((t) => t.name === name);
      if (custom) return executeCustomTool(custom, args, context);
      return {
        error: `Unknown tool: ${name}`,
        available: [
          "roll_dice",
          "update_game_state",
          "set_expression",
          "trigger_event",
          "search_lorebook",
          "save_lorebook_entry",
          "edit_chat_message",
          "read_chat_summary",
          "append_chat_summary",
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

function getCustomToolHiddenContext(tool: CustomToolDef, context?: ToolExecutionContext): CustomToolHiddenContext | undefined {
  if (tool.includeHiddenContext !== true) return undefined;
  return context?.hiddenContext ?? {};
}

async function executeCustomTool(
  tool: CustomToolDef,
  args: Record<string, unknown>,
  context?: ToolExecutionContext,
): Promise<unknown> {
  logger.info("[custom-tools] Executing %s custom tool %s", tool.executionType, tool.name);
  const customToolTimeoutMs = getCustomToolTimeoutMs();
  const hiddenContext = getCustomToolHiddenContext(tool, context);
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
          body: JSON.stringify({
            tool: tool.name,
            arguments: args,
            ...(hiddenContext !== undefined ? { context: hiddenContext } : {}),
          }),
          signal: AbortSignal.timeout(customToolTimeoutMs),
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
          error:
            "Script custom tools are disabled. Set CUSTOM_TOOL_SCRIPT_ENABLED=true to enable trusted in-process script tools.",
        };
      }
      if (!tool.scriptBody) return { error: "No script body configured" };
      try {
        // Keep host-realm objects out of the VM context. Script inputs cross the
        // boundary as JSON so built-ins stay in the VM realm where process,
        // require, Buffer, and native bindings are not exposed.
        const sandbox = vm.createContext(Object.create(null));
        (sandbox as Record<string, unknown>).__argsJson = JSON.stringify(args ?? {});
        (sandbox as Record<string, unknown>).__ctxJson = JSON.stringify(hiddenContext ?? null);
        const wrappedScript = [
          `"use strict";`,
          `globalThis.args = JSON.parse(__argsJson);`,
          `globalThis.context = JSON.parse(__ctxJson);`,
          `globalThis.console = { log: function () {} };`,
          `(function() {`,
          `${tool.scriptBody}`,
          `})();`,
        ].join("\n");
        const result = vm.runInContext(wrappedScript, sandbox, {
          timeout: customToolTimeoutMs,
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

  const value = trimToUtf8Bytes(args.value, MAX_CHAT_VARIABLE_VALUE_BYTES);
  let existed = false;
  let limitReached = false;
  const updated = await context.onUpdateMetadata((currentMeta) => {
    const variables = normalizeAgentVariables(currentMeta.agentVariables);
    existed = Object.prototype.hasOwnProperty.call(variables, keyResult.key);
    if (!existed && Object.keys(variables).length >= MAX_CHAT_VARIABLES) {
      limitReached = true;
      return {};
    }
    return { agentVariables: { ...variables, [keyResult.key]: value } };
  });
  if (limitReached) {
    return { error: `chat variable limit reached (${MAX_CHAT_VARIABLES})` };
  }
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

function normalizeLorebookEntryKeys(value: unknown, fallbackName: string): string[] {
  const raw = Array.isArray(value) ? value : [];
  const keys = Array.from(
    new Set(
      raw
        .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
        .filter((entry) => entry.length > 0),
    ),
  ).slice(0, MAX_LOREBOOK_ENTRY_KEYS);
  if (keys.length > 0) return keys;
  return fallbackName ? [fallbackName] : [];
}

function normalizeLorebookWriteMode(value: unknown): "create" | "replace" | "append" | "invalid" {
  if (value === undefined || value === null || value === "") return "replace";
  return value === "create" || value === "append" || value === "replace" ? value : "invalid";
}

async function saveLorebookEntry(
  args: Record<string, unknown>,
  saveFn?: SaveLorebookEntryFn,
): Promise<Record<string, unknown>> {
  if (!saveFn) {
    return { error: "Lorebook writing is not available in this context." };
  }
  if (typeof args.name !== "string" || !args.name.trim()) {
    return { error: "save_lorebook_entry requires a non-empty name" };
  }
  if (typeof args.content !== "string" || !args.content.trim()) {
    return { error: "save_lorebook_entry requires non-empty content" };
  }

  const name = args.name.trim().slice(0, MAX_LOREBOOK_ENTRY_NAME_LENGTH);
  const content = trimToUtf8Bytes(args.content.trim(), MAX_LOREBOOK_ENTRY_CONTENT_BYTES);
  const description =
    typeof args.description === "string" && args.description.trim()
      ? trimToUtf8Bytes(args.description.trim(), MAX_LOREBOOK_ENTRY_DESCRIPTION_BYTES)
      : undefined;
  const tag = typeof args.tag === "string" && args.tag.trim() ? args.tag.trim().slice(0, 80) : undefined;
  const mode = normalizeLorebookWriteMode(args.mode);
  if (mode === "invalid") {
    return { error: "save_lorebook_entry mode must be one of create|replace|append" };
  }

  return saveFn({
    name,
    content,
    description,
    keys: normalizeLorebookEntryKeys(args.keys, name),
    tag,
    mode,
  });
}

async function editChatMessage(
  args: Record<string, unknown>,
  replaceFn?: ReplaceChatMessageContentFn,
): Promise<Record<string, unknown>> {
  if (!replaceFn) {
    return { error: "Message editing is not available in this context." };
  }
  if (typeof args.messageId !== "string" || !args.messageId.trim()) {
    return { error: "edit_chat_message requires a non-empty messageId" };
  }
  if (typeof args.content !== "string" || !args.content.trim()) {
    return { error: "edit_chat_message requires non-empty content" };
  }

  return replaceFn({
    messageId: args.messageId.trim(),
    content: args.content.trim(),
    reason: typeof args.reason === "string" ? args.reason.trim().slice(0, 240) : undefined,
  });
}

// ── Spotify Tool Implementations ──

async function spotifyGetCurrentPlayback(
  _args: Record<string, unknown>,
  creds?: SpotifyCredentials,
): Promise<Record<string, unknown>> {
  if (!creds?.accessToken) {
    return { error: "Spotify not configured. Please connect Spotify in the Music DJ agent settings." };
  }

  try {
    const res = await fetch("https://api.spotify.com/v1/me/player", {
      headers: { Authorization: `Bearer ${creds.accessToken}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (res.status === 204) {
      const fallbackDevice = await findActiveSpotifyPlaybackDevice(creds.accessToken);
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
          ? "No active Spotify playback, but the current active Spotify device can be targeted by spotify_play."
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
    return { error: "Spotify not configured. Please add your Spotify access token in the Music DJ agent settings." };
  }
  const limit = clampNumber(args.limit ?? 20, 20, 1, 50);

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

function normalizeSpotifyPlayableUri(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const uri = value.trim();
  const trackWithCandidateSuffix = uri.match(/^spotify:track:([A-Za-z0-9]{22})_candidate$/);
  if (trackWithCandidateSuffix) return `spotify:track:${trackWithCandidateSuffix[1]}`;
  if (/^spotify:[a-z]+:[A-Za-z0-9]+$/i.test(uri)) return uri;
  return null;
}

function normalizeSpotifyTrackUri(value: unknown): string | null {
  const uri = normalizeSpotifyPlayableUri(value);
  return uri?.startsWith("spotify:track:") ? uri : null;
}

function normalizeSpotifyTrackHistory(value: unknown, limit = SPOTIFY_RECENT_TRACK_HISTORY_LIMIT): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const entry of value) {
    const uri = normalizeSpotifyTrackUri(entry);
    if (!uri || seen.has(uri)) continue;
    seen.add(uri);
    normalized.push(uri);
    if (normalized.length >= limit) break;
  }
  return normalized;
}

function appendSpotifyTrackHistory(history: unknown, uris: unknown[]): string[] {
  const next: string[] = [];
  const seen = new Set<string>();
  for (const entry of uris) {
    const uri = normalizeSpotifyTrackUri(entry);
    if (!uri || seen.has(uri)) continue;
    seen.add(uri);
    next.push(uri);
  }
  for (const uri of normalizeSpotifyTrackHistory(history)) {
    if (seen.has(uri)) continue;
    seen.add(uri);
    next.push(uri);
    if (next.length >= SPOTIFY_RECENT_TRACK_HISTORY_LIMIT) break;
  }
  return next.slice(0, SPOTIFY_RECENT_TRACK_HISTORY_LIMIT);
}

function getSpotifyRecentTrackUris(chatMeta?: Record<string, unknown>): string[] {
  if (!chatMeta) return [];
  const seen = new Set<string>();
  const recent: string[] = [];
  for (const source of [chatMeta.spotifyRecentTracks, chatMeta.gameRecentSpotifyTracks]) {
    for (const uri of normalizeSpotifyTrackHistory(source)) {
      if (seen.has(uri)) continue;
      seen.add(uri);
      recent.push(uri);
      if (recent.length >= SPOTIFY_RECENT_TRACK_HISTORY_LIMIT) return recent;
    }
  }
  return recent;
}

function getSpotifyRecentTrackMetadataKey(chatMeta?: Record<string, unknown>): "spotifyRecentTracks" | "gameRecentSpotifyTracks" {
  return chatMeta?.gameUseSpotifyMusic === true || typeof chatMeta?.gameSpotifySourceType === "string"
    ? "gameRecentSpotifyTracks"
    : "spotifyRecentTracks";
}

async function rememberSpotifyPlayedTracks(context: ToolExecutionContext | undefined, uris: unknown[]): Promise<void> {
  const trackUris = uris.map(normalizeSpotifyTrackUri).filter((uri): uri is string => Boolean(uri));
  if (trackUris.length === 0 || !context?.onUpdateMetadata) return;

  try {
    await context.onUpdateMetadata((currentMeta) => {
      const key = getSpotifyRecentTrackMetadataKey({ ...(context.chatMeta ?? {}), ...currentMeta });
      return {
        [key]: appendSpotifyTrackHistory(currentMeta[key] ?? context.chatMeta?.[key], trackUris),
      };
    });
  } catch (err) {
    logger.debug(err, "[spotify] Failed to persist recent track history");
  }
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
    device?: { id?: string | null; name?: string | null; type?: string | null } | null;
  };

  return {
    active: true,
    isPlaying: data.is_playing === true,
    trackUri: typeof data.item?.uri === "string" ? data.item.uri : null,
    repeatState: normalizeSpotifyRepeatState(data.repeat_state),
    deviceId: typeof data.device?.id === "string" ? data.device.id : null,
    deviceName: typeof data.device?.name === "string" ? data.device.name : null,
    deviceType: typeof data.device?.type === "string" ? data.device.type : null,
  };
}

async function findActiveSpotifyPlaybackDevice(
  accessToken: string,
): Promise<{ deviceId: string; deviceName: string; deviceType: string | null } | null> {
  const res = await fetch("https://api.spotify.com/v1/me/player/devices", {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);
  if (!res || !res.ok) return null;

  const data = (await res.json().catch(() => null)) as { devices?: SpotifyPlaybackDevice[] } | null;
  const devices = data?.devices ?? [];
  const candidate = devices.find(
    (device) =>
      typeof device.id === "string" &&
      device.id.trim().length > 0 &&
      device.is_restricted !== true &&
      device.is_active === true,
  );
  if (!candidate?.id) return null;

  return {
    deviceId: candidate.id,
    deviceName: candidate.name ?? "Spotify device",
    deviceType: candidate.type ?? null,
  };
}

function spotifyPlaybackMatches(
  snapshot: SpotifyPlaybackSnapshot | null,
  expectedUris?: string[],
  requireFirstUri = false,
): boolean {
  if (!snapshot?.isPlaying) return false;
  if (!expectedUris || expectedUris.length === 0) return true;
  if (!snapshot.trackUri) return false;
  if (requireFirstUri) return snapshot.trackUri === expectedUris[0];
  return expectedUris.includes(snapshot.trackUri);
}

function formatSpotifyPlaybackPendingDisplay(
  uri: string,
  reason: string | null | undefined,
  targetDeviceName?: string | null,
): string {
  const deviceText = targetDeviceName ? ` on ${targetDeviceName}` : "";
  return `🎵 Spotify accepted playback${deviceText}; verification pending: ${uri}${reason ? ` - ${reason}` : ""}`;
}

async function waitForSpotifyPlayback(
  accessToken: string,
  expectedTrackUri?: string,
): Promise<SpotifyPlaybackSnapshot | null> {
  let latest: SpotifyPlaybackSnapshot | null = null;
  for (const delay of SPOTIFY_PLAYBACK_VERIFY_DELAYS_MS) {
    if (delay > 0) await wait(delay);
    latest = await fetchSpotifyPlaybackSnapshot(accessToken);
    if (expectedTrackUri) {
      if (latest?.isPlaying && latest.trackUri === expectedTrackUri) return latest;
    } else if (latest?.isPlaying) {
      return latest;
    }
  }
  return latest;
}

async function requestSpotifyPlayback(
  accessToken: string,
  deviceId: string | null,
  body: SpotifyPlayRequestBody,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const playQuery = deviceId ? `?${new URLSearchParams({ device_id: deviceId }).toString()}` : "";
  const res = await fetch(`https://api.spotify.com/v1/me/player/play${playQuery}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  if (res.ok || res.status === 204) return { ok: true };

  const text = await res.text();
  return { ok: false, error: `Spotify play failed (${res.status}): ${text.slice(0, 200)}` };
}

async function queueSpotifyTrack(
  accessToken: string,
  deviceId: string | null,
  uri: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const params = new URLSearchParams({ uri });
  if (deviceId) params.set("device_id", deviceId);
  const res = await fetch(`https://api.spotify.com/v1/me/player/queue?${params.toString()}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (res.ok || res.status === 204) return { ok: true };

  const text = await res.text();
  return { ok: false, error: `Spotify queue failed (${res.status}): ${text.slice(0, 200)}` };
}

async function queueSpotifyTracks(accessToken: string, deviceId: string | null, uris: string[]): Promise<number> {
  let queued = 0;
  for (const uri of uris) {
    const result = await queueSpotifyTrack(accessToken, deviceId, uri);
    if (result.ok) {
      queued++;
    } else {
      logger.debug("[spotify] Queueing %s failed: %s", uri, result.error);
    }
  }
  return queued;
}

async function transferSpotifyPlaybackToDevice(accessToken: string, deviceId: string, play = false): Promise<boolean> {
  const res = await fetch("https://api.spotify.com/v1/me/player", {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ device_ids: [deviceId], play }),
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);
  return !!res && (res.ok || res.status === 204);
}

async function primeSpotifyPlaybackDevice(
  accessToken: string,
  deviceId: string,
  deviceName: string | null,
): Promise<void> {
  const transferred = await transferSpotifyPlaybackToDevice(accessToken, deviceId, false);
  if (!transferred) {
    logger.debug("[spotify] Idle-device prime failed for %s", deviceName ?? deviceId);
    return;
  }
  await wait(SPOTIFY_PLAYBACK_SETTLE_MS);
}

async function verifyOrNudgeSpotifyPlayback(args: {
  accessToken: string;
  body: SpotifyPlayRequestBody;
  initialDeviceId: string | null;
  targetDeviceId: string | null;
  targetDeviceName: string | null;
  expectedTrackUri?: string;
  expectedUris?: string[];
  requireFirstUri?: boolean;
}): Promise<SpotifyPlaybackSnapshot | null> {
  let current = await waitForSpotifyPlayback(args.accessToken, args.expectedTrackUri);
  if (spotifyPlaybackMatches(current, args.expectedUris, args.requireFirstUri)) return current;

  if (!args.targetDeviceId) return current;

  if (args.initialDeviceId !== args.targetDeviceId) {
    logger.debug(
      "[spotify] Playback verification failed; retrying explicit target device %s",
      args.targetDeviceName ?? args.targetDeviceId,
    );
    const retry = await requestSpotifyPlayback(args.accessToken, args.targetDeviceId, args.body);
    if (retry.ok) {
      current = await waitForSpotifyPlayback(args.accessToken, args.expectedTrackUri);
      if (spotifyPlaybackMatches(current, args.expectedUris, args.requireFirstUri)) return current;
    } else {
      logger.debug("[spotify] Explicit target retry failed: %s", retry.error);
    }
  }

  logger.debug("[spotify] Playback still not verified; retrying Spotify's current active playback session");
  const activeSessionRetry = await requestSpotifyPlayback(args.accessToken, null, args.body);
  if (activeSessionRetry.ok) {
    current = await waitForSpotifyPlayback(args.accessToken, args.expectedTrackUri);
    if (spotifyPlaybackMatches(current, args.expectedUris, args.requireFirstUri)) return current;
  } else {
    logger.debug("[spotify] Current active session retry failed: %s", activeSessionRetry.error);
  }

  logger.debug(
    "[spotify] Playback still not verified; nudging Spotify Connect transfer to %s",
    args.targetDeviceName ?? args.targetDeviceId,
  );
  let transferred = await transferSpotifyPlaybackToDevice(args.accessToken, args.targetDeviceId, false);
  if (transferred) {
    await wait(SPOTIFY_PLAYBACK_SETTLE_MS);
    const retry = await requestSpotifyPlayback(args.accessToken, args.targetDeviceId, args.body);
    if (retry.ok) {
      current = await waitForSpotifyPlayback(args.accessToken, args.expectedTrackUri);
      if (spotifyPlaybackMatches(current, args.expectedUris, args.requireFirstUri)) return current;
    } else {
      logger.debug("[spotify] Post-transfer play retry failed: %s", retry.error);
    }
  }

  transferred = await transferSpotifyPlaybackToDevice(args.accessToken, args.targetDeviceId, true);
  if (transferred) {
    await wait(SPOTIFY_PLAYBACK_SETTLE_MS);
    const retry = await requestSpotifyPlayback(args.accessToken, args.targetDeviceId, args.body);
    if (retry.ok) {
      current = await waitForSpotifyPlayback(args.accessToken, args.expectedTrackUri);
    } else {
      logger.debug("[spotify] Post-autoplay-transfer play retry failed: %s", retry.error);
    }
  }

  return current;
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

function createSpotifySelectionVariant(): string {
  return `${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 10)}`;
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

function sampleSpotifyTracksWithRecentAvoidance(args: {
  tracks: SpotifyTrackCandidate[];
  count: number;
  seed: string;
  recentTrackUris: Set<string>;
}): SpotifyTrackCandidate[] {
  if (args.tracks.length <= args.count) {
    if (args.recentTrackUris.size === 0) return args.tracks;
    const freshTracks = args.tracks.filter((track) => !args.recentTrackUris.has(track.uri));
    const recentTracks = args.tracks.filter((track) => args.recentTrackUris.has(track.uri));
    return [...freshTracks, ...recentTracks];
  }
  if (args.recentTrackUris.size === 0) {
    return sampleSpotifyTracksEvenly(args.tracks, args.count, args.seed);
  }

  const freshTracks = args.tracks.filter((track) => !args.recentTrackUris.has(track.uri));
  const recentTracks = args.tracks.filter((track) => args.recentTrackUris.has(track.uri));
  const selected = sampleSpotifyTracksEvenly(
    freshTracks.length > 0 ? freshTracks : args.tracks,
    Math.min(args.count, freshTracks.length || args.tracks.length),
    args.seed,
  );
  if (selected.length >= args.count || recentTracks.length === 0) return selected;

  const seen = new Set(selected.map((track) => track.uri));
  const fill = sampleSpotifyTracksEvenly(
    recentTracks.filter((track) => !seen.has(track.uri)),
    args.count - selected.length,
    `${args.seed}:recent-fill`,
  );
  selected.push(...fill);
  return selected;
}

function selectSpotifyTrackCandidates(args: {
  tracks: SpotifyTrackCandidate[];
  query: string;
  limit: number;
  playlistId: string;
  recentTrackUris?: string[];
  selectionVariant?: string;
}): { candidates: SpotifyTrackCandidate[]; mode: string; tokens: string[]; recentAvoidedCount: number } {
  const phrase = normalizeSpotifyText(args.query);
  const tokens = buildSpotifyCandidateTokens(args.query);
  const recentTrackUris = new Set(args.recentTrackUris ?? []);
  const recentAvoidedCount = args.tracks.filter((track) => recentTrackUris.has(track.uri)).length;
  if (tokens.length === 0) {
    return {
      candidates: sampleSpotifyTracksWithRecentAvoidance({
        tracks: args.tracks,
        count: args.limit,
        seed: `${args.playlistId}:balanced:${args.selectionVariant ?? ""}`,
        recentTrackUris,
      }),
      mode: recentAvoidedCount > 0 ? "balanced_sample_rotating_recent_aware" : "balanced_sample_rotating",
      tokens,
      recentAvoidedCount,
    };
  }

  const scored = args.tracks
    .map((track) => ({ ...track, score: scoreSpotifyCandidate(track, phrase, tokens) }))
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const strong = scored.filter((track) => (track.score ?? 0) >= 2);
  const strongTarget = strong.length > 0 ? Math.max(1, Math.floor(args.limit * 0.75)) : 0;
  const selected: SpotifyTrackCandidate[] =
    strongTarget > 0
      ? sampleSpotifyTracksWithRecentAvoidance({
          tracks: strong.filter((track) => !recentTrackUris.has(track.uri)),
          count: strongTarget,
          seed: `${args.playlistId}:${phrase}:${args.selectionVariant ?? ""}:strong`,
          recentTrackUris,
        })
      : [];
  const seen = new Set(selected.map((track) => track.uri));
  const reserve = args.limit - selected.length;

  if (reserve > 0) {
    const fallback = sampleSpotifyTracksWithRecentAvoidance({
      tracks: args.tracks.filter((track) => !seen.has(track.uri)),
      count: reserve,
      seed: `${args.playlistId}:${phrase}:${args.selectionVariant ?? ""}:fallback`,
      recentTrackUris,
    });
    selected.push(...fallback);
  }

  return {
    candidates: selected.slice(0, args.limit),
    mode:
      recentAvoidedCount > 0
        ? strong.length > 0
          ? "scored_candidates_rotating_recent_aware"
          : "balanced_sample_rotating_recent_aware"
        : strong.length > 0
          ? "scored_candidates_rotating"
          : "balanced_sample_rotating",
    tokens,
    recentAvoidedCount,
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
  const batchSize = SPOTIFY_TRACK_PAGE_SIZE;

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
  context?: ToolExecutionContext,
): Promise<Record<string, unknown>> {
  if (!creds?.accessToken) {
    return { error: "Spotify not configured. Please add your Spotify access token in the Music DJ agent settings." };
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
      const recentTrackUris = getSpotifyRecentTrackUris(context?.chatMeta);
      const selectionVariant = createSpotifySelectionVariant();
      const selection = selectSpotifyTrackCandidates({
        tracks: index.tracks,
        query,
        limit: candidateLimit,
        playlistId,
        recentTrackUris,
        selectionVariant,
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
        recentTrackUris: recentTrackUris.slice(0, SPOTIFY_RECENT_TRACK_PROMPT_LIMIT),
        recentAvoidedCount: selection.recentAvoidedCount,
        candidateSample: selectionVariant,
        truncated: index.truncated,
        hint:
          "Server indexed the playlist and returned only selected candidates. Recently played tracks are suppressed when alternatives exist; avoid recentTrackUris unless no fitting non-recent candidate appears. Pick 3-5 URIs from this shortlist; do not request every page unless you truly need manual browsing.",
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
    return { error: "Spotify not configured. Please add your Spotify access token in the Music DJ agent settings." };
  }
  const query = normalizeSpotifySearchQuery(args.query);
  const limit = clampNumber(args.limit ?? 5, 5, 1, 20);

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
  context?: ToolExecutionContext,
): Promise<Record<string, unknown>> {
  if (!creds?.accessToken) {
    return { error: "Spotify not configured. Please add your Spotify access token in the Music DJ agent settings." };
  }
  const reason = String(args.reason ?? "");
  const repeatAfterPlay = context?.spotifyRepeatAfterPlay;

  // Support both single `uri` and array `uris`
  let uris: string[] = [];
  if (Array.isArray(args.uris)) {
    uris = (args.uris as unknown[]).map(normalizeSpotifyPlayableUri).filter((u): u is string => Boolean(u));
  }
  const singleUri = normalizeSpotifyPlayableUri(args.uri);
  if (singleUri) {
    // If single uri is provided, prepend it (avoid duplicates)
    if (!uris.includes(singleUri)) uris.unshift(singleUri);
  }
  if (uris.length === 0) {
    return { error: "No valid Spotify URIs provided" };
  }

  try {
    // If it's a single playlist URI, use context_uri
    const firstUri = uris[0]!;
    const singleTrackUri = uris.length === 1 && firstUri.startsWith("spotify:track:");
    const beforePlayback = await fetchSpotifyPlaybackSnapshot(creds.accessToken);
    const fallbackDevice = beforePlayback?.deviceId ? null : await findActiveSpotifyPlaybackDevice(creds.accessToken);
    const targetDeviceId = beforePlayback?.deviceId ?? fallbackDevice?.deviceId ?? null;
    const targetDeviceName = beforePlayback?.deviceName ?? fallbackDevice?.deviceName ?? null;
    const playDeviceId = beforePlayback?.deviceId ? null : targetDeviceId;
    if (!targetDeviceId) {
      return {
        error:
          "No active Spotify device is available. Open Spotify on the device you want to use, then try again.",
      };
    }
    logger.debug(
      "[spotify] Starting playback on %s (%s)",
      targetDeviceName ?? "the active Spotify device",
      playDeviceId ? "explicit active-device target" : "current active playback session",
    );
    if (playDeviceId && !beforePlayback?.deviceId) {
      await primeSpotifyPlaybackDevice(creds.accessToken, playDeviceId, targetDeviceName);
    }

    if (singleTrackUri && repeatAfterPlay === "track") {
      await applySpotifyRepeatAfterPlay(creds.accessToken, "off", playDeviceId);
    }

    if (uris.length === 1 && !firstUri.startsWith("spotify:track:")) {
      const body: SpotifyPlayRequestBody = { context_uri: firstUri };
      const play = await requestSpotifyPlayback(creds.accessToken, playDeviceId, body);
      if (!play.ok) return { error: play.error };
      const repeat = await applySpotifyRepeatAfterPlay(creds.accessToken, repeatAfterPlay, playDeviceId);
      const current = await verifyOrNudgeSpotifyPlayback({
        accessToken: creds.accessToken,
        body,
        initialDeviceId: playDeviceId,
        targetDeviceId,
        targetDeviceName,
      });
      if (!spotifyPlaybackMatches(current)) {
        logger.warn(
          "[spotify] Playback accepted but verification failed device=%s isPlaying=%s currentUri=%s expected=%s",
          current?.deviceName ?? targetDeviceName ?? "unknown",
          current?.isPlaying === true ? "true" : "false",
          current?.trackUri ?? "none",
          firstUri,
        );
        return {
          applied: true,
          playbackPending: true,
          verification: "pending",
          uris,
          reason,
          repeat,
          repeatState: current?.repeatState ?? repeat ?? null,
          currentUri: current?.trackUri ?? null,
          device: current?.deviceName ?? targetDeviceName,
          display: formatSpotifyPlaybackPendingDisplay(firstUri, reason, current?.deviceName ?? targetDeviceName),
        };
      }
      await rememberSpotifyPlayedTracks(context, current?.trackUri ? [current.trackUri] : []);
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

    // For track queues, start the first track first, then add the rest with
    // Spotify's queue endpoint. Sending 3-5 URIs directly to /play is valid,
    // but Spotify Connect can accept it without reliably starting playback.
    const allTrackUris = uris.every((uri) => uri.startsWith("spotify:track:"));
    const playbackUris = allTrackUris && uris.length > 1 ? [firstUri] : uris;
    const queuedTrackUris = allTrackUris && uris.length > 1 ? uris.slice(1) : [];
    const body: SpotifyPlayRequestBody = { uris: playbackUris, position_ms: 0 };
    const play = await requestSpotifyPlayback(creds.accessToken, playDeviceId, body);
    if (!play.ok) return { error: play.error };
    if (singleTrackUri) await wait(SPOTIFY_PLAYBACK_SETTLE_MS);
    let repeat = await applySpotifyRepeatAfterPlay(creds.accessToken, repeatAfterPlay, playDeviceId);
    let current = await verifyOrNudgeSpotifyPlayback({
      accessToken: creds.accessToken,
      body,
      initialDeviceId: playDeviceId,
      targetDeviceId,
      targetDeviceName,
      expectedTrackUri: singleTrackUri || (allTrackUris && uris.length > 1) ? firstUri : undefined,
      expectedUris: playbackUris,
      requireFirstUri: singleTrackUri || (allTrackUris && uris.length > 1),
    });
    if (singleTrackUri && repeatAfterPlay === "track" && current?.repeatState !== "track") {
      repeat = await applySpotifyRepeatAfterPlay(creds.accessToken, "track", current?.deviceId ?? playDeviceId, 3);
      current = await verifyOrNudgeSpotifyPlayback({
        accessToken: creds.accessToken,
        body,
        initialDeviceId: current?.deviceId ?? playDeviceId,
        targetDeviceId,
        targetDeviceName,
        expectedTrackUri: firstUri,
        expectedUris: playbackUris,
        requireFirstUri: true,
      });
    }
    if (!spotifyPlaybackMatches(current, playbackUris, singleTrackUri || (allTrackUris && uris.length > 1))) {
      logger.warn(
        "[spotify] Playback accepted but verification failed device=%s isPlaying=%s currentUri=%s expected=%s",
        current?.deviceName ?? targetDeviceName ?? "unknown",
        current?.isPlaying === true ? "true" : "false",
        current?.trackUri ?? "none",
        playbackUris[0] ?? firstUri,
      );
      const queuedAfterStart = await queueSpotifyTracks(
        creds.accessToken,
        current?.deviceId ?? playDeviceId,
        queuedTrackUris,
      );
      const totalQueued = playbackUris.length + queuedAfterStart;
      await rememberSpotifyPlayedTracks(context, uris);
      return {
        applied: true,
        playbackPending: true,
        verification: "pending",
        uris,
        reason,
        repeat,
        repeatState: current?.repeatState ?? repeat ?? null,
        currentUri: current?.trackUri ?? null,
        device: current?.deviceName ?? targetDeviceName,
        queued: totalQueued,
        queueRequested: uris.length,
        display: formatSpotifyPlaybackPendingDisplay(firstUri, reason, current?.deviceName ?? targetDeviceName),
      };
    }
    const queuedAfterStart = await queueSpotifyTracks(
      creds.accessToken,
      current?.deviceId ?? playDeviceId,
      queuedTrackUris,
    );
    const totalQueued = playbackUris.length + queuedAfterStart;
    await rememberSpotifyPlayedTracks(context, uris);
    return {
      applied: true,
      uris,
      reason,
      repeat,
      repeatState: current?.repeatState ?? repeat ?? null,
      currentUri: current?.trackUri ?? null,
      device: current?.deviceName ?? targetDeviceName,
      queued: totalQueued,
      queueRequested: uris.length,
      display:
        totalQueued > 1
          ? `🎵 Queued ${totalQueued} tracks${reason ? ` — ${reason}` : ""}`
          : `🎵 Now playing: ${firstUri}${reason ? ` — ${reason}` : ""}`,
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
    return { error: "Spotify not configured. Please add your Spotify access token in the Music DJ agent settings." };
  }
  const volume = clampNumber(args.volume ?? 50, 50, 0, 100);
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
