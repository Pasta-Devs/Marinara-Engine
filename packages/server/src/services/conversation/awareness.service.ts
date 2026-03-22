// ──────────────────────────────────────────────
// Service: Cross-Chat Awareness
// ──────────────────────────────────────────────
// Builds an <awareness> context block for conversation mode.
// Pulls recent messages from OTHER chats that share a character,
// so the character naturally "remembers" what's happening elsewhere.
// ──────────────────────────────────────────────

import { eq, and, desc, sql } from "drizzle-orm";
import type { DB } from "../../db/connection.js";
import { chats, messages } from "../../db/schema/index.js";

// ── Temporal keyword patterns ──
// Maps regex patterns in the user's message to time windows to pull from.
const TEMPORAL_PATTERNS: Array<{ pattern: RegExp; getWindow: () => { start: Date; end: Date } }> = [
  {
    pattern: /\byesterday\b|\blast\s+night\b/i,
    getWindow: () => {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      d.setHours(0, 0, 0, 0);
      const end = new Date(d);
      end.setHours(23, 59, 59, 999);
      return { start: d, end };
    },
  },
  {
    pattern: /\bearlier\s+today\b|\bthis\s+morning\b|\bthis\s+afternoon\b|\btoday\b/i,
    getWindow: () => {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      return { start: d, end: new Date() };
    },
  },
  {
    pattern: /\blast\s+week\b|\bthis\s+week\b/i,
    getWindow: () => {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      d.setHours(0, 0, 0, 0);
      return { start: d, end: new Date() };
    },
  },
  {
    pattern: /\bthe\s+other\s+day\b|\brecently\b|\bfew\s+days\s+ago\b/i,
    getWindow: () => {
      const d = new Date();
      d.setDate(d.getDate() - 3);
      d.setHours(0, 0, 0, 0);
      return { start: d, end: new Date() };
    },
  },
];

/** Default window: last 1 hour */
function defaultWindow(): { start: Date; end: Date } {
  const end = new Date();
  const start = new Date(end.getTime() - 1 * 60 * 60 * 1000);
  return { start, end };
}

/**
 * Detect temporal keywords in a user message and return
 * all matching time windows (plus the default 2h window).
 */
function detectTimeWindows(userMessage: string): Array<{ start: Date; end: Date }> {
  const windows: Array<{ start: Date; end: Date }> = [defaultWindow()];
  for (const { pattern, getWindow } of TEMPORAL_PATTERNS) {
    if (pattern.test(userMessage)) {
      windows.push(getWindow());
    }
  }
  return windows;
}

/**
 * Merge overlapping time windows into a minimal set.
 */
function mergeWindows(windows: Array<{ start: Date; end: Date }>): Array<{ start: Date; end: Date }> {
  if (windows.length <= 1) return windows;
  const sorted = [...windows].sort((a, b) => a.start.getTime() - b.start.getTime());
  const merged: Array<{ start: Date; end: Date }> = [sorted[0]!];
  for (let i = 1; i < sorted.length; i++) {
    const prev = merged[merged.length - 1]!;
    const cur = sorted[i]!;
    if (cur.start.getTime() <= prev.end.getTime()) {
      prev.end = new Date(Math.max(prev.end.getTime(), cur.end.getTime()));
    } else {
      merged.push(cur);
    }
  }
  return merged;
}

interface ChatRow {
  id: string;
  name: string;
  characterIds: string;
  mode: string;
}

interface MessageRow {
  id: string;
  chatId: string;
  role: string;
  characterId: string | null;
  content: string;
  createdAt: string;
}

/**
 * Format a timestamp as HH:MM.
 */
function fmtTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/**
 * Format a date as DD.MM.YYYY.
 */
function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}

/**
 * Group messages into conversation bursts.
 * A gap of > 30 minutes between messages starts a new burst.
 */
function groupIntoBursts(msgs: MessageRow[]): MessageRow[][] {
  if (msgs.length === 0) return [];
  const BURST_GAP_MS = 30 * 60 * 1000;
  const bursts: MessageRow[][] = [[msgs[0]!]];
  for (let i = 1; i < msgs.length; i++) {
    const prev = msgs[i - 1]!;
    const cur = msgs[i]!;
    const gap = new Date(cur.createdAt).getTime() - new Date(prev.createdAt).getTime();
    if (gap > BURST_GAP_MS) {
      bursts.push([cur]);
    } else {
      bursts[bursts.length - 1]!.push(cur);
    }
  }
  return bursts;
}

/**
 * Build the <awareness> context block for a specific chat.
 *
 * @param db - Database connection
 * @param currentChatId - The chat we're currently generating for (excluded)
 * @param characterIds - Character IDs in the current chat
 * @param characterNames - Map of characterId → display name
 * @param userName - The user/persona name
 * @param userMessage - The user's latest message (for temporal keyword scanning)
 * @param maxTokenEstimate - Rough token budget (chars / 4). Default ~1500 tokens.
 */
export async function buildAwarenessBlock(
  db: DB,
  currentChatId: string,
  characterIds: string[],
  characterNames: Map<string, string>,
  userName: string,
  userMessage: string,
  maxTokenEstimate = 1500,
): Promise<string | null> {
  if (characterIds.length === 0) return null;

  // 1. Find all OTHER conversation chats that share at least one character
  const siblingChats: ChatRow[] = [];
  for (const charId of characterIds) {
    const rows = await db
      .select({
        id: chats.id,
        name: chats.name,
        characterIds: chats.characterIds,
        mode: chats.mode,
      })
      .from(chats)
      .where(
        and(
          sql`EXISTS (SELECT 1 FROM json_each(${chats.characterIds}) WHERE value = ${charId})`,
          eq(chats.mode, "conversation"),
        ),
      );
    for (const r of rows) {
      if (r.id !== currentChatId && !siblingChats.some((s) => s.id === r.id)) {
        siblingChats.push(r);
      }
    }
  }

  if (siblingChats.length === 0) return null;

  // 2. Detect time windows from user message
  const rawWindows = detectTimeWindows(userMessage);
  const windows = mergeWindows(rawWindows);

  // Build WHERE clauses for time windows
  const windowConditions = windows.map(
    (w) => `(created_at >= '${w.start.toISOString()}' AND created_at <= '${w.end.toISOString()}')`,
  );
  const timeFilter = windowConditions.join(" OR ");

  // 3. Pull messages from sibling chats within the time windows
  const chatMessages = new Map<string, { chatName: string; members: string[]; messages: MessageRow[] }>();

  for (const chat of siblingChats) {
    const charIds: string[] = JSON.parse(chat.characterIds);
    const memberNames = charIds.map((id) => characterNames.get(id) ?? "Unknown");
    memberNames.push(userName);

    const rows = (await db
      .select({
        id: messages.id,
        chatId: messages.chatId,
        role: messages.role,
        characterId: messages.characterId,
        content: messages.content,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .where(and(eq(messages.chatId, chat.id), sql.raw(`(${timeFilter})`)))
      .orderBy(messages.createdAt)) as MessageRow[];

    if (rows.length > 0) {
      chatMessages.set(chat.id, {
        chatName: chat.name,
        members: memberNames,
        messages: rows,
      });
    }
  }

  if (chatMessages.size === 0) return null;

  // 4. Format into the awareness block
  const maxChars = maxTokenEstimate * 4; // rough token → char estimate
  let block =
    "These are your other active conversations. You naturally remember what happens in them — reference or react to them as a real person would.\n";
  let charCount = block.length;

  for (const [, data] of chatMessages) {
    const bursts = groupIntoBursts(data.messages);
    const header = `\n## ${data.chatName} (${data.members.join(", ")})\n`;

    if (charCount + header.length > maxChars) break;
    block += header;
    charCount += header.length;

    for (const burst of bursts) {
      // Check if this burst from a different day than the previous needs a date header
      const burstDate = fmtDate(burst[0]!.createdAt);
      const dateHeader = `[${burstDate}]\n`;
      if (charCount + dateHeader.length > maxChars) break;

      // Only add date header if the burst is not from today
      const today = new Date();
      const burstDay = new Date(burst[0]!.createdAt);
      const isToday =
        burstDay.getFullYear() === today.getFullYear() &&
        burstDay.getMonth() === today.getMonth() &&
        burstDay.getDate() === today.getDate();

      if (!isToday) {
        block += dateHeader;
        charCount += dateHeader.length;
      }

      for (const msg of burst) {
        const senderName =
          msg.role === "user"
            ? userName
            : msg.characterId
              ? (characterNames.get(msg.characterId) ?? "Unknown")
              : "Unknown";
        const line = `[${fmtTime(msg.createdAt)}] ${senderName}: ${msg.content}\n`;

        if (charCount + line.length > maxChars) break;
        block += line;
        charCount += line.length;
      }
    }
  }

  return `<awareness>\n${block}</awareness>`;
}
