// ──────────────────────────────────────────────
// A lorebook entry's decision statement, read with the chat's newest pictures
// ──────────────────────────────────────────────
import { MAX_DECISION_MEDIA_WITHIN, MAX_DECISION_PICTURES } from "@marinara-engine/shared";
import { useTranslation } from "react-i18next";
import { useDecisionReadsPictures } from "../../hooks/use-decision-model";
import { cn } from "../../lib/utils";
import { VisionDecisionHint } from "../ui/VisionDecisionHint";

interface Props {
  pictures: number;
  mediaWithin: number | null;
  onChange: (patch: { decisionPictures?: number; decisionMediaWithin?: number | null }) => void;
  /** "overhaul" uses the entry editor's own field styles; "classic" the older editor's. */
  variant: "overhaul" | "classic";
}

/**
 * Off unless asked: a picture costs the decision model time, and most statements are
 * about what was written. Greyed out, with an ⓘ that says why, unless the selected
 * decision model reads pictures.
 */
export function LorebookDecisionPictureFields({ pictures, mediaWithin, onChange, variant }: Props) {
  const { t } = useTranslation();
  const readsPictures = useDecisionReadsPictures();
  const overhaul = variant === "overhaul";
  const selectClass = overhaul ? undefined : "mari-editor-field w-full px-2 py-1.5 text-xs";
  const labelClass = overhaul
    ? "ov-lf"
    : "flex min-w-0 flex-col gap-1 text-[0.6875rem] font-medium text-[var(--muted-foreground)]";

  return (
    <div className="mt-2">
      {/* The ⓘ stays outside the greyed-out settings so it can still be opened. */}
      <span
        className={cn(
          "mb-1 flex items-center gap-1",
          overhaul ? "ov-lentry__label" : "text-[0.6875rem] font-medium text-[var(--muted-foreground)]",
        )}
      >
        {t("ui.lorebooks.decisionPictures.title")}
        {!readsPictures && <VisionDecisionHint size="0.6875rem" />}
      </span>
      {/* Greyed out for a model that cannot see, but a saved count can still be cleared. */}
      <fieldset disabled={!readsPictures && pictures === 0} className={!readsPictures ? "opacity-50" : undefined}>
        <div className={overhaul ? "grid gap-2" : "grid grid-cols-2 gap-2"}>
          <label className={labelClass}>
            <span>{t("agents.activation.picturesLabel")}</span>
            <select
              className={selectClass}
              value={pictures}
              onChange={(event) => onChange({ decisionPictures: Number(event.target.value) })}
            >
              {Array.from({ length: (readsPictures ? MAX_DECISION_PICTURES : pictures) + 1 }, (_, count) => (
                <option key={count} value={count}>
                  {count === 0 ? t("agents.activation.noPictures") : t("agents.activation.pictures", { count })}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            <span>{t("ui.lorebooks.decisionPictures.withinLabel")}</span>
            <select
              className={selectClass}
              value={mediaWithin ?? ""}
              disabled={pictures === 0}
              onChange={(event) =>
                onChange({ decisionMediaWithin: event.target.value === "" ? null : Number(event.target.value) })
              }
            >
              <option value="">{t("agents.activation.mediaAlways")}</option>
              {[...new Set([1, 2, 3, 5, 10, 20, ...(mediaWithin === null ? [] : [mediaWithin])])]
                .filter((count) => count <= MAX_DECISION_MEDIA_WITHIN)
                .sort((a, b) => a - b)
                .map((count) => (
                  <option key={count} value={count}>
                    {t("agents.activation.mediaWithin", { count })}
                  </option>
                ))}
            </select>
          </label>
        </div>
      </fieldset>
      <p className={cn("mt-1", overhaul ? "ov-lentry__hint" : "text-[0.625rem] text-[var(--muted-foreground)]")}>
        {t("ui.lorebooks.decisionPictures.help")}
      </p>
    </div>
  );
}
