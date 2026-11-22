// ──────────────────────────────────────────────
// Peek prompt: where injected blocks went
//
// Post-processing ("Apply", the default) turns a system block injected at a depth (the Author's Note,
// World Info @depth) into part of the nearby user message. The model gets it there, so Peek prompt shows a
// "You" message, but it should still say what that text is. These helpers find each injected block in the
// final messages and keep its range for Peek only. Nothing here changes what is sent.
// ──────────────────────────────────────────────
/** A block injected at a depth, as Peek prompt names it. */
export interface PeekInjectedBlock {
  label: "authorsNote" | "worldInfo";
  depth: number;
  content: string;
}

/** Where an injected block sits inside a final message that also holds other text (Peek prompt only). */
export interface PeekPromptPart {
  start: number;
  end: number;
  label: PeekInjectedBlock["label"];
  depth: number;
}

/**
 * Finds each injected block inside the final messages. A block that post-processing merged into a bigger
 * message (or turned into another role) gets a part with its range, so Peek prompt can name it there. A block
 * still sent as its own message needs none. Reads the messages only: what is sent doesn't change.
 */
export function labelInjectedParts<T extends { role: string; content: unknown }>(
  messages: T[],
  blocks: PeekInjectedBlock[],
): Array<{ message: T; parts: PeekPromptPart[] }> {
  const parts = messages.map(() => [] as PeekPromptPart[]);
  const taken = messages.map(() => [] as Array<[number, number]>);
  for (const block of blocks) {
    const text = block.content;
    if (!text) continue;
    // Injections sit near the end, so search from there: chat history may hold the same words earlier.
    for (let index = messages.length - 1; index >= 0; index--) {
      const content = messages[index]!.content;
      if (typeof content !== "string") continue;
      let start = content.indexOf(text);
      while (start >= 0 && taken[index]!.some(([from, to]) => start < to && start + text.length > from)) {
        start = content.indexOf(text, start + 1);
      }
      if (start < 0) continue;
      taken[index]!.push([start, start + text.length]);
      const standsAlone = content.trim() === text.trim() && messages[index]!.role === "system";
      if (!standsAlone) parts[index]!.push({ start, end: start + text.length, label: block.label, depth: block.depth });
      break;
    }
  }
  return messages.map((message, index) => ({
    message,
    parts: parts[index]!.sort((a, b) => a.start - b.start),
  }));
}

/** Lorebook depth entries as Peek prompt blocks. */
export function worldInfoPeekBlocks(entries: ReadonlyArray<{ content: string; depth: number }> | null | undefined) {
  return (entries ?? [])
    .filter((entry) => entry.content.trim())
    .map((entry): PeekInjectedBlock => ({ label: "worldInfo", depth: entry.depth, content: entry.content }));
}

/** Parts read back from a saved request: only well-formed ranges inside the message. */
export function readPeekPromptParts(value: unknown, contentLength: number): PeekPromptPart[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((part): PeekPromptPart[] => {
    if (!part || typeof part !== "object") return [];
    const { start, end, label, depth } = part as Record<string, unknown>;
    if (label !== "authorsNote" && label !== "worldInfo") return [];
    if (!Number.isInteger(start) || !Number.isInteger(end)) return [];
    if ((start as number) < 0 || (end as number) <= (start as number) || (end as number) > contentLength) return [];
    return [
      {
        start: start as number,
        end: end as number,
        label,
        depth: Number.isInteger(depth) ? (depth as number) : 0,
      },
    ];
  });
}
