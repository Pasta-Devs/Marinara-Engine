import type { CapabilityEvent, CapabilityEventHandler } from "@marinara-engine/shared";
import { logger } from "../../lib/logger.js";
import { currentRoomGeneration } from "../multiplayer/generation-policy.js";
import {
  isSseReplyWritable,
  observeGenerationFrames,
  sendSseEvent,
  type GenerationOutput,
} from "../../routes/generate/sse.js";
import { withDeadline } from "./capability-prompt-context.service.js";

/**
 * Capability API 1.817: one in-process event bus between packages and the Engine. Fire and forget: a publisher never
 * waits for a subscriber, each handler runs under a deadline, and nothing is stored or replayed.
 */

export const MAX_CAPABILITY_EVENT_BYTES = 64 * 1024;
export const CAPABILITY_EVENT_HANDLER_DEADLINE_MS = 2000;
/** The Engine's own events carry chat content (or name chat state) and need `chat-read` to subscribe to. */
export const CHAT_CONTENT_ENGINE_EVENTS = Object.freeze([
  "engine:agent.result",
  "engine:generation.completed",
  "engine:chat.metadata.changed",
] as const);
export const ENGINE_EVENT_SOURCE = "engine";

const TYPE_PATTERN = /^[^\s:*]+:[^\s*]+$/u;
const SUBSCRIBE_PATTERN = /^[^\s:*]+:(?:\*|[^\s*]+)$/u;

interface Subscription {
  subscriberId: string;
  pattern: string;
  handler: CapabilityEventHandler;
}

const subscriptions = new Set<Subscription>();
const queue: CapabilityEvent[] = [];
let drainScheduled = false;

function matches(pattern: string, type: string): boolean {
  return pattern.endsWith(":*") ? type.startsWith(pattern.slice(0, -1)) : pattern === type;
}

export function isValidCapabilityEventPattern(pattern: unknown): pattern is string {
  return typeof pattern === "string" && SUBSCRIBE_PATTERN.test(pattern);
}

/** Whether subscribing to `pattern` can deliver an Engine event that carries chat content. */
export function capabilityEventPatternNeedsChatRead(pattern: string): boolean {
  return CHAT_CONTENT_ENGINE_EVENTS.some((type) => matches(pattern, type));
}

export function hasCapabilityEventSubscribers(type: string): boolean {
  for (const subscription of subscriptions) if (matches(subscription.pattern, type)) return true;
  return false;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

function drain(): void {
  drainScheduled = false;
  // A publish from inside a handler lands at the end of the queue; handlers never run re-entrantly.
  for (let event = queue.shift(); event; event = queue.shift()) {
    for (const subscription of [...subscriptions]) {
      if (!subscriptions.has(subscription) || !matches(subscription.pattern, event.type)) continue;
      const delivered = event;
      void withDeadline(
        Promise.resolve().then(() => subscription.handler(delivered)),
        `Capability event handler of ${subscription.subscriberId} for ${delivered.type}`,
        CAPABILITY_EVENT_HANDLER_DEADLINE_MS,
      ).catch((error: unknown) => {
        logger.warn(
          error,
          "Capability package %s failed to handle event %s",
          subscription.subscriberId,
          delivered.type,
        );
      });
    }
  }
}

export function subscribeCapabilityEvents(
  subscriberId: string,
  pattern: string,
  handler: CapabilityEventHandler,
): () => void {
  if (!isValidCapabilityEventPattern(pattern)) {
    throw new Error(`Capability event subscriptions take "<prefix>:<name>" or "<prefix>:*", not ${String(pattern)}`);
  }
  if (typeof handler !== "function") throw new Error("Capability event handler must be a function");
  const subscription: Subscription = { subscriberId, pattern, handler };
  subscriptions.add(subscription);
  return () => {
    subscriptions.delete(subscription);
  };
}

// ── Chat-scoped events ride the generation SSE of their chat ──

const chatStreams = new Map<string, Set<GenerationOutput>>();
const streamChats = new WeakMap<GenerationOutput, { chatId: string; mode: string | null; messageId: string | null }>();

/**
 * Binds a generation's output to its chat: chat-scoped package events published while it runs reach the client on
 * this stream, and the Engine's `agent.result` and `generation.completed` events are read from the frames it writes,
 * after they are written. Returns the release; a stream the client closed is also dropped on the next publish.
 */
export function attachCapabilityEventStream(
  reply: GenerationOutput,
  chat: { chatId: string; mode?: string | null },
): () => void {
  const { chatId } = chat;
  const streams = chatStreams.get(chatId) ?? new Set<GenerationOutput>();
  streams.add(reply);
  chatStreams.set(chatId, streams);
  streamChats.set(reply, { chatId, mode: chat.mode ?? null, messageId: null });
  return () => {
    streams.delete(reply);
    if (streams.size === 0 && chatStreams.get(chatId) === streams) chatStreams.delete(chatId);
  };
}

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

observeGenerationFrames((reply, payload) => {
  const chat = streamChats.get(reply);
  if (!chat) return;
  const data = record(payload.data);
  if (payload.type === "message_saved") {
    if (data.role !== "user" && typeof data.id === "string") chat.messageId = data.id;
  } else if (payload.type === "agent_result") {
    publishEngineCapabilityEvent(
      "agent.result",
      {
        chatId: chat.chatId,
        agentType: data.agentType ?? null,
        agentName: data.agentName ?? null,
        resultType: data.resultType ?? null,
        success: data.success === true,
        messageId: typeof data.messageId === "string" ? data.messageId : null,
        data: data.data ?? null,
      },
      chat.chatId,
    );
  } else if (payload.type === "done") {
    publishEngineCapabilityEvent(
      "generation.completed",
      { chatId: chat.chatId, messageId: chat.messageId, mode: chat.mode },
      chat.chatId,
    );
  }
});

function forwardToChatStreams(event: CapabilityEvent): void {
  if (!event.chatId) return;
  const streams = chatStreams.get(event.chatId);
  if (!streams) return;
  for (const reply of [...streams]) {
    if (!isSseReplyWritable(reply)) {
      streams.delete(reply);
      continue;
    }
    sendSseEvent(reply, { type: "capability_event", data: event });
  }
  if (streams.size === 0) chatStreams.delete(event.chatId);
}

/**
 * Publishes one event. The payload is copied through JSON, so subscribers never share an object with the publisher.
 * Throws for a payload that is not JSON or is larger than 64 KB. Dropped during a shared-room generation.
 */
export function publishCapabilityEvent(
  source: string,
  type: string,
  payload: unknown,
  scope?: { chatId?: string },
): void {
  if (currentRoomGeneration()) return;
  if (typeof type !== "string" || !TYPE_PATTERN.test(type)) {
    throw new Error(`Capability event type must be "<prefix>:<name>", not ${String(type)}`);
  }
  const chatId = scope?.chatId;
  if (chatId !== undefined && (typeof chatId !== "string" || chatId.length === 0)) {
    throw new Error("Capability event scope.chatId must be a non-empty string");
  }
  const forwarded = chatId !== undefined && chatStreams.has(chatId) && source !== ENGINE_EVENT_SOURCE;
  if (!forwarded && !hasCapabilityEventSubscribers(type)) return;
  let json: string | undefined;
  try {
    json = JSON.stringify(payload ?? null);
  } catch (error) {
    throw new Error(`Capability event ${type} payload must be JSON`, { cause: error });
  }
  if (json === undefined) throw new Error(`Capability event ${type} payload must be JSON`);
  if (Buffer.byteLength(json) > MAX_CAPABILITY_EVENT_BYTES) {
    throw new Error(`Capability event ${type} payload is larger than ${MAX_CAPABILITY_EVENT_BYTES} bytes`);
  }
  const event: CapabilityEvent = deepFreeze({
    type,
    source,
    ...(chatId ? { chatId } : {}),
    payload: JSON.parse(json) as CapabilityEvent["payload"],
    at: new Date().toISOString(),
  });
  if (forwarded) forwardToChatStreams(event);
  if (!hasCapabilityEventSubscribers(type)) return;
  queue.push(event);
  if (!drainScheduled) {
    drainScheduled = true;
    setImmediate(drain);
  }
}

/**
 * The Engine's own events. Never throws: an Engine event that cannot be delivered is logged, and a payload over the
 * size cap loses its `data` field (flagged `dataOmitted`) instead of the whole event.
 */
export function publishEngineCapabilityEvent(name: string, payload: Record<string, unknown>, chatId?: string): void {
  const type = `engine:${name}`;
  if (!hasCapabilityEventSubscribers(type) || currentRoomGeneration()) return;
  const scope = chatId ? { chatId } : undefined;
  try {
    publishCapabilityEvent(ENGINE_EVENT_SOURCE, type, payload, scope);
  } catch (error) {
    if ("data" in payload) {
      try {
        publishCapabilityEvent(ENGINE_EVENT_SOURCE, type, { ...payload, data: null, dataOmitted: true }, scope);
        return;
      } catch {
        // Logged below with the first error.
      }
    }
    logger.warn(error, "Could not publish Engine event %s", type);
  }
}

/** `engine:chat.metadata.changed`: only the keys whose values changed, never the values. */
export function publishChatMetadataChanged(
  chatId: string,
  previous: Record<string, unknown>,
  next: Record<string, unknown>,
): void {
  if (!hasCapabilityEventSubscribers("engine:chat.metadata.changed") || currentRoomGeneration()) return;
  const keys = [...new Set([...Object.keys(previous), ...Object.keys(next)])]
    .filter((key) => JSON.stringify(previous[key]) !== JSON.stringify(next[key]))
    .sort();
  if (keys.length > 0) publishEngineCapabilityEvent("chat.metadata.changed", { chatId, keys }, chatId);
}

export function resetCapabilityEventBus(): void {
  subscriptions.clear();
  queue.length = 0;
  chatStreams.clear();
}
