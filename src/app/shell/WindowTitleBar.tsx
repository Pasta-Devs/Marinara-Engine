import { Maximize2, Minus, Square, X } from "lucide-react";
import { lazy, Suspense, useCallback, useEffect, useMemo, useState, type MouseEvent as ReactMouseEvent } from "react";
import {
  closeDesktopWindow,
  getDesktopWindowVisualState,
  hasDesktopWindowControls,
  minimizeDesktopWindow,
  onDesktopWindowVisualStateChanged,
  startDesktopWindowDrag,
  toggleDesktopWindowFullscreen,
  toggleDesktopWindowMaximize,
  type DesktopWindowVisualState,
} from "../../shared/api/window-controls-api";
import { cn } from "../../shared/lib/utils";
import { useChatStore } from "../../shared/stores/chat.store";
import { useUIStore } from "../../shared/stores/ui.store";
import { ChatTitleControls } from "./ChatTitleControls";
import { PanelNavButtons } from "./PanelNavButtons";

const SpotifyMiniPlayer = lazy(() =>
  import("../../features/shell/spotify/shell").then((module) => ({ default: module.SpotifyMiniPlayer })),
);

type DesktopPlatform = "darwin" | "windows" | "linux";
type WindowControlAction = "close" | "minimize" | "maximize" | "fullscreen";

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
  const hasWindowControls = useMemo(hasDesktopWindowControls, []);
  const [windowVisualState, setWindowVisualState] = useState<DesktopWindowVisualState>({
    fullscreen: false,
    maximized: false,
  });
  const activeChatId = useChatStore((s) => s.activeChatId);
  const setActiveChatId = useChatStore((s) => s.setActiveChatId);
  const closeAllDetails = useUIStore((s) => s.closeAllDetails);
  const closeRightPanel = useUIStore((s) => s.closeRightPanel);
  const spotifyPlayerEnabled = useUIStore((s) => s.spotifyPlayerEnabled);
  const hasOpenSurface = useUIStore((s) =>
    Boolean(
      s.characterDetailId ||
      s.lorebookDetailId ||
      s.presetDetailId ||
      s.connectionDetailId ||
      s.agentDetailId ||
      s.toolDetailId ||
      s.personaDetailId ||
      s.regexDetailId ||
      s.characterLibraryOpen ||
      s.botBrowserOpen ||
      s.gameAssetsBrowserOpen ||
      s.rightPanelOpen,
    ),
  );

  const refreshWindowVisualState = useCallback(() => {
    if (!hasWindowControls) return;
    void getDesktopWindowVisualState()
      .then(setWindowVisualState)
      .catch(() => {
        setWindowVisualState({ fullscreen: false, maximized: false });
      });
  }, [hasWindowControls]);

  useEffect(() => {
    if (!hasWindowControls) return;
    let cleanup: (() => void) | undefined;
    let cancelled = false;

    refreshWindowVisualState();
    void onDesktopWindowVisualStateChanged(refreshWindowVisualState).then((unlisten) => {
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
  }, [hasWindowControls, refreshWindowVisualState]);

  const runWindowAction = useCallback(
    (action: WindowControlAction) => {
      if (!hasWindowControls) return;
      const next =
        action === "minimize"
          ? minimizeDesktopWindow()
          : action === "maximize"
            ? toggleDesktopWindowMaximize().then(setWindowVisualState)
            : action === "fullscreen"
              ? toggleDesktopWindowFullscreen().then(setWindowVisualState)
              : closeDesktopWindow();
      void next.catch(() => refreshWindowVisualState());
    },
    [hasWindowControls, refreshWindowVisualState],
  );

  const startWindowDrag = useCallback(
    (event: ReactMouseEvent<HTMLElement>) => {
      if (!hasWindowControls || event.button !== 0 || event.detail > 1) return;
      void startDesktopWindowDrag().catch(() => {});
    },
    [hasWindowControls],
  );

  const toggleMaximizeFromDragRegion = useCallback(() => {
    runWindowAction("maximize");
  }, [runWindowAction]);

  const goHome = useCallback(() => {
    setActiveChatId(null);
    closeAllDetails();
    closeRightPanel();
    onGoHome?.();
  }, [closeAllDetails, closeRightPanel, onGoHome, setActiveChatId]);

  const isHomeSurface = !professorMariOpen && !activeChatId && !hasOpenSurface;
  const controlActions: WindowControlAction[] =
    platform === "darwin" ? ["close", "minimize", "fullscreen"] : ["minimize", "maximize", "close"];
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
        const isExpanded =
          action === "fullscreen" ? windowVisualState.fullscreen : action === "maximize" && windowVisualState.maximized;
        const label =
          action === "fullscreen"
            ? windowVisualState.fullscreen
              ? "Exit Full Screen"
              : "Enter Full Screen"
            : action === "maximize" && windowVisualState.maximized
              ? "Restore"
              : action[0]!.toUpperCase() + action.slice(1);
        const controlClassName = action === "fullscreen" ? "maximize" : action;
        return (
          <button
            key={action}
            type="button"
            className={cn(
              `mari-window-control mari-window-control-${controlClassName}`,
              platform === "darwin" && "mari-window-control-mac",
            )}
            onClick={() => runWindowAction(action)}
            onMouseDown={(event) => event.stopPropagation()}
            onDoubleClick={(event) => event.stopPropagation()}
            aria-label={`${label} window`}
            title={label}
          >
            {action === "minimize" ? (
              <Minus aria-hidden size="0.75rem" strokeWidth={2.2} />
            ) : action === "maximize" || action === "fullscreen" ? (
              isExpanded ? (
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
        hideHome
      />
      <div className="mari-titlebar-content flex h-full min-w-0 flex-1 items-center">
        <div
          className="mari-title-drag-region flex h-full min-w-0 flex-1 items-center justify-start pl-0.5 pr-3"
          onMouseDown={startWindowDrag}
          onDoubleClick={toggleMaximizeFromDragRegion}
        >
          <button
            type="button"
            className={cn(
              "mari-titlebar-action mari-title-home-button relative rounded-md p-1.5 transition-all duration-200",
              isHomeSurface
                ? "mari-titlebar-action-active text-[color-mix(in_srgb,var(--primary)_54%,var(--muted-foreground))]"
                : "text-[var(--muted-foreground)] hover:text-[var(--primary)]",
            )}
            onClick={goHome}
            onMouseDown={(event) => event.stopPropagation()}
            onDoubleClick={(event) => event.stopPropagation()}
            title="Home"
            aria-label="Home"
            aria-current={isHomeSurface ? "page" : undefined}
          >
            <img className="mari-title-icon" src="/favicon.png" alt="" draggable={false} />
            {isHomeSurface && (
              <span className="absolute -bottom-0.5 left-1/2 h-0.5 w-3 -translate-x-1/2 rounded-full bg-gradient-to-r from-teal-500 to-cyan-500" />
            )}
          </button>
        </div>
        {spotifyPlayerEnabled && (
          <div
            className="mari-titlebar-spotify hidden min-w-0 flex-[0_1_31rem] items-center overflow-hidden px-2 md:flex"
            onMouseDown={(event) => event.stopPropagation()}
            onDoubleClick={(event) => event.stopPropagation()}
          >
            <Suspense fallback={null}>
              <SpotifyMiniPlayer />
            </Suspense>
          </div>
        )}
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
