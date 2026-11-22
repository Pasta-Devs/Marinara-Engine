// ──────────────────────────────────────────────
// UI overhaul: a dropdown that picks several values, with your own values too (New Game genre and
// tone), and a small "Ideas" menu that fills a text field (setting, goals, preferences, language).
// Both open the shared picker window: a popover on a computer, a bottom sheet on a phone.
// ──────────────────────────────────────────────
import { useId, useMemo, useRef, useState, type ReactNode } from "react";
import { Lightbulb, Plus, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "../../lib/utils";
import { PickerChevron, useFieldWindow } from "../ui/PickerField";
import { PickerSearch, PickRow, usePickerKeyboard } from "../ui/PickerParts";
import { PickerWindow } from "../ui/PickerWindow";

const keyOf = (value: string) => value.trim().toLowerCase();

/** A header over a group of rows in the window. */
function GroupHeader({ children }: { children: ReactNode }) {
  return (
    <p className="px-2 pb-0.5 pt-2 text-[0.6875rem] font-semibold uppercase tracking-wide text-foreground/45">
      {children}
    </p>
  );
}

/** A row with a "forget" × beside it, for values the app learned from earlier games. */
function ForgettableRow({ row, label, onForget }: { row: ReactNode; label: string; onForget?: () => void }) {
  if (!onForget) return <>{row}</>;
  return (
    <div className="flex items-center gap-1">
      <div className="min-w-0 flex-1">{row}</div>
      <button
        type="button"
        onClick={onForget}
        aria-label={label}
        title={label}
        className="ov-mpick__forget grid h-7 w-7 shrink-0 place-items-center rounded-md text-foreground/45"
      >
        <X size={13} aria-hidden="true" />
      </button>
    </div>
  );
}

/**
 * Several picks from a list, plus values of your own. The field shows the picks joined ("Fantasy, Horror").
 * The text box at the top of the window searches the list; a value the list does not have is added with Enter.
 */
export function OvMultiPick({
  label,
  options,
  learned = [],
  value,
  onChange,
  onForget,
  placeholder,
  addLabel,
  className,
  id,
  disabled,
}: {
  /** Names the field and titles the window. */
  label: string;
  /** Built-in values, in list order. */
  options: readonly string[];
  /** Values kept from earlier games, under "Yours". */
  learned?: readonly string[];
  value: readonly string[];
  onChange: (next: string[]) => void;
  /** Forgets a learned value. */
  onForget?: (value: string) => void;
  placeholder: string;
  /** The text box's placeholder ("Add your own…"). */
  addLabel: string;
  className?: string;
  id?: string;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const { open, triggerRef, close, toggle } = useFieldWindow(disabled);
  const [query, setQuery] = useState("");
  const listId = useId();
  const listRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const onKey = usePickerKeyboard({ listRef, searchRef, listId, query });

  const builtInKeys = useMemo(() => new Set(options.map(keyOf)), [options]);
  // "Yours": what the app learned, then any picked value of your own it hasn't learned yet.
  const yours = useMemo(() => {
    const seen = new Set<string>(builtInKeys);
    const out: string[] = [];
    for (const item of [...learned, ...value]) {
      const key = keyOf(item);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(item);
    }
    return out;
  }, [builtInKeys, learned, value]);
  const learnedKeys = useMemo(() => new Set(learned.map(keyOf)), [learned]);
  const pickedKeys = useMemo(() => new Set(value.map(keyOf)), [value]);
  const listOrder = useMemo(() => [...options, ...yours], [options, yours]);

  // Picks keep the list's order, whatever order they were picked in.
  const commit = (keys: Set<string>, extra?: string) => {
    const all = extra && !listOrder.some((item) => keyOf(item) === keyOf(extra)) ? [...listOrder, extra] : listOrder;
    onChange(all.filter((item) => keys.has(keyOf(item))));
  };
  const toggleValue = (item: string) => {
    const next = new Set(pickedKeys);
    if (next.has(keyOf(item))) next.delete(keyOf(item));
    else next.add(keyOf(item));
    commit(next);
  };

  const typed = query.trim();
  const matches = (item: string) => !typed || item.toLowerCase().includes(typed.toLowerCase());
  const exact = typed ? listOrder.find((item) => keyOf(item) === keyOf(typed)) : undefined;
  const addValue = () => {
    if (!typed) return;
    if (exact) {
      if (!pickedKeys.has(keyOf(exact))) toggleValue(exact);
    } else {
      commit(new Set([...pickedKeys, keyOf(typed)]), typed);
    }
    setQuery("");
  };

  const shownBuiltIns = options.filter(matches);
  const shownYours = yours.filter(matches);
  const summary = value.join(", ");

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        role="combobox"
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        data-value={summary}
        disabled={disabled}
        onClick={toggle}
        title={summary || undefined}
        className={cn(className, "flex items-center justify-between gap-2 text-left")}
      >
        <span className={cn("min-w-0 flex-1 truncate", !summary && "text-[var(--muted-foreground)]")}>
          {summary || placeholder}
        </span>
        <PickerChevron open={open} />
      </button>
      {open && (
        <PickerWindow title={label} anchorRef={triggerRef} onClose={close}>
          <div className="flex min-h-0 flex-1 flex-col" data-component="OvMultiPick">
            <PickerSearch
              inputRef={searchRef}
              listId={listId}
              label={addLabel}
              value={query}
              onChange={setQuery}
              onKeyDown={(event) => {
                // Enter on a typed value the list lacks adds it; otherwise it toggles the ringed row.
                if (event.key === "Enter" && typed && !exact && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  addValue();
                  return;
                }
                onKey(event);
              }}
            />
            <div
              ref={listRef}
              id={listId}
              data-picker-list
              // On a touch screen the text box isn't focused (no keyboard popping up): the list takes the keys.
              data-picker-keys=""
              tabIndex={0}
              aria-label={label}
              onKeyDown={(event) => event.target === event.currentTarget && onKey(event)}
              className="mt-2 min-h-0 flex-1 overflow-y-auto overscroll-contain border-t border-foreground/10 p-1 outline-none"
            >
              {typed && !exact && (
                <PickRow
                  picked={false}
                  onClick={addValue}
                  art={<Plus size={14} aria-hidden="true" className="shrink-0 text-foreground/55" />}
                  title={t("game.setupPage.addValue", { value: typed })}
                />
              )}
              {shownBuiltIns.map((item) => (
                <PickRow
                  key={item}
                  multiple
                  picked={pickedKeys.has(keyOf(item))}
                  onClick={() => toggleValue(item)}
                  title={item}
                />
              ))}
              {shownYours.length > 0 && <GroupHeader>{t("game.setupPage.yours")}</GroupHeader>}
              {shownYours.map((item) => (
                <ForgettableRow
                  key={item}
                  label={t("ui.game.learnedoptionchips.forgetValue1", { value1: item })}
                  onForget={onForget && learnedKeys.has(keyOf(item)) ? () => onForget(item) : undefined}
                  row={
                    <PickRow
                      multiple
                      picked={pickedKeys.has(keyOf(item))}
                      onClick={() => toggleValue(item)}
                      title={item}
                    />
                  }
                />
              ))}
              {!typed && shownBuiltIns.length === 0 && shownYours.length === 0 && (
                <div className="px-5 py-8 text-center text-xs text-foreground/55">{t("ui.select.empty")}</div>
              )}
            </div>
          </div>
        </PickerWindow>
      )}
    </>
  );
}

export type IdeaItem = {
  value: string;
  label: string;
  icon?: ReactNode;
  /** Values the app learned from earlier games can be forgotten. */
  onForget?: () => void;
  /** Picks this idea its own way (a learned value replaces the text; a suggestion may add to it). */
  onPick?: () => void;
  /** The forget button's name ("Forget Haunted lighthouse"). */
  forgetLabel?: string;
  group?: string;
};

/**
 * A small menu button at the end of a text field: picking an idea fills the field. Replaces the rows of
 * suggestion chips under setting, goals and preferences.
 */
export function OvIdeasMenu({
  title,
  buttonLabel,
  icon,
  items,
  onPick,
  disabled,
}: {
  /** Titles the window and names the button. */
  title: string;
  /** Visible button text ("Ideas"). */
  buttonLabel: string;
  icon?: ReactNode;
  items: readonly IdeaItem[];
  onPick: (value: string) => void;
  disabled?: boolean;
}) {
  const { open, triggerRef, close, toggle } = useFieldWindow(disabled);
  const listId = useId();
  const listRef = useRef<HTMLDivElement>(null);
  const onKey = usePickerKeyboard({ listRef, searchRef: listRef, listId, query: "" });
  let lastGroup: string | undefined;
  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={title}
        title={title}
        disabled={disabled || items.length === 0}
        onClick={toggle}
        className="ov-ideas"
      >
        {icon ?? <Lightbulb size={13} aria-hidden="true" />}
        <span>{buttonLabel}</span>
      </button>
      {open && (
        <PickerWindow title={title} anchorRef={triggerRef} onClose={close} hug={items.length <= 8}>
          <div
            ref={listRef}
            id={listId}
            data-picker-list
            data-picker-keys=""
            data-component="OvIdeasMenu"
            tabIndex={0}
            aria-label={title}
            onKeyDown={(event) => event.target === event.currentTarget && onKey(event)}
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1 outline-none"
          >
            {items.map((item) => {
              const header = item.group && item.group !== lastGroup ? item.group : null;
              lastGroup = item.group;
              return (
                <div key={`${item.group ?? ""}:${item.value}`}>
                  {header ? <GroupHeader>{header}</GroupHeader> : null}
                  <ForgettableRow
                    label={item.forgetLabel ?? item.label}
                    onForget={item.onForget}
                    row={
                      <PickRow
                        picked={false}
                        art={item.icon}
                        onClick={() => {
                          if (item.onPick) item.onPick();
                          else onPick(item.value);
                          close();
                        }}
                        title={item.label}
                      />
                    }
                  />
                </div>
              );
            })}
          </div>
        </PickerWindow>
      )}
    </>
  );
}
