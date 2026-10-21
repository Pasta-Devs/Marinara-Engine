import { Loader2, Wand2 } from "lucide-react";
import { useTranslation } from "react-i18next";

export function CardFieldWand({
  label,
  onGenerate,
  disabled,
  loading,
}: {
  label: string;
  onGenerate: () => void;
  disabled: boolean;
  loading: boolean;
}) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onGenerate}
      disabled={disabled}
      aria-label={t("ui.cardFields.generate", { field: label })}
      aria-busy={loading}
      title={t("ui.cardFields.generateTooltip", { field: label })}
      className="mari-editor-action inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg disabled:cursor-not-allowed disabled:opacity-50"
    >
      {loading ? <Loader2 size="1rem" className="animate-spin" aria-hidden /> : <Wand2 size="1rem" aria-hidden />}
    </button>
  );
}
