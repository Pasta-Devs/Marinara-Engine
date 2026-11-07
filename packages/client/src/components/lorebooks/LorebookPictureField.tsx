// ──────────────────────────────────────────────
// UI overhaul: the lorebook's picture, set from Book settings (beside Enabled). Lorebooks always had
// one (shown in the Library list and gallery) but the new layout had no way to set it. Same control
// as the Preset page's Picture: a small thumbnail and an Upload / Replace link.
// ──────────────────────────────────────────────
import { useRef } from "react";
import { BookOpen, Upload } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { useUploadLorebookImage } from "../../hooks/use-lorebooks";
import { useLocalizedUiText } from "../../localization/use-localized-ui-text";

export function LorebookPictureField({ id, src }: { id: string; src: string | null }) {
  const { t } = useTranslation();
  const localize = useLocalizedUiText();
  const upload = useUploadLorebookImage();
  const inputRef = useRef<HTMLInputElement>(null);
  const label = t(src ? "ui.panels.lorebookrow.replaceLorebookPicture" : "ui.panels.lorebookrow.uploadLorebookPicture");

  const choose = () => {
    if (!inputRef.current) return;
    inputRef.current.value = "";
    inputRef.current.click();
  };
  const pick = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error(localize("Pick an image file."));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const image = typeof reader.result === "string" ? reader.result : "";
      if (!image) return;
      upload.mutate(
        { id, image },
        { onError: (error) => toast.error(error instanceof Error ? error.message : String(error)) },
      );
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="ov-bk__field">
      <span>{t("ui.presets.overviewtab.picture")}</span>
      <div className="ov-povw__pic">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => pick(event.target.files?.[0])}
        />
        <button
          type="button"
          className="mari-panel-gradient-surface mari-panel-gradient--lorebooks ov-povw__thumb"
          onClick={choose}
          disabled={upload.isPending}
          title={label}
          aria-label={label}
        >
          {src ? <img src={src} alt="" draggable={false} /> : <BookOpen size={14} />}
        </button>
        <button type="button" className="ov-ed__link" onClick={choose} disabled={upload.isPending}>
          <Upload size={12} aria-hidden="true" />
          {src ? t("connections.accounts.editor.replace") : t("ui.characters.characterclipcard.upload")}
        </button>
      </div>
    </div>
  );
}
