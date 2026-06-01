import { Compass, HelpCircle, Search, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "../../../../shared/lib/utils";
import {
  DISCOVERY_ENTRIES,
  type DiscoveryCategory,
  type DiscoveryCoverage,
  type DiscoveryEntry,
} from "../discovery-registry";
import { DISCOVERY_CATEGORIES, DISCOVERY_COVERAGE } from "../discovery-types";
import { getDiscoveryActionLabel, runDiscoveryAction } from "../lib/discovery-actions";
import { filterDiscoveryEntries } from "../lib/discovery-search";

const COVERAGE_LABELS: Record<DiscoveryCoverage, string> = {
  core: "Core",
  advanced: "Advanced",
  experimental: "Experimental",
  "needs-polish": "Needs polish",
};

const COVERAGE_CLASS: Record<DiscoveryCoverage, string> = {
  core: "border-emerald-400/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200",
  advanced: "border-sky-400/25 bg-sky-500/10 text-sky-700 dark:text-sky-200",
  experimental: "border-amber-400/25 bg-amber-500/10 text-amber-700 dark:text-amber-200",
  "needs-polish": "border-zinc-400/25 bg-zinc-500/10 text-zinc-600 dark:text-zinc-300",
};

function DiscoveryEntryRow({ entry }: { entry: DiscoveryEntry }) {
  return (
    <article className="rounded-lg border border-[var(--border)] bg-[var(--card)]/70 p-3 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold tracking-tight text-[var(--foreground)]">{entry.title}</h3>
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 text-[0.58rem] font-medium uppercase tracking-[0.14em]",
                COVERAGE_CLASS[entry.coverage],
              )}
            >
              {COVERAGE_LABELS[entry.coverage]}
            </span>
          </div>
          <p className="mt-1 text-[0.68rem] font-medium uppercase tracking-[0.14em] text-[var(--muted-foreground)]/70">
            {entry.category}
          </p>
        </div>
      </div>

      <p className="mt-2 text-[0.8rem] leading-relaxed text-[var(--foreground)]/90">{entry.summary}</p>
      <p className="mt-2 text-[0.72rem] leading-relaxed text-[var(--muted-foreground)]">
        <span className="font-medium text-[var(--foreground)]/80">For:</span> {entry.audience}
      </p>
      <p className="mt-1 text-[0.72rem] leading-relaxed text-[var(--muted-foreground)]">
        <span className="font-medium text-[var(--foreground)]/80">Find it:</span> {entry.where}
      </p>

      {entry.actions.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {entry.actions.map((action) => (
            <button
              key={`${entry.id}-${action.type}-${getDiscoveryActionLabel(action)}`}
              type="button"
              onClick={() => runDiscoveryAction(action)}
              className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--secondary)]/65 px-2.5 py-1 text-[0.72rem] font-medium text-[var(--foreground)] transition-colors hover:border-[var(--primary)]/40 hover:text-[var(--primary)]"
            >
              <Sparkles size="0.75rem" aria-hidden />
              {getDiscoveryActionLabel(action)}
            </button>
          ))}
        </div>
      )}
    </article>
  );
}

export function DiscoverPanel() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<DiscoveryCategory | "All">("All");
  const [coverage, setCoverage] = useState<DiscoveryCoverage | "All">("All");

  const entries = useMemo(
    () => filterDiscoveryEntries(DISCOVERY_ENTRIES, query, { category, coverage }),
    [category, coverage, query],
  );

  return (
    <div className="flex min-h-full flex-col gap-3 p-3">
      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)]/65 p-3 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--primary)]/25 bg-[var(--primary)]/10 text-[var(--primary)]">
            <Compass size="1rem" aria-hidden />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold tracking-tight text-[var(--foreground)]">Discover Marinara</h2>
            <p className="mt-1 text-xs leading-relaxed text-[var(--muted-foreground)]">
              Search by what you want to do, then jump to the surface that owns it.
            </p>
          </div>
        </div>

        <label className="mt-3 flex min-h-10 items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--background)]/55 px-3 text-sm text-[var(--foreground)] focus-within:border-[var(--primary)]/45">
          <Search size="0.9rem" className="shrink-0 text-[var(--muted-foreground)]" aria-hidden />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search features, e.g. voice, lore, webhook..."
            className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none placeholder:text-[var(--muted-foreground)]"
          />
        </label>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex gap-1 overflow-x-auto pb-1">
          {(["All", ...DISCOVERY_CATEGORIES] as const).map((item) => {
            const selected = category === item;
            return (
              <button
                key={item}
                type="button"
                onClick={() => setCategory(item)}
                className={cn(
                  "shrink-0 rounded-md border px-2.5 py-1.5 text-[0.68rem] font-medium transition-colors",
                  selected
                    ? "border-[var(--primary)]/45 bg-[var(--primary)]/12 text-[var(--primary)]"
                    : "border-[var(--border)] bg-[var(--card)]/60 text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
                )}
              >
                {item}
              </button>
            );
          })}
        </div>

        <div className="flex gap-1 overflow-x-auto pb-1">
          {(["All", ...DISCOVERY_COVERAGE] as const).map((item) => {
            const selected = coverage === item;
            return (
              <button
                key={item}
                type="button"
                onClick={() => setCoverage(item)}
                className={cn(
                  "shrink-0 rounded-md border px-2.5 py-1.5 text-[0.68rem] font-medium transition-colors",
                  selected
                    ? "border-[var(--primary)]/45 bg-[var(--primary)]/12 text-[var(--primary)]"
                    : "border-[var(--border)] bg-[var(--card)]/60 text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
                )}
              >
                {item === "All" ? "All coverage" : COVERAGE_LABELS[item]}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between px-0.5 text-[0.68rem] text-[var(--muted-foreground)]">
        <span>{entries.length} features</span>
        <span>{DISCOVERY_ENTRIES.length} tracked</span>
      </div>

      {entries.length > 0 ? (
        <div className="flex flex-col gap-2">
          {entries.map((entry) => (
            <DiscoveryEntryRow key={entry.id} entry={entry} />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--card)]/45 p-5 text-center">
          <HelpCircle size="1.25rem" className="mx-auto text-[var(--muted-foreground)]" aria-hidden />
          <p className="mt-2 text-sm font-semibold text-[var(--foreground)]">No matching features</p>
          <p className="mt-1 text-xs leading-relaxed text-[var(--muted-foreground)]">
            Try a broader word like voice, lore, image, agent, memory, import, or game.
          </p>
          <button
            type="button"
            onClick={() => runDiscoveryAction({ type: "open-professor-mari", label: "Ask Professor Mari" })}
            className="mt-3 inline-flex min-h-8 items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--secondary)]/70 px-3 py-1 text-xs font-medium text-[var(--foreground)] transition-colors hover:border-[var(--primary)]/40 hover:text-[var(--primary)]"
          >
            <Sparkles size="0.8rem" aria-hidden />
            Ask Professor Mari
          </button>
        </div>
      )}
    </div>
  );
}
