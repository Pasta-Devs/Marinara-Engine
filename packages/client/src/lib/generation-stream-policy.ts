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

interface TypewriterRevealRateInput {
  selectedCharsPerSecond: number;
  pendingCharacters: number;
  observedArrivalCharsPerSecond: number | null;
  streamComplete: boolean;
}

/**
 * Keep the reveal slightly behind an open transport so provider-sized bursts
 * remain a continuous typewriter queue instead of draining into visible gaps.
 * Once transport completes, return to the user's selected speed so completion
 * is never artificially delayed.
 */
export function getTypewriterRevealCharsPerSecond(input: TypewriterRevealRateInput): number {
  if (!Number.isFinite(input.selectedCharsPerSecond) || input.streamComplete) {
    return input.selectedCharsPerSecond;
  }

  const arrivalRate = input.observedArrivalCharsPerSecond ?? input.pendingCharacters;
  const initialRateFloor =
    input.observedArrivalCharsPerSecond === null ? Math.min(12, input.selectedCharsPerSecond) : 1;
  return Math.max(initialRateFloor, Math.min(input.selectedCharsPerSecond, arrivalRate * 0.95));
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
