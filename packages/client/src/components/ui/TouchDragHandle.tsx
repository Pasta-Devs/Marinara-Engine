import type { TouchEvent } from "react";
import { GripVertical } from "lucide-react";
import { cn } from "../../lib/utils";

type TouchDragHandleProps = {
  label?: string;
  size?: string;
  className?: string;
  onTouchStart: (event: TouchEvent<HTMLButtonElement>) => void;
};

export function TouchDragHandle({
  label = "Drag to move",
  size = "0.8125rem",
  className,
  onTouchStart,
}: TouchDragHandleProps) {
  return (
    <button
      type="button"
      aria-hidden="true"
      tabIndex={-1}
      title={label}
      className={cn(
        // Touch-only affordance: native HTML5 drag does not fire on touch, so this
        // handle drives the custom touch-drag path. Gate on pointer type, not viewport
        // width — a width gate (md:hidden) hid it on touch devices ≥768px (tablets),
        // leaving them with no way to drag. Mouse/fine-pointer devices use native row drag.
        "mari-chrome-accent-text-muted mari-accent-animated flex h-8 w-6 shrink-0 cursor-grab touch-none items-center justify-center rounded-md opacity-100 transition-all hover:bg-[var(--marinara-chat-chrome-highlight-bg)] hover:text-[var(--marinara-chat-chrome-button-text-hover)] active:cursor-grabbing active:scale-95 [@media(pointer:fine)]:hidden",
        className,
      )}
      onClick={(event) => event.stopPropagation()}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      onTouchStart={(event) => {
        if (event.cancelable) event.preventDefault();
        event.stopPropagation();
        onTouchStart(event);
      }}
    >
      <GripVertical size={size} />
    </button>
  );
}
