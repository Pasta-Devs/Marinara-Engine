import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { galleryKeys } from "../query-keys";
import { galleryApi } from "../../../../shared/api/image-generation-api";
import { storageApi } from "../../../../shared/api/storage-api";
import type { ChatImage } from "../../../../shared/types/gallery";

export function useGalleryImages(chatId: string | null) {
  return useQuery({
    queryKey: galleryKeys.images(chatId),
    queryFn: () => storageApi.list<ChatImage>("gallery", { filters: { chatId } }),
    enabled: !!chatId,
    retry: false,
  });
}

export function useUploadGalleryImage(chatId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (files: File[]) => {
      if (!chatId) return [];
      const uploaded: ChatImage[] = [];
      let failedCount = 0;

      for (const file of files) {
        try {
          uploaded.push(await galleryApi.uploadChat<ChatImage>(chatId, file));
        } catch {
          failedCount += 1;
        }
      }

      if (failedCount > 0) {
        throw new Error(
          failedCount === 1
            ? "One chat gallery image failed to upload."
            : `${failedCount} chat gallery images failed to upload.`,
        );
      }

      return uploaded;
    },
    onSettled: () => {
      if (chatId) {
        queryClient.invalidateQueries({ queryKey: galleryKeys.images(chatId) });
      }
    },
    meta: { chatId },
  });
}

export function useDeleteGalleryImage(chatId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (imageId: string) => storageApi.delete("gallery", imageId),
    onSuccess: () => {
      if (chatId) {
        queryClient.invalidateQueries({ queryKey: galleryKeys.images(chatId) });
      }
    },
    meta: { chatId },
  });
}
