// ──────────────────────────────────────────────
// Single mount point for app-wide banners: shows only the most severe one
// ──────────────────────────────────────────────
import { useState } from "react";
import { useAccessWarningBanner } from "../diagnostics/use-access-warning-banner";
import { useCsrfOriginBanner } from "../diagnostics/use-csrf-origin-banner";
import { AppBanner, type AppBannerCandidate } from "../ui/AppBanner";
import { useMarinaraNoticeBanners } from "./use-marinara-notice-banners";

const DISMISS_KEY_PREFIX = "marinara:app-banner-dismissed:";

// Critical banners come back next session; warnings stay dismissed.
const dismissStorage = (candidate: AppBannerCandidate) =>
  candidate.severity === "critical" ? window.sessionStorage : window.localStorage;

function wasDismissed(candidate: AppBannerCandidate) {
  try {
    return dismissStorage(candidate).getItem(DISMISS_KEY_PREFIX + candidate.id) === "1";
  } catch {
    return false;
  }
}

function pickAppBanner(candidates: (AppBannerCandidate | null)[], dismissed: (c: AppBannerCandidate) => boolean) {
  return (
    candidates
      .filter((c): c is AppBannerCandidate => c !== null && !dismissed(c))
      // Array.prototype.sort is stable, so equal severities keep their candidate order.
      .sort((a, b) => Number(b.severity === "critical") - Number(a.severity === "critical"))[0] ?? null
  );
}

export function AppBannerHost() {
  const candidates = [useCsrfOriginBanner(), useAccessWarningBanner(), ...useMarinaraNoticeBanners()];
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const banner = pickAppBanner(candidates, (c) => dismissedIds.includes(c.id) || wasDismissed(c));

  const dismiss = (candidate: AppBannerCandidate) => {
    setDismissedIds((ids) => [...ids, candidate.id]);
    try {
      dismissStorage(candidate).setItem(DISMISS_KEY_PREFIX + candidate.id, "1");
    } catch {
      /* storage unavailable — the in-memory dismissal still hides it */
    }
  };

  return banner ? <AppBanner key={banner.id} {...banner} onDismiss={() => dismiss(banner)} /> : null;
}
