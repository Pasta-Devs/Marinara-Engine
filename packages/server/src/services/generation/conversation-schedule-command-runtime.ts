import { currentRoomGeneration } from "../multiplayer/generation-policy.js";
import { resolveConversationTimeZone, toZonedWallClockDate } from "../conversation/timezone.js";
import {
  parseDuration,
  type CharacterCommand,
  type ScheduleUpdateCommand,
} from "../conversation/character-commands.js";
import { logger } from "../../lib/logger.js";
import { getEnabledConversationSchedules } from "./conversation-context-utils.js";

type ChatsStore = {
  getById(id: string): Promise<{ metadata?: unknown } | null>;
  updateMetadata(id: string, patch: Record<string, unknown>): Promise<unknown>;
  patchMetadata?(id: string, updater: (metadata: Record<string, unknown>) => Record<string, unknown>): Promise<unknown>;
};

type ScheduleBlock = {
  time: string;
  activity: string;
  status: string;
};

type WeekScheduleRecord = {
  days?: Record<string, ScheduleBlock[]>;
};

const DAYS_LIST = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

export async function handleConversationScheduleCommand(args: {
  command: CharacterCommand;
  characterId: string | null;
  chatId: string;
  chats: ChatsStore;
  sendUpdated: (data: Record<string, unknown>) => void;
}): Promise<boolean> {
  if (args.command.type !== "schedule_update") return false;
  const command = args.command as ScheduleUpdateCommand;
  if (!args.characterId || (!command.status && !command.activity)) return true;
  const room = currentRoomGeneration();
  if (room?.signal?.aborted) return false;
  if (
    room &&
    (room.chatId !== args.chatId || !room.characterIds.includes(args.characterId) || !args.chats.patchMetadata)
  )
    return false;

  const characterId = args.characterId;
  const updateSchedule = (metadata: Record<string, unknown>) => {
    const schedules = getEnabledConversationSchedules(metadata) as Record<string, WeekScheduleRecord>;
    const schedule = schedules[characterId];
    if (!schedule) return null;
    const nowDate = room ? toZonedWallClockDate(new Date(), resolveConversationTimeZone(metadata)) : new Date();
    const dayName = DAYS_LIST[(nowDate.getDay() + 6) % 7]!;
    const daySchedule = schedule.days?.[dayName] ?? [];
    if (!updateCurrentScheduleBlock(daySchedule, nowDate.getHours() * 60 + nowDate.getMinutes(), command)) return null;
    schedule.days = { ...(schedule.days ?? {}), [dayName]: daySchedule };
    schedules[characterId] = schedule;
    return { characterSchedules: schedules };
  };
  let updated = false;
  if (room) {
    await args.chats.patchMetadata!(args.chatId, (metadata) => {
      const active = parseRecord(metadata.multiplayer);
      if (room.signal?.aborted || active?.status !== "active" || active.epoch !== room.epoch) return {};
      const patch = updateSchedule(metadata);
      updated = !!patch;
      return patch ?? {};
    });
  } else {
    const freshChat = await args.chats.getById(args.chatId);
    const freshMeta = parseRecord(freshChat?.metadata) ?? {};
    const patch = updateSchedule(freshMeta);
    if (patch) {
      await args.chats.updateMetadata(args.chatId, { ...freshMeta, ...patch });
      updated = true;
    }
  }
  if (!updated) return true;

  args.sendUpdated({ characterId: args.characterId, status: command.status, activity: command.activity });
  logger.info(
    "[commands] Schedule updated for %s: status=%s, activity=%s",
    args.characterId,
    command.status,
    command.activity,
  );

  return true;
}

function updateCurrentScheduleBlock(
  daySchedule: ScheduleBlock[],
  currentMinutes: number,
  command: ScheduleUpdateCommand,
): boolean {
  for (const block of daySchedule) {
    const [startStr, endStr] = block.time.split("-");
    if (!startStr || !endStr) continue;
    const [sh, sm] = startStr.split(":").map(Number);
    const [eh, em] = endStr.split(":").map(Number);
    if (![sh, sm, eh, em].every((part) => Number.isFinite(part))) continue;
    const startMin = (sh ?? 0) * 60 + (sm ?? 0);
    const endMin = (eh ?? 0) * 60 + (em ?? 0);
    if (startMin > currentMinutes || currentMinutes >= endMin) continue;

    if (command.status) block.status = command.status;
    if (command.activity) block.activity = command.activity;

    if (command.duration) {
      const durationMin = parseDuration(command.duration);
      if (durationMin && currentMinutes + durationMin < endMin) {
        const splitTime = currentMinutes + durationMin;
        const splitH = String(Math.floor(splitTime / 60)).padStart(2, "0");
        const splitM = String(splitTime % 60).padStart(2, "0");
        block.time = `${startStr}-${splitH}:${splitM}`;
        const idx = daySchedule.indexOf(block);
        daySchedule.splice(idx + 1, 0, {
          time: `${splitH}:${splitM}-${endStr}`,
          activity: "free time",
          status: "online",
        });
      }
    }
    return true;
  }
  return false;
}

function parseRecord(value: unknown): Record<string, unknown> | null {
  if (!value) return null;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }
  return typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}
