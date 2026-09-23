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
export function DecisionStatementNote({ text }: { text: string }) {
  const { t } = useTranslation();
  const usesDecisions = useMemo(
    () => /decision(?:_choice)?\s*:/iu.test(text) && collectDecisionQuestions(text).length > 0,
    [text],
  );
  const options = useDecisionOptions(usesDecisions);
  if (!usesDecisions || options.isPending || options.data?.selected) return null;
  return (
    <p role="status" className="mt-1 flex items-start gap-1.5 text-[0.625rem] text-amber-400">
      <AlertTriangle size="0.75rem" className="mt-px shrink-0" aria-hidden />
      {t("ui.ui.decisionstatementnote.decisionModelMissing")}
    </p>
  );
}
