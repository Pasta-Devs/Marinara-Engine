import { getCurrentWindow } from "@tauri-apps/api/window";
import { Maximize2, Minus, Square, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type MouseEvent as ReactMouseEvent } from "react";
import { cn } from "../../shared/lib/utils";
import { ChatTitleControls } from "./ChatTitleControls";
import { PanelNavButtons } from "./PanelNavButtons";

type DesktopPlatform = "darwin" | "windows" | "linux";

type TauriRuntimeWindow = Window & {
  __TAURI__?: unknown;
  __TAURI_INTERNALS__?: unknown;
};

function isTauriRuntime() {
  if (typeof window === "undefined") return false;
  const runtimeWindow = window as TauriRuntimeWindow;
  return Boolean(runtimeWindow.__TAURI__ || runtimeWindow.__TAURI_INTERNALS__);
}

function inferDesktopPlatform(): DesktopPlatform {
  if (typeof navigator === "undefined") return "windows";
  const platform = navigator.platform.toLowerCase();
  const userAgent = navigator.userAgent.toLowerCase();

  if (platform.includes("mac") || userAgent.includes("mac os")) return "darwin";
  if (platform.includes("linux") || userAgent.includes("x11")) return "linux";
  return "windows";
}

export function WindowTitleBar({
  professorMariOpen = false,
  onOpenProfessorMari,
  onGoHome,
}: {
  professorMariOpen?: boolean;
  onOpenProfessorMari?: () => void;
  onGoHome?: () => void;
}) {
  const platform = useMemo(inferDesktopPlatform, []);
  const [isMaximized, setIsMaximized] = useState(false);
  const appWindow = useMemo(() => (isTauriRuntime() ? getCurrentWindow() : null), []);

  const refreshMaximized = useCallback(() => {
    if (!appWindow) return;
    void appWindow.isMaximized().then(setIsMaximized).catch(() => setIsMaximized(false));
  }, [appWindow]);

  useEffect(() => {
    if (!appWindow) return;
    let cleanup: (() => void) | undefined;
    let cancelled = false;

    refreshMaximized();
    void appWindow.onResized(() => refreshMaximized()).then((unlisten) => {
      if (cancelled) {
        unlisten();
        return;
      }
      cleanup = unlisten;
    });

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [appWindow, refreshMaximized]);

  const runWindowAction = useCallback(
    (action: "minimize" | "maximize" | "close") => {
      if (!appWindow) return;
      const next =
        action === "minimize"
          ? appWindow.minimize()
          : action === "maximize"
            ? appWindow.toggleMaximize().then(refreshMaximized)
            : appWindow.close();
      void next.catch(() => {});
    },
    [appWindow, refreshMaximized],
  );

  const startWindowDrag = useCallback(
    (event: ReactMouseEvent<HTMLElement>) => {
      if (!appWindow || event.button !== 0 || event.detail > 1) return;
      void appWindow.startDragging().catch(() => {});
    },
    [appWindow],
  );

  const toggleMaximizeFromDragRegion = useCallback(() => {
    runWindowAction("maximize");
  }, [runWindowAction]);
  const controlActions = platform === "darwin" ? (["close", "minimize", "maximize"] as const) : (["minimize", "maximize", "close"] as const);
  const controls = (
    <div
      className={cn(
        "mari-window-controls flex h-full shrink-0 items-center",
        platform === "darwin" ? "order-first gap-2 pl-2 pr-3" : "order-last gap-1 pl-3 pr-2",
      )}
      aria-label="Window controls"
      onMouseDown={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
    >
      {controlActions.map((action) => {
        const label = action === "maximize" && isMaximized ? "Restore" : action[0]!.toUpperCase() + action.slice(1);
        return (
          <button
            key={action}
            type="button"
            className={cn(`mari-window-control mari-window-control-${action}`, platform === "darwin" && "mari-window-control-mac")}
            onClick={() => runWindowAction(action)}
            onMouseDown={(event) => event.stopPropagation()}
            onDoubleClick={(event) => event.stopPropagation()}
            aria-label={`${label} window`}
            title={label}
          >
            {action === "minimize" ? (
              <Minus aria-hidden size="0.75rem" strokeWidth={2.2} />
            ) : action === "maximize" ? (
              isMaximized ? (
                <Square aria-hidden size="0.625rem" strokeWidth={2.1} />
              ) : (
                <Maximize2 aria-hidden size="0.7rem" strokeWidth={2.1} />
              )
            ) : (
              <X aria-hidden size="0.75rem" strokeWidth={2.2} />
            )}
          </button>
        );
      })}
    </div>
  );

  return (
    <header
      data-component="WindowTitleBar"
      className="mari-window-titlebar relative z-40 flex shrink-0 items-center overflow-visible"
      onMouseDown={startWindowDrag}
      onDoubleClick={toggleMaximizeFromDragRegion}
    >
      {platform === "darwin" && controls}
      <ChatTitleControls
        className="pl-2.5 pr-0"
        professorMariOpen={professorMariOpen}
        onOpenProfessorMari={onOpenProfessorMari}
        onGoHome={onGoHome}
      />
      <div
        className="mari-titlebar-content flex h-full min-w-0 flex-1 items-center"
      >
        <div
          className="mari-title-drag-region flex h-full min-w-0 flex-1 items-center justify-start pl-2 pr-3"
          onMouseDown={startWindowDrag}
          onDoubleClick={toggleMaximizeFromDragRegion}
        >
          <div data-tauri-drag-region className="mari-title-brand min-w-0">
            <span className="mari-title-word mari-title-word-marinara">
              Marinara
            </span>
            <img data-tauri-drag-region className="mari-title-icon" src="/favicon.png" alt="" draggable={false} />
            <span className="mari-title-word mari-title-word-engine">
              Engine
            </span>
          </div>
        </div>
        <div
          className="mari-window-actions flex h-full shrink-0 items-center gap-2"
          onMouseDown={(event) => event.stopPropagation()}
          onDoubleClick={(event) => event.stopPropagation()}
        >
          <PanelNavButtons />
          <span className="mari-window-actions-divider" aria-hidden />
        </div>
      </div>
      {platform !== "darwin" && controls}
    </header>
  );
}
