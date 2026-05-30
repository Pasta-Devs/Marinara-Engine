// ──────────────────────────────────────────────
// React Query: Character, Group & Persona hooks
// ──────────────────────────────────────────────
import { useMemo } from "react";
import { useQuery, useQueries, useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { characterKeys, spriteKeys } from "../query-keys";
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
import { galleryApi, spriteApi } from "../../../../shared/api/image-generation-api";
import { personaApi } from "../../../../shared/api/persona-api";
import type { CharacterCardVersion } from "../../../../engine/contracts/types/character";
import type { SpriteCapabilities, SpriteCleanupEngine } from "../../../../shared/types/sprite-capabilities";

export { characterKeys, spriteKeys } from "../query-keys";

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

export type PersonaSummary = {
  id: string;
  name?: string;
  comment?: string | null;
  description?: string;
  tags?: string[];
  avatarPath?: string | null;
  avatarCrop?: unknown;
  isActive?: string | boolean;
  createdAt?: string;
  nameColor?: string;
  dialogueColor?: string;
  boxColor?: string;
};

const CHARACTER_LIST_FIELDS = ["id", "data", "comment", "avatarFilePath", "avatarFilename", "createdAt", "updatedAt"];

const CHARACTER_SUMMARY_OPTIONS = {
  fields: CHARACTER_LIST_FIELDS,
  fieldSelections: { data: ["name", "creator", "creator_notes", "character_version", "tags", "extensions"] },
};
const CHARACTER_LIST_OPTIONS = {
  fields: CHARACTER_LIST_FIELDS,
};
const CHARACTER_SUMMARY_BY_ID_CONCURRENCY = 8;
const EMPTY_CHARACTER_SUMMARIES: CharacterSummary[] = [];

const PERSONA_SUMMARY_OPTIONS = {
  fields: [
    "id",
    "name",
    "comment",
    "description",
    "tags",
    "avatarPath",
    "avatarCrop",
    "isActive",
    "active",
    "createdAt",
    "nameColor",
    "dialogueColor",
    "boxColor",
  ],
};

function isCharacterListRecord(value: unknown): value is CharacterListRecord & { id: string } {
  return Boolean(
    value && typeof value === "object" && !Array.isArray(value) && typeof (value as { id?: unknown }).id === "string",
  );
}

function isPresent<T>(value: T | null | undefined): value is NonNullable<T> {
  return value != null;
}

function normalizeSearchQuery(search: string | null | undefined): string {
  return search?.trim() ?? "";
}

function listCharacterSummaries(search?: string): Promise<CharacterSummary[]> {
  const query = normalizeSearchQuery(search);
  return storageApi.list<CharacterSummary>("characters", {
    ...CHARACTER_SUMMARY_OPTIONS,
    ...(query ? { search: query } : {}),
  });
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
          results[index] = await storageApi.get<CharacterSummary>("characters", ids[index]!, CHARACTER_SUMMARY_OPTIONS);
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
  const record = (result as { character?: unknown }).character;
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
    queryFn: () => storageApi.list<unknown>("characters", CHARACTER_LIST_OPTIONS),
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
    queryFn: () => storageApi.get("characters", id!),
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
      queryFn: () => storageApi.get("characters", id),
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

// ── Character Sprites ──

export interface SpriteInfo {
  expression: string;
  filename: string;
  url: string;
}

export interface SpriteUploadItem {
  expression: string;
  image: string;
}

export interface SpriteBulkUploadResult {
  imported: number;
  failed: Array<{ expression: string; filename?: string; error: string }>;
  sprites: SpriteInfo[];
}

export interface SpriteCleanupResult {
  processed: number;
  failed: Array<{ expression: string; error: string }>;
  restorePointId?: string | null;
  engine?: SpriteCleanupEngine;
  externalCleanupProcessed?: number;
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
  createdAt: string;
  url: string;
}

export function useSpriteCapabilities() {
  return useQuery({
    queryKey: spriteKeys.capabilities(),
    queryFn: () => spriteApi.capabilities<SpriteCapabilities>(),
    staleTime: 5 * 60_000,
  });
}

export function useCharacterSprites(characterId: string | null) {
  return useQuery({
    queryKey: spriteKeys.list(characterId ?? ""),
    queryFn: () => spriteApi.list<SpriteInfo[]>(characterId!),
    enabled: !!characterId,
  });
}

export function useUploadSprite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ characterId, expression, image }: { characterId: string; expression: string; image: string }) =>
      spriteApi.upload<SpriteInfo>(characterId, { expression, image }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: spriteKeys.list(variables.characterId) });
    },
  });
}

export function useUploadSprites() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ characterId, sprites }: { characterId: string; sprites: SpriteUploadItem[] }) =>
      spriteApi.bulkUpload<SpriteBulkUploadResult>(characterId, { sprites }),
    onSuccess: (data, variables) => {
      qc.setQueryData(spriteKeys.list(variables.characterId), data.sprites);
    },
  });
}

export function useDeleteSprite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ characterId, expression }: { characterId: string; expression: string }) =>
      spriteApi.delete(characterId, expression),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: spriteKeys.list(variables.characterId) });
    },
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
    }) => spriteApi.cleanupSaved<SpriteCleanupResult>(characterId, { expressions, cleanupStrength, engine }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: spriteKeys.list(variables.characterId) });
    },
  });
}

export function useRestoreSpriteCleanupPoint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ characterId, restorePointId }: { characterId: string; restorePointId: string }) =>
      spriteApi.cleanupRestore<SpriteCleanupRestoreResult>(characterId, { restorePointId }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: spriteKeys.list(variables.characterId) });
    },
  });
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

// ── Personas ──

export function usePersonas(enabled = true) {
  return useQuery({
    queryKey: characterKeys.personas,
    queryFn: () => storageApi.list<unknown>("personas"),
    enabled,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
}

export function usePersonaSummaries(enabled = true) {
  return useQuery({
    queryKey: characterKeys.personaSummaries,
    queryFn: () => storageApi.list<PersonaSummary>("personas", PERSONA_SUMMARY_OPTIONS),
    enabled,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
}

export function usePersona(id: string | null, enabled = true) {
  return useQuery({
    queryKey: characterKeys.personaDetail(id ?? ""),
    queryFn: () => storageApi.get("personas", id!),
    enabled: enabled && !!id,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useActivePersona(enabled = true) {
  return useQuery({
    queryKey: characterKeys.activePersona,
    queryFn: async () => {
      const personas = await storageApi.list<PersonaSummary & { active?: string | boolean }>(
        "personas",
        PERSONA_SUMMARY_OPTIONS,
      );
      return (
        personas.find(
          (persona) =>
            persona.isActive === true ||
            persona.isActive === "true" ||
            persona.active === true ||
            persona.active === "true",
        ) ?? null
      );
    },
    enabled,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useCreatePersona() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      name: string;
      description?: string;
      comment?: string;
      personality?: string;
      scenario?: string;
      backstory?: string;
      appearance?: string;
      nameColor?: string;
      dialogueColor?: string;
      boxColor?: string;
      trackerCardColors?: string;
      personaStats?: unknown;
      altDescriptions?: unknown[];
      tags?: string[];
      savedStatusOptions?: string[];
      avatarCrop?: unknown;
    }) => storageApi.create("personas", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: characterKeys.personas });
      qc.invalidateQueries({ queryKey: characterKeys.personaSummaries });
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
      description?: string;
      personality?: string;
      scenario?: string;
      backstory?: string;
      appearance?: string;
      nameColor?: string;
      dialogueColor?: string;
      boxColor?: string;
      trackerCardColors?: string;
      personaStats?: unknown;
      altDescriptions?: unknown[];
      tags?: string[];
      savedStatusOptions?: string[];
      avatarCrop?: unknown;
    }) => storageApi.update("personas", id, data),
    onSuccess: (updatedPersona, variables) => {
      qc.setQueryData(characterKeys.personaDetail(variables.id), updatedPersona);
      qc.setQueryData<unknown[] | undefined>(characterKeys.personas, (old) => {
        if (!Array.isArray(old)) return old;
        const updatedId = (updatedPersona as { id?: string } | null)?.id ?? variables.id;
        if (!updatedId) return old;

        return old.map((p) => {
          const row = p as Record<string, unknown> & { id?: string };
          if (row?.id !== updatedId) return p;
          if (!updatedPersona || typeof updatedPersona !== "object") return p;
          return { ...row, ...(updatedPersona as Record<string, unknown>) };
        });
      });

      qc.invalidateQueries({ queryKey: characterKeys.personas });
      qc.invalidateQueries({ queryKey: characterKeys.personaSummaries });
      qc.invalidateQueries({ queryKey: characterKeys.personaDetail(variables.id) });
    },
  });
}

export function useDeletePersona() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => storageApi.delete("personas", id),
    onSuccess: (_data, id) => {
      qc.removeQueries({ queryKey: characterKeys.personaDetail(id) });
      qc.removeQueries({ queryKey: characterKeys.personaSummaryDetail(id) });
      qc.invalidateQueries({ queryKey: characterKeys.personas });
      qc.invalidateQueries({ queryKey: characterKeys.personaSummaries });
    },
  });
}

export function useUploadPersonaAvatar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, avatar, filename }: { id: string; avatar: string; filename?: string }) =>
      personaApi.uploadAvatar(id, avatar, filename),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: characterKeys.personas });
      qc.invalidateQueries({ queryKey: characterKeys.personaSummaries });
      qc.invalidateQueries({ queryKey: characterKeys.personaDetail(variables.id) });
      qc.invalidateQueries({ queryKey: characterKeys.personaSummaryDetail(variables.id) });
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

// ── Persona Groups ──

export function usePersonaGroups(enabled = true) {
  return useQuery({
    queryKey: characterKeys.personaGroups,
    queryFn: () => storageApi.list<unknown>("persona-groups"),
    enabled,
  });
}
