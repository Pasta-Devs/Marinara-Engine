import { PanelLeft, PanelRight, Plus, Trash2 } from "lucide-react";
import { TrackerPanelIcon } from "../../../../shared/components/ui/TrackerPanelIcon";
import { TrackerSizeTierIcon } from "../../../../shared/components/ui/TrackerSizeTierIcon";
import {
  TRACKER_PANEL_SIZE_PROFILES,
  type TrackerPanelSide,
  type TrackerPanelSizeProfile,
} from "../../../../shared/stores/ui.store";
import { cn } from "../../../../shared/lib/utils";
import "./TrackerSidebarHeader.css";

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
  const sizeIndex = Math.max(0, TRACKER_PANEL_SIZE_PROFILES.indexOf(sizeProfile));
  const nextSizeProfile = TRACKER_PANEL_SIZE_PROFILES[(sizeIndex + 1) % TRACKER_PANEL_SIZE_PROFILES.length]!;
  const sizeLabel = TRACKER_PANEL_SIZE_LABELS[sizeProfile];
  const nextSizeLabel = TRACKER_PANEL_SIZE_LABELS[nextSizeProfile];
  const sizeTitle = `Tracker panel size: ${sizeLabel}. Click for ${nextSizeLabel}.`;
  const closePanelButton = (
    <button
      type="button"
      onClick={onClose}
      title="Close trackers"
      aria-label="Close tracker panel"
      className="tracker-sidebar-header__close"
    >
      <TrackerPanelIcon size="1.05rem" strokeWidth={1.95} />
    </button>
  );

  const outerHeaderControls = (
    <div
      className={cn(
        "tracker-sidebar-header__control-group",
        trackerPanelSide === "left" && "tracker-sidebar-header__control-group--reverse",
      )}
    >
      <button
        type="button"
        onClick={() => {
          const nextAddMode = !addMode;
          onSetAddMode(nextAddMode);
          if (nextAddMode) onSetDeleteMode(false);
        }}
        title={addMode ? "Exit add mode" : "Enter add mode"}
        aria-label={addMode ? "Exit tracker add mode" : "Enter tracker add mode"}
        aria-pressed={addMode}
        className={cn(
          "tracker-sidebar-header__mode-button",
          addMode ? "tracker-sidebar-header__mode-button--add-active" : "tracker-sidebar-header__mode-button--idle",
        )}
      >
        <Plus size="0.75rem" />
      </button>
      <button
        type="button"
        onClick={() => {
          const nextDeleteMode = !deleteMode;
          onSetDeleteMode(nextDeleteMode);
          if (nextDeleteMode) onSetAddMode(false);
        }}
        title={deleteMode ? "Exit delete mode" : "Enter delete mode"}
        aria-label={deleteMode ? "Exit tracker delete mode" : "Enter tracker delete mode"}
        aria-pressed={deleteMode}
        className={cn(
          "tracker-sidebar-header__mode-button",
          deleteMode
            ? "tracker-sidebar-header__mode-button--delete-active"
            : "tracker-sidebar-header__mode-button--idle",
        )}
      >
        <Trash2 size="0.75rem" />
      </button>
      <button
        type="button"
        onClick={() => onSetSizeProfile(nextSizeProfile)}
        title={sizeTitle}
        aria-label={sizeTitle}
        className="tracker-sidebar-header__size-button"
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
        className="tracker-sidebar-header__side-switch"
      >
        <span
          className={cn(
            "tracker-sidebar-header__side-switch-knob",
            trackerPanelSide === "left"
              ? "tracker-sidebar-header__side-switch-knob--left"
              : "tracker-sidebar-header__side-switch-knob--right",
          )}
        />
        <PanelLeft
          size="0.75rem"
          className={cn(
            "tracker-sidebar-header__side-icon",
            trackerPanelSide === "left" && "tracker-sidebar-header__side-icon--active",
          )}
        />
        <PanelRight
          size="0.75rem"
          className={cn(
            "tracker-sidebar-header__side-icon",
            trackerPanelSide === "right" && "tracker-sidebar-header__side-icon--active",
          )}
        />
      </button>
    </div>
  );

  return (
    <div className="tracker-sidebar-header">
      <div className="tracker-sidebar-header__rule" />
      {trackerPanelSide === "left" ? outerHeaderControls : closePanelButton}
      <div className="min-w-0 flex-1" />
      {trackerPanelSide === "left" ? closePanelButton : outerHeaderControls}
    </div>
  );
}
