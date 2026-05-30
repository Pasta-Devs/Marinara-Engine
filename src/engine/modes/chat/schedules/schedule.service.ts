import type { LlmGateway, LlmMessage } from "../../../capabilities/llm";
import type { StorageGateway } from "../../../capabilities/storage";
import { parseJsonArray, parseJsonObject } from "../../../core/json";
import { boolish } from "../../../generation/runtime-records";
import type { BaseLLMProvider, ChatMessage } from "../../../generation-core/llm/base-provider.js";
import { readString as stringValue } from "../../../shared/value-readers";

// ── Types ──

/** A single time block in a character's daily schedule */
interface ScheduleBlock {
  /** Hour range, e.g. "06:00-08:00" */
  time: string;
  /** What the character is doing */
  activity: string;
  /** Derived status for this block */
  status: "online" | "idle" | "dnd" | "offline";
}

/** One day of a character's schedule */
type DaySchedule = ScheduleBlock[];

/** Full weekly schedule for a character */
export interface WeekSchedule {
  /** ISO date string of the Monday this schedule starts */
  weekStart: string;
  /** Schedules keyed by day name */
  days: Record<string, DaySchedule>;
  /** How many minutes of user inactivity before this character messages unprompted (0 = never) */
  inactivityThresholdMinutes: number;
  /** Optional exact response delay in minutes while idle */
  idleResponseDelayMinutes?: number;
  /** Optional exact response delay in minutes while busy / DND */
  dndResponseDelayMinutes?: number;
  /** How chatty the character is — affects autonomous messaging frequency (0-100) */
  talkativeness: number;
}

/** All character schedules stored in chat metadata */
interface CharacterSchedules {
  [characterId: string]: WeekSchedule;
}

type JsonRecord = Record<string, unknown>;

export interface GenerateConversationSchedulesInput {
  chatId: string;
  forceRefresh?: boolean;
  characterIds?: string[];
  scheduleGenerationPreferences?: string;
}

export interface GenerateConversationSchedulesResult {
  results: Record<string, { status: string; schedule?: WeekSchedule }>;
  schedules: CharacterSchedules;
}

// ── Constants ──

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const SCHEDULE_CONTINUITY_MAX_CHARS = 6000;

const STATUS_KEYWORDS: Record<string, "online" | "idle" | "dnd" | "offline"> = {
  sleep: "offline",
  sleeping: "offline",
  nap: "offline",
  napping: "offline",
  rest: "offline",
  resting: "offline",
  work: "dnd",
  working: "dnd",
  class: "dnd",
  classes: "dnd",
  school: "dnd",
  studying: "dnd",
  study: "dnd",
  meeting: "dnd",
  training: "dnd",
  exercise: "dnd",
  gym: "dnd",
  busy: "dnd",
  commute: "idle",
  commuting: "idle",
  driving: "idle",
  travel: "idle",
  traveling: "idle",
  shower: "idle",
  showering: "idle",
  cooking: "idle",
  eating: "idle",
  meal: "idle",
};

export async function generateConversationSchedules(
  capabilities: { storage: StorageGateway; llm: LlmGateway },
  input: GenerateConversationSchedulesInput,
): Promise<GenerateConversationSchedulesResult> {
  const chat = await capabilities.storage.get<JsonRecord>("chats", input.chatId);
  if (!chat) throw new Error("Chat not found");
  if (chat.mode !== "conversation") throw new Error("Not a conversation chat");

  const connection = await resolveScheduleConnection(capabilities.storage, stringValue(chat.connectionId));
  const connectionId = stringValue(connection.id);
  if (!connectionId) throw new Error("No connection configured");

  const meta = parseJsonObject(chat.metadata);
  const existingSchedules = hasSchedules(meta.characterSchedules) ? meta.characterSchedules : {};
  const characterIds = input.characterIds?.length
    ? input.characterIds
    : parseJsonArray<string>(chat.characterIds).filter(Boolean);
  if (characterIds.length === 0) throw new Error("No conversation characters are selected");
  const provider = createScheduleProvider(capabilities.llm, connectionId, numberOrNull(connection.maxTokensOverride));
  const model = stringValue(connection.model);
  const mondayStr = getMonday().toISOString();
  const userSchedulePreferences =
    typeof input.scheduleGenerationPreferences === "string" ? input.scheduleGenerationPreferences.trim() : "";

  const newSchedules: CharacterSchedules = { ...existingSchedules };
  const results: Record<string, { status: string; schedule?: WeekSchedule }> = {};
  let otherChatSchedules: Map<string, WeekSchedule> | null = null;
  const getOtherChatSchedules = async () => {
    if (otherChatSchedules) return otherChatSchedules;
    otherChatSchedules = await loadOtherConversationSchedules(capabilities.storage, input.chatId);
    return otherChatSchedules;
  };

  for (const characterId of characterIds) {
    const existing = existingSchedules[characterId];
    if (existing && !input.forceRefresh && !scheduleNeedsRefresh(existing)) {
      results[characterId] = { status: "fresh" };
      continue;
    }

    if (!input.forceRefresh) {
      const shared = (await getOtherChatSchedules()).get(characterId);
      if (shared) {
        const mergedShared = preserveTimingSettings(shared, existing);
        newSchedules[characterId] = mergedShared;
        await updateCharacterConversationStatus(capabilities.storage, characterId, mergedShared);
        results[characterId] = { status: "shared", schedule: mergedShared };
        continue;
      }
    }

    const character = await capabilities.storage.get<JsonRecord>("characters", characterId);
    if (!character) {
      results[characterId] = { status: "not_found" };
      continue;
    }
    const characterData = parseJsonObject(character.data);
    if (parseJsonObject(characterData.extensions).isBuiltInAssistant === true) {
      results[characterId] = { status: "skipped_assistant" };
      continue;
    }

    try {
      const recentContinuityContext = existing
        ? buildScheduleContinuityContext({ meta, characterData, existingSchedule: existing })
        : undefined;
      const { schedule } = await generateCharacterSchedule(
        provider,
        model,
        stringValue(characterData.name) || "Character",
        stringValue(characterData.description),
        stringValue(characterData.personality),
        userSchedulePreferences,
        recentContinuityContext,
      );
      const fullSchedule = preserveTimingSettings({ ...schedule, weekStart: mondayStr }, existing);
      newSchedules[characterId] = fullSchedule;
      await updateCharacterConversationStatus(
        capabilities.storage,
        characterId,
        fullSchedule,
        character,
        characterData,
      );
      results[characterId] = { status: "generated", schedule: fullSchedule };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Schedule generation failed";
      results[characterId] = { status: `error: ${message}` };
    }
  }

  const hasRequestedSchedule = characterIds.some((characterId) => !!newSchedules[characterId]);
  if (!hasRequestedSchedule) {
    const failures = Object.values(results)
      .map((result) => result.status)
      .filter((status) => status.startsWith("error: "));
    throw new Error(
      failures[0]?.replace(/^error:\s*/, "") || "No usable schedules were generated for this conversation",
    );
  }

  if (Object.keys(newSchedules).length > 0) {
    const freshChat = (await capabilities.storage.get<JsonRecord>("chats", input.chatId)) ?? chat;
    const freshMeta = parseJsonObject(freshChat.metadata);
    await capabilities.storage.patchChatMetadata(input.chatId, {
      ...freshMeta,
      conversationSchedulesEnabled: true,
      characterSchedules: newSchedules,
      scheduleWeekStart: mondayStr,
    });
    await syncGeneratedSchedulesToOtherChats(capabilities.storage, input.chatId, characterIds, results, newSchedules);
  }

  return { results, schedules: newSchedules };
}

// ── Schedule Generation ──

/**
 * Generate a weekly schedule for a character using the LLM.
 */
async function generateCharacterSchedule(
  provider: BaseLLMProvider,
  model: string,
  characterName: string,
  characterDescription: string,
  characterPersonality: string,
  userSchedulePreferences?: string,
  recentContinuityContext?: string,
): Promise<{ schedule: Omit<WeekSchedule, "weekStart">; raw: string }> {
  const systemPrompt = [
    `You are a schedule generator. Create a realistic weekly schedule for a character based on their personality and description.`,
    ``,
    `Character: ${characterName}`,
    `Description: ${characterDescription}`,
    `Personality: ${characterPersonality}`,
    ``,
    ...(recentContinuityContext?.trim()
      ? [
          `Recent continuity:`,
          `This is not the first schedule for this character. Use the following recent memories, summaries, and previous routine to update the new week.`,
          `If recent events changed the character's job, school, health, relationship status, location, obligations, sleep pattern, or priorities, reflect those changes in the schedule.`,
          `If the continuity does not imply a durable routine change, preserve the character's established lifestyle.`,
          `<recent_continuity>`,
          recentContinuityContext.trim(),
          `</recent_continuity>`,
          ``,
        ]
      : []),
    ...(userSchedulePreferences?.trim()
      ? [
          `User preferences:`,
          `The person using this app has provided the following scheduling guidance.`,
          `Honor these preferences even when they would override typical patterns for this character:`,
          userSchedulePreferences.trim(),
          ``,
        ]
      : []),
    `Generate a schedule for each day of the week (Monday through Sunday).`,
    `Each day should have time blocks covering the full 24 hours.`,
    `The schedule should be realistic and consistent with the character's lifestyle.`,
    ``,
    `Each time block must include a "status" field indicating the character's availability:`,
    `- "online": awake and available (free time, socializing, casual activities)`,
    `- "idle": semi-available (eating, commuting, showering, cooking)`,
    `- "dnd": busy / do not disturb (working, studying, training, in a meeting, focused tasks)`,
    `- "offline": unavailable (sleeping, passed out, unconscious, dead to the world)`,
    ``,
    `Also assess the character's talkativeness on a scale of 0-100:`,
    `- 0-20: Very introverted, rarely initiates conversation`,
    `- 21-40: Quiet, only messages when they have something to say`,
    `- 41-60: Average, checks in now and then`,
    `- 61-80: Social, likes to chat frequently`,
    `- 81-100: Very chatty, always wants to talk`,
    ``,
    `And estimate how long (in minutes) this character would wait before messaging someone who hasn't replied:`,
    `- Very patient characters: 180-360 minutes`,
    `- Average characters: 60-180 minutes`,
    `- Impatient/chatty characters: 15-60 minutes`,
    ``,
    `RESPOND IN EXACTLY THIS JSON FORMAT (no markdown, no code blocks, just raw JSON).`,
    `Include ALL 7 days (Monday through Sunday), each with time blocks covering the full 24 hours.`,
    `Example for one day:`,
    `{`,
    `  "talkativeness": 65,`,
    `  "inactivityThresholdMinutes": 45,`,
    `  "days": {`,
    `    "Monday": [`,
    `      { "time": "00:00-07:00", "activity": "sleeping", "status": "offline" },`,
    `      { "time": "07:00-08:00", "activity": "morning routine", "status": "idle" },`,
    `      { "time": "08:00-12:00", "activity": "working", "status": "dnd" },`,
    `      { "time": "12:00-13:00", "activity": "lunch break", "status": "idle" },`,
    `      { "time": "13:00-17:00", "activity": "working", "status": "dnd" },`,
    `      { "time": "17:00-19:00", "activity": "free time", "status": "online" },`,
    `      { "time": "19:00-20:00", "activity": "dinner", "status": "idle" },`,
    `      { "time": "20:00-23:00", "activity": "relaxing", "status": "online" },`,
    `      { "time": "23:00-00:00", "activity": "getting ready for bed", "status": "idle" }`,
    `    ]`,
    `  }`,
    `}`,
    `Follow this exact structure for all 7 days. Do NOT use ellipsis, comments, or placeholders.`,
  ].join("\n");

  const scheduleMaxTokens = provider.maxTokensOverrideValue ?? 8192;
  const result = await provider.chatComplete(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: "Generate the schedule now." },
    ],
    { model, temperature: 0.8, maxTokens: scheduleMaxTokens },
  );

  const content = result.content ?? "";
  const parsed = parseScheduleResponse(content);
  return { schedule: parsed, raw: content };
}

/**
 * Parse the LLM's schedule response into a structured format.
 */
function parseScheduleResponse(content: string): Omit<WeekSchedule, "weekStart"> {
  // Try to extract JSON from response (handle markdown code blocks)
  let jsonStr = content.trim();
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) jsonStr = jsonMatch[1]!.trim();

  // Try to find raw JSON object
  const braceStart = jsonStr.indexOf("{");
  const braceEnd = jsonStr.lastIndexOf("}");
  if (braceStart !== -1 && braceEnd !== -1) {
    jsonStr = jsonStr.slice(braceStart, braceEnd + 1);
  }

  // Repair common LLM JSON issues: trailing commas, comments, ellipsis, unquoted keys
  jsonStr = jsonStr
    .replace(/\/\/[^\n]*/g, "") // remove single-line comments
    .replace(/\/\*[\s\S]*?\*\//g, "") // remove multi-line comments
    .replace(/,\s*([\]}])/g, "$1") // remove trailing commas before ] or }
    .replace(/\.{3,}[^"}\]\n]*/g, "") // remove ...etc / ... continuations (not inside strings)
    .replace(/\n\s*\n/g, "\n"); // collapse blank lines left by removals

  type RawScheduleData = {
    talkativeness?: number;
    inactivityThresholdMinutes?: number;
    days?: Record<string, Array<{ time: string; activity: string; status?: string }>>;
    schedule?: unknown;
    weeklySchedule?: unknown;
  };

  let data: RawScheduleData;

  try {
    data = normalizeScheduleData(JSON.parse(jsonStr));
  } catch (firstError) {
    // Second pass: more aggressive repair — remove any lines that aren't valid JSON structure
    // This catches things like "// ..." or bare text the LLM added inside the JSON
    const repairedLines = jsonStr.split("\n").filter((line) => {
      const trimmed = line.trim();
      // Keep lines that look like JSON structure (braces, brackets, key-value pairs, commas)
      if (!trimmed) return false;
      if (/^[{}[\],]/.test(trimmed)) return true;
      if (/^"/.test(trimmed)) return true;
      if (/^\d/.test(trimmed)) return true;
      if (/^[}\]]/.test(trimmed)) return true;
      return false;
    });
    const repairedStr = repairedLines.join("\n").replace(/,\s*([\]}])/g, "$1");
    try {
      data = normalizeScheduleData(JSON.parse(repairedStr));
    } catch {
      // If still failing, throw the original error with context
      throw firstError;
    }
  }

  const VALID_STATUSES = new Set(["online", "idle", "dnd", "offline"] as const);
  type ValidStatus = "online" | "idle" | "dnd" | "offline";
  const days: Record<string, DaySchedule> = {};
  for (const day of DAYS) {
    const dayData = getDaySchedule(data.days, day);
    days[day] = dayData.map((block) => ({
      time: block.time,
      activity: block.activity,
      status:
        block.status && VALID_STATUSES.has(block.status as ValidStatus)
          ? (block.status as ValidStatus)
          : inferStatusFromActivity(block.activity),
    }));
  }
  if (Object.values(days).every((day) => day.length === 0)) {
    throw new Error("Schedule response did not include any daily time blocks");
  }

  return {
    days,
    talkativeness: Math.max(0, Math.min(100, data.talkativeness ?? 50)),
    inactivityThresholdMinutes: Math.max(15, Math.min(360, data.inactivityThresholdMinutes ?? 120)),
  };
}

/**
 * Infer a conversation status from an activity description.
 */
function inferStatusFromActivity(activity: string): "online" | "idle" | "dnd" | "offline" {
  const lower = activity.toLowerCase();
  for (const [keyword, status] of Object.entries(STATUS_KEYWORDS)) {
    if (lower.includes(keyword)) return status;
  }
  // Default: if it's a leisure/free activity, the character is online
  return "online";
}

// ── Status Derivation ──

/**
 * Get the current status and activity for a character based on their schedule.
 */
export function getCurrentStatus(
  schedule: WeekSchedule,
  now: Date = new Date(),
): { status: "online" | "idle" | "dnd" | "offline"; activity: string } {
  const dayName = DAYS[(now.getDay() + 6) % 7]!; // JS Sunday=0, we want Monday=0
  const daySchedule = schedule.days[dayName];
  if (!daySchedule || daySchedule.length === 0) {
    return { status: "online", activity: "free time" };
  }

  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  for (const block of daySchedule) {
    const [startStr, endStr] = block.time.split("-");
    if (!startStr || !endStr) continue;

    const [sh, sm] = startStr.split(":").map(Number);
    const [eh, em] = endStr.split(":").map(Number);
    const startMin = (sh ?? 0) * 60 + (sm ?? 0);
    const endMin = (eh ?? 0) * 60 + (em ?? 0);

    // Handle blocks that don't wrap around midnight
    if (startMin <= currentMinutes && currentMinutes < endMin) {
      return { status: block.status, activity: block.activity };
    }
    // Handle midnight-wrapping blocks (e.g., 23:00-07:00)
    if (startMin > endMin && (currentMinutes >= startMin || currentMinutes < endMin)) {
      return { status: block.status, activity: block.activity };
    }
  }

  return { status: "online", activity: "free time" };
}

/**
 * Check if a schedule needs regeneration (older than 7 days from current Monday).
 */
function scheduleNeedsRefresh(schedule: WeekSchedule, now: Date = new Date()): boolean {
  const weekStart = new Date(schedule.weekStart);
  const currentMonday = getMonday(now);
  return currentMonday.getTime() > weekStart.getTime();
}

/**
 * Get the Monday of the current week at 00:00.
 */
export function getMonday(date: Date = new Date()): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function normalizeScheduleData(value: unknown): {
  talkativeness?: number;
  inactivityThresholdMinutes?: number;
  days?: Record<string, Array<{ time: string; activity: string; status?: string }>>;
} {
  const record = parseJsonObject(value);
  const nested = parseJsonObject(record.schedule);
  if (nested.days && !record.days) return nested;
  const weekly = parseJsonObject(record.weeklySchedule);
  if (weekly.days && !record.days) return weekly;
  return record;
}

function getDaySchedule(
  days: Record<string, Array<{ time: string; activity: string; status?: string }>> | undefined,
  day: string,
): Array<{ time: string; activity: string; status?: string }> {
  if (!days) return [];
  const direct = days[day];
  if (Array.isArray(direct)) return direct;
  const match = Object.entries(days).find(([key]) => key.toLowerCase() === day.toLowerCase());
  return Array.isArray(match?.[1]) ? match[1] : [];
}

function hasSchedules(value: unknown): value is CharacterSchedules {
  return !!value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length > 0;
}

function areConversationSchedulesEnabled(meta: JsonRecord): boolean {
  return typeof meta.conversationSchedulesEnabled === "boolean"
    ? meta.conversationSchedulesEnabled
    : hasSchedules(meta.characterSchedules);
}

function getEnabledConversationSchedules(meta: JsonRecord): CharacterSchedules {
  return areConversationSchedulesEnabled(meta) && hasSchedules(meta.characterSchedules) ? meta.characterSchedules : {};
}

function createScheduleProvider(
  llm: LlmGateway,
  connectionId: string,
  maxTokensOverrideValue: number | null,
): BaseLLMProvider {
  return {
    maxTokensOverrideValue,
    async chatComplete(messages, options) {
      const requestMessages: LlmMessage[] = messages.map(toLlmMessage);
      const content = await llm.complete(
        requestMessages.length
          ? {
              connectionId,
              model: options.model,
              messages: requestMessages,
              parameters: {
                temperature: options.temperature,
                maxTokens: options.maxTokens,
              },
            }
          : {
              connectionId,
              model: options.model,
              messages: [{ role: "user", content: "" }],
              parameters: {
                temperature: options.temperature,
                maxTokens: options.maxTokens,
              },
            },
      );
      return { content };
    },
  };
}

function toLlmMessage(message: ChatMessage): LlmMessage {
  const role =
    message.role === "system" || message.role === "user" || message.role === "assistant" || message.role === "tool"
      ? message.role
      : "user";
  return { role, content: String(message.content ?? ""), name: message.name };
}

async function resolveScheduleConnection(storage: StorageGateway, chatConnectionId: string): Promise<JsonRecord> {
  const connections = await storage.list<JsonRecord>("connections");
  if (chatConnectionId === "random") {
    const pool = connections.filter((connection) => boolish(connection.useForRandom, false));
    const selected = pool[Math.floor(Math.random() * pool.length)];
    if (!selected) throw new Error("No connections marked for the random pool");
    return selected;
  }
  if (chatConnectionId) {
    const connection = await storage.get<JsonRecord>("connections", chatConnectionId);
    if (!connection) throw new Error("Configured connection not found");
    return connection;
  }
  const selected =
    connections.find((connection) => boolish(connection.isDefault, false) || boolish(connection.default, false)) ??
    connections[0];
  if (!selected) throw new Error("No connection configured");
  return selected;
}

async function loadOtherConversationSchedules(
  storage: StorageGateway,
  currentChatId: string,
): Promise<Map<string, WeekSchedule>> {
  const schedules = new Map<string, WeekSchedule>();
  const allChats = await storage.list<JsonRecord>("chats");
  for (const chat of allChats) {
    if (chat.id === currentChatId || chat.mode !== "conversation") continue;
    const meta = parseJsonObject(chat.metadata);
    if (!areConversationSchedulesEnabled(meta)) continue;
    for (const [characterId, schedule] of Object.entries(getEnabledConversationSchedules(meta))) {
      if (!schedules.has(characterId) && schedule && !scheduleNeedsRefresh(schedule)) {
        schedules.set(characterId, schedule);
      }
    }
  }
  return schedules;
}

function preserveTimingSettings(schedule: WeekSchedule, existing?: WeekSchedule): WeekSchedule {
  if (!existing) return schedule;
  const merged: WeekSchedule = {
    ...schedule,
    inactivityThresholdMinutes: existing.inactivityThresholdMinutes,
  };
  if (typeof existing.idleResponseDelayMinutes === "number") {
    merged.idleResponseDelayMinutes = existing.idleResponseDelayMinutes;
  }
  if (typeof existing.dndResponseDelayMinutes === "number") {
    merged.dndResponseDelayMinutes = existing.dndResponseDelayMinutes;
  }
  return merged;
}

async function updateCharacterConversationStatus(
  storage: StorageGateway,
  characterId: string,
  schedule: WeekSchedule,
  loadedCharacter?: JsonRecord,
  loadedCharacterData?: JsonRecord,
): Promise<void> {
  const character = loadedCharacter ?? (await storage.get<JsonRecord>("characters", characterId));
  if (!character) return;
  const characterData = loadedCharacterData ?? parseJsonObject(character.data);
  const extensions = {
    ...parseJsonObject(characterData.extensions),
    conversationStatus: getCurrentStatus(schedule).status,
  };
  await storage.update("characters", characterId, {
    data: {
      ...characterData,
      extensions,
    },
  });
}

async function syncGeneratedSchedulesToOtherChats(
  storage: StorageGateway,
  currentChatId: string,
  requestedCharacterIds: string[],
  results: Record<string, { status: string; schedule?: WeekSchedule }>,
  newSchedules: CharacterSchedules,
): Promise<void> {
  const generatedCharacterIds = requestedCharacterIds.filter((id) => results[id]?.status === "generated");
  if (generatedCharacterIds.length === 0) return;

  const allChats = await storage.list<JsonRecord>("chats");
  for (const chat of allChats) {
    const chatId = stringValue(chat.id);
    if (chatId === currentChatId || chat.mode !== "conversation") continue;
    const chatCharacterIds = parseJsonArray<string>(chat.characterIds);
    const overlap = generatedCharacterIds.filter((id) => chatCharacterIds.includes(id));
    if (overlap.length === 0) continue;
    const meta = parseJsonObject(chat.metadata);
    if (!areConversationSchedulesEnabled(meta)) continue;
    const chatSchedules = hasSchedules(meta.characterSchedules) ? { ...meta.characterSchedules } : {};
    let changed = false;
    for (const characterId of overlap) {
      const schedule = newSchedules[characterId];
      if (!schedule) continue;
      chatSchedules[characterId] = preserveTimingSettings(schedule, chatSchedules[characterId]);
      changed = true;
    }
    if (changed) {
      await storage.patchChatMetadata(chatId, {
        ...meta,
        conversationSchedulesEnabled: true,
        characterSchedules: chatSchedules,
        scheduleWeekStart: getMonday().toISOString(),
      });
    }
  }
}

type SummaryEntry = { summary: string; keyDetails: string[] };
type CharacterMemoryEntry = { from?: string; summary?: string; createdAt?: string };

function parseDateKeyMs(dateKey: string): number {
  const match = dateKey.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!match) return 0;
  const [, day, month, year] = match;
  return new Date(Number(year), Number(month) - 1, Number(day)).getTime();
}

function coerceSummaryEntry(value: unknown): SummaryEntry | null {
  if (typeof value === "string") {
    const summary = value.trim();
    return summary ? { summary, keyDetails: [] } : null;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as JsonRecord;
  const summary = stringValue(record.summary).trim();
  const keyDetails = parseJsonArray<string>(record.keyDetails).filter((detail) => detail.trim().length > 0);
  return summary || keyDetails.length > 0 ? { summary, keyDetails } : null;
}

function getRecentSummaryEntries(raw: unknown, limit: number): Array<{ key: string; entry: SummaryEntry }> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  return Object.entries(raw as JsonRecord)
    .map(([key, value]) => ({ key, entry: coerceSummaryEntry(value), time: parseDateKeyMs(key) }))
    .filter((item): item is { key: string; entry: SummaryEntry; time: number } => !!item.entry)
    .sort((a, b) => b.time - a.time)
    .slice(0, limit)
    .map(({ key, entry }) => ({ key, entry }));
}

function limitText(value: string, maxChars: number): string {
  const trimmed = value.trim().replace(/\s+/g, " ");
  return trimmed.length > maxChars ? `${trimmed.slice(0, maxChars - 1).trim()}...` : trimmed;
}

function formatSummaryEntry(label: string, entry: SummaryEntry): string[] {
  const lines = [`- ${label}: ${limitText(entry.summary, 700)}`];
  if (entry.keyDetails.length > 0) {
    lines.push(
      `  Key details: ${entry.keyDetails
        .slice(0, 8)
        .map((detail) => limitText(detail, 180))
        .join("; ")}`,
    );
  }
  return lines;
}

function summarizePreviousSchedule(schedule: WeekSchedule): string[] {
  return Object.entries(schedule.days)
    .slice(0, 7)
    .map(([day, blocks]) => {
      const activities = blocks
        .slice(0, 8)
        .map((block) => `${block.time} ${block.activity} (${block.status})`)
        .join("; ");
      return `- ${day}: ${activities}`;
    });
}

function buildScheduleContinuityContext(args: {
  meta: JsonRecord;
  characterData: JsonRecord;
  existingSchedule: WeekSchedule;
}): string {
  const { meta, characterData, existingSchedule } = args;
  const sections: string[] = [];

  sections.push(`<previous_schedule weekStart="${existingSchedule.weekStart}">`);
  sections.push(...summarizePreviousSchedule(existingSchedule));
  sections.push(`</previous_schedule>`);

  const weekSummaries = getRecentSummaryEntries(meta.weekSummaries, 2);
  if (weekSummaries.length > 0) {
    sections.push("", "<recent_week_summaries>");
    for (const { key, entry } of weekSummaries) sections.push(...formatSummaryEntry(`Week of ${key}`, entry));
    sections.push("</recent_week_summaries>");
  }

  const daySummaries = getRecentSummaryEntries(meta.daySummaries, 7);
  if (daySummaries.length > 0) {
    sections.push("", "<recent_day_summaries>");
    for (const { key, entry } of daySummaries) sections.push(...formatSummaryEntry(key, entry));
    sections.push("</recent_day_summaries>");
  }

  const rollingSummary = stringValue(meta.summary).trim();
  if (rollingSummary) {
    sections.push("", "<rolling_chat_summary>", limitText(rollingSummary, 1200), "</rolling_chat_summary>");
  }

  const memories = parseJsonArray<CharacterMemoryEntry>(parseJsonObject(characterData.extensions).characterMemories);
  const previousScheduleStartMs = new Date(existingSchedule.weekStart).getTime();
  const recentMemories = memories
    .filter((memory) => typeof memory.summary === "string" && memory.summary.trim())
    .filter((memory) => {
      if (!Number.isFinite(previousScheduleStartMs) || !memory.createdAt) return true;
      const memoryTime = new Date(memory.createdAt).getTime();
      return !Number.isFinite(memoryTime) || memoryTime >= previousScheduleStartMs;
    })
    .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())
    .slice(0, 8);
  if (recentMemories.length > 0) {
    sections.push("", "<recent_character_memories>");
    for (const memory of recentMemories) {
      const date = memory.createdAt ? memory.createdAt.slice(0, 10) : "unknown date";
      const from = memory.from ? ` from ${memory.from}` : "";
      sections.push(`- ${date}${from}: ${limitText(memory.summary ?? "", 350)}`);
    }
    sections.push("</recent_character_memories>");
  }

  return sections.join("\n").slice(0, SCHEDULE_CONTINUITY_MAX_CHARS);
}

function numberOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/**
 * Calculate a delay in milliseconds for a "busy" character's response.
 * Returns 0 for online characters, 2-5 minutes for busy characters.
 */
function getConfiguredResponseDelayMinutes(
  status: "online" | "idle" | "dnd" | "offline",
  schedule?: Pick<WeekSchedule, "idleResponseDelayMinutes" | "dndResponseDelayMinutes">,
): number | null {
  const rawValue =
    status === "idle"
      ? schedule?.idleResponseDelayMinutes
      : status === "dnd"
        ? schedule?.dndResponseDelayMinutes
        : null;
  if (typeof rawValue !== "number" || !Number.isFinite(rawValue)) {
    return null;
  }
  return Math.max(0, Math.min(120, rawValue));
}

function getConfiguredResponseDelay(
  status: "online" | "idle" | "dnd" | "offline",
  schedule?: Pick<WeekSchedule, "idleResponseDelayMinutes" | "dndResponseDelayMinutes">,
): number {
  const overrideMinutes = getConfiguredResponseDelayMinutes(status, schedule);
  if (overrideMinutes !== null) {
    return overrideMinutes * 60 * 1000;
  }

  switch (status) {
    case "online":
      return 0;
    case "idle":
      return (60 + Math.random() * 120) * 1000; // 1-3 minutes
    case "dnd":
      return (120 + Math.random() * 180) * 1000; // 2-5 minutes
    case "offline":
      return 0; // Shouldn't respond at all when offline
  }
}

export function getBusyDelay(
  status: "online" | "idle" | "dnd" | "offline",
  schedule?: Pick<WeekSchedule, "idleResponseDelayMinutes" | "dndResponseDelayMinutes">,
): number {
  return getConfiguredResponseDelay(status, schedule);
}
