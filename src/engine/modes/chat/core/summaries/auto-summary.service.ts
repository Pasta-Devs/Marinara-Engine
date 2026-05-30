import type { DaySummaryEntry, WeekSummaryEntry } from "../../../../contracts/types/chat";
import type { LlmGateway, LlmMessage } from "../../../../capabilities/llm";
import type { StorageGateway } from "../../../../capabilities/storage";
import type { BaseLLMProvider } from "../../../../generation-core/llm/base-provider.js";
import { boolish } from "../../../../generation/runtime-records";
import { readString as stringValue } from "../../../../shared/value-readers";
import { stripConversationPromptTimestamps } from "./transcript-sanitize.js";

interface ConversationSummaryMessage {
  id?: string;
  role: string;
  content: string | null;
  characterId?: string | null;
  createdAt?: string | null;
}

interface ConversationSummaryRunResult {
  daySummaries: Record<string, DaySummaryEntry>;
  weekSummaries: Record<string, WeekSummaryEntry>;
  newlyGeneratedDays: Record<string, DaySummaryEntry>;
  newlyConsolidatedWeeks: Record<string, WeekSummaryEntry>;
  failedDays: Array<{ date: string; error: string }>;
  failedWeeks: Array<{ weekKey: string; error: string }>;
  missingDayCount: number;
  processedDayCount: number;
  remainingMissingDayCount: number;
}

export interface ConversationSummaryBackfillResult {
  generatedDays: string[];
  consolidatedWeeks: string[];
  failedDays: Array<{ date: string; error: string }>;
  failedWeeks: Array<{ weekKey: string; error: string }>;
  missingDayCount: number;
  processedDayCount: number;
  remainingMissingDayCount: number;
}

interface ConversationSummaryDayBucket {
  date: string;
  msgs: Array<{ role: string; content: string; author: string; ts: Date }>;
}

interface GenerateMissingConversationSummariesOptions {
  messages: ConversationSummaryMessage[];
  metadata: Record<string, unknown>;
  provider: BaseLLMProvider;
  model: string;
  personaName: string;
  charIdToName: Map<string, string>;
  now?: Date;
  rolloverHour?: number;
  timeoutMs?: number;
  maxMissingDays?: number;
}

interface RunConversationSummaryBackfillInput {
  chatId: string;
  maxMissingDays?: number;
  connectionId?: string | null;
}

const DEFAULT_SUMMARY_TIMEOUT_MS = 300_000;
const DAILY_TRANSCRIPT_CHUNK_CHARS = 32_000;
const MAX_SUMMARY_CHUNKS_PER_DAY = 12;

type JsonRecord = Record<string, unknown>;

function parseRecord(value: unknown): JsonRecord {
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as JsonRecord) : {};
    } catch {
      return {};
    }
  }
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {};
}

function stringArray(value: unknown): string[] {
  if (Array.isArray(value))
    return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return stringArray(parsed);
    } catch {
      return value.trim() ? [value] : [];
    }
  }
  return [];
}

function numberValue(value: unknown, fallback: number): number {
  const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

function extractName(row: JsonRecord | null | undefined, fallback: string): string {
  if (!row) return fallback;
  const direct = stringValue(row.name).trim();
  if (direct) return direct;
  const data = parseRecord(row.data);
  return stringValue(data.name).trim() || fallback;
}

function createSummaryProvider(llm: LlmGateway, connection: JsonRecord): BaseLLMProvider {
  const connectionId = stringValue(connection.id);
  const maxTokensOverrideValue = numberValue(connection.maxTokensOverride, NaN);
  return {
    maxTokensOverrideValue: Number.isFinite(maxTokensOverrideValue) ? maxTokensOverrideValue : null,
    async chatComplete(messages, options) {
      const requestMessages: LlmMessage[] = messages.map((message) => ({
        role:
          message.role === "system" || message.role === "assistant" || message.role === "tool" ? message.role : "user",
        content: String(message.content ?? ""),
        name: message.name,
      }));
      const content = await llm.complete(
        {
          connectionId,
          model: options.model,
          messages: requestMessages,
          parameters: {
            temperature: options.temperature,
            maxTokens: options.maxTokens,
          },
        },
        options.signal,
      );
      return { content };
    },
  };
}

async function resolveSummaryConnection(
  storage: StorageGateway,
  chat: JsonRecord,
  requestedConnectionId?: string | null,
): Promise<JsonRecord> {
  const requested = stringValue(requestedConnectionId).trim();
  if (requested) {
    const connection = await storage.get<JsonRecord>("connections", requested);
    if (!connection) throw new Error("Requested summary connection was not found");
    return connection;
  }
  const chatConnectionId = stringValue(chat.connectionId).trim();
  if (chatConnectionId) {
    const connection = await storage.get<JsonRecord>("connections", chatConnectionId);
    if (!connection) throw new Error("Chat summary connection was not found");
    return connection;
  }
  const connections = await storage.list<JsonRecord>("connections");
  const selected =
    connections.find((connection) => boolish(connection.isDefault, false) || boolish(connection.default, false)) ??
    connections[0];
  if (!selected) throw new Error("No API connection configured for this chat");
  return selected;
}

async function loadScopedMessages(storage: StorageGateway, chatId: string): Promise<ConversationSummaryMessage[]> {
  const rows = await storage.listChatMessages<unknown>(chatId);
  const messages = Array.isArray(rows)
    ? rows.filter((row): row is JsonRecord => !!row && typeof row === "object" && !Array.isArray(row))
    : [];
  let startIndex = 0;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (parseRecord(messages[index]!.extra).isConversationStart === true) {
      startIndex = index;
      break;
    }
  }
  return (startIndex > 0 ? messages.slice(startIndex) : messages).map((message) => ({
    id: stringValue(message.id) || undefined,
    role: stringValue(message.role) || "assistant",
    content: typeof message.content === "string" ? message.content : null,
    characterId: typeof message.characterId === "string" ? message.characterId : null,
    createdAt: typeof message.createdAt === "string" ? message.createdAt : null,
  }));
}

async function loadCharacterNames(storage: StorageGateway, characterIds: string[]): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  for (const characterId of characterIds) {
    const row = await storage.get<JsonRecord>("characters", characterId).catch(() => null);
    names.set(characterId, extractName(row, "Character"));
  }
  return names;
}

async function loadPersonaName(storage: StorageGateway, chat: JsonRecord): Promise<string> {
  const personaId = stringValue(chat.personaId).trim();
  if (personaId) {
    const persona = await storage.get<JsonRecord>("personas", personaId).catch(() => null);
    return extractName(persona, "User");
  }
  const personas = await storage.list<JsonRecord>("personas").catch(() => []);
  return extractName(
    personas.find((persona) => persona.isActive === true || persona.isActive === "true"),
    "User",
  );
}

function coerceSummaryEntry(value: unknown): DaySummaryEntry | null {
  if (typeof value === "string") {
    const summary = value.trim();
    return summary ? { summary, keyDetails: [] } : null;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const summary = typeof record.summary === "string" ? record.summary.trim() : "";
  const keyDetails = Array.isArray(record.keyDetails)
    ? record.keyDetails.filter((detail): detail is string => typeof detail === "string" && detail.trim().length > 0)
    : [];
  return summary || keyDetails.length > 0 ? { summary, keyDetails } : null;
}

function normalizeDaySummaries(raw: unknown): Record<string, DaySummaryEntry> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, DaySummaryEntry> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const entry = coerceSummaryEntry(value);
    if (entry) out[key] = entry;
  }
  return out;
}

function normalizeWeekSummaries(raw: unknown): Record<string, WeekSummaryEntry> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, WeekSummaryEntry> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const entry = coerceSummaryEntry(value);
    if (entry) out[key] = entry;
  }
  return out;
}

function parseConversationDateKey(dateKey: string): Date {
  const [dd, mm, yyyy] = dateKey.split(".");
  return new Date(Number(yyyy), Number(mm) - 1, Number(dd));
}

function formatConversationDateKey(date: Date): string {
  return `${String(date.getDate()).padStart(2, "0")}.${String(date.getMonth() + 1).padStart(2, "0")}.${date.getFullYear()}`;
}

function getConversationWeekMonday(date: Date): Date {
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + diff);
}

function logicalDate(date: Date, rolloverHour: number): Date {
  return new Date(date.getTime() - rolloverHour * 3_600_000);
}

function logicalDateKey(date: Date, rolloverHour: number): string {
  return formatConversationDateKey(logicalDate(date, rolloverHour));
}

function getMessageAuthor(
  message: ConversationSummaryMessage,
  personaName: string,
  charIdToName: Map<string, string>,
): string {
  if (message.role === "user") return personaName;
  if (message.characterId && charIdToName.has(message.characterId)) return charIdToName.get(message.characterId)!;
  if (message.role === "assistant") return "Character";
  if (message.role === "narrator") return "Narrator";
  return "System";
}

function buildDayBuckets(
  messages: ConversationSummaryMessage[],
  personaName: string,
  charIdToName: Map<string, string>,
  rolloverHour: number,
): ConversationSummaryDayBucket[] {
  const buckets = new Map<string, ConversationSummaryDayBucket>();
  for (const message of messages) {
    if (!message.createdAt) continue;
    const createdAt = new Date(message.createdAt);
    if (!Number.isFinite(createdAt.getTime())) continue;
    const content = stripConversationPromptTimestamps((message.content ?? "").trim());
    if (!content) continue;

    const date = logicalDateKey(createdAt, rolloverHour);
    const bucket = buckets.get(date) ?? { date, msgs: [] };
    bucket.msgs.push({
      role: message.role,
      content,
      author: getMessageAuthor(message, personaName, charIdToName),
      ts: createdAt,
    });
    buckets.set(date, bucket);
  }

  return [...buckets.values()].sort(
    (a, b) => parseConversationDateKey(a.date).getTime() - parseConversationDateKey(b.date).getTime(),
  );
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Summary timeout")), ms)),
  ]);
}

function cleanJsonishResponse(raw: string): string {
  const trimmed = raw.trim();
  const fenceMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch) return fenceMatch[1]!.trim();
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first >= 0 && last > first) return trimmed.slice(first, last + 1);
  return trimmed;
}

function parseSummaryResponse(raw: string): DaySummaryEntry {
  const trimmed = raw.trim();
  try {
    const parsed = JSON.parse(cleanJsonishResponse(trimmed)) as Record<string, unknown>;
    return {
      summary: (typeof parsed.summary === "string" ? parsed.summary : trimmed).trim(),
      keyDetails: Array.isArray(parsed.keyDetails)
        ? parsed.keyDetails.filter((detail): detail is string => typeof detail === "string" && detail.trim().length > 0)
        : [],
    };
  } catch {
    return { summary: trimmed, keyDetails: [] };
  }
}

function dailySummarySystemPrompt(date: string, scope: string): string {
  return [
    `You are a conversation memory assistant. You will receive ${scope} DM conversation from ${date}.`,
    `Produce a JSON object with two fields, in this order:`,
    ``,
    `1. "keyDetails" — An array of short, specific strings listing things the characters MUST remember going forward. Include:`,
    `   - Promises or commitments made ("Alice promised to call Bob tomorrow morning")`,
    `   - Plans or appointments ("They agreed to watch a movie together on Friday")`,
    `   - Unresolved questions or topics left hanging ("Bob asked about Alice's job interview — she said she'd tell him later")`,
    `   - Emotional events that would affect future interactions ("Alice confided she's been feeling lonely lately")`,
    `   - New information revealed ("Bob mentioned he has a sister named Clara")`,
    `   - Requests or things someone said they'd do ("Alice said she'd send the recipe")`,
    `   If nothing important needs to be carried forward, use an empty array.`,
    ``,
    `2. "summary" — A few short atmospheric notes (1-3 brief sentences, third person). These are terse field notes, NOT prose — no flourishes, no literary phrasing. The summary is consumed by a weekly summarizer that builds a relational arc, so focus on things that aggregate meaningfully across days:`,
    `   - Setting: when they talked (time of day, how long), where each character was, what they were doing`,
    `   - Physical or emotional state of each character during the talk ("Alice was sleepy in bed the whole time", "Bob was buzzing with excitement")`,
    `   - Tonal register and how it shifted ("started playful, turned tender when he opened up")`,
    `   - The character of events as experienced ("heated argument about boundaries", "quiet check-in", "rapid-fire flirting")`,
    `   Do NOT restate items already in keyDetails — the summary's job is the felt experience AROUND the facts, not the facts themselves.`,
    `   Avoid: "A buoyant exchange where the energy bloomed from initial pleasantries into a tender celebration."`,
    `   Prefer: "Buoyant evening chat. Mood warm throughout, lots of mutual hype."`,
    `   If the day was uneventful, a single sentence is fine.`,
    ``,
    `Respond with ONLY valid JSON. No markdown fences, no extra text.`,
    `Example: { "keyDetails": ["Alice promised to send Bob the recipe for pasta", "They planned to meet for coffee on Saturday", "Alice mentioned her sister Clara is visiting next week"], "summary": "Evening chat after work. Bob still at the office, Alice in pajamas at home. Warm and easy throughout, Alice tired by the end but in good spirits." }`,
  ].join("\n");
}

function chunkTranscriptLines(lines: string[], maxChars: number): string[] {
  const chunks: string[] = [];
  let current = "";
  for (const line of lines) {
    const next = current ? `${current}\n${line}` : line;
    if (next.length > maxChars && current) {
      chunks.push(current);
      current = line;
    } else {
      current = next;
    }
  }
  if (current) chunks.push(current);
  return chunks.slice(0, MAX_SUMMARY_CHUNKS_PER_DAY);
}

async function summarizeTranscript(
  provider: BaseLLMProvider,
  model: string,
  systemPrompt: string,
  userContent: string,
  timeoutMs: number,
  maxTokens = 4096,
): Promise<DaySummaryEntry> {
  const result = await withTimeout(
    provider.chatComplete(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      { model, temperature: 0.3, maxTokens },
    ),
    timeoutMs,
  );
  return parseSummaryResponse(result.content ?? "");
}

async function summarizeDayBucket(
  provider: BaseLLMProvider,
  model: string,
  bucket: ConversationSummaryDayBucket,
  timeoutMs: number,
): Promise<DaySummaryEntry> {
  const transcriptLines = bucket.msgs.map((message) => `${message.author}: ${message.content}`);
  const chunks = chunkTranscriptLines(transcriptLines, DAILY_TRANSCRIPT_CHUNK_CHARS);

  if (chunks.length <= 1) {
    return summarizeTranscript(
      provider,
      model,
      dailySummarySystemPrompt(bucket.date, "a full day's"),
      chunks[0] ?? "",
      timeoutMs,
    );
  }

  const partials: DaySummaryEntry[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const partial = await summarizeTranscript(
      provider,
      model,
      dailySummarySystemPrompt(bucket.date, `part ${i + 1} of ${chunks.length} of a long day's`),
      chunks[i]!,
      timeoutMs,
      2048,
    );
    if (partial.summary || partial.keyDetails.length > 0) partials.push(partial);
  }

  const combinedInput = partials
    .map((entry, index) => {
      const keyDetails = entry.keyDetails.length > 0 ? `\nKey details: ${entry.keyDetails.join("; ")}` : "";
      return `[Part ${index + 1}]\n${entry.summary}${keyDetails}`;
    })
    .join("\n\n");

  return summarizeTranscript(
    provider,
    model,
    [
      `You are a conversation memory assistant. You will receive partial summaries for ${bucket.date}.`,
      `Combine them into one final JSON object with "summary" and "keyDetails".`,
      `Remove duplicates, preserve unresolved promises/plans, and keep only durable details that matter later.`,
      `Respond with ONLY valid JSON. No markdown fences, no extra text.`,
    ].join("\n"),
    combinedInput,
    timeoutMs,
  );
}

function weekSummarySystemPrompt(rangeLabel: string): string {
  return [
    `You are a conversation memory assistant. You will receive a week's worth of daily entries (date, terse atmospheric notes, key facts) for the week of ${rangeLabel}.`,
    `Produce a JSON object with two fields, in this order:`,
    ``,
    `1. "keyDetails" — A consolidated array of short, specific strings listing things the characters MUST still remember going forward. Review the daily key details and:`,
    `   - KEEP details that are still relevant (upcoming plans, ongoing commitments, unresolved topics)`,
    `   - MERGE duplicates or evolving items into their latest state`,
    `   - DROP details that were already resolved during the week (e.g. "promised to send recipe" if it was sent later that week)`,
    `   - ADD any overarching patterns or relationship developments worth remembering`,
    ``,
    `2. "summary" — A few terse atmospheric notes (3-5 brief sentences, third person) capturing the week's ARC, not its events. These are field notes, NOT prose — no flourishes, no literary phrasing. The daily entries already cover what felt like what each day; your job is to find the shape across them. Focus on:`,
    `   - Tonal evolution across the week ("started distant, warmed up by Wednesday")`,
    `   - Recurring patterns or rhythms ("late-night chats most evenings", "she kept circling back to her recordings")`,
    `   - Relationship developments worth remembering ("noticeably more openly affectionate by week's end")`,
    `   - Significant emotional shifts or turning points`,
    `   Do NOT restate items already in keyDetails — the summary's job is the felt arc AROUND the facts, not the facts themselves. Do not chronicle "Monday they did X, Tuesday they did Y" — that's a list, not an arc.`,
    `   Avoid: "The week unfolded as a tender progression from initial pleasantries into deeply intimate confessions, with their bond visibly deepening."`,
    `   Prefer: "Mostly late-evening chats. Tone shifted from playful to tender mid-week after a vulnerable confession. Both more openly affectionate by Sunday."`,
    ``,
    `Respond with ONLY valid JSON. No markdown fences, no extra text.`,
    `Example: { "keyDetails": ["Alice's sister Clara visiting next weekend", "Bob still off alcohol after the tequila incidents", "They agreed to weekend plans on Saturday"], "summary": "Mostly late-evening chats, often past midnight. Alice leaning on him through some recurring work doubts. Tone shifted from playful to tender mid-week after a vulnerable confession. Both more openly affectionate by Sunday." }`,
  ].join("\n");
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function generateMissingConversationSummaries(
  options: GenerateMissingConversationSummariesOptions,
): Promise<ConversationSummaryRunResult> {
  const rolloverHour = Math.max(0, Math.min(11, Math.floor(options.rolloverHour ?? 4)));
  const timeoutMs = options.timeoutMs ?? DEFAULT_SUMMARY_TIMEOUT_MS;
  const now = options.now ?? new Date();
  const todayDateKey = logicalDateKey(now, rolloverHour);
  const daySummaries = normalizeDaySummaries(options.metadata.daySummaries);
  const weekSummaries = normalizeWeekSummaries(options.metadata.weekSummaries);

  const buckets = buildDayBuckets(options.messages, options.personaName, options.charIdToName, rolloverHour);
  const pastBuckets = buckets.filter((bucket) => bucket.date !== todayDateKey);
  const missingBuckets = pastBuckets.filter((bucket) => !daySummaries[bucket.date]);
  const maxMissingDays =
    typeof options.maxMissingDays === "number" && Number.isFinite(options.maxMissingDays)
      ? Math.max(0, Math.floor(options.maxMissingDays))
      : missingBuckets.length;
  const bucketsToProcess = missingBuckets.slice(0, maxMissingDays);

  const newlyGeneratedDays: Record<string, DaySummaryEntry> = {};
  const newlyConsolidatedWeeks: Record<string, WeekSummaryEntry> = {};
  const failedDays: Array<{ date: string; error: string }> = [];
  const failedWeeks: Array<{ weekKey: string; error: string }> = [];

  for (const bucket of bucketsToProcess) {
    try {
      const entry = await summarizeDayBucket(options.provider, options.model, bucket, timeoutMs);
      if (entry.summary || entry.keyDetails.length > 0) {
        daySummaries[bucket.date] = entry;
        newlyGeneratedDays[bucket.date] = entry;
      }
    } catch (error) {
      failedDays.push({ date: bucket.date, error: errorMessage(error) });
    }
  }

  const messageDaysByWeek = new Map<string, Set<string>>();
  for (const bucket of pastBuckets) {
    const weekKey = formatConversationDateKey(getConversationWeekMonday(parseConversationDateKey(bucket.date)));
    const set = messageDaysByWeek.get(weekKey) ?? new Set<string>();
    set.add(bucket.date);
    messageDaysByWeek.set(weekKey, set);
  }

  const daysByWeek = new Map<string, Array<{ dateKey: string; entry: DaySummaryEntry }>>();
  for (const [dateKey, entry] of Object.entries(daySummaries)) {
    const weekKey = formatConversationDateKey(getConversationWeekMonday(parseConversationDateKey(dateKey)));
    const days = daysByWeek.get(weekKey) ?? [];
    days.push({ dateKey, entry });
    daysByWeek.set(weekKey, days);
  }

  for (const [weekKey, days] of daysByWeek) {
    if (weekSummaries[weekKey]) continue;
    const monday = parseConversationDateKey(weekKey);
    const nextMonday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 7);
    if (logicalDate(now, rolloverHour).getTime() < nextMonday.getTime()) continue;

    const messageDays = messageDaysByWeek.get(weekKey);
    if (messageDays && [...messageDays].some((dateKey) => !daySummaries[dateKey])) continue;

    try {
      days.sort(
        (a, b) => parseConversationDateKey(a.dateKey).getTime() - parseConversationDateKey(b.dateKey).getTime(),
      );
      const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
      const rangeLabel = `${weekKey} – ${formatConversationDateKey(sunday)}`;
      const dayBlocks = days.map((day) => {
        const keyDetails = day.entry.keyDetails.length > 0 ? `\nKey details: ${day.entry.keyDetails.join("; ")}` : "";
        return `[${day.dateKey}]\n${day.entry.summary}${keyDetails}`;
      });
      const entry = await summarizeTranscript(
        options.provider,
        options.model,
        weekSummarySystemPrompt(rangeLabel),
        dayBlocks.join("\n\n"),
        timeoutMs,
      );
      if (entry.summary || entry.keyDetails.length > 0) {
        weekSummaries[weekKey] = entry;
        newlyConsolidatedWeeks[weekKey] = entry;
      }
    } catch (error) {
      failedWeeks.push({ weekKey, error: errorMessage(error) });
    }
  }

  return {
    daySummaries,
    weekSummaries,
    newlyGeneratedDays,
    newlyConsolidatedWeeks,
    failedDays,
    failedWeeks,
    missingDayCount: missingBuckets.length,
    processedDayCount: bucketsToProcess.length,
    remainingMissingDayCount: Math.max(0, missingBuckets.length - bucketsToProcess.length),
  };
}

export async function backfillConversationSummaries(
  capabilities: { storage: StorageGateway; llm: LlmGateway },
  input: RunConversationSummaryBackfillInput,
): Promise<ConversationSummaryBackfillResult> {
  const chat = await capabilities.storage.get<JsonRecord>("chats", input.chatId);
  if (!chat) throw new Error("Chat not found");
  if (chat.mode !== "conversation") {
    return {
      generatedDays: [],
      consolidatedWeeks: [],
      failedDays: [],
      failedWeeks: [],
      missingDayCount: 0,
      processedDayCount: 0,
      remainingMissingDayCount: 0,
    };
  }

  const metadata = parseRecord(chat.metadata);
  const maxMissingDays = Math.max(1, Math.min(60, Math.floor(numberValue(input.maxMissingDays, 14))));
  const connection = await resolveSummaryConnection(capabilities.storage, chat, input.connectionId);
  const characterIds = stringArray(chat.characterIds);
  const result = await generateMissingConversationSummaries({
    messages: await loadScopedMessages(capabilities.storage, input.chatId),
    metadata,
    provider: createSummaryProvider(capabilities.llm, connection),
    model: stringValue(connection.model),
    personaName: await loadPersonaName(capabilities.storage, chat),
    charIdToName: await loadCharacterNames(capabilities.storage, characterIds),
    rolloverHour: Math.max(0, Math.min(11, Math.floor(numberValue(metadata.dayRolloverHour, 4)))),
    maxMissingDays,
  });

  if (Object.keys(result.newlyGeneratedDays).length > 0 || Object.keys(result.newlyConsolidatedWeeks).length > 0) {
    await capabilities.storage.patchChatSummaries(input.chatId, {
      daySummaries: result.newlyGeneratedDays,
      weekSummaries: result.newlyConsolidatedWeeks,
    });
  }

  return {
    generatedDays: Object.keys(result.newlyGeneratedDays),
    consolidatedWeeks: Object.keys(result.newlyConsolidatedWeeks),
    failedDays: result.failedDays,
    failedWeeks: result.failedWeeks,
    missingDayCount: result.missingDayCount,
    processedDayCount: result.processedDayCount,
    remainingMissingDayCount: result.remainingMissingDayCount,
  };
}
