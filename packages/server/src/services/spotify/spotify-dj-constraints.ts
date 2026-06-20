// ──────────────────────────────────────────────
// Music DJ Spotify prompt constraints
// ──────────────────────────────────────────────

type SpotifyDjSourceType = "liked" | "playlist" | "artist" | "any";

function normalizeSourceType(value: unknown): SpotifyDjSourceType {
  return value === "playlist" || value === "artist" || value === "any" || value === "liked" ? value : "liked";
}

function cleanString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function buildSpotifyDjConstraints(args: {
  chatMode: string;
  chatMeta: Record<string, unknown>;
  manualRetry?: boolean;
  forceFreshPick?: boolean;
}): Record<string, unknown> {
  const isGame = args.chatMode === "game";
  const sourceType = normalizeSourceType(
    isGame ? args.chatMeta.gameSpotifySourceType : args.chatMeta.spotifySourceType,
  );
  const playlistId = cleanString(isGame ? args.chatMeta.gameSpotifyPlaylistId : args.chatMeta.spotifyPlaylistId);
  const playlistName = cleanString(isGame ? args.chatMeta.gameSpotifyPlaylistName : args.chatMeta.spotifyPlaylistName);
  const artist = cleanString(isGame ? args.chatMeta.gameSpotifyArtist : args.chatMeta.spotifyArtist);
  const constraints: Record<string, unknown> = {
    mode: isGame ? "game" : "roleplay",
    replaceBuiltInMusic: isGame && args.chatMeta.gameUseSpotifyMusic === true,
    sourceType,
    playlistId: sourceType === "liked" ? "liked" : sourceType === "playlist" ? playlistId : null,
    playlistName: sourceType === "playlist" ? playlistName : null,
    artist: sourceType === "artist" ? artist : null,
  };

  if (args.manualRetry === true) constraints.manualRetry = true;
  if (args.forceFreshPick === true) constraints.forceFreshPick = true;

  if (sourceType === "liked") {
    constraints.note =
      "Use the user's Liked Songs first by calling spotify_get_playlist_tracks with playlistId='liked'. Search wider only when no fitting liked track exists.";
  } else if (sourceType === "playlist") {
    constraints.note = playlistId
      ? "Use this configured playlist first by calling spotify_get_playlist_tracks with the provided playlistId. Search wider only if the playlist has no fitting track."
      : "Playlist source is selected, but no playlist ID is configured. Call spotify_get_playlists to inspect available playlists, then fall back to Liked Songs if needed.";
  } else if (sourceType === "artist") {
    constraints.note = artist
      ? `Search around this artist first. Prefer queries using artist:${artist}.`
      : "Artist source is selected, but no artist is configured. Fall back to Liked Songs if needed.";
  } else {
    constraints.note =
      "Spotify catalogue search is allowed. Still inspect current playback first and prefer the user's library when it fits.";
  }

  return constraints;
}
