import { cn } from "../../../../lib/utils";
import { WorldThermometerIcon } from "../../../../components/ui/WorldStateInstruments";
import type { TrackerPanelSizeProfile } from "../../../../stores/ui.store";
import type { WorldStatePresentation } from "../../lib/world-state-display";
import { useTrackerFieldLock } from "../TrackerLockContext";
import {
  WORLD_INSTRUMENT_TEXT_STYLE,
  WorldRenderedEdit,
  WorldValueText,
} from "./WorldEditableTile";

const WORLD_FORECAST_PROFILE_STYLES: Record<
  TrackerPanelSizeProfile,
  {
    shell: string;
    edit: string;
    primary: string;
    secondary: string;
    thermometer: string;
  }
> = {
  compact: {
    shell: "px-0",
    edit: "px-0.5",
    primary: "text-sm leading-4",
    secondary: "whitespace-pre-wrap break-words text-xs leading-4 [overflow-wrap:anywhere]",
    thermometer: "h-5 w-[0.625rem]",
  },
  standard: {
    shell: "px-0.5",
    edit: "px-1",
    primary: "text-[1.0625rem] leading-5",
    secondary: "text-[0.8125rem] leading-4",
    thermometer: "h-5 w-[0.625rem]",
  },
  expanded: {
    shell: "px-1",
    edit: "px-1",
    primary: "text-[1.1875rem] leading-6",
    secondary: "text-sm leading-5",
    thermometer: "h-6 w-3",
  },
};

export function WorldForecastTile({
  weatherText,
  temperatureValue,
  temperatureDisplay,
  onSaveWeather,
  onSaveTemperature,
  weatherLockKey,
  temperatureLockKey,
  sizeProfile,
}: {
  weatherText: string;
  temperatureValue?: string | null;
  temperatureDisplay: WorldStatePresentation["temperature"];
  onSaveWeather: (value: string) => void;
  onSaveTemperature: (value: string) => void;
  weatherLockKey?: string;
  temperatureLockKey?: string;
  sizeProfile: TrackerPanelSizeProfile;
}) {
  const weatherLock = useTrackerFieldLock(weatherLockKey);
  const temperatureLock = useTrackerFieldLock(temperatureLockKey);
  const style = WORLD_FORECAST_PROFILE_STYLES[sizeProfile];
  const thermometerColor = temperatureDisplay.color;
  return (
    <div className={cn("relative z-[1] min-h-16 min-w-0 overflow-hidden rounded-sm py-1", style.shell)}>
      <div className="relative z-[1] grid min-h-14 min-w-0 grid-cols-1 grid-rows-[auto_auto] content-center">
        <WorldRenderedEdit
          label="Temperature"
          value={temperatureValue}
          onSave={onSaveTemperature}
          placeholder="Set temperature"
          className={cn("row-start-1 w-full min-w-0 self-center rounded-sm py-0.5 text-right", style.edit)}
          inputClassName={cn("text-right", WORLD_INSTRUMENT_TEXT_STYLE, style.primary)}
          {...temperatureLock}
        >
          <span
            className="flex w-full min-w-0 items-center justify-end gap-1"
            style={{ color: thermometerColor }}
          >
            <WorldValueText
              value={temperatureDisplay.label}
              maxLines={2}
              className={cn(
                "min-w-0 text-right",
                WORLD_INSTRUMENT_TEXT_STYLE,
                style.primary,
              )}
            />
            <WorldThermometerIcon
              display={temperatureDisplay}
              variant="outline-bulb"
              className={cn("shrink-0", style.thermometer)}
            />
          </span>
        </WorldRenderedEdit>
        <WorldRenderedEdit
          label="Weather"
          value={weatherText}
          onSave={onSaveWeather}
          placeholder="Set weather"
          className={cn("row-start-2 w-full min-w-0 rounded-sm py-0.5 text-right", style.edit)}
          inputClassName={cn("text-right", WORLD_INSTRUMENT_TEXT_STYLE, style.secondary)}
          {...weatherLock}
        >
          <WorldValueText
            value={weatherText}
            maxLines={3}
            className={cn(
              "min-w-0 text-right text-[var(--foreground)] drop-shadow-sm",
              WORLD_INSTRUMENT_TEXT_STYLE,
              style.secondary,
            )}
          />
        </WorldRenderedEdit>
      </div>
    </div>
  );
}
