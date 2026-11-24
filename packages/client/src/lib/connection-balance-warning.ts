// ──────────────────────────────────────────────
// When a Connection card warns about its balance. The card no longer shows the balance itself (the Connection's
// page does); it only says when what is left is gone or nearly gone.
// ──────────────────────────────────────────────
import type { ConnectionBalance } from "@marinara-engine/shared";

/** Below this much money left (in the balance's own currency) the card says "Low balance". */
export const LOW_BALANCE_MONEY = 1;

export type BalanceWarning = "empty" | "low";

/** A currency code (USD, CNY), as `formatMoney` takes it, rather than a count such as "TOKENS". */
const isMoneyUnit = (unit: string) => /^[A-Z]{3}$/.test(unit);

/**
 * "empty" when nothing is left, "low" when less than one unit of money is left, otherwise null. Kept conservative:
 * no cap (`left` null), no balance read, or a non-money unit above zero never warns, since a threshold for tokens
 * would be a guess.
 */
export function balanceWarning(
  balance: Pick<ConnectionBalance, "left" | "unit"> | null | undefined,
): BalanceWarning | null {
  if (!balance || typeof balance.left !== "number" || !Number.isFinite(balance.left)) return null;
  if (balance.left <= 0) return "empty";
  return isMoneyUnit(balance.unit) && balance.left < LOW_BALANCE_MONEY ? "low" : null;
}
