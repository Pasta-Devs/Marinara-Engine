import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Loader2, Music, Pause, Play, X } from "lucide-react";
import { useAgentStore } from "@/stores/agent.store";
import { useUIStore } from "@/stores/ui.store";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { MusicSourceButton } from "@/components/music/MusicSourceButton";

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
export function YouTubePlayer() {
  const youtubePlay = useAgentStore((s) => s.youtubePlay);
  const youtubeVolume = useAgentStore((s) => s.youtubeVolume);
  const clearYoutube = useAgentStore((s) => s.clearYoutube);
  const musicPlayerActive = useUIStore((s) => s.musicPlayerEnabled && s.musicPlayerSource === "youtube");

  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const lastNonceRef = useRef(0);
  const lastQueryRef = useRef("");
  const volumeRef = useRef<number | null>(null);

  const [nowPlaying, setNowPlaying] = useState<{ title: string; mood: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [showVideo, setShowVideo] = useState(false);

  volumeRef.current = youtubeVolume;

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
    if (!musicPlayerActive) return; // player disabled in Settings — don't fetch or play
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
        const res = await api.get<{ results: SearchResult[] }>(
          `/youtube/search?q=${encodeURIComponent(query)}`,
        );
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
        setNowPlaying({ title: top.title, mood: youtubePlay.mood });
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
  }, [youtubePlay, ensurePlayer, musicPlayerActive]);

  // Stop playback immediately if the user disables the player mid-track.
  useEffect(() => {
    if (musicPlayerActive) return;
    try {
      playerRef.current?.stopVideo();
    } catch {
      /* ignore */
    }
    lastQueryRef.current = "";
    setNowPlaying(null);
  }, [musicPlayerActive]);

  // Apply DJ volume changes without changing the track.
  useEffect(() => {
    if (youtubeVolume != null) playerRef.current?.setVolume(youtubeVolume);
  }, [youtubeVolume]);

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

  const active = musicPlayerActive;
  const hasPlayerContent = !!nowPlaying || loading || !!error;

  return (
    <>
      {/* Compact mini-player pill — lives in the top bar (upper-left), like Spotify's. */}
      {active && (
        <div className="flex h-8 min-w-0 max-w-[15rem] items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--card)] pl-1 pr-1">
          <MusicSourceButton source="youtube" className="h-6 w-6 border-[var(--border)] bg-[var(--secondary)]" />
          <span
            className="hidden min-w-0 flex-1 truncate text-xs text-[var(--foreground)] sm:inline"
            title={nowPlaying?.title ?? undefined}
          >
            {loading ? "Finding a track…" : error ? error : (nowPlaying?.title ?? "YouTube")}
          </span>
          {!loading && !nowPlaying && !error && <Music className="size-3.5 shrink-0 text-[var(--muted-foreground)] sm:hidden" />}
          {loading && (
            <Loader2 className="size-3.5 shrink-0 animate-spin text-[var(--muted-foreground)] sm:hidden" />
          )}
          {nowPlaying && (
            <button
              type="button"
              onClick={togglePlay}
              className="rounded p-1 text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)] active:scale-90"
              aria-label={paused ? "Play" : "Pause"}
            >
              {paused ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}
            </button>
          )}
          {hasPlayerContent && (
            <button
              type="button"
              onClick={() => setShowVideo((v) => !v)}
              className="rounded p-1 text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)] active:scale-90"
              aria-label={showVideo ? "Hide video" : "Show video"}
            >
              {showVideo ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
            </button>
          )}
          {hasPlayerContent && (
            <button
              type="button"
              onClick={close}
              className="rounded p-1 text-[var(--muted-foreground)] transition-colors hover:text-[var(--destructive)] active:scale-90"
              aria-label="Stop"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Video panel anchored under the top bar. ALWAYS mounted so the IFrame keeps
          playing; when collapsed it is parked offscreen (full size, never display:none)
          so audio never stops. */}
      <div
        className={cn(
          "fixed top-14 z-40 w-72 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-lg transition-opacity",
          active && hasPlayerContent && showVideo
            ? "left-2 opacity-100"
            : "pointer-events-none -left-[9999px] opacity-0",
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
                <div
                  className="truncate text-xs font-medium text-[var(--foreground)]"
                  title={nowPlaying?.title}
                >
                  {nowPlaying?.title}
                </div>
                {nowPlaying?.mood && (
                  <div className="truncate text-[11px] text-[var(--muted-foreground)]">{nowPlaying.mood}</div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
