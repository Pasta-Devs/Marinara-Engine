type MarinaraAndroidFileBridge = {
  saveFile?: (base64Data: string, mimeType: string, filename: string) => void;
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

/** Save a fetched file through the Android shell when available, or through the browser otherwise. */
export async function saveBlobToDevice(blob: Blob, filename: string): Promise<void> {
  const bridge = getAndroidFileBridge();
  if (typeof bridge?.saveFile === "function") {
    const base64Data = arrayBufferToBase64(await blob.arrayBuffer());
    bridge.saveFile(base64Data, blob.type || "application/octet-stream", filename);
    return;
  }

  triggerBrowserDownload(blob, filename);
}
