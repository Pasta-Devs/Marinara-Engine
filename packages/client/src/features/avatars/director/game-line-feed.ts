// ──────────────────────────────────────────────
// Avatar director: the Game Master line now on screen
// ──────────────────────────────────────────────
// GameNarration publishes the narration segment it shows; the director listens. Only dialogue lines with a
// speaker reach avatars, with the Game Master's per-line expression. Lines Game voices never speak (a thought, the
// player's own input) change the face but not the mouth: they arrive with no text. The last line is kept and
// handed to each new listener, because the avatar stage usually mounts after the line it should show. Nothing
// listens unless an avatar stage is mounted, so publishing costs one Set lookup.
import type { AvatarGameLine } from "../contract";

type GameLineListener = (chatId: string, line: AvatarGameLine) => void;

interface ShownSegment {
  id: string;
  type: string;
  speaker?: string;
  sprite?: string;
  content: string;
  /** "thought" for a character's inner thought. */
  partyType?: string | null;
  /** "user" for the player's own input shown before the Game Master's lines. */
  sourceRole?: string | null;
  sourceMessageId?: string | null;
}

const listeners = new Set<GameLineListener>();
let lastShown: { key: string; chatId: string; line: AvatarGameLine } | null = null;

/** Called whenever the active narration segment changes; repeats of the same line are ignored. */
export function publishAvatarGameLine(
  chatId: string | null,
  segment: ShownSegment | null,
  voice: { expected: boolean; pending: boolean } = { expected: false, pending: false },
): void {
  if (!chatId || !segment) return;
  const lineId = `${segment.sourceMessageId ?? chatId}:${segment.id}`;
  if (segment.type !== "dialogue" || !segment.speaker?.trim()) {
    // Narration is on screen now: a stage that mounts later keeps the last face but does not speak the old line.
    if (lastShown?.chatId === chatId && lastShown.line.text) {
      lastShown = {
        key: `${lastShown.key}\nmuted`,
        chatId,
        line: { ...lastShown.line, id: lineId, text: "", voiceExpected: false, voicePending: false },
      };
      for (const listener of listeners) listener(chatId, lastShown.line);
    }
    return;
  }
  const key = `${chatId}\n${lineId}\n${segment.content}\n${voice.expected}\n${voice.pending}`;
  if (key === lastShown?.key) return;
  // The same lines GameNarration's voice skips (shouldSkipGameVoiceSegment).
  const unspoken = segment.partyType === "thought" || segment.sourceRole === "user" || segment.sourceRole === "system";
  const line: AvatarGameLine = {
    id: lineId,
    speakerName: segment.speaker.trim(),
    ownerId: null,
    expression: segment.sprite?.trim() || null,
    text: unspoken ? "" : segment.content,
    voiceExpected: !unspoken && voice.expected,
    voicePending: !unspoken && voice.pending,
  };
  lastShown = { key, chatId, line };
  for (const listener of listeners) listener(chatId, line);
}

/** Listens for lines; the line shown last (if any) arrives right away. */
export function subscribeAvatarGameLines(listener: GameLineListener): () => void {
  listeners.add(listener);
  if (lastShown) listener(lastShown.chatId, lastShown.line);
  return () => {
    listeners.delete(listener);
  };
}
