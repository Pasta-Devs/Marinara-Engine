// ──────────────────────────────────────────────
// New layout: the Agent Organizer as a Library landing page. Installed / Available / Updates
// tabs, section and mode filters, starter kits in a menu, and a List (default) or Gallery view.
// An agent's page keeps a narrow list of its neighbours on the left.
// ──────────────────────────────────────────────
import { useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from "react";
import {
  CheckSquare,
  ChevronDown,
  Copy,
  Download,
  Loader2,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslation as useUiTranslation } from "react-i18next";
import type { CapabilityStoreKit } from "@marinara-engine/shared";
import { cn } from "../../lib/utils";
import { useLocalizedUiText } from "../../localization/use-localized-ui-text";
import { EditorCrumbs } from "./EditorRail";
import { openLibraryPane } from "./library-navigation";
import { PHASE_LABEL, Thumb, ViewSwitch, swatch, useOvAgentRows, type OvAgentRow } from "./LibraryTables";
import { useUIStore } from "../../stores/ui.store";
import { useCapabilityAgentRegistry } from "../../hooks/use-capability-packages";
import { useOverhaulMobile } from "../../stores/overhaul.store";
import {
  checkReasonOf,
  hasUpdate,
  ORGANIZER_SECTIONS,
  packageModes,
  sectionHintKey,
  sectionLabelKey,
  sectionOf,
  taglineOf,
  type CatalogMode,
  type OrganizerEntry,
  type OrganizerPage,
  type OrganizerSectionId,
  typeOf,
} from "../agents/organizer/organizer-model";
import { AgentIcon, StoreBanner, useOrganizer, useShownEntry } from "../agents/organizer/OrganizerParts";
import type { AgentModeFilterValue } from "../agents/AgentModeFilter";
import { useAgentImportFlow } from "../agents/useAgentImportFlow";
import { useAgentConfigs, useCreateAgent, useDeleteAgent, type AgentConfigRow } from "../../hooks/use-agents";
import {
  createAgentFolderPackageFilename,
  createAgentFolderPackageFiles,
  createDuplicateAgentInput,
  serializeAgentConfig,
} from "../../lib/agent-transfer";
import { downloadZipFile } from "../../lib/download-zip";
import {
  KitBulkBar,
  KitCheck,
  KitMoreButton,
  KitSelectButton,
  kitDelete,
  useKitMenu,
  useKitSelection,
  type KitAction,
  type KitSelection,
} from "./LibraryKit";

/** Select, ⋯ and the bulk bar for "Your agents" (agents you made or imported). */
type OwnTools = {
  selection: KitSelection;
  menu: ReturnType<typeof useKitMenu>;
  actionsFor: (row: OvAgentRow) => KitAction[] | null;
};

function useOwnAgentTools(own: readonly OvAgentRow[]) {
  const localize = useLocalizedUiText();
  const { data: configs } = useAgentConfigs();
  const createAgent = useCreateAgent();
  const deleteAgent = useDeleteAgent();
  const openAgentDetail = useUIStore((s) => s.openAgentDetail);
  // Only agents with their own settings row can be copied, exported or deleted here; built-ins keep theirs.
  const configById = useMemo(
    () => new Map(((configs ?? []) as AgentConfigRow[]).map((config) => [config.id, config])),
    [configs],
  );
  const mine = own.filter((row) => configById.has(row.id));
  const selection = useKitSelection(mine.map((row) => row.id));
  const menu = useKitMenu();
  const exportAgents = async (ids: string[]) => {
    const picked = ids.map((id) => configById.get(id)).filter((config): config is AgentConfigRow => !!config);
    if (!picked.length) return;
    try {
      const files = createAgentFolderPackageFiles(picked.map(serializeAgentConfig));
      const filename =
        picked.length === 1 ? createAgentFolderPackageFilename(picked[0]!.name, "agent") : "marinara-agents.zip";
      const status = await downloadZipFile(files, filename);
      if (status === "saved") toast.success(`${localize("Exported")} ${picked.length}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : localize("Export failed"));
    }
  };
  const removeMany = async (ids: string[], names?: string) => {
    const failed = await kitDelete(ids, (id) => deleteAgent.mutateAsync(id), {
      noun: localize("agents"),
      localize,
      names,
    });
    if (failed) selection.set(new Set(failed));
    if (failed && !failed.length) selection.stop();
  };
  const actionsFor = (row: OvAgentRow): KitAction[] | null => {
    const config = configById.get(row.id);
    if (!config) return null;
    return [
      {
        key: "dup",
        label: "Duplicate",
        icon: <Copy size={14} />,
        onSelect: () =>
          void createAgent.mutateAsync(createDuplicateAgentInput(config)).then(
            (created) => {
              toast.success(`${localize("Copied")} ${row.name}`);
              if (created?.id) openAgentDetail(created.id);
            },
            (error: unknown) => toast.error(error instanceof Error ? error.message : localize("Couldn't duplicate")),
          ),
      },
      { key: "export", label: "Export", icon: <Upload size={14} />, onSelect: () => void exportAgents([row.id]) },
      { key: "select", label: "Select", icon: <CheckSquare size={14} />, onSelect: () => selection.start(row.id) },
      {
        key: "delete",
        label: "Delete",
        icon: <Trash2 size={14} />,
        danger: true,
        onSelect: () => void removeMany([row.id], `"${row.name}"`),
      },
    ];
  };
  const bulkActions: KitAction[] = [
    { key: "export", label: "Export", icon: <Upload size={14} />, onSelect: () => void exportAgents(selection.list) },
    {
      key: "delete",
      label: "Delete",
      icon: <Trash2 size={14} />,
      danger: true,
      onSelect: () => void removeMany(selection.list),
    },
  ];
  const tools: OwnTools = { selection, menu, actionsFor };
  return { tools, bulkActions, count: mine.length };
}

type Tab = "installed" | "available" | "updates";
type SortKey = "section" | "name" | "featured";
type Kit = CapabilityStoreKit & { entries: readonly OrganizerEntry[] };

const MODE_WORD: Record<CatalogMode, string> = { conversation: "Convo", roleplay: "Roleplay", game: "Game" };

function readGallery() {
  try {
    return localStorage.getItem("ov-org-view") === "gallery";
  } catch {
    return false;
  }
}

function Modes({ entry }: { entry: OrganizerEntry }) {
  const localize = useLocalizedUiText();
  const modes = packageModes(entry.manifest.id);
  if (modes.length === 0) return <span className="ov-org__dim">—</span>;
  return (
    <span className="ov-org__modes">
      {modes.map((mode, index) => (
        <span key={mode} className={`ov-org__mode is-${mode}`}>
          {index > 0 ? <i aria-hidden="true">·</i> : null}
          {localize(MODE_WORD[mode])}
        </span>
      ))}
    </span>
  );
}

/** Get / Update / Open, or a quiet "Installed". */
export function OvAgentAction({ entry }: { entry: OrganizerEntry }) {
  const { installedById, busyId, pending, install, open } = useOrganizer();
  const { t: localizeUi } = useUiTranslation();
  const installed = installedById.get(entry.manifest.id);
  const stop = (event: MouseEvent) => event.stopPropagation();
  if (busyId === entry.manifest.id)
    return (
      <span className="ov-org__act is-busy" role="status">
        <Loader2 size={13} className="animate-spin" aria-hidden="true" />
        <span className="sr-only">{localizeUi("ui.agents.organizer.working")}</span>
      </span>
    );
  if (checkReasonOf(installed) !== null)
    return <span className="ov-org__state is-warn">{localizeUi("ui.agents.organizer.needsCheck")}</span>;
  if (!installed || hasUpdate(entry, installed)) {
    const update = Boolean(installed);
    return (
      <button
        type="button"
        className={cn("ov-org__act", update && "is-update")}
        disabled={pending}
        onClick={(event) => {
          stop(event);
          install(entry);
        }}
        aria-label={localizeUi(update ? "ui.agents.organizer.updateName" : "ui.agents.organizer.getName", {
          name: entry.manifest.name,
        })}
      >
        {localizeUi(update ? "ui.agents.agentcatalogview.update" : "ui.agents.organizer.get")}
      </button>
    );
  }
  if (typeOf(entry) === "app")
    return (
      <button
        type="button"
        className="ov-org__act is-quiet"
        onClick={(event) => {
          stop(event);
          open(entry);
        }}
      >
        {localizeUi("ui.agents.organizer.open")}
      </button>
    );
  return <span className="ov-org__state">{localizeUi("ui.agents.organizer.installed")}</span>;
}

/** On the Installed tab an agent opens its settings; elsewhere it opens its Organizer page. */
function useOpenEntry(settings: boolean) {
  const { go, settingsAgentById } = useOrganizer();
  const openAgentDetail = useUIStore((s) => s.openAgentDetail);
  return (entry: OrganizerEntry) => {
    const agentId = settings ? settingsAgentById.get(entry.manifest.id) : undefined;
    if (agentId) openAgentDetail(agentId);
    else go({ kind: "agent", id: entry.manifest.id });
  };
}

function Row({ entry, settings }: { entry: OrganizerEntry; settings: boolean }) {
  const { menu } = useOrganizer();
  const openEntry = useOpenEntry(settings);
  const shown = useShownEntry(entry);
  return (
    <tr
      data-ov-org-row
      tabIndex={0}
      onClick={() => openEntry(entry)}
      onKeyDown={(event) => {
        if (event.key === "Enter") openEntry(entry);
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        menu(entry, event);
      }}
    >
      <td>
        <span className="ov-org__name">
          <AgentIcon entry={entry} className="ov-org__icon" />
          <b>{shown.name}</b>
        </span>
      </td>
      <td className="ov-org__dim">{taglineOf(entry, shown.description)}</td>
      <td>
        <Modes entry={entry} />
      </td>
      <td className="ov-org__dim">{entry.manifest.version}</td>
      <td className="ov-org__actcell">
        <OvAgentAction entry={entry} />
      </td>
    </tr>
  );
}

function Card({ entry, settings }: { entry: OrganizerEntry; settings: boolean }) {
  const openEntry = useOpenEntry(settings);
  const shown = useShownEntry(entry);
  return (
    <div
      className="ov-org-card"
      data-ov-org-row
      role="button"
      tabIndex={0}
      onClick={() => openEntry(entry)}
      onKeyDown={(event) => {
        if (event.key === "Enter") openEntry(entry);
      }}
    >
      <StoreBanner entry={entry} sizes="(min-width: 1024px) 30vw, 50vw" className="ov-org-card__art" />
      <div className="ov-org-card__foot">
        <AgentIcon entry={entry} className="ov-org__icon ov-org__icon--lg" />
        <span className="ov-org-card__text">
          <b>{shown.name}</b>
          <span>{taglineOf(entry, shown.description)}</span>
        </span>
        <OvAgentAction entry={entry} />
      </div>
    </div>
  );
}

function KitsMenu({ kits, onInstallKit }: { kits: readonly Kit[]; onInstallKit: (kit: Kit) => void }) {
  const localize = useLocalizedUiText();
  const { t: localizeUi } = useUiTranslation();
  const { installedById, pending } = useOrganizer();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);
  if (kits.length === 0) return null;
  return (
    <div className="ov-org-kits" ref={ref}>
      <button
        type="button"
        className={cn("ov-select ov-org-kits__btn", open && "is-open")}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
      >
        {localize("Starter kits")}
        <ChevronDown size={13} aria-hidden="true" />
      </button>
      {open ? (
        <div className="ov-org-kits__menu" role="menu">
          {kits.map((kit) => {
            const missing = kit.entries.filter((entry) => !installedById.has(entry.manifest.id)).length;
            return (
              <div key={kit.id} className="ov-org-kits__row">
                <span className="ov-org-kits__text">
                  <b>{kit.name}</b>
                  <span>{kit.tagline || kit.entries.map((entry) => entry.manifest.name).join(", ")}</span>
                </span>
                {missing ? (
                  <button
                    type="button"
                    className="ov-org__act"
                    disabled={pending}
                    onClick={() => {
                      onInstallKit(kit);
                      setOpen(false);
                    }}
                  >
                    {localize("Get")} {missing}
                  </button>
                ) : (
                  <span className="ov-org__state">{localizeUi("ui.agents.organizer.kitInstalled")}</span>
                )}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export interface OvAgentOrganizerProps {
  all: readonly OrganizerEntry[];
  /** Mode-filtered entries. */
  entries: readonly OrganizerEntry[];
  updates: readonly OrganizerEntry[];
  kits: readonly Kit[];
  query: string;
  setQuery: (value: string) => void;
  modeFilter: AgentModeFilterValue;
  setModeFilter: (value: AgentModeFilterValue) => void;
  page: OrganizerPage;
  agentEntry?: OrganizerEntry;
  /** Loading, error or empty-catalog notice; replaces the list. */
  status: ReactNode | null;
  /** The agent's own page (store art, about, permissions, versions). */
  agentPage: ReactNode;
  /** The release-notes list for the Updates tab. */
  updatesPage: ReactNode;
  bulkNote: ReactNode;
  bulkBusy: boolean;
  onBack: () => void;
  onMore: (event: MouseEvent<HTMLElement>) => void;
  onUpdateAll: () => void;
  onInstallKit: (kit: Kit) => void;
}

export function OvAgentOrganizer(props: OvAgentOrganizerProps) {
  const { all, entries, updates, query, setQuery, modeFilter, setModeFilter, page, agentEntry } = props;
  const localize = useLocalizedUiText();
  const { t: localizeUi, i18n } = useUiTranslation();
  const language = i18n.resolvedLanguage ?? i18n.language;
  const { installedById, go } = useOrganizer();
  // Phones put the List / Gallery switch with the filters, leaving search and sort a line of their own.
  const ovMobile = useOverhaulMobile();
  const openAgentDetail = useUIStore((s) => s.openAgentDetail);
  // This is the Library's Agents page, so it opens on what the user has.
  const [tab, setTab] = useState<Tab>(
    page.kind === "updates" ? "updates" : page.kind === "section" ? "available" : "installed",
  );
  const [section, setSection] = useState<OrganizerSectionId | "all">(page.kind === "section" ? page.id : "all");
  const [sort, setSort] = useState<SortKey>("section");
  const [gallery, setGalleryState] = useState(readGallery);
  const setGallery = (next: boolean) => {
    setGalleryState(next);
    try {
      localStorage.setItem("ov-org-view", next ? "gallery" : "list");
    } catch {
      /* per-viewer convenience only */
    }
  };

  // "See all" / section links from elsewhere land on the matching filter.
  useEffect(() => {
    if (page.kind === "section") setSection(page.id);
    if (page.kind === "updates") setTab("updates");
    if (page.kind === "installed") setTab("installed");
  }, [page]);

  const needle = query.trim().toLowerCase();
  const visible = useMemo(() => {
    let list = entries.filter((entry) =>
      tab === "installed"
        ? installedById.has(entry.manifest.id)
        : tab === "updates"
          ? hasUpdate(entry, installedById.get(entry.manifest.id))
          : true,
    );
    if (section !== "all") list = list.filter((entry) => sectionOf(entry) === section);
    if (needle)
      list = list.filter((entry) =>
        [entry.manifest.name, entry.manifest.id, entry.manifest.description, taglineOf(entry)]
          .join(" ")
          .toLowerCase()
          .includes(needle),
      );
    const byName = (a: OrganizerEntry, b: OrganizerEntry) => a.manifest.name.localeCompare(b.manifest.name, language);
    if (sort === "featured")
      return [...list].sort((a, b) => (a.store?.featured ?? 9999) - (b.store?.featured ?? 9999) || byName(a, b));
    return [...list].sort(byName);
  }, [entries, installedById, language, needle, section, sort, tab]);

  const groups = useMemo(
    () =>
      sort === "section"
        ? ORGANIZER_SECTIONS.map((id) => ({ id, rows: visible.filter((entry) => sectionOf(entry) === id) })).filter(
            (group) => group.rows.length > 0,
          )
        : [{ id: null as OrganizerSectionId | null, rows: visible }],
    [sort, visible],
  );
  const sectionsPresent = ORGANIZER_SECTIONS.filter((id) => all.some((entry) => sectionOf(entry) === id));
  // The user's own agents (and any built-in no package owns) live outside the catalog.
  const { rows: agentRows } = useOvAgentRows();
  const { data: registry } = useCapabilityAgentRegistry();
  const ownAgents = useMemo(() => {
    const packaged = new Set((registry ?? []).filter((agent) => agent.packageId).map((agent) => agent.id));
    return agentRows.filter((row) => !packaged.has(row.id)).sort((a, b) => a.name.localeCompare(b.name, language));
  }, [agentRows, language, registry]);
  const visibleOwn = useMemo(
    () =>
      tab !== "installed" || section !== "all"
        ? []
        : ownAgents.filter((row) => !needle || `${row.name} ${row.description ?? ""}`.toLowerCase().includes(needle)),
    [needle, ownAgents, section, tab],
  );
  const own = useOwnAgentTools(visibleOwn);
  const agentImport = useAgentImportFlow({ toasts: true });
  const installedCount = all.filter((entry) => installedById.has(entry.manifest.id)).length + ownAgents.length;
  const onInstalled = tab === "installed";

  const crumbs = [
    { label: localize("Library"), onClick: openLibraryPane },
    { label: localize("Agents"), onClick: () => go({ kind: "home" }) },
    { label: agentEntry?.manifest.name ?? "" },
  ];

  if (page.kind === "agent") {
    // The agent's page with its neighbours (same tab and filters) down the left.
    const neighbours = groups;
    return (
      <div className="ov-org-detail">
        <aside className="ov-org-detail__list">
          <div className="ov-org-detail__head">
            <b>{localize("Agents")}</b>
            <span>{localize(tab === "installed" ? "Installed" : tab === "updates" ? "Updates" : "Available")}</span>
          </div>
          <label className="ov-search">
            <Search size={14} aria-hidden="true" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={localize("Search agents")}
            />
          </label>
          <nav>
            {neighbours.map((group) => (
              <section key={group.id ?? "all"}>
                {group.id ? <h3>{localizeUi(sectionLabelKey(group.id))}</h3> : null}
                {group.rows.map((entry) => {
                  const installed = installedById.get(entry.manifest.id);
                  return (
                    <button
                      key={entry.manifest.id}
                      type="button"
                      className={cn("ov-org-detail__item", entry.manifest.id === agentEntry?.manifest.id && "is-on")}
                      onClick={() => go({ kind: "agent", id: entry.manifest.id })}
                    >
                      <AgentIcon entry={entry} className="ov-org__icon" />
                      <span>{entry.manifest.name}</span>
                      {hasUpdate(entry, installed) ? (
                        <em className="is-update">{localizeUi("ui.agents.agentcatalogview.update")}</em>
                      ) : installed ? (
                        <em>{localizeUi("ui.agents.organizer.installed")}</em>
                      ) : null}
                    </button>
                  );
                })}
              </section>
            ))}
          </nav>
        </aside>
        <main className="ov-org-detail__main">
          <div className="ov-org-detail__crumbs">
            <EditorCrumbs items={crumbs} />
          </div>
          {props.agentPage}
        </main>
      </div>
    );
  }

  return (
    <section className="ov-list ov-org" data-component="OverhaulAgentOrganizer">
      <header className="ov-gallery__head">
        <h1 data-mari-part="page-title">
          {localize("Agents")}
          <span className="ov-org__count">
            {installedCount} {localize("installed")} · {all.length} {localize("available")}
          </span>
        </h1>
        {own.count > 0 ? <KitSelectButton selection={own.tools.selection} /> : null}
        <KitsMenu kits={props.kits} onInstallKit={props.onInstallKit} />
        <button
          type="button"
          className={cn("ov-btn ov-btn--icon", !agentImport.enabled && "is-muted")}
          aria-label={localize("Import agents")}
          title={agentImport.enabled ? localize("Import agents") : agentImport.disabledHelp}
          onClick={() => void agentImport.choose()}
        >
          <Download size={15} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="ov-btn ov-btn--icon"
          aria-label={localizeUi("ui.agents.organizer.moreActions")}
          aria-haspopup="menu"
          onClick={props.onMore}
        >
          {props.bulkBusy ? (
            <Loader2 size={14} className="animate-spin" aria-hidden="true" />
          ) : (
            <MoreHorizontal size={15} aria-hidden="true" />
          )}
        </button>
        <button
          type="button"
          className="ov-btn ov-btn--primary"
          aria-label={localize("New agent")}
          onClick={() => openAgentDetail("__new__")}
        >
          <Plus size={14} aria-hidden="true" />
          {ovMobile ? localize("New") : localize("New agent")}
        </button>
      </header>
      {props.bulkNote}
      <div className="ov-gallery__tools">
        <div className="ov-seg ov-org__tabs" role="tablist">
          {(
            [
              ["installed", "Installed", installedCount],
              ["available", "Available", all.length],
              ["updates", "Updates", updates.length],
            ] as const
          ).map(([id, label, count]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              className={cn(tab === id && "is-on")}
              onClick={() => setTab(id)}
            >
              {localize(label)}
              <span className={cn("ov-org__tabcount", id === "updates" && count > 0 && "is-warn")}>{count}</span>
            </button>
          ))}
        </div>
        <select
          className="ov-select"
          value={section}
          onChange={(event) => setSection(event.target.value as OrganizerSectionId | "all")}
          aria-label={localizeUi("ui.agents.organizer.sectionsHeading")}
        >
          <option value="all">{localize("All sections")}</option>
          {sectionsPresent.map((id) => (
            <option key={id} value={id}>
              {localizeUi(sectionLabelKey(id))}
            </option>
          ))}
        </select>
        <select
          className="ov-select"
          value={modeFilter}
          onChange={(event) => setModeFilter(event.target.value as AgentModeFilterValue)}
          aria-label={localizeUi("ui.agents.agentcatalogview.filterByChatMode")}
        >
          <option value="all">{localize("All modes")}</option>
          <option value="conversation">{localizeUi("ui.agents.agentcatalogview.conversationMode")}</option>
          <option value="roleplay">{localizeUi("ui.agents.agentcatalogview.roleplayMode")}</option>
          <option value="game">{localizeUi("ui.agents.agentcatalogview.gameMode")}</option>
        </select>
        {ovMobile && tab !== "updates" ? <ViewSwitch gallery={gallery} onChange={setGallery} /> : null}
      </div>
      {tab !== "updates" ? (
        <div className="ov-gallery__tools">
          <label className="ov-search">
            <Search size={14} aria-hidden="true" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={localize("Search agents")}
            />
          </label>
          <select
            className="ov-select"
            value={sort}
            onChange={(event) => setSort(event.target.value as SortKey)}
            aria-label={localize("Sort")}
          >
            <option value="section">{localize("Sort: Section")}</option>
            <option value="name">{localize("Sort: Name")}</option>
            <option value="featured">{localize("Sort: Featured")}</option>
          </select>
          {!ovMobile && <ViewSwitch gallery={gallery} onChange={setGallery} />}
        </div>
      ) : null}

      {updates.length > 0 && tab !== "updates" ? (
        <div className="ov-org-updates">
          <RefreshCw size={14} aria-hidden="true" />
          <b>{localizeUi("ui.agents.organizer.updatesReady", { count: updates.length })}</b>
          <span className="ov-org-updates__list">
            {updates.map((entry) => `${entry.manifest.name} ${entry.manifest.version}`).join(" · ")}
          </span>
          <button type="button" className="ov-org-updates__link" onClick={() => setTab("updates")}>
            {localizeUi("ui.agents.organizer.seeWhatsNew")}
          </button>
          <button type="button" className="ov-org__act is-update" onClick={props.onUpdateAll}>
            {localizeUi("ui.agents.organizer.updateAll")}
          </button>
        </div>
      ) : null}

      {props.status ? (
        <div className="ov-org__status">{props.status}</div>
      ) : tab === "updates" ? (
        <div className="ov-org__updates-page">{props.updatesPage}</div>
      ) : visible.length === 0 && visibleOwn.length === 0 ? (
        <p className="ov-list__empty">
          {needle
            ? localizeUi("ui.agents.agentcatalogview.noMatchingAgents")
            : tab === "installed"
              ? localizeUi("ui.overhaul.text.noAgentsInstalled")
              : localize("Nothing here yet.")}
        </p>
      ) : gallery ? (
        <div className="ov-org-gallery">
          {visibleOwn.length > 0 ? (
            <section>
              <h3 className="ov-org-gallery__head">{localize("Your agents")}</h3>
              <div className="ov-org-gallery__grid">
                {visibleOwn.map((row) => (
                  <OwnCard key={row.id} row={row} tools={own.tools} />
                ))}
              </div>
            </section>
          ) : null}
          {groups.map((group) => (
            <section key={group.id ?? "all"}>
              {group.id ? <h3 className="ov-org-gallery__head">{localizeUi(sectionLabelKey(group.id))}</h3> : null}
              <div className="ov-org-gallery__grid">
                {group.rows.map((entry) => (
                  <Card key={entry.manifest.id} entry={entry} settings={onInstalled} />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="ov-table-wrap">
          <table className="ov-table ov-org__table">
            <thead>
              <tr>
                <th>{localize("Name")}</th>
                <th>{localize("Description")}</th>
                <th>{localize("Works in")}</th>
                <th>{localize("Version")}</th>
                <th aria-hidden="true" />
              </tr>
            </thead>
            <tbody>
              {visibleOwn.length > 0 ? <OwnRows rows={visibleOwn} tools={own.tools} /> : null}
              {groups.map((group) => (
                <GroupRows key={group.id ?? "all"} id={group.id} rows={group.rows} settings={onInstalled} />
              ))}
            </tbody>
          </table>
        </div>
      )}
      <KitBulkBar selection={own.tools.selection} actions={own.bulkActions} />
      {own.tools.menu.node}
      {agentImport.inputs}
      {agentImport.dialogs}
    </section>
  );
}

function GroupRows({
  id,
  rows,
  settings,
}: {
  id: OrganizerSectionId | null;
  rows: readonly OrganizerEntry[];
  settings: boolean;
}) {
  const { t: localizeUi } = useUiTranslation();
  return (
    <>
      {id ? (
        <tr className="ov-org__group">
          <td colSpan={5}>
            <b>{localizeUi(sectionLabelKey(id))}</b>
            <span>
              {rows.length} · {localizeUi(sectionHintKey(id))}
            </span>
          </td>
        </tr>
      ) : null}
      {rows.map((entry) => (
        <Row key={entry.manifest.id} entry={entry} settings={settings} />
      ))}
    </>
  );
}

function ownRunsLabel(row: OvAgentRow) {
  return row.app ? "App, opens its own screen" : (PHASE_LABEL[row.phase] ?? "—");
}

/** Agents the user made or imported: no catalog entry, so they open straight into their settings. */
function OwnRows({ rows, tools }: { rows: readonly OvAgentRow[]; tools: OwnTools }) {
  const localize = useLocalizedUiText();
  const openAgentDetail = useUIStore((s) => s.openAgentDetail);
  const activate = (row: OvAgentRow) => {
    if (tools.selection.on && tools.actionsFor(row)) tools.selection.toggle(row.id);
    else if (!tools.selection.on) openAgentDetail(row.id);
  };
  return (
    <>
      <tr className="ov-org__group">
        <td colSpan={5}>
          <b>{localize("Your agents")}</b>
          <span>
            {rows.length} · {localize("Made or imported by you")}
          </span>
        </td>
      </tr>
      {rows.map((row) => {
        const actions = tools.actionsFor(row);
        const checked = tools.selection.has(row.id);
        return (
          <tr
            key={row.id}
            data-ov-org-row
            tabIndex={0}
            className={cn(checked && "is-selected")}
            onClick={() => activate(row)}
            onContextMenu={actions ? (event) => tools.menu.openFromEvent(event, row.name, actions) : undefined}
            onKeyDown={(event) => {
              if (event.key === "Enter") activate(row);
            }}
          >
            <td>
              <span className="ov-org__name">
                {tools.selection.on && actions ? <KitCheck checked={checked} label={row.name} /> : null}
                <Thumb id={row.id} src={row.imagePath} />
                <b>{row.name}</b>
              </span>
            </td>
            <td className="ov-org__dim">{row.description || "—"}</td>
            <td className="ov-org__dim">{localize(ownRunsLabel(row))}</td>
            <td className="ov-org__dim">—</td>
            <td className="ov-org__actcell">
              <button type="button" className="ov-org__act is-quiet">
                {localize("Edit")}
              </button>
              {actions ? (
                <KitMoreButton
                  label={localize("More actions")}
                  onOpen={(event) => tools.menu.openFromEvent(event, row.name, actions, "button")}
                />
              ) : null}
            </td>
          </tr>
        );
      })}
    </>
  );
}

function OwnCard({ row, tools }: { row: OvAgentRow; tools: OwnTools }) {
  const localize = useLocalizedUiText();
  const openAgentDetail = useUIStore((s) => s.openAgentDetail);
  const actions = tools.actionsFor(row);
  const checked = tools.selection.has(row.id);
  const activate = () => {
    if (tools.selection.on && actions) tools.selection.toggle(row.id);
    else if (!tools.selection.on) openAgentDetail(row.id);
  };
  return (
    <div
      className={cn("ov-org-card", checked && "is-selected")}
      data-ov-org-row
      role="button"
      tabIndex={0}
      onClick={activate}
      onContextMenu={actions ? (event) => tools.menu.openFromEvent(event, row.name, actions) : undefined}
      onKeyDown={(event) => {
        if (event.key === "Enter") activate();
      }}
    >
      <div className="ov-org-card__art ov-org-card__art--own" style={{ background: swatch(row.id) }}>
        {tools.selection.on && actions ? (
          <span className="ov-card__check">
            <KitCheck checked={checked} label={row.name} />
          </span>
        ) : null}
        {actions ? (
          <KitMoreButton
            className="ov-card__more"
            label={localize("More actions")}
            onOpen={(event) => tools.menu.openFromEvent(event, row.name, actions, "button")}
          />
        ) : null}
      </div>
      <div className="ov-org-card__foot">
        <Thumb id={row.id} src={row.imagePath} />
        <span className="ov-org-card__text">
          <b>{row.name}</b>
          <span>{row.description || localize(ownRunsLabel(row))}</span>
        </span>
        <button type="button" className="ov-org__act is-quiet">
          {localize("Edit")}
        </button>
      </div>
    </div>
  );
}
