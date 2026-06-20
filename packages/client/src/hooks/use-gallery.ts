// ──────────────────────────────────────────────
// Hook: Chat Gallery Images
// ──────────────────────────────────────────────
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api-client";

export interface ChatImage {
  id: string;
  chatId: string;
  filePath: string;
  prompt: string;
  provider: string;
  model: string;
  width: number | null;
  height: number | null;
  createdAt: string;
  url: string;
}

export interface ChatAssetBrowserItem {
  id: string;
  kind: "chat-gallery" | "character-gallery" | "persona-gallery" | "sprite";
  ownerType: "chat" | "character" | "persona";
  ownerId: string;
  ownerName: string;
  name: string;
  prompt: string;
  width: number | null;
  height: number | null;
  createdAt: string | null;
  url: string;
  cardUrl: string;
}

const galleryKeys = {
  all: ["gallery"] as const,
  chat: (chatId: string) => ["gallery", chatId] as const,
  assets: (chatId: string) => ["gallery", "assets", chatId] as const,
};

export function useGalleryImages(chatId: string | undefined) {
  return useQuery({
    queryKey: galleryKeys.chat(chatId!),
    queryFn: () => api.get<ChatImage[]>(`/gallery/${chatId}`),
    enabled: !!chatId,
    staleTime: 5 * 60_000,
  });
}

export function useChatAssetBrowser(chatId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: galleryKeys.assets(chatId!),
    queryFn: () => api.get<ChatAssetBrowserItem[]>(`/gallery/assets/${chatId}`),
    enabled: enabled && !!chatId,
    staleTime: 5 * 60_000,
  });
}

export function useUploadGalleryImage(chatId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (files: File[]) => {
      const uploads = await Promise.allSettled(
        files.map((file) => {
          const formData = new FormData();
          formData.append("file", file);
          return api.upload<ChatImage>(`/gallery/${chatId}/upload`, formData);
        }),
      );

      const successfulUploads = uploads.filter(
        (result): result is PromiseFulfilledResult<ChatImage> => result.status === "fulfilled",
      );

      if (successfulUploads.length !== uploads.length) {
        const failedCount = uploads.length - successfulUploads.length;
        throw new Error(
          failedCount === 1 ? "One gallery image failed to upload." : `${failedCount} gallery images failed to upload.`,
        );
      }

      return successfulUploads.map((result) => result.value);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: galleryKeys.chat(chatId) });
    },
  });
}

export function useDeleteGalleryImage(chatId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (imageId: string) => api.delete(`/gallery/${imageId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: galleryKeys.chat(chatId) });
    },
  });
}
