type ForceRefreshSpaOptions = {
  queryParamKey?: string;
  queryParamValue?: string;
};

async function getServiceWorkerRegistrations() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return [] as ServiceWorkerRegistration[];
  }

  try {
    return await navigator.serviceWorker.getRegistrations();
  } catch {
    return [] as ServiceWorkerRegistration[];
  }
}

function replaceCurrentUrl(queryParamKey: string, queryParamValue: string) {
  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.set(queryParamKey, queryParamValue);
  window.location.replace(nextUrl.toString());
}

export async function clearBrowserRuntimeCaches() {
  if (typeof window === "undefined") {
    return;
  }

  const registrations = await getServiceWorkerRegistrations();
  await Promise.allSettled(registrations.map((registration) => registration.unregister()));

  if (!("caches" in window)) {
    return;
  }

  const cacheKeys = await caches.keys();
  await Promise.allSettled(cacheKeys.map((cacheKey) => caches.delete(cacheKey)));
}

export async function forceRefreshSpa({
  queryParamKey = "spa_refresh",
  queryParamValue = Date.now().toString(),
}: ForceRefreshSpaOptions = {}) {
  await clearBrowserRuntimeCaches();
  replaceCurrentUrl(queryParamKey, queryParamValue);
}

const PRELOAD_RECOVERY_AT_KEY = "mari-preload-recovery-at";
const PRELOAD_RECOVERY_COOLDOWN_MS = 20_000;

/**
 * Recover from a failed dynamic import — a lazy route/chunk that fails to load
 * because a newer build deleted the hashed file the running page still references
 * (or a stale service-worker precache is serving an old one). Vite dispatches a
 * `vite:preloadError` window event in this case; clear the service worker +
 * caches and reload so the browser fetches the current build's assets — the same
 * recovery the version-skew path already uses.
 *
 * Guarded by a short cooldown so a genuinely broken build — or a page that
 * re-triggers the same import immediately after reload — can't reload-loop: after
 * one attempt within the window the error is allowed to surface (Vite rethrows,
 * and the app's recovery boundary shows its Reload button).
 */
export function registerPreloadErrorRecovery() {
  if (typeof window === "undefined") {
    return;
  }

  window.addEventListener("vite:preloadError", (event: Event) => {
    try {
      const lastAt = Number(sessionStorage.getItem(PRELOAD_RECOVERY_AT_KEY) ?? "0");
      if (Number.isFinite(lastAt) && Date.now() - lastAt < PRELOAD_RECOVERY_COOLDOWN_MS) {
        return; // already tried recently → let Vite rethrow so the failure stays visible
      }
      sessionStorage.setItem(PRELOAD_RECOVERY_AT_KEY, Date.now().toString());
      // We handle recovery via a full reload; stop Vite from also rethrowing.
      event.preventDefault();
      void forceRefreshSpa({ queryParamKey: "chunk_reload" }).catch(() => {
        // Cache clearing failed; attempt a plain reload as a last resort.
        window.location.reload();
      });
    } catch {
      // sessionStorage unavailable or recovery failed → let Vite rethrow the error.
    }
  });
}
