export const DEFAULT_MAX_MOUNTED_TRANSCRIPT_MESSAGES = 80;
export const TRANSCRIPT_RENDER_WINDOW_STEP = 40;

export type TranscriptRenderWindow<T> = {
  messages: T[] | undefined;
  startIndex: number;
  endIndex: number;
  latestStartIndex: number;
  hiddenBeforeCount: number;
  hiddenAfterCount: number;
  totalLoadedCount: number;
  isWindowed: boolean;
};

/**
 * Resolve how many loaded messages the transcript may keep mounted from the
 * "Messages per page" setting. The render window exists to bound DOM cost on
 * long chats, but it must never show fewer messages than the user asked to
 * load: a page size above the default window widens the window to match, and
 * `0` ("load all messages at once") disables the window entirely (#5789).
 * Returns `null` for an unbounded window.
 */
export function resolveTranscriptRenderWindowSize(messagesPerPage: number | null | undefined): number | null {
  if (typeof messagesPerPage !== "number" || !Number.isFinite(messagesPerPage)) {
    return DEFAULT_MAX_MOUNTED_TRANSCRIPT_MESSAGES;
  }
  const pageSize = Math.floor(messagesPerPage);
  if (pageSize <= 0) return null;
  return Math.max(DEFAULT_MAX_MOUNTED_TRANSCRIPT_MESSAGES, pageSize);
}

export function getTranscriptRenderWindow<T>(
  messages: readonly T[] | undefined,
  options: { maxMountedMessages?: number | null; startIndex?: number | null } = {},
): TranscriptRenderWindow<T> {
  if (!messages) {
    return {
      messages: undefined,
      startIndex: 0,
      endIndex: 0,
      latestStartIndex: 0,
      hiddenBeforeCount: 0,
      hiddenAfterCount: 0,
      totalLoadedCount: 0,
      isWindowed: false,
    };
  }

  const maxMountedMessages =
    options.maxMountedMessages === undefined ? DEFAULT_MAX_MOUNTED_TRANSCRIPT_MESSAGES : options.maxMountedMessages;
  // `null` means unbounded: mount every loaded message.
  const safeMax =
    maxMountedMessages === null
      ? Math.max(1, messages.length)
      : Number.isFinite(maxMountedMessages) && maxMountedMessages > 0
        ? Math.floor(maxMountedMessages)
        : 1;
  const latestStartIndex = Math.max(0, messages.length - safeMax);
  const requestedStartIndex =
    typeof options.startIndex === "number" && Number.isFinite(options.startIndex)
      ? Math.floor(options.startIndex)
      : latestStartIndex;
  const startIndex = Math.max(0, Math.min(latestStartIndex, requestedStartIndex));
  const endIndex = Math.min(messages.length, startIndex + safeMax);

  return {
    messages: messages.slice(startIndex, endIndex),
    startIndex,
    endIndex,
    latestStartIndex,
    hiddenBeforeCount: startIndex,
    hiddenAfterCount: Math.max(0, messages.length - endIndex),
    totalLoadedCount: messages.length,
    isWindowed: messages.length > safeMax,
  };
}
