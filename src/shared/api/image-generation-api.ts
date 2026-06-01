import { invokeTauri } from "./tauri-client";
import { fileToUploadPayload, IMAGE_UPLOAD_SIZE_ERROR, MAX_IMAGE_UPLOAD_BYTES } from "./file-payload";

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

export const spriteApi = {
  capabilities: <T = unknown>() => invokeTauri<T>("sprite_capabilities_command"),
  cleanupStatus: <T = unknown>() => invokeTauri<T>("sprite_cleanup_status_command"),
  generateSheetPreview: <T = unknown>(body: Record<string, unknown>) =>
    invokeTauri<T>("sprite_generate_sheet_preview", { body }),
  generateSheet: <T = unknown>(body: Record<string, unknown>) => invokeTauri<T>("sprite_generate_sheet", { body }),
  cleanup: <T = unknown>(body: Record<string, unknown>) => invokeTauri<T>("sprite_cleanup", { body }),
  list: <T = unknown>(characterId: string, options?: SpriteOwnerOptions) =>
    invokeTauri<T>("sprite_list", spriteOwnerArgs(characterId, options)),
  upload: <T = unknown>(characterId: string, body: Record<string, unknown>, options?: SpriteOwnerOptions) =>
    invokeTauri<T>("sprite_upload", { ...spriteOwnerArgs(characterId, options), body }),
  bulkUpload: <T = unknown>(characterId: string, body: Record<string, unknown>, options?: SpriteOwnerOptions) =>
    invokeTauri<T>("sprite_upload_bulk", { ...spriteOwnerArgs(characterId, options), body }),
  delete: <T = unknown>(characterId: string, expression: string, options?: SpriteOwnerOptions) =>
    invokeTauri<T>("sprite_delete", { ...spriteOwnerArgs(characterId, options), expression }),
  cleanupSaved: <T = unknown>(characterId: string, body: Record<string, unknown>, options?: SpriteOwnerOptions) =>
    invokeTauri<T>("sprite_cleanup_saved", { ...spriteOwnerArgs(characterId, options), body }),
  cleanupRestore: <T = unknown>(characterId: string, body: Record<string, unknown>, options?: SpriteOwnerOptions) =>
    invokeTauri<T>("sprite_cleanup_restore", { ...spriteOwnerArgs(characterId, options), body }),
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
