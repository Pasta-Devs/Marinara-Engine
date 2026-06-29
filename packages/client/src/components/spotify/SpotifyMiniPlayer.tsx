// ──────────────────────────────────────────────
// Spotify: Global Mini Player
// ──────────────────────────────────────────────
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  GripVertical,
  Laptop,
  Loader2,
  Music2,
  Pause,
  Play,
  Repeat1,
  Repeat2,
  Settings,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  X,
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
import { toast } from "sonner";
import { api, ApiError } from "../../lib/api-client";
import {
  SPOTIFY_SCENE_TRACK_CHANGE_EVENT,
  SPOTIFY_SCENE_TRACK_CHANGE_SUPPRESS_MS,
  type SpotifySceneTrackChangeDetail,
} from "../../lib/spotify-playback-events";
import { cn } from "../../lib/utils";
import { useUIStore } from "../../stores/ui.store";
import { MusicSourceButton } from "../music/MusicSourceButton";

type SpotifyRepeatState = "off" | "track" | "context";

type SpotifyPlaybackState = {
  connected: boolean;
  active: boolean;
  isPlaying?: boolean;
  shuffle?: boolean;
  smartShuffle?: boolean;
  repeat?: SpotifyRepeatState;
  progressMs?: number | null;
  durationMs?: number | null;
  item?: {
    name: string;
    artists: string[];
    album: string | null;
    imageUrl: string | null;
    uri: string | null;
  } | null;
  device?: {
    id: string | null;
    name: string;
    type: string | null;
    volume: number | null;
    isActive: boolean;
  } | null;
};

type SpotifyDevicesState = {
  devices: Array<{
    id: string | null;
    name: string;
    type: string | null;
    volume: number | null;
    isActive: boolean;
  }>;
};

type SpotifyAccessTokenResponse = {
  accessToken: string;
  expiresAt: number;
  hasStreamingScope: boolean;
};

type SpotifyStatusResponse = {
  connected: boolean;
  expired: boolean;
  agentId: string | null;
  clientId: string | null;
  redirectUri: string;
  scopes: string[];
  missingScopes: string[];
  hasStreamingScope: boolean;
};

type DjMariPlaylistResponse = {
  success: true;
  name: string;
  playlistUrl: string | null;
  requestedTrackCount: number;
  trackCount: number;
  playbackStarted?: boolean;
  playbackError?: string | null;
};

type SpotifyControlAction =
  | { type: "play"; deviceId?: string | null; shouldTransfer?: boolean; uri?: string | null }
  | { type: "pause"; deviceId?: string | null }
  | { type: "next"; deviceId?: string | null }
  | { type: "previous"; deviceId?: string | null }
  | { type: "transfer"; deviceId: string; play?: boolean }
  | { type: "shuffle"; enabled: boolean; deviceId?: string | null }
  | { type: "repeat"; state: SpotifyRepeatState; deviceId?: string | null };

type SpotifyVolumeAction = {
  volume: number;
  deviceId?: string | null;
};

type SpotifyWebPlaybackPlayer = {
  connect: () => Promise<boolean>;
  disconnect: () => void;
  activateElement?: () => Promise<void>;
  addListener: (event: string, callback: (payload: Record<string, unknown>) => void) => boolean;
  removeListener: (event: string) => boolean;
};

type RangeCssProperties = CSSProperties & Record<`--${string}`, string | number>;

declare global {
  interface Window {
    onSpotifyWebPlaybackSDKReady?: () => void;
    Spotify?: {
      Player: new (options: {
        name: string;
        getOAuthToken: (callback: (token: string) => void) => void;
        volume?: number;
      }) => SpotifyWebPlaybackPlayer;
    };
  }
}

const spotifyKeys = {
  status: ["spotify", "status"] as const,
  player: ["spotify", "player"] as const,
  devices: ["spotify", "devices"] as const,
};

const SPOTIFY_GREEN_CLASS = "text-[#1DB954]";
const SPOTIFY_GREEN_BG_CLASS = "bg-[#1DB954]";
const MUSIC_PLAYER_SHELL_BORDER_CLASS = "border-[var(--marinara-music-player-shell-border)]";
const MUSIC_PLAYER_SHELL_BG_CLASS = "bg-[var(--marinara-music-player-shell-bg)]";
const MUSIC_PLAYER_BORDER_CLASS = "border-[#f7f3ef]/15";
const MUSIC_PLAYER_BUTTON_BG_CLASS = "bg-[#f7f3ef]/5";
const MUSIC_PLAYER_TILE_BG_CLASS = "bg-[#f7f3ef]/5";
const MUSIC_PLAYER_TILE_RING_CLASS = "ring-[#f7f3ef]/10";
const MUSIC_PLAYER_TEXT_CLASS = "text-[#f7f3ef]";
const MUSIC_PLAYER_MUTED_CLASS = "text-[#b3b3b3]";
const MUSIC_PLAYER_ICON_CLASS = "text-[#b3b3b3]";
const MUSIC_PLAYER_ICON_HOVER_CLASS = "hover:bg-[#f7f3ef]/10 hover:text-[#f7f3ef]";
const MUSIC_PLAYER_ACTION_BG_CLASS = "bg-[#f7f3ef]";
const MUSIC_PLAYER_ACTION_TEXT_CLASS = "text-[#191414]";
const MUSIC_PLAYER_PROGRESS_BG_CLASS = "bg-[#f7f3ef]/15";
const REPEAT_TRACK_END_GRACE_MS = 15_000;
const REPEAT_TRACK_REPLAY_COOLDOWN_MS = 8_000;
const MANUAL_CONTROL_REPEAT_SUPPRESS_MS = 15_000;
const DJ_MARI_PLAYLIST_READY_TOAST_MS = 20_000;
const DOTTOR_SUPPORT_GIF = "/sprites/dottore/dottore_jumping.gif";
const MOBILE_WIDGET_COLLAPSED_SIZE = 48;
const MOBILE_WIDGET_EXPANDED_MAX_WIDTH = 320;
const MOBILE_WIDGET_EXPANDED_HORIZONTAL_GUTTER = 24;
const MOBILE_WIDGET_EXPANDED_HEIGHT = 132;
const MOBILE_WIDGET_VIEWPORT_PADDING = 8;
const SPOTIFY_VOLUME_UNSUPPORTED_MESSAGE =
  "This Spotify device does not allow remote volume control. Use the device volume buttons instead.";

let spotifySdkPromise: Promise<void> | null = null;

function loadSpotifySdk(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.Spotify?.Player) return Promise.resolve();
  if (spotifySdkPromise) return spotifySdkPromise;

  spotifySdkPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>("script[data-marinara-spotify-sdk]");
    window.onSpotifyWebPlaybackSDKReady = () => resolve();
    if (existing) return;

    const script = document.createElement("script");
    script.src = "https://sdk.scdn.co/spotify-player.js";
    script.async = true;
    script.dataset.marinaraSpotifySdk = "true";
    script.onerror = () => reject(new Error("Spotify Web Playback SDK failed to load."));
    document.body.appendChild(script);
  });

  return spotifySdkPromise;
}

function formatArtists(artists: string[] | undefined) {
  return artists?.filter(Boolean).join(", ") || "Spotify";
}

function getNextRepeatState(state: SpotifyRepeatState | undefined): SpotifyRepeatState {
  if (state === "context") return "track";
  if (state === "track") return "off";
  return "context";
}

function getShuffleTitle(shuffle: boolean) {
  if (shuffle) return "Shuffle on";
  return "Shuffle off";
}

function isBrowserSpotifyDeviceName(name: string | null | undefined): boolean {
  return name === "Marinara Engine";
}

function isPersonalMobileSpotifyDeviceType(type: string | null | undefined): boolean {
  const normalized = type?.toLowerCase() ?? "";
  return normalized === "smartphone" || normalized === "tablet";
}

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
  viewportWidth?: number,
  viewportHeight?: number,
): Pick<CSSProperties, "left" | "top"> {
  if (typeof window === "undefined") {
    return { left: position.x, top: position.y };
  }
  const width = viewportWidth ?? window.innerWidth;
  const height = viewportHeight ?? window.innerHeight;

  return {
    left: Math.max(
      MOBILE_WIDGET_VIEWPORT_PADDING,
      Math.min(width - MOBILE_WIDGET_COLLAPSED_SIZE - MOBILE_WIDGET_VIEWPORT_PADDING, position.x),
    ),
    top: Math.max(
      MOBILE_WIDGET_VIEWPORT_PADDING,
      Math.min(
        height - (collapsed ? MOBILE_WIDGET_COLLAPSED_SIZE : MOBILE_WIDGET_EXPANDED_HEIGHT) - MOBILE_WIDGET_VIEWPORT_PADDING,
        position.y,
      ),
    ),
  };
}

function getMobileExpandedPanelStyle(
  position: { x: number; y: number },
  viewportWidth?: number,
): CSSProperties {
  if (typeof window === "undefined") return {};
  const availableWidth = viewportWidth ?? window.innerWidth;

  const width = Math.min(
    MOBILE_WIDGET_EXPANDED_MAX_WIDTH,
    availableWidth - MOBILE_WIDGET_EXPANDED_HORIZONTAL_GUTTER,
  );
  const opensLeft =
    position.x + width > availableWidth - MOBILE_WIDGET_VIEWPORT_PADDING ||
    position.x + MOBILE_WIDGET_COLLAPSED_SIZE / 2 > availableWidth / 2;
  const preferredLeft = opensLeft ? position.x + MOBILE_WIDGET_COLLAPSED_SIZE - width : position.x;
  const clampedLeft = Math.max(
    MOBILE_WIDGET_VIEWPORT_PADDING,
    Math.min(availableWidth - width - MOBILE_WIDGET_VIEWPORT_PADDING, preferredLeft),
  );

  return {
    width,
    transform: `translateX(${Math.round(clampedLeft - position.x)}px)`,
  };
}

function isSpotifyVolumeUnsupportedError(error: unknown): boolean {
  if (error instanceof ApiError) {
    const payload = error.payload;
    if (payload && typeof payload === "object" && "code" in payload && payload.code === "SPOTIFY_VOLUME_UNSUPPORTED") {
      return true;
    }
  }
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /cannot\s+control\s+device\s+volume|does not allow remote volume control/i.test(message);
}

function isSpotifyRestrictionError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /restriction\s+violated/i.test(message);
}

export function SpotifyMiniPlayer({
  mobile = false,
  forceFloating = false,
}: {
  mobile?: boolean;
  forceFloating?: boolean;
}) {
  const qc = useQueryClient();
  const enabled = useUIStore((s) => s.musicPlayerEnabled && s.musicPlayerSource === "spotify");
  const openRightPanel = useUIStore((s) => s.openRightPanel);
  const openAgentDetail = useUIStore((s) => s.openAgentDetail);
  const collapsed = useUIStore((s) => s.spotifyMobileWidgetCollapsed);
  const setCollapsed = useUIStore((s) => s.setSpotifyMobileWidgetCollapsed);
  const mobilePosition = useUIStore((s) => s.spotifyMobileWidgetPosition);
  const setMobilePosition = useUIStore((s) => s.setSpotifyMobileWidgetPosition);
  const [sdkDeviceId, setSdkDeviceId] = useState<string | null>(null);
  const [sdkError, setSdkError] = useState<string | null>(null);
  const [browserPlaybackRequested, setBrowserPlaybackRequested] = useState(false);
  const [volumeDraft, setVolumeDraft] = useState(50);
  const [volumeUnsupportedDeviceKey, setVolumeUnsupportedDeviceKey] = useState<string | null>(null);
  const [viewport, setViewport] = useState(() => ({
    w: typeof window === "undefined" ? 0 : window.innerWidth,
    h: typeof window === "undefined" ? 0 : window.innerHeight,
  }));
  const previousVolumeRef = useRef(50);
  const previousPlaybackRef = useRef<SpotifyPlaybackState | null>(null);
  const repeatReplayRef = useRef<{ key: string; at: number } | null>(null);
  const suppressRepeatRecoveryUntilRef = useRef(0);
  const djMariToastRef = useRef<string | number | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);
  const floating = mobile || forceFloating;
  const wasForceFloatingRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let frame = 0;
    const updateViewport = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        frame = 0;
        setViewport({ w: window.innerWidth, h: window.innerHeight });
      });
    };
    updateViewport();
    window.addEventListener("resize", updateViewport);
    window.addEventListener("orientationchange", updateViewport);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("resize", updateViewport);
      window.removeEventListener("orientationchange", updateViewport);
    };
  }, []);

  const statusQuery = useQuery({
    queryKey: spotifyKeys.status,
    queryFn: () => api.get<SpotifyStatusResponse>("/spotify/status"),
    enabled,
    staleTime: 10_000,
    refetchInterval: 30_000,
    retry: false,
  });
  const spotifyConnected = statusQuery.data?.connected === true && statusQuery.data.expired !== true;
  const spotifyStreamingAvailable = spotifyConnected && statusQuery.data?.hasStreamingScope === true;

  const playerQuery = useQuery({
    queryKey: spotifyKeys.player,
    queryFn: () => api.get<SpotifyPlaybackState>("/spotify/player"),
    enabled: enabled && spotifyConnected,
    staleTime: 2_000,
    refetchInterval: 5_000,
    retry: false,
  });

  const devicesQuery = useQuery({
    queryKey: spotifyKeys.devices,
    queryFn: () => api.get<SpotifyDevicesState>("/spotify/devices"),
    enabled: enabled && spotifyConnected && mobile,
    staleTime: 2_000,
    refetchInterval: 5_000,
    retry: false,
  });

  const player = playerQuery.data;
  const preferredMobileDevice = useMemo(() => {
    if (!mobile) return null;
    const mobileDevices = (devicesQuery.data?.devices ?? []).filter(
      (device) =>
        !!device.id && !isBrowserSpotifyDeviceName(device.name) && isPersonalMobileSpotifyDeviceType(device.type),
    );
    return mobileDevices.find((device) => device.isActive) ?? mobileDevices[0] ?? null;
  }, [devicesQuery.data?.devices, mobile]);
  const playerDeviceIsBrowser = isBrowserSpotifyDeviceName(player?.device?.name);
  const playerDeviceIsMobile = isPersonalMobileSpotifyDeviceType(player?.device?.type);
  const controlDeviceId =
    mobile && preferredMobileDevice?.id
      ? preferredMobileDevice.id
      : mobile && (!playerDeviceIsMobile || playerDeviceIsBrowser)
        ? undefined
        : (player?.device?.id ?? undefined);
  const controlDevice =
    mobile && preferredMobileDevice
      ? preferredMobileDevice
      : mobile && !playerDeviceIsMobile
        ? null
        : (player?.device ?? null);
  const item = player?.item ?? null;
  const deviceVolume = controlDevice?.volume;
  const volumeDeviceId = mobile ? controlDeviceId : (sdkDeviceId ?? player?.device?.id ?? undefined);
  const volumeDeviceKey = volumeDeviceId ?? controlDevice?.name ?? null;
  const volumeControlUnsupported =
    !!controlDevice &&
    (typeof deviceVolume !== "number" || (!!volumeDeviceKey && volumeUnsupportedDeviceKey === volumeDeviceKey));

  useEffect(() => {
    if (forceFloating && !wasForceFloatingRef.current) setCollapsed(true);
    wasForceFloatingRef.current = forceFloating;
  }, [forceFloating, setCollapsed]);

  useEffect(() => {
    if (!controlDevice) {
      setVolumeUnsupportedDeviceKey(null);
      return;
    }

    if (typeof deviceVolume !== "number") {
      if (volumeDeviceKey) setVolumeUnsupportedDeviceKey(volumeDeviceKey);
      return;
    }

    setVolumeUnsupportedDeviceKey((current) => (current === volumeDeviceKey ? null : current));
    setVolumeDraft(deviceVolume);
    if (deviceVolume > 0) previousVolumeRef.current = deviceVolume;
  }, [controlDevice, deviceVolume, volumeDeviceKey]);

  useEffect(() => {
    if (!enabled || mobile || !browserPlaybackRequested || !spotifyStreamingAvailable) return;
    let disposed = false;
    let sdkPlayer: SpotifyWebPlaybackPlayer | null = null;

    void loadSpotifySdk()
      .then(() => {
        if (disposed || !window.Spotify?.Player) return;
        sdkPlayer = new window.Spotify.Player({
          name: "Marinara Engine",
          volume: 0.5,
          getOAuthToken: (callback) => {
            void api
              .get<SpotifyAccessTokenResponse>("/spotify/access-token")
              .then((token) => {
                if (!token.hasStreamingScope) {
                  setSdkError("Reconnect Spotify to enable in-app playback.");
                }
                callback(token.accessToken);
              })
              .catch(() => callback(""));
          },
        });
        sdkPlayer.addListener("ready", (payload) => {
          const deviceId = typeof payload.device_id === "string" ? payload.device_id : null;
          if (!deviceId) return;
          setSdkDeviceId(deviceId);
          setSdkError(null);
        });
        sdkPlayer.addListener("not_ready", (payload) => {
          const deviceId = typeof payload.device_id === "string" ? payload.device_id : null;
          setSdkDeviceId((current) => (current === deviceId ? null : current));
        });
        sdkPlayer.addListener("account_error", () => setSdkError("Spotify Premium is required for in-app playback."));
        sdkPlayer.addListener("authentication_error", () =>
          setSdkError("Reconnect Spotify to refresh playback access."),
        );
        sdkPlayer.addListener("playback_error", () => setSdkError("Spotify playback failed."));
        sdkPlayer.addListener("player_state_changed", () => {
          void qc.invalidateQueries({ queryKey: spotifyKeys.player });
        });
        return sdkPlayer.connect();
      })
      .catch((err) => setSdkError(err instanceof Error ? err.message : "Spotify SDK failed."));

    return () => {
      disposed = true;
      if (sdkPlayer) {
        sdkPlayer.removeListener("ready");
        sdkPlayer.removeListener("not_ready");
        sdkPlayer.removeListener("account_error");
        sdkPlayer.removeListener("authentication_error");
        sdkPlayer.removeListener("playback_error");
        sdkPlayer.removeListener("player_state_changed");
        sdkPlayer.disconnect();
      }
    };
  }, [browserPlaybackRequested, enabled, mobile, qc, spotifyStreamingAvailable]);

  const invalidate = useCallback(() => {
    void qc.invalidateQueries({ queryKey: spotifyKeys.player });
  }, [qc]);

  const runControl = useMutation({
    mutationFn: async (action: SpotifyControlAction) => {
      if (action.type === "pause") return api.put("/spotify/player/pause", { deviceId: action.deviceId ?? undefined });
      if (action.type === "play") {
        if (action.shouldTransfer && action.deviceId) {
          await api.put("/spotify/player/transfer", { deviceId: action.deviceId, play: true }).catch(() => undefined);
        }
        return api.put("/spotify/player/play", {
          deviceId: action.deviceId ?? undefined,
          uri: action.uri ?? undefined,
        });
      }
      if (action.type === "next") return api.post("/spotify/player/next", { deviceId: action.deviceId ?? undefined });
      if (action.type === "previous") {
        return api.post("/spotify/player/previous", { deviceId: action.deviceId ?? undefined });
      }
      if (action.type === "transfer") {
        return api.put("/spotify/player/transfer", { deviceId: action.deviceId, play: action.play === true });
      }
      if (action.type === "shuffle") {
        return api.put("/spotify/player/shuffle", { enabled: action.enabled, deviceId: action.deviceId ?? undefined });
      }
      return api.put("/spotify/player/repeat", { state: action.state, deviceId: action.deviceId ?? undefined });
    },
    onMutate: async (action) => {
      if (
        action.type === "pause" ||
        action.type === "next" ||
        action.type === "previous" ||
        action.type === "transfer" ||
        (action.type === "repeat" && action.state !== "track")
      ) {
        suppressRepeatRecoveryUntilRef.current = Date.now() + MANUAL_CONTROL_REPEAT_SUPPRESS_MS;
      }
      await qc.cancelQueries({ queryKey: spotifyKeys.player });
      const previous = qc.getQueryData<SpotifyPlaybackState>(spotifyKeys.player);
      qc.setQueryData<SpotifyPlaybackState>(spotifyKeys.player, (current) => {
        if (!current) return current;
        if (action.type === "play") return { ...current, active: true, isPlaying: true };
        if (action.type === "pause") return { ...current, isPlaying: false };
        if (action.type === "shuffle") return { ...current, shuffle: action.enabled, smartShuffle: false };
        if (action.type === "repeat") return { ...current, repeat: action.state };
        return current;
      });
      return { previous };
    },
    onSuccess: (_data, action) => {
      if (action.type === "repeat" || action.type === "shuffle") {
        window.setTimeout(invalidate, 750);
        return;
      }
      invalidate();
    },
    onError: (error, _action, context) => {
      if (context?.previous) qc.setQueryData(spotifyKeys.player, context.previous);
      if (isSpotifyRestrictionError(error)) {
        toast.info("Spotify rejected that command on the current device. Open the Spotify app and try again.");
        return;
      }
      toast.error(error instanceof Error ? error.message : "Spotify control failed.");
    },
  });

  const setVolume = useMutation({
    mutationFn: (action: SpotifyVolumeAction) =>
      api.put("/spotify/player/volume", { volume: action.volume, deviceId: action.deviceId ?? undefined }),
    onMutate: async (action) => {
      await qc.cancelQueries({ queryKey: spotifyKeys.player });
      const previous = qc.getQueryData<SpotifyPlaybackState>(spotifyKeys.player);
      qc.setQueryData<SpotifyPlaybackState>(spotifyKeys.player, (current) => {
        if (!current?.device) return current;
        return { ...current, device: { ...current.device, volume: action.volume } };
      });
      return { previous };
    },
    onSuccess: invalidate,
    onError: (error, volume, context) => {
      if (context?.previous) qc.setQueryData(spotifyKeys.player, context.previous);
      if (isSpotifyVolumeUnsupportedError(error)) {
        const key = volume.deviceId ?? player?.device?.name ?? null;
        if (key) setVolumeUnsupportedDeviceKey(key);
        toast.info(SPOTIFY_VOLUME_UNSUPPORTED_MESSAGE);
        return;
      }
      toast.error(error instanceof Error ? error.message : "Spotify volume failed.");
    },
  });

  const dismissDjMariToast = useCallback(() => {
    if (djMariToastRef.current !== null) {
      toast.dismiss(djMariToastRef.current);
      djMariToastRef.current = null;
    }
  }, []);

  const showDjMariToast = useCallback(() => {
    dismissDjMariToast();
    djMariToastRef.current = toast.custom(
      () => (
        <div className="flex max-w-[22rem] items-center gap-3 pr-1 text-[var(--foreground)]">
          <img
            src={DOTTOR_SUPPORT_GIF}
            alt=""
            className="h-14 w-14 shrink-0 rounded-lg object-contain"
            draggable={false}
          />
          <p className="text-sm font-medium leading-snug">DJ Mari is composing a playlist for you, hold on tight!</p>
          <button
            type="button"
            onClick={dismissDjMariToast}
            className="rounded-full p-1 text-foreground/45 transition-colors hover:bg-foreground/10 hover:text-foreground"
            aria-label="Dismiss DJ Mari playlist toast"
          >
            <X size="0.75rem" />
          </button>
        </div>
      ),
      { duration: Infinity, position: "bottom-right" },
    );
  }, [dismissDjMariToast]);

  useEffect(() => {
    if (!enabled) return;
    const handleSceneTrackChange = (event: Event) => {
      const detail = (event as CustomEvent<SpotifySceneTrackChangeDetail>).detail;
      if (!detail?.uri) return;
      suppressRepeatRecoveryUntilRef.current = Date.now() + SPOTIFY_SCENE_TRACK_CHANGE_SUPPRESS_MS;
      repeatReplayRef.current = null;
      previousPlaybackRef.current = null;
    };

    window.addEventListener(SPOTIFY_SCENE_TRACK_CHANGE_EVENT, handleSceneTrackChange);
    return () => window.removeEventListener(SPOTIFY_SCENE_TRACK_CHANGE_EVENT, handleSceneTrackChange);
  }, [enabled]);

  const createDjMariPlaylist = useMutation({
    mutationFn: () =>
      api.post<DjMariPlaylistResponse>("/spotify/dj-mari-playlist", {
        deviceId: mobile ? controlDeviceId : (sdkDeviceId ?? player?.device?.id ?? undefined),
      }),
    onMutate: showDjMariToast,
    onSuccess: (result) => {
      dismissDjMariToast();
      invalidate();
      toast.success("DJ Mari playlist is ready", {
        description: `${result.name} - ${result.trackCount} tracks`,
        duration: DJ_MARI_PLAYLIST_READY_TOAST_MS,
        action: result.playlistUrl
          ? {
              label: "Open playlist",
              onClick: () => window.open(result.playlistUrl!, "_blank", "noopener,noreferrer"),
            }
          : undefined,
      });
      if (result.playbackStarted === false) {
        toast.warning(result.playbackError ?? "Playlist created, but Spotify did not start playback.");
      }
    },
    onError: (error) => {
      dismissDjMariToast();
      toast.error(error instanceof Error ? error.message : "DJ Mari could not create the playlist.");
    },
  });

  const handlePlayPause = useCallback(async () => {
    if (runControl.isPending) return;
    if (player?.isPlaying) {
      runControl.mutate({ type: "pause", deviceId: controlDeviceId });
      return;
    }
    runControl.mutate({
      type: "play",
      deviceId: mobile ? controlDeviceId : (sdkDeviceId ?? player?.device?.id ?? undefined),
      shouldTransfer: !mobile && !player?.active && !!sdkDeviceId,
    });
  }, [controlDeviceId, mobile, player?.active, player?.device?.id, player?.isPlaying, runControl, sdkDeviceId]);

  const handleMarinaraPlayerPress = useCallback(() => {
    if (sdkDeviceId) {
      runControl.mutate({ type: "transfer", deviceId: sdkDeviceId, play: player?.isPlaying === true });
      return;
    }
    if (!spotifyConnected) {
      openRightPanel("agents");
      openAgentDetail("spotify");
      return;
    }
    if (!spotifyStreamingAvailable) {
      setSdkError("Reconnect Spotify to enable in-app playback.");
      toast.info("Reconnect Spotify with the streaming scope to use Marinara as a Spotify player.");
      return;
    }
    setSdkError(null);
    setBrowserPlaybackRequested(true);
  }, [
    openAgentDetail,
    openRightPanel,
    player?.isPlaying,
    runControl,
    sdkDeviceId,
    spotifyConnected,
    spotifyStreamingAvailable,
  ]);

  const openSpotifyAgent = useCallback(() => {
    openRightPanel("agents");
    openAgentDetail("spotify");
  }, [openAgentDetail, openRightPanel]);

  const commitVolume = useCallback(() => {
    if (volumeControlUnsupported) {
      toast.info(SPOTIFY_VOLUME_UNSUPPORTED_MESSAGE);
      return;
    }
    setVolume.mutate({
      volume: Math.max(0, Math.min(100, Math.round(volumeDraft))),
      deviceId: volumeDeviceId,
    });
  }, [setVolume, volumeControlUnsupported, volumeDeviceId, volumeDraft]);

  const toggleMute = useCallback(() => {
    if (volumeControlUnsupported) {
      toast.info(SPOTIFY_VOLUME_UNSUPPORTED_MESSAGE);
      return;
    }
    const currentVolume = Math.max(0, Math.min(100, Math.round(volumeDraft)));
    const nextVolume = currentVolume > 0 ? 0 : Math.max(1, Math.min(100, Math.round(previousVolumeRef.current || 50)));
    if (currentVolume > 0) previousVolumeRef.current = currentVolume;
    setVolumeDraft(nextVolume);
    setVolume.mutate({ volume: nextVolume, deviceId: volumeDeviceId });
  }, [setVolume, volumeControlUnsupported, volumeDeviceId, volumeDraft]);

  const handleShufflePress = useCallback(
    (args: { shuffle: boolean; smartShuffle: boolean; deviceId?: string | null }) => {
      runControl.mutate({ type: "shuffle", enabled: !(args.shuffle || args.smartShuffle), deviceId: args.deviceId });
    },
    [runControl],
  );

  useEffect(() => {
    const previous = previousPlaybackRef.current;
    previousPlaybackRef.current = player ?? null;

    const repeatTrackEnabled = player?.repeat === "track" || previous?.repeat === "track";
    if (!previous || !player || !repeatTrackEnabled) return;
    if (runControl.isPending || Date.now() < suppressRepeatRecoveryUntilRef.current) return;

    const previousUri = previous.item?.uri;
    const currentUri = player.item?.uri;
    if (!previousUri || previous.isPlaying !== true) return;
    if (typeof previous.progressMs !== "number" || typeof previous.durationMs !== "number") return;
    if (previous.durationMs <= 0) return;

    const wasNearEnd = previous.durationMs - previous.progressMs <= REPEAT_TRACK_END_GRACE_MS;
    if (!wasNearEnd) return;

    const currentStoppedOnSameTrack = currentUri === previousUri && player.isPlaying === false;
    const advancedPastRepeatedTrack = !!currentUri && currentUri !== previousUri;
    const lostPlaybackAtEnd = !currentUri && player.active === false;
    if (!currentStoppedOnSameTrack && !advancedPastRepeatedTrack && !lostPlaybackAtEnd) return;

    const replayKey = `${previousUri}:${previous.durationMs}`;
    const lastReplay = repeatReplayRef.current;
    if (lastReplay?.key === replayKey && Date.now() - lastReplay.at < REPEAT_TRACK_REPLAY_COOLDOWN_MS) return;

    repeatReplayRef.current = { key: replayKey, at: Date.now() };
    runControl.mutate({
      type: "play",
      uri: previousUri,
      deviceId: player.device?.id ?? previous.device?.id ?? sdkDeviceId ?? undefined,
    });
  }, [player, runControl, sdkDeviceId]);

  const startDrag = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!floating) return;
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
        // Some mobile browsers can deny capture if the pointer was already cancelled.
      }
    },
    [floating, mobilePosition.x, mobilePosition.y],
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
      if (moved < 6 && floating && collapsed) setCollapsed(false);
    },
    [collapsed, floating, setCollapsed],
  );

  const title = item?.name ?? (!spotifyConnected ? "Spotify not connected" : "Spotify");
  const subtitle = item
    ? formatArtists(item.artists)
    : sdkError || (!spotifyConnected ? "Open Music DJ setup" : "No active playback");
  const cover = item?.imageUrl;
  const playPauseBusy =
    runControl.isPending && (runControl.variables?.type === "play" || runControl.variables?.type === "pause");
  const shuffleActive = player?.shuffle === true;
  const smartShuffleActive = player?.smartShuffle === true;
  const shuffleEnabled = shuffleActive || smartShuffleActive;
  const shuffleTitle = getShuffleTitle(shuffleEnabled);
  const repeatState = player?.repeat ?? "off";
  const RepeatIcon = repeatState === "track" ? Repeat1 : Repeat2;
  const repeatTitle =
    repeatState === "track" ? "Repeat track" : repeatState === "context" ? "Repeat playlist" : "Repeat off";
  const browserPlaybackLoading = browserPlaybackRequested && !sdkDeviceId && !sdkError;
  const canUseMarinaraPlayer =
    !mobile && spotifyConnected && (browserPlaybackLoading || !sdkDeviceId || player?.device?.id !== sdkDeviceId);
  const progressPercent =
    typeof player?.progressMs === "number" && typeof player.durationMs === "number" && player.durationMs > 0
      ? Math.max(0, Math.min(100, (player.progressMs / player.durationMs) * 100))
      : 0;
  const deviceId = controlDeviceId;
  const volumeMuted = volumeDraft <= 0;
  const VolumeIcon = volumeMuted ? VolumeX : Volume2;
  const spotifyVolumeStyle: RangeCssProperties = useMemo(
    () => ({
      "--range-progress": `${volumeDraft}%`,
      "--range-track-color": "color-mix(in srgb, #1DB954 26%, transparent)",
      "--range-fill-color": "#1DB954",
      "--range-thumb-color": "#1DB954",
      "--range-thumb-size": "0.6875rem",
      "--range-track-height": "0.25rem",
      "--range-thumb-shadow": "0 0 0 0.125rem #191414",
    }),
    [volumeDraft],
  );
  const viewportWidth = viewport.w;
  const viewportHeight = viewport.h;
  const mobileWidgetStyle = useMemo(
    () => getMobileWidgetStyle(mobilePosition, collapsed, viewportWidth, viewportHeight),
    [collapsed, mobilePosition, viewportHeight, viewportWidth],
  );
  const mobileExpandedPanelStyle = useMemo(
    () => getMobileExpandedPanelStyle(mobilePosition, viewportWidth),
    [mobilePosition, viewportWidth],
  );
  const volumeControls = useMemo(() => {
    const stopPointer = (event: ReactPointerEvent<HTMLElement>) => event.stopPropagation();

    if (volumeControlUnsupported) {
      return (
        <button
          type="button"
          className={cn(
            "flex w-full shrink-0 items-center gap-1 rounded-md px-1 py-0.5 text-left transition-colors hover:bg-[#f7f3ef]/10",
            MUSIC_PLAYER_ICON_CLASS,
            MUSIC_PLAYER_ICON_HOVER_CLASS,
          )}
          onPointerDown={stopPointer}
          onPointerMove={stopPointer}
          onPointerUp={stopPointer}
          onPointerCancel={stopPointer}
          onClick={(event) => {
            event.stopPropagation();
            toast.info(SPOTIFY_VOLUME_UNSUPPORTED_MESSAGE);
          }}
          title={SPOTIFY_VOLUME_UNSUPPORTED_MESSAGE}
        >
          <Volume2 size="0.75rem" className="shrink-0" />
          <span className="min-w-0 truncate text-[0.58rem] font-medium leading-tight">Use device volume</span>
        </button>
      );
    }

    return (
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
            MUSIC_PLAYER_ICON_CLASS,
            MUSIC_PLAYER_ICON_HOVER_CLASS,
          )}
          title={volumeMuted ? "Restore volume" : "Mute"}
        >
          <VolumeIcon size="0.75rem" />
        </button>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={volumeDraft}
          onChange={(event) => setVolumeDraft(Number(event.target.value))}
          onPointerUp={commitVolume}
          onKeyUp={commitVolume}
          onBlur={commitVolume}
          className="mari-spotify-volume-slider w-full"
          style={spotifyVolumeStyle}
          title="Volume"
        />
      </div>
    );
  }, [VolumeIcon, commitVolume, spotifyVolumeStyle, toggleMute, volumeControlUnsupported, volumeDraft, volumeMuted]);

  const compactBody = useMemo(
    () => (
      <>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <MusicSourceButton source="spotify" className={cn(MUSIC_PLAYER_BORDER_CLASS, MUSIC_PLAYER_BUTTON_BG_CLASS)} />
          <div
            className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-[0.375rem] ring-1",
              MUSIC_PLAYER_TILE_BG_CLASS,
              MUSIC_PLAYER_TILE_RING_CLASS,
            )}
          >
            {cover ? (
              <img src={cover} alt="" className="h-full w-full object-cover" />
            ) : (
              <Music2 size="0.875rem" className={SPOTIFY_GREEN_CLASS} />
            )}
          </div>
          <div className="min-w-0">
            <p className={cn("truncate text-[0.6875rem] font-semibold leading-tight", MUSIC_PLAYER_TEXT_CLASS)}>
              {title}
            </p>
            <p className={cn("truncate text-[0.5625rem] leading-tight", MUSIC_PLAYER_MUTED_CLASS)}>{subtitle}</p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={() => handleShufflePress({ shuffle: shuffleActive, smartShuffle: smartShuffleActive, deviceId })}
            className={cn(
              "relative inline-flex h-7 w-7 items-center justify-center rounded-full transition-colors",
              MUSIC_PLAYER_ICON_CLASS,
              MUSIC_PLAYER_ICON_HOVER_CLASS,
              shuffleEnabled && SPOTIFY_GREEN_CLASS,
            )}
            aria-pressed={shuffleEnabled}
            title={shuffleTitle}
          >
            <Shuffle size="0.8125rem" />
          </button>
          <button
            type="button"
            onClick={() => runControl.mutate({ type: "previous", deviceId })}
            className={cn(
              "inline-flex h-7 w-7 items-center justify-center rounded-full transition-colors",
              MUSIC_PLAYER_ICON_CLASS,
              MUSIC_PLAYER_ICON_HOVER_CLASS,
            )}
            title="Previous"
          >
            <SkipBack size="0.8125rem" />
          </button>
          <button
            type="button"
            onClick={() => void handlePlayPause()}
            className={cn(
              "inline-flex h-7 w-7 items-center justify-center rounded-full shadow-[0_1px_8px_rgba(255,255,255,0.18)] transition-transform hover:scale-105 active:scale-95",
              MUSIC_PLAYER_ACTION_BG_CLASS,
              MUSIC_PLAYER_ACTION_TEXT_CLASS,
            )}
            title={player?.isPlaying ? "Pause" : "Play"}
          >
            {playPauseBusy ? (
              <Loader2 size="0.8125rem" className="animate-spin" />
            ) : player?.isPlaying ? (
              <Pause size="0.8125rem" />
            ) : (
              <Play size="0.8125rem" className="translate-x-px" />
            )}
          </button>
          <button
            type="button"
            onClick={() => runControl.mutate({ type: "next", deviceId })}
            className={cn(
              "inline-flex h-7 w-7 items-center justify-center rounded-full transition-colors",
              MUSIC_PLAYER_ICON_CLASS,
              MUSIC_PLAYER_ICON_HOVER_CLASS,
            )}
            title="Next"
          >
            <SkipForward size="0.8125rem" />
          </button>
          <button
            type="button"
            onClick={() => runControl.mutate({ type: "repeat", state: getNextRepeatState(repeatState), deviceId })}
            className={cn(
              "inline-flex h-7 w-7 items-center justify-center rounded-full transition-colors",
              MUSIC_PLAYER_ICON_CLASS,
              MUSIC_PLAYER_ICON_HOVER_CLASS,
              repeatState !== "off" && SPOTIFY_GREEN_CLASS,
            )}
            aria-pressed={repeatState !== "off"}
            title={repeatTitle}
          >
            <RepeatIcon size="0.8125rem" />
          </button>
          <button
            type="button"
            onClick={() => createDjMariPlaylist.mutate()}
            disabled={createDjMariPlaylist.isPending}
            className={cn(
              "inline-flex h-7 min-w-7 items-center justify-center rounded-full px-1.5 text-[0.625rem] font-black leading-none transition-colors disabled:cursor-wait disabled:opacity-80",
              MUSIC_PLAYER_ICON_CLASS,
              MUSIC_PLAYER_ICON_HOVER_CLASS,
            )}
            title="DJ Mari composes a playlist for you!"
            aria-label="DJ Mari composes a playlist for you!"
          >
            {createDjMariPlaylist.isPending ? <Loader2 size="0.8125rem" className="animate-spin" /> : "DJ"}
          </button>
          {canUseMarinaraPlayer && (
            <button
              type="button"
              onClick={handleMarinaraPlayerPress}
              disabled={browserPlaybackLoading}
              className={cn(
                "hidden h-7 w-7 items-center justify-center rounded-full transition-colors disabled:cursor-wait disabled:opacity-80 sm:inline-flex",
                MUSIC_PLAYER_ICON_CLASS,
                MUSIC_PLAYER_ICON_HOVER_CLASS,
              )}
              title={sdkDeviceId ? "Use Marinara player" : "Enable Marinara player"}
            >
              {browserPlaybackLoading ? <Loader2 size="0.8125rem" className="animate-spin" /> : <Laptop size="0.8125rem" />}
            </button>
          )}
          <button
            type="button"
            onClick={openSpotifyAgent}
            className={cn(
              "inline-flex h-7 w-7 items-center justify-center rounded-full transition-colors",
              MUSIC_PLAYER_ICON_CLASS,
              MUSIC_PLAYER_ICON_HOVER_CLASS,
            )}
            title="Music DJ setup"
          >
            <Settings size="0.8125rem" />
          </button>
        </div>
      </>
    ),
    [
      browserPlaybackLoading,
      canUseMarinaraPlayer,
      cover,
      createDjMariPlaylist,
      deviceId,
      handleMarinaraPlayerPress,
      handleShufflePress,
      handlePlayPause,
      openSpotifyAgent,
      playPauseBusy,
      player?.isPlaying,
      RepeatIcon,
      repeatState,
      repeatTitle,
      runControl,
      sdkDeviceId,
      shuffleActive,
      shuffleEnabled,
      shuffleTitle,
      smartShuffleActive,
      subtitle,
      title,
    ],
  );

  if (!enabled) return null;

  if (floating) {
    return (
      <div
        className={cn("fixed z-[35] touch-none select-none", mobile && "md:hidden")}
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
              MUSIC_PLAYER_SHELL_BORDER_CLASS,
              MUSIC_PLAYER_SHELL_BG_CLASS,
              SPOTIFY_GREEN_CLASS,
            )}
          >
            <Music2 size="1.125rem" />
          </div>
        ) : (
          <div
            className={cn(
              "rounded-xl border p-2 shadow-2xl backdrop-blur-xl",
              MUSIC_PLAYER_SHELL_BORDER_CLASS,
              MUSIC_PLAYER_SHELL_BG_CLASS,
            )}
            style={mobileExpandedPanelStyle}
          >
            <div className="mb-1 flex items-center gap-1">
              <GripVertical size="0.875rem" className={MUSIC_PLAYER_ICON_CLASS} />
              <span className={cn("flex-1 truncate text-[0.625rem] font-medium", MUSIC_PLAYER_ICON_CLASS)}>
                {player?.device?.name ?? "Spotify"}
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
                className={cn("rounded-full p-1", MUSIC_PLAYER_ICON_CLASS, MUSIC_PLAYER_ICON_HOVER_CLASS)}
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
    );
  }

  return (
    <div
      className={cn(
        "relative hidden h-10 min-w-0 max-w-[31rem] flex-1 items-center gap-2 overflow-hidden rounded-full border px-2.5 md:flex",
        MUSIC_PLAYER_SHELL_BORDER_CLASS,
        MUSIC_PLAYER_SHELL_BG_CLASS,
      )}
    >
      {compactBody}
      <div className="hidden w-24 lg:flex">{volumeControls}</div>
      <div
        className={cn(
          "pointer-events-none absolute bottom-0 left-3 right-3 h-px overflow-hidden rounded-full",
          MUSIC_PLAYER_PROGRESS_BG_CLASS,
        )}
      >
        <div className={cn("h-full rounded-full", SPOTIFY_GREEN_BG_CLASS)} style={{ width: `${progressPercent}%` }} />
      </div>
    </div>
  );
}

export function SpotifyMobileWidget() {
  const enabled = useUIStore((s) => s.musicPlayerEnabled && s.musicPlayerSource === "spotify");
  const isMobileViewport = useMediaQuery("(max-width: 767px)");

  if (!enabled || !isMobileViewport) return null;

  return <SpotifyMiniPlayer mobile />;
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
