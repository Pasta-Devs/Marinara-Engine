// ──────────────────────────────────────────────
// ⓘ beside a setting that needs a decision model that reads pictures
// ──────────────────────────────────────────────
import { useTranslation as useUiTranslation } from "react-i18next";
import { HelpTooltip } from "./HelpTooltip";

/**
 * Shown next to every picture setting while the selected decision model cannot read
 * pictures (or none is selected), which is why the setting is greyed out.
 */
export function VisionDecisionHint({ size = "0.75rem" }: { size?: string }) {
  const { t } = useUiTranslation();
  return (
    <HelpTooltip
      icon="info"
      size={size}
      text={t("ui.decision.visionRequired")}
      ariaLabel={t("ui.decision.visionRequiredLabel")}
    />
  );
}
