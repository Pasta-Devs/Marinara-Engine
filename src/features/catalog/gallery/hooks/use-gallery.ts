import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { galleryKeys } from "../query-keys";
import { galleryApi } from "../../../../shared/api/image-generation-api";
import { storageApi } from "../../../../shared/api/storage-api";
import type { Chat } from "../../../../engine/contracts/types/chat";
import type { ChatImage } from "../../../../shared/types/gallery";

function imageCreatedAt(image: ChatImage) {
  const timestamp = typeof image.createdAt === "string" ? Date.parse(image.createdAt) : NaN;
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function getGameGalleryScopeId(chat: Chat | null): string | null {
  if (!chat || chat.mode !== "game") return null;
  const metadataGameId =
    typeof chat.metadata?.gameId === "string" && chat.metadata.gameId.trim() ? chat.metadata.gameId.trim() : null;
  return metadataGameId ?? chat.groupId ?? null;
}

export function getGalleryChatIds(chat: Chat | null, gameSessions: readonly Chat[] = []): string[] {
  if (!chat) return [];
  const gameId = getGameGalleryScopeId(chat);
  if (!gameId) return [chat.id];

  const sessionIds = gameSessions
    .filter((session) => session.mode === "game" && getGameGalleryScopeId(session) === gameId)
    .map((session) => session.id)
    .filter(Boolean);

  return Array.from(new Set([...sessionIds, chat.id]));
}

export async function listGalleryImagesForChatIds(
  galleryChatIds: readonly string[],
  listByChatId: (chatId: string) => Promise<ChatImage[]> = (chatId) =>
    storageApi.list<ChatImage>("gallery", { filters: { chatId } }),
): Promise<ChatImage[]> {
  const batches = await Promise.all(galleryChatIds.map((chatId) => listByChatId(chatId)));
  return batches.flat().sort((a, b) => imageCreatedAt(b) - imageCreatedAt(a));
}

export function useGalleryImages(chat: Chat | null) {
  const gameId = getGameGalleryScopeId(chat);
  const gameSessions = useQuery({
    queryKey: galleryKeys.gameSessions(gameId),
    queryFn: () => storageApi.list<Chat>("chats", { filters: { groupId: gameId } }),
    enabled: !!gameId,
    retry: false,
  });
  const galleryChatIds = getGalleryChatIds(chat, gameSessions.data ?? []);

  return useQuery({
    queryKey: galleryKeys.images(chat?.id ?? null, galleryChatIds),
    queryFn: () => listGalleryImagesForChatIds(galleryChatIds),
    enabled: !!chat?.id && galleryChatIds.length > 0 && (!gameId || gameSessions.isSuccess || gameSessions.isError),
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
