// ──────────────────────────────────────────────
// Picker parts: the pieces every picker list is made of: the search box, the rows, the folder
// headers, "Add all" and the keyboard. CharacterPickerList (personas, characters) and
// PickerFolderList (presets, lorebooks) only bring their data; a change here reaches all of them.
// ──────────────────────────────────────────────
import { useEffect, useReducer, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from "react";
import { Check, ChevronDown, ChevronRight, Folder, FolderOpen, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "../../lib/utils";

/** Items in no folder get their own "Ungrouped" folder only from this many; fewer sit loose under the folders. */
export const UNGROUPED_FOLDER_MIN = 8;

const ROW = "flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors max-md:min-h-12";
// The keyboard ring: the search keeps focus, so the highlighted row is marked, not focused.
const ACTIVE_RING =
  "data-[active=true]:ring-2 data-[active=true]:ring-[var(--marinara-chat-chrome-focus-ring,currentColor)]";

export function PickerSearch({
  inputRef,
  listId,
  label,
  value,
  onChange,
  onKeyDown,
  autoFocus,
}: {
  inputRef: RefObject<HTMLInputElement | null>;
  listId: string;
  /** Placeholder and accessible name. */
  label: string;
  value: string;
  onChange: (value: string) => void;
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  autoFocus?: boolean;
}) {
  return (
    <label className="mx-2 mt-2 flex items-center gap-2 rounded-lg border border-foreground/10 bg-foreground/[0.04] px-2.5 py-2 text-foreground/55 focus-within:border-foreground/25">
      <Search size="0.875rem" className="shrink-0" />
      <span className="sr-only">{label}</span>
      <input
        type="search"
        ref={inputRef}
        aria-controls={listId}
        value={value}
        autoFocus={autoFocus}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder={label}
        className="min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-foreground/40 max-md:text-base"
      />
    </label>
  );
}

/**
 * The picker keyboard: the search keeps focus, arrows move a ring over the enabled
 * `[data-pick-row]` buttons in the list, Enter clicks the ringed one. Returns the search box's key handler.
 */
export function usePickerKeyboard({
  listRef,
  searchRef,
  listId,
  query,
}: {
  listRef: RefObject<HTMLElement | null>;
  searchRef: RefObject<HTMLInputElement | null>;
  listId: string;
  query: string;
}) {
  const [active, setActive] = useState(0);
  // The ring follows an element, not a number: virtual lists mount only the rows in view, so the
  // index of a row shifts while the list scrolls.
  const activeEl = useRef<HTMLButtonElement | null>(null);
  const [, redraw] = useReducer((n: number) => n + 1, 0);
  // A ring moved by the mouse never scrolls the list; only the arrow keys do.
  const fromPointer = useRef(false);
  // After a new search the ring returns to the first row, once the list has scrolled back to it.
  const ringFirst = useRef(true);
  const lastQuery = useRef(query);
  useEffect(() => {
    fromPointer.current = false;
    activeEl.current = null;
    ringFirst.current = true;
    listRef.current?.scrollTo?.({ top: 0 });
    setActive(0);
  }, [query]);
  const rows = () =>
    Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>("[data-pick-row]:not(:disabled)") ?? []);
  const activeIndex = (list: HTMLButtonElement[]) => {
    const at = activeEl.current ? list.indexOf(activeEl.current) : -1;
    if (at >= 0) return at;
    // The ringed row scrolled out of the mounted window: continue from the first row in view.
    const top = listRef.current?.getBoundingClientRect().top ?? 0;
    const inView = list.findIndex((row) => row.getBoundingClientRect().top >= top);
    return inView >= 0 ? inView : Math.min(active, list.length - 1);
  };
  // The ring follows the mouse, so arrows continue from the row under it. Touch is left out:
  // a scrolling finger would drag the ring along.
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      const row = (event.target as Element | null)?.closest?.("[data-pick-row]");
      const all = rows();
      const index = row ? all.indexOf(row as HTMLButtonElement) : -1;
      if (index < 0) return;
      fromPointer.current = true;
      activeEl.current = all[index]!;
      setActive(index);
    };
    list.addEventListener("pointermove", onPointerMove);
    return () => list.removeEventListener("pointermove", onPointerMove);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listRef]);
  // After every render, and whenever a virtual list mounts other rows: rows come and go as
  // folders open, searches change and the list scrolls.
  const mark = () => {
    const all = rows();
    if (!(activeEl.current && all.includes(activeEl.current)) && all.length && (listRef.current?.scrollTop ?? 0) <= 2) {
      activeEl.current = all[ringFirst.current ? 0 : Math.min(active, all.length - 1)]!;
      ringFirst.current = false;
    }
    all.forEach((row, i) => {
      row.id = `${listId}-row-${i}`;
      if (row === activeEl.current) row.dataset.active = "true";
      else delete row.dataset.active;
    });
    const activeRow = activeEl.current && all.includes(activeEl.current) ? activeEl.current : null;
    if (activeRow) searchRef.current?.setAttribute("aria-activedescendant", activeRow.id);
    else searchRef.current?.removeAttribute("aria-activedescendant");
  };
  const markRef = useRef(mark);
  markRef.current = mark;
  useEffect(mark);
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    let frame = 0;
    const observer = new MutationObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => markRef.current());
    });
    observer.observe(list, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [listRef]);
  useEffect(() => {
    const searched = lastQuery.current !== query;
    lastQuery.current = query;
    if (fromPointer.current) {
      fromPointer.current = false;
      return;
    }
    if (!searched) activeEl.current?.scrollIntoView?.({ block: "nearest" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, query]);
  // A virtual list mounts the far end only after it scrolls there; wrap once it has.
  const wrapping = useRef(false);
  const wrapTo = (end: "first" | "last") => {
    const list = listRef.current;
    if (list) list.scrollTop = end === "first" ? 0 : list.scrollHeight;
    // Wait for the virtual rows at the new scroll position to mount.
    wrapping.current = true;
    window.setTimeout(() => {
      wrapping.current = false;
      const all = rows();
      const row = end === "first" ? all[0] : all[all.length - 1];
      if (!row) return;
      activeEl.current = row;
      setActive(end === "first" ? 0 : all.length - 1);
      redraw();
    }, 150);
  };
  return (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
    const all = rows();
    const count = all.length;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      // A hover over the already-ringed row leaves the flag set; the keys always scroll.
      fromPointer.current = false;
      if (!count || wrapping.current) return;
      const down = event.key === "ArrowDown";
      const next = activeIndex(all) + (down ? 1 : -1);
      if (next < 0 || next >= count) {
        // Past the mounted rows is only the end of the list once the list has scrolled there.
        const list = listRef.current;
        if (list && (down ? list.scrollTop + list.clientHeight < list.scrollHeight - 2 : list.scrollTop > 2)) {
          list.scrollBy({ top: (down ? 1 : -1) * list.clientHeight * 0.5 });
        } else wrapTo(down ? "first" : "last");
        return;
      }
      activeEl.current = all[next]!;
      setActive(next);
      redraw();
    } else if (event.key === "Enter") {
      event.preventDefault();
      all[activeIndex(all)]?.click();
    }
  };
}

export function PickRow({
  picked,
  multiple,
  onClick,
  art,
  title,
  subtitle,
  badge,
  indented,
  disabledReason,
  busy,
}: {
  picked: boolean;
  multiple?: boolean;
  onClick: () => void;
  /** The avatar or picture at the start of the row. */
  art?: ReactNode;
  title: string;
  subtitle?: string | null;
  badge?: ReactNode;
  indented?: boolean;
  /** Greys the row out, with this as the subtitle. */
  disabledReason?: string;
  busy?: boolean;
}) {
  const disabled = disabledReason !== undefined;
  return (
    <button
      type="button"
      data-pick-row
      title={title}
      disabled={disabled || busy}
      onClick={onClick}
      aria-pressed={multiple ? picked : undefined}
      aria-current={!multiple && picked ? "true" : undefined}
      className={cn(
        ROW,
        "relative",
        ACTIVE_RING,
        picked && !multiple ? "bg-foreground/10 text-foreground" : "hover:bg-foreground/[0.06]",
        indented && "pl-6",
        disabled && "cursor-default opacity-45 hover:bg-transparent",
      )}
    >
      {multiple && (
        <span
          aria-hidden="true"
          className={cn(
            "flex h-[1.125rem] w-[1.125rem] shrink-0 items-center justify-center rounded-[0.3125rem] border-[1.5px]",
            picked
              ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]"
              : "border-foreground/35",
          )}
        >
          {picked && <Check size="0.75rem" strokeWidth={3} />}
        </span>
      )}
      {art}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={cn("truncate text-xs font-medium", picked && "text-foreground")}>{title}</span>
        {(disabledReason ?? subtitle) && (
          <span className="truncate text-[0.6875rem] leading-tight text-foreground/50">
            {disabledReason ?? subtitle}
          </span>
        )}
      </span>
      {badge}
      {picked && !multiple && <Check size="0.875rem" className="ml-auto shrink-0 text-[var(--primary)]" />}
    </button>
  );
}

export function FolderToggle({
  open,
  onClick,
  label,
  count,
  icon,
}: {
  open: boolean;
  onClick: () => void;
  label: string;
  count: ReactNode;
  /** Replaces the folder icon (such as "Play as a character"). */
  icon?: ReactNode;
}) {
  return (
    <button
      type="button"
      data-pick-row
      onClick={onClick}
      aria-expanded={open}
      className={cn(ROW, "text-xs hover:bg-foreground/[0.06]", ACTIVE_RING)}
    >
      {open ? (
        <ChevronDown size="0.75rem" className="shrink-0 text-foreground/40" />
      ) : (
        <ChevronRight size="0.75rem" className="shrink-0 text-foreground/40" />
      )}
      {icon ??
        (open ? (
          <FolderOpen size="0.875rem" className="shrink-0 text-foreground/45" />
        ) : (
          <Folder size="0.875rem" className="shrink-0 text-foreground/45" />
        ))}
      <span className="min-w-0 flex-1 truncate font-semibold">{label}</span>
      <span className="text-[0.6875rem] tabular-nums text-foreground/45">{count}</span>
    </button>
  );
}

/** A folder that cannot collapse (the only one): a plain label instead of a toggle. */
export function FolderLabel({ label, count }: { label: string; count: ReactNode }) {
  return (
    <div className="flex min-h-9 items-center gap-2 px-2 text-xs">
      <FolderOpen size="0.875rem" className="shrink-0 text-foreground/45" />
      <span className="min-w-0 flex-1 truncate font-semibold">{label}</span>
      <span className="text-[0.6875rem] tabular-nums text-foreground/45">{count}</span>
    </div>
  );
}

/**
 * A folder block: its header (toggle or label), "Add all (N)" when `addable` has ids, and its rows when open.
 */
export function PickerFolder({
  header,
  addable,
  onAdd,
  busy,
  open,
  children,
}: {
  header: ReactNode;
  addable: readonly string[];
  onAdd?: (ids: string[]) => void;
  busy?: boolean;
  open: boolean;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <div>
      <div className="flex items-center gap-1">
        <div className="min-w-0 flex-1">{header}</div>
        {addable.length > 0 && onAdd && (
          <button
            type="button"
            data-pick-row
            disabled={busy}
            onClick={() => onAdd([...addable])}
            className={cn(
              "shrink-0 rounded-lg px-2 py-1.5 text-[0.6875rem] font-medium text-[var(--primary)] hover:bg-foreground/[0.06] max-md:min-h-12",
              ACTIVE_RING,
            )}
          >
            {t("ui.characterselect.addAll", { count: addable.length })}
          </button>
        )}
      </div>
      {open && children}
    </div>
  );
}

/** The thin line under leading rows such as None. */
export function PickerDivider() {
  return <div className="mx-2 my-1 h-px bg-foreground/10" />;
}
