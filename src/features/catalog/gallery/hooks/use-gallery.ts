import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { galleryKeys } from "../query-keys";
import { galleryApi, imageGenerationApi } from "../../../../shared/api/image-generation-api";
import { storageApi } from "../../../../shared/api/storage-api";
import type { Chat } from "../../../../engine/contracts/types/chat";
import type { ChatImage } from "../../../../shared/types/gallery";

function imageCreatedAt(image: ChatImage) {
  const timestamp = typeof image.createdAt === "string" ? Date.parse(image.createdAt) : NaN;
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function normalizeGalleryImage(image: ChatImage): ChatImage {
  return {
    ...image,
    url: readTrimmed(image.url) || readTrimmed(image.filePath),
  };
}

function readTrimmed(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function imageExtension(mimeType: string | null | undefined): string {
  const normalized = mimeType?.toLowerCase() ?? "";
  if (normalized.includes("jpeg") || normalized.includes("jpg")) return "jpg";
  if (normalized.includes("webp")) return "webp";
  return "png";
}

function imageDimension(value: number | null | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.round(value) : fallback;
}

function imageConnectionId(chat: Chat | null): string {
  if (!chat) return "";
  return (
    readTrimmed(chat.metadata?.gameImageConnectionId) ||
    readTrimmed(chat.metadata?.imageGenConnectionId) ||
    readTrimmed(chat.metadata?.illustrationImageConnectionId)
  );
}

function getGameGalleryScopeId(chat: Chat | null): string | null {
  if (!chat || chat.mode !== "game") return null;
  const metadataGameId =
    typeof chat.metadata?.gameId === "string" && chat.metadata.gameId.trim() ? chat.metadata.gameId.trim() : null;
  return metadataGameId ?? chat.groupId ?? null;
}

function getGalleryChatIds(chat: Chat | null, gameSessions: readonly Chat[] = []): string[] {
  if (!chat) return [];
  const gameId = getGameGalleryScopeId(chat);
  if (!gameId) return [chat.id];

  const sessionIds = gameSessions
    .filter((session) => session.mode === "game" && getGameGalleryScopeId(session) === gameId)
    .map((session) => session.id)
    .filter(Boolean);

  return Array.from(new Set([...sessionIds, chat.id]));
}

async function listGalleryImagesForChatIds(
  galleryChatIds: readonly string[],
  listByChatId: (chatId: string) => Promise<ChatImage[]> = (chatId) =>
    storageApi.list<ChatImage>("gallery", { filters: { chatId } }),
): Promise<ChatImage[]> {
  const batches = await Promise.all(galleryChatIds.map((chatId) => listByChatId(chatId)));
  return batches
    .flat()
    .map(normalizeGalleryImage)
    .sort((a, b) => imageCreatedAt(b) - imageCreatedAt(a));
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

function chatGalleryUploadFailureError(fileCount: number, failures: unknown[]): Error {
  if (fileCount === 1 && failures[0] instanceof Error) {
    return failures[0];
  }

  const failedCount = failures.length;
  return new Error(
    failedCount === 1
      ? "One chat gallery image failed to upload."
      : `${failedCount} chat gallery images failed to upload.`,
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

export function useRegenerateGalleryImage(chat: Chat | null) {
  const queryClient = useQueryClient();
  const gameId = getGameGalleryScopeId(chat);
  const gameSessions = queryClient.getQueryData<Chat[]>(galleryKeys.gameSessions(gameId)) ?? [];
  const galleryChatIds = getGalleryChatIds(chat, gameSessions);
  const activeGalleryQueryKey = galleryKeys.images(chat?.id ?? null, galleryChatIds);

  return useMutation({
    mutationFn: async (image: ChatImage) => {
      if (!chat?.id) throw new Error("Open a chat before regenerating gallery images.");

      const prompt = readTrimmed(image.prompt);
      if (!prompt) throw new Error("This image does not have a saved prompt to regenerate.");

      const connectionId = imageConnectionId(chat);
      if (!connectionId) throw new Error("Choose an image generation connection in chat settings first.");

      const width = imageDimension(image.width, 1024);
      const height = imageDimension(image.height, 1024);
      const generated = await imageGenerationApi.generate<{
        base64?: string;
        mimeType?: string;
        image?: string;
        provider?: string;
        model?: string;
      }>({
        connectionId,
        prompt,
        width,
        height,
      });
      const mimeType = generated.mimeType || "image/png";
      const imageUrl =
        readTrimmed(generated.image) ||
        (readTrimmed(generated.base64) ? `data:${mimeType};base64,${readTrimmed(generated.base64)}` : "");
      if (!imageUrl) throw new Error("Image provider returned no image data.");

      const filename = `regenerated_${Date.now()}.${imageExtension(mimeType)}`;
      return storageApi.create<ChatImage>("gallery", {
        chatId: chat.id,
        filePath: filename,
        filename,
        url: imageUrl,
        prompt,
        provider: generated.provider ?? image.provider ?? "image_generation",
        model: generated.model ?? image.model ?? null,
        width,
        height,
        sourceGalleryId: image.id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: activeGalleryQueryKey });
    },
    meta: { chatId: chat?.id ?? null },
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
