// ──────────────────────────────────────────────
// Chat: Roleplay HUD — immersive world-state widgets
// Phones keep World and Player trackers in separate movable buttons and themed sheets.
// Package controls and the manual tracker trigger remain in the compact strip.
// ──────────────────────────────────────────────
import { Suspense, lazy, useState, useEffect, useCallback, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { MapPin, Users, Backpack, Scroll, Swords, RefreshCw, BarChart3, SlidersHorizontal } from "lucide-react";
import { cn } from "../../lib/utils";
import { api } from "../../lib/api-client";
import { WorldCalendarIcon } from "../ui/WorldCalendarIcon";
import { WorldClockIcon, WorldThermometerIcon } from "../ui/WorldStateInstruments";
import { useGameStateStore } from "../../stores/game-state.store";
import { useAgentStore } from "../../stores/agent.store";
import { useGameStatePatcher } from "../../hooks/use-game-state-patcher";
import { useUIStore } from "../../stores/ui.store";
import { useReducedAmbientEffects } from "../../hooks/use-reduced-ambient-effects";
import {
  partitionTrackerCapabilityPackages,
  useInstalledCapabilityPackages,
} from "../../hooks/use-capability-packages";
import { CapabilityElement } from "../capabilities/CapabilityElement";
import {
  classifyWorldWeather,
  getLocationPinColor,
  getTemperatureGaugeDisplay,
  getWorldDateDisplay,
  getWorldTimeDisplay,
  type WorldWeatherFamily,
} from "../../lib/world-state-helpers";
import { TrackerLockProvider, useTrackerLockContext } from "../../features/tracker-panel/components/TrackerLockContext";
import { buildInventoryTrackerEditPatch } from "../../features/tracker-panel/lib/inventory-tracker-edit";
import { useTrackerFieldLockUpdater } from "../../features/tracker-panel/hooks/use-tracker-field-lock-updater";
import { NEUTRAL_PANEL_SCROLL_AREA, NEUTRAL_SURFACE_VARIABLES } from "../ui/neutral-surface-styles";
import { FloatingWindow, PHONE_SHEET_CLASS } from "../ui/FloatingWindow";
import { useMatchMedia } from "../../hooks/use-match-media";
import { useFloatingWindowStore } from "../../stores/floating-window.store";
import { getChatControlDefaultLayout } from "./ChatControlWindow";
import {
  CHAT_TOOLBAR_ICON_GAP_CLASS,
  CHAT_TOOLBAR_MOBILE_OVERFLOW_HEIGHT_CLASS,
  getChatToolbarButtonClass,
} from "./ChatToolbarControls";
import type {
  GameState,
  PresentCharacter,
  CharacterStat,
  InventoryTrackerGroup,
  InventoryTrackerRow,
  QuestProgress,
  CustomTrackerField,
  WorldCustomField,
  TrackerHiddenFields,
  InstalledCapabilityPackage,
} from "@marinara-engine/shared";
import {
  isNamedTrackerRow,
  normalizeTrackerFieldLocksForState,
  normalizeTrackerHiddenFields,
  toggleTrackerFieldLock,
} from "@marinara-engine/shared";
import type { TrackerTemperatureUnit } from "../../stores/ui.store";
import { useTranslation as useUiTranslation } from "react-i18next";

const EMPTY_AGENT_TYPE_SET = new Set<string>();
const MOBILE_WORLD_WINDOW_ID = "control:tracker-world";
const MOBILE_PLAYER_WINDOW_ID = "control:tracker-player";

interface RoleplayHUDProps {
  chatId: string;
  isStreaming: boolean;
  onRetriggerTrackers?: () => void;
  /** Re-run one tracker agent only (same pipeline as full tracker run). */
  onRerunSingleTracker?: (agentType: string) => void;
  /** When true, tracker agents are manual — show a trigger button in the widget strip */
  manualTrackers?: boolean;
  /** When provided, overrides the globally-computed set so that only per-chat agents show widgets. */
  enabledAgentTypes?: Set<string>;
}

const CombinedPlayerPanel = lazy(async () =>
  import("./RoleplayHUDPanels").then((module) => ({ default: module.CombinedPlayerPanel })),
);
const CombinedWorldPanel = lazy(async () =>
  import("./RoleplayHUDPanels").then((module) => ({ default: module.CombinedWorldPanel })),
);

/** Installed tracker packages the chat runs that draw in the Roleplay HUD. */
export function selectRoleplayTrackerPackages(
  installed: readonly InstalledCapabilityPackage[],
  enabledAgentTypes: Set<string>,
) {
  return installed.filter(
    (item) =>
      item.status === "active" &&
      enabledAgentTypes.has(item.id) &&
      Boolean(item.manifest.entrypoints.client) &&
      item.manifest.contributions?.slots?.includes("roleplay-tracker"),
  );
}

/**
 * Live tracker values and their edit handlers, shared by the HUD and the Tracker window. Each caller
 * passes its own `registrationId` so their pending edits flush independently.
 */
export function useRoleplayTrackerState(chatId: string, enabledAgentTypes: Set<string>, registrationId: string) {
  const [lockMode, setLockMode] = useState(false);
  const gameState = useGameStateStore((s) => s.current);
  const { patchField, patchPlayerStats, patchPlayerStatsMany } = useGameStatePatcher(chatId, registrationId);
  const { data: installedCapabilities = [] } = useInstalledCapabilityPackages();
  const packages = partitionTrackerCapabilityPackages(
    selectRoleplayTrackerPackages(installedCapabilities, enabledAgentTypes),
  );

  const playerStats = gameState?.playerStats ?? null;
  // Editing one group can rewrite two, so this must land as a single patch.
  const editInventoryTracker = (group: InventoryTrackerGroup, rows: InventoryTrackerRow[]) =>
    patchPlayerStatsMany((current) => buildInventoryTrackerEditPatch(current, group, rows));
  const fieldLocks = gameState ? normalizeTrackerFieldLocksForState(gameState.fieldLocks, gameState) : null;
  const hiddenTrackerFields = gameState ? normalizeTrackerHiddenFields(gameState.hiddenTrackerFields) : null;
  const updateFieldLocks = useTrackerFieldLockUpdater({ chatId, fieldLocks, patchField });
  const updateHiddenTrackerFields = useCallback(
    (updater: (hiddenFields: TrackerHiddenFields | null | undefined) => TrackerHiddenFields) => {
      const latestState = useGameStateStore.getState().current;
      const base =
        latestState?.chatId === chatId
          ? normalizeTrackerHiddenFields(latestState.hiddenTrackerFields)
          : hiddenTrackerFields;
      patchField("hiddenTrackerFields", updater(base));
    },
    [chatId, hiddenTrackerFields, patchField],
  );
  const toggleFieldLock = useCallback(
    (key: string) => {
      updateFieldLocks((locks) => toggleTrackerFieldLock(locks, key));
    },
    [updateFieldLocks],
  );

  return {
    packages,
    patchField,
    patchPlayerStats,
    editInventoryTracker,
    date: gameState?.date ?? null,
    time: gameState?.time ?? null,
    location: gameState?.location ?? null,
    weather: gameState?.weather ?? null,
    temperature: gameState?.temperature ?? null,
    worldCustomFields: Array.isArray(gameState?.worldCustomFields) ? gameState.worldCustomFields : [],
    presentCharacters: gameState?.presentCharacters ?? [],
    personaStatBars: gameState?.personaStats ?? [],
    personaStatus: playerStats?.status ?? "",
    activeQuests: playerStats?.activeQuests ?? [],
    customTrackerFields: Array.isArray(playerStats?.customTrackerFields)
      ? playerStats.customTrackerFields.filter(isNamedTrackerRow)
      : [],
    inventoryTrackerCurrencies: playerStats?.inventoryTrackerCurrencies ?? [],
    inventoryTrackerEquipped: playerStats?.inventoryTrackerEquipped ?? [],
    inventoryTrackerInventory: playerStats?.inventoryTrackerInventory ?? [],
    lockProviderProps: {
      fieldLocks,
      hiddenTrackerFields,
      lockMode,
      onSetLockMode: setLockMode,
      onToggleFieldLock: toggleFieldLock,
      onUpdateFieldLocks: updateFieldLocks,
      onUpdateHiddenFields: updateHiddenTrackerFields,
    },
  };
}

export function RoleplayHUD({
  chatId,
  isStreaming,
  onRetriggerTrackers,
  onRerunSingleTracker,
  manualTrackers,
  mobileCompact,
  enabledAgentTypes: enabledAgentTypesProp,
}: RoleplayHUDProps & { mobileCompact?: boolean }) {
  const [trackerPortalHost, setTrackerPortalHost] = useState<HTMLElement | null>(null);
  const attachHud = useCallback((node: HTMLDivElement | null) => {
    // Escape the clipped toolbar while sharing Chat Settings' stacking context.
    setTrackerPortalHost(node?.closest<HTMLElement>('[data-component="ChatArea.Roleplay"]') ?? null);
  }, []);
  const gameStateRefreshing = useGameStateStore((s) => s.isRefreshing);
  const setGameState = useGameStateStore((s) => s.setGameState);

  const enabledAgentTypes = enabledAgentTypesProp ?? EMPTY_AGENT_TYPE_SET;
  const {
    packages: { memoryNag: memoryNagTrackerPackages, other: otherRoleplayTrackerPackages },
    patchField,
    patchPlayerStats,
    editInventoryTracker,
    date,
    time,
    location,
    weather,
    temperature,
    worldCustomFields,
    presentCharacters,
    personaStatBars,
    personaStatus,
    activeQuests,
    customTrackerFields,
    inventoryTrackerCurrencies,
    inventoryTrackerEquipped,
    inventoryTrackerInventory,
    lockProviderProps,
  } = useRoleplayTrackerState(chatId, enabledAgentTypes, "roleplay-hud");

  const isAgentProcessing = useAgentStore((s) => s.processingChatIds.includes(chatId));
  const trackerPanelEnabled = useUIStore((s) => s.trackerPanelEnabled);
  const trackerPanelOpen = useUIStore((s) => s.trackerPanelOpen);
  const trackerTemperatureUnit = useUIStore((s) => s.trackerTemperatureUnit);

  const isTrackerBusy = isAgentProcessing || isStreaming || gameStateRefreshing;
  const phoneLayout = useMatchMedia("(max-width: 767px)");
  // Phones only: on a computer, trackers live in the Tracker Panel or the Tracker window.
  const showHudTrackerWidgets = !(trackerPanelEnabled && trackerPanelOpen);

  useEffect(() => {
    if (!chatId) return;
    // If the store already holds state for this chat, skip the redundant fetch.
    // This happens when ChatArea remounts after visiting an editor panel.
    const existing = useGameStateStore.getState().current;
    if (existing?.chatId === chatId) return;

    let cancelled = false;
    api
      .get<GameState | null>(`/chats/${chatId}/game-state`)
      .then((gs) => {
        if (!cancelled) setGameState(gs ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [chatId, setGameState]);

  const hasPersonaStatsTracker = enabledAgentTypes.has("persona-stats");
  const hasPlayerTrackerSections =
    hasPersonaStatsTracker ||
    enabledAgentTypes.has("character-tracker") ||
    enabledAgentTypes.has("quest") ||
    enabledAgentTypes.has("custom-tracker");
  const hasInventoryTracker = enabledAgentTypes.has("inventory-tracker");
  const hasMobilePlayerTrackerSections =
    hasPlayerTrackerSections || hasInventoryTracker || memoryNagTrackerPackages.length > 0;

  return (
    <TrackerLockProvider {...lockProviderProps}>
      {/* Only the compact phone HUD owns these windows; the portal escapes the clipped toolbar. */}
      {mobileCompact &&
        phoneLayout &&
        showHudTrackerWidgets &&
        trackerPortalHost &&
        createPortal(
          <>
            {enabledAgentTypes.has("world-state") && (
              <CombinedWorldWidget
                location={location ?? ""}
                date={date ?? ""}
                time={time ?? ""}
                weather={weather ?? ""}
                temperature={temperature ?? ""}
                worldCustomFields={worldCustomFields}
                trackerTemperatureUnit={trackerTemperatureUnit}
                onSaveLocation={(v) => patchField("location", v)}
                onSaveDate={(v) => patchField("date", v)}
                onSaveTime={(v) => patchField("time", v)}
                onSaveWeather={(v) => patchField("weather", v)}
                onSaveTemperature={(v) => patchField("temperature", v)}
                onUpdateWorldCustomFields={(fields) => patchField("worldCustomFields", fields)}
                onRerunSingleTracker={onRerunSingleTracker}
                isTrackerRetryBusy={isTrackerBusy}
              />
            )}

            {hasMobilePlayerTrackerSections && (
              <CombinedPlayerWidget
                showPersona={hasPersonaStatsTracker}
                showCharacters={enabledAgentTypes.has("character-tracker")}
                showQuests={enabledAgentTypes.has("quest")}
                showInventory={hasInventoryTracker}
                memoryNagPackageIds={memoryNagTrackerPackages.map((item) => item.id)}
                chatId={chatId}
                showCustomTracker={enabledAgentTypes.has("custom-tracker")}
                personaStats={personaStatBars}
                onUpdatePersonaStats={(bars) => patchField("personaStats", bars)}
                personaStatus={personaStatus}
                onUpdatePersonaStatus={(status) => patchPlayerStats("status", status)}
                characters={presentCharacters}
                onUpdateCharacters={(chars) => patchField("presentCharacters", chars)}
                quests={activeQuests}
                onUpdateQuests={(q) => patchPlayerStats("activeQuests", q)}
                inventoryCurrencies={inventoryTrackerCurrencies}
                inventoryEquipped={inventoryTrackerEquipped}
                inventory={inventoryTrackerInventory}
                onUpdateInventoryCurrencies={(rows) => editInventoryTracker("currencies", rows)}
                onUpdateInventoryEquipped={(rows) => editInventoryTracker("equipped", rows)}
                onUpdateInventory={(rows) => editInventoryTracker("inventory", rows)}
                customTrackerFields={customTrackerFields}
                onUpdateCustomTracker={(fields) => patchPlayerStats("customTrackerFields", fields)}
                onRerunSingleTracker={onRerunSingleTracker}
                isTrackerRetryBusy={isTrackerBusy}
              />
            )}
          </>,
          trackerPortalHost,
        )}
      <div
        ref={attachHud}
        className={cn("rpg-hud", "flex items-center", CHAT_TOOLBAR_ICON_GAP_CLASS, mobileCompact && "min-w-0")}
      >
        {/* Chat Settings turns the Tracker Panel on, and Beholder has its own window (a bubble). */}
        {/* Mobile package and manual tracker controls. */}
        {showHudTrackerWidgets && (
          <div
            className={cn(
              "flex items-center md:hidden",
              CHAT_TOOLBAR_ICON_GAP_CLASS,
              mobileCompact && "min-w-0 justify-start",
            )}
          >
            {otherRoleplayTrackerPackages.map((item) => (
              <RoleplayTrackerCapability
                key={`${item.id}-roleplay-tracker-mobile`}
                packageId={item.id}
                chatId={chatId}
                compact
                onRerunSingleTracker={onRerunSingleTracker}
                isTrackerRetryBusy={isTrackerBusy}
              />
            ))}

            {/* Manual tracker trigger button (mobile) */}
            {manualTrackers && onRetriggerTrackers && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  onRetriggerTrackers();
                }}
                disabled={isTrackerBusy}
                className={cn(
                  MOBILE_HUD_BTN,
                  "justify-center text-[0.5625rem] font-medium",
                  isTrackerBusy && "text-[var(--marinara-chat-chrome-button-text-active)]",
                )}
              >
                <RefreshCw size="0.875rem" className={cn("shrink-0 h-4 w-4", isTrackerBusy && "animate-spin")} />
              </button>
            )}
          </div>
        )}
      </div>
    </TrackerLockProvider>
  );
}

/** Common mobile HUD button sizing – used by all four strip buttons */
const HUD_ICON_BUTTON = getChatToolbarButtonClass({ compact: true });
const MOBILE_HUD_BTN = cn(HUD_ICON_BUTTON, CHAT_TOOLBAR_MOBILE_OVERFLOW_HEIGHT_CLASS, "cursor-pointer select-none");

export function RoleplayTrackerCapability({
  packageId,
  chatId,
  compact = false,
  buttonClassName,
  onRerunSingleTracker,
  isTrackerRetryBusy,
}: {
  packageId: string;
  chatId: string;
  compact?: boolean;
  /** Replaces the chat toolbar button look, for hosts with their own button style (the Tracker Panel header). */
  buttonClassName?: string;
  onRerunSingleTracker?: (agentType: string) => void;
  isTrackerRetryBusy?: boolean;
}) {
  const { lockMode, onSetLockMode } = useTrackerLockContext();
  return (
    <span className="contents [&_button>svg]:!text-inherit">
      <CapabilityElement
        packageId={packageId}
        view="toolbar"
        capabilityProps={{
          chatId,
          chatMode: "roleplay",
          mobileCompact: compact,
          onRerunTracker: onRerunSingleTracker ? () => onRerunSingleTracker(packageId) : undefined,
          trackerRetryBusy: isTrackerRetryBusy,
          lockMode,
          onToggleLockMode: onSetLockMode ? () => onSetLockMode(!lockMode) : undefined,
          toolbarButtonClass:
            buttonClassName ??
            getChatToolbarButtonClass({
              compact,
              className: compact ? CHAT_TOOLBAR_MOBILE_OVERFLOW_HEIGHT_CLASS : undefined,
            }),
        }}
        className="contents"
      />
    </span>
  );
}

function DeferredHUDPanelFallback({ label }: { label: string }) {
  return <div className="px-3 py-4 text-center text-[0.625rem] text-[var(--muted-foreground)]/60">{label}</div>;
}

// ═══════════════════════════════════════════════
// Combined Player Widget — merges Persona, Chars,
// Quests, and custom fields into a single expandable panel
// ═══════════════════════════════════════════════

function CombinedPlayerWidget({
  showPersona,
  showCharacters,
  showQuests,
  showInventory,
  memoryNagPackageIds,
  chatId,
  showCustomTracker,
  personaStats,
  onUpdatePersonaStats,
  personaStatus,
  onUpdatePersonaStatus,
  characters,
  onUpdateCharacters,
  quests,
  onUpdateQuests,
  inventoryCurrencies,
  inventoryEquipped,
  inventory,
  onUpdateInventoryCurrencies,
  onUpdateInventoryEquipped,
  onUpdateInventory,
  customTrackerFields,
  onUpdateCustomTracker,
  onRerunSingleTracker,
  isTrackerRetryBusy,
}: {
  showPersona: boolean;
  showCharacters: boolean;
  showQuests: boolean;
  showInventory: boolean;
  memoryNagPackageIds: string[];
  chatId: string;
  showCustomTracker: boolean;
  personaStats: CharacterStat[];
  onUpdatePersonaStats: (bars: CharacterStat[]) => void;
  personaStatus: string;
  onUpdatePersonaStatus: (status: string) => void;
  characters: PresentCharacter[];
  onUpdateCharacters: (chars: PresentCharacter[]) => void;
  quests: QuestProgress[];
  onUpdateQuests: (quests: QuestProgress[]) => void;
  inventoryCurrencies: InventoryTrackerRow[];
  inventoryEquipped: InventoryTrackerRow[];
  inventory: InventoryTrackerRow[];
  onUpdateInventoryCurrencies: (rows: InventoryTrackerRow[]) => void;
  onUpdateInventoryEquipped: (rows: InventoryTrackerRow[]) => void;
  onUpdateInventory: (rows: InventoryTrackerRow[]) => void;
  customTrackerFields: CustomTrackerField[];
  onUpdateCustomTracker: (fields: CustomTrackerField[]) => void;
  onRerunSingleTracker?: (agentType: string) => void;
  isTrackerRetryBusy?: boolean;
}) {
  const { t: localizeUi } = useUiTranslation();
  const close = () => useFloatingWindowStore.getState().closeWindow(MOBILE_PLAYER_WINDOW_ID);

  return (
    <MobileTrackerWindow
      id={MOBILE_PLAYER_WINDOW_ID}
      title={localizeUi("ui.chat.combinedplayerwidget.playerTracker")}
      icon={<Swords size="0.875rem" />}
      width={320}
      height={512}
    >
      <Suspense
        fallback={<DeferredHUDPanelFallback label={localizeUi("ui.chat.combinedplayerwidget.loadingTrackers")} />}
      >
        <CombinedPlayerPanel
          showPersona={showPersona}
          showCharacters={showCharacters}
          showQuests={showQuests}
          showInventory={showInventory}
          memoryNagPackageIds={memoryNagPackageIds}
          chatId={chatId}
          showCustomTracker={showCustomTracker}
          personaStats={personaStats}
          onUpdatePersonaStats={onUpdatePersonaStats}
          personaStatus={personaStatus}
          onUpdatePersonaStatus={onUpdatePersonaStatus}
          characters={characters}
          onUpdateCharacters={onUpdateCharacters}
          quests={quests}
          onUpdateQuests={onUpdateQuests}
          inventoryCurrencies={inventoryCurrencies}
          inventoryEquipped={inventoryEquipped}
          inventory={inventory}
          onUpdateInventoryCurrencies={onUpdateInventoryCurrencies}
          onUpdateInventoryEquipped={onUpdateInventoryEquipped}
          onUpdateInventory={onUpdateInventory}
          customTrackerFields={customTrackerFields}
          onUpdateCustomTracker={onUpdateCustomTracker}
          onClose={close}
          onRerunSingleTracker={onRerunSingleTracker}
          isTrackerRetryBusy={isTrackerRetryBusy}
        />
      </Suspense>
    </MobileTrackerWindow>
  );
}

/** The phone tracker's movable button and themed sheet share every other chat window's layout storage. */
function MobileTrackerWindow({
  id,
  title,
  icon,
  banner,
  width,
  height,
  children,
}: {
  id: string;
  title: string;
  icon: ReactNode;
  /** Shown on the button instead of the icon (World State's date, time and weather). */
  banner?: ReactNode;
  width: number;
  height: number;
  children: ReactNode;
}) {
  const { t } = useUiTranslation();
  useEffect(() => () => useFloatingWindowStore.getState().closeWindow(id), [id]);
  return (
    <FloatingWindow
      id={id}
      title={title}
      titleIcon={icon}
      closeLabel={t("window.controls.close")}
      presentation="sheet"
      sheetClassName={PHONE_SHEET_CLASS}
      minimizable={{ icon, banner, label: title }}
      getDefaultLayout={(bounds, bubbleSize) =>
        getChatControlDefaultLayout(bounds, 0, { width, height }, 0, bubbleSize)
      }
      autoFocus={false}
      className={NEUTRAL_SURFACE_VARIABLES}
      rootAttributes={{ "data-mobile-tracker-window": id }}
      ignoreOutsidePointer={(target) => !!target.closest("[data-chat-floating-panel], [data-macro-modal]")}
    >
      <div className={cn(NEUTRAL_PANEL_SCROLL_AREA, "@container min-h-0 flex-1 overflow-y-auto overscroll-contain")}>
        {children}
      </div>
    </FloatingWindow>
  );
}

// ═══════════════════════════════════════════════
// Miniature displays: each tracker's compact view, shown while its
// Tracker window drawer is collapsed
// ═══════════════════════════════════════════════

/** The toolbar tile a miniature sits in. It ignores the pointer, so a press reaches the drawer header. */
export const TRACKER_MINIATURE_TILE = cn(
  getChatToolbarButtonClass({ compact: true }),
  "pointer-events-none group flex-col gap-0 overflow-hidden",
);

export function PersonaStatsMiniature({ bars }: { bars: CharacterStat[] }) {
  if (bars.length === 0) return <BarChart3 size="0.875rem" className="max-md:h-3.5 max-md:w-3.5" />;
  return (
    <div className="flex w-6 max-md:w-8 flex-col justify-center gap-0.5 max-md:gap-px shrink-0">
      {bars.map((bar) => {
        const pct = bar.max > 0 ? Math.min(100, (bar.value / bar.max) * 100) : 0;
        return (
          <div
            key={bar.name}
            className="h-1 max-md:h-px w-full rounded-full bg-[var(--muted)]/30 dark:bg-foreground/10 overflow-hidden"
          >
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${pct}%`,
                backgroundColor: bar.color || "#a1a1aa",
              }}
            />
          </div>
        );
      })}
    </div>
  );
}

export function CharactersMiniature() {
  return <Users size="0.875rem" className="transition-colors max-md:h-3.5 max-md:w-3.5" />;
}

export function CustomTrackerMiniature({ fields }: { fields: CustomTrackerField[] }) {
  const reduceAmbientEffects = useReducedAmbientEffects();
  const [cycleIdx, setCycleIdx] = useState(0);
  const [animKey, setAnimKey] = useState(0);

  // Cycle through fields every 3 seconds
  useEffect(() => {
    if (reduceAmbientEffects || fields.length <= 1) return;
    const timer = setInterval(() => {
      setCycleIdx((prev) => (prev + 1) % fields.length);
      setAnimKey((k) => k + 1);
    }, 3000);
    return () => clearInterval(timer);
  }, [fields.length, reduceAmbientEffects]);

  useEffect(() => {
    if (cycleIdx >= fields.length) setCycleIdx(0);
  }, [fields.length, cycleIdx]);

  const currentField = fields[cycleIdx];
  if (fields.length === 0 || !currentField) {
    return <SlidersHorizontal size="0.875rem" className="max-md:h-3 max-md:w-3" />;
  }
  const previewLabel = currentField.value ? `${currentField.name}: ${currentField.value}` : currentField.name;
  const longestWord = previewLabel.split(/\s+/).reduce((max, w) => Math.max(max, w.length), 0);
  const previewFontSize = Math.max(3.5, Math.min(6, 60 / Math.max(longestWord, 1)));
  return (
    <span
      key={animKey}
      className={cn(
        "w-full px-0.5 text-center font-semibold leading-[1.2]",
        !reduceAmbientEffects && "animate-[inventory-cycle_0.4s_ease-out]",
      )}
      style={{ fontSize: `${previewFontSize}px` }}
    >
      {previewLabel}
    </span>
  );
}

export function InventoryTrackerMiniature({ total }: { total: number }) {
  return total > 0 ? (
    <span className="text-[0.625rem] font-semibold tabular-nums">{total}</span>
  ) : (
    <Backpack size="0.875rem" className="max-md:h-3 max-md:w-3" />
  );
}

export function QuestsMiniature({ quests }: { quests: QuestProgress[] }) {
  // The first incomplete objective from the most recent incomplete quest
  const incompleteQuests = quests.filter((q) => !q.completed);
  const mainQuest = incompleteQuests.length > 0 ? incompleteQuests[incompleteQuests.length - 1] : undefined;
  const currentObjective = mainQuest?.objectives.find((o) => !o.completed);
  if (!currentObjective) return <Scroll size="0.875rem" className="max-md:h-3 max-md:w-3" />;
  return (
    <span className="widget-scroll-text w-full px-0.5 text-center text-[0.375rem] font-semibold leading-[1.15] max-md:text-[0.5rem]">
      <span className="inline-flex animate-[widget-scroll_8s_linear_infinite] whitespace-nowrap">
        <span className="px-3">{currentObjective.text}</span>
        <span className="px-3" aria-hidden>
          {currentObjective.text}
        </span>
      </span>
    </span>
  );
}

// ═══════════════════════════════════════════════
// Uniform World-State Widgets
// ═══════════════════════════════════════════════

// ═══════════════════════════════════════════════
// Combined World-State Widget (icon strip + popover, phones)
// ═══════════════════════════════════════════════

interface WorldTrackerValues {
  location: string;
  date: string;
  time: string;
  weather: string;
  temperature: string;
  worldCustomFields: WorldCustomField[];
}

/** Icons and colors the World State miniature and its panel share. */
export function getWorldTrackerDisplay(world: WorldTrackerValues, trackerTemperatureUnit: TrackerTemperatureUnit) {
  const { location, date, time, weather, temperature, worldCustomFields } = world;
  const weatherFamily = classifyWorldWeather(weather);
  const weatherStyle = HUD_WEATHER_STYLES[weatherFamily];
  const dateDisplay = getWorldDateDisplay(date);
  const timeDisplay = getWorldTimeDisplay(time);
  const temperatureDisplay = getTemperatureGaugeDisplay(temperature, trackerTemperatureUnit);
  const hasWorldState =
    [location, date, time, weather, temperature].some((value) => value.trim().length > 0) ||
    worldCustomFields.some((field) => field.name.trim().length > 0 || field.value.trim().length > 0);
  return {
    hasWorldState,
    weatherEmoji: weatherStyle.emoji,
    weatherColor: weatherFamily === "atmosphere" && !weather ? "text-[var(--muted-foreground)]/70" : weatherStyle.color,
    pinColor: getLocationPinColor(location),
    dateDisplay,
    timeDisplay,
    timeColor:
      timeDisplay.kind === "empty" ? "text-[var(--muted-foreground)]/70" : HUD_TIME_COLORS[timeDisplay.timeOfDay],
    temperatureDisplay,
    tempColor: temperatureDisplay.color,
  };
}

type WorldTrackerDisplay = ReturnType<typeof getWorldTrackerDisplay>;

/** The World State tile: a square until there is world state, then a row of icons. */
export function getWorldMiniatureTileClass(hasWorldState: boolean, open = false) {
  return cn(
    getChatToolbarButtonClass({
      compact: true,
      open,
      className: CHAT_TOOLBAR_MOBILE_OVERFLOW_HEIGHT_CLASS,
    }),
    hasWorldState ? "w-auto min-w-8 gap-1 px-2" : "group flex-col gap-0 overflow-hidden",
  );
}

function CombinedWorldWidget({
  location,
  date,
  time,
  weather,
  temperature,
  worldCustomFields,
  trackerTemperatureUnit,
  onSaveLocation,
  onSaveDate,
  onSaveTime,
  onSaveWeather,
  onSaveTemperature,
  onUpdateWorldCustomFields,
  onRerunSingleTracker,
  isTrackerRetryBusy,
}: WorldTrackerValues & {
  trackerTemperatureUnit: TrackerTemperatureUnit;
  onSaveLocation: (v: string) => void;
  onSaveDate: (v: string) => void;
  onSaveTime: (v: string) => void;
  onSaveWeather: (v: string) => void;
  onSaveTemperature: (v: string) => void;
  onUpdateWorldCustomFields: (fields: WorldCustomField[]) => void;
  onRerunSingleTracker?: (agentType: string) => void;
  isTrackerRetryBusy?: boolean;
}) {
  const { t: localizeUi } = useUiTranslation();
  const close = () => useFloatingWindowStore.getState().closeWindow(MOBILE_WORLD_WINDOW_ID);
  const world = { location, date, time, weather, temperature, worldCustomFields };
  const display = getWorldTrackerDisplay(world, trackerTemperatureUnit);

  return (
    <MobileTrackerWindow
      id={MOBILE_WORLD_WINDOW_ID}
      title={localizeUi("ui.panels.appearancesettings.worldState")}
      icon={<MapPin size="0.875rem" />}
      banner={display.hasWorldState && <WorldStateBanner world={world} display={display} />}
      width={288}
      height={400}
    >
      <Suspense
        fallback={<DeferredHUDPanelFallback label={localizeUi("ui.chat.combinedworldwidget.loadingWorldState")} />}
      >
        <CombinedWorldPanel
          location={location}
          date={date}
          time={time}
          weather={weather}
          temperature={temperature}
          worldCustomFields={worldCustomFields}
          onSaveLocation={onSaveLocation}
          onSaveDate={onSaveDate}
          onSaveTime={onSaveTime}
          onSaveWeather={onSaveWeather}
          onSaveTemperature={onSaveTemperature}
          onUpdateWorldCustomFields={onUpdateWorldCustomFields}
          weatherEmoji={display.weatherEmoji}
          pinColor={display.pinColor}
          dateColor={display.dateDisplay.iconColor}
          timeColor={display.timeColor}
          weatherColor={display.weatherColor}
          tempColor={display.tempColor}
          onClose={close}
          onRerunSingleTracker={onRerunSingleTracker}
          isTrackerRetryBusy={isTrackerRetryBusy}
        />
      </Suspense>
    </MobileTrackerWindow>
  );
}

/** World State's banner on its minimized window's button: the miniature, with its values for screen readers. */
export function WorldStateBanner({ world, display }: { world: WorldTrackerValues; display: WorldTrackerDisplay }) {
  const values = [world.location, world.date, world.time, world.weather, world.temperature];
  return (
    <>
      <span aria-hidden="true" className="inline-flex items-center gap-1">
        <WorldStateMiniature display={display} />
      </span>
      <span className="sr-only">{values.filter((value) => value.trim()).join(", ")}</span>
    </>
  );
}

export function WorldStateMiniature({ display }: { display: WorldTrackerDisplay }) {
  const { hasWorldState, dateDisplay, timeDisplay, timeColor, weatherColor, weatherEmoji, temperatureDisplay } =
    display;
  return !hasWorldState ? (
    <MapPin size="0.875rem" className="shrink-0 max-md:h-3.5 max-md:w-3.5" />
  ) : (
    <>
      {/* Location pin */}
      <MapPin size="0.9375rem" className="shrink-0 drop-shadow-sm" />

      {/* Mini calendar with day number */}
      <WorldCalendarIcon
        day={dateDisplay.day}
        className={cn("h-4 w-4 shrink-0 drop-shadow-sm", dateDisplay.iconColor)}
      />

      <WorldClockIcon
        display={timeDisplay}
        variant="monochrome"
        className={cn("h-4 w-4 shrink-0 drop-shadow-sm", timeColor)}
      />

      {/* Weather emoji */}
      <span
        className={cn("text-sm leading-none shrink-0 drop-shadow-sm [text-shadow:0_0_8px_currentColor]", weatherColor)}
      >
        {weatherEmoji}
      </span>

      <WorldThermometerIcon display={temperatureDisplay} variant="solid-bulb" className="h-4 w-[0.625rem] shrink-0" />
      {temperatureDisplay.isPure && (
        <span
          className="shrink-0 text-[0.5rem] font-bold leading-none md:text-[0.5625rem]"
          style={{ color: display.tempColor }}
        >
          {temperatureDisplay.label}
        </span>
      )}
    </>
  );
}

// ═══════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════

const HUD_WEATHER_STYLES: Record<WorldWeatherFamily, { emoji: string; color: string }> = {
  thunder: { emoji: "⛈️", color: "text-violet-300" },
  blizzard: { emoji: "🌨️", color: "text-sky-300" },
  "heavy-rain": { emoji: "🌧️", color: "text-blue-300" },
  rain: { emoji: "🌦️", color: "text-cyan-300" },
  hail: { emoji: "🧊", color: "text-sky-200" },
  snow: { emoji: "❄️", color: "text-sky-300" },
  fog: { emoji: "🌫️", color: "text-zinc-300" },
  sand: { emoji: "🏜️", color: "text-amber-300" },
  ash: { emoji: "🌋", color: "text-stone-300" },
  fire: { emoji: "🔥", color: "text-red-400" },
  wind: { emoji: "💨", color: "text-teal-300" },
  blossom: { emoji: "🌸", color: "text-[var(--marinara-chat-chrome-panel-text)]" },
  aurora: { emoji: "🌌", color: "text-[var(--marinara-chat-chrome-panel-text)]" },
  cloud: { emoji: "☁️", color: "text-zinc-300" },
  clear: { emoji: "☀️", color: "text-yellow-300" },
  heat: { emoji: "🥵", color: "text-red-400" },
  cold: { emoji: "🥶", color: "text-sky-300" },
  atmosphere: { emoji: "🌤️", color: "text-sky-300" },
};

const HUD_TIME_COLORS: Record<ReturnType<typeof getWorldTimeDisplay>["timeOfDay"], string> = {
  dawn: "text-amber-300",
  day: "text-yellow-300",
  dusk: "text-orange-400",
  night: "text-indigo-300",
  unknown: "text-amber-300",
};
