import { useRef, useState, type ChangeEvent } from "react";
import { FolderOpen } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { showConfirmDialog } from "../../lib/app-dialogs";
import { isSpriteImageFile } from "../../lib/sprite-folder-import";

export function SpriteFolderImport({
  disabled,
  onImport,
}: {
  disabled: boolean;
  onImport: (files: File[]) => Promise<void>;
}) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [confirming, setConfirming] = useState(false);
  const busy = useRef(false);

  async function selectFolder(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = "";
    if (disabled || busy.current || !files.length) return;
    const count = files.filter(isSpriteImageFile).length;
    if (!count) {
      toast.warning(t("sprites.library.noImages"));
      return;
    }
    busy.current = true;
    setConfirming(true);
    try {
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
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("sprites.library.importFailed", { count }));
    } finally {
      busy.current = false;
      setConfirming(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="mari-editor-action min-h-[44px]! px-3 md:ml-auto md:min-h-9!"
        disabled={disabled || confirming}
        onClick={() => inputRef.current?.click()}
      >
        <FolderOpen size={14} />
        {t("sprites.library.importFolder")}
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        // @ts-expect-error — webkitdirectory is a non-standard but widely-supported attribute
        webkitdirectory=""
        className="hidden"
        onChange={selectFolder}
      />
    </>
  );
}
