import { Suspense, lazy } from "react";
import { MapPin } from "lucide-react";
import { cn } from "../../../../shared/lib/utils";
import type { TrackerTemperatureUnit } from "../../../../shared/stores/ui.store";
import {
  getLocationPinColor,
  getTemperatureColor,
  getTemperatureGaugeDisplay,
  getTemperatureKeywordHint,
  getWeatherEmoji,
  getWorldDateDisplay,
  getWorldTimeDisplay,
  parseTemperatureValue,
} from "../../../runtime/world-state/index";
import { DeferredHUDPanelFallback, WidgetPopover, useWidgetPopoverController } from "./RoleplayHUDWidgetShell";

const CombinedWorldPanel = lazy(async () =>
  import("./RoleplayHUDWorldPanel").then((module) => ({ default: module.CombinedWorldPanel })),
);

export function CombinedWorldWidget({
  location,
  date,
  time,
  weather,
  temperature,
  trackerTemperatureUnit,
  onSaveLocation,
  onSaveDate,
  onSaveTime,
  onSaveWeather,
  onSaveTemperature,
  layout,
  onRerunSingleTracker,
  isTrackerRetryBusy,
}: {
  location: string;
  date: string;
  time: string;
  weather: string;
  temperature: string;
  trackerTemperatureUnit: TrackerTemperatureUnit;
  onSaveLocation: (v: string) => void;
  onSaveDate: (v: string) => void;
  onSaveTime: (v: string) => void;
  onSaveWeather: (v: string) => void;
  onSaveTemperature: (v: string) => void;
  layout: "top" | "left" | "right";
  onRerunSingleTracker?: (agentType: string) => void;
  isTrackerRetryBusy?: boolean;
}) {
  const { buttonRef, close, open, placement, toggle } = useWidgetPopoverController(layout);
  const weatherEmoji = getWeatherEmoji(weather);
  const pinColor = getLocationPinColor(location);
  const tempNumeric = parseTemperatureValue(temperature);
  const temp = tempNumeric ?? getTemperatureKeywordHint(temperature);
  const tempColor = getTemperatureColor(temperature);
  const temperatureDisplay = getTemperatureGaugeDisplay(temperature, trackerTemperatureUnit);
  const dateDisplay = getWorldDateDisplay(date);
  const dateParts = dateDisplay.raw ? { day: dateDisplay.day, month: dateDisplay.month } : { day: null, month: null };
  const timeDisplay = getWorldTimeDisplay(time);
  const hour = timeDisplay.hour ?? -1;
  const minute = timeDisplay.minute ?? 0;
  const hourAngle = hour >= 0 ? (hour % 12) * 30 + minute * 0.5 : 0;
  const minuteAngle = minute * 6;
  const tempFill = Math.max(0, Math.min(1, temperatureDisplay.percent / 100));
  const tempFillColor = temperatureDisplay.color;

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={toggle}
        className={cn(
          "flex items-center gap-1.5 md:gap-1 rounded-lg border border-[var(--border)] bg-[var(--card)]/80 backdrop-blur-md px-2 py-1.5 md:px-2 md:py-2 md:h-10 transition-all hover:bg-[var(--card)] dark:border-foreground/10 dark:bg-black/40 dark:hover:bg-black/60 cursor-pointer select-none",
          open && "bg-[var(--card)] border-[var(--border)] dark:bg-black/60 dark:border-foreground/20",
        )}
        title="World State"
      >
        <MapPin size="0.9375rem" className={cn(pinColor, "drop-shadow-sm shrink-0")} />

        <svg viewBox="0 0 20 20" fill="none" className="shrink-0 h-4 w-4">
          <rect
            x="2"
            y="4"
            width="16"
            height="14"
            rx="2"
            stroke="currentColor"
            strokeWidth="1.5"
            className="text-violet-400/70"
          />
          <line x1="2" y1="8" x2="18" y2="8" stroke="currentColor" strokeWidth="1.2" className="text-violet-400/50" />
          <line
            x1="6"
            y1="2"
            x2="6"
            y2="5.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            className="text-violet-400/70"
          />
          <line
            x1="14"
            y1="2"
            x2="14"
            y2="5.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            className="text-violet-400/70"
          />
          {dateParts.day && (
            <text
              x="10"
              y="15.5"
              textAnchor="middle"
              fill="currentColor"
              fontSize="7"
              fontWeight="700"
              className="text-violet-300"
            >
              {dateParts.day}
            </text>
          )}
        </svg>

        <svg viewBox="0 0 20 20" fill="none" className="shrink-0 h-4 w-4">
          <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" className="text-amber-400/70" />
          {hour >= 0 ? (
            <>
              <line
                x1="10"
                y1="10"
                x2={10 + 4.2 * Math.sin((hourAngle * Math.PI) / 180)}
                y2={10 - 4.2 * Math.cos((hourAngle * Math.PI) / 180)}
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                className="text-amber-300"
              />
              <line
                x1="10"
                y1="10"
                x2={10 + 5.8 * Math.sin((minuteAngle * Math.PI) / 180)}
                y2={10 - 5.8 * Math.cos((minuteAngle * Math.PI) / 180)}
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
                className="text-amber-400/80"
              />
            </>
          ) : (
            <>
              <line
                x1="10"
                y1="10"
                x2="10"
                y2="5.5"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                className="text-amber-300"
              />
              <line
                x1="10"
                y1="10"
                x2="14"
                y2="10"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
                className="text-amber-400/80"
              />
            </>
          )}
          <circle cx="10" cy="10" r="1" fill="currentColor" className="text-amber-300" />
        </svg>

        <span className="text-sm leading-none shrink-0">{weatherEmoji}</span>

        <svg viewBox="0 0 10 20" fill="none" className="shrink-0 h-4 w-[0.625rem]">
          <rect
            x="3"
            y="1"
            width="4"
            height="13"
            rx="2"
            stroke={tempFillColor}
            strokeWidth="1.2"
            fill="none"
            opacity={temp !== null ? 1 : 0.3}
          />
          <rect
            x="3.8"
            y={1 + 12 * (1 - tempFill)}
            width="2.4"
            height={12 * tempFill + 1}
            rx="1"
            fill={tempFillColor}
            opacity={temp !== null ? 0.9 : 0.2}
          />
          <circle cx="5" cy="17" r="2.5" fill={tempFillColor} opacity={temp !== null ? 1 : 0.25} />
        </svg>
        {tempNumeric !== null && (
          <span className={cn("text-[0.5rem] md:text-[0.5625rem] font-bold leading-none shrink-0", tempColor)}>
            {temperatureDisplay.label}
          </span>
        )}
      </button>

      <WidgetPopover open={open} onClose={close} anchorRef={buttonRef} placement={placement} className="w-64">
        <Suspense fallback={<DeferredHUDPanelFallback label="Loading world state…" />}>
          <CombinedWorldPanel
            location={location}
            date={date}
            time={time}
            weather={weather}
            temperature={temperature}
            onSaveLocation={onSaveLocation}
            onSaveDate={onSaveDate}
            onSaveTime={onSaveTime}
            onSaveWeather={onSaveWeather}
            onSaveTemperature={onSaveTemperature}
            weatherEmoji={weatherEmoji}
            pinColor={pinColor}
            tempColor={tempColor}
            onClose={close}
            onRerunSingleTracker={onRerunSingleTracker}
            isTrackerRetryBusy={isTrackerRetryBusy}
          />
        </Suspense>
      </WidgetPopover>
    </div>
  );
}
