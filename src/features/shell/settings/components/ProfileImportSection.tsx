import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Check, Download, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { profileApi } from "../../../../shared/api/profile-api";
import { cn } from "../../../../shared/lib/utils";

type ProfileImportStats = {
  characters?: number;
  personas?: number;
  lorebooks?: number;
  presets?: number;
  agents?: number;
  themes?: number;
  chats?: number;
  messages?: number;
  connections?: number;
  files?: number;
  unsupportedPromptOverrides?: number;
};

type ProfileImportProgressState = {
  status: "reading" | "starting" | "running" | "success" | "error";
  label: string;
  completedItems: number;
  totalItems: number;
  startedAt: number;
  elapsedSeconds: number;
  imported?: ProfileImportStats;
  error?: string;
};

function formatProfileImportDuration(seconds: number) {
  const safeSeconds = Math.max(0, Math.round(seconds));
  if (safeSeconds < 60) return `${safeSeconds}s`;
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;
  return remainingSeconds ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
}

function estimateProfileImportRemainingSeconds(progress: ProfileImportProgressState) {
  if (progress.status !== "running" || progress.completedItems <= 0 || progress.totalItems <= progress.completedItems) {
    return null;
  }
  const secondsPerItem = progress.elapsedSeconds / progress.completedItems;
  return Math.max(1, Math.round(secondsPerItem * (progress.totalItems - progress.completedItems)));
}

function getProfileImportPercent(progress: ProfileImportProgressState) {
  if (progress.status === "success") return 100;
  if (progress.totalItems <= 0) return progress.status === "running" ? 8 : 0;
  const percent = Math.round((progress.completedItems / progress.totalItems) * 100);
  return Math.min(99, Math.max(progress.status === "running" ? 8 : 0, percent));
}

function formatProfileImportStats(stats?: ProfileImportStats) {
  if (!stats) return "";
  const entries: Array<[number | undefined, string]> = [
    [stats.characters, "characters"],
    [stats.personas, "personas"],
    [stats.lorebooks, "lorebooks"],
    [stats.presets, "presets"],
    [stats.agents, "agents"],
    [stats.themes, "themes"],
    [stats.chats, "chats"],
    [stats.messages, "messages"],
    [stats.connections, "connections"],
    [stats.files, "files"],
  ];
  return entries
    .filter(([count]) => typeof count === "number" && count > 0)
    .map(([count, label]) => `${count} ${label}`)
    .join(", ");
}

function formatProfileImportSkippedStats(stats?: ProfileImportStats) {
  const count = stats?.unsupportedPromptOverrides;
  if (typeof count !== "number" || count <= 0) return "";
  return `${count} unsupported prompt override${count === 1 ? "" : "s"} skipped`;
}

export function ProfileImportSection() {
  const qc = useQueryClient();
  const [profileImportProgress, setProfileImportProgress] = useState<ProfileImportProgressState | null>(null);
  const profileImportBusy =
    profileImportProgress?.status === "reading" ||
    profileImportProgress?.status === "starting" ||
    profileImportProgress?.status === "running";

  useEffect(() => {
    if (!profileImportBusy) return;
    const timer = window.setInterval(() => {
      setProfileImportProgress((current) =>
        current && (current.status === "reading" || current.status === "starting" || current.status === "running")
          ? { ...current, elapsedSeconds: Math.floor((Date.now() - current.startedAt) / 1000) }
          : current,
      );
    }, 1000);
    return () => window.clearInterval(timer);
  }, [profileImportBusy]);

  const handleProfileImport = async () => {
    if (profileImportBusy) return;
    const startedAt = Date.now();
    setProfileImportProgress({
      status: "reading",
      label: "Selecting profile file",
      completedItems: 0,
      totalItems: 1,
      startedAt,
      elapsedSeconds: 0,
    });
    try {
      const selected = await openDialog({
        multiple: false,
        filters: [{ name: "Marinara Profile", extensions: ["json", "zip"] }],
      });
      if (typeof selected !== "string" || !selected.trim()) {
        setProfileImportProgress(null);
        return;
      }
      setProfileImportProgress((current) =>
        current
          ? {
              ...current,
              status: "starting",
              label: "Reading profile file",
              elapsedSeconds: Math.floor((Date.now() - startedAt) / 1000),
            }
          : current,
      );
      setProfileImportProgress((current) =>
        current
          ? {
              ...current,
              status: "running",
              label: "Importing profile",
              totalItems: Math.max(1, current.totalItems),
              elapsedSeconds: Math.floor((Date.now() - startedAt) / 1000),
            }
          : current,
      );
      const data = await profileApi.importProfileFile<{
        success?: boolean;
        error?: string;
        message?: string;
        imported?: ProfileImportStats;
      }>(selected);
      if (data?.success === false) throw new Error(data.error ?? data.message ?? "Unknown error");
      qc.invalidateQueries();
      const imported = data?.imported;
      const summary = formatProfileImportStats(imported);
      const skippedSummary = formatProfileImportSkippedStats(imported);
      setProfileImportProgress((current) => {
        const totalItems = Math.max(1, current?.totalItems ?? 1);
        return {
          status: "success",
          label: "Profile import complete",
          completedItems: totalItems,
          totalItems,
          startedAt,
          elapsedSeconds: Math.floor((Date.now() - startedAt) / 1000),
          imported,
        };
      });
      toast.success(
        [summary ? `Imported: ${summary}` : "Profile imported.", skippedSummary ? `Skipped: ${skippedSummary}.` : ""]
          .filter(Boolean)
          .join(" "),
      );
    } catch (err) {
      const message =
        err instanceof SyntaxError
          ? "Import failed. Make sure this is a valid profile JSON or ZIP file."
          : `Import failed: ${err instanceof Error ? err.message : "local import error"}`;
      setProfileImportProgress({
        status: "error",
        label: "Profile import failed",
        completedItems: 0,
        totalItems: 1,
        startedAt,
        elapsedSeconds: Math.floor((Date.now() - startedAt) / 1000),
        error: message.replace(/^Import failed:\s*/, ""),
      });
      toast.error(message);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => void handleProfileImport()}
        disabled={profileImportBusy}
        className={cn(
          "flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500/20 to-teal-500/20 px-3 py-3 text-xs font-semibold ring-1 ring-emerald-500/30 transition-all hover:ring-emerald-500/50 active:scale-[0.98]",
          profileImportBusy && "pointer-events-none opacity-75",
        )}
      >
        {profileImportBusy ? <Loader2 size="1rem" className="animate-spin" /> : <Download size="1rem" />}
        {profileImportBusy ? "Importing Profile..." : "Import Profile (JSON/ZIP)"}
      </button>

      {profileImportProgress && (
        <div
          role="status"
          aria-live="polite"
          className={cn(
            "flex flex-col gap-2 rounded-lg border px-3 py-2 text-xs",
            profileImportProgress.status === "error"
              ? "border-[var(--destructive)]/40 bg-[var(--destructive)]/10 text-[var(--destructive)]"
              : profileImportProgress.status === "success"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"
                : "border-emerald-500/30 bg-emerald-500/10 text-[var(--foreground)]",
          )}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              {profileImportProgress.status === "success" ? (
                <Check size="0.875rem" className="shrink-0" />
              ) : profileImportProgress.status === "error" ? (
                <AlertTriangle size="0.875rem" className="shrink-0" />
              ) : (
                <Loader2 size="0.875rem" className="shrink-0 animate-spin text-emerald-500" />
              )}
              <span className="truncate font-medium">{profileImportProgress.label}</span>
            </div>
            <span className="shrink-0 text-[0.6875rem] text-[var(--muted-foreground)]">
              {formatProfileImportDuration(profileImportProgress.elapsedSeconds)}
            </span>
          </div>

          {profileImportProgress.status !== "error" && (
            <>
              <div className="h-1.5 overflow-hidden rounded-full bg-[var(--border)]">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-300",
                    profileImportProgress.status === "success" ? "bg-emerald-500" : "bg-emerald-400",
                  )}
                  style={{ width: `${getProfileImportPercent(profileImportProgress)}%` }}
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-[0.6875rem] text-[var(--muted-foreground)]">
                <span>
                  {profileImportProgress.completedItems}/{profileImportProgress.totalItems} items
                </span>
                {estimateProfileImportRemainingSeconds(profileImportProgress) !== null && (
                  <span>
                    ETA {formatProfileImportDuration(estimateProfileImportRemainingSeconds(profileImportProgress) ?? 0)}
                  </span>
                )}
              </div>
              {formatProfileImportStats(profileImportProgress.imported) && (
                <div className="text-[0.6875rem] text-[var(--muted-foreground)]">
                  Imported so far: {formatProfileImportStats(profileImportProgress.imported)}
                </div>
              )}
              {formatProfileImportSkippedStats(profileImportProgress.imported) && (
                <div className="text-[0.6875rem] text-[var(--muted-foreground)]">
                  Skipped: {formatProfileImportSkippedStats(profileImportProgress.imported)}
                </div>
              )}
            </>
          )}

          {profileImportProgress.status === "error" && profileImportProgress.error && (
            <div className="text-[0.6875rem]">{profileImportProgress.error}</div>
          )}
        </div>
      )}
    </>
  );
}
