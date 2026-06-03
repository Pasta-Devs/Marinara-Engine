import { invokeTauri } from "./tauri-client";
import { invalidateRemoteManagedAssetObjectUrlsAfter } from "./local-file-api";

export const npcAvatarApi = {
  upload: (chatId: string, name: string, avatar: string) =>
    invalidateRemoteManagedAssetObjectUrlsAfter(
      invokeTauri<{ avatarPath: string; avatarFilePath?: string; avatarFilename?: string }>("npc_avatar_upload", {
        chatId,
        body: { name, avatar },
      }),
      ["avatar", "avatar-thumbnail"],
    ),
};
