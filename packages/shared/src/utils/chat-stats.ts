// ──────────────────────────────────────────────
// Chat statistics: words, sittings, days and token totals
// ──────────────────────────────────────────────
import type {
  ChatDayCount,
  ChatLongestMessage,
  ChatPlayTime,
  ChatSearchRole,
  ChatSpeakerStats,
  ChatStats,
  ChatTokenTotals,
} from "../types/chat-insights.js";

/**
 * A gap longer than this between two messages ends one sitting and starts the next. The one rule
 * behind every "play time" figure, including the Golden Mari unlock (R12).
 * ponytail: an estimate from message timestamps, not wall-clock time. Reading before the first
 * message of a sitting and after its last adds nothing, a long-thinking model or a slow reader past
 * 30 minutes splits a sitting, and an idle tab between messages under 30 minutes counts. Exact time
 * would need client focus/visibility heartbeats stored per chat.
 */
export const CHAT_SITTING_GAP_MS = 30 * 60 * 1000;

export interface ChatStatsMessage {
  id: string;
  role: ChatSearchRole;
  /** Stable grouping key for the speaker (character id, "user", "narrator"...). */
  speakerKey: string;
  speakerName: string;
  content: string;
  createdAt: string;
  tokensPrompt?: number | null;
  tokensCompletion?: number | null;
}

export interface ChatStatsOptions {
  /** Minutes to subtract from UTC to get local time, as returned by Date#getTimezoneOffset. */
  timezoneOffsetMinutes?: number;
  /** IANA zone; preferred over the fixed offset so DST changes bucket correctly. */
  timeZone?: string | null;
  gapMs?: number;
}

const CJK_CHAR = "[\\p{Script=Han}\\p{Script=Hiragana}\\p{Script=Katakana}\\p{Script=Hangul}]";
const WORD_PATTERN = new RegExp(
  `${CJK_CHAR}|(?:(?!${CJK_CHAR})[\\p{L}\\p{N}\\p{M}])+(?:['’\\-](?:(?!${CJK_CHAR})[\\p{L}\\p{N}\\p{M}])+)*`,
  "gu",
);

/** Count words; each CJK character counts as one word since those scripts do not use spaces. */
export function countChatWords(text: string): number {
  if (!text) return 0;
  let count = 0;
  WORD_PATTERN.lastIndex = 0;
  while (WORD_PATTERN.exec(text) !== null) count += 1;
  return count;
}

export function parseChatTimestamp(value: unknown): number | null {
  if (typeof value !== "string" || !value) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

/** Local calendar day (YYYY-MM-DD) for a UTC timestamp and a Date#getTimezoneOffset value. */
export function toLocalDayKey(timeMs: number, timezoneOffsetMinutes = 0): string {
  const shifted = new Date(timeMs - timezoneOffsetMinutes * 60_000);
  const year = shifted.getUTCFullYear();
  const month = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const day = String(shifted.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Validate an IANA time zone name ("Europe/Berlin"); null when missing or unknown to this runtime. */
export function normalizeTimeZoneName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 64) return null;
  try {
    return new Intl.DateTimeFormat("en-US", { timeZone: trimmed }).resolvedOptions().timeZone;
  } catch {
    return null;
  }
}

export interface ChatDayZone {
  /** IANA zone. When valid it wins, so days before and after a DST change both land on the right date. */
  timeZone?: string | null;
  /** Fixed Date#getTimezoneOffset fallback for runtimes without the zone. */
  timezoneOffsetMinutes?: number;
}

const OFFSET_BUCKET_MS = 15 * 60_000;

/**
 * Build a timestamp to local YYYY-MM-DD function. With an IANA zone the UTC
 * offset is resolved per timestamp (memoized per 15 minutes, the finest step
 * any zone transitions on), so summer and winter messages both bucket correctly.
 */
export function createLocalDayKeyer(zone: ChatDayZone = {}): (timeMs: number) => string {
  const fixedOffset = zone.timezoneOffsetMinutes ?? 0;
  const timeZone = normalizeTimeZoneName(zone.timeZone);
  if (!timeZone) return (timeMs) => toLocalDayKey(timeMs, fixedOffset);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  });
  const offsets = new Map<number, number>();
  const offsetAt = (timeMs: number): number => {
    const bucket = Math.floor(timeMs / OFFSET_BUCKET_MS);
    const cached = offsets.get(bucket);
    if (cached !== undefined) return cached;
    const instant = bucket * OFFSET_BUCKET_MS;
    const parts: Record<string, number> = {};
    for (const part of formatter.formatToParts(new Date(instant))) {
      if (part.type !== "literal") parts[part.type] = Number(part.value);
    }
    const localAsUtc = Date.UTC(parts.year!, parts.month! - 1, parts.day!, parts.hour! % 24, parts.minute!);
    // Minutes east of UTC; Date#getTimezoneOffset uses the opposite sign.
    const east = Number.isFinite(localAsUtc) ? Math.round((localAsUtc - instant) / 60_000) : -fixedOffset;
    if (offsets.size > 50_000) offsets.clear();
    offsets.set(bucket, east);
    return east;
  };
  return (timeMs) => toLocalDayKey(timeMs, -offsetAt(timeMs));
}

/**
 * Split sorted or unsorted timestamps into sittings. A sitting lasts from its
 * first to its last message, so a lone message adds a sitting but no time.
 */
export function computeChatPlayTime(timestampsMs: readonly number[], gapMs = CHAT_SITTING_GAP_MS): ChatPlayTime {
  const times = timestampsMs.filter((time) => Number.isFinite(time)).sort((left, right) => left - right);
  if (times.length === 0) return { totalMs: 0, sittings: 0, longestSittingMs: 0, gapMs };
  let totalMs = 0;
  let longestSittingMs = 0;
  let sittings = 1;
  let sittingStart = times[0]!;
  let previous = times[0]!;
  for (let index = 1; index < times.length; index += 1) {
    const time = times[index]!;
    if (time - previous > gapMs) {
      const length = previous - sittingStart;
      totalMs += length;
      longestSittingMs = Math.max(longestSittingMs, length);
      sittings += 1;
      sittingStart = time;
    }
    previous = time;
  }
  const last = previous - sittingStart;
  totalMs += last;
  longestSittingMs = Math.max(longestSittingMs, last);
  return { totalMs, sittings, longestSittingMs, gapMs };
}

/** Consecutive-day streaks from a set of YYYY-MM-DD keys, measured against `todayKey`. */
export function computeDayStreaks(dayKeys: Iterable<string>, todayKey: string): { current: number; longest: number } {
  const dayNumber = (key: string) => {
    const time = Date.parse(`${key}T00:00:00Z`);
    return Number.isFinite(time) ? Math.round(time / 86_400_000) : null;
  };
  const days = [...new Set([...dayKeys].map(dayNumber).filter((day): day is number => day !== null))].sort(
    (left, right) => left - right,
  );
  let longest = 0;
  let run = 0;
  let previous: number | null = null;
  for (const day of days) {
    run = previous !== null && day === previous + 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = day;
  }
  const today = dayNumber(todayKey);
  let current = 0;
  if (today !== null && previous !== null && today - previous <= 1) {
    const present = new Set(days);
    let cursor = previous;
    while (present.has(cursor)) {
      current += 1;
      cursor -= 1;
    }
  }
  return { current, longest };
}

function previewText(content: string, maxLength = 160): string {
  const text = content.replace(/\s+/gu, " ").trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 1).trimEnd()}…` : text;
}

function readTokenCount(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

/**
 * Compute stats for one chat. `messages` must already be the visible transcript
 * in chat order; `messageNumbers` optionally maps ids to their /goto numbers.
 */
export function computeChatStats(
  chat: { id: string; name: string },
  messages: readonly ChatStatsMessage[],
  options: ChatStatsOptions & { messageNumbers?: ReadonlyMap<string, number> } = {},
): ChatStats {
  const dayKey = createLocalDayKeyer({
    timeZone: options.timeZone,
    timezoneOffsetMinutes: options.timezoneOffsetMinutes ?? 0,
  });
  const speakers = new Map<string, ChatSpeakerStats>();
  const perDay = new Map<string, number>();
  const timestamps: number[] = [];
  const tokens: ChatTokenTotals = { prompt: 0, completion: 0, total: 0, messagesWithUsage: 0 };
  let totalWords = 0;
  let replyWords = 0;
  let replyCount = 0;
  let userWords = 0;
  let userCount = 0;
  let longest: ChatLongestMessage | null = null;
  let first: number | null = null;
  let last: number | null = null;

  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index]!;
    const words = countChatWords(message.content);
    totalWords += words;
    if (message.role === "user") {
      userWords += words;
      userCount += 1;
    } else if (message.role === "assistant" || message.role === "narrator") {
      replyWords += words;
      replyCount += 1;
    }

    const speaker = speakers.get(message.speakerKey) ?? {
      key: message.speakerKey,
      name: message.speakerName,
      role: message.role,
      messages: 0,
      words: 0,
      averageWords: 0,
      longestWords: 0,
    };
    speaker.messages += 1;
    speaker.words += words;
    speaker.longestWords = Math.max(speaker.longestWords, words);
    speakers.set(message.speakerKey, speaker);

    if (!longest || words > longest.words) {
      longest = {
        messageId: message.id,
        messageNumber: options.messageNumbers?.get(message.id) ?? index + 1,
        speaker: message.speakerName,
        words,
        characters: message.content.length,
        preview: previewText(message.content),
      };
    }

    const prompt = readTokenCount(message.tokensPrompt);
    const completion = readTokenCount(message.tokensCompletion);
    if (prompt !== null || completion !== null) {
      tokens.prompt += prompt ?? 0;
      tokens.completion += completion ?? 0;
      tokens.messagesWithUsage += 1;
    }

    const time = parseChatTimestamp(message.createdAt);
    if (time !== null) {
      timestamps.push(time);
      const key = dayKey(time);
      perDay.set(key, (perDay.get(key) ?? 0) + 1);
      first = first === null ? time : Math.min(first, time);
      last = last === null ? time : Math.max(last, time);
    }
  }
  tokens.total = tokens.prompt + tokens.completion;

  const speakerList = [...speakers.values()]
    .map((speaker) => ({
      ...speaker,
      averageWords: speaker.messages > 0 ? Math.round(speaker.words / speaker.messages) : 0,
    }))
    .sort((left, right) => right.words - left.words || right.messages - left.messages);
  const messagesPerDay: ChatDayCount[] = [...perDay.entries()]
    .map(([date, count]) => ({ date, count }))
    .sort((left, right) => left.date.localeCompare(right.date));

  return {
    chatId: chat.id,
    chatName: chat.name,
    totalMessages: messages.length,
    totalWords,
    averageReplyWords: replyCount > 0 ? Math.round(replyWords / replyCount) : 0,
    averageUserWords: userCount > 0 ? Math.round(userWords / userCount) : 0,
    speakers: speakerList,
    messagesPerDay,
    activeDays: messagesPerDay.length,
    longestMessage: longest,
    tokens,
    playTime: computeChatPlayTime(timestamps, options.gapMs ?? CHAT_SITTING_GAP_MS),
    firstMessageAt: first === null ? null : new Date(first).toISOString(),
    lastMessageAt: last === null ? null : new Date(last).toISOString(),
  };
}
