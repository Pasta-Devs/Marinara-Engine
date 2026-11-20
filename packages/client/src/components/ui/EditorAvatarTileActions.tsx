import { Camera, Paintbrush, Wand2 } from "lucide-react";
import { useTranslation } from "react-i18next";

interface EditorAvatarTileActionsProps {
  generationAvailable: boolean;
  onGenerate: () => void;
  onEdit?: () => void;
  editing?: boolean;
}

export function EditorAvatarTileActions({
  generationAvailable,
  onGenerate,
  onEdit,
  editing,
}: EditorAvatarTileActionsProps) {
  const { t } = useTranslation();

  return (
    <>
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
        <Camera size="0.75rem" className="text-white" />
      </div>
      {onEdit && (
        <button
          type="button"
          disabled={editing}
          onClick={(event) => {
            event.stopPropagation();
            onEdit();
          }}
          className="absolute bottom-0 right-0 inline-flex min-h-6 min-w-6 items-center justify-center rounded-md bg-[var(--card)] text-[var(--primary)] ring-1 ring-[var(--border)] max-sm:min-h-8 max-sm:min-w-8"
          title={t("images.entity.editAvatar")}
          aria-label={t("images.entity.editAvatar")}
        >
          <Paintbrush size="0.75rem" />
        </button>
      )}
      {generationAvailable && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onGenerate();
          }}
          className="absolute right-0.5 top-0.5 inline-flex h-2 w-2 items-center justify-center rounded-full bg-[var(--card)]/95 text-[var(--primary)] shadow-md ring-1 ring-[var(--border)] transition-colors before:absolute before:-inset-2 hover:bg-[var(--accent)] max-md:right-px max-md:top-px"
          title={t("editor.avatar.generate.label")}
          aria-label={t("editor.avatar.generate.label")}
        >
          <Wand2 size="0.375rem" />
        </button>
      )}
    </>
  );
}
