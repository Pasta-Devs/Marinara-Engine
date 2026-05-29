import { fileToUploadPayload } from "./file-payload";
import { invokeTauri } from "./tauri-client";

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
  return invokeTauri("game_assets_upload", {
    body: {
      category,
      subcategory: subcategory ?? "",
      file: await fileToUploadPayload(file),
    },
  });
}

const gameAssetCommands = {
  manifest: <T = unknown>() => invokeTauri<T>("game_assets_manifest"),
  tree: <T = unknown>() => invokeTauri<T>("game_assets_tree"),
  list: (path?: string) => invokeTauri<unknown[]>("game_assets_list", { path: path ?? null }),
  createFolder: (path: string) => invokeTauri("game_assets_create_folder", { path }),
  deleteFolder: (path: string, recursive?: boolean) =>
    invokeTauri("game_assets_delete_folder", { path, recursive: recursive ?? false }),
  rename: (path: string, newName: string) => invokeTauri("game_assets_rename", { path, newName }),
  move: (path: string, targetFolder: string) => invokeTauri("game_assets_move", { path, targetFolder }),
  copy: (path: string, targetFolder: string) => invokeTauri("game_assets_copy", { path, targetFolder }),
  deleteFile: (path: string) => invokeTauri<void>("game_assets_delete_file", { path }),
  openFolder: (subfolder?: string) => invokeTauri<void>("game_assets_open_folder", { subfolder: subfolder ?? null }),
  rescan: () => invokeTauri("game_assets_rescan"),
  upload: uploadGameAsset,
  updateFolderDescription: (path: string, description: string) =>
    invokeTauri("game_assets_folder_description", { path, description }),
  readText: <T = { content: string }>(path: string) => invokeTauri<T>("game_assets_read_text", { path }),
  writeText: (path: string, content: string) => invokeTauri<void>("game_assets_write_text", { path, content }),
  fileInfo: (path: string) => invokeTauri<GameAssetFileInfo>("game_assets_file_info", { path }),
  moveBulk: (paths: string[], targetFolder: string) =>
    invokeTauri<BulkOperationResult & { targetFolder: string }>("game_assets_move_bulk", { paths, targetFolder }),
  copyBulk: (paths: string[], targetFolder: string) =>
    invokeTauri<BulkOperationResult & { targetFolder: string }>("game_assets_copy_bulk", { paths, targetFolder }),
  deleteBulk: (paths: string[]) => invokeTauri<BulkOperationResult>("game_assets_delete_bulk", { paths }),
};

export const gameAssetsApi = {
  ...gameAssetCommands,
};
