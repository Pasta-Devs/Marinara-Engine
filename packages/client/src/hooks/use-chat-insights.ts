import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query";
import type { ActivityOverview, ChatStats, GlobalChatSearchResponse } from "@marinara-engine/shared";
import { api } from "../lib/api-client";

export interface GlobalChatSearchFilters {
  query: string;
  mode?: string;
  characterId?: string;
  role?: string;
  /** ISO timestamps (already converted from the reader's local dates). */
  from?: string;
  to?: string;
  /** At most this many hits per chat, with every chat counted (see `GlobalChatSearchResponse.chats`). */
  perChat?: number;
}

export const GLOBAL_MESSAGE_HITS_PER_CHAT = 2;

const GLOBAL_SEARCH_PAGE_SIZE = 30;

export const chatInsightKeys = {
  all: ["chat-insights"] as const,
  search: (filters: GlobalChatSearchFilters) => [...chatInsightKeys.all, "search", filters] as const,
  stats: (chatId: string) => [...chatInsightKeys.all, "stats", chatId] as const,
  activity: () => [...chatInsightKeys.all, "activity"] as const,
};

/** The reader's IANA zone (DST aware) plus the current fixed offset as a fallback. */
function timezoneParams(): string {
  const params = new URLSearchParams({ tzOffset: String(new Date().getTimezoneOffset()) });
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (zone) params.set("tz", zone);
  } catch {
    // Offset only.
  }
  return params.toString();
}

export function useGlobalChatSearch(filters: GlobalChatSearchFilters, enabled = true) {
  return useInfiniteQuery({
    queryKey: chatInsightKeys.search(filters),
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) => {
      const params = new URLSearchParams({
        q: filters.query,
        offset: String(pageParam),
        limit: String(GLOBAL_SEARCH_PAGE_SIZE),
      });
      for (const key of ["mode", "characterId", "role", "from", "to"] as const) {
        const value = filters[key];
        if (value) params.set(key, value);
      }
      if (filters.perChat) params.set("perChat", String(filters.perChat));
      return api.get<GlobalChatSearchResponse>(`/chat-insights/search?${params.toString()}`, { signal });
    },
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.offset + lastPage.results.length : undefined),
    enabled: enabled && filters.query.trim().length > 0,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });
}

export function useChatStats(chatId: string | null, enabled = true) {
  return useQuery({
    queryKey: chatInsightKeys.stats(chatId ?? ""),
    queryFn: ({ signal }) =>
      api.get<ChatStats>(`/chat-insights/chats/${encodeURIComponent(chatId!)}/stats?${timezoneParams()}`, {
        signal,
      }),
    enabled: enabled && !!chatId,
    staleTime: 30_000,
  });
}

export function useActivityOverview(enabled = true) {
  return useQuery({
    queryKey: chatInsightKeys.activity(),
    queryFn: ({ signal }) => api.get<ActivityOverview>(`/chat-insights/activity?${timezoneParams()}`, { signal }),
    enabled,
    staleTime: 60_000,
  });
}
