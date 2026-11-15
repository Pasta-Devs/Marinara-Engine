export type RestartStep = "stopping" | "starting" | "back";
export type RestartProbe = { ok: false } | { ok: true; bootId?: string | null };

/**
 * Where a server restart stands after one /api/health probe. The old process keeps answering while it
 * shuts down, so an answer means "back" only once the boot id changed, or, when health hides the boot id
 * (a caller who has not signed in), after two answers in a row once the server was seen down: a frozen
 * old process can time out once and still answer before it exits.
 */
export function nextRestartStep(
  step: RestartStep,
  beforeBootId: string | null,
  probe: RestartProbe,
  lastProbeOk: boolean,
): RestartStep {
  if (step === "back") return step;
  if (!probe.ok) return "starting";
  if (probe.bootId && beforeBootId) return probe.bootId === beforeBootId ? step : "back";
  return step === "starting" && lastProbeOk ? "back" : step;
}
