import type { ProfessorMariQuickErrorKind } from "@marinara-engine/shared";

/**
 * Sorts a failed quick answer into one kind, so the omnibar can say what to do next.
 * ponytail: matches the message text the service and providers produce; a provider that
 * changes its wording falls back to "provider" (plain copy, no wrong button), never a crash.
 */
export function classifyQuickAnswerError(message: string): ProfessorMariQuickErrorKind {
  if (/set up a language connection|no model|choose a model|model is not set|missing model/i.test(message))
    return "missing-model";
  if (/\b(401|403)\b|unauthori[sz]ed|invalid api key|forbidden|incorrect api key/i.test(message)) return "auth";
  if (/sent no words|could not answer/i.test(message)) return "empty";
  if (/\b5\d\d\b|provider|endpoint error|rate limit|\b429\b/i.test(message)) return "provider";
  if (/econn|enotfound|etimedout|fetch failed|socket|network|timed? ?out/i.test(message)) return "network";
  return "provider";
}
