import { invokeTauri } from "./tauri-client";

interface UrlBinaryResponse {
  base64?: string;
  mimeType?: string;
  message?: string;
  error?: string;
}

function isUrlBinaryResponse(value: unknown): value is UrlBinaryResponse {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function binaryFailureMessage(response: unknown): string {
  if (!isUrlBinaryResponse(response)) {
    return `URL binary request returned an invalid response: ${String(response)}`;
  }
  return (
    optionalString(response.error) ??
    optionalString(response.message) ??
    "URL binary request did not return base64 data."
  );
}

function base64ToBytes(base64: string): Uint8Array {
  let binary: string;
  try {
    binary = atob(base64);
  } catch {
    throw new Error("URL binary request returned invalid base64 data.");
  }
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

function base64ToBlob(base64: string, mimeType: string): Blob {
  return new Blob([bytesToArrayBuffer(base64ToBytes(base64))], { type: mimeType });
}

export const urlBinaryApi = {
  load: async (url: string, fallbackMimeType = "application/octet-stream"): Promise<Blob> => {
    const response = await invokeTauri<unknown>("load_url_binary", {
      url,
      fallbackMime: fallbackMimeType,
    });
    if (!isUrlBinaryResponse(response) || typeof response.base64 !== "string") {
      throw new Error(binaryFailureMessage(response));
    }
    return base64ToBlob(response.base64, optionalString(response.mimeType) ?? fallbackMimeType);
  },
};
