import { getAndroidBridgeToken } from "@/lib/android-bridge";
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

async function shareImageOnIos(blob: Blob, url: string, filename: string): Promise<boolean> {
  if (!isIosDevice() || typeof navigator.share !== "function") return false;

  const file = new File([blob], filename, { type: blob.type || "image/png" });
  const shareData = navigator.canShare?.({ files: [file] }) ? { files: [file] } : { url };
  try {
    await navigator.share(shareData);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return true;
    throw error;
  }
  return true;
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

/** Save an image without navigating an installed iPhone web app into WebKit's non-dismissible file preview. */
export async function saveImageUrlToDevice(url: string, filename: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Download failed (${response.status})`);
  const blob = await response.blob();
  if (await shareImageOnIos(blob, url, filename)) return;
  await saveBlobToDevice(blob, filename);
}
