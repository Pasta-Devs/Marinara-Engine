import type { ToolDefinition } from "../../tool-definitions.js";

export const spotifyGetCurrentPlaybackToolManifest = {
  name: "spotify_get_current_playback",
  description:
    "Get the user's current Spotify playback state, track, active device, and volume. Use this before changing music so you do not restart or replace a fitting track.",
  parameters: {
    type: "object",
    properties: {},
  },
} satisfies ToolDefinition;
