import type { StorageGateway } from "../../capabilities/storage";
import { readString } from "../value-readers";

export type PromptAttachment = {
  type?: string | null;
  url?: string | null;
  data?: string | null;
  imageUrl?: string | null;
  filePath?: string | null;
  filename?: string | null;
  name?: string | null;
  prompt?: string | null;
  galleryId?: string | null;
};

export interface PreparedManagedImageAttachments {
  attachments: PromptAttachment[];
  createdGalleryIds: string[];
}

const IMAGE_ATTACHMENT_PROVIDER_BYTE_LIMIT = 6 * 1024 * 1024;

export function isImageAttachment(attachment: PromptAttachment): boolean {
  const type = readString(attachment.type).toLowerCase();
  return type === "image" || type.startsWith("image/");
}

function inlineImageDataUrl(value: unknown): string {
  const text = readString(value).trim();
  return text.toLowerCase().startsWith("data:image/") ? text : "";
}

function attachmentInlineImageDataUrl(attachment: PromptAttachment): string {
  return (
    inlineImageDataUrl(attachment.data) ||
    inlineImageDataUrl(attachment.url) ||
    inlineImageDataUrl(attachment.imageUrl)
  );
}

function hasManagedGalleryReference(attachment: PromptAttachment): boolean {
  return !!readString(attachment.galleryId).trim() || !!readString(attachment.filePath).trim();
}

function estimateDataUrlBytes(dataUrl: string): number {
  const commaIndex = dataUrl.indexOf(",");
  if (!dataUrl.startsWith("data:") || commaIndex < 0) return utf8ByteLength(dataUrl);

  const meta = dataUrl.slice(0, commaIndex).toLowerCase();
  const payload = dataUrl.slice(commaIndex + 1);
  if (!meta.includes(";base64")) {
    try {
      return utf8ByteLength(decodeURIComponent(payload));
    } catch {
      return utf8ByteLength(payload);
    }
  }

  const padding = payload.endsWith("==") ? 2 : payload.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((payload.length * 3) / 4) - padding);
}

function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

function isProviderSizedImageDataUrl(dataUrl: string): boolean {
  return estimateDataUrlBytes(dataUrl) <= IMAGE_ATTACHMENT_PROVIDER_BYTE_LIMIT;
}

function galleryStringField(row: unknown, field: string): string {
  return row && typeof row === "object" && !Array.isArray(row)
    ? readString((row as Record<string, unknown>)[field]).trim()
    : "";
}

export function getAttachmentFilename(attachment: PromptAttachment): string {
  const rawName = attachment.filename ?? attachment.name;
  return typeof rawName === "string" && rawName.trim() ? rawName.trim() : "attachment";
}

function attachmentFilename(attachment: PromptAttachment, index: number): string {
  const filename = getAttachmentFilename(attachment).trim();
  return filename && filename !== "attachment" ? filename : `attachment-${index + 1}`;
}

function managedAttachmentFromGallery(
  attachment: PromptAttachment,
  gallery: unknown,
  fallbackFilename: string,
): PromptAttachment {
  const url = galleryStringField(gallery, "url") || readString(attachment.url).trim();
  const galleryId = galleryStringField(gallery, "id") || readString(attachment.galleryId).trim();
  const filePath = galleryStringField(gallery, "filePath") || readString(attachment.filePath).trim();
  const filename = galleryStringField(gallery, "filename") || readString(attachment.filename).trim() || fallbackFilename;
  const name = readString(attachment.name).trim() || filename;
  const next: PromptAttachment = {
    ...attachment,
    data: null,
    filename,
    name,
  };
  if (url) next.url = url;
  if (galleryId) next.galleryId = galleryId;
  if (filePath) next.filePath = filePath;
  if (inlineImageDataUrl(attachment.imageUrl) && url) next.imageUrl = url;
  return next;
}

function managedAttachmentFromReference(attachment: PromptAttachment, fallbackFilename: string): PromptAttachment {
  const filename = readString(attachment.filename).trim() || readString(attachment.name).trim() || fallbackFilename;
  return {
    ...attachment,
    data: null,
    filename,
    name: readString(attachment.name).trim() || filename,
  };
}

async function deleteGalleryIds(storage: StorageGateway, galleryIds: string[]): Promise<void> {
  const uniqueIds = Array.from(new Set(galleryIds.map((id) => id.trim()).filter(Boolean)));
  await Promise.all(uniqueIds.map((id) => storage.delete("gallery", id)));
}

export async function prepareManagedImageAttachmentBatch(
  storage: StorageGateway,
  chatId: string,
  attachments: PromptAttachment[] | undefined,
): Promise<PreparedManagedImageAttachments> {
  const normalizedAttachments = attachments ?? [];
  if (normalizedAttachments.length === 0) return { attachments: [], createdGalleryIds: [] };

  const normalizedChatId = readString(chatId).trim();
  if (!normalizedChatId) return { attachments: normalizedAttachments, createdGalleryIds: [] };

  const managed: PromptAttachment[] = [];
  const createdGalleryIds: string[] = [];
  try {
    for (let index = 0; index < normalizedAttachments.length; index += 1) {
      const attachment = normalizedAttachments[index]!;
      if (!isImageAttachment(attachment)) {
        managed.push(attachment);
        continue;
      }

      if (hasManagedGalleryReference(attachment)) {
        managed.push(managedAttachmentFromReference(attachment, attachmentFilename(attachment, index)));
        continue;
      }

      const dataUrl = attachmentInlineImageDataUrl(attachment);
      if (!dataUrl) {
        managed.push(attachment);
        continue;
      }

      const filename = attachmentFilename(attachment, index);
      const gallery = await storage.create<Record<string, unknown>>("gallery", {
        chatId: normalizedChatId,
        filePath: filename,
        filename,
        kind: "attachment",
        prompt: attachment.prompt ?? null,
        url: dataUrl,
      });
      const galleryId = galleryStringField(gallery, "id");
      if (!galleryId) throw new Error("Managed image attachment was saved without a gallery id.");
      createdGalleryIds.push(galleryId);
      managed.push(managedAttachmentFromGallery(attachment, gallery, filename));
    }
  } catch (error) {
    await deleteGalleryIds(storage, createdGalleryIds).catch(() => undefined);
    throw error;
  }

  return { attachments: managed, createdGalleryIds };
}

export async function deletePreparedManagedImageAttachments(
  storage: StorageGateway,
  prepared: PreparedManagedImageAttachments,
): Promise<void> {
  await deleteGalleryIds(storage, prepared.createdGalleryIds);
}

export async function resolveImageAttachmentDataUrls(
  storage: StorageGateway,
  attachments: PromptAttachment[] | undefined,
): Promise<string[]> {
  const images: string[] = [];
  for (const attachment of attachments ?? []) {
    if (!isImageAttachment(attachment)) continue;
    const inline = attachmentInlineImageDataUrl(attachment);
    if (inline) {
      if (isProviderSizedImageDataUrl(inline)) images.push(inline);
      continue;
    }

    const resolved = await storage.resolveImageAttachmentDataUrl?.(attachment);
    if (resolved && isProviderSizedImageDataUrl(resolved)) images.push(resolved);
  }
  return images;
}
