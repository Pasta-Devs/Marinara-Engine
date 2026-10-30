import { useState, type ReactNode } from "react";
import { ArrowUpDown, ChevronDown, ChevronRight } from "lucide-react";
import { compareCapabilityPackageVersions } from "@marinara-engine/shared";
import { useTranslation as useUiTranslation } from "react-i18next";
import { useCapabilityPackageReleaseNotes } from "../../../hooks/use-capability-packages";
import { cn } from "../../../lib/utils";
import { AgentReleaseNoteList } from "../AgentReleaseNoteList";
import { AgentUpdateFailure, AgentUpdateStatus, type AgentUpdateResult } from "../AgentUpdateDialog";
import {
  formatBytes,
  checkReasonOf,
  hasUpdate,
  sectionHintKey,
  sectionLabelKey,
  typeLabelKey,
  typeOf,
  type OrganizerEntry,
  type OrganizerSectionId,
} from "./organizer-model";
import { AgentRow, IconStack, PRIMARY_ACTION, useOrganizer } from "./OrganizerParts";

function PageHeader({ title, hint, children }: { title: string; hint?: string; children?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-xl font-bold text-[var(--foreground)]">{title}</h2>
        {hint && <p className="text-sm text-[var(--muted-foreground)]">{hint}</p>}
      </div>
      {children && <div className="flex items-center gap-3">{children}</div>}
    </div>
  );
}

type SortKey = "store" | "name-asc" | "name-desc" | "newest" | "size";

const SORT_LABEL_KEYS: Record<SortKey, string> = {
  store: "ui.agents.organizer.sortStore",
  "name-asc": "ui.panels.backgroundpicker.aZ",
  "name-desc": "ui.panels.backgroundpicker.zA",
  newest: "ui.agents.organizer.sortInstalled",
  size: "ui.agents.organizer.sortSize",
};

function sortEntries(
  entries: readonly OrganizerEntry[],
  key: SortKey,
  installedAt: (id: string) => string = () => "",
): readonly OrganizerEntry[] {
  if (key === "store") return entries;
  return [...entries].sort((a, b) =>
    key === "size"
      ? b.artifact.bytes - a.artifact.bytes
      : key === "newest"
        ? installedAt(b.manifest.id).localeCompare(installedAt(a.manifest.id))
        : (key === "name-desc" ? -1 : 1) * a.manifest.name.localeCompare(b.manifest.name),
  );
}

function SortSelect({ value, keys, onChange }: { value: SortKey; keys: SortKey[]; onChange: (key: SortKey) => void }) {
  const { t: localizeUi } = useUiTranslation();
  return (
    <div className="relative shrink-0">
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as SortKey)}
        title={localizeUi("ui.panels.agentspanel.sortOrder")}
        aria-label={localizeUi("ui.panels.agentspanel.sortOrder")}
        className="mari-chrome-field mari-chrome-sort-field mari-accent-animated h-9 appearance-none py-0 pl-2.5 pr-7 text-xs"
      >
        {keys.map((key) => (
          <option key={key} value={key}>
            {localizeUi(SORT_LABEL_KEYS[key])}
          </option>
        ))}
      </select>
      <ArrowUpDown
        size="0.625rem"
        className="mari-chrome-field-icon mari-chrome-sort-icon mari-accent-animated pointer-events-none absolute right-2 top-1/2 -translate-y-1/2"
      />
    </div>
  );
}

function EmptyLine({ children }: { children: ReactNode }) {
  return <p className="py-10 text-center text-sm text-[var(--muted-foreground)]">{children}</p>;
}

export function SectionPage({ section, entries }: { section: OrganizerSectionId; entries: readonly OrganizerEntry[] }) {
  const { t: localizeUi } = useUiTranslation();
  const [sort, setSort] = useState<SortKey>("store");
  const sorted = sortEntries(entries, sort);
  return (
    <div>
      <PageHeader title={localizeUi(sectionLabelKey(section))} hint={localizeUi(sectionHintKey(section))}>
        <SortSelect value={sort} keys={["store", "name-asc", "name-desc", "size"]} onChange={setSort} />
        <span className="text-xs text-[var(--muted-foreground)]">
          {localizeUi("ui.agents.organizer.agentCount", { count: entries.length })}
        </span>
      </PageHeader>
      {entries.length === 0 ? (
        <EmptyLine>{localizeUi("ui.agents.organizer.emptySection")}</EmptyLine>
      ) : (
        <ul className="grid grid-cols-[minmax(0,1fr)] gap-x-6 xl:grid-cols-2">
          {sorted.map((entry) => (
            <AgentRow key={entry.manifest.id} entry={entry} withMenu />
          ))}
        </ul>
      )}
    </div>
  );
}

export function InstalledPage({ entries }: { entries: readonly OrganizerEntry[] }) {
  const { installedById, chatCountById } = useOrganizer();
  const { t: localizeUi } = useUiTranslation();
  const [sort, setSort] = useState<SortKey>("name-asc");
  const rows = sortEntries(
    entries.filter((entry) => installedById.has(entry.manifest.id)),
    sort,
    (id) => installedById.get(id)?.installedAt ?? "",
  );
  return (
    <div>
      <PageHeader
        title={localizeUi("ui.agents.organizer.installedTitle")}
        hint={localizeUi("ui.agents.organizer.agentCount", { count: rows.length })}
      >
        <SortSelect value={sort} keys={["name-asc", "name-desc", "newest", "size"]} onChange={setSort} />
      </PageHeader>
      {rows.length === 0 ? (
        <EmptyLine>{localizeUi("ui.agents.organizer.emptyInstalled")}</EmptyLine>
      ) : (
        <ul>
          {rows.map((entry) => {
            const installed = installedById.get(entry.manifest.id)!;
            const update = hasUpdate(entry, installed);
            return (
              <AgentRow
                key={entry.manifest.id}
                entry={entry}
                withMenu
                side={formatBytes(entry.artifact.bytes)}
                meta={
                  <>
                    {localizeUi(typeLabelKey(typeOf(entry)))} · {installed.version}
                    {update && (
                      <span className="font-semibold text-[var(--marinara-chat-chrome-accent,var(--primary))]">
                        {" "}
                        → {entry.manifest.version}
                      </span>
                    )}
                    {(chatCountById.get(entry.manifest.id) ?? 0) > 0 && (
                      <>
                        {" "}
                        · {localizeUi("ui.agents.organizer.onInChats", { count: chatCountById.get(entry.manifest.id) })}
                      </>
                    )}
                    {checkReasonOf(installed) !== null && (
                      <>
                        {" "}
                        ·{" "}
                        <span className="font-semibold text-[var(--marinara-app-accent-static)]">
                          {localizeUi("ui.agents.organizer.needsCheck")}
                        </span>
                      </>
                    )}
                  </>
                }
              />
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Notes for the versions newer than the installed one; fetched only once opened. */
function UpdateNotes({ entry, installedVersion }: { entry: OrganizerEntry; installedVersion: string }) {
  const { t: localizeUi } = useUiTranslation();
  const [open, setOpen] = useState(false);
  const { data } = useCapabilityPackageReleaseNotes(entry.manifest.id, open);
  const notes = (data ?? []).filter((note) => compareCapabilityPackageVersions(note.version, installedVersion) > 0);
  return (
    <div className="pb-3 pl-[3.75rem]">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-1 rounded-md text-xs font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
      >
        {open ? <ChevronDown size="0.8rem" aria-hidden="true" /> : <ChevronRight size="0.8rem" aria-hidden="true" />}
        {localizeUi("ui.agents.agentupdatedialog.whatChanged")}
      </button>
      {open &&
        (notes.length > 0 ? (
          <div className="mt-2">
            <AgentReleaseNoteList entries={notes} clamp={notes.length > 1} />
          </div>
        ) : (
          <p className="mt-2 text-xs text-[var(--muted-foreground)]">{localizeUi("ui.agents.organizer.noNotes")}</p>
        ))}
    </div>
  );
}

/** An "Update all" run: its rows stay listed with their result after they are up to date. */
export interface UpdateRun {
  rows: OrganizerEntry[];
  /** Installed version of each row when the run started, by package id. */
  from: Record<string, string>;
  results: Record<string, AgentUpdateResult>;
  running: boolean;
}

export function UpdatesPage({
  entries,
  run,
  onUpdateAll,
  onRetry,
}: {
  entries: readonly OrganizerEntry[];
  run: UpdateRun | null;
  onUpdateAll: () => void;
  onRetry: (entry: OrganizerEntry) => void;
}) {
  const { installedById, pending } = useOrganizer();
  const { t: localizeUi } = useUiTranslation();
  const rows = run?.rows ?? entries.filter((entry) => hasUpdate(entry, installedById.get(entry.manifest.id)));
  const notUpdated = rows.filter((entry) => run?.results[entry.manifest.id]?.status !== "updated").length;
  return (
    <div>
      <PageHeader
        title={localizeUi("ui.agents.organizer.updatesTitle")}
        hint={notUpdated > 0 ? localizeUi("ui.agents.organizer.updatesReady", { count: notUpdated }) : undefined}
      >
        {rows.length > 1 && !run && (
          <button
            type="button"
            className={cn(PRIMARY_ACTION, "h-9 gap-2 px-4 text-sm font-semibold")}
            disabled={pending}
            onClick={onUpdateAll}
          >
            <IconStack entries={rows} />
            {localizeUi("ui.agents.organizer.updateAll")}
          </button>
        )}
      </PageHeader>
      {rows.length === 0 ? (
        <EmptyLine>{localizeUi("ui.agents.organizer.emptyUpdates")}</EmptyLine>
      ) : (
        <ul>
          {rows.map((entry) => {
            const installedVersion = run?.from[entry.manifest.id] ?? installedById.get(entry.manifest.id)!.version;
            const result = run?.results[entry.manifest.id];
            return (
              <AgentRow
                key={entry.manifest.id}
                entry={entry}
                action={run ? <AgentUpdateStatus result={result} /> : undefined}
                meta={`${localizeUi("ui.agents.organizer.versionChange", { from: installedVersion, to: entry.manifest.version })}${
                  entry.manifest.restartRequired
                    ? ` · ${localizeUi("ui.agents.agentupdatedialog.restartRequired")}`
                    : ""
                }`}
              >
                {result?.status === "failed" && (
                  <AgentUpdateFailure error={result.error} disabled={pending} onRetry={() => onRetry(entry)} />
                )}
                <UpdateNotes entry={entry} installedVersion={installedVersion} />
              </AgentRow>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function SearchResults({ query, entries }: { query: string; entries: readonly OrganizerEntry[] }) {
  const { t: localizeUi } = useUiTranslation();
  return (
    <div>
      <PageHeader
        title={localizeUi("ui.agents.organizer.resultsFor", { query })}
        hint={localizeUi("ui.agents.organizer.agentCount", { count: entries.length })}
      />
      {entries.length === 0 ? (
        <EmptyLine>{localizeUi("ui.agents.agentcatalogview.noMatchingAgents")}</EmptyLine>
      ) : (
        <ul className="grid grid-cols-[minmax(0,1fr)] gap-x-6 xl:grid-cols-2">
          {entries.map((entry) => (
            <AgentRow key={entry.manifest.id} entry={entry} withMenu />
          ))}
        </ul>
      )}
    </div>
  );
}
