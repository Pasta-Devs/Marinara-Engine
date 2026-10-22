// ──────────────────────────────────────────────
// Diagnostic: owner-only access warning banner
// ──────────────────────────────────────────────
// Reads /api/access/status, which answers only the owner (this computer or the
// admin secret). Everyone else gets 403 and sees nothing. Warns on every page
// while some visitor can open Marinara without a password.
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "../../lib/api-client";
import { executeStateNavigation } from "../../lib/state-navigation";
import type { AppBannerCandidate } from "../ui/AppBanner";

export type PasswordlessPeer = "internet" | "privateNetwork" | "allowlist" | "tailscale" | "docker" | "proxy";

export type AccessStatus = {
  loopbackOnly: boolean;
  host: string;
  basicAuth: boolean;
  adminSecret: boolean;
  allowlist: boolean;
  passwordlessPeers: PasswordlessPeer[];
  /** Peers a login password would not close. */
  loginKeepsOpen: PasswordlessPeer[];
  viaProxy: boolean;
};

export function useAccessStatus() {
  return useQuery({
    queryKey: ["access-status"],
    queryFn: () => api.get<AccessStatus>("/access/status"),
    retry: false,
    staleTime: 5 * 60_000,
    // Env edits apply without a restart, so keep the mounted banner current.
    refetchInterval: 5 * 60_000,
    refetchOnMount: "always",
  });
}

/** Anyone on the internet covers every narrower kind of visitor. */
export const visiblePasswordlessPeers = (peers: PasswordlessPeer[]): PasswordlessPeer[] =>
  peers.includes("internet") ? ["internet"] : peers;

export function useAccessWarningBanner(): AppBannerCandidate | null {
  const { t, i18n } = useTranslation();
  const { data } = useAccessStatus();
  const peers = visiblePasswordlessPeers(data?.passwordlessPeers ?? []);
  if (peers.length === 0) return null;

  return {
    // A new kind of open door brings the banner back after a dismissal.
    id: `access-open:${peers.join(",")}`,
    // Critical comes back next session; an internet-wide door should not stay dismissed.
    severity: peers.includes("internet") ? "critical" : "warning",
    tone: "accent",
    title: t("ui.diagnostics.accessWarningBanner.title"),
    body: t("ui.diagnostics.accessWarningBanner.who", {
      list: new Intl.ListFormat(i18n.language).format(peers.map((peer) => t(`settings.accessStatus.peer.${peer}`))),
    }),
    actions: (
      <button
        type="button"
        onClick={() => executeStateNavigation({ kind: "settings", tab: "advanced", sectionId: "access-status" })}
        className="min-h-11 shrink-0 rounded-md border border-[var(--border)] bg-[var(--background)] px-3 text-xs font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--accent)] focus-visible:outline-2 focus-visible:outline-[var(--ring)]"
      >
        {t("ui.diagnostics.accessWarningBanner.review")}
      </button>
    ),
  };
}
