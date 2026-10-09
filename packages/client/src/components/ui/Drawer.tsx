// ──────────────────────────────────────────────
// Shared collapsible drawer (the Chat Settings section look)
//
// Custom themes style the stable `mari-drawer…` classes, `data-drawer` /
// `data-detached` and the `--mari-drawer-*` variables documented in globals.css.
// Inside a drawer host (drawer-host.ts) a drawer with an id can pop out into its
// own window, with its button or by dragging its header out of the host. On a phone
// it pops out into a bubble the user places anywhere, which opens it as a sheet.
// ──────────────────────────────────────────────
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { ChevronDown, ExternalLink, Undo2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "../../lib/utils";
import {
  clampWindowGeometry,
  getDrawerWindowId,
  placeDetachedDrawer,
  type FloatingWindowId,
  type WindowBounds,
  type WindowGeometry,
  type WindowLayout,
} from "../../lib/floating-window-layout";
import { isPhoneWindowLayout, PHONE_LAYOUT_QUERY, useFloatingWindowStore } from "../../stores/floating-window.store";
import { useMatchMedia } from "../../hooks/use-match-media";
import { FloatingWindow, focusWindowOpener, PHONE_SHEET_CLASS, readFloatingWindowBounds } from "./FloatingWindow";
import { HelpTooltip } from "./HelpTooltip";
import { useDrawerHost, type DrawerHost } from "./drawer-host";

export interface DrawerProps {
  /** Stable id, exposed as `data-drawer` for themes and tests. Inside a drawer host it also enables pop-out. */
  id?: string;
  title: ReactNode;
  icon?: ReactNode;
  count?: number;
  help?: string;
  /** Shown beside the title while the drawer is closed (a tracker's miniature display). */
  summary?: ReactNode;
  /** Shown on the bubble of its popped-out window, instead of its icon, while that window is minimized. */
  banner?: ReactNode;
  /** Extra controls between the help tip and the arrow, before the pop-out button. */
  actions?: ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** A chat control keeps its existing window id and content owner when leaving its docked section. */
  onPopOut?: (layout: WindowLayout) => void;
  /** Forces the detached look; a drawer inside a host follows its popped-out state by itself. */
  detached?: boolean;
  className?: string;
  style?: CSSProperties;
  /** Top spacing of the body; defaults to "pt-3". */
  bodyClassName?: string;
  rootAttributes?: Record<`data-${string}`, string | undefined>;
  children: ReactNode;
}

const DETACHED_LIMITS = { minWidth: 240, minHeight: 160 };
const DRAG_THRESHOLD_PX = 6;
// Roughly the popped-out window's title bar, so the window opens with its title under the pointer.
const WINDOW_HEADER_PX = 40;
const NO_DRAG_SELECTOR = "button, a, input, select, textarea, [contenteditable='true']";

function toGeometry(rect: DOMRect): WindowGeometry {
  return { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
}

/** A popped-out window keeps about the drawer's width and, when it was open, its height. */
function readDetachedSize(drawer: DOMRect, open: boolean, bounds: WindowBounds) {
  const remPx = Number.parseFloat(window.getComputedStyle(document.documentElement).fontSize) || 16;
  const maxHeight = Math.min(32 * remPx, bounds.bottom - bounds.top);
  return {
    width: Math.min(Math.max(drawer.width, 18 * remPx), 28 * remPx),
    height: open ? Math.min(Math.max(drawer.height + WINDOW_HEADER_PX, 14 * remPx), maxHeight) : 22 * remPx,
  };
}

function popOutLayout(geometry: WindowGeometry): WindowLayout {
  // Start unpinned; users can pin the detached window to keep it open elsewhere.
  return { ...geometry, pinned: false, locked: false };
}

/** Detached drawers render their body even when their original section is collapsed. */
export function useDrawerContentVisible(id: string, open: boolean): boolean {
  const host = useDrawerHost();
  const windowId = host ? getDrawerWindowId(host.id, id) : null;
  const detached = useFloatingWindowStore((state) => (windowId ? state.detached[windowId] === true : false));
  return open || detached;
}

export function Drawer({
  id,
  title,
  icon,
  count,
  help,
  summary,
  banner,
  actions,
  open,
  onOpenChange,
  onPopOut,
  detached = false,
  className,
  style,
  bodyClassName,
  rootAttributes,
  children,
}: DrawerProps) {
  const { t } = useTranslation();
  const bodyId = `mari-drawer-body-${useId().replace(/:/gu, "")}`;
  const host = useDrawerHost();
  const windowId = onPopOut ? (id ?? null) : host && id ? getDrawerWindowId(host.id, id) : null;
  const poppedOut = useFloatingWindowStore((state) =>
    windowId && !onPopOut ? state.detached[windowId] === true : false,
  );
  const rootRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; offsetX: number; active: boolean }>(null);
  const suppressClickRef = useRef(false);
  const [ghost, setGhost] = useState<{ x: number; y: number; outside: boolean; container: Element } | null>(null);

  if (poppedOut && host && windowId && id) {
    return (
      <DetachedDrawerWindow
        host={host}
        windowId={windowId}
        drawerId={id}
        title={title}
        icon={icon}
        banner={banner}
        help={help}
        className={className}
        bodyClassName={bodyClassName}
        rootAttributes={rootAttributes}
      >
        {children}
      </DetachedDrawerWindow>
    );
  }

  const titleText = typeof title === "string" ? title : t("drawer.popOut.section");
  const readHostWindow = () => rootRef.current?.closest<HTMLElement>(".mari-window") ?? null;
  const isOutsideHost = (x: number, y: number) => {
    const rect = readHostWindow()?.getBoundingClientRect();
    return !!rect && (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom);
  };

  const popOut = (
    place: (drawer: DOMRect, size: { width: number; height: number }, bounds: WindowBounds) => WindowGeometry,
  ) => {
    const drawer = rootRef.current?.getBoundingClientRect();
    if (!windowId || !drawer) return;
    const bounds = readFloatingWindowBounds();
    const geometry = place(drawer, readDetachedSize(drawer, open, bounds), bounds);
    if (onPopOut) {
      onPopOut(popOutLayout(geometry));
      return;
    }
    const windows = useFloatingWindowStore.getState();
    const phone = isPhoneWindowLayout();
    windows.detachDrawer(windowId, popOutLayout(geometry), { focus: !phone });
    if (phone) {
      // On a phone it becomes a bubble, and the sheet covering the chat closes so the bubble shows.
      windows.closeWindow(windowId);
      if (host) windows.dismissWindow(host.id, { force: true });
    }
  };

  const handlePopOutClick = () =>
    popOut((drawer, size, bounds) => {
      const hostRect = readHostWindow()?.getBoundingClientRect();
      return placeDetachedDrawer(
        toGeometry(drawer),
        hostRect ? toGeometry(hostRect) : null,
        size,
        bounds,
        DETACHED_LIMITS,
        Array.from(document.querySelectorAll<HTMLElement>('.mari-window[data-detached="true"]'))
          .filter((element) => !element.hidden && element.getClientRects().length > 0)
          .map((element) => toGeometry(element.getBoundingClientRect())),
      );
    });

  // Drag-out: past the host window's edge, the drop point becomes the new window's title bar.
  const handleHeaderPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!windowId || event.button !== 0 || event.pointerType === "touch") return;
    if (
      event.target instanceof Element &&
      event.target.closest(NO_DRAG_SELECTOR) &&
      !event.target.closest("[data-drawer-toggle]")
    )
      return;
    const header = event.currentTarget.getBoundingClientRect();
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      offsetX: event.clientX - header.left,
      active: false,
    };
  };

  const handleHeaderPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    // The button came up somewhere this header did not hear about.
    if ((event.buttons & 1) === 0) {
      handleHeaderPointerCancel();
      return;
    }
    if (!drag.active) {
      if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < DRAG_THRESHOLD_PX) return;
      drag.active = true;
      event.currentTarget.setPointerCapture?.(event.pointerId);
    }
    setGhost({
      x: event.clientX - drag.offsetX,
      y: event.clientY,
      outside: isOutsideHost(event.clientX, event.clientY),
      // Beside the host window, so the preview takes the chat's theme as the window will.
      container: readHostWindow()?.parentElement ?? document.body,
    });
  };

  const handleHeaderPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (!drag.active) return;
    setGhost(null);
    // The click that ends a drag must not also open or close the drawer.
    suppressClickRef.current = true;
    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 0);
    if (!isOutsideHost(event.clientX, event.clientY)) return;
    popOut((_drawer, size, bounds) =>
      clampWindowGeometry(
        {
          x: event.clientX - Math.min(drag.offsetX, size.width - WINDOW_HEADER_PX),
          y: event.clientY - WINDOW_HEADER_PX / 2,
          ...size,
        },
        bounds,
        DETACHED_LIMITS,
      ),
    );
  };

  const handleHeaderPointerCancel = () => {
    dragRef.current = null;
    setGhost(null);
  };

  const handleHeaderClick = () => {
    if (suppressClickRef.current) return;
    onOpenChange(!open);
  };

  return (
    <div
      ref={rootRef}
      data-drawer={id}
      data-detached={detached ? "true" : "false"}
      data-dragging={ghost ? "true" : undefined}
      {...rootAttributes}
      className={cn("mari-drawer", className)}
      style={style}
    >
      <div
        onClick={handleHeaderClick}
        onPointerDown={handleHeaderPointerDown}
        onPointerMove={handleHeaderPointerMove}
        onPointerUp={handleHeaderPointerUp}
        onPointerCancel={handleHeaderPointerCancel}
        className={cn(
          "mari-drawer__header flex w-full items-center gap-2 text-left transition-colors",
          windowId && "select-none",
        )}
      >
        <button
          type="button"
          role="button"
          data-drawer-toggle
          aria-expanded={open}
          aria-controls={open ? bodyId : undefined}
          className="flex min-w-0 flex-1 items-center gap-2 text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--marinara-chat-chrome-focus-ring)]"
        >
          {icon && <span className="mari-drawer__icon">{icon}</span>}
          <span className="mari-drawer__title flex-1 text-xs font-semibold">{title}</span>
        </button>
        {summary && !open && <span className="mari-drawer__summary flex shrink-0 items-center">{summary}</span>}
        {count != null && count > 0 && (
          <span className="mari-drawer__count rounded-full px-1.5 py-0.5 text-[0.625rem] font-medium">{count}</span>
        )}
        {help && (
          <span className="mari-drawer__help" onClick={(event) => event.stopPropagation()}>
            <HelpTooltip text={help} side="left" />
          </span>
        )}
        {(actions || windowId) && (
          <span className="mari-drawer__actions flex items-center" onClick={(event) => event.stopPropagation()}>
            {actions}
            {windowId && (
              <button
                type="button"
                data-drawer-control="pop-out"
                data-window-opener={windowId}
                aria-label={t("drawer.popOut.label", { title: titleText })}
                title={t("drawer.popOut.hint")}
                className="mari-drawer__popout inline-flex h-5 w-5 items-center max-md:-my-2 max-md:h-11 max-md:w-11 justify-center rounded-md text-[var(--mari-drawer-icon-color,var(--muted-foreground))] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--marinara-chat-chrome-focus-ring)]"
                onClick={handlePopOutClick}
              >
                <ExternalLink size="0.75rem" />
              </button>
            )}
          </span>
        )}
        <ChevronDown size="0.75rem" className={cn("mari-drawer__arrow transition-transform", open && "rotate-180")} />
      </div>
      {open && (
        <div id={bodyId} className={cn("mari-drawer__body", bodyClassName ?? "pt-3")}>
          {children}
        </div>
      )}
      {ghost &&
        createPortal(
          <div
            aria-hidden="true"
            data-outside={ghost.outside ? "true" : "false"}
            className="mari-drawer-ghost pointer-events-none fixed z-[9500] flex max-w-72 items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold"
            style={{ left: ghost.x, top: ghost.y - WINDOW_HEADER_PX / 2 }}
          >
            {icon && <span className="mari-drawer__icon">{icon}</span>}
            <span className="truncate">{title}</span>
          </div>,
          ghost.container,
        )}
    </div>
  );
}

interface DetachedDrawerWindowProps {
  host: DrawerHost;
  windowId: FloatingWindowId;
  drawerId: string;
  title: ReactNode;
  icon?: ReactNode;
  banner?: ReactNode;
  help?: string;
  className?: string;
  bodyClassName?: string;
  rootAttributes?: Record<`data-${string}`, string | undefined>;
  children: ReactNode;
}

function getDetachedFallbackLayout(bounds: WindowBounds): WindowLayout {
  return { ...popOutLayout({ x: bounds.left, y: bounds.top, width: 352, height: 352 }), minimized: true };
}

/** The visible host window, while it can take a drawer back. */
function readDockTarget(hostId: FloatingWindowId) {
  const element = document.querySelector<HTMLElement>(`.mari-window[data-window="${CSS.escape(hostId)}"]`);
  return element && !element.hidden && element.getClientRects().length > 0 ? element : null;
}

/**
 * A popped-out drawer: its body in its own window, rendered from where the drawer was (so it keeps its
 * state and context) into the host window's container (so it keeps the chat's theme). Closing it, Escape
 * or (unpinned) a press elsewhere shrinks it to a bubble showing the drawer's icon (or banner), which reopens it
 * where it was left. Only Put back (beside its X), dropping it on the host window and Reset View return
 * it to its host. On a phone the window is a sheet and the bubble keeps a phone place of its own.
 */
function DetachedDrawerWindow({
  host,
  windowId,
  drawerId,
  title,
  icon,
  banner,
  help,
  className,
  bodyClassName,
  rootAttributes,
  children,
}: DetachedDrawerWindowProps) {
  const { t } = useTranslation();
  const anchorRef = useRef<HTMLSpanElement | null>(null);
  const [container, setContainer] = useState<Element | null>(null);
  const phone = useMatchMedia(PHONE_LAYOUT_QUERY);

  useLayoutEffect(() => {
    setContainer(anchorRef.current?.closest(".mari-window")?.parentElement ?? document.body);
  }, []);

  // FloatingWindow keeps a shown window in the stacking order; leaving (a chat switch) takes it out.
  useEffect(() => () => useFloatingWindowStore.getState().closeWindow(windowId), [windowId]);

  const dock = () => useFloatingWindowStore.getState().dockDrawer(windowId);
  // Put back: the drawer returns to its host, and focus to its pop-out button there.
  const putBack = () => {
    dock();
    requestAnimationFrame(() => focusWindowOpener(windowId));
  };

  const handleDragMove = (point: { x: number; y: number }, phase: "move" | "end") => {
    const target = readDockTarget(host.id);
    const rect = target?.getBoundingClientRect();
    const over =
      !!rect && point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom;
    if (phase === "move") {
      if (over) target?.setAttribute("data-drop-target", "true");
      else target?.removeAttribute("data-drop-target");
      return;
    }
    target?.removeAttribute("data-drop-target");
    if (!over) return;
    dock();
    return true;
  };

  return (
    <>
      <span ref={anchorRef} hidden data-drawer-anchor={drawerId} />
      {container &&
        createPortal(
          <FloatingWindow
            id={windowId}
            title={title}
            titleIcon={icon ? <span className="mari-drawer__icon flex shrink-0">{icon}</span> : undefined}
            titleAccessory={help ? <HelpTooltip text={help} side="bottom" /> : undefined}
            closeLabel={t("window.controls.close")}
            closeAccessory={
              <button
                type="button"
                data-window-control="put-back"
                aria-label={t("drawer.popOut.close", { host: host.title })}
                title={t("drawer.popOut.close", { host: host.title })}
                className="mari-window__control"
                onClick={putBack}
              >
                <Undo2 size="0.875rem" />
              </button>
            }
            presentation={phone ? "sheet" : "window"}
            sheetClassName={PHONE_SHEET_CLASS}
            // The bubble shows the drawer's own icon (or banner) and is named after it.
            minimizable={{
              icon: icon ?? <ExternalLink size="0.875rem" />,
              banner,
              label: typeof title === "string" ? title : t("drawer.popOut.section"),
              phoneMenu: host.id === "chat-settings",
            }}
            getDefaultLayout={getDetachedFallbackLayout}
            minWidth={DETACHED_LIMITS.minWidth}
            minHeight={DETACHED_LIMITS.minHeight}
            autoFocus={false}
            className={host.windowClassName}
            headerClassName={host.headerClassName}
            titleClassName={host.titleClassName}
            rootAttributes={{ ...host.rootAttributes, "data-detached": "true", "data-drawer-host": host.id }}
            ignoreOutsidePointer={host.ignoreOutsidePointer}
            onRequestClose={dock}
            onDragMove={handleDragMove}
          >
            <div
              className={cn("flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain", host.scrollClassName)}
            >
              <div
                data-drawer={drawerId}
                data-detached="true"
                {...rootAttributes}
                className={cn("mari-drawer", className)}
              >
                <div className={cn("mari-drawer__body", bodyClassName ?? "pt-3")}>{children}</div>
              </div>
            </div>
          </FloatingWindow>,
          container,
        )}
    </>
  );
}
