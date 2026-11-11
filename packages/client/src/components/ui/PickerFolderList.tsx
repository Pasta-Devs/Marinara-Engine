// ──────────────────────────────────────────────
// PickerFolderList: the body of a preset / lorebook picker window. A search box over rows
// grouped by library folders, built from the same PickerParts as CharacterPickerList. The
// window around it (PickerWindow) and the data (useLibraryFolders) belong to the caller.
// ──────────────────────────────────────────────
import { useId, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { includesTextForMatch } from "@marinara-engine/shared";
import type { LibraryFolder } from "../../hooks/use-library-folders";
import {
  FolderToggle,
  PickerDivider,
  PickerFolder,
  PickerSearch,
  PickRow,
  UNGROUPED_FOLDER_MIN,
  usePickerKeyboard,
} from "./PickerParts";

export type PickerFolderItem = {
  id: string;
  label: string;
  icon?: ReactNode;
  /** Second line under the label. */
  subtitle?: string | null;
  /** Greys the row out, with this as its second line. */
  disabledReason?: string;
  /** Extra text the search matches besides the label (such as a description). */
  searchText?: string;
  /** A small mark after the label (such as "OFF"). */
  badge?: ReactNode;
};

const matches = (item: PickerFolderItem, query: string) =>
  includesTextForMatch(item.searchText ? item.label + " " + item.searchText : item.label, query);

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
  const [touchedExpanded, setTouchedExpanded] = useState<Set<string> | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const onSearchKey = usePickerKeyboard({ listRef, searchRef, listId, query });

  const visibleLeading = useMemo(
    () => (query ? (leadingItems ?? []).filter((item) => matches(item, query)) : (leadingItems ?? [])),
    [leadingItems, query],
  );
  const visibleItems = useMemo(() => (query ? items.filter((item) => matches(item, query)) : items), [items, query]);

  // Folders by sort order, each with the items it holds. Items in no folder sit loose under the
  // folders, like the panels show them; only a long tail of them collapses into "Ungrouped".
  const { groups, loose } = useMemo<{ groups: Group[]; loose: PickerFolderItem[] }>(() => {
    const grouped = new Set<string>();
    const result: Group[] = [];
    [...folders]
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
      .forEach((folder) => {
        const members = new Set(folder.itemIds);
        const inFolder = items.filter((item) => members.has(item.id));
        if (inFolder.length === 0) return;
        inFolder.forEach((item) => grouped.add(item.id));
        result.push({ id: folder.id, name: folder.name, items: inFolder });
      });
    if (result.length === 0) return { groups: [], loose: [] };
    const rest = items.filter((item) => !grouped.has(item.id));
    if (rest.length < UNGROUPED_FOLDER_MIN) return { groups: result, loose: rest };
    result.push({ id: UNGROUPED_ID, name: t("ui.chat.personapicker.ungrouped"), items: rest });
    return { groups: result, loose: [] };
  }, [items, folders, t]);

  // Folders start collapsed, except that a single pick opens the folder holding the current choice,
  // so the window shows what is picked. That start follows the folder data until the user opens or
  // closes a folder, since folders may load late.
  const picked = !multiple && selectedIds[0] ? selectedIds[0] : null;
  const initialExpanded = useMemo(() => {
    const holder = picked ? groups.find((group) => group.items.some((item) => item.id === picked)) : undefined;
    return holder ? new Set([holder.id]) : new Set<string>();
  }, [picked, groups]);
  const expanded = touchedExpanded ?? initialExpanded;

  const toggleFolder = (id: string) => {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setTouchedExpanded(next);
  };

  const itemRow = (item: PickerFolderItem, indented: boolean) => (
    <PickRow
      key={item.id}
      picked={selectedSet.has(item.id)}
      multiple={multiple}
      onClick={() => onToggle(item.id)}
      art={item.icon}
      title={item.label}
      subtitle={item.subtitle}
      disabledReason={item.disabledReason}
      badge={item.badge}
      indented={indented}
    />
  );

  const groupBlock = (group: Group) => {
    const open = expanded.has(group.id);
    const addable =
      multiple && onPickGroup && group.id !== UNGROUPED_ID
        ? group.items.filter((item) => !selectedSet.has(item.id) && !item.disabledReason).map((item) => item.id)
        : [];
    return (
      <PickerFolder
        key={group.id}
        header={
          <FolderToggle
            open={open}
            onClick={() => toggleFolder(group.id)}
            label={group.name}
            count={group.items.length}
          />
        }
        addable={addable}
        onAdd={onPickGroup}
        open={open}
      >
        {group.items.map((item) => itemRow(item, true))}
      </PickerFolder>
    );
  };

  const nothingMatches = query !== "" && visibleLeading.length === 0 && visibleItems.length === 0;
  const empty = items.length === 0 && (leadingItems?.length ?? 0) === 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PickerSearch
        inputRef={searchRef}
        listId={listId}
        label={searchLabel}
        value={search}
        onChange={setSearch}
        onKeyDown={onSearchKey}
      />

      <div
        ref={listRef}
        id={listId}
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
                <PickerDivider />
              </>
            )}
            {groups.map(groupBlock)}
            {loose.map((item) => itemRow(item, false))}
          </>
        )}
      </div>
    </div>
  );
}
