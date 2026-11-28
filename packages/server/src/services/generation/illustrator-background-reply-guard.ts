// ──────────────────────────────────────────────
// Illustrator background writes that belong to one reply
//
// A background tail runs after its reply. When replies overlap, an older tail can finish after a
// newer reply settled the picture. These writes check, inside the chat's queued metadata write,
// that the tail's reply (and swipe) is still the newest message. A new reply or swipe saved after
// that write is still outside it; that reply's own tail then sets the picture.
// ──────────────────────────────────────────────

type Metadata = Record<string, unknown>;

/** The part of the chats storage these writes use. */
export interface ReplyGuardChats {
  listMessagesPaginated(
    chatId: string,
    limit: number,
  ): Promise<Array<{ id: string; activeSwipeIndex?: number | null }>>;
  patchMetadata(chatId: string, updater: (current: Metadata) => Promise<Metadata> | Metadata): Promise<unknown>;
}

export interface BackgroundReply {
  chatId: string;
  messageId: string;
  swipeIndex: number;
}

/** Whether the reply (and swipe) is still the newest message of its chat. */
export async function backgroundReplyIsNewest(chats: ReplyGuardChats, reply: BackgroundReply): Promise<boolean> {
  const [newest] = await chats.listMessagesPaginated(reply.chatId, 1).catch(() => []);
  return !newest || (newest.id === reply.messageId && (newest.activeSwipeIndex ?? 0) === reply.swipeIndex);
}

/**
 * Show a picture only while the chat still shows `before`, the run isn't stopped and the reply is
 * still the newest. True when it was shown.
 */
export async function showBackgroundIfUnchanged(
  chats: ReplyGuardChats,
  reply: BackgroundReply,
  filename: string,
  before: string | null,
  aborted: () => boolean,
): Promise<boolean> {
  let shown = false;
  await chats.patchMetadata(reply.chatId, async (current) => {
    const now = typeof current.background === "string" && current.background.trim() ? current.background.trim() : null;
    if (now !== before || aborted() || !(await backgroundReplyIsNewest(chats, reply))) return {};
    shown = true;
    return { background: filename };
  });
  return shown;
}

/**
 * Save the Decision model's weather and time picks (the fallback for later replies) only while the
 * reply is still the newest, so an older reply finishing late can't overwrite a newer pick.
 */
export async function saveDecisionPicksIfNewest(
  chats: ReplyGuardChats,
  reply: BackgroundReply,
  picks: { weather?: string | null; time?: string | null },
): Promise<void> {
  if (!picks.weather && !picks.time) return;
  await chats.patchMetadata(reply.chatId, async (current) => {
    if (!(await backgroundReplyIsNewest(chats, reply))) return {};
    return {
      illustratorDecisionWeather: picks.weather || current.illustratorDecisionWeather,
      illustratorDecisionTime: picks.time || current.illustratorDecisionTime,
    };
  });
}
