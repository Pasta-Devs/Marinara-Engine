import { Download, Wand2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Spinner } from "./Spinner";

interface AvatarReplaceActionsProps {
  hasAvatar: boolean;
  uploading: boolean;
  generationAvailable: boolean;
  onUpload: () => void;
  onGenerate: () => void;
  /** "cover" words the buttons for a lorebook picture instead of an avatar. */
  kind?: "avatar" | "cover";
}

export function AvatarReplaceActions({
  hasAvatar,
  uploading,
  generationAvailable,
  onUpload,
  onGenerate,
  kind = "avatar",
}: AvatarReplaceActionsProps) {
  const { t } = useTranslation();
  const isCover = kind === "cover";

  return (
    <section className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--secondary)]/70 p-3">
      <div>
        <h3 className="text-xs font-semibold text-[var(--foreground)]">
          {hasAvatar
            ? isCover
              ? t("editor.cover.replace.title")
              : t("editor.avatar.replace.title")
            : isCover
              ? t("editor.cover.add.title")
              : t("editor.avatar.add.title")}
        </h3>
        <p className="mt-0.5 text-[0.6875rem] leading-5 text-[var(--muted-foreground)]">
          {t("editor.avatar.actions.help")}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2 max-[360px]:grid-cols-1">
        <button
          type="button"
          onClick={onUpload}
          disabled={uploading}
          aria-busy={uploading}
          className="mari-chrome-control mari-chrome-control--small flex min-h-10 items-center justify-center gap-1.5 text-xs disabled:cursor-wait disabled:opacity-60"
        >
          {uploading ? <Spinner size="sm" /> : <Download size="0.875rem" />}
          <span>
            {uploading
              ? isCover
                ? t("editor.cover.uploading")
                : t("editor.avatar.uploading")
              : isCover
                ? t("editor.cover.upload")
                : t("editor.avatar.upload")}
          </span>
        </button>
        <button
          type="button"
          onClick={onGenerate}
          disabled={!generationAvailable || uploading}
          title={
            !generationAvailable
              ? isCover
                ? t("editor.cover.generate.unavailable")
                : t("editor.avatar.generate.unavailable")
              : undefined
          }
          className="mari-chrome-control mari-chrome-control--small flex min-h-10 items-center justify-center gap-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-45"
        >
          <Wand2 size="0.875rem" />
          <span>{t("editor.avatar.generate")}</span>
        </button>
      </div>
    </section>
  );
}
