// ──────────────────────────────────────────────
// Custom Voice Manager (per-connection custom TTS voices)
// ──────────────────────────────────────────────
// Manages custom voices bound to one TTS connection: read-only management
// view, explicit documented profile selection (vllm-omni), WAV upload with
// consent/transcript/acknowledgment, explicit-only previews via ttsService,
// and deletion with assigned-character confirmation. All mutations pass the
// server snapshot and invalidate the TTS voices/config query caches.
import { useCallback, useEffect, useRef, useState } from "react";
import { AudioLines, FileAudio, Loader2, Music2, Play, RefreshCw, Square, Trash2, Upload } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "../../lib/utils";
import { api } from "../../lib/api-client";
import { ttsService } from "../../lib/tts-service";
import { HelpTooltip } from "../ui/HelpTooltip";
import { Modal } from "../ui/Modal";
import type { CustomVoiceManagement, CustomVoiceProfile, ManagedCustomVoice } from "@marinara-engine/shared";

const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
const MAX_AUDIO_DURATION_SECONDS = 120;
const DURATION_EPSILON_SECONDS = 0.5;

const PROFILE_OPTIONS: Array<{ value: Exclude<CustomVoiceProfile, null>; labelKey: string }> = [
  { value: "vllm-omni", labelKey: "ui.panels.customvoicemanager.profileVllmOmni" },
];

const STATUS_KEYS: Record<ManagedCustomVoice["status"], string> = {
  ready: "ui.panels.customvoicemanager.statusReady",
  pending: "ui.panels.customvoicemanager.statusPending",
  uncertain: "ui.panels.customvoicemanager.statusUncertain",
  unavailable: "ui.panels.customvoicemanager.statusUnavailable",
  deleted: "ui.panels.customvoicemanager.statusDeleted",
};

const STATUS_BADGE_STYLES: Record<ManagedCustomVoice["status"], string> = {
  ready: "bg-green-500/15 text-green-600 dark:text-green-400",
  pending: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  uncertain: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  unavailable: "bg-[var(--muted)] text-[var(--muted-foreground)]",
  deleted: "bg-[var(--muted)] text-[var(--muted-foreground)]",
};

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

async function fileToBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds)) return "--:--";
  const total = Math.round(seconds);
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

export interface CustomVoiceManagerProps {
  connectionId: string;
  onClose: () => void;
}

export function CustomVoiceManager({ connectionId, onClose }: CustomVoiceManagerProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [management, setManagement] = useState<CustomVoiceManagement | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [needsRefresh, setNeedsRefresh] = useState(false);

  const [profile, setProfile] = useState<CustomVoiceProfile>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  const [file, setFile] = useState<File | null>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [audioDuration, setAudioDuration] = useState<number | null>(null);
  const [fileIssue, setFileIssue] = useState<string | null>(null);
  const [localPreviewPlaying, setLocalPreviewPlaying] = useState(false);

  const [displayName, setDisplayName] = useState("");
  const [consentId, setConsentId] = useState("");
  const [transcript, setTranscript] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [testLine, setTestLine] = useState("");
  const [previewingVoiceId, setPreviewingVoiceId] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<ManagedCustomVoice | null>(null);
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const localPreviewAudioRef = useRef<HTMLAudioElement | null>(null);
  const previewCounterRef = useRef(0);
  // Every async result is bound to the connection it was requested for and to
  // the lifetime of this closure; stale results from a previous connection are
  // ignored instead of being applied to the new one.
  const connectionIdRef = useRef(connectionId);
  connectionIdRef.current = connectionId;
  // Sentinel guard: set on unmount so in-flight async continuations stop
  // touching state after the component is gone.
  const aliveRef = useRef(true);
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);
  const isCurrent = (cid: string) => aliveRef.current && connectionIdRef.current === cid;

  const invalidateTTSQueries = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["tts", "voices"] });
    queryClient.invalidateQueries({ queryKey: ["tts", "config"] });
  }, [queryClient]);

  // Read-only refresh: GET never mutates server state.
  const refresh = useCallback(async () => {
    const cid = connectionIdRef.current;
    setLoading(true);
    setLoadError(null);
    try {
      const data = await api.get<CustomVoiceManagement>(`/tts/custom-voices?connectionId=${encodeURIComponent(cid)}`);
      if (!isCurrent(cid)) return;
      setManagement(data);
      setProfile(data.profile);
      setNeedsRefresh(data.voices.some((v) => v.status === "uncertain") || Boolean(data.error));
      if (data.error) {
        setLoadError(data.error);
      }
    } catch (error) {
      if (!isCurrent(cid)) return;
      setLoadError(errorMessage(error));
    } finally {
      if (isCurrent(cid)) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [connectionId, refresh]);

  const stopLocalPreview = useCallback(() => {
    localPreviewAudioRef.current?.pause();
    setLocalPreviewPlaying(false);
  }, []);

  // Stop TTS preview playback and release the local object URL on close.
  useEffect(
    () => () => {
      ttsService.stop();
      stopLocalPreview();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    },
    [objectUrl, stopLocalPreview],
  );

  // Revalidate when the connection changes; drop stale form/file state.
  useEffect(() => {
    setManagement(null);
    setLoadError(null);
    setNeedsRefresh(false);
    setFile(null);
    setAudioDuration(null);
    setFileIssue(null);
    setUploadError(null);
    setDeleteTarget(null);
    setDeleteConfirmed(false);
    setPreviewingVoiceId(null);
  }, [connectionId]);

  const chooseFile = useCallback(
    (next: File | null) => {
      const cid = connectionIdRef.current;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      stopLocalPreview();
      setFile(next);
      setAudioDuration(null);
      setFileIssue(null);
      if (!next) {
        setObjectUrl(null);
        return;
      }
      const isWav = next.type === "audio/wav" || next.name.toLowerCase().endsWith(".wav");
      if (!isWav) {
        setFileIssue(t("ui.panels.customvoicemanager.fileNotWav"));
      } else if (next.size > MAX_AUDIO_BYTES) {
        setFileIssue(t("ui.panels.customvoicemanager.fileTooLarge"));
      }
      const url = URL.createObjectURL(next);
      setObjectUrl(url);
      const probe = new Audio();
      probe.preload = "metadata";
      probe.src = url;
      probe.onloadedmetadata = () => {
        if (!isCurrent(cid)) return;
        setAudioDuration(probe.duration);
        if (Number.isFinite(probe.duration) && probe.duration > MAX_AUDIO_DURATION_SECONDS + DURATION_EPSILON_SECONDS) {
          setFileIssue(t("ui.panels.customvoicemanager.fileTooLong"));
        }
      };
    },
    [objectUrl, stopLocalPreview, t],
  );

  const toggleLocalPreview = useCallback(() => {
    if (!objectUrl) return;
    const existing = localPreviewAudioRef.current;
    if (existing && !existing.paused) {
      stopLocalPreview();
      return;
    }
    const audio = existing ?? new Audio(objectUrl);
    localPreviewAudioRef.current = audio;
    void audio
      .play()
      .then(() => setLocalPreviewPlaying(true))
      .catch(() => setLocalPreviewPlaying(false));
    audio.onended = () => setLocalPreviewPlaying(false);
  }, [objectUrl, stopLocalPreview]);

  const saveProfile = useCallback(
    async (next: Exclude<CustomVoiceProfile, null>) => {
      if (!management) return;
      const cid = connectionIdRef.current;
      setSavingProfile(true);
      try {
        await api.put(`/tts/custom-voices?connectionId=${encodeURIComponent(cid)}`, {
          snapshot: management.snapshot,
          profile: next,
        });
        // Stale profile success: ignore if the connection changed or the component unmounted.
        if (isCurrent(cid)) {
          setProfile(next);
          toast.success(t("ui.panels.customvoicemanager.profileSaved"));
        }
        invalidateTTSQueries();
        await refresh();
      } catch (error) {
        if (isCurrent(cid)) {
          toast.error(t("ui.panels.customvoicemanager.profileError", { value1: errorMessage(error) }));
        }
      } finally {
        if (isCurrent(cid)) setSavingProfile(false);
      }
    },
    [management, invalidateTTSQueries, refresh, t],
  );

  const upload = useCallback(async () => {
    if (!management || !file) return;
    const cid = connectionIdRef.current;
    setUploadError(null);
    if (!displayName.trim()) {
      setUploadError(t("ui.panels.customvoicemanager.displayNameRequired"));
      return;
    }
    if (!consentId.trim()) {
      setUploadError(t("ui.panels.customvoicemanager.consentRequired"));
      return;
    }
    if (!acknowledged) {
      setUploadError(t("ui.panels.customvoicemanager.ackRequired"));
      return;
    }
    if (fileIssue) {
      setUploadError(fileIssue);
      return;
    }
    setUploading(true);
    try {
      // Base64 encoding is the long step: re-check liveness before sending.
      const audioBase64 = await fileToBase64(file);
      if (!isCurrent(cid)) return;
      const trimmedTranscript = transcript.trim();
      const body: {
        snapshot: string;
        displayName: string;
        consent: string;
        transcript?: string;
        audioBase64: string;
        acknowledged: boolean;
      } = {
        snapshot: management.snapshot,
        displayName: displayName.trim(),
        consent: consentId.trim(),
        audioBase64,
        acknowledged: true,
      };
      if (trimmedTranscript) body.transcript = trimmedTranscript;
      // POST returns the updated management snapshot, not a single voice.
      const result = await api.post<CustomVoiceManagement>(
        `/tts/custom-voices?connectionId=${encodeURIComponent(cid)}`,
        body,
      );
      invalidateTTSQueries();
      if (isCurrent(cid)) {
        const created = result.voices.find((v) => v.displayName === body.displayName);
        if (created?.status === "ready") {
          toast.success(t("ui.panels.customvoicemanager.uploadSuccess", { value1: body.displayName }));
        } else {
          setNeedsRefresh(true);
          toast.warning(t("ui.panels.customvoicemanager.uploadUncertain"));
        }
        // Clear the form only after a successful upload; failures keep state.
        setDisplayName("");
        setConsentId("");
        setTranscript("");
        setAcknowledged(false);
        chooseFile(null);
      }
      await refresh();
    } catch (error) {
      if (isCurrent(cid)) {
        setUploadError(t("ui.panels.customvoicemanager.uploadError", { value1: errorMessage(error) }));
        setNeedsRefresh(true);
      }
    } finally {
      if (isCurrent(cid)) setUploading(false);
    }
  }, [
    management,
    file,
    displayName,
    consentId,
    acknowledged,
    fileIssue,
    transcript,
    chooseFile,
    invalidateTTSQueries,
    refresh,
    t,
  ]);

  const startPreview = useCallback(
    async (voice: ManagedCustomVoice) => {
      if (previewingVoiceId) return;
      const cid = connectionIdRef.current;
      const line = testLine.trim() || t("ui.panels.customvoicemanager.testDefault");
      const previewId = `custom-voice-preview-${voice.id}-${Date.now()}-${previewCounterRef.current++}`;
      setPreviewingVoiceId(voice.id);
      try {
        await ttsService.speak(line, previewId, {
          voice: voice.id,
          audioConnectionId: cid,
          throwOnError: true,
        });
      } catch (error) {
        if (isCurrent(cid)) {
          setPreviewingVoiceId(null);
          toast.error(t("ui.panels.customvoicemanager.testError", { value1: errorMessage(error) }));
        }
      } finally {
        if (isCurrent(cid)) setPreviewingVoiceId(null);
      }
    },
    [previewingVoiceId, testLine, t],
  );

  const openDelete = useCallback((voice: ManagedCustomVoice) => {
    setDeleteTarget(voice);
    setDeleteConfirmed(false);
    setDeleteError(null);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!management || !deleteTarget) return;
    const cid = connectionIdRef.current;
    const target = deleteTarget;
    setDeleting(true);
    setDeleteError(null);
    try {
      await api.post(`/tts/custom-voices/delete?connectionId=${encodeURIComponent(cid)}`, {
        snapshot: management.snapshot,
        id: target.id,
        confirmedAssignments: management.assignments[target.id] ?? [],
      });
      invalidateTTSQueries();
      if (isCurrent(cid)) {
        setDeleteTarget(null);
        setDeleteConfirmed(false);
        toast.success(t("ui.panels.customvoicemanager.deleteSuccess", { value1: target.displayName }));
      }
      await refresh();
    } catch (error) {
      // The delete failed: keep the dialog open and the voice in the list.
      if (isCurrent(cid)) {
        setDeleteError(t("ui.panels.customvoicemanager.deleteError", { value1: errorMessage(error) }));
      }
    } finally {
      if (isCurrent(cid)) setDeleting(false);
    }
  }, [management, deleteTarget, invalidateTTSQueries, refresh, t]);

  const destination = management?.destination;
  const capability = management?.capability ?? "unknown";
  const voices = management?.voices ?? [];
  const canTest = management?.capability === "explicit";

  const destinationLabel = destination ? management.destination : "";

  const statusOf = (voice: ManagedCustomVoice) => t(STATUS_KEYS[voice.status]);

  const inputCls = "mari-chrome-field w-full px-3 py-2 text-sm placeholder:text-[var(--muted-foreground)]";

  return (
    <Modal open onClose={onClose} title={t("ui.panels.customvoicemanager.title")} width="max-w-2xl">
      <div className="space-y-4">
        {/* Destination + capability */}
        <section className="space-y-2">
          <div className="flex items-center gap-1">
            <span className="text-xs font-medium text-[var(--foreground)]">
              {t("ui.panels.customvoicemanager.destinationLabel")}
            </span>
            <HelpTooltip text={t("ui.panels.customvoicemanager.destinationHint")} />
          </div>
          <p className="rounded-lg bg-[var(--muted)] px-3 py-2 font-mono text-xs text-[var(--muted-foreground)]">
            {destinationLabel || t("ui.panels.customvoicemanager.destinationUnknown")}
          </p>
          {capability === "explicit" && (
            <p className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]">
              <AudioLines className="h-3.5 w-3.5" />
              {t("ui.panels.customvoicemanager.capabilityExplicit")}
            </p>
          )}
          {capability === "unsupported" && (
            <p className="text-xs text-[var(--muted-foreground)]">
              {t("ui.panels.customvoicemanager.capabilityUnsupported")}
            </p>
          )}
          {capability === "unknown" && (
            <div className="space-y-2 rounded-lg border border-[var(--border)] p-3">
              <p className="text-xs leading-relaxed text-[var(--muted-foreground)]">
                {t("ui.panels.customvoicemanager.capabilityUnknown")}
              </p>
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-40 flex-1 space-y-1">
                  <label htmlFor="cvm-profile" className="block text-xs font-medium text-[var(--foreground)]">
                    {t("ui.panels.customvoicemanager.profileLabel")}
                  </label>
                  <select
                    id="cvm-profile"
                    value={profile ?? ""}
                    disabled={savingProfile}
                    onChange={(event) => setProfile((event.target.value || null) as CustomVoiceProfile)}
                    className={inputCls}
                  >
                    <option value="" disabled>
                      {t("ui.panels.customvoicemanager.profileChoose")}
                    </option>
                    {PROFILE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {t(option.labelKey)}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => profile && void saveProfile(profile)}
                  disabled={!profile || savingProfile}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors",
                    !profile || savingProfile
                      ? "cursor-default text-[var(--muted-foreground)]"
                      : "bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90",
                  )}
                >
                  {savingProfile && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {savingProfile
                    ? t("ui.panels.customvoicemanager.savingProfile")
                    : t("ui.panels.customvoicemanager.saveProfile")}
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Management status / recovery guidance */}
        {(loading || loadError || needsRefresh) && (
          <div className="space-y-2">
            {loading && (
              <p className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {t("ui.panels.customvoicemanager.refreshing")}
              </p>
            )}
            {loadError && (
              <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs leading-relaxed text-red-600 dark:text-red-400">
                {t("ui.panels.customvoicemanager.loadError", { value1: loadError })}
              </p>
            )}
            {needsRefresh && (
              <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-600 dark:text-amber-400">
                {t("ui.panels.customvoicemanager.needsRefresh")}
              </p>
            )}
            <button
              type="button"
              onClick={() => void refresh()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
              {t("ui.panels.customvoicemanager.refresh")}
            </button>
          </div>
        )}

        {/* Managed voices */}
        <section className="space-y-2">
          <h3 className="text-xs font-medium text-[var(--foreground)]">
            {t("ui.panels.customvoicemanager.voicesTitle")}
          </h3>
          {voices.length === 0 ? (
            <p className="text-xs text-[var(--muted-foreground)]">{t("ui.panels.customvoicemanager.voicesEmpty")}</p>
          ) : (
            <ul className="space-y-1.5">
              {voices.map((voice) => (
                <li
                  key={voice.id}
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <Music2 className="h-3.5 w-3.5 shrink-0 text-[var(--muted-foreground)]" />
                      <span className="truncate text-sm font-medium text-[var(--foreground)]">{voice.displayName}</span>
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-1.5 py-0.5 text-[0.625rem] font-medium",
                          STATUS_BADGE_STYLES[voice.status],
                        )}
                      >
                        {statusOf(voice)}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate font-mono text-[0.625rem] text-[var(--muted-foreground)]">
                      {voice.id}
                    </p>
                  </div>
                  {canTest && voice.status === "ready" && (
                    <button
                      type="button"
                      onClick={() => void startPreview(voice)}
                      disabled={previewingVoiceId !== null}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors",
                        previewingVoiceId === voice.id
                          ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                          : "text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]",
                      )}
                      aria-label={
                        previewingVoiceId === voice.id
                          ? t("ui.panels.customvoicemanager.testing")
                          : t("ui.panels.customvoicemanager.testLabel")
                      }
                    >
                      {previewingVoiceId === voice.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Play className="h-3 w-3" />
                      )}
                      {previewingVoiceId === voice.id
                        ? t("ui.panels.customvoicemanager.testing")
                        : t("ui.panels.customvoicemanager.testLabel")}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => openDelete(voice)}
                    className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-[var(--muted-foreground)] transition-colors hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400"
                  >
                    <Trash2 className="h-3 w-3" />
                    {t("ui.panels.customvoicemanager.deleteLabel")}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {canTest && (
            <div className="flex flex-wrap items-center gap-2">
              <label htmlFor="cvm-test-line" className="text-xs font-medium text-[var(--foreground)]">
                {t("ui.panels.customvoicemanager.testLineLabel")}
              </label>
              <input
                id="cvm-test-line"
                value={testLine}
                onChange={(event) => setTestLine(event.target.value)}
                placeholder={t("ui.panels.customvoicemanager.testLinePlaceholder")}
                className={cn(inputCls, "flex-1")}
              />
            </div>
          )}
        </section>

        {/* Upload */}
        {capability === "explicit" && (
          <section className="space-y-3 rounded-lg border border-[var(--border)] p-3">
            <h3 className="flex items-center gap-1.5 text-xs font-medium text-[var(--foreground)]">
              <Upload className="h-3.5 w-3.5" />
              {t("ui.panels.customvoicemanager.uploadTitle")}
            </h3>

            <div className="flex flex-wrap items-center gap-2">
              <label className="text-xs font-medium text-[var(--foreground)]">
                {t("ui.panels.customvoicemanager.uploadFileLabel")}
              </label>
              <HelpTooltip text={t("ui.panels.customvoicemanager.uploadFileHint")} />
              <input
                type="file"
                accept="audio/wav,.wav"
                className="hidden"
                id="cvm-file"
                onChange={(event) => chooseFile(event.target.files?.[0] ?? null)}
              />
              <button
                type="button"
                onClick={() => document.getElementById("cvm-file")?.click()}
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
              >
                <FileAudio className="h-3.5 w-3.5" />
                {t("ui.panels.customvoicemanager.chooseFile")}
              </button>
              {file && (
                <>
                  <span className="inline-flex min-w-0 items-center gap-1 text-xs text-[var(--muted-foreground)]">
                    <span className="truncate">
                      {t("ui.panels.customvoicemanager.fileName", {
                        value1: file.name,
                        value2: formatFileSize(file.size),
                      })}
                    </span>
                    {audioDuration !== null && (
                      <span className="shrink-0 font-mono">{formatDuration(audioDuration)}</span>
                    )}
                  </span>
                  {objectUrl && (
                    <button
                      type="button"
                      onClick={toggleLocalPreview}
                      className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                    >
                      {localPreviewPlaying ? <Square className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                      {localPreviewPlaying
                        ? t("ui.panels.customvoicemanager.localPreviewStop")
                        : t("ui.panels.customvoicemanager.localPreviewPlay")}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => chooseFile(null)}
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                  >
                    {t("ui.panels.customvoicemanager.removeFile")}
                  </button>
                </>
              )}
            </div>
            {fileIssue && <p className="text-xs text-amber-600 dark:text-amber-400">{fileIssue}</p>}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label htmlFor="cvm-display-name" className="block text-xs font-medium text-[var(--foreground)]">
                  {t("ui.panels.customvoicemanager.displayNameLabel")}
                </label>
                <input
                  id="cvm-display-name"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  maxLength={64}
                  placeholder={t("ui.panels.customvoicemanager.displayNamePlaceholder")}
                  className={inputCls}
                />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1">
                  <label htmlFor="cvm-consent" className="text-xs font-medium text-[var(--foreground)]">
                    {t("ui.panels.customvoicemanager.consentLabel")}
                  </label>
                  <HelpTooltip text={t("ui.panels.customvoicemanager.consentHint")} />
                </div>
                <input
                  id="cvm-consent"
                  value={consentId}
                  onChange={(event) => setConsentId(event.target.value)}
                  placeholder={t("ui.panels.customvoicemanager.consentPlaceholder")}
                  className={inputCls}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label htmlFor="cvm-transcript" className="block text-xs font-medium text-[var(--foreground)]">
                {t("ui.panels.customvoicemanager.transcriptLabel")}
              </label>
              <textarea
                id="cvm-transcript"
                value={transcript}
                onChange={(event) => setTranscript(event.target.value)}
                rows={2}
                maxLength={10000}
                placeholder={t("ui.panels.customvoicemanager.transcriptPlaceholder")}
                className={cn(inputCls, "resize-y")}
              />
            </div>

            <label className="flex items-start gap-2 text-xs leading-relaxed text-[var(--muted-foreground)]">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(event) => setAcknowledged(event.target.checked)}
                className="mt-0.5 h-3.5 w-3.5"
              />
              {t("ui.panels.customvoicemanager.ackLabel")}
            </label>

            {uploadError && (
              <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs leading-relaxed text-red-600 dark:text-red-400">
                {uploadError}
              </p>
            )}

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => void upload()}
                disabled={uploading || needsRefresh}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors",
                  uploading || needsRefresh
                    ? "cursor-default text-[var(--muted-foreground)]"
                    : "bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90",
                )}
              >
                {uploading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <Upload className="h-3.5 w-3.5" />
                {uploading ? t("ui.panels.customvoicemanager.uploading") : t("ui.panels.customvoicemanager.upload")}
              </button>
            </div>
          </section>
        )}

        {/* Delete confirmation */}
        {deleteTarget && (
          <section className="space-y-2 rounded-lg border border-red-500/30 bg-red-500/5 p-3">
            <h3 className="text-xs font-medium text-[var(--foreground)]">
              {t("ui.panels.customvoicemanager.deleteTitle", { value1: deleteTarget.displayName })}
            </h3>
            <p className="text-xs leading-relaxed text-[var(--muted-foreground)]">
              {t("ui.panels.customvoicemanager.deleteBody")}
            </p>
            {(() => {
              const assignments = management?.assignments[deleteTarget.id] ?? [];
              if (assignments.length === 0) return null;
              return (
                <div className="space-y-1.5">
                  <p className="text-xs leading-relaxed text-[var(--muted-foreground)]">
                    {t("ui.panels.customvoicemanager.deleteAssignments", {
                      value1: assignments.join(", "),
                    })}
                  </p>
                  <label className="flex items-start gap-2 text-xs leading-relaxed text-[var(--muted-foreground)]">
                    <input
                      type="checkbox"
                      checked={deleteConfirmed}
                      onChange={(event) => setDeleteConfirmed(event.target.checked)}
                      className="mt-0.5 h-3.5 w-3.5"
                    />
                    {t("ui.panels.customvoicemanager.deleteConfirmLabel")}
                  </label>
                </div>
              );
            })()}
            {deleteError && (
              <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs leading-relaxed text-red-600 dark:text-red-400">
                {deleteError}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setDeleteTarget(null);
                  setDeleteConfirmed(false);
                  setDeleteError(null);
                }}
                disabled={deleting}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
              >
                {t("ui.panels.customvoicemanager.close")}
              </button>
              <button
                type="button"
                onClick={() => void confirmDelete()}
                disabled={
                  deleting ||
                  (management ? (management.assignments[deleteTarget.id] ?? []).length > 0 && !deleteConfirmed : false)
                }
                className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-default disabled:opacity-50"
              >
                {deleting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <Trash2 className="h-3.5 w-3.5" />
                {deleting
                  ? t("ui.panels.customvoicemanager.deleting")
                  : t("ui.panels.customvoicemanager.confirmDelete")}
              </button>
            </div>
          </section>
        )}
      </div>
    </Modal>
  );
}
