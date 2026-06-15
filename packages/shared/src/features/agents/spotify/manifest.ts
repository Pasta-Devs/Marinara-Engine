import type { BuiltInAgentManifest } from "../agent-manifest.types.js";

export const spotifyAgentManifest = {
  id: "spotify",
  name: "Music DJ",
  description:
    "Analyzes the narrative mood and plays matching music through Spotify or YouTube. Spotify requires Premium and API credentials; YouTube uses a free Data API key.",
  phase: "post_processing",
  enabledByDefault: false,
  category: "misc",
  defaultSettings: {
    musicProvider: "spotify",
  },
  defaultTools: [
    "spotify_get_current_playback",
    "spotify_get_playlists",
    "spotify_get_playlist_tracks",
    "spotify_search",
    "spotify_play",
    "spotify_set_volume",
  ],
} satisfies BuiltInAgentManifest;
