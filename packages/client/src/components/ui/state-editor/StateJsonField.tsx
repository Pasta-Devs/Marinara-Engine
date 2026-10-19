// ──────────────────────────────────────────────
// State JSON field — a JSON textarea with a line-number gutter, shared by the
// State Editor and Agent Suite. Lines never wrap, so each number stays beside
// its line; the gutter scrolls with the textarea.
// Tokens are coloured by a highlight layer behind a transparent textarea, so
// typing, the caret, selection and the line numbers behave exactly as before.
// ──────────────────────────────────────────────
import { useMemo, useRef, type RefObject } from "react";
import { cn } from "../../../lib/utils";
import { tokenizeStateJson, type StateJsonTokenKind } from "../../../lib/state-editor/state-editor-json";

interface StateJsonFieldProps {
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  /** Draws the field in the error color, e.g. while the JSON does not parse. */
  invalid?: boolean;
  disabled?: boolean;
  /** Selectable and scrollable but not editable, unlike `disabled`, which also greys it out. */
  readOnly?: boolean;
  /** Smaller type for dense panels such as Agent Suite. */
  compact?: boolean;
  /** Fixed visible rows; the field fills its container's height when omitted. */
  rows?: number;
  textareaRef?: RefObject<HTMLTextAreaElement | null>;
  onSelect?: () => void;
  className?: string;
}

// Theme tokens only, so every theme and the accent picker keep working.
const TOKEN_CLASS: Record<StateJsonTokenKind, string> = {
  key: "text-[var(--color-rgb-violet)]",
  string: "text-[var(--color-rgb-green)]",
  number: "text-[var(--color-rgb-blue)]",
  literal: "text-[var(--color-rgb-orange)]",
  punctuation: "text-[var(--foreground)]/70",
};

export function StateJsonField({
  value,
  onChange,
  ariaLabel,
  invalid = false,
  disabled = false,
  readOnly = false,
  compact = false,
  rows,
  textareaRef,
  onSelect,
  className,
}: StateJsonFieldProps) {
  const gutterRef = useRef<HTMLPreElement>(null);
  const highlightRef = useRef<HTMLPreElement>(null);
  const lineNumbers = useMemo(
    () => Array.from({ length: Math.max(1, value.split("\n").length) }, (_, i) => String(i + 1)).join("\n"),
    [value],
  );
  const tokens = useMemo(() => tokenizeStateJson(value), [value]);
  // Touch devices bump textareas to 1rem (no iOS zoom, see globals.css); the gutter follows so the
  // numbers stay on their lines.
  const typeClass = cn(
    "font-mono leading-relaxed [@media(pointer:coarse)]:text-base",
    compact ? "text-[0.625rem]" : "text-xs",
  );

  return (
    <div
      className={cn(
        "grid overflow-hidden rounded-lg bg-[var(--background)] ring-1 focus-within:ring-2",
        compact ? "grid-cols-[2.25rem_minmax(0,1fr)]" : "grid-cols-[2.75rem_minmax(0,1fr)]",
        invalid
          ? "ring-[var(--marinara-app-accent-static)]/50 focus-within:ring-[var(--marinara-app-accent-static)]/70"
          : "ring-[var(--border)] focus-within:ring-[var(--ring)]",
        disabled && "opacity-60",
        className,
      )}
    >
      <pre
        ref={gutterRef}
        aria-hidden="true"
        className={cn(
          "select-none overflow-hidden border-r border-[var(--border)]/60 bg-[var(--secondary)]/40 py-2 pr-2 pl-1 text-right text-[var(--muted-foreground)]/70",
          typeClass,
        )}
      >
        {lineNumbers}
      </pre>
      <div className="relative min-w-0">
        <pre
          ref={highlightRef}
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-0 select-none overflow-hidden whitespace-pre px-3 py-2",
            typeClass,
          )}
        >
          {tokens.map((token, index) => (
            <span key={index} className={TOKEN_CLASS[token.kind]}>
              {token.text}
            </span>
          ))}
          {"\n"}
        </pre>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onScroll={(event) => {
            const { scrollTop, scrollLeft } = event.currentTarget;
            if (gutterRef.current) gutterRef.current.scrollTop = scrollTop;
            if (highlightRef.current) {
              highlightRef.current.scrollTop = scrollTop;
              highlightRef.current.scrollLeft = scrollLeft;
            }
          }}
          onSelect={onSelect}
          disabled={disabled}
          readOnly={readOnly}
          rows={rows}
          wrap="off"
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          aria-label={ariaLabel}
          aria-invalid={invalid || undefined}
          className={cn(
            "relative w-full resize-none border-0 bg-transparent px-3 py-2 text-transparent caret-[var(--foreground)] outline-none selection:bg-[var(--primary)]/30",
            rows && "resize-y",
            !rows && "h-full",
            typeClass,
          )}
        />
      </div>
    </div>
  );
}
