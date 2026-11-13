import { normalizeSpotifySourceType, type Chat } from "@marinara-engine/shared";
import { useTranslation as useUiTranslation } from "react-i18next";
import { useUpdateChatMetadata } from "../../../hooks/use-chats";
import { SPOTIFY_SOURCE_OPTIONS } from "../../../lib/spotify-source-options";

type SpotifyPlaylist = { id: string; name: string; uri: string; trackCount: number | null; owned: boolean | null };

type SpotifySourceKeys = { sourceType: string; playlistId: string; playlistName: string; artist: string };

/** Roleplay and Game keep separate Spotify choices in the chat's metadata, under these keys. */
export const ROLEPLAY_SPOTIFY_KEYS: SpotifySourceKeys = {
  sourceType: "spotifySourceType",
  playlistId: "spotifyPlaylistId",
  playlistName: "spotifyPlaylistName",
  artist: "spotifyArtist",
};
export const GAME_SPOTIFY_KEYS: SpotifySourceKeys = {
  sourceType: "gameSpotifySourceType",
  playlistId: "gameSpotifyPlaylistId",
  playlistName: "gameSpotifyPlaylistName",
  artist: "gameSpotifyArtist",
};

interface SpotifySourceSettingsProps {
  chat: Chat;
  metadata: Record<string, unknown>;
  keys: SpotifySourceKeys;
  sourceType: string;
  playlistId: string;
  artistDraft: string;
  setArtistDraft: (artist: string) => void;
  playlistsQuery: { data?: { playlists: SpotifyPlaylist[] }; isFetching: boolean; isError: boolean };
}

/** Music DJ's Spotify source, playlist and artist, shown by both the Roleplay and the Game agent card. */
export function SpotifySourceSettings({
  chat,
  metadata,
  keys,
  sourceType,
  playlistId,
  artistDraft,
  setArtistDraft,
  playlistsQuery,
}: SpotifySourceSettingsProps) {
  const { t: localizeUi } = useUiTranslation();
  const updateMeta = useUpdateChatMetadata();
  return (
    <>
      <label className="flex flex-col gap-1">
        <span className="text-[0.625rem] font-medium text-[var(--muted-foreground)]">
          {localizeUi("ui.chat.chatsettingsdrawer.spotifySource")}
        </span>
        <select
          value={sourceType}
          onChange={(event) => {
            const next = normalizeSpotifySourceType(event.target.value);
            updateMeta.mutate({
              id: chat.id,
              [keys.sourceType]: next,
              [keys.playlistId]: next === "playlist" ? playlistId || null : null,
              [keys.playlistName]: next === "playlist" ? (metadata[keys.playlistName] as string) || null : null,
              [keys.artist]: next === "artist" ? artistDraft.trim() || null : null,
            });
          }}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-2 text-xs text-[var(--foreground)]"
        >
          {SPOTIFY_SOURCE_OPTIONS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
        <span className="text-[0.5625rem] text-[var(--muted-foreground)]">
          {SPOTIFY_SOURCE_OPTIONS.find((option) => option.id === sourceType)?.description ?? ""}
        </span>
      </label>

      {sourceType === "playlist" && (
        <label className="flex flex-col gap-1">
          <span className="text-[0.625rem] font-medium text-[var(--muted-foreground)]">
            {localizeUi("ui.chat.musicdjsetupfields.playlist")}
          </span>
          {playlistsQuery.data?.playlists.length ? (
            <select
              value={playlistId}
              onChange={(event) => {
                const playlist = playlistsQuery.data?.playlists.find((entry) => entry.id === event.target.value);
                updateMeta.mutate({
                  id: chat.id,
                  [keys.playlistId]: event.target.value || null,
                  [keys.playlistName]: playlist?.name ?? null,
                });
              }}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-2 text-xs text-[var(--foreground)]"
            >
              <option value="">{localizeUi("ui.chat.musicdjsetupfields.choosePlaylist")}</option>
              {playlistsQuery.data.playlists.map((playlist) => {
                const suffix =
                  typeof playlist.trackCount === "number"
                    ? ` (${playlist.trackCount})`
                    : playlist.owned === false
                      ? " (followed, unavailable)"
                      : "";
                return (
                  <option key={playlist.id} value={playlist.id}>
                    {playlist.name}
                    {suffix}
                  </option>
                );
              })}
            </select>
          ) : (
            <input
              key={`${chat.id}-${playlistId}`}
              defaultValue={playlistId}
              onBlur={(event) =>
                updateMeta.mutate({
                  id: chat.id,
                  [keys.playlistId]: event.target.value.trim() || null,
                  [keys.playlistName]: null,
                })
              }
              placeholder={
                playlistsQuery.isFetching
                  ? localizeUi("ui.chat.musicdjsetupfields.loadingPlaylists")
                  : localizeUi("ui.chat.musicdjsetupfields.pastePlaylistId")
              }
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-2 text-xs text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]/50"
            />
          )}
          {playlistsQuery.isError && (
            <span className="text-[0.5625rem] text-amber-400/90">
              {localizeUi("ui.chat.musicdjsetupfields.connectSpotifyInTheMusicDjAgentToLoad")}
            </span>
          )}
        </label>
      )}

      {sourceType === "artist" && (
        <label className="flex flex-col gap-1">
          <span className="text-[0.625rem] font-medium text-[var(--muted-foreground)]">
            {localizeUi("ui.chat.musicdjsetupfields.artist")}
          </span>
          <input
            value={artistDraft}
            onChange={(event) => setArtistDraft(event.target.value)}
            onBlur={() =>
              updateMeta.mutate({
                id: chat.id,
                [keys.artist]: artistDraft.trim() || null,
              })
            }
            placeholder={localizeUi("ui.chat.musicdjsetupfields.hoyoMix")}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-2 text-xs text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]/50"
          />
        </label>
      )}
    </>
  );
}
