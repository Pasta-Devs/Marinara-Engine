import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { Pencil } from "lucide-react";
import { cn } from "../../../../shared/lib/utils";

type InlinePreviewPosition = {
  top: number;
  left: number;
  maxWidth: number;
  maxHeight: number;
};

function InlinePreviewPortal({
  open,
  value,
  anchorRef,
}: {
  open: boolean;
  value: string;
  anchorRef: RefObject<HTMLElement | null>;
}) {
  const previewRef = useRef<HTMLSpanElement>(null);
  const [position, setPosition] = useState<InlinePreviewPosition | null>(null);

  const updatePosition = useCallback(() => {
    if (!open || !value) {
      setPosition(null);
      return;
    }

    const anchor = anchorRef.current;
    if (!anchor || typeof window === "undefined") return;

    const rect = anchor.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      setPosition((current) => (current === null ? current : null));
      return;
    }

    const margin = 8;
    const gap = 4;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const maxWidth = Math.min(224, Math.max(120, viewportWidth - margin * 2));
    const measuredWidth = Math.min(maxWidth, Math.max(1, previewRef.current?.offsetWidth ?? 192));
    const naturalHeight = Math.max(40, previewRef.current?.scrollHeight ?? previewRef.current?.offsetHeight ?? 72);
    const availableAbove = Math.max(0, rect.top - margin - gap);
    const availableBelow = Math.max(0, viewportHeight - rect.bottom - margin - gap);
    const placeBelow = naturalHeight > availableAbove && availableBelow > availableAbove;
    const laneHeight = placeBelow ? availableBelow : availableAbove;
    const maxHeight = Math.max(40, Math.min(naturalHeight, laneHeight || viewportHeight - margin * 2));
    const visibleHeight = Math.min(naturalHeight, maxHeight);
    const rawLeft = rect.left + rect.width / 2 - measuredWidth / 2;
    const left = Math.round(Math.max(margin, Math.min(viewportWidth - measuredWidth - margin, rawLeft)));
    const top = Math.round(placeBelow ? rect.bottom + gap : Math.max(margin, rect.top - visibleHeight - gap));

    setPosition((current) =>
      current?.top === top && current.left === left && current.maxWidth === maxWidth && current.maxHeight === maxHeight
        ? current
        : { top, left, maxWidth, maxHeight },
    );
  }, [anchorRef, open, value]);

  useLayoutEffect(() => {
    if (!open || !value) {
      setPosition(null);
      return;
    }
    updatePosition();
  }, [open, updatePosition, value]);

  useEffect(() => {
    if (!open || !value || typeof window === "undefined") return;

    const update = () => updatePosition();
    const anchor = anchorRef.current;
    const resizeObserver = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);

    if (anchor) resizeObserver?.observe(anchor);
    if (previewRef.current) resizeObserver?.observe(previewRef.current);
    window.addEventListener("resize", update);
    const scrollOptions: AddEventListenerOptions = { capture: true, passive: true };
    window.addEventListener("scroll", update, scrollOptions);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, scrollOptions);
    };
  }, [anchorRef, open, updatePosition, value]);

  if (!open || !value || typeof document === "undefined") return null;

  return createPortal(
    <span
      ref={previewRef}
      data-roleplay-inline-preview
      className="pointer-events-none fixed z-[10000] animate-message-in whitespace-normal break-words rounded border border-[var(--border)] bg-[var(--popover)] px-1.5 py-1 text-[0.5625rem] text-[var(--foreground)]/80 shadow-xl"
      style={{
        top: position?.top ?? -9999,
        left: position?.left ?? -9999,
        maxWidth: position?.maxWidth ?? 224,
        maxHeight: position?.maxHeight,
        overflow: position ? "hidden" : undefined,
      }}
    >
      {value}
    </span>,
    document.body,
  );
}

export function InlineEdit({
  value,
  onSave,
  placeholder,
  className,
  scrollOnHover = false,
}: {
  value: string;
  onSave: (value: string) => void;
  placeholder?: string;
  className?: string;
  scrollOnHover?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const lastTapRef = useRef(0);
  const isTouchRef = useRef(false);
  const [showTip, setShowTip] = useState(false);
  const tipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (editing) ref.current?.focus();
  }, [editing]);

  useEffect(() => {
    return () => {
      if (tipTimerRef.current) clearTimeout(tipTimerRef.current);
    };
  }, []);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed !== value) onSave(trimmed);
    setEditing(false);
  };

  const handleTouchStart = () => {
    isTouchRef.current = true;
  };

  const handleClick = () => {
    if (!isTouchRef.current) {
      setDraft(value);
      setEditing(true);
      return;
    }

    isTouchRef.current = false;
    const now = Date.now();
    if (now - lastTapRef.current < 350) {
      setShowTip(false);
      if (tipTimerRef.current) clearTimeout(tipTimerRef.current);
      setDraft(value);
      setEditing(true);
    } else {
      setShowTip(true);
      if (tipTimerRef.current) clearTimeout(tipTimerRef.current);
      tipTimerRef.current = setTimeout(() => setShowTip(false), 2500);
    }
    lastTapRef.current = now;
  };

  if (editing) {
    return (
      <input
        ref={ref}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") commit();
          if (event.key === "Escape") setEditing(false);
        }}
        onBlur={commit}
        className={cn(
          "bg-[var(--muted)]/20 rounded px-1.5 py-0.5 text-[0.625rem] text-[var(--foreground)] outline-none border border-[var(--border)] focus:border-purple-400/40",
          className,
        )}
        placeholder={placeholder}
      />
    );
  }

  return (
    <button
      ref={buttonRef}
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      title={value || undefined}
      aria-label={value || placeholder}
      className={cn(
        "group relative flex items-center gap-1 text-left hover:bg-[var(--muted)]/20 rounded px-0.5 transition-colors min-w-0",
        className,
      )}
    >
      <span
        className={cn(
          "text-[0.625rem] text-[var(--foreground)]/70 overflow-hidden whitespace-nowrap scrollbar-hide min-w-0",
          scrollOnHover && value && "roleplay-hud-scroll-field",
        )}
      >
        {scrollOnHover && value ? (
          <span className={cn("roleplay-hud-scroll-track", showTip && "roleplay-hud-scroll-track--active")}>
            <span className="pr-6">{value}</span>
            <span className="pr-6" aria-hidden>
              {value}
            </span>
          </span>
        ) : (
          value || <span className="italic text-[var(--muted-foreground)]/50">{placeholder ?? "—"}</span>
        )}
      </span>
      <Pencil size="0.4375rem" className="opacity-0 group-hover:opacity-40 shrink-0 transition-opacity" />
      <InlinePreviewPortal open={showTip} value={value} anchorRef={buttonRef} />
    </button>
  );
}
