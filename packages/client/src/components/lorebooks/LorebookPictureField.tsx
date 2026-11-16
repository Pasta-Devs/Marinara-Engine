// ──────────────────────────────────────────────
// UI overhaul: the lorebook's picture, set from Book settings (beside Enabled). Same control as the
// Preset page's Picture: a small thumbnail and text links. The editor owns the picture itself
// (upload, Generate with AI, crop, remove), so the classic Image section and this field stay in step.
// ──────────────────────────────────────────────
import { BookOpen, Crop, Sparkles, Upload } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { AvatarCrop } from "@marinara-engine/shared";
import { cn, getAvatarCropStyle } from "../../lib/utils";

export function LorebookPictureField({
  src,
  crop,
  busy,
  generationAvailable,
  cropOpen,
  onUpload,
  onGenerate,
  onToggleCrop,
}: {
  src: string | null;
  crop: AvatarCrop | null;
  busy: boolean;
  generationAvailable: boolean;
  cropOpen: boolean;
  onUpload: () => void;
  onGenerate: () => void;
  onToggleCrop: () => void;
}) {
  const { t } = useTranslation();
  const label = t(src ? "ui.panels.lorebookrow.replaceLorebookPicture" : "ui.panels.lorebookrow.uploadLorebookPicture");

  return (
    <div className="ov-bk__field">
      <span>{t("ui.presets.overviewtab.picture")}</span>
      <div className="ov-povw__pic ov-povw__pic--stack">
        <button
          type="button"
          className="mari-panel-gradient-surface mari-panel-gradient--lorebooks ov-povw__thumb ov-povw__thumb--crop"
          onClick={src ? onToggleCrop : onUpload}
          disabled={busy}
          title={src ? t("ui.noodle.noodlehome.adjustCrop") : label}
          aria-label={src ? t("ui.noodle.noodlehome.adjustCrop") : label}
        >
          {src ? <img src={src} alt="" draggable={false} style={getAvatarCropStyle(crop)} /> : <BookOpen size={14} />}
        </button>
        <span className="ov-povw__links">
          <button type="button" className="ov-ed__link" onClick={onUpload} disabled={busy} title={label}>
            <Upload size={12} aria-hidden="true" />
            <span>{src ? t("connections.accounts.editor.replace") : t("ui.characters.characterclipcard.upload")}</span>
          </button>
          {generationAvailable ? (
            <button type="button" className="ov-ed__link" onClick={onGenerate} disabled={busy}>
              <Sparkles size={12} aria-hidden="true" />
              <span>{t("editor.avatar.generate")}</span>
            </button>
          ) : null}
          {src ? (
            <button
              type="button"
              className={cn("ov-ed__link", cropOpen && "is-on")}
              onClick={onToggleCrop}
              aria-expanded={cropOpen}
              disabled={busy}
            >
              <Crop size={12} aria-hidden="true" />
              <span>{t("ui.noodle.noodlehome.adjustCrop")}</span>
            </button>
          ) : null}
        </span>
      </div>
    </div>
  );
}
