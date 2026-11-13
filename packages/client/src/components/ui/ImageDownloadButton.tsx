import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  downloadUrlToDevice,
  prepareImageSave,
  savePreparedImageToDevice,
  shouldUseIosImageShare,
  type PreparedImageSave,
} from "../../lib/file-download";

/** Prepare preview images before the tap so iOS sharing retains user activation. */
export function ImageDownloadButton({
  url,
  filename,
  className,
}: {
  url: string;
  filename: string;
  className?: string;
}) {
  const { t } = useTranslation();
  const useIosShare = shouldUseIosImageShare();
  const [preparedImage, setPreparedImage] = useState<PreparedImageSave | null>(null);
  const currentPreparedImage = preparedImage?.url === url && preparedImage.filename === filename ? preparedImage : null;

  useEffect(() => {
    if (!useIosShare) return;
    let active = true;
    void prepareImageSave(url, filename)
      .then((prepared) => {
        if (active) setPreparedImage(prepared);
      })
      .catch(() => {
        if (active) toast.error(t("ui.chat.chatgallery.downloadFailed"));
      });
    return () => {
      active = false;
    };
  }, [filename, url, t, useIosShare]);

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        const save = useIosShare
          ? currentPreparedImage
            ? savePreparedImageToDevice(currentPreparedImage)
            : Promise.resolve()
          : downloadUrlToDevice(url, filename);
        void save.catch(() => toast.error(t("ui.chat.chatgallery.downloadFailed")));
      }}
      disabled={useIosShare && !currentPreparedImage}
      aria-label={t("ui.chat.chatgallery.downloadImage")}
      className={
        className ?? "rounded-lg bg-black/60 p-2 text-white transition-colors hover:bg-black/80 disabled:opacity-50"
      }
    >
      <Download size="0.875rem" />
    </button>
  );
}
