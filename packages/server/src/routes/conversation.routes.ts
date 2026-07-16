// ──────────────────────────────────────────────
// Routes: Conversation Mode Services
// ──────────────────────────────────────────────
// Endpoints for schedule generation, status checking,
// autonomous message polling, and busy-delay responses.

import type { FastifyInstance } from "fastify";
import { logger } from "../lib/logger.js";
import { createChatsStorage } from "../services/storage/chats.storage.js";
import { createCharactersStorage } from "../services/storage/characters.storage.js";
import { createConnectionsStorage } from "../services/storage/connections.storage.js";
import { createLLMProvider } from "../services/llm/provider-registry.js";
import { withConnectionFallbackProvider } from "../services/llm/connection-fallback-provider.js";
import { CONVERSATION_SCHEDULE_DAYS, PROVIDERS, localAuthProviderBaseUrl } from "@marinara-engine/shared";
import type { CharacterData, ConversationStatusOverride } from "@marinara-engine/shared";
import {
  generateCharacterSchedule,
  generateCharacterDaySchedule,
  generateScheduleRoutineSummary,
  getEffectiveCurrentStatus,
  scheduleNeedsRefresh,
  getMonday,
  getBusyDelay,
  type WeekSchedule,
  type CharacterSchedules,
  type WeekScheduleDraftMode,
} from "../services/conversation/schedule.service.js";
import {
  checkAutonomousMessaging,
  checkCharacterExchange,
  getActivityState,
  isAutonomousDailyBudgetExhausted,
  recordUserActivity,
  recordAssistantActivity,
  recordAutonomousClientPresence,
  markGenerationInProgress,
  clearGenerationInProgress,
  initializeActivityFromMessages,
} from "../services/conversation/autonomous.service.js";
import { getActiveTurnGame } from "../services/turn-games/turn-game-runner.service.js";
import {
  normalizePromptTimeZone,
  resolveConversationTimeZone,
  toZonedWallClockDate,
} from "../services/conversation/timezone.js";
import {
  getIntentHint,
  isIntentOnCooldown,
  resolveIntent,
  type MessageIntent,
} from "../services/conversation/intent.service.js";
import { parseConversationStatusOverrides } from "../services/generation/conversation-context-utils.js";

function resolveBaseUrl(connection: { baseUrl: string | null; provider: string }): string {
  if (connection.baseUrl) return connection.baseUrl;
  // Login-backed providers own their endpoint internally; return sentinels so
  // downstream baseUrl gates pass.
  const localAuthBaseUrl = localAuthProviderBaseUrl(connection.provider);
  if (localAuthBaseUrl) return localAuthBaseUrl;
  const providerDef = PROVIDERS[connection.provider as keyof typeof PROVIDERS];
  return providerDef?.defaultBaseUrl ?? "";
}

function hasSchedules(value: unknown): value is CharacterSchedules {
  return !!value && typeof value === "object" && Object.keys(value as Record<string, unknown>).length > 0;
}

function areConversationSchedulesEnabled(meta: Record<string, unknown>): boolean {
  if (typeof meta.conversationSchedulesEnabled === "boolean") return meta.conversationSchedulesEnabled;
  return hasSchedules(meta.characterSchedules);
}

function parseWeekScheduleDraftMode(value: unknown): WeekScheduleDraftMode {
  return value === "adjust" || value === "vary" || value === "repair" || value === "rewrite" ? value : "rewrite";
}

function getEnabledConversationSchedules(meta: Record<string, unknown>): CharacterSchedules {
  return areConversationSchedulesEnabled(meta) && hasSchedules(meta.characterSchedules) ? meta.characterSchedules : {};
}

function getScheduleGenerationError(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

type AutonomousUserStatus = "active" | "idle" | "dnd";

type AutonomousIntentPayload = {
  autonomousIntent?: string;
  autonomousIntentPrompt?: string;
  autonomousIntentKey?: MessageIntent;
  onCooldown: boolean;
};

type AutonomousCandidateEvaluation =
  | { ok: true; intent: AutonomousIntentPayload }
  | { ok: false; reason: "daily_budget_exhausted" | "intent_cooldown" };

function normalizeAutonomousUserStatus(value: unknown): AutonomousUserStatus {
  return value === "idle" || value === "dnd" ? value : "active";
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function getCharacterCardTalkativeness(data: unknown): number {
  let parsed: CharacterData | null = null;
  if (typeof data === "string") {
    try {
      parsed = JSON.parse(data) as CharacterData;
    } catch {
      return 50;
    }
  } else if (data && typeof data === "object") {
    parsed = data as CharacterData;
  }

  const raw = parsed?.extensions?.talkativeness;
  const value = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(value)) return 50;
  return clampPercent(value <= 1 ? Math.round(value * 100) : Math.round(value));
}

function getSchedulelessInactivityThresholdMinutes(talkativeness: number, userStatus: AutonomousUserStatus): number {
  const chatty = clampPercent(talkativeness) / 100;
  const minMinutes = userStatus === "idle" ? 10 : 30;
  const maxMinutes = userStatus === "idle" ? 180 : 360;
  return Math.round(maxMinutes - (maxMinutes - minMinutes) * chatty);
}

function createSchedulelessAutonomySchedule(talkativeness: number, userStatus: AutonomousUserStatus): WeekSchedule {
  return {
    weekStart: getMonday().toISOString(),
    days: {},
    inactivityThresholdMinutes: getSchedulelessInactivityThresholdMinutes(talkativeness, userStatus),
    talkativeness,
  };
}

function resolveAutonomousIntentPayload(
  chatId: string,
  characterId: string,
  schedule: WeekSchedule | undefined,
  meta: Record<string, unknown>,
  now = new Date(),
): AutonomousIntentPayload {
  if (!schedule) return { onCooldown: false };
  const state = getActivityState(chatId);
  const msSinceUserLastSpoke = state?.lastUserMessageAt ? Date.now() - state.lastUserMessageAt : 0;
  const hadUnansweredUserMessage = state ? state.lastUserMessageAt > state.lastAssistantMessageAt : false;
  const intent = resolveIntent(schedule, msSinceUserLastSpoke, hadUnansweredUserMessage, now);
  return {
    autonomousIntent: getIntentHint(intent),
    autonomousIntentPrompt: `What prompted this message: ${getIntentHint(intent)}`,
    autonomousIntentKey: intent,
    onCooldown: isIntentOnCooldown(meta, characterId, intent),
  };
}

function evaluateAutonomousCandidate(
  chatId: string,
  characterId: string,
  schedule: WeekSchedule | undefined,
  meta: Record<string, unknown>,
  now = new Date(),
): AutonomousCandidateEvaluation {
  if (isAutonomousDailyBudgetExhausted(characterId, schedule, meta)) {
    return { ok: false, reason: "daily_budget_exhausted" };
  }

  const intent = resolveAutonomousIntentPayload(chatId, characterId, schedule, meta, now);
  if (intent.onCooldown) return { ok: false, reason: "intent_cooldown" };

  return { ok: true, intent };
}

function blockedAutonomousResponse(reason: "daily_budget_exhausted" | "intent_cooldown") {
  return { shouldTrigger: false, characterIds: [], reason, inactivityMs: 0 };
}

function resolveLongAbsenceCandidate(
  chatId: string,
  schedules: CharacterSchedules,
  statusOverrides: Record<string, ConversationStatusOverride>,
  meta: Record<string, unknown>,
  now = new Date(),
  scheduleNow = now,
):
  | { characterId: string; intent: AutonomousIntentPayload }
  | { blockedReason: "daily_budget_exhausted" | "intent_cooldown" }
  | null {
  const state = getActivityState(chatId);
  if (!state?.lastUserMessageAt || state.lastUserMessageAt > state.lastAssistantMessageAt) return null;

  const candidates = Object.entries(schedules)
    .filter(([characterId, schedule]) => {
      const { status } = getEffectiveCurrentStatus(
        schedule,
        statusOverrides[characterId],
        now,
        "free time",
        scheduleNow,
      );
      return status !== "offline";
    })
    .sort(([, a], [, b]) => b.talkativeness - a.talkativeness);

  let blockedReason: "daily_budget_exhausted" | "intent_cooldown" | null = null;
  for (const [characterId, schedule] of candidates) {
    const intent = resolveAutonomousIntentPayload(chatId, characterId, schedule, meta, scheduleNow);
    if (intent.autonomousIntentKey !== "long_absence_check_in") continue;

    if (isAutonomousDailyBudgetExhausted(characterId, schedule, meta)) {
      blockedReason = blockedReason ?? "daily_budget_exhausted";
      continue;
    }

    if (intent.onCooldown) {
      blockedReason = blockedReason ?? "intent_cooldown";
      continue;
    }

    return { characterId, intent };
  }

  return blockedReason ? { blockedReason } : null;
}

type SummaryEntry = { summary: string; keyDetails: string[] };
type CharacterMemoryEntry = { from?: string; summary?: string; createdAt?: string };
type ConnectionsStorage = ReturnType<typeof createConnectionsStorage>;

const SCHEDULE_CONTINUITY_MAX_CHARS = 6000;

async function resolveConversationScheduleConnection(connections: ConnectionsStorage, chatConnectionId: string | null) {
  if (chatConnectionId === "random") {
    const pool = await connections.listRandomPool();
    if (!pool.length) {
      return { conn: null, error: "No connections marked for the random pool" };
    }
    return { conn: pool[Math.floor(Math.random() * pool.length)] ?? null, error: null };
  }

  const connId = chatConnectionId ?? (await connections.getDefault())?.id;
  if (!connId) {
    return { conn: null, error: "No connection configured" };
  }

  return { conn: await connections.getWithKey(connId), error: null };
}

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
  const record = value as Record<string, unknown>;
  const summary = typeof record.summary === "string" ? record.summary.trim() : "";
  const keyDetails = Array.isArray(record.keyDetails)
    ? record.keyDetails.filter((detail): detail is string => typeof detail === "string" && detail.trim().length > 0)
    : [];
  return summary || keyDetails.length > 0 ? { summary, keyDetails } : null;
}

function getRecentSummaryEntries(raw: unknown, limit: number): Array<{ key: string; entry: SummaryEntry }> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  return Object.entries(raw as Record<string, unknown>)
    .map(([key, value]) => ({ key, entry: coerceSummaryEntry(value), time: parseDateKeyMs(key) }))
    .filter((item): item is { key: string; entry: SummaryEntry; time: number } => !!item.entry)
    .sort((a, b) => b.time - a.time)
    .slice(0, limit)
    .map(({ key, entry }) => ({ key, entry }));
}

function limitText(value: string, maxChars: number): string {
  const trimmed = value.trim().replace(/\s+/g, " ");
  return trimmed.length > maxChars ? `${trimmed.slice(0, maxChars - 1).trim()}…` : trimmed;
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
  meta: Record<string, unknown>;
  charData: CharacterData;
  existingSchedule: WeekSchedule;
}): string {
  const { meta, charData, existingSchedule } = args;
  const sections: string[] = [];

  sections.push(`<previous_schedule weekStart="${existingSchedule.weekStart}">`);
  sections.push(...summarizePreviousSchedule(existingSchedule));
  sections.push(`</previous_schedule>`);

  const weekSummaries = getRecentSummaryEntries(meta.weekSummaries, 2);
  if (weekSummaries.length > 0) {
    sections.push(``, `<recent_week_summaries>`);
    for (const { key, entry } of weekSummaries) {
      sections.push(...formatSummaryEntry(`Week of ${key}`, entry));
    }
    sections.push(`</recent_week_summaries>`);
  }

  const daySummaries = getRecentSummaryEntries(meta.daySummaries, 7);
  if (daySummaries.length > 0) {
    sections.push(``, `<recent_day_summaries>`);
    for (const { key, entry } of daySummaries) {
      sections.push(...formatSummaryEntry(key, entry));
    }
    sections.push(`</recent_day_summaries>`);
  }

  const rollingSummary = typeof meta.summary === "string" ? meta.summary.trim() : "";
  if (rollingSummary) {
    sections.push(``, `<rolling_chat_summary>`, limitText(rollingSummary, 1200), `</rolling_chat_summary>`);
  }

  const memories: CharacterMemoryEntry[] = Array.isArray(charData.extensions?.characterMemories)
    ? (charData.extensions.characterMemories as CharacterMemoryEntry[])
    : [];
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
    sections.push(``, `<recent_character_memories>`);
    for (const memory of recentMemories) {
      const date = memory.createdAt ? memory.createdAt.slice(0, 10) : "unknown date";
      const from = memory.from ? ` from ${memory.from}` : "";
      sections.push(`- ${date}${from}: ${limitText(memory.summary ?? "", 350)}`);
    }
    sections.push(`</recent_character_memories>`);
  }

  return sections.join("\n").slice(0, SCHEDULE_CONTINUITY_MAX_CHARS);
}

export async function conversationRoutes(app: FastifyInstance) {
  const chats = createChatsStorage(app.db);
  const chars = createCharactersStorage(app.db);
  const connections = createConnectionsStorage(app.db);

  async function rememberConversationTimeZone(timeZone: string): Promise<number> {
    const allChats = await chats.list();
    let updatedChats = 0;
    for (const chat of allChats) {
      if (chat.mode !== "conversation") continue;
      const metadata = typeof chat.metadata === "string" ? JSON.parse(chat.metadata) : (chat.metadata ?? {});
      if (normalizePromptTimeZone(metadata.conversationTimeZone) === timeZone) continue;
      await chats.patchMetadata(chat.id, { conversationTimeZone: timeZone }, { touchUpdatedAt: false });
      updatedChats += 1;
    }
    return updatedChats;
  }

  async function createConversationAgentProvider(
    conn: NonNullable<Awaited<ReturnType<typeof connections.getWithKey>>>,
    baseUrl: string,
  ) {
    const fallbackConnection = await connections.getFallbackForAgents();
    return withConnectionFallbackProvider({
      primary: createLLMProvider(
        conn.provider,
        baseUrl,
        conn.apiKey,
        conn.maxContext,
        conn.openrouterProvider,
        conn.maxTokensOverride,
      ),
      primaryConnectionId: conn.id,
      fallbackConnection,
      fallbackBaseUrl: fallbackConnection ? resolveBaseUrl(fallbackConnection) : "",
      category: "agents",
    });
  }

  async function resolveScheduleGenerationContext(chatId: string, characterId: string) {
    const chat = await chats.getById(chatId);
    if (!chat) return { errorStatus: 404 as const, error: "Chat not found" };
    if (chat.mode !== "conversation") return { errorStatus: 400 as const, error: "Not a conversation chat" };

    const { conn, error: connectionError } = await resolveConversationScheduleConnection(
      connections,
      chat.connectionId,
    );
    if (!conn) return { errorStatus: 400 as const, error: connectionError ?? "No connection configured" };
    const baseUrl = resolveBaseUrl(conn);
    if (!baseUrl) return { errorStatus: 400 as const, error: "No base URL" };

    const charRow = await chars.getById(characterId);
    if (!charRow) return { errorStatus: 404 as const, error: "Character not found" };
    const charData = JSON.parse(charRow.data as string) as CharacterData;
    const provider = await createConversationAgentProvider(conn, baseUrl);
    return { chat, charData, provider, model: conn.model ?? "" };
  }

  function preserveDraftScheduleFields(schedule: WeekSchedule, existing?: WeekSchedule): WeekSchedule {
    if (!existing) return schedule;
    const merged: WeekSchedule = {
      ...schedule,
      inactivityThresholdMinutes: existing.inactivityThresholdMinutes,
      talkativeness: existing.talkativeness,
      routineSummary: null,
      routineSummaryGeneratedAt: null,
    };
    if (typeof existing.idleResponseDelayMinutes === "number")
      merged.idleResponseDelayMinutes = existing.idleResponseDelayMinutes;
    if (typeof existing.dndResponseDelayMinutes === "number")
      merged.dndResponseDelayMinutes = existing.dndResponseDelayMinutes;
    return preserveAutonomousScheduleControls(merged, existing);
  }

  function preserveAutonomousScheduleControls(schedule: WeekSchedule, existing: WeekSchedule): WeekSchedule {
    const merged: WeekSchedule = { ...schedule };
    if (typeof existing.autonomousDailyCapOverride === "number") {
      merged.autonomousDailyCapOverride = existing.autonomousDailyCapOverride;
    } else if (existing.autonomousDailyCapOverride === null) {
      merged.autonomousDailyCapOverride = null;
    }
    if (Array.isArray(existing.disabledAutonomousIntents)) {
      merged.disabledAutonomousIntents = existing.disabledAutonomousIntents;
    }
    return merged;
  }

  app.put<{
    Body: { timeZone?: unknown };
  }>("/schedule/timezone", async (req, reply) => {
    const timeZone = normalizePromptTimeZone(req.body.timeZone);
    if (!timeZone) return reply.status(400).send({ error: "timeZone must be a valid IANA timezone" });
    const updatedChats = await rememberConversationTimeZone(timeZone);
    return reply.send({ timeZone, updatedChats });
  });

  app.post<{
    Body: {
      chatId: string;
      characterId: string;
      mode: "week" | "day";
      day?: string;
      schedule?: WeekSchedule;
      guidance?: string;
      dayGuidance?: string;
      draftMode?: string;
      timeZone?: unknown;
    };
  }>("/schedule/draft", async (req, reply) => {
    const { chatId, characterId, mode } = req.body;
    const guidance = typeof req.body.guidance === "string" ? req.body.guidance.trim() : "";
    const dayGuidance = typeof req.body.dayGuidance === "string" ? req.body.dayGuidance.trim() : "";
    const context = await resolveScheduleGenerationContext(chatId, characterId);
    if ("error" in context) return reply.status(context.errorStatus ?? 400).send({ error: context.error });
    const requestedTimeZone = normalizePromptTimeZone(req.body.timeZone);
    if (req.body.timeZone != null && !requestedTimeZone) {
      return reply.status(400).send({ error: "timeZone must be a valid IANA timezone" });
    }
    if (requestedTimeZone) await rememberConversationTimeZone(requestedTimeZone);
    const contextMeta =
      typeof context.chat.metadata === "string" ? JSON.parse(context.chat.metadata) : (context.chat.metadata ?? {});
    const scheduleTimeZone = requestedTimeZone ?? resolveConversationTimeZone(contextMeta);
    const scheduleNow = toZonedWallClockDate(new Date(), scheduleTimeZone);
    const { charData, provider, model } = context;

    try {
      if (mode === "day") {
        const day = typeof req.body.day === "string" ? req.body.day : "";
        if (!CONVERSATION_SCHEDULE_DAYS.includes(day)) return reply.status(400).send({ error: "Invalid schedule day" });
        if (!req.body.schedule) return reply.status(400).send({ error: "schedule is required for day regeneration" });
        const { blocks } = await generateCharacterDaySchedule(
          provider,
          model,
          charData.name,
          charData.description ?? "",
          charData.personality ?? "",
          day,
          req.body.schedule,
          guidance,
          dayGuidance,
          scheduleTimeZone,
        );
        return reply.send({ day, blocks });
      }

      const { schedule } = await generateCharacterSchedule(
        provider,
        model,
        charData.name,
        charData.description ?? "",
        charData.personality ?? "",
        guidance,
        req.body.schedule
          ? `Current draft schedule:\n${summarizePreviousSchedule(req.body.schedule).join("\n")}`
          : undefined,
        {
          draftMode: parseWeekScheduleDraftMode(req.body.draftMode),
          timeZone: scheduleTimeZone,
        },
      );
      const fullSchedule = preserveDraftScheduleFields(
        { ...schedule, weekStart: getMonday(scheduleNow).toISOString() },
        req.body.schedule,
      );
      return reply.send({ schedule: fullSchedule });
    } catch (error) {
      logger.error(error instanceof Error ? error : undefined, "[schedule] Draft generation failed");
      return reply.status(502).send({ error: getScheduleGenerationError(error, "Schedule draft generation failed") });
    }
  });

  app.post<{
    Body: {
      chatId: string;
      characterId: string;
      schedule: WeekSchedule;
      guidance?: string;
    };
  }>("/schedule/summary", async (req, reply) => {
    const { chatId, characterId, schedule } = req.body;
    if (!schedule) return reply.status(400).send({ error: "schedule is required" });
    const guidance = typeof req.body.guidance === "string" ? req.body.guidance.trim() : "";
    const context = await resolveScheduleGenerationContext(chatId, characterId);
    if ("error" in context) return reply.status(context.errorStatus ?? 400).send({ error: context.error });
    const { charData, provider, model } = context;
    try {
      const { summary } = await generateScheduleRoutineSummary(provider, model, charData.name, schedule, guidance);
      return reply.send({ summary, generatedAt: new Date().toISOString() });
    } catch (error) {
      logger.error(error instanceof Error ? error : undefined, "[schedule] Summary generation failed");
      return reply.status(502).send({ error: getScheduleGenerationError(error, "Schedule summary generation failed") });
    }
  });

  // ─────────────────────────────────────────────
  // POST /schedule/generate — Generate or refresh weekly schedules
  // ─────────────────────────────────────────────
  app.post<{
    Body: {
      chatId: string;
      forceRefresh?: boolean;
      characterIds?: string[];
      scheduleGenerationPreferences?: string;
      timeZone?: unknown;
    };
  }>("/schedule/generate", async (req, reply) => {
    const { chatId, forceRefresh } = req.body;
    // Runtime guard: TypeScript's Body type is compile-time only. If a client sends a non-string,
    // .trim() would throw and surface as a 500. Reject explicitly with 400 instead.
    const rawPrefs: unknown = req.body.scheduleGenerationPreferences;
    if (rawPrefs != null && typeof rawPrefs !== "string") {
      return reply.status(400).send({ error: "scheduleGenerationPreferences must be a string" });
    }
    const userSchedulePreferences = typeof rawPrefs === "string" ? rawPrefs.trim() : "";

    const chat = await chats.getById(chatId);
    if (!chat) return reply.status(404).send({ error: "Chat not found" });
    if (chat.mode !== "conversation") return reply.status(400).send({ error: "Not a conversation chat" });
    const requestedTimeZone = normalizePromptTimeZone(req.body.timeZone);
    if (req.body.timeZone != null && !requestedTimeZone) {
      return reply.status(400).send({ error: "timeZone must be a valid IANA timezone" });
    }
    if (requestedTimeZone) await rememberConversationTimeZone(requestedTimeZone);

    // Resolve connection (need decrypted API key; "random" is a sentinel, not a persisted connection id)
    const { conn, error: connectionError } = await resolveConversationScheduleConnection(
      connections,
      chat.connectionId,
    );
    if (!conn) return reply.status(400).send({ error: connectionError ?? "No connection configured" });
    const baseUrl = resolveBaseUrl(conn);
    if (!baseUrl) return reply.status(400).send({ error: "No base URL" });

    const meta = typeof chat.metadata === "string" ? JSON.parse(chat.metadata) : (chat.metadata ?? {});
    if (requestedTimeZone) meta.conversationTimeZone = requestedTimeZone;
    const scheduleTimeZone = requestedTimeZone ?? resolveConversationTimeZone(meta);
    const nowInstant = new Date();
    const scheduleNow = toZonedWallClockDate(nowInstant, scheduleTimeZone);
    const existingSchedules: CharacterSchedules = hasSchedules(meta.characterSchedules) ? meta.characterSchedules : {};
    // Prefer client-supplied characterIds (avoids race condition with DB persistence)
    const characterIds: string[] =
      Array.isArray(req.body.characterIds) && req.body.characterIds.length > 0
        ? req.body.characterIds
        : typeof chat.characterIds === "string"
          ? JSON.parse(chat.characterIds)
          : chat.characterIds;

    const provider = await createConversationAgentProvider(conn, baseUrl);
    const model = conn.model ?? "";
    const mondayStr = getMonday(scheduleNow).toISOString();

    const preserveTimingSettings = (schedule: WeekSchedule, existing?: WeekSchedule): WeekSchedule => {
      if (!existing) {
        return schedule;
      }
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
      return preserveAutonomousScheduleControls(merged, existing);
    };

    const newSchedules: CharacterSchedules = { ...existingSchedules };
    const results: Record<string, { status: string; schedule?: WeekSchedule }> = {};

    // Pre-fetch schedules from other conversation chats so we can reuse them
    // instead of generating from scratch. This makes schedules shared across chats.
    let otherChatSchedules: Map<string, WeekSchedule> | null = null;
    const getOtherChatSchedules = async (): Promise<Map<string, WeekSchedule>> => {
      if (otherChatSchedules) return otherChatSchedules;
      otherChatSchedules = new Map();
      const allChats = await chats.list();
      for (const c of allChats) {
        if (c.id === chatId || c.mode !== "conversation") continue;
        const m = typeof c.metadata === "string" ? JSON.parse(c.metadata as string) : (c.metadata ?? {});
        if (!areConversationSchedulesEnabled(m)) continue;
        const scheds: CharacterSchedules = getEnabledConversationSchedules(m);
        for (const [cid, sched] of Object.entries(scheds)) {
          if (sched && !otherChatSchedules.has(cid) && !scheduleNeedsRefresh(sched, scheduleNow)) {
            otherChatSchedules.set(cid, sched);
          }
        }
      }
      return otherChatSchedules;
    };

    for (const charId of characterIds) {
      // Check if schedule exists and is fresh
      const existing = existingSchedules[charId];
      if (existing && !forceRefresh && !scheduleNeedsRefresh(existing, scheduleNow)) {
        results[charId] = { status: "fresh" };
        continue;
      }

      // Check if this character has a fresh schedule in another chat
      if (!forceRefresh) {
        const shared = (await getOtherChatSchedules()).get(charId);
        if (shared) {
          const mergedShared = preserveTimingSettings(shared, existing);
          newSchedules[charId] = mergedShared;
          // Update character's conversationStatus to match
          const charRow = await chars.getById(charId);
          if (charRow) {
            const charData = JSON.parse(charRow.data as string) as CharacterData;
            const statusOverrides = parseConversationStatusOverrides(meta.conversationStatusOverrides);
            const { status } = getEffectiveCurrentStatus(
              mergedShared,
              statusOverrides[charId],
              nowInstant,
              "free time",
              scheduleNow,
            );
            const extensions = { ...(charData.extensions ?? {}), conversationStatus: status };
            await chars.update(charId, { extensions } as Partial<CharacterData>, undefined, {
              skipVersionSnapshot: true,
            });
          }
          results[charId] = { status: "shared", schedule: mergedShared };
          continue;
        }
      }

      // Load character data
      const charRow = await chars.getById(charId);
      if (!charRow) {
        results[charId] = { status: "not_found" };
        continue;
      }
      const charData = JSON.parse(charRow.data as string) as CharacterData;

      // Skip built-in assistants — they don't need generated schedules
      if (charData.extensions?.isBuiltInAssistant) {
        results[charId] = { status: "skipped_assistant" };
        continue;
      }

      try {
        logger.info("[schedule] Generating schedule for %s (%s)...", charData.name, charId);
        const recentContinuityContext = existing
          ? buildScheduleContinuityContext({ meta, charData, existingSchedule: existing })
          : undefined;
        const { schedule } = await generateCharacterSchedule(
          provider,
          model,
          charData.name,
          charData.description ?? "",
          charData.personality ?? "",
          userSchedulePreferences,
          recentContinuityContext,
          { timeZone: scheduleTimeZone },
        );
        logger.info("[schedule] Generated schedule for %s, days: %s", charData.name, Object.keys(schedule.days ?? {}));

        const fullSchedule = preserveTimingSettings(
          {
            ...schedule,
            weekStart: mondayStr,
          },
          existing,
        );
        newSchedules[charId] = fullSchedule;

        // Update character's conversationStatus to match current schedule
        const statusOverrides = parseConversationStatusOverrides(meta.conversationStatusOverrides);
        const { status } = getEffectiveCurrentStatus(
          fullSchedule,
          statusOverrides[charId],
          nowInstant,
          "free time",
          scheduleNow,
        );
        const extensions = { ...(charData.extensions ?? {}), conversationStatus: status };
        await chars.update(charId, { extensions } as Partial<CharacterData>, undefined, {
          skipVersionSnapshot: true,
        });

        results[charId] = { status: "generated", schedule: fullSchedule };
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Schedule generation failed";
        logger.error(err instanceof Error ? err : undefined, "[schedule] ERROR for %s: %s", charData.name, msg);
        results[charId] = { status: `error: ${msg}` };
      }
    }

    // Only save if we actually have schedules to persist (avoids overwriting real data with empty object)
    if (Object.keys(newSchedules).length > 0) {
      const changedCharIds = Object.entries(results)
        .filter(([, result]) => result.status === "generated" || result.status === "shared")
        .map(([id]) => id);
      if (changedCharIds.length > 0) {
        await chats.patchMetadata(chatId, (current) => {
          const currentSchedules: CharacterSchedules = hasSchedules(current.characterSchedules)
            ? (current.characterSchedules as CharacterSchedules)
            : {};
          const mergedSchedules: CharacterSchedules = { ...currentSchedules };
          for (const id of changedCharIds) {
            mergedSchedules[id] = preserveTimingSettings(newSchedules[id]!, currentSchedules[id]);
          }
          return {
            conversationSchedulesEnabled: true,
            characterSchedules: mergedSchedules,
            scheduleWeekStart: mondayStr,
          };
        });
      }

      // Sync newly generated schedules to other conversation chats that use the same characters
      const generatedCharIds = Object.entries(results)
        .filter(([, r]) => r.status === "generated")
        .map(([id]) => id);
      if (generatedCharIds.length > 0) {
        const allChats = await chats.list();
        for (const c of allChats) {
          if (c.id === chatId || c.mode !== "conversation") continue;
          const cCharIds: string[] =
            typeof c.characterIds === "string" ? JSON.parse(c.characterIds as string) : (c.characterIds as string[]);
          const overlap = generatedCharIds.filter((id) => cCharIds.includes(id));
          if (overlap.length === 0) continue;
          const cMeta = typeof c.metadata === "string" ? JSON.parse(c.metadata as string) : (c.metadata ?? {});
          if (!areConversationSchedulesEnabled(cMeta)) continue;
          const cSchedules: CharacterSchedules = hasSchedules(cMeta.characterSchedules) ? cMeta.characterSchedules : {};
          await chats.patchMetadata(c.id, (current) => {
            if (!areConversationSchedulesEnabled(current)) {
              return {};
            }
            const currentSchedules: CharacterSchedules = hasSchedules(current.characterSchedules)
              ? (current.characterSchedules as CharacterSchedules)
              : {};
            const mergedSchedules: CharacterSchedules = { ...currentSchedules };
            for (const cid of overlap) {
              mergedSchedules[cid] = preserveTimingSettings(
                newSchedules[cid]!,
                currentSchedules[cid] ?? cSchedules[cid],
              );
            }
            return {
              conversationSchedulesEnabled: true,
              characterSchedules: mergedSchedules,
              scheduleWeekStart: mondayStr,
            };
          });
        }
      }
    }

    return reply.send({ results, schedules: newSchedules });
  });

  // ─────────────────────────────────────────────
  // GET /status/:chatId — Get current status for all characters in a chat
  // ─────────────────────────────────────────────
  app.get<{
    Params: { chatId: string };
  }>("/status/:chatId", async (req, reply) => {
    const chat = await chats.getById(req.params.chatId);
    if (!chat) return reply.status(404).send({ error: "Chat not found" });

    const [schedules, lastContactMap] = await Promise.all([
      chats.inheritFreshConversationSchedules(req.params.chatId),
      chats.lastContactByCharacter(req.params.chatId),
    ]);
    const characterIds: string[] =
      typeof chat.characterIds === "string" ? JSON.parse(chat.characterIds) : chat.characterIds;
    const meta = typeof chat.metadata === "string" ? JSON.parse(chat.metadata) : (chat.metadata ?? {});
    const statusOverrides = parseConversationStatusOverrides(meta.conversationStatusOverrides);

    const now = new Date();
    const scheduleNow = toZonedWallClockDate(now, resolveConversationTimeZone(meta));
    const statuses: Record<
      string,
      { status: string; activity: string; schedule?: WeekSchedule; override?: object; lastContact?: string }
    > = {};

    for (const charId of characterIds) {
      const schedule = schedules[charId];
      if (!schedule) {
        const { status, activity, override } = getEffectiveCurrentStatus(
          null,
          statusOverrides[charId],
          now,
          "",
          scheduleNow,
        );
        const charRow = await chars.getById(charId);
        if (charRow) {
          const charData = JSON.parse(charRow.data as string) as CharacterData;
          const currentExtensions = (charData.extensions as Record<string, unknown> | undefined) ?? {};
          if (currentExtensions.conversationStatus !== status || currentExtensions.conversationActivity !== activity) {
            const extensions: Record<string, unknown> = {
              ...currentExtensions,
              conversationStatus: status,
              conversationActivity: activity,
            };
            await chars.update(charId, { extensions } as Partial<CharacterData>, undefined, {
              skipVersionSnapshot: true,
            });
          }
        }
        statuses[charId] = { status, activity, override, lastContact: lastContactMap[charId] };
        continue;
      }
      const { status, activity, override } = getEffectiveCurrentStatus(
        schedule,
        statusOverrides[charId],
        now,
        "free time",
        scheduleNow,
      );

      // Sync the character's conversationStatus in the database
      const charRow = await chars.getById(charId);
      if (charRow) {
        const charData = JSON.parse(charRow.data as string) as CharacterData;
        if (
          charData.extensions?.conversationStatus !== status ||
          charData.extensions?.conversationActivity !== activity
        ) {
          const extensions = {
            ...(charData.extensions ?? {}),
            conversationStatus: status,
            conversationActivity: activity,
          };
          await chars.update(charId, { extensions } as Partial<CharacterData>, undefined, {
            skipVersionSnapshot: true,
          });
        }
      }

      statuses[charId] = { status, activity, schedule, override, lastContact: lastContactMap[charId] };
    }

    return reply.send({
      statuses,
      needsRefresh: Object.values(schedules).some((schedule) => scheduleNeedsRefresh(schedule, scheduleNow)),
    });
  });

  // ─────────────────────────────────────────────
  // POST /activity/user — Record user activity (called on message send)
  // ─────────────────────────────────────────────
  app.post<{
    Body: { chatId: string; preserveGenerationInProgress?: boolean };
  }>("/activity/user", async (req, reply) => {
    recordUserActivity(req.body.chatId, {
      preserveGenerationInProgress: req.body.preserveGenerationInProgress === true,
    });
    return reply.send({ ok: true });
  });

  // ─────────────────────────────────────────────
  // POST /activity/assistant — Record assistant activity
  // ─────────────────────────────────────────────
  app.post<{
    Body: { chatId: string; characterId?: string };
  }>("/activity/assistant", async (req, reply) => {
    recordAssistantActivity(req.body.chatId, req.body.characterId);
    return reply.send({ ok: true });
  });

  // ─────────────────────────────────────────────
  // POST /activity/presence — Record connected client autonomous-poller presence
  // ─────────────────────────────────────────────
  app.post<{
    Body: { chatId: string; userStatus?: AutonomousUserStatus };
  }>("/activity/presence", async (req, reply) => {
    recordAutonomousClientPresence(req.body.chatId, normalizeAutonomousUserStatus(req.body.userStatus));
    return reply.send({ ok: true });
  });

  // ─────────────────────────────────────────────
  // POST /autonomous/check — Check if autonomous message should trigger
  // ─────────────────────────────────────────────
  app.post<{
    Body: { chatId: string; userStatus?: AutonomousUserStatus; maxFollowups?: number; source?: "client" | "server" };
  }>("/autonomous/check", async (req, reply) => {
    const { chatId } = req.body;
    const userStatus = normalizeAutonomousUserStatus(req.body.userStatus);
    if (req.body.source !== "server") {
      recordAutonomousClientPresence(chatId, userStatus);
    }
    const chat = await chats.getById(chatId);
    if (!chat) return reply.status(404).send({ error: "Chat not found" });

    const meta = typeof chat.metadata === "string" ? JSON.parse(chat.metadata) : (chat.metadata ?? {});
    const promptTimeZone = resolveConversationTimeZone(meta);
    const nowInstant = new Date();
    const promptNow = toZonedWallClockDate(nowInstant, promptTimeZone);

    // Check if autonomous messages are enabled
    if (!meta.autonomousMessages) {
      return reply.send({ shouldTrigger: false, characterIds: [], reason: "disabled", inactivityMs: 0 });
    }

    if (userStatus === "dnd") {
      return reply.send({ shouldTrigger: false, characterIds: [], reason: "user_dnd", inactivityMs: 0 });
    }

    const schedules: CharacterSchedules = await chats.inheritFreshConversationSchedules(chatId);
    const characterIds: string[] =
      typeof chat.characterIds === "string" ? JSON.parse(chat.characterIds) : chat.characterIds;
    const isGroup = characterIds.length > 1;
    const hasRoutineSchedules = hasSchedules(schedules);
    const statusOverrides = parseConversationStatusOverrides(meta.conversationStatusOverrides);

    const autonomySchedules: CharacterSchedules = { ...schedules };
    const schedulelessCharacterIds = characterIds.filter((cid) => !autonomySchedules[cid]);
    for (const cid of schedulelessCharacterIds) {
      const charRow = await chars.getById(cid);
      autonomySchedules[cid] = createSchedulelessAutonomySchedule(
        getCharacterCardTalkativeness(charRow?.data),
        userStatus,
      );
    }

    // Update each character's conversationStatus to match current schedule
    for (const cid of characterIds) {
      const schedule = schedules[cid];
      if (!schedule) continue;
      const { status } = getEffectiveCurrentStatus(schedule, statusOverrides[cid], nowInstant, "free time", promptNow);
      const charRow = await chars.getById(cid);
      if (!charRow) continue;
      const charData = JSON.parse(charRow.data as string);
      const currentStatus = charData.extensions?.conversationStatus;
      if (currentStatus !== status) {
        const extensions = { ...(charData.extensions ?? {}), conversationStatus: status };
        await chars.update(cid, { extensions } as any, undefined, { skipVersionSnapshot: true });
      }
    }

    // Initialize activity state from DB if not already in memory (handles server restart / fresh load)
    const messages = await chats.listMessages(chatId);
    initializeActivityFromMessages(
      chatId,
      messages as Array<{ role: string; createdAt?: string; characterId?: string | null }>,
    );

    // Filter out characters busy in an active scene
    const sceneBusyCharIds: string[] = meta.sceneBusyCharIds ?? [];
    const filteredSchedules = { ...autonomySchedules };
    for (const busyId of sceneBusyCharIds) {
      delete filteredSchedules[busyId];
    }

    // Also skip autonomous check entirely if this chat IS an active scene
    if (meta.sceneStatus === "active") {
      return reply.send({ shouldTrigger: false, characterIds: [], reason: "scene_active", inactivityMs: 0 });
    }

    // Skip autonomous while a turn-game (UNO, etc.) is active. The game's bot turns
    // already drive generation; an autonomous message here would seize the chat's
    // single generation lock and 409 the next bot-turn request, stalling the game.
    if (await getActiveTurnGame(app.db, chatId)) {
      return reply.send({ shouldTrigger: false, characterIds: [], reason: "turn_game_active", inactivityMs: 0 });
    }

    const result = checkAutonomousMessaging(chatId, filteredSchedules, isGroup, {
      maxFollowups: req.body.maxFollowups,
      statusOverrides,
      actualNow: nowInstant,
      scheduleNow: promptNow,
    });
    if (result.reason === "generation_in_progress") return reply.send(result);

    if (result.shouldTrigger) {
      let blockedReason: "daily_budget_exhausted" | "intent_cooldown" | null = null;
      for (const characterId of result.characterIds) {
        const evaluation = evaluateAutonomousCandidate(
          chatId,
          characterId,
          autonomySchedules[characterId],
          meta,
          promptNow,
        );
        if (!evaluation.ok) {
          blockedReason = blockedReason ?? evaluation.reason;
          continue;
        }
        const generationStartedAt = markGenerationInProgress(chatId);
        return reply.send({ ...result, characterIds: [characterId], generationStartedAt, ...evaluation.intent });
      }
      if (blockedReason) return reply.send(blockedAutonomousResponse(blockedReason));
    }

    const longAbsence = resolveLongAbsenceCandidate(
      chatId,
      filteredSchedules,
      statusOverrides,
      meta,
      nowInstant,
      promptNow,
    );
    if (longAbsence) {
      if ("blockedReason" in longAbsence) return reply.send(blockedAutonomousResponse(longAbsence.blockedReason));
      const state = getActivityState(chatId);
      const generationStartedAt = markGenerationInProgress(chatId);
      return reply.send({
        shouldTrigger: true,
        characterIds: [longAbsence.characterId],
        reason: "user_inactivity",
        inactivityMs: state?.lastUserMessageAt ? Date.now() - state.lastUserMessageAt : 0,
        generationStartedAt,
        ...longAbsence.intent,
      });
    }

    // ── Offline catch-up: if any character is now online and last messages are from user ──
    // This catches the case where user sent messages while character was offline.
    // Now that they're online, trigger a catch-up generation.
    if (hasRoutineSchedules) {
      const onlineCharIds = characterIds.filter((cid) => {
        if (sceneBusyCharIds.includes(cid)) return false;
        const schedule = autonomySchedules[cid];
        const { status } = getEffectiveCurrentStatus(
          schedule,
          statusOverrides[cid],
          nowInstant,
          "free time",
          promptNow,
        );
        return status !== "offline";
      });

      if (onlineCharIds.length > 0 && messages.length > 0) {
        // Check if the last message (or consecutive last messages) are all from the user
        const last = messages[messages.length - 1]!;
        if (last.role === "user") {
          let blockedReason: "daily_budget_exhausted" | "intent_cooldown" | null = null;
          for (const catchUpCharacterId of onlineCharIds) {
            const evaluation = evaluateAutonomousCandidate(
              chatId,
              catchUpCharacterId,
              autonomySchedules[catchUpCharacterId],
              meta,
              promptNow,
            );
            if (!evaluation.ok) {
              blockedReason = blockedReason ?? evaluation.reason;
              continue;
            }
            const generationStartedAt = markGenerationInProgress(chatId);
            return reply.send({
              shouldTrigger: true,
              characterIds: [catchUpCharacterId],
              reason: "user_inactivity",
              inactivityMs: 0,
              generationStartedAt,
              ...evaluation.intent,
            });
          }
          if (blockedReason) return reply.send(blockedAutonomousResponse(blockedReason));
        }
      }
    }

    return reply.send(result);
  });

  // ─────────────────────────────────────────────
  // POST /autonomous/clear-in-progress — Clear a claimed autonomous generation marker
  // ─────────────────────────────────────────────
  app.post<{
    Body: { chatId: string; startedAt?: number };
  }>("/autonomous/clear-in-progress", async (req, reply) => {
    const startedAt =
      typeof req.body.startedAt === "number" && Number.isFinite(req.body.startedAt) ? req.body.startedAt : undefined;
    clearGenerationInProgress(req.body.chatId, startedAt);
    return reply.send({ ok: true });
  });

  // ─────────────────────────────────────────────
  // POST /busy-delay — Calculate response delay based on character status
  // ─────────────────────────────────────────────
  app.post<{
    Body: { chatId: string; characterId: string };
  }>("/busy-delay", async (req, reply) => {
    const { chatId, characterId } = req.body;
    const chat = await chats.getById(chatId);
    if (!chat) return reply.status(404).send({ error: "Chat not found" });

    const schedules: CharacterSchedules = await chats.inheritFreshConversationSchedules(chatId);
    const schedule = schedules[characterId];
    const meta = typeof chat.metadata === "string" ? JSON.parse(chat.metadata) : (chat.metadata ?? {});
    const statusOverrides = parseConversationStatusOverrides(meta.conversationStatusOverrides);
    const now = new Date();
    const scheduleNow = toZonedWallClockDate(now, resolveConversationTimeZone(meta));

    if (!schedule) {
      const { status, activity } = getEffectiveCurrentStatus(
        null,
        statusOverrides[characterId],
        now,
        "",
        scheduleNow,
      );
      return reply.send({ delayMs: getBusyDelay(status), status, activity });
    }

    const { status, activity } = getEffectiveCurrentStatus(
      schedule,
      statusOverrides[characterId],
      now,
      "free time",
      scheduleNow,
    );
    const delayMs = getBusyDelay(status, schedule);

    return reply.send({ delayMs, status, activity });
  });

  // ─────────────────────────────────────────────
  // POST /autonomous/exchange — Check if another character wants to reply in a group chat
  // ─────────────────────────────────────────────
  app.post<{
    Body: { chatId: string; lastSpeakerCharId: string };
  }>("/autonomous/exchange", async (req, reply) => {
    const { chatId, lastSpeakerCharId } = req.body;
    const chat = await chats.getById(chatId);
    if (!chat) return reply.status(404).send({ error: "Chat not found" });

    const meta = typeof chat.metadata === "string" ? JSON.parse(chat.metadata) : (chat.metadata ?? {});
    const characterIds: string[] =
      typeof chat.characterIds === "string" ? JSON.parse(chat.characterIds) : chat.characterIds;

    // Only relevant for group chats
    if (characterIds.length < 2) {
      return reply.send({ shouldTrigger: false, characterIds: [], reason: "not_group", inactivityMs: 0 });
    }

    // Respect the characterExchanges toggle
    if (!meta.characterExchanges) {
      return reply.send({ shouldTrigger: false, characterIds: [], reason: "exchanges_disabled", inactivityMs: 0 });
    }

    const schedules: CharacterSchedules = await chats.inheritFreshConversationSchedules(chatId);
    const statusOverrides = parseConversationStatusOverrides(meta.conversationStatusOverrides);
    const now = new Date();
    const scheduleNow = toZonedWallClockDate(now, resolveConversationTimeZone(meta));
    const sceneBusyCharIds: string[] = meta.sceneBusyCharIds ?? [];
    const filteredSchedules = { ...schedules };
    for (const busyId of sceneBusyCharIds) {
      delete filteredSchedules[busyId];
    }
    const messages = await chats.listMessages(chatId);
    initializeActivityFromMessages(
      chatId,
      messages as Array<{ role: string; createdAt?: string; characterId?: string | null }>,
    );

    const result = checkCharacterExchange(chatId, lastSpeakerCharId, filteredSchedules, statusOverrides, now, scheduleNow);
    if (result.shouldTrigger) {
      const allowedCharacterId = result.characterIds.find(
        (characterId) => !isAutonomousDailyBudgetExhausted(characterId, schedules[characterId], meta),
      );
      if (!allowedCharacterId) {
        return reply.send({
          shouldTrigger: false,
          characterIds: [],
          reason: "daily_budget_exhausted",
          inactivityMs: 0,
        });
      }
      const generationStartedAt = markGenerationInProgress(chatId);
      return reply.send({ ...result, characterIds: [allowedCharacterId], generationStartedAt });
    }
    return reply.send(result);
  });
}
