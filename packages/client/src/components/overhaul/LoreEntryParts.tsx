// ──────────────────────────────────────────────
// UI overhaul: small controls for the lorebook entry editor (v1 frame)
//
// Chip inputs (keys, schedule), a segmented control (entry type, filter
// modes), a labelled switch, and a chip picker that adds from a fixed list.
// ──────────────────────────────────────────────
import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";
import { Select } from "../ui/Select";
import { useTranslation as useUiTranslation } from "react-i18next";
import { useLocalizedUiText } from "../../localization/use-localized-ui-text";

/** Chips inside one input-looking box; Enter or comma adds, Backspace on empty removes the last. */
export function OvChipInput({
  values,
  onChange,
  placeholder,
  parse,
  mono = true,
}: {
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  /** Turns typed text into the next list; defaults to comma split with de-dupe. */
  parse?: (current: string[], text: string) => string[];
  mono?: boolean;
}) {
  const { t: localizeUi } = useUiTranslation();
  const [draft, setDraft] = useState("");
  const commit = () => {
    const text = draft.trim();
    if (!text) return;
    const next = parse
      ? parse(values, text)
      : [
          ...values,
          ...text
            .split(",")
            .map((part) => part.trim())
            .filter((part) => part && !values.includes(part)),
        ];
    if (next.length !== values.length) onChange(next);
    setDraft("");
  };
  return (
    <div
      className={cn("ov-chipbox", mono && "is-mono")}
      onClick={(event) => event.currentTarget.querySelector("input")?.focus()}
    >
      {values.map((value, index) => (
        <span key={`${value}-${index}`} className="ov-chipbox__chip">
          {value}
          <button
            type="button"
            aria-label={localizeUi("ui.agents.regexscripteditor.removeValue1", { value1: value })}
            onClick={(event) => {
              event.stopPropagation();
              onChange(values.filter((_, i) => i !== index));
            }}
          >
            <X size={10} />
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === ",") {
            event.preventDefault();
            commit();
          } else if (event.key === "Backspace" && !draft && values.length) {
            onChange(values.slice(0, -1));
          }
        }}
        placeholder={placeholder}
      />
    </div>
  );
}

/**
 * Segmented one-of-N control (2-3 short options). A radio group: only the picked option is in the Tab order,
 * and the arrow keys (Home/End too) move to and pick a neighbour, as with native radio buttons.
 */
export function OvSeg<T extends string>({
  value,
  options,
  onChange,
  label,
  labelledBy,
  disabled,
  className,
  id,
}: {
  value: T;
  options: Array<{ value: T; label: string; title?: string }>;
  onChange: (next: T) => void;
  label?: string;
  labelledBy?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
}) {
  const localize = useLocalizedUiText();
  const groupRef = useRef<HTMLDivElement>(null);
  const checkedIndex = options.findIndex((option) => option.value === value);
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled || event.altKey || event.ctrlKey || event.metaKey) return;
    const current = options.findIndex((option) => option.value === value);
    let next = -1;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (current + 1) % options.length;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp")
      next = (current - 1 + options.length) % options.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = options.length - 1;
    if (next < 0) return;
    event.preventDefault();
    onChange(options[next]!.value);
    groupRef.current?.querySelectorAll<HTMLButtonElement>("[role=radio]")[next]?.focus();
  };
  return (
    <div
      ref={groupRef}
      id={id}
      className={cn("ov-seg", className)}
      role="radiogroup"
      aria-label={labelledBy ? undefined : label}
      aria-labelledby={labelledBy}
      aria-disabled={disabled || undefined}
      onKeyDown={onKeyDown}
    >
      {options.map((option, index) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          tabIndex={index === (checkedIndex < 0 ? 0 : checkedIndex) ? 0 : -1}
          title={option.title ? localize(option.title) : undefined}
          disabled={disabled}
          className={cn(value === option.value && "is-on")}
          onClick={() => onChange(option.value)}
        >
          {localize(option.label)}
        </button>
      ))}
    </div>
  );
}

export function OvToggle({
  label,
  on,
  onChange,
  title,
}: {
  label: ReactNode;
  on: boolean;
  onChange: (next: boolean) => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      title={title}
      className="ov-ltoggle"
      onClick={() => onChange(!on)}
    >
      <span className={cn("ov-switch", on && "is-on")}>
        <span />
      </span>
      {label}
    </button>
  );
}

/** Selected values as chips plus a dropdown that adds one of the rest. */
export function OvChipPicker({
  options,
  selected,
  onChange,
  placeholder,
}: {
  options: Array<{ value: string; label: string }>;
  selected: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
}) {
  const { t: localizeUi } = useUiTranslation();
  const labelOf = (value: string) => options.find((option) => option.value === value)?.label ?? value;
  const rest = options.filter((option) => !selected.includes(option.value));
  return (
    <div className="ov-chipbox">
      {selected.map((value) => (
        <span key={value} className="ov-chipbox__chip">
          {labelOf(value)}
          <button
            type="button"
            aria-label={localizeUi("ui.agents.regexscripteditor.removeValue1", { value1: labelOf(value) })}
            onClick={() => onChange(selected.filter((item) => item !== value))}
          >
            <X size={10} />
          </button>
        </span>
      ))}
      {rest.length ? (
        // An "add one" picker: nothing stays picked, each pick adds a chip.
        <Select
          className="ov-lsel ov-chipbox__add"
          label={placeholder}
          placeholder={placeholder}
          value={null}
          onChange={(next) => onChange([...selected, next])}
          options={rest.map((option) => ({ value: option.value, label: option.label }))}
        />
      ) : null}
    </div>
  );
}

/** Number box that commits on blur or Enter; empty commits null when allowed. */
export function OvNum({
  value,
  onCommit,
  min,
  max,
  placeholder,
  allowEmpty = false,
  label,
  className,
}: {
  value: number | null;
  onCommit: (next: number | null) => void;
  min?: number;
  max?: number;
  placeholder?: string;
  allowEmpty?: boolean;
  label: string;
  className?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? (value === null ? "" : String(value));
  const commit = () => {
    if (draft === null) return;
    const text = draft.trim();
    setDraft(null);
    if (!text) {
      if (allowEmpty && value !== null) onCommit(null);
      return;
    }
    let parsed = parseInt(text, 10);
    if (Number.isNaN(parsed)) return;
    if (min !== undefined) parsed = Math.max(min, parsed);
    if (max !== undefined) parsed = Math.min(max, parsed);
    if (parsed !== value) onCommit(parsed);
  };
  return (
    <input
      type="number"
      className={cn("ov-lnum", className)}
      aria-label={label}
      value={shown}
      min={min}
      max={max}
      placeholder={placeholder}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          (event.currentTarget as HTMLInputElement).blur();
        }
      }}
      onClick={(event) => event.stopPropagation()}
    />
  );
}
