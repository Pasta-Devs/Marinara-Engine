import { formDataToJson, CHAT_IMPORT_SIZE_ERROR, type FilePayloadOptions } from "./file-payload";
import { MAX_FILE_SIZES } from "../../engine/contracts/constants/defaults";
import { Channel } from "@tauri-apps/api/core";
import { invokeTauri } from "./tauri-client";
import {
  invalidateRemoteManagedAssetObjectUrls,
  invalidateRemoteManagedAssetObjectUrlsAfter,
  type RemoteManagedAssetKind,
} from "./local-file-api";
import { remoteRuntimeTarget, streamRemoteJsonEvents } from "./remote-runtime";

export interface ImportFilePayload {
  file: File;
  fields?: Record<string, string | number | boolean | null | undefined>;
}

const CHAT_IMPORT_LIMIT: FilePayloadOptions = {
  maxBytes: MAX_FILE_SIZES.CHAT_JSONL,
  tooLargeMessage: CHAT_IMPORT_SIZE_ERROR,
};

const IMPORT_MANAGED_ASSET_KINDS: RemoteManagedAssetKind[] = [
  "avatar",
  "avatar-thumbnail",
  "background",
  "gallery",
  "lorebook",
  "sprite",
];

function invalidateImportManagedAssetObjectUrls(): void {
  for (const kind of IMPORT_MANAGED_ASSET_KINDS) {
    invalidateRemoteManagedAssetObjectUrls(kind);
  }
}

async function filePayload(
  payload: ImportFilePayload | File,
  options?: FilePayloadOptions,
): Promise<Record<string, unknown>> {
  const file = payload instanceof File ? payload : payload.file;
  const fields = payload instanceof File ? undefined : payload.fields;
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields ?? {})) {
    if (value !== null && value !== undefined) formData.append(key, String(value));
  }
  formData.append("file", file, file.name);
  return formDataToJson(formData, options);
}

async function filesPayload(
  payload: File[] | FormData,
  options?: FilePayloadOptions,
): Promise<Record<string, unknown>> {
  if (payload instanceof FormData) return formDataToJson(payload, options);
  const form = new FormData();
  payload.forEach((file) => form.append("files", file, file.name));
  return formDataToJson(form, options);
}

export const importApi = {
  marinara: <T>(envelope: unknown) =>
    invalidateRemoteManagedAssetObjectUrlsAfter(
      invokeTauri<T>("import_marinara", { envelope }),
      IMPORT_MANAGED_ASSET_KINDS,
    ),
  marinaraFile: async <T>(payload: ImportFilePayload | File) =>
    invalidateRemoteManagedAssetObjectUrlsAfter(
      invokeTauri<T>("import_marinara_file", { body: await filePayload(payload) }),
      IMPORT_MANAGED_ASSET_KINDS,
    ),
  stCharacterJson: <T>(body: unknown) =>
    invalidateRemoteManagedAssetObjectUrlsAfter(invokeTauri<T>("import_st_character", { body }), [
      "avatar",
      "avatar-thumbnail",
      "gallery",
      "sprite",
    ]),
  stCharacterFile: async <T>(payload: ImportFilePayload) =>
    invalidateRemoteManagedAssetObjectUrlsAfter(
      invokeTauri<T>("import_st_character", { body: await filePayload(payload) }),
      ["avatar", "avatar-thumbnail", "gallery", "sprite"],
    ),
  stCharacterBatch: async <T>(payload: ImportFilePayload | File[] | FormData) => {
    const body =
      Array.isArray(payload) || payload instanceof FormData ? await filesPayload(payload) : await filePayload(payload);
    return invalidateRemoteManagedAssetObjectUrlsAfter(invokeTauri<T>("import_st_character_batch", { body }), [
      "avatar",
      "avatar-thumbnail",
      "gallery",
      "sprite",
    ]);
  },
  stCharacterInspect: async <T>(payload: File[] | FormData) =>
    invokeTauri<T>("import_st_character_inspect", { body: await filesPayload(payload) }),
  stChat: async <T>(file: File) =>
    invalidateRemoteManagedAssetObjectUrlsAfter(
      invokeTauri<T>("import_st_chat", { body: await filePayload(file, CHAT_IMPORT_LIMIT) }),
      ["avatar", "avatar-thumbnail", "background", "gallery"],
    ),
  stChatIntoGroup: async <T>(chatId: string, file: File) =>
    invalidateRemoteManagedAssetObjectUrlsAfter(
      invokeTauri<T>("import_st_chat_into_group", {
        body: await filePayload({ file, fields: { chatId } }, CHAT_IMPORT_LIMIT),
      }),
      ["avatar", "avatar-thumbnail", "background", "gallery"],
    ),
  stPreset: <T>(payload: unknown) => invokeTauri<T>("import_st_preset", { payload }),
  stLorebook: <T>(payload: unknown) =>
    invalidateRemoteManagedAssetObjectUrlsAfter(invokeTauri<T>("import_st_lorebook", { payload }), "lorebook"),
  stBulkScan: <T>(payload: unknown) => invokeTauri<T>("import_st_bulk_scan", { payload }),
  stBulkRun: <T>(payload: unknown) =>
    invalidateRemoteManagedAssetObjectUrlsAfter(
      invokeTauri<T>("import_st_bulk_run", { payload }),
      IMPORT_MANAGED_ASSET_KINDS,
    ),
  stBulkRunEvents: async function* (
    payload: unknown,
    signal?: AbortSignal,
  ): AsyncGenerator<{ type: string; data: unknown }> {
    if (signal?.aborted) throw new DOMException("The operation was aborted.", "AbortError");
    let importCompleted = false;
    let importFailed = false;
    if (remoteRuntimeTarget()) {
      try {
        for await (const event of streamRemoteJsonEvents("/api/import/st-bulk/run", payload, {
          signal,
          privileged: true,
        })) {
          if (event.type === "done") importCompleted = true;
          yield event;
        }
      } catch (error) {
        importFailed = true;
        throw error;
      } finally {
        if (importCompleted && !importFailed && !signal?.aborted) {
          invalidateImportManagedAssetObjectUrls();
        }
      }
      return;
    }
    const queue: Array<{ type?: unknown; data?: unknown; text?: unknown; [key: string]: unknown }> = [];
    let completed = false;
    let failure: unknown = null;
    let wake: (() => void) | null = null;
    const notify = () => {
      wake?.();
      wake = null;
    };
    const abort = () => {
      importFailed = true;
      failure = new DOMException("The operation was aborted.", "AbortError");
      notify();
    };
    signal?.addEventListener("abort", abort, { once: true });
    const onEvent = new Channel<(typeof queue)[number]>((event) => {
      queue.push(event);
      if (event.type === "done" || event.type === "error") completed = true;
      notify();
    });
    const command = invokeTauri<void>("import_st_bulk_run_events", { payload, onEvent }).catch((error) => {
      failure = error;
      completed = true;
      notify();
    });

    try {
      while (!completed || queue.length > 0) {
        if (failure) throw failure;
        if (queue.length === 0) {
          await new Promise<void>((resolve) => {
            wake = resolve;
          });
          continue;
        }
        const event = queue.shift()!;
        const type = typeof event.type === "string" ? event.type : "message";
        if (type === "done") importCompleted = true;
        if (type === "error") importFailed = true;
        yield { type, data: "data" in event ? event.data : "text" in event ? event.text : event };
      }
      await command;
      if (failure) {
        importFailed = true;
        throw failure;
      }
    } finally {
      signal?.removeEventListener("abort", abort);
      if (importCompleted && !importFailed && !signal?.aborted) {
        invalidateImportManagedAssetObjectUrls();
      }
    }
  },
  listDirectory: <T>(path: string, options?: { pickerSelected?: boolean }) =>
    invokeTauri<T>("import_list_directory", {
      path,
      pickerSelected: options?.pickerSelected ?? false,
    }),
};
