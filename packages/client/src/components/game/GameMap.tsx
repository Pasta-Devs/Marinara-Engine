// ──────────────────────────────────────────────
// Game: Map Wrapper (switches between grid and node)
// ──────────────────────────────────────────────
import { useState, useCallback, useEffect, useRef, type FocusEvent, type PointerEvent, type RefObject } from "react";
import { motion } from "framer-motion";
import type { GameMap, GameActiveState, SpatialContextResponse } from "@marinara-engine/shared";
import { GameGridMap } from "./GameGridMap";
import { GameNodeMap } from "./GameNodeMap";
import { CapabilityElement } from "../capabilities/CapabilityElement";
import { useChatStore, type PendingSpatialTransitionDraft } from "../../stores/chat.store";
import {
  ChevronDown,
  ChevronUp,
  Map as MapIcon,
  Wand2,
  X,
  Compass,
  MessageCircle,
  Swords,
  Moon,
  Minus,
  Plus,
  Globe2,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { PanelLockButton, useDraggablePanel } from "./DraggablePanel";
import { CHAT_TOOLBAR_OVERFLOW_BUTTON_SIZE_CLASS, getChatToolbarButtonClass } from "../chat/ChatToolbarControls";
import { NEUTRAL_SURFACE_VARIABLES } from "../ui/neutral-surface-styles";

const STATE_CONFIG: Record<GameActiveState, { icon: typeof Compass; label: string; color: string }> = {
  exploration: { icon: Compass, label: "Exploration", color: "text-emerald-300" },
  dialogue: { icon: MessageCircle, label: "Dialogue", color: "text-sky-300" },
  combat: { icon: Swords, label: "Combat", color: "text-red-300" },
  travel_rest: { icon: Moon, label: "Travel & Rest", color: "text-amber-300" },
};

const MAP_ZOOM_MIN = 0.75;
const MAP_ZOOM_MAX = 1.8;
const MAP_ZOOM_STEP = 0.25;
const GAME_MAP_PANEL_CLASS = cn(
  NEUTRAL_SURFACE_VARIABLES,
  "marinara-chat-popover rounded-lg border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--marinara-chat-chrome-panel-bg)] text-[var(--marinara-chat-chrome-panel-text)] shadow-lg shadow-black/35 backdrop-blur-md",
);
const GAME_MAP_DIVIDER_CLASS = "border-[var(--marinara-chat-chrome-panel-divider)]";
const GAME_MAP_FIELD_CLASS =
  "rounded-md border border-[var(--marinara-chat-chrome-input-border)] bg-[var(--marinara-chat-chrome-input-bg)] text-[var(--marinara-chat-chrome-panel-text)] outline-none transition-colors focus:border-[var(--marinara-chat-chrome-input-border-focus)]";
const GAME_MAP_ACTION_ITEM_CLASS =
  "text-[var(--marinara-chat-chrome-button-text)] transition-colors hover:bg-[var(--marinara-chat-chrome-button-bg-hover)] hover:text-[var(--marinara-chat-chrome-button-text-hover)] disabled:cursor-not-allowed disabled:opacity-35";

function hasActiveSpatialWorldMap(spatialContext?: SpatialContextResponse | null): boolean {
  return Boolean(
    spatialContext?.definition?.enabled &&
      spatialContext.definition.locations.some((location) => location.status === "active"),
  );
}

function syncPackageSpatialTransition(chatId: string, pending: unknown): void {
  if (pending && typeof pending === "object") {
    useChatStore.getState().setPendingSpatialTransition(chatId, pending as PendingSpatialTransitionDraft);
  } else {
    useChatStore.getState().clearPendingSpatialTransition(chatId);
  }
}

type EditableTimePhase = "dawn" | "morning" | "afternoon" | "evening" | "night" | "midnight";
type TimePhase = EditableTimePhase | "noon";

const EDITABLE_TIME_PHASES: EditableTimePhase[] = ["dawn", "morning", "afternoon", "evening", "night", "midnight"];

function extractHour(timeOfDay: string): number | null {
  const explicitTime = timeOfDay.match(/\b(\d{1,2})[:.h](\d{2})\b/);
  if (explicitTime) {
    let hour = Number.parseInt(explicitTime[1] ?? "", 10);
    if (timeOfDay.includes("pm") && hour < 12) hour += 12;
    if (timeOfDay.includes("am") && hour === 12) hour = 0;
    return hour >= 0 && hour < 24 ? hour : null;
  }

  const amPmTime = timeOfDay.match(/\b(\d{1,2})\s*(am|pm)\b/);
  if (amPmTime) {
    let hour = Number.parseInt(amPmTime[1] ?? "", 10);
    if (amPmTime[2] === "pm" && hour < 12) hour += 12;
    if (amPmTime[2] === "am" && hour === 12) hour = 0;
    return hour >= 0 && hour < 24 ? hour : null;
  }

  return null;
}

function normalizeTimePhase(timeOfDay?: string | null): TimePhase | null {
  if (!timeOfDay) return null;
  const normalized = timeOfDay.toLowerCase();

  if (normalized.includes("midnight")) return "midnight";
  if (normalized.includes("dawn") || normalized.includes("sunrise")) return "dawn";
  if (normalized.includes("morning")) return "morning";
  if (normalized.includes("noon") || normalized.includes("midday")) return "noon";
  if (normalized.includes("afternoon")) return "afternoon";
  if (normalized.includes("evening") || normalized.includes("dusk") || normalized.includes("sunset")) {
    return "evening";
  }
  if (normalized.includes("night")) return "night";

  const hour = extractHour(normalized);
  if (hour == null) return null;
  if (hour < 5) return "midnight";
  if (hour < 7) return "dawn";
  if (hour < 12) return "morning";
  if (hour < 15) return "noon";
  if (hour < 18) return "afternoon";
  if (hour < 21) return "evening";
  return "night";
}

function getTimePhaseLabel(phase: TimePhase): string {
  switch (phase) {
    case "midnight":
      return "Midnight";
    case "night":
      return "Night";
    case "dawn":
      return "Dawn";
    case "morning":
      return "Morning";
    case "noon":
      return "Noon";
    case "afternoon":
      return "Afternoon";
    case "evening":
      return "Evening";
  }
}

function getSkyClasses(phase: TimePhase): string {
  switch (phase) {
    case "midnight":
      return "bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900";
    case "night":
      return "bg-gradient-to-b from-slate-800 via-slate-900 to-slate-950";
    case "dawn":
      return "bg-gradient-to-b from-rose-300 via-amber-200 to-sky-300";
    case "morning":
      return "bg-gradient-to-b from-sky-300 via-sky-200 to-amber-100";
    case "noon":
      return "bg-gradient-to-b from-sky-400 via-sky-300 to-sky-200";
    case "afternoon":
      return "bg-gradient-to-b from-sky-400 via-cyan-300 to-amber-100";
    case "evening":
      return "bg-gradient-to-b from-slate-500 via-rose-300 to-amber-200";
  }
}

function getOrbPosition(phase: TimePhase): string {
  switch (phase) {
    case "midnight":
      return "left-1/2 top-[1px] -translate-x-1/2";
    case "night":
      return "right-[16%] top-[1px]";
    case "dawn":
      return "left-[12%] bottom-[1px]";
    case "morning":
      return "left-[26%] bottom-[1px]";
    case "noon":
      return "left-1/2 top-[1px] -translate-x-1/2";
    case "afternoon":
      return "right-[24%] bottom-[1px]";
    case "evening":
      return "right-[10%] bottom-[1px]";
  }
}

interface TimeOfDayIndicatorProps {
  timeOfDay?: string | null;
  size?: "desktop" | "mobile";
  className?: string;
}

function TimeOfDayIndicator({ timeOfDay, size = "desktop", className }: TimeOfDayIndicatorProps) {
  const phase = normalizeTimePhase(timeOfDay);
  if (!phase) {
    return (
      <span
        className={cn(
          "relative flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/20 bg-black/55 text-[0.625rem] font-bold leading-none text-white/75 shadow-[0_2px_8px_rgba(0,0,0,0.24)]",
          size === "mobile" ? "h-3.5 w-6" : "h-4 w-7",
          className,
        )}
        aria-label="Time of day unknown"
        title="Time of day unknown"
      >
        ?
      </span>
    );
  }

  const label = getTimePhaseLabel(phase);
  const nightPhase = phase === "night" || phase === "midnight";

  return (
    <span
      className={cn(
        "relative shrink-0 overflow-hidden rounded-full border border-white/20 shadow-[0_2px_8px_rgba(0,0,0,0.24)]",
        size === "mobile" ? "h-3.5 w-6" : "h-4 w-7",
        getSkyClasses(phase),
        className,
      )}
      aria-label={`Time of day: ${label}`}
      title={`Time of day: ${label}`}
    >
      {!nightPhase && <span className="absolute inset-x-[12%] bottom-[2px] h-px bg-white/45" />}
      {nightPhase && (
        <>
          <span className="absolute left-[18%] top-[22%] h-[1.5px] w-[1.5px] rounded-full bg-white/80" />
          <span className="absolute right-[22%] top-[30%] h-px w-px rounded-full bg-white/70" />
        </>
      )}
      <span
        className={cn(
          "absolute rounded-full",
          size === "mobile" ? "h-2 w-2" : "h-2.5 w-2.5",
          getOrbPosition(phase),
          nightPhase
            ? "bg-slate-100 shadow-[0_0_8px_rgba(226,232,240,0.45)]"
            : phase === "evening"
              ? "bg-orange-200 shadow-[0_0_10px_rgba(251,146,60,0.55)]"
              : "bg-yellow-200 shadow-[0_0_10px_rgba(253,224,71,0.55)]",
        )}
      >
        {nightPhase && <span className="absolute inset-y-0 right-[-1px] w-[55%] rounded-full bg-slate-900/85" />}
      </span>
    </span>
  );
}

interface DayTimeIndicatorProps {
  day?: number | null;
  timeOfDay?: string | null;
  onDayChange?: (day: number) => void;
  onTimeChange?: (timeOfDay: EditableTimePhase) => void;
  size?: "desktop" | "mobile";
  className?: string;
}

function normalizeDayInput(value: string): number | null {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(1, Math.min(9999, parsed));
}

function getTimeOfDayStatusLabel(timeOfDay?: string | null): string {
  const phase = normalizeTimePhase(timeOfDay);
  return phase ? `Time of day: ${getTimePhaseLabel(phase)}` : "Time of day unknown";
}

function DayTimeIndicator({
  day,
  timeOfDay,
  onDayChange,
  onTimeChange,
  size = "desktop",
  className,
}: DayTimeIndicatorProps) {
  const safeDay = Math.max(1, Math.floor(day ?? 1));
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(safeDay));
  const skipCommitRef = useRef(false);
  const selectedPhase = normalizeTimePhase(timeOfDay);
  const editableTimeValue = selectedPhase && selectedPhase !== "noon" ? selectedPhase : "";
  const timeLabel = getTimeOfDayStatusLabel(timeOfDay);
  const rootClassName = cn(
    "inline-flex shrink-0 items-stretch overflow-hidden rounded-lg border border-[var(--marinara-chat-chrome-button-border)] bg-[var(--marinara-chat-chrome-button-bg)] text-[var(--marinara-chat-chrome-button-text-hover)] shadow-[0_2px_8px_rgba(0,0,0,0.2)]",
    size === "mobile" ? "h-7 text-[0.6875rem]" : "h-5 text-[0.625rem]",
    className,
  );
  const dayClassName = cn(
    "flex items-center justify-center font-semibold leading-none",
    size === "mobile" ? "min-w-14 px-2.5" : "min-w-11 px-1.5",
  );
  const dividerClassName = cn(
    "my-auto w-px shrink-0 bg-[var(--marinara-chat-chrome-panel-divider)]",
    size === "mobile" ? "h-5" : "h-3.5",
  );
  const timeClassName = cn(
    "h-full rounded-l-none rounded-r-full border-0 shadow-none",
    size === "mobile" ? "w-8" : "w-7",
  );

  useEffect(() => {
    if (!editing) setDraft(String(safeDay));
  }, [editing, safeDay]);

  const commit = useCallback(() => {
    if (skipCommitRef.current) {
      skipCommitRef.current = false;
      setEditing(false);
      setDraft(String(safeDay));
      return;
    }
    const next = normalizeDayInput(draft);
    setEditing(false);
    if (next == null) {
      setDraft(String(safeDay));
      return;
    }
    setDraft(String(next));
    if (next !== safeDay) onDayChange?.(next);
  }, [draft, onDayChange, safeDay]);

  const handleEditorBlur = useCallback(
    (event: FocusEvent<HTMLDivElement>) => {
      const nextTarget = event.relatedTarget;
      if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) return;
      commit();
    },
    [commit],
  );

  if (editing) {
    return (
      <div
        className={cn(rootClassName, "focus-within:ring-2 focus-within:ring-[var(--marinara-chat-chrome-focus-ring)]")}
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
        onBlur={handleEditorBlur}
        title={`Day ${safeDay}. ${timeLabel}.`}
        aria-label={`Day ${safeDay}. ${timeLabel}.`}
      >
        <input
          autoFocus
          inputMode="numeric"
          min={1}
          max={9999}
          value={draft}
          onChange={(event) => setDraft(event.target.value.replace(/[^\d]/g, "").slice(0, 4))}
          onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === "Escape") {
              skipCommitRef.current = true;
              setDraft(String(safeDay));
              setEditing(false);
            } else if (event.key === "Enter") {
              event.preventDefault();
              commit();
            }
          }}
          className={cn(
            "h-full bg-transparent text-center font-semibold text-[var(--marinara-chat-chrome-panel-title)] outline-none",
            size === "mobile" ? "w-14 px-2.5 text-[0.6875rem]" : "w-11 px-1.5 text-[0.625rem]",
          )}
          aria-label="Edit game day"
        />
        <span className={dividerClassName} aria-hidden="true" />
        <select
          value={editableTimeValue}
          onChange={(event) => {
            const next = event.target.value as EditableTimePhase;
            if (next) onTimeChange?.(next);
          }}
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
          className={cn(
            "h-full rounded-r-lg border-0 bg-transparent px-1 text-[0.625rem] font-semibold capitalize text-[var(--marinara-chat-chrome-panel-title)] outline-none",
            size === "mobile" ? "w-[5.4rem]" : "w-[4.8rem]",
          )}
          aria-label="Edit game time of day"
        >
          <option value="" disabled>
            Time
          </option>
          {EDITABLE_TIME_PHASES.map((phase) => (
            <option key={phase} value={phase}>
              {getTimePhaseLabel(phase)}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        setEditing(true);
      }}
      onPointerDown={(event) => event.stopPropagation()}
      className={cn(
        rootClassName,
        "transition-colors hover:border-[var(--marinara-chat-chrome-button-border-hover)] hover:bg-[var(--marinara-chat-chrome-button-bg-hover)] hover:text-[var(--marinara-chat-chrome-button-text-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--marinara-chat-chrome-focus-ring)]",
      )}
      title={`Day ${safeDay}. ${timeLabel}. Tap to edit day and time.`}
      aria-label={`Day ${safeDay}. ${timeLabel}. Tap to edit day and time.`}
    >
      <span className={dayClassName}>Day {safeDay}</span>
      <span className={dividerClassName} aria-hidden="true" />
      <TimeOfDayIndicator timeOfDay={timeOfDay} size={size} className={timeClassName} />
    </button>
  );
}

function slugifyMapId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function getMapId(map: GameMap | null | undefined, fallbackIndex = 0): string | null {
  if (!map) return null;
  const explicit = map.id?.trim();
  if (explicit) return explicit;
  return slugifyMapId(map.name || "") || `map-${fallbackIndex + 1}`;
}

function buildMapOptions(map: GameMap | null, maps?: GameMap[]): GameMap[] {
  const source = maps?.length ? maps : map ? [map] : [];
  const seen = new Set<string>();
  return source.filter((entry, index) => {
    const id = getMapId(entry, index);
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function nextMapZoom(current: number, delta: number): number {
  const next = Math.round((current + delta) * 100) / 100;
  return Math.min(MAP_ZOOM_MAX, Math.max(MAP_ZOOM_MIN, next));
}

interface MapZoomControlsProps {
  zoom: number;
  onZoomOut: () => void;
  onZoomIn: () => void;
}

function MapZoomControls({ zoom, onZoomOut, onZoomIn }: MapZoomControlsProps) {
  const atMin = zoom <= MAP_ZOOM_MIN;
  const atMax = zoom >= MAP_ZOOM_MAX;

  const stopPointer = (event: PointerEvent<HTMLDivElement | HTMLButtonElement>) => {
    event.stopPropagation();
  };

  return (
    <div
      className="absolute right-1.5 top-1.5 z-20 flex h-6 overflow-hidden rounded-md border border-[var(--marinara-chat-chrome-button-border)] bg-[var(--marinara-chat-chrome-button-bg)] shadow-lg shadow-black/35 backdrop-blur-md"
      onPointerDown={stopPointer}
      title={`Map zoom: ${Math.round(zoom * 100)}%`}
    >
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onZoomOut();
        }}
        disabled={atMin}
        className={cn("flex h-full w-5 items-center justify-center", GAME_MAP_ACTION_ITEM_CLASS)}
        title="Zoom out"
        aria-label="Zoom out map"
      >
        <Minus size={11} />
      </button>
      <span className="w-px bg-[var(--marinara-chat-chrome-button-border)]" />
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onZoomIn();
        }}
        disabled={atMax}
        className={cn("flex h-full w-5 items-center justify-center", GAME_MAP_ACTION_ITEM_CLASS)}
        title="Zoom in"
        aria-label="Zoom in map"
      >
        <Plus size={11} />
      </button>
    </div>
  );
}

interface GameMapProps {
  map: GameMap | null;
  maps?: GameMap[];
  activeMapId?: string | null;
  viewedMapId?: string | null;
  onViewedMapChange?: (mapId: string) => void;
  onMove: (position: { x: number; y: number } | string) => void;
  selectedPosition?: { x: number; y: number } | string | null;
  onGenerateMap?: () => void;
  generateMapDisabled?: boolean;
  /** Disable interactive elements (e.g. during narration playback) */
  disabled?: boolean;
  /** Current game state — shown as icon left of the location name */
  gameState?: GameActiveState;
  /** Current time of day — shown as a compact sky indicator. */
  timeOfDay?: string | null;
  /** In-game day number, starting at 1. */
  day?: number | null;
  /** Called when the user edits the visible day number. */
  onDayChange?: (day: number) => void;
  /** Called when the user manually chooses a time of day. */
  onTimeChange?: (timeOfDay: EditableTimePhase) => void;
  /** Hierarchical world map shown above the local tactical map when enabled. */
  spatialContext?: SpatialContextResponse | null;
  spatialContextLoading?: boolean;
}

type GameMapViewMode = "world" | "local";

interface GameMapViewTabsProps {
  value: GameMapViewMode;
  onChange: (value: GameMapViewMode) => void;
}

function GameMapViewTabs({ value, onChange }: GameMapViewTabsProps) {
  return (
    <div
      role="group"
      aria-label="Map view"
      className="grid grid-cols-2 rounded-lg border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--marinara-chat-chrome-input-bg)] p-0.5"
    >
      <button
        type="button"
        onClick={() => onChange("world")}
        aria-pressed={value === "world"}
        className={cn(
          "flex min-h-11 items-center justify-center gap-1.5 rounded-md px-2 text-[0.6875rem] font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-chat-chrome-focus-ring)]",
          value === "world"
            ? "bg-[var(--marinara-chat-chrome-highlight-bg)] text-[var(--marinara-chat-chrome-panel-title)] shadow-sm"
            : "text-[var(--marinara-chat-chrome-panel-muted)] hover:text-[var(--marinara-chat-chrome-panel-title)]",
        )}
      >
        <Globe2 size="0.8125rem" /> World
      </button>
      <button
        type="button"
        onClick={() => onChange("local")}
        aria-pressed={value === "local"}
        className={cn(
          "flex min-h-11 items-center justify-center gap-1.5 rounded-md px-2 text-[0.6875rem] font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-chat-chrome-focus-ring)]",
          value === "local"
            ? "bg-[var(--marinara-chat-chrome-highlight-bg)] text-[var(--marinara-chat-chrome-panel-title)] shadow-sm"
            : "text-[var(--marinara-chat-chrome-panel-muted)] hover:text-[var(--marinara-chat-chrome-panel-title)]",
        )}
      >
        <MapIcon size="0.8125rem" /> Local
      </button>
    </div>
  );
}

interface MapGenerateButtonProps {
  onGenerateMap: () => void;
  disabled?: boolean;
  onAfterGenerate?: () => void;
}

function MapGenerateButton({ onGenerateMap, disabled, onAfterGenerate }: MapGenerateButtonProps) {
  return (
    <button
      type="button"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        onGenerateMap();
        onAfterGenerate?.();
      }}
      disabled={disabled}
      className={getChatToolbarButtonClass({
        compact: true,
        sizeClassName: "h-6 w-6",
        className:
          "absolute left-1.5 top-1.5 z-20 shadow-lg shadow-black/35 disabled:cursor-not-allowed disabled:opacity-45",
      })}
      title="Generate another map"
      aria-label="Generate another map"
    >
      <Wand2 size={11} />
    </button>
  );
}

interface GameMapPanelProps extends GameMapProps {
  /** Chat id used to scope persisted lock + position so layouts don't bleed across games. */
  chatId: string;
  /** Ref to the game surface element used as a drag boundary. */
  constraintsRef?: RefObject<HTMLElement | null>;
}

/** Desktop: inline collapsible panel. */
export function GameMapPanel({
  map,
  maps,
  activeMapId,
  viewedMapId,
  onViewedMapChange,
  onMove,
  selectedPosition,
  onGenerateMap,
  generateMapDisabled,
  disabled,
  gameState,
  timeOfDay,
  day,
  onDayChange,
  onTimeChange,
  spatialContext,
  spatialContextLoading,
  chatId,
  constraintsRef,
}: GameMapPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [stateHovered, setStateHovered] = useState(false);
  const [mapZoom, setMapZoom] = useState(1);
  const [mapViewMode, setMapViewMode] = useState<GameMapViewMode>("world");
  const pendingSpatialTransition = useChatStore((state) => state.pendingSpatialTransitions.get(chatId) ?? null);
  const { locked, toggleLocked, resetPosition, x, y, handleDragEnd } = useDraggablePanel(chatId, "map");
  const mapOptions = buildMapOptions(map, maps);
  const selectedMapId = viewedMapId ?? getMapId(map);
  const activeMap = activeMapId == null || selectedMapId === activeMapId;
  const mapInteractionDisabled = disabled || !activeMap;
  const hasWorldMap = hasActiveSpatialWorldMap(spatialContext);
  const effectiveMapView = hasWorldMap ? mapViewMode : "local";
  const zoomControls = (
    <MapZoomControls
      zoom={mapZoom}
      onZoomOut={() => setMapZoom((current) => nextMapZoom(current, -MAP_ZOOM_STEP))}
      onZoomIn={() => setMapZoom((current) => nextMapZoom(current, MAP_ZOOM_STEP))}
    />
  );

  if (!map && !hasWorldMap) {
    return (
      <div
        data-tour="game-map"
        className={cn(GAME_MAP_PANEL_CLASS, "flex w-52 flex-col items-center justify-center gap-2 p-3")}
      >
        <span className="text-[0.625rem] text-[var(--marinara-chat-chrome-panel-muted)]">
          {spatialContextLoading ? "Loading maps…" : "No map yet"}
        </span>
        {onGenerateMap && (
          <button
            type="button"
            onClick={onGenerateMap}
            disabled={disabled}
            className="flex items-center gap-1 rounded-md border border-[var(--marinara-chat-chrome-button-border)] bg-[var(--marinara-chat-chrome-button-bg)] px-2 py-1 text-[0.625rem] font-medium text-[var(--marinara-chat-chrome-button-text-hover)] transition-colors hover:border-[var(--marinara-chat-chrome-button-border-hover)] hover:bg-[var(--marinara-chat-chrome-button-bg-hover)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Wand2 size={10} />
            Generate
          </button>
        )}
      </div>
    );
  }

  const mapName = effectiveMapView === "world" ? "World map" : (map?.name || "Local map");
  const shouldMarquee = mapName.length > 18;
  const stateCfg = gameState ? STATE_CONFIG[gameState] : null;
  const StateIcon = stateCfg?.icon ?? null;
  const hasLeadingStatus = Boolean(StateIcon || timeOfDay || day);

  return (
    <motion.div
      data-tour="game-map"
      data-game-skip-bg-nav="true"
      drag={!locked}
      dragMomentum={false}
      dragElastic={0}
      dragConstraints={constraintsRef as RefObject<Element>}
      onDragEnd={handleDragEnd}
      style={{ x, y }}
      className={cn(
        GAME_MAP_PANEL_CLASS,
        "game-map-container flex flex-col gap-1 p-2",
        effectiveMapView === "world" ? "w-80" : "w-52",
        !locked && "cursor-grab ring-1 ring-[var(--marinara-chat-chrome-focus-ring)] active:cursor-grabbing",
      )}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={() => setCollapsed(!collapsed)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setCollapsed(!collapsed);
          }
        }}
        className="relative flex cursor-pointer items-center gap-1.5 text-xs text-[var(--marinara-chat-chrome-panel-muted)] transition-colors hover:text-[var(--marinara-chat-chrome-panel-title)]"
      >
        {hasLeadingStatus && (
          <div className="flex shrink-0 items-center gap-1.5">
            {/* State icon */}
            {StateIcon && (
              <span
                className={cn("relative shrink-0", stateCfg!.color)}
                onMouseEnter={() => setStateHovered(true)}
                onMouseLeave={() => setStateHovered(false)}
              >
                <StateIcon size={13} />
                {stateHovered && (
                  <span className="absolute -bottom-6 left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded bg-[var(--marinara-chat-chrome-panel-bg)] px-1.5 py-0.5 text-[0.55rem] text-[var(--marinara-chat-chrome-panel-title)] shadow">
                    {stateCfg!.label}
                  </span>
                )}
              </span>
            )}
            <DayTimeIndicator
              day={day}
              timeOfDay={timeOfDay}
              onDayChange={onDayChange}
              onTimeChange={onTimeChange}
            />
          </div>
        )}
        <span className="block min-w-0 flex-1 overflow-hidden text-center font-semibold text-[var(--marinara-chat-chrome-panel-title)]">
          {shouldMarquee ? (
            <span className="game-map-marquee-track inline-flex whitespace-nowrap">
              <span className="pr-8">{mapName}</span>
              <span className="pr-8">{mapName}</span>
            </span>
          ) : (
            <span className="block truncate">{mapName}</span>
          )}
        </span>
        <PanelLockButton locked={locked} onToggle={toggleLocked} onReset={resetPosition} size={11} />
        <span className="shrink-0 text-[var(--marinara-chat-chrome-button-text)]">
          {collapsed ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
        </span>
      </div>
      {!collapsed && hasWorldMap && (
        <GameMapViewTabs value={effectiveMapView} onChange={setMapViewMode} />
      )}
      {!collapsed && effectiveMapView === "local" && mapOptions.length > 1 && (
        <div className="flex items-center gap-1">
          <select
            value={selectedMapId ?? ""}
            onChange={(event) => onViewedMapChange?.(event.target.value)}
            className={cn(GAME_MAP_FIELD_CLASS, "min-w-0 flex-1 px-1.5 py-1 text-[0.625rem]")}
            title="View map"
          >
            {mapOptions.map((option, index) => {
              const id = getMapId(option, index) ?? `map-${index + 1}`;
              return (
                <option key={id} value={id}>
                  {option.name || `Map ${index + 1}`}
                  {id === activeMapId ? " (Current)" : ""}
                </option>
              );
            })}
          </select>
        </div>
      )}
      {!collapsed &&
        (effectiveMapView === "world" && spatialContext ? (
          <CapabilityElement
            packageId="hierarchical-maps"
            view="world-map"
            capabilityProps={{
              chatId,
              disabled,
              pendingTransition: pendingSpatialTransition,
              onPendingTransitionChange: (pending: unknown) => syncPackageSpatialTransition(chatId, pending),
            }}
            className="block h-full min-h-0"
          />
        ) : !map ? (
          <div className="flex flex-col items-center justify-center gap-2 py-3">
            <span className="text-[0.625rem] text-[var(--marinara-chat-chrome-panel-muted)]">
              {spatialContextLoading ? "Loading maps…" : "No local map yet"}
            </span>
            {onGenerateMap && (
              <button
                type="button"
                onClick={onGenerateMap}
                disabled={generateMapDisabled || disabled}
                className="flex items-center gap-1 rounded-md border border-[var(--marinara-chat-chrome-button-border)] bg-[var(--marinara-chat-chrome-button-bg)] px-2 py-1 text-[0.625rem] font-medium text-[var(--marinara-chat-chrome-button-text-hover)] transition-colors hover:border-[var(--marinara-chat-chrome-button-border-hover)] hover:bg-[var(--marinara-chat-chrome-button-bg-hover)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Wand2 size={10} />
                Generate
              </button>
            )}
          </div>
        ) : map.type === "grid" ? (
          <GameGridMap
            map={map}
            onCellClick={(x, y) => onMove({ x, y })}
            selectedPosition={selectedPosition}
            disabled={mapInteractionDisabled}
            showPartyPosition={activeMap}
            zoom={mapZoom}
            topLeftAction={
              onGenerateMap ? <MapGenerateButton onGenerateMap={onGenerateMap} disabled={generateMapDisabled} /> : null
            }
            topRightAction={zoomControls}
          />
        ) : (
          <GameNodeMap
            map={map}
            onNodeClick={(nodeId) => onMove(nodeId)}
            selectedNodeId={typeof selectedPosition === "string" ? selectedPosition : null}
            disabled={mapInteractionDisabled}
            showPartyPosition={activeMap}
            zoom={mapZoom}
            topLeftAction={
              onGenerateMap ? <MapGenerateButton onGenerateMap={onGenerateMap} disabled={generateMapDisabled} /> : null
            }
            topRightAction={zoomControls}
          />
        ))}
    </motion.div>
  );
}

// ── Mobile Map: icon trigger + anchored popover ──

interface MobileMapButtonProps {
  chatId: string;
  map: GameMap | null;
  maps?: GameMap[];
  activeMapId?: string | null;
  viewedMapId?: string | null;
  onViewedMapChange?: (mapId: string) => void;
  onMove: (position: { x: number; y: number } | string) => void;
  selectedPosition?: { x: number; y: number } | string | null;
  onGenerateMap?: () => void;
  generateMapDisabled?: boolean;
  disabled?: boolean;
  gameState?: GameActiveState;
  timeOfDay?: string | null;
  day?: number | null;
  onDayChange?: (day: number) => void;
  onTimeChange?: (timeOfDay: EditableTimePhase) => void;
  spatialContext?: SpatialContextResponse | null;
  spatialContextLoading?: boolean;
}

/** Mobile-only: map icon button in top-left that opens a compact anchored popover. */
export function MobileMapButton({
  chatId,
  map,
  maps,
  activeMapId,
  viewedMapId,
  onViewedMapChange,
  onMove,
  selectedPosition,
  onGenerateMap,
  generateMapDisabled,
  disabled,
  gameState,
  timeOfDay,
  day,
  onDayChange,
  onTimeChange,
  spatialContext,
  spatialContextLoading,
}: MobileMapButtonProps) {
  const [open, setOpen] = useState(false);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [mapZoom, setMapZoom] = useState(1);
  const [mapViewMode, setMapViewMode] = useState<GameMapViewMode>("world");
  const pendingSpatialTransition = useChatStore((state) => state.pendingSpatialTransitions.get(chatId) ?? null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const mapOptions = buildMapOptions(map, maps);
  const selectedMapId = viewedMapId ?? getMapId(map);
  const activeMap = activeMapId == null || selectedMapId === activeMapId;
  const mapInteractionDisabled = disabled || !activeMap;
  const hasWorldMap = hasActiveSpatialWorldMap(spatialContext);
  const effectiveMapView = hasWorldMap ? mapViewMode : "local";
  const zoomControls = (
    <MapZoomControls
      zoom={mapZoom}
      onZoomOut={() => setMapZoom((current) => nextMapZoom(current, -MAP_ZOOM_STEP))}
      onZoomIn={() => setMapZoom((current) => nextMapZoom(current, MAP_ZOOM_STEP))}
    />
  );

  useEffect(() => {
    if (!open) return;
    setSelectedNode(effectiveMapView === "local" && typeof selectedPosition === "string" ? selectedPosition : null);
  }, [effectiveMapView, open, selectedPosition]);

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event: globalThis.PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (popoverRef.current?.contains(target)) return;
      setOpen(false);
      setSelectedNode(null);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      setSelectedNode(null);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const stateCfg = gameState ? STATE_CONFIG[gameState] : null;
  const StateIcon = stateCfg?.icon ?? Compass;

  const handleNodeTap = useCallback((nodeId: string) => {
    setSelectedNode((prev) => (prev === nodeId ? null : nodeId));
  }, []);

  const handleTravel = useCallback(() => {
    if (selectedNode) {
      onMove(selectedNode);
      setSelectedNode(null);
      setOpen(false);
    }
  }, [selectedNode, onMove]);

  const currentNode = effectiveMapView === "local" && activeMap
    ? map?.nodes?.find((n) => n.id === (typeof map.partyPosition === "string" ? map.partyPosition : null))
    : null;
  const selectedNodeData = map?.nodes?.find((n) => n.id === selectedNode);
  const adjacentIds = new Set<string>();
  if (map?.edges && currentNode) {
    for (const edge of map.edges) {
      if (edge.from === currentNode.id) adjacentIds.add(edge.to);
      if (edge.to === currentNode.id) adjacentIds.add(edge.from);
    }
  }
  const canTravel =
    activeMap &&
    !disabled &&
    selectedNode != null &&
    (selectedNodeData?.discovered || adjacentIds.has(selectedNode) || selectedNode === currentNode?.id);

  return (
    <div ref={popoverRef} className="relative flex items-center">
      {/* Floating map icon */}
      <div className="flex items-center">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className={getChatToolbarButtonClass({
            open,
            className: "shadow-lg shadow-black/25",
            sizeClassName: CHAT_TOOLBAR_OVERFLOW_BUTTON_SIZE_CLASS,
          })}
          aria-expanded={open}
          aria-label={open ? "Close map" : "Open map"}
          title={open ? "Close map" : "Open map"}
        >
          <MapIcon size={14} />
        </button>
      </div>

      {/* Anchored map popover */}
      {open && (
        <div
          className={cn(
            GAME_MAP_PANEL_CLASS,
            "absolute left-0 top-[calc(100%+0.375rem)] z-50 w-[min(20rem,calc(100vw-1.5rem))] overflow-hidden shadow-2xl shadow-black/45",
          )}
          data-game-skip-bg-nav="true"
        >
          <div
            className="relative flex max-h-[min(68dvh,26rem)] flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className={cn("flex items-center gap-2 border-b px-2.5 py-2", GAME_MAP_DIVIDER_CLASS)}>
              <StateIcon size={14} className={stateCfg?.color ?? "text-[var(--marinara-chat-chrome-panel-muted)]"} />
              <DayTimeIndicator
                day={day}
                timeOfDay={timeOfDay}
                onDayChange={onDayChange}
                onTimeChange={onTimeChange}
                size="mobile"
              />
              <div className="min-w-0 flex-1 overflow-hidden">
                <p className="block overflow-hidden whitespace-nowrap text-xs font-bold text-[var(--marinara-chat-chrome-panel-title)]">
                  {(effectiveMapView === "world" ? "World map" : (map?.name || "Local map")).length > 18 ? (
                    <span className="game-map-marquee-track inline-flex whitespace-nowrap">
                      <span className="pr-8">{effectiveMapView === "world" ? "World map" : (map?.name || "Local map")}</span>
                      <span className="pr-8">{effectiveMapView === "world" ? "World map" : (map?.name || "Local map")}</span>
                    </span>
                  ) : (
                    <span className="block truncate">{effectiveMapView === "world" ? "World map" : (map?.name || "Local map")}</span>
                  )}
                </p>
                {effectiveMapView === "world" && spatialContext?.breadcrumb.length ? (
                  <p
                    className="block truncate text-[0.625rem] text-[var(--marinara-chat-chrome-panel-muted)]"
                    title={spatialContext.breadcrumb.map((crumb) => crumb.name).join(" › ")}
                  >
                    Story location: {spatialContext.breadcrumb.map((crumb) => crumb.name).join(" › ")}
                  </p>
                ) : currentNode ? (
                  <p className="block overflow-hidden whitespace-nowrap text-[0.625rem] text-[var(--marinara-chat-chrome-panel-muted)]">
                    {currentNode.label.length > 22 ? (
                      <span className="game-map-marquee-track inline-flex whitespace-nowrap">
                        <span className="pr-8">📍 {currentNode.label}</span>
                        <span className="pr-8">📍 {currentNode.label}</span>
                      </span>
                    ) : (
                      <span className="block truncate">📍 {currentNode.label}</span>
                    )}
                  </p>
                ) : null}
                {effectiveMapView === "local" && mapOptions.length > 1 && (
                  <select
                    value={selectedMapId ?? ""}
                    onChange={(event) => {
                      onViewedMapChange?.(event.target.value);
                      setSelectedNode(null);
                    }}
                    className={cn(GAME_MAP_FIELD_CLASS, "mt-1 w-full px-1.5 py-1 text-[0.625rem]")}
                    title="View map"
                  >
                    {mapOptions.map((option, index) => {
                      const id = getMapId(option, index) ?? `map-${index + 1}`;
                      return (
                        <option key={id} value={id}>
                          {option.name || `Map ${index + 1}`}
                          {id === activeMapId ? " (Current)" : ""}
                        </option>
                      );
                    })}
                  </select>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setSelectedNode(null);
                }}
                className={getChatToolbarButtonClass({ compact: true, sizeClassName: "h-7 w-7 shrink-0" })}
                aria-label="Close map"
                title="Close map"
              >
                <X size={14} />
              </button>
            </div>

            {hasWorldMap && map && (
              <div className={cn("border-b px-2 py-1.5", GAME_MAP_DIVIDER_CLASS)}>
                <GameMapViewTabs value={effectiveMapView} onChange={setMapViewMode} />
              </div>
            )}

            {/* Map body */}
            <div className="min-h-0 overflow-auto p-2 overscroll-contain">
              {effectiveMapView === "world" && spatialContext ? (
                <CapabilityElement
                  packageId="hierarchical-maps"
                  view="world-map"
                  capabilityProps={{
                    chatId,
                    disabled,
                    compact: true,
                    pendingTransition: pendingSpatialTransition,
                    onPendingTransitionChange: (pending: unknown) => {
                      syncPackageSpatialTransition(chatId, pending);
                      if (pending) setOpen(false);
                    },
                  }}
                  className="block h-full min-h-0"
                />
              ) : !map ? (
                <div className="flex flex-col items-center justify-center gap-3 py-8 text-[var(--muted-foreground)]">
                  <span className="text-xs">{spatialContextLoading ? "Loading maps…" : "No local map yet"}</span>
                  {onGenerateMap && (
                    <button
                      type="button"
                      onClick={() => {
                        onGenerateMap();
                        setOpen(false);
                      }}
                      disabled={disabled}
                      className="flex items-center gap-1 rounded-md border border-[var(--marinara-chat-chrome-button-border)] bg-[var(--marinara-chat-chrome-button-bg)] px-3 py-1.5 text-xs font-medium text-[var(--marinara-chat-chrome-button-text-hover)] transition-colors hover:border-[var(--marinara-chat-chrome-button-border-hover)] hover:bg-[var(--marinara-chat-chrome-button-bg-hover)] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Wand2 size={12} />
                      Generate
                    </button>
                  )}
                </div>
              ) : map.type === "grid" ? (
                <GameGridMap
                  map={map}
                  selectedPosition={selectedPosition}
                  disabled={mapInteractionDisabled}
                  showPartyPosition={activeMap}
                  zoom={mapZoom}
                  compactFit
                  topLeftAction={
                    onGenerateMap ? (
                      <MapGenerateButton
                        onGenerateMap={onGenerateMap}
                        disabled={generateMapDisabled}
                        onAfterGenerate={() => {
                          setOpen(false);
                          setSelectedNode(null);
                        }}
                      />
                    ) : null
                  }
                  topRightAction={zoomControls}
                  onCellClick={(x, y) => {
                    onMove({ x, y });
                    setOpen(false);
                  }}
                />
              ) : (
                <GameNodeMap
                  map={map}
                  onNodeClick={handleNodeTap}
                  selectedNodeId={selectedNode}
                  disabled={mapInteractionDisabled}
                  showPartyPosition={activeMap}
                  zoom={mapZoom}
                  compactFit
                  topLeftAction={
                    onGenerateMap ? (
                      <MapGenerateButton
                        onGenerateMap={onGenerateMap}
                        disabled={generateMapDisabled}
                        onAfterGenerate={() => {
                          setOpen(false);
                          setSelectedNode(null);
                        }}
                      />
                    ) : null
                  }
                  topRightAction={zoomControls}
                />
              )}
            </div>

            {/* Selected node footer — shown when a node is tapped */}
            {effectiveMapView === "local" && selectedNodeData && (
              <div className={cn("flex items-center gap-2 border-t px-2.5 py-2", GAME_MAP_DIVIDER_CLASS)}>
                <span className="text-sm">{selectedNodeData.discovered ? selectedNodeData.emoji : "❓"}</span>
                <span className="min-w-0 flex-1 truncate text-xs font-medium text-[var(--foreground)]">
                  {selectedNodeData.discovered ? selectedNodeData.label : "Unknown location"}
                </span>
                {canTravel && selectedNode !== currentNode?.id && (
                  <button
                    type="button"
                    onClick={handleTravel}
                    className="shrink-0 rounded-lg border border-[var(--marinara-chat-chrome-button-border)] bg-[var(--marinara-chat-chrome-button-bg)] px-3 py-1.5 text-[0.6875rem] font-semibold text-[var(--marinara-chat-chrome-button-text-hover)] transition-colors hover:border-[var(--marinara-chat-chrome-button-border-hover)] hover:bg-[var(--marinara-chat-chrome-button-bg-hover)] active:opacity-80"
                  >
                    Set destination
                  </button>
                )}
                {selectedNode === currentNode?.id && (
                  <span className="shrink-0 text-[0.625rem] text-emerald-400/70">You are here</span>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
