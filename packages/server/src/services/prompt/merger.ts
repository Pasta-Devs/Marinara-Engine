// ──────────────────────────────────────────────
// Merger — Adjacent same-role message merging
// ──────────────────────────────────────────────
import type { ChatMLMessage } from "@marinara-engine/shared";

/**
 * Merge consecutive messages that share the same role, with a double-newline separator.
 *
 * Rules:
 * - Only merges when adjacent messages have the **exact same** role.
 * - Preserves the `name` of the first message if set.
 * - Skips empty messages entirely.
 *
 * @example
 *   [{ role: "system", content: "A" }, { role: "system", content: "B" }, { role: "user", content: "C" }]
 *   → [{ role: "system", content: "A\n\nB" }, { role: "user", content: "C" }]
 */
export function mergeAdjacentMessages(messages: ChatMLMessage[]): ChatMLMessage[] {
  if (messages.length === 0) return [];

  const result: ChatMLMessage[] = [];
  let current: ChatMLMessage | null = null;

  for (const msg of messages) {
    // Skip empty messages
    if (!msg.content.trim()) continue;

    if (current && current.role === msg.role) {
      // Same role — merge
      const mergedImages: string[] | undefined =
        current.images || msg.images ? [...(current.images ?? []), ...(msg.images ?? [])] : undefined;
      // Prefer the later message's providerMetadata (most recent thought signature)
      const mergedMeta: Record<string, unknown> | undefined = msg.providerMetadata ?? current.providerMetadata;
      current = {
        role: current.role,
        content: current.content + "\n\n" + msg.content,
        name: current.name,
        ...(mergedImages ? { images: mergedImages } : {}),
        ...(mergedMeta ? { providerMetadata: mergedMeta } : {}),
      };
    } else {
      // Different role — push current and start new accumulator
      if (current) result.push(current);
      current = { ...msg };
    }
  }

  if (current) result.push(current);

  return result;
}

/**
 * Squash all system messages into one (used when `squashSystemMessages` is enabled).
 * Groups all consecutive system messages at the start, then keeps the rest.
 */
export function squashLeadingSystemMessages(messages: ChatMLMessage[]): ChatMLMessage[] {
  if (messages.length === 0) return [];

  // Find the end of leading system messages
  let systemEnd = 0;
  while (systemEnd < messages.length && messages[systemEnd]!.role === "system") {
    systemEnd++;
  }

  if (systemEnd <= 1) return messages; // Nothing to squash

  const combinedContent = messages
    .slice(0, systemEnd)
    .map((m) => m.content)
    .join("\n\n");

  return [{ role: "system", content: combinedContent }, ...messages.slice(systemEnd)];
}
