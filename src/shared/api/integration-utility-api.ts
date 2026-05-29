import { fileToUploadPayload } from "./file-payload";
import { openExternalUrl } from "./external-link-api";
import { remoteRuntimeTarget } from "./remote-runtime";
import { invokeTauri } from "./tauri-client";

interface GifSearchResult {
  id: string;
  title: string;
  preview: string;
  url: string;
  width: number;
  height: number;
}

export interface GifSearchResponse {
  results: GifSearchResult[];
  next: string;
}

export interface SpotifyStatus {
  connected: boolean;
  expired?: boolean;
  redirectUri?: string | null;
}

export interface SpotifyAuthorizeResponse {
  authUrl?: string;
  error?: string;
  [key: string]: unknown;
}

export interface SpotifyExchangeResponse {
  success?: boolean;
  error?: string;
  [key: string]: unknown;
}

export const gifsApi = {
  search: (input: { q?: string; limit?: number; pos?: string }) => {
    return invokeTauri<GifSearchResponse>("gif_search", {
      q: input.q?.trim() || null,
      limit: input.limit ?? 20,
      pos: input.pos ?? null,
    });
  },
};

export const spotifyApi = {
  status: (agentId: string) => invokeTauri<SpotifyStatus>("spotify_status", { body: { agentId } }),
  authorize: async (input: { clientId: string; agentId: string }) => {
    const shouldOpenClientSide = Boolean(remoteRuntimeTarget());
    const response = await invokeTauri<SpotifyAuthorizeResponse>("spotify_authorize", { input });
    if (shouldOpenClientSide && response.authUrl) {
      await openExternalUrl(response.authUrl);
    }
    return response;
  },
  exchange: (callbackUrl: string) => invokeTauri<SpotifyExchangeResponse>("spotify_exchange", { callbackUrl }),
  disconnect: (agentId: string) => invokeTauri("spotify_disconnect", { body: { agentId } }),
  accessToken: <T = unknown>() => invokeTauri<T>("spotify_access_token", { body: null }),
  player: <T = unknown>(body?: Record<string, unknown> | null) =>
    invokeTauri<T>("spotify_player", { body: body ?? null }),
  devices: <T = unknown>(body?: Record<string, unknown> | null) =>
    invokeTauri<T>("spotify_devices", { body: body ?? null }),
  playlists: <T = unknown>(input?: { agentId?: string | null; limit?: number }) =>
    invokeTauri<T>("spotify_playlists", { agentId: input?.agentId ?? null, limit: input?.limit ?? null }),
  playlistTracks: <T = unknown>(input: Record<string, unknown>) =>
    invokeTauri<T>("spotify_playlist_tracks", { input }),
  play: (body: Record<string, unknown>) => invokeTauri("spotify_player_play", { body }),
  pause: (body: Record<string, unknown>) => invokeTauri("spotify_player_pause", { body }),
  next: (body: Record<string, unknown>) => invokeTauri("spotify_player_next", { body }),
  previous: (body: Record<string, unknown>) => invokeTauri("spotify_player_previous", { body }),
  transfer: (body: Record<string, unknown>) => invokeTauri("spotify_player_transfer", { body }),
  shuffle: (body: Record<string, unknown>) => invokeTauri("spotify_player_shuffle", { body }),
  repeat: (body: Record<string, unknown>) => invokeTauri("spotify_player_repeat", { body }),
  volume: (body: Record<string, unknown>) => invokeTauri("spotify_player_volume", { body }),
  searchTracks: <T = unknown>(input: Record<string, unknown>) => invokeTauri<T>("spotify_search_tracks", { input }),
  playTrack: <T = unknown>(input: Record<string, unknown>) => invokeTauri<T>("spotify_play_track", { input }),
  djMariPlaylist: <T = unknown>(input: Record<string, unknown>) =>
    invokeTauri<T>("spotify_dj_mari_playlist", { input }),
};

export const knowledgeSourcesApi = {
  list: <T = unknown>() => invokeTauri<T>("knowledge_sources_list"),
  upload: (file: File) => {
    return fileToUploadPayload(file).then((payload) =>
      invokeTauri("knowledge_source_upload", {
        body: { file: payload },
      }),
    );
  },
  delete: <T = unknown>(id: string) => invokeTauri<T>("knowledge_source_delete", { id }),
  text: <T = unknown>(id: string) => invokeTauri<T>("knowledge_source_text", { id }),
};

export const connectionsUtilityApi = {
  list: <T = unknown>() => invokeTauri<T>("storage_list", { entity: "connections", options: null }),
};
