import { useQuery } from "@tanstack/react-query";
import { normalizeTextForMatch, type Message } from "@marinara-engine/shared";
import { Loader2, Search, X } from "lucide-react";
import { createPortal } from "react-dom";
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { api } from "../../lib/api-client";
import { CHAT_FLOATING_UI_DISMISS_EVENT } from "../../lib/chat-floating-ui-events";
import { isMessageHiddenFromUser } from "../../lib/chat-message-visibility";
import { normalizeHydratedMessage } from "../../lib/message-hydration";
import { cn } from "../../lib/utils";
import { useChatStore } from "../../stores/chat.store";
import {
  CHAT_TOOLBAR_ACTION_EVENT,
  getChatFloatingPanelDesktopRight,
  getChatToolbarButtonClass,
  readAnnouncedChatToolbarPanelAction,
  readChatToolbarFloatingPanelAnchor,
  type ChatToolbarFloatingPanelAnchor,
} from "./ChatToolbarControls";
import {
  NEUTRAL_PANEL_CLOSE_BUTTON,
  NEUTRAL_PANEL_CLOSE_ICON_SIZE,
  NEUTRAL_PANEL_HEADER,
  NEUTRAL_PANEL_SHELL,
  NEUTRAL_PANEL_TITLE,
} from "../ui/neutral-surface-styles";

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

function getPanelStyle(anchor: NonNullable<ChatToolbarFloatingPanelAnchor>): CSSProperties {
  const mobile = window.innerWidth < 768;
  return {
    top: anchor.top,
    right: mobile ? `${anchor.right}px` : getChatFloatingPanelDesktopRight(anchor),
    width: mobile ? `min(22rem, calc(100vw - ${anchor.right}px - 0.75rem))` : "min(22rem, calc(100vw - 1rem))",
    maxHeight: `calc(100dvh - ${anchor.top + 8}px)`,
  };
}

export function ChatMessageSearch({ chatId }: { chatId: string }) {
  const { t: localizeUi } = useUiTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [anchor, setAnchor] = useState<ChatToolbarFloatingPanelAnchor>(null);
  const panelId = useId();
  const titleId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
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
    enabled: open,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });

  const results = useMemo<SearchResult[]>(() => {
    const normalizedQuery = normalizeTextForMatch(query.trim());
    if (!normalizedQuery) return [];
    return (messages ?? []).flatMap((message, index) =>
      !isMessageHiddenFromUser(message) && normalizeTextForMatch(message.content).includes(normalizedQuery)
        ? [{ message, messageNumber: index + 1 }]
        : [],
    );
  }, [messages, query]);

  useEffect(() => {
    setOpen(false);
    setQuery("");
  }, [chatId]);

  useLayoutEffect(() => {
    if (!open) {
      setAnchor(null);
      return;
    }
    const update = () => setAnchor(readChatToolbarFloatingPanelAnchor(buttonRef.current));
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const handlePointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return;
      if (buttonRef.current?.contains(event.target) || panelRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const handleToolbarAction = (event: Event) => {
      if (readAnnouncedChatToolbarPanelAction(event) !== "search") setOpen(false);
    };
    const handleDismiss = () => setOpen(false);
    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener(CHAT_TOOLBAR_ACTION_EVENT, handleToolbarAction);
    window.addEventListener(CHAT_FLOATING_UI_DISMISS_EVENT, handleDismiss);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener(CHAT_TOOLBAR_ACTION_EVENT, handleToolbarAction);
      window.removeEventListener(CHAT_FLOATING_UI_DISMISS_EVENT, handleDismiss);
    };
  }, [open]);

  const jumpToMessage = (messageNumber: number) => {
    useChatStore.getState().requestGotoMessage(chatId, messageNumber);
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        data-chat-help="search"
        data-chat-toolbar-panel-action="search"
        className={getChatToolbarButtonClass({ open })}
        title={title}
        aria-label={title}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((current) => !current)}
      >
        <Search size="0.875rem" />
      </button>

      {open &&
        anchor &&
        createPortal(
          <div
            ref={panelRef}
            id={panelId}
            data-chat-floating-panel
            data-chat-toolbar-panel-action="search"
            role="dialog"
            aria-labelledby={titleId}
            className={cn(NEUTRAL_PANEL_SHELL, "fixed z-[9999] flex min-h-0 flex-col overflow-hidden")}
            style={getPanelStyle(anchor)}
          >
            <div className={cn(NEUTRAL_PANEL_HEADER, "flex shrink-0 items-center justify-between")}>
              <h3 id={titleId} className={NEUTRAL_PANEL_TITLE}>
                <Search size="0.8125rem" className="shrink-0 text-[var(--muted-foreground)]" />
                {title}
              </h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className={NEUTRAL_PANEL_CLOSE_BUTTON}
                aria-label={localizeUi("ui.chat.chatmessagesearch.close")}
              >
                <X size={NEUTRAL_PANEL_CLOSE_ICON_SIZE} />
              </button>
            </div>

            <div className="shrink-0 p-3">
              <div className="relative">
                <Search
                  size="0.875rem"
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]"
                />
                <input
                  ref={inputRef}
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && results[0]) jumpToMessage(results[0].messageNumber);
                  }}
                  placeholder={localizeUi("ui.chat.chatmessagesearch.placeholder")}
                  aria-label={localizeUi("ui.chat.chatmessagesearch.inputLabel")}
                  className="h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] pl-9 pr-3 text-sm text-[var(--foreground)] outline-none transition-colors placeholder:text-[var(--muted-foreground)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/25"
                />
              </div>
              <p className="mt-2 min-h-4 text-xs text-[var(--muted-foreground)]" role="status" aria-live="polite">
                {query.trim()
                  ? localizeUi("ui.chat.chatmessagesearch.resultCount", { count: results.length })
                  : localizeUi("ui.chat.chatmessagesearch.startTyping")}
              </p>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto border-t border-[var(--border)]">
              {isLoading ? (
                <div className="flex items-center justify-center gap-2 px-3 py-8 text-sm text-[var(--muted-foreground)]">
                  <Loader2 size="0.875rem" className="animate-spin" />
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
          </div>,
          document.body,
        )}
    </>
  );
}
