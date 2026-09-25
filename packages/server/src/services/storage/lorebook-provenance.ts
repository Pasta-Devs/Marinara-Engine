// Message-provenance parsing shared by the lorebook store and the chat
// message-delete cascade. A leaf module on purpose: lorebooks.storage already
// imports chats.storage, so neither side can host this without a cycle.
import type { SourceMessageRef } from "@marinara-engine/shared";

/**
 * Parse an entry's source-ref JSON column. Accepts the stored shape
 * ({ id, swipeIndex } objects) and bare id strings, dropping malformed
 * entries and de-duplicating on (id, swipeIndex) so repeated writes over the
 * same turn cannot grow the array unboundedly.
 */
export function parseSourceMessageRefs(value: unknown): SourceMessageRef[] {
  const normalize = (items: unknown[]): SourceMessageRef[] =>
    items
      .map((item) => {
        if (typeof item === "string") return { id: item, swipeIndex: null };
        if (item && typeof item === "object" && typeof (item as { id?: unknown }).id === "string") {
          const swipeIndex = (item as { swipeIndex?: unknown }).swipeIndex;
          return {
            id: (item as { id: string }).id,
            swipeIndex: typeof swipeIndex === "number" ? swipeIndex : null,
          };
        }
        return null;
      })
      .filter((ref): ref is SourceMessageRef => ref !== null && ref.id.trim().length > 0)
      .filter(
        (ref, index, all) =>
          all.findIndex((other) => other.id === ref.id && other.swipeIndex === ref.swipeIndex) === index,
      );
  if (Array.isArray(value)) return normalize(value);
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? normalize(parsed) : [];
  } catch {
    return [];
  }
}
