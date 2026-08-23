import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { GripVertical, Music2, Sparkles, X } from "lucide-react";
import { cn } from "../../lib/utils";
import { useUIStore } from "../../stores/ui.store";
import { useTranslation as useUiTranslation } from "react-i18next";

const MOBILE_WIDGET_COLLAPSED_SIZE = 48;
const MOBILE_WIDGET_EXPANDED_MAX_WIDTH = 320;
const MOBILE_WIDGET_EXPANDED_HORIZONTAL_GUTTER = 24;
const MOBILE_WIDGET_EXPANDED_HEIGHT = 108;
const MOBILE_WIDGET_VIEWPORT_PADDING = 8;

function clampMobilePosition(x: number, y: number, collapsed: boolean) {
  if (typeof window === "undefined") return { x, y };
  const width = collapsed
    ? MOBILE_WIDGET_COLLAPSED_SIZE
    : Math.min(MOBILE_WIDGET_EXPANDED_MAX_WIDTH, window.innerWidth - MOBILE_WIDGET_EXPANDED_HORIZONTAL_GUTTER);
  const height = collapsed ? MOBILE_WIDGET_COLLAPSED_SIZE : MOBILE_WIDGET_EXPANDED_HEIGHT;
  return {
    x: Math.max(
      MOBILE_WIDGET_VIEWPORT_PADDING,
      Math.min(window.innerWidth - width - MOBILE_WIDGET_VIEWPORT_PADDING, x),
    ),
    y: Math.max(
      MOBILE_WIDGET_VIEWPORT_PADDING,
      Math.min(window.innerHeight - height - MOBILE_WIDGET_VIEWPORT_PADDING, y),
    ),
  };
}

function getMobileWidgetStyle(
  position: { x: number; y: number },
  collapsed: boolean,
): Pick<CSSProperties, "left" | "top"> {
  if (typeof window === "undefined") return { left: position.x, top: position.y };
  return {
    left: Math.max(
      MOBILE_WIDGET_VIEWPORT_PADDING,
      Math.min(window.innerWidth - MOBILE_WIDGET_COLLAPSED_SIZE - MOBILE_WIDGET_VIEWPORT_PADDING, position.x),
    ),
    top: collapsed
      ? Math.max(
          MOBILE_WIDGET_VIEWPORT_PADDING,
          Math.min(window.innerHeight - MOBILE_WIDGET_COLLAPSED_SIZE - MOBILE_WIDGET_VIEWPORT_PADDING, position.y),
        )
      : Math.max(
          MOBILE_WIDGET_VIEWPORT_PADDING,
          Math.min(window.innerHeight - MOBILE_WIDGET_EXPANDED_HEIGHT - MOBILE_WIDGET_VIEWPORT_PADDING, position.y),
        ),
  };
}

function getMobileExpandedPanelStyle(position: { x: number; y: number }): CSSProperties {
  if (typeof window === "undefined") return {};
  const width = Math.min(
    MOBILE_WIDGET_EXPANDED_MAX_WIDTH,
    window.innerWidth - MOBILE_WIDGET_EXPANDED_HORIZONTAL_GUTTER,
  );
  const opensLeft =
    position.x + width > window.innerWidth - MOBILE_WIDGET_VIEWPORT_PADDING ||
    position.x + MOBILE_WIDGET_COLLAPSED_SIZE / 2 > window.innerWidth / 2;
  const preferredLeft = opensLeft ? position.x + MOBILE_WIDGET_COLLAPSED_SIZE - width : position.x;
  const clampedLeft = Math.max(
    MOBILE_WIDGET_VIEWPORT_PADDING,
    Math.min(window.innerWidth - width - MOBILE_WIDGET_VIEWPORT_PADDING, preferredLeft),
  );
  return {
    width,
    transform: `translateX(${Math.round(clampedLeft - position.x)}px)`,
  };
}

export function MusicDjUnavailablePlayer({
  floating = false,
  mobileOnly = false,
}: {
  floating?: boolean;
  mobileOnly?: boolean;
}) {
  const { t: localizeUi } = useUiTranslation();
  const openRightPanel = useUIStore((state) => state.openRightPanel);
  const openAgentCatalog = useUIStore((state) => state.openAgentCatalog);
  const agentCatalogOpen = useUIStore((state) => state.agentCatalogOpen);
  const collapsed = useUIStore((state) => state.spotifyMobileWidgetCollapsed);
  const setCollapsed = useUIStore((state) => state.setSpotifyMobileWidgetCollapsed);
  const mobilePosition = useUIStore((state) => state.spotifyMobileWidgetPosition);
  const setMobilePosition = useUIStore((state) => state.setSpotifyMobileWidgetPosition);
  const [, setViewportRevision] = useState(0);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);
  const mobileWidgetStyle = getMobileWidgetStyle(mobilePosition, collapsed);
  const mobileExpandedPanelStyle = getMobileExpandedPanelStyle(mobilePosition);

  useEffect(() => {
    if (!mobileOnly) return;

    const refreshViewport = () => {
      setViewportRevision((revision) => revision + 1);
      const nextPosition = clampMobilePosition(mobilePosition.x, mobilePosition.y, collapsed);
      if (nextPosition.x !== mobilePosition.x || nextPosition.y !== mobilePosition.y) {
        setMobilePosition(nextPosition);
      }
    };

    window.addEventListener("resize", refreshViewport);
    window.addEventListener("orientationchange", refreshViewport);
    return () => {
      window.removeEventListener("resize", refreshViewport);
      window.removeEventListener("orientationchange", refreshViewport);
    };
  }, [collapsed, mobileOnly, mobilePosition.x, mobilePosition.y, setMobilePosition]);

  const openDownloadAgents = () => {
    openRightPanel("agents");
    openAgentCatalog();
  };

  const startDrag = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!mobileOnly) return;
      if (event.target instanceof Element) {
        const interactiveTarget = event.target.closest("button,a,input,textarea,select,[role='button']");
        if (interactiveTarget && interactiveTarget !== event.currentTarget) return;
      }
      event.preventDefault();
      dragRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        originX: mobilePosition.x,
        originY: mobilePosition.y,
      };
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // Some mobile browsers can deny capture after the pointer is cancelled.
      }
    },
    [mobileOnly, mobilePosition.x, mobilePosition.y],
  );

  const moveDrag = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      event.preventDefault();
      setMobilePosition(
        clampMobilePosition(
          drag.originX + event.clientX - drag.startX,
          drag.originY + event.clientY - drag.startY,
          collapsed,
        ),
      );
    },
    [collapsed, setMobilePosition],
  );

  const endDrag = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      const moved = Math.abs(event.clientX - drag.startX) + Math.abs(event.clientY - drag.startY);
      dragRef.current = null;
      try {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
      } catch {
        // The browser may already have released capture.
      }
      if (moved < 6 && collapsed) setCollapsed(false);
    },
    [collapsed, setCollapsed],
  );

  if (mobileOnly && agentCatalogOpen) return null;

  if (mobileOnly) {
    return (
      <div
        data-component="MusicDjUnavailablePlayer"
        className="fixed z-[45] touch-none select-none md:hidden"
        style={mobileWidgetStyle}
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        {...(collapsed
          ? {
              role: "button",
              tabIndex: 0,
              "aria-label": "Open Music DJ download prompt",
              onKeyDown: (event: ReactKeyboardEvent<HTMLDivElement>) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setCollapsed(false);
                }
              },
            }
          : {})}
      >
        {collapsed ? (
          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[var(--marinara-music-player-shell-border)] bg-[var(--marinara-music-player-shell-bg)] text-[var(--marinara-music-player-icon)] shadow-lg backdrop-blur-xl">
            <Music2 size="1.125rem" />
          </div>
        ) : (
          <div
            className="rounded-xl border border-[var(--marinara-music-player-shell-border)] bg-[var(--marinara-music-player-shell-bg)] p-2 shadow-2xl backdrop-blur-xl"
            style={mobileExpandedPanelStyle}
          >
            <div className="mb-1.5 flex items-center gap-1">
              <GripVertical size="0.875rem" className="text-[var(--marinara-music-player-icon)]" />
              <span className="flex-1 text-[0.625rem] font-medium text-[var(--marinara-music-player-muted)]">
                {localizeUi("settings.controls.musicPlayer.label")}
              </span>
              <button
                type="button"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={() => setCollapsed(true)}
                className="rounded-full p-1 text-[var(--marinara-music-player-icon)] transition-colors hover:bg-[var(--marinara-music-player-button-bg-hover)]"
                aria-label={localizeUi("ui.music.musicdjunavailableplayer.collapseMusicPlayer")}
              >
                <X size="0.875rem" />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <Music2 size="0.875rem" className="shrink-0 text-[var(--marinara-music-player-icon)]" />
              <span className="min-w-0 flex-1 text-[0.6875rem] leading-tight text-[var(--marinara-music-player-text)]">
                {localizeUi("ui.music.musicdjunavailableplayer.downloadMusicDjAgentToConfigure")}
              </span>
              <button
                type="button"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={openDownloadAgents}
                className="mari-chrome-control mari-chrome-control--primary mari-chrome-control--compact shrink-0 gap-1.5 whitespace-nowrap"
              >
                <Sparkles size="0.75rem" />
                {localizeUi("ui.agents.agentcatalogview.downloadAgents")}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      data-component="MusicDjUnavailablePlayer"
      className={cn(
        "flex min-w-0 items-center gap-2 rounded-xl border border-[var(--marinara-music-player-shell-border)] bg-[var(--marinara-music-player-shell-bg)] px-2.5 py-1.5 shadow-lg backdrop-blur-xl",
        floating
          ? "fixed inset-x-3 top-[calc(env(safe-area-inset-top)+3.5rem)] z-[45] mx-auto max-w-md"
          : "relative hidden h-10 max-w-[31rem] flex-1 md:flex",
      )}
    >
      <Music2 size="0.875rem" className="shrink-0 text-[var(--marinara-music-player-icon)]" />
      <span className="min-w-0 flex-1 text-[0.6875rem] leading-tight text-[var(--marinara-music-player-text)]">
        {localizeUi("ui.music.musicdjunavailableplayer.downloadMusicDjAgentToConfigure")}
      </span>
      <button
        type="button"
        onClick={openDownloadAgents}
        className="mari-chrome-control mari-chrome-control--primary mari-chrome-control--compact shrink-0 gap-1.5 whitespace-nowrap"
      >
        <Sparkles size="0.75rem" />
        {localizeUi("ui.agents.agentcatalogview.downloadAgents")}
      </button>
    </div>
  );
}
