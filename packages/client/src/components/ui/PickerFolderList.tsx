// ──────────────────────────────────────────────
// PickerFolderList: the body of a preset / lorebook picker window. A search box over rows
// grouped by library folders, styled like CharacterPickerList. The window around it
// (PickerWindow) and the data (useLibraryFolders) belong to the caller.
// ──────────────────────────────────────────────
import { useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Check, ChevronDown, ChevronRight, Folder, FolderOpen, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { includesTextForMatch } from "@marinara-engine/shared";
import type { LibraryFolder } from "../../hooks/use-library-folders";
import { cn } from "../../lib/utils";

export type PickerFolderItem = { id: string; label: string; icon?: ReactNode };

export type PickerFolderListProps = {
  /** Already in display order. */
  items: PickerFolderItem[];
  folders: LibraryFolder[];
  selectedIds: readonly string[];
  multiple?: boolean;
  /** Single pick: picks the row. Multiple: toggles it. */
  onToggle: (id: string) => void;
  /** Multiple only: "Add all (N)" on a folder header, with the ids of that folder not yet selected. */
  onPickGroup?: (ids: string[]) => void;
  /** Placeholder and aria-label of the search box. */
  searchLabel: string;
  /** Shown when there are no items at all. */
  emptyLabel: string;
  /** Shown when the search matches nothing. */
  noMatchesLabel: string;
  /** Rows above the folders, never grouped (such as "None" for presets). */
  leadingItems?: PickerFolderItem[];
};

type Group = { id: string; name: string; items: PickerFolderItem[] };

const ROW = "flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors max-md:min-h-11";
const FOCUS_RING =
  "focus-visible:ring-2 focus-visible:ring-[var(--marinara-chat-chrome-focus-ring,currentColor)] focus-visible:outline-none";
const UNGROUPED_ID = "__ungrouped__";

export function PickerFolderList({
  items,
  folders,
  selectedIds,
  multiple = false,
  onToggle,
  onPickGroup,
  searchLabel,
  emptyLabel,
  noMatchesLabel,
  leadingItems,
}: PickerFolderListProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const query = search.trim();
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const listRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const toggleFolder = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const visibleLeading = useMemo(
    () =>
      query ? (leadingItems ?? []).filter((item) => includesTextForMatch(item.label, query)) : (leadingItems ?? []),
    [leadingItems, query],
  );
  const visibleItems = useMemo(
    () => (query ? items.filter((item) => includesTextForMatch(item.label, query)) : items),
    [items, query],
  );

  // Folders by sort order, each with the items it holds; the rest go in "Ungrouped".
  const groups = useMemo<Group[]>(() => {
    const byId = new Map(items.map((item) => [item.id, item]));
    const grouped = new Set<string>();
    const result: Group[] = [];
    [...folders]
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
      .forEach((folder) => {
        const members = new Set(folder.itemIds);
        const inFolder = items.filter((item) => members.has(item.id) && byId.has(item.id));
        if (inFolder.length === 0) return;
        inFolder.forEach((item) => grouped.add(item.id));
        result.push({ id: folder.id, name: folder.name, items: inFolder });
      });
    if (result.length === 0) return [];
    const rest = items.filter((item) => !grouped.has(item.id));
    if (rest.length > 0) result.push({ id: UNGROUPED_ID, name: t("ui.chat.personapicker.ungrouped"), items: rest });
    return result;
  }, [items, folders, t]);

  const rows = () =>
    Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>("[data-pick-row]:not(:disabled)") ?? []);

  const onSearchKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      rows()[0]?.focus();
    } else if (event.key === "Enter" && query) {
      // Only with a search: then the list is flat and the first match is the first row the user sees.
      event.preventDefault();
      const first = visibleLeading[0] ?? visibleItems[0];
      if (first) onToggle(first.id);
    }
  };

  const onListKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const all = rows();
    const index = all.indexOf(document.activeElement as HTMLButtonElement);
    if (index < 0) return;
    event.preventDefault();
    if (event.key === "ArrowDown") all[index + 1]?.focus();
    else if (index === 0) searchRef.current?.focus();
    else all[index - 1]?.focus();
  };

  const itemRow = (item: PickerFolderItem, indented: boolean) => {
    const picked = selectedSet.has(item.id);
    return (
      <button
        key={item.id}
        type="button"
        data-pick-row
        title={item.label}
        onClick={() => onToggle(item.id)}
        aria-pressed={multiple ? picked : undefined}
        aria-current={!multiple && picked ? "true" : undefined}
        className={cn(
          ROW,
          FOCUS_RING,
          picked && !multiple ? "bg-foreground/10 text-foreground" : "hover:bg-foreground/[0.06]",
          indented && "pl-6",
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
        {item.icon}
        <span className={cn("min-w-0 flex-1 truncate text-xs font-medium", picked && "text-foreground")}>
          {item.label}
        </span>
        {picked && !multiple && <Check size="0.875rem" className="ml-auto shrink-0 text-[var(--primary)]" />}
      </button>
    );
  };

  const groupBlock = (group: Group) => {
    const open = expanded.has(group.id);
    const addable =
      multiple && onPickGroup && group.id !== UNGROUPED_ID
        ? group.items.filter((item) => !selectedSet.has(item.id)).map((item) => item.id)
        : [];
    return (
      <div key={group.id}>
        <div className="flex items-center gap-1">
          <div className="min-w-0 flex-1">
            <button
              type="button"
              data-pick-row
              onClick={() => toggleFolder(group.id)}
              aria-expanded={open}
              className={cn(ROW, FOCUS_RING, "text-xs hover:bg-foreground/[0.06]")}
            >
              {open ? (
                <ChevronDown size="0.75rem" className="shrink-0 text-foreground/40" />
              ) : (
                <ChevronRight size="0.75rem" className="shrink-0 text-foreground/40" />
              )}
              {open ? (
                <FolderOpen size="0.875rem" className="shrink-0 text-foreground/45" />
              ) : (
                <Folder size="0.875rem" className="shrink-0 text-foreground/45" />
              )}
              <span className="min-w-0 flex-1 truncate font-semibold">{group.name}</span>
              <span className="text-[0.6875rem] tabular-nums text-foreground/45">{group.items.length}</span>
            </button>
          </div>
          {addable.length > 0 && (
            <button
              type="button"
              data-pick-row
              onClick={() => onPickGroup?.(addable)}
              className={cn(
                "shrink-0 rounded-lg px-2 py-1.5 text-[0.6875rem] font-medium text-[var(--primary)] hover:bg-foreground/[0.06] max-md:min-h-11",
                FOCUS_RING,
              )}
            >
              {t("ui.characterselect.addAll", { count: addable.length })}
            </button>
          )}
        </div>
        {open && group.items.map((item) => itemRow(item, true))}
      </div>
    );
  };

  const nothingMatches = query !== "" && visibleLeading.length === 0 && visibleItems.length === 0;
  const empty = items.length === 0 && (leadingItems?.length ?? 0) === 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <label className="mx-2 mt-2 flex items-center gap-2 rounded-lg border border-foreground/10 bg-foreground/[0.04] px-2.5 py-2 text-foreground/55 focus-within:border-foreground/25">
        <Search size="0.875rem" className="shrink-0" />
        <span className="sr-only">{searchLabel}</span>
        <input
          type="search"
          ref={searchRef}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onKeyDown={onSearchKey}
          placeholder={searchLabel}
          aria-label={searchLabel}
          className="min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-foreground/40 max-md:text-base"
        />
      </label>

      <div
        ref={listRef}
        onKeyDown={onListKey}
        className="mt-2 min-h-0 flex-1 overflow-y-auto overscroll-contain border-t border-foreground/10 p-1"
      >
        {empty ? (
          <div className="px-5 py-8 text-center text-xs text-foreground/55">{emptyLabel}</div>
        ) : nothingMatches ? (
          <div className="px-5 py-8 text-center text-xs text-foreground/55">{noMatchesLabel}</div>
        ) : query !== "" || groups.length === 0 ? (
          <>
            {visibleLeading.map((item) => itemRow(item, false))}
            {visibleItems.map((item) => itemRow(item, false))}
          </>
        ) : (
          <>
            {visibleLeading.length > 0 && (
              <>
                {visibleLeading.map((item) => itemRow(item, false))}
                <div className="mx-2 my-1 h-px bg-foreground/10" />
              </>
            )}
            {groups.map(groupBlock)}
          </>
        )}
      </div>
    </div>
  );
}
