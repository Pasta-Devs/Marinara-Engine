// ──────────────────────────────────────────────
// ContextMenu — small portal-rendered right-click menu
// ──────────────────────────────────────────────
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Check } from "lucide-react";
import { cn } from "../../lib/utils";

export interface ContextMenuItem {
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  disabled?: boolean;
  destructive?: boolean;
  /** Muted second line, such as the Connection a Model belongs to. */
  hint?: string;
  /** Marks the current choice when the menu picks one value. */
  checked?: boolean;
  /** An on/off setting: `checked` is its state, not the menu's one choice. */
  toggle?: boolean;
}

interface ContextMenuProps {
  /** Page-relative coordinates (e.clientX / e.clientY) where the menu should anchor. */
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
  /** Visual treatment for destructive items. Defaults to the semantic destructive color. */
  destructiveTone?: "destructive" | "accent";
  /** Opened from the keyboard: focus the first item, and return focus when the menu closes. */
  autoFocus?: boolean;
}

/** Right-click menu anchored at (x, y). Auto-flips when it would clip the viewport. */
export function ContextMenu({
  x,
  y,
  items,
  onClose,
  destructiveTone = "destructive",
  autoFocus = false,
}: ContextMenuProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState({ left: x, top: y });

  // Flip / clamp the menu so it always stays inside the viewport.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    let left = x;
    let top = y;
    if (left + rect.width > window.innerWidth - 4) left = window.innerWidth - rect.width - 4;
    if (top + rect.height > window.innerHeight - 4) top = window.innerHeight - rect.height - 4;
    if (left < 4) left = 4;
    if (top < 4) top = 4;
    setPos({ left, top });
  }, [x, y]);

  // Keyboard users land inside the menu, and return to where they were when it closes.
  useEffect(() => {
    if (!autoFocus) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    ref.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus({ preventScroll: true });
    return () => previous?.focus({ preventScroll: true });
  }, [autoFocus]);

  // Close on outside click, Escape, scroll, or window resize.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    // Escape is the menu's alone: captured before React's own listeners, so the panel or dialog under the
    // menu does not close with it.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      onClose();
    };
    // A long menu scrolls itself; only scrolling the page behind it closes it.
    const onScroll = (e: Event) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    window.addEventListener("keydown", onKey, true);
    const raf = requestAnimationFrame(() => {
      document.addEventListener("mousedown", onDown);
      window.addEventListener("scroll", onScroll, true);
      window.addEventListener("resize", onClose);
    });
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onClose);
    };
  }, [onClose]);

  return createPortal(
    <div
      ref={ref}
      role="menu"
      // Above a modal (z 10000), so a menu opened inside a dialog shows.
      style={{ position: "fixed", left: pos.left, top: pos.top, zIndex: 10001 }}
      className="max-h-[calc(100dvh-0.5rem)] min-w-[12rem] max-w-[min(20rem,calc(100vw-0.5rem))] overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--card)] py-1 shadow-xl animate-fade-in-up"
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((item, i) => (
        <button
          key={`${item.label}-${i}`}
          type="button"
          role={item.toggle ? "menuitemcheckbox" : item.checked === undefined ? "menuitem" : "menuitemradio"}
          aria-checked={item.checked}
          disabled={item.disabled}
          onClick={() => {
            if (item.disabled) return;
            item.onSelect();
            onClose();
          }}
          className={cn(
            "flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors outline-none focus-visible:bg-[var(--accent)]",
            item.disabled
              ? "cursor-not-allowed text-[var(--muted-foreground)] opacity-50"
              : item.destructive
                ? destructiveTone === "accent"
                  ? "text-[var(--primary)] hover:bg-[var(--primary)]/10"
                  : "text-[var(--destructive)] hover:bg-[var(--destructive)]/10"
                : "text-[var(--foreground)] hover:bg-[var(--accent)]",
          )}
        >
          {item.icon && <span className="shrink-0 text-[var(--muted-foreground)]">{item.icon}</span>}
          <span className="min-w-0 flex-1">
            <span className="block truncate">{item.label}</span>
            {item.hint && (
              <span className="block truncate text-[0.625rem] text-[var(--muted-foreground)]">{item.hint}</span>
            )}
          </span>
          {item.checked && <Check size="0.75rem" className="shrink-0 text-[var(--primary)]" />}
        </button>
      ))}
    </div>,
    document.body,
  );
}
