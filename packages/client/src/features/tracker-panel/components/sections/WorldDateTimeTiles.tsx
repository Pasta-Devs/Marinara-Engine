import { cn } from "../../../../lib/utils";
import { WorldCalendarIcon } from "../../../../components/ui/WorldCalendarIcon";
import { WorldClockIcon } from "../../../../components/ui/WorldStateInstruments";
import type { TrackerPanelSizeProfile } from "../../../../stores/ui.store";
import type { WorldStatePresentation } from "../../lib/world-state-display";
import { useTrackerFieldLock } from "../TrackerLockContext";
import {
  WORLD_INSTRUMENT_TEXT_STYLE,
  WorldRenderedEdit,
  WorldValueText,
} from "./WorldEditableTile";

const WORLD_DATE_TIME_PROFILE_STYLES: Record<
  TrackerPanelSizeProfile,
  {
    shell: string;
    grid: string;
    clock: string;
    calendar: string;
    edit: string;
    time: string;
    date: string;
  }
> = {
  compact: {
    shell: "px-0",
    grid: "grid-cols-[1.25rem_minmax(0,1fr)]",
    clock: "h-4 w-4 opacity-80",
    calendar: "h-3.5 w-3.5 opacity-[0.58]",
    edit: "px-0.5",
    time: "text-sm leading-4",
    date: "text-xs leading-4",
  },
  standard: {
    shell: "pr-1",
    grid: "grid-cols-[1.5rem_minmax(0,1fr)]",
    clock: "h-5 w-5 opacity-85",
    calendar: "h-4 w-4 opacity-[0.62]",
    edit: "px-1",
    time: "text-[1.0625rem] leading-5",
    date: "text-[0.8125rem] leading-4",
  },
  expanded: {
    shell: "pr-1",
    grid: "grid-cols-[1.5rem_minmax(0,1fr)]",
    clock: "h-6 w-6 opacity-85",
    calendar: "h-5 w-5 opacity-[0.62]",
    edit: "px-1",
    time: "text-[1.1875rem] leading-6",
    date: "text-sm leading-5",
  },
};

export function WorldDateTimeTile({
  dateText,
  dateColor,
  dateDay,
  timeDisplay,
  onSaveDate,
  onSaveTime,
  dateLockKey,
  timeLockKey,
  sizeProfile,
}: {
  dateText: string;
  dateColor: string;
  dateDay: string | null;
  timeDisplay: WorldStatePresentation["time"];
  onSaveDate: (value: string) => void;
  onSaveTime: (value: string) => void;
  dateLockKey?: string;
  timeLockKey?: string;
  sizeProfile: TrackerPanelSizeProfile;
}) {
  const dateLock = useTrackerFieldLock(dateLockKey);
  const timeLock = useTrackerFieldLock(timeLockKey);
  const style = WORLD_DATE_TIME_PROFILE_STYLES[sizeProfile];
  return (
    <div className={cn("relative z-[1] min-h-16 min-w-0 overflow-hidden rounded-sm py-1", style.shell)}>
      <div className={cn("relative z-[1] grid min-h-14 min-w-0 grid-rows-[auto_auto] content-center", style.grid)}>
        <WorldClockIcon
          display={timeDisplay}
          variant="accented"
          className={cn(
            "pointer-events-none col-start-1 row-start-1 self-center justify-self-center text-[var(--tracker-world-time-accent)] drop-shadow-sm",
            style.clock,
          )}
        />
        {dateDay && (
          <WorldCalendarIcon
            day={dateDay}
            className={cn(
              "pointer-events-none col-start-1 row-start-2 self-center justify-self-center drop-shadow-sm",
              style.calendar,
              dateColor,
            )}
          />
        )}
        <WorldRenderedEdit
          label="Time"
          value={timeDisplay.raw}
          onSave={onSaveTime}
          placeholder="Set time"
          className={cn("col-start-2 row-start-1 w-full min-w-0 self-center rounded-sm py-0.5 text-left", style.edit)}
          inputClassName={cn(
            "text-left text-[var(--tracker-world-time-accent)]",
            WORLD_INSTRUMENT_TEXT_STYLE,
            style.time,
          )}
          {...timeLock}
        >
          <WorldValueText
            value={timeDisplay.raw}
            maxLines={timeDisplay.kind === "clock" ? 1 : 3}
            className={cn(
              "min-w-0 text-left text-[var(--tracker-world-time-accent)] drop-shadow-sm",
              WORLD_INSTRUMENT_TEXT_STYLE,
              style.time,
              timeDisplay.kind === "clock"
                ? "whitespace-nowrap [overflow-wrap:normal]"
                : "whitespace-pre-wrap break-words [overflow-wrap:anywhere]",
            )}
          />
        </WorldRenderedEdit>
        <WorldRenderedEdit
          label="Date"
          value={dateText}
          onSave={onSaveDate}
          placeholder="Set date"
          className={cn(
            "col-start-2 row-start-2 w-full min-w-0 justify-self-start overflow-hidden rounded-sm py-0.5 text-left",
            style.edit,
            sizeProfile === "compact" ? "pr-1" : "pr-2",
          )}
          inputClassName={cn(
            "text-left",
            WORLD_INSTRUMENT_TEXT_STYLE,
            style.date,
            sizeProfile === "compact" ? "pr-1" : "pr-2",
          )}
          {...dateLock}
        >
          <WorldValueText
            value={dateText}
            maxLines={2}
            className={cn(
              "relative z-[1] min-w-0 text-left text-[color-mix(in_srgb,var(--foreground)_86%,var(--muted-foreground))] drop-shadow-[0_1px_1px_color-mix(in_srgb,var(--background)_90%,transparent)]",
              WORLD_INSTRUMENT_TEXT_STYLE,
              style.date,
              "tracking-[0.015em]",
            )}
          />
        </WorldRenderedEdit>
      </div>
    </div>
  );
}
