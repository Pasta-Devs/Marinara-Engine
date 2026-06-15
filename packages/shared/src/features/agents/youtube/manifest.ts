import type { BuiltInAgentManifest } from "../agent-manifest.types.js";

// ponytail: no defaultTools — the YouTube DJ is a pure-JSON agent. It returns a
// search query and the client resolves it to a video + plays it in an embedded
// player. No OAuth, no remote-device control, no Premium required.
export const youtubeAgentManifest = {
  id: "youtube",
  name: "YouTube DJ",
  description:
    "Analyzes the narrative mood and plays matching music from YouTube in an embedded in-app player. Free for any account — only needs a free YouTube Data API key.",
  phase: "post_processing",
  enabledByDefault: false,
  category: "misc",
  libraryHidden: true,
  resultType: "youtube_control",
} satisfies BuiltInAgentManifest;
