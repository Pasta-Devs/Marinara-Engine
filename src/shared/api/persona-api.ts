import { invokeTauri } from "./tauri-client";
import { invalidateRemoteManagedAssetObjectUrlsAfter } from "./local-file-api";

export const personaApi = {
  activate: (id: string) => invokeTauri("persona_activate", { id }),
  uploadAvatar: (id: string, avatar: string, filename?: string) =>
    invalidateRemoteManagedAssetObjectUrlsAfter(
      invokeTauri("persona_avatar_upload", { id, body: { avatar, filename } }),
      ["avatar", "avatar-thumbnail"],
    ),
};
