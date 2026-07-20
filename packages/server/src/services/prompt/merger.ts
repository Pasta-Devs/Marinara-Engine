// ──────────────────────────────────────────────
// Merger — Adjacent same-role message merging
// ──────────────────────────────────────────────
import type { ChatMLMessage } from "@marinara-engine/shared";

function hasSameAudience(first: ChatMLMessage | undefined, second: ChatMLMessage): boolean {
  const firstAudience = first?.hiddenFromAICharacterIds ?? [];
  const secondAudience = second.hiddenFromAICharacterIds ?? [];
  return (
    firstAudience.length === secondAudience.length &&
    firstAudience.every((characterId) => secondAudience.includes(characterId))
  );
}

/**
 * Merge consecutive messages that share the same role, with a double-newline separator.
 *
 * Rules:
 * - Only merges when adjacent messages share the **exact same** role, the same
 *   `characterId` (including both unset), and a compatible `contextKind` (equal, or
 *   one/both unset).
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

  const mergeContextKind = (a?: ChatMLMessage["contextKind"], b?: ChatMLMessage["contextKind"]) => {
    if (a === b) return a;
    return undefined;
  };

  const canMerge = (a: ChatMLMessage, b: ChatMLMessage) => {
    if (a.role !== b.role) return false;
    if ((a.characterId ?? null) !== (b.characterId ?? null)) return false;
    if (!hasSameAudience(a, b)) return false;
    if (!a.contextKind || !b.contextKind) return true;
    return a.contextKind === b.contextKind;
  };

  for (const msg of messages) {
    // Skip empty messages unless they carry provider-native attachments.
    if (!msg.content.trim() && !msg.images?.length && !msg.files?.length) continue;

    if (current && canMerge(current, msg)) {
      // Same role — merge
      const mergedImages: string[] | undefined =
        current.images || msg.images ? [...(current.images ?? []), ...(msg.images ?? [])] : undefined;
      const mergedFiles: ChatMLMessage["files"] | undefined =
        current.files || msg.files ? [...(current.files ?? []), ...(msg.files ?? [])] : undefined;
      // Prefer the later message's providerMetadata (most recent thought signature)
      const mergedMeta: Record<string, unknown> | undefined = msg.providerMetadata ?? current.providerMetadata;
      const mergedContextKind = mergeContextKind(current.contextKind, msg.contextKind);
      current = {
        role: current.role,
        content: current.content + "\n\n" + msg.content,
        ...(mergedContextKind ? { contextKind: mergedContextKind } : {}),
        name: current.name,
        ...(current.characterId ? { characterId: current.characterId } : {}),
        ...(current.hiddenFromAICharacterIds?.length
          ? { hiddenFromAICharacterIds: current.hiddenFromAICharacterIds }
          : {}),
        ...(mergedImages ? { images: mergedImages } : {}),
        ...(mergedFiles ? { files: mergedFiles } : {}),
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
 * Squash contiguous leading system messages with the same character audience
 * (used when `squashSystemMessages` is enabled), then keep the rest.
 */
export function squashLeadingSystemMessages(messages: ChatMLMessage[]): ChatMLMessage[] {
  if (messages.length === 0) return [];

  // Find the end of leading system messages
  let systemEnd = 0;
  while (systemEnd < messages.length && messages[systemEnd]!.role === "system") {
    systemEnd++;
  }

  if (systemEnd <= 1) return messages; // Nothing to squash

  const leadingSystemMessages = messages.slice(0, systemEnd);
  const squashRun = (run: ChatMLMessage[]): ChatMLMessage => {
    if (run.length === 1) return run[0]!;
    const contextKinds = new Set(run.map((message) => message.contextKind).filter(Boolean));
    return {
      role: "system",
      content: run.map((message) => message.content).join("\n\n"),
      ...(contextKinds.size === 1 ? { contextKind: [...contextKinds][0] } : {}),
      ...(run[0]?.hiddenFromAICharacterIds?.length
        ? { hiddenFromAICharacterIds: run[0].hiddenFromAICharacterIds }
        : {}),
    };
  };

  const squashedSystemMessages: ChatMLMessage[] = [];
  let runStart = 0;
  for (let index = 1; index <= leadingSystemMessages.length; index += 1) {
    if (
      index < leadingSystemMessages.length &&
      hasSameAudience(leadingSystemMessages[runStart], leadingSystemMessages[index]!)
    ) {
      continue;
    }
    squashedSystemMessages.push(squashRun(leadingSystemMessages.slice(runStart, index)));
    runStart = index;
  }

  return [...squashedSystemMessages, ...messages.slice(systemEnd)];
}
