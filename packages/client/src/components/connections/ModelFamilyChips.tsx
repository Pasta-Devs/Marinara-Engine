// ──────────────────────────────────────────────
// Model family chips: "All 240", "Claude 12", "Qwen 30"… over a long model list. One family at a
// time; pressing the chosen one again, or All, shows every model. The row wraps instead of
// scrolling, so no chip hides off the edge of a phone.
// ──────────────────────────────────────────────
import { useTranslation } from "react-i18next";
import { MODEL_FAMILY_LABELS, type ModelFamily, type ModelFamilyChip } from "../../lib/model-families";
import { cn } from "../../lib/utils";

const CHIP_CLASS = "mari-connection-chip gap-1 outline-none focus-visible:ring-1 focus-visible:ring-foreground/25";

export function ModelFamilyChips({
  chips,
  total,
  selected,
  onSelect,
  className,
}: {
  chips: readonly ModelFamilyChip[];
  /** Every model in the list, for the All chip. */
  total: number;
  /** The family shown, or null for all of them. */
  selected: ModelFamily | null;
  onSelect: (family: ModelFamily | null) => void;
  className?: string;
}) {
  const { t } = useTranslation();
  const chip = (family: ModelFamily | null, label: string, count: number) => (
    <button
      key={family ?? "all"}
      type="button"
      data-switcher-family={family ?? "all"}
      aria-pressed={selected === family}
      aria-label={t("connections.switcher.familyChip", { family: label, count })}
      onClick={() => onSelect(family === selected ? null : family)}
      className={CHIP_CLASS}
    >
      {label}
      <span className="tabular-nums opacity-70">{count}</span>
    </button>
  );
  return (
    <div
      role="group"
      aria-label={t("connections.switcher.families")}
      className={cn("flex flex-wrap gap-1 px-3 pb-1.5 pt-1", className)}
    >
      {chip(null, t("connections.modelPicker.allUpstreams"), total)}
      {chips.map(({ family, count }) =>
        chip(family, family === "other" ? t("connections.switcher.familyOther") : MODEL_FAMILY_LABELS[family], count),
      )}
    </div>
  );
}
