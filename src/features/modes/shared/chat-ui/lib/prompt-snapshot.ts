import type { Message } from "../../../../../engine/contracts/types/chat";

type GenerationPromptSnapshot = Message["extra"]["generationPromptSnapshot"];

/**
 * Resolve the prompt snapshot to show for a message, honoring per-swipe history.
 *
 * Generation stores a snapshot per swipe in `generationPromptSnapshotsBySwipe`
 * (keyed by swipe index) plus a singular `generationPromptSnapshot` tracking the
 * active swipe. Prefer the entry for the active swipe, then fall back to the
 * singular field. Returns null when neither is present (caller then rebuilds).
 *
 * Imported legacy (v1.6.1-era) prompts live under `extra.cachedPrompt` and are
 * synthesized into `generationPromptSnapshot` at the storage projection boundary
 * ([project_timeline_message] in src-tauri), so this resolver only needs to know
 * about the current snapshot fields.
 */
export function resolvePromptSnapshotFromExtra(
  extra: unknown,
  activeSwipeIndex?: number | null,
): GenerationPromptSnapshot | null {
  if (!extra || typeof extra !== "object" || Array.isArray(extra)) return null;
  const record = extra as Record<string, unknown>;
  const index =
    typeof activeSwipeIndex === "number" && Number.isFinite(activeSwipeIndex)
      ? Math.max(0, Math.trunc(activeSwipeIndex))
      : 0;

  const bySwipe = record.generationPromptSnapshotsBySwipe;
  if (bySwipe && typeof bySwipe === "object" && !Array.isArray(bySwipe)) {
    const entry = (bySwipe as Record<string, unknown>)[String(index)];
    if (entry) return entry as GenerationPromptSnapshot;
  }

  const single = record.generationPromptSnapshot;
  return single ? (single as GenerationPromptSnapshot) : null;
}
