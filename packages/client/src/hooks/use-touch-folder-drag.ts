import { useCallback, useEffect, useRef, type TouchEvent as ReactTouchEvent } from "react";
import {
  beginChatResourceTouchDrag,
  clearActiveChatResourceDrag,
  type ChatResourceDragPayload,
} from "../lib/chat-resource-drag";

type TouchFolderDragState = {
  id: string;
  timer: number | null;
  active: boolean;
  sourceElement: HTMLElement;
  previousDraggable: string | null;
  previousTouchCallout: string;
  previousTouchAction: string;
  previousUserDrag: string;
  previousUserSelect: string;
  previewElement: HTMLElement | null;
  previewOffsetX: number;
  previewOffsetY: number;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  scrollTargets: AutoScrollTarget[];
  autoScrollFrame: number | null;
  chatResourcePayload: ChatResourceDragPayload | null;
};

type TouchFolderDragOptions = {
  delayMs?: number;
  moveActivateThresholdPx?: number;
  autoScrollEdgePx?: number;
  autoScrollMaxSpeedPx?: number;
  onActivate: (id: string) => void;
  onDrop: (id: string, x: number, y: number) => void;
  onCancel?: (id: string, active: boolean) => void;
};

type StartTouchDragOptions = {
  allowInteractiveTarget?: boolean;
  sourceElement?: HTMLElement | null;
  /** Set by rows that can also be dropped on a chat, so the mobile drop dock can offer itself. */
  chatResourcePayload?: ChatResourceDragPayload | null;
};

type AutoScrollTarget = {
  kind: "element" | "window";
  element: HTMLElement | Window;
  getBounds: () => { top: number; bottom: number };
  canScroll: (direction: -1 | 1) => boolean;
  scrollBy: (deltaY: number) => void;
};

const DEFAULT_TOUCH_DRAG_DELAY_MS = 320;
const DEFAULT_TOUCH_DRAG_ACTIVATE_THRESHOLD_PX = 10;
const DEFAULT_AUTO_SCROLL_EDGE_PX = 76;
const DEFAULT_AUTO_SCROLL_MAX_SPEED_PX = 18;
const WEBKIT_TOUCH_CALLOUT_PROPERTY = "-webkit-touch-callout";
const WEBKIT_USER_DRAG_PROPERTY = "-webkit-user-drag";
const TOUCH_DRAG_ACTIVE_TOUCH_ACTION = "none";
const TOUCH_DRAG_PREVIEW_Z_INDEX = "100000";

function restoreStyleProperty(style: CSSStyleDeclaration, property: string, value: string) {
  if (value) {
    style.setProperty(property, value);
  } else {
    style.removeProperty(property);
  }
}

function updatePreviewPosition(drag: TouchFolderDragState) {
  if (!drag.previewElement) return;
  drag.previewElement.style.transform = `translate3d(${drag.lastX - drag.previewOffsetX}px, ${
    drag.lastY - drag.previewOffsetY
  }px, 0)`;
}

function createPreviewElement(drag: TouchFolderDragState) {
  const rect = drag.sourceElement.getBoundingClientRect();
  const clone = drag.sourceElement.cloneNode(true) as HTMLElement;
  const computedStyle = window.getComputedStyle(drag.sourceElement);

  drag.previewOffsetX = drag.startX - rect.left;
  drag.previewOffsetY = drag.startY - rect.top;

  clone.setAttribute("aria-hidden", "true");
  clone.style.position = "fixed";
  clone.style.left = "0";
  clone.style.top = "0";
  clone.style.width = `${rect.width}px`;
  clone.style.height = `${rect.height}px`;
  clone.style.margin = "0";
  clone.style.pointerEvents = "none";
  clone.style.zIndex = TOUCH_DRAG_PREVIEW_Z_INDEX;
  clone.style.opacity = "0.96";
  clone.style.borderRadius = computedStyle.borderRadius;
  clone.style.boxShadow = "0 18px 44px rgba(0, 0, 0, 0.34)";
  clone.style.transformOrigin = "top left";
  clone.style.transition = "none";
  clone.style.willChange = "transform";
  clone.style.contain = "layout paint style";

  document.body.appendChild(clone);
  drag.previewElement = clone;
  updatePreviewPosition(drag);
}

function removePreviewElement(drag: TouchFolderDragState) {
  drag.previewElement?.remove();
  drag.previewElement = null;
}

function getDocumentScrollingElement(): HTMLElement {
  return (document.scrollingElement ?? document.documentElement) as HTMLElement;
}

function getVisibleElementBounds(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  return {
    top: Math.max(0, rect.top),
    bottom: Math.min(window.innerHeight, rect.bottom),
  };
}

function isScrollableElement(element: HTMLElement) {
  const style = window.getComputedStyle(element);
  const overflowY = style.overflowY;
  return (
    (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") &&
    element.scrollHeight > element.clientHeight + 1
  );
}

function createElementScrollTarget(element: HTMLElement): AutoScrollTarget {
  return {
    kind: "element",
    element,
    getBounds: () => getVisibleElementBounds(element),
    canScroll: (direction) =>
      direction < 0 ? element.scrollTop > 0 : element.scrollTop + element.clientHeight < element.scrollHeight - 1,
    scrollBy: (deltaY) => {
      element.scrollTop += deltaY;
    },
  };
}

function createWindowScrollTarget(): AutoScrollTarget {
  return {
    kind: "window",
    element: window,
    getBounds: () => ({ top: 0, bottom: window.innerHeight }),
    canScroll: (direction) => {
      const scrollingElement = getDocumentScrollingElement();
      return direction < 0
        ? window.scrollY > 0 || scrollingElement.scrollTop > 0
        : window.scrollY + window.innerHeight < scrollingElement.scrollHeight - 1;
    },
    scrollBy: (deltaY) => {
      window.scrollBy({ top: deltaY, behavior: "auto" });
    },
  };
}

function getAutoScrollTargets(sourceElement: HTMLElement) {
  const targets: AutoScrollTarget[] = [];
  let current = sourceElement.parentElement;
  while (current && current !== document.body) {
    if (isScrollableElement(current)) {
      targets.push(createElementScrollTarget(current));
    }
    current = current.parentElement;
  }
  targets.push(createWindowScrollTarget());
  return targets;
}

export function useTouchFolderDrag({
  delayMs = DEFAULT_TOUCH_DRAG_DELAY_MS,
  moveActivateThresholdPx,
  autoScrollEdgePx = DEFAULT_AUTO_SCROLL_EDGE_PX,
  autoScrollMaxSpeedPx = DEFAULT_AUTO_SCROLL_MAX_SPEED_PX,
  onActivate,
  onDrop,
  onCancel,
}: TouchFolderDragOptions) {
  const resolvedMoveActivateThresholdPx =
    moveActivateThresholdPx ?? DEFAULT_TOUCH_DRAG_ACTIVATE_THRESHOLD_PX;
  const dragRef = useRef<TouchFolderDragState | null>(null);
  const optionsRef = useRef({
    delayMs,
    moveActivateThresholdPx: resolvedMoveActivateThresholdPx,
    autoScrollEdgePx,
    autoScrollMaxSpeedPx,
    onActivate,
    onDrop,
    onCancel,
  });
  const removeListenersRef = useRef<(() => void) | null>(null);

  optionsRef.current = {
    delayMs,
    moveActivateThresholdPx: resolvedMoveActivateThresholdPx,
    autoScrollEdgePx,
    autoScrollMaxSpeedPx,
    onActivate,
    onDrop,
    onCancel,
  };

  const clearDragTimer = useCallback((drag: TouchFolderDragState) => {
    if (drag.timer !== null) {
      window.clearTimeout(drag.timer);
      drag.timer = null;
    }
  }, []);

  const stopAutoScroll = useCallback((drag: TouchFolderDragState) => {
    if (drag.autoScrollFrame !== null) {
      window.cancelAnimationFrame(drag.autoScrollFrame);
      drag.autoScrollFrame = null;
    }
  }, []);

  const getAutoScrollDelta = useCallback((drag: TouchFolderDragState) => {
    const edgePx = optionsRef.current.autoScrollEdgePx;
    const maxSpeedPx = optionsRef.current.autoScrollMaxSpeedPx;

    for (const target of drag.scrollTargets) {
      const { top, bottom } = target.getBounds();
      if (bottom <= top) continue;

      const distanceFromTop = drag.lastY - top;
      const distanceFromBottom = bottom - drag.lastY;
      const direction = distanceFromTop < edgePx ? -1 : distanceFromBottom < edgePx ? 1 : 0;
      if (direction === 0 || !target.canScroll(direction)) continue;

      const distance = direction < 0 ? distanceFromTop : distanceFromBottom;
      const intensity = Math.max(0, Math.min(1, (edgePx - distance) / edgePx));
      const speed = Math.max(1, Math.round(maxSpeedPx * (0.2 + intensity * intensity * 0.8)));
      return { target, deltaY: direction * speed };
    }

    return null;
  }, []);

  const runAutoScroll = useCallback(() => {
    const drag = dragRef.current;
    if (!drag?.active) return;

    const scroll = getAutoScrollDelta(drag);
    if (!scroll) {
      drag.autoScrollFrame = null;
      return;
    }

    scroll.target.scrollBy(scroll.deltaY);
    updatePreviewPosition(drag);
    drag.autoScrollFrame = window.requestAnimationFrame(runAutoScroll);
  }, [getAutoScrollDelta]);

  const scheduleAutoScroll = useCallback(
    (drag: TouchFolderDragState) => {
      if (drag.autoScrollFrame !== null) return;
      if (!getAutoScrollDelta(drag)) return;
      drag.autoScrollFrame = window.requestAnimationFrame(runAutoScroll);
    },
    [getAutoScrollDelta, runAutoScroll],
  );

  const activateTouchDrag = useCallback(
    (drag: TouchFolderDragState) => {
      if (drag.active || dragRef.current !== drag) return;
      clearDragTimer(drag);
      drag.active = true;
      drag.sourceElement.style.touchAction = TOUCH_DRAG_ACTIVE_TOUCH_ACTION;
      createPreviewElement(drag);
      if (drag.chatResourcePayload) beginChatResourceTouchDrag(drag.chatResourcePayload);
      optionsRef.current.onActivate(drag.id);
      scheduleAutoScroll(drag);
    },
    [clearDragTimer, scheduleAutoScroll],
  );

  const restoreSourceElement = useCallback((drag: TouchFolderDragState) => {
    removePreviewElement(drag);
    if (drag.previousDraggable === null) {
      drag.sourceElement.removeAttribute("draggable");
    } else {
      drag.sourceElement.setAttribute("draggable", drag.previousDraggable);
    }
    restoreStyleProperty(drag.sourceElement.style, WEBKIT_TOUCH_CALLOUT_PROPERTY, drag.previousTouchCallout);
    restoreStyleProperty(drag.sourceElement.style, WEBKIT_USER_DRAG_PROPERTY, drag.previousUserDrag);
    drag.sourceElement.style.touchAction = drag.previousTouchAction;
    drag.sourceElement.style.userSelect = drag.previousUserSelect;
  }, []);

  const removeListeners = useCallback(() => {
    removeListenersRef.current?.();
    removeListenersRef.current = null;
  }, []);

  const cancelTouchDrag = useCallback(
    (drop = false) => {
      const drag = dragRef.current;
      if (!drag) return;
      clearDragTimer(drag);
      stopAutoScroll(drag);
      restoreSourceElement(drag);
      dragRef.current = null;
      removeListeners();
      // The dock reads the payload in the capture phase, so it is safe to drop it here.
      if (drag.chatResourcePayload) clearActiveChatResourceDrag();

      if (drop && drag.active) {
        optionsRef.current.onDrop(drag.id, drag.lastX, drag.lastY);
      } else {
        optionsRef.current.onCancel?.(drag.id, drag.active);
      }
    },
    [clearDragTimer, removeListeners, restoreSourceElement, stopAutoScroll],
  );

  const handleTouchMove = useCallback(
    (event: TouchEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const touch = event.touches[0] ?? event.changedTouches[0];
      if (!touch) return;

      if (event.cancelable) event.preventDefault();

      drag.lastX = touch.clientX;
      drag.lastY = touch.clientY;

      const movedX = touch.clientX - drag.startX;
      const movedY = touch.clientY - drag.startY;
      const moved = Math.hypot(movedX, movedY);

      if (!drag.active && moved > optionsRef.current.moveActivateThresholdPx) {
        activateTouchDrag(drag);
      }

      if (drag.active) {
        updatePreviewPosition(drag);
        scheduleAutoScroll(drag);
      }
    },
    [activateTouchDrag, scheduleAutoScroll],
  );

  const handleTouchEnd = useCallback(
    (event: TouchEvent) => {
      const drag = dragRef.current;
      if (drag?.active) {
        if (event.cancelable) event.preventDefault();
      }
      cancelTouchDrag(true);
    },
    [cancelTouchDrag],
  );

  const handleTouchCancel = useCallback(() => cancelTouchDrag(false), [cancelTouchDrag]);
  const handleContextMenu = useCallback(
    (event: Event) => {
      const drag = dragRef.current;
      if (!drag) return;
      event.preventDefault();
      cancelTouchDrag(false);
    },
    [cancelTouchDrag],
  );
  const handleInterruptedTouchDrag = useCallback(() => cancelTouchDrag(false), [cancelTouchDrag]);

  const attachListeners = useCallback(() => {
    removeListeners();
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", handleTouchEnd, { passive: false });
    window.addEventListener("touchcancel", handleTouchCancel, { passive: false });
    window.addEventListener("contextmenu", handleContextMenu, { capture: true });
    window.addEventListener("blur", handleInterruptedTouchDrag);
    window.addEventListener("pagehide", handleInterruptedTouchDrag);
    removeListenersRef.current = () => {
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("touchcancel", handleTouchCancel);
      window.removeEventListener("contextmenu", handleContextMenu, { capture: true });
      window.removeEventListener("blur", handleInterruptedTouchDrag);
      window.removeEventListener("pagehide", handleInterruptedTouchDrag);
    };
  }, [handleContextMenu, handleInterruptedTouchDrag, handleTouchCancel, handleTouchEnd, handleTouchMove, removeListeners]);

  const startTouchDrag = useCallback(
    (event: ReactTouchEvent<HTMLElement>, id: string, options?: StartTouchDragOptions) => {
      if (event.touches.length !== 1) return;
      const interactiveTarget =
        event.target instanceof Element
          ? event.target.closest("button,a,input,textarea,select,[role='button']")
          : null;
      if (!options?.allowInteractiveTarget && interactiveTarget && interactiveTarget !== event.currentTarget) {
        return;
      }
      cancelTouchDrag(false);
      attachListeners();

      const touch = event.touches[0];
      const sourceElement = options?.sourceElement ?? event.currentTarget;
      const previousDraggable = sourceElement.getAttribute("draggable");
      const previousTouchCallout = sourceElement.style.getPropertyValue(WEBKIT_TOUCH_CALLOUT_PROPERTY);
      const previousTouchAction = sourceElement.style.touchAction;
      const previousUserDrag = sourceElement.style.getPropertyValue(WEBKIT_USER_DRAG_PROPERTY);
      const previousUserSelect = sourceElement.style.userSelect;

      sourceElement.setAttribute("draggable", "false");
      sourceElement.style.setProperty(WEBKIT_TOUCH_CALLOUT_PROPERTY, "none");
      sourceElement.style.setProperty(WEBKIT_USER_DRAG_PROPERTY, "none");
      sourceElement.style.touchAction = TOUCH_DRAG_ACTIVE_TOUCH_ACTION;
      sourceElement.style.userSelect = "none";

      const drag: TouchFolderDragState = {
        id,
        timer: null,
        active: false,
        sourceElement,
        previousDraggable,
        previousTouchCallout,
        previousTouchAction,
        previousUserDrag,
        previousUserSelect,
        previewElement: null,
        previewOffsetX: 0,
        previewOffsetY: 0,
        startX: touch.clientX,
        startY: touch.clientY,
        lastX: touch.clientX,
        lastY: touch.clientY,
        scrollTargets: getAutoScrollTargets(sourceElement),
        autoScrollFrame: null,
        chatResourcePayload: options?.chatResourcePayload ?? null,
      };

      drag.timer = window.setTimeout(() => {
        activateTouchDrag(drag);
      }, optionsRef.current.delayMs);

      dragRef.current = drag;
    },
    [activateTouchDrag, attachListeners, cancelTouchDrag],
  );

  useEffect(
    () => () => {
      removeListeners();
      const drag = dragRef.current;
      if (drag) {
        clearDragTimer(drag);
        stopAutoScroll(drag);
        restoreSourceElement(drag);
      }
      dragRef.current = null;
    },
    [clearDragTimer, removeListeners, restoreSourceElement, stopAutoScroll],
  );

  return { startTouchDrag, cancelTouchDrag };
}
