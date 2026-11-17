import { Wand2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { CardFieldGenerationKey } from "@marinara-engine/shared";
import { Spinner } from "../ui/Spinner";

export function CardFieldWand({
  label,
  onGenerate,
  disabled,
  loading,
  field,
}: {
  label: string;
  onGenerate: () => void;
  disabled: boolean;
  loading: boolean;
  /** The field it writes. Public Face has its own tooltip: it has no word range. */
  field?: CardFieldGenerationKey;
}) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onGenerate}
      disabled={disabled}
      aria-label={t("ui.cardFields.generate", { field: label })}
      aria-busy={loading}
      title={
        field === "publicFace"
          ? t("ui.cardFields.publicFace.generateTooltip")
          : t("ui.cardFields.generateTooltip", { field: label })
      }
      className="mari-editor-action inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg disabled:cursor-not-allowed disabled:opacity-50"
    >
      {loading ? <Spinner size="md" aria-hidden="true" /> : <Wand2 size="1rem" aria-hidden />}
    </button>
  );
}
