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
};

export function findLatestTTSAutoplayMessage<T extends TTSAutoplayMessage>(messages: readonly T[]): T | undefined {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const candidate = messages[index];
    if (candidate && (candidate.role === "assistant" || candidate.role === "narrator")) return candidate;
  }
  return undefined;
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
