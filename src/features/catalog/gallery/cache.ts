import type { QueryClient } from "@tanstack/react-query";
import { galleryKeys } from "./query-keys";

type ManagedAttachmentGalleryReference = {
  galleryId?: string | null;
  filePath?: string | null;
};

function hasManagedGalleryReference(attachment: ManagedAttachmentGalleryReference): boolean {
  return !!attachment.galleryId?.trim() || !!attachment.filePath?.trim();
}

export function invalidateGalleryImagesForManagedAttachments(
  queryClient: QueryClient,
  chatId: string | null | undefined,
  attachments: readonly ManagedAttachmentGalleryReference[],
): void {
  const normalizedChatId = chatId?.trim();
  if (!normalizedChatId || !attachments.some(hasManagedGalleryReference)) return;
  void queryClient.invalidateQueries({ queryKey: galleryKeys.images(normalizedChatId) });
}
