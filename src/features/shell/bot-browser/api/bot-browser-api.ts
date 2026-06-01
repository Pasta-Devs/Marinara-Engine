import { botBrowserCommandApi } from "../../../../shared/api/bot-browser-command-api";
import { importApi } from "../../../../shared/api/import-api";
import { loadUrlBlob } from "../../../../shared/lib/url-blob";

const TAURI_ASSET_PREFIX = "tauri-api:";
const JANNY_SEARCH_URL = "https://search.jannyai.com/multi-search";

export interface ImportCharacterResult {
  success?: boolean;
  name?: string;
  character?: unknown;
  lorebook?: unknown;
  error?: string;
}

type BinaryPayload =
  | string
  | {
      base64?: string;
      data?: string;
      body?: string;
      mimeType?: string;
      contentType?: string;
      type?: string;
    };

function normalizeBotBrowserPath(path: string): string {
  if (path.startsWith("/bot-browser/")) return path;
  return `/bot-browser/${path.replace(/^\/+/, "")}`;
}

function stripAssetPrefix(src: string): string | null {
  return src.startsWith(TAURI_ASSET_PREFIX) ? src.slice(TAURI_ASSET_PREFIX.length) : null;
}

function binaryStringToBlob(binary: string, mimeType: string): Blob {
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
}

function payloadToBlob(payload: BinaryPayload, fallbackMimeType: string): Blob {
  const value = typeof payload === "string" ? payload : (payload.base64 ?? payload.data ?? payload.body ?? "");
  const mimeType =
    typeof payload === "string"
      ? fallbackMimeType
      : (payload.mimeType ?? payload.contentType ?? payload.type ?? fallbackMimeType);

  if (typeof value === "string" && value.startsWith("data:")) {
    const [header, data = ""] = value.split(",", 2);
    const dataMimeType = header.match(/^data:([^;]+)/)?.[1] ?? mimeType;
    return binaryStringToBlob(atob(data), dataMimeType);
  }

  if (typeof value === "string" && value.length > 0) {
    return binaryStringToBlob(atob(value), mimeType);
  }

  return new Blob([JSON.stringify(payload)], { type: "application/json" });
}

export function botBrowserAssetUrl(path: string): string {
  return `${TAURI_ASSET_PREFIX}${normalizeBotBrowserPath(path)}`;
}

export async function botBrowserGet<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  if (init?.signal?.aborted) throw new DOMException("The operation was aborted.", "AbortError");
  return botBrowserCommandApi.get<T>(normalizeBotBrowserPath(path));
}

export async function botBrowserPost<T = unknown>(path: string, body?: unknown, init?: RequestInit): Promise<T> {
  if (init?.signal?.aborted) throw new DOMException("The operation was aborted.", "AbortError");
  return botBrowserCommandApi.post<T>(normalizeBotBrowserPath(path), body);
}

function errorCode(error: unknown): string {
  const details = error && typeof error === "object" ? (error as { details?: unknown }).details : null;
  if (details && typeof details === "object" && typeof (details as { code?: unknown }).code === "string") {
    return (details as { code: string }).code;
  }
  return "";
}

function isJannyCloudflareBlock(error: unknown): boolean {
  return errorCode(error) === "upstream_blocked" || String(error).toLowerCase().includes("cloudflare");
}

async function jannyBrowserSearch<T>(payload: unknown, forceToken: boolean): Promise<T> {
  const tokenResponse = await botBrowserGet<{ token?: string }>(`janny/token${forceToken ? "?force=true" : ""}`);
  const token = tokenResponse.token?.trim();
  if (!token) throw new Error("JannyAI search token is unavailable");

  const response = await fetch(JANNY_SEARCH_URL, {
    method: "POST",
    headers: {
      Accept: "*/*",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "x-meilisearch-client": "Meilisearch instant-meilisearch (v0.19.0) ; Meilisearch JavaScript (v0.41.0)",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`JannyAI browser fallback returned ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export async function jannySearchWithBrowserFallback<T = unknown>(payload: unknown): Promise<T> {
  try {
    return await botBrowserPost<T>("janny/search", { payload });
  } catch (error) {
    if (!isJannyCloudflareBlock(error)) throw error;
    return jannyBrowserSearch<T>(payload, true);
  }
}

export async function botBrowserBlob(path: string, fallbackMimeType = "image/png", init?: RequestInit): Promise<Blob> {
  const payload = await botBrowserGet<BinaryPayload>(path, init);
  return payloadToBlob(payload, fallbackMimeType);
}

export async function fetchBotBrowserAssetBlob(
  src: string,
  fallbackMimeType = "image/png",
  init?: RequestInit,
): Promise<Blob> {
  const localPath = stripAssetPrefix(src);
  if (localPath) return botBrowserBlob(localPath, fallbackMimeType, init);

  return loadUrlBlob(src, { init, errorMessage: "Failed to load asset" });
}

export async function resolveBotBrowserAssetUrl(src: string, init?: RequestInit): Promise<string> {
  const localPath = stripAssetPrefix(src);
  if (!localPath) return src;
  const blob = await botBrowserBlob(localPath, "image/png", init);
  return URL.createObjectURL(blob);
}

export async function importStCharacter(body: Record<string, unknown>): Promise<ImportCharacterResult> {
  return importApi.stCharacterJson<ImportCharacterResult>(body);
}
