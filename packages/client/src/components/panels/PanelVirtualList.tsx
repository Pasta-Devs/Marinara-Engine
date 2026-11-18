import { Fragment, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { defaultRangeExtractor, useVirtualizer, type VirtualItem } from "@tanstack/react-virtual";
import {
  findScrollParent,
  loadMeasurementSnapshot,
  saveMeasurementSnapshot,
  shouldFetchNextPage,
  withPinnedIndex,
} from "../../lib/panel-virtual-list";

type Key = VirtualItem["key"];

interface PanelVirtualListProps {
  /** Stable id of this list (e.g. "characters:root"); keys the remembered row measurements. */
  listKey: string;
  count: number;
  getItemKey: (index: number) => string;
  renderRow: (index: number) => ReactNode;
  /** Row height guess in px until the row is measured. */
  estimateSize: number;
  /** Space between rows in px. */
  gap?: number;
  /** Row index that stays mounted while it is dragged, so drag handlers survive scrolling it away. */
  pinnedIndex?: number;
  /** Scrolls this row into view when the value changes (keyboard highlight on rows that may be unmounted). */
  scrollToIndex?: number;
  /** Paged lists: asks for the next page when the last rendered row is near the end. */
  paging?: {
    hasNextPage: boolean;
    isFetchingNextPage: boolean;
    isFetchNextPageError: boolean;
    onNearEnd: () => void;
  };
  className?: string;
  /**
   * Grid: items per row for the list's width in px. Rows are windowed; each row is a CSS grid, so an
   * item may add a `col-span-full` cell after itself. Grid rows get no list roles.
   */
  columns?: (width: number) => number;
  /** Off for lists whose rows carry their own roles (a picker's `option` rows). */
  asList?: boolean;
}

/**
 * One windowed list for the side panels. It scrolls inside the nearest scrollable ancestor (the panel's own
 * container), so several lists can share one container: each measures its own offset (`scrollMargin`) from the
 * container's top and re-measures when anything above it (its ancestors or their earlier siblings) changes size.
 * Rows are wrapped, so `data-virtual-list` marks the row scope for sibling lookups (see use-library-order).
 */
export function PanelVirtualList({
  listKey,
  count,
  getItemKey,
  renderRow,
  estimateSize,
  gap = 0,
  pinnedIndex,
  scrollToIndex,
  paging,
  className,
  columns,
  asList = true,
}: PanelVirtualListProps) {
  const [listEl, setListEl] = useState<HTMLDivElement | null>(null);
  const [scroller, setScroller] = useState<HTMLElement | null>(null);
  const [scrollMargin, setScrollMargin] = useState(0);
  const [width, setWidth] = useState(0);
  // The row holding focus stays mounted, so keyboard focus is not lost when it scrolls away.
  const [focusedKey, setFocusedKey] = useState<Key>();
  const perRow = columns ? Math.max(1, Math.floor(columns(width))) : 1;
  const rowCount = Math.ceil(count / perRow);
  const toRow = (index: number | undefined) => (index === undefined || index < 0 ? index : Math.floor(index / perRow));

  const rowKey = (row: number) => (perRow === 1 ? getItemKey(row) : `${perRow}:${getItemKey(row * perRow)}`);
  // By key, not index: a re-sort (a chat with new activity) moves the focused row.
  let focusedRow: number | undefined;
  for (let row = 0; focusedKey !== undefined && row < rowCount; row++) {
    if (rowKey(row) === focusedKey) {
      focusedRow = row;
      break;
    }
  }
  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scroller,
    getItemKey: rowKey,
    estimateSize: () => estimateSize,
    // The default rounds to whole pixels, which drifts rows that have fractional heights.
    measureElement: (el) => el.getBoundingClientRect().height,
    gap,
    overscan: 6,
    scrollMargin,
    initialMeasurementsCache: loadMeasurementSnapshot(listKey),
    rangeExtractor: (range) =>
      withPinnedIndex(withPinnedIndex(defaultRangeExtractor(range), toRow(pinnedIndex)), focusedRow),
  });

  // Remember measured heights so a remount (panel switch) lands on the same row without re-estimating.
  useEffect(() => () => saveMeasurementSnapshot(listKey, virtualizer.takeSnapshot()), [virtualizer, listKey]);

  // The content above this list (other folders, headers, filters) changes height, so scrollMargin is re-measured.
  useLayoutEffect(() => {
    if (!listEl) return;
    const container = findScrollParent(listEl);
    if (!container) return;
    setScroller(container);
    const measure = () => {
      // A breakpoint can move the scrolling to another ancestor (a page that scrolls on phones, a pane on desktop).
      const current = findScrollParent(listEl) ?? container;
      setScroller(current);
      setWidth(listEl.clientWidth);
      setScrollMargin(listEl.getBoundingClientRect().top - current.getBoundingClientRect().top + current.scrollTop);
    };
    const resize = new ResizeObserver(measure);
    // Anything above the list that changes size moves it: watch every ancestor up to the container and all of their
    // earlier siblings (an open folder closing while another opens keeps the total height, but not the offsets).
    const mutation = new MutationObserver(() => observeAbove());
    const observeAbove = () => {
      resize.disconnect();
      mutation.disconnect();
      for (let el: HTMLElement | null = listEl; el && el !== container; el = el.parentElement) {
        resize.observe(el);
        for (let sib = el.previousElementSibling; sib; sib = sib.previousElementSibling) resize.observe(sib);
        if (el.parentElement) mutation.observe(el.parentElement, { childList: true });
      }
      measure();
    };
    observeAbove();
    return () => {
      resize.disconnect();
      mutation.disconnect();
    };
  }, [listEl]);

  // Only a new target item scrolls: rows streaming in (count) or the same item moving (a chat that
  // re-sorts to the top) must not pull the list back.
  const scrollToKey =
    scrollToIndex !== undefined && scrollToIndex >= 0 && scrollToIndex < count ? getItemKey(scrollToIndex) : undefined;
  // Waits for the scroll container (found after the first render); a cleared target re-arms it.
  const scrolledKeyRef = useRef<Key | undefined>(undefined);
  useEffect(() => {
    if (scrollToKey === undefined) scrolledKeyRef.current = undefined;
    if (scrollToKey === undefined || !scroller || scrolledKeyRef.current === scrollToKey) return;
    scrolledKeyRef.current = scrollToKey;
    virtualizer.scrollToIndex(toRow(scrollToIndex)!, { align: "auto" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollToKey, scroller, virtualizer]);

  const items = virtualizer.getVirtualItems();
  const lastVisibleIndex = items.length > 0 ? items[items.length - 1]!.index : undefined;
  const requestedRef = useRef(false);
  const isFetchingNextPage = paging?.isFetchingNextPage ?? false;
  useEffect(() => {
    if (!isFetchingNextPage) requestedRef.current = false;
  }, [isFetchingNextPage]);
  useEffect(() => {
    if (!paging || requestedRef.current) return;
    if (shouldFetchNextPage({ lastVisibleIndex, count: rowCount, ...paging })) {
      // Hold off until the fetch shows up as in flight, so a scroll re-render cannot fire it twice.
      requestedRef.current = true;
      paging.onNearEnd();
    }
  });

  return (
    <div
      ref={setListEl}
      data-virtual-list
      data-count={rowCount}
      role={asList && perRow === 1 ? "list" : undefined}
      className={className}
      style={{ position: "relative", height: virtualizer.getTotalSize() }}
    >
      {items.map((virtualRow) => {
        const first = virtualRow.index * perRow;
        return (
          <div
            key={virtualRow.key}
            ref={virtualizer.measureElement}
            data-index={virtualRow.index}
            role={asList && perRow === 1 ? "listitem" : undefined}
            aria-posinset={asList && perRow === 1 ? first + 1 : undefined}
            aria-setsize={asList && perRow === 1 ? count : undefined}
            onFocus={() => setFocusedKey(virtualRow.key)}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) setFocusedKey(undefined);
            }}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              transform: `translateY(${virtualRow.start - virtualizer.options.scrollMargin}px)`,
              ...(perRow > 1 && {
                display: "grid",
                gridTemplateColumns: `repeat(${perRow}, minmax(0, 1fr))`,
                columnGap: gap,
              }),
            }}
          >
            {perRow === 1
              ? renderRow(first)
              : Array.from({ length: Math.min(perRow, count - first) }, (_, offset) => (
                  <Fragment key={getItemKey(first + offset)}>{renderRow(first + offset)}</Fragment>
                ))}
          </div>
        );
      })}
    </div>
  );
}
