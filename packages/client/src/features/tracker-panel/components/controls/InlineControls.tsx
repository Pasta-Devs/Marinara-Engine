import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { Pencil, Plus } from "lucide-react";
import { cn } from "../../../../lib/utils";
import { TRACKER_TEXT_MICRO } from "../../lib/tracker-panel.constants";
import { getNumberValueWidth } from "../../lib/tracker-display";

export function FittedText({
  children,
  className,
  title,
  minScale = 0.62,
  align = "left",
}: {
  children: string;
  className?: string;
  title?: string;
  minScale?: number;
  align?: "left" | "center" | "right";
}) {
  const containerRef = useRef<HTMLSpanElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const measure = measureRef.current;
    if (!container || !measure) return;

    const updateScale = () => {
      const availableWidth = container.clientWidth;
      const naturalWidth = measure.scrollWidth;
      if (availableWidth <= 0 || naturalWidth <= 0) return;

      const nextScale = Math.min(1, Math.max(minScale, (availableWidth - 1) / naturalWidth));
      setScale((previous) => (Math.abs(previous - nextScale) < 0.01 ? previous : nextScale));
    };

    updateScale();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateScale);
      return () => window.removeEventListener("resize", updateScale);
    }

    const resizeObserver = new ResizeObserver(updateScale);
    resizeObserver.observe(container);
    resizeObserver.observe(measure);
    return () => resizeObserver.disconnect();
  }, [children, minScale]);

  return (
    <span
      ref={containerRef}
      title={title ?? children}
      className={cn(
        "relative flex min-w-0 max-w-full overflow-hidden whitespace-nowrap",
        align === "center" && "justify-center text-center",
        align === "right" && "justify-end text-right",
        align === "left" && "justify-start text-left",
        className,
      )}
    >
      <span
        ref={measureRef}
        aria-hidden="true"
        className="pointer-events-none invisible absolute left-0 top-0 block w-max max-w-none whitespace-nowrap"
      >
        {children}
      </span>
      <span
        className="block min-w-0 max-w-full overflow-hidden whitespace-nowrap"
        style={scale < 0.999 ? { fontSize: `calc(1em * ${scale.toFixed(3)})` } : undefined}
      >
        {children}
      </span>
    </span>
  );
}

export function InlineEdit({
  value,
  onSave,
  placeholder = "Empty",
  className,
  style,
  title,
  fullPreview = false,
  scrollOnHover = false,
  showEditHint = true,
  twoLinePreview = false,
  threeLinePreview = false,
  previewLineCount,
  previewClassName,
  previewStyle,
  fitPreview = false,
  fitMinScale = 0.62,
  fitAlign = "left",
  locked = false,
  lockMode = false,
  onToggleLock,
}: {
  value: string | number | null | undefined;
  onSave: (value: string) => void;
  placeholder?: string;
  className?: string;
  style?: CSSProperties;
  title?: string;
  fullPreview?: boolean;
  scrollOnHover?: boolean;
  showEditHint?: boolean;
  twoLinePreview?: boolean;
  threeLinePreview?: boolean;
  previewLineCount?: 2 | 3 | 4 | "full";
  previewClassName?: string;
  previewStyle?: CSSProperties;
  fitPreview?: boolean;
  fitMinScale?: number;
  fitAlign?: "left" | "center" | "right";
  locked?: boolean;
  lockMode?: boolean;
  onToggleLock?: () => void;
}) {
  const currentValue = value === null || value === undefined ? "" : String(value);
  const previewText = currentValue || placeholder;
  const multilinePreviewLineCount = previewLineCount ?? (threeLinePreview ? 3 : twoLinePreview ? 2 : undefined);
  const useFittedPreview = fitPreview && !fullPreview && !multilinePreviewLineCount;
  const useHoverScroll = scrollOnHover && !useFittedPreview;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(currentValue);
  const [scrollActive, setScrollActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollFieldRef = useRef<HTMLSpanElement>(null);
  const scrollMeasureRef = useRef<HTMLSpanElement>(null);
  const committedRef = useRef(false);
  const lockToggleActive = lockMode && !!onToggleLock;

  useEffect(() => {
    if (!editing) setDraft(currentValue);
  }, [currentValue, editing]);

  useEffect(() => {
    if (!editing) return;
    committedRef.current = false;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [editing]);

  useEffect(() => {
    setScrollActive((previous) => (previous ? false : previous));
  }, [currentValue, useHoverScroll]);

  const measureScrollOverflow = () => {
    if (!useHoverScroll || !currentValue) return;
    const field = scrollFieldRef.current;
    const measure = scrollMeasureRef.current;
    if (!field || !measure) return;

    const nextScrollActive = measure.scrollWidth > field.clientWidth + 1;
    setScrollActive((previous) => (previous === nextScrollActive ? previous : nextScrollActive));
  };
  const resetScrollOverflow = () => {
    setScrollActive((previous) => (previous ? false : previous));
  };

  const commit = () => {
    if (committedRef.current) return;
    committedRef.current = true;
    const trimmed = draft.trim();
    if (trimmed !== currentValue) onSave(trimmed);
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") commit();
          if (event.key === "Escape") {
            setDraft(currentValue);
            setEditing(false);
          }
        }}
        onBlur={commit}
        className={cn(
          "min-w-0 rounded-sm border border-[var(--tracker-inline-rule,var(--border))] bg-[var(--background)]/50 px-1 py-0.5 text-xs text-[color:var(--tracker-inline-foreground,var(--foreground))] outline-none transition-colors focus:border-[var(--foreground)]/30",
          className,
        )}
        style={style}
        placeholder={placeholder}
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
      onMouseEnter={measureScrollOverflow}
      onFocus={measureScrollOverflow}
      onMouseLeave={resetScrollOverflow}
      onBlur={resetScrollOverflow}
      title={lockToggleActive ? (locked ? "Unlock field" : "Lock field") : (title ?? currentValue)}
      aria-label={
        lockToggleActive ? `${locked ? "Unlock" : "Lock"} ${(title ?? currentValue) || placeholder}` : undefined
      }
      aria-pressed={lockToggleActive ? locked : undefined}
      className={cn(
        "group group/inline relative flex min-w-0 rounded px-0.5 text-left transition-colors hover:bg-[var(--accent)]/55",
        multilinePreviewLineCount ? "items-start overflow-hidden" : "items-center",
        locked &&
          "bg-[color-mix(in_srgb,var(--foreground)_8%,transparent)] text-[var(--foreground)] ring-1 ring-[color-mix(in_srgb,var(--foreground)_30%,transparent)]",
        lockToggleActive && "cursor-pointer [@media(pointer:coarse)]:min-h-[1.75rem]",
        className,
      )}
      style={style}
    >
      {useHoverScroll && currentValue ? (
        <span
          ref={scrollMeasureRef}
          aria-hidden="true"
          className="pointer-events-none absolute left-0 top-0 block h-0 w-max max-w-none overflow-hidden whitespace-nowrap opacity-0"
        >
          {currentValue}
        </span>
      ) : null}
      {useFittedPreview ? (
        <FittedText
          minScale={fitMinScale}
          align={fitAlign}
          className={cn(
            "flex-1",
            currentValue
              ? "text-[color:var(--tracker-inline-foreground,var(--foreground))]"
              : "italic text-[color:var(--tracker-inline-muted,var(--muted-foreground))]",
          )}
        >
          {previewText}
        </FittedText>
      ) : (
        <span
          ref={useHoverScroll ? scrollFieldRef : undefined}
          className={cn(
            "min-w-0",
            useHoverScroll
              ? cn("block overflow-hidden whitespace-nowrap", scrollActive ? "roleplay-hud-scroll-field" : "truncate")
              : multilinePreviewLineCount === "full"
                ? "flex-1 whitespace-normal break-words leading-[1.12]"
                : multilinePreviewLineCount === 4
                  ? "line-clamp-4 flex-1 whitespace-normal break-words leading-[1.12]"
                  : multilinePreviewLineCount === 3
                    ? "line-clamp-3 flex-1 whitespace-normal break-words leading-[1.14]"
                    : multilinePreviewLineCount === 2
                      ? "line-clamp-2 flex-1 whitespace-normal break-words leading-[1.15]"
                      : fullPreview
                        ? "whitespace-nowrap leading-tight"
                        : "truncate",
            currentValue
              ? "text-[color:var(--tracker-inline-foreground,var(--foreground))]"
              : "italic text-[color:var(--tracker-inline-muted,var(--muted-foreground))]",
            previewClassName,
          )}
          style={previewStyle}
        >
          {useHoverScroll && currentValue && scrollActive ? (
            <span className="roleplay-hud-scroll-track">
              <span className="pr-6">{currentValue}</span>
              <span className="pr-6" aria-hidden>
                {currentValue}
              </span>
            </span>
          ) : (
            previewText
          )}
        </span>
      )}
      {!(lockMode || locked) && (
        <Pencil
          className={cn(
            "pointer-events-none absolute right-0.5 top-1/2 h-2.5 w-2.5 -translate-y-1/2 shrink-0 text-[color:var(--tracker-inline-muted,var(--muted-foreground))] opacity-0 transition-opacity group-hover/inline:opacity-60",
            (!showEditHint || fullPreview) && "hidden",
          )}
        />
      )}
    </button>
  );
}

export function InlineNumber({
  value,
  onChange,
  className,
  min,
  title,
  locked = false,
  lockMode = false,
  onToggleLock,
}: {
  value: number;
  onChange: (value: number) => void;
  className?: string;
  min?: number;
  title?: string;
  locked?: boolean;
  lockMode?: boolean;
  onToggleLock?: () => void;
}) {
  const width = getNumberValueWidth(value);

  if (lockMode && onToggleLock) {
    return (
      <button
        type="button"
        onClick={onToggleLock}
        title={locked ? "Unlock field" : "Lock field"}
        aria-label={`${locked ? "Unlock" : "Lock"} ${title?.toLowerCase() ?? "field"}`}
        aria-pressed={locked}
        style={{ width }}
        className={cn(
          "inline-flex min-w-0 items-center justify-end rounded bg-transparent px-0 py-0.5 text-right text-[0.625rem] tabular-nums text-[color:var(--tracker-inline-number,var(--tracker-inline-foreground,var(--foreground)))] outline-none ring-1 transition-colors hover:bg-[var(--accent)]/45 focus:ring-[var(--border)]",
          locked
            ? "bg-[color-mix(in_srgb,var(--foreground)_8%,transparent)] ring-1 ring-[color-mix(in_srgb,var(--foreground)_30%,transparent)]"
            : "opacity-90 ring-transparent hover:ring-[var(--border)]/60",
          className,
          "[@media(pointer:coarse)]:min-h-[1.75rem]",
        )}
      >
        <span>{Number.isFinite(value) ? value : 0}</span>
      </button>
    );
  }

  return (
    <input
      type="number"
      value={Number.isFinite(value) ? value : 0}
      onChange={(event) => {
        const numeric = Number(event.target.value);
        const next = Number.isFinite(numeric) ? numeric : 0;
        onChange(min === undefined ? next : Math.max(min, next));
      }}
      title={title}
      style={{ width }}
      className={cn(
        "rounded bg-transparent px-1 py-0.5 text-right text-[0.625rem] tabular-nums text-[color:var(--tracker-inline-number,var(--tracker-inline-foreground,var(--foreground)))] outline-none transition-colors hover:bg-[var(--accent)]/45 focus:bg-[var(--background)] focus:ring-1 focus:ring-[var(--border)] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
        locked &&
          "bg-[color-mix(in_srgb,var(--foreground)_8%,transparent)] ring-1 ring-[color-mix(in_srgb,var(--foreground)_30%,transparent)]",
        className,
      )}
    />
  );
}

export function InlineAddRow({
  onClick,
  title,
  label,
  className,
}: {
  onClick: () => void;
  title: string;
  label?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className={cn(
        "flex min-h-5 w-full items-center gap-1 border-t border-[var(--border)]/30 px-1 py-0.5 text-left font-semibold text-[var(--foreground)]/42 transition-colors hover:bg-[var(--foreground)]/8 hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-[var(--border)]",
        TRACKER_TEXT_MICRO,
        className,
      )}
    >
      <Plus size="0.625rem" className="shrink-0" />
      <span className="truncate">{label ?? title}</span>
    </button>
  );
}
