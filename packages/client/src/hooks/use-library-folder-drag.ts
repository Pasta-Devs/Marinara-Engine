import { type MouseEvent, type TouchEvent } from "react";
import { useLibraryOrder } from "./use-library-order";
import { useTouchFolderDrag } from "./use-touch-folder-drag";

export function useLibraryFolderDrag(kind: string, onReorder?: ReturnType<typeof useLibraryOrder>["reorder"]) {
  const order = useLibraryOrder(`${kind}-folder`, onReorder);
  const { startTouchDrag } = useTouchFolderDrag({
    onActivate: () => {},
    onReorder: onReorder ?? order.reorder,
    onDrop: () => {},
  });
  const bind = (id: string) => {
    const start = (event: MouseEvent<HTMLElement> | TouchEvent<HTMLElement>) => {
      // An item inside an expanded folder owns its own gesture.
      if (!(event.target instanceof Element) || event.target.closest("[data-drag-kind]") !== event.currentTarget)
        return;
      startTouchDrag(event, id);
    };
    return {
      "data-drag-id": id,
      "data-drag-kind": `${kind}-folder`,
      "aria-keyshortcuts": "Alt+ArrowUp Alt+ArrowDown",
      onMouseDown: start,
      onTouchStart: start,
    };
  };
  const orderItems: typeof order.orderItems = onReorder ? (items) => [...items] : order.orderItems;
  return { ...order, orderItems, bind };
}
