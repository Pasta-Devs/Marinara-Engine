import {
  GripVertical,
  Music2,
  Pause,
  Play,
  Volume2,
  VolumeX,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { encodeAssetPath } from "../game-assets/encode-asset-path";
import { MusicSourceButton, MusicSourceGlyph } from "../music/MusicSourceButton";
import { cn } from "../../lib/utils";
import { useAgentStore } from "../../stores/agent.store";
import { useUIStore } from "../../stores/ui.store";

const MUSIC_NEUTRAL_SHELL_BORDER_CLASS = "border-[#f7f3ef]/15";
const MUSIC_NEUTRAL_SHELL_BG_CLASS = "bg-[#0f0f0f]/95";
const MUSIC_NEUTRAL_BUTTON_BG_CLASS = "bg-[#f7f3ef]/5";
const MUSIC_NEUTRAL_TILE_BG_CLASS = "bg-[#f7f3ef]/5";
const MUSIC_NEUTRAL_TEXT_CLASS = "text-[#f7f3ef]";
const MUSIC_NEUTRAL_MUTED_CLASS = "text-[#aaa]";
const MUSIC_NEUTRAL_ICON_CLASS = "text-[#aaa]";
const MUSIC_NEUTRAL_ICON_HOVER_CLASS = "hover:bg-[#f7f3ef]/10 hover:text-[#f7f3ef]";
const MUSIC_NEUTRAL_ACTION_BG_CLASS = "bg-[var(--primary)]";
const MUSIC_NEUTRAL_ACTION_TEXT_CLASS = "text-[var(--primary-foreground)]";
const MUSIC_NEUTRAL_PROGRESS_BG_CLASS = "bg-[#f7f3ef]/15";
const MOBILE_WIDGET_COLLAPSED_SIZE = 48;
const MOBILE_WIDGET_EXPANDED_MAX_WIDTH = 320;
const MOBILE_WIDGET_EXPANDED_HORIZONTAL_GUTTER = 24;
const MOBILE_WIDGET_EXPANDED_HEIGHT = 132;
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
      ? position.y
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

function getTrackUrl(path: string) {
  if (path.startsWith("local-music:")) {
    return `/api/game-assets/local-music-file/${encodeURIComponent(path.slice("local-music:".length))}`;
  }
  return `/api/game-assets/file/${encodeAssetPath(path)}`;
}

function LocalPlayerIcon({ icon: Icon }: { icon: LucideIcon }) {
  return <Icon size="0.875rem" className="text-[var(--primary)]" />;
}

export function LocalMusicPlayer({ mobile = false }: { mobile?: boolean } = {}) {
  const localMusicPlay = useAgentStore((s) => s.localMusicPlay);
  const localMusicVolume = useAgentStore((s) => s.localMusicVolume);
  const clearLocalMusic = useAgentStore((s) => s.clearLocalMusic);
  const playerVolume = useUIStore((s) => s.localMusicPlayerVolume);
  const setPlayerVolume = useUIStore((s) => s.setLocalMusicPlayerVolume);
  const musicPlayerActive = useUIStore((s) => s.musicPlayerEnabled && s.musicPlayerSource === "custom");
  const collapsed = useUIStore((s) => s.spotifyMobileWidgetCollapsed);
  const setCollapsed = useUIStore((s) => s.setSpotifyMobileWidgetCollapsed);
  const mobilePosition = useUIStore((s) => s.spotifyMobileWidgetPosition);
  const setMobilePosition = useUIStore((s) => s.setSpotifyMobileWidgetPosition);
  const desktopViewport = useMediaQuery("(min-width: 768px)");

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastNonceRef = useRef(0);
  const prevVolumeRef = useRef(70);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  const [nowPlaying, setNowPlaying] = useState<{ path: string; title: string; mood: string } | null>(null);
  const [paused, setPaused] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const active = musicPlayerActive && (mobile || desktopViewport);

  useEffect(() => {
    if (!active) return;
    if (!localMusicPlay) return;
    if (localMusicPlay.nonce === lastNonceRef.current) return;
    lastNonceRef.current = localMusicPlay.nonce;

    const audio = audioRef.current;
    if (!audio) return;

    const src = getTrackUrl(localMusicPlay.path);
    setError(null);
    setNowPlaying({ path: localMusicPlay.path, title: localMusicPlay.title, mood: localMusicPlay.mood });
    setPaused(false);
    audio.src = src;
    audio.loop = true;
    audio.volume = Math.max(0, Math.min(1, playerVolume / 100));
    audio
      .play()
      .then(() => setPaused(false))
      .catch((err) => {
        setPaused(true);
        setError(err instanceof Error ? err.message : "Local playback failed");
      });
  }, [active, localMusicPlay, playerVolume]);

  useEffect(() => {
    if (localMusicVolume != null) setPlayerVolume(localMusicVolume);
  }, [localMusicVolume, setPlayerVolume]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = Math.max(0, Math.min(1, playerVolume / 100));
  }, [playerVolume]);

  useEffect(() => {
    if (playerVolume > 0) prevVolumeRef.current = playerVolume;
  }, [playerVolume]);

  useEffect(() => {
    if (active) return;
    audioRef.current?.pause();
    setNowPlaying(null);
    setPaused(true);
  }, [active]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio || !nowPlaying) return;
    if (paused) {
      audio
        .play()
        .then(() => setPaused(false))
        .catch((err) => setError(err instanceof Error ? err.message : "Local playback failed"));
    } else {
      audio.pause();
      setPaused(true);
    }
  };

  const close = () => {
    audioRef.current?.pause();
    if (audioRef.current) audioRef.current.currentTime = 0;
    setNowPlaying(null);
    setPaused(true);
    setError(null);
    clearLocalMusic();
  };

  const toggleMute = useCallback(() => {
    if (playerVolume > 0) {
      prevVolumeRef.current = playerVolume;
      setPlayerVolume(0);
    } else {
      setPlayerVolume(prevVolumeRef.current > 0 ? prevVolumeRef.current : 70);
    }
  }, [playerVolume, setPlayerVolume]);

  const startDrag = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!mobile) return;
      if (event.target instanceof Element && event.target.closest("button,a,input,textarea,select,[role='button']")) {
        return;
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
        // Some mobile browsers deny capture if the pointer was already cancelled.
      }
    },
    [mobile, mobilePosition.x, mobilePosition.y],
  );

  const moveDrag = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      event.preventDefault();
      const next = clampMobilePosition(
        drag.originX + event.clientX - drag.startX,
        drag.originY + event.clientY - drag.startY,
        collapsed,
      );
      setMobilePosition(next);
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
        // Ignore browsers that already released capture.
      }
      if (moved < 6 && mobile && collapsed) setCollapsed(false);
    },
    [collapsed, mobile, setCollapsed],
  );

  const hasPlayerContent = !!nowPlaying || !!error;
  const showPlayer = active;
  const displayTitle = error ? error : (nowPlaying?.title ?? "Custom Music");
  const displaySubtitle = error ? "Playback needs attention" : (nowPlaying?.mood ?? "Ready for Music DJ");
  const mobileWidgetStyle = useMemo(() => getMobileWidgetStyle(mobilePosition, collapsed), [collapsed, mobilePosition]);
  const mobileExpandedPanelStyle = useMemo(() => getMobileExpandedPanelStyle(mobilePosition), [mobilePosition]);
  const volumeMuted = playerVolume <= 0;
  const VolumeIcon = volumeMuted ? VolumeX : Volume2;
  const stopPointer = (event: ReactPointerEvent<HTMLElement>) => event.stopPropagation();

  const volumeControls = (
    <div
      className="flex w-full shrink-0 items-center gap-1"
      onPointerDown={stopPointer}
      onPointerMove={stopPointer}
      onPointerUp={stopPointer}
      onPointerCancel={stopPointer}
    >
      <button
        type="button"
        onClick={toggleMute}
        className={cn(
          "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-colors",
          MUSIC_NEUTRAL_ICON_CLASS,
          MUSIC_NEUTRAL_ICON_HOVER_CLASS,
        )}
        title={volumeMuted ? "Unmute" : "Mute"}
        aria-label={volumeMuted ? "Unmute" : "Mute"}
      >
        <VolumeIcon size="0.75rem" />
      </button>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={playerVolume}
        onChange={(event) => setPlayerVolume(Number(event.target.value))}
        className="mari-local-music-volume-slider w-full"
        title="Volume"
        aria-label="Custom music volume"
        style={{ "--range-progress": `${playerVolume}%` } as CSSProperties}
      />
    </div>
  );

  const compactBody = (
    <>
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <MusicSourceButton source="custom" className={MUSIC_NEUTRAL_BUTTON_BG_CLASS} />
        <div
          className={cn(
            "flex h-7 w-10 shrink-0 items-center justify-center overflow-hidden rounded-[0.375rem] ring-1 ring-[#f7f3ef]/10",
            MUSIC_NEUTRAL_TILE_BG_CLASS,
          )}
        >
          <LocalPlayerIcon icon={Music2} />
        </div>
        <div className="min-w-0">
          <p
            className={cn("truncate text-[0.6875rem] font-semibold leading-tight", MUSIC_NEUTRAL_TEXT_CLASS)}
            title={displayTitle}
          >
            {displayTitle}
          </p>
          <p className={cn("truncate text-[0.5625rem] leading-tight", MUSIC_NEUTRAL_MUTED_CLASS)}>{displaySubtitle}</p>
        </div>
      </div>
      {nowPlaying && (
        <button
          type="button"
          onClick={togglePlay}
          className={cn(
            "inline-flex h-7 w-7 items-center justify-center rounded-full shadow-[0_1px_8px_color-mix(in_srgb,var(--primary)_45%,transparent)] transition-transform hover:scale-105 active:scale-95",
            MUSIC_NEUTRAL_ACTION_BG_CLASS,
            MUSIC_NEUTRAL_ACTION_TEXT_CLASS,
          )}
          aria-label={paused ? "Play" : "Pause"}
        >
          {paused ? <Play size="0.8125rem" className="translate-x-px fill-current" /> : <Pause size="0.8125rem" />}
        </button>
      )}
      {hasPlayerContent && (
        <button
          type="button"
          onClick={close}
          className={cn(
            "inline-flex h-7 w-7 items-center justify-center rounded-full transition-colors active:scale-90",
            MUSIC_NEUTRAL_ICON_CLASS,
            MUSIC_NEUTRAL_ICON_HOVER_CLASS,
          )}
          aria-label="Stop"
        >
          <X size="0.8125rem" />
        </button>
      )}
    </>
  );

  if (mobile) {
    return (
      <>
        <audio ref={audioRef} className="hidden" />
        {showPlayer && (
          <div
            className="fixed z-[35] touch-none select-none md:hidden"
            style={mobileWidgetStyle}
            onPointerDown={startDrag}
            onPointerMove={moveDrag}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
            {collapsed ? (
              <div
                className={cn(
                  "flex h-12 w-12 items-center justify-center rounded-full border shadow-lg backdrop-blur-xl",
                  MUSIC_NEUTRAL_SHELL_BORDER_CLASS,
                  MUSIC_NEUTRAL_SHELL_BG_CLASS,
                )}
              >
                <MusicSourceGlyph source="custom" className="h-5 w-5 text-[var(--primary)]" />
              </div>
            ) : (
              <div
                className={cn(
                  "rounded-xl border p-2 shadow-2xl backdrop-blur-xl",
                  MUSIC_NEUTRAL_SHELL_BORDER_CLASS,
                  MUSIC_NEUTRAL_SHELL_BG_CLASS,
                )}
                style={mobileExpandedPanelStyle}
              >
                <div className="mb-1 flex items-center gap-1">
                  <GripVertical size="0.875rem" className={MUSIC_NEUTRAL_ICON_CLASS} />
                  <span className={cn("flex-1 truncate text-[0.625rem] font-medium", MUSIC_NEUTRAL_ICON_CLASS)}>
                    Custom
                  </span>
                  <button
                    type="button"
                    onPointerDown={(event) => event.stopPropagation()}
                    onPointerMove={(event) => event.stopPropagation()}
                    onPointerUp={(event) => event.stopPropagation()}
                    onPointerCancel={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.stopPropagation();
                      setCollapsed(true);
                    }}
                    className={cn(
                      "rounded-full p-1 transition-colors",
                      MUSIC_NEUTRAL_ICON_CLASS,
                      MUSIC_NEUTRAL_ICON_HOVER_CLASS,
                    )}
                    title="Close player"
                  >
                    <X size="0.875rem" />
                  </button>
                </div>
                <div className="flex items-center gap-2">{compactBody}</div>
                <div className="mt-2">{volumeControls}</div>
              </div>
            )}
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <audio ref={audioRef} className="hidden" />
      {showPlayer && (
        <div
          className={cn(
            "relative hidden h-10 min-w-0 max-w-[31rem] flex-1 items-center gap-2 overflow-hidden rounded-full border px-2.5 md:flex",
            MUSIC_NEUTRAL_SHELL_BORDER_CLASS,
            MUSIC_NEUTRAL_SHELL_BG_CLASS,
          )}
        >
          {compactBody}
          <div className="hidden w-24 shrink-0 lg:flex">{volumeControls}</div>
          <div
            className={cn(
              "pointer-events-none absolute bottom-0 left-3 right-3 h-px overflow-hidden rounded-full",
              MUSIC_NEUTRAL_PROGRESS_BG_CLASS,
            )}
          >
            <div
              className={cn(
                "h-full rounded-full bg-[var(--primary)]",
                hasPlayerContent && !paused ? "w-full opacity-80" : "w-8 opacity-50",
              )}
            />
          </div>
        </div>
      )}
    </>
  );
}

export function LocalMusicMobileWidget() {
  const enabled = useUIStore((s) => s.musicPlayerEnabled && s.musicPlayerSource === "custom");
  const isMobileViewport = useMediaQuery("(max-width: 767px)");

  if (!enabled || !isMobileViewport) return null;

  return <LocalMusicPlayer mobile />;
}

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() =>
    typeof window === "undefined" ? false : window.matchMedia(query).matches,
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [query]);

  return matches;
}
