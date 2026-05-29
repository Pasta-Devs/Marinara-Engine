type TauriOpenerApi = typeof import("@tauri-apps/plugin-opener");

const EXTERNAL_URL_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:"]);
const BROWSER_POPUP_PROTOCOLS = new Set(["http:", "https:"]);

function hasEmbeddedTauriRuntime(): boolean {
  if (typeof window === "undefined") return false;
  const tauriWindow = window as unknown as { __TAURI__?: unknown; __TAURI_INTERNALS__?: unknown };
  return Boolean(tauriWindow.__TAURI__ || tauriWindow.__TAURI_INTERNALS__);
}

function normalizeExternalUrl(rawUrl: string | URL): string {
  const value = rawUrl instanceof URL ? rawUrl.toString() : rawUrl.trim();
  if (!value) throw new Error("External URL is empty.");

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("External URL is invalid.");
  }

  if (!EXTERNAL_URL_PROTOCOLS.has(url.protocol)) {
    throw new Error(`Unsupported external URL protocol: ${url.protocol || "unknown"}`);
  }
  return url.toString();
}

function openExternalUrlInBrowser(url: string): void {
  if (typeof window === "undefined") {
    throw new Error("External URLs can only be opened in a browser or Tauri runtime.");
  }

  const parsedUrl = new URL(url);
  if (!BROWSER_POPUP_PROTOCOLS.has(parsedUrl.protocol)) {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }

  // `noopener` can force a null return even when the popup succeeds, so open a
  // detectable blank page, sever the opener, then navigate with noreferrer.
  const opened = window.open("about:blank", "_blank");
  if (opened == null) {
    throw new Error("The browser blocked the external URL popup.");
  }
  opened.opener = null;

  const link = opened.document.createElement("a");
  link.href = url;
  link.rel = "noreferrer";
  link.target = "_self";
  opened.document.body.append(link);
  link.click();
}

async function getTauriOpenerApi(): Promise<TauriOpenerApi> {
  return import("@tauri-apps/plugin-opener");
}

export async function openExternalUrl(rawUrl: string | URL): Promise<void> {
  const url = normalizeExternalUrl(rawUrl);
  if (!hasEmbeddedTauriRuntime()) {
    openExternalUrlInBrowser(url);
    return;
  }
  const { openUrl } = await getTauriOpenerApi();
  await openUrl(url);
}
