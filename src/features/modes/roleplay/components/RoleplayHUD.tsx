// ──────────────────────────────────────────────
// Chat: Roleplay HUD — immersive world-state widgets
// Each tracker category gets its own mini widget with
// a compact preview and expandable editable popover.
// Supports top (horizontal) and left/right (vertical) layout.
// ──────────────────────────────────────────────
import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { cn } from "../../../../shared/lib/utils";
import { agentApi } from "../../../../shared/api/agent-api";
import { roleplayTrackerApi } from "../api/roleplay-tracker-api";
import { useGameStateStore } from "../../../runtime/world-state/index";
import { useAgentStore } from "../../../../shared/stores/agent.store";
import { useAgentConfigs } from "../../../catalog/agents/index";
import { useChat } from "../../../catalog/chats/index";
import { useTrackerStateController } from "../../../runtime/world-state/index";
import { discardPendingGameStatePatch } from "../../../runtime/world-state/index";
import {
  mergeNamedTrackerListUpdate,
  mergePresentCharacterListUpdate,
  mergeQuestProgressListUpdate,
} from "../../../runtime/world-state/index";
import { TRACKER_SECTION_AGENT_TYPES, type TrackerPanelSection } from "../../../runtime/world-state/index";
import { useUIStore } from "../../../../shared/stores/ui.store";
import type { Message } from "../../../../engine/contracts/types/chat";
import type {
  CharacterStat,
  CustomTrackerField,
  GameState,
  InventoryItem,
  PresentCharacter,
  QuestProgress,
} from "../../../../engine/contracts/types/game-state";
import type { HudPosition } from "../../../../shared/stores/ui.store";
import { ActionsGroup } from "./RoleplayHUDActionsGroup";
import { CombinedPlayerWidget } from "./RoleplayHUDPlayerWidget";
import {
  CharactersWidget,
  CustomTrackerWidget,
  InventoryWidget,
  PersonaStatsWidget,
  QuestsWidget,
} from "./RoleplayHUDTrackerWidgets";
import { MOBILE_HUD_BTN, TrackerPanelToggleButton, WIDGET } from "./RoleplayHUDWidgetShell";
import { CombinedWorldWidget } from "./RoleplayHUDWorldWidget";

interface RoleplayHUDProps {
  chatId: string;
  characterCount: number;
  layout?: HudPosition;
  isStreaming: boolean;
  onRetriggerTrackers?: () => void;
  /** Re-run one tracker agent only (same pipeline as full tracker run). */
  onRerunSingleTracker?: (agentType: string) => void;
  onRetryFailedAgents?: () => void;
  /** When true, tracker agents are manual — show a trigger button in the widget strip */
  manualTrackers?: boolean;
  /** When provided, overrides the globally-computed set so that only per-chat agents show widgets. */
  enabledAgentTypes?: Set<string>;
  /** Chat messages (chronological) — used to resolve cached prompt injections on the latest assistant reply */
  injectionSourceMessages?: Message[];
}

function useIsDesktopHudLayout() {
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(min-width: 768px)").matches : false,
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const query = window.matchMedia("(min-width: 768px)");
    const update = (event: MediaQueryListEvent) => setIsDesktop(event.matches);
    setIsDesktop(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return isDesktop;
}

export function RoleplayHUD({
  chatId,
  characterCount: _characterCount,
  layout = "top",
  isStreaming,
  onRetriggerTrackers,
  onRerunSingleTracker,
  onRetryFailedAgents,
  manualTrackers,
  mobileCompact,
  enabledAgentTypes: enabledAgentTypesProp,
  injectionSourceMessages,
}: RoleplayHUDProps & { mobileCompact?: boolean }) {
  const [agentsOpen, setAgentsOpen] = useState(false);
  const isDesktopHudLayout = useIsDesktopHudLayout();
  const { data: agentConfigs } = useAgentConfigs();
  const globalEnabledAgentTypes = useMemo(() => {
    const set = new Set<string>();
    if (agentConfigs) {
      for (const a of agentConfigs as Array<{ type: string; enabled: string }>) {
        if (a.enabled === "true") set.add(a.type);
      }
    }
    return set;
  }, [agentConfigs]);
  const enabledAgentTypes = enabledAgentTypesProp ?? globalEnabledAgentTypes;
  const trackerStateEnabled = useMemo(
    () => Object.values(TRACKER_SECTION_AGENT_TYPES).some((agentType) => enabledAgentTypes.has(agentType)),
    [enabledAgentTypes],
  );
  const {
    gameState,
    playerStats,
    personaStats: personaStatBars,
    presentCharacters,
    inventory,
    quests: activeQuests,
    customTrackerFields,
    gameStateRefreshing,
    getSnapshot,
    patchField,
    patchPlayerStats,
  } = useTrackerStateController(chatId, "roleplay-hud", trackerStateEnabled);
  const setGameState = useGameStateStore((s) => s.setGameState);

  const { data: chatForAgentsMenu } = useChat(chatId);
  const agentsMenuMetadata = useMemo(() => {
    const raw = chatForAgentsMenu?.metadata;
    let m: Record<string, unknown> = {};
    if (typeof raw === "string") {
      try {
        m = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        m = {};
      }
    } else if (raw && typeof raw === "object") {
      m = raw as Record<string, unknown>;
    }
    return m;
  }, [chatForAgentsMenu?.metadata]);
  const showInjectionsTab = agentsMenuMetadata.showInjectionsPanel === true;
  const showSecretPlotTab =
    agentsMenuMetadata.showSecretPlotPanel === true && enabledAgentTypes.has("secret-plot-driver");

  const thoughtBubbles = useAgentStore((s) => s.thoughtBubbles);
  const isAgentProcessing = useAgentStore((s) => s.isProcessing);
  const failedAgentTypes = useAgentStore((s) => s.failedAgentTypes);
  const failedAgentFailures = useAgentStore((s) => s.failedAgentFailures);
  const dismissThoughtBubble = useAgentStore((s) => s.dismissThoughtBubble);
  const clearThoughtBubbles = useAgentStore((s) => s.clearThoughtBubbles);
  const resetAgentStore = useAgentStore((s) => s.reset);
  const trackerPanelEnabled = useUIStore((s) => s.trackerPanelEnabled);
  const trackerPanelOpen = useUIStore((s) => s.trackerPanelOpen);
  const trackerPanelHideHudWidgets = useUIStore((s) => s.trackerPanelHideHudWidgets);
  const trackerTemperatureUnit = useUIStore((s) => s.trackerTemperatureUnit);
  const toggleTrackerPanel = useUIStore((s) => s.toggleTrackerPanel);

  const isTrackerBusy = isAgentProcessing || isStreaming || gameStateRefreshing;
  const showHudTrackerWidgets = !gameStateRefreshing && !(trackerPanelEnabled && trackerPanelHideHudWidgets);
  const showMobileTrackerWidgets = showHudTrackerWidgets && !isDesktopHudLayout;
  const showDesktopTrackerWidgets = showHudTrackerWidgets && isDesktopHudLayout;

  const clearGameState = useCallback(() => {
    const cleared = {
      date: null,
      time: null,
      location: null,
      weather: null,
      temperature: null,
      presentCharacters: [],
      recentEvents: [],
      playerStats: {
        stats: [],
        attributes: null,
        skills: {},
        inventory: [],
        activeQuests: [],
        status: "",
      },
      personaStats: [],
    };
    const prev = useGameStateStore.getState().current;
    if (prev?.chatId === chatId) {
      setGameState({ ...prev, ...cleared } as GameState);
    } else {
      setGameState({
        id: "",
        chatId,
        messageId: "",
        swipeIndex: 0,
        createdAt: "",
        ...cleared,
      } as GameState);
    }
    void discardPendingGameStatePatch(chatId)
      .then(() => roleplayTrackerApi.clearManualState(chatId, cleared))
      .catch((error) => {
        console.error("[RoleplayHUD] Failed to clear world state:", error);
      });
    // Clear committed agent runs & memory from DB + reset client state
    agentApi.clearRunsForChat(chatId).catch((error) => {
      console.error("[RoleplayHUD] Failed to clear agent runs:", error);
    });
    resetAgentStore();
  }, [chatId, setGameState, resetAgentStore]);

  const date = gameState?.date ?? null;
  const time = gameState?.time ?? null;
  const location = gameState?.location ?? null;
  const weather = gameState?.weather ?? null;
  const temperature = gameState?.temperature ?? null;
  const personaStatus = playerStats?.status ?? "";
  const updatePersonaStats = useCallback(
    (bars: CharacterStat[]) => {
      patchField("personaStats", mergeNamedTrackerListUpdate(personaStatBars, getSnapshot().personaStats, bars));
    },
    [getSnapshot, patchField, personaStatBars],
  );
  const updatePresentCharacters = useCallback(
    (chars: PresentCharacter[]) => {
      patchField(
        "presentCharacters",
        mergePresentCharacterListUpdate(presentCharacters, getSnapshot().presentCharacters, chars),
      );
    },
    [getSnapshot, patchField, presentCharacters],
  );
  const updateInventory = useCallback(
    (items: InventoryItem[]) => {
      patchPlayerStats("inventory", mergeNamedTrackerListUpdate(inventory, getSnapshot().inventory, items));
    },
    [getSnapshot, inventory, patchPlayerStats],
  );
  const updateQuests = useCallback(
    (quests: QuestProgress[]) => {
      patchPlayerStats("activeQuests", mergeQuestProgressListUpdate(activeQuests, getSnapshot().quests, quests));
    },
    [activeQuests, getSnapshot, patchPlayerStats],
  );
  const updateCustomTrackerFields = useCallback(
    (fields: CustomTrackerField[]) => {
      patchPlayerStats(
        "customTrackerFields",
        mergeNamedTrackerListUpdate(customTrackerFields, getSnapshot().customTrackerFields, fields),
      );
    },
    [customTrackerFields, getSnapshot, patchPlayerStats],
  );
  const playerTrackerSections: TrackerPanelSection[] = ["persona", "characters", "quests", "custom"];
  const hasPlayerTrackerSections = playerTrackerSections.some((section) =>
    enabledAgentTypes.has(TRACKER_SECTION_AGENT_TYPES[section]),
  );

  const isVertical = layout === "left" || layout === "right";
  // If mobileCompact, widgets are even narrower and action buttons are not cut off

  return (
    <div
      className={cn(
        "rpg-hud",
        isVertical ? "flex flex-col items-center gap-1.5" : "flex items-center gap-1.5",
        mobileCompact && "flex-1 min-w-0",
      )}
    >
      {trackerPanelEnabled && !trackerPanelOpen && <TrackerPanelToggleButton onToggle={toggleTrackerPanel} />}

      {/* Actions (Agents + Clear) */}
      <ActionsGroup
        chatId={chatId}
        injectionSourceMessages={injectionSourceMessages}
        agentConfigs={agentConfigs}
        isVertical={isVertical}
        agentsOpen={agentsOpen}
        setAgentsOpen={setAgentsOpen}
        isAgentProcessing={isAgentProcessing}
        isGenerationBusy={isTrackerBusy}
        thoughtBubbles={thoughtBubbles}
        clearThoughtBubbles={clearThoughtBubbles}
        dismissThoughtBubble={dismissThoughtBubble}
        enabledAgentTypes={enabledAgentTypes}
        clearGameState={clearGameState}
        onRetriggerTrackers={onRetriggerTrackers}
        onRetryFailedAgents={onRetryFailedAgents}
        failedAgentTypes={failedAgentTypes}
        failedAgentFailures={failedAgentFailures}
        showInjectionsTab={showInjectionsTab}
        showSecretPlotTab={showSecretPlotTab}
      />

      {/* ── Mobile: combined widgets, centered ── */}
      {showMobileTrackerWidgets && (
        <div className={cn("flex items-center gap-0.5 md:hidden", mobileCompact && "flex-1 justify-center")}>
          {enabledAgentTypes.has(TRACKER_SECTION_AGENT_TYPES.world) && (
            <CombinedWorldWidget
              location={location ?? ""}
              date={date ?? ""}
              time={time ?? ""}
              weather={weather ?? ""}
              temperature={temperature ?? ""}
              trackerTemperatureUnit={trackerTemperatureUnit}
              onSaveLocation={(v) => patchField("location", v)}
              onSaveDate={(v) => patchField("date", v)}
              onSaveTime={(v) => patchField("time", v)}
              onSaveWeather={(v) => patchField("weather", v)}
              onSaveTemperature={(v) => patchField("temperature", v)}
              layout={layout}
              onRerunSingleTracker={onRerunSingleTracker}
              isTrackerRetryBusy={isTrackerBusy}
            />
          )}

          {hasPlayerTrackerSections && (
            <CombinedPlayerWidget
              layout={layout}
              showPersona={enabledAgentTypes.has(TRACKER_SECTION_AGENT_TYPES.persona)}
              showCharacters={enabledAgentTypes.has(TRACKER_SECTION_AGENT_TYPES.characters)}
              showQuests={enabledAgentTypes.has(TRACKER_SECTION_AGENT_TYPES.quests)}
              showCustomTracker={enabledAgentTypes.has(TRACKER_SECTION_AGENT_TYPES.custom)}
              personaStats={personaStatBars}
              onUpdatePersonaStats={updatePersonaStats}
              personaStatus={personaStatus}
              onUpdatePersonaStatus={(status) => patchPlayerStats("status", status)}
              characters={presentCharacters}
              onUpdateCharacters={updatePresentCharacters}
              inventory={inventory}
              onUpdateInventory={updateInventory}
              quests={activeQuests}
              onUpdateQuests={updateQuests}
              customTrackerFields={customTrackerFields}
              onUpdateCustomTracker={updateCustomTrackerFields}
              onRerunSingleTracker={onRerunSingleTracker}
              isTrackerRetryBusy={isTrackerBusy}
            />
          )}

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
                isTrackerBusy ? "text-foreground/75" : "text-[var(--muted-foreground)]",
              )}
            >
              <RefreshCw size="0.875rem" className={cn("shrink-0 h-4 w-4", isTrackerBusy && "animate-spin")} />
            </button>
          )}
        </div>
      )}

      {/* ── Desktop: separate individual widgets ── */}
      {showDesktopTrackerWidgets && (
        <div className="hidden md:flex items-center gap-1.5">
          {enabledAgentTypes.has(TRACKER_SECTION_AGENT_TYPES.world) && (
            <CombinedWorldWidget
              location={location ?? ""}
              date={date ?? ""}
              time={time ?? ""}
              weather={weather ?? ""}
              temperature={temperature ?? ""}
              trackerTemperatureUnit={trackerTemperatureUnit}
              onSaveLocation={(v) => patchField("location", v)}
              onSaveDate={(v) => patchField("date", v)}
              onSaveTime={(v) => patchField("time", v)}
              onSaveWeather={(v) => patchField("weather", v)}
              onSaveTemperature={(v) => patchField("temperature", v)}
              layout={layout}
              onRerunSingleTracker={onRerunSingleTracker}
              isTrackerRetryBusy={isTrackerBusy}
            />
          )}

          {enabledAgentTypes.has(TRACKER_SECTION_AGENT_TYPES.persona) && (
            <PersonaStatsWidget
              bars={personaStatBars}
              onUpdate={updatePersonaStats}
              status={personaStatus}
              onUpdateStatus={(status) => patchPlayerStats("status", status)}
              layout={layout}
              onRerunSingleTracker={onRerunSingleTracker}
              isTrackerRetryBusy={isTrackerBusy}
            />
          )}

          {enabledAgentTypes.has(TRACKER_SECTION_AGENT_TYPES.characters) && (
            <CharactersWidget
              characters={presentCharacters}
              onUpdate={updatePresentCharacters}
              chatId={chatId}
              layout={layout}
              onRerunSingleTracker={onRerunSingleTracker}
              isTrackerRetryBusy={isTrackerBusy}
            />
          )}

          {hasPlayerTrackerSections && (
            <InventoryWidget
              items={inventory}
              onUpdate={updateInventory}
              layout={layout}
            />
          )}

          {enabledAgentTypes.has(TRACKER_SECTION_AGENT_TYPES.quests) && (
            <QuestsWidget
              quests={activeQuests}
              onUpdate={updateQuests}
              layout={layout}
              onRerunSingleTracker={onRerunSingleTracker}
              isTrackerRetryBusy={isTrackerBusy}
            />
          )}

          {enabledAgentTypes.has(TRACKER_SECTION_AGENT_TYPES.custom) && (
            <CustomTrackerWidget
              fields={customTrackerFields}
              onUpdate={updateCustomTrackerFields}
              layout={layout}
              onRerunSingleTracker={onRerunSingleTracker}
              isTrackerRetryBusy={isTrackerBusy}
            />
          )}

          {/* Manual tracker trigger button (desktop) */}
          {manualTrackers && onRetriggerTrackers && (
            <button
              onClick={(e) => {
                e.preventDefault();
                onRetriggerTrackers();
              }}
              disabled={isTrackerBusy}
              className={cn(WIDGET, isTrackerBusy ? "text-foreground/75" : "text-[var(--muted-foreground)]")}
              title={isTrackerBusy ? "Trackers running…" : "Run Trackers"}
            >
              <RefreshCw size="0.875rem" className={cn(isTrackerBusy && "animate-spin")} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
