import { useState } from "react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { Search, X } from "lucide-react";
import { parseGreeting } from "../../lib/character-greetings";
import { cn } from "../../lib/utils";

const fieldBox =
  "grid gap-0.5 rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-2.5 py-1.5 focus-within:border-[var(--primary)]/40 focus-within:ring-1 focus-within:ring-[var(--primary)]/20";
const fieldLabel = "text-[0.625rem] font-medium uppercase tracking-wide text-[var(--muted-foreground)]";
const fieldInput =
  "min-w-0 bg-transparent text-sm outline-none placeholder:text-[var(--muted-foreground)]/60 max-md:min-h-9 max-sm:text-base";
const chip =
  "inline-flex max-w-full items-center gap-0.5 rounded-full border border-[var(--border)] px-1.5 text-[0.6875rem] text-[var(--muted-foreground)]";

/** Search box and tag chips over a long greeting list; picked tags must all match. */
export function GreetingListFilter({
  query,
  onQuery,
  tags,
  picked,
  onPicked,
  shown,
  total,
}: {
  query: string;
  onQuery: (query: string) => void;
  tags: string[];
  picked: string[];
  onPicked: (picked: string[]) => void;
  shown: number;
  total: number;
}) {
  const { t: localizeUi } = useUiTranslation();
  return (
    <div className="grid gap-2">
      <div className="relative">
        <Search
          size="0.875rem"
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]"
        />
        <input
          type="search"
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          aria-label={localizeUi("ui.chat.swipepicker.searchLabel")}
          placeholder={localizeUi("ui.chat.swipepicker.searchPlaceholder")}
          autoComplete="off"
          spellCheck={false}
          className="h-9 w-full rounded-lg max-md:h-11 border border-[var(--border)] bg-[var(--secondary)] pl-9 pr-3 text-sm outline-none placeholder:text-[var(--muted-foreground)] focus:border-[var(--primary)]/40 focus:ring-1 focus:ring-[var(--primary)]/20 max-sm:text-base"
        />
      </div>
      {(tags.length > 0 || picked.length > 0) && (
        <div
          role="group"
          aria-label={localizeUi("ui.chat.swipepicker.filterLabel")}
          className="flex flex-wrap items-center gap-1.5"
        >
          {tags.map((tag) => {
            const on = picked.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                aria-pressed={on}
                onClick={() => onPicked(on ? picked.filter((value) => value !== tag) : [...picked, tag])}
                className={cn(
                  "inline-flex h-7 items-center rounded-full border px-2.5 text-xs transition-colors max-md:h-9",
                  on
                    ? "border-[var(--primary)] bg-[var(--primary)] font-semibold text-[var(--primary-foreground)]"
                    : "border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--secondary)]",
                )}
              >
                {tag}
              </button>
            );
          })}
          {picked.length > 0 && (
            <button
              type="button"
              onClick={() => onPicked([])}
              className="inline-flex h-7 items-center gap-1 rounded-full px-2 text-xs text-[var(--primary)] max-md:h-9"
            >
              <X size="0.75rem" aria-hidden="true" />
              {localizeUi("ui.chat.swipepicker.clearTags", { count: picked.length })}
            </button>
          )}
        </div>
      )}
      {(query.trim() || picked.length > 0) && (
        <p aria-live="polite" className="text-xs text-[var(--muted-foreground)]">
          {shown
            ? localizeUi("ui.chat.swipepicker.countFiltered", { shown, total })
            : localizeUi("ui.chat.swipepicker.empty")}
        </p>
      )}
    </div>
  );
}

/** A folded greeting: number, title, tags and one line of text. */
export function GreetingRow({
  number,
  text,
  allowTags,
  onOpen,
}: {
  number: number;
  text: string;
  allowTags: boolean;
  onOpen: () => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const entry = parseGreeting(text, allowTags);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="grid w-full grid-cols-[2rem_minmax(0,1fr)] gap-x-2 rounded-xl border border-[var(--border)] bg-[var(--secondary)]/40 px-3 py-2 text-left transition-colors hover:bg-[var(--secondary)]"
    >
      <span className="row-span-2 pt-0.5 text-right text-xs tabular-nums text-[var(--muted-foreground)]">{number}</span>
      <span className="flex min-w-0 items-center gap-1.5">
        <span className="truncate text-sm font-semibold">
          {entry.title || localizeUi("ui.chat.swipepicker.untitled")}
        </span>
        {entry.tags.map((tag) => (
          <span key={tag} className={cn(chip, "shrink-0")}>
            {tag}
          </span>
        ))}
      </span>
      {entry.preview && <span className="truncate text-xs text-[var(--muted-foreground)]">{entry.preview}</span>}
    </button>
  );
}

/** Title and Tags fields of an open greeting; they edit the header line of the text. */
export function GreetingHeaderFields({
  id,
  title,
  titlePlaceholder,
  tags,
  tagOptions,
  onChange,
}: {
  id: string;
  title: string;
  titlePlaceholder: string;
  tags: string[];
  tagOptions: string[];
  onChange: (tags: string[], title: string) => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const [draft, setDraft] = useState("");
  const addDraft = () => {
    const tag = draft.replace(/[[\]\n]/g, "").trim();
    setDraft("");
    if (tag && !tags.includes(tag)) onChange([...tags, tag], title);
  };
  return (
    // The whole box is the touch target: a tap anywhere on it focuses its input.
    <div
      className="grid gap-2 sm:grid-cols-2"
      onClick={(event) => {
        const box = (event.target as HTMLElement).closest("[data-field-box]");
        if (box && event.target === box) box.querySelector("input")?.focus();
      }}
    >
      <div data-field-box className={fieldBox}>
        <label htmlFor={`greeting-title-${id}`} className={fieldLabel}>
          {localizeUi("ui.characters.dialoguetab.greetingTitle")}
        </label>
        <input
          id={`greeting-title-${id}`}
          value={title}
          maxLength={80}
          placeholder={titlePlaceholder}
          onChange={(event) => onChange(tags, event.target.value.replace(/[*()\n]/g, ""))}
          className={fieldInput}
        />
      </div>
      <div data-field-box className={fieldBox}>
        <label htmlFor={`greeting-tags-${id}`} className={fieldLabel}>
          {localizeUi("ui.characters.dialoguetab.greetingTags")}
        </label>
        <div className="flex flex-wrap items-center gap-1">
          {tags.map((tag) => (
            <span key={tag} className={chip}>
              <span className="truncate">{tag}</span>
              <button
                type="button"
                onClick={() =>
                  onChange(
                    tags.filter((value) => value !== tag),
                    title,
                  )
                }
                aria-label={localizeUi("ui.characters.dialoguetab.removeGreetingTag", { tag })}
                className="-mr-1 inline-flex h-4 w-4 items-center justify-center rounded-full hover:text-[var(--foreground)]"
              >
                <X size="0.625rem" aria-hidden="true" />
              </button>
            </span>
          ))}
          <input
            id={`greeting-tags-${id}`}
            list={`greeting-tag-options-${id}`}
            value={draft}
            maxLength={24}
            placeholder={tags.length ? "" : localizeUi("ui.characters.dialoguetab.addGreetingTag")}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === ",") {
                event.preventDefault();
                addDraft();
              } else if (event.key === "Backspace" && !draft && tags.length) {
                onChange(tags.slice(0, -1), title);
              }
            }}
            onBlur={addDraft}
            className={cn(fieldInput, "w-20 flex-1 [&::-webkit-calendar-picker-indicator]:hidden")}
          />
          <datalist id={`greeting-tag-options-${id}`}>
            {tagOptions
              .filter((tag) => !tags.includes(tag))
              .map((tag) => (
                <option key={tag} value={tag} />
              ))}
          </datalist>
        </div>
      </div>
    </div>
  );
}
