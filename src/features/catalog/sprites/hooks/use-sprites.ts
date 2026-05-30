import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { spriteApi, type SpriteOwnerType } from "../../../../shared/api/image-generation-api";
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
  ownerType?: SpriteOwnerType;
}

interface SpriteOwner {
  id: string;
  type: SpriteOwnerType;
}

function normalizeSpriteOwnerId(value: string | undefined): string | null {
  const normalized = value?.trim() ?? "";
  return normalized || null;
}

function getSpriteOwner(variables: SpriteOwnerVariables): SpriteOwner {
  const spriteOwnerId =
    normalizeSpriteOwnerId(variables.spriteOwnerId) ?? normalizeSpriteOwnerId(variables.characterId);
  if (!spriteOwnerId) throw new Error("Sprite owner id is required.");
  return {
    id: spriteOwnerId,
    type: variables.ownerType ?? "character",
  };
}

export function useSpriteCapabilities() {
  return useQuery({
    queryKey: spriteKeys.capabilities(),
    queryFn: () => spriteApi.capabilities<SpriteCapabilities>(),
    staleTime: 5 * 60_000,
  });
}

export function useSprites(spriteOwnerId: string | null, ownerType: SpriteOwnerType = "character") {
  const normalizedSpriteOwnerId = normalizeSpriteOwnerId(spriteOwnerId ?? undefined);
  return useQuery({
    queryKey: spriteKeys.list(normalizedSpriteOwnerId ?? "", ownerType),
    queryFn: () => spriteApi.list<SpriteInfo[]>(normalizedSpriteOwnerId!, { ownerType }),
    enabled: !!normalizedSpriteOwnerId,
  });
}

export const useCharacterSprites = useSprites;

export function usePersonaSprites(spriteOwnerId: string | null) {
  return useSprites(spriteOwnerId, "persona");
}

export function useUploadSprite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (variables: SpriteOwnerVariables & { expression: string; image: string }) => {
      const owner = getSpriteOwner(variables);
      return spriteApi.upload<SpriteInfo>(
        owner.id,
        {
          expression: variables.expression,
          image: variables.image,
        },
        { ownerType: owner.type },
      );
    },
    onSuccess: (_data, variables) => {
      const owner = getSpriteOwner(variables);
      qc.invalidateQueries({ queryKey: spriteKeys.list(owner.id, owner.type) });
    },
  });
}

export function useUploadSprites() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (variables: SpriteOwnerVariables & { sprites: SpriteUploadItem[] }) => {
      const owner = getSpriteOwner(variables);
      return spriteApi.bulkUpload<SpriteBulkUploadResult>(
        owner.id,
        { sprites: variables.sprites },
        { ownerType: owner.type },
      );
    },
    onSuccess: (data, variables) => {
      const owner = getSpriteOwner(variables);
      qc.setQueryData(spriteKeys.list(owner.id, owner.type), data.sprites);
    },
  });
}

export function useDeleteSprite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (variables: SpriteOwnerVariables & { expression: string }) => {
      const owner = getSpriteOwner(variables);
      return spriteApi.delete(owner.id, variables.expression, { ownerType: owner.type });
    },
    onSuccess: (_data, variables) => {
      const owner = getSpriteOwner(variables);
      qc.invalidateQueries({ queryKey: spriteKeys.list(owner.id, owner.type) });
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
    ) => {
      const owner = getSpriteOwner(variables);
      return spriteApi.cleanupSaved<SpriteCleanupResult>(
        owner.id,
        {
          expressions: variables.expressions,
          cleanupStrength: variables.cleanupStrength ?? 35,
          engine: variables.engine ?? "auto",
        },
        { ownerType: owner.type },
      );
    },
    onSuccess: (_data, variables) => {
      const owner = getSpriteOwner(variables);
      qc.invalidateQueries({ queryKey: spriteKeys.list(owner.id, owner.type) });
    },
  });
}

export function useRestoreSpriteCleanupPoint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (variables: SpriteOwnerVariables & { restorePointId: string }) => {
      const owner = getSpriteOwner(variables);
      return spriteApi.cleanupRestore<SpriteCleanupRestoreResult>(
        owner.id,
        {
          restorePointId: variables.restorePointId,
        },
        { ownerType: owner.type },
      );
    },
    onSuccess: (_data, variables) => {
      const owner = getSpriteOwner(variables);
      qc.invalidateQueries({ queryKey: spriteKeys.list(owner.id, owner.type) });
    },
  });
}
