import { useMemo, useState } from "react";
import { CheckCircle2, CircleAlert, Clock3, Download, FileJson, Loader2, Square, XCircle } from "lucide-react";
import { Modal } from "../ui/Modal";
import { cn } from "../../lib/utils";
import {
  useCancelGenerationJob,
  useGenerationJobResult,
  useGenerationJobs,
  useGenerationJobsEnabled,
  useTrackedGenerationJobs,
  type GenerationJobMetadata,
  type GenerationJobStatus,
} from "../../hooks/use-generation-jobs";
import { useTranslation } from "react-i18next";
import { TrackedJobDetails } from "../generation-jobs/TrackedJobDetails";

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function statusLabel(status: GenerationJobStatus, t: (key: string) => string): string {
  return t(`generationJobs.status.${status}`);
}

function readableKind(kind: string): string {
  return (
    kind
      .replace(/[_-]+/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase())
      .trim() || "Generation"
  );
}

function statusIcon(status: GenerationJobStatus) {
  if (status === "running") return <Loader2 size="0.9rem" className="animate-spin" aria-hidden="true" />;
  if (status === "completed") return <CheckCircle2 size="0.9rem" aria-hidden="true" />;
  if (status === "failed") return <CircleAlert size="0.9rem" aria-hidden="true" />;
  return <XCircle size="0.9rem" aria-hidden="true" />;
}

type MediaPreview = { src: string; kind: "image" | "audio" | "video" };

function mediaKind(source: string, key: string): MediaPreview["kind"] | null {
  const dataMatch = source.match(/^data:(image|audio|video)\//i);
  if (dataMatch) return dataMatch[1].toLowerCase() as MediaPreview["kind"];
  if (/audio|sound|music/i.test(key) || /\.(mp3|wav|ogg|m4a|aac)(?:$|[?#])/i.test(source)) return "audio";
  if (/video|animated|motion/i.test(key) || /\.(mp4|webm|mov|m4v)(?:$|[?#])/i.test(source)) return "video";
  if (/\.(png|jpe?g|gif|webp|avif)(?:$|[?#])/i.test(source) || /image|avatar|sprite|sheet/i.test(key)) return "image";
  return null;
}

function isSafeMediaSource(value: unknown, key = ""): boolean {
  if (typeof value !== "string" || !value) return false;
  if (/^data:(image|audio|video)\/(png|jpe?g|gif|webp|avif|mpeg|wav|ogg|mp4|webm|quicktime);base64,/i.test(value))
    return true;
  return (
    (value.startsWith("/api/") || value.startsWith("/uploads/") || value.startsWith("/assets/")) &&
    mediaKind(value, key) !== null
  );
}

function extractPreviewSources(value: unknown): MediaPreview[] {
  const sources: MediaPreview[] = [];
  const visit = (node: unknown, key = "") => {
    if (typeof node === "string") {
      if (isSafeMediaSource(node, key)) sources.push({ src: node, kind: mediaKind(node, key) ?? "image" });
      else if (/base64$/i.test(key) && node.length > 16)
        sources.push({ src: `data:image/png;base64,${node}`, kind: "image" });
      return;
    }
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      node.forEach((item) => visit(item, key));
      return;
    }
    Object.entries(node as Record<string, unknown>).forEach(([childKey, child]) => visit(child, childKey));
  };
  visit(value);
  return sources
    .filter((source, index, all) => all.findIndex((candidate) => candidate.src === source.src) === index)
    .slice(0, 12);
}

function downloadJson(id: string, value: unknown) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `generation-job-${id}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function downloadMedia(source: string, id: string, index: number) {
  const anchor = document.createElement("a");
  anchor.href = source;
  anchor.download = `generation-job-${id}-${index + 1}`;
  anchor.target = "_blank";
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

function extractReadableText(value: unknown): string | null {
  if (typeof value === "string" && value.trim() && !isSafeMediaSource(value)) return value.trim();
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  for (const key of ["text", "content", "raw", "message", "description"]) {
    if (typeof record[key] === "string" && record[key].trim()) return record[key].trim();
  }
  return null;
}

function JobResult({ job }: { job: GenerationJobMetadata }) {
  const { t } = useTranslation();
  const result = useGenerationJobResult(job.id, job.resultAvailable);
  const sources = useMemo(() => extractPreviewSources(result.data), [result.data]);
  const readableText = useMemo(() => extractReadableText(result.data), [result.data]);

  if (result.isLoading)
    return <p className="text-xs text-[var(--muted-foreground)]">{t("generationJobs.loadingResult")}</p>;
  if (result.isError) return <p className="text-xs text-[var(--destructive)]">{t("generationJobs.resultError")}</p>;
  if (result.data === undefined) return null;

  return (
    <div className="mt-3 space-y-3 border-t border-[var(--border)]/60 pt-3">
      {sources.length > 0 ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {sources.map((source, index) => (
            <figure
              key={`${source.src}-${index}`}
              className="group relative overflow-hidden rounded-lg border border-[var(--border)]/70 bg-[var(--background)]"
            >
              {source.kind === "image" ? (
                <img
                  src={source.src}
                  alt={t("generationJobs.previewAlt", { value1: job.label, value2: index + 1 })}
                  className="aspect-square w-full object-contain"
                />
              ) : null}
              {source.kind === "audio" ? (
                <audio src={source.src} controls className="w-full p-2" aria-label={t("generationJobs.audioPreview")} />
              ) : null}
              {source.kind === "video" ? (
                <video
                  src={source.src}
                  controls
                  className="aspect-square w-full object-contain"
                  aria-label={t("generationJobs.videoPreview")}
                />
              ) : null}
              <button
                type="button"
                onClick={() => downloadMedia(source.src, job.id, index)}
                className="absolute bottom-1 right-1 rounded-md bg-[var(--card)]/90 p-1.5 text-[var(--foreground)] shadow-sm hover:bg-[var(--accent)]"
                aria-label={t("generationJobs.downloadPreview")}
              >
                <Download size="0.75rem" />
              </button>
            </figure>
          ))}
        </div>
      ) : null}
      {readableText ? (
        <p className="whitespace-pre-wrap break-words rounded-lg border border-[var(--border)]/60 bg-[var(--background)]/60 p-3 text-sm text-[var(--foreground)]">
          {readableText}
        </p>
      ) : null}
      <div className="flex items-start gap-2 rounded-lg border border-[var(--border)]/60 bg-[var(--background)]/60 p-3">
        <FileJson size="0.9rem" className="mt-0.5 shrink-0 text-[var(--muted-foreground)]" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-xs text-[var(--foreground)]">{t("generationJobs.completedOutputReady")}</p>
          <button
            type="button"
            onClick={() => downloadJson(job.id, result.data)}
            className="mt-2 text-xs font-semibold text-[var(--primary)] underline-offset-2 hover:underline"
          >
            {t("generationJobs.downloadResultJson")}
          </button>
        </div>
      </div>
    </div>
  );
}

export function GenerationJobsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  // Every job route answers 404 while the switch is off, so nothing is requested then.
  const trackingEnabled = useGenerationJobsEnabled();
  const jobs = useGenerationJobs(trackingEnabled && open);
  const cancel = useCancelGenerationJob();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const tracked = useTrackedGenerationJobs(trackingEnabled && open);
  const trackedById = useMemo(() => new Map((tracked.data ?? []).map((record) => [record.id, record])), [tracked.data]);

  return (
    <Modal open={open} onClose={onClose} title={t("generationJobs.title")} width="max-w-2xl" mobileFullscreen>
      <div className="space-y-3">
        <p className="text-xs text-[var(--muted-foreground)]">{t("generationJobs.description")}</p>
        {cancelError ? (
          <p
            role="alert"
            className="rounded-lg border border-[var(--destructive)]/40 bg-[var(--destructive)]/10 p-2 text-xs text-[var(--destructive)]"
          >
            {cancelError}
          </p>
        ) : null}
        {!trackingEnabled ? (
          <p className="rounded-lg border border-[var(--border)]/60 bg-[var(--background)]/60 p-3 text-sm text-[var(--muted-foreground)]">
            {t("generationJobs.switchOff")}
          </p>
        ) : jobs.isLoading ? (
          <div className="flex items-center gap-2 py-8 text-sm text-[var(--muted-foreground)]">
            <Loader2 size="1rem" className="animate-spin" />
            {t("generationJobs.loading")}
          </div>
        ) : jobs.isError ? (
          <div className="rounded-lg border border-[var(--destructive)]/40 bg-[var(--destructive)]/10 p-3 text-sm text-[var(--foreground)]">
            {t("generationJobs.loadError")}
          </div>
        ) : (jobs.data ?? []).length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center text-[var(--muted-foreground)]">
            <Clock3 size="1.5rem" aria-hidden="true" />
            <p className="text-sm">{t("generationJobs.empty")}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {(jobs.data ?? []).map((job) => {
              const selected = selectedId === job.id;
              return (
                <div
                  key={job.id}
                  className={cn(
                    "rounded-xl border p-3",
                    selected
                      ? "border-[var(--primary)]/50 bg-[var(--accent)]/40"
                      : "border-[var(--border)]/70 bg-[var(--card)]/40",
                  )}
                >
                  <div className="flex w-full min-w-0 items-start gap-3 text-start">
                    <button
                      type="button"
                      onClick={() => setSelectedId(selected ? null : job.id)}
                      className="flex min-w-0 flex-1 items-start gap-3 text-start"
                    >
                      <span className="mt-0.5 shrink-0 text-[var(--muted-foreground)]">{statusIcon(job.status)}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-[var(--foreground)]">
                          {job.label || readableKind(job.kind)}
                        </span>
                        <span className="mt-1 block text-xs text-[var(--muted-foreground)]">
                          {statusLabel(job.status, t)} · {formatDate(job.updatedAt || job.createdAt)}
                        </span>
                        {job.error ? (
                          <span className="mt-1 block break-words text-xs text-[var(--destructive)]">{job.error}</span>
                        ) : null}
                      </span>
                    </button>
                    {job.status === "running" ? (
                      <button
                        type="button"
                        onClick={() => {
                          setCancelError(null);
                          cancel.mutate(job.id, {
                            onError: (error) =>
                              setCancelError(error instanceof Error ? error.message : t("generationJobs.cancelError")),
                          });
                        }}
                        disabled={cancel.isPending}
                        className="inline-flex shrink-0 items-center gap-1 rounded-md border border-[var(--border)] px-2 py-1 text-xs font-semibold text-[var(--foreground)] hover:bg-[var(--accent)] disabled:cursor-wait disabled:opacity-60"
                        aria-label={t("generationJobs.stopGeneration")}
                      >
                        <Square size="0.65rem" />
                        {t("generationJobs.stop")}
                      </button>
                    ) : null}
                  </div>
                  {trackedById.has(job.id) ? (
                    <div className="ps-7">
                      <TrackedJobDetails record={trackedById.get(job.id)!} expanded={selected} />
                    </div>
                  ) : null}
                  {selected && job.status === "completed" && job.resultAvailable ? <JobResult job={job} /> : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
}
