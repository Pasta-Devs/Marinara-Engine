import { estimateCharacterCardTokens, estimateTextTokens } from "@marinara-engine/shared";
import type { TFunction } from "i18next";

export { estimateCharacterCardTokens, estimateTextTokens };

export function formatEstimatedTokens(tokens: number, localizeUi: TFunction): string {
  return localizeUi("chat.summary.tokenEstimate", { tokens: tokens.toLocaleString() });
}
