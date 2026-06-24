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
        "mari-chrome-accent-text-muted mari-accent-animated flex h-8 w-6 shrink-0 cursor-grab touch-none items-center justify-center rounded-md opacity-100 transition-all hover:bg-[var(--marinara-chat-chrome-highlight-bg)] hover:text-[var(--marinara-chat-chrome-button-text-hover)] active:cursor-grabbing active:scale-95 md:hidden",
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
