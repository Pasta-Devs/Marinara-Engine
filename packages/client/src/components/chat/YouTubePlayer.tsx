import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { ChevronDown, ChevronUp, GripVertical, Loader2, Pause, Play, Volume2, VolumeX, X } from "lucide-react";
import { useAgentStore } from "@/stores/agent.store";
import { useUIStore } from "@/stores/ui.store";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { MusicSourceButton, MusicSourceGlyph } from "@/components/music/MusicSourceButton";

// The YouTube IFrame API attaches itself to window; it has no bundled types.
type YTPlayer = {
  loadVideoById: (id: string) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  stopVideo: () => void;
  setVolume: (v: number) => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  destroy: () => void;
};

interface SearchResult {
  videoId: string;
  title: string;
  channel: string;
  thumbnail: string | null;
}

let ytApiPromise: Promise<void> | null = null;

const MUSIC_NEUTRAL_BORDER_CLASS = "border-[#f7f3ef]/15";
const MUSIC_NEUTRAL_SHELL_BORDER_CLASS = "border-[#f7f3ef]/15";
const MUSIC_NEUTRAL_SHELL_BG_CLASS = "bg-[#0f0f0f]/95";
const MUSIC_NEUTRAL_BUTTON_BG_CLASS = "bg-[#f7f3ef]/5";
const MUSIC_NEUTRAL_TILE_BG_CLASS = "bg-[#f7f3ef]/5";
const MUSIC_NEUTRAL_TEXT_CLASS = "text-[#f7f3ef]";
const MUSIC_NEUTRAL_MUTED_CLASS = "text-[#aaa]";
const MUSIC_NEUTRAL_ICON_CLASS = "text-[#aaa]";
const MUSIC_NEUTRAL_ICON_HOVER_CLASS = "hover:bg-[#f7f3ef]/10 hover:text-[#f7f3ef]";
const MUSIC_NEUTRAL_PROGRESS_BG_CLASS = "bg-[#f7f3ef]/15";
const MUSIC_NEUTRAL_PROGRESS_FILL_CLASS = "bg-[#FF0000]";
const MUSIC_NEUTRAL_ACTION_BG_CLASS = "bg-[#f7f3ef]";
const MUSIC_NEUTRAL_ACTION_TEXT_CLASS = "text-[#0f0f0f]";
const YOUTUBE_LOGO_CLASS = "text-[#FF0000]";
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
  if (typeof window === "undefined") {
    return { left: position.x, top: position.y };
  }

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

/** Load the YouTube IFrame Player API script exactly once. */
function loadYouTubeApi(): Promise<void> {
  const w = window as any;
  if (w.YT?.Player) return Promise.resolve();
  if (ytApiPromise) return ytApiPromise;
  ytApiPromise = new Promise<void>((resolve) => {
    const prev = w.onYouTubeIframeAPIReady;
    w.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve();
    };
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
  });
  return ytApiPromise;
}

/**
 * Embedded player for Music DJ's YouTube mode. Listens for the agent's "play"
 * intent in the agent store, resolves the search query to a video server-side,
 * and plays it in an in-app IFrame player. No OAuth, no external device.
 */
export function YouTubePlayer({ mobile = false }: { mobile?: boolean } = {}) {
  const youtubePlay = useAgentStore((s) => s.youtubePlay);
  const youtubeVolume = useAgentStore((s) => s.youtubeVolume);
  const clearYoutube = useAgentStore((s) => s.clearYoutube);
  const playerVolume = useUIStore((s) => s.youtubePlayerVolume);
  const setPlayerVolume = useUIStore((s) => s.setYoutubePlayerVolume);
  const musicPlayerActive = useUIStore((s) => s.musicPlayerEnabled && s.musicPlayerSource === "youtube");
  const collapsed = useUIStore((s) => s.spotifyMobileWidgetCollapsed);
  const setCollapsed = useUIStore((s) => s.setSpotifyMobileWidgetCollapsed);
  const mobilePosition = useUIStore((s) => s.spotifyMobileWidgetPosition);
  const setMobilePosition = useUIStore((s) => s.setSpotifyMobileWidgetPosition);
  const desktopViewport = useMediaQuery("(min-width: 768px)");

  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const lastNonceRef = useRef(0);
  const lastQueryRef = useRef("");
  const volumeRef = useRef<number | null>(null);
  const prevVolumeRef = useRef(70);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  const [nowPlaying, setNowPlaying] = useState<{
    title: string;
    mood: string;
    channel: string;
    thumbnail: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [showVideo, setShowVideo] = useState(false);

  volumeRef.current = playerVolume;
  const active = musicPlayerActive && (mobile || desktopViewport);

  /** Create the IFrame player on first use (idempotent). */
  const ensurePlayer = useCallback(async () => {
    if (playerRef.current) return playerRef.current;
    await loadYouTubeApi();
    const w = window as any;
    const inner = document.createElement("div"); // YT replaces this node; React never tracks it
    hostRef.current?.appendChild(inner);
    return await new Promise<YTPlayer>((resolve) => {
      const player: YTPlayer = new w.YT.Player(inner, {
        width: "246",
        height: "138",
        playerVars: { autoplay: 1, playsinline: 1, modestbranding: 1, rel: 0 },
        events: {
          onReady: () => {
            if (volumeRef.current != null) player.setVolume(volumeRef.current);
            playerRef.current = player;
            resolve(player);
          },
          onStateChange: (e: { data: number }) => {
            // 1 = playing, 2 = paused, 0 = ended
            if (e.data === 1) setPaused(false);
            if (e.data === 2) setPaused(true);
            // Loop the current track until the DJ picks a new one.
            if (e.data === 0) {
              player.seekTo(0, true);
              player.playVideo();
            }
          },
        },
      });
    });
  }, []);

  // React to a new "play" intent.
  useEffect(() => {
    if (!active) return; // player disabled or handled by the other viewport instance
    if (!youtubePlay) return;
    if (youtubePlay.nonce === lastNonceRef.current) return;
    lastNonceRef.current = youtubePlay.nonce;
    const query = youtubePlay.searchQuery;
    // Skip if the DJ asked for the same track again — don't restart playback.
    if (query === lastQueryRef.current && playerRef.current) return;

    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.get<{ results: SearchResult[] }>(`/youtube/search?q=${encodeURIComponent(query)}`);
        const top = res.results?.[0];
        if (!top) {
          if (!cancelled) setError(`No YouTube results for "${query}"`);
          return;
        }
        const player = await ensurePlayer();
        if (cancelled) return;
        lastQueryRef.current = query;
        player.loadVideoById(top.videoId);
        if (volumeRef.current != null) player.setVolume(volumeRef.current);
        setNowPlaying({
          title: top.title,
          mood: youtubePlay.mood,
          channel: top.channel,
          thumbnail: top.thumbnail,
        });
        setPaused(false);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "YouTube playback failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [youtubePlay, ensurePlayer, active]);

  // Stop playback immediately if the user disables the player mid-track.
  useEffect(() => {
    if (active) return;
    try {
      playerRef.current?.stopVideo();
    } catch {
      /* ignore */
    }
    lastQueryRef.current = "";
    setNowPlaying(null);
  }, [active]);

  // When the DJ picks a volume, fold it into the user-facing player volume so the
  // slider stays the single source of truth (the effect below applies it to the player).
  useEffect(() => {
    if (youtubeVolume != null) setPlayerVolume(youtubeVolume);
  }, [youtubeVolume, setPlayerVolume]);

  // Apply the user-facing volume to the player without changing the track.
  useEffect(() => {
    playerRef.current?.setVolume(playerVolume);
  }, [playerVolume]);

  // Remember the last audible volume so unmute can restore it, whether the user
  // muted via the button or dragged the slider all the way to zero.
  useEffect(() => {
    if (playerVolume > 0) prevVolumeRef.current = playerVolume;
  }, [playerVolume]);

  // Clean up the player on unmount.
  useEffect(() => {
    return () => {
      try {
        playerRef.current?.destroy();
      } catch {
        /* ignore */
      }
      playerRef.current = null;
    };
  }, []);

  const togglePlay = () => {
    const player = playerRef.current;
    if (!player) return;
    if (paused) player.playVideo();
    else player.pauseVideo();
  };

  const close = () => {
    try {
      playerRef.current?.stopVideo();
    } catch {
      /* ignore */
    }
    lastQueryRef.current = "";
    setNowPlaying(null);
    setError(null);
    clearYoutube();
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
      dragRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        originX: mobilePosition.x,
        originY: mobilePosition.y,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [mobile, mobilePosition.x, mobilePosition.y],
  );

  const moveDrag = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
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
      if (moved < 6 && mobile && collapsed) setCollapsed(false);
    },
    [collapsed, mobile, setCollapsed],
  );

  const hasPlayerContent = !!nowPlaying || loading || !!error;
  const displayTitle = loading ? "Finding a track..." : error ? error : (nowPlaying?.title ?? "YouTube");
  const displaySubtitle = loading
    ? "Searching YouTube"
    : error
      ? "Playback needs attention"
      : (nowPlaying?.channel ?? nowPlaying?.mood ?? "Ready for Music DJ");
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
        className="h-1.5 w-full cursor-pointer accent-[#FF0000]"
        title="Volume"
        aria-label="YouTube volume"
      />
    </div>
  );

  const compactBody = (
    <>
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <MusicSourceButton source="youtube" className={cn(MUSIC_NEUTRAL_BORDER_CLASS, MUSIC_NEUTRAL_BUTTON_BG_CLASS)} />
        <div
          className={cn(
            "flex h-7 w-10 shrink-0 items-center justify-center overflow-hidden rounded-[0.375rem] ring-1",
            MUSIC_NEUTRAL_TILE_BG_CLASS,
            "ring-[#f7f3ef]/10",
          )}
        >
          {loading ? (
            <Loader2 size="0.875rem" className={cn("animate-spin", MUSIC_NEUTRAL_MUTED_CLASS)} />
          ) : nowPlaying?.thumbnail ? (
            <img src={nowPlaying.thumbnail} alt="" className="h-full w-full object-cover" />
          ) : (
            <Play size="0.875rem" className={cn("translate-x-px", MUSIC_NEUTRAL_MUTED_CLASS)} />
          )}
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
            "inline-flex h-7 w-7 items-center justify-center rounded-full shadow-[0_1px_8px_rgba(255,255,255,0.18)] transition-transform hover:scale-105 active:scale-95",
            MUSIC_NEUTRAL_ACTION_BG_CLASS,
            MUSIC_NEUTRAL_ACTION_TEXT_CLASS,
          )}
          aria-label={paused ? "Play" : "Pause"}
        >
          {paused ? <Play size="0.8125rem" className="translate-x-px" /> : <Pause size="0.8125rem" />}
        </button>
      )}
      {hasPlayerContent && (
        <button
          type="button"
          onClick={() => setShowVideo((v) => !v)}
          className={cn(
            "inline-flex h-7 w-7 items-center justify-center rounded-full transition-colors active:scale-90",
            MUSIC_NEUTRAL_ICON_CLASS,
            MUSIC_NEUTRAL_ICON_HOVER_CLASS,
          )}
          aria-label={showVideo ? "Hide video" : "Show video"}
        >
          {showVideo ? <ChevronUp size="0.8125rem" /> : <ChevronDown size="0.8125rem" />}
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

  const videoPanel = (
    <div
      className={cn(
        "fixed top-14 z-40 w-[calc(100vw-1rem)] max-w-80 overflow-hidden rounded-xl border shadow-[0_18px_50px_rgba(0,0,0,0.35)] transition-opacity",
        MUSIC_NEUTRAL_SHELL_BORDER_CLASS,
        MUSIC_NEUTRAL_SHELL_BG_CLASS,
        active && hasPlayerContent && showVideo ? "left-2 opacity-100" : "pointer-events-none -left-[9999px] opacity-0",
      )}
    >
      {/* The IFrame player lives here; YT injects the iframe into this host. */}
      <div ref={hostRef} className="aspect-video w-full bg-black [&_iframe]:size-full" />
      {(nowPlaying || error) && (
        <div className="px-3 py-2">
          {error ? (
            <div className="text-xs text-[var(--destructive)]">{error}</div>
          ) : (
            <div className="min-w-0">
              <div className={cn("truncate text-xs font-medium", MUSIC_NEUTRAL_TEXT_CLASS)} title={nowPlaying?.title}>
                {nowPlaying?.title}
              </div>
              {nowPlaying?.mood && (
                <div className={cn("truncate text-[11px]", MUSIC_NEUTRAL_MUTED_CLASS)}>{nowPlaying.mood}</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );

  if (mobile) {
    return (
      <>
        {active && (
          <div
            className="fixed z-[60] md:hidden"
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
                <MusicSourceGlyph source="youtube" className={cn("h-5 w-5", YOUTUBE_LOGO_CLASS)} />
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
                    YouTube
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
        {videoPanel}
      </>
    );
  }

  return (
    <>
      {/* Compact mini-player pill — lives in the top bar (upper-left), like Spotify's. */}
      {active && (
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
                "h-full rounded-full",
                MUSIC_NEUTRAL_PROGRESS_FILL_CLASS,
                hasPlayerContent && !paused ? "w-full opacity-80" : "w-8 opacity-50",
              )}
            />
          </div>
        </div>
      )}

      {videoPanel}
    </>
  );
}

export function YouTubeMobileWidget() {
  const enabled = useUIStore((s) => s.musicPlayerEnabled && s.musicPlayerSource === "youtube");
  const isMobileViewport = useMediaQuery("(max-width: 767px)");

  if (!enabled || !isMobileViewport) return null;

  return <YouTubePlayer mobile />;
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
