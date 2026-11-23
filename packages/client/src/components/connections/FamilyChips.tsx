// ──────────────────────────────────────────────
// One row of model-family chips over a long model list: All, Claude 12, DeepSeek 9 … Other. A chip shows one
// family at a time; search ignores it. Lists under FAMILY_CHIPS_MIN models, or with one family, show no chips.
// ──────────────────────────────────────────────
import { useTranslation } from "react-i18next";
import { FAMILY_CHIPS_MIN, familiesOf, familyOf } from "../../lib/model-families";
import { cn } from "../../lib/utils";

/** The chips to show for a list and the filter they apply. Cheap enough to run on every render (164 ids). */
export function familyFilterOf(ids: readonly string[], family: string | null) {
  const families = familiesOf(ids);
  const shown = ids.length >= FAMILY_CHIPS_MIN && families.length >= 2;
  // A family the list no longer has (another account, a refresh) falls back to All.
  const active = shown && family && families.some((entry) => entry.key === family) ? family : null;
  return {
    families: shown ? families : [],
    active,
    matches: (id: string) => !active || familyOf(id).key === active,
  };
}

export function FamilyChips({
  families,
  active,
  total,
  onChange,
  className,
}: {
  families: ReadonlyArray<{ key: string; label: string; count: number }>;
  active: string | null;
  total: number;
  onChange: (family: string | null) => void;
  className?: string;
}) {
  const { t } = useTranslation();
  if (!families.length) return null;
  const chip = (key: string | null, label: string, count: number) => (
    <button
      key={key ?? "all"}
      type="button"
      className={cn("ov-family-chip", active === key && "is-on")}
      aria-pressed={active === key}
      onClick={() => onChange(key)}
    >
      {label}
      <span className="ov-family-chip__count">{count}</span>
    </button>
  );
  return (
    <div
      className={cn("ov-family-chips", className)}
      role="group"
      aria-label={t("connections.families.label")}
      data-family-chips
    >
      {chip(null, t("connections.families.all"), total)}
      {families.map((family) =>
        chip(family.key, family.key === "other" ? t("connections.families.other") : family.label, family.count),
      )}
    </div>
  );
}
