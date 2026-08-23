// Convo schedules are owned by the character card, not by each chat. A chat's
// `metadata.characterSchedules` is only a resolved cache. This regression pins
// the two behaviors that move depends on:
//   1. a legacy chat-only schedule is hoisted onto the character card, and
//   2. a schedule saved on the character resolves into every chat that has it.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { WeekSchedule } from "../../packages/shared/src/utils/conversation-presence.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-character-schedule-ownership-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/** Monday of the current week, so `scheduleNeedsRefresh` treats it as fresh. */
function currentWeekStart(): string {
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString();
}

function makeSchedule(activity: string): WeekSchedule {
  return {
    weekStart: currentWeekStart(),
    days: Object.fromEntries(DAYS.map((day) => [day, [{ time: "09:00-17:00", activity, status: "dnd" as const }]])),
    inactivityThresholdMinutes: 90,
    talkativeness: 70,
  };
}

let app: { close(): Promise<void> } | null = null;

try {
  const { buildApp } = await import("../../packages/server/src/app.js");
  const { getDB } = await import("../../packages/server/src/db/connection.js");
  const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
  const { createCharactersStorage } = await import("../../packages/server/src/services/storage/characters.storage.js");

  app = await buildApp();
  const db = await getDB();
  const chats = createChatsStorage(db);
  const chars = createCharactersStorage(db);

  const character = await chars.create({ name: "Il Dottore", description: "", personality: "" } as never);
  assert.ok(character, "character was created");
  const characterId = character!.id;

  const readCardSchedule = async (): Promise<WeekSchedule | undefined> => {
    const row = await chars.getById(characterId);
    const data = JSON.parse(row!.data as string) as { extensions?: { conversationSchedule?: WeekSchedule } };
    return data.extensions?.conversationSchedule;
  };

  // ── 1. Legacy hoist: schedule lives only in a chat's metadata ──
  const legacy = makeSchedule("Legacy research");
  const legacyChat = await chats.create({
    name: "Legacy chat",
    mode: "conversation",
    characterIds: [characterId],
  } as never);
  await chats.patchMetadata(legacyChat!.id, {
    conversationSchedulesEnabled: true,
    characterSchedules: { [characterId]: legacy },
  });
  assert.equal(await readCardSchedule(), undefined, "card starts with no schedule");

  const legacyResolved = (await chats.resolveConversationPresenceState(legacyChat!.id)).schedules;
  assert.deepEqual(legacyResolved[characterId], legacy, "legacy chat keeps its schedule");
  assert.deepEqual(await readCardSchedule(), legacy, "legacy schedule is hoisted onto the card");

  // ── 2. The card is the source of truth for every other chat ──
  const shared = makeSchedule("Shared lab work");
  const row = await chars.getById(characterId);
  const cardData = JSON.parse(row!.data as string) as { extensions?: Record<string, unknown> };
  await chars.update(
    characterId,
    { extensions: { ...(cardData.extensions ?? {}), conversationSchedule: shared } } as never,
    undefined,
    { skipVersionSnapshot: true },
  );

  const otherChat = await chats.create({
    name: "Other chat",
    mode: "conversation",
    characterIds: [characterId],
  } as never);
  const otherResolved = (await chats.resolveConversationPresenceState(otherChat!.id)).schedules;
  assert.deepEqual(otherResolved[characterId], shared, "a new chat resolves the card's schedule");

  const legacyRefreshed = (await chats.resolveConversationPresenceState(legacyChat!.id)).schedules;
  assert.deepEqual(legacyRefreshed[characterId], shared, "the existing chat picks up the card's newer schedule");

  // ── 3. The per-chat kill switch is scoped to that chat ──
  await chats.patchMetadata(otherChat!.id, { conversationSchedulesEnabled: false, characterSchedules: {} });
  assert.deepEqual(
    (await chats.resolveConversationPresenceState(otherChat!.id)).schedules,
    {},
    "disabled chat resolves nothing",
  );
  assert.deepEqual(await readCardSchedule(), shared, "disabling one chat leaves the card intact");
  assert.deepEqual(
    (await chats.resolveConversationPresenceState(legacyChat!.id)).schedules[characterId],
    shared,
    "the other chat still resolves the schedule",
  );

  // ── 4. An unset flag means off, so a character gaining a schedule does not
  //       silently switch schedules on in a chat that never used them ──
  const optOutChat = await chats.create({
    name: "Never used schedules",
    mode: "conversation",
    characterIds: [],
  } as never);
  await chats.update(optOutChat!.id, { characterIds: [characterId] } as never);
  assert.deepEqual(
    (await chats.resolveConversationPresenceState(optOutChat!.id)).schedules,
    {},
    "a chat that never opted in stays off",
  );

  // ── 5. Presence in a chat with schedules off is always-online and never
  //       falls through to the character's global schedule-derived status ──
  const { resolveLiveConversationStatus } =
    await import("../../packages/client/src/lib/conversation-presence-status.js");
  assert.deepEqual(
    resolveLiveConversationStatus(
      { conversationSchedulesEnabled: false, characterSchedules: {} },
      characterId,
      new Date(),
    ),
    { status: "online", activity: "" },
    "a disabled chat reports online rather than deferring to the card",
  );

  // ── 6. A manual presence override belongs to the character too ──
  const cardWithOverride = await chars.getById(characterId);
  const overrideExtensions = (JSON.parse(cardWithOverride!.data as string) as { extensions?: Record<string, unknown> })
    .extensions;
  const beforeVersion = (JSON.parse(cardWithOverride!.data as string) as { character_version: string })
    .character_version;
  await chars.update(
    characterId,
    {
      extensions: {
        ...(overrideExtensions ?? {}),
        conversationStatusOverride: { status: "dnd", activity: "heads down", createdAt: new Date().toISOString() },
      },
    } as never,
    undefined,
    { skipVersionSnapshot: true },
  );

  const legacyPresence = await chats.resolveConversationPresenceState(legacyChat!.id);
  assert.equal(legacyPresence.statusOverrides[characterId]?.status, "dnd", "the override reaches one chat");
  const otherPresence = await chats.resolveConversationPresenceState(otherChat!.id);
  assert.equal(
    otherPresence.statusOverrides[characterId]?.status,
    "dnd",
    "the override reaches a chat with schedules switched off",
  );

  // ── 7. Schedule and presence are runtime state, so they never bump the card
  //       version or snapshot a revision ──
  const bumped = await chars.getById(characterId);
  assert.equal(
    (JSON.parse(bumped!.data as string) as { character_version: string }).character_version,
    beforeVersion,
    "a presence write leaves the card version alone",
  );
  const withSchedule = JSON.parse(bumped!.data as string) as { extensions: Record<string, unknown> };
  await chars.update(characterId, {
    extensions: { ...withSchedule.extensions, conversationSchedule: makeSchedule("Rewritten") },
  } as never);
  const afterScheduleEdit = await chars.getById(characterId);
  assert.equal(
    (JSON.parse(afterScheduleEdit!.data as string) as { character_version: string }).character_version,
    beforeVersion,
    "editing only the schedule does not bump the card version",
  );
  await chars.update(characterId, { description: "Versioned description" } as never);
  const afterContentEdit = await chars.getById(characterId);
  assert.notEqual(
    (JSON.parse(afterContentEdit!.data as string) as { character_version: string }).character_version,
    beforeVersion,
    "ordinary card edits bump the card version",
  );

  console.log("character-schedule-ownership regression passed");
} finally {
  await app?.close();
  rmSync(dataDir, { recursive: true, force: true });
}
