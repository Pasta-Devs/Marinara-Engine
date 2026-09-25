import { Component, Suspense, lazy, useEffect, type ErrorInfo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import {
  DEFAULT_COMMAND_CENTER_SESSION_STATE,
  isOmnibarShortcut,
  readCommandCenterSessionState,
  writeCommandCenterSessionState,
} from "../../lib/command-center";
import { isShortcutsHelpKey, isTypingTarget } from "../../lib/keyboard-shortcuts";
import { isModalOverlayOpen } from "../../lib/modal-overlay-registry";
import {
  consumeProfessorMariOpenRequest,
  PROFESSOR_MARI_OPEN_EVENT,
  type ProfessorMariOpenDetail,
} from "../../lib/professor-mari-open";
import { useMariPresence } from "../../hooks/use-mari-presence";
import { useUIStore } from "../../stores/ui.store";

// The dialog carries the whole Command Center (search, browse, Mari panes), so it
// stays out of the eager app shell chunk until the user actually opens it.
const GlobalOmnibarDialog = lazy(() =>
  import("./GlobalOmnibar").then((module) => ({ default: module.GlobalOmnibarDialog })),
);

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
    writeCommandCenterSessionState(DEFAULT_COMMAND_CENTER_SESSION_STATE);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return <OmnibarErrorPanel error={this.state.error} onClose={this.props.onClose} />;
  }
}

function OmnibarErrorPanel({ error, onClose }: { error: unknown; onClose: () => void }) {
  const { t } = useTranslation();
  const message = error instanceof Error ? error.message : String(error);
  return (
    <div
      role="alertdialog"
      aria-label={t("commandCenter.error.title", "The Command Center could not open")}
      className="fixed inset-0 z-[100] flex items-start justify-center bg-black/55 p-4 backdrop-blur-sm sm:pt-[10vh]"
    >
      <div className="w-full max-w-lg rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 text-[var(--foreground)] shadow-2xl">
        <h2 className="text-base font-semibold">
          {t("commandCenter.error.title", "The Command Center could not open")}
        </h2>
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
  // The presence indicator reads the same query.
  useMariPresence();

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      // A `Modal` (a confirm dialog, say) does not set `ui.modal`, so check the
      // overlay registry too; the omnibar itself is not a `Modal`.
      const ui = useUIStore.getState();
      if (event.defaultPrevented || event.isComposing || ui.modal || isModalOverlayOpen()) return;
      if (isOmnibarShortcut(event)) {
        event.preventDefault();
        setOpen(!ui.omnibarOpen);
      } else if (isShortcutsHelpKey(event) && !ui.omnibarOpen && !isTypingTarget(event.target)) {
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
      consumeProfessorMariOpenRequest("omnibar");
      if (!useUIStore.getState().omnibarOpen) {
        const current = readCommandCenterSessionState();
        writeCommandCenterSessionState({
          ...current,
          pane: "mari",
          mariHandoff: request.context
            ? {
                status: "pending",
                context: request.context,
                draft: request.draft,
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
