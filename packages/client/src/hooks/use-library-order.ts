import { useCallback, useEffect, useMemo } from "react";
import { useUIStore } from "../stores/ui.store";
import { getLibraryDragRows, insertLibraryItems, readLibraryOrder, type InsertEdge } from "../lib/library-order";

export function useLibraryOrder(
  kind: string,
  onKeyboardReorder?: (ids: string[], target: string, edge: InsertEdge, visibleIds: string[]) => void,
) {
  const raw = useUIStore((state) => state.libraryManualOrders?.[kind]);
  const save = useUIStore((state) => state.setLibraryManualOrder);
  const order = useMemo(() => readLibraryOrder(raw), [raw]);
  const ranks = useMemo(() => new Map(order.ids.map((id, index) => [id, index])), [order]);
  const orderItems = useCallback(
    <T>(items: readonly T[], getId: (item: T) => string = (item) => (item as { id: string }).id): T[] => {
      if (!order.active) return [...items];
      return [...items].sort((a, b) => (ranks.get(getId(a)) ?? Infinity) - (ranks.get(getId(b)) ?? Infinity));
    },
    [order.active, ranks],
  );
  const reorder = useCallback(
    (ids: string[], target: string, edge: InsertEdge, visibleIds: string[]) => {
      // Retain unseen (filtered, collapsed or paginated) items when updating visible positions.
      const existing = readLibraryOrder(useUIStore.getState().libraryManualOrders?.[kind]);
      const base = existing.active
        ? Array.from(new Set([...existing.ids, ...visibleIds, ...ids]))
        : Array.from(new Set([...visibleIds, ...existing.ids, ...ids]));
      save(kind, { active: true, ids: insertLibraryItems(base, ids, target, edge) });
    },
    [kind, save],
  );
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        !event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        !["ArrowUp", "ArrowDown"].includes(event.key)
      )
        return;
      const row = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-drag-id]") : null;
      if (
        !row ||
        (event.target instanceof Element && event.target.closest("input,textarea,select")) ||
        (event.target instanceof HTMLElement && event.target.isContentEditable) ||
        row.dataset.dragKind !== kind ||
        row.closest('[aria-hidden="true"]') ||
        document.querySelector('body > [data-drag-kind][aria-hidden="true"]')
      )
        return;
      const siblings = Array.from(
        row.parentElement?.querySelectorAll<HTMLElement>(`[data-drag-kind="${kind}"]`) ?? [],
      ).filter((element) => element.parentElement === row.parentElement && element.getClientRects().length > 0);
      const index = siblings.indexOf(row);
      const target = siblings[index + (event.key === "ArrowUp" ? -1 : 1)];
      if (!target) return;
      event.preventDefault();
      const key = (element: HTMLElement) => element.dataset.dragOrderId ?? element.dataset.dragId!;
      (onKeyboardReorder ?? reorder)(
        [key(row)],
        key(target),
        event.key === "ArrowUp" ? "before" : "after",
        getLibraryDragRows(row, kind).map(key),
      );
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [kind, reorder, onKeyboardReorder]);
  const setActive = useCallback((active: boolean) => save(kind, { ...order, active }), [kind, order, save]);
  return { active: order.active, orderItems, reorder, setActive };
}
