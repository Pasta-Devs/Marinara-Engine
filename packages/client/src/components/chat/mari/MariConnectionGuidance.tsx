import { useState } from "react";
import { useTranslation } from "react-i18next";

/** The same model guidance beside Mari's first connection choice and in her connection picker. */
export function MariConnectionGuidance({
  showSelectionHint = false,
  compact = false,
}: {
  showSelectionHint?: boolean;
  /** One line with a More button; the full text opens on tap. For phone sheets, where the list needs the room. */
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  if (compact && !expanded) {
    return (
      <p
        data-component="ProfessorMari.ConnectionGuidance"
        className="flex items-center gap-1 text-xs text-[var(--muted-foreground)]"
      >
        {t("professorMari.connectionGuidance.short")} ·
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="min-h-11 px-1 font-semibold text-[var(--foreground)] underline underline-offset-2"
        >
          {t("professorMari.connectionGuidance.more")}
        </button>
      </p>
    );
  }
  return (
    <div
      data-component="ProfessorMari.ConnectionGuidance"
      className="space-y-2 text-xs leading-relaxed text-[var(--muted-foreground)]"
    >
      {showSelectionHint && <p>{t("professorMari.connectionGuidance.select")}</p>}
      <p>{t("professorMari.connectionGuidance.model")}</p>
      <p>{t("professorMari.connectionGuidance.context")}</p>
      <ul className="list-disc space-y-1 pl-4">
        <li>{t("professorMari.connectionGuidance.tier16k")}</li>
        <li>{t("professorMari.connectionGuidance.tier32k")}</li>
        <li>{t("professorMari.connectionGuidance.tier64k")}</li>
        <li>{t("professorMari.connectionGuidance.tier128k")}</li>
      </ul>
    </div>
  );
}
