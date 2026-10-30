import { z } from "zod";

export const spriteFolderSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(100),
  category: z.enum(["expressions", "full-body"]).optional(),
});

export const spriteMetadataSchema = z.object({
  id: z.string().min(1).max(100),
  label: z.string().min(1).max(160),
  folderId: z.string().uuid().nullable(),
});

export const spriteCatalogSchema = z.object({
  version: z.literal(1),
  folders: z.array(spriteFolderSchema).max(400),
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
}

export interface CharacterSpriteCatalog {
  folders: SpriteFolder[];
  sprites: CatalogSprite[];
}
