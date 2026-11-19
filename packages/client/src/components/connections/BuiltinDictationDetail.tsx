// ──────────────────────────────────────────────
// Whisper's page: the speech model Calls and Videos turn speech into text with on this device (Calls package only).
// Same anatomy as the other models on this device: hero with state, labelled actions, one facts card, the download,
// Remove files.
// ──────────────────────────────────────────────
import { useEffect, useState } from "react";
import { HardDriveDownload, Settings2, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { SIDECAR_SPEECH_MODELS, type SidecarSpeechModelId } from "@marinara-engine/shared";
import { showConfirmDialog } from "../../lib/app-dialogs";
import { cn } from "../../lib/utils";
import { useSidecarStore } from "../../stores/sidecar.store";
import { useUIStore } from "../../stores/ui.store";
import {
  DETAIL_CARD_CLASS,
  DEVICE_FIELD,
  DetailHero,
  describeSpeechRuntimeUnavailable,
  FactRow,
  formatBytes,
  SMALL_ACTION,
  StateWord,
  type DeviceEngine,
} from "./DeviceDetail";
import { ProviderIcon } from "./ProviderIcon";

export function BuiltinDictationDetail({ engine }: { engine?: DeviceEngine }) {
  const { t } = useTranslation();
  const {
    speechStatus,
    speechAvailable,
    speechModelDownloaded,
    speechModelDisplayName,
    speechModelSize,
    speechModels: listedModels,
    speechConfig,
    speechRuntime,
    speechDownloadProgress,
    speechError,
    startSpeechDownload,
    deleteSpeechModel,
    fetchSpeechStatus,
  } = useSidecarStore();
  // The server lists none where Whisper can't run; the page still names what it would download.
  const speechModels = listedModels.length > 0 ? listedModels : SIDECAR_SPEECH_MODELS;
  const [choice, setChoice] = useState<SidecarSpeechModelId | null>(null);
  const [removing, setRemoving] = useState(false);
  useEffect(() => {
    void fetchSpeechStatus();
  }, [fetchSpeechStatus]);

  const downloading = speechDownloadProgress?.status === "downloading" || speechStatus === "downloading_model";
  const installed = speechModels.find((model) => model.id === speechConfig.modelId) ?? null;
  const shown =
    (speechModelDownloaded ? installed : null) ??
    speechModels.find((model) => model.id === choice) ??
    speechModels[0] ??
    null;

  const download = async () => {
    if (!shown || downloading) return;
    if (await startSpeechDownload(shown.id)) toast.success(t("connections.device.whisper.downloadedRestart"));
  };
  const remove = async () => {
    const confirmed = await showConfirmDialog({
      title: t("connections.builtinEmbedding.removeTitle", { model: speechModelDisplayName ?? "Whisper" }),
      message: t("connections.builtinDictation.removeBody"),
      confirmLabel: t("connections.device.removeFiles"),
      tone: "destructive",
    });
    if (!confirmed) return;
    setRemoving(true);
    try {
      await deleteSpeechModel();
      toast.success(t("connections.device.whisper.deleted"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("connections.device.whisper.deleteFailed"));
    } finally {
      setRemoving(false);
    }
  };
  const percent =
    speechDownloadProgress && speechDownloadProgress.total > 0
      ? Math.min(100, Math.round((speechDownloadProgress.downloaded / speechDownloadProgress.total) * 100))
      : 12;

  return (
    <div className="flex flex-col gap-3" data-component="BuiltinDictationDetail">
      <DetailHero icon={<ProviderIcon provider="stt" size="lg" />} title={t("connections.builtinDictation.name")}>
        {engine ? <StateWord tone={engine.tone} label={engine.state} /> : null}
        <span>· {t("connections.accounts.section.device")}</span>
      </DetailHero>

      <div className="flex flex-wrap gap-1.5">
        {/* The Dictation settings live in its job; this page keeps the model. */}
        <button
          type="button"
          onClick={() => useUIStore.getState().openModal("job-settings", { job: "stt" })}
          className={SMALL_ACTION}
        >
          <Settings2 size="0.75rem" />
          {t("connections.device.openJobSettings")}
        </button>
      </div>

      {!speechAvailable && (
        <div className="mari-device-warn rounded-lg border border-[var(--warning)]/30 bg-[var(--warning)]/10 p-2.5 text-[0.6875rem]">
          <p className="text-[var(--foreground)]">{describeSpeechRuntimeUnavailable(speechRuntime, t)}</p>
          {speechRuntime && (
            <p className="mt-1 text-[var(--muted-foreground)]">
              {t("connections.device.whisper.nodeAt", {
                version: speechRuntime.nodeVersion,
                path: speechRuntime.nodeExecPath,
              })}
            </p>
          )}
        </div>
      )}

      {speechError && (
        <p role="alert" className="text-[0.6875rem] text-[var(--marinara-app-accent-static)] [overflow-wrap:anywhere]">
          {speechError}
        </p>
      )}

      <section className={DETAIL_CARD_CLASS}>
        <FactRow label={t("connections.device.fact.model")}>
          {speechModelDownloaded ? (
            (speechModelDisplayName ?? shown?.label ?? "Whisper")
          ) : (
            <select
              value={shown?.id ?? ""}
              disabled={downloading || !speechAvailable}
              onChange={(event) => setChoice(event.target.value as SidecarSpeechModelId)}
              aria-label={t("connections.device.fact.model")}
              className={DEVICE_FIELD}
            >
              {speechModels.map((model) => (
                <option key={model.id} value={model.id}>
                  {t("connections.builtinEmbedding.optionToDownload", {
                    model: model.label,
                    size: formatBytes(model.sizeBytes),
                  })}
                </option>
              ))}
            </select>
          )}
          {shown && (
            <span className="mt-1 block text-[0.6875rem] text-[var(--muted-foreground)]">
              {[
                speechModelDownloaded
                  ? ""
                  : t("connections.builtinEmbedding.notDownloadedSize", { size: formatBytes(shown.sizeBytes) }),
                shown.description,
              ]
                .filter(Boolean)
                .join(" ")}
            </span>
          )}
        </FactRow>
        {shown && (
          <FactRow label={t("connections.device.fact.memory")}>
            {t("connections.builtinEmbedding.memoryUpTo", { max: formatBytes(shown.ramBytes) })}
            {speechModelDownloaded && speechModelSize ? (
              <span className="block text-[0.6875rem] text-[var(--muted-foreground)]">
                {t("connections.builtinDictation.onDisk", { size: formatBytes(speechModelSize) })}
              </span>
            ) : null}
          </FactRow>
        )}
        <FactRow label={t("connections.device.fact.usedBy")}>
          {speechModelDownloaded ? t("connections.builtinDictation.usedBy") : t("connections.device.usedBy.none")}
        </FactRow>
      </section>

      {downloading ? (
        <div className="flex flex-col gap-1.5">
          <div className="h-1.5 overflow-hidden rounded-full bg-[var(--secondary)]">
            <div
              className="h-full rounded-full bg-[var(--primary)] transition-[width]"
              style={{ width: `${percent}%` }}
            />
          </div>
          <span className="truncate text-[0.6875rem] text-[var(--muted-foreground)]">
            {speechDownloadProgress?.label ?? t("connections.device.whisper.downloading")}
          </span>
        </div>
      ) : !speechModelDownloaded && speechAvailable && shown ? (
        <button
          type="button"
          onClick={() => void download()}
          className="mari-chrome-control mari-chrome-control--primary w-full"
        >
          <HardDriveDownload size="0.8125rem" />
          {t("connections.builtinEmbedding.downloadModel", { model: shown.label, size: formatBytes(shown.sizeBytes) })}
        </button>
      ) : null}

      {speechModelDownloaded && !downloading && (
        <button
          type="button"
          disabled={removing}
          onClick={() => void remove()}
          className={cn(SMALL_ACTION, "mari-device-remove self-start")}
        >
          <Trash2 size="0.75rem" />
          {t("connections.device.removeFiles")}
        </button>
      )}
    </div>
  );
}
