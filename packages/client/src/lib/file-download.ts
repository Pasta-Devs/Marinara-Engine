import { toast } from "sonner";
import { getAndroidBridgeToken } from "./android-bridge";
import { isIosWebKitBrowser } from "./generation-stream-policy";

type MarinaraAndroidFileBridge = {
  saveFile?: {
    (token: string, base64Data: string, mimeType: string, filename: string): void;
    (base64Data: string, mimeType: string, filename: string): void;
  };
};

/** Read the optional Android shell file bridge from the current browser window. */
function getAndroidFileBridge(): MarinaraAndroidFileBridge | null {
  if (typeof window === "undefined") return null;
  return (window as Window & { MarinaraAndroid?: MarinaraAndroidFileBridge }).MarinaraAndroid ?? null;
}

/** Encode binary file data for the Android JavaScript bridge without overflowing the call stack. */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return window.btoa(binary);
}

/** Trigger the standard browser download path and retain the object URL long enough for mobile browsers. */
function triggerBrowserDownload(blob: Blob, filename: string) {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  // WebKit can display downloads instead of saving them, especially without the share API.
  anchor.target = "_blank";
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}

function isIosDevice(): boolean {
  return (
    typeof navigator !== "undefined" &&
    isIosWebKitBrowser(navigator.userAgent, navigator.platform, navigator.maxTouchPoints)
  );
}

export interface PreparedImageSave {
  blob: Blob;
  file: File;
  filename: string;
  url: string;
}

/** Whether image saves should use the native iOS share sheet instead of WebKit's PWA download preview. */
export function shouldUseIosImageShare(): boolean {
  return isIosDevice() && typeof navigator.share === "function";
}

/** Fetch and construct the image file before a later user gesture opens the iOS share sheet. */
export async function prepareImageSave(url: string, filename: string): Promise<PreparedImageSave> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Download failed (${response.status})`);
  const blob = await response.blob();
  return {
    blob,
    file: new File([blob], filename, { type: blob.type || "image/png" }),
    filename,
    url,
  };
}

/** Share from the tap; a failed iOS share must never fall back to a PWA-trapping download preview. */
export function savePreparedImageToDevice(prepared: PreparedImageSave): Promise<void> {
  if (!shouldUseIosImageShare()) return saveBlobToDevice(prepared.blob, prepared.filename);

  const shareData = navigator.canShare?.({ files: [prepared.file] })
    ? { files: [prepared.file] }
    : { url: prepared.url };
  return navigator.share(shareData).catch((error: unknown) => {
    if (error instanceof DOMException && error.name === "AbortError") return;
    throw error;
  });
}

/** Save a fetched file through the Android shell when available, or through the browser otherwise. */
export async function saveBlobToDevice(blob: Blob, filename: string): Promise<void> {
  const bridge = getAndroidFileBridge();
  if (typeof bridge?.saveFile === "function") {
    const base64Data = arrayBufferToBase64(await blob.arrayBuffer());
    const token = getAndroidBridgeToken();
    if (token) bridge.saveFile(token, base64Data, blob.type || "application/octet-stream", filename);
    else bridge.saveFile(base64Data, blob.type || "application/octet-stream", filename);
    return;
  }

  triggerBrowserDownload(blob, filename);
}

/** Fetch a same-origin media URL and save it through the active browser or Android shell. */
export async function downloadUrlToDevice(url: string, filename: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Download failed (${response.status})`);
  await saveBlobToDevice(await response.blob(), filename);
}

type SaveFilePickerWindow = Window &
  typeof globalThis & {
    showSaveFilePicker?: (options?: {
      suggestedName?: string;
      types?: Array<{ description?: string; accept: Record<string, string[]> }>;
    }) => Promise<{
      createWritable: () => Promise<{ write: (data: Blob) => Promise<void>; close: () => Promise<void> }>;
    }>;
  };

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

/**
 * Use the desktop save dialog when the browser has one. "unavailable" means the plain download should run
 * instead; once the user has chosen a file, a write failure throws rather than starting a second download.
 */
async function saveWithFilePicker(blob: Blob, filename: string): Promise<ExportSaveStatus | "unavailable"> {
  const pickerWindow = window as SaveFilePickerWindow;
  if (!window.isSecureContext || typeof pickerWindow.showSaveFilePicker !== "function") return "unavailable";
  const extension = filename.includes(".") ? filename.slice(filename.lastIndexOf(".")).toLowerCase() : "";
  let handle: Awaited<ReturnType<NonNullable<SaveFilePickerWindow["showSaveFilePicker"]>>>;
  try {
    handle = await pickerWindow.showSaveFilePicker({
      suggestedName: filename,
      types: extension
        ? [
            {
              description: `${extension.slice(1).toUpperCase()} file`,
              accept: { [blob.type || "application/octet-stream"]: [extension] },
            },
          ]
        : undefined,
    });
  } catch (error) {
    // Cancelled, or the dialog could not open (for example without a recent tap): download instead.
    return isAbortError(error) ? "cancelled" : "unavailable";
  }
  const writable = await handle.createWritable();
  await writable.write(blob);
  await writable.close();
  return "saved";
}

function canShareFile(file: File): boolean {
  return typeof navigator.share === "function" && navigator.canShare?.({ files: [file] }) === true;
}

/** Offer a fresh tap: iOS only opens the share sheet or a download from a recent user gesture. */
async function offerIosFileSave(file: File): Promise<void> {
  const { translate } = await import("../localization/i18n");
  toast(translate("ui.app.fileSave.ready"), {
    id: `file-save:${file.name}`,
    description: file.name,
    duration: Infinity,
    action: {
      label: translate("ui.app.fileSave.save"),
      onClick: () => {
        if (!canShareFile(file)) {
          triggerBrowserDownload(file, file.name);
          return;
        }
        navigator.share({ files: [file] }).catch((error: unknown) => {
          if (!isAbortError(error)) toast.error(translate("ui.app.fileSave.failed"));
        });
      },
    },
  });
}

/** Shared by every export error toast, so a caller's own wording replaces this one instead of stacking. */
export const EXPORT_FAILED_TOAST_ID = "file-export-failed";

/** Show one plain error for a failed export; cancelling is not a failure. */
export async function showExportError(error: unknown): Promise<void> {
  if (isAbortError(error)) return;
  const { translate } = await import("../localization/i18n");
  toast.error(translate("ui.app.fileSave.exportFailed"), {
    id: EXPORT_FAILED_TOAST_ID,
    description: error instanceof Error && error.message ? error.message : undefined,
  });
}

/**
 * How an export save ended: "saved" (written, shared, or a download started), "prompted" (iOS shows a
 * Save file toast, finished by a later tap), "cancelled" by the user, or "failed" (an error toast is shown).
 */
export type ExportSaveStatus = "saved" | "prompted" | "cancelled" | "failed";

/**
 * Save an exported file: the Android shell bridge, the iOS share sheet (or a Save file toast when the
 * export's fetch used up the tap), the desktop save dialog when requested, or a plain browser download.
 * Never rejects; a failure shows an error and resolves "failed".
 */
export async function saveExportFile(
  blob: Blob,
  filename: string,
  options: { savePicker?: boolean } = {},
): Promise<ExportSaveStatus> {
  try {
    if (typeof getAndroidFileBridge()?.saveFile === "function") {
      await saveBlobToDevice(blob, filename);
      return "saved";
    }
    if (isIosDevice()) {
      const file = new File([blob], filename, { type: blob.type || "application/octet-stream" });
      if (canShareFile(file)) {
        try {
          await navigator.share({ files: [file] });
          return "saved";
        } catch (error) {
          if (isAbortError(error)) return "cancelled";
          // Usually NotAllowedError: the tap's activation ran out while the export was fetched.
        }
      }
      await offerIosFileSave(file);
      return "prompted";
    }
    if (options.savePicker) {
      const status = await saveWithFilePicker(blob, filename);
      if (status !== "unavailable") return status;
    }
    triggerBrowserDownload(blob, filename);
    return "saved";
  } catch (error) {
    if (isAbortError(error)) return "cancelled";
    await showExportError(error);
    return "failed";
  }
}

/** Fetch a same-origin file and save it like an export. Call it straight from the tap; it never rejects. */
export async function saveExportUrl(url: string, filename: string): Promise<ExportSaveStatus> {
  let blob: Blob;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Download failed (${response.status})`);
    blob = await response.blob();
  } catch (error) {
    await showExportError(error);
    return "failed";
  }
  return saveExportFile(blob, filename);
}
