import { Lock, PanelLeft, PanelRight, Plus, Trash2, Unlock } from "lucide-react";
import { TrackerPanelIcon } from "../../../components/ui/TrackerPanelIcon";
import { TrackerSizeTierIcon } from "../../../components/ui/TrackerSizeTierIcon";
import type { TrackerPanelSide, TrackerPanelSizeProfile } from "../../../stores/ui.store";
import { cn } from "../../../lib/utils";
import { useTrackerLockContext } from "./TrackerLockContext";

const TRACKER_PANEL_SIZE_SEQUENCE: TrackerPanelSizeProfile[] = ["compact", "standard", "expanded"];
const TRACKER_PANEL_SIZE_LABELS: Record<TrackerPanelSizeProfile, string> = {
  compact: "Compact",
  standard: "Standard",
  expanded: "Expanded",
};
export function TrackerSidebarHeader({
  trackerPanelSide,
  sizeProfile,
  addMode,
  deleteMode,
  onSetAddMode,
  onSetDeleteMode,
  onSetSide,
  onSetSizeProfile,
  onClose,
}: {
  trackerPanelSide: TrackerPanelSide;
  sizeProfile: TrackerPanelSizeProfile;
  addMode: boolean;
  deleteMode: boolean;
  onSetAddMode: (enabled: boolean) => void;
  onSetDeleteMode: (enabled: boolean) => void;
  onSetSide: (side: TrackerPanelSide) => void;
  onSetSizeProfile: (profile: TrackerPanelSizeProfile) => void;
  onClose: () => void;
}) {
  const { lockMode, onSetLockMode } = useTrackerLockContext();
  const sizeIndex = Math.max(0, TRACKER_PANEL_SIZE_SEQUENCE.indexOf(sizeProfile));
  const nextSizeProfile = TRACKER_PANEL_SIZE_SEQUENCE[(sizeIndex + 1) % TRACKER_PANEL_SIZE_SEQUENCE.length]!;
  const sizeLabel = TRACKER_PANEL_SIZE_LABELS[sizeProfile];
  const nextSizeLabel = TRACKER_PANEL_SIZE_LABELS[nextSizeProfile];
  const sizeTitle = `Tracker panel size: ${sizeLabel}. Click for ${nextSizeLabel}.`;
  const closePanelButton = (
    <button
      type="button"
      onClick={onClose}
      title="Close trackers"
      aria-label="Close tracker panel"
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-sm bg-[var(--background)]/45 text-[var(--foreground)]/70 ring-1 ring-[var(--border)] transition-all hover:bg-[var(--accent)]/45 hover:text-[var(--foreground)] hover:ring-[var(--foreground)]/20 active:scale-90"
    >
      <TrackerPanelIcon size="1.05rem" strokeWidth={1.95} />
    </button>
  );

  const outerHeaderControls = (
    <div className={cn("flex shrink-0 items-center gap-1", trackerPanelSide === "left" && "flex-row-reverse")}>
      <button
        type="button"
        onClick={() => {
          const nextAddMode = !addMode;
          onSetAddMode(nextAddMode);
          if (nextAddMode) {
            onSetDeleteMode(false);
            onSetLockMode?.(false);
          }
        }}
        title={addMode ? "Exit add mode" : "Enter add mode"}
        aria-label={addMode ? "Exit tracker add mode" : "Enter tracker add mode"}
        aria-pressed={addMode}
        className={cn(
          "flex h-6 w-6 items-center justify-center rounded-sm transition-all ring-1 active:scale-90",
          addMode
            ? "bg-[var(--foreground)]/12 text-[var(--foreground)] ring-[var(--foreground)]/24"
            : "text-[var(--muted-foreground)]/55 ring-transparent hover:bg-[var(--accent)] hover:text-[var(--muted-foreground)] hover:ring-[var(--border)]",
        )}
      >
        <Plus size="0.75rem" />
      </button>
      <button
        type="button"
        onClick={() => {
          const nextLockMode = !lockMode;
          onSetLockMode?.(nextLockMode);
          if (nextLockMode) {
            onSetAddMode(false);
            onSetDeleteMode(false);
          }
        }}
        title={lockMode ? "Exit lock mode" : "Enter lock mode"}
        aria-label={lockMode ? "Exit tracker lock mode" : "Enter tracker lock mode"}
        aria-pressed={lockMode}
        className={cn(
          "flex h-6 w-6 items-center justify-center rounded-sm transition-all ring-1 active:scale-90",
          lockMode
            ? "bg-[var(--foreground)]/12 text-[var(--foreground)] ring-[var(--foreground)]/24"
            : "text-[var(--muted-foreground)]/55 ring-transparent hover:bg-[var(--accent)] hover:text-[var(--muted-foreground)] hover:ring-[var(--border)]",
        )}
      >
        {lockMode ? <Lock size="0.75rem" /> : <Unlock size="0.75rem" />}
      </button>
      <button
        type="button"
        onClick={() => {
          const nextDeleteMode = !deleteMode;
          onSetDeleteMode(nextDeleteMode);
          if (nextDeleteMode) {
            onSetAddMode(false);
            onSetLockMode?.(false);
          }
        }}
        title={deleteMode ? "Exit delete mode" : "Enter delete mode"}
        aria-label={deleteMode ? "Exit tracker delete mode" : "Enter tracker delete mode"}
        aria-pressed={deleteMode}
        className={cn(
          "flex h-6 w-6 items-center justify-center rounded-sm transition-all ring-1 active:scale-90",
          deleteMode
            ? "bg-[var(--destructive)]/15 text-[var(--destructive)] ring-[var(--destructive)]/45"
            : "text-[var(--muted-foreground)]/55 ring-transparent hover:bg-[var(--accent)] hover:text-[var(--muted-foreground)] hover:ring-[var(--border)]",
        )}
      >
        <Trash2 size="0.75rem" />
      </button>
      <button
        type="button"
        onClick={() => onSetSizeProfile(nextSizeProfile)}
        title={sizeTitle}
        aria-label={sizeTitle}
        className="flex h-6 w-6 items-center justify-center rounded-sm text-[var(--muted-foreground)]/62 ring-1 ring-transparent transition-all hover:bg-[var(--accent)] hover:text-[var(--foreground)] hover:ring-[var(--border)] active:scale-90"
      >
        <TrackerSizeTierIcon sizeProfile={sizeProfile} />
      </button>
      <button
        type="button"
        onClick={() => onSetSide(trackerPanelSide === "left" ? "right" : "left")}
        title={`Panel anchored ${trackerPanelSide}. Click to anchor ${trackerPanelSide === "left" ? "right" : "left"}.`}
        aria-label={`Tracker panel anchored ${trackerPanelSide}. Click to anchor ${trackerPanelSide === "left" ? "right" : "left"}.`}
        role="switch"
        aria-checked={trackerPanelSide === "right"}
        className="relative grid h-6 w-[2.875rem] grid-cols-2 items-center overflow-hidden rounded-full border border-[var(--border)] bg-[var(--background)]/30 p-0.5 text-[var(--muted-foreground)] transition-colors hover:border-[var(--foreground)]/20 hover:bg-[var(--accent)]/60"
      >
        <span
          className={cn(
            "absolute inset-y-0.5 w-[1.25rem] rounded-full bg-[var(--foreground)]/12 ring-1 ring-[var(--foreground)]/20 transition-transform duration-150 ease-[cubic-bezier(0.16,1,0.3,1)]",
            trackerPanelSide === "left" ? "translate-x-0.5" : "translate-x-[1.375rem]",
          )}
        />
        <PanelLeft
          size="0.75rem"
          className={cn("relative z-10 mx-auto", trackerPanelSide === "left" && "text-[var(--foreground)]")}
        />
        <PanelRight
          size="0.75rem"
          className={cn("relative z-10 mx-auto", trackerPanelSide === "right" && "text-[var(--foreground)]")}
        />
      </button>
    </div>
  );

  return (
    <div className="sticky top-0 z-30 flex h-7 flex-shrink-0 items-center justify-between gap-1 bg-[color-mix(in_srgb,var(--card)_28%,var(--background)_72%)] px-1 shadow-[0_1px_0_color-mix(in_srgb,var(--border)_36%,transparent),0_8px_14px_color-mix(in_srgb,var(--background)_22%,transparent)] backdrop-blur-sm">
      <div className="absolute inset-x-0 bottom-0 h-px bg-[var(--border)]/30" />
      {trackerPanelSide === "left" ? outerHeaderControls : closePanelButton}
      <div className="min-w-0 flex-1" />
      {trackerPanelSide === "left" ? closePanelButton : outerHeaderControls}
    </div>
  );
}
