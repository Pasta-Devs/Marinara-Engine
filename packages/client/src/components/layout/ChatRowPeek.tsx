// ──────────────────────────────────────────────
// Hover peek — read the tail of a chat without switching to it
// ──────────────────────────────────────────────
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation as useUiTranslation } from "react-i18next";
import { useChatMessagePeek } from "../../hooks/use-chats";
import { CHAT_FLOATING_UI_DISMISS_EVENT } from "../../lib/chat-floating-ui-events";
import { cn } from "../../lib/utils";

/** Dwell before opening, so sweeping the pointer down the list fires no requests. */
const HOVER_DELAY_MS = 500;
const PEEK_MESSAGE_COUNT = 4;

interface ChatRowPeekProps {
  /** The scroll container holding the `[data-chat-id]` rows. */
  containerRef: React.RefObject<HTMLElement | null>;
  /** Peek is suppressed for this chat — it's already on screen. */
  activeChatId: string | null;
  /** Suppressed entirely while the list is in multi-select. */
  disabled?: boolean;
}

/**
 * Rendered once per list rather than per row. Hover is tracked by delegating
 * mouseover/mouseout on the container and reading `data-chat-id`, so pointer movement
 * never re-renders the row list — only this component.
 */
export function ChatRowPeek({ containerRef, activeChatId, disabled }: ChatRowPeekProps) {
  const { t: localizeUi } = useUiTranslation();
  const [chatId, setChatId] = useState<string | null>(null);
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number; ready: boolean }>({ top: 0, left: 0, ready: false });

  const close = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    setChatId(null);
    setAnchor(null);
  }, []);

  // Touch devices have no hover; never arm the listeners there.
  const hoverCapable =
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia("(hover: hover)").matches
      : false;

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !hoverCapable || disabled) return;

    const onOver = (event: MouseEvent) => {
      const row = (event.target as HTMLElement | null)?.closest?.("[data-chat-id]") as HTMLElement | null;
      const id = row?.dataset.chatId ?? null;
      if (!id || id === activeChatId) {
        close();
        return;
      }
      if (id === chatId) return;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setChatId(id);
        setAnchor(row!.getBoundingClientRect());
      }, HOVER_DELAY_MS);
    };

    const onLeave = () => close();

    container.addEventListener("mouseover", onOver);
    container.addEventListener("mouseleave", onLeave);
    return () => {
      container.removeEventListener("mouseover", onOver);
      container.removeEventListener("mouseleave", onLeave);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [containerRef, hoverCapable, disabled, activeChatId, chatId, close]);

  // Close alongside every other chat popover (navigation, modals, …), and on Escape.
  useEffect(() => {
    if (!chatId) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener(CHAT_FLOATING_UI_DISMISS_EVENT, close);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener(CHAT_FLOATING_UI_DISMISS_EVENT, close);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, true);
    };
  }, [chatId, close]);

  const { data: messages, isLoading } = useChatMessagePeek(chatId, PEEK_MESSAGE_COUNT, Boolean(chatId));

  // Anchor to the right of the row, clamped into the viewport.
  useLayoutEffect(() => {
    if (!chatId || !anchor || !panelRef.current) {
      setPos({ top: 0, left: 0, ready: false });
      return;
    }
    const panel = panelRef.current.getBoundingClientRect();
    const pad = 8;
    const left = Math.min(anchor.right + pad, window.innerWidth - panel.width - pad);
    const top = Math.max(pad, Math.min(anchor.top, window.innerHeight - panel.height - pad));
    setPos({ top, left, ready: true });
  }, [chatId, anchor, messages, isLoading]);

  if (!chatId || !anchor) return null;

  return createPortal(
    <div
      ref={panelRef}
      data-chat-floating-panel
      role="tooltip"
      className={cn(
        "pointer-events-none fixed z-50 w-72 rounded-xl border border-[var(--border)] bg-[var(--popover)]/95 p-3 shadow-xl backdrop-blur-sm",
        pos.ready ? "animate-fade-in-up opacity-100" : "opacity-0",
      )}
      style={{ top: pos.top, left: pos.left }}
    >
      {isLoading ? (
        <p className="text-[0.6875rem] text-[var(--muted-foreground)]">{localizeUi("ui.layout.chatsidebar.loading")}</p>
      ) : messages?.length ? (
        <div className="flex flex-col gap-2">
          {messages.map((message) => (
            <div key={message.id} className="flex gap-2 text-[0.6875rem] leading-snug">
              {/* Speaker rail: a tinted bar reads faster down a stack than a repeated word,
                  and keeps the message text on one flush left edge. */}
              <span
                aria-hidden
                className={cn(
                  "mt-0.5 w-0.5 shrink-0 rounded-full",
                  message.role === "user" ? "bg-[var(--muted-foreground)]/40" : "bg-[var(--primary)]/60",
                )}
              />
              <div className="min-w-0">
                <span className="mari-chrome-accent-text-muted text-[0.625rem] font-medium uppercase tracking-wide">
                  {message.role === "user"
                    ? localizeUi("ui.layout.chatsidebar.peekYou")
                    : localizeUi("ui.layout.chatsidebar.peekReply")}
                </span>
                {/* Raw content in a clamped box — the house pattern; there is no
                    strip-markdown helper and pre-truncating in JS would cut mid-syntax.
                    Must be a block for line-clamp to apply. */}
                <p className="line-clamp-2 break-words text-[var(--foreground)] opacity-80">{message.content}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mari-accent-animated text-[0.6875rem] text-[var(--marinara-chat-chrome-button-text-active)]">
          {localizeUi("ui.layout.chatsidebar.peekEmpty")}
        </p>
      )}
    </div>,
    document.body,
  );
}
