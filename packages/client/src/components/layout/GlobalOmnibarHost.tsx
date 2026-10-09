import { Component, Suspense, useEffect, type ErrorInfo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import {
  DEFAULT_COMMAND_CENTER_SESSION_STATE,
  isAskMariShortcut,
  isOmnibarShortcut,
  readCommandCenterSessionState,
  writeCommandCenterSessionState,
} from "../../lib/command-center";
import { isShortcutsHelpKey, isTypingTarget } from "../../lib/keyboard-shortcuts";
import { isModalOverlayOpen } from "../../lib/modal-overlay-registry";
import { parseOmnibarScope } from "../../lib/omnibar-scope";
import {
  consumeProfessorMariOpenRequest,
  PROFESSOR_MARI_OPEN_EVENT,
  requestProfessorMariOpen,
  type ProfessorMariOpenDetail,
} from "../../lib/professor-mari-open";
import { useMariAppearancePack, useMariPackUnlocks } from "../../hooks/use-mari-appearance-pack";
import { useMariPresence } from "../../hooks/use-mari-presence";
import { warmMariSprite } from "../../lib/mari-sprite-ready";
import { mariAssetUrls } from "../../lib/mari-work-animations";
import { preloadedLazy } from "../../lib/preloaded-lazy";
import { useUIStore } from "../../stores/ui.store";

// The dialog carries the whole Command Center (search, browse, Mari panes), so it
// stays out of the eager app shell chunk until the user actually opens it.
// Preloaded at idle below; rendered directly once loaded, so the first open skips React's Suspense throttle.
const GlobalOmnibarDialog = preloadedLazy(() => import("./GlobalOmnibar").then((module) => module.GlobalOmnibarDialog));

/**
 * The Command Center session (pane, selected result, query) is persisted, so a
 * render failure in one pane would otherwise reappear on every open and take the
 * whole app down with it. Contain the failure to the panel, show what broke, and
 * drop the persisted session so the next open starts clean.
 */
class OmnibarErrorBoundary extends Component<
  { onClose: () => void; children: ReactNode },
  { error: unknown; hasError: boolean }
> {
  state: { error: unknown; hasError: boolean } = { error: null, hasError: false };

  static getDerivedStateFromError(error: unknown) {
    return { error, hasError: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error("[GlobalOmnibar] Unhandled render error", error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return <OmnibarErrorPanel error={this.state.error} onClose={this.props.onClose} />;
  }
}

function OmnibarErrorPanel({ error, onClose }: { error: unknown; onClose: () => void }) {
  const { t } = useTranslation();
  const message = error instanceof Error ? error.message : String(error);
  // Clear the saved session here, not in componentDidCatch: the crashed dialog's unmount effect flushes
  // its session after componentDidCatch runs, and this panel's mount effect runs after that flush.
  useEffect(() => {
    writeCommandCenterSessionState(DEFAULT_COMMAND_CENTER_SESSION_STATE);
  }, []);
  return (
    <div
      role="alertdialog"
      aria-label={t("commandCenter.error.title", "Search could not open")}
      className="fixed inset-0 z-(--mari-layer-omnibar) flex items-start justify-center bg-black/55 p-4 backdrop-blur-sm sm:pt-[10vh]"
    >
      <div className="w-full max-w-lg rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 text-[var(--foreground)] shadow-2xl">
        <h2 className="text-base font-semibold">{t("commandCenter.error.title", "Search could not open")}</h2>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          {t("commandCenter.error.description", "Its saved state was cleared. Opening it again should work.")}
        </p>
        <p className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--secondary)] p-2 text-sm">{message}</p>
        <button
          type="button"
          onClick={onClose}
          className="mt-4 inline-flex min-h-11 items-center justify-center rounded-md bg-[var(--primary)] px-3 text-sm font-semibold text-[var(--primary-foreground)] sm:min-h-9"
        >
          {t("commandCenter.error.close", "Close")}
        </button>
      </div>
    </div>
  );
}

export function GlobalOmnibar() {
  const open = useUIStore((state) => state.omnibarOpen);
  const setOpen = useUIStore((state) => state.setOmnibarOpen);
  // This host is mounted for the whole session while the dialog below it is
  // not, so the heartbeat lives here. Without it Professor Mari's state dies
  // with the dialog and a task that finishes after a close is never noticed.
  // The top-bar edge glow (useMariEdgeGlow) reads the same query.
  useMariPresence();

  // Fetch the dialog's code once the app is idle, so the first ⌘K opens without
  // waiting on the network. A failed preload is retried by the real open.
  useEffect(() => {
    const preload = () =>
      void GlobalOmnibarDialog.preload()
        .then(() => import("./GlobalOmnibar"))
        // Her pane's code too, so the first ⌘J does not fetch and run it before her chat can load.
        .then((module) => (useUIStore.getState().commandCenterMariEnabled ? module.OmnibarMariPane.preload() : null))
        .catch(() => undefined);
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(preload, { timeout: 5_000 });
      return () => window.cancelIdleCallback(id);
    }
    const timer = window.setTimeout(preload, 2_000);
    return () => window.clearTimeout(timer);
  }, []);

  // M16 tier 2: once the page has loaded, warm the selected pack's omnibar sprites at idle, so the
  // first ⌘K, ⌘J or pull shows Mari at once. Only this pack; a switch warms the new one (its tier 1
  // sprites come from the Home <img> tags themselves).
  const pack = useMariAppearancePack();
  useMariPackUnlocks();
  useEffect(() => {
    let idleId: number | undefined;
    let timer: number | undefined;
    // Decoded, not just fetched: the first frame she draws is already a bitmap, not a late pop-in.
    // Decoded, not just fetched: a sheet counts as drawn only once it is decoded (mari-sprite-ready).
    const prefetch = () => {
      for (const url of mariAssetUrls(pack, 2)) void warmMariSprite(url);
    };
    const schedule = () => {
      if (typeof window.requestIdleCallback === "function")
        idleId = window.requestIdleCallback(prefetch, { timeout: 5_000 });
      else timer = window.setTimeout(prefetch, 2_000);
    };
    if (document.readyState === "complete") schedule();
    else window.addEventListener("load", schedule, { once: true });
    return () => {
      window.removeEventListener("load", schedule);
      if (idleId !== undefined) window.cancelIdleCallback(idleId);
      window.clearTimeout(timer);
    };
  }, [pack]);

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      const ui = useUIStore.getState();
      if (event.defaultPrevented || event.isComposing) return;
      if (isOmnibarShortcut(event)) {
        // L8: ⌘K opens on top of any dialog or the game setup wizard. While the
        // omnibar is open, a dialog opened above it (a confirm from Mari, say)
        // keeps the keyboard: ⌘K there does not close the omnibar beneath it.
        const dialog = event.target instanceof Element ? event.target.closest('[aria-modal="true"]') : null;
        if (ui.omnibarOpen && dialog && !dialog.closest('[data-component="GlobalOmnibar"]')) return;
        event.preventDefault();
        setOpen(!ui.omnibarOpen);
      } else if (isAskMariShortcut(event) && !ui.omnibarOpen && ui.commandCenterMariEnabled) {
        // M18: ⌘J opens Mari with this screen's context, over any dialog like ⌘K (L8). While the
        // omnibar is open its dialog owns ⌘J (back to search, or into Mari).
        event.preventDefault();
        requestProfessorMariOpen();
      } else if (
        isShortcutsHelpKey(event) &&
        !ui.omnibarOpen &&
        // A `Modal` (a confirm dialog, say) does not set `ui.modal`, so check
        // the overlay registry too.
        !ui.modal &&
        !isModalOverlayOpen() &&
        !isTypingTarget(event.target)
      ) {
        event.preventDefault();
        ui.openModal("keyboard-shortcuts");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [setOpen]);

  useEffect(() => {
    const openProfessorMari = (event: Event) => {
      const request = (event as CustomEvent<ProfessorMariOpenDetail>).detail;
      if ((request.destination ?? "omnibar") !== "omnibar") return;
      // M9: a request that brings nothing stays pending for the dialog, which arrives with the
      // context of the screen it opens over.
      if (request.context || request.draft) consumeProfessorMariOpenRequest("omnibar");
      if (!useUIStore.getState().omnibarOpen) {
        const current = readCommandCenterSessionState();
        writeCommandCenterSessionState({
          ...current,
          pane: "mari",
          mariHandoff: request.context
            ? {
                status: "pending",
                context: request.context,
                // A scope prefix like "faq:" is omnibar search syntax, not part
                // of the message text — strip it before it lands in the composer.
                draft: parseOmnibarScope(request.draft ?? request.context.query ?? "").query,
                submitDraft: request.submitDraft,
              }
            : current.mariHandoff,
        });
      }
      setOpen(true);
    };
    window.addEventListener(PROFESSOR_MARI_OPEN_EVENT, openProfessorMari);
    return () => window.removeEventListener(PROFESSOR_MARI_OPEN_EVENT, openProfessorMari);
  }, [setOpen]);

  if (!open) return null;
  return (
    <OmnibarErrorBoundary key="omnibar" onClose={() => setOpen(false)}>
      <Suspense fallback={null}>
        <GlobalOmnibarDialog onClose={() => setOpen(false)} />
      </Suspense>
    </OmnibarErrorBoundary>
  );
}
