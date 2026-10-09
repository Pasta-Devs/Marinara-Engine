import {
  useCallback,
  useEffect,
  useRef,
  type MouseEvent as ReactMouseEvent,
  type TouchEvent as ReactTouchEvent,
} from "react";
import { useTranslation } from "react-i18next";
import { getLibraryDragRows, type InsertEdge } from "../lib/library-order";
import {
  beginChatResourceMouseDrag,
  beginChatResourceTouchDrag,
  clearActiveChatResourceDrag,
  parseChatResourceDragPayload,
  type ChatResourceDragPayload,
} from "../lib/chat-resource-drag";

type TouchFolderDragState = {
  id: string;
  ids: string[];
  stackedElements: HTMLElement[];
  feedbackElement: HTMLElement | null;
  insertEdge: InsertEdge | null;
  timer: number | null;
  active: boolean;
  holdToActivate: boolean;
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
  touchIdentifier: number | null;
  scrollTouch: {
    identifier: number;
    lastY: number;
    startX: number;
    startY: number;
    startedAt: number;
    moved: boolean;
    candidate: { id: string; element: HTMLElement; payload: ChatResourceDragPayload | null } | null;
  } | null;
  scrollTargets: AutoScrollTarget[];
  autoScrollFrame: number | null;
  chatResourcePayload: ChatResourceDragPayload | null;
};

type TouchFolderDragOptions = {
  delayMs?: number;
  moveActivateThresholdPx?: number;
  /** Set to zero to keep the surrounding panel still while dragging. */
  autoScrollEdgePx?: number;
  autoScrollMaxSpeedPx?: number;
  /** Enables second-finger gathering and preserves any existing bulk selection. */
  getDragIds?: (id: string) => string[];
  /** Set when reordering also commits the destination folder. */
  reorderHandlesDrop?: boolean;
  onReorder?: (ids: string[], target: string, edge: InsertEdge, visibleIds: string[]) => void;
  onActivate: (id: string) => void;
  onDrop: (id: string, x: number, y: number, ids: string[]) => void;
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
  if (drag.sourceElement.dataset.dragKind?.endsWith("-folder") && clone.tagName !== "BUTTON") {
    Array.from(clone.children)
      .slice(1)
      .forEach((child) => child.remove());
  }
  const computedStyle = window.getComputedStyle(drag.sourceElement);

  drag.previewOffsetX = drag.startX - rect.left;
  drag.previewOffsetY = drag.startY - rect.top;

  clone.setAttribute("aria-hidden", "true");
  clone.inert = true;
  clone.classList.add("mari-chrome-token-scope");
  clone.style.position = "fixed";
  clone.style.left = "0";
  clone.style.top = "0";
  clone.style.width = `${rect.width}px`;
  const headerHeight =
    drag.sourceElement.dataset.dragKind?.endsWith("-folder") && clone.tagName !== "BUTTON"
      ? drag.sourceElement.firstElementChild?.getBoundingClientRect().height
      : undefined;
  clone.style.height = `${headerHeight ?? rect.height}px`;
  clone.style.margin = "0";
  clone.style.pointerEvents = "none";
  clone.style.zIndex = TOUCH_DRAG_PREVIEW_Z_INDEX;
  clone.style.opacity = "0.96";
  clone.style.backgroundColor = "var(--sidebar)";
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

function updateStackPreview(drag: TouchFolderDragState) {
  if (!drag.previewElement || drag.ids.length < 2) return;
  let badge = drag.previewElement.querySelector<HTMLElement>("[data-drag-stack-count]");
  if (!badge) {
    badge = document.createElement("span");
    badge.setAttribute("data-drag-stack-count", "");
    badge.className =
      "absolute right-1 top-1 rounded-full bg-[var(--primary)] px-2 py-0.5 text-xs font-semibold text-[var(--primary-foreground)] shadow-sm";
    drag.previewElement.appendChild(badge);
    drag.previewElement.style.boxShadow =
      "0 4px 0 -1px var(--sidebar), 0 4px 0 var(--border), 0 8px 0 -1px var(--sidebar), 0 8px 0 var(--border), 0 18px 44px rgba(0, 0, 0, 0.34)";
  }
  badge.textContent = String(drag.ids.length);
}

function clearDropFeedback(drag: TouchFolderDragState) {
  drag.feedbackElement?.removeAttribute("data-drag-insert");
  drag.feedbackElement?.removeAttribute("data-drag-insert-axis");
  drag.feedbackElement?.removeAttribute("data-drag-target");
  drag.feedbackElement = null;
  drag.insertEdge = null;
}

function updateDropFeedback(drag: TouchFolderDragState, reorderEnabled: boolean) {
  const kind = drag.sourceElement.dataset.dragKind;
  if (!kind) return null;
  const hit = document.elementFromPoint(drag.lastX, drag.lastY);
  let row = hit?.closest<HTMLElement>(`[data-drag-kind="${kind}"]`);
  const folder = hit?.closest<HTMLElement>(`[data-${kind}-folder-id]`);
  // Margins belong to the list, so the opened insertion gap has no row under the pointer.
  // Snap nearby empty space to a row without stealing folder-header drops or leaving the list.
  if (reorderEnabled && !row && hit) {
    const candidates = Array.from(hit.querySelectorAll<HTMLElement>(`[data-drag-kind="${kind}"]`));
    if (drag.feedbackElement && candidates.includes(drag.feedbackElement)) {
      candidates.unshift(drag.feedbackElement);
    }
    let nearestDistance = 25;
    for (const candidate of candidates) {
      if (
        !candidate.getClientRects().length ||
        candidate.closest('[aria-hidden="true"]') ||
        drag.ids.includes(candidate.dataset.dragId ?? "")
      )
        continue;
      const rect = candidate.getBoundingClientRect();
      const distance = Math.hypot(
        Math.max(rect.left - drag.lastX, 0, drag.lastX - rect.right),
        Math.max(rect.top - drag.lastY, 0, drag.lastY - rect.bottom),
      );
      if (distance <= 24 && distance < nearestDistance) {
        nearestDistance = distance;
        row = candidate;
      }
    }
  }
  if (row && row.dataset.dragKind === kind && drag.ids.includes(row.dataset.dragId ?? "")) {
    clearDropFeedback(drag);
    return null;
  }
  if (reorderEnabled && row?.dataset.dragKind === kind && row.dataset.dragId) {
    // Installed agents keep their categories; only cross-folder moves change a container.
    if (
      kind === "agent" &&
      !folder &&
      !drag.sourceElement.closest("[data-agent-folder-id]") &&
      row.parentElement !== drag.sourceElement.parentElement
    ) {
      clearDropFeedback(drag);
      return null;
    }
    const rect = row.getBoundingClientRect();
    const layout = row.parentElement ? getComputedStyle(row.parentElement) : null;
    const horizontal = layout?.display === "grid" || (layout?.display === "flex" && layout.flexDirection === "row");
    const offset = horizontal ? drag.lastX - (rect.left + rect.width / 2) : drag.lastY - (rect.top + rect.height / 2);
    const edge: InsertEdge =
      drag.feedbackElement === row && Math.abs(offset) < 12 && drag.insertEdge
        ? drag.insertEdge
        : offset < 0
          ? "before"
          : "after";
    if (drag.feedbackElement !== row || drag.insertEdge !== edge) {
      clearDropFeedback(drag);
      row.setAttribute("data-drag-insert", edge);
      row.setAttribute("data-drag-insert-axis", horizontal ? "x" : "y");
      drag.feedbackElement = row;
      drag.insertEdge = edge;
    }
    const visibleIds = getLibraryDragRows(drag.sourceElement, kind)
      .map((element) => element.dataset.dragId!)
      .filter(Boolean);
    return { target: row.dataset.dragId, edge, visibleIds: Array.from(new Set(visibleIds)) };
  }
  clearDropFeedback(drag);
  if (folder) {
    folder.setAttribute("data-drag-target", "inside");
    drag.feedbackElement = folder;
  }
  return null;
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
  getDragIds,
  onReorder,
  reorderHandlesDrop,
  onActivate,
  onDrop,
  onCancel,
}: TouchFolderDragOptions) {
  const { t } = useTranslation();
  const resolvedMoveActivateThresholdPx = moveActivateThresholdPx ?? DEFAULT_TOUCH_DRAG_ACTIVATE_THRESHOLD_PX;
  const dragRef = useRef<TouchFolderDragState | null>(null);
  const optionsRef = useRef({
    delayMs,
    moveActivateThresholdPx: resolvedMoveActivateThresholdPx,
    autoScrollEdgePx,
    autoScrollMaxSpeedPx,
    getDragIds,
    onReorder,
    reorderHandlesDrop,
    onActivate,
    onDrop,
    onCancel,
  });
  const removeListenersRef = useRef<(() => void) | null>(null);
  const releaseClickCleanupRef = useRef<(() => void) | null>(null);

  optionsRef.current = {
    delayMs,
    moveActivateThresholdPx: resolvedMoveActivateThresholdPx,
    autoScrollEdgePx,
    autoScrollMaxSpeedPx,
    getDragIds,
    onReorder,
    reorderHandlesDrop,
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
    if (edgePx <= 0 || drag.scrollTouch) return null;

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
    updateDropFeedback(drag, !!optionsRef.current.onReorder);
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
      drag.sourceElement.setAttribute("data-drag-source", "true");
      updateStackPreview(drag);
      if (drag.chatResourcePayload) {
        if (drag.touchIdentifier === null) beginChatResourceMouseDrag(drag.chatResourcePayload);
        else beginChatResourceTouchDrag(drag.chatResourcePayload, drag.touchIdentifier);
      }
      optionsRef.current.onActivate(drag.id);
      scheduleAutoScroll(drag);
    },
    [clearDragTimer, scheduleAutoScroll],
  );

  const restoreSourceElement = useCallback((drag: TouchFolderDragState) => {
    removePreviewElement(drag);
    drag.sourceElement.removeAttribute("data-drag-source");
    clearDropFeedback(drag);
    drag.stackedElements.forEach((element) => element.removeAttribute("data-drag-stacked"));
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
      const insertion = drop && drag.active ? updateDropFeedback(drag, !!optionsRef.current.onReorder) : null;
      clearDragTimer(drag);
      stopAutoScroll(drag);
      const insertionElement = insertion ? drag.feedbackElement : null;
      restoreSourceElement(drag);
      if (drag.active && drag.touchIdentifier === null) {
        // Escape can cancel before mouseup. Suppress that gesture's eventual release click,
        // while allowing a fresh pointer press or keyboard activation immediately.
        releaseClickCleanupRef.current?.();
        const suppressClick = (event: MouseEvent) => {
          if (event.detail === 0) return;
          event.preventDefault();
          event.stopPropagation();
        };
        const clear = () => {
          window.removeEventListener("click", suppressClick, { capture: true });
          window.removeEventListener("mousedown", clear, { capture: true });
          window.removeEventListener("mouseup", afterRelease, { capture: true });
          releaseClickCleanupRef.current = null;
        };
        const afterRelease = () => window.setTimeout(clear, 0);
        window.addEventListener("click", suppressClick, { capture: true });
        window.addEventListener("mousedown", clear, { capture: true, once: true });
        if (drop) afterRelease();
        else window.addEventListener("mouseup", afterRelease, { capture: true, once: true });
        releaseClickCleanupRef.current = clear;
      }
      dragRef.current = null;
      removeListeners();
      // The dock reads the payload in the capture phase, so it is safe to drop it here.
      if (drag.chatResourcePayload) clearActiveChatResourceDrag();

      if (drop && drag.active) {
        const options = optionsRef.current;
        const rect = insertionElement?.getBoundingClientRect();
        const x = rect ? rect.left + rect.width / 2 : drag.lastX;
        const y = rect ? rect.top + rect.height / 2 : drag.lastY;
        if (insertion && options.reorderHandlesDrop) {
          options.onReorder?.(drag.ids, insertion.target, insertion.edge, insertion.visibleIds);
          options.onCancel?.(drag.id, true);
        } else {
          options.onDrop(drag.id, x, y, drag.ids);
          if (insertion) options.onReorder?.(drag.ids, insertion.target, insertion.edge, insertion.visibleIds);
        }
      } else {
        optionsRef.current.onCancel?.(drag.id, drag.active);
      }
    },
    [clearDragTimer, removeListeners, restoreSourceElement, stopAutoScroll],
  );

  const handleTouchStart = useCallback(
    (event: TouchEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.touchIdentifier === null || drag.scrollTouch) return;
      const touch = Array.from(event.touches).find((touch) => touch.identifier !== drag.touchIdentifier);
      if (!touch) return;
      if (!drag.active) {
        cancelTouchDrag(false);
        return;
      }
      const target = document.elementFromPoint(touch.clientX, touch.clientY);
      const row = target?.closest<HTMLElement>("[data-drag-id]");
      const control = target?.closest(
        "button,a,input,textarea,select,[role='button'],[role='switch'],[contenteditable]:not([contenteditable='false'])",
      );
      let candidate: NonNullable<TouchFolderDragState["scrollTouch"]>["candidate"] = null;
      if (
        optionsRef.current.getDragIds &&
        row?.dataset.dragId &&
        row.dataset.dragKind === drag.sourceElement.dataset.dragKind &&
        (!control || control === row || control.hasAttribute("data-drag-surface"))
      ) {
        let payload: ChatResourceDragPayload | null = null;
        try {
          payload = parseChatResourceDragPayload(JSON.parse(row.dataset.dragPayload ?? "null"));
        } catch {
          /* Ignore malformed row metadata. */
        }
        if (!drag.chatResourcePayload || payload?.kind === drag.chatResourcePayload.kind) {
          candidate = { id: row.dataset.dragId, element: row, payload };
        }
      }
      drag.scrollTouch = {
        identifier: touch.identifier,
        lastY: touch.clientY,
        startX: touch.clientX,
        startY: touch.clientY,
        startedAt: performance.now(),
        moved: false,
        candidate,
      };
      stopAutoScroll(drag);
    },
    [cancelTouchDrag, stopAutoScroll],
  );

  const handleTouchMove = useCallback(
    (event: TouchEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const touch = Array.from(event.touches).find((touch) => touch.identifier === drag.touchIdentifier);
      if (!touch) return;
      if (!drag.active && drag.holdToActivate && !event.cancelable) {
        // The browser has already taken this gesture for native scrolling.
        cancelTouchDrag(false);
        return;
      }

      drag.lastX = touch.clientX;
      drag.lastY = touch.clientY;

      const movedX = touch.clientX - drag.startX;
      const movedY = touch.clientY - drag.startY;
      const moved = Math.hypot(movedX, movedY);

      if (!drag.active && moved > optionsRef.current.moveActivateThresholdPx) {
        if (drag.holdToActivate) {
          // A swipe before pickup belongs to the browser's normal scrolling gesture.
          cancelTouchDrag(false);
          return;
        }
        activateTouchDrag(drag);
      }

      if (drag.active) {
        if (event.cancelable) event.preventDefault();
        const scrollTouch = Array.from(event.touches).find(
          (touch) => touch.identifier === drag.scrollTouch?.identifier,
        );
        if (scrollTouch && drag.scrollTouch) {
          const finger = drag.scrollTouch;
          finger.moved ||=
            Math.hypot(scrollTouch.clientX - finger.startX, scrollTouch.clientY - finger.startY) >
            optionsRef.current.moveActivateThresholdPx;
          const deltaY = finger.lastY - scrollTouch.clientY;
          if (finger.moved) finger.lastY = scrollTouch.clientY;
          if (finger.moved && deltaY !== 0) {
            drag.scrollTargets.find((target) => target.canScroll(deltaY < 0 ? -1 : 1))?.scrollBy(deltaY);
          }
        }
        updatePreviewPosition(drag);
        updateDropFeedback(drag, !!optionsRef.current.onReorder);
        scheduleAutoScroll(drag);
      }
    },
    [activateTouchDrag, cancelTouchDrag, scheduleAutoScroll],
  );

  const handleTouchEnd = useCallback(
    (event: TouchEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      if (drag.active) {
        if (event.cancelable) event.preventDefault();
      }
      const touch = Array.from(event.changedTouches).find((touch) => touch.identifier === drag.touchIdentifier);
      if (!touch) {
        if (Array.from(event.changedTouches).some((touch) => touch.identifier === drag.scrollTouch?.identifier)) {
          const finger = drag.scrollTouch;
          const lifted = Array.from(event.changedTouches).find((touch) => touch.identifier === finger?.identifier);
          const candidate = finger?.candidate;
          if (
            finger &&
            lifted &&
            candidate &&
            !finger.moved &&
            performance.now() - finger.startedAt < 350 &&
            Math.hypot(lifted.clientX - finger.startX, lifted.clientY - finger.startY) <=
              optionsRef.current.moveActivateThresholdPx &&
            !drag.ids.includes(candidate.id) &&
            drag.ids.length < 100
          ) {
            drag.ids.push(candidate.id);
            candidate.element.setAttribute("data-drag-stacked", "true");
            drag.stackedElements.push(candidate.element);
            updateStackPreview(drag);
            if (drag.chatResourcePayload && candidate.payload?.kind === drag.chatResourcePayload.kind) {
              drag.chatResourcePayload = {
                ...drag.chatResourcePayload,
                ids: Array.from(new Set([...drag.chatResourcePayload.ids, ...candidate.payload.ids])),
                label: t("dragDrop.stackCount", { count: drag.ids.length }),
                ...(candidate.payload.unsupported ? { unsupported: candidate.payload.unsupported } : {}),
              };
              beginChatResourceTouchDrag(drag.chatResourcePayload, drag.touchIdentifier!);
            }
          }
          drag.scrollTouch = null;
          if (drag.active) scheduleAutoScroll(drag);
        }
        return;
      }
      drag.lastX = touch.clientX;
      drag.lastY = touch.clientY;
      cancelTouchDrag(true);
    },
    [cancelTouchDrag, scheduleAutoScroll, t],
  );

  const handleTouchCancel = useCallback(
    (event: TouchEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      if (
        !event.changedTouches ||
        Array.from(event.changedTouches).some((touch) => touch.identifier === drag.touchIdentifier)
      ) {
        cancelTouchDrag(false);
      } else if (Array.from(event.changedTouches).some((touch) => touch.identifier === drag.scrollTouch?.identifier)) {
        drag.scrollTouch = null;
        if (drag.active) scheduleAutoScroll(drag);
      }
    },
    [cancelTouchDrag, scheduleAutoScroll],
  );
  const handleContextMenu = useCallback((event: Event) => {
    const drag = dragRef.current;
    if (!drag) return;
    event.preventDefault();
  }, []);
  const handleInterruptedTouchDrag = useCallback(() => cancelTouchDrag(false), [cancelTouchDrag]);

  const handleMouseMove = useCallback(
    (event: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.touchIdentifier !== null) return;
      if (!(event.buttons & 1)) {
        cancelTouchDrag(false);
        return;
      }
      drag.lastX = event.clientX;
      drag.lastY = event.clientY;
      if (
        !drag.active &&
        Math.hypot(drag.lastX - drag.startX, drag.lastY - drag.startY) > optionsRef.current.moveActivateThresholdPx
      ) {
        activateTouchDrag(drag);
      }
      if (drag.active) {
        updatePreviewPosition(drag);
        updateDropFeedback(drag, !!optionsRef.current.onReorder);
        scheduleAutoScroll(drag);
      }
    },
    [activateTouchDrag, cancelTouchDrag, scheduleAutoScroll],
  );

  const handleMouseUp = useCallback(
    (event: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.touchIdentifier !== null || event.button !== 0) return;
      drag.lastX = event.clientX;
      drag.lastY = event.clientY;
      cancelTouchDrag(true);
    },
    [cancelTouchDrag],
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !dragRef.current) return;
      // Heard in the capture phase and marked handled, so a side panel's Escape-to-close leaves it alone.
      event.preventDefault();
      cancelTouchDrag(false);
    },
    [cancelTouchDrag],
  );

  const attachListeners = useCallback(() => {
    removeListeners();
    window.addEventListener("touchstart", handleTouchStart, { capture: true, passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", handleTouchEnd, { passive: false });
    window.addEventListener("touchcancel", handleTouchCancel, { passive: false });
    window.addEventListener("contextmenu", handleContextMenu, { capture: true });
    window.addEventListener("blur", handleInterruptedTouchDrag);
    window.addEventListener("pagehide", handleInterruptedTouchDrag);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("keydown", handleKeyDown, { capture: true });
    removeListenersRef.current = () => {
      window.removeEventListener("touchstart", handleTouchStart, { capture: true });
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("touchcancel", handleTouchCancel);
      window.removeEventListener("contextmenu", handleContextMenu, { capture: true });
      window.removeEventListener("blur", handleInterruptedTouchDrag);
      window.removeEventListener("pagehide", handleInterruptedTouchDrag);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
    };
  }, [
    handleContextMenu,
    handleInterruptedTouchDrag,
    handleMouseMove,
    handleMouseUp,
    handleKeyDown,
    handleTouchCancel,
    handleTouchEnd,
    handleTouchMove,
    handleTouchStart,
    removeListeners,
  ]);

  const startDrag = useCallback(
    (
      event: ReactTouchEvent<HTMLElement> | ReactMouseEvent<HTMLElement>,
      id: string,
      options?: StartTouchDragOptions,
    ) => {
      const touch = "touches" in event ? event.touches[0] : null;
      if (!("touches" in event) && event.button !== 0) return;
      const interactiveTarget =
        event.target instanceof Element
          ? event.target.closest(
              "button,a,input,textarea,select,[role='button'],[role='switch'],[contenteditable]:not([contenteditable='false'])",
            )
          : null;
      if (
        !options?.allowInteractiveTarget &&
        interactiveTarget &&
        interactiveTarget !== event.currentTarget &&
        !interactiveTarget.hasAttribute("data-folder-drag-handle") &&
        !interactiveTarget.hasAttribute("data-drag-surface")
      ) {
        return;
      }
      if ("touches" in event && dragRef.current?.active) return;
      if ("touches" in event && event.touches.length !== 1) return;
      // Native HTML dragging suppresses wheel events. Keep mouse drags in the same
      // preview/drop flow as touch so the list remains normally scrollable.
      if (!touch) event.preventDefault();
      cancelTouchDrag(false);
      attachListeners();

      const point = touch ?? (event as ReactMouseEvent<HTMLElement>);
      const sourceElement = options?.sourceElement ?? event.currentTarget;
      const previousDraggable = sourceElement.getAttribute("draggable");
      const previousTouchCallout = sourceElement.style.getPropertyValue(WEBKIT_TOUCH_CALLOUT_PROPERTY);
      const previousTouchAction = sourceElement.style.touchAction;
      const previousUserDrag = sourceElement.style.getPropertyValue(WEBKIT_USER_DRAG_PROPERTY);
      const previousUserSelect = sourceElement.style.userSelect;

      sourceElement.setAttribute("draggable", "false");
      sourceElement.style.setProperty(WEBKIT_TOUCH_CALLOUT_PROPERTY, "none");
      sourceElement.style.setProperty(WEBKIT_USER_DRAG_PROPERTY, "none");
      if (!touch || options?.allowInteractiveTarget) sourceElement.style.touchAction = TOUCH_DRAG_ACTIVE_TOUCH_ACTION;
      sourceElement.style.userSelect = "none";

      const drag: TouchFolderDragState = {
        id,
        ids: Array.from(new Set(optionsRef.current.getDragIds?.(id) ?? [id])),
        stackedElements: [],
        feedbackElement: null,
        insertEdge: null,
        timer: null,
        active: false,
        holdToActivate: !!touch && !options?.allowInteractiveTarget,
        sourceElement,
        previousDraggable,
        previousTouchCallout,
        previousTouchAction,
        previousUserDrag,
        previousUserSelect,
        previewElement: null,
        previewOffsetX: 0,
        previewOffsetY: 0,
        startX: point.clientX,
        startY: point.clientY,
        lastX: point.clientX,
        lastY: point.clientY,
        touchIdentifier: touch?.identifier ?? null,
        scrollTouch: null,
        scrollTargets: getAutoScrollTargets(sourceElement),
        autoScrollFrame: null,
        chatResourcePayload: options?.chatResourcePayload ?? null,
      };

      if (touch) {
        drag.timer = window.setTimeout(() => {
          activateTouchDrag(drag);
        }, optionsRef.current.delayMs);
      }

      dragRef.current = drag;
    },
    [activateTouchDrag, attachListeners, cancelTouchDrag],
  );

  useEffect(
    () => () => {
      releaseClickCleanupRef.current?.();
      removeListeners();
      const drag = dragRef.current;
      if (drag) {
        clearDragTimer(drag);
        stopAutoScroll(drag);
        restoreSourceElement(drag);
      }
      dragRef.current = null;
      if (drag?.chatResourcePayload) clearActiveChatResourceDrag();
    },
    [clearDragTimer, removeListeners, restoreSourceElement, stopAutoScroll],
  );

  return { startTouchDrag: startDrag, startMouseDrag: startDrag, cancelTouchDrag };
}
