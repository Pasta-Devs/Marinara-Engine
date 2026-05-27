// ──────────────────────────────────────────────
// React Query: Character, Group & Persona hooks
// ──────────────────────────────────────────────
import { useQuery, useQueries, useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { characterKeys, spriteKeys } from "../query-keys";
import { storageApi } from "../../../../shared/api/storage-api";
import { invokeTauri } from "../../../../shared/api/tauri-client";
import { galleryApi, spriteApi } from "../../../../shared/api/image-generation-api";
import type { CharacterCardVersion } from "../../../../engine/contracts/types/character";
import type { SpriteCapabilities, SpriteCleanupEngine } from "../../../../shared/types/sprite-capabilities";

export { characterKeys, spriteKeys } from "../query-keys";

type CharacterListRecord = Record<string, unknown> & { id?: string };

function isCharacterListRecord(value: unknown): value is CharacterListRecord & { id: string } {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      typeof (value as { id?: unknown }).id === "string",
  );
}

export function upsertCharacterListRecord(current: unknown[] | undefined, record: unknown): unknown[] | undefined {
  if (!isCharacterListRecord(record)) return current;
  if (!Array.isArray(current)) return current;

  const existingIndex = current.findIndex((item) => isCharacterListRecord(item) && item.id === record.id);
  if (existingIndex === -1) return [record, ...current];

  return current.map((item, index) =>
    index === existingIndex && isCharacterListRecord(item) ? { ...item, ...record } : item,
  );
}

export function removeCharacterListRecord(current: unknown[] | undefined, id: string): unknown[] | undefined {
  if (!Array.isArray(current)) return current;
  return current.filter((item) => !isCharacterListRecord(item) || item.id !== id);
}

export function cacheCharacterListRecordFromResult(
  queryClient: Pick<QueryClient, "getQueryData" | "setQueryData">,
  result: unknown,
): boolean {
  if (!result || typeof result !== "object" || Array.isArray(result)) return false;
  const record = (result as { character?: unknown }).character;
  if (!isCharacterListRecord(record)) return false;

  const current = queryClient.getQueryData<unknown[] | undefined>(characterKeys.list());
  if (!Array.isArray(current)) return false;

  queryClient.setQueryData<unknown[] | undefined>(characterKeys.list(), (value) =>
    upsertCharacterListRecord(value, record),
  );
  return true;
}

// ── Characters ──

export function useCharacters(enabled = true) {
  return useQuery({
    queryKey: characterKeys.list(),
    queryFn: () => storageApi.list<unknown>("characters"),
    enabled,
    staleTime: 5 * 60_000,
  });
}

export function useCharacter(id: string | null) {
  return useQuery({
    queryKey: characterKeys.detail(id ?? ""),
    queryFn: () => storageApi.get("characters", id!),
    enabled: !!id,
    staleTime: 5 * 60_000,
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
    })),
  });

  return {
    data: queries.map((query) => query.data).filter(Boolean),
    isLoading: queries.some((query) => query.isLoading),
    isFetching: queries.some((query) => query.isFetching),
  };
}

export function useCreateCharacter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => storageApi.create("characters", data),
    onSuccess: (character) => {
      const updated = cacheCharacterListRecordFromResult(qc, { character });
      if (!updated) qc.invalidateQueries({ queryKey: characterKeys.list() });
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
    }) => storageApi.update("characters", id, data),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: characterKeys.list() });
      qc.invalidateQueries({ queryKey: characterKeys.detail(variables.id) });
      qc.invalidateQueries({ queryKey: characterKeys.versions(variables.id) });
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
    mutationFn: ({ id, versionId }: { id: string; versionId: string }) =>
      invokeTauri("character_restore_version", { characterId: id, versionId }),
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
    mutationFn: ({ versionId }: { id: string; versionId: string }) => storageApi.delete("character-versions", versionId),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: characterKeys.versions(variables.id) });
    },
  });
}

export function useUploadAvatar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, avatar }: { id: string; avatar: string }) =>
      invokeTauri("character_avatar_upload", { id, body: { avatar } }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: characterKeys.list() });
      qc.invalidateQueries({ queryKey: characterKeys.detail(variables.id) });
    },
  });
}

export function useDeleteCharacter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => storageApi.delete("characters", id),
    onSuccess: (result, id) => {
      if (result?.deleted !== true) {
        qc.invalidateQueries({ queryKey: characterKeys.list() });
        return;
      }

      const current = qc.getQueryData<unknown[] | undefined>(characterKeys.list());
      if (!Array.isArray(current)) {
        qc.invalidateQueries({ queryKey: characterKeys.list() });
        return;
      }

      qc.setQueryData<unknown[] | undefined>(characterKeys.list(), (value) => removeCharacterListRecord(value, id));
    },
  });
}

export function useDuplicateCharacter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => invokeTauri("storage_duplicate", { entity: "characters", id }),
    onSuccess: (character) => {
      const updated = cacheCharacterListRecordFromResult(qc, { character });
      if (!updated) qc.invalidateQueries({ queryKey: characterKeys.list() });
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
    }) =>
      spriteApi.cleanupSaved<SpriteCleanupResult>(characterId, { expressions, cleanupStrength, engine }),
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
  });
}

export function usePersona(id: string | null, enabled = true) {
  return useQuery({
    queryKey: characterKeys.personaDetail(id ?? ""),
    queryFn: () => storageApi.get("personas", id!),
    enabled: enabled && !!id,
    staleTime: 5 * 60_000,
  });
}

export function useActivePersona(enabled = true) {
  return useQuery({
    queryKey: characterKeys.activePersona,
    queryFn: async () => {
      for (const filters of [
        { isActive: true },
        { isActive: "true" },
        { active: true },
        { active: "true" },
      ]) {
        const [persona] = await storageApi.list<unknown>("personas", { filters, limit: 1 });
        if (persona) return persona;
      }
      return null;
    },
    enabled,
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
    onSuccess: () => qc.invalidateQueries({ queryKey: characterKeys.personas }),
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
    },
  });
}

export function useDeletePersona() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => storageApi.delete("personas", id),
    onSuccess: () => qc.invalidateQueries({ queryKey: characterKeys.personas }),
  });
}

export function useDuplicatePersona() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => invokeTauri("storage_duplicate", { entity: "personas", id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: characterKeys.personas }),
  });
}

export function useActivatePersona() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => invokeTauri("persona_activate", { id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: characterKeys.personas }),
  });
}

export function useUploadPersonaAvatar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, avatar, filename }: { id: string; avatar: string; filename?: string }) =>
      invokeTauri("persona_avatar_upload", { id, body: { avatar, filename } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: characterKeys.personas }),
  });
}

// ── Character Groups ──

export function useCharacterGroups() {
  return useQuery({
    queryKey: characterKeys.groups,
    queryFn: () => storageApi.list<unknown>("character-groups"),
  });
}

export function useCharacterGroup(id: string | null) {
  return useQuery({
    queryKey: characterKeys.groupDetail(id ?? ""),
    queryFn: () => storageApi.get("character-groups", id!),
    enabled: !!id,
  });
}

export function useCreateGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; description?: string; characterIds?: string[] }) =>
      storageApi.create("character-groups", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: characterKeys.groups }),
  });
}

export function useUpdateGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; description?: string; characterIds?: string[] }) =>
      storageApi.update("character-groups", id, data),
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

export function useCreatePersonaGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; description?: string; personaIds?: string[] }) =>
      storageApi.create("persona-groups", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: characterKeys.personaGroups }),
  });
}

export function useUpdatePersonaGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; description?: string; personaIds?: string[] }) =>
      storageApi.update("persona-groups", id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: characterKeys.personaGroups }),
  });
}

export function useDeletePersonaGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => storageApi.delete("persona-groups", id),
    onSuccess: () => qc.invalidateQueries({ queryKey: characterKeys.personaGroups }),
  });
}
