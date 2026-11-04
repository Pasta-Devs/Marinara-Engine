import { useTranslation as useUiTranslation } from "react-i18next";
import type { CapabilityPackageManifest, InstalledCapabilityPackage } from "@marinara-engine/shared";
import { useCapabilityServiceSharing, useSetCapabilityServiceSharing } from "../../../hooks/use-capability-packages";
import { formatRelativeContact } from "../../../lib/relative-time";
import { cn } from "../../../lib/utils";
import type { OrganizerEntry } from "./organizer-model";
import { AgentIcon, SECONDARY_ACTION, useOrganizer } from "./OrganizerParts";

/**
 * Capability API 1.819: one row per pair of this package and a peer it provides a service to or uses one from,
 * read from both packages' `contributions.services`. A pair is a provider service key and a consumer package id.
 */
export interface OtherAgentRow {
  key: string;
  service: string;
  providerId: string;
  consumerId: string;
  /** The peer on this row: the consumer when this package provides, the provider when it requires. */
  peerId: string;
  peerName: string;
  consumerName: string;
  peerEntry: OrganizerEntry | undefined;
  peerInstalled: boolean;
  direction: "provides" | "requires";
  description: string | null;
  sharedByDefault: boolean;
}

type Manifest = CapabilityPackageManifest;
const ownerOf = (key: string) => key.slice(0, key.indexOf(":"));
const servicesOf = (manifest: Manifest | undefined) => manifest?.contributions?.services;

/** Rows for one package page. Empty when neither side declares a pairing, so the section is left out. */
export function otherAgentRows(
  manifest: Manifest,
  entries: readonly OrganizerEntry[],
  installedById: ReadonlyMap<string, InstalledCapabilityPackage>,
): OtherAgentRow[] {
  const own = servicesOf(installedById.get(manifest.id)?.manifest ?? manifest);
  if (!own) return [];
  const entryById = new Map(entries.map((entry) => [entry.manifest.id, entry]));
  // Installed manifests win over catalog ones: they are what runs.
  const peers = new Map<string, Manifest>();
  for (const entry of entries) peers.set(entry.manifest.id, entry.manifest);
  for (const [id, installed] of installedById) peers.set(id, installed.manifest);
  peers.delete(manifest.id);
  const row = (
    key: string,
    peerId: string,
    direction: OtherAgentRow["direction"],
    description: string | null,
    sharedByDefault: boolean,
  ): OtherAgentRow => ({
    key,
    service: key.slice(key.indexOf(":") + 1),
    providerId: direction === "provides" ? manifest.id : peerId,
    consumerId: direction === "provides" ? peerId : manifest.id,
    peerId,
    peerName: peers.get(peerId)?.name ?? peerId,
    consumerName: direction === "provides" ? (peers.get(peerId)?.name ?? peerId) : manifest.name,
    peerEntry: entryById.get(peerId),
    peerInstalled: installedById.has(peerId),
    direction,
    description,
    sharedByDefault,
  });
  const rows: OtherAgentRow[] = [];
  for (const provided of own.provides ?? []) {
    for (const [peerId, peer] of peers) {
      const wanted = servicesOf(peer)?.requires?.find((entry) => entry.key === provided.key);
      if (!wanted) continue;
      rows.push(
        row(
          provided.key,
          peerId,
          "provides",
          wanted.description ?? provided.description ?? null,
          provided.sharedByDefault !== false,
        ),
      );
    }
  }
  for (const required of own.requires ?? []) {
    const providerId = ownerOf(required.key);
    const provided = servicesOf(peers.get(providerId))?.provides?.find((entry) => entry.key === required.key);
    rows.push(
      row(
        required.key,
        providerId,
        "requires",
        required.description ?? provided?.description ?? null,
        provided?.sharedByDefault !== false,
      ),
    );
  }
  return rows;
}

/** The Other agents rows. Switches and usage show only for pairs whose two packages are both installed. */
export function OtherAgentsList({ rows, installed }: { rows: readonly OtherAgentRow[]; installed: boolean }) {
  const { t: localizeUi } = useUiTranslation();
  const { open } = useOrganizer();
  const talking = installed && rows.some((row) => row.peerInstalled);
  const sharing = useCapabilityServiceSharing(talking);
  const setSharing = useSetCapabilityServiceSharing();
  const overrides = new Map(
    (sharing.data?.overrides ?? []).map((entry) => [`${entry.key}|${entry.consumerId}`, entry.shared]),
  );
  const usage = new Map((sharing.data?.usage ?? []).map((entry) => [`${entry.key}|${entry.consumerId}`, entry]));

  return (
    <>
      <p className="text-xs leading-relaxed text-[var(--muted-foreground)]">
        {localizeUi("ui.agents.agentcatalogview.otherAgents.notice")}
      </p>
      <ul className="mt-3 grid gap-2">
        {rows.map((row) => {
          const id = `${row.key}|${row.consumerId}`;
          const live = talking && row.peerInstalled;
          const shared = overrides.get(id) ?? row.sharedByDefault;
          const used = usage.get(id);
          const lastUsed = used ? formatRelativeContact(used.lastUsedAt) : null;
          const sentence =
            row.description ??
            localizeUi(
              row.direction === "provides"
                ? "ui.agents.agentcatalogview.otherAgents.usesService"
                : "ui.agents.agentcatalogview.otherAgents.providesService",
              { service: row.service },
            );
          return (
            <li
              key={`${row.direction}:${id}`}
              className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-[var(--border)] px-3 py-2"
            >
              {row.peerEntry && <AgentIcon entry={row.peerEntry} className="h-9 w-9 rounded-lg" />}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[var(--foreground)]">{row.peerName}</p>
                <p className="text-xs leading-relaxed text-[var(--muted-foreground)]">{sentence}</p>
                {live && (
                  <p className="text-[0.6875rem] text-[var(--muted-foreground)]">
                    {lastUsed
                      ? localizeUi("ui.agents.agentcatalogview.otherAgents.usage", {
                          when: lastUsed,
                          count: used?.usesThisWeek ?? 0,
                        })
                      : localizeUi("ui.agents.agentcatalogview.otherAgents.notUsedYet")}
                  </p>
                )}
              </div>
              {!row.peerInstalled &&
                (row.peerEntry ? (
                  <button type="button" className={SECONDARY_ACTION} onClick={() => open(row.peerEntry!)}>
                    {localizeUi("ui.agents.agentcatalogview.otherAgents.get")}
                  </button>
                ) : (
                  <span className="text-xs text-[var(--muted-foreground)]">
                    {localizeUi("ui.agents.agentcatalogview.otherAgents.notInstalled")}
                  </span>
                ))}
              {live && (
                <label className="flex min-h-11 shrink-0 cursor-pointer items-center">
                  <span className="sr-only">
                    {localizeUi("ui.agents.agentcatalogview.otherAgents.switchLabel", {
                      consumer: row.consumerName,
                      service: row.service,
                    })}
                  </span>
                  <input
                    type="checkbox"
                    role="switch"
                    checked={shared}
                    disabled={setSharing.isPending || sharing.isLoading}
                    onChange={(event) =>
                      setSharing.mutate({ key: row.key, consumerId: row.consumerId, shared: event.target.checked })
                    }
                    className="peer sr-only"
                  />
                  <span
                    className={cn(
                      "relative h-5 w-9 shrink-0 rounded-full border transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--ring)] peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-[var(--background)] peer-disabled:opacity-50",
                      shared
                        ? "border-[var(--primary)] bg-[var(--primary)]"
                        : "border-[var(--border)] bg-[var(--muted)]",
                    )}
                    aria-hidden="true"
                  >
                    <span
                      className={cn(
                        "absolute left-0.5 top-0.5 size-3.5 rounded-full bg-[var(--background)] shadow-sm transition-transform",
                        shared && "translate-x-4",
                      )}
                    />
                  </span>
                </label>
              )}
            </li>
          );
        })}
      </ul>
      {setSharing.isError && (
        <p role="alert" className="mt-2 text-xs text-[var(--destructive)]">
          {localizeUi("ui.agents.agentcatalogview.otherAgents.saveFailed")}
        </p>
      )}
    </>
  );
}
