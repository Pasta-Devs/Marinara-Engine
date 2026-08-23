import type { ReactNode, Ref } from "react";
import { cn } from "../../lib/utils";

export const MESSAGE_ACTION_ICON_SIZE = "1em";

export function MessageActionButton({
  icon,
  onClick,
  title,
  className,
  disabled,
  ariaPressed,
  thinkingAction,
  tabIndex,
  buttonRef,
  stopPropagation,
}: {
  icon: ReactNode;
  onClick: () => void;
  title: string;
  className?: string;
  disabled?: boolean;
  ariaPressed?: boolean;
  thinkingAction?: boolean;
  tabIndex?: number;
  buttonRef?: Ref<HTMLButtonElement>;
  stopPropagation?: boolean;
}) {
  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={(event) => {
        if (stopPropagation) event.stopPropagation();
        onClick();
      }}
      title={title}
      aria-label={title}
      aria-pressed={ariaPressed}
      data-message-thinking-action={thinkingAction || undefined}
      disabled={disabled}
      tabIndex={tabIndex}
      className={cn(
        "inline-flex h-[1.7em] w-[1.7em] shrink-0 items-center justify-center rounded-md p-0 text-[0.8125rem] leading-none transition-all active:scale-90 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-30",
        "text-[var(--marinara-chat-message-action-text)] hover:bg-[var(--marinara-chat-message-action-bg-hover)] hover:text-[var(--marinara-chat-message-action-text-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-chat-chrome-focus-ring)]",
        className,
      )}
    >
      {icon}
    </button>
  );
}
