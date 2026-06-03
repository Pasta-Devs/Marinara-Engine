import { invokeTauri } from "./tauri-client";
import { ApiError } from "./api-errors";
import { downloadPayloadFromApiValue, type DownloadPayload } from "./download-payload";
import { invalidateRemoteManagedAssetObjectUrlsAfter, type RemoteManagedAssetKind } from "./local-file-api";
import { remoteRuntimeTarget } from "./remote-runtime";

export type ProfileExportFormat = "native" | "compatible" | "zip";

const PROFILE_EXPORT_FALLBACKS: Record<ProfileExportFormat, { filename: string; contentType: string }> = {
  native: { filename: "marinara-profile.json", contentType: "application/json" },
  compatible: { filename: "marinara-compatible-export.zip", contentType: "application/zip" },
  zip: { filename: "marinara-profile.zip", contentType: "application/zip" },
};

const PROFILE_IMPORT_MANAGED_ASSET_KINDS: RemoteManagedAssetKind[] = [
  "avatar",
  "avatar-thumbnail",
  "background",
  "gallery",
  "game",
  "lorebook",
  "sprite",
];

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("Could not read profile file"));
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      resolve(result.split(",", 2)[1] ?? result);
    };
    reader.readAsDataURL(file);
  });
}

async function exportProfile(format: ProfileExportFormat = "native"): Promise<DownloadPayload> {
  const value = await invokeTauri("profile_export", { format });
  const fallback = PROFILE_EXPORT_FALLBACKS[format];
  return downloadPayloadFromApiValue(value, fallback.filename, fallback.contentType);
}

async function importProfile<T>(envelope: unknown): Promise<T> {
  return invalidateRemoteManagedAssetObjectUrlsAfter(
    invokeTauri<T>("profile_import", { envelope }),
    PROFILE_IMPORT_MANAGED_ASSET_KINDS,
  );
}

async function importProfileFile<T>(path: string): Promise<T> {
  if (remoteRuntimeTarget()) {
    throw new ApiError(
      "Profile import from a local file path is not available while Remote Runtime is configured.",
      400,
      { code: "remote_local_path_unsupported" },
    );
  }
  return invalidateRemoteManagedAssetObjectUrlsAfter(
    invokeTauri<T>("profile_import_file", { path }),
    PROFILE_IMPORT_MANAGED_ASSET_KINDS,
  );
}

async function importProfileUpload<T>(file: File): Promise<T> {
  return invalidateRemoteManagedAssetObjectUrlsAfter(
    invokeTauri<T>("profile_import_upload", {
      filename: file.name,
      base64: await readFileAsBase64(file),
    }),
    PROFILE_IMPORT_MANAGED_ASSET_KINDS,
  );
}

export type ManagedBackup = {
  name: string;
  createdAt: string;
};

async function createBackup(): Promise<{ success: boolean; backupName: string }> {
  return invokeTauri("backup_create");
}

async function listBackups(): Promise<ManagedBackup[]> {
  return invokeTauri("backup_list");
}

async function deleteBackup(name: string): Promise<{ success: boolean; deleted: boolean }> {
  return invokeTauri("backup_delete", { name });
}

async function downloadBackup(name?: string): Promise<DownloadPayload> {
  const value = await invokeTauri("backup_download", name ? { name } : undefined);
  return downloadPayloadFromApiValue(value, "marinara-backup.zip", "application/zip");
}

export const profileApi = {
  exportProfile,
  importProfile,
  importProfileFile,
  importProfileUpload,
};

export const backupApi = {
  createBackup,
  listBackups,
  deleteBackup,
  downloadBackup,
};
