import type { ToolDefinition } from "../../tool-definitions.js";

export const spotifyGetPlaylistsToolManifest = {
  name: "spotify_get_playlists",
  description:
    "Get the user's Spotify playlists and saved library. Returns playlist names and URIs. Use this FIRST to see what the user already has before searching.",
  parameters: {
    type: "object",
    properties: {
      limit: {
        type: "integer",
        minimum: 1,
        maximum: 50,
        default: 20,
        description: "Number of playlists to return (default: 20, max: 50)",
      },
    },
  },
} satisfies ToolDefinition;
