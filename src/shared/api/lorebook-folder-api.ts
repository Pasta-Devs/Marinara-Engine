import type { LorebookFolder } from "../../engine/contracts/types/lorebook";
import { invokeTauri } from "./tauri-client";

export const lorebookFolderApi = {
  reorder: (input: { lorebookId: string; folderIds: string[]; parentFolderId: string | null }) =>
    invokeTauri<LorebookFolder[]>("lorebook_folder_reorder", {
      lorebookId: input.lorebookId,
      orderedIds: input.folderIds,
      parentFolderId: input.parentFolderId,
    }),
};
