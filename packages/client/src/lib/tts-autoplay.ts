export type TTSAutoplayMessage = {
  id: string;
  role: string;
  content: string;
  characterId?: string | null;
  activeSwipeIndex?: number | null;
};

export const TTS_AUTOPLAY_MESSAGE_READY_EVENT = "marinara:tts-autoplay-message-ready";

export type TTSAutoplayMessageReadyDetail = {
  chatId: string;
  message: TTSAutoplayMessage;
  /** The parts before `message` of a reply split at scene breaks (#7481), read first and in order. */
  earlierMessages?: TTSAutoplayMessage[];
};

/** Auto-play is reading a reply (`pending: true`, sent before the voice loads) or has stopped reading it (`pending:
 *  false`, sent however it ended: played, failed, had no lines, was stopped or superseded). Avatars wait for it. */
export const TTS_AUTOPLAY_VOICE_EVENT = "marinara:tts-autoplay-voice";

export type TTSAutoplayVoiceDetail = {
  chatId: string;
  messageId: string;
  /** One per reading: a regenerated swipe keeps its message id, so the end of the reading it replaced is not its own. */
  readingId: string;
  pending: boolean;
};

let ttsAutoplayReadings = 0;
export const nextTTSAutoplayReadingId = () => `tts-reading-${(ttsAutoplayReadings += 1)}`;

export function findLatestTTSAutoplayMessage<T extends TTSAutoplayMessage>(messages: readonly T[]): T | undefined {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const candidate = messages[index];
    if (candidate && (candidate.role === "assistant" || candidate.role === "narrator")) return candidate;
  }
  return undefined;
}

/** The earlier parts, in order, of a reply split at scene breaks (#7481) whose last part is `last`. */
export function findSplitReplyEarlierParts<T extends TTSAutoplayMessage & { extra?: unknown }>(
  messages: readonly T[],
  last: TTSAutoplayMessage,
): T[] {
  const parts: T[] = [];
  for (let index = messages.findIndex((message) => message.id === last.id) - 1; index >= 0; index -= 1) {
    const candidate = messages[index]!;
    let extra = candidate.extra;
    try {
      if (typeof extra === "string") extra = JSON.parse(extra);
    } catch {
      extra = null;
    }
    if (
      candidate.role !== last.role ||
      candidate.characterId !== last.characterId ||
      (extra as { continuesAfterSceneBreak?: unknown } | null)?.continuesAfterSceneBreak !== true
    )
      break;
    parts.unshift(candidate);
  }
  return parts;
}

export function getTTSAutoplayRevision(message?: TTSAutoplayMessage | null): string | null {
  if (!message?.content.trim()) return null;
  return JSON.stringify([message.id, message.activeSwipeIndex ?? 0, message.content]);
}

export function shouldAutoplayGeneratedTTS(args: {
  beforeRevision: string | null;
  message?: TTSAutoplayMessage | null;
  generationFailed: boolean;
}): boolean {
  if (args.generationFailed) return false;
  const afterRevision = getTTSAutoplayRevision(args.message);
  return afterRevision !== null && afterRevision !== args.beforeRevision;
}
