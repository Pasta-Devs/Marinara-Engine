import { Trash2, User } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ChatImageLightbox } from "../chat/ChatImageLightbox";
import {
  useEntityImageRegenerator,
  type EntityEditableImage,
  type EntityImageOwner,
} from "../../hooks/use-entity-image-edit";
import { VIEWER_BUTTON_CLASS } from "./ImageViewer";

export function EntityImageLightbox<T extends EntityEditableImage>({
  owner,
  image,
  images,
  onClose,
  onUseImage,
  onDelete,
  busy = false,
  applyEditedOnly = false,
}: {
  owner: EntityImageOwner;
  image: T;
  images?: T[];
  onClose: () => void;
  onUseImage?: (image: T) => void;
  onDelete?: (image: T) => void;
  busy?: boolean;
  /** Avatar previews offer apply only after this session has produced a new image. */
  applyEditedOnly?: boolean;
}) {
  const { t } = useTranslation();
  const regenerator = useEntityImageRegenerator(owner, applyEditedOnly);
  const asChatImage = (item: T) => ({ ...item, chatId: "", generation: item.generation ?? null });
  return (
    <ChatImageLightbox
      image={asChatImage(image)}
      images={images?.map(asChatImage)}
      pinEnabled={false}
      regenerate={{}}
      regenerator={regenerator}
      interactionDisabled={busy}
      onClose={onClose}
      editActions={
        applyEditedOnly && onUseImage
          ? (active, editingBusy) =>
              active.id !== image.id ? (
                <button
                  type="button"
                  className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-[var(--border)] bg-[var(--secondary)] px-3 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--accent)] disabled:opacity-50 sm:w-auto"
                  disabled={busy || editingBusy}
                  onClick={() => onUseImage({ ...image, ...active })}
                >
                  <User size="1rem" aria-hidden />
                  {t("images.entity.useAvatar")}
                </button>
              ) : null
          : undefined
      }
      actions={(active) => (
        <>
          {onUseImage && !applyEditedOnly && (
            <button
              type="button"
              className={`${VIEWER_BUTTON_CLASS}${!onDelete ? " !w-auto gap-2 px-3" : ""}`}
              disabled={busy}
              aria-label={t("images.entity.useAvatar")}
              title={t("images.entity.useAvatar")}
              onClick={() => onUseImage({ ...image, ...active })}
            >
              <User size="0.875rem" />
              {!onDelete && t("images.entity.useAvatar")}
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              className={VIEWER_BUTTON_CLASS}
              disabled={busy}
              aria-label={t("lorebook.editor.batch.delete")}
              title={t("lorebook.editor.batch.delete")}
              onClick={() => onDelete({ ...image, ...active })}
            >
              <Trash2 size="0.875rem" />
            </button>
          )}
        </>
      )}
    />
  );
}
