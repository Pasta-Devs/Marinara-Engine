import type { FastifyInstance } from "fastify";
import { logger } from "../../lib/logger.js";
import { createChatsStorage } from "../storage/chats.storage.js";
import {
  clearGenerationInProgress,
  getActivityState,
  getRecentAutonomousClientPresence,
} from "./autonomous.service.js";
import {
  isIntentOnCooldown,
  resolveIntent,
  type MessageIntent,
} from "./intent.service.js";
import { getBusyDelay, getEffectiveCurrentStatus, type WeekSchedule } from "./schedule.service.js";
import { parseConversationStatusOverrides } from "../generation/conversation-context-utils.js";

const SERVER_AUTONOMOUS_INITIAL_DELAY_MS = 20_000;
const SERVER_AUTONOMOUS_POLL_MS = 60_000;
const RECENT_CLIENT_PRESENCE_MS = 75_000;
const OFFLINE_MAX_FOLLOWUPS = 2;
const MAX_SERVER_AUTONOMOUS_CONCURRENT_EVALUATIONS = 2;
const AUTONOMOUS_FAILURE_BASE_BACKOFF_MS = 5 * 60_000;
const AUTONOMOUS_FAILURE_MAX_BACKOFF_MS = 60 * 60_000;
const AUTONOMOUS_HARD_FAILURE_BACKOFF_MS = 30 * 60_000;

type AutonomousFailureBackoff = {
  attempts: number;
  nextAllowedAt: number;
  lastError: string;
  hardFailure: boolean;
};

type RawChat = {
  id: string;
  mode?: string | null;
  metadata?: string | Record<string, unknown> | null;
};

type AutonomousCheckResult = {
  shouldTrigger?: boolean;
  characterIds?: string[];
  reason?: string;
  inactivityMs?: number;
  generationStartedAt?: number;
};

function resolveAvailableIntent(
  chatId: string,
  characterId: string,
  schedule: WeekSchedule | null,
  chatMeta: Record<string, unknown>,
): { intent: MessageIntent | null; onCooldown: boolean; disabled: boolean } {
  if (!schedule) return { intent: null, onCooldown: false, disabled: false };

  const state = getActivityState(chatId);
  const msSinceUserLastSpoke = state ? Date.now() - state.lastUserMessageAt : 0;
  const hadUnansweredUserMessage = state ? state.lastUserMessageAt > state.lastAssistantMessageAt : false;
  const intent = resolveIntent(schedule, msSinceUserLastSpoke, hadUnansweredUserMessage);

  return {
    intent,
    onCooldown: isIntentOnCooldown(chatMeta, characterId, intent),
    disabled: intent !== "check_in" && (schedule.disabledAutonomousIntents?.includes(intent) ?? false),
  };
}

function parseMetadata(raw: RawChat["metadata"]): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return raw;
}

function shouldConsiderChat(chat: RawChat): boolean {
  if (chat.mode !== "conversation") return false;
  const meta = parseMetadata(chat.metadata);
  if (meta.internalAssistant === "professor-mari") return false;
  return meta.autonomousMessages === true && meta.sceneStatus !== "active";
}

function parseSsePayload(payload: string): { done: boolean; error: string | null } {
  let done = false;
  let error: string | null = null;

  for (const block of payload.split(/\n\n/u)) {
    const line = block
      .split(/\n/u)
      .find((entry) => entry.startsWith("data:"))
      ?.slice(5)
      .trim();
    if (!line) continue;
    try {
      const event = JSON.parse(line) as { type?: string; data?: unknown };
      if (event.type === "done") done = true;
      if (event.type === "error") {
        error = typeof event.data === "string" ? event.data : "Generation failed";
      }
    } catch {
      continue;
    }
  }

  return { done, error };
}

function isHardGenerationFailure(error: string, statusCode?: number): boolean {
  if (statusCode !== undefined) {
    return statusCode >= 400 && statusCode < 500 && statusCode !== 408 && statusCode !== 409 && statusCode !== 429;
  }
  return /\b(?:400|401|403|404|405|410|422)\b/u.test(error);
}

export function startServerAutonomousScheduler(app: FastifyInstance) {
  const chats = createChatsStorage(app.db);
  const runningChats = new Set<string>();
  const failureBackoffByChat = new Map<string, AutonomousFailureBackoff>();
  let stopped = false;
  let polling = false;
  let pollTimer: ReturnType<typeof setTimeout> | null = null;

  const scheduleNext = (delayMs = SERVER_AUTONOMOUS_POLL_MS) => {
    if (stopped) return;
    if (pollTimer) clearTimeout(pollTimer);
    pollTimer = setTimeout(() => {
      void poll();
    }, delayMs);
    pollTimer.unref?.();
  };

  const isChatOnFailureBackoff = (chatId: string) => {
    const backoff = failureBackoffByChat.get(chatId);
    if (!backoff) return false;
    if (Date.now() < backoff.nextAllowedAt) return true;
    return false;
  };

  const clearFailureBackoff = (chatId: string) => {
    failureBackoffByChat.delete(chatId);
  };

  const recordFailureBackoff = (chatId: string, error: string, statusCode?: number) => {
    const previous = failureBackoffByChat.get(chatId);
    const attempts = (previous?.attempts ?? 0) + 1;
    const hardFailure = isHardGenerationFailure(error, statusCode);
    const delayMs = hardFailure
      ? Math.min(AUTONOMOUS_FAILURE_MAX_BACKOFF_MS, AUTONOMOUS_HARD_FAILURE_BACKOFF_MS * attempts)
      : Math.min(AUTONOMOUS_FAILURE_MAX_BACKOFF_MS, AUTONOMOUS_FAILURE_BASE_BACKOFF_MS * 2 ** Math.max(0, attempts - 1));
    failureBackoffByChat.set(chatId, {
      attempts,
      nextAllowedAt: Date.now() + delayMs,
      lastError: error,
      hardFailure,
    });
    logger.warn(
      "[autonomous-scheduler] Pausing retries for chat %s for %d seconds after %s failure: %s",
      chatId,
      Math.ceil(delayMs / 1000),
      hardFailure ? "hard" : "transient",
      error,
    );
  };

  const generateAutonomousMessage = async (
    chatId: string,
    characterId: string,
    schedule: WeekSchedule | null,
    chatMeta: Record<string, unknown>,
    claimedAt?: number,
  ): Promise<boolean> => {
    const { intent, onCooldown, disabled } = resolveAvailableIntent(chatId, characterId, schedule, chatMeta);
    if (onCooldown || disabled) {
      clearGenerationInProgress(chatId, claimedAt);
      return false;
    }
    const response = await app.inject({
      method: "POST",
      url: "/api/generate",
      payload: {
        chatId,
        connectionId: null,
        forCharacterId: characterId,
        streaming: false,
        userStatus: "idle",
        userActivity: "away or offline",
        autonomous: true,
        skipPresenceDelay: true,
        autonomousIntentKey: intent ?? "",
      },
    });

    if (response.statusCode === 409) {
      clearGenerationInProgress(chatId, claimedAt);
      return false;
    }

    if (response.statusCode !== 200) {
      clearGenerationInProgress(chatId, claimedAt);
      recordFailureBackoff(chatId, response.payload.slice(0, 300), response.statusCode);
      logger.warn(
        "[autonomous-scheduler] Generate failed for chat %s with status %d: %s",
        chatId,
        response.statusCode,
        response.payload.slice(0, 300),
      );
      return false;
    }

    const result = parseSsePayload(response.payload);
    if (result.error) {
      clearGenerationInProgress(chatId, claimedAt);
      recordFailureBackoff(chatId, result.error);
      logger.warn("[autonomous-scheduler] Generate failed for chat %s: %s", chatId, result.error);
      return false;
    }
    if (!result.done) {
      clearGenerationInProgress(chatId, claimedAt);
      logger.warn("[autonomous-scheduler] Generate ended without a done event for chat %s", chatId);
      return false;
    }

    clearFailureBackoff(chatId);
    await chats.markAutonomousUnread(chatId, { characterId });
    return true;
  };

  // Runs after a busy delay on a per-chat timer so the poll loop isn't blocked.
  // Owns the runningChats slot until it finishes.
  const scheduleDelayedGeneration = (
    chatId: string,
    characterId: string,
    schedule: WeekSchedule | null,
    chatMeta: Record<string, unknown>,
    claimedAt: number | undefined,
    delayMs: number,
  ) => {
    const timer = setTimeout(() => {
      void (async () => {
        try {
          if (stopped) return;
          if (getRecentAutonomousClientPresence(chatId, RECENT_CLIENT_PRESENCE_MS)) {
            clearGenerationInProgress(chatId, claimedAt);
            return;
          }
          if (isChatOnFailureBackoff(chatId)) {
            clearGenerationInProgress(chatId, claimedAt);
            return;
          }
          const generated = await generateAutonomousMessage(chatId, characterId, schedule, chatMeta, claimedAt);
          if (generated) {
            logger.info("[autonomous-scheduler] Generated autonomous message for chat %s (after delay)", chatId);
          }
        } catch (err) {
          clearGenerationInProgress(chatId, claimedAt);
          logger.warn(err, "[autonomous-scheduler] Failed during delayed generation for chat %s", chatId);
        } finally {
          runningChats.delete(chatId);
        }
      })();
    }, delayMs);
    timer.unref?.();
  };

  const evaluateChat = async (chat: RawChat) => {
    if (runningChats.has(chat.id)) return;
    if (isChatOnFailureBackoff(chat.id)) return;
    const activeGenerations = (app as unknown as { activeGenerations?: Map<string, unknown> }).activeGenerations;
    if (activeGenerations?.has(chat.id)) return;

    const recentPresence = getRecentAutonomousClientPresence(chat.id, RECENT_CLIENT_PRESENCE_MS);
    if (recentPresence) return;

    runningChats.add(chat.id);
    let generationStartedAt: number | undefined;
    let handedOffToTimer = false;
    try {
      const checkResponse = await app.inject({
        method: "POST",
        url: "/api/conversation/autonomous/check",
        payload: {
          chatId: chat.id,
          userStatus: "idle",
          maxFollowups: OFFLINE_MAX_FOLLOWUPS,
          source: "server",
        },
      });

      if (checkResponse.statusCode !== 200) {
        logger.warn(
          "[autonomous-scheduler] Eligibility check failed for chat %s with status %d",
          chat.id,
          checkResponse.statusCode,
        );
        return;
      }

      const result = JSON.parse(checkResponse.payload) as AutonomousCheckResult;
      generationStartedAt = result.generationStartedAt;
      const characterId = result.shouldTrigger ? result.characterIds?.[0] : null;
      if (!characterId) return;

      await chats.inheritFreshConversationSchedules(chat.id);
      const freshChat = await chats.getById(chat.id);
      if (!freshChat) return;
      const freshMeta = parseMetadata(freshChat.metadata);
      const freshSchedules = (freshMeta.characterSchedules ?? {}) as Record<string, WeekSchedule>;
      const statusOverrides = parseConversationStatusOverrides(freshMeta.conversationStatusOverrides);
      const schedule = freshSchedules[characterId] ?? null;

      if (schedule) {
        const { status } = getEffectiveCurrentStatus(schedule, statusOverrides[characterId]);
        if (status === "offline") {
          clearGenerationInProgress(chat.id, generationStartedAt);
          return;
        }
        const delayMs = getBusyDelay(status, schedule);
        if (delayMs > 0) {
          handedOffToTimer = true;
          scheduleDelayedGeneration(chat.id, characterId, schedule, freshMeta, generationStartedAt, delayMs);
          return;
        }
      }

      const generated = await generateAutonomousMessage(chat.id, characterId, schedule, freshMeta, generationStartedAt);
      if (generated) {
        logger.info("[autonomous-scheduler] Generated autonomous message for chat %s", chat.id);
      }
    } catch (err) {
      clearGenerationInProgress(chat.id, generationStartedAt);
      recordFailureBackoff(chat.id, err instanceof Error ? err.message : String(err));
      logger.warn(err, "[autonomous-scheduler] Failed while evaluating chat %s", chat.id);
    } finally {
      if (!handedOffToTimer) runningChats.delete(chat.id);
    }
  };

  const poll = async () => {
    if (stopped || polling) return;
    polling = true;
    try {
      const allChats = (await chats.list()) as RawChat[];
      for (const chat of allChats) {
        if (stopped) return;
        if (runningChats.size >= MAX_SERVER_AUTONOMOUS_CONCURRENT_EVALUATIONS) break;
        if (!shouldConsiderChat(chat)) continue;
        void evaluateChat(chat);
      }
    } catch (err) {
      logger.warn(err, "[autonomous-scheduler] Poll failed");
    } finally {
      polling = false;
      scheduleNext();
    }
  };

  const stop = () => {
    stopped = true;
    if (pollTimer) clearTimeout(pollTimer);
    pollTimer = null;
  };

  scheduleNext(SERVER_AUTONOMOUS_INITIAL_DELAY_MS);
  app.addHook("onClose", async () => {
    stop();
  });

  logger.info("[autonomous-scheduler] Server-side autonomous scheduler started");

  return { stop };
}
