// ──────────────────────────────────────────────
// UI overhaul: Library landing pages as compact tables
//
// Lorebooks, Presets, Regex scripts, Connections and Agents each get a title
// with Import / New, one toolbar row (search, filter chips, List/Gallery where
// items have pictures, sort) and a dense table. Clicking a row opens its editor.
// ──────────────────────────────────────────────
import { useMemo, useRef, useState, type ReactNode } from "react";
import { Plus, Search, Download, List, LayoutGrid } from "lucide-react";
import { toast } from "sonner";
import {
  BUILT_IN_AGENTS,
  isAgentConfigDeleted,
  isRetiredBuiltInAgentId,
  type APIConnection,
  type Lorebook,
} from "@marinara-engine/shared";
import { useUIStore } from "../../stores/ui.store";
import { useOverhaulMobile, useOverhaulStore } from "../../stores/overhaul.store";
import { useLorebooks, useUpdateLorebook } from "../../hooks/use-lorebooks";
import { usePresets } from "../../hooks/use-presets";
import { useConnections } from "../../hooks/use-connections";
import { useAgentConfigs, type AgentConfigRow } from "../../hooks/use-agents";
import { useCapabilityAgentRegistry } from "../../hooks/use-capability-packages";
import {
  useImportRegexScript,
  useRegexScripts,
  useUpdateRegexScript,
  type RegexScriptRow,
} from "../../hooks/use-regex-scripts";
import { useLocalizedUiText } from "../../localization/use-localized-ui-text";
import { formatRelativeContact } from "../../lib/relative-time";
import { resolvePresetArtwork } from "../../lib/preset-artwork";
import { cn } from "../../lib/utils";
import { getImportEntries, getNextRegexOrderBase, normalizeRegexImportEntry } from "../panels/PresetsPanel";

// ── Shared pieces ──

type Column<T> = {
  key: string;
  label: string;
  className?: string;
  render: (row: T) => ReactNode;
};

type Chip = { id: string; label: string };

export function swatch(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  const hue = Math.abs(hash) % 360;
  return `linear-gradient(160deg, hsl(${hue} 55% 55%), hsl(${(hue + 35) % 360} 45% 30%))`;
}

export function Thumb({ id, src }: { id: string; src?: string | null }) {
  return (
    <span className="ov-thumb" style={src ? undefined : { background: swatch(id) }} aria-hidden="true">
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

function ListPage<T extends { id: string }>({
  title,
  actions,
  searchPlaceholder,
  search,
  onSearch,
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
}: {
  title: string;
  actions: ReactNode;
  searchPlaceholder: string;
  search: string;
  onSearch: (value: string) => void;
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
  gallery?: { on: boolean; render: (row: T) => ReactNode };
  empty: string;
}) {
  const localize = useLocalizedUiText();
  // New layout on phones: the filter chips become one dropdown beside + New, the view switch
  // sits at the end of that line, and the sort shares the search bar's line.
  const mobile = useOverhaulMobile();
  return (
    <section className="ov-list" data-component="OverhaulLibraryList">
      <header className="ov-gallery__head">
        <h1>{title}</h1>
        {actions}
        {mobile && chips?.length ? (
          <select
            className="ov-select ovm-lp-filter"
            value={chip}
            onChange={(event) => onChip?.(event.target.value)}
            aria-label={localize("Filter")}
          >
            {chips.map((item) => (
              <option key={item.id} value={item.id}>
                {localize(item.label)}
              </option>
            ))}
          </select>
        ) : null}
        {mobile ? view : null}
      </header>
      <div className="ov-gallery__tools">
        <label className="ov-search">
          <Search size={14} aria-hidden="true" />
          <input value={search} onChange={(event) => onSearch(event.target.value)} placeholder={searchPlaceholder} />
        </label>
        {(mobile ? [] : (chips ?? [])).map((item) => (
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
      {rows.length === 0 ? (
        <p className="ov-list__empty">{empty}</p>
      ) : gallery?.on ? (
        <div className="ov-gallery__grid">{rows.map((row) => gallery.render(row))}</div>
      ) : (
        <div className="ov-table-wrap">
          <table className="ov-table">
            <thead>
              <tr>
                {leading ? <th className="ov-table__lead" aria-hidden="true" /> : null}
                {columns.map((column) => (
                  <th key={column.key} className={column.className}>
                    {localize(column.label)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  tabIndex={0}
                  onClick={() => onOpen(row)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") onOpen(row);
                  }}
                >
                  {leading ? <td className="ov-table__lead">{leading(row)}</td> : null}
                  {columns.map((column) => (
                    <td key={column.key} className={column.className}>
                      {column.render(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

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
}: {
  id: string;
  name: string;
  sub: string;
  src?: string | null;
  onOpen: () => void;
}) {
  return (
    <div key={id} className="ov-card">
      <button
        type="button"
        className="ov-card__art ov-card__art--square"
        onClick={onOpen}
        style={src ? undefined : { background: swatch(id) }}
        aria-label={name}
      >
        {src ? <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" /> : null}
      </button>
      <button type="button" className="ov-card__name" onClick={onOpen}>
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
  const openModal = useUIStore((s) => s.openModal);
  const openLorebookDetail = useUIStore((s) => s.openLorebookDetail);
  const [search, setSearch] = useState("");
  const [chip, setChip] = useState("all");
  const [gallery, setGallery] = useState(false);
  const [sort, setSort] = useState<SortKey>("recent");

  const tagFilter = useOverhaulStore((s) => s.lorebookTag);
  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const wantedTag = tagFilter?.toLowerCase() ?? null;
    const list = (data ?? []).filter((book) => {
      if (wantedTag !== null) {
        const tags = (book.tags ?? []).filter((tag) => tag.trim());
        if (wantedTag === "" ? tags.length > 0 : !tags.some((tag) => tag.toLowerCase() === wantedTag)) return false;
      }
      if (chip === "global" && !book.isGlobal) return false;
      if (chip !== "all" && chip !== "global" && book.category !== chip) return false;
      if (!needle) return true;
      return (
        book.name.toLowerCase().includes(needle) ||
        book.description?.toLowerCase().includes(needle) ||
        book.tags?.some((tag) => tag.toLowerCase().includes(needle))
      );
    });
    return sortRows(list, sort);
  }, [chip, data, search, sort, tagFilter]);

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
      toolsEnd={<SortSelect value={sort} onChange={setSort} options={SORTS} />}
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
        render: (book) => (
          <GalleryTile
            key={book.id}
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
  const openModal = useUIStore((s) => s.openModal);
  const openPresetDetail = useUIStore((s) => s.openPresetDetail);
  const [search, setSearch] = useState("");
  const [chip, setChip] = useState("all");
  const [gallery, setGallery] = useState(false);
  const [sort, setSort] = useState<SortKey>("recent");

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const list = (data ?? []).filter((preset) => {
      if (chip === "defaults" && !preset.isDefault) return false;
      if (!needle) return true;
      return preset.name.toLowerCase().includes(needle) || preset.description?.toLowerCase().includes(needle);
    });
    return sortRows(list, sort);
  }, [chip, data, search, sort]);

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
      toolsEnd={<SortSelect value={sort} onChange={setSort} options={SORTS} />}
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
          render: (preset) => preset.sectionOrder?.length ?? 0,
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
        render: (preset) => (
          <GalleryTile
            key={preset.id}
            id={preset.id}
            name={preset.name}
            sub={`${preset.sectionOrder?.length ?? 0} ${localize("sections")}`}
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

export function RegexLanding() {
  const localize = useLocalizedUiText();
  const { data } = useRegexScripts();
  const updateRegex = useUpdateRegexScript();
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

export function AgentsLanding() {
  const localize = useLocalizedUiText();
  const { rows: data } = useOvAgentRows();
  const { data: connections } = useConnections();
  const openAgentDetail = useUIStore((s) => s.openAgentDetail);
  const openAgentCatalog = useUIStore((s) => s.openAgentCatalog);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("name-asc");

  const connectionName = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of (connections ?? []) as Partial<APIConnection>[]) {
      if (row?.id) map.set(row.id, row.name ?? row.id);
    }
    return map;
  }, [connections]);

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const list = data.filter(
      (agent) =>
        !needle || agent.name.toLowerCase().includes(needle) || agent.description?.toLowerCase().includes(needle),
    );
    // Apps first, so installed apps like Noodle are easy to find and open.
    return sortRows(list, sort).sort((a, b) => Number(Boolean(b.app)) - Number(Boolean(a.app)));
  }, [data, search, sort]);

  return (
    <ListPage
      title={localize("Agents")}
      actions={
        <>
          <button type="button" className="ov-btn" onClick={() => openAgentCatalog()}>
            {localize("Download Agents")}
          </button>
          <NewButton label={localize("New")} onClick={() => openAgentDetail("__new__")} />
        </>
      }
      searchPlaceholder={localize("Search agents")}
      search={search}
      onSearch={setSearch}
      toolsEnd={<SortSelect value={sort} onChange={setSort} options={SORTS} />}
      rows={rows}
      onOpen={(agent) => openAgentDetail(agent.id)}
      columns={[
        {
          key: "name",
          label: "Agent",
          className: "ov-table__name",
          render: (agent) => (
            <span className="ov-table__title">
              <Thumb id={agent.id} src={agent.imagePath} />
              <span>{agent.name}</span>
            </span>
          ),
        },
        {
          key: "description",
          label: "Description",
          className: "ov-table__desc",
          render: (agent) => agent.description || "—",
        },
        {
          key: "phase",
          label: "Runs",
          render: (agent) =>
            agent.app
              ? localize("App, opens its own screen")
              : localize(PHASE_LABEL[agent.phase] ?? agent.phase ?? "—"),
        },
        {
          key: "connection",
          label: "Connection",
          render: (agent) =>
            agent.connectionId ? (connectionName.get(agent.connectionId) ?? localize("Unknown")) : localize("Default"),
        },
      ]}
      empty={localize("No agents installed yet. Use Download Agents to add some.")}
    />
  );
}
