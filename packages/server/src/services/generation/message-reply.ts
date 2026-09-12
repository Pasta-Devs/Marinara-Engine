import { messageReplySchema } from "@marinara-engine/shared";

/** Stored/imported extras are untrusted. Older turns never repeat their quoted snapshot. */
export function withLatestMessageReply(content: string, reply: unknown, isLatestUserMessage: boolean): string {
  if (!isLatestUserMessage) return content;
  const parsed = messageReplySchema.safeParse(reply);
  if (!parsed.success) return content;
  const quote = parsed.data.content
    .split(/\r?\n/)
    .map((line) => `> ${line}`)
    .join("\n");
  return `Replying to ${parsed.data.name}:\n${quote}\n\n${content}`;
}
