// ──────────────────────────────────────────────
// Peek prompt: where injected blocks went
//
// Post-processing ("Apply", the default) turns a system block injected at a depth (the Author's Note,
// World Info @depth) into part of the nearby user message. The model gets it there, so Peek prompt shows a
// "You" message, but it should still say what that text is. These helpers find each injected block in the
// final messages and keep its range for Peek only. Nothing here changes what is sent.
// ──────────────────────────────────────────────
import type { PeekPromptPart } from "@marinara-engine/shared";

export type { PeekPromptPart };

/** A block injected at a depth, as Peek prompt names it. */
export interface PeekInjectedBlock {
  label: PeekPromptPart["label"];
  depth: number;
  content: string;
}

/** The blank-line cleanup prompt shaping applies to every message, so an injected block can be found after it. */
function collapseBlankLines(text: string): string {
  return text.replace(/\n([ \t]*\n){2,}/g, "\n\n");
}

/** A block stands on its own lines when post-processing joins it to other text: not mid-sentence like a quote. */
function onOwnLines(content: string, start: number, end: number): boolean {
  return (start === 0 || content[start - 1] === "\n") && (end === content.length || content[end] === "\n");
}

/**
 * Finds each injected block inside the final messages. A block that post-processing merged into a bigger
 * message (or turned into another role) gets a part with its range, so Peek prompt can name it there. A block
 * still sent as its own message needs none. Reads the messages only: what is sent doesn't change.
 *
 * Chat history can hold the same words (an older copy, or a later message quoting the note), so a copy is picked
 * by where the block was put: the message whose number of later chat messages is closest to its depth, then a
 * copy on its own lines over one inside a sentence.
 */
export function labelInjectedParts<T extends { role: string; content: unknown }>(
  messages: T[],
  blocks: PeekInjectedBlock[],
): Array<{ message: T; parts: PeekPromptPart[] }> {
  const parts = messages.map(() => [] as PeekPromptPart[]);
  const taken = messages.map(() => [] as Array<[number, number]>);
  // Chat messages (user/assistant) after each message: how deep it sits.
  const chatAfter: number[] = new Array(messages.length).fill(0);
  for (let index = messages.length - 2; index >= 0; index--) {
    const next = messages[index + 1]!.role;
    chatAfter[index] = chatAfter[index + 1]! + (next === "user" || next === "assistant" ? 1 : 0);
  }
  for (const block of blocks) {
    if (!block.content.trim()) continue;
    const texts = [...new Set([block.content, collapseBlankLines(block.content)])];
    let best: { index: number; start: number; length: number; score: number } | null = null;
    for (let index = messages.length - 1; index >= 0; index--) {
      const content = messages[index]!.content;
      if (typeof content !== "string") continue;
      for (const text of texts) {
        for (let start = content.indexOf(text); start >= 0; start = content.indexOf(text, start + 1)) {
          const end = start + text.length;
          if (taken[index]!.some(([from, to]) => start < to && end > from)) continue;
          // Lower is better: distance from the depth first, then a copy inside a sentence.
          const score = Math.abs(chatAfter[index]! - block.depth) * 2 + (onOwnLines(content, start, end) ? 0 : 1);
          // Ties keep the later message (searched first) and, inside it, the first copy.
          if (!best || score < best.score) best = { index, start, length: text.length, score };
        }
      }
    }
    if (!best) continue;
    const { index, start, length } = best;
    const content = messages[index]!.content as string;
    taken[index]!.push([start, start + length]);
    const standsAlone =
      content.trim() === content.slice(start, start + length).trim() && messages[index]!.role === "system";
    if (!standsAlone) parts[index]!.push({ start, end: start + length, label: block.label, depth: block.depth });
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
