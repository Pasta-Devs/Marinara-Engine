// ──────────────────────────────────────────────
// React Query: Character & Group hooks
// ──────────────────────────────────────────────
import { useMemo } from "react";
import { useQuery, useQueries, useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
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
import { characterAvatarUrl, type CharacterAvatarSource } from "../lib/character-avatar-url";

export { characterKeys } from "../query-keys";

type CharacterListRecord = Record<string, unknown> & { id?: string };
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
const CHARACTER_LIST_OPTIONS = {
  fields: CHARACTER_LIST_FIELDS,
};
const CHARACTER_SUMMARY_BY_ID_CONCURRENCY = 8;
const EMPTY_CHARACTER_SUMMARIES: CharacterSummary[] = [];

function isCharacterListRecord(value: unknown): value is CharacterListRecord & { id: string } {
  return Boolean(
    value && typeof value === "object" && !Array.isArray(value) && typeof (value as { id?: unknown }).id === "string",
  );
}

function isPresent<T>(value: T | null | undefined): value is NonNullable<T> {
  return value != null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function normalizeCharacterAvatarFields<T>(character: T): T {
  if (!isRecord(character)) return character;
  const avatarPath = characterAvatarUrl(character as CharacterAvatarSource);
  const hasAvatarPath = Object.prototype.hasOwnProperty.call(character, "avatarPath");
  const currentAvatarPath = character.avatarPath as string | null | undefined;
  if (hasAvatarPath && currentAvatarPath === avatarPath) return character;
  return { ...character, avatarPath } as T;
}

function normalizeSearchQuery(search: string | null | undefined): string {
  return search?.trim() ?? "";
}

async function listCharacters(): Promise<unknown[]> {
  const characters = await storageApi.list<unknown>("characters", CHARACTER_LIST_OPTIONS);
  return characters.map(normalizeCharacterAvatarFields);
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

function upsertCharacterListRecord(current: unknown[] | undefined, record: unknown): unknown[] | undefined {
  if (!isCharacterListRecord(record)) return current;
  if (!Array.isArray(current)) return current;

  const existingIndex = current.findIndex((item) => isCharacterListRecord(item) && item.id === record.id);
  if (existingIndex === -1) return [record, ...current];

  return current.map((item, index) =>
    index === existingIndex && isCharacterListRecord(item) ? { ...item, ...record } : item,
  );
}

function removeCharacterListRecord(current: unknown[] | undefined, id: string): unknown[] | undefined {
  if (!Array.isArray(current)) return current;
  return current.filter((item) => !isCharacterListRecord(item) || item.id !== id);
}

export function invalidateCharacterCollectionQueries(queryClient: Pick<QueryClient, "invalidateQueries">): void {
  queryClient.invalidateQueries({ queryKey: characterKeys.list() });
  queryClient.invalidateQueries({ queryKey: characterKeys.summaries() });
}

function upsertCharacterCollectionRecord(
  queryClient: Pick<QueryClient, "getQueryData" | "setQueryData">,
  queryKey: readonly unknown[],
  record: CharacterListRecord & { id: string },
): boolean {
  const current = queryClient.getQueryData<unknown[] | undefined>(queryKey);
  if (!Array.isArray(current)) return false;
  queryClient.setQueryData<unknown[] | undefined>(queryKey, (value) => upsertCharacterListRecord(value, record));
  return true;
}

function removeCharacterCollectionRecord(
  queryClient: Pick<QueryClient, "setQueryData">,
  queryKey: readonly unknown[],
  id: string,
): void {
  queryClient.setQueryData<unknown[] | undefined>(queryKey, (value) => removeCharacterListRecord(value, id));
}

export function cacheCharacterListRecordFromResult(
  queryClient: Pick<QueryClient, "getQueryData" | "setQueryData">,
  result: unknown,
): boolean {
  if (!result || typeof result !== "object" || Array.isArray(result)) return false;
  const record = normalizeCharacterAvatarFields((result as { character?: unknown }).character);
  if (!isCharacterListRecord(record)) return false;

  const updatedList = upsertCharacterCollectionRecord(queryClient, characterKeys.list(), record);
  const updatedSummaries = upsertCharacterCollectionRecord(queryClient, characterKeys.summaries(), record);
  queryClient.setQueryData(characterKeys.detail(record.id), record);
  queryClient.setQueryData(characterKeys.summaryDetail(record.id), record);
  return updatedList || updatedSummaries;
}

export function removeCachedCharacterRecord(
  queryClient: Pick<QueryClient, "setQueryData" | "removeQueries" | "invalidateQueries">,
  id: string,
) {
  removeCharacterCollectionRecord(queryClient, characterKeys.list(), id);
  removeCharacterCollectionRecord(queryClient, characterKeys.summaries(), id);
  queryClient.removeQueries({ queryKey: characterKeys.detail(id) });
  queryClient.removeQueries({ queryKey: characterKeys.summaryDetail(id) });
  queryClient.invalidateQueries({ queryKey: characterKeys.summaries() });
}

function refreshCharacterCollectionAfterMutation(
  queryClient: Pick<QueryClient, "getQueryData" | "setQueryData" | "invalidateQueries">,
  result: unknown,
): void {
  const updated = cacheCharacterListRecordFromResult(queryClient, { character: result });
  if (!updated) invalidateCharacterCollectionQueries(queryClient);
  else queryClient.invalidateQueries({ queryKey: characterKeys.summaries() });
}

function invalidateCharacterDetailQueries(
  queryClient: Pick<QueryClient, "invalidateQueries">,
  id: string,
  options: { includeVersions?: boolean } = {},
): void {
  queryClient.invalidateQueries({ queryKey: characterKeys.detail(id) });
  queryClient.invalidateQueries({ queryKey: characterKeys.summaryDetail(id) });
  if (options.includeVersions) {
    queryClient.invalidateQueries({ queryKey: characterKeys.versions(id) });
  }
}

function invalidateCharacterRecordQueries(
  queryClient: Pick<QueryClient, "invalidateQueries">,
  id: string,
  options: { includeVersions?: boolean } = {},
): void {
  invalidateCharacterCollectionQueries(queryClient);
  invalidateCharacterDetailQueries(queryClient, id, options);
}

// ── Characters ──

export function useCharacters(enabled = true) {
  return useQuery({
    queryKey: characterKeys.list(),
    queryFn: listCharacters,
    enabled,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
}

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
    }) => storageApi.update("characters", id, updateCharacterSchema.parse(data)),
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
      invalidateCharacterRecordQueries(qc, variables.id);
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
  prompt: string;
  provider: string;
  model: string;
  width: number | null;
  height: number | null;
  createdAt: string;
  url: string;
}

export function useCharacterGalleryImages(characterId: string | null) {
  return useQuery({
    queryKey: characterKeys.gallery(characterId ?? ""),
    queryFn: () => storageApi.list<CharacterGalleryImage>("character-gallery", { filters: { characterId } }),
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
