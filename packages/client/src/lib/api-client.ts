// ──────────────────────────────────────────────
// Generic API client for communicating with the backend
// ──────────────────────────────────────────────

import { CSRF_HEADER, CSRF_HEADER_VALUE } from "@marinara-engine/shared";
import { showGenerationFallbackHeader, showGenerationFallbackToast } from "./generation-fallback-notice";

const BASE = "/api";
const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
export const ADMIN_SECRET_STORAGE_KEY = "marinara_admin_secret";

function getAdminSecretHeader(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const secret = window.localStorage.getItem(ADMIN_SECRET_STORAGE_KEY)?.trim();
    return secret ? { "X-Admin-Secret": secret } : {};
  } catch {
    return {};
  }
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public payload?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const PRIVILEGED_ACCESS_HINT =
  "This action needs loopback access or admin access. Open the app through localhost, or set ADMIN_SECRET=<secret> in the server .env and paste the same value in Settings → Advanced → Admin Access. Marinara sends it as the X-Admin-Secret header.";

/**
 * Build a user-facing message for a privileged-gated action (extension install,
 * Professor Mari workspace mutation, etc.). The privileged gate replies 403 with a
 * terse server message that doesn't tell the user how to recover, so surface the
 * admin-secret hint for 403s; otherwise pass through the server/error message.
 */
export function getPrivilegedActionErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError && error.status === 403) {
    return error.message ? `${PRIVILEGED_ACCESS_HINT} (${error.message})` : PRIVILEGED_ACCESS_HINT;
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export type JsonRepairKind = "game_setup" | "session_conclusion" | "campaign_progression" | "lorebook_keeper";

export type JsonRepairRequest = {
  kind: JsonRepairKind;
  title: string;
  rawJson: string;
  applyEndpoint: string;
  applyBody?: Record<string, unknown>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function findNestedApiErrorMessage(value: unknown): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (Array.isArray(value)) {
    for (const item of value) {
      const message = findNestedApiErrorMessage(item);
      if (message) return message;
    }
  } else if (isRecord(value)) {
    for (const nested of Object.values(value)) {
      const message = findNestedApiErrorMessage(nested);
      if (message) return message;
    }
  }
  return "";
}

export function getApiErrorMessage(value: unknown, fallback: string): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (Array.isArray(value)) {
    for (const item of value) {
      const message = getApiErrorMessage(item, "");
      if (message) return message;
    }
    return fallback;
  }
  if (isRecord(value)) {
    for (const key of ["message", "formErrors", "fieldErrors", "issues"] as const) {
      if (!(key in value)) continue;
      const message = findNestedApiErrorMessage(value[key]);
      if (message) return message;
    }
  }
  return fallback;
}

function getSseDataPayload(line: string): string | null {
  const normalized = line.endsWith("\r") ? line.slice(0, -1) : line;
  if (!normalized.startsWith("data:")) return null;
  const data = normalized.slice(5);
  return (data.startsWith(" ") ? data.slice(1) : data).trimEnd();
}

function readSseDataPayloads(buffer: string, final = false): { payloads: string[]; rest: string } {
  const lines = buffer.split(/\r?\n/);
  const rest = final ? "" : (lines.pop() ?? "");
  const payloads = lines.map(getSseDataPayload).filter((payload): payload is string => payload !== null);
  return { payloads, rest };
}

function parseSseJsonPayload(data: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(data);
    return isRecord(parsed) ? parsed : null;
  } catch (error) {
    console.warn("[api] Skipping malformed SSE frame", { error, data: data.slice(0, 200) });
    return null;
  }
}

async function releaseSseReader(reader: ReadableStreamDefaultReader<Uint8Array>, completed: boolean) {
  if (!completed) {
    try {
      await reader.cancel();
    } catch {
      /* stream may already be closed or aborted */
    }
  }
  try {
    reader.releaseLock();
  } catch {
    /* lock may already be released */
  }
}

function getSseErrorMessage(parsed: Record<string, unknown>): string {
  return typeof parsed.data === "string" ? parsed.data : "Generation error";
}

export function getJsonRepairRequest(error: unknown): JsonRepairRequest | null {
  if (!(error instanceof ApiError) || !isRecord(error.payload)) return null;
  const repair = error.payload.jsonRepair;
  if (!isRecord(repair)) return null;

  const kind = repair.kind;
  const title = repair.title;
  const rawJson = repair.rawJson;
  const applyEndpoint = repair.applyEndpoint;
  if (
    (kind !== "game_setup" &&
      kind !== "session_conclusion" &&
      kind !== "campaign_progression" &&
      kind !== "lorebook_keeper") ||
    typeof title !== "string" ||
    typeof rawJson !== "string" ||
    typeof applyEndpoint !== "string"
  ) {
    return null;
  }

  return {
    kind,
    title,
    rawJson,
    applyEndpoint,
    applyBody: isRecord(repair.applyBody) ? repair.applyBody : undefined,
  };
}

export function isJsonRepairApiError(error: unknown): boolean {
  return getJsonRepairRequest(error) !== null;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(path, init);
  showGenerationFallbackHeader(res);

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError(res.status, getApiErrorMessage(body.error, res.statusText), body);
  }

  // 204 No Content
  if (res.status === 204) return undefined as T;

  return res.json() as Promise<T>;
}

async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  for (const [name, value] of Object.entries(getAdminSecretHeader())) {
    headers.set(name, value);
  }
  const method = (init?.method ?? "GET").toUpperCase();
  if (UNSAFE_METHODS.has(method)) {
    headers.set(CSRF_HEADER, CSRF_HEADER_VALUE);
  }

  // Only default string bodies to JSON; FormData/Blob/etc. need browser-managed headers.
  if (typeof init?.body === "string" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return fetch(`${BASE}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });
}

type SaveFilePickerWindow = Window &
  typeof globalThis & {
    showSaveFilePicker?: (options?: {
      suggestedName?: string;
      types?: Array<{
        description?: string;
        accept: Record<string, string[]>;
      }>;
    }) => Promise<{
      createWritable: () => Promise<{
        write: (data: Blob) => Promise<void>;
        close: () => Promise<void>;
      }>;
    }>;
  };

function triggerBrowserDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function getSavePickerTypes(blob: Blob, filename: string) {
  const extension = filename.includes(".") ? filename.slice(filename.lastIndexOf(".")).toLowerCase() : "";
  if (!extension) return undefined;
  const mimeType = blob.type || "application/octet-stream";
  return [
    {
      description: extension ? `${extension.slice(1).toUpperCase()} file` : "Export file",
      accept: { [mimeType]: [extension] },
    },
  ];
}

async function saveBlob(blob: Blob, filename: string) {
  const pickerWindow = window as SaveFilePickerWindow;
  if (!window.isSecureContext || typeof pickerWindow.showSaveFilePicker !== "function") {
    triggerBrowserDownload(blob, filename);
    return;
  }

  try {
    const handle = await pickerWindow.showSaveFilePicker({
      suggestedName: filename,
      types: getSavePickerTypes(blob, filename),
    });
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return;
    triggerBrowserDownload(blob, filename);
  }
}

async function readDownloadFilename(res: Response, fallbackFilename: string) {
  const disposition = res.headers.get("Content-Disposition");
  if (!disposition) return fallbackFilename;

  const utf8Match = disposition.match(/filename\*=UTF-8''([^;\n]+)/i);
  if (utf8Match?.[1]) return decodeURIComponent(utf8Match[1]);

  const match = disposition.match(/filename="?([^";\n]+)"?/);
  return match?.[1] ? decodeURIComponent(match[1]) : fallbackFilename;
}

export const api = {
  /** Return the raw response while still applying shared auth, CSRF, and cache policy. */
  raw: (path: string, init?: RequestInit) => apiFetch(path, init),

  get: <T>(path: string, init?: RequestInit) => request<T>(path, init),

  post: <T>(path: string, body?: unknown, init?: RequestInit) =>
    request<T>(path, {
      ...init,
      method: "POST",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),

  put: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "PUT",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),

  patch: <T>(path: string, body?: unknown, init?: RequestInit) =>
    request<T>(path, {
      ...init,
      method: "PATCH",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),

  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),

  /** Download a JSON endpoint as a file (triggers browser save-as). */
  download: async (path: string, fallbackFilename = "export.json", init?: RequestInit) => {
    const res = await apiFetch(path, init);
    if (!res.ok) {
      const payload = await res.json().catch(() => ({ error: res.statusText }));
      throw new ApiError(res.status, payload.error ?? "Download failed", payload);
    }
    const filename = await readDownloadFilename(res, fallbackFilename);
    const blob = await res.blob();
    await saveBlob(blob, filename);
  },

  /** Download a POST endpoint as a file (useful for bulk exports). */
  downloadPost: async (path: string, body: unknown, fallbackFilename = "export.bin") => {
    const res = await apiFetch(path, {
      method: "POST",
      body: JSON.stringify(body),
    });
    showGenerationFallbackHeader(res);
    if (!res.ok) {
      const payload = await res.json().catch(() => ({ error: res.statusText }));
      throw new ApiError(res.status, payload.error ?? "Download failed", payload);
    }
    const filename = await readDownloadFilename(res, fallbackFilename);
    const blob = await res.blob();
    await saveBlob(blob, filename);
  },

  /**
   * Stream an SSE endpoint. Returns an async iterable of parsed events.
   */
  stream: async function* (path: string, body?: unknown, signal?: AbortSignal): AsyncGenerator<string> {
    const res = await apiFetch(path, {
      method: "POST",
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });
    showGenerationFallbackHeader(res);

    if (!res.ok || !res.body) {
      let detail = `HTTP ${res.status}`;
      let payload: unknown;
      try {
        const text = await res.text();
        const json = JSON.parse(text) as unknown;
        payload = json;
        if (isRecord(json)) detail = findNestedApiErrorMessage(json.error ?? json.message) || text.slice(0, 200);
        else detail = text.slice(0, 200);
      } catch {
        /* couldn't parse body */
      }
      throw new ApiError(res.status, detail, payload);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let completed = false;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          completed = true;
          buffer += decoder.decode();
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const parsedBuffer = readSseDataPayloads(buffer);
        buffer = parsedBuffer.rest;

        for (const data of parsedBuffer.payloads) {
          if (data === "[DONE]") return;
          const parsed = parseSseJsonPayload(data);
          if (!parsed) continue;
          if (parsed.type === "fallback_used") showGenerationFallbackToast(parsed.data);
          else if (parsed.type === "token" && typeof parsed.data === "string") yield parsed.data;
          else if (parsed.type === "error") throw new ApiError(500, getSseErrorMessage(parsed), parsed);
          else if (parsed.type === "done") return;
        }
      }

      for (const data of readSseDataPayloads(buffer, true).payloads) {
        if (data === "[DONE]") return;
        const parsed = parseSseJsonPayload(data);
        if (!parsed) continue;
        if (parsed.type === "fallback_used") showGenerationFallbackToast(parsed.data);
        else if (parsed.type === "token" && typeof parsed.data === "string") yield parsed.data;
        else if (parsed.type === "error") throw new ApiError(500, getSseErrorMessage(parsed), parsed);
        else if (parsed.type === "done") return;
      }
    } finally {
      await releaseSseReader(reader, completed);
    }
  },

  /**
   * Stream an SSE endpoint. Returns an async iterable of all typed events.
   * Unlike `stream()`, this does NOT filter to only token events.
   */
  streamEvents: async function* (
    path: string,
    body?: unknown,
    signal?: AbortSignal,
  ): AsyncGenerator<{ type: string; data: unknown } & Record<string, unknown>> {
    const res = await apiFetch(path, {
      method: "POST",
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });
    showGenerationFallbackHeader(res);

    if (!res.ok || !res.body) {
      let detail = `HTTP ${res.status}`;
      try {
        const text = await res.text();
        const json = JSON.parse(text);
        detail = json.error || json.message || text.slice(0, 200);
      } catch {
        /* couldn't parse body */
      }
      throw new ApiError(res.status, detail);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let completed = false;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          completed = true;
          buffer += decoder.decode();
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const parsedBuffer = readSseDataPayloads(buffer);
        buffer = parsedBuffer.rest;

        for (const data of parsedBuffer.payloads) {
          if (data === "[DONE]") return;
          const parsed = parseSseJsonPayload(data);
          if (!parsed || typeof parsed.type !== "string") continue;
          if (parsed.type === "fallback_used") showGenerationFallbackToast(parsed.data);
          yield parsed as { type: string; data: unknown } & Record<string, unknown>;
          if (parsed.type === "error") return;
        }
      }

      for (const data of readSseDataPayloads(buffer, true).payloads) {
        if (data === "[DONE]") return;
        const parsed = parseSseJsonPayload(data);
        if (!parsed || typeof parsed.type !== "string") continue;
        if (parsed.type === "fallback_used") showGenerationFallbackToast(parsed.data);
        yield parsed as { type: string; data: unknown } & Record<string, unknown>;
        if (parsed.type === "error") return;
      }
    } finally {
      await releaseSseReader(reader, completed);
    }
  },

  /** Upload a file via multipart/form-data */
  upload: async <T>(path: string, formData: FormData): Promise<T> => {
    const res = await apiFetch(path, {
      method: "POST",
      body: formData,
    });
    showGenerationFallbackHeader(res);

    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: res.statusText }));
      throw new ApiError(res.status, getApiErrorMessage(body.error, res.statusText), body);
    }

    return res.json() as Promise<T>;
  },
};
