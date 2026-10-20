// ──────────────────────────────────────────────
// CostBadge — the one cost word on a model row: "Included", "2x", "Free", or "Paid" where a plan catalog
// mixes paid models in. A pay-per-use model with a known price shows "$in · $out" per 1M tokens; without one it
// shows nothing. RetiringHint is the quiet amber "Retiring <date>".
// ──────────────────────────────────────────────
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import type { ConnectionModelCost, ModelCatalogPricing } from "@marinara-engine/shared";
import { useUIStore } from "../../stores/ui.store";
import { formatRelativeContact } from "../../lib/relative-time";
import { cn } from "../../lib/utils";

const PILL = "shrink-0 whitespace-nowrap rounded-full border px-1.5 text-[0.6875rem] font-medium leading-[1.125rem]";

/** "$1.50", "¥0.0375": two decimals, more for prices under a cent. */
export function formatMoney(amount: number, currency = "USD", locale?: string) {
  const small = amount !== 0 && Math.abs(amount) < 0.01;
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
      minimumFractionDigits: 2,
      maximumFractionDigits: small ? 4 : 2,
    }).format(amount);
  } catch {
    // Not an ISO currency (a token unit): the plain number and the unit.
    return `${amount.toLocaleString(locale, { maximumFractionDigits: small ? 4 : 2 })} ${currency}`;
  }
}

/** The short price badge ("$1.50 · $7.50" per 1M input · output, or "$0.30 / call") and its full hover text. */
export function priceBadge(pricing: ModelCatalogPricing | undefined, t: TFunction, locale?: string) {
  if (!pricing) return null;
  const money = (value: number) => formatMoney(value, pricing.currency, locale);
  const short =
    pricing.perCall !== undefined
      ? t("connections.cost.price.perCall", { price: money(pricing.perCall) })
      : pricing.prompt !== undefined || pricing.completion !== undefined
        ? `${money(pricing.prompt ?? 0)} · ${money(pricing.completion ?? 0)}`
        : null;
  if (!short) return null;
  const age = pricing.fetchedAt ? formatRelativeContact(pricing.fetchedAt) : null;
  const lines = [
    pricing.perCall !== undefined && t("connections.cost.price.perCallLine", { price: money(pricing.perCall) }),
    pricing.prompt !== undefined && t("connections.cost.price.input", { price: money(pricing.prompt) }),
    pricing.completion !== undefined && t("connections.cost.price.output", { price: money(pricing.completion) }),
    pricing.cacheRead !== undefined && t("connections.cost.price.cacheRead", { price: money(pricing.cacheRead) }),
    pricing.cacheWrite !== undefined && t("connections.cost.price.cacheWrite", { price: money(pricing.cacheWrite) }),
    pricing.beforeGroupDiscount && t("connections.cost.price.beforeGroupDiscount"),
    pricing.source
      ? t("connections.cost.price.source", {
          source: t(`connections.cost.price.sources.${pricing.source === "models.dev" ? "modelsDev" : pricing.source}`),
          age: age ?? "",
        })
      : t("connections.cost.price.ownList"),
  ];
  return { short, full: lines.filter(Boolean).join("\n") };
}

/** CostBadge's rule, for rows that lay out around it: a price shows even where a bare "Paid" would not. */
export const costBadgeShows = (
  cost: ConnectionModelCost | undefined,
  showPaid: boolean,
  pricing?: ModelCatalogPricing,
) => !!cost && (cost !== "paid" || showPaid || hasPrice(pricing));

const hasPrice = (pricing?: ModelCatalogPricing) =>
  !!pricing && (pricing.perCall !== undefined || pricing.prompt !== undefined || pricing.completion !== undefined);

export function CostBadge({
  cost,
  showPaid = false,
  pricing,
}: {
  cost?: ConnectionModelCost;
  showPaid?: boolean;
  /** A pay-per-use model with a known price shows it instead of "Paid". */
  pricing?: ModelCatalogPricing;
}) {
  const { t, i18n } = useTranslation();
  const shown = useUIStore((s) => s.showCostBadges);
  if (!shown || !cost || !costBadgeShows(cost, showPaid, pricing)) return null;
  const price = cost === "paid" ? priceBadge(pricing, t, i18n.resolvedLanguage) : null;
  const multiplier = cost.startsWith("multiplier:") ? cost.slice("multiplier:".length) : null;
  const label =
    price?.short ??
    (multiplier
      ? t("connections.cost.multiplier", { multiplier })
      : t(`connections.cost.${cost as "included" | "free" | "paid"}`));
  const hint =
    price?.full ??
    (multiplier
      ? t("connections.cost.multiplierHint", { multiplier })
      : t(`connections.cost.${cost as "included" | "free" | "paid"}Hint`));
  return (
    <span
      data-model-cost={price ? "price" : multiplier ? "multiplier" : cost}
      title={hint}
      className={cn(
        PILL,
        "tabular-nums",
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
