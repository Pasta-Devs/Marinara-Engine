import { invokeTauri } from "./tauri-client";
import { fileToUploadPayload, IMAGE_UPLOAD_SIZE_ERROR, MAX_IMAGE_UPLOAD_BYTES } from "./file-payload";

export const spriteApi = {
  capabilities: <T = unknown>() => invokeTauri<T>("sprite_capabilities_command"),
  cleanupStatus: <T = unknown>() => invokeTauri<T>("sprite_cleanup_status_command"),
  generateSheetPreview: <T = unknown>(body: Record<string, unknown>) =>
    invokeTauri<T>("sprite_generate_sheet_preview", { body }),
  generateSheet: <T = unknown>(body: Record<string, unknown>) => invokeTauri<T>("sprite_generate_sheet", { body }),
  cleanup: <T = unknown>(body: Record<string, unknown>) => invokeTauri<T>("sprite_cleanup", { body }),
  list: <T = unknown>(characterId: string) => invokeTauri<T>("sprite_list", { characterId }),
  upload: <T = unknown>(characterId: string, body: Record<string, unknown>) =>
    invokeTauri<T>("sprite_upload", { characterId, body }),
  bulkUpload: <T = unknown>(characterId: string, body: Record<string, unknown>) =>
    invokeTauri<T>("sprite_upload_bulk", { characterId, body }),
  delete: <T = unknown>(characterId: string, expression: string) =>
    invokeTauri<T>("sprite_delete", { characterId, expression }),
  cleanupSaved: <T = unknown>(characterId: string, body: Record<string, unknown>) =>
    invokeTauri<T>("sprite_cleanup_saved", { characterId, body }),
  cleanupRestore: <T = unknown>(characterId: string, body: Record<string, unknown>) =>
    invokeTauri<T>("sprite_cleanup_restore", { characterId, body }),
};

export const imageGenerationApi = {
  avatarPreview: <T = unknown>(body: Record<string, unknown>) =>
    invokeTauri<T>("avatar_generation_preview_command", { body }),
  avatarGenerate: <T = unknown>(body: Record<string, unknown>) =>
    invokeTauri<T>("avatar_generation_command", { body }),
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
