import { useRef, useState, type DragEvent } from "react";
import { FolderOpen } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { showConfirmDialog } from "../../lib/app-dialogs";
import { isSpriteImageFile, readDroppedSpriteFiles } from "../../lib/sprite-folder-import";
import { ImageUploadDropzone } from "../ui/ImageUploadDropzone";
import { Modal } from "../ui/Modal";

export function SpriteFolderImport({
  disabled,
  onImport,
}: {
  disabled: boolean;
  onImport: (files: File[]) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [reading, setReading] = useState(false);
  const busy = useRef(false);

  async function importFiles(readFiles: () => Promise<File[]>) {
    if (disabled || busy.current) return;
    busy.current = true;
    setReading(true);
    try {
      const files = await readFiles();
      const count = files.filter(isSpriteImageFile).length;
      if (!count) {
        toast.warning(t("sprites.library.noImages"));
        return;
      }
      setOpen(false);
      if (
        await showConfirmDialog({
          title: t("sprites.library.importFolder"),
          message: t("sprites.library.confirmFolderImport", { count }),
          confirmLabel: t("sprites.library.import"),
          cancelLabel: t("sprites.library.cancel"),
          tone: "accent",
        })
      )
        await onImport(files);
    } catch {
      toast.error(t("sprites.library.folderReadFailed"));
    } finally {
      busy.current = false;
      setReading(false);
    }
  }

  function drop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    event.stopPropagation();
    const entries = Array.from(event.dataTransfer.items)
      .map((item) => item.webkitGetAsEntry())
      .filter((entry): entry is FileSystemEntry => entry !== null);
    const files = Array.from(event.dataTransfer.files);
    void importFiles(() => (entries.length ? readDroppedSpriteFiles(entries) : Promise.resolve(files)));
  }

  return (
    <>
      <button
        type="button"
        className="mari-editor-action min-h-[44px]! px-3 md:ml-auto md:min-h-9!"
        disabled={disabled || reading}
        onClick={() => setOpen(true)}
      >
        <FolderOpen size={14} />
        {t("sprites.library.importFolder")}
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        closeDisabled={reading}
        title={t("sprites.library.importFolder")}
      >
        <div
          className="space-y-4"
          onDropCapture={drop}
          onDragOverCapture={(event) => {
            event.preventDefault();
            event.stopPropagation();
            event.dataTransfer.dropEffect = reading ? "none" : "copy";
          }}
        >
          <p className="rounded-xl border-2 border-dashed border-[var(--border)] px-4 py-8 text-center text-sm text-[var(--muted-foreground)]">
            {t(reading ? "sprites.library.readingFolder" : "sprites.library.dropFolder")}
          </p>
          <ImageUploadDropzone
            label={t("sprites.library.uploadImages")}
            disabled={reading}
            onFilesSelected={(files) => void importFiles(() => Promise.resolve(files))}
          />
        </div>
      </Modal>
    </>
  );
}
