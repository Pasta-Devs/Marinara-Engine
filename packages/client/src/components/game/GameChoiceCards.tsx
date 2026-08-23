// ──────────────────────────────────────────────
// Game: Choice Cards UI
//
// Renders VN-style clickable choice cards when the
// GM emits [choices: "A" | "B" | "C"] tags.
// ──────────────────────────────────────────────
import { useState } from "react";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";
import { normalizeChoiceText } from "../../lib/game-choice-utils";
import { AnimatedText } from "./AnimatedText";
import { useTranslation as useUiTranslation } from "react-i18next";

interface GameChoiceCardsProps {
  choices: string[];
  onSelect: (choice: string) => void;
  onDismiss?: () => void;
  disabled?: boolean;
  /** In replay mode, only this previously selected choice remains interactive. */
  replayChoice?: string | null;
}

function choiceStateClassName(
  selected: boolean,
  replayMode: boolean,
  recordedChoice: boolean,
  selectionMade: boolean,
): string {
  if (selected) {
    return "border-[var(--primary)]/50 bg-[var(--primary)]/20 text-white ring-2 ring-[var(--primary)]/30 scale-[0.98]";
  }
  if (replayMode && recordedChoice) {
    return "border-[var(--primary)]/35 bg-[var(--primary)]/12 text-white hover:border-[var(--primary)]/55 hover:bg-[var(--primary)]/20";
  }
  if (selectionMade || (replayMode && !recordedChoice)) {
    return "border-white/5 bg-white/3 text-white/30 opacity-50";
  }
  return "border-white/10 bg-white/5 text-white/90 hover:border-[var(--primary)]/30 hover:bg-[var(--primary)]/10 hover:text-white";
}

export function GameChoiceCards({ choices, onSelect, onDismiss, disabled, replayChoice }: GameChoiceCardsProps) {
  const { t: localizeUi } = useUiTranslation();
  const [selected, setSelected] = useState<number | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const replayMode = replayChoice !== undefined;
  const normalizedReplayChoice = replayChoice ? normalizeChoiceText(replayChoice) : null;

  const handleSelect = (choice: string, index: number) => {
    const isRecordedChoice = !replayMode || normalizeChoiceText(choice) === normalizedReplayChoice;
    if (disabled || selected !== null || !isRecordedChoice) return;
    setSelected(index);
    // Brief animation before sending
    setTimeout(() => {
      onSelect(choice);
    }, 300);
  };

  return (
    <div className="mx-auto flex h-full max-h-full min-h-0 w-full max-w-2xl px-3 pb-2 sm:pb-3">
      <div className="flex h-full max-h-[clamp(8rem,30svh,14rem)] min-h-0 w-full flex-col rounded-2xl border border-white/15 bg-black/50 p-3 shadow-[0_8px_24px_rgba(0,0,0,0.3)] backdrop-blur-md sm:max-h-[clamp(9rem,36svh,20rem)] md:max-h-[min(52dvh,32rem)]">
        <div className="mb-2 flex shrink-0 items-center justify-between gap-2">
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[0.625rem] font-semibold uppercase tracking-wide text-white/90">
            {replayMode
              ? localizeUi("ui.game.gamechoicecards.recordedChoice")
              : localizeUi("ui.game.gamechoicecards.chooseYourAction")}
          </span>
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="rounded-lg p-1 text-white/55 transition-colors hover:bg-white/10 hover:text-white"
              title={localizeUi("ui.game.gamechoicecards.closeChoices")}
              aria-label={localizeUi("ui.game.gamechoicecards.closeChoices")}
            >
              <X size="0.875rem" />
            </button>
          )}
        </div>

        <div
          data-component="GameChoiceCards.Options"
          className="flex min-h-0 flex-1 touch-pan-y flex-col gap-2 overflow-y-auto overscroll-contain pr-1 [-webkit-overflow-scrolling:touch]"
        >
          {choices.map((choice, i) => {
            const isRecordedChoice = !replayMode || normalizeChoiceText(choice) === normalizedReplayChoice;
            const choiceDisabled = disabled || selected !== null || !isRecordedChoice;
            return (
              <button
                key={i}
                onClick={() => handleSelect(choice, i)}
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
                disabled={choiceDisabled}
                title={
                  replayMode && !isRecordedChoice
                    ? localizeUi("ui.game.gamechoicecards.thisChoiceWasNotSelectedInTheOriginalSession")
                    : undefined
                }
                className={cn(
                  "group relative shrink-0 overflow-hidden rounded-xl border px-4 py-3 text-left text-sm transition-all duration-200",
                  choiceStateClassName(selected === i, replayMode, isRecordedChoice, selected !== null),
                  disabled && "pointer-events-none opacity-50",
                )}
              >
                {/* Choice number badge */}
                <span
                  className={cn(
                    "mr-2.5 inline-flex h-5 w-5 items-center justify-center rounded-full text-[0.625rem] font-bold transition-colors",
                    selected === i
                      ? "bg-[var(--primary)] text-white"
                      : hoveredIndex === i
                        ? "bg-[var(--primary)]/30 text-[var(--primary)]"
                        : "bg-white/10 text-white/60",
                  )}
                >
                  {i + 1}
                </span>
                <AnimatedText html={choice} />

                {/* Hover shine effect */}
                <div
                  className={cn(
                    "pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 transition-opacity duration-300",
                    hoveredIndex === i && selected === null && "opacity-100",
                  )}
                />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
