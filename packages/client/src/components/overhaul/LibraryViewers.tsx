// ──────────────────────────────────────────────
// UI overhaul: Library viewers (mockups Regex / Connections / Agents viewer)
//
// The Preset editor's master-detail layout for the other Library sections:
// a left column with the section's tools, search + New and a compact list
// grouped the way you think about the items; the clicked item opens on the
// right in its usual editor. One Library tab per section, not one per item.
// ──────────────────────────────────────────────
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  CheckSquare,
  ChevronDown,
  ChevronLeft,
  Download,
  Folder,
  FolderPlus,
  Plus,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { getFolderImportEntries } from "@marinara-engine/shared";
import { useTranslation } from "react-i18next";
import { PROVIDERS, type APIConnection, type APIProvider } from "@marinara-engine/shared";
import { useUIStore } from "../../stores/ui.store";
import { useOverhaulStore } from "../../stores/overhaul.store";
import { useConnections } from "../../hooks/use-connections";
import { useConnectionAccounts } from "../../hooks/use-connection-accounts";
import { groupModelsByAccount } from "../../lib/connection-groups";
import {
  useRegexScripts,
  useReorderRegexScripts,
  useUpdateRegexScript,
  type RegexScriptRow,
} from "../../hooks/use-regex-scripts";
import { useLocalizedUiText } from "../../localization/use-localized-ui-text";
import { cn } from "../../lib/utils";
import { Toggle, flag, parseList, useRegexFolders, useRegexImport, useRegexKitActions } from "./LibraryTables";
import { insertLibraryItems } from "../../lib/library-order";
import { DeviceDetail, useDeviceEngines } from "../connections/DeviceDetail";
import { ConnectionAccountEditor } from "../connections/ConnectionAccountEditor";
import { ProviderIcon } from "../connections/ProviderIcon";
import type { DeviceItem } from "../../hooks/use-device-setup";
import { DecisionModelModal } from "../modals/DecisionModelModal";
import { DECISION_DEVICE_ID, useDecisionEngine } from "./decision-engine";
import { EditorCrumbs, useSplitTouchCrumbs, type RailCrumb } from "./EditorRail";
import { openLibraryPane, openLibrarySection } from "./library-navigation";
import { OvEditorHeadSlot } from "./EditorChrome";
import {
  useCreateCustomTool,
  useCustomTools,
  useDeleteCustomTool,
  useUpdateCustomTool,
  type CustomToolRow,
} from "../../hooks/use-custom-tools";
import {
  createCustomToolFolderPackageFiles,
  importCustomToolEntries,
  serializeCustomToolForTransfer,
} from "../../lib/custom-tool-transfer";
import { collectFolderPackageEntries, type FolderPackageImportEntry } from "../../lib/folder-package-transfer";
import { isZipFile, readTextFilesFromZip } from "../../lib/read-zip-text";
import { downloadZipFile } from "../../lib/download-zip";
import { showConfirmDialog } from "../../lib/app-dialogs";
import {
  KitBulkBar,
  KitCheck,
  KitEmpty,
  KitMoreButton,
  useKitMenu,
  useKitSelection,
  useKitRowDrag,
  useSuppressClick,
  kitDelete,
  type KitAction,
  type KitSelection,
} from "./LibraryKit";

/** Built-in model and local voice engines share the Model viewer: their id is `device:<item>`. */
export const DEVICE_PREFIX = "device:";
/** Viewer id of an account's own page (`account-key:` opens it on Replace key). */
export const ACCOUNT_PREFIX = "account:";
export const ACCOUNT_KEY_PREFIX = "account-key:";

export type OvViewerRow = {
  id: string;
  name: string;
  sub?: ReactNode;
  lead?: ReactNode;
  trail?: ReactNode;
  dim?: boolean;
  monoSub?: boolean;
};

/**
 * A folder heading (Regex scripts): folder icon, name, a note such as "3/12 on", an optional switch
 * for the whole folder and a ⋯ menu. `dropId` makes it a drop target for dragged rows (the user's own
 * folders); `closed` / `onToggle` keep its open state outside the viewer.
 */
export type OvViewerFolder = {
  dropId?: string;
  dragKind?: string;
  /** Replaces the folder icon (a preset's folder shows the preset icon). */
  icon?: ReactNode;
  note?: string;
  title?: string;
  trail?: ReactNode;
  menu?: KitAction[];
  closed?: boolean;
  onToggle?: () => void;
};

/** `openId`: the group itself has a page (a Connections account); its name opens it, the chevron folds it. */
export type OvViewerGroup = {
  id: string;
  label: string;
  rows: OvViewerRow[];
  openId?: string;
  folder?: OvViewerFolder;
};

/** `compact`: in the list's own tool row (an item is open) the tool shows as its icon only, to keep that row on one line. */
export type OvViewerTool = { label: string; icon: typeof Plus; onClick: () => void; compact?: boolean };

/** Select, ⋯ menus and dragging for a viewer's list (Regex). Rows without a menu are left alone. */
export type OvViewerKit = {
  selection: KitSelection;
  menu: ReturnType<typeof useKitMenu>;
  rowMenu: (id: string) => { title: string; actions: KitAction[] } | null;
  bulkActions: KitAction[];
  rowDrag?: (id: string, folderId: string | null) => Record<string, unknown>;
  blocked?: () => boolean;
};

function OvViewer({
  title,
  meta,
  tools,
  listLabel,
  listNote,
  search,
  onSearch,
  searchPlaceholder,
  newLabel,
  onNew,
  newAnchor,
  groups,
  selectedId,
  onSelect,
  emptyList,
  emptyDetail,
  children,
  onSection,
  kit,
}: {
  kit?: OvViewerKit;
  title: string;
  /** The section's landing page (Library > Connections). Without it the crumb only names the section. */
  onSection?: () => void;
  meta: string;
  tools: OvViewerTool[];
  listLabel: string;
  listNote?: string;
  search: string;
  onSearch: (value: string) => void;
  searchPlaceholder: string;
  newLabel: string;
  onNew: () => void;
  /** Marks the New button so a menu can drop down under it (data-ov-anchor). */
  newAnchor?: string;
  groups: OvViewerGroup[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  emptyList: string;
  emptyDetail: string;
  children: ReactNode;
}) {
  const localize = useLocalizedUiText();
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  const [headSlot, setHeadSlot] = useState<HTMLDivElement | null>(null);
  const visible = groups.filter((group) => group.rows.length || !search);
  const total = groups.reduce((sum, group) => sum + group.rows.length, 0);
  // Library > Section > item, like the Lorebook, Preset and Character pages.
  const selectedName = selectedId
    ? (groups.find((group) => group.openId === selectedId)?.label ??
      groups.flatMap((group) => group.rows).find((row) => row.id === selectedId)?.name)
    : undefined;
  const crumbs: RailCrumb[] = [
    { label: "Library", onClick: openLibraryPane },
    { label: title, onClick: onSection },
  ];
  if (typeof selectedName === "string" && selectedName) crumbs.push({ label: selectedName });
  // With nothing open this is the section's landing page: it reads like the other Library landing pages
  // (no crumbs, title at the same spot, Import and + New as pills at the top right). Once an item is
  // open, its editor header takes the top and the list keeps Import / + New (audit D7).
  const landing = !selectedId;
  const newButton = (
    <button type="button" className="ov-btn ov-btn--primary" data-ov-anchor={newAnchor} onClick={onNew}>
      <Plus size={14} aria-hidden="true" />
      {newLabel}
    </button>
  );
  return (
    <div className={cn("ov-vw", landing && total === 0 && !search && "is-empty")}>
      {/* The open item's editor puts its own header here (OvEditorHead), so Regex, Connections and
          Agents read like every other editor: Library › Section › Item, the item's name, Save. */}
      <div className="ov-vw__head">
        <div className="ov-vw__slot" ref={setHeadSlot} />
        <header className={cn("ov-vw__top", !landing && "has-crumbs")}>
          {landing ? null : <EditorCrumbs items={crumbs} />}
          <h1 data-mari-part="page-title">{title}</h1>
          <small>{meta}</small>
          {landing ? (
            <div className="ov-vw__actions">
              {tools.map(({ label, icon: Icon, onClick }) => (
                <button key={label} type="button" className="ov-btn" onClick={onClick}>
                  {Icon ? <Icon size={14} aria-hidden="true" /> : null}
                  {label}
                </button>
              ))}
              {/* With nothing yet, + New sits in the empty state instead (one button, not two). */}
              {total > 0 || search ? newButton : null}
            </div>
          ) : null}
        </header>
      </div>
      <aside className="ov-vw__left" aria-label={title}>
        <div className="ov-vw__find">
          <label className="ov-vw__search">
            <Search size={13} aria-hidden="true" />
            <input value={search} onChange={(event) => onSearch(event.target.value)} placeholder={searchPlaceholder} />
          </label>
        </div>
        <div className="ov-vw__tools ov-vw__tools--list">
          {landing
            ? null
            : tools.map(({ label, icon: Icon, onClick, compact }) => (
                <button
                  key={label}
                  type="button"
                  onClick={onClick}
                  aria-label={compact ? label : undefined}
                  title={compact ? label : undefined}
                >
                  {Icon ? <Icon size={compact ? 14 : 13} aria-hidden="true" /> : null}
                  {compact ? null : label}
                </button>
              ))}
          {landing ? null : (
            <button type="button" className="is-new" data-ov-anchor={newAnchor} onClick={onNew}>
              <Plus size={13} aria-hidden="true" />
              {newLabel}
            </button>
          )}
          {kit ? (
            <button
              type="button"
              className={cn("ov-vw__tools-end", kit.selection.on && "is-on")}
              aria-pressed={kit.selection.on}
              onClick={() => (kit.selection.on ? kit.selection.stop() : kit.selection.start())}
            >
              <CheckSquare size={13} aria-hidden="true" />
              {localize("Select")}
            </button>
          ) : null}
        </div>
        <p className="ov-vw__label">
          {listLabel}
          {listNote ? <small>{listNote}</small> : null}
        </p>
        <div className="ov-vw__list" role="listbox" aria-label={listLabel}>
          {total === 0 && !landing ? <p className="ov-vw__empty">{emptyList}</p> : null}
          {total === 0 && landing && search ? <p className="ov-vw__empty">{localize("No matches.")}</p> : null}
          {visible.map((group) => {
            const folder = group.folder;
            const isClosed = (folder?.closed ?? closed[group.id]) && !search;
            const toggleGroup = () =>
              folder?.onToggle
                ? folder.onToggle()
                : setClosed((current) => ({ ...current, [group.id]: !current[group.id] }));
            return (
              <section key={group.id} className={cn("ov-vw__group", folder && "is-folder")}>
                {folder ? (
                  <div
                    className="ov-vw__ghead is-folder"
                    title={folder.title}
                    {...(folder.dropId
                      ? {
                          "data-ov-folder-id": folder.dropId,
                          ...(folder.dragKind ? { [`data-${folder.dragKind}-folder-id`]: folder.dropId } : {}),
                        }
                      : {})}
                    onContextMenu={
                      folder.menu && kit
                        ? (event) => kit.menu.openFromEvent(event, group.label, folder.menu!)
                        : undefined
                    }
                  >
                    <button type="button" className="ov-vw__gopen" aria-expanded={!isClosed} onClick={toggleGroup}>
                      <ChevronDown size={13} className={cn(isClosed && "-rotate-90")} aria-hidden="true" />
                      {folder.icon ?? <Folder size={14} className="ov-vw__gicon" aria-hidden="true" />}
                      <span>{group.label}</span>
                      <small>{folder.note ?? group.rows.length}</small>
                    </button>
                    {folder.trail ? <span className="ov-vw__trail">{folder.trail}</span> : null}
                    {folder.menu && kit ? (
                      <KitMoreButton
                        label={localize("Folder actions")}
                        onOpen={(event) => kit.menu.openFromEvent(event, group.label, folder.menu!, "button")}
                      />
                    ) : null}
                  </div>
                ) : group.label && group.openId ? (
                  <div className={cn("ov-vw__ghead is-split", group.openId === selectedId && "is-on")}>
                    <button
                      type="button"
                      className="ov-vw__gfold"
                      aria-expanded={!isClosed}
                      aria-label={group.label}
                      onClick={() => setClosed((current) => ({ ...current, [group.id]: !current[group.id] }))}
                    >
                      <ChevronDown size={13} className={cn(isClosed && "-rotate-90")} aria-hidden="true" />
                    </button>
                    <button type="button" className="ov-vw__gopen" onClick={() => onSelect(group.openId!)}>
                      <span>{group.label}</span>
                      <small>{group.rows.length}</small>
                    </button>
                  </div>
                ) : group.label ? (
                  <button type="button" className="ov-vw__ghead" aria-expanded={!isClosed} onClick={toggleGroup}>
                    <ChevronDown size={13} className={cn(isClosed && "-rotate-90")} aria-hidden="true" />
                    <span>{group.label}</span>
                    <small>{group.rows.length}</small>
                  </button>
                ) : null}
                {isClosed
                  ? null
                  : group.rows.map((row) => {
                      const rowMenu = kit?.rowMenu(row.id) ?? null;
                      const selecting = !!kit?.selection.on && !!rowMenu;
                      const checked = selecting && kit!.selection.has(row.id);
                      const pick = () => {
                        if (kit?.blocked?.()) return;
                        if (selecting) kit!.selection.toggle(row.id);
                        else onSelect(row.id);
                      };
                      return (
                        <div
                          key={row.id}
                          role="option"
                          tabIndex={0}
                          aria-selected={selecting ? checked : row.id === selectedId}
                          className={cn(
                            "ov-vw__row",
                            !selecting && row.id === selectedId && "is-on",
                            checked && "is-selected",
                            row.dim && "is-dim",
                          )}
                          {...(rowMenu && kit?.rowDrag ? kit.rowDrag(row.id, folder?.dropId ?? null) : {})}
                          onClick={pick}
                          onContextMenu={
                            rowMenu && kit
                              ? (event) => kit.menu.openFromEvent(event, rowMenu.title, rowMenu.actions)
                              : undefined
                          }
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              pick();
                            }
                          }}
                        >
                          {selecting ? (
                            <span className="ov-vw__lead">
                              <KitCheck checked={checked} label={row.name} />
                            </span>
                          ) : row.lead ? (
                            <span className="ov-vw__lead">{row.lead}</span>
                          ) : null}
                          <span className="ov-vw__text">
                            <span className="ov-vw__name">{row.name}</span>
                            {row.sub ? <small className={cn(row.monoSub && "is-mono")}>{row.sub}</small> : null}
                          </span>
                          {row.trail ? <span className="ov-vw__trail">{row.trail}</span> : null}
                          {rowMenu && kit ? (
                            <KitMoreButton
                              label={rowMenu.title}
                              onOpen={(event) =>
                                kit.menu.openFromEvent(event, rowMenu.title, rowMenu.actions, "button")
                              }
                            />
                          ) : null}
                        </div>
                      );
                    })}
              </section>
            );
          })}
        </div>
        {kit ? <KitBulkBar selection={kit.selection} actions={kit.bulkActions} /> : null}
        {kit?.menu.node}
      </aside>
      <div className="ov-vw__main">
        <OvEditorHeadSlot.Provider value={headSlot}>
          {children}
          {landing ? (
            total === 0 && !search ? (
              <div className="ov-vw__pick">
                <KitEmpty title={emptyList} action={newButton} />
              </div>
            ) : (
              <p className="ov-vw__pick">{emptyDetail}</p>
            )
          ) : null}
        </OvEditorHeadSlot.Provider>
      </div>
    </div>
  );
}

/**
 * The viewer always shows an item, like the mockups: with nothing selected it opens the first one.
 * Only while its Library page is the one on screen, so leaving it (Home, a chat) closes the item
 * instead of reopening it on the way out.
 */
function useAutoSelect(
  section: "connections" | "agents",
  selectedId: string | null,
  firstId: string | undefined,
  open: (id: string) => void,
) {
  useEffect(() => {
    if (selectedId || !firstId) return;
    if (useOverhaulStore.getState().libraryPage !== section) return;
    open(firstId);
  }, [firstId, open, section, selectedId]);
}

// ── Regex scripts ──

export function OvRegexViewer({ children }: { children: ReactNode }) {
  const localize = useLocalizedUiText();
  const { data } = useRegexScripts();
  const updateRegex = useUpdateRegexScript();
  const handleImport = useRegexImport();
  const selectedId = useUIStore((s) => s.regexDetailId);
  const openRegexDetail = useUIStore((s) => s.openRegexDetail);
  const fileRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");

  const scripts = useMemo(
    () => [...((data ?? []) as RegexScriptRow[])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [data],
  );
  const regexFolders = useRegexFolders(scripts);
  const { display } = regexFolders;

  const needle = search.trim().toLowerCase();
  const matches = (script: RegexScriptRow) =>
    !needle || script.name.toLowerCase().includes(needle) || script.findRegex.toLowerCase().includes(needle);
  const toRow = (script: RegexScriptRow): OvViewerRow => {
    const enabled = script.enabled === "true";
    return {
      id: script.id,
      name: script.name || localize("Untitled script"),
      sub: script.findRegex,
      monoSub: true,
      lead: <span className="ov-vw__num">{script.order ?? 0}</span>,
      dim: !enabled,
      trail: (
        <Toggle
          on={enabled}
          label={localize(enabled ? "Disable regex" : "Enable regex")}
          onChange={(next) => updateRegex.mutate({ id: script.id, enabled: next })}
        />
      ),
    };
  };
  // Your folders, then one per preset, then the scripts in no folder: Global and Scoped to characters.
  const filed = new Set<string>();
  const groups: OvViewerGroup[] = [];
  for (const folder of display.folders) {
    const members = regexFolders.members(folder).filter((script) => !filed.has(script.id));
    members.forEach((script) => filed.add(script.id));
    const rows = members.filter(matches).map(toRow);
    if (needle && !rows.length) continue;
    groups.push({
      id: `folder:${folder.id}`,
      label: folder.name,
      rows,
      folder: {
        dropId: folder.virtual ? undefined : folder.id,
        dragKind: "regex",
        title: regexFolders.title(folder),
        ...regexFolders.extra(folder),
        closed: display.isCollapsed(folder),
        onToggle: () => display.toggleCollapsed(folder),
        menu: regexFolders.menu(folder),
      },
    });
  }
  const loose = scripts.filter((script) => !filed.has(script.id));
  const scoped = loose.filter((script) => parseList(script.targetCharacterIds).length);
  groups.push({
    id: "global",
    label: localize("Global"),
    rows: loose.filter((script) => !parseList(script.targetCharacterIds).length && matches(script)).map(toRow),
  });
  if (scoped.length)
    groups.push({
      id: "characters",
      label: localize("Scoped to characters"),
      rows: scoped.filter(matches).map(toRow),
    });

  // Regex scripts opens on its landing page like every other Library section (audit D7).
  const reorderRegex = useReorderRegexScripts();
  const visibleIds = groups.flatMap((group) => group.rows.map((row) => row.id));
  const selection = useKitSelection(visibleIds);
  const menu = useKitMenu();
  const suppress = useSuppressClick();
  const regexActions = useRegexKitActions(scripts, selection, regexFolders.manual);
  const byId = useMemo(() => new Map(scripts.map((script) => [script.id, script])), [scripts]);
  // Dragging a script changes its run order, like the classic panel; dropping it on one of your folders
  // files it there. Not while searching.
  const dragProps = useKitRowDrag({
    kind: "regex",
    reorder: (ids, target, edge) =>
      reorderRegex.mutate(
        insertLibraryItems(
          scripts.map((script) => script.id),
          ids,
          target,
          edge,
        ),
      ),
    folders: regexFolders.manual,
    selection,
    suppress,
    onHold: (id) => {
      const script = byId.get(id);
      if (script) menu.open(script.name, regexActions.rowActions(script), { x: 0, y: 0 });
    },
  });
  const kit: OvViewerKit = {
    selection,
    menu,
    blocked: suppress.blocked,
    bulkActions: regexActions.bulkActions,
    rowDrag: needle ? undefined : (id, folderId) => dragProps(id, folderId),
    rowMenu: (id) => {
      const script = byId.get(id);
      return script
        ? { title: script.name || localize("Untitled script"), actions: regexActions.rowActions(script) }
        : null;
    },
  };
  const enabledCount = scripts.filter((script) => script.enabled === "true").length;

  return (
    <OvViewer
      title={localize("Regex scripts")}
      meta={`${scripts.length} ${localize(scripts.length === 1 ? "script" : "scripts")} · ${enabledCount} ${localize("enabled")}`}
      tools={[
        { label: localize("Import"), icon: Download, onClick: () => fileRef.current?.click() },
        { label: localize("New folder"), icon: FolderPlus, onClick: regexFolders.manual.create, compact: true },
      ]}
      listLabel={localize("Scripts")}
      listNote={localize("in run order")}
      search={search}
      onSearch={setSearch}
      searchPlaceholder={localize("Search scripts…")}
      newLabel={localize("New script")}
      onNew={() => openRegexDetail("__new__")}
      groups={groups}
      selectedId={selectedId}
      onSelect={(id) => openRegexDetail(id)}
      kit={kit}
      emptyList={localize("No regex scripts yet.")}
      emptyDetail={localize("Pick a script on the left, or make a new one.")}
    >
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
      {regexFolders.fileInput}
      {children}
    </OvViewer>
  );
}

// ── Custom tools ──

const TOOL_TYPE_LABEL: Record<string, string> = { static: "Static result", webhook: "Webhook", script: "Script" };

function toolParamCount(tool: CustomToolRow) {
  try {
    const schema = JSON.parse(tool.parametersSchema || "{}") as { properties?: Record<string, unknown> };
    return Object.keys(schema.properties ?? {}).length;
  } catch {
    return 0;
  }
}

/**
 * Custom tools (functions the AI can call): the list on the left, the open tool's editor on the right.
 * Import and Export use the same files as the classic Presets panel's Functions section.
 */
export function OvToolsViewer({ children }: { children: ReactNode }) {
  const localize = useLocalizedUiText();
  const { t: localizeUi } = useTranslation();
  const { data } = useCustomTools();
  const createTool = useCreateCustomTool();
  const updateTool = useUpdateCustomTool();
  const deleteTool = useDeleteCustomTool();
  const selectedId = useUIStore((s) => s.toolDetailId);
  const openToolDetail = useUIStore((s) => s.openToolDetail);
  const closeToolDetail = useUIStore((s) => s.closeToolDetail);
  const fileRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");

  const tools = useMemo(
    () =>
      [...((data ?? []) as CustomToolRow[])].sort(
        (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name),
      ),
    [data],
  );
  const groups = useMemo<OvViewerGroup[]>(() => {
    const needle = search.trim().toLowerCase();
    const rows = tools
      .filter((tool) => !needle || `${tool.name} ${tool.description}`.toLowerCase().includes(needle))
      .map((tool) => {
        const enabled = tool.enabled === "true" || tool.enabled === "1";
        const params = toolParamCount(tool);
        return {
          id: tool.id,
          name: tool.name,
          monoSub: false,
          sub: [
            localize(TOOL_TYPE_LABEL[tool.executionType] ?? tool.executionType),
            `${params} ${localize(params === 1 ? "parameter" : "parameters")}`,
          ].join(" · "),
          dim: !enabled,
          trail: (
            <Toggle
              on={enabled}
              label={localize(enabled ? "Turn off" : "Turn on")}
              onChange={(next) => updateTool.mutate({ id: tool.id, enabled: next })}
            />
          ),
        };
      });
    return [{ id: "tools", label: "", rows }];
  }, [localize, search, tools, updateTool]);

  // Like Regex scripts, Custom tools opens on its landing page; pick a tool on the left.

  const visibleIds = useMemo(() => groups.flatMap((group) => group.rows.map((row) => row.id)), [groups]);
  const selection = useKitSelection(visibleIds);
  const menu = useKitMenu();
  const byId = useMemo(() => new Map(tools.map((tool) => [tool.id, tool])), [tools]);

  const exportTools = async (picked: CustomToolRow[]) => {
    if (!picked.length) return;
    // A webhook address can hold a key: ask before it leaves the app.
    if (
      picked.some((tool) => tool.executionType === "webhook" && Boolean(tool.webhookUrl)) &&
      !(await showConfirmDialog({
        title: localizeUi("ui.panels.presetspanel.exportWebhookCredentials"),
        message: localizeUi("ui.panels.presetspanel.exportWebhookCredentialsWarning"),
        confirmLabel: localizeUi("ui.panels.presetspanel.exportWithCredentials"),
        tone: "destructive",
      }))
    )
      return;
    const status = await downloadZipFile(
      createCustomToolFolderPackageFiles(picked.map(serializeCustomToolForTransfer)),
      picked.length === 1 ? `${picked[0]!.name}.zip` : "marinara-functions.zip",
    );
    if (status === "saved") toast.success(localizeUi("ui.overhaul.text.exportedNumber", { number: picked.length }));
  };
  const removeMany = async (ids: string[], names?: string) => {
    const failed = await kitDelete(ids, (id) => deleteTool.mutateAsync(id), {
      noun: localize("tools"),
      localize,
      names,
    });
    if (failed && selectedId && ids.includes(selectedId) && !failed.includes(selectedId)) closeToolDetail();
    if (failed) selection.set(new Set(failed));
    if (failed && !failed.length) selection.stop();
  };
  const importFile = async (file: File) => {
    try {
      const entries: FolderPackageImportEntry[] = isZipFile(file)
        ? collectFolderPackageEntries(await readTextFilesFromZip(file), {
            rootFilenames: ["marinara-functions.json"],
            collectionKeys: ["functions", "customTools", "tools"],
          })
        : getFolderImportEntries(JSON.parse(await file.text()), ["functions", "customTools", "tools"]).map(
            (raw): FolderPackageImportEntry => ({ raw, path: file.name, basePath: "", resolveTextFile: () => null }),
          );
      if (!entries.length) throw new Error(localizeUi("ui.panels.functionssection.noFunctionsFoundInFile"));
      const { imported, failed, reviews } = await importCustomToolEntries(entries, createTool);
      if (imported === 0 && failed.length === 0)
        throw new Error(localizeUi("ui.panels.functionssection.noValidFunctionsFoundInFile"));
      if (imported > 0) toast.success(localizeUi("ui.panels.functionssection.importedFunctions", { count: imported }));
      if (failed.length > 0)
        toast.error(
          localizeUi("ui.panels.functionssection.failedFunctions", { count: failed.length, error: failed[0] }),
        );
      // Webhook and script tools come in switched off, for you to check first.
      if (reviews.length > 0)
        toast.warning(
          localizeUi("ui.chat.quickreplymenu.value1Value2", {
            value1: reviews.map((review) => review.name).join(", "),
            value2: localizeUi("ui.panels.functionssection.executableImportReviewDescription"),
          }),
          { duration: 12000 },
        );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : localizeUi("ui.panels.functionssection.failedToImportFunctions"),
      );
    }
  };

  const rowActions = (tool: CustomToolRow): KitAction[] => [
    { key: "export", label: "Export", icon: <Upload size={14} />, onSelect: () => void exportTools([tool]) },
    { key: "select", label: "Select", icon: <CheckSquare size={14} />, onSelect: () => selection.start(tool.id) },
    {
      key: "delete",
      label: "Delete",
      icon: <Trash2 size={14} />,
      danger: true,
      onSelect: () => void removeMany([tool.id], `"${tool.name}"`),
    },
  ];
  const kit: OvViewerKit = {
    selection,
    menu,
    bulkActions: [
      {
        key: "export",
        label: "Export",
        icon: <Upload size={14} />,
        onSelect: () => void exportTools(tools.filter((tool) => selection.has(tool.id))),
      },
      {
        key: "delete",
        label: "Delete",
        icon: <Trash2 size={14} />,
        danger: true,
        onSelect: () => void removeMany(selection.list),
      },
    ],
    rowMenu: (id) => {
      const tool = byId.get(id);
      return tool ? { title: tool.name, actions: rowActions(tool) } : null;
    },
  };
  const enabledCount = tools.filter((tool) => tool.enabled === "true" || tool.enabled === "1").length;

  return (
    <OvViewer
      title={localize("Custom tools")}
      meta={`${tools.length} ${localize(tools.length === 1 ? "tool" : "tools")} · ${enabledCount} ${localize("on")}`}
      tools={[
        { label: localize("Import"), icon: Download, onClick: () => fileRef.current?.click() },
        ...(tools.length
          ? [{ label: localize("Export all"), icon: Upload, onClick: () => void exportTools(tools) }]
          : []),
      ]}
      listLabel={localize("Tools")}
      search={search}
      onSearch={setSearch}
      searchPlaceholder={localize("Search tools")}
      newLabel={localize("New tool")}
      onNew={() => openToolDetail("__new__")}
      groups={groups}
      selectedId={selectedId}
      onSelect={(id) => openToolDetail(id)}
      emptyList={localize("No custom tools yet.")}
      emptyDetail={localize("Pick a tool on the left, or make a new one.")}
      onSection={() => openLibrarySection("tools")}
      kit={kit}
    >
      <input
        ref={fileRef}
        type="file"
        accept=".json,.zip,application/json,application/zip"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void importFile(file);
        }}
      />
      {children}
    </OvViewer>
  );
}

// ── Connections ──

export function OvConnectionsViewer({ children }: { children: ReactNode }) {
  const localize = useLocalizedUiText();
  const { data } = useConnections();
  const { data: accounts } = useConnectionAccounts();
  const openModal = useUIStore((s) => s.openModal);
  const selectedId = useUIStore((s) => s.connectionDetailId);
  const openConnectionDetail = useUIStore((s) => s.openConnectionDetail);
  const closeConnectionDetail = useUIStore((s) => s.closeConnectionDetail);
  const engines = useDeviceEngines();
  const decisionEngine = useDecisionEngine();
  const [search, setSearch] = useState("");

  // Same shape as the landing table: each account with its models, then models with no account.
  const grouped = useMemo(() => {
    const rows = ((data ?? []) as Array<Partial<APIConnection> & { id: string; accountId?: string | null }>).filter(
      (row) => typeof row?.id === "string",
    );
    return groupModelsByAccount(rows as never[], accounts ?? []) as unknown as {
      groups: Array<{ account: { id: string; name: string }; rows: Array<Partial<APIConnection> & { id: string }> }>;
      standalone: Array<Partial<APIConnection> & { id: string }>;
    };
  }, [accounts, data]);
  const modelCount = grouped.groups.reduce((sum, group) => sum + group.rows.length, 0) + grouped.standalone.length;

  const groups = useMemo<OvViewerGroup[]>(() => {
    const needle = search.trim().toLowerCase();
    const toRow = (row: Partial<APIConnection> & { id: string }, accountName?: string) => ({
      id: row.id,
      name: row.name || row.model || localize("Untitled connection"),
      sub: [accountName, row.model].filter((part) => part && part !== row.name).join(" · "),
      trail: flag(row.isDefault) ? <span className="ov-vw__badge">{localize("Default")}</span> : undefined,
    });
    const hit = (row: Partial<APIConnection>, accountName = "") =>
      !needle || `${row.name ?? ""} ${row.model ?? ""} ${accountName}`.toLowerCase().includes(needle);
    const list: OvViewerGroup[] = grouped.groups
      .map((group) => ({
        id: group.account.id,
        label: group.account.name,
        openId: `${ACCOUNT_PREFIX}${group.account.id}`,
        rows: group.rows
          .filter((row) => hit(row, group.account.name))
          .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""))
          .map((row) => toRow(row)),
      }))
      .filter((group) => group.rows.length > 0);
    const other = grouped.standalone
      .filter((row) => hit(row))
      .map((row) => toRow(row, PROVIDERS[row.provider as APIProvider]?.name ?? row.provider ?? undefined));
    if (other.length) list.push({ id: "__other", label: localize("Other models"), rows: other });
    const devices = engines
      .filter((engine) => !needle || engine.name.toLowerCase().includes(needle))
      .map((engine) => ({
        id: `${DEVICE_PREFIX}${engine.item}`,
        name: engine.name,
        sub: [engine.state, engine.detail].filter(Boolean).join(" · "),
        lead: <ProviderIcon provider={engine.item} size="sm" dim={engine.tone !== "ok"} />,
      }));
    if (decisionEngine && (!needle || decisionEngine.name.toLowerCase().includes(needle)))
      devices.push({
        id: DECISION_DEVICE_ID,
        name: decisionEngine.name,
        sub: decisionEngine.state,
        lead: <ProviderIcon provider="decision" size="sm" dim={decisionEngine.tone !== "ok"} />,
      });
    if (devices.length) list.push({ id: "__device", label: localize("On this device"), rows: devices });
    return list;
  }, [decisionEngine, engines, grouped, localize, search]);
  const accountPage = selectedId?.startsWith(ACCOUNT_PREFIX)
    ? { id: selectedId.slice(ACCOUNT_PREFIX.length), replaceKey: false }
    : selectedId?.startsWith(ACCOUNT_KEY_PREFIX)
      ? { id: selectedId.slice(ACCOUNT_KEY_PREFIX.length), replaceKey: true }
      : null;
  const device = selectedId?.startsWith(DEVICE_PREFIX) ? (selectedId.slice(DEVICE_PREFIX.length) as DeviceItem) : null;

  const firstId = groups.find((group) => group.rows.length)?.rows[0]?.id;
  useAutoSelect("connections", selectedId, firstId, openConnectionDetail);
  const accountCount = accounts?.length ?? 0;

  return (
    <OvViewer
      title={localize("Connections")}
      meta={`${accountCount} ${localize(accountCount === 1 ? "account" : "accounts")} · ${modelCount} ${localize(modelCount === 1 ? "model" : "models")}`}
      tools={[{ label: localize("Import"), icon: Download, onClick: () => openModal("import-connection") }]}
      listLabel={localize("Accounts")}
      search={search}
      onSearch={setSearch}
      searchPlaceholder={localize("Search accounts and models")}
      newLabel={localize("New connection")}
      newAnchor="ov-add-account-viewer"
      onNew={() => openModal("create-connection", { anchor: "ov-add-account-viewer" })}
      groups={groups}
      selectedId={selectedId}
      onSelect={(id) => openConnectionDetail(id)}
      emptyList={localize("No accounts yet.")}
      emptyDetail={localize("Pick a model on the left, or add an account.")}
      onSection={() => openLibrarySection("connections")}
    >
      {accountPage ? (
        <ConnectionAccountEditor
          key={selectedId}
          embedded
          accountId={accountPage.id}
          replaceKey={accountPage.replaceKey}
          onClose={closeConnectionDetail}
        />
      ) : selectedId === DECISION_DEVICE_ID ? (
        <div className="ov-devpage">
          <header className="ov-devpage__head">
            <ProviderIcon provider="decision" size="sm" />
            <h3>{decisionEngine?.name ?? localize("Built-in model (decisions)")}</h3>
            {decisionEngine ? <span className="ov-conn__dim">{decisionEngine.state}</span> : null}
          </header>
          <DecisionModelModal embedded open onClose={closeConnectionDetail} />
        </div>
      ) : device ? (
        <div className="ov-devpage">
          <DeviceDetail key={device} item={device} onOpenDefaults={closeConnectionDetail} />
        </div>
      ) : (
        children
      )}
    </OvViewer>
  );
}

// ── Agents ──

/**
 * Phones and tablets: an account, the built-in model, the decision model and the voice engines open
 * as their own page (a ‹ back and a title, like other editors) instead of a pop-up. Model ids fall
 * through to `children` (the Connection editor).
 */
export function OvConnectionPageMobile({ children }: { children: ReactNode }) {
  const localize = useLocalizedUiText();
  const { t } = useTranslation();
  const selectedId = useUIStore((s) => s.connectionDetailId);
  const closeConnectionDetail = useUIStore((s) => s.closeConnectionDetail);
  const decisionEngine = useDecisionEngine();
  const splitCrumbs = useSplitTouchCrumbs();
  const accountPage = selectedId?.startsWith(ACCOUNT_PREFIX)
    ? { id: selectedId.slice(ACCOUNT_PREFIX.length), replaceKey: false }
    : selectedId?.startsWith(ACCOUNT_KEY_PREFIX)
      ? { id: selectedId.slice(ACCOUNT_KEY_PREFIX.length), replaceKey: true }
      : null;
  const device =
    selectedId?.startsWith(DEVICE_PREFIX) && selectedId !== DECISION_DEVICE_ID
      ? (selectedId.slice(DEVICE_PREFIX.length) as DeviceItem)
      : null;
  if (!accountPage && !device && selectedId !== DECISION_DEVICE_ID) return <>{children}</>;
  const title = accountPage
    ? localize("Account")
    : device
      ? t(`connections.add.device.${device === "local-model" ? "local_model" : device}`)
      : (decisionEngine?.name ?? localize("Built-in model (decisions)"));
  return (
    <section className="ov-ed ovm-connpage" data-component="OverhaulConnectionPage">
      {/* Split view's narrow side: Library › Connections › page at the top, like every other Library page. */}
      {splitCrumbs && !accountPage ? (
        <EditorCrumbs
          items={[
            { label: "Library", onClick: openLibraryPane },
            { label: "Connections", onClick: () => openLibrarySection("connections") },
            { label: title },
          ]}
        />
      ) : null}
      {/* An account page brings the shared editor header (‹ back, name, Save). */}
      <div className="ovm-drill-page__head" hidden={!!accountPage}>
        <button
          type="button"
          className="ovm-drill-page__back"
          aria-label={localize("Back")}
          onClick={closeConnectionDetail}
        >
          <ChevronLeft size={26} aria-hidden="true" />
        </button>
        <span className="ovm-drill-page__title">{title}</span>
        <span aria-hidden="true" />
      </div>
      {accountPage ? (
        <ConnectionAccountEditor
          key={selectedId}
          embedded
          accountId={accountPage.id}
          replaceKey={accountPage.replaceKey}
          onClose={closeConnectionDetail}
        />
      ) : device ? (
        <div className="ov-devpage">
          <DeviceDetail key={device} item={device} onOpenDefaults={closeConnectionDetail} />
        </div>
      ) : (
        <div className="ov-devpage">
          <DecisionModelModal embedded open onClose={closeConnectionDetail} />
        </div>
      )}
    </section>
  );
}
