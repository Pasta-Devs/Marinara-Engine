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
  /**
   * The most video messages Conversation characters may send on their own in one reply, one per character. A group
   * turn is one reply, so this is what lets several characters (or a request for several clips) each send one.
   */
  maxCharacterVideosPerReply: number;
}
