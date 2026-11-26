// ──────────────────────────────────────────────
// Per-message user marks: bookmarks, context pins and private notes
// ──────────────────────────────────────────────
// All three live in the message's `extra` JSON (message-level, mirrored to every swipe).
// Bookmarks are reader-only. A note enters no prompt unless the user shares it with one
// character, who then sees it with that message. Pins only change which history rows
// survive the chat's context message limit.

/** Most messages one chat may pin into its prompt context. */
export const MAX_PINNED_CONTEXT_MESSAGES = 10;

/** Chat setting `historyDropStep`: how many old messages leave the prompt at once when a limit is hit. */
export const HISTORY_DROP_STEP = { MIN: 1, MAX: 100, SUGGESTED: 10 } as const;

/** Read a chat's `historyDropStep`; anything unset or invalid means 1 (one message at a time). */
export function normalizeHistoryDropStep(value: unknown): number {
  const parsed = Math.floor(Number(value));
  if (!Number.isFinite(parsed) || parsed < HISTORY_DROP_STEP.MIN) return HISTORY_DROP_STEP.MIN;
  return Math.min(HISTORY_DROP_STEP.MAX, parsed);
}

/**
 * How many of the oldest of `total` messages to leave out so at most `keep` remain, rounded up to a whole
 * number of `step`s. With a step of 10 the start of the history stays put for about ten new messages and then
 * jumps ten at once, instead of moving every turn; a prompt cache keyed on that start keeps hitting in between.
 * The count is taken from the oldest message, so the same chat gives the same cut on every turn.
 */
export function steppedDropCount(total: number, keep: number, step: number): number {
  const overflow = Math.floor(total) - Math.max(0, Math.floor(keep));
  if (overflow <= 0) return 0;
  const size = normalizeHistoryDropStep(step);
  return Math.min(Math.floor(total), Math.ceil(overflow / size) * size);
}

/**
 * The smallest message limit that never cuts history between two automatic summaries when summarised messages are
 * hidden: the messages kept after a summary, plus the user and assistant messages until the next one (`every` counts
 * user messages, so about twice as many in all), plus one step when old messages drop in steps. Below it the limit
 * starts dropping messages on ordinary turns, and each drop is another prompt-cache rewrite.
 */
export function summaryFriendlyMessageLimit(input: { tail: number; every: number; step: number }): number {
  const step = normalizeHistoryDropStep(input.step);
  return Math.max(0, Math.floor(input.tail)) + 2 * Math.max(1, Math.floor(input.every)) + (step > 1 ? step : 0);
}
export const MAX_BOOKMARK_LABEL_LENGTH = 80;
export const MAX_PRIVATE_NOTE_LENGTH = 2000;
/** Trashed messages older than this are purged automatically. */
export const MESSAGE_TRASH_RETENTION_DAYS = 30;
/** Line prefixed to a pinned message that was restored from outside the context message limit. */
export const PINNED_CONTEXT_MESSAGE_MARKER = "[Pinned message from earlier in the chat]";

export interface MessageBookmark {
  /** Optional short user label shown in the Bookmarks list. */
  label?: string | null;
  createdAt: string;
}

/** Extra keys that belong to the whole message, not one swipe. */
export const MESSAGE_MARK_EXTRA_KEYS = [
  "bookmark",
  "pinnedToContext",
  "privateNote",
  "privateNoteRecipientId",
] as const;

function readExtraRecord(extra: unknown): Record<string, unknown> {
  if (!extra) return {};
  if (typeof extra === "string") {
    try {
      const parsed: unknown = JSON.parse(extra);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return typeof extra === "object" && !Array.isArray(extra) ? (extra as Record<string, unknown>) : {};
}

export function readMessageBookmark(extra: unknown): MessageBookmark | null {
  const value = readExtraRecord(extra).bookmark;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const label = typeof record.label === "string" && record.label.trim() ? record.label.trim() : null;
  const createdAt = typeof record.createdAt === "string" ? record.createdAt : "";
  return { label, createdAt };
}

export function isMessagePinnedToContext(extra: unknown): boolean {
  return readExtraRecord(extra).pinnedToContext === true;
}

export function readMessagePrivateNote(extra: unknown): string | null {
  const value = readExtraRecord(extra).privateNote;
  return typeof value === "string" && value.trim() ? value : null;
}

/** The one character the user shared this message's note with, or null while it stays private. */
export function readMessagePrivateNoteRecipientId(extra: unknown): string | null {
  const value = readExtraRecord(extra).privateNoteRecipientId;
  return typeof value === "string" && value ? value : null;
}

/**
 * Validate a client patch for the mark keys. Returns the normalized patch, or an
 * error string. Keys other than the mark keys pass through untouched.
 */
export function normalizeMessageMarkPatch(
  partial: Record<string, unknown>,
  now: () => string = () => new Date().toISOString(),
): { patch: Record<string, unknown> } | { error: string } {
  const patch = { ...partial };
  if (Object.prototype.hasOwnProperty.call(patch, "bookmark")) {
    const value = patch.bookmark;
    if (value === null || value === false) {
      patch.bookmark = null;
    } else if (value === true || (value && typeof value === "object" && !Array.isArray(value))) {
      const record = value === true ? {} : (value as Record<string, unknown>);
      if (record.label !== undefined && record.label !== null && typeof record.label !== "string")
        return { error: "bookmark.label must be a string" };
      const label = typeof record.label === "string" ? record.label.trim().slice(0, MAX_BOOKMARK_LABEL_LENGTH) : "";
      patch.bookmark = {
        label: label || null,
        createdAt: typeof record.createdAt === "string" && record.createdAt ? record.createdAt : now(),
      } satisfies MessageBookmark;
    } else {
      return { error: "bookmark must be an object or null" };
    }
  }
  if (Object.prototype.hasOwnProperty.call(patch, "pinnedToContext")) {
    if (typeof patch.pinnedToContext !== "boolean") return { error: "pinnedToContext must be a boolean" };
  }
  if (Object.prototype.hasOwnProperty.call(patch, "privateNote")) {
    const value = patch.privateNote;
    if (value !== null && typeof value !== "string") return { error: "privateNote must be a string or null" };
    const trimmed = typeof value === "string" ? value.trim() : "";
    if (trimmed.length > MAX_PRIVATE_NOTE_LENGTH)
      return { error: `privateNote must be at most ${MAX_PRIVATE_NOTE_LENGTH} characters` };
    patch.privateNote = trimmed || null;
  }
  if (Object.prototype.hasOwnProperty.call(patch, "privateNoteRecipientId")) {
    const value = patch.privateNoteRecipientId;
    if (value !== null && (typeof value !== "string" || !value || value.length > 200))
      return { error: "privateNoteRecipientId must be a character ID or null" };
  }
  return { patch };
}

/** Remove the private note from an extra record (exports, copies shared with others). */
export function stripPrivateMessageNote<T extends Record<string, unknown>>(extra: T): T {
  if (
    !Object.prototype.hasOwnProperty.call(extra, "privateNote") &&
    !Object.prototype.hasOwnProperty.call(extra, "privateNoteRecipientId")
  )
    return extra;
  const { privateNote: _privateNote, privateNoteRecipientId: _recipient, ...rest } = extra;
  return rest as T;
}

/**
 * Apply a chat's context message limit while keeping pinned messages.
 *
 * Returns the last `limit` messages, preceded by up to `maxPinned` of the newest pinned
 * messages that the limit would have dropped. Those restored rows are shallow copies with
 * {@link PINNED_CONTEXT_MESSAGE_MARKER} prefixed to their content so the model can tell the
 * history skips ahead after them; everything else is returned by reference. Chronological
 * order is preserved because every restored row predates the kept window.
 */
export function applyContextMessageLimitWithPins<T extends { content?: unknown; extra?: unknown }>(
  messages: readonly T[],
  limit: number | null | undefined,
  maxPinned = MAX_PINNED_CONTEXT_MESSAGES,
  step = 1,
): T[] {
  if (typeof limit !== "number" || !Number.isFinite(limit)) {
    return [...messages];
  }
  const normalizedLimit = Math.floor(limit);
  if (normalizedLimit <= 0 || messages.length <= normalizedLimit) return [...messages];
  // Never drop the newest message, even when a step is larger than the limit.
  const cut = Math.min(messages.length - 1, steppedDropCount(messages.length, normalizedLimit, step));
  const kept = messages.slice(cut);
  if (maxPinned <= 0) return kept;
  const pinned = messages
    .slice(0, cut)
    .filter((message) => isMessagePinnedToContext(message.extra))
    .slice(-maxPinned)
    .map((message) => ({
      ...message,
      content: `${PINNED_CONTEXT_MESSAGE_MARKER}\n${typeof message.content === "string" ? message.content : ""}`,
    }));
  return [...pinned, ...kept];
}

/** A message moved to its chat's trash (list view; the stored snapshot stays server-side). */
export interface MessageTrashEntry {
  id: string;
  chatId: string;
  messageId: string;
  role: "user" | "assistant" | "system" | "narrator";
  characterId: string | null;
  /** Active swipe content at deletion time. */
  content: string;
  swipeCount: number;
  messageCreatedAt: string;
  deletedAt: string;
  /** When the automatic purge removes this entry. */
  expiresAt: string;
}
