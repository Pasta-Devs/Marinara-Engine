// ──────────────────────────────────────────────
// State Editor — the Fields view: a section's simple values (text, numbers,
// on/off) as inputs, grouped the way the JSON nests them. It writes the same
// JSON draft as the JSON view, so both views always show the same edit.
// Fields, entries and values can be added, filled in and removed here too; an
// added entry copies the shape of the entry above it, so it stays readable.
// ──────────────────────────────────────────────
import { useEffect, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { cn } from "../../../lib/utils";
import {
  blankStateArrayItem,
  describeArrayItem,
  hasDeclaredStateEntry,
  humanizeStateKey,
  setStateValueAtPath,
  shapeStateEntry,
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
  /** The open section: its list names differ between sections (see the maps below). */
  sectionId?: string;
}

/** The list a section holds at its root, for the sections that are one list rather than an object. */
const SECTION_ROOT_LIST: Record<string, string | undefined> = {
  "character-tracker": "presentCharacters",
  "custom-tracker": "customTrackerFields",
  quest: "activeQuests",
};

/**
 * No add control at the section's own list. Characters and quests are identified by an id the editor
 * can't invent, and the save path stores whatever row it is given, so an added row would be a card the
 * trackers can't match to anything. Lists inside those cards (a character's stats) still add.
 */
const NO_ROOT_ADD = new Set(["character-tracker", "quest"]);

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
            // left-0.5 anchors the knob: absolutely positioned inside a flex row it takes its static
            // position from the track, so without it the knob starts already slid to the right.
            "absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-[var(--background)] shadow-sm transition-transform",
            value ? "translate-x-4" : "translate-x-0",
          )}
        />
      </span>
      {localizeUi(value ? "ui.stateEditor.fields.on" : "ui.stateEditor.fields.off")}
    </button>
  );
}

const SMALL_BUTTON =
  "inline-flex min-h-8 items-center gap-1 rounded-lg px-2 text-xs text-[var(--muted-foreground)] ring-1 ring-[var(--border)] transition-colors pointer-coarse:min-h-11 pointer-coarse:px-3 hover:bg-[var(--secondary)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:cursor-default disabled:opacity-50";

/** A null leaf means the trackers didn't know; picking a kind is what turns it back into a field. */
function NullField({
  onPick,
  readOnly,
  numberStart = 0,
}: {
  onPick: (next: string | number | boolean) => void;
  readOnly?: boolean;
  /** A cleared quantity starts at 1: the save path rejects 0 (findInvalidInventoryTrackerRow). */
  numberStart?: number;
}) {
  const { t: localizeUi } = useUiTranslation();
  if (readOnly) {
    return (
      <span className="inline-flex min-h-9 items-center text-xs italic text-[var(--muted-foreground)]">
        {localizeUi("ui.stateEditor.fields.noValueReadOnly")}
      </span>
    );
  }
  const kinds: { key: string; value: string | number | boolean }[] = [
    { key: "ui.stateEditor.fields.kindText", value: "" },
    { key: "ui.stateEditor.fields.kindNumber", value: numberStart },
    { key: "ui.stateEditor.fields.kindBoolean", value: false },
  ];
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs italic text-[var(--muted-foreground)]">
        {localizeUi("ui.stateEditor.fields.noValue")}
      </span>
      {kinds.map((kind) => (
        <button key={kind.key} type="button" onClick={() => onPick(kind.value)} className={SMALL_BUTTON}>
          {localizeUi(kind.key)}
        </button>
      ))}
    </div>
  );
}

/** A name and a value, for an object that would otherwise only grow in the JSON view. */
function AddFieldRow({ existingKeys, onAdd }: { existingKeys: string[]; onAdd: (key: string, value: string) => void }) {
  const { t: localizeUi } = useUiTranslation();
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const name = key.trim();
  const canAdd = name.length > 0 && !existingKeys.includes(name);
  const add = () => {
    if (!canAdd) return;
    onAdd(name, value);
    setKey("");
    setValue("");
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <input
        value={key}
        onChange={(event) => setKey(event.target.value)}
        onKeyDown={(event) => {
          // An IME confirms a candidate with Enter; that key is not a submit.
          if (event.key === "Enter" && !event.nativeEvent.isComposing) add();
        }}
        placeholder={localizeUi("ui.stateEditor.fields.fieldName")}
        aria-label={localizeUi("ui.stateEditor.fields.fieldName")}
        className={cn(INPUT, "h-9 w-40")}
      />
      <input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          // An IME confirms a candidate with Enter; that key is not a submit.
          if (event.key === "Enter" && !event.nativeEvent.isComposing) add();
        }}
        placeholder={localizeUi("ui.stateEditor.fields.value")}
        aria-label={localizeUi("ui.stateEditor.fields.value")}
        className={cn(INPUT, "h-9 min-w-32 flex-1")}
      />
      <button type="button" onClick={add} disabled={!canAdd} className={SMALL_BUTTON}>
        <Plus className="h-3.5 w-3.5" />
        {localizeUi("ui.stateEditor.fields.add")}
      </button>
    </div>
  );
}

export function StateFieldsView({
  value,
  onChange,
  focusPath,
  onFocusHandled,
  readOnly,
  sectionId,
}: StateFieldsViewProps) {
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

  /**
   * The list a path is an item of, named the way the list's section names it: the last step for a plain
   * key, the section's own root list for `[]`.
   */
  const listKeyAt = (candidate: StateEditorPath): string | undefined => {
    const last = candidate[candidate.length - 1];
    if (typeof last === "string") return last;
    return candidate.length === 0 && sectionId ? SECTION_ROOT_LIST[sectionId] : undefined;
  };

  const renderLeaf = (node: unknown, path: StateEditorPath, label: string) => {
    if (typeof node === "string")
      return <TextField value={node} onChange={(next) => update(path, next)} label={label} readOnly={readOnly} />;
    if (typeof node === "number") {
      return <NumberField value={node} onChange={(next) => update(path, next)} label={label} readOnly={readOnly} />;
    }
    if (typeof node === "boolean") {
      return <BooleanField value={node} onChange={(next) => update(path, next)} label={label} readOnly={readOnly} />;
    }
    // null: the trackers left it empty, so offer the kinds it could become.
    const leafKey = path[path.length - 1];
    return (
      <NullField
        onPick={(next) => update(path, next)}
        readOnly={readOnly}
        numberStart={leafKey === "qty" || leafKey === "quantity" ? 1 : 0}
      />
    );
  };

  const emptyNote = (
    <p className="text-xs text-[var(--muted-foreground)]">
      {localizeUi(readOnly ? "ui.stateEditor.fields.emptyReadOnly" : "ui.stateEditor.fields.empty")}
    </p>
  );
  /** The same note for a list that can't be added to here (a character's or quest's identity). */
  const emptyNoteWithoutAdd = (
    <p className="text-xs text-[var(--muted-foreground)]">{localizeUi("ui.stateEditor.fields.emptyReadOnly")}</p>
  );

  /** One labelled entry: a field for a simple value, a nested group for an object or a list. */
  const renderEntry = (node: unknown, path: StateEditorPath, label: string, title?: string) => {
    const key = statePathKey(path);
    if (!isContainer(node)) {
      const clearLabel = localizeUi("ui.stateEditor.fields.clear");
      return (
        <div
          key={key}
          data-state-path={key}
          className="group/field grid gap-1 sm:grid-cols-[minmax(7rem,11rem)_minmax(0,1fr)] sm:items-start sm:gap-3"
        >
          <span title={title} className="truncate pt-0 text-xs font-medium text-[var(--muted-foreground)] sm:pt-2.5">
            {label}
          </span>
          <div className="flex min-w-0 items-start gap-1">
            <div className="min-w-0 flex-1">{renderLeaf(node, path, label)}</div>
            {readOnly || node === null ? null : (
              // Back to "no value", which is how the state records a field the trackers don't know. It
              // is offered inside cards too: choosing a kind for a null field would otherwise be one-way,
              // and the card's × removes the whole entry instead of emptying the one field.
              <button
                type="button"
                title={clearLabel}
                aria-label={clearLabel}
                onClick={() => update(path, null)}
                className="relative mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-md text-[var(--muted-foreground)] transition-opacity after:absolute after:-inset-2 after:content-[''] hover:text-[var(--destructive)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/field:opacity-100 [@media(hover:hover)]:focus-visible:opacity-100"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
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
      const removeLabel = localizeUi("ui.stateEditor.fields.removeItem");
      const removeItem = (index: number) => {
        if (readOnly) return null;
        return (
          <button
            type="button"
            title={removeLabel}
            aria-label={removeLabel}
            onClick={() =>
              update(
                path,
                node.filter((_, item) => item !== index),
              )
            }
            className="relative grid h-7 w-7 shrink-0 place-items-center rounded-md text-[var(--muted-foreground)] transition-opacity after:absolute after:-inset-2 after:content-[''] hover:text-[var(--destructive)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/card:opacity-100 [@media(hover:hover)]:focus-visible:opacity-100"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        );
      };
      // The list's own key names the shape an empty list starts from (stats, worldCustomFields, …); a
      // section that is one list has no key in the path, so it takes the one its section declares.
      const listKey = listKeyAt(path);
      const addItem =
        readOnly || (sectionId !== undefined && path.length === 0 && NO_ROOT_ADD.has(sectionId)) ? null : (
          <button
            type="button"
            onClick={() => update(path, [...node, blankStateArrayItem(node, listKey, sectionId)])}
            className={SMALL_BUTTON}
          >
            <Plus className="h-3.5 w-3.5" />
            {localizeUi("ui.stateEditor.fields.addItem")}
          </button>
        );
      if (node.length === 0) {
        return (
          <>
            {addItem ? emptyNote : emptyNoteWithoutAdd}
            {addItem}
          </>
        );
      }
      return (
        <>
          {node.map((item, index) => {
            const itemPath = [...path, index];
            if (!isContainer(item)) {
              return (
                <div key={statePathKey(itemPath)} className="group/card flex items-start gap-1">
                  <div className="min-w-0 flex-1">{renderEntry(item, itemPath, `#${index + 1}`)}</div>
                  {removeItem(index)}
                </div>
              );
            }
            // A list of records reads as cards, each named like the search trail names it.
            return (
              <div
                key={statePathKey(itemPath)}
                data-state-path={statePathKey(itemPath)}
                className="group/card flex min-w-0 flex-col gap-2 rounded-lg bg-[var(--secondary)]/40 p-3 ring-1 ring-[var(--border)]/60"
              >
                <div className="flex min-w-0 items-start gap-2">
                  <span className="min-w-0 flex-1 truncate text-xs font-semibold text-[var(--foreground)]">
                    {describeArrayItem(item, index)}
                  </span>
                  {removeItem(index)}
                </div>
                {renderChildren(shapeStateEntry(item, listKey, sectionId), itemPath)}
              </div>
            );
          })}
          {addItem}
        </>
      );
    }
    if (isPlainRecord(node)) {
      const entries = Object.entries(node).filter(([, item]) => item !== undefined);
      // Where the add control earns its space: the section itself, an object with nothing to show yet,
      // and an entry of a list with no declared shape — without the last one a `{}` entry could only
      // ever get a single field before this row disappeared.
      const showAddField =
        !readOnly &&
        (path.length === 0 ||
          entries.length === 0 ||
          (typeof path[path.length - 1] === "number" &&
            !hasDeclaredStateEntry(listKeyAt(path.slice(0, -1)), sectionId)));
      return (
        <>
          {entries.length === 0
            ? emptyNote
            : entries.map(([childKey, item]) =>
                renderEntry(item, [...path, childKey], humanizeStateKey(childKey), childKey),
              )}
          {showAddField ? (
            <AddFieldRow
              existingKeys={entries.map(([childKey]) => childKey)}
              onAdd={(childKey, fieldValue) => update(path, { ...node, [childKey]: fieldValue })}
            />
          ) : null}
        </>
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
