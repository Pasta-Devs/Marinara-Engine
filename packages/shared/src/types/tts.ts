// ──────────────────────────────────────────────
// TTS Types
// ──────────────────────────────────────────────
import { z } from "zod";

export const ttsSourceSchema = z.enum(["openai", "elevenlabs", "pockettts", "xai"]);
export type TTSSource = z.infer<typeof ttsSourceSchema>;

export const ttsAudioFormatSchema = z.enum(["mp3", "wav"]);
export type TTSAudioFormat = z.infer<typeof ttsAudioFormatSchema>;

export const ttsDialogueScopeSchema = z.enum(["all", "character"]);
export type TTSDialogueScope = z.infer<typeof ttsDialogueScopeSchema>;

export const ttsVoiceModeSchema = z.enum(["single", "per-character"]);
export type TTSVoiceMode = z.infer<typeof ttsVoiceModeSchema>;

export const ttsConversationCallAudioInputModeSchema = z.enum(["system", "auto", "transcribe", "local_whisper"]);
export type TTSConversationCallAudioInputMode = z.infer<typeof ttsConversationCallAudioInputModeSchema>;

export const ttsVoiceAssignmentSchema = z.object({
  characterId: z.string().default(""),
  characterName: z.string().default(""),
  voice: z.string().default(""),
});
export type TTSVoiceAssignment = z.infer<typeof ttsVoiceAssignmentSchema>;

export const ELEVENLABS_TTS_LANGUAGE_OPTIONS = [
  { code: "", label: "Auto detect" },
  { code: "af", label: "Afrikaans" },
  { code: "ar", label: "Arabic" },
  { code: "hy", label: "Armenian" },
  { code: "as", label: "Assamese" },
  { code: "az", label: "Azerbaijani" },
  { code: "be", label: "Belarusian" },
  { code: "bn", label: "Bengali" },
  { code: "bs", label: "Bosnian" },
  { code: "bg", label: "Bulgarian" },
  { code: "ca", label: "Catalan" },
  { code: "ceb", label: "Cebuano" },
  { code: "ny", label: "Chichewa" },
  { code: "hr", label: "Croatian" },
  { code: "cs", label: "Czech" },
  { code: "da", label: "Danish" },
  { code: "nl", label: "Dutch" },
  { code: "en", label: "English" },
  { code: "et", label: "Estonian" },
  { code: "fil", label: "Filipino" },
  { code: "fi", label: "Finnish" },
  { code: "fr", label: "French" },
  { code: "gl", label: "Galician" },
  { code: "ka", label: "Georgian" },
  { code: "de", label: "German" },
  { code: "el", label: "Greek" },
  { code: "gu", label: "Gujarati" },
  { code: "ha", label: "Hausa" },
  { code: "he", label: "Hebrew" },
  { code: "hi", label: "Hindi" },
  { code: "hu", label: "Hungarian" },
  { code: "is", label: "Icelandic" },
  { code: "id", label: "Indonesian" },
  { code: "ga", label: "Irish" },
  { code: "it", label: "Italian" },
  { code: "ja", label: "Japanese" },
  { code: "jv", label: "Javanese" },
  { code: "kn", label: "Kannada" },
  { code: "kk", label: "Kazakh" },
  { code: "ky", label: "Kirghiz" },
  { code: "ko", label: "Korean" },
  { code: "lv", label: "Latvian" },
  { code: "ln", label: "Lingala" },
  { code: "lt", label: "Lithuanian" },
  { code: "lb", label: "Luxembourgish" },
  { code: "mk", label: "Macedonian" },
  { code: "ms", label: "Malay" },
  { code: "ml", label: "Malayalam" },
  { code: "zh", label: "Mandarin Chinese" },
  { code: "mr", label: "Marathi" },
  { code: "ne", label: "Nepali" },
  { code: "no", label: "Norwegian" },
  { code: "ps", label: "Pashto" },
  { code: "fa", label: "Persian" },
  { code: "pl", label: "Polish" },
  { code: "pt", label: "Portuguese" },
  { code: "pa", label: "Punjabi" },
  { code: "ro", label: "Romanian" },
  { code: "ru", label: "Russian" },
  { code: "sr", label: "Serbian" },
  { code: "sd", label: "Sindhi" },
  { code: "sk", label: "Slovak" },
  { code: "sl", label: "Slovenian" },
  { code: "so", label: "Somali" },
  { code: "es", label: "Spanish" },
  { code: "sw", label: "Swahili" },
  { code: "sv", label: "Swedish" },
  { code: "ta", label: "Tamil" },
  { code: "te", label: "Telugu" },
  { code: "th", label: "Thai" },
  { code: "tr", label: "Turkish" },
  { code: "uk", label: "Ukrainian" },
  { code: "ur", label: "Urdu" },
  { code: "vi", label: "Vietnamese" },
  { code: "cy", label: "Welsh" },
] as const;

export const ttsConfigSchema = z.object({
  enabled: z.boolean().default(false),
  source: ttsSourceSchema.default("openai"),
  baseUrl: z.string().default("https://api.openai.com/v1"),
  /** Plain text on write; masked "••••••" on read when a key is saved */
  apiKey: z.string().default(""),
  voice: z.string().default("alloy"),
  model: z.string().default("tts-1"),
  /** 0.25 – 4.0 */
  speed: z.number().min(0.25).max(4.0).default(1.0),
  /** ElevenLabs only: 0.0 = more expressive/creative, 1.0 = more stable/robust */
  elevenLabsStability: z.number().min(0).max(1).default(0.5),
  /** ElevenLabs only: optional language_code. Empty means automatic language detection. */
  elevenLabsLanguageCode: z.string().max(8).default(""),
  voiceMode: ttsVoiceModeSchema.default("single"),
  voiceAssignments: z.array(ttsVoiceAssignmentSchema).default([]),
  narratorVoiceEnabled: z.boolean().default(false),
  narratorVoice: z.string().default(""),
  npcDefaultVoicesEnabled: z.boolean().default(false),
  npcDefaultMaleVoices: z.array(z.string()).default([]),
  npcDefaultFemaleVoices: z.array(z.string()).default([]),
  autoplayRP: z.boolean().default(false),
  autoplayConvo: z.boolean().default(false),
  autoplayGame: z.boolean().default(false),
  progressivePlayback: z.boolean().default(false),
  dialogueOnly: z.boolean().default(false),
  audioFormat: ttsAudioFormatSchema.default("mp3"),
  dialogueScope: ttsDialogueScopeSchema.default("all"),
  dialogueCharacterName: z.string().default(""),
  /** Global gate for Conversation-mode calls. Individual chats opt in separately. */
  callAudioEnabled: z.boolean().default(false),
  /** Deprecated: call transcription now uses the active conversation connection. */
  callSttConnectionId: z.string().default(""),
  /** Deprecated: call transcription now follows the selected call audio input mode. */
  callSttModel: z.string().default(""),
  /** Conversation call mic path: local Whisper, browser speech, manual OS dictation, or provider-native media. */
  callAudioInputMode: ttsConversationCallAudioInputModeSchema.default("local_whisper"),
  /** UI gate for camera/screen controls. Provider-native video input remains capability-gated by the call pipeline. */
  callVideoInputEnabled: z.boolean().default(false),
  /** Generate and play cached character presence videos during Conversation Calls. */
  callCharacterVideoEnabled: z.boolean().default(false),
  /** Automatically generate the minimum idle/talking call-presence clips for call participants. */
  callAutomaticVideoClipsEnabled: z.boolean().default(false),
  /** Let characters sparsely generate custom call-presence clips on explicit user request. */
  callCustomVideoClipsEnabled: z.boolean().default(false),
  /** Deprecated: soundboard is always available during calls. */
  callSoundboardEnabled: z.boolean().default(true),
});

export type TTSConfig = z.infer<typeof ttsConfigSchema>;

export const TTS_SETTINGS_KEY = "tts";
export const TTS_API_KEY_MASK = "••••••";

/** Returned by GET /api/tts/voices */
export interface TTSVoicesResponse {
  voices: string[];
  voiceOptions?: Array<{
    id: string;
    name: string;
    description?: string | null;
    previewUrl?: string | null;
    category?: string | null;
    labels?: Record<string, string | number | boolean | null> | null;
  }>;
  /** True when the list came from the provider; false = local fallback or no provider voices */
  fromProvider: boolean;
  source: TTSSource;
}
