// ──────────────────────────────────────────────
// ContextMenu — small portal-rendered right-click menu
// ──────────────────────────────────────────────
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "../../lib/utils";

export interface ContextMenuItem {
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  disabled?: boolean;
  destructive?: boolean;
}

interface ContextMenuProps {
  /** Page-relative coordinates (e.clientX / e.clientY) where the menu should anchor. */
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

/** Right-click menu anchored at (x, y). Auto-flips when it would clip the viewport. */
export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
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

  // Close on outside click, Escape, scroll, or window resize.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const raf = requestAnimationFrame(() => {
      document.addEventListener("mousedown", onDown);
      document.addEventListener("keydown", onKey);
      window.addEventListener("scroll", onClose, true);
      window.addEventListener("resize", onClose);
    });
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onClose, true);
      window.removeEventListener("resize", onClose);
    };
  }, [onClose]);

  return createPortal(
    <div
      ref={ref}
      role="menu"
      style={{ position: "fixed", left: pos.left, top: pos.top, zIndex: 9999 }}
      className="min-w-[12rem] rounded-lg border border-[var(--border)] bg-[var(--card)] py-1 shadow-xl animate-fade-in-up"
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((item, i) => (
        <button
          key={`${item.label}-${i}`}
          type="button"
          role="menuitem"
          disabled={item.disabled}
          onClick={() => {
            if (item.disabled) return;
            item.onSelect();
            onClose();
          }}
          className={cn(
            "flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors",
            item.disabled
              ? "cursor-not-allowed text-[var(--muted-foreground)] opacity-50"
              : item.destructive
                ? "text-[var(--destructive)] hover:bg-[var(--destructive)]/10"
                : "text-[var(--foreground)] hover:bg-[var(--accent)]",
          )}
        >
          {item.icon && <span className="shrink-0 text-[var(--muted-foreground)]">{item.icon}</span>}
          <span className="flex-1 truncate">{item.label}</span>
        </button>
      ))}
    </div>,
    document.body,
  );
}
