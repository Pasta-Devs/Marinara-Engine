// ──────────────────────────────────────────────
// Chat insights: cross-chat search, per-chat stats and activity overview
// ──────────────────────────────────────────────
// Every scan walks one chat at a time through a chatId-scoped query so the
// file store only has to keep the chat unit it is reading resident; nothing
// here asks for the whole messages table at once.
import {
  CHAT_SITTING_GAP_MS,
  buildChatSearchSnippet,
  compileChatSearchQuery,
  computeChatPlayTime,
  computeChatStats,
  computeDayStreaks,
  countChatWords,
  createLocalDayKeyer,
  matchesChatSearchQuery,
  normalizeTimeZoneName,
  parseChatTimestamp,
  type ActivityOverview,
  type ActivityTopChat,
  type ChatMode,
  type ChatSearchRole,
  type ChatStats,
  type ChatStatsMessage,
  type GlobalChatSearchResponse,
  type GlobalChatSearchResult,
} from "@marinara-engine/shared";
import type { DB } from "../../db/connection.js";
import { chats, characters, messages } from "../../db/schema/index.js";
import { eq, inArray } from "../../db/file-query.js";
import { createCharactersStorage } from "../storage/characters.storage.js";
import { resolveChatUserIdentity } from "../chat-user-identity.js";

type ChatRow = typeof chats.$inferSelect;
type MessageRow = typeof messages.$inferSelect;

const PROFESSOR_MARI_INTERNAL_CHAT_MARKER = "professor-mari";
const SEARCH_ROLES = new Set<ChatSearchRole>(["user", "assistant", "narrator", "system"]);
const CHAT_MODES = new Set<ChatMode>(["conversation", "roleplay", "game"]);

export const GLOBAL_SEARCH_MAX_LIMIT = 100;
export const GLOBAL_SEARCH_MAX_OFFSET = 1_000;
export const GLOBAL_SEARCH_TIME_BUDGET_MS = 8_000;

function parseRecord(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (typeof raw !== "string" || !raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function parseIdList(raw: unknown): string[] {
  const value =
    typeof raw === "string"
      ? (() => {
          try {
            return JSON.parse(raw);
          } catch {
            return [];
          }
        })()
      : raw;
  return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string" && id.length > 0) : [];
}

export function isInternalAssistantChat(chat: { metadata?: unknown }): boolean {
  return parseRecord(chat.metadata).internalAssistant === PROFESSOR_MARI_INTERNAL_CHAT_MARKER;
}

const VISIBILITY_FLAGS = ["hiddenFromUser", "commandOnly", "roleplayPrivateOnly"] as const;

/**
 * Whether a stored message shows up in the readable transcript. The extra blob
 * is only parsed when it mentions one of the flags, which keeps full scans cheap.
 */
export function isReaderVisibleMessage(message: { role?: unknown; content?: unknown; extra?: unknown }): boolean {
  if (message.role === "system") return false;
  if (typeof message.content !== "string" || message.content.trim().length === 0) return false;
  const extra = message.extra;
  if (typeof extra === "string" && !VISIBILITY_FLAGS.some((flag) => extra.includes(flag))) return true;
  const record = parseRecord(extra);
  return VISIBILITY_FLAGS.every((flag) => record[flag] !== true);
}

function normalizeRole(role: unknown): ChatSearchRole {
  return SEARCH_ROLES.has(role as ChatSearchRole) ? (role as ChatSearchRole) : "assistant";
}

async function listChatMessages(db: DB, chatId: string): Promise<MessageRow[]> {
  return db.select().from(messages).where(eq(messages.chatId, chatId)).orderBy(messages.createdAt, messages.id);
}

async function listUserChats(db: DB): Promise<ChatRow[]> {
  const rows = (await db.select().from(chats)) as ChatRow[];
  return rows.filter((chat) => !isInternalAssistantChat(chat));
}

function chatActivityTime(chat: ChatRow): number {
  return parseChatTimestamp(chat.lastMessageAt) ?? parseChatTimestamp(chat.updatedAt) ?? 0;
}

/** Lazily resolves character display names, parsing each card at most once per scan. */
function createCharacterNameCache(db: DB) {
  const names = new Map<string, string | null>();
  return {
    async load(ids: Iterable<string>) {
      const missing = [...new Set(ids)].filter((id) => id && !names.has(id));
      if (missing.length === 0) return;
      const rows = await db
        .select({ id: characters.id, data: characters.data })
        .from(characters)
        .where(inArray(characters.id, missing));
      for (const id of missing) names.set(id, null);
      for (const row of rows) {
        const name = parseRecord(row.data).name;
        names.set(row.id, typeof name === "string" && name.trim() ? name.trim() : null);
      }
    },
    get(id: string | null | undefined): string | null {
      return id ? (names.get(id) ?? null) : null;
    },
  };
}

// ── Global search ──

export interface GlobalChatSearchParams {
  query: string;
  mode?: string | null;
  characterId?: string | null;
  role?: string | null;
  from?: string | null;
  to?: string | null;
  offset?: number;
  limit?: number;
  /**
   * Keeps at most this many hits per chat and counts every match per chat (`chats`).
   * The scan covers every chat, so the counts are complete; `offset` and `hasMore` do not apply.
   */
  perChat?: number;
  /** Test hook: overrides the scan time budget. */
  timeBudgetMs?: number;
}

function clampInteger(value: unknown, fallback: number, min: number, max: number): number {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(number)));
}

/** Parse a date filter. A bare YYYY-MM-DD `to` date includes that whole day. */
function parseDateBound(value: string | null | undefined, endOfDay: boolean): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/u.test(trimmed)) {
    const base = Date.parse(`${trimmed}T00:00:00Z`);
    if (!Number.isFinite(base)) return null;
    return endOfDay ? base + 86_400_000 - 1 : base;
  }
  return parseChatTimestamp(trimmed);
}

export async function searchAllChats(db: DB, params: GlobalChatSearchParams): Promise<GlobalChatSearchResponse> {
  const query = compileChatSearchQuery(params.query ?? "");
  const limit = clampInteger(params.limit, 30, 1, GLOBAL_SEARCH_MAX_LIMIT);
  // Offsets past the cap return an empty final page instead of being clamped
  // back onto it, which would hand the client the same results again forever.
  const requestedOffset = clampInteger(params.offset, 0, 0, Number.MAX_SAFE_INTEGER);
  const offset = Math.min(requestedOffset, GLOBAL_SEARCH_MAX_OFFSET);
  const mode = CHAT_MODES.has(params.mode as ChatMode) ? (params.mode as ChatMode) : null;
  const role = SEARCH_ROLES.has(params.role as ChatSearchRole) ? (params.role as ChatSearchRole) : null;
  const characterId = params.characterId?.trim() || null;
  const from = parseDateBound(params.from, false);
  const to = parseDateBound(params.to, true);
  const budget = params.timeBudgetMs ?? GLOBAL_SEARCH_TIME_BUDGET_MS;
  const response: GlobalChatSearchResponse = {
    query: params.query ?? "",
    results: [],
    chats: [],
    offset,
    limit,
    hasMore: false,
    partial: false,
    scannedChats: 0,
    totalChats: 0,
  };
  if (query.patterns.length === 0 || requestedOffset > GLOBAL_SEARCH_MAX_OFFSET) return response;

  const candidates = (await listUserChats(db))
    .filter((chat) => !mode || chat.mode === mode)
    .filter((chat) => !characterId || parseIdList(chat.characterIds).includes(characterId))
    .filter((chat) => {
      // A chat whose newest message predates the window cannot match.
      if (from === null) return true;
      const last = parseChatTimestamp(chat.lastMessageAt);
      return last === null || last >= from;
    })
    .sort((left, right) => chatActivityTime(right) - chatActivityTime(left) || left.id.localeCompare(right.id));
  response.totalChats = candidates.length;

  const names = createCharacterNameCache(db);
  const wanted = offset + limit;
  // perChat counts every chat, so it never stops early; the time budget still can.
  const perChat = params.perChat === undefined ? null : clampInteger(params.perChat, 1, 1, GLOBAL_SEARCH_MAX_LIMIT);
  let matched = 0;
  const startedAt = Date.now();

  for (const chat of candidates) {
    if (!perChat && matched > wanted) break;
    if (Date.now() - startedAt > budget) {
      response.partial = true;
      break;
    }
    response.scannedChats += 1;
    const rows = await listChatMessages(db, chat.id);
    const pending: Array<{ row: MessageRow; index: number }> = [];
    let chatMatches = 0;
    // Newest matches first inside each chat, so recent context surfaces sooner.
    for (let index = rows.length - 1; index >= 0; index -= 1) {
      const row = rows[index]!;
      const rowRole = normalizeRole(row.role);
      if (role && rowRole !== role) continue;
      if (from !== null || to !== null) {
        const time = parseChatTimestamp(row.createdAt);
        if (time === null || (from !== null && time < from) || (to !== null && time > to)) continue;
      }
      if (!matchesChatSearchQuery(row.content, query)) continue;
      if (!isReaderVisibleMessage(row)) continue;
      matched += 1;
      chatMatches += 1;
      if (perChat ? pending.length < perChat : matched > offset && matched <= wanted) pending.push({ row, index });
      if (!perChat && matched > wanted) break;
    }
    if (perChat && chatMatches > 0) {
      const castIds = parseIdList(chat.characterIds);
      await names.load(castIds);
      response.chats.push({
        chatId: chat.id,
        chatName: chat.name,
        chatMode: chat.mode as ChatMode,
        matches: chatMatches,
        cast: castIds.map((id) => names.get(id)).filter((name): name is string => name !== null),
      });
    }
    if (pending.length === 0) continue;
    await names.load(pending.map(({ row }) => row.characterId ?? "").filter(Boolean));
    // A perChat page stops at `limit` hits; the chat counts above still cover every chat.
    const room = perChat ? Math.max(0, limit - response.results.length) : pending.length;
    for (const { row, index } of pending.slice(0, room)) {
      const rowRole = normalizeRole(row.role);
      const snippet = buildChatSearchSnippet(row.content, query);
      const speaker = rowRole === "assistant" && chat.mode !== "game";
      const result: GlobalChatSearchResult = {
        chatId: chat.id,
        chatName: chat.name,
        chatMode: chat.mode as ChatMode,
        messageId: row.id,
        messageNumber: index + 1,
        role: rowRole,
        speaker: speaker ? names.get(row.characterId) : null,
        characterId: speaker ? (row.characterId ?? null) : null,
        createdAt: row.createdAt,
        snippet: snippet.text,
        highlights: snippet.highlights,
      };
      response.results.push(result);
    }
  }

  // The next page starts at `wanted`; past the offset cap there is no next page.
  response.hasMore = !perChat && matched > wanted && wanted <= GLOBAL_SEARCH_MAX_OFFSET;
  return response;
}

// ── Per-chat stats ──

export interface ChatStatsParams {
  timezoneOffsetMinutes?: number;
  /** IANA zone from the reader's browser; wins over the fixed offset so DST is honoured. */
  timeZone?: string | null;
}

export function normalizeTimezoneOffset(value: unknown): number {
  return clampInteger(value, 0, -14 * 60, 14 * 60);
}

function readGenerationUsage(extra: unknown): { prompt: number | null; completion: number | null } {
  if (typeof extra === "string" && !extra.includes("generationInfo")) return { prompt: null, completion: null };
  const info = parseRecord(parseRecord(extra).generationInfo);
  const number = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : null);
  return { prompt: number(info.tokensPrompt), completion: number(info.tokensCompletion) };
}

export async function computeStoredChatStats(db: DB, chat: ChatRow, params: ChatStatsParams = {}): Promise<ChatStats> {
  const rows = await listChatMessages(db, chat.id);
  const names = createCharacterNameCache(db);
  await names.load([...parseIdList(chat.characterIds), ...rows.map((row) => row.characterId ?? "").filter(Boolean)]);
  const identity = await resolveChatUserIdentity(createCharactersStorage(db), chat).catch(() => null);
  const userName = identity?.name?.trim() || "You";
  const primaryCharacter = names.get(parseIdList(chat.characterIds)[0]) ?? chat.name;

  const messageNumbers = new Map<string, number>();
  const input: ChatStatsMessage[] = [];
  rows.forEach((row, index) => {
    const role = normalizeRole(row.role);
    if (role === "system" || !isReaderVisibleMessage(row)) return;
    messageNumbers.set(row.id, index + 1);
    let speakerKey: string = role;
    let speakerName = role === "user" ? userName : "Narrator";
    if (role === "assistant" && chat.mode !== "game") {
      speakerKey = row.characterId ? `character:${row.characterId}` : "character:primary";
      speakerName = names.get(row.characterId) ?? primaryCharacter;
    }
    const usage = role === "assistant" || role === "narrator" ? readGenerationUsage(row.extra) : null;
    input.push({
      id: row.id,
      role,
      speakerKey,
      speakerName,
      content: row.content,
      createdAt: row.createdAt,
      tokensPrompt: usage?.prompt ?? null,
      tokensCompletion: usage?.completion ?? null,
    });
  });

  return computeChatStats({ id: chat.id, name: chat.name }, input, {
    timezoneOffsetMinutes: normalizeTimezoneOffset(params.timezoneOffsetMinutes),
    timeZone: normalizeTimeZoneName(params.timeZone),
    messageNumbers,
  });
}

// ── Activity overview ──

export const ACTIVITY_CACHE_TTL_MS = 60_000;
export const ACTIVITY_TOP_CHAT_LIMIT = 8;
/** Even an unchanged-looking chat summary is re-read after this long, to heal any drift. */
export const ACTIVITY_SUMMARY_MAX_AGE_MS = 60 * 60_000;

/** Time zone independent facts about one chat, reusable across overviews. */
interface ChatActivitySummary {
  /** updatedAt and lastMessageAt when the summary was computed. */
  key: string;
  /** messages table write generation read before the rows were scanned. */
  generation: number;
  computedAt: number;
  /** Visible, non-system message times, ascending. */
  times: number[];
  words: number;
}

type ActivityStoreProbe = {
  getTableWriteGeneration?: (table: string) => number;
};

function chatSummaryKey(chat: ChatRow): string {
  return `${chat.updatedAt ?? ""}|${chat.lastMessageAt ?? ""}`;
}

async function summarizeChatActivity(db: DB, chat: ChatRow, generation: number): Promise<ChatActivitySummary> {
  const rows = await listChatMessages(db, chat.id);
  const times: number[] = [];
  let words = 0;
  for (const row of rows) {
    if (row.role === "system" || !isReaderVisibleMessage(row)) continue;
    const time = parseChatTimestamp(row.createdAt);
    if (time === null) continue;
    times.push(time);
    words += countChatWords(row.content);
  }
  times.sort((left, right) => left - right);
  return { key: chatSummaryKey(chat), generation, computedAt: Date.now(), times, words };
}

/**
 * Per-chat activity summaries that survive between overview builds, so a
 * rebuild only re-reads chats that may have changed. A summary is reused when
 * the chat's updatedAt/lastMessageAt and the entire messages table write
 * generation are unchanged. Residency cannot prove that a chat is unchanged:
 * an edited unit can be flushed and evicted before the next overview build.
 */
export function createChatActivitySummaryCache(db: DB, maxAgeMs = ACTIVITY_SUMMARY_MAX_AGE_MS) {
  const entries = new Map<string, ChatActivitySummary>();
  const store = (db as { _fileStore?: ActivityStoreProbe })._fileStore;
  const stats = { scanned: 0, reused: 0 };
  return {
    stats,
    async collect(chatRows: readonly ChatRow[]): Promise<Map<string, ChatActivitySummary>> {
      const generation = store?.getTableWriteGeneration?.("messages") ?? -1;
      const now = Date.now();
      const result = new Map<string, ChatActivitySummary>();
      for (const chat of chatRows) {
        const cached = entries.get(chat.id);
        const reusable =
          cached &&
          generation >= 0 &&
          cached.key === chatSummaryKey(chat) &&
          now - cached.computedAt < maxAgeMs &&
          cached.generation === generation;
        if (reusable) {
          stats.reused += 1;
          result.set(chat.id, cached);
          continue;
        }
        const summary = await summarizeChatActivity(db, chat, store?.getTableWriteGeneration?.("messages") ?? -1);
        stats.scanned += 1;
        entries.set(chat.id, summary);
        result.set(chat.id, summary);
      }
      // Forget deleted chats.
      for (const id of entries.keys()) if (!result.has(id)) entries.delete(id);
      return result;
    },
    clear() {
      entries.clear();
    },
  };
}

export type ChatActivitySummaryCache = ReturnType<typeof createChatActivitySummaryCache>;

export async function buildActivityOverview(
  db: DB,
  params: {
    timezoneOffsetMinutes?: number;
    timeZone?: string | null;
    now?: number;
    summaries?: ChatActivitySummaryCache;
  } = {},
): Promise<ActivityOverview> {
  const dayKey = createLocalDayKeyer({
    timeZone: params.timeZone,
    timezoneOffsetMinutes: normalizeTimezoneOffset(params.timezoneOffsetMinutes),
  });
  const now = params.now ?? Date.now();
  const days: Record<string, number> = {};
  const allTimes: number[] = [];
  const topChats: ActivityTopChat[] = [];
  let totalMessages = 0;
  let totalWords = 0;

  const chatRows = await listUserChats(db);
  const summaries = await (params.summaries ?? createChatActivitySummaryCache(db)).collect(chatRows);
  for (const chat of chatRows) {
    const summary = summaries.get(chat.id);
    if (!summary || summary.times.length === 0) continue;
    const { times } = summary;
    totalMessages += times.length;
    totalWords += summary.words;
    for (const time of times) {
      allTimes.push(time);
      const key = dayKey(time);
      days[key] = (days[key] ?? 0) + 1;
    }
    const playTime = computeChatPlayTime(times);
    topChats.push({
      chatId: chat.id,
      chatName: chat.name,
      chatMode: chat.mode as ChatMode,
      messages: times.length,
      playTimeMs: playTime.totalMs,
      lastMessageAt: new Date(times[times.length - 1]!).toISOString(),
    });
  }

  const activeChats = topChats.length;
  topChats.sort((left, right) => right.playTimeMs - left.playTimeMs || right.messages - left.messages);
  const streaks = computeDayStreaks(Object.keys(days), dayKey(now));
  let first: number | null = null;
  let last: number | null = null;
  for (const time of allTimes) {
    if (first === null || time < first) first = time;
    if (last === null || time > last) last = time;
  }

  return {
    generatedAt: new Date(now).toISOString(),
    days,
    totalMessages,
    totalWords,
    activeChats,
    activeDays: Object.keys(days).length,
    currentStreakDays: streaks.current,
    longestStreakDays: streaks.longest,
    // One global timeline, so two chats played side by side are not counted twice.
    playTime: computeChatPlayTime(allTimes, CHAT_SITTING_GAP_MS),
    topChats: topChats.slice(0, ACTIVITY_TOP_CHAT_LIMIT),
    firstMessageAt: first === null ? null : new Date(first).toISOString(),
    lastMessageAt: last === null ? null : new Date(last).toISOString(),
  };
}

const ACTIVITY_CACHE_MAX_ZONES = 32;

/**
 * Memoizes the overview per time zone for a minute and shares one in-flight
 * scan. Per-chat summaries are shared across zones and kept past the TTL, so a
 * miss only re-reads chats that changed.
 */
export function createActivityOverviewCache(db: DB, ttlMs = ACTIVITY_CACHE_TTL_MS) {
  const entries = new Map<string, { at: number; value: Promise<ActivityOverview> }>();
  const summaries = createChatActivitySummaryCache(db);
  return {
    summaries,
    get(
      timezoneOffsetMinutes: number,
      options: { refresh?: boolean; timeZone?: string | null } = {},
    ): Promise<ActivityOverview> {
      const offset = normalizeTimezoneOffset(timezoneOffsetMinutes);
      const timeZone = normalizeTimeZoneName(options.timeZone);
      const cacheKey = timeZone ?? `offset:${offset}`;
      const cached = entries.get(cacheKey);
      if (cached && !options.refresh && Date.now() - cached.at < ttlMs) return cached.value;
      const value = buildActivityOverview(db, { timezoneOffsetMinutes: offset, timeZone, summaries });
      entries.delete(cacheKey);
      if (entries.size >= ACTIVITY_CACHE_MAX_ZONES) entries.delete(entries.keys().next().value!);
      entries.set(cacheKey, { at: Date.now(), value });
      value.catch(() => {
        if (entries.get(cacheKey)?.value === value) entries.delete(cacheKey);
      });
      return value;
    },
    clear() {
      entries.clear();
      summaries.clear();
    },
  };
}
