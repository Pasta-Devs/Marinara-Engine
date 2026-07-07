import type { LorebookScanResult } from "../../services/lorebook/index.js";

export type LorebookScanSnapshot = {
  activatedEntries: LorebookScanResult["activatedEntries"];
  budgetSkippedEntries: LorebookScanResult["budgetSkippedEntries"];
  totalTokensEstimate: number;
  totalEntries: number;
};

export function emptyLorebookScanSnapshot(): LorebookScanSnapshot {
  return {
    activatedEntries: [],
    budgetSkippedEntries: [],
    totalTokensEstimate: 0,
    totalEntries: 0,
  };
}

export function toLorebookScanSnapshot(result: LorebookScanResult | null | undefined): LorebookScanSnapshot {
  if (!result) return emptyLorebookScanSnapshot();
  return {
    activatedEntries: result.activatedEntries,
    budgetSkippedEntries: result.budgetSkippedEntries,
    totalTokensEstimate: result.totalTokensEstimate,
    totalEntries: result.totalEntries,
  };
}
