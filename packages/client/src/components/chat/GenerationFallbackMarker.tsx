import { useTranslation } from "react-i18next";
import { describeGenerationFallback } from "../../lib/generation-fallback-notice";
import { cn } from "../../lib/utils";
import { HelpTooltip } from "../ui/HelpTooltip";

/**
 * "Fallback" beside a reply the fallback wrote. Tap, focus or hover names the connection that failed
 * first (#7697), so phones, keyboards and screen readers reach it on every reply, not only the newest.
 */
export function GenerationFallbackMarker({ fallback, className }: { fallback: unknown; className?: string }) {
  const { t } = useTranslation();
  const note = describeGenerationFallback(fallback);
  if (!note) return null;
  return (
    <HelpTooltip
      label={t("generation.fallback.marker")}
      text={note}
      ariaLabel={note}
      size="0.625rem"
      className={cn("shrink-0", className)}
      buttonClassName="text-[0.5625rem] italic"
      wide
    />
  );
}
