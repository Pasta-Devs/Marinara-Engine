import type { FastifyInstance } from "fastify";
import { logger } from "../../lib/logger.js";
import { logRateLimited } from "../../lib/log-rate-limit.js";
import { registerWorkerGauge } from "../../lib/worker-gauges.js";
import { tryConsumeBackgroundCall } from "../generation/background-call-budget.js";
import { createChatsStorage } from "../storage/chats.storage.js";
import {
  clearGenerationInProgress,
  getActivityState,
  getRecentAutonomousClientPresence,
} from "./autonomous.service.js";
import { isIntentOnCooldown, resolveIntent, type MessageIntent } from "./intent.service.js";
import { getBusyDelay, getEffectiveCurrentStatus, type WeekSchedule } from "./schedule.service.js";
import { resolveConversationTimeZone, toZonedWallClockDate } from "./timezone.js";

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
  now: Date,
): { intent: MessageIntent | null; onCooldown: boolean; disabled: boolean } {
  if (!schedule) return { intent: null, onCooldown: false, disabled: false };

  const state = getActivityState(chatId);
  const msSinceUserLastSpoke = state ? Date.now() - state.lastUserMessageAt : 0;
  const hadUnansweredUserMessage = state ? state.lastUserMessageAt > state.lastAssistantMessageAt : false;
  const intent = resolveIntent(schedule, msSinceUserLastSpoke, hadUnansweredUserMessage, now);

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

function parseSsePayload(payload: string): { done: boolean; discarded: boolean; error: string | null } {
  let done = false;
  let discarded = false;
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
      if (event.type === "generation_discarded") discarded = true;
      if (event.type === "error") {
        error = typeof event.data === "string" ? event.data : "Generation failed";
      }
    } catch {
      continue;
    }
  }

  return { done, discarded, error };
}

function isHardGenerationFailure(error: string, statusCode?: number): boolean {
  if (statusCode !== undefined) {
    return statusCode >= 400 && statusCode < 500 && statusCode !== 408 && statusCode !== 409 && statusCode !== 429;
  }
  return /\b(?:400|401|403|404|405|410|422)\b/u.test(error);
}

/**
 * Sweep-gate decisions (#4705), exported pure so the regression suite pins the
 * state machine against refactors — recording an idle conclusion from a sweep
 * that didn't evaluate every chat is the dormant-scheduler regression class.
 */
export function shouldSkipAutonomousSweep(
  idleSweepGeneration: number | null,
  currentGeneration: number | null,
): boolean {
  return idleSweepGeneration !== null && currentGeneration !== null && currentGeneration === idleSweepGeneration;
}

/** Returns the generation to remember as "idle since", or null when the sweep proves nothing. */
export function concludeAutonomousSweep(args: {
  inconclusive: boolean;
  sawEligible: boolean;
  generation: number | null;
}): number | null {
  return !args.inconclusive && !args.sawEligible ? args.generation : null;
}

/**
 * Round-robin order for one sweep: start just after the chat the previous
 * sweep dispatched last, so the concurrency cap does not keep handing both
 * slots to the same chats at the top of the updatedAt-sorted list. A cursor
 * that is no longer eligible falls back to the top of the list.
 */
export function orderAutonomousSweepCandidates<T extends { id: string }>(eligible: T[], cursorId: string | null): T[] {
  const start = cursorId ? eligible.findIndex((chat) => chat.id === cursorId) + 1 : 0;
  return [...eligible.slice(start), ...eligible.slice(0, start)];
}

/**
 * Fire-time re-validation for a busy-delayed autonomous generation. The delay
 * can be long (up to the configured dnd/idle minutes), so the state captured
 * when the timer was armed may no longer hold. Returns the reason to abort, or
 * null when generation may proceed.
 */
export function getDelayedAutonomousAbortReason(args: {
  claimedAt: number | undefined;
  state: { generationInProgressSince: number | null; lastUserMessageAt: number } | undefined;
  chat: RawChat | null | undefined;
}): string | null {
  const { claimedAt, state, chat } = args;
  if (claimedAt != null) {
    // User or assistant activity released the claim, or someone re-took it.
    if (state?.generationInProgressSince !== claimedAt) return "claim_released";
    // The user spoke after the claim (replies that preserve the claim).
    if (state.lastUserMessageAt > claimedAt) return "user_replied";
  }
  if (!chat || !shouldConsiderChat(chat)) return "chat_ineligible";
  return null;
}

export function startServerAutonomousScheduler(app: FastifyInstance) {
  const chats = createChatsStorage(app.db);
  const runningChats = new Set<string>();
  // Chats waiting on a busy-delay timer. Kept apart from runningChats so a
  // pending delay does not hold one of the evaluation slots.
  const delayedChats = new Set<string>();
  let sweepCursorId: string | null = null;
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
      : Math.min(
          AUTONOMOUS_FAILURE_MAX_BACKOFF_MS,
          AUTONOMOUS_FAILURE_BASE_BACKOFF_MS * 2 ** Math.max(0, attempts - 1),
        );
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
    const promptTimeZone = resolveConversationTimeZone(chatMeta);
    const promptNow = toZonedWallClockDate(new Date(), promptTimeZone);
    const { intent, onCooldown, disabled } = resolveAvailableIntent(chatId, characterId, schedule, chatMeta, promptNow);
    if (onCooldown || disabled) {
      clearGenerationInProgress(chatId, claimedAt);
      return false;
    }
    // Background call cap (off by default): an unattended turn is refused locally once the hourly cap is spent.
    // The budget logs the pause once; the chat is simply picked up again by a later poll.
    if (!tryConsumeBackgroundCall(`autonomous:${chatId}`).allowed) {
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
        userTimeZone: promptTimeZone,
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

    if (result.discarded) {
      clearFailureBackoff(chatId);
      return false;
    }

    clearFailureBackoff(chatId);
    await chats.markAutonomousUnread(chatId, { characterId });
    return true;
  };

  // Runs after a busy delay on a per-chat timer so the poll loop isn't blocked.
  // Owns the chat's delayedChats entry until it finishes.
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
          // Re-validate against current state: the chat or the user may have
          // moved on while the timer waited.
          const currentChat = (await chats.getById(chatId)) as RawChat | null | undefined;
          const abortReason = getDelayedAutonomousAbortReason({
            claimedAt,
            state: getActivityState(chatId),
            chat: currentChat,
          });
          if (abortReason) {
            clearGenerationInProgress(chatId, claimedAt);
            return;
          }
          const currentMeta = currentChat ? parseMetadata(currentChat.metadata) : chatMeta;
          const generated = await generateAutonomousMessage(chatId, characterId, schedule, currentMeta, claimedAt);
          if (generated) {
            logger.info("[autonomous-scheduler] Generated autonomous message for chat %s (after delay)", chatId);
          }
        } catch (err) {
          clearGenerationInProgress(chatId, claimedAt);
          logger.warn(err, "[autonomous-scheduler] Failed during delayed generation for chat %s", chatId);
        } finally {
          delayedChats.delete(chatId);
        }
      })();
    }, delayMs);
    timer.unref?.();
  };

  const evaluateChat = async (chat: RawChat) => {
    if (runningChats.has(chat.id)) return;
    if (delayedChats.has(chat.id)) return;
    if (isChatOnFailureBackoff(chat.id)) return;
    const activeGenerations = (app as unknown as { activeGenerations?: Map<string, unknown> }).activeGenerations;
    if (activeGenerations?.has(chat.id)) return;

    const recentPresence = getRecentAutonomousClientPresence(chat.id, RECENT_CLIENT_PRESENCE_MS);
    if (recentPresence) return;

    runningChats.add(chat.id);
    let generationStartedAt: number | undefined;
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

      const presence = await chats.resolveConversationPresenceState(chat.id);
      const freshChat = await chats.getById(chat.id);
      if (!freshChat) return;
      const freshMeta = parseMetadata(freshChat.metadata);
      const promptTimeZone = resolveConversationTimeZone(freshMeta);
      const nowInstant = new Date();
      const promptNow = toZonedWallClockDate(nowInstant, promptTimeZone);
      const freshSchedules = presence.schedules;
      const statusOverrides = presence.statusOverrides;
      const schedule = freshSchedules[characterId] ?? null;

      if (schedule) {
        const { status } = getEffectiveCurrentStatus(
          schedule,
          statusOverrides[characterId],
          nowInstant,
          "free time",
          promptNow,
        );
        if (status === "offline") {
          clearGenerationInProgress(chat.id, generationStartedAt);
          return;
        }
        const delayMs = getBusyDelay(status, schedule);
        if (delayMs > 0) {
          delayedChats.add(chat.id);
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
      logRateLimited(
        "warn",
        `autonomous-scheduler:${chat.id}`,
        err,
        "[autonomous-scheduler] Failed while evaluating chat %s",
        chat.id,
      );
    } finally {
      runningChats.delete(chat.id);
    }
  };

  // Sweep gate (#4705): when a CONCLUSIVE sweep found no eligible chats and
  // the chats table hasn't been written since, skip the full list + metadata
  // parse. Any chats-table write (including enabling autonomous messages from
  // any device — all writes come through this server, and transaction
  // rollbacks bump the counter too) re-arms the sweep, so pickup stays within
  // one poll interval. When the store doesn't expose the counter, the gate
  // degrades to always sweeping.
  const readChatsWriteGeneration = (): number | null => {
    const fileStore = (app.db as { _fileStore?: { getTableWriteGeneration?: (table: string) => number } })._fileStore;
    const generation = fileStore?.getTableWriteGeneration?.("chats");
    return typeof generation === "number" ? generation : null;
  };
  let idleSweepGeneration: number | null = null;

  const poll = async () => {
    if (stopped || polling) return;
    polling = true;
    try {
      // Capture BEFORE listing: a write that lands mid-sweep bumps the live
      // generation past this snapshot, so the next poll re-sweeps (safe side).
      const generation = readChatsWriteGeneration();
      if (shouldSkipAutonomousSweep(idleSweepGeneration, generation)) {
        return;
      }
      const allChats = (await chats.list()) as RawChat[];
      const eligible = allChats.filter(shouldConsiderChat);
      const sawEligible = eligible.length > 0;
      let inconclusive = false;
      for (const chat of orderAutonomousSweepCandidates(eligible, sweepCursorId)) {
        if (stopped) {
          inconclusive = true;
          break;
        }
        if (runningChats.size >= MAX_SERVER_AUTONOMOUS_CONCURRENT_EVALUATIONS) {
          // Chats after the cap break were not evaluated this sweep, so it
          // proves nothing about them.
          inconclusive = true;
          break;
        }
        if (runningChats.has(chat.id) || delayedChats.has(chat.id)) continue;
        void evaluateChat(chat);
        sweepCursorId = chat.id;
      }
      // Only a sweep that evaluated EVERY chat may record the none-eligible
      // conclusion: delayed generations can finish through paths that never
      // write the chats table, so recording it from an inconclusive sweep
      // could leave the scheduler dormant with enabled chats (#4705).
      idleSweepGeneration = concludeAutonomousSweep({ inconclusive, sawEligible, generation });
    } catch (err) {
      // The poll repeats every few seconds; a lasting failure logs once a minute with a repeat count.
      logRateLimited("warn", "autonomous-scheduler:poll", err, "[autonomous-scheduler] Poll failed");
    } finally {
      polling = false;
      scheduleNext();
    }
  };

  const unregisterGauge = registerWorkerGauge("autonomous", () => ({
    runningChats: runningChats.size,
    backedOff: failureBackoffByChat.size,
  }));

  const stop = () => {
    stopped = true;
    unregisterGauge();
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
