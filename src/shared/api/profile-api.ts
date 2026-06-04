import { Channel } from "@tauri-apps/api/core";
import { invokeTauri } from "./tauri-client";
import { ApiError } from "./api-errors";
import { downloadPayloadFromApiValue, type DownloadPayload } from "./download-payload";
import { invalidateRemoteManagedAssetObjectUrlsAfter, type RemoteManagedAssetKind } from "./local-file-api";
import {
  readRemoteError,
  remoteFetchInit,
  remotePrivilegedHeaders,
  remoteRuntimeTarget,
  streamRemoteFormEvents,
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

export type ProfileImportProgressEvent = { type: string; data: unknown };
type RawProfileImportEvent = { type?: unknown; data?: unknown; text?: unknown; [key: string]: unknown };
type ProfileImportProgressHandler = (event: ProfileImportProgressEvent) => void;

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

async function importProfileFile<T>(path: string, options?: { previewFingerprint?: string | null }): Promise<T> {
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

function normalizeProfileImportEvent(event: RawProfileImportEvent): ProfileImportProgressEvent {
  const type = typeof event.type === "string" ? event.type : "message";
  return { type, data: "data" in event ? event.data : "text" in event ? event.text : event };
}

function isProfileImportEventRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function profileImportEventError(event: ProfileImportProgressEvent): ApiError {
  const record = isProfileImportEventRecord(event.data) ? event.data : {};
  const originalError = isProfileImportEventRecord(record.error) ? record.error : undefined;
  const code =
    typeof record.code === "string"
      ? record.code
      : typeof originalError?.code === "string"
        ? originalError.code
        : undefined;
  const message =
    typeof record.message === "string"
      ? record.message
      : typeof record.error === "string"
        ? record.error
        : typeof originalError?.message === "string"
          ? originalError.message
          : "Profile import failed";
  return new ApiError(message, 500, {
    ...(code ? { code } : {}),
    event,
    ...(originalError ? { originalError } : {}),
  });
}

async function runTauriProfileFileImportWithProgress<T>(
  path: string,
  options: { previewFingerprint?: string | null } | undefined,
  onProgress?: ProfileImportProgressHandler,
): Promise<T> {
  const queue: RawProfileImportEvent[] = [];
  let completed = false;
  let failure: unknown = null;
  let streamedFailure: ApiError | null = null;
  let wake: (() => void) | null = null;
  let doneData: T | null = null;
  let hasDone = false;
  const notify = () => {
    wake?.();
    wake = null;
  };
  const onEvent = new Channel<RawProfileImportEvent>((event) => {
    queue.push(event);
    if (event.type === "done" || event.type === "error") completed = true;
    notify();
  });
  const command = invokeTauri<T>("profile_import_file_events", {
    path,
    previewFingerprint: options?.previewFingerprint ?? null,
    onEvent,
  }).then(
    (value) => {
      if (!hasDone && !failure) {
        doneData = value;
        hasDone = true;
      }
      completed = true;
      notify();
    },
    (error) => {
      if (!failure) failure = error;
      completed = true;
      notify();
    },
  );

  while (!completed || queue.length > 0) {
    if (queue.length === 0) {
      if (failure) break;
      await new Promise<void>((resolve) => {
        wake = resolve;
      });
      continue;
    }
    const event = normalizeProfileImportEvent(queue.shift()!);
    if (event.type === "progress") {
      onProgress?.(event);
      continue;
    }
    if (event.type === "done") {
      doneData = event.data as T;
      hasDone = true;
      completed = true;
      continue;
    }
    if (event.type === "error") {
      streamedFailure = profileImportEventError(event);
      completed = true;
    }
  }
  await command;
  if (failure) throw failure;
  if (streamedFailure) throw streamedFailure;
  if (!hasDone) throw new ApiError("Profile import stream ended before completion", 500);
  return doneData as T;
}

async function importProfileFileWithProgress<T>(
  path: string,
  options?: { previewFingerprint?: string | null },
  onProgress?: ProfileImportProgressHandler,
): Promise<T> {
  if (remoteRuntimeTarget()) {
    throw new ApiError(
      "Profile import from a local file path is not available while Remote Runtime is configured.",
      400,
      { code: "remote_local_path_unsupported" },
    );
  }
  return invalidateRemoteManagedAssetObjectUrlsAfter(
    runTauriProfileFileImportWithProgress<T>(path, options, onProgress),
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

async function importRemoteProfileUploadWithProgress<T>(
  file: File,
  onProgress?: ProfileImportProgressHandler,
): Promise<T> {
  const form = new FormData();
  form.append("file", file, file.name);
  let doneData: T | null = null;
  let hasDone = false;
  for await (const event of streamRemoteFormEvents("/api/profile/import/events", form, { privileged: true })) {
    if (event.type === "progress") {
      onProgress?.(event);
      continue;
    }
    if (event.type === "done") {
      doneData = event.data as T;
      hasDone = true;
    }
  }
  if (!hasDone) throw new ApiError("Profile import stream ended before completion", 500);
  return doneData as T;
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

async function importProfileUploadWithProgress<T>(file: File, onProgress?: ProfileImportProgressHandler): Promise<T> {
  const target = remoteRuntimeTarget();
  return invalidateRemoteManagedAssetObjectUrlsAfter(
    target
      ? importRemoteProfileUploadWithProgress<T>(file, onProgress)
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
  importProfileFileWithProgress,
  importProfileUpload,
  importProfileUploadWithProgress,
};

export const backupApi = {
  createBackup,
  listBackups,
  deleteBackup,
  downloadBackup,
};
