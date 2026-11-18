// ──────────────────────────────────────────────
// The avatars' emotion model's page: a small multilingual model that reads the mood of each sentence while a reply
// streams, so 2D and 3D Avatars change face as their character talks. Same anatomy as the other models on this
// device: hero with state, one facts card, the download, Remove files.
// ──────────────────────────────────────────────
import { HardDriveDownload, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  useAvatarEmotionModelStatus,
  useDownloadAvatarEmotionModel,
  useRemoveAvatarEmotionModel,
} from "../../hooks/use-avatar-emotion-model";
import { showConfirmDialog } from "../../lib/app-dialogs";
import { cn } from "../../lib/utils";
import { Spinner } from "../ui/Spinner";
import {
  DETAIL_CARD_CLASS,
  DetailHero,
  FactRow,
  formatBytes,
  SMALL_ACTION,
  StateWord,
  type EngineTone,
} from "./DeviceDetail";
import { ProviderIcon } from "./ProviderIcon";

const MODEL_LABEL = "Multilingual Emotions (small)";
const MODEL_LICENSE = "Apache 2.0";
/** Measured while it reads (local-emotion-model.ts). */
const MODEL_MEMORY_BYTES = 1_100_000_000;

/** The page's state as one coloured word, shared with the On this device rows. */
export function useBuiltinEmotionState(): { name: string; tone: EngineTone; state: string; detail: string } | null {
  const { t } = useTranslation();
  const { data } = useAvatarEmotionModelStatus();
  if (!data || data.unsupported === "lite") return null;
  const name = t("connections.builtinEmotion.name");
  const detail = t("connections.builtinEmotion.short");
  if (data.unsupported) return { name, tone: "off", detail, state: t("connections.builtinEmotion.state.wordsOnly") };
  switch (data.state) {
    case "downloading": {
      const percent = data.totalBytes > 0 ? Math.floor((data.downloadedBytes / data.totalBytes) * 100) : 0;
      return { name, tone: "off", detail, state: t("connections.builtinEmbedding.downloadingPercent", { percent }) };
    }
    case "loading":
      return { name, tone: "off", detail, state: t("connections.device.state.starting") };
    case "downloaded":
      return { name, tone: "ok", detail, state: t("connections.builtinEmbedding.state.ready") };
    case "failed":
      return { name, tone: "warn", detail, state: t("connections.device.state.error") };
    default:
      return { name, tone: "off", detail, state: t("connections.device.state.notDownloaded") };
  }
}

export function BuiltinEmotionDetail() {
  const { t } = useTranslation();
  const status = useAvatarEmotionModelStatus();
  const download = useDownloadAvatarEmotionModel();
  const remove = useRemoveAvatarEmotionModel();
  const engine = useBuiltinEmotionState();
  const data = status.data;
  if (!data) {
    return status.isError ? (
      <p className="text-xs text-[var(--muted-foreground)]">{t("connections.builtinEmotion.statusFailed")}</p>
    ) : (
      <Spinner size="sm" />
    );
  }
  const report = (error: unknown) =>
    toast.error(error instanceof Error ? error.message : t("connections.builtinEmbedding.failed"));
  const busy = download.isPending || remove.isPending;
  const downloading = data.state === "downloading";
  const onDisk = data.state === "downloaded" || data.state === "loading";
  const percent = data.totalBytes > 0 ? Math.min(100, Math.floor((data.downloadedBytes / data.totalBytes) * 100)) : 0;

  const startDownload = async () => {
    const confirmed = await showConfirmDialog({
      title: t("connections.builtinEmbedding.downloadTitle", { model: MODEL_LABEL }),
      message: t("connections.builtinEmotion.downloadBody", {
        size: formatBytes(data.totalBytes),
        memory: formatBytes(MODEL_MEMORY_BYTES),
        license: MODEL_LICENSE,
      }),
      confirmLabel: t("connections.device.download"),
    });
    if (confirmed) download.mutate(undefined, { onError: report });
  };

  const removeFiles = async () => {
    const confirmed = await showConfirmDialog({
      title: t("connections.builtinEmbedding.removeTitle", { model: MODEL_LABEL }),
      message: t("connections.builtinEmotion.removeBody"),
      confirmLabel: t("connections.device.removeFiles"),
      tone: "destructive",
    });
    if (confirmed) remove.mutate(undefined, { onError: report });
  };

  const unsupportedText =
    data.unsupported === "low-memory"
      ? t("connections.builtinEmotion.lowMemory")
      : data.unsupported
        ? t("connections.builtinEmotion.noRuntime")
        : null;

  return (
    <div className="flex flex-col gap-3" data-component="BuiltinEmotionDetail">
      <DetailHero icon={<ProviderIcon provider="emotions" size="lg" />} title={t("connections.builtinEmotion.name")}>
        {engine ? <StateWord tone={engine.tone} label={engine.state} /> : null}
        <span>· {t("connections.accounts.section.device")}</span>
      </DetailHero>

      {unsupportedText && (
        <div className="mari-device-warn rounded-lg border border-[var(--warning)]/30 bg-[var(--warning)]/10 p-2.5 text-[0.6875rem]">
          <p className="text-[var(--foreground)]">{unsupportedText}</p>
        </div>
      )}

      {data.state === "failed" && (
        <p role="alert" className="text-[0.6875rem] text-[var(--marinara-app-accent-static)]">
          {t("connections.builtinEmotion.failed")}
        </p>
      )}

      <section className={DETAIL_CARD_CLASS}>
        <FactRow label={t("connections.device.fact.model")}>
          {MODEL_LABEL}
          <span className="mt-1 block text-[0.6875rem] text-[var(--muted-foreground)]">
            {[
              onDisk ? "" : t("connections.builtinEmbedding.notDownloadedSize", { size: formatBytes(data.totalBytes) }),
              t("connections.builtinEmotion.about", { license: MODEL_LICENSE }),
            ]
              .filter(Boolean)
              .join(" ")}
          </span>
        </FactRow>
        <FactRow label={t("connections.device.fact.memory")}>
          {t("connections.builtinEmbedding.memoryUpTo", { max: formatBytes(MODEL_MEMORY_BYTES) })}
          <span className="block text-[0.6875rem] text-[var(--muted-foreground)]">
            {t("connections.builtinEmotion.unloadsWhenIdle")}
          </span>
        </FactRow>
        <FactRow label={t("connections.device.fact.usedBy")}>{t("connections.builtinEmotion.usedBy")}</FactRow>
      </section>

      {downloading ? (
        <div className="flex flex-col gap-1.5">
          <div className="h-1.5 overflow-hidden rounded-full bg-[var(--secondary)]">
            <div
              role="progressbar"
              aria-label={t("avatars.director.model.progressLabel")}
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
              className="h-full rounded-full bg-[var(--primary)] transition-[width]"
              style={{ width: `${Math.max(percent, 4)}%` }}
            />
          </div>
          <span className="text-[0.6875rem] text-[var(--muted-foreground)]">
            {t("connections.builtinEmbedding.downloadingOf", {
              model: MODEL_LABEL,
              done: formatBytes(data.downloadedBytes),
              total: formatBytes(data.totalBytes),
            })}
          </span>
        </div>
      ) : !onDisk && !data.unsupported ? (
        <button
          type="button"
          onClick={() => void startDownload()}
          disabled={busy}
          className="mari-chrome-control mari-chrome-control--primary w-full"
        >
          <HardDriveDownload size="0.8125rem" />
          {t("connections.builtinEmbedding.downloadModel", { model: MODEL_LABEL, size: formatBytes(data.totalBytes) })}
        </button>
      ) : null}

      {!onDisk && !data.unsupported && (
        <p className="px-0.5 text-[0.6875rem] text-[var(--muted-foreground)]">{t("connections.builtinEmotion.note")}</p>
      )}

      {onDisk && (
        <button
          type="button"
          disabled={busy || data.state === "loading"}
          onClick={() => void removeFiles()}
          className={cn(SMALL_ACTION, "mari-device-remove self-start")}
        >
          <Trash2 size="0.75rem" />
          {t("connections.device.removeFiles")}
        </button>
      )}
    </div>
  );
}
