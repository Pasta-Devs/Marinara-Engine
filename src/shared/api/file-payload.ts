import { MAX_FILE_SIZES } from "../../engine/contracts/constants/defaults";

export interface UploadFilePayload {
  name: string;
  type: string;
  size: number;
  base64: string;
}

function formatUploadSize(bytes: number) {
  const mib = bytes / (1024 * 1024);
  return `${Number.isInteger(mib) ? mib.toString() : mib.toFixed(1)} MB`;
}

export const MAX_IMAGE_UPLOAD_BYTES = MAX_FILE_SIZES.IMAGE_UPLOAD;
export const IMAGE_UPLOAD_SIZE_ERROR = `Image uploads must be ${formatUploadSize(MAX_IMAGE_UPLOAD_BYTES)} or smaller`;

export const CHAT_IMPORT_SIZE_ERROR = `Chat imports must be ${formatUploadSize(MAX_FILE_SIZES.CHAT_JSONL)} or smaller`;
export const GAME_ASSET_SIZE_ERROR = `Game assets must be ${formatUploadSize(MAX_FILE_SIZES.GAME_ASSET)} or smaller`;

export interface FilePayloadOptions {
  maxBytes?: number;
  tooLargeMessage?: string;
}

export async function fileToUploadPayload(file: File, options: FilePayloadOptions = {}): Promise<UploadFilePayload> {
  if (options.maxBytes !== undefined && file.size > options.maxBytes) {
    throw new Error(options.tooLargeMessage ?? `Uploads must be ${options.maxBytes} bytes or smaller`);
  }

  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return {
    name: file.name,
    type: file.type,
    size: file.size,
    base64: btoa(binary),
  };
}

export async function formDataToJson(
  body: FormData,
  options: FilePayloadOptions = {},
): Promise<Record<string, unknown>> {
  const entries: Record<string, unknown> = {};
  const appendEntry = (key: string, value: unknown) => {
    const existing = entries[key];
    if (existing === undefined) {
      entries[key] = value;
    } else if (Array.isArray(existing)) {
      existing.push(value);
    } else {
      entries[key] = [existing, value];
    }
  };
  for (const [key, value] of body.entries()) {
    // Pass the caller's size limit down so a File entry is rejected before its
    // bytes are read into memory, rather than after.
    appendEntry(key, value instanceof File ? await fileToUploadPayload(value, options) : value);
  }
  return entries;
}
