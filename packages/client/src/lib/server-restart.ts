export type RestartStep = "stopping" | "starting" | "back";
export type RestartProbe = { ok: false } | { ok: true; bootId?: string | null };

/**
 * Where a server restart stands after one /api/health probe. The old process keeps answering while it
 * shuts down, so an answer means "back" only once the boot id changed, or, when health hides the boot id
 * (a caller who has not signed in), once the server was seen down.
 */
export function nextRestartStep(step: RestartStep, beforeBootId: string | null, probe: RestartProbe): RestartStep {
  if (step === "back") return step;
  if (!probe.ok) return "starting";
  if (probe.bootId && beforeBootId) return probe.bootId === beforeBootId ? "stopping" : "back";
  return step === "starting" ? "back" : step;
}
