/**
 * The message a rejected `audio.play()` should show in the custom Music DJ player, or null when it should show nothing
 * (#8618):
 * - a newer track took over (`attempt` is no longer the `current` source), so this attempt's outcome is stale;
 * - the attempt was cut short on purpose: a new track calls `pause()` and `load()`, which makes the browser reject the
 *   pending play with an `AbortError` ("The play() request was interrupted by …"). Nothing failed.
 * Genuine failures (an unsupported or missing file, autoplay blocked by the browser) still show.
 */
export function playbackErrorMessage(err: unknown, attempt: number, current: number): string | null {
  if (attempt !== current) return null;
  if ((err as { name?: unknown } | null)?.name === "AbortError") return null;
  return err instanceof Error && err.message ? err.message : "Local playback failed";
}
