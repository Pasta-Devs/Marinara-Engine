const MAX_MOUNTED_TRANSCRIPT_MESSAGES = 80;
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

export function getTranscriptRenderWindow<T>(
  messages: readonly T[] | undefined,
  options: { maxMountedMessages?: number; startIndex?: number | null } = {},
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

  const maxMountedMessages = options.maxMountedMessages ?? MAX_MOUNTED_TRANSCRIPT_MESSAGES;
  const safeMax = Number.isFinite(maxMountedMessages) && maxMountedMessages > 0 ? Math.floor(maxMountedMessages) : 1;
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
