// Professor Mari's pane unmounts with the omnibar, so every open started from nothing: a skeleton, three
// requests in a row and a full render of the thread. This keeps the last thread she showed, and the Chats
// list the arrival routing read, for the page session. A reopen into the same thread draws at once and the
// fetch only refreshes it.
import type { Message } from "@marinara-engine/shared";
import { chooseMariThread, readMariThread, type MariThreadContext } from "./mari-arrival";

type MariThreadSummary = Parameters<typeof readMariThread>[0];

let lastThread: { chatId: string; messages: Message[] } | null = null;
let lastThreads: readonly MariThreadSummary[] | null = null;

export function rememberMariThread(chatId: string, messages: Message[]) {
  lastThread = { chatId, messages };
}

export function rememberMariThreads(threads: readonly MariThreadSummary[]) {
  lastThreads = threads;
}

/**
 * The thread to draw at once, or null. With an arrival still to route (R7), only when the routing would
 * pick that same thread from the last Chats list, so an open never flashes a thread it then leaves.
 */
export function cachedMariThread(
  route: { context: MariThreadContext; continuedThereId?: string | null } | null,
): { chatId: string; messages: Message[] } | null {
  if (!lastThread || !route) return lastThread;
  if (!lastThreads) return null;
  const choice = chooseMariThread({
    threads: lastThreads.map(readMariThread),
    contextKey: route.context.key,
    continuedThereId: route.continuedThereId,
  });
  const target = choice.kind === "continue" ? choice.chatId : choice.kind === "ask" ? choice.recentChatId : null;
  return target === lastThread.chatId ? lastThread : null;
}

/**
 * The fresh list, reusing each message object whose data did not change, so the memoized rows of a long
 * thread do not all render again after a reload. Returns `previous` itself when nothing changed.
 */
export function keepUnchangedMessages(previous: readonly Message[], next: Message[]): Message[] {
  const byId = new Map(previous.map((message) => [message.id, message]));
  let unchanged = previous.length === next.length;
  const merged = next.map((message, index) => {
    const old = byId.get(message.id);
    const kept = old && JSON.stringify(old) === JSON.stringify(message) ? old : message;
    if (kept !== previous[index]) unchanged = false;
    return kept;
  });
  return unchanged ? (previous as Message[]) : merged;
}
