import { useId, type ReactNode } from "react";
import {
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  Flame,
  MapPin,
  Moon,
  Snowflake,
  Sun,
  Wind,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  DEFAULT_WORLD_CUSTOM_FIELD_ICON,
  removeTrackerFieldLockPrefix,
  renameTrackerFieldLockPrefix,
  worldCustomFieldTrackerLockKey,
  worldCustomFieldTrackerLockPrefix,
  worldTrackerLockKey,
  type GameState,
  type WorldCustomField,
} from "@marinara-engine/shared";
import type { GameStatePatchField } from "../../../../hooks/use-game-state-patcher";
import type { TrackerPanelSizeProfile, TrackerTemperatureUnit } from "../../../../stores/ui.store";
import { cn } from "../../../../lib/utils";
import {
  getLocationPinColor,
  getWorldDateDisplay,
} from "../../../../lib/world-state-helpers";
import { getWorldStatePresentation, type WorldSceneGlyph } from "../../lib/world-state-display";
import { visibleText } from "../../lib/tracker-display";
import { WorldCustomFieldIcon } from "../../lib/world-custom-field-icons";
import { InlineEdit } from "../controls/InlineControls";
import { AddRowButton, SectionHeader } from "../controls/SectionControls";
import { useTrackerFieldLock, useTrackerLockContext } from "../TrackerLockContext";
import { WorldDateTimeTile } from "./WorldDateTimeTiles";
import { WorldRenderedEdit, WorldValueText } from "./WorldEditableTile";
import { WorldForecastTile } from "./WorldForecastTile";
import { WorldLocationPlate } from "./WorldLocationPlate";

function makeUniqueWorldCustomFieldName(fields: WorldCustomField[]) {
  const names = new Set(fields.map((field) => normalizeCustomFieldName(field.name)).filter(Boolean));
  let index = 1;
  let name = "New Field";
  while (names.has(normalizeCustomFieldName(name))) {
    index += 1;
    name = `New Field ${index}`;
  }
  return name;
}

function normalizeCustomFieldName(value: string) {
  return value.normalize("NFKC").trim().toLocaleLowerCase("en-US").replace(/\s+/gu, " ");
}

const WORLD_SCENE_ICONS = {
  sun: Sun,
  moon: Moon,
  cloud: Cloud,
  rain: CloudRain,
  snow: Snowflake,
  storm: CloudLightning,
  fog: CloudFog,
  wind: Wind,
  fire: Flame,
} satisfies Record<WorldSceneGlyph, LucideIcon>;

function WorldSceneAtmosphere({
  glyph,
  sizeProfile,
}: {
  glyph?: WorldSceneGlyph;
  sizeProfile: TrackerPanelSizeProfile;
}) {
  if (!glyph) return null;
  const Icon = WORLD_SCENE_ICONS[glyph];

  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-y-0 left-1/2 z-0 flex w-[clamp(3rem,32%,8rem)] -translate-x-1/2 items-center justify-center py-0.5 text-[var(--tracker-world-scene-ink)]",
        sizeProfile === "compact" ? "opacity-[0.18]" : "opacity-[0.22]",
      )}
    >
      <Icon className="h-full w-auto max-w-full" strokeWidth={0.8} />
    </div>
  );
}

function WorldLocatorRail({ locationColor }: { locationColor: string }) {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      <span
        className={cn(
          "absolute left-1 top-[calc(50%-0.1875rem)] z-[2] flex h-5 w-5 -translate-y-1/2 items-center justify-center opacity-65",
          locationColor,
        )}
      >
        <span className="absolute inset-0 rounded-full border border-current/20" />
        <span className="absolute inset-1 rounded-full border border-current/15" />
        <MapPin className="relative h-[0.95rem] w-[0.95rem]" strokeWidth={2.2} />
      </span>
      <span className="absolute inset-x-2 -bottom-3.5 h-8 overflow-hidden [mask-image:linear-gradient(90deg,transparent_0%,black_3%,black_94%,transparent_100%)]">
        <span className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 opacity-65 [background-image:radial-gradient(circle,color-mix(in_srgb,var(--muted-foreground)_58%,transparent)_1px,transparent_1.4px)] [background-position:center] [background-size:10px_4px]" />
        <span className="absolute inset-x-[22%] top-1/2 h-1 -translate-y-1/2 opacity-75 [background-image:radial-gradient(circle,color-mix(in_srgb,var(--tracker-world-scene-stroke)_72%,transparent)_1px,transparent_1.4px)] [background-position:center] [background-size:10px_4px] [mask-image:linear-gradient(90deg,transparent,black_48%,black_52%,transparent)]" />
        <svg viewBox="0 0 32 32" className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2">
          <path
            d="M16 1.5 C17.5 8.5 23.5 14.5 30.5 16 C23.5 17.5 17.5 23.5 16 30.5 C14.5 23.5 8.5 17.5 1.5 16 C8.5 14.5 14.5 8.5 16 1.5Z"
            fill="color-mix(in srgb, var(--background) 88%, transparent)"
            stroke="var(--tracker-world-scene-stroke)"
            strokeWidth="1.25"
          />
          <path
            d="M16 5.5 C17 10.5 21.5 15 26.5 16 C21.5 17 17 21.5 16 26.5 C15 21.5 10.5 17 5.5 16 C10.5 15 15 10.5 16 5.5Z"
            fill="none"
            stroke="color-mix(in srgb, var(--tracker-world-scene-stroke) 70%, transparent)"
            strokeWidth="0.75"
          />
          <circle
            cx="16"
            cy="16"
            r="1.65"
            fill="color-mix(in srgb, var(--tracker-world-scene-stroke) 92%, transparent)"
          />
        </svg>
      </span>
    </div>
  );
}

function WorldInstrumentFrame({
  sizeProfile,
  locationColor,
  dateColor,
}: {
  sizeProfile: TrackerPanelSizeProfile;
  locationColor: string;
  dateColor: string;
}) {
  const compact = sizeProfile === "compact";
  const gradientId = useId().replace(/:/g, "");
  const topHighlightId = `${gradientId}-world-frame-top`;
  const bottomHighlightId = `${gradientId}-world-frame-bottom`;

  return (
    <div aria-hidden="true" className={cn("pointer-events-none absolute inset-0 z-0", locationColor)}>
      <svg
        viewBox="0 0 600 160"
        preserveAspectRatio="none"
        className={cn("h-full w-full opacity-55", compact && "opacity-40")}
      >
        <defs>
          <linearGradient id={topHighlightId} x1="72" y1="0" x2="430" y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="currentColor" stopOpacity="0" />
            <stop offset="0.2" stopColor="currentColor" stopOpacity="0.72" />
            <stop offset="0.56" stopColor="var(--tracker-world-scene-ink)" stopOpacity="1" />
            <stop offset="0.82" stopColor="var(--tracker-world-scene-ink)" stopOpacity="0.46" />
            <stop offset="1" stopColor="var(--tracker-world-scene-ink)" stopOpacity="0" />
          </linearGradient>
          <linearGradient
            id={bottomHighlightId}
            className={dateColor}
            x1="72"
            y1="0"
            x2="528"
            y2="0"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0" stopColor="currentColor" stopOpacity="0" />
            <stop offset="0.14" stopColor="currentColor" stopOpacity="0.72" />
            <stop offset="0.3" stopColor="var(--tracker-world-time-accent)" stopOpacity="0.82" />
            <stop offset="0.48" stopColor="var(--tracker-world-scene-ink)" stopOpacity="1" />
            <stop offset="0.72" stopColor="var(--tracker-world-weather-accent)" stopOpacity="0.88" />
            <stop offset="0.88" stopColor="var(--tracker-world-temperature-accent)" stopOpacity="0.62" />
            <stop offset="1" stopColor="var(--tracker-world-temperature-accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d="M0.5 14 L5 9 H12 L16 1 H584 L588 9 H595 L599.5 14 V146 L595 151 H588 L584 159 H16 L12 151 H5 L0.5 146 Z"
          fill="none"
          stroke="color-mix(in srgb, var(--muted-foreground) 70%, transparent)"
          strokeWidth="0.55"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M3 16 L7 12 H14 L18 5 H582 L586 12 H593 L597 16 V144 L593 148 H586 L582 155 H18 L14 148 H7 L3 144 Z"
          fill="none"
          stroke="color-mix(in srgb, var(--foreground) 40%, transparent)"
          strokeWidth="0.45"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M72 1 H430"
          fill="none"
          stroke={`url(#${topHighlightId})`}
          strokeLinecap="round"
          strokeWidth="1.05"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M72 159 H528"
          fill="none"
          stroke={`url(#${bottomHighlightId})`}
          strokeLinecap="round"
          strokeWidth="1.1"
          vectorEffect="non-scaling-stroke"
        />
        {!compact && (
          <>
            <path
              d="M3 35 V58 M597 101 V125"
              fill="none"
              stroke="color-mix(in srgb, var(--tracker-world-scene-stroke) 46%, transparent)"
              strokeWidth="0.65"
              vectorEffect="non-scaling-stroke"
            />
            <circle
              cx="7"
              cy="21"
              r="1"
              fill="color-mix(in srgb, var(--tracker-world-scene-stroke) 70%, transparent)"
            />
            <circle
              cx="593"
              cy="139"
              r="1"
              fill="color-mix(in srgb, var(--tracker-world-scene-stroke) 70%, transparent)"
            />
          </>
        )}
      </svg>
    </div>
  );
}

function WorldCustomFieldPlate({
  field,
  fieldIndex,
  className,
  addMode,
  deleteMode,
  onUpdate,
  onRemove,
  isNameTaken,
}: {
  field: WorldCustomField;
  fieldIndex: number;
  className?: string;
  addMode: boolean;
  deleteMode: boolean;
  onUpdate: (field: WorldCustomField) => void;
  onRemove: () => void;
  isNameTaken: (name: string) => boolean;
}) {
  const { fieldLocks, onUpdateFieldLocks } = useTrackerLockContext();
  const valueLockKey = worldCustomFieldTrackerLockKey(field, "value", fieldIndex);
  const valueLock = useTrackerFieldLock(valueLockKey);
  const name = field.name?.trim() || "Field";
  const customPrefix = worldCustomFieldTrackerLockPrefix(field, fieldIndex);

  const updateName = (nextName: string) => {
    const trimmedName = nextName.trim() || "Field";
    if (trimmedName === name) return;
    if (isNameTaken(trimmedName)) return;
    const updated = { ...field, name: trimmedName };
    onUpdateFieldLocks?.((locks) =>
      renameTrackerFieldLockPrefix(locks, customPrefix, worldCustomFieldTrackerLockPrefix(updated, fieldIndex)),
    );
    onUpdate(updated);
  };

  return (
    <div
      className={cn(
        "@container relative min-h-[2.25rem] min-w-0 transition-colors duration-200 [@media(pointer:coarse)]:min-h-11",
        className,
      )}
      title={name}
    >
      <div
        className={cn(
          "relative z-[1] grid h-full items-center gap-1 px-1 py-0.5 text-left @min-[380px]:px-1.5",
          "grid-cols-[1.5rem_minmax(2.6rem,0.42fr)_minmax(0,1fr)] @min-[380px]:grid-cols-[1.7rem_minmax(3rem,0.4fr)_minmax(0,1fr)]",
          deleteMode && "pr-7 [@media(pointer:coarse)]:pr-12",
        )}
      >
        <div className="relative flex h-full min-h-[2rem] w-full items-center justify-center overflow-hidden bg-[color-mix(in_srgb,var(--background)_18%,transparent)]">
          <div className="pointer-events-none absolute inset-0 opacity-[0.17] [background-image:radial-gradient(circle,color-mix(in_srgb,var(--foreground)_44%,transparent)_0.75px,transparent_1px)] [background-size:4px_4px]" />
          <WorldCustomFieldIcon icon={field.icon} className="relative z-[1]" />
        </div>
        {addMode && (
          <dt className="min-w-0">
            <InlineEdit
              value={name}
              onSave={updateName}
              placeholder="Field"
              ariaLabel={`${name} field name`}
              className="min-w-0 px-0.5 py-0 text-[0.625rem] font-semibold uppercase text-[var(--muted-foreground)]/88"
              previewClassName="truncate"
              scrollOnHover
              showEditHint={false}
              locked={!!fieldLocks?.[worldCustomFieldTrackerLockKey(field, "name", fieldIndex)]}
              lockMode={false}
            />
          </dt>
        )}
        {!addMode && (
          <dt
            dir="auto"
            className="line-clamp-2 min-w-0 whitespace-normal break-words px-0.5 text-[0.625rem] font-semibold uppercase text-[var(--muted-foreground)]/88"
            title={name}
          >
            {name}
          </dt>
        )}
        <dd className="min-w-0">
          <WorldRenderedEdit
            label={`${name} value`}
            value={field.value}
            onSave={(value) => onUpdate({ ...field, value })}
            placeholder="Not recorded"
            className="min-h-8 min-w-0 max-w-full pr-3 text-left font-bold text-[var(--foreground)]/92 drop-shadow-sm"
            inputClassName="text-left text-[0.75rem]"
            showEditHint={!deleteMode}
            {...valueLock}
          >
            <WorldValueText value={field.value} maxLines={3} className="text-[0.75rem] leading-4" />
          </WorldRenderedEdit>
        </dd>
      </div>
      {deleteMode && (
        <button
          type="button"
          onClick={() => {
            onUpdateFieldLocks?.((locks) => removeTrackerFieldLockPrefix(locks, customPrefix));
            onRemove();
          }}
          title={`Remove ${name}`}
          aria-label={`Remove ${name}`}
          className="absolute right-1 top-1/2 z-[4] flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full bg-[var(--background)]/85 text-[var(--destructive)] shadow-sm ring-1 ring-[var(--border)]/70 backdrop-blur-sm transition-all hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-[var(--border)] active:scale-90 [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:w-11"
        >
          <X size="0.625rem" />
        </button>
      )}
    </div>
  );
}

export function WorldStatePanel({
  state,
  trackerPanelSizeProfile,
  trackerTemperatureUnit,
  action,
  onSaveField,
  deleteMode = false,
  addMode = false,
  collapsed = false,
  onToggleCollapsed,
}: {
  state: GameState | null;
  trackerPanelSizeProfile: TrackerPanelSizeProfile;
  trackerTemperatureUnit: TrackerTemperatureUnit;
  action?: ReactNode;
  onSaveField: (field: GameStatePatchField, value: unknown) => void;
  deleteMode?: boolean;
  addMode?: boolean;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}) {
  const worldCustomFields = Array.isArray(state?.worldCustomFields) ? state.worldCustomFields : [];
  const presentation = getWorldStatePresentation(
    {
      time: state?.time,
      weather: state?.weather,
      temperature: state?.temperature,
    },
    trackerTemperatureUnit,
  );
  const locationColor = getLocationPinColor(state?.location);
  const dateDisplay = getWorldDateDisplay(state?.date);
  const isCompact = trackerPanelSizeProfile === "compact";
  return (
    <div
      className="relative z-10 overflow-hidden border-b border-[var(--border)] shadow-inner transition-colors duration-200 @container"
      style={presentation.ambienceStyle}
    >
      <div className="pointer-events-none absolute inset-0 opacity-[var(--tracker-world-atmosphere-opacity)] [background-image:radial-gradient(circle_at_68%_54%,var(--tracker-world-scene-wash),transparent_34%),radial-gradient(ellipse_at_18%_0%,var(--tracker-world-time-tone),transparent_48%),radial-gradient(ellipse_at_82%_12%,var(--tracker-world-weather-tone),transparent_44%),radial-gradient(ellipse_at_50%_100%,var(--tracker-world-temperature-tone),transparent_52%)] transition-[opacity,filter] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-[var(--foreground)]/9" />

      <SectionHeader
        icon={<MapPin size="0.6875rem" />}
        title="World"
        action={action}
        addAction={
          addMode ? (
            <AddRowButton
              title="Add world field"
              onClick={() =>
                onSaveField("worldCustomFields", [
                  ...worldCustomFields,
                  {
                    name: makeUniqueWorldCustomFieldName(worldCustomFields),
                    value: "",
                    icon: DEFAULT_WORLD_CUSTOM_FIELD_ICON,
                  },
                ])
              }
              className="rounded-sm"
            />
          ) : undefined
        }
        collapsed={collapsed}
        onToggle={onToggleCollapsed}
      />

      {!collapsed && (
        <>
          <div
            className={cn(
              "relative z-[1] mt-0.5 grid min-w-0 gap-0.5 px-2 py-1.5 @container",
              isCompact && "px-1.5 py-1",
            )}
          >
            <WorldInstrumentFrame
              sizeProfile={trackerPanelSizeProfile}
              locationColor={locationColor}
              dateColor={dateDisplay.iconColor}
            />
            <div className="relative min-w-0 pb-1.5">
              <WorldLocatorRail locationColor={locationColor} />
              <div className={cn("min-w-0 pl-7", isCompact && "pl-6")}>
                <WorldLocationPlate
                  value={state?.location}
                  onSave={(value) => onSaveField("location", value || null)}
                  lockKey={worldTrackerLockKey("location")}
                  sizeProfile={trackerPanelSizeProfile}
                />
              </div>
            </div>
            <div
              className={cn(
                "relative isolate mx-auto grid w-full max-w-[30rem] min-w-0 grid-cols-2 gap-2 px-1",
                isCompact && "grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] gap-1 px-0",
                trackerPanelSizeProfile === "standard" &&
                  "grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] gap-1.5 px-0.5",
              )}
            >
              <WorldSceneAtmosphere glyph={presentation.sceneGlyph} sizeProfile={trackerPanelSizeProfile} />
              <WorldDateTimeTile
                dateText={visibleText(state?.date, "")}
                dateColor={dateDisplay.iconColor}
                dateDay={dateDisplay.day}
                timeDisplay={presentation.time}
                onSaveDate={(value) => onSaveField("date", value || null)}
                onSaveTime={(value) => onSaveField("time", value || null)}
                dateLockKey={worldTrackerLockKey("date")}
                timeLockKey={worldTrackerLockKey("time")}
                sizeProfile={trackerPanelSizeProfile}
              />
              <WorldForecastTile
                weatherText={presentation.weatherText}
                temperatureValue={state?.temperature}
                temperatureDisplay={presentation.temperature}
                onSaveWeather={(value) => onSaveField("weather", value || null)}
                onSaveTemperature={(value) => onSaveField("temperature", value || null)}
                weatherLockKey={worldTrackerLockKey("weather")}
                temperatureLockKey={worldTrackerLockKey("temperature")}
                sizeProfile={trackerPanelSizeProfile}
              />
            </div>
          </div>
          {worldCustomFields.length > 0 && (
            <section className="relative grid min-w-0 gap-1 px-1 pb-1">
              <dl className="grid min-w-0 gap-0.5">
                {worldCustomFields.map((field, index) => (
                  <WorldCustomFieldPlate
                    key={`${field.name}-${index}`}
                    field={field}
                    fieldIndex={index}
                    className="col-span-full"
                    addMode={addMode}
                    deleteMode={deleteMode}
                    onUpdate={(updated) => {
                      const next = [...worldCustomFields];
                      next[index] = updated;
                      onSaveField("worldCustomFields", next);
                    }}
                    onRemove={() =>
                      onSaveField(
                        "worldCustomFields",
                        worldCustomFields.filter((_, fieldIndex) => fieldIndex !== index),
                      )
                    }
                    isNameTaken={(candidate) =>
                      worldCustomFields.some(
                        (otherField, otherIndex) =>
                          otherIndex !== index &&
                          normalizeCustomFieldName(otherField.name) === normalizeCustomFieldName(candidate),
                      )
                    }
                  />
                ))}
              </dl>
            </section>
          )}
        </>
      )}
    </div>
  );
}
