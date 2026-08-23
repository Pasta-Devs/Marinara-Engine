import { useEffect, useMemo, useState } from "react";
import { CheckSquare2, RotateCcw, Square } from "lucide-react";
import { cn } from "../../lib/utils";
import { useTranslation as useUiTranslation } from "react-i18next";

interface ContinuityIssueChecklistProps {
  content: string;
  compact?: boolean;
}

function parseContinuityLines(content: string): string[] {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function ContinuityIssueChecklist({ content, compact = false }: ContinuityIssueChecklistProps) {
  const { t: localizeUi } = useUiTranslation();
  const issues = useMemo(() => parseContinuityLines(content), [content]);
  const [selected, setSelected] = useState<Set<number>>(() => new Set(issues.map((_, index) => index)));
  const [acceptedOnly, setAcceptedOnly] = useState(false);

  useEffect(() => {
    setSelected(new Set(issues.map((_, index) => index)));
    setAcceptedOnly(false);
  }, [issues]);

  if (issues.length === 0) return null;

  const visibleIssues = issues
    .map((line, index) => ({ index, line }))
    .filter(({ index }) => !acceptedOnly || selected.has(index));
  const selectedCount = issues.reduce((count, _, index) => (selected.has(index) ? count + 1 : count), 0);

  const toggleIssue = (index: number) => {
    setAcceptedOnly(false);
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const resetReview = () => {
    setSelected(new Set(issues.map((_, index) => index)));
    setAcceptedOnly(false);
  };

  return (
    <div className={cn("mt-1 flex flex-col", compact ? "gap-1" : "gap-1.5")}>
      {visibleIssues.map(({ index, line }) => {
        const checked = selected.has(index);
        return (
          <button
            key={`${index}-${line}`}
            type="button"
            onClick={() => toggleIssue(index)}
            aria-pressed={checked}
            className={cn(
              "flex w-full items-start gap-1.5 rounded-md text-left transition-colors",
              compact ? "p-1.5 text-[0.625rem]" : "p-2 text-xs",
              checked
                ? "bg-[var(--primary)]/10 text-[var(--foreground)]"
                : "bg-[var(--muted)]/30 text-[var(--muted-foreground)] opacity-70",
            )}
          >
            {checked ? (
              <CheckSquare2 size={compact ? "0.75rem" : "0.875rem"} className="mt-0.5 shrink-0 text-[var(--primary)]" />
            ) : (
              <Square size={compact ? "0.75rem" : "0.875rem"} className="mt-0.5 shrink-0" />
            )}
            <span className="min-w-0 flex-1 whitespace-pre-wrap leading-relaxed">{line}</span>
          </button>
        );
      })}
      <div className="flex items-center justify-between gap-2 pt-1">
        <span className={cn("text-[var(--muted-foreground)]", compact ? "text-[0.5625rem]" : "text-[0.625rem]")}>
          {selectedCount} {localizeUi("ui.noodle.noodlehome.of")} {issues.length}{" "}
          {localizeUi("ui.agents.agenteditor.selected")}
        </span>
        <div className="flex items-center gap-1">
          {acceptedOnly && (
            <button
              type="button"
              onClick={resetReview}
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[0.5625rem] text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)]"
            >
              <RotateCcw size="0.625rem" />
              {localizeUi("ui.agents.continuityissuechecklist.reviewAll")}
            </button>
          )}
          <button
            type="button"
            disabled={selectedCount === 0 || acceptedOnly}
            onClick={() => setAcceptedOnly(true)}
            className="rounded-md bg-[var(--primary)] px-2 py-1 text-[0.5625rem] font-medium text-[var(--primary-foreground)] transition-opacity hover:opacity-90 disabled:opacity-45"
          >
            {localizeUi("ui.agents.continuityissuechecklist.acceptSelected")}
          </button>
        </div>
      </div>
    </div>
  );
}
