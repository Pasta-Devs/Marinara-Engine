import type { ConversationCallCharacterVideoClipKind } from "./conversation-call.js";

export type ConversationCallVideoClipDurations = Record<ConversationCallCharacterVideoClipKind, number>;

export interface VideoGenerationUserSettings {
  /** Global fallback for manual Game/Gallery scene videos when the selected video connection has no own defaults. */
  sceneVideoDurationSeconds: number;
  /** Conversation Call character-presence clip durations, in seconds. */
  callClipDurations: ConversationCallVideoClipDurations;
  /** One-off custom Conversation Call clip duration, in seconds. */
  callCustomClipDurationSeconds: number;
  /** Animated Expression Engine portrait clip duration, in seconds. */
  animatedExpressionClipDurationSeconds: number;
}
