// ──────────────────────────────────────────────
// UI: Kaomoji Picker — lightweight anchored popover
// ──────────────────────────────────────────────
import { useState, useRef, useEffect, useCallback, useLayoutEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Search } from "lucide-react";
import { cn } from "../../lib/utils";
import { KAOMOJI_CATEGORIES, KAOMOJI_ALL, searchKaomoji } from "../../lib/kaomoji-catalog";
import { rememberRecentMedia, useRecentMedia } from "../../hooks/use-recent-media";

interface KaomojiPickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (kaomoji: string) => void;
  anchorRef?: React.RefObject<HTMLElement | null>;
  /** The composer bar; when provided the panel pins above it and grows upward. */
  containerRef?: React.RefObject<HTMLElement | null>;
  /** Render inline (no portal/positioning) — for the Conversation media tab panel. */
  embedded?: boolean;
}

const PICKER_WIDTH = 320;
const PICKER_HEIGHT = 360;

export function KaomojiPicker({ open, onClose, onSelect, anchorRef, containerRef, embedded }: KaomojiPickerProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [pos, setPos] = useState<{ top?: number; left?: number; right?: number; maxHeight?: number }>({});
  const recentKaomoji = useRecentMedia("kaomoji");

  const results = useMemo(() => {
    if (search.trim()) return searchKaomoji(search);
    return KAOMOJI_CATEGORIES[activeCategory]?.items ?? KAOMOJI_ALL;
  }, [search, activeCategory]);

  const handleSelect = useCallback(
    (value: string) => {
      rememberRecentMedia("kaomoji", { value, label: value });
      onSelect(value);
    },
    [onSelect],
  );

  // Reset transient state each time it opens.
  useEffect(() => {
    if (open) {
      setSearch("");
      setActiveCategory(0);
    }
  }, [open]);

  // Close on Escape (anchored mode only; the embedded host owns dismissal).
  // Outside pointer presses are handled by the inert backdrop rendered beneath
  // the panel so native Firefox scrollbar interactions never look like outside
  // document clicks.
  useEffect(() => {
    if (!open || embedded) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose, embedded]);

  const updatePosition = useCallback(() => {
    if (!anchorRef?.current) return;
    const btnRect = anchorRef.current.getBoundingClientRect();
    const pad = 8;
    const viewport = window.visualViewport;
    const viewportLeft = viewport?.offsetLeft ?? 0;
    const viewportTop = viewport?.offsetTop ?? 0;
    const vw = viewport?.width ?? window.innerWidth;
    const vh = viewport?.height ?? window.innerHeight;
    const visibleLeft = viewportLeft;
    const visibleTop = viewportTop;
    const visibleRight = viewportLeft + vw;
    const panelWidth = Math.min(PICKER_WIDTH, Math.max(0, vw - 2 * pad));
    const btnRight = btnRect.right + viewportLeft;

    if (containerRef?.current) {
      const barTop = containerRef.current.getBoundingClientRect().top + viewportTop;
      const maxHeight = Math.min(PICKER_HEIGHT, Math.max(0, barTop - visibleTop - 2 * pad));
      const top = Math.max(visibleTop + pad, barTop - maxHeight - pad);
      if (vw < 480) {
        setPos({ top, left: visibleLeft + Math.max(pad, (vw - panelWidth) / 2), maxHeight });
      } else {
        const alignedLeft = btnRight - panelWidth;
        if (alignedLeft < visibleLeft + pad) setPos({ top, left: visibleLeft + pad, maxHeight });
        else setPos({ top, right: Math.max(pad, visibleRight - btnRight), maxHeight });
      }
      return;
    }

    const maxHeight = Math.min(PICKER_HEIGHT, Math.max(0, vh - 2 * pad));
    const btnBottom = btnRect.bottom + viewportTop;
    const btnTop = btnRect.top + viewportTop;
    const spaceBelow = visibleTop + vh - btnBottom;
    const openBelow = spaceBelow >= maxHeight + pad || spaceBelow >= btnTop - visibleTop;
    let top = openBelow ? btnBottom + pad : btnTop - pad - maxHeight;
    top = Math.max(visibleTop + pad, Math.min(top, visibleTop + vh - maxHeight - pad));
    let left = btnRight - panelWidth;
    left = Math.max(visibleLeft + pad, Math.min(left, visibleRight - panelWidth - pad));
    setPos({ top, left, maxHeight });
  }, [anchorRef, containerRef]);

  useLayoutEffect(() => {
    if (!open || embedded) {
      if (open && embedded) searchInputRef.current?.focus();
      return;
    }
    updatePosition();
    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(updatePosition);
    };
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, true);
    window.visualViewport?.addEventListener("resize", schedule);
    window.visualViewport?.addEventListener("scroll", schedule);
    searchInputRef.current?.focus();
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
      window.visualViewport?.removeEventListener("resize", schedule);
      window.visualViewport?.removeEventListener("scroll", schedule);
    };
  }, [open, embedded, updatePosition]);

  if (!open) return null;

  const body = (
    <>
      <div className="border-b border-foreground/10 px-3 py-2">
        <div
          data-kaomoji-search-shell
          className="flex items-center gap-2 rounded-md bg-foreground/5 px-2.5 py-1.5 ring-1 ring-foreground/10 transition-shadow focus-within:ring-foreground/20"
        >
          <Search aria-hidden="true" size="0.875rem" className="shrink-0 text-foreground/45" />
          <input
            ref={searchInputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("chat.kaomoji.search")}
            aria-label={t("chat.kaomoji.search")}
            className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-foreground/35"
          />
        </div>
      </div>

      {!search.trim() && (
        <div
          data-kaomoji-categories
          className="flex shrink-0 flex-wrap gap-1 overflow-x-hidden border-b border-[var(--border)] px-1.5 py-1.5"
        >
          {KAOMOJI_CATEGORIES.map((category, index) => (
            <button
              key={category.id}
              type="button"
              onClick={() => setActiveCategory(index)}
              aria-pressed={index === activeCategory}
              className={cn(
                "whitespace-nowrap rounded-md px-2 py-1 text-[0.6875rem] font-medium transition-colors",
                index === activeCategory
                  ? "bg-[var(--marinara-chat-chrome-highlight-bg)] text-[var(--marinara-chat-chrome-button-text-active)] ring-1 ring-[var(--marinara-chat-chrome-button-border-active)]"
                  : "text-[var(--muted-foreground)] hover:bg-[var(--secondary)]/50 hover:text-[var(--foreground)]",
              )}
            >
              {t(`chat.kaomoji.category.${category.id}`, category.label)}
            </button>
          ))}
        </div>
      )}

      <div data-kaomoji-results className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto p-1.5">
        {!search.trim() && recentKaomoji.length > 0 && (
          <section data-recent-media="kaomoji" className="mb-1.5 border-b border-[var(--border)] pb-1.5">
            <p className="mb-1 px-1 text-[0.625rem] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
              {t("ui.mediaPicker.recentlyUsed")}
            </p>
            <div className="grid min-w-0 grid-cols-2 gap-1">
              {recentKaomoji.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => handleSelect(item.value)}
                  title={item.label ?? item.value}
                  className="min-w-0 truncate rounded-lg px-2 py-2 text-center text-sm text-[var(--foreground)] transition-colors hover:bg-[var(--secondary)]/60 active:scale-95"
                >
                  {item.value}
                </button>
              ))}
            </div>
          </section>
        )}
        {results.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-[var(--muted-foreground)]">{t("chat.kaomoji.empty")}</p>
        ) : (
          <div className="grid min-w-0 grid-cols-2 gap-1">
            {results.map((entry) => (
              <button
                key={entry.value}
                type="button"
                onClick={() => handleSelect(entry.value)}
                title={entry.keywords}
                className="min-w-0 truncate rounded-lg px-2 py-2 text-center text-sm text-[var(--foreground)] transition-colors hover:bg-[var(--secondary)]/60 active:scale-95"
              >
                {entry.value}
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );

  if (embedded) {
    return (
      <div
        ref={panelRef}
        role="dialog"
        aria-label={t("chat.kaomoji.title")}
        className="flex h-full flex-col overflow-hidden"
      >
        {body}
      </div>
    );
  }

  return createPortal(
    <>
      <div data-kaomoji-picker-backdrop aria-hidden="true" className="fixed inset-0 z-[59]" onPointerDown={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-label={t("chat.kaomoji.title")}
        className="fixed z-[60] flex w-80 max-w-[calc(100vw-1rem)] flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-2xl"
        style={{ top: pos.top, left: pos.left, right: pos.right, maxHeight: pos.maxHeight, width: PICKER_WIDTH }}
      >
        {body}
      </div>
    </>,
    document.body,
  );
}
