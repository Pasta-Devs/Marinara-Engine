// ──────────────────────────────────────────────
// Hook: Chat Gallery Images
// ──────────────────────────────────────────────
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api-client";
import type { GeneratedSceneVideo } from "@marinara-engine/shared";

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
  sceneVideos: (chatId: string) => ["gallery", "scene-videos", chatId] as const,
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

export function useSceneVideos(chatId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: galleryKeys.sceneVideos(chatId!),
    queryFn: async () => {
      const result = await api.get<{ videos: GeneratedSceneVideo[] }>(`/gallery/scene-videos/${chatId}`);
      return result.videos;
    },
    enabled: enabled && !!chatId,
    staleTime: 30_000,
  });
}

export function useDeleteSceneVideo(chatId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (videoId: string) => api.delete(`/gallery/scene-videos/${chatId}/${videoId}`),
    onMutate: async (videoId) => {
      await qc.cancelQueries({ queryKey: galleryKeys.sceneVideos(chatId) });
      const previousVideos = qc.getQueryData<GeneratedSceneVideo[]>(galleryKeys.sceneVideos(chatId));
      qc.setQueryData<GeneratedSceneVideo[]>(galleryKeys.sceneVideos(chatId), (old) =>
        old?.filter((video) => video.id !== videoId),
      );
      return { previousVideos };
    },
    onError: (_error, _videoId, context) => {
      if (context?.previousVideos) qc.setQueryData(galleryKeys.sceneVideos(chatId), context.previousVideos);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: galleryKeys.sceneVideos(chatId) });
    },
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

export function useGenerateGallerySelfie(chatId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      characterId: string;
      context?: string;
      promptOverride?: string;
      negativePromptOverride?: string;
      queueImageGenerationRequests?: boolean;
      debugMode?: boolean;
    }) => api.post<ChatImage>(`/gallery/${chatId}/selfie`, input),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: galleryKeys.chat(chatId) });
      qc.invalidateQueries({ queryKey: galleryKeys.assets(chatId) });
    },
  });
}

export function useDeleteGalleryImage(chatId: string) {
  const qc = useQueryClient();
  return useMutation({
    // The wire-level chatId is the image row's OWN owner, not this hook's
    // ambient chatId: a Game-mode gallery aggregates sibling sessions'
    // images, so the two can differ. The server scopes the lookup by the
    // hint (#5615), and a wrong owner would 404 the delete. The ambient
    // chatId stays correct for the cache keys — that is what the list
    // queries are keyed on.
    mutationFn: ({ imageId, chatId: ownerChatId }: { imageId: string; chatId: string }) =>
      api.delete(`/gallery/${imageId}?chatId=${encodeURIComponent(ownerChatId)}`),
    onMutate: async ({ imageId }) => {
      await Promise.all([
        qc.cancelQueries({ queryKey: galleryKeys.chat(chatId) }),
        qc.cancelQueries({ queryKey: galleryKeys.assets(chatId) }),
      ]);

      const previousImages = qc.getQueryData<ChatImage[]>(galleryKeys.chat(chatId));
      const previousAssets = qc.getQueryData<ChatAssetBrowserItem[]>(galleryKeys.assets(chatId));

      qc.setQueryData<ChatImage[]>(galleryKeys.chat(chatId), (old) => old?.filter((image) => image.id !== imageId));
      qc.setQueryData<ChatAssetBrowserItem[]>(galleryKeys.assets(chatId), (old) =>
        old?.filter((asset) => asset.id !== imageId && asset.id !== `chat-gallery:${imageId}`),
      );

      return { previousImages, previousAssets };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousImages) qc.setQueryData(galleryKeys.chat(chatId), context.previousImages);
      if (context?.previousAssets) qc.setQueryData(galleryKeys.assets(chatId), context.previousAssets);
    },
    onSettled: (_data, _error, variables) => {
      qc.invalidateQueries({ queryKey: galleryKeys.chat(chatId) });
      qc.invalidateQueries({ queryKey: galleryKeys.assets(chatId) });
      // A Game-mode gallery can delete a sibling session's image; that
      // session's own cached lists must not keep showing the deleted row.
      if (variables && variables.chatId !== chatId) {
        qc.invalidateQueries({ queryKey: galleryKeys.chat(variables.chatId) });
        qc.invalidateQueries({ queryKey: galleryKeys.assets(variables.chatId) });
      }
    },
  });
}
