import type { VisualAssetGateway } from "../../engine/capabilities/visual-assets";
import { gameAssetsApi } from "./assets-api";
import { spriteApi } from "./image-generation-api";
import { resolveAvatarFileUrl } from "./local-file-api";
import { backgroundsApi } from "./settings-assets-api";
import { urlBinaryApi } from "./url-binary-api";

const IMAGE_REFERENCE_PROVIDER_BYTE_LIMIT = 6 * 1024 * 1024;

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function inlineImageDataUrl(value: unknown): string | null {
  const text = cleanString(value);
  if (!text) return null;
  if (/^data:image\/(?:png|jpe?g|webp|gif);base64,/i.test(text)) return text;
  const wrapped = text.match(/^[a-z][a-z0-9+.-]*:\/\/(data:image\/(?:png|jpe?g|webp|gif);base64,.*)$/i);
  return wrapped?.[1] ?? null;
}

function rawBase64ImageDataUrl(value: unknown, mimeType = "image/png"): string | null {
  const text = cleanString(value).replace(/\s+/g, "");
  if (!text || text.length <= 80 || !/^[A-Za-z0-9+/=]+$/.test(text)) return null;
  return `data:${mimeType};base64,${text}`;
}

function estimateDataUrlBytes(dataUrl: string): number {
  const commaIndex = dataUrl.indexOf(",");
  if (!dataUrl.startsWith("data:") || commaIndex < 0) return new TextEncoder().encode(dataUrl).length;
  const payload = dataUrl.slice(commaIndex + 1);
  const padding = payload.endsWith("==") ? 2 : payload.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((payload.length * 3) / 4) - padding);
}

function usableDataUrl(dataUrl: string | null): string | null {
  return dataUrl && estimateDataUrlBytes(dataUrl) <= IMAGE_REFERENCE_PROVIDER_BYTE_LIMIT ? dataUrl : null;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.slice(index, index + chunkSize));
  }
  return btoa(binary);
}

async function blobToDataUrl(blob: Blob, fallbackMimeType: string): Promise<string | null> {
  if (blob.size > IMAGE_REFERENCE_PROVIDER_BYTE_LIMIT) return null;
  const mimeType = blob.type.startsWith("image/") ? blob.type : fallbackMimeType;
  const base64 = bytesToBase64(new Uint8Array(await blob.arrayBuffer()));
  return `data:${mimeType};base64,${base64}`;
}

async function fetchBlobUrl(url: string, fallbackMimeType: string): Promise<string | null> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Reference image returned ${response.status}`);
  return blobToDataUrl(await response.blob(), fallbackMimeType);
}

async function loadUrlDataUrl(url: string, fallbackMimeType: string): Promise<string | null> {
  if (url.startsWith("blob:")) return fetchBlobUrl(url, fallbackMimeType);
  try {
    return blobToDataUrl(await urlBinaryApi.load(url, fallbackMimeType), fallbackMimeType);
  } catch (error) {
    if (typeof fetch !== "function") throw error;
    return fetchBlobUrl(url, fallbackMimeType);
  }
}

export const visualAssetsApi: VisualAssetGateway = {
  listSprites: (ownerId, ownerType = "character") => spriteApi.list(ownerId, { ownerType }),
  listBackgrounds: () => backgroundsApi.list(),
  gameAssetsManifest: () => gameAssetsApi.manifest(),
  resolveReferenceImage: async (source) => {
    const fallbackMimeType = cleanString(source.mimeType) || "image/png";
    const inline =
      usableDataUrl(inlineImageDataUrl(source.image)) ??
      usableDataUrl(inlineImageDataUrl(source.url)) ??
      usableDataUrl(inlineImageDataUrl(source.base64)) ??
      usableDataUrl(rawBase64ImageDataUrl(source.base64 || source.image || source.url, fallbackMimeType));
    if (inline) return inline;

    const avatarUrl = await resolveAvatarFileUrl(source.avatarFilename, source.avatarFilePath).catch(() => null);
    const url = avatarUrl || cleanString(source.url) || cleanString(source.image);
    if (!url) return null;
    return usableDataUrl(await loadUrlDataUrl(url, fallbackMimeType));
  },
};
