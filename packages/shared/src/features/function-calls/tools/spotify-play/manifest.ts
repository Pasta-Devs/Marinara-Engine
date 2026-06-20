import type { ToolDefinition } from "../../tool-definitions.js";

export const spotifyPlayToolManifest = {
  name: "spotify_play",
  description:
    "Play one or more tracks, or a playlist, on the user's active Spotify device. In game mode, pass one best track URI so it can loop until a new scene pick.",
  parameters: {
    type: "object",
    properties: {
      uri: {
        type: "string",
        description:
          "Single Spotify URI to play (e.g. 'spotify:track:xxx' or 'spotify:playlist:xxx'). Use 'uris' instead when queueing multiple tracks.",
      },
      uris: {
        type: "array",
        items: { type: "string" },
        description:
          "Array of Spotify track URIs to play as a queue (e.g. ['spotify:track:xxx', 'spotify:track:yyy']). The first track plays immediately, the rest are queued.",
      },
      reason: { type: "string", description: "Why this track fits the current scene mood" },
    },
    oneOf: [{ required: ["uri"] }, { required: ["uris"] }],
    additionalProperties: false,
  },
} satisfies ToolDefinition;
