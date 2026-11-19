// ──────────────────────────────────────────────
// Picker fields: a trigger that opens PickerWindow with a searchable PickerFolderList.
// PickerField picks one item (a pick closes the window); PickerListField picks several and
// lists them under the trigger with a remove button each. The library pickers (presets,
// lorebooks), the settings-profile field and the profile builder are built on these.
// ──────────────────────────────────────────────
import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { Ban, ChevronDown, Trash2, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { LibraryFolder } from "../../hooks/use-library-folders";
import { cn } from "../../lib/utils";
import { PickerFolderList, type PickerFolderItem } from "./PickerFolderList";
import { PickerWindow } from "./PickerWindow";

/** Size of the picture in a picker row. */
export const PICKER_ROW_ART = "h-8 w-8 rounded-lg";

/**
 * An item's picture: its image, or an icon on its library's gradient (`.mari-panel-gradient--<type>`),
 * like presets fall back to the presets gradient with a page.
 */
export function PickerTileArt({
  src,
  type,
  icon: Icon,
  className = PICKER_ROW_ART,
}: {
  src?: string | null;
  /** The library colour: connections, agents, personas, settings, backgrounds, characters… */
  type: string;
  icon: LucideIcon;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden",
        src ? "bg-[var(--muted)]" : `mari-panel-gradient-surface mari-panel-gradient--${type}`,
        className,
      )}
    >
      {src ? (
        <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" draggable={false} />
      ) : (
        <Icon size="0.875rem" />
      )}
    </span>
  );
}

/** The None row's picture: a dashed square with the ban icon, like the character picker's None. */
export function PickerNoneArt() {
  return (
    <span
      aria-hidden="true"
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-dashed border-foreground/35 text-foreground/40"
    >
      <Ban size="0.8rem" />
    </span>
  );
}

type TriggerData = Record<`data-${string}`, string | undefined>;

type ListTexts = {
  /** Placeholder and aria-label of the search box. */
  searchLabel: string;
  /** Shown when there are no items at all. */
  emptyLabel: string;
  /** Shown when the search matches nothing. */
  noMatchesLabel: string;
};

export type PickerFieldProps = ListTexts & {
  /** Item id, or "" for none. */
  value: string;
  /** Already in display order; `icon` is the row's picture. */
  items: readonly PickerFolderItem[];
  folders?: readonly LibraryFolder[];
  /** Names the trigger and, unless `title` is set, titles the window. */
  ariaLabel: string;
  title?: string;
  /** Adds a None row (id "") above the list, and is the trigger text when nothing is picked. */
  noneLabel?: string;
  /** Trigger text when `value` is set but not in the list, or empty with no None row. */
  missingLabel?: string;
  /** The field look of the surface it sits in (wizard input, drawer select). */
  triggerClassName: string;
  /** Tooltip on the trigger. */
  triggerTitle?: string;
  /** Hooks for tests and styles, such as `data-preset-picker-trigger`. */
  triggerData?: TriggerData;
  disabled?: boolean;
  onChange: (value: string) => void;
};

/** Open state of a field's picker window; closing returns focus to the trigger. Shared with Select. */
export function useFieldWindow(disabled: boolean | undefined) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const restoreRef = useRef(false);
  // Read while rendering, before the disabled attribute lands and the browser drops focus to the page: was the
  // window open, or did the field itself have focus (a pick closes the window, then the save disables the field)?
  const wasDisabledRef = useRef(disabled);
  if (disabled && !wasDisabledRef.current && (open || document.activeElement === triggerRef.current)) {
    restoreRef.current = true;
  }
  wasDisabledRef.current = disabled;
  // The window goes away if the field turns disabled while it is open (such as during a save or a refetch). Focus
  // was in the window, so it falls to the page; once the field is enabled again it takes the focus back, unless the
  // user has moved on to something else meanwhile (#5642).
  useEffect(() => {
    if (disabled) {
      setOpen(false);
      return;
    }
    if (!restoreRef.current) return;
    restoreRef.current = false;
    const active = document.activeElement;
    if (!active || active === document.body) triggerRef.current?.focus({ preventScroll: true });
  }, [disabled]);
  const close = () => {
    setOpen(false);
    // Without a scroll: a popover closed because its field scrolled away must not pull the field back into view.
    triggerRef.current?.focus({ preventScroll: true });
  };
  const toggle = () => (open ? close() : setOpen(true));
  return { open: open && !disabled, triggerRef, close, toggle };
}

export function PickerChevron({ open }: { open: boolean }) {
  return (
    <ChevronDown
      size="0.75rem"
      aria-hidden="true"
      className={cn("shrink-0 text-[var(--muted-foreground)] transition-transform", open && "rotate-180")}
    />
  );
}

// A single-pick field, like the persona and character pickers: search, an optional None row and
// the caller's folders. A pick closes the window.
export function PickerField({
  value,
  items,
  folders,
  ariaLabel,
  title,
  noneLabel,
  missingLabel,
  triggerClassName,
  triggerTitle,
  triggerData,
  disabled,
  onChange,
  searchLabel,
  emptyLabel,
  noMatchesLabel,
}: PickerFieldProps) {
  const { open, triggerRef, close, toggle } = useFieldWindow(disabled);
  const leadingItems = noneLabel === undefined ? undefined : [{ id: "", label: noneLabel, icon: <PickerNoneArt /> }];
  const fallback = noneLabel ?? missingLabel ?? "";
  const selectedLabel = value ? (items.find((item) => item.id === value)?.label ?? missingLabel ?? fallback) : fallback;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        {...triggerData}
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        title={triggerTitle}
        disabled={disabled}
        onClick={toggle}
        className={cn(triggerClassName, "flex items-center justify-between gap-2 pr-3 text-left")}
      >
        <span className="min-w-0 flex-1 truncate">{selectedLabel}</span>
        <PickerChevron open={open} />
      </button>
      {open && (
        <PickerWindow title={title ?? ariaLabel} anchorRef={triggerRef} onClose={close}>
          <PickerFolderList
            items={items}
            folders={folders ?? []}
            selectedIds={[value]}
            leadingItems={leadingItems}
            onToggle={(id) => {
              // Re-picking the current choice is no change: callers such as the conversation prompt
              // reset other state on a change, which the old select never fired for.
              if (id !== value) onChange(id);
              close();
            }}
            searchLabel={searchLabel}
            emptyLabel={emptyLabel}
            noMatchesLabel={noMatchesLabel}
          />
        </PickerWindow>
      )}
    </>
  );
}

/** A row of a several-items field; `smallIcon` is its picture in the picked rows under the trigger. */
export type PickerListItem = PickerFolderItem & { smallIcon?: ReactNode };

// The several-items window: search, checkboxes and the caller's folders ("Add all" per folder),
// titled with the count. It stays open while picking; the caller owns the trigger and open state.
export function PickerListWindow({
  title,
  anchorRef,
  items,
  folders,
  selectedIds,
  onToggle,
  onAdd,
  onClose,
  searchLabel,
  emptyLabel,
  noMatchesLabel,
}: ListTexts & {
  /** The window's title; the picked count is added after it. */
  title: string;
  anchorRef: RefObject<HTMLElement | null>;
  items: readonly PickerFolderItem[];
  folders?: readonly LibraryFolder[];
  selectedIds: readonly string[];
  onToggle: (id: string) => void;
  /** "Add all" on a folder, with the ids of that folder not yet selected. */
  onAdd: (ids: string[]) => void;
  onClose: () => void;
}) {
  const count = selectedIds.filter((id) => items.some((item) => item.id === id)).length;
  return (
    <PickerWindow title={count > 0 ? title + " · " + count : title} anchorRef={anchorRef} onClose={onClose}>
      <PickerFolderList
        items={items}
        folders={folders ?? []}
        selectedIds={selectedIds}
        multiple
        onToggle={onToggle}
        onPickGroup={onAdd}
        searchLabel={searchLabel}
        emptyLabel={emptyLabel}
        noMatchesLabel={noMatchesLabel}
      />
    </PickerWindow>
  );
}

// A several-items field (New Chat lorebook step, agents' fixed sources, the profile builder): a
// trigger that opens the list window, with the picked items listed under it, a remove button each.
export function PickerListField({
  items,
  folders,
  selectedIds,
  onToggle,
  onAdd,
  title,
  triggerLabel,
  triggerIcon,
  triggerClassName,
  triggerData,
  ariaLabel,
  removeLabel,
  keepMissing = false,
  disabled,
  searchLabel,
  emptyLabel,
  noMatchesLabel,
}: ListTexts & {
  items: readonly PickerListItem[];
  folders?: readonly LibraryFolder[];
  selectedIds: readonly string[];
  onToggle: (id: string) => void;
  onAdd: (ids: string[]) => void;
  /** The window's title; the picked count is added after it. */
  title: string;
  /** The trigger's text, such as "Choose lorebooks". */
  triggerLabel: string;
  triggerIcon?: ReactNode;
  /** The field look of the surface it sits in. */
  triggerClassName: string;
  triggerData?: TriggerData;
  /** Names the trigger, when a visible label isn't tied to it. */
  ariaLabel?: string;
  /** Accessible name of a picked row's remove button. */
  removeLabel: (name: string) => string;
  /** Lists picked ids that aren't in `items` (deleted, not loaded) by their id, so they can be removed. */
  keepMissing?: boolean;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const { open, triggerRef, close, toggle } = useFieldWindow(disabled);
  const picked = selectedIds.flatMap((id): PickerListItem[] => {
    const item = items.find((entry) => entry.id === id);
    if (item) return [item];
    return keepMissing ? [{ id, label: id }] : [];
  });

  return (
    <div className="space-y-2">
      <button
        ref={triggerRef}
        type="button"
        {...triggerData}
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={disabled}
        onClick={toggle}
        className={cn(triggerClassName, "flex items-center justify-between gap-2 pr-3 text-left")}
      >
        {triggerIcon}
        <span className="min-w-0 flex-1 truncate text-[var(--muted-foreground)]">{triggerLabel}</span>
        <PickerChevron open={open} />
      </button>
      {picked.length > 0 && (
        <div className="flex flex-col gap-1">
          {picked.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-2.5 rounded-lg bg-[var(--primary)]/10 px-3 py-2 ring-1 ring-[var(--primary)]/30"
            >
              {item.smallIcon}
              <span className="min-w-0 flex-1 truncate text-xs">{item.label}</span>
              {item.badge}
              <button
                type="button"
                disabled={disabled}
                onClick={() => onToggle(item.id)}
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[var(--muted-foreground)] transition-colors hover:bg-[var(--destructive)]/15 hover:text-[var(--destructive)] disabled:opacity-50 max-md:-my-2 max-md:h-11 max-md:w-11"
                title={t("settings.notifications.customSound.actions.remove")}
                aria-label={removeLabel(item.label)}
              >
                <Trash2 size="0.6875rem" />
              </button>
            </div>
          ))}
        </div>
      )}
      {open && (
        <PickerListWindow
          title={title}
          anchorRef={triggerRef}
          items={items}
          folders={folders}
          selectedIds={selectedIds}
          onToggle={onToggle}
          onAdd={onAdd}
          onClose={close}
          searchLabel={searchLabel}
          emptyLabel={emptyLabel}
          noMatchesLabel={noMatchesLabel}
        />
      )}
    </div>
  );
}
