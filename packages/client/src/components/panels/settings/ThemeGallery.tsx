// ──────────────────────────────────────────────
// Theme gallery (2026-11-09): starter themes download on demand.
//
// Starter themes are no longer part of the install. The list comes from the theme gallery (a folder on
// the repo's theme branch) only when the person opens it, and a theme is downloaded only when they pick
// it. A downloaded theme shows up with the other starter themes (read-only, Clone + Edit, removable);
// when the gallery has a newer version, its row here offers Update.
// ──────────────────────────────────────────────
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, Loader2, RefreshCw } from "lucide-react";
import type { Theme } from "@marinara-engine/shared";
import { api, ApiError } from "../../../lib/api-client";
import { themeKeys } from "../../../hooks/use-themes";
import { useTranslation as useUiTranslation } from "react-i18next";
import { cn } from "../../../lib/utils";
import { SETTINGS_BUTTON_CLASS, SETTINGS_COMPACT_PRIMARY_BUTTON_CLASS } from "./SettingControls";
import { ThemeLabels } from "./ThemeCredits";

export interface ThemeGalleryEntry {
  id: string;
  name: string;
  author?: string;
  version?: string;
  description?: string;
  colorScheme?: "dark" | "light" | "both";
  labels?: string[];
  preview?: string;
  bytes: number;
}

const STARTER_PREFIX = "starter-";

function sizeLabel(bytes: number) {
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function ThemeGallery({ starterThemes }: { starterThemes: Theme[] }) {
  const { t: localizeUi } = useUiTranslation();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const gallery = useQuery({
    queryKey: [...themeKeys.all, "gallery"],
    queryFn: () => api.get<{ themes: ThemeGalleryEntry[] }>("/themes/gallery"),
    enabled: open,
    staleTime: 10 * 60_000,
    retry: 1,
  });
  const download = useMutation({
    mutationFn: (entry: ThemeGalleryEntry) => api.post<Theme>(`/themes/gallery/${encodeURIComponent(entry.id)}`, {}),
    onSuccess: (_theme, entry) => {
      qc.invalidateQueries({ queryKey: themeKeys.list() });
      toast.success(
        localizeUi("theming.gallery.downloaded", {
          name: entry.name,
          defaultValue: "Downloaded {{name}}. Pick it under Starter themes to try it.",
        }),
      );
    },
    onError: (err, entry) => {
      console.error("[ThemeGallery] Download failed:", err);
      toast.error(
        err instanceof ApiError && err.message
          ? err.message
          : localizeUi("theming.gallery.downloadFailed", {
              name: entry.name,
              defaultValue: "Couldn't download {{name}}.",
            }),
      );
    },
  });

  const installed = new Map(starterThemes.map((theme) => [theme.id.slice(STARTER_PREFIX.length), theme] as const));
  const entries = gallery.data?.themes ?? [];
  const rows = entries.filter((entry) => {
    const have = installed.get(entry.id);
    return !have || (entry.version && have.meta?.version !== entry.version);
  });

  if (!open) {
    return (
      <span className="mt-2 flex flex-col gap-1" data-theme-gallery="">
        <button type="button" onClick={() => setOpen(true)} className={cn(SETTINGS_BUTTON_CLASS, "self-start")}>
          <Download size="0.75rem" />
          {localizeUi("theming.gallery.browse", { defaultValue: "Browse the theme gallery" })}
        </button>
        <span className="mari-chrome-text-muted text-[0.6875rem]">
          {localizeUi("theming.gallery.browseHelp", {
            defaultValue: "Starter themes aren't part of the install. Download only the ones you want.",
          })}
        </span>
      </span>
    );
  }

  return (
    <span className="mt-2 flex flex-col gap-1.5" data-theme-gallery="open">
      <span className="flex items-center gap-2">
        <span className="text-xs font-medium">
          {localizeUi("theming.gallery.heading", { defaultValue: "Theme gallery" })}
        </span>
        <button
          type="button"
          onClick={() => {
            void api
              .get<{ themes: ThemeGalleryEntry[] }>("/themes/gallery?refresh=1")
              .then((data) => qc.setQueryData([...themeKeys.all, "gallery"], data))
              .catch(() => void gallery.refetch());
          }}
          className="mari-chrome-text-muted ml-auto inline-flex flex-row items-center gap-1 whitespace-nowrap text-[0.6875rem] hover:underline"
        >
          <RefreshCw size="0.6875rem" className={gallery.isFetching ? "animate-spin" : undefined} />
          {localizeUi("theming.gallery.refresh", { defaultValue: "Refresh" })}
        </button>
      </span>
      {gallery.isLoading ? (
        <span className="mari-chrome-text-muted flex items-center gap-2 py-2 text-[0.6875rem]">
          <Loader2 size="0.75rem" className="animate-spin" />
          {localizeUi("theming.gallery.loading", { defaultValue: "Loading the gallery…" })}
        </span>
      ) : gallery.isError ? (
        <span className="mari-chrome-text-muted py-1 text-[0.6875rem]">
          {localizeUi("theming.gallery.offline", {
            defaultValue: "Couldn't reach the theme gallery. Check the internet connection and try again.",
          })}
        </span>
      ) : rows.length === 0 ? (
        <span className="mari-chrome-text-muted py-1 text-[0.6875rem]">
          {localizeUi("theming.gallery.allDownloaded", {
            defaultValue: "You have every theme in the gallery.",
          })}
        </span>
      ) : (
        rows.map((entry) => {
          const update = installed.has(entry.id);
          const busy = download.isPending && download.variables?.id === entry.id;
          return (
            <span
              key={entry.id}
              className="flex flex-col gap-1.5 rounded-lg bg-[var(--secondary)] px-3 py-2 text-xs text-[var(--secondary-foreground)]"
              data-theme-gallery-entry={entry.id}
            >
              <span className="flex items-center gap-2">
                {entry.preview ? (
                  <img
                    src={entry.preview}
                    alt=""
                    className="h-10 w-16 shrink-0 rounded object-cover ring-1 ring-[var(--border)]"
                  />
                ) : (
                  <span className="h-10 w-16 shrink-0 rounded bg-[var(--muted)]/60 ring-1 ring-[var(--border)]" />
                )}
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="mari-chrome-text truncate font-medium" title={entry.name}>
                    {entry.name}
                  </span>
                  <span className="mari-chrome-text-muted truncate text-[0.625rem]">
                    {[
                      entry.author ? localizeUi("theming.import.by", { author: entry.author }) : null,
                      entry.version ? `v${entry.version}` : null,
                      sizeLabel(entry.bytes),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => download.mutate(entry)}
                  disabled={download.isPending}
                  className={cn(
                    SETTINGS_COMPACT_PRIMARY_BUTTON_CLASS,
                    "inline-flex shrink-0 flex-row items-center gap-1 whitespace-nowrap disabled:opacity-50",
                  )}
                  aria-label={`${update ? localizeUi("theming.gallery.update", { defaultValue: "Update" }) : localizeUi("theming.gallery.download", { defaultValue: "Download" })}: ${entry.name}`}
                  data-theme-gallery-download={entry.id}
                >
                  {busy ? <Loader2 size="0.75rem" className="animate-spin" /> : <Download size="0.75rem" />}
                  {/* Consistency audit P19: icon only on a phone, so the theme name keeps the room. */}
                  <span className="max-sm:sr-only">
                    {update
                      ? localizeUi("theming.gallery.update", { defaultValue: "Update" })
                      : localizeUi("theming.gallery.download", { defaultValue: "Download" })}
                  </span>
                </button>
              </span>
              {entry.description ? (
                <span className="mari-chrome-text-muted line-clamp-3 text-[0.6875rem] leading-snug">
                  {entry.description}
                </span>
              ) : null}
              <ThemeLabels meta={{ labels: entry.labels }} className="flex flex-wrap gap-1" />
            </span>
          );
        })
      )}
    </span>
  );
}
