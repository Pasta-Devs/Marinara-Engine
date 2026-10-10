/**
 * Professor Mari's workspace session ids, and which Mari chat a review card belongs to.
 *
 * A Keep/Restore card belongs to the Mari chat whose run made the change, so that run's
 * database commands carry `professor-mari-workspace:<chatId>`. A review made anywhere else
 * (the `mari` CLI in a terminal, or a workspace run from before per-chat ids) names no chat
 * and shows in every Mari chat until it is kept, restored or expires (#6842).
 */
export const MARI_WORKSPACE_SESSION_ID = "professor-mari-workspace";

const CHAT_PREFIX = `${MARI_WORKSPACE_SESSION_ID}:`;

export function mariWorkspaceSessionId(chatId: string | null | undefined): string {
  return chatId ? `${CHAT_PREFIX}${chatId}` : MARI_WORKSPACE_SESSION_ID;
}

/** The Mari chat a review was made in, or null when no chat owns it. */
export function chatIdForMariSession(sessionId: string | null | undefined): string | null {
  if (typeof sessionId !== "string" || !sessionId.startsWith(CHAT_PREFIX)) return null;
  return sessionId.slice(CHAT_PREFIX.length) || null;
}

/** A review shows in its own chat, and one no chat owns shows everywhere. No chat named shows all. */
export function isMariReviewVisibleInChat(sessionId: string, chatId: string | null | undefined): boolean {
  const owner = chatIdForMariSession(sessionId);
  return owner === null || !chatId || owner === chatId;
}
