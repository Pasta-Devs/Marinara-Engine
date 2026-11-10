// ──────────────────────────────────────────────
// UI overhaul: Library landing pages as compact tables
//
// Lorebooks, Presets, Regex scripts, Connections and Agents each get a title
// with Import / New, one toolbar row (search, filter chips, List/Gallery where
// items have pictures, sort) and a dense table. Clicking a row opens its editor.
// ──────────────────────────────────────────────
import { placeholderArt } from "../../lib/placeholder-art";
import { Fragment, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import {
  CheckSquare,
  Copy,
  Download,
  LayoutGrid,
  List,
  Plus,
  Power,
  PowerOff,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { BUILT_IN_AGENTS, isAgentConfigDeleted, isRetiredBuiltInAgentId, type Lorebook } from "@marinara-engine/shared";
import { useUIStore } from "../../stores/ui.store";
import { useOverhaulMobile } from "../../stores/overhaul.store";
import {
  useCreateLorebook,
  useDeleteLorebook,
  useLorebooks,
  useSetLorebooksEnabled,
  useUpdateLorebook,
} from "../../hooks/use-lorebooks";
import { useLibraryOrder } from "../../hooks/use-library-order";
import { duplicateLorebook } from "../../lib/lorebook-duplicate";
import { api } from "../../lib/api-client";
import { useDeletePreset, useDuplicatePreset, usePresets } from "../../hooks/use-presets";
import { useAgentConfigs, type AgentConfigRow } from "../../hooks/use-agents";
import { useCapabilityAgentRegistry } from "../../hooks/use-capability-packages";
import {
  useDeleteRegexScript,
  useImportRegexScript,
  useRegexScripts,
  useReorderRegexScripts,
  useUpdateRegexScript,
  type RegexScriptRow,
} from "../../hooks/use-regex-scripts";
import { downloadJsonFile } from "../../lib/download-json";
import { useLocalizedUiText } from "../../localization/use-localized-ui-text";
import { formatRelativeContact } from "../../lib/relative-time";
import { resolvePresetArtwork } from "../../lib/preset-artwork";
import { cn } from "../../lib/utils";
import {
  getImportEntries,
  getNextRegexOrderBase,
  normalizeRegexImportEntry,
  serializeRegexScript,
} from "../panels/PresetsPanel";
import { insertLibraryItems, type InsertEdge } from "../../lib/library-order";
import {
  KitBulkBar,
  KitCheck,
  KitFolderHead,
  KitMoreButton,
  KitNewFolderButton,
  KitSelectButton,
  folderActions,
  groupByFolder,
  kitDelete,
  kitExport,
  moveToFolderAction,
  useKitMenu,
  useKitSelection,
  useScopeFolders,
  useKitRowDrag,
  useSuppressClick,
  type KitAction,
  type KitFolder,
  type KitFolders,
  type KitSelection,
} from "./LibraryKit";
import { TagFilter, countItemTags, matchesPickedTags } from "./TagFilter";

// ── Shared pieces ──

type Column<T> = {
  key: string;
  label: string;
  className?: string;
  render: (row: T) => ReactNode;
};

type Chip = { id: string; label: string };

/** Section and group orders can arrive as stored JSON text: count the ids, not the characters. */
function orderCount(order: unknown): number {
  if (Array.isArray(order)) return order.length;
  if (typeof order !== "string") return 0;
  try {
    const parsed: unknown = JSON.parse(order);
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}
export function swatch(id: string) {
  return placeholderArt(id, 35, 160, [55, 55, 45, 30]);
}

export function Thumb({ id, src }: { id: string; src?: string | null }) {
  return (
    <span
      className="ov-thumb"
      style={src ? undefined : { background: `var(--mari-card-art-placeholder, ${swatch(id)})` }}
      aria-hidden="true"
    >
      {src ? <img src={src} alt="" loading="lazy" /> : null}
    </span>
  );
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (next: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      className={cn("ov-switch", on && "is-on")}
      onClick={(event) => {
        event.stopPropagation();
        onChange(!on);
      }}
    >
      <span />
    </button>
  );
}

function relative(iso: string | null | undefined) {
  if (!iso) return "—";
  return formatRelativeContact(iso) ?? "—";
}

/** What a page hands ListPage to get Select, "⋯" menus, folders and My order (LibraryKit). */
export type ListKit<T> = {
  selection: KitSelection;
  menu: ReturnType<typeof useKitMenu>;
  rowTitle: (row: T) => string;
  rowActions: (row: T) => KitAction[];
  bulkActions: KitAction[];
  folders?: KitFolders | null;
  /** Manual order kind (shared with the classic panels) and its reorder; rows become draggable. */
  drag?: { kind: string; reorder?: (ids: string[], target: string, edge: InsertEdge, visibleIds: string[]) => void };
  /** Search or a filter is on: folders with no matching rows step aside. */
  filtering: boolean;
};

function ListPage<T extends { id: string }>({
  title,
  actions,
  searchPlaceholder,
  search,
  onSearch,
  searchExtra,
  chips,
  chip,
  onChip,
  toolsEnd,
  view,
  rows,
  columns,
  onOpen,
  leading,
  gallery,
  empty,
  kit,
}: {
  title: string;
  actions: ReactNode;
  searchPlaceholder: string;
  search: string;
  onSearch: (value: string) => void;
  /** Right after the search box, such as the tag selector. */
  searchExtra?: ReactNode;
  chips?: Chip[];
  chip?: string;
  onChip?: (id: string) => void;
  toolsEnd?: ReactNode;
  /** The List / Gallery switch; on phones it moves up beside + New. */
  view?: ReactNode;
  rows: T[];
  columns: Column<T>[];
  onOpen: (row: T) => void;
  leading?: (row: T) => ReactNode;
  gallery?: { on: boolean; render: (row: T, extra?: GalleryExtra) => ReactNode };
  empty: string;
  kit?: ListKit<T>;
}) {
  const localize = useLocalizedUiText();
  // New layout on phones: the filter chips become one dropdown beside + New, the view switch
  // sits at the end of that line, and the sort shares the search bar's line.
  const mobile = useOverhaulMobile();
  // Many filters read as one dropdown on desktop too (like Connections' "All kinds"), so the toolbar stays on one line.
  const chipsAsSelect = !!chips?.length && (mobile || chips.length > 3);
  const suppress = useSuppressClick();
  const byId = useMemo(() => new Map(rows.map((row) => [row.id, row])), [rows]);
  const openRowMenu = (row: T, at: { x: number; y: number }) =>
    kit?.menu.open(kit.rowTitle(row), kit.rowActions(row), at);
  const bindDrag = useKitRowDrag({
    kind: kit?.drag?.kind ?? "ov-none",
    reorder: kit?.drag?.reorder,
    folders: kit?.folders,
    selection: kit?.selection ?? NO_SELECTION,
    suppress,
    onHold: (id) => {
      const row = byId.get(id);
      const el = document.querySelector<HTMLElement>(`[data-drag-id="${CSS.escape(id)}"]`);
      const rect = el?.getBoundingClientRect();
      if (row) openRowMenu(row, { x: rect?.left ?? 0, y: rect?.bottom ?? 0 });
    },
  });
  const activate = (row: T) => {
    if (suppress.blocked()) return;
    if (kit?.selection.on) kit.selection.toggle(row.id);
    else onOpen(row);
  };
  const rowProps = (row: T, folderId: string | null) => ({
    ...(kit?.drag ? bindDrag(row.id, folderId) : {}),
    onContextMenu: kit
      ? (event: ReactMouseEvent<HTMLElement>) => kit.menu.openFromEvent(event, kit.rowTitle(row), kit.rowActions(row))
      : undefined,
  });
  const { groups, loose } = groupByFolder(rows, kit?.folders ?? null, !!kit?.filtering);
  const chipSelect = chips?.length ? (
    <select
      className={cn("ov-select", mobile && "ovm-lp-filter")}
      value={chip}
      onChange={(event) => onChip?.(event.target.value)}
      aria-label={localize("Filter")}
    >
      {chips.map((item) => (
        <option key={item.id} value={item.id}>
          {item.id === "all" ? localize(mobile ? "All" : "All kinds") : localize(item.label)}
        </option>
      ))}
    </select>
  ) : null;
  const selecting = !!kit?.selection.on;
  const colCount = columns.length + (leading ? 1 : 0) + (selecting ? 1 : 0) + (kit ? 1 : 0);
  const folderHead = (folder: KitFolder, count: number) =>
    kit?.folders ? (
      <KitFolderHead
        folder={folder}
        count={count}
        dragKind={kit.drag?.kind}
        collapsed={kit.folders.isCollapsed(folder)}
        onToggle={() => kit.folders!.toggleCollapsed(folder)}
        onMenu={(event, anchor) =>
          kit.menu.openFromEvent(event, folder.name, folderActions(kit.folders!, folder), anchor)
        }
      />
    ) : null;
  const tableRow = (row: T, folderId: string | null) => (
    <tr
      key={row.id}
      tabIndex={0}
      className={cn(folderId && "is-in-folder", kit?.selection.has(row.id) && "is-selected")}
      onClick={() => activate(row)}
      onKeyDown={(event) => {
        if (event.key === "Enter") activate(row);
      }}
      {...rowProps(row, folderId)}
    >
      {selecting ? (
        <td className="ov-table__check">
          <KitCheck checked={kit!.selection.has(row.id)} label={kit!.rowTitle(row)} />
        </td>
      ) : null}
      {leading ? <td className="ov-table__lead">{leading(row)}</td> : null}
      {columns.map((column) => (
        <td key={column.key} className={column.className}>
          {column.render(row)}
        </td>
      ))}
      {kit ? (
        <td className="ov-table__more">
          <KitMoreButton
            label={localize("More actions")}
            onOpen={(event) => kit.menu.openFromEvent(event, kit.rowTitle(row), kit.rowActions(row), "button")}
          />
        </td>
      ) : null}
    </tr>
  );
  const galleryItem = (row: T, folderId: string | null) => {
    const extra: GalleryExtra = {
      selecting,
      selected: !!kit?.selection.has(row.id),
      onActivate: () => activate(row),
      props: rowProps(row, folderId),
      more: kit ? (
        <KitMoreButton
          className="ov-card__more"
          label={localize("More actions")}
          onOpen={(event) => kit.menu.openFromEvent(event, kit.rowTitle(row), kit.rowActions(row), "button")}
        />
      ) : null,
    };
    return gallery!.render(row, extra);
  };
  return (
    <section className="ov-list" data-component="OverhaulLibraryList">
      <header className="ov-gallery__head">
        <h1 data-mari-part="page-title">{title}</h1>
        {kit?.folders ? <KitNewFolderButton folders={kit.folders} /> : null}
        {kit ? <KitSelectButton selection={kit.selection} /> : null}
        {actions}
        {mobile ? chipSelect : null}
        {mobile ? view : null}
      </header>
      <div className="ov-gallery__tools">
        <label className="ov-search">
          <Search size={14} aria-hidden="true" />
          <input value={search} onChange={(event) => onSearch(event.target.value)} placeholder={searchPlaceholder} />
        </label>
        {searchExtra}
        {!mobile && chipsAsSelect ? chipSelect : null}
        {(chipsAsSelect ? [] : (chips ?? [])).map((item) => (
          <button
            key={item.id}
            type="button"
            className={cn("ov-pill", chip === item.id && "is-on")}
            aria-pressed={chip === item.id}
            onClick={() => onChip?.(item.id)}
          >
            {localize(item.label)}
          </button>
        ))}
        <span className="ov-gallery__spacer" />
        {mobile ? null : view}
        {toolsEnd}
      </div>
      {rows.length === 0 && groups.length === 0 ? (
        <p className="ov-list__empty">{empty}</p>
      ) : gallery?.on ? (
        <div className="ov-gallery__grid">
          {groups.map(({ folder, rows: members }) => (
            <Fragment key={`folder:${folder.id}`}>
              <div className="ov-kit-folder-cell">{folderHead(folder, members.length)}</div>
              {kit?.folders?.isCollapsed(folder) ? null : members.map((row) => galleryItem(row, folder.id))}
            </Fragment>
          ))}
          {groups.length > 0 && loose.length > 0 ? (
            <div className="ov-kit-folder-cell ov-kit-loose">{localize("Not in a folder")}</div>
          ) : null}
          {loose.map((row) => galleryItem(row, null))}
        </div>
      ) : (
        <div className="ov-table-wrap">
          <table className="ov-table">
            <thead>
              <tr>
                {selecting ? (
                  <th className="ov-table__check">
                    <button
                      type="button"
                      onClick={kit!.selection.toggleAll}
                      aria-label={localize(kit!.selection.allSelected ? "Select none" : "Select all")}
                    >
                      <KitCheck checked={kit!.selection.allSelected} label={localize("Select all")} />
                    </button>
                  </th>
                ) : null}
                {leading ? <th className="ov-table__lead" aria-hidden="true" /> : null}
                {columns.map((column) => (
                  <th key={column.key} className={column.className}>
                    {localize(column.label)}
                  </th>
                ))}
                {kit ? <th className="ov-table__more" aria-hidden="true" /> : null}
              </tr>
            </thead>
            <tbody>
              {groups.map(({ folder, rows: members }) => (
                <Fragment key={`folder:${folder.id}`}>
                  <tr className="ov-table__folder">
                    <td colSpan={colCount}>{folderHead(folder, members.length)}</td>
                  </tr>
                  {kit?.folders?.isCollapsed(folder) ? null : members.map((row) => tableRow(row, folder.id))}
                </Fragment>
              ))}
              {loose.map((row) => tableRow(row, null))}
            </tbody>
          </table>
        </div>
      )}
      {kit ? <KitBulkBar selection={kit.selection} actions={kit.bulkActions} /> : null}
      {kit?.menu.node}
    </section>
  );
}

const NO_SELECTION = {
  on: false,
  has: () => false,
  list: [] as string[],
} as unknown as KitSelection;

/** Extra bits ListPage hands a gallery tile: selection state, drag/right-click props and the "⋯" button. */
export type GalleryExtra = {
  selecting: boolean;
  selected: boolean;
  onActivate: () => void;
  props: Record<string, unknown>;
  more: ReactNode;
};

export function ViewSwitch({ gallery, onChange }: { gallery: boolean; onChange: (gallery: boolean) => void }) {
  const localize = useLocalizedUiText();
  const mobile = useOverhaulMobile();
  if (mobile) {
    // Phones: two icon buttons, like the composer's toggles.
    return (
      <div className="ovm-lp-view" role="group" aria-label={localize("View")}>
        <button
          type="button"
          className={cn(!gallery && "is-on")}
          aria-pressed={!gallery}
          aria-label={localize("List")}
          onClick={() => onChange(false)}
        >
          <List size={18} aria-hidden="true" />
        </button>
        <button
          type="button"
          className={cn(gallery && "is-on")}
          aria-pressed={gallery}
          aria-label={localize("Gallery")}
          onClick={() => onChange(true)}
        >
          <LayoutGrid size={18} aria-hidden="true" />
        </button>
      </div>
    );
  }
  return (
    <div className="ov-seg" role="group" aria-label={localize("View")}>
      <button type="button" className={cn(!gallery && "is-on")} onClick={() => onChange(false)}>
        <List size={13} aria-hidden="true" />
        {localize("List")}
      </button>
      <button type="button" className={cn(gallery && "is-on")} onClick={() => onChange(true)}>
        <LayoutGrid size={13} aria-hidden="true" />
        {localize("Gallery")}
      </button>
    </div>
  );
}

function SortSelect<K extends string>({
  value,
  onChange,
  options,
}: {
  value: K;
  onChange: (value: K) => void;
  options: { id: K; label: string }[];
}) {
  const localize = useLocalizedUiText();
  return (
    <select
      className="ov-select"
      value={value}
      onChange={(event) => onChange(event.target.value as K)}
      aria-label={localize("Sort")}
    >
      {options.map((option) => (
        <option key={option.id} value={option.id}>
          {localize(option.label)}
        </option>
      ))}
    </select>
  );
}

type SortKey = "recent" | "name-asc" | "name-desc";
const SORTS: { id: SortKey; label: string }[] = [
  { id: "recent", label: "Recently edited" },
  { id: "name-asc", label: "A to Z" },
  { id: "name-desc", label: "Z to A" },
];

/** Bulk "On or off ›": two choices in one button so the selection bar stays on one line. */
function onOffAction(set: (enabled: boolean) => void): KitAction {
  return {
    key: "onoff",
    label: "On or off",
    icon: <Power size={14} />,
    submenu: [
      { key: "on", label: "Turn on", icon: <Power size={14} />, onSelect: () => set(true) },
      { key: "off", label: "Turn off", icon: <PowerOff size={14} />, onSelect: () => set(false) },
    ],
  };
}

type OrderSortKey = SortKey | "custom";
const ORDER_SORTS: { id: OrderSortKey; label: string }[] = [...SORTS, { id: "custom", label: "My order" }];

function sortRows<T extends { name: string; updatedAt?: string }>(rows: T[], sort: SortKey) {
  const list = [...rows];
  if (sort === "name-asc") return list.sort((a, b) => a.name.localeCompare(b.name));
  if (sort === "name-desc") return list.sort((a, b) => b.name.localeCompare(a.name));
  return list.sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));
}

function NewButton({ label, onClick }: { label: string; onClick: () => void }) {
  // Phones show just "+ New": the page title already names the kind of item.
  const mobile = useOverhaulMobile();
  const localize = useLocalizedUiText();
  return (
    <button type="button" className="ov-btn ov-btn--primary" onClick={onClick} aria-label={label}>
      <Plus size={14} aria-hidden="true" />
      {mobile ? localize("New") : label}
    </button>
  );
}

function GalleryTile({
  id,
  name,
  sub,
  src,
  onOpen,
  extra,
}: {
  id: string;
  name: string;
  sub: string;
  src?: string | null;
  onOpen: () => void;
  extra?: GalleryExtra;
}) {
  const open = extra?.onActivate ?? onOpen;
  return (
    <div key={id} className={cn("ov-card", extra?.selected && "is-selected")} {...(extra?.props ?? {})}>
      <button
        type="button"
        className="ov-card__art ov-card__art--square"
        onClick={open}
        style={src ? undefined : { background: swatch(id) }}
        aria-label={name}
        data-drag-surface
      >
        {src ? <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" /> : null}
        {extra?.selecting ? (
          <span className="ov-card__check">
            <KitCheck checked={extra.selected} label={name} />
          </span>
        ) : null}
      </button>
      {extra?.more}
      <button type="button" className="ov-card__name" onClick={open} data-drag-surface>
        {name}
      </button>
      <p className="ov-card__tags">{sub}</p>
    </div>
  );
}

// ── Lorebooks ──

const LOREBOOK_CATEGORY_LABEL: Record<string, string> = {
  world: "World",
  character: "Character",
  npc: "NPC",
  spellbook: "Spellbook",
  uncategorized: "Uncategorized",
};

export function LorebooksLanding() {
  const localize = useLocalizedUiText();
  const { data } = useLorebooks();
  const updateLorebook = useUpdateLorebook();
  const createLorebook = useCreateLorebook();
  const deleteLorebook = useDeleteLorebook();
  const setEnabled = useSetLorebooksEnabled();
  const openModal = useUIStore((s) => s.openModal);
  const openLorebookDetail = useUIStore((s) => s.openLorebookDetail);
  const [search, setSearch] = useState("");
  const [chip, setChip] = useState("all");
  const [gallery, setGallery] = useState(false);
  const order = useLibraryOrder("lorebook");
  const [baseSort, setBaseSort] = useState<SortKey>("recent");
  const sort: OrderSortKey = order.active ? "custom" : baseSort;
  const setSort = (next: OrderSortKey) => {
    if (next === "custom") order.setActive(true);
    else {
      if (order.active) order.setActive(false);
      setBaseSort(next);
    }
  };
  const folders = useScopeFolders("lorebooks", localize("lorebooks"));
  const menu = useKitMenu();

  // The tag selector beside search (several tags narrow to books with all of them).
  const [pickedTags, setPickedTags] = useState<string[]>([]);
  const tagCounts = useMemo(() => countItemTags((data ?? []).map((book) => ({ tags: book.tags ?? [] }))), [data]);
  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const tagQuery = needle.startsWith("tag:") ? needle.slice(4).trim() : null;
    const list = (data ?? []).filter((book) => {
      if (!matchesPickedTags(book.tags ?? [], pickedTags)) return false;
      if (chip === "global" && !book.isGlobal) return false;
      if (chip !== "all" && chip !== "global" && book.category !== chip) return false;
      if (!needle) return true;
      if (tagQuery !== null) return (book.tags ?? []).some((tag) => tag.toLowerCase().includes(tagQuery));
      return (
        book.name.toLowerCase().includes(needle) ||
        book.description?.toLowerCase().includes(needle) ||
        book.tags?.some((tag) => tag.toLowerCase().includes(needle))
      );
    });
    return sort === "custom" ? order.orderItems(sortRows(list, "name-asc")) : sortRows(list, sort);
  }, [chip, data, order, pickedTags, search, sort]);
  const selection = useKitSelection(rows.map((row) => row.id));
  const duplicate = async (book: Lorebook) => {
    try {
      const id = await duplicateLorebook(book, (input) => createLorebook.mutateAsync(input));
      toast.success(`${localize("Copied")} ${book.name}`);
      openLorebookDetail(id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : localize("Couldn't copy the lorebook."));
    }
  };
  const removeMany = async (ids: string[], names?: string) => {
    const failed = await kitDelete(ids, (id) => deleteLorebook.mutateAsync(id), {
      noun: localize("lorebooks"),
      localize,
      names,
    });
    if (failed) selection.set(new Set(failed));
    if (failed && !failed.length) selection.stop();
  };
  const kit: ListKit<Lorebook> = {
    selection,
    menu,
    folders,
    filtering: !!search.trim() || chip !== "all" || pickedTags.length > 0,
    drag: { kind: "lorebook", reorder: order.reorder },
    rowTitle: (book) => book.name,
    rowActions: (book) => [
      { key: "dup", label: "Duplicate", icon: <Copy size={14} />, onSelect: () => void duplicate(book) },
      moveToFolderAction(folders, () => [book.id], folders.folderOf(book.id)),
      {
        key: "export",
        label: "Export",
        icon: <Upload size={14} />,
        onSelect: () => void api.download(`/lorebooks/${book.id}/export?format=native`),
      },
      { key: "select", label: "Select", icon: <CheckSquare size={14} />, onSelect: () => selection.start(book.id) },
      {
        key: "delete",
        label: "Delete",
        icon: <Trash2 size={14} />,
        danger: true,
        onSelect: () => void removeMany([book.id], `"${book.name}"`),
      },
    ],
    bulkActions: [
      moveToFolderAction(folders, () => selection.list, null),
      onOffAction((enabled) => setEnabled.mutate({ ids: selection.list, enabled })),
      {
        key: "export",
        label: "Export",
        icon: <Upload size={14} />,
        onSelect: () => void kitExport("/lorebooks/export-bulk", selection.list, "marinara-lorebooks.zip", localize),
      },
      {
        key: "delete",
        label: "Delete",
        icon: <Trash2 size={14} />,
        danger: true,
        onSelect: () => void removeMany(selection.list),
      },
    ],
  };

  const activeIn = (book: Lorebook) => {
    if (book.isGlobal) return localize("Global");
    const parts: string[] = [];
    const characters = book.characterIds?.length ?? (book.characterId ? 1 : 0);
    const personas = book.personaIds?.length ?? (book.personaId ? 1 : 0);
    if (characters) parts.push(`${characters} ${localize(characters === 1 ? "character" : "characters")}`);
    if (personas) parts.push(`${personas} ${localize(personas === 1 ? "persona" : "personas")}`);
    if (book.chatId) parts.push(localize("1 chat"));
    return parts.join(" · ") || "—";
  };

  return (
    <ListPage
      title={localize("Lorebooks")}
      actions={
        <>
          <button type="button" className="ov-btn" onClick={() => openModal("import-lorebook")}>
            <Download size={14} aria-hidden="true" />
            {localize("Import")}
          </button>
          <NewButton label={localize("New lorebook")} onClick={() => openModal("create-lorebook")} />
        </>
      }
      searchPlaceholder={localize("Search lorebooks")}
      search={search}
      onSearch={setSearch}
      searchExtra={
        tagCounts.tags.length || pickedTags.length ? (
          <TagFilter tags={tagCounts.tags} untagged={tagCounts.untagged} picked={pickedTags} onChange={setPickedTags} />
        ) : null
      }
      chips={[
        { id: "all", label: "All" },
        { id: "global", label: "Global" },
        { id: "world", label: "World" },
        { id: "character", label: "Character" },
        { id: "npc", label: "NPC" },
        { id: "spellbook", label: "Spellbook" },
      ]}
      chip={chip}
      onChip={setChip}
      view={<ViewSwitch gallery={gallery} onChange={setGallery} />}
      toolsEnd={<SortSelect value={sort} onChange={setSort} options={ORDER_SORTS} />}
      kit={kit}
      rows={rows}
      onOpen={(book) => openLorebookDetail(book.id)}
      leading={(book) => (
        <Toggle
          on={book.enabled}
          label={localize(book.enabled ? "Disable lorebook" : "Enable lorebook")}
          onChange={(enabled) => updateLorebook.mutate({ id: book.id, enabled })}
        />
      )}
      columns={[
        {
          key: "name",
          label: "Lorebook",
          className: "ov-table__name",
          render: (book) => (
            <span className="ov-table__title">
              <Thumb id={book.id} src={book.imagePath} />
              <span>{book.name}</span>
            </span>
          ),
        },
        {
          key: "category",
          label: "Category",
          render: (book) => localize(LOREBOOK_CATEGORY_LABEL[book.category] ?? book.category),
        },
        {
          key: "entries",
          label: "Entries",
          className: "ov-table__num",
          render: (book) => (book.entryCount ?? "—").toLocaleString(),
        },
        { key: "active", label: "Active in", render: activeIn },
        { key: "updated", label: "Updated", render: (book) => relative(book.updatedAt) },
      ]}
      gallery={{
        on: gallery,
        render: (book, extra) => (
          <GalleryTile
            key={book.id}
            extra={extra}
            id={book.id}
            name={book.name}
            sub={`${localize(LOREBOOK_CATEGORY_LABEL[book.category] ?? book.category)} · ${book.entryCount ?? 0} ${localize("entries")}`}
            src={book.imagePath}
            onOpen={() => openLorebookDetail(book.id)}
          />
        ),
      }}
      empty={localize("No lorebooks yet.")}
    />
  );
}

// ── Presets ──

export function PresetsLanding() {
  const localize = useLocalizedUiText();
  const { data } = usePresets();
  const duplicatePreset = useDuplicatePreset();
  const deletePreset = useDeletePreset();
  const openModal = useUIStore((s) => s.openModal);
  const openPresetDetail = useUIStore((s) => s.openPresetDetail);
  const [search, setSearch] = useState("");
  const [chip, setChip] = useState("all");
  const [gallery, setGallery] = useState(false);
  const order = useLibraryOrder("preset");
  const [baseSort, setBaseSort] = useState<SortKey>("recent");
  const sort: OrderSortKey = order.active ? "custom" : baseSort;
  const setSort = (next: OrderSortKey) => {
    if (next === "custom") order.setActive(true);
    else {
      if (order.active) order.setActive(false);
      setBaseSort(next);
    }
  };
  const folders = useScopeFolders("presets", localize("presets"));
  const menu = useKitMenu();

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const list = (data ?? []).filter((preset) => {
      if (chip === "defaults" && !preset.isDefault) return false;
      if (!needle) return true;
      return preset.name.toLowerCase().includes(needle) || preset.description?.toLowerCase().includes(needle);
    });
    return sort === "custom" ? order.orderItems(sortRows(list, "name-asc")) : sortRows(list, sort);
  }, [chip, data, order, search, sort]);
  const selection = useKitSelection(rows.map((row) => row.id));
  type PresetRow = (typeof rows)[number];
  const removeMany = async (ids: string[], names?: string) => {
    const failed = await kitDelete(ids, (id) => deletePreset.mutateAsync(id), {
      noun: localize("presets"),
      localize,
      names,
    });
    if (failed) selection.set(new Set(failed));
    if (failed && !failed.length) selection.stop();
  };
  const kit: ListKit<PresetRow> = {
    selection,
    menu,
    folders,
    filtering: !!search.trim() || chip !== "all",
    drag: { kind: "preset", reorder: order.reorder },
    rowTitle: (preset) => preset.name,
    rowActions: (preset) => [
      {
        key: "dup",
        label: "Duplicate",
        icon: <Copy size={14} />,
        onSelect: () =>
          void duplicatePreset
            .mutateAsync(preset.id)
            .then((copy) => {
              toast.success(`${localize("Copied")} ${preset.name}`);
              openPresetDetail(copy.id);
            })
            .catch((error: unknown) =>
              toast.error(error instanceof Error ? error.message : localize("Couldn't copy the preset.")),
            ),
      },
      moveToFolderAction(folders, () => [preset.id], folders.folderOf(preset.id)),
      {
        key: "export",
        label: "Export",
        icon: <Upload size={14} />,
        onSelect: () => void api.download(`/prompts/${preset.id}/export`),
      },
      { key: "select", label: "Select", icon: <CheckSquare size={14} />, onSelect: () => selection.start(preset.id) },
      {
        key: "delete",
        label: "Delete",
        icon: <Trash2 size={14} />,
        danger: true,
        disabled: preset.isDefault,
        onSelect: () => void removeMany([preset.id], `"${preset.name}"`),
      },
    ],
    bulkActions: [
      moveToFolderAction(folders, () => selection.list, null),
      {
        key: "export",
        label: "Export",
        icon: <Upload size={14} />,
        onSelect: () => void kitExport("/prompts/export-bulk", selection.list, "marinara-presets.zip", localize),
      },
      {
        key: "delete",
        label: "Delete",
        icon: <Trash2 size={14} />,
        danger: true,
        onSelect: () =>
          void removeMany(selection.list.filter((id) => !(data ?? []).find((p) => p.id === id)?.isDefault)),
      },
    ],
  };

  return (
    <ListPage
      title={localize("Presets")}
      actions={
        <>
          <button type="button" className="ov-btn" onClick={() => openModal("import-preset")}>
            <Download size={14} aria-hidden="true" />
            {localize("Import")}
          </button>
          <NewButton label={localize("New preset")} onClick={() => openModal("create-preset")} />
        </>
      }
      searchPlaceholder={localize("Search presets")}
      search={search}
      onSearch={setSearch}
      chips={[
        { id: "all", label: "All" },
        { id: "defaults", label: "Defaults" },
      ]}
      chip={chip}
      onChip={setChip}
      view={<ViewSwitch gallery={gallery} onChange={setGallery} />}
      toolsEnd={<SortSelect value={sort} onChange={setSort} options={ORDER_SORTS} />}
      kit={kit}
      rows={rows}
      onOpen={(preset) => openPresetDetail(preset.id)}
      columns={[
        {
          key: "name",
          label: "Preset",
          className: "ov-table__name",
          render: (preset) => (
            <span className="ov-table__title">
              <Thumb id={preset.id} src={resolvePresetArtwork(preset)} />
              <span>{preset.name}</span>
            </span>
          ),
        },
        {
          key: "description",
          label: "Description",
          className: "ov-table__desc",
          render: (preset) => preset.description || "—",
        },
        {
          key: "sections",
          label: "Sections",
          className: "ov-table__num",
          render: (preset) => orderCount(preset.sectionOrder),
        },
        { key: "author", label: "Author", render: (preset) => preset.author || "—" },
        {
          key: "default",
          label: "Default",
          render: (preset) => (preset.isDefault ? localize("Default") : "—"),
        },
        { key: "updated", label: "Updated", render: (preset) => relative(preset.updatedAt) },
      ]}
      gallery={{
        on: gallery,
        render: (preset, extra) => (
          <GalleryTile
            key={preset.id}
            extra={extra}
            id={preset.id}
            name={preset.name}
            sub={`${orderCount(preset.sectionOrder)} ${localize("sections")}`}
            src={resolvePresetArtwork(preset)}
            onOpen={() => openPresetDetail(preset.id)}
          />
        ),
      }}
      empty={localize("No presets yet.")}
    />
  );
}

// ── Regex scripts ──

export function parseList(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export const REGEX_PLACEMENT_LABEL: Record<string, string> = {
  user_input: "User",
  ai_output: "AI",
  world_info: "Lore",
  reasoning: "Reasoning",
  slash_command: "Commands",
};

/** Import regex scripts from a JSON file, appended after the current run order. */
export function useRegexImport() {
  const localize = useLocalizedUiText();
  const { data } = useRegexScripts();
  const importRegex = useImportRegexScript();
  return async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text());
      const entries = getImportEntries(parsed, ["regexScripts", "regexes", "scripts"]);
      const base = getNextRegexOrderBase((data ?? []) as RegexScriptRow[]);
      let imported = 0;
      for (const [index, entry] of entries.entries()) {
        const normalized = normalizeRegexImportEntry(entry, base + index);
        if (!normalized) continue;
        await importRegex.mutateAsync(normalized);
        imported += 1;
      }
      if (imported) toast.success(`${localize("Imported")} ${imported}`);
      else toast.error(localize("No valid regex scripts found in file."));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : localize("Failed to import regex scripts"));
    }
  };
}

/** Duplicate, export, delete and on/off for regex scripts: shared by the list page and the Regex viewer. */
export function useRegexKitActions(allScripts: RegexScriptRow[], selection: KitSelection) {
  const localize = useLocalizedUiText();
  const updateRegex = useUpdateRegexScript();
  const deleteRegex = useDeleteRegexScript();
  const importRegex = useImportRegexScript();
  const exportScripts = (scripts: RegexScriptRow[]) =>
    void downloadJsonFile(
      {
        kind: "marinara.regex-scripts",
        version: 1,
        exportedAt: new Date().toISOString(),
        regexScripts: scripts.map(serializeRegexScript),
      },
      scripts.length === 1 ? `${scripts[0]!.name || "regex"}.json` : "marinara-regexes.json",
    );
  const setEnabledMany = (ids: string[], enabled: boolean) =>
    void Promise.all(ids.map((id) => updateRegex.mutateAsync({ id, enabled })));
  const removeMany = async (ids: string[], names?: string) => {
    const failed = await kitDelete(ids, (id) => deleteRegex.mutateAsync(id), {
      noun: localize("scripts"),
      localize,
      names,
    });
    // The open script went away: let the viewer open the first one left.
    const ui = useUIStore.getState();
    if (failed && ui.regexDetailId && ids.includes(ui.regexDetailId) && !failed.includes(ui.regexDetailId))
      ui.closeRegexDetail();
    if (failed) selection.set(new Set(failed));
    if (failed && !failed.length) selection.stop();
  };
  const rowActions = (script: RegexScriptRow): KitAction[] => [
    {
      key: "dup",
      label: "Duplicate",
      icon: <Copy size={14} />,
      onSelect: () => {
        const entry = normalizeRegexImportEntry(
          { ...serializeRegexScript(script), name: `${script.name} (Copy)` },
          getNextRegexOrderBase(allScripts),
        );
        if (entry)
          void importRegex.mutateAsync(entry).then(() => toast.success(`${localize("Copied")} ${script.name}`));
      },
    },
    { key: "export", label: "Export", icon: <Upload size={14} />, onSelect: () => exportScripts([script]) },
    { key: "select", label: "Select", icon: <CheckSquare size={14} />, onSelect: () => selection.start(script.id) },
    {
      key: "delete",
      label: "Delete",
      icon: <Trash2 size={14} />,
      danger: true,
      onSelect: () => void removeMany([script.id], `"${script.name}"`),
    },
  ];
  const bulkActions: KitAction[] = [
    onOffAction((enabled) => setEnabledMany(selection.list, enabled)),
    {
      key: "export",
      label: "Export",
      icon: <Upload size={14} />,
      onSelect: () => exportScripts(allScripts.filter((script) => selection.has(script.id))),
    },
    {
      key: "delete",
      label: "Delete",
      icon: <Trash2 size={14} />,
      danger: true,
      onSelect: () => void removeMany(selection.list),
    },
  ];
  return { rowActions, bulkActions };
}

export function RegexLanding() {
  const localize = useLocalizedUiText();
  const { data } = useRegexScripts();
  const updateRegex = useUpdateRegexScript();
  const reorderRegex = useReorderRegexScripts();
  const menu = useKitMenu();
  const openRegexDetail = useUIStore((s) => s.openRegexDetail);
  const fileRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [chip, setChip] = useState("all");
  const [sort, setSort] = useState<"order" | SortKey>("order");

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const list = ((data ?? []) as RegexScriptRow[]).filter((script) => {
      const enabled = script.enabled === "true";
      if (chip === "on" && !enabled) return false;
      if (chip === "off" && enabled) return false;
      if (
        chip === "scoped" &&
        !parseList(script.targetCharacterIds).length &&
        !parseList(script.targetPromptPresetIds).length
      )
        return false;
      if (!needle) return true;
      return script.name.toLowerCase().includes(needle) || script.findRegex.toLowerCase().includes(needle);
    });
    if (sort === "order") return [...list].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    return sortRows(list, sort);
  }, [chip, data, search, sort]);

  const handleImport = useRegexImport();
  const selection = useKitSelection(rows.map((row) => row.id));
  const allScripts = useMemo(
    () => [...((data ?? []) as RegexScriptRow[])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [data],
  );
  const regexActions = useRegexKitActions(allScripts, selection);
  const kit: ListKit<RegexScriptRow> = {
    selection,
    menu,
    filtering: !!search.trim() || chip !== "all",
    // Run order is the scripts' own order: dragging a row changes it, like the classic panel.
    drag:
      sort === "order"
        ? {
            kind: "regex",
            reorder: (ids, target, edge) => {
              const next = insertLibraryItems(
                allScripts.map((script) => script.id),
                ids,
                target,
                edge,
              );
              reorderRegex.mutate(next);
            },
          }
        : undefined,
    rowTitle: (script) => script.name,
    rowActions: regexActions.rowActions,
    bulkActions: regexActions.bulkActions,
  };

  return (
    <ListPage
      title={localize("Regex scripts")}
      actions={
        <>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void handleImport(file);
            }}
          />
          <button type="button" className="ov-btn" onClick={() => fileRef.current?.click()}>
            <Download size={14} aria-hidden="true" />
            {localize("Import")}
          </button>
          <NewButton label={localize("New script")} onClick={() => openRegexDetail("__new__")} />
        </>
      }
      searchPlaceholder={localize("Search scripts or patterns")}
      search={search}
      onSearch={setSearch}
      chips={[
        { id: "all", label: "All" },
        { id: "on", label: "On" },
        { id: "off", label: "Off" },
        { id: "scoped", label: "Scoped" },
      ]}
      chip={chip}
      onChip={setChip}
      toolsEnd={
        <SortSelect value={sort} onChange={setSort} options={[{ id: "order", label: "Run order" }, ...SORTS]} />
      }
      kit={kit}
      rows={rows}
      onOpen={(script) => openRegexDetail(script.id)}
      leading={(script) => {
        const enabled = script.enabled === "true";
        return (
          <Toggle
            on={enabled}
            label={localize(enabled ? "Disable regex" : "Enable regex")}
            onChange={(next) => updateRegex.mutate({ id: script.id, enabled: next })}
          />
        );
      }}
      columns={[
        { key: "name", label: "Script", className: "ov-table__name", render: (script) => script.name },
        {
          key: "find",
          label: "Find",
          className: "ov-table__mono ov-table__desc",
          render: (script) => `/${script.findRegex}/${script.flags ?? ""}`,
        },
        {
          key: "applies",
          label: "Applies to",
          render: (script) =>
            parseList(script.placement)
              .map((place) => localize(REGEX_PLACEMENT_LABEL[place] ?? place))
              .join(" · ") || "—",
        },
        {
          key: "scope",
          label: "Scope",
          render: (script) => {
            const characters = parseList(script.targetCharacterIds).length;
            const presets = parseList(script.targetPromptPresetIds).length;
            if (!characters && !presets) return localize("Everywhere");
            return [
              characters ? `${characters} ${localize(characters === 1 ? "character" : "characters")}` : null,
              presets ? `${presets} ${localize(presets === 1 ? "preset" : "presets")}` : null,
            ]
              .filter(Boolean)
              .join(" · ");
          },
        },
        { key: "order", label: "Order", className: "ov-table__num", render: (script) => script.order ?? 0 },
      ]}
      empty={localize("No regex scripts yet.")}
    />
  );
}

// ── Connections ──

export type ConnectionKind = "text" | "image" | "video" | "audio" | "decision";

export function connectionKind(provider: string): ConnectionKind {
  if (provider === "image_generation") return "image";
  if (provider === "video_generation") return "video";
  if (provider === "audio") return "audio";
  if (provider === "decision") return "decision";
  return "text";
}

export const KIND_LABEL: Record<ConnectionKind, string> = {
  text: "Text",
  image: "Image",
  video: "Video",
  audio: "Audio",
  decision: "Decision",
};

export function flag(value: unknown) {
  return value === true || value === "true" || value === "1" || value === 1;
}

export { ConnectionsLanding } from "./ConnectionsLanding";

// ── Agents ──

export const PHASE_LABEL: Record<string, string> = {
  pre_generation: "Before reply",
  parallel: "With reply",
  post_processing: "After reply",
};

export interface OvAgentRow {
  /** What openAgentDetail takes: the type for an installed agent, the config id for a custom one. */
  id: string;
  name: string;
  description: string;
  phase: string;
  connectionId: string | null;
  imagePath: string | null;
  updatedAt?: string;
  /** App-like agents (Noodle…) open their own screen instead of running in chats. */
  app?: boolean;
}

/**
 * Installed agents (from capability packages) plus custom agents, the same
 * list the classic Agents panel shows. Agent configs alone only hold agents
 * the user has edited or created, so installed packages never appeared.
 */
export function useOvAgentRows() {
  const { data: configs, isLoading: configsLoading } = useAgentConfigs();
  const { data: registry, isLoading: registryLoading } = useCapabilityAgentRegistry();
  const rows = useMemo<OvAgentRow[]>(() => {
    const configRows = (configs ?? []) as AgentConfigRow[];
    const available = registry
      ? BUILT_IN_AGENTS.filter((agent) => registry.some((entry) => entry.id === agent.id))
      : [...BUILT_IN_AGENTS];
    const builtInIds = new Set(available.map((agent) => agent.id));
    const visibleConfigs = configRows.filter((config) => !isAgentConfigDeleted(config.settings));
    const deleted = new Set(
      configRows
        .filter((config) => builtInIds.has(config.type) && isAgentConfigDeleted(config.settings))
        .map((config) => config.type),
    );
    const configByType = new Map(visibleConfigs.map((config) => [config.type, config]));
    const builtIns = available
      .filter((agent) => !deleted.has(agent.id))
      .map((agent) => {
        const config = configByType.get(agent.id);
        return {
          id: agent.id,
          name: config?.name || agent.name,
          description: config?.description || agent.description,
          phase: config?.phase || agent.phase,
          connectionId: config?.connectionId ?? null,
          imagePath: config?.imagePath ?? null,
          updatedAt: config?.updatedAt,
          app: agent.execution === "feature",
        };
      });
    const custom = visibleConfigs
      .filter((config) => !builtInIds.has(config.type) && !isRetiredBuiltInAgentId(config.type))
      .map((config) => ({
        id: config.id,
        name: config.name,
        description: config.description,
        phase: config.phase,
        connectionId: config.connectionId,
        imagePath: config.imagePath,
        updatedAt: config.updatedAt,
      }));
    return [...builtIns, ...custom];
  }, [configs, registry]);
  return { rows, ready: !configsLoading && !registryLoading };
}
