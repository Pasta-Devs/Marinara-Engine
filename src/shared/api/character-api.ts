import { invokeTauri } from "./tauri-client";
import { storageApi } from "./storage-api";
import { invalidateRemoteManagedAssetObjectUrlsAfter } from "./local-file-api";

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
    invalidateRemoteManagedAssetObjectUrlsAfter(invokeTauri("character_restore_version", { characterId, versionId }), [
      "avatar",
      "avatar-thumbnail",
      "gallery",
      "sprite",
    ]),
  uploadAvatar: (id: string, avatar: string) =>
    invalidateRemoteManagedAssetObjectUrlsAfter(invokeTauri("character_avatar_upload", { id, body: { avatar } }), [
      "avatar",
      "avatar-thumbnail",
    ]),
  removeAvatar: (id: string) =>
    invalidateRemoteManagedAssetObjectUrlsAfter(invokeTauri("character_avatar_remove", { id }), [
      "avatar",
      "avatar-thumbnail",
    ]),
  importEmbeddedLorebook: (id: string) =>
    invokeTauri<EmbeddedLorebookImportResult>("character_embedded_lorebook_import", { id }),
};
