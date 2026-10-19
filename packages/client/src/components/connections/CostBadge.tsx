// ──────────────────────────────────────────────
// CostBadge — the one cost word on a model row: "Included", "2x", "Free", or "Paid" where a plan catalog
// mixes paid models in. Pay-per-use models show nothing. RetiringHint is the quiet amber "Retiring <date>".
// ──────────────────────────────────────────────
import { useTranslation } from "react-i18next";
import type { ConnectionModelCost } from "@marinara-engine/shared";
import { useUIStore } from "../../stores/ui.store";
import { cn } from "../../lib/utils";

const PILL = "shrink-0 whitespace-nowrap rounded-full border px-1.5 text-[0.6875rem] font-medium leading-[1.125rem]";

export function CostBadge({ cost, showPaid = false }: { cost?: ConnectionModelCost; showPaid?: boolean }) {
  const { t } = useTranslation();
  const shown = useUIStore((s) => s.showCostBadges);
  if (!shown || !cost || (cost === "paid" && !showPaid)) return null;
  const multiplier = cost.startsWith("multiplier:") ? cost.slice("multiplier:".length) : null;
  const label = multiplier
    ? t("connections.cost.multiplier", { multiplier })
    : t(`connections.cost.${cost as "included" | "free" | "paid"}`);
  const hint = multiplier
    ? t("connections.cost.multiplierHint", { multiplier })
    : t(`connections.cost.${cost as "included" | "free" | "paid"}Hint`);
  return (
    <span
      data-model-cost={multiplier ? "multiplier" : cost}
      title={hint}
      className={cn(
        PILL,
        cost === "paid"
          ? "border-[var(--border)] text-[var(--muted-foreground)]"
          : multiplier
            ? "border-transparent bg-[color-mix(in_srgb,var(--color-amber-500)_14%,transparent)] text-[color-mix(in_srgb,var(--color-amber-500)_72%,var(--foreground)_28%)]"
            : "border-transparent bg-[color-mix(in_srgb,var(--color-emerald-500)_13%,transparent)] text-[color-mix(in_srgb,var(--color-emerald-500)_70%,var(--foreground)_30%)]",
      )}
    >
      {label}
    </span>
  );
}

export function RetiringHint({ deprecated, retiresAt }: { deprecated?: boolean; retiresAt?: string }) {
  const { t, i18n } = useTranslation();
  if (!deprecated && !retiresAt) return null;
  const date = retiresAt ? new Date(retiresAt) : null;
  const when =
    date && Number.isFinite(date.getTime())
      ? date.toLocaleDateString(i18n.resolvedLanguage, { month: "short", day: "numeric" })
      : null;
  return (
    <span
      data-model-retiring
      className="shrink-0 whitespace-nowrap text-[0.6875rem] text-[color-mix(in_srgb,var(--color-amber-500)_78%,var(--foreground)_22%)]"
      title={retiresAt}
    >
      {when ? t("connections.cost.retiring", { date: when }) : t("connections.cost.retiringSoon")}
    </span>
  );
}
