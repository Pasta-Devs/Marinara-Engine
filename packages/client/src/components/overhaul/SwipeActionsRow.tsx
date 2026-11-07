// ──────────────────────────────────────────────
// UI overhaul, phones: swipe a list row left to reveal its actions
//
// The row slides over a tray of buttons (Pin, Rename, Delete for chats).
// Swiping right, or tapping the row while open, slides it back. Only one row
// is open at a time; the list owns which one.
// ──────────────────────────────────────────────
import { useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
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
const ACTION_WIDTH_PX = 64;

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
  const [dragging, setDragging] = useState(false);
  const swipe = useHorizontalSwipe({
    enabled,
    maxFollow: trayWidth,
    restOffset: open ? -trayWidth : 0,
    canSwipe: (direction) => (direction === "left" ? !open : open),
    onSwipe: (direction) => onOpenChange(direction === "left"),
    onDragChange: setDragging,
  });
  if (!enabled) return <>{children}</>;
  return (
    <div
      className="ovm-swiperow"
      data-open={open ? "true" : undefined}
      data-dragging={dragging ? "true" : undefined}
      style={{ "--ovm-swiperow-tray": `${trayWidth}px` } as CSSProperties}
    >
      <div className="ovm-swiperow__tray" aria-hidden={!open}>
        {actions.map((action) => (
          <button
            key={action.key}
            type="button"
            tabIndex={open ? 0 : -1}
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
    </div>
  );
}
