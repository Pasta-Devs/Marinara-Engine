export interface SpriteAssetInfo {
  expression?: string | null;
  [key: string]: unknown;
}

export type SpriteOwnerType = "character" | "persona";

export interface BackgroundAssetInfo {
  filename?: string | null;
  name?: string | null;
  path?: string | null;
  originalName?: string | null;
  tags?: unknown;
  source?: string | null;
  [key: string]: unknown;
}

export interface GameAssetManifestEntry {
  tag?: string | null;
  category?: string | null;
  subcategory?: string | null;
  name?: string | null;
  path?: string | null;
  [key: string]: unknown;
}

export interface GameAssetManifest {
  byCategory?: Record<string, GameAssetManifestEntry[]>;
  [key: string]: unknown;
}

export interface VisualReferenceImageSource {
  image?: string | null;
  url?: string | null;
  base64?: string | null;
  mimeType?: string | null;
  avatarFilePath?: string | null;
  avatarFilename?: string | null;
}

export interface VisualAssetGateway {
  listSprites(ownerId: string, ownerType?: SpriteOwnerType): Promise<SpriteAssetInfo[]>;
  listBackgrounds(): Promise<BackgroundAssetInfo[]>;
  gameAssetsManifest?(): Promise<GameAssetManifest | null>;
  resolveReferenceImage?(source: VisualReferenceImageSource): Promise<string | null>;
}
