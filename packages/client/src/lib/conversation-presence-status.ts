import {
  getActiveStatusOverride,
  getEffectiveCurrentStatus,
  toConversationScheduleWallClockDate,
  type ConversationPresenceStatus,
  type ConversationStatusOverride,
  type WeekSchedule,
} from "@marinara-engine/shared";

type ConversationPresenceMeta = {
  conversationSchedulesEnabled?: unknown;
  conversationTimeZone?: unknown;
  promptTimeZone?: unknown;
  characterSchedules?: unknown;
  conversationStatusOverrides?: unknown;
};

/**
 * Resolve a character's live conversation presence the same way the server's
 * status endpoint does — active manual override first, then the current schedule
 * block — so the chat-list sidebar and the in-chat overlay agree with the
 * presence pill instead of reading a generation-time snapshot.
 *
 * Returns `null` when there is no live signal (no active override and no
 * schedule in play), in which case the caller keeps the stored
 * `conversationCharacterStatuses` snapshot. This is the single gate both client
 * surfaces share, so they cannot drift on which metadata is allowed to drive
 * live status.
 *
 * The schedule gate deliberately mirrors the server's own contract — its status
 * endpoint reads schedules via `inheritFreshConversationSchedules`, which uses
 * them whenever `conversationSchedulesEnabled !== false`. Matching that exactly
 * keeps these surfaces consistent with the presence pill (a stricter client-only
 * rule would diverge from the pill for legacy/imported schedule-backed chats).
 * Overrides are validated by `getActiveStatusOverride` (status enum + expiry),
 * so a malformed or expired override falls through to the snapshot.
 */
export function resolveLiveConversationStatus(
  meta: ConversationPresenceMeta | null | undefined,
  characterId: string,
  now: Date,
): { status: ConversationPresenceStatus; activity: string } | null {
  if (!meta) return null;
  const override = (meta.conversationStatusOverrides as Record<string, ConversationStatusOverride> | undefined)?.[
    characterId
  ];
  const schedule =
    meta.conversationSchedulesEnabled !== false
      ? (meta.characterSchedules as Record<string, WeekSchedule> | undefined)?.[characterId]
      : undefined;
  if (!getActiveStatusOverride(override, now) && !schedule) return null;
  const timeZone =
    typeof meta.conversationTimeZone === "string"
      ? meta.conversationTimeZone
      : typeof meta.promptTimeZone === "string"
        ? meta.promptTimeZone
        : undefined;
  const scheduleNow = toConversationScheduleWallClockDate(now, timeZone);
  const { status, activity } = getEffectiveCurrentStatus(schedule, override, now, "free time", scheduleNow);
  return { status, activity };
}
