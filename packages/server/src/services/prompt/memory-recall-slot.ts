import { randomUUID } from "node:crypto";

/**
 * Where a preset's Memory Recall marker puts recalled memories. The assembler emits this token; generation fills it
 * with the memories block, and every prompt that does not run Memory Recall drops it.
 */
export const MEMORY_RECALL_SLOT_TOKEN = `__MARINARA_MEMORY_RECALL_${randomUUID()}__`;

/**
 * Around a preset group that holds nothing but the Memory Recall marker. Filled, the group wraps the memories; with
 * nothing recalled, the whole group goes, so no empty group container is sent.
 */
const groupNonce = randomUUID();
export const MEMORY_RECALL_GROUP_START = `__MARINARA_MEMORY_RECALL_GROUP_${groupNonce}_START__`;
export const MEMORY_RECALL_GROUP_END = `__MARINARA_MEMORY_RECALL_GROUP_${groupNonce}_END__`;
const groupSpan = new RegExp(`${MEMORY_RECALL_GROUP_START}[\\s\\S]*?${MEMORY_RECALL_GROUP_END}`, "gu");
const groupMarks = new RegExp(`${MEMORY_RECALL_GROUP_START}|${MEMORY_RECALL_GROUP_END}`, "gu");

/** Mark a group message whose only content is the Memory Recall marker, so an empty recall drops the group too. */
export function markMemoryRecallOnlyGroup(content: string): string {
  return `${MEMORY_RECALL_GROUP_START}${content}${MEMORY_RECALL_GROUP_END}`;
}

/** Put `block` where the Memory Recall marker is. Returns false when the prompt has no marker. */
export function fillMemoryRecallSlot(messages: Array<{ content: string }>, block: string): boolean {
  const slot = messages.find((message) => message.content.includes(MEMORY_RECALL_SLOT_TOKEN));
  if (!slot) return false;
  slot.content = slot.content.replace(MEMORY_RECALL_SLOT_TOKEN, () => block).replace(groupMarks, "");
  return true;
}

/** Remove an unfilled Memory Recall marker, and any message left with no text, images or files (#9765). */
export function stripMemoryRecallSlot<T extends { content: string; images?: unknown[]; files?: unknown[] }>(
  messages: T[],
): T[] {
  if (!messages.some((message) => message.content.includes(MEMORY_RECALL_SLOT_TOKEN))) return messages;
  return messages
    .map((message) =>
      message.content.includes(MEMORY_RECALL_SLOT_TOKEN)
        ? {
            ...message,
            content: message.content.replace(groupSpan, "").split(MEMORY_RECALL_SLOT_TOKEN).join("").trim(),
          }
        : message,
    )
    .filter((message) => message.content.length > 0 || message.images?.length || message.files?.length);
}
