import { useMutation, useQuery } from "@tanstack/react-query";
import type { GameSceneVideoAspectRatio, GameTurnStoryboard } from "@marinara-engine/shared";
import { api } from "../lib/api-client";

export const gameStoryboardKeys = {
  all: ["game", "storyboards"] as const,
  chat: (chatId: string) => [...gameStoryboardKeys.all, chatId] as const,
  list: (chatId: string) => [...gameStoryboardKeys.chat(chatId), "list"] as const,
  turn: (chatId: string, messageId: string, swipeIndex: number) =>
    [...gameStoryboardKeys.chat(chatId), "turn", messageId, swipeIndex] as const,
};

export type GenerateGameTurnStoryboardInput = {
  chatId: string;
  messageId: string;
  swipeIndex?: number;
  sections?: Array<{
    index: number;
    kind: "narration" | "dialogue" | "readable" | "system" | "user" | "assistant";
    speaker?: string | null;
    content: string;
  }>;
  keyframeCount?: number;
  durationSeconds?: number;
  aspectRatio?: GameSceneVideoAspectRatio;
  generateVideos?: boolean;
  automatic?: boolean;
  plannedStoryboard?: unknown;
  promptOverrides?: Array<{
    id: string;
    prompt: string;
    negativePrompt?: string;
  }>;
  debugMode?: boolean;
};

export type GameStoryboardPromptPreviewItem = {
  id: string;
  kind: "illustration";
  title: string;
  prompt: string;
  negativePrompt?: string;
  width: number;
  height: number;
};

const RENDERING_STORYBOARD_STATUSES = new Set(["planning", "rendering_images", "rendering_videos"]);

export function isGameTurnStoryboardRendering(storyboard: GameTurnStoryboard | null | undefined): boolean {
  if (!storyboard) return false;
  return RENDERING_STORYBOARD_STATUSES.has(storyboard.status);
}

function hasRenderingStoryboard(storyboards: GameTurnStoryboard[] | undefined): boolean {
  return storyboards?.some(isGameTurnStoryboardRendering) ?? false;
}

export function useGameChatStoryboards(chatId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: gameStoryboardKeys.list(chatId ?? ""),
    queryFn: async () => {
      const result = await api.get<{ storyboards: GameTurnStoryboard[] }>(`/game/storyboards/${chatId}`);
      return result.storyboards;
    },
    enabled: enabled && !!chatId,
    refetchInterval: (query) => {
      const storyboards = query.state.data as GameTurnStoryboard[] | undefined;
      return hasRenderingStoryboard(storyboards) ? 2500 : false;
    },
    staleTime: 30_000,
  });
}

export function useGameTurnStoryboards(
  chatId: string | undefined,
  messageId: string | undefined,
  swipeIndex: number | undefined,
  enabled = true,
) {
  const normalizedSwipeIndex = swipeIndex ?? 0;
  return useQuery({
    queryKey: gameStoryboardKeys.turn(chatId ?? "", messageId ?? "", normalizedSwipeIndex),
    queryFn: async () => {
      const params = new URLSearchParams({
        messageId: messageId!,
        swipeIndex: String(normalizedSwipeIndex),
      });
      const result = await api.get<{ storyboards: GameTurnStoryboard[] }>(
        `/game/storyboards/${chatId}?${params.toString()}`,
      );
      return result.storyboards;
    },
    enabled: enabled && !!chatId && !!messageId,
    refetchInterval: (query) => {
      const storyboards = query.state.data as GameTurnStoryboard[] | undefined;
      return hasRenderingStoryboard(storyboards) ? 2500 : false;
    },
    staleTime: 30_000,
  });
}

export function useGenerateGameTurnStoryboard() {
  return useMutation({
    mutationFn: (input: GenerateGameTurnStoryboardInput) =>
      api.post<{ storyboard: GameTurnStoryboard } | { skipped: true; reason: "manual" | "interval" | "duplicate" }>(
        "/game/storyboard/generate",
        input,
      ),
  });
}

export function usePreviewGameTurnStoryboardPrompts() {
  return useMutation({
    mutationFn: (input: GenerateGameTurnStoryboardInput) =>
      api.post<{ items: GameStoryboardPromptPreviewItem[]; plannedStoryboard: unknown }>("/game/storyboard/generate", {
        ...input,
        previewOnly: true,
      }),
  });
}
