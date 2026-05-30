import type { StorageListOptions } from "../../../../engine/capabilities/storage";
import type { Message } from "../../../../engine/contracts/types/chat";

const CHAT_MESSAGE_TIMELINE_FIELDS = [
  "id",
  "chatId",
  "role",
  "content",
  "characterId",
  "name",
  "displayName",
  "characterName",
  "activeSwipeIndex",
  "swipeCount",
  "rowid",
  "extra",
  "createdAt",
];

const CHAT_MESSAGE_TIMELINE_EXTRA_FIELDS = [
  "displayText",
  "isGenerated",
  "tokenCount",
  "generationInfo",
  "thinking",
  "reasoning",
  "reasoning_content",
  "spriteExpressions",
  "cyoaChoices",
  "contextInjections",
  "chatSummaryFingerprint",
  "generationReplay",
  "generationPromptSnapshot",
  "attachments",
  "personaSnapshot",
  "hiddenFromUser",
  "hiddenFromAI",
  "hiddenFromAi",
  "isConversationStart",
  "generationError",
  "translation",
];

type TimelineMessageOptions = Omit<StorageListOptions, "filters">;

function parseRecord(value: unknown): Record<string, unknown> {
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export function timelineMessageProjection(options: TimelineMessageOptions = {}): TimelineMessageOptions {
  return {
    ...options,
    fields: CHAT_MESSAGE_TIMELINE_FIELDS,
    fieldSelections: {
      ...options.fieldSelections,
      extra: CHAT_MESSAGE_TIMELINE_EXTRA_FIELDS,
    },
  };
}

export function sanitizeTimelineMessageRecord<T extends Record<string, unknown>>(record: T): T {
  const { swipes: _swipes, ...withoutSwipes } = record;
  const extra = parseRecord(withoutSwipes.extra);
  const { generationPromptSnapshotsBySwipe: _generationPromptSnapshotsBySwipe, ...timelineExtra } = extra;
  return {
    ...withoutSwipes,
    extra: timelineExtra,
  } as unknown as T;
}

export function sanitizeTimelineMessage<T extends Message | null | undefined>(message: T): T {
  if (!message || typeof message !== "object" || Array.isArray(message)) return message;
  return sanitizeTimelineMessageRecord(message as unknown as Record<string, unknown>) as unknown as T;
}
