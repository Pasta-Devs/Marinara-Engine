// ──────────────────────────────────────────────
// UI overhaul: Library viewers (mockups Regex / Connections / Agents viewer)
//
// The Preset editor's master-detail layout for the other Library sections:
// a left column with the section's tools, search + New and a compact list
// grouped the way you think about the items; the clicked item opens on the
// right in its usual editor. One Library tab per section, not one per item.
// ──────────────────────────────────────────────
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronDown, Download, Plus, Search, Upload } from "lucide-react";
import { PROVIDERS, type APIConnection, type APIProvider } from "@marinara-engine/shared";
import { useUIStore } from "../../stores/ui.store";
import { useChatStore } from "../../stores/chat.store";
import { selectHomeBrowserPackages, useInstalledCapabilityPackages } from "../../hooks/use-capability-packages";
import { useOverhaulStore } from "../../stores/overhaul.store";
import { useConnections } from "../../hooks/use-connections";
import { useRegexScripts, useUpdateRegexScript, type RegexScriptRow } from "../../hooks/use-regex-scripts";
import { useLocalizedUiText } from "../../localization/use-localized-ui-text";
import { cn } from "../../lib/utils";
import {
  KIND_LABEL,
  Thumb,
  Toggle,
  connectionKind,
  flag,
  parseList,
  useOvAgentRows,
  useRegexImport,
  type ConnectionKind,
} from "./LibraryTables";

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
          {tools.map(({ label, onClick }) => (
            <button key={label} type="button" className="ov-btn" onClick={onClick}>
              {label}
            </button>
          ))}
          <button type="button" className="ov-btn ov-btn--primary" onClick={onNew}>
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

/** The viewer always shows an item, like the mockups: with nothing selected it opens the first one. */
function useAutoSelect(selectedId: string | null, firstId: string | undefined, open: (id: string) => void) {
  useEffect(() => {
    if (!selectedId && firstId) open(firstId);
  }, [firstId, open, selectedId]);
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

  useAutoSelect(selectedId, scripts[0]?.id, openRegexDetail);
  const enabledCount = scripts.filter((script) => script.enabled === "true").length;

  return (
    <OvViewer
      title={localize("Regex scripts")}
      meta={`${scripts.length} ${localize(scripts.length === 1 ? "script" : "scripts")} · ${enabledCount} ${localize("enabled")}`}
      tools={[{ label: localize("Import"), icon: Upload, onClick: () => fileRef.current?.click() }]}
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

const KIND_ORDER: ConnectionKind[] = ["text", "image", "video", "audio", "decision"];

export function OvConnectionsViewer({ children }: { children: ReactNode }) {
  const localize = useLocalizedUiText();
  const { data } = useConnections();
  const openModal = useUIStore((s) => s.openModal);
  const selectedId = useUIStore((s) => s.connectionDetailId);
  const openConnectionDetail = useUIStore((s) => s.openConnectionDetail);
  const [search, setSearch] = useState("");

  const connections = useMemo(
    () =>
      ((data ?? []) as Partial<APIConnection>[])
        .filter((row): row is Partial<APIConnection> & { id: string } => typeof row?.id === "string")
        .map((row) => ({ ...row, name: row.name ?? "", kind: connectionKind(String(row.provider ?? "")) }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [data],
  );
  const groups = useMemo<OvViewerGroup[]>(() => {
    const needle = search.trim().toLowerCase();
    return KIND_ORDER.map((kind) => ({
      id: kind,
      label: localize(KIND_LABEL[kind]),
      rows: connections
        .filter((row) => row.kind === kind)
        .filter(
          (row) =>
            !needle ||
            row.name.toLowerCase().includes(needle) ||
            String(row.model ?? "")
              .toLowerCase()
              .includes(needle),
        )
        .map((row) => ({
          id: row.id,
          name: row.name || localize("Untitled connection"),
          sub: [PROVIDERS[row.provider as APIProvider]?.name ?? row.provider, row.model].filter(Boolean).join(" · "),
          trail: flag(row.isDefault) ? <span className="ov-vw__badge">{localize("Default")}</span> : undefined,
        })),
    })).filter((group) => group.rows.length || group.id === "text");
  }, [connections, localize, search]);

  const firstId = groups.find((group) => group.rows.length)?.rows[0]?.id;
  useAutoSelect(selectedId, firstId, openConnectionDetail);

  return (
    <OvViewer
      title={localize("Connections")}
      meta={`${connections.length} ${localize(connections.length === 1 ? "connection" : "connections")}`}
      tools={[{ label: localize("Import"), icon: Upload, onClick: () => openModal("import-connection") }]}
      listLabel={localize("Connections")}
      search={search}
      onSearch={setSearch}
      searchPlaceholder={localize("Search connections…")}
      newLabel={localize("New connection")}
      onNew={() => openModal("create-connection")}
      groups={groups}
      selectedId={selectedId}
      onSelect={(id) => openConnectionDetail(id)}
      emptyList={localize("No connections yet.")}
      emptyDetail={localize("Pick a connection on the left, or make a new one.")}
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
  useAutoSelect(selectedId, firstId, openAgentDetail);

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
