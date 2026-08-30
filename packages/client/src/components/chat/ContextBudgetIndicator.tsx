import type { CSSProperties } from "react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { formatCompactTokenCount, type ProfessorMariContextBudget } from "../../lib/professor-mari-context-budget";

const CONTEXT_GAUGE_CIRCUMFERENCE = 2 * Math.PI * 10;

export function ContextBudgetGauge({ percentage }: { percentage: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="pointer-events-none absolute inset-0 h-full w-full -rotate-90"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.2" />
      <circle
        cx="12"
        cy="12"
        r="10"
        fill="none"
        stroke="var(--marinara-chat-chrome-text)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray={`${(percentage / 100) * CONTEXT_GAUGE_CIRCUMFERENCE} ${CONTEXT_GAUGE_CIRCUMFERENCE}`}
      />
    </svg>
  );
}

export function ContextBudgetIndicator({ budget }: { budget: ProfessorMariContextBudget }) {
  const { t: localizeUi } = useUiTranslation();
  const used = formatCompactTokenCount(budget.usedTokens);
  const maximum = formatCompactTokenCount(budget.maxTokens);
  const ariaLabel = localizeUi("ui.chat.contextBudget.aria", { used, maximum });
  const progressStyle = { "--context-budget": `${budget.percentage}%` } as CSSProperties;

  return (
    <div
      data-component="ContextBudget"
      className="mb-2 space-y-1 px-0.5 text-[0.6875rem] text-[var(--marinara-chat-chrome-panel-muted)]"
    >
      <div className="flex items-center justify-between gap-3">
        <span>{localizeUi("ui.chat.contextBudget.label")}</span>
        <span className="tabular-nums text-[var(--marinara-chat-chrome-panel-text)]">
          {localizeUi("ui.chat.contextBudget.value", { used, maximum })}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={ariaLabel}
        aria-valuemin={0}
        aria-valuemax={budget.maxTokens}
        aria-valuenow={Math.min(budget.usedTokens, budget.maxTokens)}
        className="h-1 overflow-hidden rounded-full bg-[var(--muted)]/55"
      >
        <div
          className="h-full w-[var(--context-budget)] rounded-full bg-[var(--marinara-chat-chrome-text)] transition-[width] duration-200 motion-reduce:transition-none"
          style={progressStyle}
        />
      </div>
    </div>
  );
}
