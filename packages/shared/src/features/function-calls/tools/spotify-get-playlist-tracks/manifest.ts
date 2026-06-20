import type { ToolDefinition } from "../../tool-definitions.js";

export const spotifyGetPlaylistTracksToolManifest = {
  name: "spotify_get_playlist_tracks",
  description:
    "Get track candidates from a specific playlist or the user's Liked Songs. By default, the server indexes/caches the full source and returns only a compact scored shortlist for the model. Supplying offset switches to raw page mode.",
  parameters: {
    type: "object",
    properties: {
      playlistId: {
        type: "string",
        description: "Playlist ID (from spotify_get_playlists), or 'liked' for the user's Liked Songs library",
      },
      query: {
        type: "string",
        description:
          "Scene/mood search terms used to score candidates from the full cached playlist, e.g. 'tense battle orchestral' or 'quiet melancholy'.",
      },
      mood: {
        type: "string",
        description: "Optional short mood label to combine with query when choosing candidates.",
      },
      candidateLimit: {
        type: "number",
        description: "How many candidate tracks to return in candidate mode (default: 60, max: 80).",
      },
      limit: {
        type: "number",
        description: "Candidate count in default mode, or page size when offset is provided (page max: 50).",
      },
      offset: {
        type: "number",
        description:
          "Optional raw-page offset. Only use for manual browsing; default mode is cached candidate selection.",
      },
    },
    required: ["playlistId"],
  },
} satisfies ToolDefinition;
