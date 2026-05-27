import { formDataToJson } from "./file-payload";
import { Channel } from "@tauri-apps/api/core";
import { invokeTauri } from "./tauri-client";
import { remoteRuntimeTarget } from "./remote-runtime";

export interface ImportFilePayload {
  file: File;
  fields?: Record<string, string | number | boolean | null | undefined>;
}

async function filePayload(payload: ImportFilePayload | File): Promise<Record<string, unknown>> {
  const file = payload instanceof File ? payload : payload.file;
  const fields = payload instanceof File ? undefined : payload.fields;
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields ?? {})) {
    if (value !== null && value !== undefined) formData.append(key, String(value));
  }
  formData.append("file", file, file.name);
  return formDataToJson(formData);
}

async function filesPayload(payload: File[] | FormData): Promise<Record<string, unknown>> {
  if (payload instanceof FormData) return formDataToJson(payload);
  const form = new FormData();
  payload.forEach((file) => form.append("files", file, file.name));
  return formDataToJson(form);
}

export const importApi = {
  marinara: <T>(envelope: unknown) => invokeTauri<T>("import_marinara", { envelope }),
  marinaraFile: async <T>(payload: ImportFilePayload | File) =>
    invokeTauri<T>("import_marinara_file", { body: await filePayload(payload) }),
  stCharacterJson: <T>(body: unknown) => invokeTauri<T>("import_st_character", { body }),
  stCharacterFile: async <T>(payload: ImportFilePayload) =>
    invokeTauri<T>("import_st_character", { body: await filePayload(payload) }),
  stCharacterBatch: async <T>(payload: ImportFilePayload | File[] | FormData) => {
    const body = Array.isArray(payload) || payload instanceof FormData ? await filesPayload(payload) : await filePayload(payload);
    return invokeTauri<T>("import_st_character_batch", { body });
  },
  stCharacterInspect: async <T>(payload: File[] | FormData) =>
    invokeTauri<T>("import_st_character_inspect", { body: await filesPayload(payload) }),
  stChat: async <T>(file: File) => invokeTauri<T>("import_st_chat", { body: await filePayload(file) }),
  stChatIntoGroup: async <T>(chatId: string, file: File) =>
    invokeTauri<T>("import_st_chat_into_group", {
      body: await filePayload({ file, fields: { chatId } }),
    }),
  stPreset: <T>(payload: unknown) => invokeTauri<T>("import_st_preset", { payload }),
  stLorebook: <T>(payload: unknown) => invokeTauri<T>("import_st_lorebook", { payload }),
  stBulkScan: <T>(payload: unknown) => invokeTauri<T>("import_st_bulk_scan", { payload }),
  stBulkRun: <T>(payload: unknown) => invokeTauri<T>("import_st_bulk_run", { payload }),
  stBulkRunEvents: async function* (
    payload: unknown,
    signal?: AbortSignal,
  ): AsyncGenerator<{ type: string; data: unknown }> {
    if (signal?.aborted) throw new DOMException("The operation was aborted.", "AbortError");
    if (remoteRuntimeTarget()) {
      const data = await invokeTauri("import_st_bulk_run", { payload });
      yield { type: "done", data };
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
        yield { type, data: "data" in event ? event.data : "text" in event ? event.text : event };
      }
      await command;
      if (failure) throw failure;
    } finally {
      signal?.removeEventListener("abort", abort);
    }
  },
  listDirectory: <T>(path: string, options?: { pickerSelected?: boolean }) =>
    invokeTauri<T>("import_list_directory", {
      path,
      pickerSelected: options?.pickerSelected ?? false,
    }),
};
