// Timing for Professor Mari's live work card. Kept out of the component so the arithmetic that
// decides what the user reads as "how long this took" has one runnable check.

/** The step timestamps the card can see. Live steps carry `startedAt`; replayed ones only a pair. */
export interface RunStepTiming {
  startedAt?: number;
  updatedAt?: number;
  durationMs?: number;
}

/** Start of the earliest step, or null when no step carries a usable timestamp. */
export function resolveRunStartMs(steps: readonly RunStepTiming[]): number | null {
  let earliest: number | null = null;
  for (const step of steps) {
    const end = step.updatedAt || 0;
    const start = step.durationMs !== undefined && end ? end - step.durationMs : step.startedAt || 0;
    if (!start) continue;
    earliest = earliest === null ? start : Math.min(earliest, start);
  }
  return earliest;
}

/**
 * R14 (item 7): when the run's clock starts - when you sent the message (or the run began) - so the live
 * timer and "Worked for" share one anchor that never moves when a step, a round or a remount arrives.
 * The earliest step only counts when it is earlier (a replayed trace), or when there is no send time.
 */
export function resolveRunAnchorMs(
  sentAtMs: number | null | undefined,
  steps: readonly RunStepTiming[],
): number | null {
  const firstStep = resolveRunStartMs(steps);
  if (!sentAtMs || !Number.isFinite(sentAtMs)) return firstStep;
  return firstStep === null ? sentAtMs : Math.min(sentAtMs, firstStep);
}

/**
 * Wall-clock span of a finished run: its anchor (`startMs`, else the earliest step start) to its end
 * (`endMs`, else the latest step end). Summing step durations instead would drop every gap between them
 * (thinking, streaming), so a run the user watched for three minutes would report a few seconds the
 * moment it finished.
 */
export function resolveRunSeconds(
  steps: readonly RunStepTiming[],
  { startMs, endMs }: { startMs?: number | null; endMs?: number | null } = {},
): number {
  const start = startMs || resolveRunStartMs(steps);
  const end = Math.max(
    endMs || 0,
    steps.reduce((latest, step) => Math.max(latest, step.updatedAt || 0), 0),
  );
  // Steps never show under 1s, so a real run never totals less than one of its own steps.
  return start && end > start ? Math.max(1, Math.round((end - start) / 1_000)) : 0;
}
