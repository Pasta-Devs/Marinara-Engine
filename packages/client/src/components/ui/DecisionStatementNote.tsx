// ──────────────────────────────────────────────
// Note under a prompt field that asks the Decision model
// ──────────────────────────────────────────────
import { useMemo } from "react";
import { AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { collectDecisionQuestions } from "@marinara-engine/shared";
import { useDecisionOptions } from "../../hooks/use-decision-model";

/**
 * Shown under a field whose text uses `decision:` or `decision_choice:` while no
 * Decision model is set. Those conditions then read as no on every turn, and without
 * this the author would only find out from a prompt that never changes.
 *
 * The options query only runs once the text holds a decision statement, so the many
 * fields that never use one cost nothing.
 */
export function DecisionStatementNote({
  text = "",
  active,
  message,
}: {
  text?: string;
  /** Show for a field that is itself a decision setting, such as a lorebook entry's statement. */
  active?: boolean;
  /** A message worded for that field, in place of the one about decision conditions. */
  message?: string;
}) {
  const { t } = useTranslation();
  const usesDecisions = useMemo(
    () => active ?? (/decision(?:_choice)?\s*:/iu.test(text) && collectDecisionQuestions(text).length > 0),
    [active, text],
  );
  const options = useDecisionOptions(usesDecisions);
  if (!usesDecisions || options.isPending || options.data?.selected) return null;
  return (
    <p role="status" className="mt-1 flex items-start gap-1.5 text-[0.625rem] text-amber-400">
      <AlertTriangle size="0.75rem" className="mt-px shrink-0" aria-hidden />
      {message ?? t("ui.ui.decisionstatementnote.decisionModelMissing")}
    </p>
  );
}
