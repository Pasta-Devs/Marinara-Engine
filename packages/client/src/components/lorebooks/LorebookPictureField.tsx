// ──────────────────────────────────────────────
// UI overhaul: the lorebook's picture, set from Book settings. Lorebooks always had one (shown in
// the Library list and gallery) but the new layout had no way to set it.
// ──────────────────────────────────────────────
import { useRef } from "react";
import { Camera } from "lucide-react";
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
    <div className="ov-bk__pic">
      <button
        type="button"
        className="ov-bk__pic-thumb"
        aria-label={label}
        disabled={upload.isPending}
        onClick={() => inputRef.current?.click()}
      >
        {src ? <img src={src} alt="" /> : <Camera size={18} aria-hidden="true" />}
      </button>
      <div className="ov-bk__pic-text">
        <span>{localize("Picture")}</span>
        <button type="button" className="ov-bk__pic-btn" onClick={() => inputRef.current?.click()}>
          {upload.isPending ? localize("Uploading…") : label}
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(event) => {
          pick(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
    </div>
  );
}
