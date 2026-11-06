// ──────────────────────────────────────────────
// Diagnostic: "a device tried to connect" banners
// ──────────────────────────────────────────────
// Reads /api/access/refusals, which answers only on this computer and in browsers
// signed in with the login. Every other device gets 403 once and stops asking; other errors retry. One banner per refused device: the
// server keeps the same id while that device keeps trying, so a dismissal holds.
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, ApiError } from "../../lib/api-client";
import { executeStateNavigation } from "../../lib/state-navigation";
import type { AppBannerCandidate } from "../ui/AppBanner";

type RefusedDevice = { id: string; label: string; reason: "noLogin" | "allowlist"; at: number };

export function useRefusedDeviceBanners(): AppBannerCandidate[] {
  const { t } = useTranslation();
  const { data } = useQuery({
    queryKey: ["access-refusals"],
    queryFn: () => api.get<{ refusals: RefusedDevice[] }>("/access/refusals").then((body) => body.refusals),
    retry: false,
    // Only a 403 means "not for this browser"; a network or server error is retried on the next tick.
    refetchInterval: (query) =>
      query.state.error instanceof ApiError && query.state.error.status === 403 ? false : 30_000,
  });

  return (data ?? []).map((device) => ({
    id: `device-refused:${device.id}`,
    severity: "warning",
    tone: "accent",
    title: t("ui.diagnostics.refusedDeviceBanner.title"),
    body: t(`ui.diagnostics.refusedDeviceBanner.${device.reason}`, { device: device.label }),
    actions: (
      <button
        type="button"
        onClick={() => executeStateNavigation({ kind: "settings", tab: "advanced", sectionId: "access-status" })}
        className="min-h-11 shrink-0 rounded-md border border-[var(--border)] bg-[var(--background)] px-3 text-xs font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--accent)] focus-visible:outline-2 focus-visible:outline-[var(--ring)]"
      >
        {t("ui.diagnostics.refusedDeviceBanner.review")}
      </button>
    ),
  }));
}
