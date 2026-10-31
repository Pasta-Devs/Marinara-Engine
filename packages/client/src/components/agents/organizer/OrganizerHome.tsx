import { ChevronRight } from "lucide-react";
import { useTranslation as useUiTranslation } from "react-i18next";
import type { CapabilityStoreKit } from "@marinara-engine/shared";
import { cn } from "../../../lib/utils";
import {
  featuredEntries,
  hasUpdate,
  ORGANIZER_SECTIONS,
  sectionHintKey,
  sectionLabelKey,
  sectionOf,
  taglineOf,
  type OrganizerEntry,
} from "./organizer-model";
import {
  AgentAction,
  AgentIcon,
  AgentRow,
  IconStack,
  PRIMARY_ACTION,
  SECONDARY_ACTION,
  StoreBanner,
  useOrganizer,
  useShownEntry,
} from "./OrganizerParts";

const SHELF_SIZE = 4;

export type OrganizerKit = CapabilityStoreKit & { entries: readonly OrganizerEntry[] };

function FeaturedCard({ entry, large, priority }: { entry: OrganizerEntry; large: boolean; priority: boolean }) {
  const { go } = useOrganizer();
  const { t: localizeUi } = useUiTranslation();
  const shown = useShownEntry(entry);
  return (
    <div className="group relative isolate overflow-hidden rounded-2xl border border-[var(--border)]">
      <StoreBanner
        entry={entry}
        priority={priority}
        sizes={large ? "(min-width: 1024px) 60vw, 100vw" : "(min-width: 1024px) 30vw, 100vw"}
        className={cn(
          "absolute inset-0 -z-10 h-full w-full transition-transform duration-300 group-hover:scale-[1.02] motion-reduce:transition-none",
        )}
      />
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
      <button
        type="button"
        onClick={() => go({ kind: "agent", id: entry.manifest.id })}
        className={cn(
          "flex w-full flex-col justify-end text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--ring)]",
          large ? "aspect-[16/10] p-5 sm:aspect-[16/9]" : "aspect-[8/3] p-4 lg:aspect-auto lg:h-full lg:min-h-36",
        )}
      >
        <span className="mb-2 text-[0.6875rem] font-semibold tracking-wide text-white/80">
          {large
            ? localizeUi("ui.agents.organizer.featuredIn", { section: localizeUi(sectionLabelKey(sectionOf(entry))) })
            : localizeUi(sectionLabelKey(sectionOf(entry)))}
        </span>
        <span className="flex items-center gap-3 pr-24">
          <AgentIcon entry={entry} className={large ? "h-14 w-14 bg-black/40" : "h-10 w-10 bg-black/40"} />
          <span className="min-w-0">
            <span className={cn("block truncate font-bold text-white", large ? "text-2xl" : "text-base")}>
              {shown.name}
            </span>
            <span className="line-clamp-2 text-xs text-white/85 sm:text-sm">{taglineOf(entry, shown.description)}</span>
          </span>
        </span>
      </button>
      <div className={cn("absolute right-4", large ? "bottom-5" : "bottom-4")}>
        <AgentAction entry={entry} light />
      </div>
    </div>
  );
}

export function OrganizerHome({
  entries,
  kits,
  onUpdateAll,
  onInstallKit,
}: {
  entries: readonly OrganizerEntry[];
  kits: readonly OrganizerKit[];
  onUpdateAll: () => void;
  onInstallKit: (entries: readonly OrganizerEntry[]) => void;
}) {
  const { installedById, go, pending } = useOrganizer();
  const { t: localizeUi } = useUiTranslation();
  const featured = featuredEntries(entries).slice(0, 3);
  const updates = entries.filter((entry) => hasUpdate(entry, installedById.get(entry.manifest.id)));

  return (
    <div className="space-y-8">
      {featured.length > 0 && (
        <section
          aria-label={localizeUi("ui.agents.organizer.featured")}
          className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]"
        >
          <FeaturedCard entry={featured[0]!} large priority />
          {featured.length > 1 && (
            <div className="grid min-w-0 grid-cols-1 gap-3 lg:grid-rows-2">
              {featured.slice(1).map((entry) => (
                <FeaturedCard key={entry.manifest.id} entry={entry} large={false} priority={false} />
              ))}
            </div>
          )}
        </section>
      )}

      {updates.length > 0 && (
        <section className="flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--border)] px-4 py-3">
          <IconStack entries={updates} />
          <div className="min-w-[10rem] flex-1">
            <p className="text-sm font-semibold text-[var(--foreground)]">
              {localizeUi("ui.agents.organizer.updatesReady", { count: updates.length })}
            </p>
            <p className="truncate text-xs text-[var(--muted-foreground)]">
              {updates.map((entry) => `${entry.manifest.name} ${entry.manifest.version}`).join(" · ")}
            </p>
          </div>
          <button
            type="button"
            className={cn(SECONDARY_ACTION, "h-8 px-3 text-xs font-semibold")}
            onClick={() => go({ kind: "updates" })}
          >
            {localizeUi("ui.agents.organizer.seeWhatsNew")}
          </button>
          <button
            type="button"
            className={cn(PRIMARY_ACTION, "h-8 px-3 text-xs font-semibold")}
            disabled={pending}
            onClick={onUpdateAll}
          >
            {localizeUi("ui.agents.organizer.updateAll")}
          </button>
        </section>
      )}

      {kits.length > 0 && (
        <section aria-labelledby="organizer-kits">
          <h2 id="organizer-kits" className="mb-3 text-lg font-semibold text-[var(--foreground)]">
            {localizeUi("ui.agents.organizer.starterKits")}
          </h2>
          <ul className="grid grid-cols-[minmax(0,1fr)] gap-3 xl:grid-cols-2">
            {kits.map((kit) => {
              const missing = kit.entries.filter((entry) => !installedById.has(entry.manifest.id)).length;
              return (
                <li
                  key={kit.id}
                  className="flex items-center gap-3 rounded-2xl border border-[var(--border)] px-4 py-3"
                >
                  <IconStack entries={kit.entries} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[var(--foreground)]">{kit.name}</p>
                    <p className="truncate text-xs text-[var(--muted-foreground)]">
                      {kit.tagline || kit.entries.map((entry) => entry.manifest.name).join(", ")}
                    </p>
                  </div>
                  <button
                    type="button"
                    className={cn(
                      missing ? PRIMARY_ACTION : SECONDARY_ACTION,
                      "h-8 shrink-0 px-3 text-xs font-semibold",
                    )}
                    disabled={pending || missing === 0}
                    onClick={() => onInstallKit(kit.entries)}
                  >
                    {missing
                      ? localizeUi("ui.agents.organizer.getKit", { count: missing })
                      : localizeUi("ui.agents.organizer.kitInstalled")}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {ORGANIZER_SECTIONS.map((section) => {
        const shelf = entries.filter((entry) => sectionOf(entry) === section);
        if (shelf.length === 0) return null;
        const titleId = `organizer-shelf-${section}`;
        return (
          <section key={section} aria-labelledby={titleId}>
            <div className="mb-1 flex items-end justify-between gap-3">
              <div className="min-w-0">
                <h2 id={titleId} className="text-lg font-semibold text-[var(--foreground)]">
                  {localizeUi(sectionLabelKey(section))}
                </h2>
                <p className="text-xs text-[var(--muted-foreground)]">{localizeUi(sectionHintKey(section))}</p>
              </div>
              {shelf.length > SHELF_SIZE && (
                <button
                  type="button"
                  onClick={() => go({ kind: "section", id: section })}
                  className="flex shrink-0 items-center gap-0.5 rounded-md px-1 text-xs font-semibold text-[var(--marinara-chat-chrome-accent,var(--primary))] hover:underline"
                >
                  {localizeUi("ui.agents.organizer.seeAll", { count: shelf.length })}
                  <ChevronRight size="0.8rem" aria-hidden="true" />
                </button>
              )}
            </div>
            <ul className="grid grid-cols-[minmax(0,1fr)] gap-x-6 xl:grid-cols-2">
              {shelf.slice(0, SHELF_SIZE).map((entry) => (
                <AgentRow key={entry.manifest.id} entry={entry} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
