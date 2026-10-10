import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Sparkles } from "lucide-react";
import type {
  ProfessorMariAskContext,
  ProfessorMariContextResource,
  ProfessorMariEntryPoint,
} from "@marinara-engine/shared";
import { requestProfessorMariOpen } from "../../lib/professor-mari-open";
import { suggestMariAction, type MariFieldInput } from "../../lib/mari-field-suggestions";

interface MariContextChipProps {
  /** Where the chip lives; also the handoff entry point. */
  entryPoint: Extract<ProfessorMariEntryPoint, "character-editor" | "character-chat">;
  surface: MariFieldInput["surface"];
  /** The resource Mari is looking at (character being edited / chatted with). */
  resource?: ProfessorMariContextResource;
  /** Focused field id in the editor, if any. */
  field?: string;
  /** Live text of the focused field / chat draft — drives the label. */
  value: string;
  subject?: string;
  className?: string;
}

/**
 * Context-aware Mari trigger. Runs the local (LLM-free) heuristic over `value`
 * to advertise the most useful action, and hands off to the floating assistant
 * with a typed context on click.
 */
export function MariContextChip({
  entryPoint,
  surface,
  resource,
  field,
  value,
  subject,
  className,
}: MariContextChipProps) {
  const { t } = useTranslation();
  const suggestion = useMemo(
    () => suggestMariAction({ surface, field, value, subject }),
    [surface, field, value, subject],
  );

  const genericLabel = t("mari.contextChip.generic", "Ask Professor Mari");
  const effectiveLabel = suggestion ? t(suggestion.labelKey, suggestion.label, suggestion.labelValues) : genericLabel;

  const handleOpen = () => {
    const context: ProfessorMariAskContext = {
      source: entryPoint,
      capability: suggestion?.capability ?? "explain",
      query: suggestion?.draft,
      resource,
      field,
    };
    requestProfessorMariOpen({
      destination: "omnibar",
      draft: suggestion?.draft,
      context,
    });
  };

  return (
    <button
      type="button"
      onClick={handleOpen}
      className={
        className ??
        "inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--muted)]/40 px-2.5 py-1 text-xs font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
      }
      title={effectiveLabel}
    >
      <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span className="truncate">{effectiveLabel}</span>
    </button>
  );
}
