import type { FastifyInstance } from "fastify";
import { logger } from "../../lib/logger.js";
import { createChatsStorage } from "../storage/chats.storage.js";
import { clearGenerationInProgress, getRecentAutonomousClientPresence } from "./autonomous.service.js";

const SERVER_AUTONOMOUS_INITIAL_DELAY_MS = 20_000;
const SERVER_AUTONOMOUS_POLL_MS = 60_000;
const RECENT_CLIENT_PRESENCE_MS = 75_000;
const OFFLINE_MAX_FOLLOWUPS = 2;

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
};

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

export function startServerAutonomousScheduler(app: FastifyInstance) {
  const chats = createChatsStorage(app.db);
  const runningChats = new Set<string>();
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

  const generateAutonomousMessage = async (chatId: string, characterId: string): Promise<boolean> => {
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
      },
    });

    if (response.statusCode === 409) {
      return false;
    }

    if (response.statusCode !== 200) {
      clearGenerationInProgress(chatId);
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
      logger.warn("[autonomous-scheduler] Generate failed for chat %s: %s", chatId, result.error);
      return false;
    }
    if (!result.done) {
      logger.warn("[autonomous-scheduler] Generate ended without a done event for chat %s", chatId);
      return false;
    }

    await chats.markAutonomousUnread(chatId, { characterId });
    return true;
  };

  const evaluateChat = async (chat: RawChat) => {
    if (runningChats.has(chat.id)) return;
    const activeGenerations = (app as unknown as { activeGenerations?: Map<string, unknown> }).activeGenerations;
    if (activeGenerations?.has(chat.id)) return;

    const recentPresence = getRecentAutonomousClientPresence(chat.id, RECENT_CLIENT_PRESENCE_MS);
    if (recentPresence) return;

    runningChats.add(chat.id);
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
      const characterId = result.shouldTrigger ? result.characterIds?.[0] : null;
      if (!characterId) return;

      const generated = await generateAutonomousMessage(chat.id, characterId);
      if (generated) {
        logger.info("[autonomous-scheduler] Generated autonomous message for chat %s", chat.id);
      }
    } catch (err) {
      clearGenerationInProgress(chat.id);
      logger.warn(err, "[autonomous-scheduler] Failed while evaluating chat %s", chat.id);
    } finally {
      runningChats.delete(chat.id);
    }
  };

  const poll = async () => {
    if (stopped || polling) return;
    polling = true;
    try {
      const allChats = (await chats.list()) as RawChat[];
      for (const chat of allChats) {
        if (stopped) return;
        if (!shouldConsiderChat(chat)) continue;
        await evaluateChat(chat);
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
