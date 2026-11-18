import { useQuery } from "@tanstack/react-query";
import { normalizeTextForMatch, type Message } from "@marinara-engine/shared";
import { Bookmark, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { api } from "../../lib/api-client";
import { isMessageHiddenFromUser } from "../../lib/chat-message-visibility";
import { normalizeHydratedMessage } from "../../lib/message-hydration";
import { cn } from "../../lib/utils";
import { useChatStore } from "../../stores/chat.store";
import { ChatBookmarksList, ChatTrashList } from "../../components/chat/ChatMessageMarksPanels";
import { SearchInput } from "../../components/ui/SearchInput";
import { Spinner } from "../../components/ui/Spinner";
import { Tabs } from "../../components/ui/Tabs";

type SearchPanelView = "search" | "bookmarks" | "trash";
const PANEL_VIEWS = [
  { id: "search", icon: Search, labelKey: "ui.chat.messagemarks.searchTab" },
  { id: "bookmarks", icon: Bookmark, labelKey: "ui.chat.messagemarks.bookmarksTab" },
  { id: "trash", icon: Trash2, labelKey: "ui.chat.messagetrash.trashTab" },
] as const satisfies ReadonlyArray<{ id: SearchPanelView; icon: typeof Search; labelKey: string }>;

type SearchResult = {
  message: Message;
  messageNumber: number;
};

function getResultSnippet(content: string, query: string): string {
  const text = content.replace(/\s+/gu, " ").trim();
  if (text.length <= 180) return text;
  const matchIndex = normalizeTextForMatch(text).indexOf(normalizeTextForMatch(query));
  const start = Math.max(0, matchIndex - 55);
  const end = Math.min(text.length, start + 180);
  return `${start > 0 ? "…" : ""}${text.slice(start, end).trim()}${end < text.length ? "…" : ""}`;
}

/** Search, bookmarks and trash for a chat's messages, inline in Chat Settings. */
export function ChatMessageSearch({ chatId }: { chatId: string }) {
  const { t: localizeUi } = useUiTranslation();
  const [query, setQuery] = useState("");
  const [view, setView] = useState<SearchPanelView>("search");
  // Messages load once the user starts searching or opens Bookmarks, not whenever Chat Settings opens.
  const [engaged, setEngaged] = useState(false);
  const title = localizeUi("chat.toolbar.searchMessages");

  const {
    data: messages,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["chat-message-search", chatId],
    queryFn: ({ signal }) =>
      api.get<Message[]>(`/chats/${chatId}/messages`, { signal }).then((items) => items.map(normalizeHydratedMessage)),
    enabled: engaged,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });

  const results = useMemo<SearchResult[]>(() => {
    const normalizedQuery = normalizeTextForMatch(query.trim());
    if (!normalizedQuery) return [];
    const messageNumber = /^#\d+$/u.test(normalizedQuery) ? Number(normalizedQuery.slice(1)) : null;
    return (messages ?? []).flatMap((message, index) =>
      !isMessageHiddenFromUser(message) &&
      (messageNumber === null
        ? normalizeTextForMatch(message.content).includes(normalizedQuery)
        : index + 1 === messageNumber)
        ? [{ message, messageNumber: index + 1 }]
        : [],
    );
  }, [messages, query]);

  useEffect(() => {
    setQuery("");
    setView("search");
    setEngaged(false);
  }, [chatId]);

  const jumpToMessage = (messageNumber: number) => {
    useChatStore.getState().requestGotoMessage(chatId, messageNumber);
  };

  const showList = view !== "search" || query.trim() !== "";

  return (
    <div data-chat-message-search role="search" aria-label={title} className="flex flex-col">
      <Tabs
        items={PANEL_VIEWS.map(({ id, icon: Icon, labelKey }) => ({
          id,
          label: localizeUi(labelKey),
          icon: <Icon size="0.75rem" />,
        }))}
        value={view}
        onChange={(id) => {
          setView(id);
          setEngaged(true);
        }}
        variant="underline"
        className="px-3 pb-1 pt-2.5"
        label={localizeUi("ui.chat.messagemarks.panelViews")}
      />

      {view === "search" && (
        <div className="shrink-0 px-3 pb-3 pt-1.5">
          <SearchInput
            value={query}
            onChange={setQuery}
            onFocus={() => setEngaged(true)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && results[0]) jumpToMessage(results[0].messageNumber);
            }}
            placeholder={localizeUi("ui.chat.chatmessagesearch.placeholder")}
            label={localizeUi("ui.chat.chatmessagesearch.inputLabel")}
          />
          <p className="mt-2 min-h-4 text-xs text-[var(--muted-foreground)]" role="status" aria-live="polite">
            {query.trim()
              ? localizeUi("ui.chat.chatmessagesearch.resultCount", { count: results.length })
              : localizeUi("ui.chat.chatmessagesearch.startTyping")}
          </p>
        </div>
      )}

      {showList && (
        <div className={cn("max-h-72 overflow-y-auto", view === "search" && "border-t border-[var(--border)]")}>
          {view === "trash" ? (
            // Keyed by chat so another chat's trash starts its progressive fill from the first batch.
            <ChatTrashList key={chatId} chatId={chatId} enabled />
          ) : isLoading ? (
            <div className="flex items-center justify-center gap-2 px-3 py-8 text-sm text-[var(--muted-foreground)]">
              <Spinner size="sm" />
              {localizeUi("ui.chat.chatmessagesearch.loading")}
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center gap-3 px-3 py-8 text-center text-sm text-[var(--muted-foreground)]">
              <p>{localizeUi("ui.chat.chatmessagesearch.loadFailed")}</p>
              <button
                type="button"
                onClick={() => void refetch()}
                className="mari-chrome-control mari-chrome-control--small px-3"
              >
                {localizeUi("ui.chat.chatmessagesearch.tryAgain")}
              </button>
            </div>
          ) : view === "bookmarks" ? (
            <ChatBookmarksList messages={messages ?? []} onJump={jumpToMessage} />
          ) : query.trim() && results.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-[var(--muted-foreground)]">
              {localizeUi("ui.chat.chatmessagesearch.noMatches")}
            </p>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {results.map(({ message, messageNumber }) => (
                <button
                  key={message.id}
                  type="button"
                  onClick={() => jumpToMessage(messageNumber)}
                  className="block w-full px-3 py-2.5 text-left transition-colors hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--primary)]"
                  title={localizeUi("ui.chat.chatmessagesearch.jumpToMessage", { number: messageNumber })}
                >
                  <span className="text-xs font-semibold text-[var(--primary)]">
                    {localizeUi("ui.chat.chatmessagesearch.messageNumber", { number: messageNumber })}
                  </span>
                  <span className="mt-1 line-clamp-3 block break-words text-sm leading-5 text-[var(--foreground)]">
                    {getResultSnippet(message.content, query.trim())}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
