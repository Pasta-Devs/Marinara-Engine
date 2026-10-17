// ──────────────────────────────────────────────
// State Editor — the Fields view: a section's simple values (text, numbers,
// on/off) as inputs, grouped the way the JSON nests them. It writes the same
// JSON draft as the JSON view, so both views always show the same edit.
// Adding or removing entries stays in the JSON view.
// ──────────────────────────────────────────────
import { useEffect, useRef, useState } from "react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { cn } from "../../../lib/utils";
import {
  describeArrayItem,
  humanizeStateKey,
  setStateValueAtPath,
  statePathKey,
} from "../../../lib/state-editor/state-editor-json";
import type { StateEditorPath } from "../../../lib/state-editor/state-editor.types";

interface StateFieldsViewProps {
  value: unknown;
  onChange: (next: unknown) => void;
  /** A search result to bring into view; cleared through onFocusHandled once it is shown. */
  focusPath?: StateEditorPath | null;
  onFocusHandled?: () => void;
  /** Values show as non-editable inputs, for a section the source can't save. */
  readOnly?: boolean;
}

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const isContainer = (value: unknown) => Array.isArray(value) || isPlainRecord(value);

const INPUT =
  "w-full min-w-0 rounded-lg bg-[var(--background)] px-2.5 text-sm text-[var(--foreground)] ring-1 ring-[var(--border)] outline-none transition-shadow placeholder:text-[var(--muted-foreground)] focus:ring-2 focus:ring-[var(--ring)] read-only:bg-[var(--secondary)]/40 read-only:text-[var(--muted-foreground)]";

interface LeafProps<T> {
  value: T;
  onChange: (next: T) => void;
  label: string;
  readOnly?: boolean;
}

/** Text wraps to about 60 characters a line; short text stays one row. */
const TEXT_LINE = 60;

/**
 * Always a textarea, so typing past one line or pressing Enter never swaps the element (and drops
 * focus mid-edit); only its height follows the text.
 */
function TextField({ value, onChange, label, readOnly }: LeafProps<string>) {
  const rows = Math.min(6, Math.max(1, Math.ceil(value.length / TEXT_LINE), value.split("\n").length));
  return (
    <textarea
      value={value}
      onChange={(event) => onChange(event.target.value)}
      aria-label={label}
      readOnly={readOnly}
      rows={rows}
      className={cn(INPUT, "block min-h-9 resize-y py-1.5 leading-snug")}
    />
  );
}

/** Keeps what is typed ("-", "1.") while it isn't a number yet; only a real number reaches the draft. */
function NumberField({ value, onChange, label, readOnly }: LeafProps<number>) {
  const [text, setText] = useState(String(value));
  useEffect(() => {
    setText((current) => (Number(current) === value && current.trim() !== "" ? current : String(value)));
  }, [value]);
  const parsed = text.trim() === "" ? Number.NaN : Number(text);
  const valid = Number.isFinite(parsed);
  return (
    <input
      type="text"
      inputMode="decimal"
      value={text}
      onChange={(event) => {
        setText(event.target.value);
        const next = event.target.value.trim() === "" ? Number.NaN : Number(event.target.value);
        if (Number.isFinite(next)) onChange(next);
      }}
      onBlur={() => {
        if (!valid) setText(String(value));
      }}
      aria-label={label}
      readOnly={readOnly}
      aria-invalid={!valid || undefined}
      className={cn(
        INPUT,
        "h-9 w-32 tabular-nums",
        !valid && "ring-[var(--marinara-app-accent-static)] focus:ring-[var(--marinara-app-accent-static)]",
      )}
    />
  );
}

function BooleanField({ value, onChange, label, readOnly }: LeafProps<boolean>) {
  const { t: localizeUi } = useUiTranslation();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      aria-label={label}
      onClick={() => onChange(!value)}
      disabled={readOnly}
      className="inline-flex min-h-9 items-center gap-2 rounded-lg px-1 text-xs text-[var(--muted-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:cursor-default"
    >
      <span
        className={cn(
          "relative h-5 w-9 shrink-0 rounded-full transition-colors",
          value ? "bg-[var(--primary)]" : "bg-[var(--secondary)] ring-1 ring-[var(--border)]",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-4 w-4 rounded-full bg-[var(--background)] shadow-sm transition-transform",
            value ? "translate-x-[1.125rem]" : "translate-x-0.5",
          )}
        />
      </span>
      {localizeUi(value ? "ui.stateEditor.fields.on" : "ui.stateEditor.fields.off")}
    </button>
  );
}

export function StateFieldsView({ value, onChange, focusPath, onFocusHandled, readOnly }: StateFieldsViewProps) {
  const { t: localizeUi } = useUiTranslation();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!focusPath || !containerRef.current) return;
    const target = containerRef.current.querySelector<HTMLElement>(
      `[data-state-path="${CSS.escape(statePathKey(focusPath))}"]`,
    );
    if (target) {
      target.scrollIntoView({ block: "center" });
      target.querySelector<HTMLElement>("input, textarea, button")?.focus({ preventScroll: true });
    }
    onFocusHandled?.();
  }, [focusPath, onFocusHandled]);

  const update = (path: StateEditorPath, next: unknown) => onChange(setStateValueAtPath(value, path, next));

  const renderLeaf = (node: unknown, path: StateEditorPath, label: string) => {
    if (typeof node === "string")
      return <TextField value={node} onChange={(next) => update(path, next)} label={label} readOnly={readOnly} />;
    if (typeof node === "number") {
      return <NumberField value={node} onChange={(next) => update(path, next)} label={label} readOnly={readOnly} />;
    }
    if (typeof node === "boolean") {
      return <BooleanField value={node} onChange={(next) => update(path, next)} label={label} readOnly={readOnly} />;
    }
    // null: nothing to type into without guessing its kind.
    return (
      <span className="inline-flex min-h-9 items-center text-xs italic text-[var(--muted-foreground)]">
        {localizeUi(readOnly ? "ui.stateEditor.fields.noValueReadOnly" : "ui.stateEditor.fields.noValue")}
      </span>
    );
  };

  const emptyNote = (
    <p className="text-xs text-[var(--muted-foreground)]">
      {localizeUi(readOnly ? "ui.stateEditor.fields.emptyReadOnly" : "ui.stateEditor.fields.empty")}
    </p>
  );

  /** One labelled entry: a field for a simple value, a nested group for an object or a list. */
  const renderEntry = (node: unknown, path: StateEditorPath, label: string, title?: string) => {
    const key = statePathKey(path);
    if (!isContainer(node)) {
      return (
        <div
          key={key}
          data-state-path={key}
          className="grid gap-1 sm:grid-cols-[minmax(7rem,11rem)_minmax(0,1fr)] sm:items-start sm:gap-3"
        >
          <span title={title} className="truncate pt-0 text-xs font-medium text-[var(--muted-foreground)] sm:pt-2.5">
            {label}
          </span>
          <div className="min-w-0">{renderLeaf(node, path, label)}</div>
        </div>
      );
    }
    return (
      <fieldset key={key} data-state-path={key} className="flex min-w-0 flex-col gap-2">
        <legend title={title} className="mb-1 text-xs font-semibold text-[var(--foreground)]">
          {label}
        </legend>
        <div className="flex flex-col gap-2 border-l border-[var(--border)]/70 pl-3">{renderChildren(node, path)}</div>
      </fieldset>
    );
  };

  function renderChildren(node: unknown, path: StateEditorPath) {
    if (Array.isArray(node)) {
      if (node.length === 0) return emptyNote;
      return node.map((item, index) => {
        const itemPath = [...path, index];
        if (!isContainer(item)) return renderEntry(item, itemPath, `#${index + 1}`);
        // A list of records reads as cards, each named like the search trail names it.
        return (
          <div
            key={statePathKey(itemPath)}
            data-state-path={statePathKey(itemPath)}
            className="flex min-w-0 flex-col gap-2 rounded-lg bg-[var(--secondary)]/40 p-3 ring-1 ring-[var(--border)]/60"
          >
            <span className="truncate text-xs font-semibold text-[var(--foreground)]">
              {describeArrayItem(item, index)}
            </span>
            {renderChildren(item, itemPath)}
          </div>
        );
      });
    }
    if (isPlainRecord(node)) {
      const entries = Object.entries(node).filter(([, item]) => item !== undefined);
      if (entries.length === 0) return emptyNote;
      return entries.map(([childKey, item]) =>
        renderEntry(item, [...path, childKey], humanizeStateKey(childKey), childKey),
      );
    }
    return null;
  }

  return (
    <div ref={containerRef} className="flex min-w-0 flex-col gap-3">
      {readOnly ? null : (
        <p className="text-[0.6875rem] text-[var(--muted-foreground)]">{localizeUi("ui.stateEditor.fields.hint")}</p>
      )}
      {isContainer(value)
        ? renderChildren(value, [])
        : renderEntry(value, [], localizeUi("ui.stateEditor.fields.value"))}
    </div>
  );
}
