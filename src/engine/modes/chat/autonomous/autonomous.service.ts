import type { StorageGateway } from "../../../capabilities/storage";
import { getBusyDelay, getCurrentStatus, getMonday, type WeekSchedule } from "../schedules/schedule.service.js";

// ── Types ──

export interface AutonomousCheckResult {
  /** Whether an autonomous message should be triggered */
  shouldTrigger: boolean;
  /** Which character(s) should send a message */
  characterIds: string[];
  /** Why this was triggered */
  reason: "user_inactivity" | "character_exchange" | "none" | "disabled" | "user_dnd" | "scene_active" | "waiting";
  /** How long the user has been inactive (ms) */
  inactivityMs: number;
}

export interface ConversationStatusResult {
  statuses: Record<string, { status: string; activity: string; schedule?: unknown }>;
  needsRefresh: boolean;
}

export interface BusyDelayResult {
  delayMs: number;
  status: string;
  activity: string;
}

type StoredChat = {
  id?: unknown;
  characterIds?: unknown;
  metadata?: unknown;
};

type StoredMessage = {
  role?: unknown;
  createdAt?: unknown;
  characterId?: unknown;
};

type UserStatus = "active" | "idle" | "dnd";

const AUTONOMOUS_ACTIVITY_MESSAGE_LIMIT = 80;
const AUTONOMOUS_ACTIVITY_MESSAGE_FIELDS = ["role", "createdAt", "characterId"];

function metadataRecord(value: unknown): Record<string, unknown> {
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function chatCharacterIds(chat: StoredChat): string[] {
  return Array.isArray(chat.characterIds)
    ? chat.characterIds.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    : [];
}

async function requireChat(storage: StorageGateway, chatId: string): Promise<StoredChat> {
  const chat = await storage.get<StoredChat>("chats", chatId);
  if (!chat) throw new Error("Chat was not found");
  return chat;
}

async function chatMessages(storage: StorageGateway, chatId: string): Promise<StoredMessage[]> {
  const rows = await storage.listChatMessages<unknown>(chatId, {
    limit: AUTONOMOUS_ACTIVITY_MESSAGE_LIMIT,
    fields: AUTONOMOUS_ACTIVITY_MESSAGE_FIELDS,
  });
  return Array.isArray(rows) ? (rows as StoredMessage[]) : [];
}

function characterSchedules(meta: Record<string, unknown>): Record<string, WeekSchedule> {
  const raw = metadataRecord(meta.characterSchedules);
  return raw as Record<string, WeekSchedule>;
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function characterTalkativeness(character: unknown): number {
  const row = metadataRecord(character);
  const data = metadataRecord(row.data);
  const extensions = metadataRecord(data.extensions);
  const raw = extensions.talkativeness;
  const value = typeof raw === "number" ? raw : typeof raw === "string" && raw.trim() ? Number(raw) : NaN;
  if (!Number.isFinite(value)) return 50;
  return clampPercent(value <= 1 ? value * 100 : value);
}

function schedulelessInactivityThresholdMinutes(talkativeness: number, userStatus: UserStatus): number {
  const chatty = clampPercent(talkativeness) / 100;
  const minMinutes = userStatus === "idle" ? 10 : 30;
  const maxMinutes = userStatus === "idle" ? 180 : 360;
  return Math.round(maxMinutes - (maxMinutes - minMinutes) * chatty);
}

function createSchedulelessAutonomySchedule(talkativeness: number, userStatus: UserStatus): WeekSchedule {
  return {
    weekStart: getMonday().toISOString(),
    days: {},
    inactivityThresholdMinutes: schedulelessInactivityThresholdMinutes(talkativeness, userStatus),
    talkativeness,
  };
}

function stringSet(value: unknown): Set<string> {
  return new Set(
    Array.isArray(value)
      ? value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
      : [],
  );
}

export async function getConversationStatus(
  storage: StorageGateway,
  chatId: string,
): Promise<ConversationStatusResult> {
  const chat = await requireChat(storage, chatId);
  const schedules = characterSchedules(metadataRecord(chat.metadata));
  const statuses: ConversationStatusResult["statuses"] = {};
  for (const characterId of chatCharacterIds(chat)) {
    const schedule = schedules[characterId];
    const status = schedule ? getCurrentStatus(schedule) : null;
    statuses[characterId] = {
      status: status?.status ?? "online",
      activity: status?.activity ?? (schedule ? "scheduled" : "unknown (no schedule)"),
      schedule,
    };
  }
  return { statuses, needsRefresh: false };
}

export async function checkConversationAutonomous(
  storage: StorageGateway,
  input: { chatId: string; userStatus?: string; maxFollowups?: number },
): Promise<AutonomousCheckResult> {
  const chat = await requireChat(storage, input.chatId);
  const meta = metadataRecord(chat.metadata);
  const userStatus: UserStatus =
    input.userStatus === "idle" || input.userStatus === "dnd" ? input.userStatus : "active";
  const disabled = meta.autonomousMessages !== true;
  if (disabled) return { shouldTrigger: false, characterIds: [], reason: "disabled", inactivityMs: 0 };
  if (userStatus === "dnd") return { shouldTrigger: false, characterIds: [], reason: "user_dnd", inactivityMs: 0 };
  if (meta.sceneStatus === "active")
    return { shouldTrigger: false, characterIds: [], reason: "scene_active", inactivityMs: 0 };

  const messages = await chatMessages(storage, input.chatId);
  initializeActivityFromMessages(
    input.chatId,
    messages.map((message) => ({
      role: typeof message.role === "string" ? message.role : "message",
      createdAt: typeof message.createdAt === "string" ? message.createdAt : undefined,
      characterId: typeof message.characterId === "string" ? message.characterId : null,
    })),
  );

  const ids = chatCharacterIds(chat);
  const schedules = characterSchedules(meta);
  const autonomySchedules: Record<string, WeekSchedule> = { ...schedules };
  await Promise.all(
    ids
      .filter((characterId) => !autonomySchedules[characterId])
      .map(async (characterId) => {
        const character = await storage.get("characters", characterId);
        autonomySchedules[characterId] = createSchedulelessAutonomySchedule(
          characterTalkativeness(character),
          userStatus,
        );
      }),
  );

  const sceneBusyIds = stringSet(meta.sceneBusyCharIds);
  for (const busyId of sceneBusyIds) {
    delete autonomySchedules[busyId];
  }

  const scheduled = checkAutonomousMessaging(input.chatId, autonomySchedules, ids.length > 1, {
    maxFollowups: input.maxFollowups,
  });
  if (scheduled.shouldTrigger) return scheduled;

  if (Object.keys(schedules).length > 0) {
    const last = messages[messages.length - 1];
    if (last?.role === "user") {
      const onlineIds = ids.filter((characterId) => {
        if (sceneBusyIds.has(characterId)) return false;
        const status = getCurrentStatus(schedules[characterId] ?? autonomySchedules[characterId]!);
        return status.status !== "offline";
      });
      if (onlineIds.length > 0) {
        return {
          shouldTrigger: true,
          characterIds: [onlineIds[0]!],
          reason: "user_inactivity",
          inactivityMs: 0,
        };
      }
    }
  }

  return { shouldTrigger: false, characterIds: [], reason: "waiting", inactivityMs: 0 };
}

export async function getConversationBusyDelay(
  storage: StorageGateway,
  input: { chatId: string; characterId: string },
): Promise<BusyDelayResult> {
  const chat = await requireChat(storage, input.chatId);
  const schedule = characterSchedules(metadataRecord(chat.metadata))[input.characterId];
  const current = schedule ? getCurrentStatus(schedule) : null;
  const status = current?.status ?? "online";
  return {
    delayMs: getBusyDelay(status, schedule),
    status,
    activity: current?.activity ?? (schedule ? "scheduled" : "unknown"),
  };
}

export async function checkConversationCharacterExchange(
  storage: StorageGateway,
  input: { chatId: string; lastSpeakerCharId: string },
): Promise<AutonomousCheckResult> {
  const chat = await requireChat(storage, input.chatId);
  const meta = metadataRecord(chat.metadata);
  if (meta.characterExchanges !== true) {
    return { shouldTrigger: false, characterIds: [], reason: "disabled", inactivityMs: 0 };
  }
  return checkCharacterExchange(input.chatId, input.lastSpeakerCharId, characterSchedules(meta));
}

export type AutonomousClientPresenceStatus = "active" | "idle" | "dnd";

/** Auto-reset generationInProgress after this many ms (5 minutes) */
const GENERATION_TIMEOUT_MS = 5 * 60 * 1000;

interface ChatActivityState {
  /** Timestamp of the last user message */
  lastUserMessageAt: number;
  /** Timestamp of the last assistant message */
  lastAssistantMessageAt: number;
  /** Per-character autonomous message tracking: count sent + timestamp of last autonomous msg */
  autonomousMessages: Map<string, { count: number; lastSentAt: number }>;
  /** Timestamp when generation started, or null if not in progress */
  generationInProgressSince: number | null;
  /** Last status reported by a connected client autonomous poller. */
  clientPresence?: { status: AutonomousClientPresenceStatus; updatedAt: number };
}

// ── In-memory activity tracker ──
// Keyed by chatId. This is intentionally in-memory since it's just timing state.
const activityStates = new Map<string, ChatActivityState>();

/**
 * Record that the user sent a message in a chat.
 */
export function recordUserActivity(chatId: string, opts: { preserveGenerationInProgress?: boolean } = {}): void {
  const now = Date.now();
  const existing = activityStates.get(chatId);
  if (existing) {
    existing.lastUserMessageAt = now;
    existing.autonomousMessages.clear(); // Reset — user is active again
    if (!opts.preserveGenerationInProgress) {
      existing.generationInProgressSince = null;
    }
  } else {
    activityStates.set(chatId, {
      lastUserMessageAt: now,
      lastAssistantMessageAt: 0,
      autonomousMessages: new Map(),
      generationInProgressSince: null,
    });
  }
}

/**
 * Record that an assistant message was sent (either user-triggered or autonomous).
 */
export function recordAssistantActivity(chatId: string, characterId?: string): void {
  const existing = activityStates.get(chatId);
  if (existing) {
    const now = Date.now();
    existing.lastAssistantMessageAt = now;
    if (characterId) {
      const prev = existing.autonomousMessages.get(characterId);
      existing.autonomousMessages.set(characterId, {
        count: (prev?.count ?? 0) + 1,
        lastSentAt: now,
      });
    }
    existing.generationInProgressSince = null;
  }
}

/**
 * Mark that an autonomous generation is in progress for a chat.
 */
export function markGenerationInProgress(chatId: string): number {
  const now = Date.now();
  const state = activityStates.get(chatId);
  if (state) {
    state.generationInProgressSince = now;
  } else {
    activityStates.set(chatId, {
      lastUserMessageAt: 0,
      lastAssistantMessageAt: 0,
      autonomousMessages: new Map(),
      generationInProgressSince: now,
    });
  }
  return now;
}

/**
 * Clear a generation-in-progress marker. If `startedAt` is supplied, only
 * clear the marker that this caller created.
 */
export function clearGenerationInProgress(chatId: string, startedAt?: number): void {
  const state = activityStates.get(chatId);
  if (!state) return;
  if (startedAt != null && state.generationInProgressSince !== startedAt) return;
  state.generationInProgressSince = null;
}

/**
 * Initialize activity state from DB messages if not already tracked in memory.
 * This handles server restarts and fresh page loads — we look at the most recent
 * messages to reconstruct timing state so autonomous messaging can resume.
 */
function initializeActivityFromMessages(
  chatId: string,
  messages: Array<{ role: string; createdAt?: string; characterId?: string | null }>,
): void {
  // Already tracked — don't overwrite
  if (activityStates.has(chatId)) return;
  if (messages.length === 0) return;

  let lastUserAt = 0;
  let lastAssistantAt = 0;

  // Scan messages in reverse to find timestamps efficiently
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]!;
    const ts = msg.createdAt ? new Date(msg.createdAt).getTime() : 0;
    if (msg.role === "user" && !lastUserAt) lastUserAt = ts;
    if (msg.role === "assistant" && !lastAssistantAt) lastAssistantAt = ts;
    if (lastUserAt && lastAssistantAt) break;
  }

  if (!lastUserAt) return; // No user messages — can't initialize

  activityStates.set(chatId, {
    lastUserMessageAt: lastUserAt,
    lastAssistantMessageAt: lastAssistantAt,
    autonomousMessages: new Map(),
    generationInProgressSince: null,
  });
}

export function recordAutonomousClientPresence(
  chatId: string,
  status: AutonomousClientPresenceStatus = "active",
): void {
  const now = Date.now();
  const state = activityStates.get(chatId);
  if (state) {
    state.clientPresence = { status, updatedAt: now };
    return;
  }

  activityStates.set(chatId, {
    lastUserMessageAt: 0,
    lastAssistantMessageAt: 0,
    autonomousMessages: new Map(),
    generationInProgressSince: null,
    clientPresence: { status, updatedAt: now },
  });
}

/**
 * Check whether any character in a chat should send an autonomous message.
 */
function checkAutonomousMessaging(
  chatId: string,
  characterSchedules: Record<string, WeekSchedule>,
  isGroupChat: boolean,
  opts: { maxFollowups?: number } = {},
): AutonomousCheckResult {
  const noTrigger: AutonomousCheckResult = {
    shouldTrigger: false,
    characterIds: [],
    reason: "none",
    inactivityMs: 0,
  };

  const state = activityStates.get(chatId);
  if (!state) return noTrigger;

  // Auto-reset stuck generation flag after timeout
  if (state.generationInProgressSince) {
    if (Date.now() - state.generationInProgressSince > GENERATION_TIMEOUT_MS) {
      state.generationInProgressSince = null;
    } else {
      return noTrigger;
    }
  }

  const now = Date.now();
  const inactivityMs = now - state.lastUserMessageAt;

  // Don't trigger if user has never sent a message (fresh chat)
  if (state.lastUserMessageAt === 0) return noTrigger;

  // ── Check each character for inactivity threshold ──
  const eligibleCharacters: Array<{ id: string; priority: number }> = [];

  // Maximum autonomous follow-ups before a character stops messaging
  const maxFollowups = Math.max(1, Math.min(3, Math.floor(opts.maxFollowups ?? 3)));

  for (const [charId, schedule] of Object.entries(characterSchedules)) {
    const { status } = getCurrentStatus(schedule);

    // Can't send if offline or sleeping
    if (status === "offline") continue;

    // Base inactivity threshold
    const baseThresholdMs =
      status === "dnd"
        ? schedule.inactivityThresholdMinutes * 60 * 1000 * 3 // 3x threshold when busy
        : schedule.inactivityThresholdMinutes * 60 * 1000;

    const prevAutonomous = state.autonomousMessages.get(charId);
    const sentCount = prevAutonomous?.count ?? 0;

    // Cap follow-ups — don't spam the user endlessly
    if (sentCount >= maxFollowups) continue;

    if (sentCount === 0) {
      // First autonomous message — use normal inactivity from user's last message
      if (inactivityMs >= baseThresholdMs) {
        eligibleCharacters.push({
          id: charId,
          priority: schedule.talkativeness + (status === "online" ? 20 : 0),
        });
      }
    } else {
      // Follow-up messages — measure from the last autonomous message, with escalating cooldown
      // Each follow-up doubles the cooldown: 2x, 4x base threshold
      const cooldownMultiplier = Math.pow(2, sentCount);
      const followUpThresholdMs = baseThresholdMs * cooldownMultiplier;
      const timeSinceLastAutonomous = now - (prevAutonomous?.lastSentAt ?? 0);

      if (timeSinceLastAutonomous >= followUpThresholdMs) {
        eligibleCharacters.push({
          id: charId,
          priority: schedule.talkativeness + (status === "online" ? 20 : 0) - sentCount * 10, // Lower priority for repeat messages
        });
      }
    }
  }

  if (eligibleCharacters.length === 0) return noTrigger;

  // Sort by priority (highest first)
  eligibleCharacters.sort((a, b) => b.priority - a.priority);

  if (isGroupChat) {
    // In group chats, potentially multiple characters can exchange
    // but start with just the top character
    return {
      shouldTrigger: true,
      characterIds: [eligibleCharacters[0]!.id],
      reason: "user_inactivity",
      inactivityMs,
    };
  }

  // In DMs, only one character
  return {
    shouldTrigger: true,
    characterIds: [eligibleCharacters[0]!.id],
    reason: "user_inactivity",
    inactivityMs,
  };
}

/**
 * For group chats: check if characters should chat with each other.
 * This is triggered after an assistant message, to see if another character
 * wants to respond to what was just said.
 */
function checkCharacterExchange(
  chatId: string,
  lastSpeakerCharId: string,
  characterSchedules: Record<string, WeekSchedule>,
): AutonomousCheckResult {
  const noTrigger: AutonomousCheckResult = {
    shouldTrigger: false,
    characterIds: [],
    reason: "none",
    inactivityMs: 0,
  };

  const state = activityStates.get(chatId);
  if (!state) return noTrigger;
  if (state.generationInProgressSince) {
    if (Date.now() - state.generationInProgressSince > GENERATION_TIMEOUT_MS) {
      state.generationInProgressSince = null;
    } else {
      return noTrigger;
    }
  }

  // Only allow character exchanges if user has been inactive for at least 30 seconds
  const inactivityMs = Date.now() - state.lastUserMessageAt;
  if (inactivityMs < 30_000) return noTrigger;

  const eligible: Array<{ id: string; weight: number }> = [];

  for (const [charId, schedule] of Object.entries(characterSchedules)) {
    if (charId === lastSpeakerCharId) continue;

    const { status } = getCurrentStatus(schedule);
    if (status === "offline") continue;
    if (status === "dnd") continue; // Busy characters don't join casual exchanges

    // Weight based on talkativeness — more talkative characters more likely to jump in
    eligible.push({ id: charId, weight: schedule.talkativeness });
  }

  if (eligible.length === 0) return noTrigger;

  // Probabilistic: roll dice weighted by talkativeness
  // A character with talkativeness 80 has an 80% chance of responding
  const candidate = eligible[Math.floor(Math.random() * eligible.length)]!;
  const roll = Math.random() * 100;
  if (roll > candidate.weight) return noTrigger;

  return {
    shouldTrigger: true,
    characterIds: [candidate.id],
    reason: "character_exchange",
    inactivityMs,
  };
}

/**
 * Clean up activity state for a chat (when chat is deleted or closed).
 */
export function clearChatActivity(chatId: string): void {
  activityStates.delete(chatId);
}
