import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Check, ChevronDown, Download, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "../../../lib/utils";
import { GEMMA_RESTART_MESSAGE, useSidecarStore } from "../../../stores/sidecar.store";
import { SmoothFolderContent } from "../../ui/SmoothFolderContent";
import { ModelDownloadModal } from "../ModelDownloadModal";

const gb = (bytes: number) => (bytes / 1024 ** 3).toFixed(1);

/** Add step 2 for the built-in model: one download button, the rest under Advanced. */
export function BuiltInModelSetup() {
  const { t } = useTranslation();
  const curated = useSidecarStore((s) => s.curatedModels);
  const modelDownloaded = useSidecarStore((s) => s.modelDownloaded);
  const inferenceReady = useSidecarStore((s) => s.inferenceReady);
  const status = useSidecarStore((s) => s.status);
  const progress = useSidecarStore((s) => s.downloadProgress);
  const runtimeInstalled = useSidecarStore((s) => s.runtime.installed);
  const [advanced, setAdvanced] = useState(false);

  // The preset the old dialog marks "Recommended".
  const recommended = curated.find((model) => model.quantization === "q8_0") ?? curated[0];
  const busy = status === "downloading_runtime" || status === "downloading_model" || status === "starting_server";
  const percent = progress && progress.total > 0 ? Math.round((progress.downloaded / progress.total) * 100) : 0;

  const download = async () => {
    const store = useSidecarStore.getState();
    store.markPrompted();
    if (!runtimeInstalled) await store.installRuntime();
    if (!useSidecarStore.getState().runtime.installed || !recommended) return;
    if (await store.startDownload(recommended.quantization)) toast.success(GEMMA_RESTART_MESSAGE);
  };

  return (
    <div className="mt-3 flex flex-col gap-3" data-add-connection-builtin>
      {recommended && (
        <p className="text-xs leading-relaxed text-[var(--muted-foreground)]">
          {t("connections.builtin.size", { size: gb(recommended.sizeBytes), ram: gb(recommended.ramBytes) })}
        </p>
      )}
      <p className="flex items-center gap-1.5 text-xs text-[var(--warning)]">
        <AlertTriangle size="0.875rem" className="shrink-0" aria-hidden />
        {t("connections.builtin.warning")}
      </p>
      {modelDownloaded && inferenceReady && !busy ? (
        <p className="flex items-center gap-2 text-sm font-medium text-emerald-500">
          <Check size="1rem" aria-hidden />
          {t("connections.builtin.ready")}
        </p>
      ) : busy ? (
        <div className="flex flex-col gap-2" role="status">
          <div className="flex items-center justify-between gap-3 text-xs text-[var(--muted-foreground)]">
            <span className="flex items-center gap-2">
              <Loader2 size="0.875rem" className="animate-spin" aria-hidden />
              {status === "starting_server"
                ? t("connections.builtin.starting")
                : progress?.phase === "runtime"
                  ? t("connections.builtin.settingUp")
                  : t("connections.builtin.downloading", { percent })}
            </span>
            <button
              type="button"
              onClick={() => void useSidecarStore.getState().cancelDownload()}
              className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-[var(--foreground)]"
            >
              <X size="0.75rem" aria-hidden />
              {t("connections.builtin.cancel")}
            </button>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--border)]">
            <div
              className="mari-chrome-accent-progress h-full rounded-full bg-[var(--marinara-app-accent-static)] transition-all duration-300"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={() => void download()}
            disabled={!recommended}
            className="mari-chrome-accent-surface flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            <Download size="0.875rem" aria-hidden />
            {t("connections.builtin.download")}
          </button>
          {progress?.status === "error" && (
            <p className="text-xs text-[var(--destructive)]">{progress.error || t("connections.builtin.failed")}</p>
          )}
        </>
      )}
      <button
        type="button"
        onClick={() => setAdvanced((open) => !open)}
        aria-expanded={advanced}
        className="flex min-h-11 items-center gap-1.5 self-start rounded-lg text-xs font-medium text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)] md:min-h-9"
      >
        <ChevronDown
          size="0.75rem"
          aria-hidden
          className={cn("transition-transform motion-reduce:transition-none", advanced && "rotate-180")}
        />
        {t("connections.builtin.advanced")}
      </button>
      <SmoothFolderContent open={advanced}>
        {advanced && <ModelDownloadModal embedded open onClose={() => setAdvanced(false)} />}
      </SmoothFolderContent>
    </div>
  );
}
