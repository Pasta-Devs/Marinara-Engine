import type { Client } from "discord.js";
import type { ChatEventStreamEvent, ChatRealtimeEvent } from "@marinara-engine/shared";
import { syncEngineMessagesToDiscord } from "./engine-sync.js";
import { listThreadBindings } from "./marinara-api.js";
import { logger } from "./logger.js";

const MIN_RECONNECT_DELAY_MS = 1_000;
const MAX_RECONNECT_DELAY_MS = 30_000;
const SYNC_DEBOUNCE_MS = 250;
const TYPING_REFRESH_MS = 8_000;
const TYPING_MAX_DURATION_MS = 120_000;

interface TypingThread {
  sendTyping(): Promise<unknown>;
}

interface TypingState {
  interval: NodeJS.Timeout;
  timeout: NodeJS.Timeout;
  threadIds: Set<string>;
}

function chatEventsUrl(serverUrl: string) {
  return `${serverUrl.replace(/\/+$/, "")}/api/chat-events`;
}

function isChatRealtimeEvent(value: unknown): value is ChatRealtimeEvent {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const event = value as Partial<ChatRealtimeEvent>;
  return typeof event.type === "string" && typeof event.chatId === "string";
}

function isChatEventStreamEvent(value: unknown): value is ChatEventStreamEvent {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return typeof (value as Partial<ChatEventStreamEvent>).type === "string";
}

function parseSseBuffer(buffer: string) {
  const events: unknown[] = [];
  const blocks = buffer.split("\n\n");
  const remaining = blocks.pop() ?? "";

  for (const block of blocks) {
    const data = block
      .split("\n")
      .filter((line) => line.startsWith("data: "))
      .map((line) => line.slice(6))
      .join("\n");
    if (!data) continue;
    try {
      events.push(JSON.parse(data) as unknown);
    } catch {
      // Ignore malformed SSE payloads and keep the stream alive.
    }
  }

  return { events, remaining };
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function errorMessage(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

function isConnectionRefused(err: unknown) {
  if (!(err instanceof Error)) return false;
  return err.message.includes("fetch failed") && String((err as { cause?: unknown }).cause).includes("ECONNREFUSED");
}

function isTypingThread(channel: unknown): channel is TypingThread {
  return (
    typeof channel === "object" &&
    channel !== null &&
    "sendTyping" in channel &&
    typeof (channel as { sendTyping?: unknown }).sendTyping === "function"
  );
}

export function startChatEventSync(input: { client: Client; serverUrl: string }) {
  let stopped = false;
  let controller: AbortController | null = null;
  let syncing = false;
  let pending = false;
  let debounce: NodeJS.Timeout | null = null;
  let waitingLogged = false;
  const typingByChatId = new Map<string, TypingState>();

  const runSync = () => {
    if (syncing) {
      pending = true;
      return;
    }

    syncing = true;
    void syncEngineMessagesToDiscord({ client: input.client, serverUrl: input.serverUrl })
      .catch((err) => {
        logger.error(err, "Event-driven Engine to Discord sync failed");
      })
      .finally(() => {
        syncing = false;
        if (pending && !stopped) {
          pending = false;
          runSync();
        }
      });
  };

  const scheduleSync = () => {
    if (debounce) clearTimeout(debounce);
    debounce = setTimeout(runSync, SYNC_DEBOUNCE_MS);
    debounce.unref();
  };

  const sendTypingToThread = async (threadId: string) => {
    const channel = await input.client.channels.fetch(threadId).catch(() => null);
    if (!isTypingThread(channel)) return;
    await channel.sendTyping();
  };

  const stopTyping = (chatId: string) => {
    const state = typingByChatId.get(chatId);
    if (!state) return;
    clearInterval(state.interval);
    clearTimeout(state.timeout);
    typingByChatId.delete(chatId);
  };

  const startTyping = async (chatId: string) => {
    if (typingByChatId.has(chatId)) return;

    const bindings = (await listThreadBindings(input.serverUrl)).filter((binding) => binding.chatId === chatId);
    const threadIds = new Set(bindings.map((binding) => binding.threadId));
    if (threadIds.size === 0) return;

    const sendTyping = () => {
      for (const threadId of threadIds) {
        void sendTypingToThread(threadId).catch((err) => {
          logger.warn(err, `Discord typing indicator failed for thread ${threadId}`);
        });
      }
    };

    sendTyping();
    const interval = setInterval(sendTyping, TYPING_REFRESH_MS);
    interval.unref();
    const timeout = setTimeout(() => stopTyping(chatId), TYPING_MAX_DURATION_MS);
    timeout.unref();
    typingByChatId.set(chatId, { interval, timeout, threadIds });
  };

  const connect = async () => {
    let reconnectDelay = MIN_RECONNECT_DELAY_MS;

    while (!stopped) {
      controller = new AbortController();
      try {
        const response = await fetch(chatEventsUrl(input.serverUrl), {
          headers: { accept: "text/event-stream" },
          signal: controller.signal,
        });
        if (!response.ok || !response.body) {
          throw new Error(`chat event stream returned HTTP ${response.status}`);
        }

        if (waitingLogged) {
          logger.info("Marinara chat event stream recovered at %s", chatEventsUrl(input.serverUrl));
        }
        waitingLogged = false;
        logger.info("Connected to Marinara chat event stream at %s", chatEventsUrl(input.serverUrl));
        reconnectDelay = MIN_RECONNECT_DELAY_MS;

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (!stopped) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
          const parsed = parseSseBuffer(buffer);
          buffer = parsed.remaining;

          for (const event of parsed.events) {
            if (!isChatEventStreamEvent(event)) continue;
            if (event.type === "server_ready") {
              logger.info("Marinara server ready event received");
              scheduleSync();
              continue;
            }
            if (!isChatRealtimeEvent(event)) continue;
            if (event.source === "discord_bridge") continue;
            if (event.type === "chat_generation_started") {
              void startTyping(event.chatId).catch((err) => {
                logger.warn(err, "Discord typing indicator setup failed for chat %s", event.chatId);
              });
              continue;
            }
            stopTyping(event.chatId);
            scheduleSync();
          }
        }
      } catch (err) {
        if (!stopped) {
          if (isConnectionRefused(err)) {
            if (!waitingLogged) {
              logger.warn("Waiting for Marinara chat events at %s: %s", chatEventsUrl(input.serverUrl), errorMessage(err));
              waitingLogged = true;
            }
          } else {
            logger.warn(err, "Marinara chat event stream disconnected");
          }
        }
      } finally {
        controller = null;
      }

      if (!stopped) {
        await delay(reconnectDelay);
        reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY_MS);
      }
    }
  };

  void connect();

  return () => {
    stopped = true;
    if (debounce) clearTimeout(debounce);
    for (const chatId of typingByChatId.keys()) {
      stopTyping(chatId);
    }
    controller?.abort();
  };
}
