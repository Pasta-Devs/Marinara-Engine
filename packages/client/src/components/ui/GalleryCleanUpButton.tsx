// ──────────────────────────────────────────────
// GalleryCleanUpButton — in a gallery's select mode, runs the sticker / emoji
// clean-up passes on the selected stickers and emoji and swaps the pictures in
// place. Hidden when the selection has none.
// ──────────────────────────────────────────────
import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Spinner } from "./Spinner";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslation as useUiTranslation } from "react-i18next";
import { showConfirmDialog } from "../../lib/app-dialogs";
import { cleanableGalleryImages, cleanUpGalleryImages, type CleanableGalleryImage } from "../../lib/gallery-clean-up";

export function GalleryCleanUpButton({
  images,
  replacePath,
  queryKey,
}: {
  images: CleanableGalleryImage[];
  replacePath: (imageId: string) => string;
  queryKey: QueryKey;
}) {
  const { t: localizeUi } = useUiTranslation();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const count = cleanableGalleryImages(images).length;
  if (count === 0) return null;

  const run = async () => {
    if (busy) return;
    if (
      !(await showConfirmDialog({
        title: localizeUi("ui.gallery.batch.cleanUpTitle"),
        message: localizeUi("ui.gallery.batch.cleanUpMessage", { count }),
        confirmLabel: localizeUi("ui.gallery.batch.cleanUp"),
      }))
    ) {
      return;
    }
    setBusy(true);
    try {
      await cleanUpGalleryImages(images, { replacePath, localizeUi });
    } catch {
      toast.error(localizeUi("ui.gallery.batch.cleanUpFailed"));
    } finally {
      await queryClient.invalidateQueries({ queryKey });
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void run()}
      disabled={busy}
      className="mari-editor-action inline-flex disabled:cursor-wait disabled:opacity-60"
      title={localizeUi("ui.gallery.batch.cleanUpHint")}
    >
      {busy ? <Spinner size="sm" /> : <Sparkles size="0.875rem" />}
      {localizeUi(busy ? "ui.gallery.batch.cleaningUp" : "ui.gallery.batch.cleanUpCount", { count })}
    </button>
  );
}
