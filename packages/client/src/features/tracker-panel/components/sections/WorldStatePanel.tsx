import { type ReactNode } from "react";
import { MapPin } from "lucide-react";
import { worldTrackerLockKey, type GameState } from "@marinara-engine/shared";
import type { GameStatePatchField } from "../../../../hooks/use-game-state-patcher";
import type { TrackerPanelSizeProfile, TrackerTemperatureUnit } from "../../../../stores/ui.store";
import { cn } from "../../../../lib/utils";
import {
  getWorldAmbienceStyle,
  getWorldDateDisplay,
  getWorldTimeDisplay,
  WORLD_FREEFORM_DATE_GRID_BASE_CLASS,
  WORLD_FREEFORM_DATE_GRID_PHRASE_TIME_CLASS,
  WORLD_GRID_BASE_CLASS,
  WORLD_GRID_PHRASE_TIME_CLASS,
} from "../../lib/world-state-display";
import { SectionHeader } from "../controls/SectionControls";
import { WorldDateTile, WorldTimeTile } from "./WorldDateTimeTiles";
import { WorldForecastTile } from "./WorldForecastTile";
import { WorldLocationPlate } from "./WorldLocationPlate";

export function WorldStatePanel({
  state,
  trackerPanelSizeProfile,
  trackerTemperatureUnit,
  action,
  onSaveField,
  collapsed = false,
  onToggleCollapsed,
}: {
  state: GameState | null;
  trackerPanelSizeProfile: TrackerPanelSizeProfile;
  trackerTemperatureUnit: TrackerTemperatureUnit;
  action?: ReactNode;
  onSaveField: (field: GameStatePatchField, value: string | null) => void;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}) {
  const dateDisplay = getWorldDateDisplay(state?.date);
  const hasFreeformDate = dateDisplay.kind === "freeform";
  const hasPhraseTime = getWorldTimeDisplay(state?.time).kind === "phrase";
  const gridColumnsClass = hasFreeformDate
    ? hasPhraseTime
      ? WORLD_FREEFORM_DATE_GRID_PHRASE_TIME_CLASS
      : WORLD_FREEFORM_DATE_GRID_BASE_CLASS
    : hasPhraseTime
      ? WORLD_GRID_PHRASE_TIME_CLASS
      : WORLD_GRID_BASE_CLASS;

  return (
    <div
      className="relative z-10 overflow-hidden border-b border-[var(--border)] shadow-inner transition-colors duration-200"
      style={getWorldAmbienceStyle(state)}
    >
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-[var(--foreground)]/10" />

      <SectionHeader
        icon={<MapPin size="0.6875rem" />}
        title="World"
        action={action}
        collapsed={collapsed}
        onToggle={onToggleCollapsed}
      />

      {!collapsed && (
        <div
          className={cn("relative grid gap-px p-1 @min-[380px]:gap-1 @min-[380px]:p-1.5", gridColumnsClass)}
        >
          <WorldDateTile
            value={state?.date}
            display={dateDisplay}
            onSave={(value) => onSaveField("date", value || null)}
            lockKey={worldTrackerLockKey("date")}
          />
          <WorldTimeTile
            value={state?.time}
            onSave={(value) => onSaveField("time", value || null)}
            lockKey={worldTrackerLockKey("time")}
          />
          <WorldForecastTile
            weather={state?.weather}
            temperature={state?.temperature}
            trackerPanelSizeProfile={trackerPanelSizeProfile}
            trackerTemperatureUnit={trackerTemperatureUnit}
            onSaveWeather={(value) => onSaveField("weather", value || null)}
            onSaveTemperature={(value) => onSaveField("temperature", value || null)}
            weatherLockKey={worldTrackerLockKey("weather")}
            temperatureLockKey={worldTrackerLockKey("temperature")}
          />
          <WorldLocationPlate
            value={state?.location}
            onSave={(value) => onSaveField("location", value || null)}
            className="col-span-full"
            lockKey={worldTrackerLockKey("location")}
          />
        </div>
      )}
    </div>
  );
}
