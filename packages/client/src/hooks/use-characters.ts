// ──────────────────────────────────────────────
// React Query: Character, Group & Persona hooks
// ──────────────────────────────────────────────
import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api-client";
import { useUIStore } from "../stores/ui.store";
import {
  collectAllPaginatedItems,
  flattenPaginatedItems,
  getNextPageOffset,
  LIBRARY_PAGE_SIZE,
  type PaginatedList,
} from "../lib/list-pagination";
import { achievementKeys, trackAchievementEvent } from "./use-achievements";
import {
  parseTrackerCardColorConfig,
  serializeTrackerCardColorConfig,
  TRACKER_CARD_COLOR_PREVIEW_BASE_FIELD,
} from "../lib/tracker-card-colors";
import {
  PROFESSOR_MARI_ID,
  type CharacterCardVersion,
  type Persona,
  type PersonaCardVersion,
} from "@marinara-engine/shared";
import type { CustomKind, CustomTagPatch } from "../lib/custom-emoji";

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function mergeTrackerCardPortraitFields(baseRaw: unknown, portraitRaw: unknown) {
  const baseConfig = parseTrackerCardColorConfig(baseRaw);
  const portraitConfig = parseTrackerCardColorConfig(portraitRaw);

  return serializeTrackerCardColorConfig({
    ...baseConfig,
    portraitFocusX: portraitConfig.portraitFocusX,
    portraitFocusY: portraitConfig.portraitFocusY,
    portraitZoom: portraitConfig.portraitZoom,
  });
}

export const characterKeys = {
  all: ["characters"] as const,
  list: () => [...characterKeys.all, "list"] as const,
  listWithBuiltIns: () => [...characterKeys.all, "list", "with-built-ins"] as const,
  page: (includeBuiltIn: boolean, search: string, sort: string, favoriteFilter: string) =>
    [...characterKeys.list(), "page", includeBuiltIn, search, sort, favoriteFilter] as const,
  summariesRoot: () => [...characterKeys.all, "summaries"] as const,
  summaries: (idsKey: string) => [...characterKeys.all, "summaries", idsKey] as const,
  detail: (id: string) => [...characterKeys.all, "detail", id] as const,
  versions: (id: string) => [...characterKeys.detail(id), "versions"] as const,
  gallery: (id: string) => [...characterKeys.all, "gallery", id] as const,
  galleryClips: (id: string) => [...characterKeys.all, "gallery", id, "clips"] as const,
  personaGallery: (id: string) => ["persona-gallery", id] as const,
  personaGalleryClips: (id: string) => ["persona-gallery", id, "clips"] as const,
  personaCallVideos: (id: string) => ["conversation-calls", "persona-videos", id] as const,
  personas: ["personas"] as const,
  personaActive: () => [...characterKeys.personas, "active"] as const,
  personaDetail: (id: string) => [...characterKeys.personas, "detail", id] as const,
  personaVersions: (id: string) => [...characterKeys.personaDetail(id), "versions"] as const,
  groups: ["character-groups"] as const,
  groupDetail: (id: string) => ["character-groups", "detail", id] as const,
  personaGroups: ["persona-groups"] as const,
  personaGroupDetail: (id: string) => ["persona-groups", "detail", id] as const,
};

export type CharacterSummary = {
  id: string;
  name: string;
  avatarUrl: string | null;
  avatarCrop?: unknown;
  conversationStatus?: string;
};

// ── Characters ──

type UseCharactersOptions =
  | boolean
  | {
      enabled?: boolean;
      includeBuiltIn?: boolean;
    };

export function useCharacters(options: UseCharactersOptions = true) {
  const enabled = typeof options === "boolean" ? options : (options.enabled ?? true);
  const includeBuiltIn = typeof options === "object" ? options.includeBuiltIn === true : false;

  return useQuery({
    queryKey: includeBuiltIn ? characterKeys.listWithBuiltIns() : characterKeys.list(),
    queryFn: async () => {
      const characters = await api.get<Array<{ id?: unknown }>>(
        includeBuiltIn ? "/characters?includeBuiltIn=true" : "/characters",
      );
      if (includeBuiltIn) return characters;
      return characters.filter((character) => character.id !== PROFESSOR_MARI_ID);
    },
    enabled,
    staleTime: 5 * 60_000,
  });
}

export function useCharacterPages(options: {
  enabled?: boolean;
  includeBuiltIn?: boolean;
  search?: string;
  sort?: string;
  favoriteFilter?: string;
}) {
  const enabled = options.enabled ?? true;
  const includeBuiltIn = options.includeBuiltIn === true;
  const search = (options.search ?? "").trim();
  const sort = options.sort ?? "";
  const favoriteFilter = options.favoriteFilter ?? "";

  return useInfiniteQuery({
    queryKey: characterKeys.page(includeBuiltIn, search, sort, favoriteFilter),
    initialPageParam: 0,
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({
        limit: String(LIBRARY_PAGE_SIZE),
        offset: String(Number(pageParam) || 0),
      });
      if (includeBuiltIn) params.set("includeBuiltIn", "true");
      if (search) params.set("search", search);
      if (sort) params.set("sort", sort);
      if (favoriteFilter) params.set("favoriteFilter", favoriteFilter);
      return api.get<PaginatedList<Record<string, unknown>>>(`/characters?${params.toString()}`);
    },
    getNextPageParam: getNextPageOffset,
    enabled,
    staleTime: 5 * 60_000,
  });
}

export function flattenCharacterPages(data: { pages?: Array<PaginatedList<Record<string, unknown>>> } | undefined) {
  return flattenPaginatedItems(data?.pages);
}

export function fetchAllCharacterPages(
  options: {
    includeBuiltIn?: boolean;
    search?: string;
    sort?: string;
  } = {},
) {
  const includeBuiltIn = options.includeBuiltIn === true;
  const search = (options.search ?? "").trim();
  const sort = options.sort ?? "";

  return collectAllPaginatedItems<Record<string, unknown>>((offset) => {
    const params = new URLSearchParams({
      limit: String(LIBRARY_PAGE_SIZE),
      offset: String(offset),
    });
    if (includeBuiltIn) params.set("includeBuiltIn", "true");
    if (search) params.set("search", search);
    if (sort) params.set("sort", sort);
    return api.get<PaginatedList<Record<string, unknown>>>(`/characters?${params.toString()}`);
  });
}

export function useCharacterSummaries(ids: string[], enabled = true) {
  const uniqueIds = Array.from(new Set(ids.filter((id) => id.trim().length > 0))).sort();
  const idsKey = uniqueIds.join(",");

  return useQuery({
    queryKey: characterKeys.summaries(idsKey),
    queryFn: () => api.post<CharacterSummary[]>("/characters/summaries", { ids: uniqueIds }),
    enabled: enabled && uniqueIds.length > 0,
    placeholderData: (previousData) => previousData,
    staleTime: 5 * 60_000,
  });
}

export function useCharacter(id: string | null) {
  return useQuery({
    queryKey: characterKeys.detail(id ?? ""),
    queryFn: () => api.get(`/characters/${id}`),
    enabled: !!id,
    staleTime: 5 * 60_000,
  });
}

export function useCreateCharacter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post("/characters", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: characterKeys.list() });
      qc.invalidateQueries({ queryKey: characterKeys.summariesRoot() });
      void trackAchievementEvent("library_changed")
        .finally(() => qc.invalidateQueries({ queryKey: achievementKeys.all }))
        .catch(() => undefined);
    },
  });
}

export function useUpdateCharacter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: {
      id: string;
      data?: Record<string, unknown>;
      avatarPath?: string;
      comment?: string;
      versionSource?: string;
      versionReason?: string;
      skipVersionSnapshot?: boolean;
    }) => api.patch(`/characters/${id}`, data),
    onSuccess: (updatedCharacter, variables) => {
      const updatedRow = isRecord(updatedCharacter) ? updatedCharacter : null;
      const updatedId = typeof updatedRow?.id === "string" ? updatedRow.id : variables.id;
      if (updatedRow) {
        qc.setQueryData<unknown[] | undefined>(characterKeys.list(), (old) => {
          if (!Array.isArray(old)) return old;

          return old.map((character) => {
            if (!isRecord(character) || character.id !== updatedId) return character;
            return { ...character, ...updatedRow };
          });
        });
        qc.setQueryData(characterKeys.detail(updatedId), (old: unknown) => {
          if (!isRecord(old)) return updatedRow;
          return { ...old, ...updatedRow };
        });
      }
      qc.invalidateQueries({ queryKey: characterKeys.list() });
      qc.invalidateQueries({ queryKey: characterKeys.summariesRoot() });
      qc.invalidateQueries({ queryKey: characterKeys.detail(updatedId) });
      qc.invalidateQueries({ queryKey: characterKeys.versions(updatedId) });
    },
  });
}

export function useCharacterVersions(id: string | null) {
  return useQuery({
    queryKey: characterKeys.versions(id ?? ""),
    queryFn: () => api.get<CharacterCardVersion[]>(`/characters/${id}/versions`),
    enabled: !!id,
    staleTime: 60_000,
  });
}

export function useRestoreCharacterVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, versionId }: { id: string; versionId: string }) =>
      api.post(`/characters/${id}/versions/${versionId}/restore`, {}),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: characterKeys.list() });
      qc.invalidateQueries({ queryKey: characterKeys.detail(variables.id) });
      qc.invalidateQueries({ queryKey: characterKeys.versions(variables.id) });
    },
  });
}

export function useDeleteCharacterVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, versionId }: { id: string; versionId: string }) =>
      api.delete(`/characters/${id}/versions/${versionId}`),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: characterKeys.versions(variables.id) });
    },
  });
}

export function useUploadAvatar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, avatar }: { id: string; avatar: string }) => api.post(`/characters/${id}/avatar`, { avatar }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: characterKeys.list() });
      qc.invalidateQueries({ queryKey: characterKeys.summariesRoot() });
      qc.invalidateQueries({ queryKey: characterKeys.detail(variables.id) });
    },
  });
}

export function useRemoveAvatar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/characters/${id}/avatar`),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: characterKeys.list() });
      qc.invalidateQueries({ queryKey: characterKeys.summariesRoot() });
      qc.invalidateQueries({ queryKey: characterKeys.detail(id) });
    },
  });
}

export function useDeleteCharacter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/characters/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: characterKeys.list() });
      qc.invalidateQueries({ queryKey: characterKeys.summariesRoot() });
    },
  });
}

export function useDuplicateCharacter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/characters/${id}/duplicate`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: characterKeys.list() });
      qc.invalidateQueries({ queryKey: characterKeys.summariesRoot() });
    },
  });
}

// ── Character Sprites ──

export interface SpriteInfo {
  expression: string;
  filename: string;
  url: string;
}

export type SpriteCleanupEngine = "auto" | "backgroundremover" | "builtin";

export interface SpriteCapabilities {
  imageProcessingAvailable: boolean;
  spriteGenerationAvailable: boolean;
  backgroundRemovalAvailable: boolean;
  reason: string | null;
  backgroundRemover?: {
    engine: SpriteCleanupEngine;
    installed: boolean;
    command: string | null;
    source: "env" | "local" | "path" | null;
    runtimeDir: string;
    reason: string | null;
  };
}

export interface SpriteCleanupResult {
  processed: number;
  failed: Array<{ expression: string; error: string }>;
  backupId?: string | null;
  engine?: SpriteCleanupEngine;
  backgroundRemoverProcessed?: number;
  builtinProcessed?: number;
  sprites: SpriteInfo[];
  error?: string;
}

export interface SpriteCleanupRestoreResult {
  restored: number;
  failed: Array<{ expression: string; error: string }>;
  sprites: SpriteInfo[];
  error?: string;
}

export interface CharacterGalleryImage {
  id: string;
  characterId: string;
  filePath: string;
  prompt: string;
  provider: string;
  model: string;
  width: number | null;
  height: number | null;
  customKind: CustomKind | null;
  customName: string | null;
  createdAt: string;
  url: string;
}

export interface CharacterGalleryClip {
  id: string;
  source: "conversation-call" | "conversation-call-custom" | "game-scene" | "scene-video" | "uploaded-video";
  label: string;
  prompt: string;
  status: "ready" | "generating" | "error" | "missing";
  url: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  origin?: "generated" | "uploaded" | null;
  durationSeconds: number | null;
  trimStartSeconds?: number | null;
  trimEndSeconds?: number | null;
  aspectRatio: string;
  provider: string;
  model: string;
  chatId: string | null;
  chatName: string | null;
  clipKind: string | null;
}

export interface CharacterGalleryClipsResponse {
  clips: CharacterGalleryClip[];
  callVideoGenerating: boolean;
}

export type CharacterGalleryClipUploadInput = {
  file: File;
  label?: string | null;
  kind?: string | null;
};

export type CharacterCallVideoGenerationInput = {
  clipKind?: string | null;
  clipKinds?: string[] | null;
  clipCount?: number | null;
  connectionId?: string | null;
  includeAvatarReference?: boolean;
  customClip?: {
    label: string;
    prompt: string;
  } | null;
};

export const spriteKeys = {
  list: (characterId: string) => ["sprites", characterId] as const,
  capabilities: () => ["sprites", "capabilities"] as const,
};

export function useSpriteCapabilities() {
  return useQuery({
    queryKey: spriteKeys.capabilities(),
    queryFn: () => api.get<SpriteCapabilities>("/sprites/capabilities"),
    staleTime: 5 * 60_000,
  });
}

export function useCharacterSprites(characterId: string | null) {
  return useQuery({
    queryKey: spriteKeys.list(characterId ?? ""),
    queryFn: () => api.get<SpriteInfo[]>(`/sprites/${characterId}`),
    enabled: !!characterId,
  });
}

export function useUploadSprite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ characterId, expression, image }: { characterId: string; expression: string; image: string }) =>
      api.post<SpriteInfo>(`/sprites/${characterId}`, { expression, image }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: spriteKeys.list(variables.characterId) });
    },
  });
}

export function useDeleteSprite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ characterId, expression }: { characterId: string; expression: string }) =>
      api.delete(`/sprites/${characterId}/${expression}`),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: spriteKeys.list(variables.characterId) });
    },
  });
}

export function useExportSprites() {
  return useMutation({
    mutationFn: ({
      characterId,
      expressions,
      folderName,
    }: {
      characterId: string;
      expressions: string[];
      folderName: string;
    }) => api.downloadPost(`/sprites/${characterId}/export`, { expressions, folderName }, `${folderName}.zip`),
  });
}

export function useCleanupSavedSprites() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      characterId,
      expressions,
      cleanupStrength = 35,
      engine = "auto",
    }: {
      characterId: string;
      expressions?: string[];
      cleanupStrength?: number;
      engine?: SpriteCleanupEngine;
    }) =>
      api.post<SpriteCleanupResult>(`/sprites/${characterId}/cleanup-saved`, { expressions, cleanupStrength, engine }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: spriteKeys.list(variables.characterId) });
    },
  });
}

export function useRestoreSpriteCleanupBackup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ characterId, backupId }: { characterId: string; backupId: string }) =>
      api.post<SpriteCleanupRestoreResult>(`/sprites/${characterId}/cleanup-restore`, { backupId }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: spriteKeys.list(variables.characterId) });
    },
  });
}

export function useCharacterGalleryImages(characterId: string | null) {
  return useQuery({
    queryKey: characterKeys.gallery(characterId ?? ""),
    queryFn: () => api.get<CharacterGalleryImage[]>(`/characters/${characterId}/gallery`),
    enabled: !!characterId,
    staleTime: 5 * 60_000,
  });
}

export function useCharacterGalleryClips(characterId: string | null) {
  return useQuery({
    queryKey: characterKeys.galleryClips(characterId ?? ""),
    queryFn: () => api.get<CharacterGalleryClipsResponse>(`/characters/${characterId}/gallery/clips`),
    enabled: !!characterId,
    refetchInterval: (query) =>
      query.state.data?.callVideoGenerating || query.state.data?.clips.some((clip) => clip.status === "generating")
        ? 15_000
        : false,
    staleTime: 15_000,
  });
}

export function useGenerateCharacterCallVideoClips(characterId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input?: CharacterCallVideoGenerationInput) =>
      api.post(`/conversation-calls/character-videos/${characterId}/generate`, {
        debugMode: useUIStore.getState().debugMode,
        ...(input?.clipKind ? { clipKind: input.clipKind } : {}),
        ...(input?.clipKinds?.length ? { clipKinds: input.clipKinds } : {}),
        ...(input?.clipCount ? { clipCount: input.clipCount } : {}),
        ...(input?.connectionId ? { connectionId: input.connectionId } : {}),
        ...(input?.includeAvatarReference === false ? { includeAvatarReference: false } : {}),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: characterKeys.galleryClips(characterId) });
      qc.invalidateQueries({ queryKey: ["conversation-calls", "character-videos", characterId] });
    },
  });
}

export function useGenerateCharacterCustomCallVideoClip(characterId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CharacterCallVideoGenerationInput) => {
      if (!input.customClip?.label.trim() || !input.customClip.prompt.trim()) {
        throw new Error("Custom clips need a name and action.");
      }
      return api.post(`/conversation-calls/character-videos/${characterId}/custom/generate`, {
        debugMode: useUIStore.getState().debugMode,
        label: input.customClip.label.trim(),
        prompt: input.customClip.prompt.trim(),
        ...(input.connectionId ? { connectionId: input.connectionId } : {}),
        ...(input.includeAvatarReference === false ? { includeAvatarReference: false } : {}),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: characterKeys.galleryClips(characterId) });
      qc.invalidateQueries({ queryKey: ["conversation-calls", "character-videos", characterId] });
    },
  });
}

export function useGeneratePersonaCallVideoClips(personaId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input?: CharacterCallVideoGenerationInput) =>
      api.post(`/conversation-calls/persona-videos/${personaId}/generate`, {
        debugMode: useUIStore.getState().debugMode,
        ...(input?.clipKind ? { clipKind: input.clipKind } : {}),
        ...(input?.clipKinds?.length ? { clipKinds: input.clipKinds } : {}),
        ...(input?.clipCount ? { clipCount: input.clipCount } : {}),
        ...(input?.connectionId ? { connectionId: input.connectionId } : {}),
        ...(input?.includeAvatarReference === false ? { includeAvatarReference: false } : {}),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: characterKeys.personaGalleryClips(personaId) });
      qc.invalidateQueries({ queryKey: characterKeys.personaCallVideos(personaId) });
    },
  });
}

export function useGeneratePersonaCustomCallVideoClip(personaId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CharacterCallVideoGenerationInput) => {
      if (!input.customClip?.label.trim() || !input.customClip.prompt.trim()) {
        throw new Error("Custom clips need a name and action.");
      }
      return api.post(`/conversation-calls/persona-videos/${personaId}/custom/generate`, {
        debugMode: useUIStore.getState().debugMode,
        label: input.customClip.label.trim(),
        prompt: input.customClip.prompt.trim(),
        ...(input.connectionId ? { connectionId: input.connectionId } : {}),
        ...(input.includeAvatarReference === false ? { includeAvatarReference: false } : {}),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: characterKeys.personaGalleryClips(personaId) });
      qc.invalidateQueries({ queryKey: characterKeys.personaCallVideos(personaId) });
    },
  });
}

export function useDeleteCharacterGalleryClip(characterId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (clipId: string) =>
      api.delete(`/characters/${characterId}/gallery/clips/${encodeURIComponent(clipId)}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: characterKeys.galleryClips(characterId) });
      qc.invalidateQueries({ queryKey: ["conversation-calls", "character-videos", characterId] });
    },
  });
}

export function useUpdateCharacterGalleryClipTrim(characterId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      clipId,
      trimStartSeconds,
      trimEndSeconds,
    }: {
      clipId: string;
      trimStartSeconds: number | null;
      trimEndSeconds: number | null;
    }) =>
      api.patch(`/characters/${characterId}/gallery/clips/${encodeURIComponent(clipId)}/trim`, {
        trimStartSeconds,
        trimEndSeconds,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: characterKeys.galleryClips(characterId) });
      qc.invalidateQueries({ queryKey: ["conversation-calls", "character-videos", characterId] });
    },
  });
}

export function useUploadCharacterGalleryClip(characterId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ file, label, kind }: CharacterGalleryClipUploadInput) => {
      const formData = new FormData();
      formData.append("file", file);
      if (label?.trim()) formData.append("label", label.trim());
      if (kind?.trim()) formData.append("kind", kind.trim());
      return api.upload<CharacterGalleryClipsResponse>(`/characters/${characterId}/gallery/clips/upload`, formData);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: characterKeys.galleryClips(characterId) });
      qc.invalidateQueries({ queryKey: ["conversation-calls", "character-videos", characterId] });
    },
  });
}

export function useUploadCharacterGalleryVideo(characterId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ file, label }: CharacterGalleryClipUploadInput) => {
      const formData = new FormData();
      formData.append("file", file);
      if (label?.trim()) formData.append("label", label.trim());
      return api.upload<CharacterGalleryClip>(`/characters/${characterId}/gallery/videos/upload`, formData);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: characterKeys.galleryClips(characterId) });
    },
  });
}

export function useUploadCharacterGalleryImage(characterId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (files: File[]) => {
      const uploads = await Promise.allSettled(
        files.map((file) => {
          const formData = new FormData();
          formData.append("file", file);
          return api.upload<CharacterGalleryImage>(`/characters/${characterId}/gallery/upload`, formData);
        }),
      );

      const successfulUploads = uploads.filter(
        (result): result is PromiseFulfilledResult<CharacterGalleryImage> => result.status === "fulfilled",
      );

      if (successfulUploads.length !== uploads.length) {
        const failedCount = uploads.length - successfulUploads.length;
        throw new Error(
          failedCount === 1
            ? "One character gallery image failed to upload."
            : `${failedCount} character gallery images failed to upload.`,
        );
      }

      return successfulUploads.map((result) => result.value);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: characterKeys.gallery(characterId) });
    },
  });
}

export function useDeleteCharacterGalleryImage(characterId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (imageId: string) => api.delete(`/characters/${characterId}/gallery/${imageId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: characterKeys.gallery(characterId) });
    },
  });
}

export function useTagCharacterGalleryImage(characterId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ imageId, patch }: { imageId: string; patch: CustomTagPatch }) =>
      api.patch<CharacterGalleryImage>(`/characters/${characterId}/gallery/${imageId}/tag`, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: characterKeys.gallery(characterId) });
    },
  });
}

// ── Persona Gallery ──

export interface PersonaGalleryImage {
  id: string;
  personaId: string;
  filePath: string;
  prompt: string;
  provider: string;
  model: string;
  width: number | null;
  height: number | null;
  customKind: CustomKind | null;
  customName: string | null;
  createdAt: string;
  url: string;
}

export function usePersonaGalleryImages(personaId: string | null) {
  return useQuery({
    queryKey: characterKeys.personaGallery(personaId ?? ""),
    queryFn: () => api.get<PersonaGalleryImage[]>(`/characters/personas/${personaId}/gallery`),
    enabled: !!personaId,
    staleTime: 5 * 60_000,
  });
}

export function usePersonaGalleryClips(personaId: string | null) {
  return useQuery({
    queryKey: characterKeys.personaGalleryClips(personaId ?? ""),
    queryFn: () => api.get<CharacterGalleryClipsResponse>(`/characters/personas/${personaId}/gallery/clips`),
    enabled: !!personaId,
    staleTime: 15_000,
  });
}

export function useDeletePersonaGalleryClip(personaId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (clipId: string) =>
      api.delete(`/characters/personas/${personaId}/gallery/clips/${encodeURIComponent(clipId)}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: characterKeys.personaGalleryClips(personaId) });
    },
  });
}

export function useUpdatePersonaGalleryClipTrim(personaId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      clipId,
      trimStartSeconds,
      trimEndSeconds,
    }: {
      clipId: string;
      trimStartSeconds: number | null;
      trimEndSeconds: number | null;
    }) =>
      api.patch(`/characters/personas/${personaId}/gallery/clips/${encodeURIComponent(clipId)}/trim`, {
        trimStartSeconds,
        trimEndSeconds,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: characterKeys.personaGalleryClips(personaId) });
    },
  });
}

export function useUploadPersonaGalleryClip(personaId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ file, label, kind }: CharacterGalleryClipUploadInput) => {
      const formData = new FormData();
      formData.append("file", file);
      if (label?.trim()) formData.append("label", label.trim());
      if (kind?.trim()) formData.append("kind", kind.trim());
      return api.upload<CharacterGalleryClipsResponse>(
        `/characters/personas/${personaId}/gallery/clips/upload`,
        formData,
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: characterKeys.personaGalleryClips(personaId) });
      qc.invalidateQueries({ queryKey: characterKeys.personaCallVideos(personaId) });
    },
  });
}

export function useUploadPersonaGalleryVideo(personaId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ file, label }: CharacterGalleryClipUploadInput) => {
      const formData = new FormData();
      formData.append("file", file);
      if (label?.trim()) formData.append("label", label.trim());
      return api.upload<CharacterGalleryClip>(`/characters/personas/${personaId}/gallery/videos/upload`, formData);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: characterKeys.personaGalleryClips(personaId) });
    },
  });
}

export function useUploadPersonaGalleryImage(personaId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (files: File[]) => {
      const uploads = await Promise.allSettled(
        files.map((file) => {
          const formData = new FormData();
          formData.append("file", file);
          return api.upload<PersonaGalleryImage>(`/characters/personas/${personaId}/gallery/upload`, formData);
        }),
      );

      const successfulUploads = uploads.filter(
        (result): result is PromiseFulfilledResult<PersonaGalleryImage> => result.status === "fulfilled",
      );

      if (successfulUploads.length !== uploads.length) {
        const failedCount = uploads.length - successfulUploads.length;
        throw new Error(
          failedCount === 1
            ? "One persona gallery image failed to upload."
            : `${failedCount} persona gallery images failed to upload.`,
        );
      }

      return successfulUploads.map((result) => result.value);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: characterKeys.personaGallery(personaId) });
    },
  });
}

export function useDeletePersonaGalleryImage(personaId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (imageId: string) => api.delete(`/characters/personas/${personaId}/gallery/${imageId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: characterKeys.personaGallery(personaId) });
    },
  });
}

export function useTagPersonaGalleryImage(personaId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ imageId, patch }: { imageId: string; patch: CustomTagPatch }) =>
      api.patch<PersonaGalleryImage>(`/characters/personas/${personaId}/gallery/${imageId}/tag`, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: characterKeys.personaGallery(personaId) });
    },
  });
}

// ── Personas ──

export function usePersonas(enabled = true) {
  return useQuery({
    queryKey: characterKeys.personas,
    queryFn: () => api.get<unknown[]>("/characters/personas/list"),
    enabled,
    staleTime: 5 * 60_000,
  });
}

export function usePersonaPages(options: { enabled?: boolean; search?: string; sort?: string }) {
  const enabled = options.enabled ?? true;
  const search = (options.search ?? "").trim();
  const sort = options.sort ?? "";

  return useInfiniteQuery({
    queryKey: [...characterKeys.personas, "page", search, sort] as const,
    initialPageParam: 0,
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({
        limit: String(LIBRARY_PAGE_SIZE),
        offset: String(Number(pageParam) || 0),
      });
      if (search) params.set("search", search);
      if (sort) params.set("sort", sort);
      return api.get<PaginatedList<unknown>>(`/characters/personas/list?${params.toString()}`);
    },
    getNextPageParam: getNextPageOffset,
    enabled,
    staleTime: 5 * 60_000,
  });
}

export function flattenPersonaPages(data: { pages?: Array<PaginatedList<unknown>> } | undefined) {
  return flattenPaginatedItems(data?.pages);
}

export function fetchAllPersonaPages(options: { search?: string; sort?: string } = {}) {
  const search = (options.search ?? "").trim();
  const sort = options.sort ?? "";

  return collectAllPaginatedItems<Record<string, unknown>>((offset) => {
    const params = new URLSearchParams({
      limit: String(LIBRARY_PAGE_SIZE),
      offset: String(offset),
    });
    if (search) params.set("search", search);
    if (sort) params.set("sort", sort);
    return api.get<PaginatedList<Record<string, unknown>>>(`/characters/personas/list?${params.toString()}`);
  });
}

export function usePersona(id: string | null) {
  return useQuery({
    queryKey: characterKeys.personaDetail(id ?? ""),
    queryFn: () => api.get<Persona>(`/characters/personas/${id}`),
    enabled: !!id,
    retry: false,
    staleTime: 5 * 60_000,
  });
}

export function useActivePersona(enabled = true) {
  return useQuery({
    queryKey: characterKeys.personaActive(),
    queryFn: () => api.get<Persona | null>("/characters/personas/active"),
    enabled,
    retry: false,
    staleTime: 5 * 60_000,
  });
}

export function useCreatePersona() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      name: string;
      description?: string;
      comment?: string;
      creator?: string;
      personaVersion?: string;
      creatorNotes?: string;
      phoneticName?: string;
      personality?: string;
      scenario?: string;
      backstory?: string;
      appearance?: string;
      nameColor?: string;
      dialogueColor?: string;
      boxColor?: string;
      trackerCardColors?: string;
      personaStats?: string;
      tags?: string;
      savedStatusOptions?: string;
      avatarCrop?: string;
    }) => api.post("/characters/personas", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: characterKeys.personas });
      void trackAchievementEvent("library_changed")
        .finally(() => qc.invalidateQueries({ queryKey: achievementKeys.all }))
        .catch(() => undefined);
    },
  });
}

export function useUpdatePersona() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: {
      id: string;
      name?: string;
      comment?: string;
      creator?: string;
      personaVersion?: string;
      creatorNotes?: string;
      phoneticName?: string;
      description?: string;
      personality?: string;
      scenario?: string;
      backstory?: string;
      appearance?: string;
      nameColor?: string;
      dialogueColor?: string;
      boxColor?: string;
      trackerCardColors?: string;
      personaStats?: string;
      tags?: string;
      savedStatusOptions?: string;
      avatarCrop?: string;
    }) => api.patch(`/characters/personas/${id}`, data),
    onSuccess: (updatedPersona, variables) => {
      const updatedId = (updatedPersona as { id?: string } | null)?.id ?? variables.id;
      qc.setQueryData<unknown[] | undefined>(characterKeys.personas, (old) => {
        if (!Array.isArray(old)) return old;
        if (!updatedId) return old;

        return old.map((p) => {
          const row = p as Record<string, unknown> & { id?: string };
          if (row?.id !== updatedId) return p;
          if (!updatedPersona || typeof updatedPersona !== "object") return p;
          const updatedRow = updatedPersona as Record<string, unknown>;
          const nextPersona = { ...row, ...updatedRow };
          const previewBaseTrackerCardColors = row[TRACKER_CARD_COLOR_PREVIEW_BASE_FIELD];
          const updatedTrackerCardColors = updatedRow.trackerCardColors;

          if (typeof previewBaseTrackerCardColors === "string" && typeof updatedTrackerCardColors === "string") {
            nextPersona[TRACKER_CARD_COLOR_PREVIEW_BASE_FIELD] = updatedTrackerCardColors;
            nextPersona.trackerCardColors = mergeTrackerCardPortraitFields(
              row.trackerCardColors,
              updatedTrackerCardColors,
            );
          }

          return nextPersona;
        });
      });

      qc.invalidateQueries({ queryKey: characterKeys.personas });
      qc.invalidateQueries({ queryKey: characterKeys.personaActive() });
      if (updatedId) {
        qc.invalidateQueries({ queryKey: characterKeys.personaDetail(updatedId) });
        qc.invalidateQueries({ queryKey: characterKeys.personaVersions(updatedId) });
      }
    },
  });
}

export function usePersonaVersions(id: string | null) {
  return useQuery({
    queryKey: characterKeys.personaVersions(id ?? ""),
    queryFn: () => api.get<PersonaCardVersion[]>(`/characters/personas/${id}/versions`),
    enabled: !!id,
    staleTime: 60_000,
  });
}

export function useRestorePersonaVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, versionId }: { id: string; versionId: string }) =>
      api.post(`/characters/personas/${id}/versions/${versionId}/restore`, {}),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: characterKeys.personas });
      qc.invalidateQueries({ queryKey: characterKeys.personaActive() });
      qc.invalidateQueries({ queryKey: characterKeys.personaDetail(variables.id) });
      qc.invalidateQueries({ queryKey: characterKeys.personaVersions(variables.id) });
    },
  });
}

export function useDeletePersonaVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, versionId }: { id: string; versionId: string }) =>
      api.delete(`/characters/personas/${id}/versions/${versionId}`),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: characterKeys.personaVersions(variables.id) });
    },
  });
}

export function useDeletePersona() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/characters/personas/${id}`),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: characterKeys.personas });
      qc.invalidateQueries({ queryKey: characterKeys.personaActive() });
      qc.removeQueries({ queryKey: characterKeys.personaDetail(id) });
    },
  });
}

export function useDuplicatePersona() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/characters/personas/${id}/duplicate`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: characterKeys.personas }),
  });
}

export function useActivatePersona() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.put(`/characters/personas/${id}/activate`, {}),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: characterKeys.personas });
      qc.invalidateQueries({ queryKey: characterKeys.personaActive() });
      qc.invalidateQueries({ queryKey: characterKeys.personaDetail(id) });
    },
  });
}

export function useUploadPersonaAvatar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, avatar, filename }: { id: string; avatar: string; filename?: string }) =>
      api.post(`/characters/personas/${id}/avatar`, { avatar, filename }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: characterKeys.personas });
      qc.invalidateQueries({ queryKey: characterKeys.personaActive() });
      qc.invalidateQueries({ queryKey: characterKeys.personaDetail(variables.id) });
      qc.invalidateQueries({ queryKey: characterKeys.personaVersions(variables.id) });
    },
  });
}

// ── Character Groups ──

export function useCharacterGroups() {
  return useQuery({
    queryKey: characterKeys.groups,
    queryFn: () => api.get<unknown[]>("/characters/groups/list"),
  });
}

export function useCharacterGroup(id: string | null) {
  return useQuery({
    queryKey: characterKeys.groupDetail(id ?? ""),
    queryFn: () => api.get(`/characters/groups/${id}`),
    enabled: !!id,
  });
}

export function useCreateGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; description?: string; characterIds?: string[] }) =>
      api.post("/characters/groups", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: characterKeys.groups }),
  });
}

export function useUpdateGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; description?: string; characterIds?: string[] }) =>
      api.patch(`/characters/groups/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: characterKeys.groups }),
  });
}

export function useDeleteGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/characters/groups/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: characterKeys.groups }),
  });
}

// ── Persona Groups ──

export function usePersonaGroups() {
  return useQuery({
    queryKey: characterKeys.personaGroups,
    queryFn: () => api.get<unknown[]>("/characters/persona-groups/list"),
  });
}

export function useCreatePersonaGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; description?: string; personaIds?: string[] }) =>
      api.post("/characters/persona-groups", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: characterKeys.personaGroups }),
  });
}

export function useUpdatePersonaGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; description?: string; personaIds?: string[] }) =>
      api.patch(`/characters/persona-groups/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: characterKeys.personaGroups }),
  });
}

export function useDeletePersonaGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/characters/persona-groups/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: characterKeys.personaGroups }),
  });
}
