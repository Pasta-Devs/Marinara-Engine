import { ttsConfigSchema } from "@marinara-engine/shared";

export const TTS_EMOTION_CUE_GUIDANCE =
  "Use sparse, context-appropriate square-bracketed vocal cues immediately before the phrases they affect. Describe audible voice quality, volume, pace, and emotion with natural phrases, such as [low, breathy voice, restrained urgency], [dry, amused delivery], or [strained whisper, fighting back tears]. Small vocal sounds and pauses such as [shaky inhale], [soft laugh], or [brief pause] may mark meaningful beats. Vary cues when delivery changes; do not tag every phrase. Use plain phrases rather than key:value command syntax. Keep each cue on one line with at most 80 characters inside its brackets. Do not use cues for visual actions, facial expressions, environmental sound effects, or music, and do not use SSML/XML tags.";

/** Game dialogue is annotated in its existing generation only when its saved voice playback opts in. */
export function gameTtsEmotionIndicatorsEnabled(raw: string | null | undefined): boolean {
  if (!raw) return false;
  try {
    const config = ttsConfigSchema.safeParse(JSON.parse(raw));
    return (
      config.success &&
      config.data.enabled &&
      config.data.autoplayGame &&
      config.data.roleplaySpeakerExtractorEmotionsEnabled
    );
  } catch {
    return false;
  }
}
