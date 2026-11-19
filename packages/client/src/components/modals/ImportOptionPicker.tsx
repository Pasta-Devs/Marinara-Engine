// ──────────────────────────────────────────────
// Import windows (new layout): a label-left segmented picker with the chosen
// option's description underneath. Shared by Import character and the
// SillyTavern folder import so their option rows look the same.
// ──────────────────────────────────────────────
import { useTranslation as useUiTranslation } from "react-i18next";
import { cn } from "../../lib/utils";

/** New layout: a label-left segmented picker with the chosen option's description underneath. */
export function ImportOptionPicker<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Array<{ value: T; short: string; description: string }>;
  value: T;
  onChange: (value: T) => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const current = options.find((option) => option.value === value);
  return (
    <div className="ov-imp__pick">
      <span className="ov-imp__label">{label}</span>
      <div className="ov-imp__choice">
        <div className="ov-seg" role="radiogroup" aria-label={label}>
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={option.value === value}
              className={cn(option.value === value && "is-on")}
              onClick={() => onChange(option.value)}
            >
              {localizeUi(option.short)}
            </button>
          ))}
        </div>
        {current ? <p className="ov-imp__desc">{localizeUi(current.description)}</p> : null}
      </div>
    </div>
  );
}
