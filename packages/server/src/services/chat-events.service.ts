import type { ChatRealtimeEvent } from "@marinara-engine/shared";

type ChatEventListener = (event: ChatRealtimeEvent) => void;

const listeners = new Set<ChatEventListener>();

export function publishChatEvent(event: ChatRealtimeEvent): void {
  for (const listener of listeners) {
    listener(event);
  }
}

export function subscribeChatEvents(listener: ChatEventListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function createChatRealtimeEvent(
  input: Omit<ChatRealtimeEvent, "timestamp"> & { timestamp?: string },
): ChatRealtimeEvent {
  return {
    ...input,
    timestamp: input.timestamp ?? new Date().toISOString(),
  };
}
