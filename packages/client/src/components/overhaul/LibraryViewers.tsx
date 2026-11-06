// ──────────────────────────────────────────────
// UI overhaul: Library viewers (mockups Regex / Connections / Agents viewer)
//
// The Preset editor's master-detail layout for the other Library sections:
// a left column with the section's tools, search + New and a compact list
// grouped the way you think about the items; the clicked item opens on the
// right in its usual editor. One Library tab per section, not one per item.
// ──────────────────────────────────────────────
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronDown, Download, Plus, Search } from "lucide-react";
import { PROVIDERS, type APIConnection, type APIProvider } from "@marinara-engine/shared";
import { useUIStore } from "../../stores/ui.store";
import { useChatStore } from "../../stores/chat.store";
import { selectHomeBrowserPackages, useInstalledCapabilityPackages } from "../../hooks/use-capability-packages";
import { useOverhaulStore } from "../../stores/overhaul.store";
import { useConnections } from "../../hooks/use-connections";
import { useConnectionAccounts } from "../../hooks/use-connection-accounts";
import { groupModelsByAccount } from "../../lib/connection-groups";
import { useRegexScripts, useUpdateRegexScript, type RegexScriptRow } from "../../hooks/use-regex-scripts";
import { useLocalizedUiText } from "../../localization/use-localized-ui-text";
import { cn } from "../../lib/utils";
import { Thumb, Toggle, flag, parseList, useOvAgentRows, useRegexImport } from "./LibraryTables";

export type OvViewerRow = {
  id: string;
  name: string;
  sub?: ReactNode;
  lead?: ReactNode;
  trail?: ReactNode;
  dim?: boolean;
  monoSub?: boolean;
};

export type OvViewerGroup = { id: string; label: string; rows: OvViewerRow[] };

export type OvViewerTool = { label: string; icon: typeof Plus; onClick: () => void };

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
}: {
  title: string;
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
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  const visible = groups.filter((group) => group.rows.length || !search);
  const total = groups.reduce((sum, group) => sum + group.rows.length, 0);
  return (
    <div className="ov-vw">
      <header className="ov-vw__top">
        <h1>{title}</h1>
        <small>{meta}</small>
        <div className="ov-vw__actions">
          {tools.map(({ label, icon: Icon, onClick }) => (
            <button key={label} type="button" className="ov-btn" onClick={onClick}>
              {Icon ? <Icon size={14} aria-hidden="true" /> : null}
              {label}
            </button>
          ))}
          <button type="button" className="ov-btn ov-btn--primary" data-ov-anchor={newAnchor} onClick={onNew}>
            <Plus size={14} aria-hidden="true" />
            {newLabel}
          </button>
        </div>
      </header>
      <aside className="ov-vw__left" aria-label={title}>
        <div className="ov-vw__find">
          <label className="ov-vw__search">
            <Search size={13} aria-hidden="true" />
            <input value={search} onChange={(event) => onSearch(event.target.value)} placeholder={searchPlaceholder} />
          </label>
        </div>
        <p className="ov-vw__label">
          {listLabel}
          {listNote ? <small>{listNote}</small> : null}
        </p>
        <div className="ov-vw__list" role="listbox" aria-label={listLabel}>
          {total === 0 ? <p className="ov-vw__empty">{emptyList}</p> : null}
          {visible.map((group) => {
            const isClosed = closed[group.id] && !search;
            return (
              <section key={group.id} className="ov-vw__group">
                {group.label ? (
                  <button
                    type="button"
                    className="ov-vw__ghead"
                    aria-expanded={!isClosed}
                    onClick={() => setClosed((current) => ({ ...current, [group.id]: !current[group.id] }))}
                  >
                    <ChevronDown size={13} className={cn(isClosed && "-rotate-90")} aria-hidden="true" />
                    <span>{group.label}</span>
                    <small>{group.rows.length}</small>
                  </button>
                ) : null}
                {isClosed
                  ? null
                  : group.rows.map((row) => (
                      <div
                        key={row.id}
                        role="option"
                        tabIndex={0}
                        aria-selected={row.id === selectedId}
                        className={cn("ov-vw__row", row.id === selectedId && "is-on", row.dim && "is-dim")}
                        onClick={() => onSelect(row.id)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            onSelect(row.id);
                          }
                        }}
                      >
                        {row.lead ? <span className="ov-vw__lead">{row.lead}</span> : null}
                        <span className="ov-vw__text">
                          <span className="ov-vw__name">{row.name}</span>
                          {row.sub ? <small className={cn(row.monoSub && "is-mono")}>{row.sub}</small> : null}
                        </span>
                        {row.trail ? <span className="ov-vw__trail">{row.trail}</span> : null}
                      </div>
                    ))}
              </section>
            );
          })}
        </div>
      </aside>
      <div className="ov-vw__main">{children ?? <p className="ov-vw__pick">{emptyDetail}</p>}</div>
    </div>
  );
}

/**
 * The viewer always shows an item, like the mockups: with nothing selected it opens the first one.
 * Only while its Library page is the one on screen, so leaving it (Home, a chat) closes the item
 * instead of reopening it on the way out.
 */
function useAutoSelect(
  section: "regex" | "connections" | "agents",
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
  const groups = useMemo<OvViewerGroup[]>(() => {
    const needle = search.trim().toLowerCase();
    const buckets: Record<string, OvViewerRow[]> = { global: [], presets: [], characters: [] };
    for (const script of scripts) {
      if (needle && !script.name.toLowerCase().includes(needle) && !script.findRegex.toLowerCase().includes(needle))
        continue;
      const enabled = script.enabled === "true";
      const bucket = parseList(script.targetCharacterIds).length
        ? "characters"
        : parseList(script.targetPromptPresetIds).length
          ? "presets"
          : "global";
      buckets[bucket]!.push({
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
      });
    }
    return [
      { id: "global", label: localize("Global"), rows: buckets.global! },
      { id: "presets", label: localize("Scoped to presets"), rows: buckets.presets! },
      { id: "characters", label: localize("Scoped to characters"), rows: buckets.characters! },
    ].filter((group) => group.rows.length || group.id === "global");
  }, [localize, scripts, search, updateRegex]);

  useAutoSelect("regex", selectedId, scripts[0]?.id, openRegexDetail);
  const enabledCount = scripts.filter((script) => script.enabled === "true").length;

  return (
    <OvViewer
      title={localize("Regex scripts")}
      meta={`${scripts.length} ${localize(scripts.length === 1 ? "script" : "scripts")} · ${enabledCount} ${localize("enabled")}`}
      tools={[{ label: localize("Import"), icon: Download, onClick: () => fileRef.current?.click() }]}
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
    return list;
  }, [grouped, localize, search]);

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
      newLabel={localize("Add connection")}
      newAnchor="ov-add-account-viewer"
      onNew={() => openModal("create-connection", { anchor: "ov-add-account-viewer" })}
      groups={groups}
      selectedId={selectedId}
      onSelect={(id) => openConnectionDetail(id)}
      emptyList={localize("No accounts yet.")}
      emptyDetail={localize("Pick a model on the left, or add an account.")}
    >
      {children}
    </OvViewer>
  );
}

// ── Agents ──

const AGENT_GROUPS: Array<{ id: string; label: string; match: (row: { phase: string; app?: boolean }) => boolean }> = [
  { id: "apps", label: "Apps", match: (row) => Boolean(row.app) },
  { id: "pre", label: "Before the reply", match: (row) => !row.app && row.phase === "pre_generation" },
  { id: "with", label: "Alongside the reply", match: (row) => !row.app && row.phase === "parallel" },
  { id: "post", label: "After the reply", match: (row) => !row.app && row.phase === "post_processing" },
];

export function OvAgentsViewer({ children }: { children: ReactNode }) {
  const localize = useLocalizedUiText();
  const { rows } = useOvAgentRows();
  const selectedId = useUIStore((s) => s.agentDetailId);
  const openAgentDetail = useUIStore((s) => s.openAgentDetail);
  const openAgentCatalog = useUIStore((s) => s.openAgentCatalog);
  const installed = useInstalledCapabilityPackages();
  const homeAppIds = useMemo(
    () => new Set(selectHomeBrowserPackages(installed.data).map((item) => item.id)),
    [installed.data],
  );
  const [search, setSearch] = useState("");

  const groups = useMemo<OvViewerGroup[]>(() => {
    const needle = search.trim().toLowerCase();
    const list = [...rows]
      .filter(
        (row) => !needle || row.name.toLowerCase().includes(needle) || row.description?.toLowerCase().includes(needle),
      )
      .sort((a, b) => a.name.localeCompare(b.name));
    const known = new Set<string>();
    const result = AGENT_GROUPS.map((group) => {
      const matched = list.filter((row) => group.match(row));
      matched.forEach((row) => known.add(row.id));
      return { id: group.id, label: localize(group.label), rows: matched };
    });
    const other = list.filter((row) => !known.has(row.id));
    if (other.length) result.push({ id: "other", label: localize("Other"), rows: other });
    return result
      .filter((group) => group.rows.length)
      .map((group) => ({
        ...group,
        rows: group.rows.map((row) => ({
          id: row.id,
          name: row.name,
          sub: row.app ? localize("App, opens in its own tab") : row.description,
          lead: <Thumb id={row.id} src={row.imagePath} />,
        })),
      }));
  }, [localize, rows, search]);

  const firstId = groups.find((group) => group.id !== "apps")?.rows[0]?.id ?? groups[0]?.rows[0]?.id;
  useAutoSelect("agents", selectedId, firstId, openAgentDetail);

  return (
    <OvViewer
      title={localize("Agents")}
      meta={`${rows.length} ${localize("installed")}`}
      tools={[{ label: localize("Download agents"), icon: Download, onClick: () => openAgentCatalog() }]}
      listLabel={localize("Installed")}
      listNote={localize("grouped by when they run")}
      search={search}
      onSearch={setSearch}
      searchPlaceholder={localize("Search agents…")}
      newLabel={localize("New agent")}
      onNew={() => openAgentDetail("__new__")}
      groups={groups}
      selectedId={selectedId}
      onSelect={(id) => {
        // Home apps (Noodle, Slurp...) open in their own tab, not on a settings page.
        if (homeAppIds.has(id)) {
          useUIStore.getState().closeAllDetails();
          useChatStore.getState().setActiveChatId(null);
          useOverhaulStore.getState().openApp(id);
        } else openAgentDetail(id);
      }}
      emptyList={localize("No agents installed yet. Use Download agents to add some.")}
      emptyDetail={localize("Pick an agent on the left, or download some.")}
    >
      {children}
    </OvViewer>
  );
}
