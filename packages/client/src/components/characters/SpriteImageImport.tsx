import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { showConfirmDialog } from "../../lib/app-dialogs";
import { isSpriteImageFile } from "../../lib/sprite-folder-import";
import { ImageUploadDropzone } from "../ui/ImageUploadDropzone";

export function SpriteImageImport({
  disabled,
  pending,
  onImport,
}: {
  disabled: boolean;
  pending: boolean;
  onImport: (files: File[]) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [confirming, setConfirming] = useState(false);
  const busy = useRef(false);

  async function selectImages(files: File[]) {
    if (disabled || busy.current || !files.length) return;
    files = files.filter(isSpriteImageFile);
    const count = files.length;
    if (!count) {
      toast.warning(t("sprites.library.noImages"));
      return;
    }
    busy.current = true;
    setConfirming(true);
    try {
      if (
        await showConfirmDialog({
          title: t("sprites.library.importImages"),
          message: t("sprites.library.confirmImageImport", { count }),
          confirmLabel: t("sprites.library.import"),
          cancelLabel: t("sprites.library.cancel"),
          tone: "accent",
        })
      )
        await onImport(files);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("sprites.library.importFailed", { count }));
    } finally {
      busy.current = false;
      setConfirming(false);
    }
  }

  return (
    <ImageUploadDropzone
      multiple
      className="col-span-2 min-h-11 py-2 md:min-h-9"
      disabled={disabled || confirming}
      label={t("sprites.library.uploadImages")}
      pending={pending}
      pendingLabel={t("ui.ui.imageuploaddropzone.uploadingImages")}
      dragLabel={t("sprites.library.dropImages")}
      onFilesSelected={(files) => void selectImages(files)}
      icon={<Upload size={16} />}
    />
  );
}
