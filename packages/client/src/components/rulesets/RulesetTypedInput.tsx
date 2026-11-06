// One sheet value's input, typed by the ruleset: a number within its bounds, a checkbox, a choice, text.
// Shared by the full sheet form and the guided builder.
import {
  resolveRulesetValueRef,
  type RulesetDefinition,
  type RulesetField,
  type RulesetListColumn,
  type RulesetSheetBuild,
} from "@marinara-engine/shared";
import { DraftNumberInput } from "../ui/DraftNumberInput";
import { DraftTextarea } from "../ui/DraftTextarea";
import { useTranslation as useUiTranslation } from "react-i18next";
import { useRulesetText } from "../../lib/ruleset-text";

export type Scalar = number | string | boolean;

export const inputClass =
  "w-full min-w-0 rounded-lg border border-[var(--border)] bg-[var(--input)] px-2 py-1 text-xs text-[var(--foreground)]";
export const labelClass = "text-[0.6875rem] font-medium text-[var(--muted-foreground)]";

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** How many of a text field's suggestions its holder picks (1.797), as the sheet reads now. */
export function rulesetPickCount(
  definition: RulesetDefinition,
  build: RulesetSheetBuild,
  spec: RulesetField | RulesetListColumn,
): number | undefined {
  if (spec.type !== "text" || !spec.pick) return undefined;
  return resolveRulesetValueRef(definition, build, spec.pick);
}

export function TypedInput({
  spec,
  value,
  onChange,
  ariaLabel,
  disabled = false,
  title,
  describedBy,
  pick,
}: {
  spec: RulesetField | RulesetListColumn;
  value: Scalar | undefined;
  onChange: (value: Scalar) => void;
  ariaLabel: string;
  /** Set for a cell the ruleset keeps itself. The control stays in place and stops taking edits. */
  disabled?: boolean;
  /** The hint behind such a cell, for a pointer. */
  title?: string;
  /** The id of the visible text that says the same thing. A disabled control cannot be focused, so
   *  a `title` alone never reaches a keyboard or a screen reader. */
  describedBy?: string;
  /** How many of a text field's suggestions its holder picks (1.797), as the sheet reads now. */
  pick?: number;
}) {
  // A choice's words in the player's language (1.811); the value kept is the ruleset's own.
  const rt = useRulesetText();
  if (spec.type === "text" && spec.suggestions?.length)
    return (
      <SuggestedText
        spec={spec}
        value={value}
        onChange={onChange}
        ariaLabel={ariaLabel}
        disabled={disabled}
        title={title}
        describedBy={describedBy}
        pick={pick}
      />
    );
  if (spec.type === "number") {
    const shown = typeof value === "number" && Number.isFinite(value) ? value : spec.default;
    const shared = {
      min: spec.min,
      max: spec.max,
      integer: spec.integer,
      disabled,
      title,
      ariaLabel,
      ariaDescribedBy: describedBy,
      className: `${inputClass} text-center`,
    };
    // A cell nobody filled in, with no default, shows empty rather than its lowest allowed number
    // (Ruleset 2026-10-25: an unrolled hit-point row read "1"), and stays empty until one is typed.
    if (shown === undefined)
      return (
        <DraftNumberInput
          {...shared}
          allowEmpty
          value={null}
          placeholder="—"
          onCommit={(next) => {
            if (next !== null) onChange(clamp(next, spec.min, spec.max));
          }}
        />
      );
    return (
      <DraftNumberInput {...shared} value={shown} onCommit={(next) => onChange(clamp(next, spec.min, spec.max))} />
    );
  }
  if (spec.type === "boolean") {
    return (
      <input
        type="checkbox"
        checked={value === true}
        onChange={(event) => onChange(event.target.checked)}
        disabled={disabled}
        title={title}
        aria-label={ariaLabel}
        aria-describedby={describedBy}
        className="h-4 w-4 accent-[var(--primary)]"
      />
    );
  }
  if (spec.type === "enum") {
    // On purpose the control shows the value the sheet EVALUATES to. A stored string the ruleset
    // no longer offers reads as the default in the sheet math, so showing the stale string beside
    // modifiers computed from the default would misreport them. The stored string itself is left
    // untouched until the user picks a value.
    const current = typeof value === "string" && spec.values.includes(value) ? value : (spec.default ?? spec.values[0]);
    return (
      <select
        value={current}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        title={title}
        aria-label={ariaLabel}
        aria-describedby={describedBy}
        className={inputClass}
      >
        {spec.values.map((option) => (
          <option key={option} value={option}>
            {rt(spec.valueLabels?.[option] ?? option)}
          </option>
        ))}
      </select>
    );
  }
  if (spec.type === "longtext") {
    return (
      <DraftTextarea
        value={typeof value === "string" ? value : ""}
        onCommit={(next) => onChange(next.slice(0, spec.maxLength))}
        maxLength={spec.maxLength}
        rows={2}
        disabled={disabled}
        title={title}
        aria-label={ariaLabel}
        aria-describedby={describedBy}
        className={inputClass}
      />
    );
  }
  const maxLength = spec.type === "text" ? spec.maxLength : 40;
  const input = (
    <input
      type="text"
      value={typeof value === "string" ? value : ""}
      onChange={(event) => onChange(event.target.value.slice(0, maxLength))}
      maxLength={maxLength}
      placeholder={spec.type === "dice" ? spec.example : undefined}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel}
      aria-describedby={describedBy}
      className={inputClass}
    />
  );
  return input;
}

/** A text field offering words to pick (1.796): a chip adds its word to what is written, and takes it
 *  out again. With a count to pick (1.797) it says how many, and offers no more once they are in
 *  (laptop class builds 2026-10-24: a ranger's favored enemies showed no count); typing is never
 *  refused. */
function SuggestedText({
  spec,
  value,
  onChange,
  ariaLabel,
  disabled,
  title,
  describedBy,
  pick,
}: {
  spec: Extract<RulesetField | RulesetListColumn, { type: "text" }>;
  value: Scalar | undefined;
  onChange: (value: Scalar) => void;
  ariaLabel: string;
  disabled: boolean;
  title?: string;
  describedBy?: string;
  pick?: number;
}) {
  const { t } = useUiTranslation();
  const rt = useRulesetText();
  const maxLength = spec.maxLength;
  const suggestions = spec.suggestions ?? [];
  const input = (
    <input
      type="text"
      value={typeof value === "string" ? value : ""}
      onChange={(event) => onChange(event.target.value.slice(0, maxLength))}
      maxLength={maxLength}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel}
      aria-describedby={describedBy}
      className={inputClass}
    />
  );
  const text = typeof value === "string" ? value : "";
  const words = text
    .split(",")
    .map((one) => one.trim())
    .filter(Boolean);
  const has = (word: string) => words.some((one) => one.toLowerCase() === word.toLowerCase());
  const count = pick !== undefined && pick > 0 ? Math.trunc(pick) : undefined;
  const full = count !== undefined && words.length >= count;
  return (
    <div className="space-y-1">
      {input}
      {count !== undefined && (
        <p className={labelClass}>{t("ui.rulesets.typed.pick", { count, picked: Math.min(words.length, count) })}</p>
      )}
      <div className="flex flex-wrap gap-1">
        {suggestions.map((word) => (
          <button
            key={word}
            type="button"
            aria-pressed={has(word)}
            disabled={disabled || (full && !has(word))}
            onClick={() =>
              onChange(
                (has(word) ? words.filter((one) => one.toLowerCase() !== word.toLowerCase()) : [...words, word])
                  .join(", ")
                  .slice(0, maxLength),
              )
            }
            className={`rounded-full border px-2 py-0.5 text-[0.6875rem] disabled:opacity-50 ${
              has(word)
                ? "border-[var(--primary)] bg-[var(--primary)]/15 text-[var(--foreground)]"
                : "border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--accent)]"
            }`}
          >
            {rt(word)}
          </button>
        ))}
      </div>
    </div>
  );
}
