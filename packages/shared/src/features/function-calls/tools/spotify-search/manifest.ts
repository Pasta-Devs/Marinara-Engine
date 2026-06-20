import type { ToolDefinition } from "../../tool-definitions.js";

export const spotifySearchToolManifest = {
  name: "spotify_search",
  description:
    "Search Spotify for tracks matching a mood, genre, or specific query. Returns a list of track URIs. Prefer using the user's playlists/liked songs first.",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description:
          "Search query — mood keywords, genre, artist, or track name (e.g. 'dark ambient orchestral', 'battle music epic')",
      },
      limit: { type: "number", description: "Number of results to return (default: 5)" },
    },
    required: ["query"],
  },
} satisfies ToolDefinition;
