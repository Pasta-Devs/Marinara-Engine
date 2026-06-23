import type { BuiltInAgentManifest } from "../agent-manifest.types.js";
import { getDefaultAgentPrompt } from "../../../constants/agent-prompts.js";

export const spotifyAgentManifest = {
  id: "spotify",
  name: "Music DJ",
  description:
    "Analyzes the narrative mood and plays matching music through Spotify, YouTube, or local Game Assets music.",
  phase: "post_processing",
  enabledByDefault: false,
  category: "misc",
  defaultSettings: {
    musicProvider: "spotify",
    customMusicSource: "game-assets",
    customMusicFolder: "music",
    customMusicExternalFolder: "",
    promptTemplates: [
      {
        id: "spotify",
        name: "Spotify DJ",
        description: "Use Spotify tools and playback controls.",
        promptTemplate: getDefaultAgentPrompt("spotify"),
      },
      {
        id: "youtube",
        name: "YouTube DJ",
        description: "Return YouTube search intents for the embedded player.",
        promptTemplate: getDefaultAgentPrompt("youtube"),
      },
      {
        id: "custom",
        name: "Custom Local DJ",
        description: "Choose from Game Assets or a selected local music folder for the embedded player.",
        promptTemplate: getDefaultAgentPrompt("local-music"),
      },
    ],
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
