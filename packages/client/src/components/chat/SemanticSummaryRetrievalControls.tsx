export type SemanticSummaryRetrievalControlField =
  "semanticSummaryRecentCount" | "semanticSummaryOlderCount" | "semanticSummaryMinSimilarity";

interface SemanticSummaryRetrievalControlsProps {
  enabled: boolean;
  recentCount: number;
  olderCount: number;
  minSimilarity: number;
  recentLabel: string;
  olderLabel: string;
  thresholdLabel: string;
  onChange: (field: SemanticSummaryRetrievalControlField, value: number) => void;
}

export function SemanticSummaryRetrievalControls({
  enabled,
  recentCount,
  olderCount,
  minSimilarity,
  recentLabel,
  olderLabel,
  thresholdLabel,
  onChange,
}: SemanticSummaryRetrievalControlsProps) {
  if (!enabled) return null;

  const controls = [
    {
      field: "semanticSummaryRecentCount",
      label: recentLabel,
      value: recentCount,
      min: 0,
      max: 20,
      step: 1,
    },
    {
      field: "semanticSummaryOlderCount",
      label: olderLabel,
      value: olderCount,
      min: 0,
      max: 20,
      step: 1,
    },
    {
      field: "semanticSummaryMinSimilarity",
      label: thresholdLabel,
      value: minSimilarity,
      min: 0,
      max: 1,
      step: 0.01,
    },
  ] as const;

  return (
    // Lays out by the Chat Settings window's width, not the screen's.
    <div className="grid gap-2 @lg:grid-cols-3">
      {controls.map((control) => (
        <label
          key={control.field}
          className="flex min-w-0 flex-col gap-1.5 rounded-lg bg-[var(--secondary)]/50 px-2.5 py-2 text-[0.625rem] text-[var(--muted-foreground)]"
        >
          <span className="flex items-center justify-between gap-2">
            <span className="font-medium text-[var(--foreground)]">{control.label}</span>
            <span className="tabular-nums">
              {control.field === "semanticSummaryMinSimilarity" ? control.value.toFixed(2) : control.value}
            </span>
          </span>
          <input
            type="range"
            min={control.min}
            max={control.max}
            step={control.step}
            value={control.value}
            aria-label={control.label}
            onChange={(event) => onChange(control.field, Number(event.target.value))}
            className="h-8 w-full cursor-pointer accent-[var(--primary)]"
          />
        </label>
      ))}
    </div>
  );
}
