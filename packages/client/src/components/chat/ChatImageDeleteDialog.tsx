import { Layers, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type { ChatImage } from "../../hooks/use-gallery";
import { useDeleteChatImageVersions } from "../../hooks/use-regenerate-chat-image";
import { useGalleryStore } from "../../stores/gallery.store";
import { Modal } from "../ui/Modal";
import { SHEET_BUTTON_SECONDARY, SHEET_CHOICE_GROUP_CLASS, SHEET_CHOICE_ROW_CLASS } from "../ui/neutral-surface-styles";

export function ChatImageDeleteDialog({
  image,
  count,
  index,
  onClose,
  onDeleted,
}: {
  image: ChatImage;
  count: number;
  index: number;
  onClose: () => void;
  onDeleted: (result: { deletedImageIds: string[]; selectedImageId: string | null }) => void;
}) {
  const { t } = useTranslation();
  const remove = useDeleteChatImageVersions();
  const deleteVersions = async (scope: "version" | "others" | "stack") => {
    if (remove.isPending) return;
    try {
      const result = await remove.mutateAsync({ image, scope });
      for (const id of result.deletedImageIds) useGalleryStore.getState().unpinImage(id);
      toast.success(t("chat.imageVersions.deleted", { count: result.deletedImageIds.length }));
      onDeleted(result);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("ui.chat.chatgallery.failedToDeleteImage"));
    }
  };
  return (
    <Modal
      open
      title={t("chat.imageVersions.deleteTitle")}
      onClose={onClose}
      closeDisabled={remove.isPending}
      pullToClose={false}
      closeButtonClassName="max-sm:hidden"
      width="max-w-sm"
      panelClassName="mari-chat-style-surface mari-chat-action-panel"
      chatFloatingPanel
    >
      <p className="mb-4 text-sm leading-relaxed text-[var(--marinara-chat-chrome-panel-muted)]">
        {t("chat.imageVersions.deleteDescription")}
      </p>
      <div className="flex flex-col gap-2">
        <div className={SHEET_CHOICE_GROUP_CLASS}>
          <button
            type="button"
            disabled={remove.isPending}
            onClick={() => void deleteVersions("version")}
            className={SHEET_CHOICE_ROW_CLASS}
          >
            <Layers size="0.8rem" />
            <span>{t("chat.imageVersions.deleteVersion", { current: index + 1, total: count })}</span>
          </button>
          {count > 1 && (
            <>
              <button
                type="button"
                disabled={remove.isPending}
                onClick={() => void deleteVersions("others")}
                className={SHEET_CHOICE_ROW_CLASS}
              >
                <Layers size="0.8rem" />
                <span>{t("chat.imageVersions.deleteOthers", { count: count - 1 })}</span>
              </button>
              <button
                type="button"
                disabled={remove.isPending}
                onClick={() => void deleteVersions("stack")}
                className={`${SHEET_CHOICE_ROW_CLASS} font-semibold text-[var(--destructive)]`}
              >
                <Trash2 size="0.8rem" />
                <span>{t("chat.imageVersions.deleteStack", { count })}</span>
              </button>
            </>
          )}
        </div>
        {remove.isPending && (
          <p role="status" className="text-sm">
            {t("chat.imageVersions.deleting")}
          </p>
        )}
        <button type="button" disabled={remove.isPending} className={SHEET_BUTTON_SECONDARY} onClick={onClose}>
          {t("chat.delete.dialog.cancel")}
        </button>
      </div>
    </Modal>
  );
}
