import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../../lib/utils";

export interface TabItem<T extends string = string> {
  id: T;
  label: ReactNode;
  /** Shown before the label; a pill tab with an icon stacks it above the label. */
  icon?: ReactNode;
  /** A number shown in the shared count badge, e.g. how many images. */
  count?: number;
  /** Other content after the label, e.g. a status dot. */
  badge?: ReactNode;
  title?: string;
  disabled?: boolean;
  /** Extra attributes for the tab button (data-tour, data-testid, …). */
  buttonProps?: ButtonHTMLAttributes<HTMLButtonElement> & Record<`data-${string}`, string | undefined>;
}

interface TabsProps<T extends string> {
  items: readonly TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  /** `pill`: segmented track for switching views or modes. `underline`: text tabs for sections inside a sheet or dialog. */
  variant?: "pill" | "underline";
  /** Accessible name of the tab list. */
  label: string;
  /** Gives tabs `id="<idPrefix>-tab-<id>"` and `aria-controls="<idPrefix>-panel-<id>"`. */
  idPrefix?: string;
  /** Pill only: cells per row; more items wrap. Defaults to one row. */
  columns?: number;
  /** Pill only: the icon sits before the label on one line, as in the Download | Open Library row, not above it. */
  inlineIcons?: boolean;
  className?: string;
  tabClassName?: string;
}

const SEGMENT_RADIUS = "calc(0.75rem - 1px)";
const SEGMENT_DIVIDER = "1px solid var(--marinara-chat-chrome-button-border)";

/**
 * A pill row, or a grid of rows, reads as one button split into cells: only the outer corners are round, a line
 * parts the cells of a row and another the rows, and the first cell of a row has none on the outer edge. The last
 * cell stretches across the empty places of a row it does not fill, so that row also ends at the track's edge. The
 * sides are logical, so a right-to-left language mirrors them with the grid (inline styles skip the build's CSS
 * lowering). Cells must touch the track: a caller that pads its tab row pads a wrapper, not the track.
 */
function segmentCorners(index: number, count: number, columns: number): CSSProperties {
  const column = index % columns;
  const firstRow = index < columns;
  const lastRow = Math.floor(index / columns) === Math.floor((count - 1) / columns);
  const rowEnd = column === columns - 1 || index === count - 1;
  const round = (outer: boolean) => (outer ? SEGMENT_RADIUS : "0");
  return {
    borderStartStartRadius: round(firstRow && column === 0),
    borderStartEndRadius: round(firstRow && rowEnd),
    borderEndEndRadius: round(lastRow && rowEnd),
    borderEndStartRadius: round(lastRow && column === 0),
  };
}

function segmentCellStyle(index: number, count: number, columns: number): CSSProperties {
  const column = index % columns;
  const emptyAfter = index === count - 1 ? columns - 1 - column : 0;
  return {
    ...segmentCorners(index, count, columns),
    borderInlineStart: column === 0 ? "1px solid transparent" : SEGMENT_DIVIDER,
    borderInlineEnd: "0",
    borderTop: index < columns ? undefined : SEGMENT_DIVIDER,
    gridColumn: emptyAfter > 0 ? `span ${emptyAfter + 1}` : undefined,
  };
}

/**
 * The shared tab bar: one `role="tablist"`; arrow keys, Home and End move and select. The highlight
 * (pill) or bar (underline) slides to the selected tab. An underline row that does not fit scrolls,
 * with a fade and an arrow on the hidden side, and keeps the selected tab in view.
 */
export function Tabs<T extends string>({
  items,
  value,
  onChange,
  variant = "pill",
  label,
  idPrefix,
  columns,
  inlineIcons,
  className,
  tabClassName,
}: TabsProps<T>) {
  const listRef = useRef<HTMLDivElement>(null);
  const pill = variant === "pill";
  const cellsPerRow = columns ?? items.length;
  const [indicator, setIndicator] = useState<CSSProperties | null>(null);
  const [overflow, setOverflow] = useState({ back: false, forward: false });

  const measure = useCallback(() => {
    const list = listRef.current;
    const tab = list?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
    if (!list || !tab) return setIndicator(null);
    setIndicator(
      pill
        ? {
            transform: `translate(${tab.offsetLeft}px, ${tab.offsetTop}px)`,
            width: tab.offsetWidth,
            height: tab.offsetHeight,
          }
        : { transform: `translateX(${tab.offsetLeft}px)`, width: tab.offsetWidth },
    );
    if (!pill) {
      const max = list.scrollWidth - list.clientWidth;
      setOverflow({ back: list.scrollLeft > 1, forward: list.scrollLeft < max - 1 });
    }
  }, [pill]);

  useLayoutEffect(() => {
    measure();
    const list = listRef.current;
    if (!list) return;
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    return () => observer.disconnect();
  }, [measure, value, items]);

  useLayoutEffect(() => {
    if (pill) return;
    listRef.current
      ?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')
      ?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [pill, value]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const enabled = items.filter((item) => !item.disabled);
    const index = enabled.findIndex((item) => item.id === value);
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    let next: TabItem<T> | undefined;
    if (step) next = enabled[(index + step + enabled.length) % enabled.length];
    else if (event.key === "Home") next = enabled[0];
    else if (event.key === "End") next = enabled[enabled.length - 1];
    if (!next) return;
    event.preventDefault();
    onChange(next.id);
    listRef.current?.querySelector<HTMLElement>(`[data-tab-id="${CSS.escape(next.id)}"]`)?.focus();
  };

  const scrollBy = (direction: 1 | -1) => {
    const list = listRef.current;
    list?.scrollBy({ left: direction * list.clientWidth * 0.7, behavior: "smooth" });
  };

  const slide = "transition-[transform,width,height,border-radius] duration-200 ease-out motion-reduce:transition-none";
  const list = (
    <div
      ref={listRef}
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      onScroll={pill ? undefined : measure}
      className={cn(
        "relative",
        pill
          ? "mari-chrome-segmented"
          : "flex min-w-0 gap-4 overflow-x-auto border-b border-[var(--border)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        pill && className,
      )}
      style={pill ? { gridTemplateColumns: `repeat(${cellsPerRow}, minmax(0, 1fr))` } : undefined}
    >
      {indicator && (
        <span
          aria-hidden="true"
          // The highlight takes its cell's corners: round only where the cell meets the outer edge.
          style={
            pill
              ? {
                  ...indicator,
                  ...segmentCorners(
                    items.findIndex((item) => item.id === value),
                    items.length,
                    cellsPerRow,
                  ),
                }
              : indicator
          }
          className={cn(
            "pointer-events-none absolute left-0 top-0",
            slide,
            pill
              ? "bg-[var(--marinara-chat-chrome-button-bg-active)] shadow-[inset_0_0_0_1px_var(--marinara-chat-chrome-focus-ring)]"
              : "top-auto bottom-0 h-0.5 rounded-full bg-[var(--primary)]",
          )}
        />
      )}
      {items.map((item, index) => {
        const active = item.id === value;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            {...item.buttonProps}
            data-tab-id={item.id}
            id={idPrefix ? `${idPrefix}-tab-${item.id}` : undefined}
            aria-controls={idPrefix && active ? `${idPrefix}-panel-${item.id}` : undefined}
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            title={item.title}
            disabled={item.disabled}
            onClick={() => onChange(item.id)}
            style={pill ? segmentCellStyle(index, items.length, cellsPerRow) : undefined}
            className={cn(
              "relative",
              pill
                ? cn(
                    "mari-chrome-segmented__button min-w-0 px-1.5 py-2 text-[0.625rem] leading-normal",
                    // The sliding highlight paints the selected cell once it is measured.
                    indicator && "!bg-transparent !shadow-none",
                    item.icon && !inlineIcons && "flex-col gap-0.5",
                  )
                : cn(
                    "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-0.5 py-2 text-xs font-semibold transition-colors",
                    active
                      ? "text-[var(--foreground)]"
                      : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
                    !indicator &&
                      active &&
                      "after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full after:bg-[var(--primary)]",
                  ),
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--card)] disabled:cursor-not-allowed disabled:opacity-50",
              tabClassName,
            )}
          >
            {item.icon && (
              <span className="inline-flex shrink-0" aria-hidden="true">
                {item.icon}
              </span>
            )}
            <span className={cn("min-w-0", pill && !inlineIcons ? "line-clamp-2 break-words" : "truncate")}>
              {item.label}
            </span>
            {item.count !== undefined && (
              <span
                className={cn(
                  "shrink-0 rounded-full px-1.5 text-[0.625rem] font-semibold tabular-nums leading-4",
                  active
                    ? "bg-[color-mix(in_srgb,var(--primary)_25%,transparent)] text-[var(--foreground)]"
                    : "bg-[color-mix(in_srgb,var(--foreground)_10%,transparent)]",
                )}
              >
                {item.count}
              </span>
            )}
            {item.badge}
          </button>
        );
      })}
    </div>
  );

  if (pill) return list;

  // Mouse aid only: keyboard users move with the arrow keys, so the edge buttons stay out of the tab order.
  const edge = (direction: 1 | -1) => (
    <button
      type="button"
      tabIndex={-1}
      aria-hidden="true"
      onClick={() => scrollBy(direction)}
      className={cn(
        "absolute inset-y-0 bottom-px flex w-10 items-center text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
        direction === 1
          ? "right-0 justify-end bg-gradient-to-l from-[var(--card)] from-50% to-transparent"
          : "left-0 justify-start bg-gradient-to-r from-[var(--card)] from-50% to-transparent",
      )}
    >
      {direction === 1 ? <ChevronRight size="1rem" /> : <ChevronLeft size="1rem" />}
    </button>
  );

  return (
    <div className={cn("relative min-w-0", className)}>
      {list}
      {overflow.back && edge(-1)}
      {overflow.forward && edge(1)}
    </div>
  );
}
