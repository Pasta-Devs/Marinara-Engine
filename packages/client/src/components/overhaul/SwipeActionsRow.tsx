// ──────────────────────────────────────────────
// UI overhaul, touch screens: swipe a list row left to reveal its actions
//
// A narrow tray of buttons (Pin, Rename, Delete for chats) slides in over the
// row's trailing end, so the avatar and the start of the name stay readable.
// Swiping right, tapping the row, tapping anywhere else or scrolling closes it.
// Only one row is open at a time; the list owns which one.
// ──────────────────────────────────────────────
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import { cn } from "../../lib/utils";
import { useHorizontalSwipe } from "./use-horizontal-swipe";

export type SwipeAction = {
  key: string;
  label: string;
  icon: ReactNode;
  tone?: "danger";
  onSelect: () => void;
};

/** Width of one action button; the tray is this times the number of actions. */
const ACTION_WIDTH_PX = 52;

export function SwipeActionsRow({
  enabled,
  open,
  onOpenChange,
  actions,
  children,
}: {
  enabled: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actions: SwipeAction[];
  children: ReactNode;
}) {
  const trayWidth = ACTION_WIDTH_PX * actions.length;
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState(false);
  // How far the tray is pulled in while a finger drags it (null = resting on the open/closed state).
  const [pull, setPull] = useState<number | null>(null);
  const swipe = useHorizontalSwipe({
    enabled,
    follow: false,
    maxFollow: trayWidth,
    restOffset: open ? -trayWidth : 0,
    canSwipe: (direction) => (direction === "left" ? !open : open),
    onSwipe: (direction) => onOpenChange(direction === "left"),
    onDragChange: setDragging,
    onDrag: (offset) => setPull(offset === null ? null : Math.max(0, Math.min(trayWidth, -offset))),
  });

  // An open tray closes on any touch outside its row, and when the list scrolls.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return;
      onOpenChange(false);
    };
    const onScroll = (event: Event) => {
      if (event.target instanceof Node && rootRef.current?.contains(event.target)) return;
      onOpenChange(false);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open, onOpenChange]);

  if (!enabled) return <>{children}</>;
  const shown = pull ?? (open ? trayWidth : 0);
  return (
    <div
      ref={rootRef}
      className="ovm-swiperow"
      data-open={open ? "true" : undefined}
      data-dragging={dragging ? "true" : undefined}
      style={
        {
          "--ovm-swiperow-tray": `${trayWidth}px`,
          "--ovm-swiperow-shown": `${shown}px`,
        } as CSSProperties
      }
    >
      <div
        className="ovm-swiperow__slide"
        {...swipe}
        onClickCapture={(event) => {
          (swipe as { onClickCapture?: (event: ReactMouseEvent<HTMLElement>) => void }).onClickCapture?.(event);
          if (event.isPropagationStopped() || !open) return;
          // A tap on an open row closes it instead of opening the chat.
          event.preventDefault();
          event.stopPropagation();
          onOpenChange(false);
        }}
      >
        {children}
      </div>
      <div className="ovm-swiperow__tray" aria-hidden={!open}>
        {actions.map((action) => (
          <button
            key={action.key}
            type="button"
            tabIndex={open ? 0 : -1}
            aria-label={action.label}
            className={cn("ovm-swiperow__action", action.tone === "danger" && "is-danger")}
            onClick={(event) => {
              event.stopPropagation();
              onOpenChange(false);
              action.onSelect();
            }}
          >
            {action.icon}
            <span>{action.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
