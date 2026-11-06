// What the user sees before an Experience file (Capability API 1.373) is imported: read from the start of
// the file alone, in the browser, so nothing of it has reached Marinara yet. It shows how big the import
// is and what it is made of, says it carries no code, and waits for Import or Don't Import.
import { useState, type ReactNode } from "react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { ShieldCheck } from "lucide-react";
import type { ExperienceFileSummary, ExperienceFileType } from "@marinara-engine/shared";
import { formatExperienceBytes } from "../../lib/experience-file-review";
import { Modal } from "../ui/Modal";

const TYPES: Array<{ type: ExperienceFileType; label: string; bar: string }> = [
  { type: "image", label: "game.experienceFile.typeImages", bar: "bg-[var(--primary)]" },
  { type: "audio", label: "game.experienceFile.typeMusic", bar: "bg-amber-500" },
  { type: "data", label: "game.experienceFile.typeData", bar: "bg-[var(--muted-foreground)]" },
];

function ReviewRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
      <span className="shrink-0 text-xs font-medium text-[var(--foreground)] sm:w-36">{label}</span>
      <span className="min-w-0 text-xs text-[var(--muted-foreground)]">{children}</span>
    </div>
  );
}

/** A share as a whole percent, never showing 0% for something that is there. */
function percent(part: number, whole: number): number {
  if (!whole || !part) return 0;
  return Math.max(1, Math.round((part / whole) * 100));
}

export function ExperienceFileImportModal({
  review,
  installedVersion,
  importing,
  failure,
  onCancel,
  onConfirm,
}: {
  /** The file under review, or null when nothing is waiting. */
  review: { summary: ExperienceFileSummary; fileBytes: number; fileName: string } | null;
  /** The version of this Experience already installed, if any. */
  installedVersion: string | null;
  importing: boolean;
  /** Why the last attempt failed, shown here because the wizard sits behind the dialog. */
  failure: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t } = useUiTranslation();
  // The dialog closes by `review` going null; its exit animation still shows the last file.
  const [shown, setShown] = useState(review);
  if (review && shown !== review) setShown(review);
  const open = review !== null;
  const current = shown;
  const summary = current?.summary;
  const total = summary?.contentBytes ?? 0;
  return (
    <Modal
      open={open}
      onClose={() => {
        if (!importing) onCancel();
      }}
      title={t("game.experienceFile.title")}
      width="max-w-xl"
      mobileFullscreen
      topLayer
      closeDisabled={importing}
    >
      {current && summary && (
        <div className="space-y-4" data-component="ExperienceFileImportModal">
          <div className="flex gap-3 rounded-xl border border-[var(--border)] bg-[var(--secondary)]/45 p-3 text-sm leading-6">
            <ShieldCheck className="mt-0.5 shrink-0 text-[var(--primary)]" size="1rem" />
            <p className="text-[var(--muted-foreground)]">{t("game.experienceFile.noCode")}</p>
          </div>

          <section className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--background)]/45 p-3">
            <h3 className="text-sm font-semibold">{summary.name}</h3>
            {summary.description && (
              <p className="line-clamp-4 text-xs leading-relaxed text-[var(--muted-foreground)]">
                {summary.description}
              </p>
            )}
            <ReviewRow label={t("game.experienceFile.versionLabel")}>{summary.version}</ReviewRow>
            <ReviewRow label={t("game.experienceFile.fileLabel")}>{current.fileName}</ReviewRow>
            <ReviewRow label={t("game.experienceFile.sizeLabel")}>
              <span className="block font-medium text-[var(--foreground)]" data-testid="experience-import-size">
                {formatExperienceBytes(current.fileBytes)}
              </span>
              <span className="block">
                {t("game.experienceFile.sizeHint", {
                  content: formatExperienceBytes(total),
                  count: summary.files,
                })}
              </span>
            </ReviewRow>
            <ReviewRow label={t("game.experienceFile.holdsLabel")}>
              {t("game.experienceFile.holds", {
                worlds: summary.worlds,
                creatures: summary.creaturePacks,
                tracks: summary.musicTracks,
              })}
            </ReviewRow>
          </section>

          <section className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--background)]/45 p-3">
            <h4 className="text-xs font-semibold">{t("game.experienceFile.contentsLabel")}</h4>
            <div
              className="flex h-2.5 w-full overflow-hidden rounded-full bg-[var(--secondary)]"
              role="img"
              aria-label={TYPES.map(
                ({ type, label }) => `${t(label)} ${percent(summary.byType[type].bytes, total)}%`,
              ).join(", ")}
            >
              {TYPES.map(({ type, bar }) =>
                summary.byType[type].bytes ? (
                  <div key={type} className={bar} style={{ width: `${(summary.byType[type].bytes / total) * 100}%` }} />
                ) : null,
              )}
            </div>
            <ul className="space-y-1">
              {TYPES.map(({ type, label, bar }) => (
                <li
                  key={type}
                  className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]"
                  data-testid={`experience-import-${type}`}
                >
                  <span className={`h-2 w-2 shrink-0 rounded-full ${bar}`} />
                  <span className="min-w-0 flex-1 text-[var(--foreground)]">{t(label)}</span>
                  <span className="tabular-nums">
                    {t("game.experienceFile.typeShare", {
                      percent: percent(summary.byType[type].bytes, total),
                      size: formatExperienceBytes(summary.byType[type].bytes),
                      count: summary.byType[type].files,
                    })}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {installedVersion && (
            <div role="status" className="rounded-lg bg-[var(--primary)]/10 px-3 py-2 text-xs text-[var(--primary)]">
              {installedVersion === summary.version
                ? t("game.experienceFile.sameVersion", { version: installedVersion })
                : t("game.experienceFile.replacesVersion", { installed: installedVersion, version: summary.version })}
            </div>
          )}

          {failure && (
            <div role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-500">
              {failure}
            </div>
          )}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              disabled={importing}
              onClick={onCancel}
              className="mari-chrome-control h-10 px-4 text-sm"
            >
              {t("game.experienceFile.dontImport")}
            </button>
            <button
              type="button"
              disabled={importing}
              onClick={onConfirm}
              className="mari-chrome-control mari-chrome-control--primary h-10 px-4 text-sm"
            >
              {importing ? t("game.experienceFile.importing") : t("game.experienceFile.import")}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
