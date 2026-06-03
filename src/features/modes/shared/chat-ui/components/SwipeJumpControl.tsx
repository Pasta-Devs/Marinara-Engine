import { useEffect, useId, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../../../../../shared/lib/utils";

interface SwipeJumpControlProps {
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
  activeSwipeIndex,
  swipeCount,
  onSetActiveSwipe,
  onCreateNextSwipe,
  className,
  buttonClassName,
  inputClassName,
  iconSize = "0.75rem",
}: SwipeJumpControlProps) {
  const inputId = useId();
  const [inputValue, setInputValue] = useState(() => String(activeSwipeIndex + 1));

  useEffect(() => {
    setInputValue(String(activeSwipeIndex + 1));
  }, [activeSwipeIndex]);

  if (swipeCount <= 1) return null;

  const setActiveIndex = (index: number) => {
    const nextIndex = Math.min(Math.max(index, 0), swipeCount - 1);
    setInputValue(String(nextIndex + 1));
    if (nextIndex !== activeSwipeIndex) {
      onSetActiveSwipe(nextIndex);
    }
  };
  const setSwipeByDisplayIndex = (displayIndex: number) => {
    if (!Number.isFinite(displayIndex)) return;
    setActiveIndex(displayIndex - 1);
  };
  const parseDisplayIndex = (value: string) => (/^\d+$/.test(value) ? Number.parseInt(value, 10) : Number.NaN);
  const handleInputChange = (value: string) => {
    setInputValue(value);
    const displayIndex = parseDisplayIndex(value);
    if (Number.isNaN(displayIndex) || displayIndex < 1 || displayIndex > swipeCount) return;
    setSwipeByDisplayIndex(displayIndex);
  };
  const isLastSwipe = activeSwipeIndex >= swipeCount - 1;
  const canCreateNextSwipe = Boolean(onCreateNextSwipe);

  return (
    <div className={cn("mari-message-swipes flex items-center gap-1.5", className)}>
      <button
        type="button"
        className={buttonClassName}
        onClick={(event) => {
          event.stopPropagation();
          setActiveIndex(activeSwipeIndex - 1);
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
        min={1}
        max={swipeCount}
        inputMode="numeric"
        pattern="[0-9]*"
        value={inputValue}
        onChange={(event) => handleInputChange(event.target.value)}
        onBlur={() => setSwipeByDisplayIndex(parseDisplayIndex(inputValue) || activeSwipeIndex + 1)}
        onClick={(event) => event.stopPropagation()}
        onFocus={(event) => event.currentTarget.select()}
        onKeyDown={(event) => event.stopPropagation()}
        className={cn(
          "h-[1.625rem] w-[3.25rem] rounded border border-[var(--border)] bg-[var(--background)]/70 px-1 text-center text-[0.75rem] tabular-nums outline-none transition-colors focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]/40",
          inputClassName,
        )}
        aria-label={`Jump to swipe, 1 through ${swipeCount}`}
        title={`Jump to swipe 1-${swipeCount}`}
      />
      <span className="tabular-nums" aria-hidden="true">
        /{swipeCount}
      </span>
      <span className="sr-only" aria-live="polite">
        Swipe {activeSwipeIndex + 1} of {swipeCount}
      </span>
      <button
        type="button"
        className={buttonClassName}
        onClick={(event) => {
          event.stopPropagation();
          if (isLastSwipe) {
            onCreateNextSwipe?.();
            return;
          }
          setActiveIndex(activeSwipeIndex + 1);
        }}
        disabled={isLastSwipe && !canCreateNextSwipe}
        aria-label={isLastSwipe && canCreateNextSwipe ? "Generate next swipe" : "Next swipe"}
        title={isLastSwipe && canCreateNextSwipe ? "Generate next swipe" : "Next swipe"}
      >
        <ChevronRight size={iconSize} />
      </button>
    </div>
  );
}
