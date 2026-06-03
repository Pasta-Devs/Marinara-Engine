import type { Message } from "../../../../../engine/contracts/types/chat";

type GenerationPromptSnapshot = Message["extra"]["generationPromptSnapshot"];

/**
 * Resolve the prompt snapshot to show for a message, honoring legacy per-swipe
 * history.
 *
 * Newer storage records keep prompt snapshots on `swipes[].extra`; the storage
 * projection materializes the active swipe into the singular
 * `generationPromptSnapshot`. Prefer legacy `generationPromptSnapshotsBySwipe`
 * only when it is still present on older records, then fall back to the singular
 * field. Returns null when neither is present (caller then rebuilds).
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
