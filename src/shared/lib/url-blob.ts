import { urlBinaryApi } from "../api/url-binary-api";

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function bytesToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

function dataUrlToBlob(url: string, fallbackMimeType = "application/octet-stream"): Blob {
  const [header, data = ""] = url.split(",", 2);
  const mimeType = header.match(/^data:([^;]+)/)?.[1] ?? fallbackMimeType;
  return new Blob([bytesToArrayBuffer(base64ToBytes(data))], { type: mimeType });
}

function blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  return blob.arrayBuffer();
}

async function loadRemoteBlob(url: string, fallbackMimeType: string): Promise<Blob> {
  return urlBinaryApi.load(url, fallbackMimeType);
}

export async function loadUrlBlob(
  url: string,
  options: { init?: RequestInit; errorMessage?: string } = {},
): Promise<Blob> {
  if (options.init?.method && options.init.method.toUpperCase() !== "GET") {
    throw new Error(options.errorMessage ?? "Only GET binary loading is supported.");
  }
  if (url.startsWith("data:")) return dataUrlToBlob(url);
  try {
    return await loadRemoteBlob(url, "application/octet-stream");
  } catch (error) {
    throw new Error(options.errorMessage ?? (error instanceof Error ? error.message : `Failed to load ${url}`));
  }
}

export async function loadUrlArrayBuffer(
  url: string,
  options: { init?: RequestInit; errorMessage?: string } = {},
): Promise<ArrayBuffer> {
  return blobToArrayBuffer(await loadUrlBlob(url, options));
}

export async function blobToDataUrl(blob: Blob, errorMessage = "Failed to convert file."): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error(errorMessage));
    };
    reader.onerror = () => reject(reader.error ?? new Error(errorMessage));
    reader.readAsDataURL(blob);
  });
}

export async function urlToDataUrl(url: string, errorMessage = "Failed to read file."): Promise<string> {
  if (url.startsWith("data:")) return url;
  return blobToDataUrl(await loadUrlBlob(url, { errorMessage }), errorMessage);
}

export function downloadBlob(blob: Blob, filename: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}
