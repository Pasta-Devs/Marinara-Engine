import type { WrapFormat } from "@marinara-engine/shared";
import { normalizeTextForMatch, stripLeadingMessageTimestamps } from "@marinara-engine/shared";

import { logger } from "../../lib/logger.js";
import {
  formatConversationDateKey,
  generateMissingConversationSummaries,
  parseConversationDateKey,
} from "../../services/conversation/auto-summary.service.js";
import { stripConversationPromptTimestamps } from "../../services/conversation/transcript-sanitize.js";
import {
  formatZonedConversationDate,
  formatZonedConversationTime,
  isSameZonedLogicalDay,
} from "../../services/conversation/timezone.js";
import { formatConversationPromptTurn } from "../../services/generation/generation-text-utils.js";
import type { GenerationPromptMessage } from "../../services/generation/prompt-message-scope.js";
import {
  withConnectionFallbackProvider,
  type FallbackConnection,
} from "../../services/llm/connection-fallback-provider.js";
import type { BaseLLMProvider } from "../../services/llm/base-provider.js";
import { createLLMProvider } from "../../services/llm/provider-registry.js";
import { wrapContent } from "../../services/prompt/format-engine.js";
import { annotateContentWithReactions, REACTION_ANNOTATION_CONTENT_CAP } from "./conversation-custom-assets.js";
import {
  formatConversationDateHistoryMessages,
  formatConversationSummaryHistoryBlock,
} from "./conversation-prompt-formatting.js";
import { parseExtra } from "./generate-route-utils.js";

type ConversationHistoryMessage = {
  id?: unknown;
  role?: string | null;
  content?: unknown;
  characterId?: unknown;
  createdAt?: unknown;
  extra?: unknown;
};

type ConversationHistoryCharacterStore = {
  getById(id: string): Promise<{ data?: unknown } | null>;
};

type ConversationHistoryChatsStore = {
  patchMetadata(
    chatId: string,
    updater: (freshMeta: Record<string, unknown>) => Record<string, unknown>,
  ): Promise<unknown>;
};

type ConversationSummaryConnection = {
  provider: string;
  apiKey: string;
  model: string;
  maxContext?: number | null;
  openrouterProvider?: string | null;
  maxTokensOverride?: number | null;
};

type BucketMsg = { role: string; content: string; author: string; ts: Date };
type Bucket = { date: string; msgs: BucketMsg[] };

export type ConversationMembershipHistoryEvent = "joined" | "left";

export function resolveConversationMembershipHistoryEvent(
  message: ConversationHistoryMessage | null | undefined,
): ConversationMembershipHistoryEvent | null {
  if (!message) return null;
  const taggedEvent = parseExtra(message.extra).conversationMembershipEvent;
  if (taggedEvent === "joined" || taggedEvent === "left") return taggedEvent;
  if (message.role !== "system" && message.role !== "narrator") return null;
  const content = typeof message.content === "string" ? message.content.trim() : "";
  const legacyMatch = content.match(/\bhas (joined|left) the chat\.\s*$/u);
  return legacyMatch?.[1] === "joined" || legacyMatch?.[1] === "left" ? legacyMatch[1] : null;
}

function hasTaggedConversationMembershipEvent(message: ConversationHistoryMessage | null | undefined): boolean {
  const taggedEvent = parseExtra(message?.extra).conversationMembershipEvent;
  return taggedEvent === "joined" || taggedEvent === "left";
}

export async function prepareConversationPromptHistory(args: {
  finalMessages: GenerationPromptMessage[];
  chatMessages: ConversationHistoryMessage[];
  scopedMessages: ConversationHistoryMessage[];
  regenerateMessageId?: string | null;
  chatMeta: Record<string, unknown>;
  chatId: string;
  chats: ConversationHistoryChatsStore;
  chars: ConversationHistoryCharacterStore;
  characterIds: string[];
  allCharacterIds: string[];
  convoCharInfo: Array<{ name: string }>;
  convoCharNames: string[];
  personaName: string;
  nowInstant: Date;
  promptTimeZone?: string;
  wrapFormat: WrapFormat;
  connection: ConversationSummaryConnection;
  connectionId: string;
  baseUrl: string;
  fallbackConnection?: FallbackConnection | null;
  fallbackBaseUrl?: string;
}): Promise<{ finalMessages: GenerationPromptMessage[]; importantMemoryBlock: string | null }> {
  const rolloverHour = Math.max(
    0,
    Math.min(11, Math.floor((args.chatMeta.dayRolloverHour as number | undefined) ?? 4)),
  );
  const isSameDay = (ts: Date) => isSameZonedLogicalDay(ts, args.nowInstant, args.promptTimeZone, rolloverHour);
  const fmtDate = (ts: Date) => formatZonedConversationDate(ts, args.promptTimeZone, rolloverHour);
  const todayDateKey = fmtDate(args.nowInstant);
  const fmtTime = (ts: Date) => formatZonedConversationTime(ts, args.promptTimeZone);

  const charIdToName = new Map<string, string>();
  for (let ci = 0; ci < args.characterIds.length; ci++) {
    if (args.convoCharInfo[ci]) charIdToName.set(args.characterIds[ci]!, args.convoCharInfo[ci]!.name);
  }

  let finalMessages = await annotateConversationPromptReactions({
    finalMessages: args.finalMessages,
    chatMessages: args.chatMessages,
    charIdToName,
    allCharacterIds: args.allCharacterIds,
    chars: args.chars,
    personaName: args.personaName,
  });

  const historyBuckets = bucketConversationHistory({
    finalMessages,
    chatMessages: args.chatMessages,
    charIdToName,
    convoCharNames: args.convoCharNames,
    personaName: args.personaName,
    isSameDay,
    fmtDate,
    fmtTime,
  });
  const buckets = historyBuckets.buckets;

  const parseDateKey = parseConversationDateKey;
  const fmtDateKey = formatConversationDateKey;
  const unfilteredSummarySourceMessages = args.regenerateMessageId
    ? args.scopedMessages.filter((message) => message.id !== args.regenerateMessageId)
    : args.scopedMessages;
  const firstSummaryConversationTurnIndex = unfilteredSummarySourceMessages.findIndex(
    (message) => message.role === "user" || message.role === "assistant",
  );
  const summarySourceMessages = unfilteredSummarySourceMessages.filter(
    (message, index) =>
      !(
        resolveConversationMembershipHistoryEvent(message) !== null &&
        !hasTaggedConversationMembershipEvent(message) &&
        (firstSummaryConversationTurnIndex < 0 || index < firstSummaryConversationTurnIndex)
      ),
  );
  const summaryProvider: BaseLLMProvider = withConnectionFallbackProvider({
    primary: createLLMProvider(
      args.connection.provider,
      args.baseUrl,
      args.connection.apiKey,
      args.connection.maxContext,
      args.connection.openrouterProvider,
      args.connection.maxTokensOverride,
    ),
    primaryConnectionId: args.connectionId,
    fallbackConnection: args.fallbackConnection,
    fallbackBaseUrl: args.fallbackBaseUrl ?? "",
    category: "agents",
  });
  const summaryRun = await generateMissingConversationSummaries({
    messages: summarySourceMessages.map((message) => ({
      id: typeof message.id === "string" ? message.id : undefined,
      role: String(message.role ?? ""),
      content: typeof message.content === "string" ? message.content : String(message.content ?? ""),
      characterId: typeof message.characterId === "string" ? message.characterId : null,
      createdAt: typeof message.createdAt === "string" ? message.createdAt : null,
    })),
    metadata: args.chatMeta,
    provider: summaryProvider,
    model: args.connection.model,
    personaName: args.personaName,
    charIdToName,
    now: args.nowInstant,
    rolloverHour,
    timeZone: args.promptTimeZone,
    maxMissingDays: 2,
  });

  for (const failure of summaryRun.failedDays) {
    logger.warn(
      { chatId: args.chatId, date: failure.date, err: failure.error },
      "[conversation-summary] failed to generate day summary",
    );
  }
  for (const failure of summaryRun.failedWeeks) {
    logger.warn(
      { chatId: args.chatId, weekKey: failure.weekKey, err: failure.error },
      "[conversation-summary] failed to consolidate week summary",
    );
  }

  const hasNewSummaries =
    Object.keys(summaryRun.newlyGeneratedDays).length > 0 || Object.keys(summaryRun.newlyConsolidatedWeeks).length > 0;
  if (hasNewSummaries || summaryRun.summaryFailureMetadataChanged) {
    await args.chats.patchMetadata(args.chatId, (freshMeta) => {
      const existingDaySummaries = (freshMeta.daySummaries as Record<string, unknown> | undefined) ?? {};
      const existingWeekSummaries = (freshMeta.weekSummaries as Record<string, unknown> | undefined) ?? {};
      return {
        ...freshMeta,
        daySummaries: { ...existingDaySummaries, ...summaryRun.newlyGeneratedDays },
        weekSummaries: { ...existingWeekSummaries, ...summaryRun.newlyConsolidatedWeeks },
        conversationSummaryFailures: summaryRun.summaryFailures,
      };
    });
    args.chatMeta.daySummaries = {
      ...((args.chatMeta.daySummaries as Record<string, unknown> | undefined) ?? {}),
      ...summaryRun.newlyGeneratedDays,
    };
    args.chatMeta.weekSummaries = {
      ...((args.chatMeta.weekSummaries as Record<string, unknown> | undefined) ?? {}),
      ...summaryRun.newlyConsolidatedWeeks,
    };
    args.chatMeta.conversationSummaryFailures = summaryRun.summaryFailures;
  }

  const daySummaries = summaryRun.daySummaries;
  const weekSummaries = summaryRun.weekSummaries;
  const dayToWeek = new Map<string, string>();
  for (const [weekKey] of Object.entries(weekSummaries)) {
    const monday = parseDateKey(weekKey);
    for (let i = 0; i < 7; i++) {
      const day = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
      dayToWeek.set(fmtDateKey(day), weekKey);
    }
  }

  const allKeyDetails = collectConversationKeyDetails({
    daySummaries,
    weekSummaries,
    dayToWeek,
    parseDateKey,
    fmtDateKey,
  });

  const tailCount = Math.max(
    0,
    Math.min(50, Math.floor((args.chatMeta.summaryTailMessages as number | undefined) ?? 10)),
  );
  const tailEntries = collectConversationSummaryTail({
    buckets,
    tailCount,
    todayDateKey,
    daySummaries,
  });

  finalMessages = flattenConversationHistoryBuckets({
    buckets,
    tailEntries,
    firstTodayIdx: historyBuckets.firstTodayIdx,
    daySummaries,
    weekSummaries,
    dayToWeek,
    parseDateKey,
    fmtDateKey,
    promptTimeZone: args.promptTimeZone,
    personaName: args.personaName,
    wrapFormat: args.wrapFormat,
  });

  const importantMemoryBlock = formatConversationImportantMemoryBlock(allKeyDetails, args.wrapFormat);
  return { finalMessages, importantMemoryBlock };
}

async function annotateConversationPromptReactions(args: {
  finalMessages: GenerationPromptMessage[];
  chatMessages: ConversationHistoryMessage[];
  charIdToName: Map<string, string>;
  allCharacterIds: string[];
  chars: ConversationHistoryCharacterStore;
  personaName: string;
}): Promise<GenerationPromptMessage[]> {
  const anyReactedMessage = args.chatMessages.some((message) => {
    const reactions = parseExtra(message.extra).reactions;
    return Array.isArray(reactions) && reactions.length > 0;
  });
  if (!anyReactedMessage) return args.finalMessages;

  const reactionNameById = new Map(args.charIdToName);
  const reactionSpeakersByNorm = new Map<string, string>();
  const addReactionSpeaker = (name: unknown) => {
    if (typeof name !== "string") return;
    const norm = normalizeTextForMatch(name);
    const canonical = name.replace(/\s+/g, " ").trim();
    if (norm && canonical && !reactionSpeakersByNorm.has(norm)) reactionSpeakersByNorm.set(norm, canonical);
  };
  for (const name of args.charIdToName.values()) addReactionSpeaker(name);
  const extraSpeakerIds = new Set<string>();
  for (const cid of args.allCharacterIds) if (!args.charIdToName.has(cid)) extraSpeakerIds.add(cid);
  for (const message of args.chatMessages) {
    const cid = message.characterId;
    if (typeof cid === "string" && cid && !args.charIdToName.has(cid)) extraSpeakerIds.add(cid);
  }
  for (const cid of extraSpeakerIds) {
    const row = await args.chars.getById(cid);
    if (!row) continue;
    try {
      const data = typeof row.data === "string" ? JSON.parse(row.data) : row.data;
      const name = (data as { name?: unknown } | null)?.name;
      if (typeof name === "string" && name.trim()) {
        reactionNameById.set(cid, name);
        addReactionSpeaker(name);
      }
    } catch {
      // Malformed character data — skip; that speaker just won't be attributable.
    }
  }

  const rawMessagesById = new Map<string, ConversationHistoryMessage>();
  for (const message of args.chatMessages) {
    if (typeof message.id === "string") rawMessagesById.set(message.id, message);
  }

  const reactorDisplayName = (reactorId: string): string =>
    reactorId === "user" ? args.personaName : (args.charIdToName.get(reactorId) ?? "a character");
  return args.finalMessages.map((message) => {
    const promptMsgId = (message as { id?: unknown }).id;
    const raw = typeof promptMsgId === "string" ? rawMessagesById.get(promptMsgId) : undefined;
    if (!raw) return message;

    const rawContentStr = typeof raw.content === "string" ? raw.content : String(raw.content ?? "");
    return {
      ...message,
      content: annotateContentWithReactions(
        message.content,
        rawContentStr.length > REACTION_ANNOTATION_CONTENT_CAP
          ? rawContentStr
          : stripLeadingMessageTimestamps(rawContentStr),
        parseExtra(raw.extra).reactions,
        reactionSpeakersByNorm,
        reactorDisplayName,
        typeof raw.characterId === "string" ? (reactionNameById.get(raw.characterId) ?? null) : null,
      ),
    };
  });
}

function bucketConversationHistory(args: {
  finalMessages: GenerationPromptMessage[];
  chatMessages: ConversationHistoryMessage[];
  charIdToName: Map<string, string>;
  convoCharNames: string[];
  personaName: string;
  isSameDay: (date: Date) => boolean;
  fmtDate: (date: Date) => string;
  fmtTime: (date: Date) => string;
}): { buckets: Array<Bucket | GenerationPromptMessage>; firstTodayIdx: number | null } {
  const buckets: Array<Bucket | GenerationPromptMessage> = [];
  let currentBucket: Bucket | null = null;
  let firstTodayIdx: number | null = null;
  const firstConversationTurnIndex = args.chatMessages.findIndex(
    (message) => message.role === "user" || message.role === "assistant",
  );

  for (let i = 0; i < args.finalMessages.length; i++) {
    const msg = args.finalMessages[i]!;
    const raw = args.chatMessages[i];
    const membershipEvent = resolveConversationMembershipHistoryEvent(raw);
    const isLegacySetupMembershipEvent =
      membershipEvent !== null &&
      !hasTaggedConversationMembershipEvent(raw) &&
      (firstConversationTurnIndex < 0 || i < firstConversationTurnIndex);
    if (isLegacySetupMembershipEvent) continue;
    const narratorTimestamp = raw?.role === "narrator" && raw.createdAt ? new Date(raw.createdAt as string) : null;
    const isPastNarratorHistory =
      msg.role === "system" &&
      narratorTimestamp !== null &&
      Number.isFinite(narratorTimestamp.getTime()) &&
      !args.isSameDay(narratorTimestamp);
    if (!raw?.createdAt || (msg.role === "system" && !isPastNarratorHistory && membershipEvent === null)) {
      if (currentBucket) {
        buckets.push(currentBucket);
        currentBucket = null;
      }
      buckets.push(msg);
      continue;
    }

    const ts = new Date(raw.createdAt as string);
    let author = "Character";
    if (membershipEvent !== null) author = "System";
    else if (raw.role === "narrator") author = "Narrator";
    else if (msg.role === "user") author = args.personaName;
    else {
      author =
        (raw.characterId ? args.charIdToName.get(raw.characterId as string) : null) ??
        args.convoCharNames[0] ??
        "Character";
    }

    if (args.isSameDay(ts)) {
      if (currentBucket) {
        buckets.push(currentBucket);
        currentBucket = null;
      }
      if (firstTodayIdx === null) firstTodayIdx = buckets.length;
      const promptContent = formatConversationPromptTurn(
        stripConversationPromptTimestamps(msg.content),
        msg.role,
        args.personaName,
        msg.role === "assistant" ? author : null,
      );
      buckets.push({
        ...msg,
        role: membershipEvent !== null ? "user" : msg.role,
        content: `[${args.fmtTime(ts)}] ${promptContent}`,
      });
      continue;
    }

    const dateKey = args.fmtDate(ts);
    const bucketMessage = {
      ...msg,
      role: membershipEvent !== null ? "user" : msg.role,
      content: stripConversationPromptTimestamps(msg.content),
      author,
      ts,
    };
    if (currentBucket && currentBucket.date === dateKey) {
      currentBucket.msgs.push(bucketMessage);
    } else {
      if (currentBucket) buckets.push(currentBucket);
      currentBucket = { date: dateKey, msgs: [bucketMessage] };
    }
  }

  if (currentBucket) buckets.push(currentBucket);
  return { buckets, firstTodayIdx };
}

function collectConversationKeyDetails(args: {
  daySummaries: Record<string, { keyDetails: string[] }>;
  weekSummaries: Record<string, { keyDetails: string[] }>;
  dayToWeek: Map<string, string>;
  parseDateKey: (date: string) => Date;
  fmtDateKey: (date: Date) => string;
}): Array<{ label: string; details: string[] }> {
  const allKeyDetails: { label: string; details: string[] }[] = [];
  const sortedWeekKeys = Object.keys(args.weekSummaries).sort(
    (a, b) => args.parseDateKey(a).getTime() - args.parseDateKey(b).getTime(),
  );
  for (const wk of sortedWeekKeys) {
    const entry = args.weekSummaries[wk]!;
    if (entry.keyDetails.length > 0) {
      const monday = args.parseDateKey(wk);
      const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
      allKeyDetails.push({
        label: `Week of ${wk} – ${args.fmtDateKey(sunday)}`,
        details: entry.keyDetails,
      });
    }
  }
  for (const [date, entry] of Object.entries(args.daySummaries)) {
    if (args.dayToWeek.has(date)) continue;
    if (entry.keyDetails.length > 0) allKeyDetails.push({ label: date, details: entry.keyDetails });
  }
  return allKeyDetails;
}

function collectConversationSummaryTail(args: {
  buckets: Array<Bucket | GenerationPromptMessage>;
  tailCount: number;
  todayDateKey: string;
  daySummaries: Record<string, unknown>;
}): BucketMsg[] {
  const tailEntries: BucketMsg[] = [];
  if (args.tailCount <= 0) return tailEntries;

  outer: for (let bi = args.buckets.length - 1; bi >= 0; bi--) {
    const bucket = args.buckets[bi]!;
    if (!("date" in bucket && "msgs" in bucket)) continue;
    if (bucket.date === args.todayDateKey) continue;
    if (!args.daySummaries[bucket.date]) continue;
    for (let mi = bucket.msgs.length - 1; mi >= 0; mi--) {
      const message = bucket.msgs[mi]!;
      // Timestamped narrator messages (including concluded scene summaries) are represented as
      // system-role history. Once their day is summarized, do not resurrect those generated blocks
      // through the verbatim conversation tail; keep filling the tail with real conversation turns.
      if (message.role === "system") continue;
      tailEntries.unshift(message);
      if (tailEntries.length >= args.tailCount) break outer;
    }
  }
  return tailEntries;
}

function flattenConversationHistoryBuckets(args: {
  buckets: Array<Bucket | GenerationPromptMessage>;
  tailEntries: BucketMsg[];
  firstTodayIdx: number | null;
  daySummaries: Record<string, { summary: string }>;
  weekSummaries: Record<string, { summary: string }>;
  dayToWeek: Map<string, string>;
  parseDateKey: (date: string) => Date;
  fmtDateKey: (date: Date) => string;
  promptTimeZone?: string;
  personaName: string;
  wrapFormat: WrapFormat;
}): GenerationPromptMessage[] {
  const weekBlocksEmitted = new Set<string>();
  const fmtTailPrefix = (ts: Date) => {
    const date = formatZonedConversationDate(ts, args.promptTimeZone).slice(0, 5);
    return `[${date} ${formatZonedConversationTime(ts, args.promptTimeZone)}]`;
  };
  const buildTailTurns = (): GenerationPromptMessage[] =>
    args.tailEntries.map((message) => ({
      role: message.role as "user" | "assistant" | "system",
      content: `${fmtTailPrefix(message.ts)} ${formatConversationPromptTurn(
        message.content,
        message.role,
        args.personaName,
        message.role === "assistant" ? message.author : null,
      )}`,
    }));

  const finalMessages = args.buckets.flatMap((bucket, bucketIndex): GenerationPromptMessage[] => {
    const prefix = bucketIndex === args.firstTodayIdx ? buildTailTurns() : [];

    if ("date" in bucket && "msgs" in bucket) {
      const weekKey = args.dayToWeek.get(bucket.date);
      if (weekKey && args.weekSummaries[weekKey]) {
        if (weekBlocksEmitted.has(weekKey)) return prefix;
        weekBlocksEmitted.add(weekKey);
        const weekEntry = args.weekSummaries[weekKey]!;
        const monday = args.parseDateKey(weekKey);
        const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
        return [
          ...prefix,
          {
            role: "system",
            content: formatConversationSummaryHistoryBlock(
              `week="${weekKey} – ${args.fmtDateKey(sunday)}"`,
              weekEntry.summary,
              args.wrapFormat,
            ),
          },
        ];
      }

      const dayEntry = args.daySummaries[bucket.date];
      if (dayEntry) {
        return [
          ...prefix,
          {
            role: "system",
            content: formatConversationSummaryHistoryBlock(`date="${bucket.date}"`, dayEntry.summary, args.wrapFormat),
          },
        ];
      }

      const turns = formatConversationDateHistoryMessages(
        bucket.msgs.map((message) => ({
          role: message.role as "user" | "assistant" | "system",
          author: message.author,
          content: message.content,
        })),
        bucket.date,
        args.wrapFormat,
      );
      return [...prefix, ...turns];
    }
    return [...prefix, bucket];
  });

  if (args.firstTodayIdx === null && args.tailEntries.length > 0) {
    return [...finalMessages, ...buildTailTurns()];
  }
  return finalMessages;
}

function formatConversationImportantMemoryBlock(
  allKeyDetails: Array<{ label: string; details: string[] }>,
  wrapFormat: WrapFormat,
): string | null {
  if (allKeyDetails.length === 0) return null;
  allKeyDetails.sort((a, b) => {
    const extractDate = (label: string) => {
      const match = label.match(/(\d{2}\.\d{2}\.\d{4})/);
      return match ? parseConversationDateKey(match[1]!).getTime() : 0;
    };
    return extractDate(a.label) - extractDate(b.label);
  });
  const memoryLines = [`Things you must remember from past conversations:`];
  for (const { label, details } of allKeyDetails) {
    memoryLines.push(`[${label}]`);
    for (const detail of details) memoryLines.push(`- ${detail}`);
  }
  return wrapContent(memoryLines.join("\n"), "Important Memories", wrapFormat);
}
