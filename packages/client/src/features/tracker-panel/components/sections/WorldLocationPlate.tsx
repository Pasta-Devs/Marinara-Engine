import { cn } from "../../../../lib/utils";
import type { TrackerPanelSizeProfile } from "../../../../stores/ui.store";
import { useTrackerFieldLock } from "../TrackerLockContext";
import { WorldRenderedEdit, WorldValueText } from "./WorldEditableTile";

export function WorldLocationPlate({
  value,
  onSave,
  lockKey,
  sizeProfile,
}: {
  value: string | null | undefined;
  onSave: (value: string) => void;
  lockKey?: string;
  sizeProfile: TrackerPanelSizeProfile;
}) {
  const lock = useTrackerFieldLock(lockKey);
  const compact = sizeProfile === "compact";
  return (
    <WorldRenderedEdit
      label="Location"
      value={value}
      onSave={onSave}
      placeholder="Set location"
      className={cn(
        "flex min-w-0 items-center gap-1.5 rounded-sm px-1 pb-0.5 pt-0 text-left",
        compact && "px-0.5",
      )}
      inputClassName={cn("text-left text-sm", compact && "text-[0.8125rem]")}
      {...lock}
    >
      <WorldValueText
        value={value}
        maxLines={2}
        className={cn(
          "min-w-0 text-sm font-semibold leading-5 text-[var(--foreground)]",
          compact && "text-[0.8125rem] leading-4",
        )}
      />
    </WorldRenderedEdit>
  );
}
