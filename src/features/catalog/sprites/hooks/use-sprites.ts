import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { spriteApi } from "../../../../shared/api/image-generation-api";
import type { SpriteCapabilities, SpriteCleanupEngine } from "../../../../shared/types/sprite-capabilities";
import { spriteKeys } from "../query-keys";

export { spriteKeys } from "../query-keys";

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

interface SpriteOwnerVariables {
  spriteOwnerId?: string;
  characterId?: string;
}

function normalizeSpriteOwnerId(value: string | undefined): string | null {
  const normalized = value?.trim() ?? "";
  return normalized || null;
}

function getSpriteOwnerId(variables: SpriteOwnerVariables): string {
  const spriteOwnerId =
    normalizeSpriteOwnerId(variables.spriteOwnerId) ?? normalizeSpriteOwnerId(variables.characterId);
  if (!spriteOwnerId) throw new Error("Sprite owner id is required.");
  return spriteOwnerId;
}

export function useSpriteCapabilities() {
  return useQuery({
    queryKey: spriteKeys.capabilities(),
    queryFn: () => spriteApi.capabilities<SpriteCapabilities>(),
    staleTime: 5 * 60_000,
  });
}

export function useSprites(spriteOwnerId: string | null) {
  const normalizedSpriteOwnerId = normalizeSpriteOwnerId(spriteOwnerId ?? undefined);
  return useQuery({
    queryKey: spriteKeys.list(normalizedSpriteOwnerId ?? ""),
    queryFn: () => spriteApi.list<SpriteInfo[]>(normalizedSpriteOwnerId!),
    enabled: !!normalizedSpriteOwnerId,
  });
}

export const useCharacterSprites = useSprites;

export function useUploadSprite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (variables: SpriteOwnerVariables & { expression: string; image: string }) =>
      spriteApi.upload<SpriteInfo>(getSpriteOwnerId(variables), {
        expression: variables.expression,
        image: variables.image,
      }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: spriteKeys.list(getSpriteOwnerId(variables)) });
    },
  });
}

export function useUploadSprites() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (variables: SpriteOwnerVariables & { sprites: SpriteUploadItem[] }) =>
      spriteApi.bulkUpload<SpriteBulkUploadResult>(getSpriteOwnerId(variables), { sprites: variables.sprites }),
    onSuccess: (data, variables) => {
      qc.setQueryData(spriteKeys.list(getSpriteOwnerId(variables)), data.sprites);
    },
  });
}

export function useDeleteSprite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (variables: SpriteOwnerVariables & { expression: string }) =>
      spriteApi.delete(getSpriteOwnerId(variables), variables.expression),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: spriteKeys.list(getSpriteOwnerId(variables)) });
    },
  });
}

export function useCleanupSavedSprites() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (
      variables: SpriteOwnerVariables & {
        expressions?: string[];
        cleanupStrength?: number;
        engine?: SpriteCleanupEngine;
      },
    ) =>
      spriteApi.cleanupSaved<SpriteCleanupResult>(getSpriteOwnerId(variables), {
        expressions: variables.expressions,
        cleanupStrength: variables.cleanupStrength ?? 35,
        engine: variables.engine ?? "auto",
      }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: spriteKeys.list(getSpriteOwnerId(variables)) });
    },
  });
}

export function useRestoreSpriteCleanupPoint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (variables: SpriteOwnerVariables & { restorePointId: string }) =>
      spriteApi.cleanupRestore<SpriteCleanupRestoreResult>(getSpriteOwnerId(variables), {
        restorePointId: variables.restorePointId,
      }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: spriteKeys.list(getSpriteOwnerId(variables)) });
    },
  });
}
