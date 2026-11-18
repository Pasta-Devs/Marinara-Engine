// ──────────────────────────────────────────────
// GalleryDescribeButton — in a gallery's select mode, has the Image reading
// model write descriptions for the selected pictures. Pictures that already
// have one are kept unless the user chooses to replace them.
// ──────────────────────────────────────────────
import { useState } from "react";
import { ScanText } from "lucide-react";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslation as useUiTranslation } from "react-i18next";
import { Spinner } from "./Spinner";
import { showChoiceDialog, showConfirmDialog } from "../../lib/app-dialogs";
import {
  describeGalleryImages,
  type DescribableGalleryImage,
  type GalleryDescriptionTarget,
} from "../../lib/gallery-descriptions";

export function GalleryDescribeButton({
  images,
  target,
  queryKey,
  ownerOf,
  className = "mari-editor-action inline-flex disabled:cursor-not-allowed disabled:opacity-60",
}: {
  images: DescribableGalleryImage[];
  target: GalleryDescriptionTarget;
  /** The picture's own owner, when the gallery shows pictures of more than one (Game mode's chat gallery). */
  ownerOf?: (image: DescribableGalleryImage) => string;
  className?: string;
  queryKey: QueryKey | QueryKey[];
}) {
  const { t: localizeUi } = useUiTranslation();
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const count = images.length;

  const run = async () => {
    if (progress || count === 0) return;
    const alreadyDescribed = images.filter((image) => image.description?.trim()).length;
    let overwrite = false;
    if (alreadyDescribed > 0) {
      const choice = await showChoiceDialog({
        title: localizeUi("ui.gallery.describe.title"),
        message: localizeUi("ui.gallery.describe.someDescribed", { count: alreadyDescribed }),
        choices: [
          ...(alreadyDescribed < count
            ? [
                {
                  key: "missing",
                  label: localizeUi("ui.gallery.describe.onlyMissing", { count: count - alreadyDescribed }),
                },
              ]
            : []),
          { key: "all", label: localizeUi("ui.gallery.describe.replaceAll", { count }) },
        ],
      });
      if (!choice) return;
      overwrite = choice === "all";
    } else if (
      !(await showConfirmDialog({
        title: localizeUi("ui.gallery.describe.title"),
        message: localizeUi("ui.gallery.describe.message", { count }),
        confirmLabel: localizeUi("ui.gallery.describe.confirm"),
      }))
    ) {
      return;
    }

    const chosen = overwrite ? images : images.filter((image) => !image.description?.trim());
    const byOwner = new Map<string, string[]>();
    for (const image of chosen) {
      const owner = ownerOf?.(image) ?? target.ownerId ?? "";
      byOwner.set(owner, [...(byOwner.get(owner) ?? []), image.id]);
    }
    const total = chosen.length;
    setProgress({ done: 0, total });
    try {
      const summary = { described: 0, failed: [] as Array<{ error?: string }> };
      let finished = 0;
      for (const [owner, ids] of byOwner) {
        const part = await describeGalleryImages({ ...target, ownerId: owner || target.ownerId }, ids, {
          overwrite,
          onProgress: (done) => setProgress({ done: finished + done, total }),
        });
        finished += ids.length;
        summary.described += part.described;
        summary.failed.push(...part.failed);
      }
      if (summary.failed.length === 0) {
        toast.success(localizeUi("ui.gallery.describe.done", { count: summary.described }));
      } else {
        toast.error(
          localizeUi("ui.gallery.describe.partial", {
            described: summary.described,
            failed: summary.failed.length,
            reason: summary.failed[0]?.error ?? "",
          }),
        );
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : localizeUi("ui.gallery.describe.failed"));
    } finally {
      const keys = (Array.isArray(queryKey[0]) ? queryKey : [queryKey]) as QueryKey[];
      await Promise.all(keys.map((key) => queryClient.invalidateQueries({ queryKey: key })));
      setProgress(null);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void run()}
      disabled={progress !== null || count === 0}
      className={className}
      title={localizeUi("ui.gallery.describe.hint")}
    >
      {progress ? <Spinner size="sm" /> : <ScanText size="0.875rem" />}
      {progress
        ? localizeUi("ui.gallery.describe.progress", { done: progress.done, total: progress.total })
        : localizeUi("ui.gallery.describe.button", { count })}
    </button>
  );
}
