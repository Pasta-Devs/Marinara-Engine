interface StreamHandoffInput {
  streamingEnabled: boolean;
  shouldDisplayRawStream: boolean;
  isGameGeneration: boolean;
  isRegeneration: boolean;
  isContinuation: boolean;
}

interface TypewriterReplacement {
  visibleText: string;
  pendingText: string;
}

interface TypewriterSlice {
  visibleText: string;
  pendingText: string;
  characterCount: number;
}

interface TypewriterFrameBudget {
  accruedCharacters: number;
  maxCharacters: number;
}

interface RoleplayTypewriterRevealRateInput {
  selectedCharsPerSecond: number;
  pendingCharacters: number;
  previousCharsPerSecond: number | null;
  elapsedMs: number;
  streamComplete: boolean;
}

interface GenerationSendBlockInput {
  streamActive: boolean;
  agentsProcessing: boolean;
  backgroundIllustration: boolean;
  delayedResponse?: boolean;
}

interface GenerationStartBlockInput {
  setupLocked: boolean;
  activeController: boolean;
  backgroundIllustration: boolean;
}

const ROLEPLAY_QUEUE_RESERVE_SECONDS = 0.9;
const ROLEPLAY_SLOWDOWN_RESPONSE_MS = 120;
const ROLEPLAY_SPEEDUP_RESPONSE_MS = 480;

/** Keep send actions guarded while leaving the draft field itself editable. */
export function isGenerationSendBlocked(input: GenerationSendBlockInput): boolean {
  return !input.backgroundIllustration && !input.delayedResponse && (input.streamActive || input.agentsProcessing);
}

/** An Illustrator-only SSE tail may coexist with the chat's next text generation. */
export function isGenerationStartBlocked(input: GenerationStartBlockInput): boolean {
  return input.setupLocked || (input.activeController && !input.backgroundIllustration);
}

/**
 * Map the 1–100 streaming-speed control to the visible-speed ceiling. Roleplay
 * may ease below that ceiling to preserve a queue between provider bursts. The
 * final setting remains an intentional instant-reveal shortcut.
 */
export function getStreamingCharsPerSecond(streamingSpeed: number, prefersReducedMotion = false): number {
  if (prefersReducedMotion || streamingSpeed >= 100) return Infinity;
  if (!Number.isFinite(streamingSpeed)) return 50;
  return Math.max(1, Math.min(99, Math.round(streamingSpeed)));
}

/**
 * Keep Roleplay's reveal queue slightly behind the open transport so provider
 * bursts remain one continuous motion. The selected speed stays the ceiling.
 */
export function getRoleplayTypewriterRevealCharsPerSecond(input: RoleplayTypewriterRevealRateInput): number {
  if (!Number.isFinite(input.selectedCharsPerSecond)) return input.selectedCharsPerSecond;
  if (input.streamComplete) return input.selectedCharsPerSecond;

  const minimumRate = Math.min(6, input.selectedCharsPerSecond);
  const queueSmoothedTarget = Math.max(minimumRate, input.pendingCharacters / ROLEPLAY_QUEUE_RESERVE_SECONDS);
  const targetRate = Math.min(input.selectedCharsPerSecond, queueSmoothedTarget);

  if (input.previousCharsPerSecond === null || !Number.isFinite(input.previousCharsPerSecond)) {
    return targetRate;
  }

  const responseTimeMs =
    targetRate < input.previousCharsPerSecond ? ROLEPLAY_SLOWDOWN_RESPONSE_MS : ROLEPLAY_SPEEDUP_RESPONSE_MS;
  const blend = 1 - Math.exp(-Math.max(0, input.elapsedMs) / responseTimeMs);
  return input.previousCharsPerSecond + (targetRate - input.previousCharsPerSecond) * blend;
}

/** Preserve the selected reveal rate even when animation frames arrive below 60 Hz. */
export function getTypewriterFrameBudget(
  charsPerSecond: number,
  elapsedMs: number,
  carriedRemainder: number,
): TypewriterFrameBudget {
  const newlyAccruedCharacters = (charsPerSecond * Math.max(0, elapsedMs)) / 1000;
  return {
    accruedCharacters: carriedRemainder + newlyAccruedCharacters,
    maxCharacters: Math.max(1, Math.ceil(newlyAccruedCharacters)),
  };
}

const typewriterGraphemeSegmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

/** Reveal whole user-perceived characters so emoji and combining marks never flash half-formed. */
export function takeTypewriterCharacters(text: string, maxCharacters: number): TypewriterSlice {
  if (!text || maxCharacters < 1) {
    return { visibleText: "", pendingText: text, characterCount: 0 };
  }

  let endIndex = 0;
  let characterCount = 0;
  for (const segment of typewriterGraphemeSegmenter.segment(text)) {
    if (characterCount >= maxCharacters) break;
    endIndex = segment.index + segment.segment.length;
    characterCount += 1;
  }

  return {
    visibleText: text.slice(0, endIndex),
    pendingText: text.slice(endIndex),
    characterCount,
  };
}

/**
 * Reconcile an authoritative replacement with text that the typewriter has
 * already painted. Server cleanup can trim a leading newline, speaker label,
 * or thinking block after token streaming. Preserve the amount of text the
 * user has already read and keep the remainder queued instead of revealing the
 * complete cleaned response in one frame.
 */
export function reconcileTypewriterReplacement(
  visibleText: string,
  replacementText: string,
  retype = false,
): TypewriterReplacement {
  if (retype) return { visibleText: "", pendingText: replacementText };
  if (replacementText.startsWith(visibleText)) {
    return {
      visibleText,
      pendingText: replacementText.slice(visibleText.length),
    };
  }

  const preservedLength = Math.min(visibleText.length, replacementText.length);
  return {
    visibleText: replacementText.slice(0, preservedLength),
    pendingText: replacementText.slice(preservedLength),
  };
}

interface LiveStreamMessageShadowInput {
  hasLiveStream: boolean;
  regenerateMessageId: string | null;
  streamedMessageId: string | null;
  messageId: string;
}

/** Keep a saved assistant row from shadowing its still-active presentation row. */
export function isMessageShadowedByLiveStream(input: LiveStreamMessageShadowInput): boolean {
  return (
    input.hasLiveStream &&
    !input.regenerateMessageId &&
    input.streamedMessageId !== null &&
    input.messageId === input.streamedMessageId
  );
}

/**
 * Fresh Roleplay streams keep ownership of the visible transcript until the
 * entire SSE lifecycle has finished. The server persists the assistant message
 * before post-processing agents run, so handing off on `message_saved` would
 * replace the animated buffer with the completed database row mid-stream.
 */
export function shouldKeepStreamLiveThroughPostProcessing(input: StreamHandoffInput): boolean {
  return (
    input.streamingEnabled &&
    input.shouldDisplayRawStream &&
    !input.isGameGeneration &&
    !input.isRegeneration &&
    !input.isContinuation
  );
}
