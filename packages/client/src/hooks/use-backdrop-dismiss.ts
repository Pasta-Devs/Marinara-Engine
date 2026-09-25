import { useCallback, useRef, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from "react";

function isBackdropTarget(currentTarget: HTMLElement, target: EventTarget | null): boolean {
  if (target === currentTarget) return true;
  return (
    target instanceof HTMLElement && target.dataset.backdropDismissSurface === "true" && currentTarget.contains(target)
  );
}

function getHitTarget(event: ReactPointerEvent): EventTarget | null {
  if (typeof document !== "undefined" && Number.isFinite(event.clientX) && Number.isFinite(event.clientY)) {
    return document.elementFromPoint(event.clientX, event.clientY);
  }
  return event.target;
}

/**
 * Closes an overlay only when the pointer press, pointer release, and click
 * all occur on its backdrop. A drag or native window-resize gesture that starts
 * or ends across boundaries must not be interpreted as an outside click.
 */
export function useBackdropDismiss<T extends HTMLElement>(onDismiss: () => void, disabled = false) {
  const pointerIdRef = useRef<number | null>(null);
  const pointerStartedOnBackdropRef = useRef(false);
  const pointerEndedOnBackdropRef = useRef(false);

  const onPointerDownCapture = useCallback((event: ReactPointerEvent<T>) => {
    // A second finger cancels dismissal instead of borrowing the first finger's release.
    pointerIdRef.current = event.isPrimary ? event.pointerId : null;
    pointerStartedOnBackdropRef.current = event.isPrimary && isBackdropTarget(event.currentTarget, event.target);
    pointerEndedOnBackdropRef.current = false;
  }, []);

  const onPointerUpCapture = useCallback((event: ReactPointerEvent<T>) => {
    const releaseTarget = getHitTarget(event);
    pointerEndedOnBackdropRef.current =
      event.pointerId === pointerIdRef.current && isBackdropTarget(event.currentTarget, releaseTarget);
  }, []);

  const onPointerCancelCapture = useCallback(() => {
    pointerIdRef.current = null;
    pointerStartedOnBackdropRef.current = false;
    pointerEndedOnBackdropRef.current = false;
  }, []);

  const onClick = useCallback(
    (event: ReactMouseEvent<T>) => {
      const clickPointerId = "pointerId" in event.nativeEvent ? event.nativeEvent.pointerId : null;
      const shouldDismiss =
        !disabled &&
        (clickPointerId === null || clickPointerId === pointerIdRef.current) &&
        pointerStartedOnBackdropRef.current &&
        pointerEndedOnBackdropRef.current &&
        isBackdropTarget(event.currentTarget, event.target);
      pointerIdRef.current = null;
      pointerStartedOnBackdropRef.current = false;
      pointerEndedOnBackdropRef.current = false;
      if (shouldDismiss) onDismiss();
    },
    [disabled, onDismiss],
  );

  return { onPointerDownCapture, onPointerUpCapture, onPointerCancelCapture, onClick };
}
