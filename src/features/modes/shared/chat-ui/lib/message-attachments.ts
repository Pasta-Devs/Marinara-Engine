import type { MessageAttachment, MessageAttachmentExtraValue } from "../../../../../engine/contracts/types/chat";

const MESSAGE_ATTACHMENT_KEYS = [
  "type",
  "url",
  "data",
  "imageUrl",
  "filePath",
  "filename",
  "name",
  "prompt",
  "galleryId",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function hasOwnKey(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function isKnownAttachmentValue(value: unknown): value is string | null | undefined {
  return value == null || typeof value === "string";
}

function isAttachmentExtraValue(value: unknown): value is MessageAttachmentExtraValue {
  return value == null || ["string", "number", "boolean"].includes(typeof value);
}

function hasKnownAttachmentField(record: Record<string, unknown>): boolean {
  return MESSAGE_ATTACHMENT_KEYS.some((key) => hasOwnKey(record, key) && isKnownAttachmentValue(record[key]));
}

function hasValidKnownAttachmentFields(record: Record<string, unknown>): boolean {
  return MESSAGE_ATTACHMENT_KEYS.every((key) => !hasOwnKey(record, key) || isKnownAttachmentValue(record[key]));
}

function isMessageAttachment(value: unknown): value is MessageAttachment {
  return (
    isRecord(value) &&
    hasKnownAttachmentField(value) &&
    hasValidKnownAttachmentFields(value) &&
    Object.values(value).every(isAttachmentExtraValue)
  );
}

export function messageAttachmentsFromExtra(extra: { attachments?: unknown } | null | undefined): MessageAttachment[] {
  const attachments = extra?.attachments;
  if (attachments == null) return [];
  if (!Array.isArray(attachments)) {
    console.warn("[chat-ui] Ignored malformed message attachments payload", { reason: "not-array" });
    return [];
  }

  const valid = attachments.filter(isMessageAttachment);
  const dropped = attachments.length - valid.length;
  if (dropped > 0) {
    console.warn("[chat-ui] Dropped malformed message attachment(s)", { dropped, total: attachments.length });
  }
  return valid;
}

export function isImageMessageAttachment(attachment: MessageAttachment): boolean {
  return attachment.type === "image" || attachment.type?.startsWith("image/") === true;
}

export function messageAttachmentImageSource(attachment: MessageAttachment): string | null {
  const source = [attachment.url, attachment.imageUrl, attachment.data].find(
    (value): value is string => typeof value === "string" && value.length > 0,
  );
  return source ?? null;
}

export function messageAttachmentImageAlt(attachment: MessageAttachment): string {
  const alt = attachment.filename ?? attachment.name;
  return typeof alt === "string" && alt.trim().length > 0 ? alt : "image";
}
