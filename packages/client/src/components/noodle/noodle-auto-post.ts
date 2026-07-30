import type { NoodlerRefreshNowOutcome } from "@marinara-engine/shared";

/**
 * Summarize the per-creator outcomes of "Refresh NoodleR now" into a localization key + params.
 * Anything not generated/skipped is a failure, so an all-failure run never reports success.
 * Callers must localize the returned key via useUiTranslation before toasting.
 */
export function summarizeRefreshOutcomes(
  outcomes: NoodlerRefreshNowOutcome[],
): { ok: boolean; key: string; params?: Record<string, number> } {
  const generated = outcomes.filter((o) => o.status === "generated").length;
  const skipped = outcomes.filter((o) => o.status === "skipped").length;
  const failed = outcomes.length - generated - skipped;
  if (outcomes.length === 0) {
    return { ok: true, key: "ui.noodle.noodlerhome.noCreatorsHaveAutomaticPostingEnabled" };
  }
  if (failed === 0) return { ok: true, key: "ui.noodle.refresh.generatedPosts", params: { count: generated } };
  if (generated === 0) return { ok: false, key: "ui.noodle.refresh.allCreatorsFailed", params: { count: failed } };
  return {
    ok: false,
    key: skipped ? "ui.noodle.refresh.partialFailureWithSkipped" : "ui.noodle.refresh.partialFailure",
    params: { generated, failed, skipped },
  };
}
