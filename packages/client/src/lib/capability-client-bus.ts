// ──────────────────────────────────────────────
// Capability API 1.817: the client side of the package event bus (__MARINARA_HOST__.events)
// ──────────────────────────────────────────────
// Every package client runs in this one page, so this bus is cooperative: the source of an event is the prefix of
// its type, and nothing stops a package from publishing under another's. Anything that needs a trusted sender goes
// through the server bus or a privileged route instead.
import { dispatchCapabilityClientEvent } from "./capability-client-events";

export interface CapabilityClientBusEvent {
  readonly type: string;
  readonly source: string;
  readonly chatId?: string;
  readonly payload: unknown;
  readonly at: string;
}

type Handler = (event: CapabilityClientBusEvent) => void;
const subscriptions = new Set<{ pattern: string; handler: Handler }>();
const SUBSCRIBE_PATTERN = /^[^\s:*]+:(?:\*|[^\s*]+)$/u;
const TYPE_PATTERN = /^[^\s:*]+:[^\s*]+$/u;

const matches = (pattern: string, type: string) =>
  pattern.endsWith(":*") ? type.startsWith(pattern.slice(0, -1)) : pattern === type;

function deliver(event: CapabilityClientBusEvent) {
  for (const subscription of [...subscriptions]) {
    if (!subscriptions.has(subscription) || !matches(subscription.pattern, event.type)) continue;
    // Each handler on its own task: one that throws or loops cannot stop the others or the publisher.
    queueMicrotask(() => {
      try {
        subscription.handler(event);
      } catch (error) {
        console.warn(`[capability events] handler for ${event.type} failed`, error);
      }
    });
  }
}

export const capabilityClientBus = Object.freeze({
  publish(type: string, payload?: unknown, scope?: { chatId?: string }) {
    if (typeof type !== "string" || !TYPE_PATTERN.test(type)) {
      throw new Error(`Capability event type must be "<prefix>:<name>", not ${String(type)}`);
    }
    const json = JSON.stringify(payload ?? null);
    deliver(
      Object.freeze({
        type,
        source: type.slice(0, type.indexOf(":")),
        ...(scope?.chatId ? { chatId: scope.chatId } : {}),
        payload: JSON.parse(json) as unknown,
        at: new Date().toISOString(),
      }),
    );
  },
  subscribe(type: string, handler: Handler): () => void {
    if (!SUBSCRIBE_PATTERN.test(type)) {
      throw new Error(`Capability event subscriptions take "<prefix>:<name>" or "<prefix>:*", not ${String(type)}`);
    }
    const subscription = { pattern: type, handler };
    subscriptions.add(subscription);
    return () => {
      subscriptions.delete(subscription);
    };
  },
});

/**
 * A `capability_event` frame from a generation stream: a chat-scoped event a package server published. It reaches the
 * publishing package's own element as a `marinara-capability-server-event` (detail.packageId = source) and every
 * client subscriber through the bus.
 */
export function relayCapabilityServerEvent(data: unknown, fallbackChatId: string) {
  const event = data as Partial<CapabilityClientBusEvent> | null;
  if (!event || typeof event.type !== "string" || typeof event.source !== "string") return;
  const chatId = typeof event.chatId === "string" ? event.chatId : fallbackChatId;
  dispatchCapabilityClientEvent({ packageId: event.source, type: event.type, chatId, data: event.payload });
  deliver(
    Object.freeze({
      type: event.type,
      source: event.source,
      chatId,
      payload: event.payload,
      at: typeof event.at === "string" ? event.at : new Date().toISOString(),
    }),
  );
}
