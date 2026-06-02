import { invokeTauri } from "./tauri-client";
import { fileToUploadPayload, IMAGE_UPLOAD_SIZE_ERROR, MAX_IMAGE_UPLOAD_BYTES } from "./file-payload";
import { resolveSpriteFileUrl } from "./local-file-api";

export type SpriteOwnerType = "character" | "persona";

export interface SpriteOwnerOptions {
  ownerType?: SpriteOwnerType;
}

function spriteOwnerArgs(characterId: string, options?: SpriteOwnerOptions) {
  return {
    characterId,
    ownerType: options?.ownerType ?? "character",
  };
}

type SpriteRecord = {
  absolutePath?: unknown;
  cacheKey?: unknown;
  expression?: unknown;
  filename?: unknown;
  ownerId?: unknown;
  ownerType?: unknown;
  url?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readCacheKey(value: unknown): string | number | null {
  return typeof value === "string" || typeof value === "number" ? value : null;
}

function isSpriteRecord(value: unknown): value is SpriteRecord {
  return isRecord(value) && typeof value.filename === "string" && typeof value.expression === "string";
}

async function resolveSpriteRecordUrl(
  sprite: SpriteRecord,
  ownerId: string,
  ownerType: SpriteOwnerType,
): Promise<SpriteRecord> {
  const filename = readString(sprite.filename);
  if (!filename) return sprite;
  const resolvedUrl = await resolveSpriteFileUrl(
    readString(sprite.ownerType) ?? ownerType,
    readString(sprite.ownerId) ?? ownerId,
    filename,
    readString(sprite.absolutePath),
    readCacheKey(sprite.cacheKey),
  );
  return resolvedUrl ? { ...sprite, url: resolvedUrl } : sprite;
}

async function resolveSpriteResponse<T>(value: T, ownerId: string, ownerType: SpriteOwnerType): Promise<T> {
  if (Array.isArray(value)) {
    return Promise.all(
      value.map((item) => (isSpriteRecord(item) ? resolveSpriteRecordUrl(item, ownerId, ownerType) : item)),
    ) as T;
  }
  if (isRecord(value) && Array.isArray(value.sprites)) {
    return {
      ...value,
      sprites: await Promise.all(
        value.sprites.map((item) => (isSpriteRecord(item) ? resolveSpriteRecordUrl(item, ownerId, ownerType) : item)),
      ),
    } as T;
  }
  if (isSpriteRecord(value)) {
    return (await resolveSpriteRecordUrl(value, ownerId, ownerType)) as T;
  }
  return value;
}

export const spriteApi = {
  capabilities: <T = unknown>() => invokeTauri<T>("sprite_capabilities_command"),
  cleanupStatus: <T = unknown>() => invokeTauri<T>("sprite_cleanup_status_command"),
  generateSheetPreview: <T = unknown>(body: Record<string, unknown>) =>
    invokeTauri<T>("sprite_generate_sheet_preview", { body }),
  generateSheet: <T = unknown>(body: Record<string, unknown>) => invokeTauri<T>("sprite_generate_sheet", { body }),
  cleanup: <T = unknown>(body: Record<string, unknown>) => invokeTauri<T>("sprite_cleanup", { body }),
  list: async <T = unknown>(characterId: string, options?: SpriteOwnerOptions) => {
    const owner = spriteOwnerArgs(characterId, options);
    return resolveSpriteResponse(await invokeTauri<T>("sprite_list", owner), owner.characterId, owner.ownerType);
  },
  upload: async <T = unknown>(characterId: string, body: Record<string, unknown>, options?: SpriteOwnerOptions) => {
    const owner = spriteOwnerArgs(characterId, options);
    return resolveSpriteResponse(
      await invokeTauri<T>("sprite_upload", { ...owner, body }),
      owner.characterId,
      owner.ownerType,
    );
  },
  bulkUpload: async <T = unknown>(characterId: string, body: Record<string, unknown>, options?: SpriteOwnerOptions) => {
    const owner = spriteOwnerArgs(characterId, options);
    return resolveSpriteResponse(
      await invokeTauri<T>("sprite_upload_bulk", { ...owner, body }),
      owner.characterId,
      owner.ownerType,
    );
  },
  delete: <T = unknown>(characterId: string, expression: string, options?: SpriteOwnerOptions) =>
    invokeTauri<T>("sprite_delete", { ...spriteOwnerArgs(characterId, options), expression }),
  cleanupSaved: async <T = unknown>(
    characterId: string,
    body: Record<string, unknown>,
    options?: SpriteOwnerOptions,
  ) => {
    const owner = spriteOwnerArgs(characterId, options);
    return resolveSpriteResponse(
      await invokeTauri<T>("sprite_cleanup_saved", { ...owner, body }),
      owner.characterId,
      owner.ownerType,
    );
  },
  cleanupRestore: async <T = unknown>(
    characterId: string,
    body: Record<string, unknown>,
    options?: SpriteOwnerOptions,
  ) => {
    const owner = spriteOwnerArgs(characterId, options);
    return resolveSpriteResponse(
      await invokeTauri<T>("sprite_cleanup_restore", { ...owner, body }),
      owner.characterId,
      owner.ownerType,
    );
  },
};

export const imageGenerationApi = {
  avatarPreview: <T = unknown>(body: Record<string, unknown>) =>
    invokeTauri<T>("avatar_generation_preview_command", { body }),
  avatarGenerate: <T = unknown>(body: Record<string, unknown>) => invokeTauri<T>("avatar_generation_command", { body }),
  generate: <T = unknown>(body: Record<string, unknown>) => invokeTauri<T>("image_generate", { body }),
};

export const galleryApi = {
  uploadCharacter: async <T = unknown>(characterId: string, file: File) => {
    const payload = await fileToUploadPayload(file, {
      maxBytes: MAX_IMAGE_UPLOAD_BYTES,
      tooLargeMessage: IMAGE_UPLOAD_SIZE_ERROR,
    });
    return invokeTauri<T>("character_gallery_upload", { characterId, body: { file: payload } });
  },
  uploadChat: async <T = unknown>(chatId: string, file: File) => {
    const payload = await fileToUploadPayload(file, {
      maxBytes: MAX_IMAGE_UPLOAD_BYTES,
      tooLargeMessage: IMAGE_UPLOAD_SIZE_ERROR,
    });
    return invokeTauri<T>("chat_gallery_upload", { chatId, body: { file: payload } });
  },
};
