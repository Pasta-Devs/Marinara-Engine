import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../../lib/utils";

interface SwipeJumpControlProps {
  messageId: string;
  activeSwipeIndex: number;
  swipeCount: number;
  onSetActiveSwipe: (index: number) => void;
  onCreateNextSwipe?: () => void;
  className?: string;
  buttonClassName?: string;
  inputClassName?: string;
  iconSize?: string;
}

export function SwipeJumpControl({
  messageId,
  activeSwipeIndex,
  swipeCount,
  onSetActiveSwipe,
  onCreateNextSwipe,
  className,
  buttonClassName,
  inputClassName,
  iconSize = "0.75rem",
}: SwipeJumpControlProps) {
  const [inputValue, setInputValue] = useState(() => String(activeSwipeIndex + 1));

  useEffect(() => {
    setInputValue(String(activeSwipeIndex + 1));
  }, [activeSwipeIndex]);

  if (swipeCount <= 1 && !onCreateNextSwipe) return null;

  const inputId = `swipe-jump-${messageId}`;
  const displaySwipeCount = Math.max(1, swipeCount);
  const hasNextSwipe = activeSwipeIndex < displaySwipeCount - 1;
  const canCreateNextSwipe = !hasNextSwipe && Boolean(onCreateNextSwipe);

  const setSwipeByDisplayIndex = (displayIndex: number) => {
    const nextIndex = Math.min(Math.max(displayIndex, 1), displaySwipeCount) - 1;
    setInputValue(String(nextIndex + 1));
    if (nextIndex !== activeSwipeIndex) {
      onSetActiveSwipe(nextIndex);
    }
  };

  const handleInputChange = (value: string) => {
    if (!/^\d*$/.test(value)) return;
    setInputValue(value);
    if (value === "") return;
    const displayIndex = Number.parseInt(value, 10);
    if (Number.isNaN(displayIndex) || displayIndex < 1 || displayIndex > displaySwipeCount) return;
    setSwipeByDisplayIndex(displayIndex);
  };

  return (
    <div className={cn("mari-message-swipes flex items-center gap-1.5", className)}>
      <button
        type="button"
        className={buttonClassName}
        onClick={(event) => {
          event.stopPropagation();
          setSwipeByDisplayIndex(activeSwipeIndex);
        }}
        disabled={activeSwipeIndex <= 0}
        aria-label="Previous swipe"
        title="Previous swipe"
      >
        <ChevronLeft size={iconSize} />
      </button>
      <label className="sr-only" htmlFor={inputId}>
        Jump to swipe
      </label>
      <input
        id={inputId}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={inputValue}
        onChange={(event) => handleInputChange(event.target.value)}
        onBlur={() => {
          const parsed = Number.parseInt(inputValue, 10);
          setSwipeByDisplayIndex(Number.isNaN(parsed) ? activeSwipeIndex + 1 : parsed);
        }}
        onClick={(event) => event.stopPropagation()}
        onFocus={(event) => event.currentTarget.select()}
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.key === "Enter") event.currentTarget.blur();
        }}
        className={cn(
          "h-[1.375rem] w-9 rounded-full border border-transparent bg-[var(--marinara-chat-chrome-highlight-bg)] px-1.5 py-0.5 text-center tabular-nums text-[0.625rem] font-medium text-[var(--marinara-chat-chrome-panel-muted)] outline-none transition-[background-color,border-color,box-shadow,color] focus:border-[var(--marinara-chat-chrome-button-border-active)] focus:bg-[var(--marinara-chat-chrome-button-bg-active)]",
          inputClassName,
        )}
        aria-label={`Jump to swipe, 1 through ${displaySwipeCount}`}
        title={`Jump to swipe 1-${displaySwipeCount}`}
      />
      <span className="tabular-nums">/{displaySwipeCount}</span>
      <button
        type="button"
        className={buttonClassName}
        onClick={(event) => {
          event.stopPropagation();
          if (hasNextSwipe) {
            setSwipeByDisplayIndex(activeSwipeIndex + 2);
            return;
          }
          onCreateNextSwipe?.();
        }}
        disabled={!hasNextSwipe && !canCreateNextSwipe}
        aria-label={hasNextSwipe ? "Next swipe" : "Generate next swipe"}
        title={hasNextSwipe ? "Next swipe" : "Generate next swipe"}
      >
        <ChevronRight size={iconSize} />
      </button>
    </div>
  );
}
