import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../../lib/utils";
import { useTranslation as useUiTranslation } from "react-i18next";

const SWIPE_BUTTON_CLASS =
  "inline-flex min-h-8 min-w-8 items-center justify-center rounded-md p-[0.25em] transition-colors hover:bg-[var(--marinara-chat-message-action-bg-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-chat-chrome-focus-ring)] disabled:opacity-30 max-md:min-h-[44px] max-md:min-w-[44px]";

interface SwipeJumpControlProps {
  messageId: string;
  activeSwipeIndex: number;
  swipeCount: number;
  alwaysShow?: boolean;
  onSetActiveSwipe: (index: number) => void;
  onCreateNextSwipe?: () => void;
  className?: string;
}

export function SwipeJumpControl({
  messageId,
  activeSwipeIndex,
  swipeCount,
  alwaysShow = false,
  onSetActiveSwipe,
  onCreateNextSwipe,
  className,
}: SwipeJumpControlProps) {
  const { t: localizeUi } = useUiTranslation();
  const [inputValue, setInputValue] = useState(() => String(activeSwipeIndex + 1));

  useEffect(() => {
    setInputValue(String(activeSwipeIndex + 1));
  }, [activeSwipeIndex]);

  if (swipeCount <= 1 && !alwaysShow) return null;

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
    <div
      className={cn(
        "mari-message-swipes flex items-center gap-1.5 px-1 text-[0.75rem] text-[var(--marinara-chat-message-action-text)]",
        className,
      )}
    >
      <button
        type="button"
        className={SWIPE_BUTTON_CLASS}
        onClick={(event) => {
          event.stopPropagation();
          setSwipeByDisplayIndex(activeSwipeIndex);
        }}
        disabled={activeSwipeIndex <= 0}
        aria-label={localizeUi("ui.chat.swipejumpcontrol.previousSwipe")}
        title={localizeUi("ui.chat.swipejumpcontrol.previousSwipe")}
      >
        <ChevronLeft size="1.15em" />
      </button>
      <label className="sr-only" htmlFor={inputId}>
        {localizeUi("ui.chat.swipejumpcontrol.jumpToSwipe")}
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
        className="h-[1.375rem] w-9 rounded-full border border-[var(--marinara-chat-message-action-bg-hover)] bg-[color-mix(in_srgb,var(--marinara-chat-chrome-text)_5%,transparent)] px-1.5 py-0.5 text-center tabular-nums text-[0.625rem] font-medium text-[var(--marinara-chat-message-action-text-hover)] outline-none transition-[background-color,border-color,box-shadow,color] focus:border-[var(--marinara-chat-chrome-button-border-active)] focus:bg-[var(--marinara-chat-chrome-button-bg-active)]"
        aria-label={localizeUi("ui.chat.swipejumpcontrol.jumpToSwipe1ThroughValue1", { value1: displaySwipeCount })}
        title={localizeUi("ui.chat.swipejumpcontrol.jumpToSwipe1Value1", { value1: displaySwipeCount })}
      />
      <span className="tabular-nums">/{displaySwipeCount}</span>
      <button
        type="button"
        className={SWIPE_BUTTON_CLASS}
        onClick={(event) => {
          event.stopPropagation();
          if (hasNextSwipe) {
            setSwipeByDisplayIndex(activeSwipeIndex + 2);
            return;
          }
          onCreateNextSwipe?.();
        }}
        disabled={!hasNextSwipe && !canCreateNextSwipe}
        aria-label={
          hasNextSwipe
            ? localizeUi("ui.chat.swipejumpcontrol.nextSwipe")
            : localizeUi("ui.chat.swipejumpcontrol.generateNextSwipe")
        }
        title={
          hasNextSwipe
            ? localizeUi("ui.chat.swipejumpcontrol.nextSwipe")
            : localizeUi("ui.chat.swipejumpcontrol.generateNextSwipe")
        }
      >
        <ChevronRight size="1.15em" />
      </button>
    </div>
  );
}
