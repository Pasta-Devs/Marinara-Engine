// ──────────────────────────────────────────────
// GalleryCleanUpButton — in a gallery's select mode, runs the sticker / emoji
// clean-up passes on the selected stickers and emoji and swaps the pictures in
// place. Hidden when the selection has none. Beside it, "Undo clean up" puts
// back the pictures they had before they were first cleaned up.
// ──────────────────────────────────────────────
import { useState } from "react";
import { Sparkles, Undo2 } from "lucide-react";
import { Spinner } from "./Spinner";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslation as useUiTranslation } from "react-i18next";
import { showConfirmDialog } from "../../lib/app-dialogs";
import {
  cleanableGalleryImages,
  cleanUpGalleryImages,
  restorableGalleryImages,
  restoreGalleryImages,
  type CleanableGalleryImage,
} from "../../lib/gallery-clean-up";

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
  const [busy, setBusy] = useState<"clean" | "undo" | null>(null);
  const count = cleanableGalleryImages(images).length;
  const restorable = restorableGalleryImages(images).length;
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
    setBusy("clean");
    try {
      await cleanUpGalleryImages(images, { replacePath, localizeUi });
    } catch {
      toast.error(localizeUi("ui.gallery.batch.cleanUpFailed"));
    } finally {
      await queryClient.invalidateQueries({ queryKey });
      setBusy(null);
    }
  };

  const undo = async () => {
    if (busy) return;
    if (
      !(await showConfirmDialog({
        title: localizeUi("ui.gallery.batch.undoCleanUpTitle"),
        message: localizeUi("ui.gallery.batch.undoCleanUpMessage", { count: restorable }),
        confirmLabel: localizeUi("ui.gallery.batch.undoCleanUp"),
      }))
    ) {
      return;
    }
    setBusy("undo");
    try {
      await restoreGalleryImages(images, {
        restorePath: (imageId) => replacePath(imageId).replace(/\/replace$/, "/restore-original"),
        localizeUi,
      });
    } finally {
      await queryClient.invalidateQueries({ queryKey });
      setBusy(null);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => void run()}
        disabled={busy !== null}
        className="mari-editor-action inline-flex disabled:cursor-wait disabled:opacity-60"
        title={localizeUi("ui.gallery.batch.cleanUpHint")}
      >
        {busy === "clean" ? <Spinner size="sm" /> : <Sparkles size="0.875rem" />}
        {localizeUi(busy === "clean" ? "ui.gallery.batch.cleaningUp" : "ui.gallery.batch.cleanUpCount", { count })}
      </button>
      {restorable > 0 ? (
        <button
          type="button"
          onClick={() => void undo()}
          disabled={busy !== null}
          className="mari-editor-action inline-flex disabled:cursor-wait disabled:opacity-60"
          title={localizeUi("ui.gallery.batch.undoCleanUpHint")}
        >
          {busy === "undo" ? <Spinner size="sm" /> : <Undo2 size="0.875rem" />}
          {localizeUi(busy === "undo" ? "ui.gallery.batch.undoingCleanUp" : "ui.gallery.batch.undoCleanUpCount", {
            count: restorable,
          })}
        </button>
      ) : null}
    </>
  );
}
