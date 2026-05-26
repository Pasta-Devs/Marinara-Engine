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

export function chatGalleryUploadFailureError(fileCount: number, failures: unknown[]): Error {
  if (fileCount === 1 && failures[0] instanceof Error) {
    return failures[0];
  }

  const failedCount = failures.length;
  return new Error(
    failedCount === 1 ? "One chat gallery image failed to upload." : `${failedCount} chat gallery images failed to upload.`,
  );
}

export function useUploadGalleryImage(chatId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (files: File[]) => {
      if (!chatId) return [];
      const uploaded: ChatImage[] = [];
      const failures: unknown[] = [];

      for (const file of files) {
        try {
          uploaded.push(await galleryApi.uploadChat<ChatImage>(chatId, file));
        } catch (error) {
          failures.push(error);
        }
      }

      if (failures.length > 0) {
        throw chatGalleryUploadFailureError(files.length, failures);
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
