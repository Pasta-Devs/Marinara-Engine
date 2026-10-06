// ──────────────────────────────────────────────
// Shared floating window: move, resize, pin, lock, close
//
// Every chat window (Chat Settings, popped-out drawers, the Trackers window, the
// chat's control windows) renders through this component so they behave and theme
// alike. A minimizable window shrinks to a small button (its bubble) the user can
// place anywhere; on a phone it shows as its bubble and opens as a sheet. Custom
// themes style the stable `mari-window…` classes, the data attributes and the
// `--mari-window-*` variables documented in globals.css.
// ──────────────────────────────────────────────
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type Ref,
} from "react";
import { Lock, Pin, Unlock, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "../../lib/utils";
import {
  PHONE_BUBBLE_SIZE_PX,
  RESIZE_EDGES,
  WINDOW_KEYBOARD_LARGE_STEP_PX,
  WINDOW_KEYBOARD_STEP_PX,
  WINDOW_BUBBLE_SIZE_PX,
  WINDOW_MARGIN_PX,
  clampWindowBubble,
  clampWindowGeometry,
  getPhoneBubbleSlot,
  moveWindowGeometry,
  placeWindowBesideBubble,
  resizeWindowGeometry,
  type FloatingWindowId,
  type WindowPoint,
  type ResizeEdge,
  type WindowBounds,
  type WindowGeometry,
  type WindowLayout,
} from "../../lib/floating-window-layout";
import { isModalOverlayOpen } from "../../lib/modal-overlay-registry";
import { CHAT_VISUAL_VIEWPORT_CHANGE_EVENT } from "../../hooks/use-visual-viewport-chat-bottom";
import { BUBBLE_SNAP_GAP_PX } from "../../lib/window-bubble-snap";
import { DrawerHostContext, type DrawerHost } from "./drawer-host";
import { WindowBubble } from "./WindowBubble";
import { useChatToolsMenuStore } from "../../stores/chat-tools-menu.store";
import {
  FLOATING_WINDOW_Z_BASE,
  PHONE_BUBBLE_Z_INDEX,
  isPhoneWindowLayout,
  takeFloatingWindowFocusRequest,
  takeFloatingWindowOpener,
  useFloatingWindowStore,
} from "../../stores/floating-window.store";

export type FloatingWindowCloseReason = "close-button" | "escape" | "outside-pointer";

export interface FloatingWindowProps {
  id: FloatingWindowId;
  title: ReactNode;
  titleIcon?: ReactNode;
  /** Rendered after the title, outside the heading (a help button, for example). */
  titleAccessory?: ReactNode;
  /** The window's own buttons in the title bar, before minimize, pin, lock and close (`mari-window__control`). */
  headerControls?: ReactNode;
  /** A title bar button just before close (a popped-out drawer's Put back). */
  closeAccessory?: ReactNode;
  closeLabel: string;
  /** Where the window opens before the user moves it, and where Reset View puts it back. */
  getDefaultLayout: (bounds: WindowBounds, bubbleSize: number) => WindowLayout;
  /** Changing this re-reads the default once the page has updated (a panel the default avoids opened, say). */
  defaultLayoutKey?: string;
  minWidth?: number;
  minHeight?: number;
  /** "sheet" is today's phone panel: no move, resize, pin or lock, and it closes on an outside press. */
  presentation?: "window" | "sheet";
  /** False: the window takes focus only when the user opens it, never just because focus is free. */
  autoFocus?: boolean;
  /**
   * Keeps a closed window mounted but out of sight, so drawers popped out of it (rendered from inside
   * it) stay open. Showing it again counts as opening it.
   */
  hidden?: boolean;
  /**
   * Drawers inside can pop out into their own windows, which copy this window's look. `title` names
   * this window on their close buttons; `scrollClassName` styles their scrolling body.
   */
  drawerHost?: { title: string; scrollClassName?: string };
  /**
   * The window can shrink to a small button you place anywhere (its bubble), showing `icon`; `label`
   * names it. Closing it, Escape and, while unpinned, a press elsewhere shrink it back too.
   * `getDefaultLayout` says whether it starts minimized and where its bubble starts. On a phone
   * ("sheet") it shows as its bubble until tapped and its sheet closes back to the bubble;
   * `getPhoneBubble` says where that bubble starts (the top of the right-edge column otherwise).
   * `bubbleBadge` is drawn on the bubble.
   */
  minimizable?: {
    icon: ReactNode;
    label: string;
    getPhoneBubble?: (bounds: WindowBounds, bubbleSize: number) => WindowPoint;
    bubbleBadge?: ReactNode;
    /** Collect this phone launcher in Chat tools; the window and its contents stay here. */
    phoneMenu?: boolean;
  };
  className?: string;
  sheetClassName?: string;
  sheetStyle?: CSSProperties;
  headerClassName?: string;
  titleClassName?: string;
  bodyClassName?: string;
  bodyRef?: Ref<HTMLDivElement>;
  rootAttributes?: Record<`data-${string}`, string | boolean | undefined>;
  /** Presses on these targets do not count as "outside" (portalled menus, related dialogs…). */
  ignoreOutsidePointer?: (target: Element) => boolean;
  /**
   * May resolve to `false` when a guard keeps the window open; focus then stays where it is. A
   * minimizable window minimizes instead and does not call it.
   */
  onRequestClose?: (reason: FloatingWindowCloseReason) => void | Promise<boolean>;
  /** Follows the pointer while the title bar is dragged; returning true at "end" keeps the window where it was. */
  onDragMove?: (point: { x: number; y: number }, phase: "move" | "end") => boolean | void;
  children: ReactNode;
}

/**
 * A phone sheet below the topbar, as tall as its content up to the screen. Content that scrolls itself
 * adds PHONE_FULL_SHEET_CLASS, which pins the bottom too, so it gets a bounded height to scroll in.
 */
export const PHONE_SHEET_CLASS =
  "fixed inset-x-2 top-[calc(3.5rem+env(safe-area-inset-top))] z-[70] max-h-[calc(100dvh-4.25rem-env(safe-area-inset-top)-var(--mari-safe-area-inset-bottom,env(safe-area-inset-bottom)))] overflow-hidden";
export const PHONE_FULL_SHEET_CLASS =
  "bottom-[calc(0.75rem+var(--mari-safe-area-inset-bottom,env(safe-area-inset-bottom)))]";

/**
 * The first free place for a new bubble: in the row of bubbles along the top, just left of the
 * rightmost run of them (the chat's control bubbles), a snapping gap away; otherwise the first free
 * spot along the top rows from the right edge. `except` is the bubble being placed.
 */
export function findFreeBubble(
  bounds: WindowBounds,
  { size, except }: { size: number; except?: FloatingWindowId },
): WindowPoint {
  const gap = BUBBLE_SNAP_GAP_PX;
  const placements = isPhoneWindowLayout()
    ? useFloatingWindowStore.getState().phoneBubbles
    : useFloatingWindowStore.getState().bubbles;
  const taken = Array.from(document.querySelectorAll<HTMLElement>(".mari-window-bubble"))
    .filter((element) => element.dataset.window !== except && element.getClientRects().length > 0)
    .map((element) => {
      const rect = element.getBoundingClientRect();
      const saved = placements[element.dataset.window ?? ""];
      if (!saved) return rect;
      // Earlier siblings may have reserved a slot in this layout effect before React paints it.
      const point = clampWindowBubble(saved, bounds, Math.max(rect.width, rect.height));
      return { left: point.x, top: point.y, right: point.x + rect.width, bottom: point.y + rect.height };
    });
  const free = (x: number, y: number) =>
    x >= bounds.left &&
    taken.every((rect) => rect.right <= x || rect.left >= x + size || rect.bottom <= y || rect.top >= y + size);
  const topRow = taken.filter((rect) => Math.abs(rect.top - bounds.top) <= 1);
  if (topRow.length > 0) {
    let x = Math.max(...topRow.map((rect) => rect.left)) - gap - size;
    while (x >= bounds.left && !free(x, bounds.top)) {
      const blocking = topRow.find((rect) => rect.left < x + size && rect.right > x);
      if (!blocking) break;
      x = blocking.left - gap - size;
    }
    if (free(x, bounds.top)) return { x, y: bounds.top };
  }
  for (let y = bounds.top; y + size <= bounds.bottom; y += size + gap) {
    for (let x = bounds.right - size; x >= bounds.left; x -= size + gap) {
      if (free(x, y)) return { x, y };
    }
  }
  return { x: bounds.right - size, y: bounds.top };
}

const DEFAULT_MIN_WIDTH = 320;
const DEFAULT_MIN_HEIGHT = 240;
const NO_DRAG_SELECTOR = "button, a, input, select, textarea, [contenteditable='true'], [data-window-no-drag]";
// Escape in a text field belongs to the field (many cancel an edit with it); anywhere else in the
// window it closes an unpinned window. Controls that use Escape themselves call preventDefault.
const KEEPS_ESCAPE_SELECTOR =
  "textarea, [contenteditable='true'], input:not([type='checkbox'], [type='radio'], [type='range'], [type='button'], [type='submit'], [type='reset'], [type='color'], [type='file'])";

const CENTER_CONTENT_SELECTOR = '[data-component="CenterContent"]';

/** A closed host may no longer have an opener; keep keyboard users in the active chat. */
export function focusWindowOpener(id: FloatingWindowId) {
  const candidates = [
    takeFloatingWindowOpener(id),
    document.querySelector<HTMLElement>(`[data-window-opener="${CSS.escape(id)}"]`),
    document.querySelector<HTMLElement>("[data-chat-settings-button]"),
    document.querySelector<HTMLElement>("textarea[data-chat-composer]"),
  ];
  candidates
    .find(
      (element) => element?.isConnected && element.getClientRects().length > 0 && !element.closest("[hidden], [inert]"),
    )
    ?.focus({ preventScroll: true });
}

/**
 * The chat area below the topbar, inside the viewport, minus the window margin. Windows stay over
 * the chat: they never cover their own topbar toggle or a docked sidebar, and follow the chat area
 * when a sidebar opens or the browser resizes.
 */
export function readFloatingWindowBounds(): WindowBounds {
  if (typeof window === "undefined") return { left: 0, top: 0, right: 1024, bottom: 768 };
  const topbar = document.querySelector<HTMLElement>('[data-component="TopBar"]');
  const area = document.querySelector<HTMLElement>(CENTER_CONTENT_SELECTOR)?.getBoundingClientRect();
  const composer = Array.from(document.querySelectorAll("[data-chat-mode] [data-chat-composer]"))
    .map((element) =>
      (
        element.closest(".chat-input-container") ??
        element.closest("[data-chat-resource-drop-exclude]") ??
        element
      ).getBoundingClientRect(),
    )
    .find((rect) => rect.width > 1 && rect.height > 1);
  return {
    left: Math.max(0, area?.left ?? 0) + WINDOW_MARGIN_PX,
    top: Math.max(0, topbar?.getBoundingClientRect().bottom ?? 0, area?.top ?? 0) + WINDOW_MARGIN_PX,
    right: Math.min(window.innerWidth, area?.right ?? window.innerWidth) - WINDOW_MARGIN_PX,
    bottom:
      Math.min(window.innerHeight, area?.bottom ?? window.innerHeight, composer?.top ?? Infinity) - WINDOW_MARGIN_PX,
  };
}

let safeAreaProbe: HTMLElement | null = null;

/** The device's safe-area insets (notch, home indicator), read through a hidden probe. */
function readSafeAreaInsets() {
  if (!safeAreaProbe?.isConnected) {
    safeAreaProbe = document.createElement("div");
    safeAreaProbe.setAttribute("aria-hidden", "true");
    safeAreaProbe.style.cssText =
      "position:fixed;top:0;left:0;width:0;height:0;visibility:hidden;pointer-events:none;" +
      "padding:env(safe-area-inset-top) env(safe-area-inset-right) " +
      "var(--mari-safe-area-inset-bottom,env(safe-area-inset-bottom)) env(safe-area-inset-left)";
    document.body.appendChild(safeAreaProbe);
  }
  const style = window.getComputedStyle(safeAreaProbe);
  const read = (value: string) => Number.parseFloat(value) || 0;
  return { right: read(style.paddingRight), bottom: read(style.paddingBottom), left: read(style.paddingLeft) };
}

/**
 * Where phone bubbles may sit: the chat below the topbar, inside the safe area, above the on-screen
 * keyboard and above the open chat's message box, so a bubble never covers it.
 */
export function readPhoneBubbleBounds(): WindowBounds {
  const base = readFloatingWindowBounds();
  const insets = readSafeAreaInsets();
  const viewport = window.visualViewport;
  const visibleBottom = viewport ? viewport.offsetTop + viewport.height : window.innerHeight;
  const composer = Array.from(document.querySelectorAll("[data-chat-mode] [data-chat-composer]"))
    .map((element) =>
      (
        element.closest(".chat-input-container") ??
        element.closest("[data-chat-resource-drop-exclude]") ??
        element
      ).getBoundingClientRect(),
    )
    .find((rect) => rect.width > 1 && rect.height > 1);
  return {
    left: Math.max(base.left, insets.left + WINDOW_MARGIN_PX),
    top: base.top,
    right: Math.min(base.right, window.innerWidth - insets.right - WINDOW_MARGIN_PX),
    bottom: Math.min(
      base.bottom,
      visibleBottom - insets.bottom - WINDOW_MARGIN_PX,
      composer ? composer.top - WINDOW_MARGIN_PX : Infinity,
    ),
  };
}

function sameBounds(left: WindowBounds, right: WindowBounds) {
  return (
    left.left === right.left && left.top === right.top && left.right === right.right && left.bottom === right.bottom
  );
}

/** Phone bubble bounds, kept current through rotation, the keyboard and the message box growing. */
export function usePhoneBubbleBounds(active: boolean): WindowBounds {
  return useLiveBounds(readPhoneBubbleBounds, active);
}

/** Where a computer's buttons may sit (the chat area below the topbar), kept current. */
export function useWindowBubbleBounds(active: boolean): WindowBounds {
  return useLiveBounds(readFloatingWindowBounds, active);
}

// Input can appear after Game controls or be replaced when the active chat changes.
// Observe those mounts only; streaming text and animated style attributes do not matter here.
function observeWindowBounds(update: () => void) {
  const resize = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
  const observed = new Set<Element>();
  const refresh = () => {
    for (const element of observed) {
      if (!element.isConnected) {
        resize?.unobserve(element);
        observed.delete(element);
      }
    }
    for (const element of document.querySelectorAll(
      `${CENTER_CONTENT_SELECTOR}, [data-component="TopBar"], [data-chat-mode] .chat-input-container, [data-chat-input-container]`,
    )) {
      if (observed.has(element)) continue;
      observed.add(element);
      resize?.observe(element);
    }
    update();
  };
  const containsComposer = (node: Node) =>
    node instanceof Element &&
    (node.matches("[data-chat-composer]") || node.querySelector("[data-chat-composer]") !== null);
  const mounts = new MutationObserver((records) => {
    if (records.some((record) => [...record.addedNodes, ...record.removedNodes].some(containsComposer))) refresh();
  });
  const area = document.querySelector(CENTER_CONTENT_SELECTOR);
  if (area) mounts.observe(area, { childList: true, subtree: true });
  refresh();
  return () => {
    mounts.disconnect();
    resize?.disconnect();
  };
}

function useLiveBounds(read: () => WindowBounds, active: boolean): WindowBounds {
  const [bounds, setBounds] = useState(() =>
    typeof window === "undefined" ? { left: 0, top: 0, right: 390, bottom: 844 } : read(),
  );
  const readRef = useRef(read);
  readRef.current = read;
  useEffect(() => {
    if (!active) return;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const next = readRef.current();
        setBounds((current) => (sameBounds(current, next) ? current : next));
      });
    };
    const viewport = window.visualViewport;
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    window.addEventListener(CHAT_VISUAL_VIEWPORT_CHANGE_EVENT, update);
    viewport?.addEventListener("resize", update);
    viewport?.addEventListener("scroll", update);
    const stopObserving = observeWindowBounds(update);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
      window.removeEventListener(CHAT_VISUAL_VIEWPORT_CHANGE_EVENT, update);
      viewport?.removeEventListener("resize", update);
      viewport?.removeEventListener("scroll", update);
      stopObserving();
    };
  }, [active]);
  return bounds;
}

function sameGeometry(left: WindowGeometry, right: WindowGeometry) {
  return left.x === right.x && left.y === right.y && left.width === right.width && left.height === right.height;
}

type PointerSession = {
  pointerId: number;
  startX: number;
  startY: number;
  start: WindowGeometry;
  edge: ResizeEdge | null;
};

export function FloatingWindow({
  id,
  title,
  titleIcon,
  titleAccessory,
  headerControls,
  closeAccessory,
  closeLabel,
  getDefaultLayout,
  defaultLayoutKey,
  minWidth = DEFAULT_MIN_WIDTH,
  minHeight = DEFAULT_MIN_HEIGHT,
  presentation = "window",
  autoFocus = true,
  hidden = false,
  drawerHost,
  minimizable,
  className,
  sheetClassName,
  sheetStyle,
  headerClassName,
  titleClassName,
  bodyClassName,
  bodyRef,
  rootAttributes,
  ignoreOutsidePointer,
  onRequestClose,
  onDragMove,
  children,
}: FloatingWindowProps) {
  const { t } = useTranslation();
  const titleId = `mari-window-title-${useId().replace(/:/gu, "")}`;
  const rootRef = useRef<HTMLDivElement | null>(null);
  const sheet = presentation === "sheet";
  const savedLayout = useFloatingWindowStore((state) => state.layouts[id]);
  const savedDesktopBubble = useFloatingWindowStore((state) => state.bubbles[id]);
  const resetRevision = useFloatingWindowStore((state) => state.resetRevision);
  const stackIndex = useFloatingWindowStore((state) => state.stack.indexOf(id));
  const saveLayout = useFloatingWindowStore((state) => state.saveLayout);
  const bringToFront = useFloatingWindowStore((state) => state.bringToFront);
  const bounds = useLiveBounds(
    () => (window.innerWidth < 768 ? readPhoneBubbleBounds() : readFloatingWindowBounds()),
    !sheet,
  );
  const [liveGeometry, setLiveGeometry] = useState<WindowGeometry | null>(null);
  const pointerSessionRef = useRef<PointerSession | null>(null);
  const frameRef = useRef(0);
  const restoreFocusOnUnmountRef = useRef(false);
  const getDefaultLayoutRef = useRef(getDefaultLayout);
  getDefaultLayoutRef.current = getDefaultLayout;
  const onRequestCloseRef = useRef(onRequestClose);
  onRequestCloseRef.current = onRequestClose;
  const ignoreOutsidePointerRef = useRef(ignoreOutsidePointer);
  ignoreOutsidePointerRef.current = ignoreOutsidePointer;
  const onDragMoveRef = useRef(onDragMove);
  onDragMoveRef.current = onDragMove;
  const bubbleRef = useRef<HTMLButtonElement | null>(null);
  const focusBubbleRef = useRef(false);
  // A phone shows a minimizable window as its bubble, and as a sheet while it is open.
  const phoneBubble = sheet && !!minimizable;
  const phoneMenu = phoneBubble && minimizable?.phoneMenu === true;
  const openInStore = useFloatingWindowStore((state) => state.open[id] === true);
  const savedPhoneBubble = useFloatingWindowStore((state) => state.phoneBubbles[id]);
  const phoneBounds = usePhoneBubbleBounds(phoneBubble);
  const [bubbleSize, setBubbleSize] = useState(phoneBubble ? PHONE_BUBBLE_SIZE_PX : WINDOW_BUBBLE_SIZE_PX);
  const menuIcon = minimizable?.icon;
  const menuLabel = minimizable?.label;
  const menuBadge = minimizable?.bubbleBadge;
  useLayoutEffect(() => {
    if (!phoneMenu || hidden || !menuLabel) return;
    return useChatToolsMenuStore.getState().register({ id, label: menuLabel, icon: menuIcon, badge: menuBadge });
  }, [hidden, id, menuBadge, menuIcon, menuLabel, phoneMenu]);

  const limits = useMemo(() => ({ minWidth, minHeight }), [minHeight, minWidth]);
  // On a phone a popped-out drawer becomes a bubble, so sheets host drawers too.
  const hostTitle = drawerHost?.title;
  const hostScrollClassName = drawerHost?.scrollClassName;
  const drawerHostValue = useMemo<DrawerHost | null>(
    () =>
      hostTitle === undefined
        ? null
        : {
            id,
            title: hostTitle,
            windowClassName: className,
            headerClassName,
            titleClassName,
            scrollClassName: hostScrollClassName,
            rootAttributes,
            ignoreOutsidePointer,
          },
    [
      className,
      headerClassName,
      hostScrollClassName,
      hostTitle,
      id,
      ignoreOutsidePointer,
      rootAttributes,
      titleClassName,
    ],
  );
  // Bumped after a defaultLayoutKey change has rendered, so the default reads the updated page.
  const [defaultRevision, setDefaultRevision] = useState(0);
  const defaultLayoutKeyRef = useRef(defaultLayoutKey);
  useEffect(() => {
    if (defaultLayoutKeyRef.current === defaultLayoutKey) return;
    defaultLayoutKeyRef.current = defaultLayoutKey;
    setDefaultRevision((revision) => revision + 1);
  }, [defaultLayoutKey]);
  // The default follows the viewport and Reset View until the user changes the window.
  const defaultLayout = useMemo(
    () => getDefaultLayoutRef.current(bounds, bubbleSize),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the revisions recompute the default on purpose
    [bounds, bubbleSize, resetRevision, defaultRevision, openInStore],
  );
  const layout = savedLayout ?? defaultLayout;
  const pinned = !sheet && layout.pinned;
  const locked = layout.locked;
  const geometry = clampWindowGeometry(liveGeometry ?? layout, bounds, limits);
  const canMinimize = !!minimizable && !sheet;
  const minimized = canMinimize ? layout.minimized === true : phoneBubble && !openInStore;
  const bubblePoint = savedDesktopBubble ??
    savedLayout?.bubble ?? {
      ...(defaultLayout.bubble ?? { x: bounds.right - bubbleSize, y: bounds.top }),
      automatic: true as const,
    };

  // A phone bubble with no saved place and no default (a popped-out drawer) takes the first free spot.
  const needsPhonePlace =
    phoneBubble && !phoneMenu && minimized && !hidden && !savedPhoneBubble && !minimizable?.getPhoneBubble;
  useLayoutEffect(() => {
    if (!needsPhonePlace) return;
    useFloatingWindowStore.getState().savePhoneBubble(id, {
      ...findFreeBubble(readPhoneBubbleBounds(), { size: bubbleSize, except: id }),
      automatic: true,
    });
  }, [bubbleSize, id, needsPhonePlace]);

  // Drawers migrated from old toolbar buttons have no saved window geometry yet.
  const needsDesktopPlace = canMinimize && minimized && !hidden && !savedDesktopBubble && !layout.bubble;
  useLayoutEffect(() => {
    if (!needsDesktopPlace) return;
    useFloatingWindowStore
      .getState()
      .saveBubble(id, { ...findFreeBubble(bounds, { size: bubbleSize, except: id }), automatic: true });
  }, [bounds, bubbleSize, id, needsDesktopPlace]);

  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const minimizeRef = useRef<(focusBubble: boolean) => void>(() => {});
  minimizeRef.current = (focusBubble) => {
    restoreFocusOnUnmountRef.current = false;
    focusBubbleRef.current = focusBubble;
    const current = layoutRef.current;
    // A window with no bubble place of its own (a popped-out drawer) gets one beside the other bubbles.
    const bubble =
      current.bubble ?? (defaultLayout.bubble ? undefined : findFreeBubble(bounds, { size: bubbleSize, except: id }));
    saveLayout(id, { ...current, minimized: true, ...(bubble ? { bubble } : {}) });
    useFloatingWindowStore.getState().closeWindow(id);
  };

  const requestClose = useCallback(
    (reason: FloatingWindowCloseReason) => {
      // A minimizable window goes back to its bubble; focus follows it unless the user pressed elsewhere.
      if (canMinimize) {
        minimizeRef.current(reason !== "outside-pointer");
        return;
      }
      if (phoneBubble) {
        focusBubbleRef.current = reason !== "outside-pointer";
        useFloatingWindowStore.getState().closeWindow(id);
        return;
      }
      restoreFocusOnUnmountRef.current = reason !== "outside-pointer";
      const result = onRequestCloseRef.current?.(reason);
      void result?.then((closed) => {
        // A guard kept the window open, so a later unmount must not move focus.
        if (!closed) restoreFocusOnUnmountRef.current = false;
      });
    },
    [canMinimize, id, phoneBubble],
  );

  // The window opens where it was last left; its bubble's place is its own.
  const restoreFromBubble = (bubble: HTMLButtonElement) => {
    const rect = bubble.getBoundingClientRect();
    const initialGeometry = savedLayout
      ? savedLayout
      : placeWindowBesideBubble(
          layoutRef.current,
          { x: rect.left, y: rect.top },
          readFloatingWindowBounds(),
          limits,
          rect.height,
        );
    saveLayout(id, { ...layoutRef.current, ...initialGeometry, minimized: false });
    useFloatingWindowStore.getState().openWindow(id, bubble);
  };

  // Focus moves into the window when it opens and back to its opener when it closes. A remount (a
  // chat switch, or the loading placeholder giving way) only takes focus if nothing else has it.
  // Hiding and showing a kept-mounted window count as closing and opening it.
  useEffect(() => {
    if (hidden || minimized) return;
    restoreFocusOnUnmountRef.current = false;
    const requested = takeFloatingWindowFocusRequest(id);
    const focusIsFree = !document.activeElement || document.activeElement === document.body;
    if ((requested && (!sheet || phoneMenu)) || (!sheet && autoFocus && focusIsFree)) {
      rootRef.current?.focus({ preventScroll: true });
    }
    return () => {
      // A placeholder swapped for the real window unmounts without a close request and keeps the opener.
      if (!restoreFocusOnUnmountRef.current) return;
      focusWindowOpener(id);
    };
    // Mount and unmount only; switching presentation keeps focus where it is.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, hidden, minimized]);

  // A restored minimizable window stacks with the others; a minimized one hands focus to its bubble.
  useEffect(() => {
    if ((!canMinimize && !phoneBubble) || hidden) return;
    if (!minimized) {
      if (canMinimize && !useFloatingWindowStore.getState().stack.includes(id)) {
        useFloatingWindowStore.getState().openWindow(id, null, { focus: false });
      }
      return;
    }
    if (!focusBubbleRef.current) return;
    focusBubbleRef.current = false;
    if (phoneMenu) focusWindowOpener(id);
    else bubbleRef.current?.focus({ preventScroll: true });
  }, [canMinimize, hidden, id, minimized, phoneBubble, phoneMenu]);

  // An unpinned window closes when the user presses anywhere else.
  useEffect(() => {
    if (pinned || hidden || minimized) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (rootRef.current?.contains(target)) return;
      // The window's own toggle closes it on click; closing here too would let that click reopen it.
      if (target.closest(`[data-window-opener="${id}"]`)) return;
      if (target.closest(".mari-window, [data-chat-help-overlay], [role='dialog'][aria-modal='true']")) return;
      if (ignoreOutsidePointerRef.current?.(target)) return;
      requestClose("outside-pointer");
    };
    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => document.removeEventListener("pointerdown", handlePointerDown, true);
  }, [id, pinned, hidden, minimized, requestClose]);

  useEffect(() => () => cancelAnimationFrame(frameRef.current), []);

  // Drag and keyboard pass geometry that is already clamped. Pin and lock keep the saved geometry, so a
  // window squeezed by a small viewport still returns to its place when the viewport grows again.
  const commitLayout = useCallback(
    (patch: Partial<WindowLayout>) => saveLayout(id, { ...layout, ...patch }),
    [id, layout, saveLayout],
  );

  const beginPointerSession = (event: ReactPointerEvent<HTMLElement>, edge: ResizeEdge | null) => {
    if (sheet || locked || event.button !== 0 || pointerSessionRef.current) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    pointerSessionRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      start: geometry,
      edge,
    };
  };

  const updatePointerSession = (event: ReactPointerEvent<HTMLElement>) => {
    const session = pointerSessionRef.current;
    if (!session || session.pointerId !== event.pointerId) return;
    const dx = event.clientX - session.startX;
    const dy = event.clientY - session.startY;
    const next = session.edge
      ? resizeWindowGeometry(session.start, session.edge, dx, dy, bounds, limits)
      : moveWindowGeometry(session.start, dx, dy, bounds, limits);
    if (!session.edge) onDragMoveRef.current?.({ x: event.clientX, y: event.clientY }, "move");
    cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(() => setLiveGeometry(next));
  };

  const endPointerSession = (event: ReactPointerEvent<HTMLElement>) => {
    const session = pointerSessionRef.current;
    if (!session || session.pointerId !== event.pointerId) return;
    pointerSessionRef.current = null;
    cancelAnimationFrame(frameRef.current);
    const dx = event.clientX - session.startX;
    const dy = event.clientY - session.startY;
    const next = session.edge
      ? resizeWindowGeometry(session.start, session.edge, dx, dy, bounds, limits)
      : moveWindowGeometry(session.start, dx, dy, bounds, limits);
    setLiveGeometry(null);
    if (!session.edge && onDragMoveRef.current?.({ x: event.clientX, y: event.clientY }, "end") === true) return;
    if (!sameGeometry(next, session.start)) commitLayout(next);
  };

  const handleHeaderPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.target instanceof Element && event.target.closest(NO_DRAG_SELECTOR)) return;
    beginPointerSession(event, null);
  };

  const readArrowDelta = (event: ReactKeyboardEvent<HTMLElement>) => {
    const step = event.shiftKey ? WINDOW_KEYBOARD_LARGE_STEP_PX : WINDOW_KEYBOARD_STEP_PX;
    if (event.key === "ArrowLeft") return { dx: -step, dy: 0 };
    if (event.key === "ArrowRight") return { dx: step, dy: 0 };
    if (event.key === "ArrowUp") return { dx: 0, dy: -step };
    if (event.key === "ArrowDown") return { dx: 0, dy: step };
    return null;
  };

  const handleHeaderKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget || locked || sheet) return;
    const delta = readArrowDelta(event);
    if (!delta) return;
    // Handled keys stop here, so chat-wide arrow shortcuts (swipes, history) skip them.
    event.preventDefault();
    commitLayout(moveWindowGeometry(geometry, delta.dx, delta.dy, bounds, limits));
  };

  const handleResizeKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (locked || sheet) return;
    const delta = readArrowDelta(event);
    if (!delta) return;
    event.preventDefault();
    commitLayout(resizeWindowGeometry(geometry, "se", delta.dx, delta.dy, bounds, limits));
  };

  const handleRootKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Escape" || event.defaultPrevented || event.nativeEvent.isComposing) return;
    const target = event.target;
    // Portalled dialogs bubble through this component in React; only presses inside the window count.
    if (!(target instanceof Element) || !rootRef.current?.contains(target)) return;
    if (pinned || target.closest(KEEPS_ESCAPE_SELECTOR) || isModalOverlayOpen()) return;
    // Menus inside the window close on Escape through document listeners, which run after this one.
    // Wait until the press has reached them all, and close only if none of them claimed it.
    const pressed = event.nativeEvent;
    window.setTimeout(() => {
      if (!pressed.defaultPrevented) requestClose("escape");
    }, 0);
  };

  const minimizedBubble =
    minimized && minimizable && !hidden && !phoneMenu ? (
      phoneBubble ? (
        <WindowBubble
          buttonRef={bubbleRef}
          id={id}
          point={
            savedPhoneBubble ?? {
              ...(minimizable.getPhoneBubble?.(phoneBounds, bubbleSize) ??
                getPhoneBubbleSlot(phoneBounds, 0, bubbleSize)),
              automatic: true,
            }
          }
          bounds={phoneBounds}
          size={PHONE_BUBBLE_SIZE_PX}
          onSizeChange={setBubbleSize}
          icon={minimizable.icon}
          label={minimizable.label}
          locked={layout.locked}
          zIndex={PHONE_BUBBLE_Z_INDEX}
          attributes={{ ...rootAttributes, "data-presentation": "sheet" }}
          onMove={(point) => useFloatingWindowStore.getState().savePhoneBubble(id, point)}
          onOpen={(bubble) => useFloatingWindowStore.getState().openWindow(id, bubble)}
        >
          {minimizable.bubbleBadge}
        </WindowBubble>
      ) : (
        <WindowBubble
          buttonRef={bubbleRef}
          id={id}
          point={bubblePoint}
          bounds={bounds}
          onSizeChange={setBubbleSize}
          icon={minimizable.icon}
          label={minimizable.label}
          locked={layout.locked}
          zIndex={FLOATING_WINDOW_Z_BASE}
          attributes={rootAttributes}
          onMove={(point) => useFloatingWindowStore.getState().saveBubble(id, point)}
          onOpen={restoreFromBubble}
        >
          {minimizable.bubbleBadge}
        </WindowBubble>
      )
    ) : null;
  if (minimized && minimizable && !hidden && !drawerHost) return minimizedBubble;

  const rootStyle: CSSProperties | undefined = sheet
    ? sheetStyle
    : {
        left: geometry.x,
        top: geometry.y,
        width: geometry.width,
        height: geometry.height,
        zIndex: FLOATING_WINDOW_Z_BASE + 1 + Math.max(0, stackIndex),
      };

  return (
    <>
      {minimizedBubble}
      <div
        ref={rootRef}
        role="dialog"
        aria-modal="false"
        aria-labelledby={titleId}
        tabIndex={-1}
        hidden={hidden || minimized}
        data-window={id}
        data-pinned={pinned ? "true" : "false"}
        data-locked={locked ? "true" : "false"}
        data-detached="false"
        data-presentation={presentation}
        data-no-intuitive-swipe
        {...rootAttributes}
        className={cn("mari-window flex min-h-0 flex-col outline-none", className, sheet ? sheetClassName : "fixed")}
        style={rootStyle}
        onPointerDownCapture={() => bringToFront(id)}
        onFocusCapture={() => bringToFront(id)}
        onKeyDown={handleRootKeyDown}
      >
        <div
          className={cn(
            "mari-window__header flex shrink-0 items-center justify-between gap-2",
            !sheet && !locked && "cursor-grab touch-none select-none active:cursor-grabbing",
            headerClassName,
          )}
          role={sheet || locked ? undefined : "group"}
          tabIndex={sheet || locked ? undefined : 0}
          aria-label={sheet || locked ? undefined : t("window.controls.move")}
          onPointerDown={handleHeaderPointerDown}
          onPointerMove={updatePointerSession}
          onPointerUp={endPointerSession}
          onPointerCancel={endPointerSession}
          onKeyDown={handleHeaderKeyDown}
        >
          <span className="mari-window__title-row flex min-w-0 items-center gap-1.5">
            {titleIcon}
            <h2 id={titleId} className={cn("mari-window__title truncate", titleClassName)}>
              {title}
            </h2>
            {titleAccessory}
          </span>
          <div className="mari-window__controls flex shrink-0 items-center">
            {headerControls}
            {!sheet && (
              <button
                type="button"
                data-window-control="pin"
                aria-pressed={pinned}
                aria-label={t("window.controls.pin")}
                title={t(pinned ? "window.controls.unpinHint" : "window.controls.pinHint")}
                className="mari-window__control"
                onClick={() => commitLayout({ pinned: !pinned })}
              >
                <Pin size="0.875rem" fill={pinned ? "currentColor" : "none"} />
              </button>
            )}
            <button
              type="button"
              data-window-control="lock"
              aria-pressed={locked}
              aria-label={t("window.controls.lock")}
              title={t(locked ? "window.controls.unlockHint" : "window.controls.lockHint")}
              className="mari-window__control"
              onClick={() => commitLayout({ locked: !locked })}
            >
              {locked ? <Lock size="0.875rem" /> : <Unlock size="0.875rem" />}
            </button>
            {closeAccessory}
            <button
              type="button"
              data-window-control="close"
              aria-label={closeLabel}
              title={closeLabel}
              className="mari-window__control"
              onClick={() => requestClose("close-button")}
            >
              <X size="1rem" />
            </button>
          </div>
        </div>
        <div ref={bodyRef} className={cn("mari-window__body flex min-h-0 flex-1 flex-col", bodyClassName)}>
          {drawerHost ? (
            <DrawerHostContext.Provider value={drawerHostValue}>{children}</DrawerHostContext.Provider>
          ) : (
            children
          )}
        </div>
        {!sheet &&
          !locked &&
          RESIZE_EDGES.map((edge) =>
            edge === "se" ? (
              <button
                key={edge}
                type="button"
                data-edge={edge}
                aria-label={t("window.controls.resize")}
                className="mari-window__resize-handle"
                onPointerDown={(event) => beginPointerSession(event, edge)}
                onPointerMove={updatePointerSession}
                onPointerUp={endPointerSession}
                onPointerCancel={endPointerSession}
                onKeyDown={handleResizeKeyDown}
              >
                {/* Shown while the pointer or focus is in the window: a cue that it resizes from here. */}
                <span aria-hidden="true" className="mari-window__resize-grip" />
              </button>
            ) : (
              <div
                key={edge}
                data-edge={edge}
                aria-hidden="true"
                className="mari-window__resize-handle"
                onPointerDown={(event) => beginPointerSession(event, edge)}
                onPointerMove={updatePointerSession}
                onPointerUp={endPointerSession}
                onPointerCancel={endPointerSession}
              />
            ),
          )}
      </div>
    </>
  );
}
