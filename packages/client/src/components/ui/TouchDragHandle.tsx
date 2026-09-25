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
      data-folder-drag-handle
      aria-hidden="true"
      tabIndex={-1}
      title={label}
      className={cn(
        // Coarse pointers need the handle visible for custom touch dragging; mouse users
        // get the same hover-revealed affordance as the chat list.
        "mari-chrome-accent-text-muted mari-accent-animated flex h-8 w-6 shrink-0 cursor-grab touch-none items-center justify-center rounded-md opacity-100 transition-all hover:bg-[var(--marinara-chat-chrome-highlight-bg)] hover:text-[var(--marinara-chat-chrome-button-text-hover)] active:cursor-grabbing active:scale-95 [@media(pointer:fine)]:h-7 [@media(pointer:fine)]:w-5 [@media(pointer:fine)]:opacity-0 [@media(pointer:fine)]:group-focus-within:opacity-100 [@media(pointer:fine)]:group-hover:opacity-100",
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
