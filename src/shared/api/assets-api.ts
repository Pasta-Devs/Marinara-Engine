import { fileToUploadPayload, GAME_ASSET_SIZE_ERROR } from "./file-payload";
import { MAX_FILE_SIZES } from "../../engine/contracts/constants/defaults";
import { invokeTauri } from "./tauri-client";
import { invalidateRemoteManagedAssetObjectUrlsAfter } from "./local-file-api";

interface GameAssetFileInfo {
  name: string;
  size: number;
  width?: number;
  height?: number;
  format?: string;
  modified: string;
  created: string;
}

type BulkOperationResult = {
  succeeded: string[];
  failed: { path: string; error: string }[];
};

async function uploadGameAsset({
  file,
  category,
  subcategory,
}: {
  file: File;
  category: string;
  subcategory?: string;
}) {
  return invalidateRemoteManagedAssetObjectUrlsAfter(
    invokeTauri("game_assets_upload", {
      body: {
        category,
        subcategory: subcategory ?? "",
        file: await fileToUploadPayload(file, {
          maxBytes: MAX_FILE_SIZES.GAME_ASSET,
          tooLargeMessage: GAME_ASSET_SIZE_ERROR,
        }),
      },
    }),
    "game",
  );
}

const gameAssetCommands = {
  manifest: <T = unknown>() => invokeTauri<T>("game_assets_manifest"),
  tree: <T = unknown>() => invokeTauri<T>("game_assets_tree"),
  list: (path?: string) => invokeTauri<unknown[]>("game_assets_list", { path: path ?? null }),
  createFolder: (path: string) => invokeTauri("game_assets_create_folder", { path }),
  deleteFolder: (path: string, recursive?: boolean) =>
    invalidateRemoteManagedAssetObjectUrlsAfter(
      invokeTauri("game_assets_delete_folder", { path, recursive: recursive ?? false }),
      "game",
    ),
  rename: (path: string, newName: string) =>
    invalidateRemoteManagedAssetObjectUrlsAfter(invokeTauri("game_assets_rename", { path, newName }), "game"),
  move: (path: string, targetFolder: string) =>
    invalidateRemoteManagedAssetObjectUrlsAfter(invokeTauri("game_assets_move", { path, targetFolder }), "game"),
  copy: (path: string, targetFolder: string) => invokeTauri("game_assets_copy", { path, targetFolder }),
  deleteFile: (path: string) =>
    invalidateRemoteManagedAssetObjectUrlsAfter(invokeTauri<void>("game_assets_delete_file", { path }), "game"),
  openFolder: (subfolder?: string) => invokeTauri<void>("game_assets_open_folder", { subfolder: subfolder ?? null }),
  rescan: () => invalidateRemoteManagedAssetObjectUrlsAfter(invokeTauri("game_assets_rescan"), "game"),
  upload: uploadGameAsset,
  updateFolderDescription: (path: string, description: string) =>
    invokeTauri("game_assets_folder_description", { path, description }),
  readText: <T = { content: string }>(path: string) => invokeTauri<T>("game_assets_read_text", { path }),
  writeText: (path: string, content: string) =>
    invalidateRemoteManagedAssetObjectUrlsAfter(invokeTauri<void>("game_assets_write_text", { path, content }), "game"),
  fileInfo: (path: string) => invokeTauri<GameAssetFileInfo>("game_assets_file_info", { path }),
  moveBulk: (paths: string[], targetFolder: string) =>
    invalidateRemoteManagedAssetObjectUrlsAfter(
      invokeTauri<BulkOperationResult & { targetFolder: string }>("game_assets_move_bulk", { paths, targetFolder }),
      "game",
    ),
  copyBulk: (paths: string[], targetFolder: string) =>
    invokeTauri<BulkOperationResult & { targetFolder: string }>("game_assets_copy_bulk", { paths, targetFolder }),
  deleteBulk: (paths: string[]) =>
    invalidateRemoteManagedAssetObjectUrlsAfter(
      invokeTauri<BulkOperationResult>("game_assets_delete_bulk", { paths }),
      "game",
    ),
};

export const gameAssetsApi = {
  ...gameAssetCommands,
};
