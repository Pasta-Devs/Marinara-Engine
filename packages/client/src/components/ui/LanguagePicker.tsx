import { useMemo } from "react";
import { Select } from "./Select";

interface LanguageOption {
  code: string;
  label: string;
  englishLabel?: string;
}

interface LanguagePickerProps {
  id?: string;
  label: string;
  value: string;
  options: readonly LanguageOption[];
  onChange: (code: string) => void;
  disabled?: boolean;
}

let englishNames: Intl.DisplayNames | undefined;

function englishName(option: LanguageOption) {
  if (option.englishLabel) return option.englishLabel;
  try {
    englishNames ??= new Intl.DisplayNames(["en"], { type: "language" });
    return englishNames.of(option.code) ?? option.label;
  } catch {
    // Older WebViews without DisplayNames just show the native label.
    return option.label;
  }
}

/** Shared by interface and documentation language controls; pack installation stays with the caller. */
export function LanguagePicker({ id, label, value, options, onChange, disabled }: LanguagePickerProps) {
  const selectOptions = useMemo(
    () =>
      options.map((option) => {
        const english = englishName(option);
        return {
          value: option.code,
          label: option.label,
          description: english !== option.label ? english : undefined,
        };
      }),
    [options],
  );

  return (
    <Select
      id={id}
      label={label}
      value={value}
      options={selectOptions}
      onChange={onChange}
      disabled={disabled}
      placeholder={value}
      searchable
      className="min-h-11 w-full min-w-0 touch-manipulation rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-3 py-2 text-xs text-[var(--foreground)] transition-colors hover:border-[var(--primary)]/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-50"
    />
  );
}
