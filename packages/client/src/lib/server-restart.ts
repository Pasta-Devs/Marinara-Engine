export type RestartStep = "stopping" | "starting" | "back";

/**
 * Where a server restart stands after one /api/health probe. The old server answers 503 from the
 * restart request until it exits, so any ok answer after the 202 comes from the new server.
 */
export function nextRestartStep(step: RestartStep, probeOk: boolean): RestartStep {
  if (step === "back" || probeOk) return "back";
  return "starting";
}
