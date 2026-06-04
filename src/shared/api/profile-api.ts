import { invokeTauri } from "./tauri-client";
import { ApiError } from "./api-errors";
import { downloadPayloadFromApiValue, type DownloadPayload } from "./download-payload";
import { invalidateRemoteManagedAssetObjectUrlsAfter, type RemoteManagedAssetKind } from "./local-file-api";
import {
  readRemoteError,
  remoteFetchInit,
  remotePrivilegedHeaders,
  remoteRuntimeTarget,
  type RuntimeTarget,
} from "./remote-runtime";

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

function profileExportUrl(target: RuntimeTarget, format: ProfileExportFormat) {
  const params = new URLSearchParams({ format });
  return `${target.baseUrl}/api/profile/export?${params.toString()}`;
}

function filenameFromContentDisposition(value: string | null, fallback: string) {
  if (!value) return fallback;
  const encoded = value.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  if (encoded) {
    try {
      const decoded = decodeURIComponent(encoded.trim().replace(/^"|"$/g, ""));
      if (decoded) return decoded;
    } catch {
      // Fall back to plain filename parsing below.
    }
  }
  const plain = value.match(/filename="?([^";]+)"?/i)?.[1]?.trim();
  return plain || fallback;
}

async function exportRemoteProfile(target: RuntimeTarget, format: ProfileExportFormat): Promise<DownloadPayload> {
  const fallback = PROFILE_EXPORT_FALLBACKS[format];
  const response = await fetch(
    profileExportUrl(target, format),
    remoteFetchInit({
      method: "GET",
      headers: remotePrivilegedHeaders(target, { accept: fallback.contentType }),
    }),
  );
  if (!response.ok) throw await readRemoteError(response);
  return {
    blob: await response.blob(),
    filename: filenameFromContentDisposition(response.headers.get("content-disposition"), fallback.filename),
  };
}

async function exportProfile(format: ProfileExportFormat = "native"): Promise<DownloadPayload> {
  const target = remoteRuntimeTarget();
  if (target) return exportRemoteProfile(target, format);
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

async function importProfileFile<T>(
  path: string,
  options?: { previewFingerprint?: string | null },
): Promise<T> {
  if (remoteRuntimeTarget()) {
    throw new ApiError(
      "Profile import from a local file path is not available while Remote Runtime is configured.",
      400,
      { code: "remote_local_path_unsupported" },
    );
  }
  return invalidateRemoteManagedAssetObjectUrlsAfter(
    invokeTauri<T>("profile_import_file", {
      path,
      previewFingerprint: options?.previewFingerprint ?? null,
    }),
    PROFILE_IMPORT_MANAGED_ASSET_KINDS,
  );
}

async function previewProfileFile<T>(path: string): Promise<T> {
  if (remoteRuntimeTarget()) {
    throw new ApiError(
      "Profile preview from a local file path is not available while Remote Runtime is configured.",
      400,
      { code: "remote_local_path_unsupported" },
    );
  }
  return invokeTauri<T>("profile_import_preview_file", { path });
}

async function previewRemoteProfileUpload<T>(target: RuntimeTarget, file: File): Promise<T> {
  const form = new FormData();
  form.append("file", file, file.name);
  const response = await fetch(
    `${target.baseUrl}/api/profile/import/preview`,
    remoteFetchInit({
      method: "POST",
      headers: remotePrivilegedHeaders(target, { accept: "application/json" }),
      body: form,
    }),
  );
  if (!response.ok) throw await readRemoteError(response);
  return (await response.json()) as T;
}

async function previewProfileUpload<T>(file: File): Promise<T> {
  const target = remoteRuntimeTarget();
  return target
    ? previewRemoteProfileUpload<T>(target, file)
    : invokeTauri<T>("profile_import_preview_upload", {
        filename: file.name,
        base64: await readFileAsBase64(file),
      });
}

async function importRemoteProfileUpload<T>(target: RuntimeTarget, file: File): Promise<T> {
  const form = new FormData();
  form.append("file", file, file.name);
  const response = await fetch(
    `${target.baseUrl}/api/profile/import`,
    remoteFetchInit({
      method: "POST",
      headers: remotePrivilegedHeaders(target, { accept: "application/json" }),
      body: form,
    }),
  );
  if (!response.ok) throw await readRemoteError(response);
  return (await response.json()) as T;
}

async function importProfileUpload<T>(file: File): Promise<T> {
  const target = remoteRuntimeTarget();
  return invalidateRemoteManagedAssetObjectUrlsAfter(
    target
      ? importRemoteProfileUpload<T>(target, file)
      : invokeTauri<T>("profile_import_upload", {
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
  previewProfileFile,
  previewProfileUpload,
  importProfileFile,
  importProfileUpload,
};

export const backupApi = {
  createBackup,
  listBackups,
  deleteBackup,
  downloadBackup,
};
