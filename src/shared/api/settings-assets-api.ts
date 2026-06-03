import { fileToUploadPayload, IMAGE_UPLOAD_SIZE_ERROR, MAX_IMAGE_UPLOAD_BYTES } from "./file-payload";
import { invokeTauri } from "./tauri-client";
import { invalidateRemoteManagedAssetObjectUrlsAfter } from "./local-file-api";

export const fontsApi = {
  list: <T = unknown>() => invokeTauri<T>("fonts_list"),
  downloadGoogle: <T = unknown>(family: string) => invokeTauri<T>("fonts_google_download", { family }),
  openFolder: () => invokeTauri("fonts_open_folder"),
};

export const backgroundsApi = {
  list: <T = unknown>() => invokeTauri<T>("backgrounds_list"),
  tags: <T = unknown>() => invokeTauri<T>("backgrounds_tags"),
  upload: async <T = unknown>(file: File) => {
    const payload = await fileToUploadPayload(file, {
      maxBytes: MAX_IMAGE_UPLOAD_BYTES,
      tooLargeMessage: IMAGE_UPLOAD_SIZE_ERROR,
    });
    return invalidateRemoteManagedAssetObjectUrlsAfter(
      invokeTauri<T>("background_upload", { body: { file: payload } }),
      "background",
    );
  },
  delete: <T = unknown>(filename: string) =>
    invalidateRemoteManagedAssetObjectUrlsAfter(invokeTauri<T>("background_delete", { filename }), "background"),
  updateTags: <T = unknown>(filename: string, tags: string[]) =>
    invokeTauri<T>("background_tags_update", { filename, tags }),
  rename: <T = unknown>(filename: string, name: string) =>
    invalidateRemoteManagedAssetObjectUrlsAfter(invokeTauri<T>("background_rename", { filename, name }), "background"),
};
