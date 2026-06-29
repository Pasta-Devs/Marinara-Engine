// ──────────────────────────────────────────────
// Service: Cross-Chat Awareness
// ──────────────────────────────────────────────
// Builds an <awareness> context block for conversation mode.
// Pulls recent messages from OTHER chats that share a character,
// so the character naturally "remembers" what's happening elsewhere.
// ──────────────────────────────────────────────

import { eq } from "drizzle-orm";
import type { DB } from "../../db/connection.js";
import { chats, messages } from "../../db/schema/index.js";
import { createCharactersStorage } from "../storage/characters.storage.js";
import { formatZonedConversationDate, formatZonedConversationTime, isSameZonedLogicalDay } from "./timezone.js";
import { escapeXmlText } from "../prompt/prompt-escaping.js";

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
  personaId: string | null;
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
function fmtTime(iso: string, timeZone?: string): string {
  return formatZonedConversationTime(new Date(iso), timeZone);
}

/**
 * Format a date as DD.MM.YYYY.
 */
function fmtDate(iso: string, timeZone?: string): string {
  return formatZonedConversationDate(new Date(iso), timeZone);
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
  timeZone?: string,
): Promise<string | null> {
  if (characterIds.length === 0) return null;

  // 1. Find all OTHER conversation chats that share at least one character
  const siblingChats: ChatRow[] = [];
  const conversationChats = await db
    .select({
      id: chats.id,
      name: chats.name,
      characterIds: chats.characterIds,
      mode: chats.mode,
      personaId: chats.personaId,
    })
    .from(chats)
    .where(eq(chats.mode, "conversation"));
  for (const charId of characterIds) {
    for (const r of conversationChats) {
      let chatCharacterIds: string[] = [];
      try {
        chatCharacterIds = JSON.parse(r.characterIds);
      } catch {
        chatCharacterIds = [];
      }
      if (!chatCharacterIds.includes(charId)) continue;
      if (r.id !== currentChatId && !siblingChats.some((s) => s.id === r.id)) {
        siblingChats.push(r);
      }
    }
  }

  if (siblingChats.length === 0) return null;

  // 2. Detect time windows from user message
  const rawWindows = detectTimeWindows(userMessage);
  const windows = mergeWindows(rawWindows);

  const isWithinRequestedWindow = (createdAt: string) => {
    const timestamp = new Date(createdAt).getTime();
    return windows.some((window) => timestamp >= window.start.getTime() && timestamp <= window.end.getTime());
  };

  // 3. Pull messages from sibling chats within the time windows
  const charStorage = createCharactersStorage(db);
  const personas = await charStorage.listPersonas();
  const activePersona = personas.find((persona) => persona.isActive === "true");
  const resolveChatPersonaName = (chat: ChatRow): string => {
    const persona = chat.personaId ? personas.find((entry) => entry.id === chat.personaId) : activePersona;
    return persona?.name || userName;
  };

  const chatMessages = new Map<
    string,
    { chatName: string; members: string[]; userName: string; messages: MessageRow[] }
  >();

  for (const chat of siblingChats) {
    const charIds: string[] = JSON.parse(chat.characterIds);
    const memberNames = charIds.map((id) => characterNames.get(id) ?? "Unknown");
    const chatUserName = resolveChatPersonaName(chat);
    memberNames.push(chatUserName);

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
      .where(eq(messages.chatId, chat.id))
      .orderBy(messages.createdAt)) as MessageRow[];
    const filteredRows = rows.filter((row) => isWithinRequestedWindow(row.createdAt));

    if (filteredRows.length > 0) {
      chatMessages.set(chat.id, {
        chatName: chat.name,
        members: memberNames,
        userName: chatUserName,
        messages: filteredRows,
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
    const header = `\n## ${escapeXmlText(data.chatName)} (${data.members.map(escapeXmlText).join(", ")})\n`;

    if (charCount + header.length > maxChars) break;
    block += header;
    charCount += header.length;

    for (const burst of bursts) {
      // Check if this burst from a different day than the previous needs a date header
      const burstDate = fmtDate(burst[0]!.createdAt, timeZone);
      const dateHeader = `[${burstDate}]\n`;
      if (charCount + dateHeader.length > maxChars) break;

      // Only add date header if the burst is not from today
      const today = new Date();
      const burstDay = new Date(burst[0]!.createdAt);
      const isToday = isSameZonedLogicalDay(burstDay, today, timeZone);

      if (!isToday) {
        block += dateHeader;
        charCount += dateHeader.length;
      }

      for (const msg of burst) {
        const senderName =
          msg.role === "user"
            ? data.userName
            : msg.characterId
              ? (characterNames.get(msg.characterId) ?? "Unknown")
              : "Unknown";
        const line = `[${fmtTime(msg.createdAt, timeZone)}] ${escapeXmlText(senderName)}: ${escapeXmlText(msg.content)}\n`;

        if (charCount + line.length > maxChars) break;
        block += line;
        charCount += line.length;
      }
    }
  }

  return `<awareness>\n${block}</awareness>`;
}
