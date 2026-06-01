import type { MessageAttachment } from "../../../../../engine/contracts/types/chat";

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isMessageAttachment(value: unknown): value is MessageAttachment {
  return isRecord(value);
}

export function messageAttachmentsFromExtra(extra: { attachments?: unknown } | null | undefined): MessageAttachment[] {
  return Array.isArray(extra?.attachments) ? extra.attachments.filter(isMessageAttachment) : [];
}

export function isImageMessageAttachment(attachment: MessageAttachment): boolean {
  return attachment.type === "image" || attachment.type?.startsWith("image/") === true;
}

export function messageAttachmentImageSource(attachment: MessageAttachment): string | null {
  const source = attachment.url ?? attachment.data;
  return typeof source === "string" && source.length > 0 ? source : null;
}

export function messageAttachmentImageAlt(attachment: MessageAttachment): string {
  const alt = attachment.filename ?? attachment.name;
  return typeof alt === "string" && alt.trim().length > 0 ? alt : "image";
}
