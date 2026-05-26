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
      const uploads = await Promise.allSettled(files.map((file) => galleryApi.uploadChat<ChatImage>(chatId, file)));
      const successfulUploads = uploads.filter(
        (result): result is PromiseFulfilledResult<ChatImage> => result.status === "fulfilled",
      );

      if (successfulUploads.length !== uploads.length) {
        const failedCount = uploads.length - successfulUploads.length;
        throw new Error(
          failedCount === 1
            ? "One chat gallery image failed to upload."
            : `${failedCount} chat gallery images failed to upload.`,
        );
      }

      return successfulUploads.map((result) => result.value);
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
