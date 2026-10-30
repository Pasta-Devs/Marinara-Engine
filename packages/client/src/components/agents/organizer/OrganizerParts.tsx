import { createContext, useContext, type MouseEvent, type ReactNode } from "react";
import { ArrowUpRight, Check, Loader2, MoreHorizontal } from "lucide-react";
import type { InstalledCapabilityPackage } from "@marinara-engine/shared";
import { useTranslation as useUiTranslation } from "react-i18next";
import { cn } from "../../../lib/utils";
import { AgentArtwork } from "../AgentArtwork";
import {
  hasUpdate,
  iconOf,
  taglineOf,
  typeLabelKey,
  typeOf,
  type OrganizerEntry,
  type OrganizerPage,
} from "./organizer-model";

/** Everything a page needs from the Organizer shell, so pages stay plain renderers. */
export interface OrganizerActions {
  installedById: ReadonlyMap<string, InstalledCapabilityPackage>;
  /** Chats with agents on that use each package, by package id. */
  chatCountById: ReadonlyMap<string, number>;
  /** First agent of each package, by package id, for its Settings button. */
  settingsAgentById: ReadonlyMap<string, string>;
  /** Package id whose install/update/uninstall is running. */
  busyId: string | null;
  /** Any package action or bulk run is in flight. */
  pending: boolean;
  install: (entry: OrganizerEntry) => void;
  open: (entry: OrganizerEntry) => void;
  go: (page: OrganizerPage) => void;
  menu: (entry: OrganizerEntry, event: MouseEvent<HTMLElement>) => void;
}

export const OrganizerContext = createContext<OrganizerActions | null>(null);

export function useOrganizer(): OrganizerActions {
  const actions = useContext(OrganizerContext);
  if (!actions) throw new Error("useOrganizer must be used inside the Agent Organizer");
  return actions;
}

export const PRIMARY_ACTION = "mari-chrome-control mari-chrome-control--primary";
export const SECONDARY_ACTION = "mari-chrome-control";

export function AgentIcon({ entry, className }: { entry: OrganizerEntry; className?: string }) {
  const { installedById } = useOrganizer();
  const { t: localizeUi } = useUiTranslation();
  const icon = iconOf(entry, installedById.get(entry.manifest.id));
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-xl [&>img]:h-[68%]! [&>img]:w-[68%]! [&>img]:object-contain! bg-[color-mix(in_srgb,var(--foreground)_12%,var(--card))] shadow-[0_1px_3px_rgb(0_0_0/0.3),inset_0_0_0_1px_color-mix(in_srgb,var(--foreground)_10%,transparent)]",
        className ?? "h-10 w-10",
      )}
    >
      <AgentArtwork
        imageUrl={icon}
        alt={localizeUi("ui.agents.agentcatalogview.value1Artwork", { value1: entry.manifest.name })}
        iconSize="1.15rem"
      />
    </span>
  );
}

/** Get, Update or Open; nothing for an installed non-app that is current. */
// White pill for buttons that sit on store artwork, like the featured cards.
const LIGHT_ACTION =
  "inline-flex items-center justify-center rounded-full bg-white text-black shadow-sm transition-colors hover:bg-white/85 disabled:opacity-60";

export function AgentAction({
  entry,
  size = "sm",
  light = false,
}: {
  entry: OrganizerEntry;
  size?: "sm" | "lg";
  light?: boolean;
}) {
  const { installedById, busyId, pending, install, open } = useOrganizer();
  const { t: localizeUi } = useUiTranslation();
  const installed = installedById.get(entry.manifest.id);
  const sizing = size === "lg" ? "h-10 px-5 text-sm" : "h-8 px-3 text-xs [@media(pointer:coarse)]:h-11";
  const stop = (event: MouseEvent) => event.stopPropagation();
  if (busyId === entry.manifest.id) {
    return (
      <span className={cn(light ? LIGHT_ACTION : SECONDARY_ACTION, sizing, "pointer-events-none")} role="status">
        <Loader2 size="0.85rem" className="animate-spin" aria-hidden="true" />
        <span className="sr-only">{localizeUi("ui.agents.organizer.working")}</span>
      </span>
    );
  }
  if (!installed || hasUpdate(entry, installed)) {
    return (
      <button
        type="button"
        className={cn(
          light
            ? LIGHT_ACTION
            : cn(PRIMARY_ACTION, "bg-[var(--primary)]! text-[var(--primary-foreground)]! hover:opacity-90"),
          sizing,
          "font-semibold",
        )}
        disabled={pending}
        onClick={(event) => {
          stop(event);
          install(entry);
        }}
        aria-label={localizeUi(installed ? "ui.agents.organizer.updateName" : "ui.agents.organizer.getName", {
          name: entry.manifest.name,
        })}
      >
        {localizeUi(installed ? "ui.agents.agentcatalogview.update" : "ui.agents.organizer.get")}
      </button>
    );
  }
  if (typeOf(entry) === "app") {
    return (
      <button
        type="button"
        className={cn(light ? LIGHT_ACTION : SECONDARY_ACTION, sizing, "gap-1 font-semibold")}
        onClick={(event) => {
          stop(event);
          open(entry);
        }}
        aria-label={localizeUi("ui.agents.organizer.openName", { name: entry.manifest.name })}
      >
        <ArrowUpRight size="0.85rem" aria-hidden="true" />
        {localizeUi("ui.agents.organizer.open")}
      </button>
    );
  }
  return (
    <span className="flex h-8 items-center gap-1 px-1 text-xs text-[var(--muted-foreground)]">
      <Check size="0.85rem" className="text-[var(--marinara-chat-chrome-accent,var(--primary))]" aria-hidden="true" />
      {localizeUi("ui.agents.organizer.installed")}
    </span>
  );
}

export function MenuButton({ entry, className }: { entry: OrganizerEntry; className?: string }) {
  const { menu } = useOrganizer();
  const { t: localizeUi } = useUiTranslation();
  return (
    <button
      type="button"
      className={cn(
        SECONDARY_ACTION,
        "h-8 w-8 shrink-0 p-0 [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:w-11",
        className,
      )}
      aria-label={localizeUi("ui.agents.organizer.moreFor", { name: entry.manifest.name })}
      aria-haspopup="menu"
      onClick={(event) => {
        event.stopPropagation();
        menu(entry, event);
      }}
    >
      <MoreHorizontal size="0.95rem" aria-hidden="true" />
    </button>
  );
}

/** The one row used by Section, Installed, Updates and search results. */
export function AgentRow({
  entry,
  meta,
  side,
  withMenu = false,
  action,
  children,
}: {
  entry: OrganizerEntry;
  /** Replaces the default "Type" line under the tagline. */
  meta?: ReactNode;
  /** Extra column before the action (wide screens only). */
  side?: ReactNode;
  withMenu?: boolean;
  /** Replaces the Get/Update/Open button, e.g. with a running update's state. */
  action?: ReactNode;
  children?: ReactNode;
}) {
  const { go } = useOrganizer();
  const { t: localizeUi } = useUiTranslation();
  return (
    <li className="border-b border-[var(--border)] last:border-b-0">
      <div className="flex items-center gap-3 py-3">
        <button
          type="button"
          onClick={() => go({ kind: "agent", id: entry.manifest.id })}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        >
          <AgentIcon entry={entry} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-[var(--foreground)]">{entry.manifest.name}</span>
            <span className="block truncate text-xs text-[var(--muted-foreground)]">{taglineOf(entry)}</span>
            <span className="mt-0.5 block truncate text-[0.6875rem] text-[var(--muted-foreground)]/80">
              {meta ?? localizeUi(typeLabelKey(typeOf(entry)))}
            </span>
          </span>
          {side && <span className="hidden shrink-0 text-xs text-[var(--muted-foreground)] lg:block">{side}</span>}
        </button>
        {action ?? <AgentAction entry={entry} />}
        {withMenu && <MenuButton entry={entry} />}
      </div>
      {children}
    </li>
  );
}

/** A store banner: lazy, async, sized box with a fill so the layout never jumps. */
export function StoreBanner({
  entry,
  priority = false,
  sizes,
  className,
}: {
  entry: OrganizerEntry;
  priority?: boolean;
  sizes: string;
  className?: string;
}) {
  const store = entry.store;
  const src = store?.bannerSmallUrl ?? store?.bannerUrl;
  return (
    <div
      aria-hidden="true"
      className={cn(
        "mari-panel-gradient-surface mari-panel-gradient--agents overflow-hidden bg-[var(--card)]",
        className,
      )}
    >
      {src && (
        <img
          src={src}
          srcSet={
            store?.bannerSmallUrl && store.bannerUrl
              ? `${store.bannerSmallUrl} 1200w, ${store.bannerUrl} 2400w`
              : undefined
          }
          sizes={sizes}
          width={1200}
          height={450}
          alt=""
          draggable={false}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          fetchPriority={priority ? "high" : "auto"}
          className="h-full w-full object-cover"
        />
      )}
    </div>
  );
}

export function IconStack({ entries, className }: { entries: readonly OrganizerEntry[]; className?: string }) {
  return (
    <span className={cn("flex shrink-0", className)} aria-hidden="true">
      {entries.slice(0, 3).map((entry, index) => (
        <AgentIcon
          key={entry.manifest.id}
          entry={entry}
          className={cn("h-6 w-6 rounded-md ring-2 ring-[var(--background)]", index > 0 && "-ml-2")}
        />
      ))}
    </span>
  );
}
