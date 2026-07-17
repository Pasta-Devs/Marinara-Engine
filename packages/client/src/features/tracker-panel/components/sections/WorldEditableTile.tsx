import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Lock, Pencil, Unlock } from "lucide-react";
import { cn } from "../../../../lib/utils";
import { visibleText } from "../../lib/tracker-display";

export const WORLD_INSTRUMENT_TEXT_STYLE =
  "font-[family-name:'Share_Tech_Mono',monospace] font-normal uppercase tabular-nums tracking-[0.035em]";

export function WorldRenderedEdit({
  label,
  value,
  onSave,
  placeholder,
  className,
  inputClassName,
  showEditHint = true,
  locked = false,
  lockMode = false,
  onToggleLock,
  children,
}: {
  label: string;
  value: string | null | undefined;
  onSave: (value: string) => void;
  placeholder: string;
  className?: string;
  inputClassName?: string;
  showEditHint?: boolean;
  locked?: boolean;
  lockMode?: boolean;
  onToggleLock?: () => void;
  children: ReactNode;
}) {
  const currentValue = value === null || value === undefined ? "" : String(value);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(currentValue);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const committedRef = useRef(false);
  const cancelledRef = useRef(false);
  const title = `${label}: ${visibleText(value)}`;
  const lockToggleActive = lockMode && !!onToggleLock;

  useEffect(() => {
    if (!editing) setDraft(currentValue);
  }, [currentValue, editing]);

  useEffect(() => {
    if (!editing) return;
    committedRef.current = false;
    cancelledRef.current = false;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [editing]);

  useLayoutEffect(() => {
    if (!editing || !inputRef.current) return;
    inputRef.current.style.height = "auto";
    inputRef.current.style.height = `${inputRef.current.scrollHeight}px`;
  }, [draft, editing]);

  const commit = () => {
    if (committedRef.current || cancelledRef.current) return;
    committedRef.current = true;
    const trimmed = draft.trim();
    if (trimmed !== currentValue) onSave(trimmed);
    setEditing(false);
  };

  if (editing) {
    return (
      <textarea
        ref={inputRef}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault();
            commit();
          } else if (event.key === "Escape") {
            event.preventDefault();
            cancelledRef.current = true;
            setDraft(currentValue);
            setEditing(false);
          }
        }}
        onBlur={commit}
        className={cn(
          "h-auto max-h-24 min-h-full w-full min-w-0 resize-none overflow-y-auto rounded-sm border border-[var(--foreground)]/25 bg-[var(--background)]/68 px-1 py-1 text-[0.6875rem] font-semibold leading-4 text-[var(--foreground)] outline-none focus:ring-1 focus:ring-[var(--border)]",
          className,
          inputClassName,
        )}
        placeholder={placeholder}
        aria-label={label}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        if (lockToggleActive) {
          onToggleLock?.();
          return;
        }
        setEditing(true);
      }}
      title={lockToggleActive ? (locked ? `Unlock ${label.toLowerCase()}` : `Lock ${label.toLowerCase()}`) : title}
      aria-label={
        lockToggleActive ? `${locked ? "Unlock" : "Lock"} ${label.toLowerCase()}` : `${title}. Click to edit.`
      }
      aria-pressed={lockToggleActive ? locked : undefined}
      className={cn(
        "group/world-edit relative h-full w-full min-w-0 text-left transition-colors hover:bg-[var(--accent)]/20 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-[var(--border)]",
        locked &&
          "bg-[color-mix(in_srgb,var(--foreground)_8%,transparent)] ring-1 ring-inset ring-[color-mix(in_srgb,var(--foreground)_30%,transparent)]",
        className,
      )}
    >
      {children}
      {(lockMode || locked) && (
        <span
          className={cn(
            "pointer-events-none absolute right-0.5 top-0.5 z-[12] flex h-3.5 w-3.5 items-center justify-center rounded-[2px] bg-[var(--background)]/58 shadow-[0_0_6px_color-mix(in_srgb,var(--foreground)_10%,transparent)] ring-1 ring-[var(--border)] transition-opacity duration-150 [@media(pointer:coarse)]:h-4 [@media(pointer:coarse)]:w-4",
            locked ? "text-[var(--foreground)] opacity-90" : "text-[var(--muted-foreground)] opacity-50",
          )}
          aria-hidden="true"
        >
          {locked ? (
            <Lock className="h-2.5 w-2.5 [@media(pointer:coarse)]:h-3 [@media(pointer:coarse)]:w-3" />
          ) : (
            <Unlock className="h-2.5 w-2.5 [@media(pointer:coarse)]:h-3 [@media(pointer:coarse)]:w-3" />
          )}
        </span>
      )}
      {showEditHint && !lockMode && !locked && (
        <span
          className={cn(
            "pointer-events-none absolute right-0.5 top-0.5 z-[12] flex h-3 w-3 translate-y-0.5 items-center justify-center rounded-[2px] bg-[var(--background)]/58 text-[var(--muted-foreground)] opacity-0 shadow-[0_0_6px_color-mix(in_srgb,var(--foreground)_10%,transparent)] ring-1 ring-[var(--border)] transition-[opacity,transform] duration-150 group-hover/world-edit:translate-y-0 group-hover/world-edit:opacity-70 group-focus-visible/world-edit:translate-y-0 group-focus-visible/world-edit:opacity-80 max-md:translate-y-0 max-md:opacity-45",
          )}
          aria-hidden="true"
        >
          <Pencil size="0.5rem" />
        </span>
      )}
    </button>
  );
}

/** Raw world text that shrinks to its field's line budget before clamping exceptional values. */
export function WorldValueText({
  value,
  maxLines,
  className,
  minScale = 0.62,
}: {
  value: string | null | undefined;
  maxLines: 1 | 2 | 3;
  className?: string;
  minScale?: number;
}) {
  const text = value === null || value === undefined ? "" : String(value);
  const displayText = text || "Not recorded";
  const containerRef = useRef<HTMLSpanElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const [fit, setFit] = useState({ scale: 1, fontSize: 0, lineHeight: 0 });

  useLayoutEffect(() => {
    const container = containerRef.current;
    const measure = measureRef.current;
    if (!container || !measure) return;

    const updateScale = () => {
      measure.style.fontSize = "";
      measure.style.lineHeight = "";
      const computed = window.getComputedStyle(measure);
      const baseFontSize = Number.parseFloat(computed.fontSize);
      const baseLineHeight = Number.parseFloat(computed.lineHeight);
      if (!container.clientWidth || !baseFontSize || !baseLineHeight) return;

      const fits = (candidate: number) => {
        measure.style.fontSize = `${baseFontSize * candidate}px`;
        measure.style.lineHeight = `${baseLineHeight * candidate}px`;
        return measure.scrollHeight <= baseLineHeight * candidate * maxLines + 1;
      };

      let nextScale = 1;
      if (!fits(1)) {
        let lower = minScale;
        let upper = 1;
        for (let step = 0; step < 7; step += 1) {
          const candidate = (lower + upper) / 2;
          if (fits(candidate)) lower = candidate;
          else upper = candidate;
        }
        nextScale = fits(lower) ? lower : minScale;
      }

      setFit((previous) =>
        Math.abs(previous.scale - nextScale) < 0.01 &&
        Math.abs(previous.fontSize - baseFontSize * nextScale) < 0.1 &&
        Math.abs(previous.lineHeight - baseLineHeight * nextScale) < 0.1
          ? previous
          : {
              scale: nextScale,
              fontSize: baseFontSize * nextScale,
              lineHeight: baseLineHeight * nextScale,
            },
      );
    };

    updateScale();
    const resizeObserver =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => updateScale());
    resizeObserver?.observe(container);
    void document.fonts?.ready.then(updateScale);
    if (!resizeObserver) window.addEventListener("resize", updateScale);
    return () => {
      resizeObserver?.disconnect();
      if (!resizeObserver) window.removeEventListener("resize", updateScale);
    };
  }, [displayText, maxLines, minScale]);

  const fittedStyle: CSSProperties = {
    display: "-webkit-box",
    WebkitBoxOrient: "vertical",
    WebkitLineClamp: maxLines,
    fontSize: fit.scale < 0.999 ? `${fit.fontSize}px` : undefined,
    lineHeight: fit.scale < 0.999 ? `${fit.lineHeight}px` : undefined,
  };

  return (
    <span
      ref={containerRef}
      className={cn("relative block min-w-0 overflow-hidden whitespace-pre-wrap break-words [overflow-wrap:anywhere] leading-5", className)}
      dir="auto"
    >
      <span
        ref={measureRef}
        aria-hidden="true"
        className="pointer-events-none invisible absolute inset-x-0 top-0 block whitespace-pre-wrap break-words [overflow-wrap:anywhere]"
      >
        {displayText}
      </span>
      <span className="overflow-hidden" style={fittedStyle}>
        {displayText}
      </span>
    </span>
  );
}
