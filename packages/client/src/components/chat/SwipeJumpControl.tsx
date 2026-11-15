import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../../lib/utils";
import { SwipePicker } from "./SwipePicker";
import { useTranslation as useUiTranslation } from "react-i18next";

const SWIPE_BUTTON_CLASS =
  "mari-chat-style-control inline-flex min-h-8 min-w-8 items-center justify-center rounded-md p-[0.25em] transition-colors hover:bg-[var(--marinara-chat-message-action-bg-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-chat-chrome-focus-ring)] disabled:opacity-30 max-md:min-h-[44px] max-md:min-w-[44px]";

// The list button is the right end of the number capsule; the invisible ::after keeps a phone-sized tap target.
const LIST_BUTTON_CLASS =
  "relative flex h-full items-center rounded-r-full px-1.5 text-[var(--marinara-chat-message-action-text)] transition-colors hover:bg-[var(--marinara-chat-message-action-bg-hover)] hover:text-[var(--marinara-chat-message-action-text-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-chat-chrome-focus-ring)] after:absolute after:inset-x-0 after:-inset-y-2.5 after:content-['']";

interface SwipeJumpControlProps {
  messageId: string;
  activeSwipeIndex: number;
  swipeCount: number;
  alwaysShow?: boolean;
  onSetActiveSwipe: (index: number) => void | Promise<boolean | undefined>;
  onCreateNextSwipe?: () => void;
  className?: string;
  /** When set, the counter becomes a list of the swipes; `greeting` marks the chat's first message. */
  picker?: { chatId: string; content: string; greeting: boolean };
}

export function SwipeJumpControl({
  messageId,
  activeSwipeIndex,
  swipeCount,
  alwaysShow = false,
  onSetActiveSwipe,
  onCreateNextSwipe,
  className,
  picker,
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
  };

  return (
    <div
      className={cn(
        "mari-message-swipes mari-chat-style-text flex items-center gap-1.5 px-1 text-[0.75rem] text-[var(--marinara-chat-message-action-text)]",
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
      <span className="mari-swipe-input mari-chat-style-control inline-flex h-[1.375rem] min-w-9 items-center rounded-full border border-transparent bg-[color-mix(in_srgb,var(--marinara-chat-chrome-text)_3.5%,transparent)] transition-[background-color,border-color,box-shadow,color] focus-within:border-[var(--marinara-chat-chrome-button-border-active)] focus-within:bg-[var(--marinara-chat-chrome-button-bg-active)]">
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
          // Sized to the typed number, so the total sits right after it inside the capsule.
          style={{ width: `${Math.max(inputValue.length, 1) + 2}ch` }}
          className="mari-chat-style-text h-full min-w-0 shrink-0 rounded-l-full bg-transparent py-0.5 pl-1.5 text-center tabular-nums text-[0.75rem] font-medium text-[var(--marinara-chat-message-action-text-hover)] outline-none"
          aria-label={localizeUi("ui.chat.swipejumpcontrol.jumpToSwipe1ThroughValue1", {
            value1: displaySwipeCount,
          })}
          title={localizeUi("ui.chat.swipejumpcontrol.jumpToSwipe1Value1", { value1: displaySwipeCount })}
        />
        <label htmlFor={inputId} aria-hidden="true" className="cursor-text pr-2 tabular-nums">
          /{displaySwipeCount}
        </label>
        {picker && swipeCount > 1 && (
          <>
            <span
              aria-hidden="true"
              className="h-3 w-px bg-[color-mix(in_srgb,var(--marinara-chat-chrome-text)_8%,transparent)]"
            />
            <SwipePicker
              chatId={picker.chatId}
              messageId={messageId}
              activeSwipeIndex={activeSwipeIndex}
              swipeCount={swipeCount}
              currentContent={picker.content}
              greeting={picker.greeting}
              onSetActiveSwipe={onSetActiveSwipe}
              triggerClassName={LIST_BUTTON_CLASS}
            />
          </>
        )}
      </span>
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
