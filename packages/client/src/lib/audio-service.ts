// Capability API 1.381: packages reuse Engine playback and asset selection.
import { scoreMusic, type MusicScoreInput } from "@marinara-engine/shared";
import type { GameAssetManifest } from "../hooks/use-game-assets";

export { createAudioPlayer as createPlayer } from "./game-audio";
export type { AudioPlayer, AudioAssetMap } from "./game-audio";
export type { GameAssetManifest, GameAssetEntry } from "../hooks/use-game-assets";

export type AudioMusicCue = "home" | "combat" | "boss" | "happy" | "tense" | "sad" | "bond";

const CUE_DIRECTION: Record<AudioMusicCue, Pick<MusicScoreInput, "state" | "musicGenre" | "musicIntensity">> = {
  home: { state: "dialogue", musicGenre: "slice_of_life", musicIntensity: "calm" },
  combat: { state: "combat", musicGenre: "fantasy", musicIntensity: "intense" },
  boss: { state: "combat", musicGenre: "fantasy", musicIntensity: "intense" },
  happy: { state: "dialogue", musicGenre: "slice_of_life", musicIntensity: "calm" },
  tense: { state: "exploration", musicGenre: "horror", musicIntensity: "tense" },
  sad: { state: "dialogue", musicGenre: "drama", musicIntensity: "calm" },
  bond: { state: "dialogue", musicGenre: "romance", musicIntensity: "calm" },
};

/** The existing game-assets manifest, including uploaded and bundled assets. */
export async function getAssetManifest(): Promise<GameAssetManifest> {
  const { api } = await import("./api-client");
  return api.get<GameAssetManifest>("/game-assets/manifest");
}

/** Choose an existing state-library track, keeping a fitting current track stable.
 * Game area/tier and generated package-context tracks are deliberately excluded.
 * Several cues can share a stock track; an absent cue state returns null.
 * This never generates or fetches music.
 */
export function selectDefaultMusic(
  cue: AudioMusicCue,
  manifest: GameAssetManifest,
  options: { currentTag?: string | null; genre?: string | null } = {},
): string | null {
  const direction = CUE_DIRECTION[cue];
  const availableMusic = Object.keys(manifest.assets).filter((tag) =>
    /^music:(exploration|dialogue|combat|travel_rest):/.test(tag),
  );
  const input = {
    ...direction,
    musicGenre: options.genre ?? direction.musicGenre,
    availableMusic,
    currentMusic: options.currentTag,
  };
  return scoreMusic(input);
}
