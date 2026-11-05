// Professor Mari's agent runtime: "classic" is the original JSON-frame loop and the fallback;
// "pi" runs the same workspace tools through the pi SDK with native tool calls (trial, server-authoritative).
// The value lives in app_settings under MARI_RUNTIME_SETTINGS_KEY and is written only by the validated
// PUT /api/professor-mari/workspace/runtime route or the one-time default rollout. Read fresh on every run.
export const MARI_RUNTIME_SETTINGS_KEY = "mari-runtime";

export const MARI_RUNTIMES = ["classic", "pi"] as const;

export type MariRuntime = (typeof MARI_RUNTIMES)[number];

export const DEFAULT_MARI_RUNTIME: MariRuntime = "pi";

export function isMariRuntime(value: unknown): value is MariRuntime {
  return typeof value === "string" && (MARI_RUNTIMES as readonly string[]).includes(value);
}

// The opening words of every app_data dry-run result. The work timeline marks a step "Previewed" by them.
export const APP_DATA_DRY_RUN_PREFIX = "NOT SAVED - dry run";
// A mari CLI run without --apply opens its bash result with this line instead.
export const MARI_DRY_RUN_SENTINEL = "Dry-run: the mari CLI ran without --apply, so no changes were saved.";

/** Either dry-run opening: the step finished but saved nothing. */
export function isDryRunOutput(output: string | null | undefined): boolean {
  return output?.startsWith(APP_DATA_DRY_RUN_PREFIX) === true || output?.startsWith(MARI_DRY_RUN_SENTINEL) === true;
}

// #7949: before her first write on a handbook surface in a chat, Professor Mari must read that
// surface's built-in skill. On unless the user turns it off; "false" is the only stored off value.
// Written only by PUT /api/professor-mari/workspace/skill-gate. Read fresh on every app_data call.
export const MARI_SKILL_GATE_SETTINGS_KEY = "mari-skill-gate";
