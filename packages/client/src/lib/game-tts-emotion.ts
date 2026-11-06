// Game mode speaks each line with the sprite expression it resolved (GameNarration and combat dialogue send it as the
// line's tone). Any expression a model writes is folded into the shared vocabulary here, so the server can map it to a
// documented ElevenLabs audio tag or to none, and never sends a word that would be read aloud (#8619).
import { GAME_TTS_EMOTIONS, type GameTtsEmotion } from "@marinara-engine/shared";
import { normalizeSpriteExpressionKey } from "./sprite-expression-match";

const GAME_TTS_EMOTION_SET = new Set<string>(GAME_TTS_EMOTIONS);

const GAME_TTS_EMOTION_ALIASES: Record<string, GameTtsEmotion> = {
  afraid: "scared",
  anger: "angry",
  amused: "laughing",
  blush: "blushing",
  confused_look: "confused",
  confusion: "confused",
  cry: "crying",
  determined_look: "determined",
  disgust: "disgusted",
  drowsy: "sleepy",
  embarrassed_smile: "embarrassed",
  fear: "scared",
  fearful: "scared",
  flustered: "blushing",
  focused: "determined",
  grin: "happy",
  joyful: "happy",
  laugh: "laughing",
  nervous: "scared",
  pensive: "thinking",
  puzzled: "confused",
  sad_look: "sad",
  sadness: "sad",
  serious: "determined",
  shocked: "surprised",
  shy: "blushing",
  sleep: "sleepy",
  sleepy_eyes: "sleepy",
  smile: "happy",
  smirking: "smirk",
  sobbing: "crying",
  startled: "surprised",
  surprise: "surprised",
  think: "thinking",
  tired: "sleepy",
  worried: "scared",
};

/** A model-written expression as one of the game's spoken expressions, or null when it names none of them. */
export function normalizeGameTtsEmotion(value?: string | null): GameTtsEmotion | null {
  const normalized = value ? normalizeSpriteExpressionKey(value) : "";
  if (!normalized) return null;
  if (GAME_TTS_EMOTION_SET.has(normalized)) return normalized as GameTtsEmotion;
  if (GAME_TTS_EMOTION_ALIASES[normalized]) return GAME_TTS_EMOTION_ALIASES[normalized];

  const parts = normalized.split("_").filter(Boolean);
  for (const part of parts) {
    if (GAME_TTS_EMOTION_SET.has(part)) return part as GameTtsEmotion;
    if (GAME_TTS_EMOTION_ALIASES[part]) return GAME_TTS_EMOTION_ALIASES[part];
  }

  return null;
}
