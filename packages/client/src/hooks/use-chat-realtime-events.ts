import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { ChatEventStreamEvent, ChatRealtimeEvent } from "@marinara-engine/shared";
import { chatKeys } from "./use-chats";
import { lorebookKeys } from "./use-lorebooks";

function isChatRealtimeEvent(value: unknown): value is ChatRealtimeEvent {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const event = value as Partial<ChatRealtimeEvent>;
  return typeof event.type === "string" && typeof event.chatId === "string";
}

function isChatEventStreamEvent(value: unknown): value is ChatEventStreamEvent {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return typeof (value as Partial<ChatEventStreamEvent>).type === "string";
}

export function useChatRealtimeEvents() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const events = new EventSource("/api/chat-events");

    events.onmessage = (message) => {
      try {
        const parsed = JSON.parse(message.data) as unknown;
        if (!isChatEventStreamEvent(parsed) || parsed.type === "server_ready") return;
        if (!isChatRealtimeEvent(parsed)) return;
        if (parsed.type === "chat_generation_started") return;

        queryClient.invalidateQueries({ queryKey: chatKeys.messages(parsed.chatId) });
        queryClient.invalidateQueries({ queryKey: chatKeys.messageCount(parsed.chatId) });
        queryClient.invalidateQueries({ queryKey: chatKeys.list() });
        queryClient.invalidateQueries({ queryKey: lorebookKeys.active(parsed.chatId) });
      } catch {
        // Ignore malformed event payloads; EventSource will keep the stream alive.
      }
    };

    return () => {
      events.close();
    };
  }, [queryClient]);
}
