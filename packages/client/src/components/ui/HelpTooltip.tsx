// ──────────────────────────────────────────────
// Reusable help tooltip — hover ? icon to see explanation
// ──────────────────────────────────────────────
import { useState, useRef, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { HelpCircle } from "lucide-react";
import { cn } from "../../lib/utils";

interface HelpTooltipProps {
  /** The help text to display */
  text: string;
  /** Optional size of the icon (default "0.75rem") */
  size?: string | number;
  /** Preferred position */
  side?: "top" | "bottom" | "left" | "right";
  /** Extra class on the icon wrapper */
  className?: string;
}

export function HelpTooltip({ text, size = "0.75rem", side = "top", className }: HelpTooltipProps) {
  const [show, setShow] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; ready: boolean }>({ top: 0, left: 0, ready: false });

  // Compute position before paint so the tooltip never flickers
  useLayoutEffect(() => {
    if (!show || !wrapRef.current || !tipRef.current) {
      setPos({ top: 0, left: 0, ready: false });
      return;
    }
    const rect = wrapRef.current.getBoundingClientRect();
    const tip = tipRef.current.getBoundingClientRect();
    const pad = 8;
    let top = 0;
    let left = 0;

    if (side === "top") {
      top = rect.top - 6 - tip.height;
      left = rect.left + rect.width / 2 - tip.width / 2;
    } else if (side === "bottom") {
      top = rect.bottom + 6;
      left = rect.left + rect.width / 2 - tip.width / 2;
    } else if (side === "left") {
      top = rect.top + rect.height / 2 - tip.height / 2;
      left = rect.left - 6 - tip.width;
    } else {
      top = rect.top + rect.height / 2 - tip.height / 2;
      left = rect.right + 6;
    }

    // Clamp to viewport
    left = Math.max(pad, Math.min(left, window.innerWidth - pad - tip.width));
    top = Math.max(pad, Math.min(top, window.innerHeight - pad - tip.height));

    setPos({ top, left, ready: true });
  }, [show, side]);

  return (
    <span
      ref={wrapRef}
      className={cn("relative inline-flex cursor-help", className)}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <HelpCircle
        size={size}
        className="text-[var(--muted-foreground)] opacity-50 transition-opacity hover:opacity-100"
      />
      {show &&
        createPortal(
          <div
            ref={tipRef}
            className="pointer-events-none fixed z-[9999] w-56 rounded-lg bg-[var(--popover)] px-3 py-2 text-[0.6875rem] leading-relaxed text-[var(--popover-foreground)] shadow-xl ring-1 ring-[var(--border)]"
            style={{ top: pos.top, left: pos.left, visibility: pos.ready ? "visible" : "hidden" }}
          >
            {text}
          </div>,
          document.body,
        )}
    </span>
  );
}

/** Helper: label text followed by a help tooltip icon */
export function LabelWithHelp({ label, help, className }: { label: string; help: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      {label}
      <HelpTooltip text={help} />
    </span>
  );
}
