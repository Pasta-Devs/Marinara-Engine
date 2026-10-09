export type InsertEdge = "before" | "after";
export type LibraryOrder = { active: boolean; ids: string[] };
export const EMPTY_LIBRARY_ORDER: LibraryOrder = { active: false, ids: [] };

export function getLibraryDragRows(source: HTMLElement, kind: string) {
  const scope =
    source.closest(
      '[data-component="RightPanelMobile"],[data-component="RightPanelDesktop"],[data-component="ChatSidebar"],[role="dialog"]',
    ) ?? document;
  return Array.from(scope.querySelectorAll<HTMLElement>(`[data-drag-kind="${kind}"]`)).filter(
    (element) => element.getClientRects().length > 0 && !element.closest('[aria-hidden="true"]'),
  );
}

export function readLibraryOrder(value: unknown): LibraryOrder {
  if (!value || typeof value !== "object") return EMPTY_LIBRARY_ORDER;
  const order = value as Partial<LibraryOrder>;
  if (!Array.isArray(order.ids)) return EMPTY_LIBRARY_ORDER;
  return { active: order.active === true, ids: Array.from(new Set(order.ids.filter((id) => typeof id === "string"))) };
}

/** Preserve hidden IDs; move a stack as a block in its original visible order. */
export function insertLibraryItems(
  order: readonly string[],
  dragged: readonly string[],
  target: string,
  edge: InsertEdge,
) {
  const moving = new Set(dragged);
  if (moving.has(target) || !order.includes(target)) return [...order];
  const block = order.filter((id) => moving.has(id));
  const remaining = order.filter((id) => !moving.has(id));
  const index = remaining.indexOf(target) + (edge === "after" ? 1 : 0);
  return [...remaining.slice(0, index), ...block, ...remaining.slice(index)];
}
