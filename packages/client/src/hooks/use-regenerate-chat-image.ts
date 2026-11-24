// ──────────────────────────────────────────────
// Hook: Regenerate a chat gallery image (#7767)
// ──────────────────────────────────────────────
// Kept out of use-gallery.ts on purpose: that file is reachable from the e2e type graph
// (slash-commands -> gallery.store), and importing use-chats there pulls in half the client.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api-client";
import { chatKeys } from "./use-chats";
import { galleryKeys, type ChatImage, type RegenerateChatImageInput } from "./use-gallery";
import { gameStoryboardKeys } from "./use-game-storyboards";

export function useChatImageEditConnection(chatId: string, imageId: string, enabled: boolean) {
  return useQuery({
    queryKey: [...galleryKeys.all, "edit-connection", chatId, imageId],
    queryFn: () =>
      api.get<{ connectionId: string | null }>(
        `/gallery/${chatId}/images/${encodeURIComponent(imageId)}/edit-connection`,
      ),
    enabled: enabled && Boolean(chatId && imageId),
    staleTime: 0,
  });
}

/** Re-send an image's final request, possibly edited; the new image replaces it in messages and storyboards. */
export function useRegenerateChatImage(chatId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ imageId, ...input }: RegenerateChatImageInput) =>
      api.post<{ image: ChatImage; replacedMessageIds: string[]; replacedKeyframeIds: string[] }>(
        `/gallery/${chatId}/images/${encodeURIComponent(imageId)}/regenerate`,
        input,
      ),
    onSuccess: (result) => {
      // The prefix, not this chat's keys: a Game gallery lists sibling sessions' images, and
      // regenerating one of those must refresh whichever gallery is open.
      const refreshedGallery = qc.invalidateQueries({ queryKey: galleryKeys.all });
      if (result.replacedMessageIds.length > 0) qc.invalidateQueries({ queryKey: chatKeys.messages(chatId) });
      if (result.replacedKeyframeIds.length > 0) qc.invalidateQueries({ queryKey: gameStoryboardKeys.chat(chatId) });
      return refreshedGallery;
    },
  });
}

export interface ImagePromptDraft {
  prompt: string;
  negativePrompt: string;
  characterPrompts: NonNullable<RegenerateChatImageInput["characterPrompts"]>;
}

export function useReviseChatImagePrompt(chatId: string) {
  return useMutation({
    mutationFn: ({
      imageId,
      ...input
    }: ImagePromptDraft & { imageId: string; guidance: string; connectionId?: string; debugMode: boolean }) =>
      api.post<ImagePromptDraft>(`/gallery/${chatId}/images/${encodeURIComponent(imageId)}/regenerate/prompt`, input),
  });
}

export function useSelectChatImageVersion(chatId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (image: Pick<ChatImage, "id" | "chatId">) =>
      api.post<{ image: ChatImage }>(`/gallery/${image.chatId}/images/${encodeURIComponent(image.id)}/select`),
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: galleryKeys.all }),
        qc.invalidateQueries({ queryKey: chatKeys.all }),
        qc.invalidateQueries({ queryKey: gameStoryboardKeys.chat(chatId) }),
      ]),
  });
}

export function useDeleteChatImageVersions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      image,
      scope,
      versionIds,
    }: {
      image: Pick<ChatImage, "id" | "chatId">;
      scope: "version" | "others" | "stack";
      versionIds: string[];
    }) =>
      api.delete<{ deletedImageIds: string[]; selectedImageId: string | null }>(
        `/gallery/${image.chatId}/images/${encodeURIComponent(image.id)}/versions?scope=${scope}`,
        { versionIds },
      ),
    onSuccess: (_result, { image }) => {
      qc.invalidateQueries({ queryKey: galleryKeys.all });
      qc.invalidateQueries({ queryKey: chatKeys.all });
      qc.invalidateQueries({ queryKey: gameStoryboardKeys.chat(image.chatId) });
      qc.invalidateQueries({ queryKey: ["characters", "gallery"] });
      qc.invalidateQueries({ queryKey: ["persona-gallery"] });
    },
    onError: () => qc.invalidateQueries({ queryKey: galleryKeys.all }),
  });
}
