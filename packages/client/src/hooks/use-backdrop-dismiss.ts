import { useCallback, useRef, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from "react";

function isBackdropTarget(currentTarget: HTMLElement, target: EventTarget | null): boolean {
  if (target === currentTarget) return true;
  return (
    target instanceof HTMLElement && target.dataset.backdropDismissSurface === "true" && currentTarget.contains(target)
  );
}

/**
 * Closes an overlay only when the pointer press, pointer release, and click
 * all occur on its backdrop. A drag or native window-resize gesture that starts
 * or ends across boundaries must not be interpreted as an outside click.
 */
export function useBackdropDismiss<T extends HTMLElement>(onDismiss: () => void, disabled = false) {
  const pointerStartedOnBackdropRef = useRef(false);
  const pointerEndedOnBackdropRef = useRef(false);

  const onPointerDownCapture = useCallback((event: ReactPointerEvent<T>) => {
    pointerStartedOnBackdropRef.current = isBackdropTarget(event.currentTarget, event.target);
    pointerEndedOnBackdropRef.current = false;
  }, []);

  const onPointerUpCapture = useCallback((event: ReactPointerEvent<T>) => {
    pointerEndedOnBackdropRef.current = isBackdropTarget(event.currentTarget, event.target);
  }, []);

  const onPointerCancelCapture = useCallback(() => {
    pointerStartedOnBackdropRef.current = false;
    pointerEndedOnBackdropRef.current = false;
  }, []);

  const onClick = useCallback(
    (event: ReactMouseEvent<T>) => {
      const shouldDismiss =
        !disabled &&
        pointerStartedOnBackdropRef.current &&
        pointerEndedOnBackdropRef.current &&
        isBackdropTarget(event.currentTarget, event.target);
      pointerStartedOnBackdropRef.current = false;
      pointerEndedOnBackdropRef.current = false;
      if (shouldDismiss) onDismiss();
    },
    [disabled, onDismiss],
  );

  return { onPointerDownCapture, onPointerUpCapture, onPointerCancelCapture, onClick };
}
