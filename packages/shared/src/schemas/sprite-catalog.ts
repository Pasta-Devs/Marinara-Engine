import { z } from "zod";

export const spriteFolderSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(100),
  description: z.string().max(500).default(""),
});

export const spriteMetadataSchema = z.object({
  id: z.string().min(1).max(100),
  label: z.string().min(1).max(160),
  folderId: z.string().uuid().nullable(),
});

export const spriteCatalogSchema = z.object({
  version: z.literal(1),
  folders: z.array(spriteFolderSchema).max(200),
  defaultFolderId: z.string().uuid().nullable(),
  sprites: z.record(z.string(), spriteMetadataSchema),
});

export type SpriteFolder = z.infer<typeof spriteFolderSchema>;
export type SpriteMetadata = z.infer<typeof spriteMetadataSchema>;
export type SpriteCatalog = z.infer<typeof spriteCatalogSchema>;

export interface CatalogSprite extends SpriteMetadata {
  /** Existing API/file handle. Independent of the editable expression label. */
  expression: string;
  filename: string;
  url: string;
  folderName: string | null;
  active: boolean;
}

export interface CharacterSpriteCatalog {
  folders: SpriteFolder[];
  defaultFolderId: string | null;
  sprites: CatalogSprite[];
}

export function getSpriteFolderOverride(metadata: unknown, ownerId: string): string | null | undefined {
  if (!metadata || typeof metadata !== "object") return undefined;
  const overrides = (metadata as Record<string, unknown>).spriteFolderOverrides;
  if (!overrides || typeof overrides !== "object" || !Object.hasOwn(overrides, ownerId)) return undefined;
  const value = (overrides as Record<string, unknown>)[ownerId];
  return value === null || typeof value === "string" ? value : undefined;
}

export function selectSpriteFolder<T extends { folderId?: string | null; active?: boolean }>(
  sprites: readonly T[],
  folderId?: string | null,
): T[] {
  return sprites.filter((sprite) =>
    folderId === undefined ? sprite.active !== false : (sprite.folderId ?? null) === folderId,
  );
}
