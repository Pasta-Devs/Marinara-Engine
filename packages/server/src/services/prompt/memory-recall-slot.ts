import { randomUUID } from "node:crypto";

/**
 * Where a preset's Memory Recall marker puts recalled memories. The assembler emits this token; generation fills it
 * with the memories block, and every prompt that does not run Memory Recall drops it.
 */
export const MEMORY_RECALL_SLOT_TOKEN = `__MARINARA_MEMORY_RECALL_${randomUUID()}__`;

/** Put `block` where the Memory Recall marker is. Returns false when the prompt has no marker. */
export function fillMemoryRecallSlot(messages: Array<{ content: string }>, block: string): boolean {
  const slot = messages.find((message) => message.content.includes(MEMORY_RECALL_SLOT_TOKEN));
  if (!slot) return false;
  slot.content = slot.content.replace(MEMORY_RECALL_SLOT_TOKEN, () => block);
  return true;
}

/** Remove an unfilled Memory Recall marker, and any message it leaves empty. */
export function stripMemoryRecallSlot<T extends { content: string }>(messages: T[]): T[] {
  if (!messages.some((message) => message.content.includes(MEMORY_RECALL_SLOT_TOKEN))) return messages;
  return messages
    .map((message) =>
      message.content.includes(MEMORY_RECALL_SLOT_TOKEN)
        ? { ...message, content: message.content.split(MEMORY_RECALL_SLOT_TOKEN).join("").trim() }
        : message,
    )
    .filter((message) => message.content.length > 0);
}
