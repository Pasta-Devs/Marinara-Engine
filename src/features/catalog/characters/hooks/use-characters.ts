// ──────────────────────────────────────────────
// React Query: Character & Group hooks
// ──────────────────────────────────────────────
import { useMemo } from "react";
import { useQuery, useQueries, useMutation, useQueryClient } from "@tanstack/react-query";
import { characterKeys } from "../query-keys";
import {
  createCharacterSchema,
  createGroupSchema,
  updateCharacterSchema,
  updateGroupSchema,
} from "../../../../engine/contracts/schemas/character.schema";
import { characterApi } from "../../../../shared/api/character-api";
import { ApiError } from "../../../../shared/api/api-errors";
import { storageApi } from "../../../../shared/api/storage-api";
import { storageCommandsApi } from "../../../../shared/api/storage-commands-api";
import { galleryApi } from "../../../../shared/api/image-generation-api";
import type { CharacterCardVersion } from "../../../../engine/contracts/types/character";
import {
  invalidateCharacterCollectionQueries,
  invalidateCharacterRecordQueries,
  normalizeCharacterAvatarFields,
  refreshCharacterCollectionAfterMutation,
  removeCachedCharacterRecord,
} from "../lib/character-query-cache";

export { characterKeys } from "../query-keys";
export {
  cacheCharacterListRecordFromResult,
  invalidateCharacterCollectionQueries,
} from "../lib/character-query-cache";

export type CharacterSummary = {
  id: string;
  data?: {
    name?: string;
    creator?: string;
    creator_notes?: string;
    character_version?: string;
    tags?: unknown[];
    extensions?: Record<string, unknown>;
  };
  comment?: string | null;
  avatarPath?: string | null;
  avatarFilePath?: string | null;
  avatarFilename?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

const CHARACTER_LIST_FIELDS = [
  "id",
  "data",
  "comment",
  "avatarPath",
  "avatarFilePath",
  "avatarFilename",
  "createdAt",
  "updatedAt",
];

const CHARACTER_SUMMARY_OPTIONS = {
  fields: CHARACTER_LIST_FIELDS,
  fieldSelections: { data: ["name", "creator", "creator_notes", "character_version", "tags", "extensions"] },
};
const CHARACTER_SUMMARY_BY_ID_CONCURRENCY = 8;
const EMPTY_CHARACTER_SUMMARIES: CharacterSummary[] = [];

function isPresent<T>(value: T | null | undefined): value is NonNullable<T> {
  return value != null;
}

function normalizeSearchQuery(search: string | null | undefined): string {
  return search?.trim() ?? "";
}

function readTrimmed(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

async function listCharacterSummaries(search?: string): Promise<CharacterSummary[]> {
  const query = normalizeSearchQuery(search);
  const characters = await storageApi.list<CharacterSummary>("characters", {
    ...CHARACTER_SUMMARY_OPTIONS,
    ...(query ? { search: query } : {}),
  });
  return characters.map(normalizeCharacterAvatarFields);
}

async function getCharacter(id: string): Promise<unknown> {
  return normalizeCharacterAvatarFields(await storageApi.get<unknown>("characters", id));
}

async function listCharacterSummariesByIds(ids: string[]): Promise<CharacterSummary[]> {
  const results = new Array<CharacterSummary | null>(ids.length).fill(null);
  let nextIndex = 0;
  const workerCount = Math.min(CHARACTER_SUMMARY_BY_ID_CONCURRENCY, ids.length);
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < ids.length) {
        const index = nextIndex;
        nextIndex += 1;
        try {
          results[index] = normalizeCharacterAvatarFields(
            await storageApi.get<CharacterSummary>("characters", ids[index]!, CHARACTER_SUMMARY_OPTIONS),
          );
        } catch (error) {
          if (error instanceof ApiError && error.status === 404) {
            results[index] = null;
            continue;
          }
          throw error;
        }
      }
    }),
  );
  return results.filter(isPresent);
}

// ── Characters ──

export function useCharacterSummaries(enabled = true, search?: string) {
  const query = normalizeSearchQuery(search);
  return useQuery({
    queryKey: query ? characterKeys.summarySearch(query) : characterKeys.summaries(),
    queryFn: () => listCharacterSummaries(query),
    enabled,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useCharacter(id: string | null) {
  return useQuery({
    queryKey: characterKeys.detail(id ?? ""),
    queryFn: () => getCharacter(id!),
    enabled: !!id,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useCharactersByIds(ids: string[], enabled = true) {
  const uniqueIds = Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));
  const queries = useQueries({
    queries: uniqueIds.map((id) => ({
      queryKey: characterKeys.detail(id),
      queryFn: () => getCharacter(id),
      enabled: enabled && !!id,
      staleTime: 5 * 60_000,
      refetchOnWindowFocus: false,
    })),
  });

  return {
    data: queries.map((query) => query.data).filter(isPresent),
    isLoading: queries.some((query) => query.isLoading),
    isFetching: queries.some((query) => query.isFetching),
  };
}

export function useCharacterSummariesByIds(ids: string[], enabled = true) {
  const normalizedIdKey = ids
    .map((id) => id.trim())
    .filter(Boolean)
    .join("\0");
  const uniqueIds = useMemo(
    () => (normalizedIdKey ? Array.from(new Set(normalizedIdKey.split("\0").filter(Boolean))) : []),
    [normalizedIdKey],
  );
  const shouldRead = enabled && normalizedIdKey.length > 0;
  const query = useQuery({
    queryKey: characterKeys.summaryByIds(uniqueIds),
    queryFn: () => listCharacterSummariesByIds(uniqueIds),
    enabled: shouldRead,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
  const data = useMemo(() => {
    if (!shouldRead) return EMPTY_CHARACTER_SUMMARIES;
    const byId = new Map((query.data ?? []).map((character) => [character.id, character]));
    return uniqueIds.map((id) => byId.get(id)).filter(isPresent);
  }, [query.data, shouldRead, uniqueIds]);

  return {
    data,
    isLoading: shouldRead ? query.isLoading : false,
    isFetching: shouldRead ? query.isFetching : false,
  };
}

export function useCreateCharacter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => storageApi.create("characters", createCharacterSchema.parse(data)),
    onSuccess: (character) => {
      refreshCharacterCollectionAfterMutation(qc, character);
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
    }) => characterApi.update(id, updateCharacterSchema.parse(data)),
    onSuccess: (_data, variables) => {
      invalidateCharacterRecordQueries(qc, variables.id, { includeVersions: true });
    },
  });
}

export function useCharacterVersions(id: string | null) {
  return useQuery({
    queryKey: characterKeys.versions(id ?? ""),
    queryFn: () => storageApi.list<CharacterCardVersion>("character-versions", { filters: { characterId: id } }),
    enabled: !!id,
    staleTime: 60_000,
  });
}

export function useRestoreCharacterVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, versionId }: { id: string; versionId: string }) => characterApi.restoreVersion(id, versionId),
    onSuccess: (_data, variables) => {
      invalidateCharacterRecordQueries(qc, variables.id, { includeVersions: true });
    },
  });
}

export function useDeleteCharacterVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ versionId }: { id: string; versionId: string }) =>
      storageApi.delete("character-versions", versionId),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: characterKeys.versions(variables.id) });
    },
  });
}

export function useUploadAvatar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, avatar }: { id: string; avatar: string }) => characterApi.uploadAvatar(id, avatar),
    onSuccess: (_data, variables) => {
      invalidateCharacterRecordQueries(qc, variables.id, { includeVersions: true });
    },
  });
}

export function useRemoveAvatar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => characterApi.removeAvatar(id),
    onSuccess: (_data, id) => {
      invalidateCharacterRecordQueries(qc, id, { includeVersions: true });
    },
  });
}

export function useDeleteCharacter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => storageApi.delete("characters", id),
    onSuccess: (result, id) => {
      if (result?.deleted !== true) {
        invalidateCharacterCollectionQueries(qc);
        return;
      }

      const hasListCache = Array.isArray(qc.getQueryData<unknown[] | undefined>(characterKeys.list()));
      const hasSummaryCache = Array.isArray(qc.getQueryData<unknown[] | undefined>(characterKeys.summaries()));
      if (!hasListCache && !hasSummaryCache) {
        invalidateCharacterCollectionQueries(qc);
      }

      removeCachedCharacterRecord(qc, id);
    },
  });
}

export function useDuplicateCharacter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => storageCommandsApi.duplicate("characters", id),
    onSuccess: (character) => {
      refreshCharacterCollectionAfterMutation(qc, character);
    },
  });
}

export interface CharacterGalleryImage {
  id: string;
  characterId: string;
  filePath: string;
  filename?: string | null;
  prompt: string;
  provider: string;
  model: string;
  width: number | null;
  height: number | null;
  createdAt: string;
  url: string;
}

function normalizeCharacterGalleryImage(image: CharacterGalleryImage): CharacterGalleryImage {
  return {
    ...image,
    url: readTrimmed(image.url) || readTrimmed(image.filePath),
  };
}

export function useCharacterGalleryImages(characterId: string | null) {
  return useQuery({
    queryKey: characterKeys.gallery(characterId ?? ""),
    queryFn: async () =>
      (await storageApi.list<CharacterGalleryImage>("character-gallery", { filters: { characterId } })).map(
        normalizeCharacterGalleryImage,
      ),
    enabled: !!characterId,
    staleTime: 5 * 60_000,
  });
}

export function useUploadCharacterGalleryImage(characterId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (files: File[]) => {
      const uploads = await Promise.allSettled(
        files.map((file) => galleryApi.uploadCharacter<CharacterGalleryImage>(characterId, file)),
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
    mutationFn: (imageId: string) => storageApi.delete("character-gallery", imageId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: characterKeys.gallery(characterId) });
    },
  });
}

// ── Character Groups ──

export function useCharacterGroups() {
  return useQuery({
    queryKey: characterKeys.groups,
    queryFn: () => storageApi.list<unknown>("character-groups"),
  });
}

export function useCreateGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; description?: string; characterIds?: string[] }) =>
      storageApi.create("character-groups", createGroupSchema.parse(data)),
    onSuccess: () => qc.invalidateQueries({ queryKey: characterKeys.groups }),
  });
}

export function useUpdateGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; description?: string; characterIds?: string[] }) =>
      storageApi.update("character-groups", id, updateGroupSchema.parse(data)),
    onSuccess: () => qc.invalidateQueries({ queryKey: characterKeys.groups }),
  });
}

export function useDeleteGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => storageApi.delete("character-groups", id),
    onSuccess: () => qc.invalidateQueries({ queryKey: characterKeys.groups }),
  });
}
