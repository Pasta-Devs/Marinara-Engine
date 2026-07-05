import { useMemo, useState } from "react";
import { CalendarClock, Pencil } from "lucide-react";
import {
  CONVERSATION_SCHEDULE_DAYS,
  type ConversationPresenceStatus,
  type WeekSchedule,
} from "@marinara-engine/shared";
import { cn } from "../../lib/utils";

type ConversationPresenceScheduleSectionProps = {
  characterId: string;
  schedule?: WeekSchedule;
  schedulesEnabled: boolean;
  hasGeneratedSchedules: boolean;
  onOpenScheduleEditor?: (characterId: string, options?: { initialDay?: string | null }) => void;
};

type UpcomingScheduleBlock = {
  day: string;
  dayOffset: number;
  blockIndex: number;
  time: string;
  activity: string;
  status: ConversationPresenceStatus;
  startsAt: number;
};

const STATUS_COLORS: Record<ConversationPresenceStatus, string> = {
  online: "bg-green-500",
  idle: "bg-yellow-500",
  dnd: "bg-red-500",
  offline: "bg-gray-400",
};

function statusLabel(status: ConversationPresenceStatus): string {
  return status === "offline" ? "Offline" : status === "dnd" ? "Busy" : status === "idle" ? "Away" : "Online";
}

function parseClock(value?: string): number | null {
  if (!value) return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
  if (hours < 0 || hours > 24 || minutes < 0 || minutes > 59) return null;
  if (hours === 24 && minutes !== 0) return null;
  return hours * 60 + minutes;
}

function formatScheduleTimeRange(value: string) {
  const [start, end] = value.split("-");
  const formatter = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
  const formatPart = (part?: string) => {
    const minutes = parseClock(part);
    if (minutes == null) return part ?? "";
    const date = new Date();
    date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
    return formatter.format(date);
  };
  const formattedStart = formatPart(start);
  const formattedEnd = formatPart(end);
  return formattedStart && formattedEnd ? `${formattedStart} - ${formattedEnd}` : value;
}

function getUpcomingScheduleBlocks(schedule?: WeekSchedule, limit = 4): UpcomingScheduleBlock[] {
  if (!schedule?.days) return [];
  const now = new Date();
  const todayIndex = (now.getDay() + 6) % 7;
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const upcoming: UpcomingScheduleBlock[] = [];

  for (let dayOffset = 0; dayOffset < CONVERSATION_SCHEDULE_DAYS.length; dayOffset += 1) {
    const dayIndex = (todayIndex + dayOffset) % CONVERSATION_SCHEDULE_DAYS.length;
    const day = CONVERSATION_SCHEDULE_DAYS[dayIndex]!;
    const blocks = schedule.days[day] ?? [];
    for (let blockIndex = 0; blockIndex < blocks.length; blockIndex += 1) {
      const block = blocks[blockIndex]!;
      const start = parseClock(block.time?.split("-")[0]);
      if (start == null) continue;
      if (dayOffset === 0 && start <= currentMinutes) continue;
      upcoming.push({
        day,
        dayOffset,
        blockIndex,
        time: block.time,
        activity: block.activity || statusLabel(block.status),
        status: block.status,
        startsAt: dayOffset * 1440 + start,
      });
    }
  }

  return upcoming.sort((left, right) => left.startsAt - right.startsAt).slice(0, limit);
}

function getScheduledDayCount(schedule?: WeekSchedule): number {
  if (!schedule?.days) return 0;
  return CONVERSATION_SCHEDULE_DAYS.filter((day) => (schedule.days[day] ?? []).length > 0).length;
}

type ScheduleSummary = { text: string; kind: "day-count" | "message" };

function getSummaryText(schedulesEnabled: boolean, hasGeneratedSchedules: boolean, schedule?: WeekSchedule): ScheduleSummary {
  const dayCount = getScheduledDayCount(schedule);
  if (!schedulesEnabled && !hasGeneratedSchedules) return { text: "Autonomous scheduling is off and no schedule has been generated yet.", kind: "message" };
  if (!schedulesEnabled) return { text: "Autonomous scheduling is off.", kind: "message" };
  if (!hasGeneratedSchedules || !schedule) return { text: "Autonomous scheduling is on, but no schedule has been generated yet.", kind: "message" };
  if (dayCount > 0) return { text: `${dayCount} day${dayCount === 1 ? "" : "s"} scheduled`, kind: "day-count" };
  return { text: "Schedule exists, but nothing is upcoming yet.", kind: "message" };
}

function dayLabel(block: UpcomingScheduleBlock): string {
  if (block.dayOffset === 0) return "Today";
  if (block.dayOffset === 1) return "Tomorrow";
  return block.day;
}

export function ConversationPresenceScheduleSection({
  characterId,
  schedule,
  schedulesEnabled,
  hasGeneratedSchedules,
  onOpenScheduleEditor,
}: ConversationPresenceScheduleSectionProps) {
  const [expanded, setExpanded] = useState(false);
  const upcomingBlocks = useMemo(() => getUpcomingScheduleBlocks(schedule, 3), [schedule]);
  const nextBlock = upcomingBlocks[0];
  const extraBlocks = upcomingBlocks.slice(1);
  const badge = schedulesEnabled ? (schedule ? "Active" : "Ready") : "Off";
  const summary = getSummaryText(schedulesEnabled, hasGeneratedSchedules, schedule);

  const openEditor = (day?: string | null) => {
    if (!onOpenScheduleEditor) return;
    onOpenScheduleEditor(characterId, { initialDay: day ?? null });
  };

  return (
    <div className="mt-2 rounded-lg bg-[var(--background)]/35 px-2.5 py-2 ring-1 ring-[var(--border)]/70">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[0.625rem] font-semibold text-[var(--foreground)]/82">
            <CalendarClock size="0.6875rem" />
            <span>Schedule</span>
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-[0.5625rem] font-medium ring-1",
                schedulesEnabled
                  ? "bg-green-500/10 text-green-500 ring-green-500/25"
                  : "bg-[var(--foreground)]/6 text-[var(--muted-foreground)] ring-[var(--border)]",
              )}
            >
              {badge}
            </span>
          </div>
          {summary.kind !== "day-count" && (
            <p className="mt-1 text-[0.625rem] leading-4 text-[var(--muted-foreground)]/82">{summary.text}</p>
          )}
        </div>

        {onOpenScheduleEditor && (
          <button
            type="button"
            onClick={() => openEditor()}
            className="inline-flex shrink-0 items-center gap-1 rounded-md bg-[var(--foreground)]/8 px-2 py-1 text-[0.625rem] font-medium text-[var(--foreground)]/78 ring-1 ring-[var(--border)] transition-colors hover:bg-[var(--foreground)]/12 hover:text-[var(--foreground)]"
          >
            <Pencil size="0.6875rem" /> Edit
          </button>
        )}
      </div>

      {nextBlock ? (
        <div className="mt-1.5 space-y-1">
          <div className="rounded-md bg-[var(--foreground)]/[0.025] px-1.5 py-1">
            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 text-[0.625rem] text-[var(--muted-foreground)]/86">
              <div className="flex min-w-0 items-center gap-1.5">
                <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", STATUS_COLORS[nextBlock.status])} />
                <span className="shrink-0 font-medium text-[var(--muted-foreground)]">Next</span>
                <span className="shrink-0 text-[var(--muted-foreground)]/55">·</span>
                <span className="shrink-0 font-medium text-[var(--muted-foreground)]">{dayLabel(nextBlock)}</span>
                <span className="shrink-0 text-[var(--muted-foreground)]/55">·</span>
                <span className="min-w-0 truncate tabular-nums">{formatScheduleTimeRange(nextBlock.time)}</span>
              </div>
              {extraBlocks.length > 0 && (
                <button
                  type="button"
                  aria-expanded={expanded}
                  onClick={() => setExpanded((value) => !value)}
                  className="rounded px-1.5 py-0.5 text-[0.5625rem] font-medium text-[var(--foreground)]/70 transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                >
                  {expanded ? "Hide" : `+${extraBlocks.length} more`}
                </button>
              )}
            </div>
            <div className="mt-0.5 break-words pl-3 text-[0.625rem] leading-4 text-[var(--muted-foreground)]/86">
              {nextBlock.activity}
            </div>
          </div>

          {expanded && extraBlocks.length > 0 && (
            <div className="space-y-1">
              {extraBlocks.map((block) => (
                <button
                  key={`${block.day}-${block.blockIndex}-${block.time}`}
                  type="button"
                  onClick={() => openEditor(block.day)}
                  className="w-full min-w-0 rounded-md bg-[var(--foreground)]/[0.025] px-1.5 py-1 text-left transition-colors hover:bg-[var(--accent)]/20"
                >
                  <div className="flex min-w-0 items-center gap-1.5 text-[0.625rem] text-[var(--muted-foreground)]/82">
                    <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", STATUS_COLORS[block.status])} />
                    <span className="shrink-0 font-medium">{dayLabel(block)}</span>
                    <span className="shrink-0 text-[var(--muted-foreground)]/55">·</span>
                    <span className="min-w-0 truncate tabular-nums">{formatScheduleTimeRange(block.time)}</span>
                  </div>
                  <div className="mt-0.5 break-words pl-3 text-[0.625rem] leading-4 text-[var(--muted-foreground)]/82">
                    {block.activity}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : schedule && schedulesEnabled ? (
        <div className="mt-1.5 text-[0.625rem] text-[var(--muted-foreground)]/82">No upcoming blocks</div>
      ) : null}
    </div>
  );
}
