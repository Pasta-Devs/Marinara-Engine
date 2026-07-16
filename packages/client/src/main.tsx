import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App, AppRecoveryBoundary } from "./App";
import { startKeepAlive } from "./lib/keep-alive";
import { installCsrfFetchShim } from "./lib/csrf-fetch";
import { registerPreloadErrorRecovery } from "./lib/browser-runtime";
import "./styles/globals.css";

// Installed capability clients can outlive the Engine build that produced
// them. Older Conversation-game bundles contain classic JSX output that reads
// React from the global scope, so expose the host runtime before any package
// client is imported.
Object.assign(globalThis, { React, ReactDOM });

// Prevent Chrome/Edge from sleeping this tab
startKeepAlive();
installCsrfFetchShim();
// Auto-recover from stale-chunk dynamic-import failures (e.g. a lazy route that
// 404s after an update) instead of surfacing "Failed to fetch dynamically
// imported module" to the user.
registerPreloadErrorRecovery();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function scheduleAfterFirstLoad(callback: () => void) {
  const schedule = () => {
    const requestIdleCallback = window.requestIdleCallback;
    if (typeof requestIdleCallback === "function") {
      requestIdleCallback(callback, { timeout: 3_000 });
      return;
    }

    globalThis.setTimeout(callback, 1_000);
  };

  if (document.readyState === "complete") {
    schedule();
    return;
  }

  window.addEventListener("load", schedule, { once: true });
}

function registerServiceWorker() {
  scheduleAfterFirstLoad(() => {
    void import("virtual:pwa-register")
      .then(({ registerSW }) => {
        const updateSW = registerSW({
          immediate: true,
          onNeedRefresh() {
            void updateSW(true);
          },
          onRegisteredSW(_swUrl: string, registration?: ServiceWorkerRegistration) {
            if (!registration) {
              return;
            }

            const isMobile = window.matchMedia("(hover: none) and (pointer: coarse)").matches;
            const updateIntervalMs = isMobile ? 6 * 60 * 60_000 : 60 * 60_000;
            window.setInterval(() => {
              if (document.visibilityState === "visible") void registration.update();
            }, updateIntervalMs);
          },
        });
      })
      .catch(() => {
        // Service worker registration is a progressive enhancement.
      });
  });
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AppRecoveryBoundary>
        <App />
      </AppRecoveryBoundary>
    </QueryClientProvider>
  </React.StrictMode>,
);

registerServiceWorker();
