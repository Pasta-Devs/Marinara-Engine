import type { SpotifySourceType } from "@marinara-engine/shared";

/** Where Music DJ picks Spotify tracks from, as the agent's setup and Chat Settings both offer it. */
export const SPOTIFY_SOURCE_OPTIONS: Array<{ id: SpotifySourceType; label: string; description: string }> = [
  { id: "liked", label: "Liked Songs", description: "Pick from the user's saved tracks first." },
  { id: "playlist", label: "Playlist", description: "Keep choices inside one Spotify playlist." },
  { id: "artist", label: "Artist", description: "Search only around a named artist, like HOYO-MiX." },
  { id: "any", label: "Any Spotify", description: "Let the DJ use Spotify search when it fits." },
];
