import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Check, Download, FileSearch, Loader2 } from "lucide-react";
import { type ChangeEvent, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { profileApi, type ProfileImportProgressEvent } from "../../../../shared/api/profile-api";
import { remoteRuntimeTarget } from "../../../../shared/api/remote-runtime";
import { showConfirmDialog } from "../../../../shared/lib/app-dialogs";
import { cn } from "../../../../shared/lib/utils";
import { useUIStore } from "../../../../shared/stores/ui.store";

type ProfileImportStats = {
  [key: string]: number | undefined;
  characters?: number;
  "character-groups"?: number;
  "character-versions"?: number;
  personas?: number;
  "persona-groups"?: number;
  lorebooks?: number;
  "lorebook-entries"?: number;
  "lorebook-folders"?: number;
  prompts?: number;
  "prompt-groups"?: number;
  "prompt-sections"?: number;
  "prompt-variables"?: number;
  "prompt-overrides"?: number;
  presets?: number;
  "chat-presets"?: number;
  agents?: number;
  "agent-runs"?: number;
  "agent-memory"?: number;
  themes?: number;
  extensions?: number;
  chats?: number;
  "chat-folders"?: number;
  messages?: number;
  "message-swipes"?: number;
  connections?: number;
  "connection-folders"?: number;
  "custom-tools"?: number;
  "regex-scripts"?: number;
  "app-settings"?: number;
  gallery?: number;
  "character-gallery"?: number;
  "background-metadata"?: number;
  sprites?: number;
  "knowledge-sources"?: number;
  "game-state-snapshots"?: number;
  "game-checkpoints"?: number;
  "conversation-notes"?: number;
  "ooc-influences"?: number;
  files?: number;
  unsupportedPromptOverrides?: number;
};

type ProfileImportProgressState = {
  status: "reading" | "preview" | "starting" | "running" | "success" | "error";
  label: string;
  completedItems: number;
  totalItems: number;
  startedAt: number;
  elapsedSeconds: number;
  imported?: ProfileImportStats;
  warnings?: ProfileImportWarning[];
  error?: string;
  sourceFormat?: string;
  converted?: ProfileImportConversion;
};

type ProfileImportWarning = {
  type?: string;
  path?: string;
  message?: string;
};

type ProfileImportResult = {
  success?: boolean;
  preview?: boolean;
  error?: string;
  message?: string;
  imported?: ProfileImportStats;
  warnings?: ProfileImportWarning[];
  sourceFormat?: string;
  converted?: ProfileImportConversion;
  fileFingerprint?: string;
};

type ProfileImportConversion = {
  applied?: boolean;
  from?: string;
  to?: string;
};

const PROFILE_IMPORT_STAT_LABELS: Array<{ key: string; aliases?: string[]; singular: string; plural: string }> = [
  { key: "characters", singular: "character", plural: "characters" },
  { key: "character-groups", singular: "character group", plural: "character groups" },
  { key: "character-versions", singular: "character version", plural: "character versions" },
  { key: "personas", singular: "persona", plural: "personas" },
  { key: "persona-groups", singular: "persona group", plural: "persona groups" },
  { key: "lorebooks", singular: "lorebook", plural: "lorebooks" },
  { key: "lorebook-entries", singular: "lorebook entry", plural: "lorebook entries" },
  { key: "lorebook-folders", singular: "lorebook folder", plural: "lorebook folders" },
  { key: "presets", aliases: ["prompts"], singular: "preset", plural: "presets" },
  { key: "prompt-groups", singular: "prompt group", plural: "prompt groups" },
  { key: "prompt-sections", singular: "prompt section", plural: "prompt sections" },
  { key: "prompt-variables", singular: "prompt variable", plural: "prompt variables" },
  { key: "prompt-overrides", singular: "prompt override", plural: "prompt overrides" },
  { key: "chat-presets", singular: "chat preset", plural: "chat presets" },
  { key: "agents", singular: "agent", plural: "agents" },
  { key: "agent-runs", singular: "agent run", plural: "agent runs" },
  { key: "agent-memory", singular: "agent memory row", plural: "agent memory rows" },
  { key: "themes", singular: "theme", plural: "themes" },
  { key: "extensions", singular: "extension", plural: "extensions" },
  { key: "connections", singular: "connection", plural: "connections" },
  { key: "connection-folders", singular: "connection folder", plural: "connection folders" },
  { key: "chats", singular: "chat", plural: "chats" },
  { key: "chat-folders", singular: "chat folder", plural: "chat folders" },
  { key: "messages", singular: "message", plural: "messages" },
  { key: "message-swipes", singular: "message swipe", plural: "message swipes" },
  { key: "custom-tools", singular: "custom tool", plural: "custom tools" },
  { key: "regex-scripts", singular: "regex script", plural: "regex scripts" },
  { key: "app-settings", singular: "app setting", plural: "app settings" },
  { key: "gallery", singular: "gallery item", plural: "gallery items" },
  { key: "character-gallery", singular: "character gallery item", plural: "character gallery items" },
  { key: "background-metadata", singular: "background", plural: "backgrounds" },
  { key: "sprites", singular: "sprite", plural: "sprites" },
  { key: "knowledge-sources", singular: "knowledge source", plural: "knowledge sources" },
  { key: "game-state-snapshots", singular: "game state snapshot", plural: "game state snapshots" },
  { key: "game-checkpoints", singular: "game checkpoint", plural: "game checkpoints" },
  { key: "conversation-notes", singular: "conversation note", plural: "conversation notes" },
  { key: "ooc-influences", singular: "OOC influence", plural: "OOC influences" },
  { key: "files", singular: "file", plural: "files" },
];
const PROFILE_IMPORT_STAT_META_KEYS = new Set(["unsupportedPromptOverrides"]);
const PROFILE_IMPORT_STAT_ALIAS_KEYS = new Set(["prompts"]);

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
  if (progress.status === "preview") return 0;
  if (progress.totalItems <= 0) return progress.status === "running" ? 8 : 0;
  const percent = Math.round((progress.completedItems / progress.totalItems) * 100);
  return Math.min(99, Math.max(progress.status === "running" ? 8 : 0, percent));
}

function formatProfileImportStats(stats?: ProfileImportStats) {
  if (!stats) return "";
  return profileImportStatEntries(stats)
    .map(({ count, singular, plural }) => `${count} ${count === 1 ? singular : plural}`)
    .join(", ");
}

function getProfileImportItemCount(stats?: ProfileImportStats) {
  if (!stats) return 0;
  return profileImportStatEntries(stats).reduce((total, { count }) => total + count, 0);
}

function profileImportStatEntries(stats: ProfileImportStats) {
  const used = new Set<string>();
  const entries: Array<{ key: string; count: number; singular: string; plural: string }> = [];
  for (const label of PROFILE_IMPORT_STAT_LABELS) {
    const keys = [label.key, ...(label.aliases ?? [])];
    for (const key of keys) used.add(key);
    const count =
      typeof stats[label.key] === "number"
        ? stats[label.key]
        : label.aliases?.map((key) => stats[key]).find((value) => typeof value === "number");
    if (typeof count === "number" && count > 0) {
      entries.push({ key: label.key, singular: label.singular, plural: label.plural, count });
    }
  }
  for (const [key, count] of Object.entries(stats)) {
    if (
      used.has(key) ||
      PROFILE_IMPORT_STAT_META_KEYS.has(key) ||
      PROFILE_IMPORT_STAT_ALIAS_KEYS.has(key) ||
      typeof count !== "number" ||
      count <= 0
    ) {
      continue;
    }
    const label = formatUnknownProfileImportStatKey(key);
    entries.push({ key, count, singular: label, plural: label });
  }
  return entries;
}

function formatUnknownProfileImportStatKey(key: string) {
  return key.replace(/[-_]+/g, " ");
}

function formatProfileImportSkippedStats(stats?: ProfileImportStats) {
  const count = stats?.unsupportedPromptOverrides;
  if (typeof count !== "number" || count <= 0) return "";
  return `${count} unsupported prompt override${count === 1 ? "" : "s"} skipped`;
}

function formatProfileImportWarnings(warnings?: ProfileImportWarning[]) {
  const count = warnings?.length ?? 0;
  if (count <= 0) return "";
  return `${count} warning${count === 1 ? "" : "s"}`;
}

function hasProfileImportWarningType(warnings: ProfileImportWarning[] | undefined, type: string) {
  return warnings?.some((warning) => warning.type === type) ?? false;
}

function formatProfileImportSourceFormat(sourceFormat?: string) {
  if (!sourceFormat) return "";
  const labels: Record<string, string> = {
    "refactor-native": "refactor native",
    "legacy-modern-fileStorage": "legacy fileStorage",
    "legacy-array": "legacy array",
    "refactor-collections": "refactor collections",
  };
  return labels[sourceFormat] ?? sourceFormat;
}

function formatProfileImportMetadata(progress: ProfileImportProgressState) {
  const source = formatProfileImportSourceFormat(progress.sourceFormat);
  const parts = source ? [`Source: ${source}`] : [];
  if (progress.converted?.applied) {
    const from = formatProfileImportSourceFormat(progress.converted.from);
    const to = formatProfileImportSourceFormat(progress.converted.to);
    parts.push(from && to ? `Conversion: ${from} -> ${to}` : "Conversion: applied");
  } else if (progress.converted?.applied === false) {
    parts.push("Conversion: none");
  }
  return parts.join(". ");
}

function profileImportMetadataFromResult(data?: ProfileImportResult) {
  return {
    imported: data?.imported,
    warnings: Array.isArray(data?.warnings) ? data.warnings : [],
    sourceFormat: typeof data?.sourceFormat === "string" ? data.sourceFormat : undefined,
    converted: data?.converted && typeof data.converted === "object" ? data.converted : undefined,
  };
}

function isProfileImportRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function profileImportProgressNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : undefined;
}

function profileImportStatsFromUnknown(value: unknown): ProfileImportStats | undefined {
  if (!isProfileImportRecord(value)) return undefined;
  const stats: ProfileImportStats = {};
  for (const [key, count] of Object.entries(value)) {
    if (typeof count === "number" && Number.isFinite(count)) {
      stats[key] = Math.max(0, Math.floor(count));
    }
  }
  return Object.keys(stats).length > 0 ? stats : undefined;
}

function formatProfileImportConfirmationMessage(preview: ProfileImportResult) {
  const { imported, warnings, sourceFormat, converted } = profileImportMetadataFromResult(preview);
  const found = formatProfileImportStats(imported) || "no counted records";
  const source = formatProfileImportSourceFormat(sourceFormat);
  const conversion = converted?.applied
    ? `Conversion: ${formatProfileImportSourceFormat(converted.from) || "legacy"} -> ${
        formatProfileImportSourceFormat(converted.to) || "refactor"
      }.`
    : converted?.applied === false
      ? "Conversion: none."
      : "";
  const skipped = formatProfileImportSkippedStats(imported);
  const warningSummary = formatProfileImportWarnings(warnings);
  const warningDetail = warningSummary
    ? hasProfileImportWarningType(warnings, "missing_asset")
      ? `${warningSummary} detected. Missing assets will be skipped.`
      : `${warningSummary} detected. Review warnings before continuing.`
    : "";
  return [
    `Found: ${found}.`,
    source ? `Source: ${source}.` : "",
    conversion,
    skipped ? `Skipped during conversion: ${skipped}.` : "",
    warningDetail,
    "Importing replaces the matching profile data areas from this file. This cannot be undone. Continue?",
  ]
    .filter(Boolean)
    .join("\n");
}

export function ProfileImportSection() {
  const qc = useQueryClient();
  const remoteProfileInputRef = useRef<HTMLInputElement>(null);
  const remoteRuntimeUrl = useUIStore((state) => state.remoteRuntimeUrl);
  const [profileImportProgress, setProfileImportProgress] = useState<ProfileImportProgressState | null>(null);
  const profileImportBusy =
    profileImportProgress?.status === "reading" ||
    profileImportProgress?.status === "preview" ||
    profileImportProgress?.status === "starting" ||
    profileImportProgress?.status === "running";
  const isRemoteRuntime = remoteRuntimeUrl.trim().length > 0;

  useEffect(() => {
    if (!profileImportBusy) return;
    const timer = window.setInterval(() => {
      setProfileImportProgress((current) =>
        current &&
        (current.status === "reading" ||
          current.status === "preview" ||
          current.status === "starting" ||
          current.status === "running")
          ? { ...current, elapsedSeconds: Math.floor((Date.now() - current.startedAt) / 1000) }
          : current,
      );
    }, 1000);
    return () => window.clearInterval(timer);
  }, [profileImportBusy]);

  const finishProfileImport = (data: ProfileImportResult, startedAt: number) => {
    if (data?.success === false) throw new Error(data.error ?? data.message ?? "Unknown error");
    qc.invalidateQueries();
    const { imported, warnings, sourceFormat, converted } = profileImportMetadataFromResult(data);
    const summary = formatProfileImportStats(imported);
    const skippedSummary = formatProfileImportSkippedStats(imported);
    const warningSummary = formatProfileImportWarnings(warnings);
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
        warnings,
        sourceFormat,
        converted,
      };
    });
    toast.success(
      [
        summary ? `Imported: ${summary}` : "Profile imported.",
        skippedSummary ? `Skipped: ${skippedSummary}.` : "",
        warningSummary ? `${warningSummary} reported.` : "",
      ]
        .filter(Boolean)
        .join(" "),
    );
  };

  const applyProfileImportProgressEvent = (event: ProfileImportProgressEvent, startedAt: number) => {
    if (event.type !== "progress") return;
    const data = isProfileImportRecord(event.data) ? event.data : {};
    const label = typeof data.label === "string" && data.label.trim() ? data.label : "Importing profile";
    const current = profileImportProgressNumber(data.current);
    const total = profileImportProgressNumber(data.total);
    const imported = profileImportStatsFromUnknown(data.imported);
    setProfileImportProgress((progress) => {
      if (!progress) return progress;
      const totalItems = Math.max(1, total ?? progress.totalItems);
      const completedItems = Math.min(totalItems, current ?? progress.completedItems);
      return {
        ...progress,
        status: "running",
        label,
        completedItems,
        totalItems,
        elapsedSeconds: Math.floor((Date.now() - startedAt) / 1000),
        imported: imported ?? progress.imported,
      };
    });
  };

  const runPreviewedProfileImport = async (
    startedAt: number,
    previewProfile: () => Promise<ProfileImportResult>,
    importProfile: (
      preview: ProfileImportResult,
      onProgress: (event: ProfileImportProgressEvent) => void,
    ) => Promise<ProfileImportResult>,
  ) => {
    setProfileImportProgress((current) =>
      current
        ? {
            ...current,
            status: "reading",
            label: "Scanning profile file",
            elapsedSeconds: Math.floor((Date.now() - startedAt) / 1000),
          }
        : current,
    );
    const preview = await previewProfile();
    if (preview?.success === false) throw new Error(preview.error ?? preview.message ?? "Unknown error");
    const { imported, warnings, sourceFormat, converted } = profileImportMetadataFromResult(preview);
    const totalItems = Math.max(1, getProfileImportItemCount(imported));
    setProfileImportProgress({
      status: "preview",
      label: "Review profile import",
      completedItems: 0,
      totalItems,
      startedAt,
      elapsedSeconds: Math.floor((Date.now() - startedAt) / 1000),
      imported,
      warnings,
      sourceFormat,
      converted,
    });
    const confirmed = await showConfirmDialog({
      title: "Import Profile",
      message: formatProfileImportConfirmationMessage(preview),
      confirmLabel: "Import",
      cancelLabel: "Cancel",
      tone: "destructive",
    });
    if (!confirmed) {
      setProfileImportProgress(null);
      return;
    }
    setProfileImportProgress((current) =>
      current
        ? {
            ...current,
            status: "starting",
            label: "Preparing profile import",
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
    finishProfileImport(
      await importProfile(preview, (event) => applyProfileImportProgressEvent(event, startedAt)),
      startedAt,
    );
  };

  const showProfileImportError = (err: unknown, startedAt: number) => {
    const expectedProfileFile = "profile JSON or ZIP file";
    const message =
      err instanceof SyntaxError
        ? `Import failed. Make sure this is a valid ${expectedProfileFile}.`
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
  };

  const handleProfileImport = async () => {
    if (profileImportBusy) return;
    if (isRemoteRuntime) {
      try {
        remoteRuntimeTarget();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Invalid Remote Runtime URL");
        return;
      }
      remoteProfileInputRef.current?.click();
      return;
    }
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
      await runPreviewedProfileImport(
        startedAt,
        () => profileApi.previewProfileFile<ProfileImportResult>(selected),
        (preview, onProgress) =>
          profileApi.importProfileFileWithProgress<ProfileImportResult>(
            selected,
            {
              previewFingerprint: preview.fileFingerprint,
            },
            onProgress,
          ),
      );
    } catch (err) {
      showProfileImportError(err, startedAt);
    }
  };

  const handleRemoteProfileFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0] ?? null;
    event.currentTarget.value = "";
    if (!file || profileImportBusy) return;
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
      await runPreviewedProfileImport(
        startedAt,
        () => profileApi.previewProfileUpload<ProfileImportResult>(file),
        (_preview, onProgress) => profileApi.importProfileUploadWithProgress<ProfileImportResult>(file, onProgress),
      );
    } catch (err) {
      showProfileImportError(err, startedAt);
    }
  };

  return (
    <>
      <input
        ref={remoteProfileInputRef}
        type="file"
        accept=".json,.zip,application/json,application/zip,application/x-zip-compressed"
        className="hidden"
        onChange={(event) => void handleRemoteProfileFileChange(event)}
      />
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
        {profileImportBusy
          ? profileImportProgress?.status === "reading" || profileImportProgress?.status === "preview"
            ? "Scanning Profile..."
            : "Importing Profile..."
          : "Import Profile (JSON/ZIP)"}
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
              ) : profileImportProgress.status === "preview" ? (
                <FileSearch size="0.875rem" className="shrink-0 text-emerald-500" />
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
              {profileImportProgress.status !== "preview" && (
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
                        ETA{" "}
                        {formatProfileImportDuration(estimateProfileImportRemainingSeconds(profileImportProgress) ?? 0)}
                      </span>
                    )}
                  </div>
                </>
              )}
              {formatProfileImportStats(profileImportProgress.imported) && (
                <div className="text-[0.6875rem] text-[var(--muted-foreground)]">
                  {profileImportProgress.status === "success" ? "Imported" : "Found"}:{" "}
                  {formatProfileImportStats(profileImportProgress.imported)}
                </div>
              )}
              {formatProfileImportMetadata(profileImportProgress) && (
                <div className="text-[0.6875rem] text-[var(--muted-foreground)]">
                  {formatProfileImportMetadata(profileImportProgress)}
                </div>
              )}
              {formatProfileImportSkippedStats(profileImportProgress.imported) && (
                <div className="text-[0.6875rem] text-[var(--muted-foreground)]">
                  Skipped: {formatProfileImportSkippedStats(profileImportProgress.imported)}
                </div>
              )}
              {formatProfileImportWarnings(profileImportProgress.warnings) && (
                <div className="text-[0.6875rem] text-[var(--muted-foreground)]">
                  Warnings: {formatProfileImportWarnings(profileImportProgress.warnings)}
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
