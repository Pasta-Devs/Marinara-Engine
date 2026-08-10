import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Message } from "@marinara-engine/shared";
import { api } from "../lib/api-client";
import { findChatSearchHits, type ChatSearchHit } from "../lib/chat-search";

/**
 * Query keys for in-chat message search.
 *
 * Deliberately does NOT reuse `chatKeys.messages` — that key backs ChatArea's
 * paginated infinite query, and writing an unpaged full-history array into it
 * would leave the chat view starting from the wrong cache shape.
 */
export const chatSearchKeys = {
  all: ["chat-search"] as const,
  corpus: (chatId: string) => [...chatSearchKeys.all, "corpus", chatId] as const,
};

export type { ChatSearchHit };

/**
 * The chat's whole message history, so search can reach matches outside
 * ChatArea's loaded window.
 *
 * Only enabled while the search panel is open, so a chat that is never
 * searched costs nothing.
 */
export function useChatSearchCorpus(chatId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: chatSearchKeys.corpus(chatId ?? ""),
    queryFn: ({ signal }) => api.get<Message[]>(`/chats/${chatId}/messages`, { signal }),
    enabled: !!chatId && enabled,
    staleTime: 30_000,
  });
}

/** Memoised naive, case-insensitive substring search over a chat's messages. */
export function useChatSearchResults(messages: Message[] | undefined, query: string): ChatSearchHit[] {
  return useMemo(() => findChatSearchHits(messages, query), [messages, query]);
}
