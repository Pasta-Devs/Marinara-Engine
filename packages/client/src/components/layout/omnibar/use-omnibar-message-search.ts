import { normalizeTextForMatch } from "@marinara-engine/shared";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { OmnibarResult } from "../../../lib/omnibar-search";
import type { parseOmnibarScope } from "../../../lib/omnibar-scope";
import {
  MIN_MESSAGE_SEARCH_LENGTH,
  buildOmnibarMessageResults,
  buildOmnibarGlobalMessageResults,
  buildOmnibarLorebookEntryResults,
} from "../../../lib/omnibar-results";
import { isMessageHiddenFromUser } from "../../../lib/chat-message-visibility";
import { type useLorebooks, useLorebookEntrySearch } from "../../../hooks/use-lorebooks";
import { useDebouncedValue } from "../../../hooks/use-debounced-value";
import { useChatMessageSearchSource } from "../../../hooks/use-chats";
import { GLOBAL_MESSAGE_HITS_PER_CHAT, useGlobalChatSearch } from "../../../hooks/use-chat-insights";

/** Message and lorebook-entry hits: the open chat from the client cache, other chats and entries from the server. */
export function useOmnibarMessageSearch({
  activeChatId,
  deferredQuery,
  queryScope,
  lorebooks,
}: {
  activeChatId: string | null;
  deferredQuery: string;
  queryScope: ReturnType<typeof parseOmnibarScope>["scope"];
  lorebooks: ReturnType<typeof useLorebooks>["data"];
}) {
  const { t } = useTranslation();
  // Chat search: the engine only stores messages per chat, so this searches the
  // chat you are in rather than pretending to search all of them. The message
  // list is shared with the in-chat search panel's cache.
  const messageSearchQuery = deferredQuery.trim();
  const messageSearch = useChatMessageSearchSource(
    activeChatId ?? null,
    !!activeChatId && messageSearchQuery.length >= MIN_MESSAGE_SEARCH_LENGTH,
  );
  // Normalizing every message body is NFKC + regex work over the whole chat, so
  // it is cached against the message list instead of redone on each keystroke.
  const messageSearchIndex = useMemo(
    () =>
      (messageSearch.data ?? []).map((message) => ({
        message,
        haystack: isMessageHiddenFromUser(message) ? null : normalizeTextForMatch(message.content),
      })),
    [messageSearch.data],
  );
  const messageResults = useMemo<OmnibarResult[]>(
    () => buildOmnibarMessageResults({ activeChatId, messageSearchIndex, messageSearchQuery, t }),
    [activeChatId, messageSearchIndex, messageSearchQuery, t],
  );
  // The other chats' transcripts are not on the client, so searching them is a
  // server read. Only asked for once the query is long enough to be selective.
  const globalMessageScoped = !queryScope || queryScope === "messages";
  // Each request scans every chat on the server, so wait for a typing pause,
  // with the same delay as the Search All Chats modal.
  const globalMessageQuery = useDebouncedValue(messageSearchQuery, 300);
  const globalMessageSearch = useGlobalChatSearch(
    // Two hits per chat, so the rows cover every chat that matches, not only the newest.
    { query: globalMessageQuery, perChat: GLOBAL_MESSAGE_HITS_PER_CHAT },
    globalMessageQuery.length >= MIN_MESSAGE_SEARCH_LENGTH && globalMessageScoped,
  );
  const globalMessageResults = useMemo<OmnibarResult[]>(
    () =>
      buildOmnibarGlobalMessageResults({
        activeChatId,
        // The query keeps the previous page while the next one loads; hits for
        // an older query are not answers to this one.
        chats:
          globalMessageSearch.data?.pages[0]?.query === messageSearchQuery
            ? globalMessageSearch.data.pages[0].chats
            : [],
        hits:
          globalMessageSearch.data?.pages[0]?.query === messageSearchQuery
            ? globalMessageSearch.data.pages[0].results
            : [],
        messageSearchQuery,
        t,
      }),
    [activeChatId, globalMessageSearch.data, messageSearchQuery, t],
  );
  // Lorebook entries: the same typing pause as message search, with no scope or `lore:`.
  const entrySearchScoped = !queryScope || queryScope === "lorebook";
  const lorebookEntrySearch = useLorebookEntrySearch(
    globalMessageQuery,
    globalMessageQuery.length >= MIN_MESSAGE_SEARCH_LENGTH && entrySearchScoped,
  );
  const lorebookNameById = useMemo(
    () => new Map((lorebooks ?? []).map((book) => [book.id, book.name] as const)),
    [lorebooks],
  );
  const lorebookEntryResults = useMemo<OmnibarResult[]>(
    () =>
      // Only while the typed query still matches the one that was searched.
      globalMessageQuery === messageSearchQuery
        ? buildOmnibarLorebookEntryResults({
            entries: lorebookEntrySearch.data ?? [],
            lorebookNameById,
            query: messageSearchQuery,
            t,
          })
        : [],
    [globalMessageQuery, lorebookEntrySearch.data, lorebookNameById, messageSearchQuery, t],
  );
  return { messageResults, globalMessageScoped, globalMessageSearch, globalMessageResults, lorebookEntryResults };
}
