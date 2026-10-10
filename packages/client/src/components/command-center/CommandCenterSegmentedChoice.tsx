import { useId, type KeyboardEvent } from "react";
import { Loader2, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export interface CommandCenterChoiceOption<T extends string> {
  value: T;
  label: string;
  icon?: LucideIcon;
  disabled?: boolean;
}

export interface CommandCenterSegmentedChoiceProps<T extends string> {
  value: T;
  label: string;
  options: readonly CommandCenterChoiceOption<T>[];
  onValueChange: (value: T) => void;
  variant?: "default" | "compact";
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  /**
   * F5 (O5): the option the omnibar's own ArrowDown/ArrowUp has keyboard-highlighted
   * but not yet committed (Enter still has to run). Without this, a keyboard pick
   * had no visible row and no visible segment - the picker looked untouched. Distinct
   * from `selected` (the already-applied value), so a pick-in-progress still reads
   * differently from the current one.
   */
  pendingValue?: T;
}

export function CommandCenterSegmentedChoice<T extends string>({
  value,
  label,
  options,
  onValueChange,
  variant = "default",
  disabled = false,
  loading = false,
  className,
  pendingValue,
}: CommandCenterSegmentedChoiceProps<T>) {
  const labelId = useId();
  const unavailable = disabled || loading;
  const compact = variant === "compact";
  const selectedOption = options.find((option) => option.value === value && !option.disabled);
  const fallbackOption = options.find((option) => !option.disabled);
  const tabStopValue = selectedOption?.value ?? fallbackOption?.value;

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, optionIndex: number) => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;

    event.preventDefault();
    const enabledOptions = options.map((option, index) => ({ option, index })).filter(({ option }) => !option.disabled);
    if (enabledOptions.length === 0) return;

    const currentIndex = enabledOptions.findIndex(({ index }) => index === optionIndex);
    const offset = event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1;
    const targetIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? enabledOptions.length - 1
          : (currentIndex + offset + enabledOptions.length) % enabledOptions.length;
    const target = enabledOptions[targetIndex];
    if (!target) return;

    // A group with no selected option is a question (an approval's Keep/Restore, "Retry with"), not a
    // setting: arrows only move focus there, so looking at the options never runs one. Enter/Space picks.
    if (selectedOption) onValueChange(target.option.value);
    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>("[role='radio']")[target.index]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-labelledby={labelId}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex min-w-0 max-w-full gap-0.5 rounded-full border border-[var(--border)] bg-[color-mix(in_srgb,var(--foreground)_5%,var(--secondary))] p-0.5 shadow-inner",
        compact ? "scrollbar-hide w-full flex-nowrap overflow-x-auto overscroll-x-contain" : "flex-wrap",
        unavailable && "opacity-50",
        className,
      )}
    >
      <span id={labelId} className="sr-only">
        {label}
      </span>
      {options.map((option, index) => {
        const selected = option.value === value;
        const pending = !selected && option.value === pendingValue;
        const OptionIcon = option.icon;

        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={unavailable || option.disabled}
            tabIndex={!unavailable && option.value === tabStopValue ? 0 : -1}
            onClick={() => onValueChange(option.value)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={cn(
              "inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-all sm:min-h-7",
              compact ? "shrink-0" : "min-w-0 max-md:flex-1",
              "focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
              "disabled:cursor-not-allowed",
              selected
                ? "bg-[var(--primary)] text-[var(--primary-foreground)] shadow-sm"
                : "text-[var(--muted-foreground)] hover:bg-[color-mix(in_srgb,var(--foreground)_8%,transparent)] hover:text-[var(--foreground)]",
              pending && "ring-2 ring-[var(--ring)] text-[var(--foreground)]",
            )}
          >
            {loading && selected ? (
              <Loader2 className="size-3.5 shrink-0 animate-spin" aria-hidden="true" />
            ) : OptionIcon ? (
              <OptionIcon className="size-3.5 shrink-0" aria-hidden="true" />
            ) : null}
            <span
              className={cn(
                "min-w-0 text-center leading-4",
                compact ? "whitespace-nowrap" : "whitespace-normal break-words",
              )}
            >
              {option.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
