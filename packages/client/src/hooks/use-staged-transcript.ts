import { useEffect, useState } from "react";
import { onNextIdle } from "../lib/idle-batch";

/** Rows mounted when a chat opens: enough to fill the screen above the composer. */
export const STAGED_OPENING_ROWS = 8;
/** Older rows added per idle moment until the whole loaded window is mounted. */
const STAGED_ROWS_STEP = 8;

type Stage = { chatId: string | null; cap: number | null };

/**
 * Opening a chat mounts its newest rows first and the older loaded ones over the next idle moments,
 * so the chat is readable before every row has been built. Returns the row cap for this render, or
 * null once everything is mounted. `skip` (a jump to a message, multi-select, a pinned window) mounts
 * everything at once and ends staging for this chat.
 */
export function useStagedTranscriptCap(chatId: string | null, loadedCount: number, skip: boolean): number | null {
  const [stage, setStage] = useState<Stage>({ chatId, cap: STAGED_OPENING_ROWS });
  let current = stage;
  if (stage.chatId !== chatId) {
    current = { chatId, cap: STAGED_OPENING_ROWS };
    setStage(current);
  }
  const staging = !skip && current.cap !== null && loadedCount > current.cap;

  // A short chat, or a skip, ends staging for good, so rows that arrive later never get capped.
  const finished = current.cap !== null && (skip || (loadedCount > 0 && loadedCount <= current.cap));
  useEffect(() => {
    if (finished) setStage((s) => (s.chatId === chatId ? { chatId, cap: null } : s));
  }, [finished, chatId]);

  useEffect(() => {
    if (!staging) return;
    return onNextIdle(() =>
      setStage((s) => {
        if (s.chatId !== chatId || s.cap === null) return s;
        const next = s.cap + STAGED_ROWS_STEP;
        return { chatId, cap: next >= loadedCount ? null : next };
      }),
    );
  }, [staging, chatId, loadedCount, current.cap]);

  return staging ? current.cap : null;
}
