import { invokeTauri } from "./tauri-client";
import { storageApi } from "./storage-api";

export type EmbeddedLorebookImportResult = {
  success: boolean;
  lorebookId: string;
  entriesImported: number;
  reimported?: boolean;
};

export type CharacterUpdatePatch = Record<string, unknown>;

export const characterApi = {
  update: (id: string, patch: CharacterUpdatePatch) => storageApi.update("characters", id, patch),
  restoreVersion: (characterId: string, versionId: string) =>
    invokeTauri("character_restore_version", { characterId, versionId }),
  uploadAvatar: (id: string, avatar: string) => invokeTauri("character_avatar_upload", { id, body: { avatar } }),
  importEmbeddedLorebook: (id: string) =>
    invokeTauri<EmbeddedLorebookImportResult>("character_embedded_lorebook_import", { id }),
};
