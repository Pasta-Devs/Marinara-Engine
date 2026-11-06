// ──────────────────────────────────────────────
// Marinara notices: maintainer-published warnings from the `notices` branch
// ──────────────────────────────────────────────
// The server validates the file and only answers the owner. Polls hourly so a tab
// that stays open for days still sees a newly published notice.
import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { api } from "../../lib/api-client";
import type { AppBannerCandidate } from "../ui/AppBanner";

type MarinaraNotice = {
  id: string;
  level: "warning" | "critical";
  title: string;
  text: string;
  action: string;
  link: string | null;
};

const POLL_MS = 60 * 60_000;

export function useMarinaraNoticeBanners(): AppBannerCandidate[] {
  const { t: localizeUi } = useUiTranslation();
  const [notices, setNotices] = useState<MarinaraNotice[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      void api
        .get<{ notices?: MarinaraNotice[] } | null>("/notices")
        .then((value) => {
          if (!cancelled && Array.isArray(value?.notices)) setNotices(value.notices);
        })
        .catch(() => {
          // Notices are best-effort; keep whatever was last shown.
        });
    };
    load();
    const timer = window.setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  // Remote text renders as React text nodes only, never as HTML.
  return notices.map((notice) => ({
    id: `notice:${notice.id}`,
    severity: notice.level,
    title: notice.title,
    body: (
      <>
        {notice.text} <span className="font-medium text-[var(--foreground)]">{notice.action}</span>
      </>
    ),
    actions: notice.link && (
      <a
        href={notice.link}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--background)] px-3 text-xs font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--accent)] focus-visible:outline-2 focus-visible:outline-[var(--ring)]"
      >
        {localizeUi("ui.app.banner.openOnGitHub")}
        <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
      </a>
    ),
  }));
}
