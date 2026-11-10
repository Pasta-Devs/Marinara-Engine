import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { defaultRangeExtractor, useVirtualizer } from "@tanstack/react-virtual";
import {
  findScrollParent,
  loadMeasurementSnapshot,
  saveMeasurementSnapshot,
  shouldFetchNextPage,
  withPinnedIndex,
} from "../../lib/panel-virtual-list";

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
  /** Paged lists: asks for the next page when the last rendered row is near the end. */
  paging?: {
    hasNextPage: boolean;
    isFetchingNextPage: boolean;
    isFetchNextPageError: boolean;
    onNearEnd: () => void;
  };
  className?: string;
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
  paging,
  className,
}: PanelVirtualListProps) {
  const [listEl, setListEl] = useState<HTMLDivElement | null>(null);
  const [scroller, setScroller] = useState<HTMLElement | null>(null);
  const [scrollMargin, setScrollMargin] = useState(0);

  const virtualizer = useVirtualizer({
    count,
    getScrollElement: () => scroller,
    getItemKey,
    estimateSize: () => estimateSize,
    gap,
    overscan: 6,
    scrollMargin,
    initialMeasurementsCache: loadMeasurementSnapshot(listKey),
    rangeExtractor: (range) => withPinnedIndex(defaultRangeExtractor(range), pinnedIndex),
  });

  // Remember measured heights so a remount (panel switch) lands on the same row without re-estimating.
  useEffect(() => () => saveMeasurementSnapshot(listKey, virtualizer.takeSnapshot()), [virtualizer, listKey]);

  // The content above this list (other folders, headers, filters) changes height, so scrollMargin is re-measured.
  useLayoutEffect(() => {
    if (!listEl) return;
    const container = findScrollParent(listEl);
    if (!container) return;
    setScroller(container);
    const measure = () =>
      setScrollMargin(listEl.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop);
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

  const items = virtualizer.getVirtualItems();
  const lastVisibleIndex = items.length > 0 ? items[items.length - 1]!.index : undefined;
  const requestedRef = useRef(false);
  const isFetchingNextPage = paging?.isFetchingNextPage ?? false;
  useEffect(() => {
    if (!isFetchingNextPage) requestedRef.current = false;
  }, [isFetchingNextPage]);
  useEffect(() => {
    if (!paging || requestedRef.current) return;
    if (shouldFetchNextPage({ lastVisibleIndex, count, ...paging })) {
      // Hold off until the fetch shows up as in flight, so a scroll re-render cannot fire it twice.
      requestedRef.current = true;
      paging.onNearEnd();
    }
  });

  return (
    <div
      ref={setListEl}
      data-virtual-list
      className={className}
      style={{ position: "relative", height: virtualizer.getTotalSize() }}
    >
      {items.map((virtualRow) => (
        <div
          key={virtualRow.key}
          ref={virtualizer.measureElement}
          data-index={virtualRow.index}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            transform: `translateY(${virtualRow.start - virtualizer.options.scrollMargin}px)`,
          }}
        >
          {renderRow(virtualRow.index)}
        </div>
      ))}
    </div>
  );
}
