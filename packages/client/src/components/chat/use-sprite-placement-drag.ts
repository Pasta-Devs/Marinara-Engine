// ──────────────────────────────────────────────
// Drag-to-place in the sprites' Arrange mode, shared by sprites and avatars
// ──────────────────────────────────────────────
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import type { SpritePlacement } from "@marinara-engine/shared";
import { clampSpritePlacement } from "./sprite-placement";

/** The item follows the pointer in percentages of the stage while Arrange mode is on, and its place is saved
 *  on release. Outside a drag it follows the saved place. */
export function useSpritePlacementDrag({
  placement,
  placementKey,
  editing,
  stageRef,
  onPlacementChange,
}: {
  placement: SpritePlacement;
  placementKey: string;
  editing: boolean;
  stageRef: RefObject<HTMLDivElement | null>;
  onPlacementChange?: (placementKey: string, placement: SpritePlacement) => void;
}) {
  const { x, y } = clampSpritePlacement(placement);
  const [current, setCurrent] = useState<SpritePlacement>(() => ({ x, y }));
  const currentRef = useRef(current);
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; origin: SpritePlacement } | null>(null);
  const [dragging, setDragging] = useState(false);

  // Follow the saved place by value (callers may build a new object each render) unless a drag is running.
  useLayoutEffect(() => {
    if (dragging) return;
    currentRef.current = { x, y };
    setCurrent({ x, y });
  }, [dragging, x, y]);

  useEffect(() => {
    if (!editing && dragRef.current) {
      dragRef.current = null;
      setDragging(false);
    }
  }, [editing]);

  useEffect(() => {
    if (!dragging) return;

    const handlePointerMove = (event: PointerEvent) => {
      const dragState = dragRef.current;
      const stage = stageRef.current;
      if (!dragState || !stage || event.pointerId !== dragState.pointerId) return;

      const dx = ((event.clientX - dragState.startX) / Math.max(stage.clientWidth, 1)) * 100;
      const dy = ((event.clientY - dragState.startY) / Math.max(stage.clientHeight, 1)) * 100;
      const nextPlacement = clampSpritePlacement({ x: dragState.origin.x + dx, y: dragState.origin.y + dy });
      currentRef.current = nextPlacement;
      setCurrent(nextPlacement);
    };

    const finishDrag = (event: PointerEvent) => {
      const dragState = dragRef.current;
      if (!dragState || event.pointerId !== dragState.pointerId) return;
      dragRef.current = null;
      setDragging(false);
      onPlacementChange?.(placementKey, currentRef.current);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", finishDrag);
    window.addEventListener("pointercancel", finishDrag);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", finishDrag);
      window.removeEventListener("pointercancel", finishDrag);
    };
  }, [dragging, onPlacementChange, placementKey, stageRef]);

  const onPointerDown = (event: ReactPointerEvent) => {
    if (!editing) return;
    if (event.button !== 0 && event.pointerType !== "touch") return;
    event.preventDefault();
    event.stopPropagation();
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      origin: currentRef.current,
    };
    setDragging(true);
  };

  const nudgePlacement = (delta: SpritePlacement) => {
    const next = clampSpritePlacement({ x: currentRef.current.x + delta.x, y: currentRef.current.y + delta.y });
    currentRef.current = next;
    setCurrent(next);
    onPlacementChange?.(placementKey, next);
  };
  const commitPlacement = () => onPlacementChange?.(placementKey, currentRef.current);

  return { placement: current, dragging, onPointerDown, nudgePlacement, commitPlacement };
}
