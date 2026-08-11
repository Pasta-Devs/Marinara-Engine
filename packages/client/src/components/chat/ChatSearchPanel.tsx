import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, ChevronUp, Search, X } from "lucide-react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { useChatStore } from "../../stores/chat.store";
import { useCharacterSummaries } from "../../hooks/use-characters";
import { useChatSearchCorpus, useChatSearchResults, type ChatSearchHit } from "../../hooks/use-chat-search";
import { cn } from "../../lib/utils";
import {
  ROLEPLAY_POPOVER_CLOSE_BUTTON,
  ROLEPLAY_POPOVER_HEADER,
  ROLEPLAY_POPOVER_SCROLL_AREA,
  ROLEPLAY_POPOVER_SHELL,
  ROLEPLAY_POPOVER_TITLE,
} from "./roleplay-popover-styles";

const DESKTOP_WIDTH = 340;
const MOBILE_QUERY = "(max-width: 767px)";

type Anchor = { top: number; right: number };

/**
 * "Find in chat" — a naive, case-insensitive substring search over the open
 * conversation, with jump-to-message.
 *
 * Presentation is the A+B hybrid: a result list you read and choose from
 * (drawer on desktop, bottom sheet on mobile), which collapses to a compact
 * prev/next stepper once you have jumped, so walking the remaining matches
 * costs one tap.
 *
 * Jumping delegates to the existing `/goto` machinery via
 * `requestGotoMessageId` — ChatArea paginates back until the target message is
 * loaded, centres it, and suppresses auto-scroll-to-bottom. The id form is used
 * rather than the message number because search already knows the id, and
 * resolving a number depends on `totalMessageCount - messages.length`, which
 * duplicate entries in the paginated cache distort.
 */
export function ChatSearchPanel() {
  const { t } = useUiTranslation();
  const activeChatId = useChatStore((s) => s.activeChatId);
  const open = useChatStore((s) => s.chatSearchOpen);
  const openChatSearch = useChatStore((s) => s.openChatSearch);
  const closeChatSearch = useChatStore((s) => s.closeChatSearch);
  const requestGotoMessageId = useChatStore((s) => s.requestGotoMessageId);
  const setChatSearchCurrent = useChatStore((s) => s.setChatSearchCurrent);

  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.matchMedia(MOBILE_QUERY).matches,
  );
  const [anchor, setAnchor] = useState<Anchor>({ top: 64, right: 12 });
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: corpus, isLoading } = useChatSearchCorpus(activeChatId, open);
  const results = useChatSearchResults(corpus, query);

  const characterIds = useMemo(() => {
    const ids = new Set<string>();
    for (const hit of results) if (hit.characterId) ids.add(hit.characterId);
    return Array.from(ids);
  }, [results]);
  const { data: characterSummaries } = useCharacterSummaries(characterIds, characterIds.length > 0);
  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const character of characterSummaries ?? []) map.set(character.id, character.name);
    return map;
  }, [characterSummaries]);

  // ── Viewport mode ────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia(MOBILE_QUERY);
    const sync = () => setIsMobile(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  // ── Anchor the desktop drawer under its toolbar trigger ──────────
  useLayoutEffect(() => {
    if (!open || isMobile || typeof window === "undefined") return;
    const measure = () => {
      const trigger = document.querySelector("[data-chat-search-trigger]");
      const rect = trigger?.getBoundingClientRect();
      if (!rect || rect.width === 0) {
        setAnchor({ top: 64, right: 12 });
        return;
      }
      // Clamp so the drawer stays fully on screen even when the trigger sits
      // far from the right edge (narrow windows, or a left-aligned toolbar).
      const maxRight = Math.max(8, window.innerWidth - DESKTOP_WIDTH - 8);
      setAnchor({
        top: rect.bottom + 6,
        right: Math.min(maxRight, Math.max(8, window.innerWidth - rect.right)),
      });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [open, isMobile]);

  // ── Reset when the panel opens or the chat changes ───────────────
  useEffect(() => {
    if (!open) return;
    setActiveIndex(-1);
    setCollapsed(false);
    setChatSearchCurrent(null);
    const focus = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(focus);
  }, [open, activeChatId, setChatSearchCurrent]);

  useEffect(() => {
    setQuery("");
  }, [activeChatId]);

  // A new query invalidates the previous selection.
  useEffect(() => {
    setActiveIndex(-1);
    setCollapsed(false);
    setChatSearchCurrent(null);
  }, [query, setChatSearchCurrent]);

  // ── Jumping ──────────────────────────────────────────────────────
  const jumpTo = useCallback(
    (index: number) => {
      if (!activeChatId || !results.length) return;
      const wrapped = ((index % results.length) + results.length) % results.length;
      const hit = results[wrapped];
      if (!hit) return;
      setActiveIndex(wrapped);
      setChatSearchCurrent(hit.messageNumber);
      // Jump by id: search already knows it, so the jump does not depend on
      // the message-number arithmetic the paginated cache can distort.
      requestGotoMessageId(activeChatId, hit.messageId, hit.messageNumber);
      if (isMobile) setCollapsed(true);
    },
    [activeChatId, results, isMobile, requestGotoMessageId, setChatSearchCurrent],
  );

  const step = useCallback((delta: number) => jumpTo(activeIndex < 0 ? 0 : activeIndex + delta), [activeIndex, jumpTo]);

  // ── Keyboard ─────────────────────────────────────────────────────
  // Ctrl/Cmd+K opens. Browser find (Ctrl+F) is deliberately left alone.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        if (!useChatStore.getState().activeChatId) return;
        event.preventDefault();
        openChatSearch();
        return;
      }
      if (event.key === "Escape" && useChatStore.getState().chatSearchOpen) {
        event.preventDefault();
        closeChatSearch();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openChatSearch, closeChatSearch]);

  // ── Mark matching messages in the rendered list ───────────────────
  // The message list re-renders as older pages load, so re-apply on mutation.
  const currentMessageId = activeIndex >= 0 ? results[activeIndex]?.messageId : undefined;
  useEffect(() => {
    if (typeof document === "undefined") return;

    const clear = () => {
      document.querySelectorAll("[data-mari-search-hit],[data-mari-search-current]").forEach((element) => {
        element.removeAttribute("data-mari-search-hit");
        element.removeAttribute("data-mari-search-current");
      });
    };

    if (!open || !results.length) {
      clear();
      return;
    }

    const hitIds = new Set(results.map((hit) => hit.messageId));
    let frame = 0;
    const apply = () => {
      frame = 0;
      document.querySelectorAll("[data-message-id]").forEach((element) => {
        const id = element.getAttribute("data-message-id");
        if (!id) return;
        if (hitIds.has(id)) element.setAttribute("data-mari-search-hit", "");
        else element.removeAttribute("data-mari-search-hit");
        if (id === currentMessageId) element.setAttribute("data-mari-search-current", "");
        else element.removeAttribute("data-mari-search-current");
      });
    };

    apply();
    const observer = new MutationObserver(() => {
      if (frame) return;
      frame = requestAnimationFrame(apply);
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
      clear();
    };
  }, [open, results, currentMessageId]);

  if (!open || !activeChatId) return null;

  const authorOf = (hit: ChatSearchHit) =>
    hit.role === "user" ? t("chat.search.you") : (hit.characterId && nameById.get(hit.characterId)) || "";

  const searchField = (
    <div className="flex items-center gap-2 rounded-lg border border-[var(--marinara-chat-chrome-input-border)] bg-[var(--marinara-chat-chrome-panel-bg)] px-2.5 py-1.5 focus-within:ring-1 focus-within:ring-[var(--marinara-chat-chrome-focus-ring)]">
      <Search size="0.8125rem" className="shrink-0 text-[var(--marinara-chat-chrome-panel-muted)]" />
      <input
        ref={inputRef}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            step(event.shiftKey ? -1 : 1);
          } else if (event.key === "ArrowDown") {
            event.preventDefault();
            step(1);
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            step(-1);
          }
        }}
        placeholder={t("chat.search.placeholder")}
        className="min-w-0 flex-1 bg-transparent text-xs text-[var(--marinara-chat-chrome-panel-text)] outline-none placeholder:text-[var(--marinara-chat-chrome-panel-muted)]"
        spellCheck={false}
        autoComplete="off"
      />
      {query && (
        <button
          type="button"
          onClick={() => {
            setQuery("");
            inputRef.current?.focus();
          }}
          className="shrink-0 rounded p-0.5 text-[var(--marinara-chat-chrome-panel-muted)] transition-colors hover:text-[var(--marinara-chat-chrome-panel-text)]"
          aria-label={t("chat.search.close")}
        >
          <X size="0.75rem" />
        </button>
      )}
    </div>
  );

  const stepper = results.length > 0 && (
    <div className="flex shrink-0 items-center gap-1">
      <span className="mr-1 whitespace-nowrap font-mono text-[0.625rem] tabular-nums text-[var(--marinara-chat-chrome-panel-muted)]">
        {activeIndex >= 0
          ? t("chat.search.position", { current: activeIndex + 1, total: results.length })
          : t("chat.search.matches", { count: results.length })}
      </span>
      <button
        type="button"
        onClick={() => step(-1)}
        className="rounded-md border border-[var(--marinara-chat-chrome-panel-border)] p-1 text-[var(--marinara-chat-chrome-panel-text)] transition-colors hover:bg-[var(--marinara-chat-chrome-highlight-bg)] active:scale-90"
        aria-label={t("chat.search.previous")}
      >
        <ChevronUp size="0.75rem" />
      </button>
      <button
        type="button"
        onClick={() => step(1)}
        className="rounded-md border border-[var(--marinara-chat-chrome-panel-border)] p-1 text-[var(--marinara-chat-chrome-panel-text)] transition-colors hover:bg-[var(--marinara-chat-chrome-highlight-bg)] active:scale-90"
        aria-label={t("chat.search.next")}
      >
        <ChevronDown size="0.75rem" />
      </button>
    </div>
  );

  const resultList = (
    <div className={cn("min-h-0 flex-1 overflow-y-auto p-2", ROLEPLAY_POPOVER_SCROLL_AREA)}>
      {isLoading ? (
        <p className="px-2 py-6 text-center text-[0.6875rem] text-[var(--marinara-chat-chrome-panel-muted)]">
          {t("chat.search.loading")}
        </p>
      ) : !query.trim() ? (
        <p className="px-2 py-6 text-center text-[0.6875rem] leading-relaxed text-[var(--marinara-chat-chrome-panel-muted)]">
          {t("chat.search.empty")}
        </p>
      ) : results.length === 0 ? (
        <p className="px-2 py-6 text-center text-[0.6875rem] leading-relaxed text-[var(--marinara-chat-chrome-panel-muted)]">
          {t("chat.search.noResults", { query: query.trim() })}
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {results.map((hit, index) => (
            <button
              key={hit.messageId}
              type="button"
              onClick={() => jumpTo(index)}
              aria-label={t("chat.search.jumpToMessage", { number: hit.messageNumber })}
              className={cn(
                "w-full rounded-lg border px-2.5 py-2 text-left transition-colors",
                index === activeIndex
                  ? "border-[var(--marinara-chat-chrome-button-border-active)] bg-[var(--marinara-chat-chrome-highlight-bg)]"
                  : "border-[var(--marinara-chat-chrome-panel-border)] hover:bg-[var(--marinara-chat-chrome-highlight-bg-hover)]",
              )}
            >
              <span className="mb-1 flex items-baseline justify-between gap-2">
                <span className="truncate text-[0.625rem] font-semibold text-[var(--marinara-chat-chrome-panel-title)]">
                  {authorOf(hit)}
                </span>
                <span className="shrink-0 font-mono text-[0.5625rem] tabular-nums text-[var(--marinara-chat-chrome-panel-muted)]">
                  #{hit.messageNumber}
                </span>
              </span>
              <span className="block text-[0.6875rem] leading-relaxed text-[var(--marinara-chat-chrome-panel-text)]">
                {hit.snippet.slice(0, hit.matchStart)}
                {/* The highlight bg and highlight text tokens are the same hue at
                    different alphas, which reads fine on a dark panel and washes out
                    on a light one. Take the match's colour from the panel title
                    instead, and let the tint plus weight carry the emphasis. */}
                <mark className="rounded-sm bg-[var(--marinara-chat-chrome-highlight-bg)] px-0.5 font-semibold text-[var(--marinara-chat-chrome-panel-title)]">
                  {hit.snippet.slice(hit.matchStart, hit.matchStart + hit.matchLength)}
                </mark>
                {hit.snippet.slice(hit.matchStart + hit.matchLength)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );

  const header = (
    <div className={cn(ROLEPLAY_POPOVER_HEADER, "flex flex-col gap-2")}>
      <div className="flex items-start justify-between gap-2">
        <div className={cn(ROLEPLAY_POPOVER_TITLE, "min-w-0")}>
          <Search size="0.8125rem" />
          <span className="truncate">{t("chat.search.title")}</span>
        </div>
        <button
          type="button"
          onClick={closeChatSearch}
          className={cn(ROLEPLAY_POPOVER_CLOSE_BUTTON, "shrink-0")}
          aria-label={t("chat.search.close")}
        >
          <X size="0.875rem" />
        </button>
      </div>
      {searchField}
      {results.length > 0 && <div className="flex items-center justify-end">{stepper}</div>}
    </div>
  );

  // ── Mobile: bottom sheet, collapsing to a stepper pill after a jump ──
  if (isMobile) {
    if (collapsed) {
      return createPortal(
        <div
          data-chat-floating-panel
          data-component="ChatSearchStepper"
          className={cn(
            ROLEPLAY_POPOVER_SHELL,
            "fixed inset-x-3 z-[9998] flex items-center gap-2 rounded-full px-3 py-2",
          )}
          style={{ bottom: "calc(5.5rem + env(safe-area-inset-bottom))" }}
        >
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            className="flex min-w-0 flex-1 items-center gap-2 text-left"
          >
            <Search size="0.75rem" className="shrink-0 text-[var(--marinara-chat-chrome-panel-muted)]" />
            <span className="truncate text-[0.6875rem] text-[var(--marinara-chat-chrome-panel-text)]">
              {query.trim()}
            </span>
          </button>
          {stepper}
          <button
            type="button"
            onClick={closeChatSearch}
            className={cn(ROLEPLAY_POPOVER_CLOSE_BUTTON, "shrink-0")}
            aria-label={t("chat.search.close")}
          >
            <X size="0.875rem" />
          </button>
        </div>,
        document.body,
      );
    }

    return createPortal(
      <div
        data-chat-floating-panel
        data-component="ChatSearchSheet"
        className={cn(
          ROLEPLAY_POPOVER_SHELL,
          "fixed inset-x-0 bottom-0 z-[9998] flex max-h-[72dvh] flex-col rounded-b-none rounded-t-2xl",
        )}
      >
        <div className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-[var(--marinara-chat-chrome-panel-border)]" />
        {header}
        {resultList}
        <div className="h-[env(safe-area-inset-bottom)] shrink-0" />
      </div>,
      document.body,
    );
  }

  // ── Desktop: drawer anchored under the toolbar trigger ──────────────
  return createPortal(
    <div
      data-chat-floating-panel
      data-component="ChatSearchDrawer"
      className={cn(ROLEPLAY_POPOVER_SHELL, "fixed z-[9998] flex flex-col overflow-hidden")}
      style={{
        top: anchor.top,
        right: anchor.right,
        width: DESKTOP_WIDTH,
        maxHeight: `calc(100dvh - ${anchor.top + 16}px)`,
      }}
    >
      {header}
      {resultList}
    </div>,
    document.body,
  );
}
