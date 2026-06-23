// ──────────────────────────────────────────────
// Chat: Roleplay HUD — immersive world-state widgets
// Each tracker category gets its own mini widget with
// a compact preview and expandable editable popover.
// Supports top (horizontal) and left/right (vertical) layout.
// ──────────────────────────────────────────────
import { Suspense, lazy, useState, useEffect, useRef, useCallback, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import {
  MapPin,
  Users,
  Package,
  Scroll,
  Sparkles,
  Swords,
  RefreshCw,
  BarChart3,
  SlidersHorizontal,
  Loader2,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { api } from "../../lib/api-client";
import type { AgentFailure } from "../../lib/agent-failures";
import { TrackerPanelIcon } from "../ui/TrackerPanelIcon";
import { useGameStateStore } from "../../stores/game-state.store";
import { useAgentStore } from "../../stores/agent.store";
import { useAgentConfigs, useCustomAgentRuns, type AgentConfigRow } from "../../hooks/use-agents";
import { discardPendingGameStatePatch, useGameStatePatcher } from "../../hooks/use-game-state-patcher";
import { useUIStore } from "../../stores/ui.store";
import {
  getLocationPinColor,
  getTemperatureColor,
  getTemperatureGaugeDisplay,
  getTemperatureKeywordHint,
  getWeatherIconColor,
  getWorldDateIconColor,
  getWorldTimeIconColor,
  parseTemperatureValue,
} from "../../features/tracker-panel/lib/world-state-display";
import { TrackerLockProvider } from "../../features/tracker-panel/components/TrackerLockContext";
import { useTrackerFieldLockUpdater } from "../../features/tracker-panel/hooks/use-tracker-field-lock-updater";
import { ROLEPLAY_POPOVER_SCROLL_AREA, ROLEPLAY_POPOVER_SHELL } from "./roleplay-popover-styles";
import {
  CHAT_TOOLBAR_ICON_GAP_CLASS,
  CHAT_TOOLBAR_MOBILE_OVERFLOW_HEIGHT_CLASS,
  getChatToolbarButtonClass,
} from "./ChatToolbarControls";
import type {
  GameState,
  PresentCharacter,
  CharacterStat,
  InventoryItem,
  QuestProgress,
  CustomTrackerField,
  Message,
} from "@marinara-engine/shared";
import {
  inventoryItemTrackerLockPrefix,
  normalizeTrackerFieldLocksForState,
  removeTrackerFieldLockPrefix,
  toggleTrackerFieldLock,
} from "@marinara-engine/shared";
import type { HudPosition, TrackerTemperatureUnit } from "../../stores/ui.store";

const ACTIONS_DROPDOWN_WIDTH_PX = 288;
const EMPTY_INVENTORY: InventoryItem[] = [];
const EMPTY_AGENT_TYPE_SET = new Set<string>();

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

const RoleplayHUDActionsMenu = lazy(async () =>
  import("./RoleplayHUDActionsMenu").then((module) => ({ default: module.RoleplayHUDActionsMenu })),
);
const CombinedPlayerPanel = lazy(async () =>
  import("./RoleplayHUDPanels").then((module) => ({ default: module.CombinedPlayerPanel })),
);
const PersonaStatsPanel = lazy(async () =>
  import("./RoleplayHUDPanels").then((module) => ({ default: module.PersonaStatsPanel })),
);
const CharactersPanel = lazy(async () =>
  import("./RoleplayHUDPanels").then((module) => ({ default: module.CharactersPanel })),
);
const InventoryPanel = lazy(async () =>
  import("./RoleplayHUDPanels").then((module) => ({ default: module.InventoryPanel })),
);
const QuestsPanel = lazy(async () => import("./RoleplayHUDPanels").then((module) => ({ default: module.QuestsPanel })));
const CustomTrackerPanel = lazy(async () =>
  import("./RoleplayHUDPanels").then((module) => ({ default: module.CustomTrackerPanel })),
);
const CombinedWorldPanel = lazy(async () =>
  import("./RoleplayHUDPanels").then((module) => ({ default: module.CombinedWorldPanel })),
);

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
  const [lockMode, setLockMode] = useState(false);
  const gameState = useGameStateStore((s) => s.current);
  const gameStateRefreshing = useGameStateStore((s) => s.isRefreshing);
  const setGameState = useGameStateStore((s) => s.setGameState);
  const { patchField, patchPlayerStats } = useGameStatePatcher(chatId, "roleplay-hud");

  const { data: agentConfigs } = useAgentConfigs();
  const enabledAgentTypes = enabledAgentTypesProp ?? EMPTY_AGENT_TYPE_SET;

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
  const showInjectionsTab = useUIStore((s) => s.debugMode);

  const isTrackerBusy = isAgentProcessing || isStreaming || gameStateRefreshing;
  const showHudTrackerWidgets = !(trackerPanelEnabled && trackerPanelHideHudWidgets);

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
      fieldLocks: null,
    };
    discardPendingGameStatePatch(chatId);
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
    api.patch(`/chats/${chatId}/game-state`, { ...cleared, manual: true, clearOverrides: true }).catch(() => {});
    // Clear committed agent runs & memory from DB + reset client state
    api.delete(`/agents/runs/${chatId}`).catch(() => {});
    resetAgentStore();
  }, [chatId, setGameState, resetAgentStore]);

  const date = gameState?.date ?? null;
  const time = gameState?.time ?? null;
  const location = gameState?.location ?? null;
  const weather = gameState?.weather ?? null;
  const temperature = gameState?.temperature ?? null;
  const presentCharacters = gameState?.presentCharacters ?? [];
  const personaStatBars = gameState?.personaStats ?? [];
  const playerStats = gameState?.playerStats ?? null;
  const personaStatus = playerStats?.status ?? "";
  const inventory = playerStats?.inventory ?? EMPTY_INVENTORY;
  const activeQuests = playerStats?.activeQuests ?? [];
  const customTrackerFields = playerStats?.customTrackerFields ?? [];
  const fieldLocks = gameState ? normalizeTrackerFieldLocksForState(gameState.fieldLocks, gameState) : null;
  const updateFieldLocks = useTrackerFieldLockUpdater({ chatId, fieldLocks, patchField });
  const updateInventoryItems = useCallback(
    (items: InventoryItem[]) => patchPlayerStats("inventory", items),
    [patchPlayerStats],
  );
  const removeInventoryItem = useCallback(
    (index: number) => {
      updateInventoryItems(inventory.filter((_, itemIndex) => itemIndex !== index));
      updateFieldLocks((locks) => removeTrackerFieldLockPrefix(locks, inventoryItemTrackerLockPrefix(inventory[index]!, index)));
    },
    [inventory, updateFieldLocks, updateInventoryItems],
  );
  const toggleFieldLock = useCallback(
    (key: string) => {
      updateFieldLocks((locks) => toggleTrackerFieldLock(locks, key));
    },
    [updateFieldLocks],
  );
  const hasPersonaStatsTracker = enabledAgentTypes.has("persona-stats");
  const hasPlayerTrackerSections =
    hasPersonaStatsTracker ||
    enabledAgentTypes.has("character-tracker") ||
    enabledAgentTypes.has("quest") ||
    enabledAgentTypes.has("custom-tracker");

  const isVertical = layout === "left" || layout === "right";
  // If mobileCompact, widgets are even narrower and action buttons are not cut off

  return (
    <TrackerLockProvider
      fieldLocks={fieldLocks}
      lockMode={lockMode}
      onSetLockMode={setLockMode}
      onToggleFieldLock={toggleFieldLock}
      onUpdateFieldLocks={updateFieldLocks}
    >
      <div
        className={cn(
          "rpg-hud",
          isVertical ? "flex flex-col items-center" : "flex items-center",
          CHAT_TOOLBAR_ICON_GAP_CLASS,
          mobileCompact && "min-w-0",
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
        />

        {/* ── Mobile: combined widgets, grouped with tracker and agent controls ── */}
        {showHudTrackerWidgets && (
          <div
            className={cn(
              "flex items-center md:hidden",
              CHAT_TOOLBAR_ICON_GAP_CLASS,
              mobileCompact && "min-w-0 justify-start",
            )}
          >
            {enabledAgentTypes.has("world-state") && (
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
                showPersona={hasPersonaStatsTracker}
                showCharacters={enabledAgentTypes.has("character-tracker")}
                showQuests={enabledAgentTypes.has("quest")}
                showCustomTracker={enabledAgentTypes.has("custom-tracker")}
                personaStats={personaStatBars}
                onUpdatePersonaStats={(bars) => patchField("personaStats", bars)}
                personaStatus={personaStatus}
                onUpdatePersonaStatus={(status) => patchPlayerStats("status", status)}
                characters={presentCharacters}
                onUpdateCharacters={(chars) => patchField("presentCharacters", chars)}
                inventory={inventory}
                onUpdateInventory={updateInventoryItems}
                onRemoveInventoryItem={removeInventoryItem}
                quests={activeQuests}
                onUpdateQuests={(q) => patchPlayerStats("activeQuests", q)}
                customTrackerFields={customTrackerFields}
                onUpdateCustomTracker={(fields) => patchPlayerStats("customTrackerFields", fields)}
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
                  isTrackerBusy && "text-[var(--marinara-chat-chrome-button-text-active)]",
                )}
              >
                <RefreshCw size="0.875rem" className={cn("shrink-0 h-4 w-4", isTrackerBusy && "animate-spin")} />
              </button>
            )}
          </div>
        )}

        {/* ── Desktop: separate individual widgets ── */}
        {showHudTrackerWidgets && (
          <div className={cn("hidden items-center md:flex", CHAT_TOOLBAR_ICON_GAP_CLASS)}>
            {enabledAgentTypes.has("world-state") && (
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

            {hasPersonaStatsTracker && (
              <PersonaStatsWidget
                bars={personaStatBars}
                onUpdate={(bars) => patchField("personaStats", bars)}
                status={personaStatus}
                onUpdateStatus={(status) => patchPlayerStats("status", status)}
                layout={layout}
                onRerunSingleTracker={onRerunSingleTracker}
                isTrackerRetryBusy={isTrackerBusy}
              />
            )}

            {enabledAgentTypes.has("character-tracker") && (
              <CharactersWidget
                characters={presentCharacters}
                onUpdate={(chars) => patchField("presentCharacters", chars)}
                chatId={chatId}
                layout={layout}
                onRerunSingleTracker={onRerunSingleTracker}
                isTrackerRetryBusy={isTrackerBusy}
              />
            )}

            {hasPersonaStatsTracker && (
              <InventoryWidget
                items={inventory}
                onUpdate={updateInventoryItems}
                onRemoveItem={removeInventoryItem}
                layout={layout}
              />
            )}

            {enabledAgentTypes.has("quest") && (
              <QuestsWidget
                quests={activeQuests}
                onUpdate={(q) => patchPlayerStats("activeQuests", q)}
                layout={layout}
                onRerunSingleTracker={onRerunSingleTracker}
                isTrackerRetryBusy={isTrackerBusy}
              />
            )}

            {enabledAgentTypes.has("custom-tracker") && (
              <CustomTrackerWidget
                fields={customTrackerFields}
                onUpdate={(fields) => patchPlayerStats("customTrackerFields", fields)}
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
                className={cn(WIDGET, isTrackerBusy && "text-[var(--marinara-chat-chrome-button-text-active)]")}
                title={isTrackerBusy ? "Trackers running…" : "Run Trackers"}
              >
                <RefreshCw size="0.875rem" className={cn(isTrackerBusy && "animate-spin")} />
              </button>
            )}
          </div>
        )}
      </div>
    </TrackerLockProvider>
  );
}

// ═══════════════════════════════════════════════
// Actions Group (Agents dropdown, Echo Chamber toggle, Clear)
// ═══════════════════════════════════════════════

/** Common mobile HUD button sizing – used by all four strip buttons */
const HUD_ICON_BUTTON = getChatToolbarButtonClass({ compact: true });
const MOBILE_HUD_BTN = cn(HUD_ICON_BUTTON, CHAT_TOOLBAR_MOBILE_OVERFLOW_HEIGHT_CLASS, "cursor-pointer select-none");

function DeferredHUDPanelFallback({ label }: { label: string }) {
  return <div className="px-3 py-4 text-center text-[0.625rem] text-[var(--muted-foreground)]/60">{label}</div>;
}

function DeferredActionsFallback({ isAgentProcessing }: { isAgentProcessing: boolean }) {
  return (
    <div className="px-3 py-4 text-center text-[0.625rem] text-[var(--muted-foreground)]/60">
      {isAgentProcessing ? "Loading agent activity…" : "Loading actions…"}
    </div>
  );
}

function customAgentRunIdentity(run: { agentType?: string | null; id?: string | null }) {
  return run.agentType?.trim() || run.id?.trim() || "custom-agent";
}

function TrackerPanelToggleButton({ onToggle }: { onToggle: () => void }) {
  return (
    <button
      data-tracker-panel-toggle="roleplay-hud"
      onClick={onToggle}
      className={WIDGET}
      title="Show Tracker Panel"
      aria-label="Show Tracker Panel"
    >
      <TrackerPanelIcon size="1.05rem" strokeWidth={1.95} className="shrink-0" />
      <span className="sr-only">Tracker Panel</span>
    </button>
  );
}

interface ActionsGroupProps {
  chatId: string;
  injectionSourceMessages?: Message[];
  agentConfigs?: AgentConfigRow[];
  isVertical: boolean;
  agentsOpen: boolean;
  setAgentsOpen: (v: boolean) => void;
  isAgentProcessing: boolean;
  isGenerationBusy: boolean;
  thoughtBubbles: Array<{ agentId: string; agentName: string; content: string; timestamp: number }>;
  clearThoughtBubbles: () => void;
  dismissThoughtBubble: (i: number) => void;
  enabledAgentTypes: Set<string>;
  clearGameState: () => void;
  onRetriggerTrackers?: () => void;
  onRetryFailedAgents?: () => void;
  failedAgentTypes: string[];
  failedAgentFailures: AgentFailure[];
  showInjectionsTab?: boolean;
}

function ActionsGroup({
  chatId,
  injectionSourceMessages,
  agentConfigs,
  isVertical,
  agentsOpen,
  setAgentsOpen,
  isAgentProcessing,
  isGenerationBusy,
  thoughtBubbles,
  clearThoughtBubbles,
  dismissThoughtBubble,
  enabledAgentTypes,
  clearGameState,
  onRetriggerTrackers,
  onRetryFailedAgents,
  failedAgentTypes,
  failedAgentFailures,
  showInjectionsTab,
}: ActionsGroupProps) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const echoChamberOpen = useUIStore((s) => s.echoChamberOpen);
  const toggleEchoChamber = useUIStore((s) => s.toggleEchoChamber);
  const echoMessages = useAgentStore((s) => s.echoMessages);
  const showEcho = enabledAgentTypes.has("echo-chamber");
  const { data: customAgentRuns = [], isLoading: customAgentRunsLoading } = useCustomAgentRuns(chatId, agentsOpen);

  const computeActionsPosition = useCallback(() => {
    if (!btnRef.current) return null;
    const rect = btnRef.current.getBoundingClientRect();
    const dropdownWidth = dropdownRef.current?.offsetWidth ?? ACTIONS_DROPDOWN_WIDTH_PX;
    const dropdownHeight = dropdownRef.current?.offsetHeight ?? Math.min(320, window.innerHeight - 16);
    const belowTop = rect.bottom + 4;
    const aboveTop = rect.top - dropdownHeight - 4;
    const preferredTop = belowTop + dropdownHeight > window.innerHeight - 8 ? aboveTop : belowTop;
    const top = Math.max(8, Math.min(preferredTop, window.innerHeight - dropdownHeight - 8));
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - dropdownWidth - 8));
    return { top, left };
  }, []);

  // Position with fixed layout to avoid overflow clipping
  useLayoutEffect(() => {
    if (!agentsOpen) return;
    setPos(computeActionsPosition());
  }, [agentsOpen, computeActionsPosition]);

  useEffect(() => {
    if (!agentsOpen) return;
    const update = () => setPos(computeActionsPosition());
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    const observer = new ResizeObserver(update);
    if (dropdownRef.current) observer.observe(dropdownRef.current);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
      observer.disconnect();
    };
  }, [agentsOpen, computeActionsPosition]);

  // Close on outside click or Escape
  useEffect(() => {
    if (!agentsOpen) return;
    const handler = (e: MouseEvent) => {
      if (btnRef.current?.contains(e.target as Node) || dropdownRef.current?.contains(e.target as Node)) return;
      setAgentsOpen(false);
    };
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAgentsOpen(false);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", keyHandler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", keyHandler);
    };
  }, [agentsOpen, setAgentsOpen]);

  // Badge count — unique agent types that produced results
  const generatedAgentIds = new Set([
    ...thoughtBubbles.map((bubble) => bubble.agentId),
    ...customAgentRuns.map(customAgentRunIdentity),
  ]);
  if (echoMessages.length > 0 && !generatedAgentIds.has("echo-chamber")) generatedAgentIds.add("echo-chamber");
  const generatedAgentCount = generatedAgentIds.size;
  const agentsLabel = `Agents & Actions${generatedAgentCount > 0 ? ` - ${generatedAgentCount} generated` : ""}${
    failedAgentTypes.length > 0 ? ` - ${failedAgentTypes.length} failed` : ""
  }`;
  const hasAgentCount = generatedAgentCount > 0 || failedAgentTypes.length > 0;

  // ── Shared dropdown portal (used by both desktop & mobile) ──
  const dropdownContent =
    agentsOpen &&
    pos &&
    createPortal(
      <div
        ref={dropdownRef}
        className={cn(
          ROLEPLAY_POPOVER_SHELL,
          ROLEPLAY_POPOVER_SCROLL_AREA,
          "fixed z-[9999] max-h-80 w-72 max-w-[calc(100vw-1rem)] overflow-y-auto",
        )}
        style={{ top: pos.top, left: pos.left }}
      >
        <Suspense fallback={<DeferredActionsFallback isAgentProcessing={isAgentProcessing} />}>
          <RoleplayHUDActionsMenu
            chatId={chatId}
            injectionSourceMessages={injectionSourceMessages}
            isAgentProcessing={isAgentProcessing}
            isGenerationBusy={isGenerationBusy}
            thoughtBubbles={thoughtBubbles}
            clearThoughtBubbles={clearThoughtBubbles}
            dismissThoughtBubble={dismissThoughtBubble}
            customAgentRuns={customAgentRuns}
            customAgentRunsLoading={customAgentRunsLoading}
            agentConfigs={agentConfigs}
            enabledAgentTypes={enabledAgentTypes}
            showEcho={showEcho}
            echoChamberOpen={echoChamberOpen}
            toggleEchoChamber={toggleEchoChamber}
            echoMessageCount={echoMessages.length}
            clearGameState={clearGameState}
            onRetriggerTrackers={onRetriggerTrackers}
            onRetryFailedAgents={onRetryFailedAgents}
            failedAgentTypes={failedAgentTypes}
            failedAgentFailures={failedAgentFailures}
            onClose={() => setAgentsOpen(false)}
            showInjectionsTab={showInjectionsTab}
          />
        </Suspense>
      </div>,
      document.body,
    );

  return (
    <div className={cn("relative flex items-center", CHAT_TOOLBAR_ICON_GAP_CLASS, isVertical && "flex-col")}>
      <button
        ref={btnRef}
        onClick={() => setAgentsOpen(!agentsOpen)}
        className={cn(
          getChatToolbarButtonClass({
            compact: true,
            open: agentsOpen,
            className: cn(CHAT_TOOLBAR_MOBILE_OVERFLOW_HEIGHT_CLASS, hasAgentCount && "w-auto min-w-8 gap-1.5 px-2"),
          }),
          "group cursor-pointer select-none",
        )}
        title={agentsLabel}
        aria-label={agentsLabel}
      >
        {isAgentProcessing ? (
          <Loader2 size="0.875rem" strokeWidth={2.5} className="shrink-0 animate-spin transition-colors" />
        ) : (
          <Sparkles size="0.875rem" strokeWidth={2.5} className="shrink-0 transition-colors" />
        )}
        {generatedAgentCount > 0 && (
          <span
            className={cn(
              "shrink-0 rounded-full bg-[var(--marinara-chat-chrome-highlight-bg)] px-1.5 py-0.5 text-[0.625rem] font-medium tabular-nums text-[var(--marinara-chat-chrome-button-text-hover)]",
              agentsOpen && "bg-[var(--marinara-chat-chrome-highlight-bg-hover)]",
            )}
            aria-hidden="true"
          >
            {generatedAgentCount}
          </span>
        )}
        {failedAgentTypes.length > 0 && (
          <span
            className="shrink-0 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[0.625rem] font-medium tabular-nums text-amber-200"
            aria-hidden="true"
          >
            {failedAgentTypes.length}
          </span>
        )}
      </button>
      {dropdownContent}
    </div>
  );
}

// ═══════════════════════════════════════════════
// Combined Player Widget — merges Persona, Chars,
// Inventory, and Quests into a single expandable panel
// ═══════════════════════════════════════════════

function CombinedPlayerWidget({
  layout = "top",
  showPersona,
  showCharacters,
  showQuests,
  showCustomTracker,
  personaStats,
  onUpdatePersonaStats,
  personaStatus,
  onUpdatePersonaStatus,
  characters,
  onUpdateCharacters,
  inventory,
  onUpdateInventory,
  onRemoveInventoryItem,
  quests,
  onUpdateQuests,
  customTrackerFields,
  onUpdateCustomTracker,
  onRerunSingleTracker,
  isTrackerRetryBusy,
}: {
  layout?: HudPosition;
  showPersona: boolean;
  showCharacters: boolean;
  showQuests: boolean;
  showCustomTracker: boolean;
  personaStats: CharacterStat[];
  onUpdatePersonaStats: (bars: CharacterStat[]) => void;
  personaStatus: string;
  onUpdatePersonaStatus: (status: string) => void;
  characters: PresentCharacter[];
  onUpdateCharacters: (chars: PresentCharacter[]) => void;
  inventory: InventoryItem[];
  onUpdateInventory: (items: InventoryItem[]) => void;
  onRemoveInventoryItem?: (index: number) => void;
  quests: QuestProgress[];
  onUpdateQuests: (quests: QuestProgress[]) => void;
  customTrackerFields: CustomTrackerField[];
  onUpdateCustomTracker: (fields: CustomTrackerField[]) => void;
  onRerunSingleTracker?: (agentType: string) => void;
  isTrackerRetryBusy?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="relative">
      <button ref={buttonRef} onClick={() => setOpen(!open)} className={WIDGET} title="Player & Tracker">
        <div className="flex h-4 items-center justify-center shrink-0">
          <Swords size="0.875rem" className="max-md:h-4 max-md:w-4" />
        </div>
        <span className="sr-only">Tracker</span>
      </button>

      <WidgetPopover
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={buttonRef}
        placement={layout === "left" ? "right" : layout === "right" ? "left" : "bottom"}
        className="w-80 max-h-[min(75vh,32rem)]"
      >
        <Suspense fallback={<DeferredHUDPanelFallback label="Loading trackers…" />}>
          <CombinedPlayerPanel
            showPersona={showPersona}
            showCharacters={showCharacters}
            showQuests={showQuests}
            showCustomTracker={showCustomTracker}
            personaStats={personaStats}
            onUpdatePersonaStats={onUpdatePersonaStats}
            personaStatus={personaStatus}
            onUpdatePersonaStatus={onUpdatePersonaStatus}
            characters={characters}
            onUpdateCharacters={onUpdateCharacters}
            inventory={inventory}
            onUpdateInventory={onUpdateInventory}
            onRemoveInventoryItem={onRemoveInventoryItem}
            quests={quests}
            onUpdateQuests={onUpdateQuests}
            customTrackerFields={customTrackerFields}
            onUpdateCustomTracker={onUpdateCustomTracker}
            onClose={() => setOpen(false)}
            onRerunSingleTracker={onRerunSingleTracker}
            isTrackerRetryBusy={isTrackerRetryBusy}
          />
        </Suspense>
      </WidgetPopover>
    </div>
  );
}

/** Shared popover wrapper used by tracker widgets — renders via portal to escape overflow clipping */
function WidgetPopover({
  open,
  onClose,
  anchorRef,
  placement = "bottom",
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
  placement?: "bottom" | "right" | "left";
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const computePosition = useCallback(() => {
    if (!anchorRef.current) return null;
    const rect = anchorRef.current.getBoundingClientRect();
    const popoverWidth = ref.current?.offsetWidth ?? 288;
    const popoverHeight = ref.current?.offsetHeight ?? 200;
    let top: number;
    let left: number;

    if (placement === "right") {
      left = rect.right + 4;
      top = rect.top;
      if (top + popoverHeight > window.innerHeight - 8) {
        top = Math.max(8, window.innerHeight - popoverHeight - 8);
      }
    } else if (placement === "left") {
      left = rect.left - popoverWidth - 4;
      top = rect.top;
      if (left < 8) left = 8;
      if (top + popoverHeight > window.innerHeight - 8) {
        top = Math.max(8, window.innerHeight - popoverHeight - 8);
      }
    } else {
      // Bottom placement — center horizontally on screen for mobile
      top = rect.bottom + 4;
      const isMobile = window.innerWidth < 768;
      if (isMobile) {
        left = Math.round((window.innerWidth - popoverWidth) / 2);
      } else {
        left = rect.left;
        if (left + popoverWidth > window.innerWidth - 8) {
          left = Math.max(8, window.innerWidth - popoverWidth - 8);
        }
      }
    }
    return {
      top: Math.max(8, Math.min(top, window.innerHeight - popoverHeight - 8)),
      left: Math.max(8, Math.min(left, window.innerWidth - popoverWidth - 8)),
    };
  }, [anchorRef, placement]);

  // Position the popover relative to the anchor element
  useLayoutEffect(() => {
    if (!open) return;
    setPos(computePosition());
  }, [open, computePosition]);

  // Reposition on scroll/resize
  useEffect(() => {
    if (!open) return;
    const update = () => setPos(computePosition());
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    const observer = new ResizeObserver(update);
    if (ref.current) observer.observe(ref.current);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
      observer.disconnect();
    };
  }, [open, computePosition]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (ref.current && !ref.current.contains(target) && !anchorRef.current?.contains(target)) {
        // Delay close so that the input's blur event fires first, committing any edits
        requestAnimationFrame(() => onClose());
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, onClose, anchorRef]);

  if (!open) return null;
  return createPortal(
    <div
      ref={ref}
      style={pos ? { position: "fixed", top: pos.top, left: pos.left } : { position: "fixed", top: -9999, left: -9999 }}
      className={cn(
        ROLEPLAY_POPOVER_SHELL,
        ROLEPLAY_POPOVER_SCROLL_AREA,
        "z-[9999] min-h-24 min-w-60 max-w-[calc(100vw-1rem)] resize overflow-auto",
        className,
        "!max-h-[calc(100vh-1rem)]",
      )}
    >
      {children}
    </div>,
    document.body,
  );
}

// ── Present Characters Widget ────────────────

function CharactersWidget({
  characters,
  onUpdate,
  chatId,
  layout = "top",
  onRerunSingleTracker,
  isTrackerRetryBusy,
}: {
  characters: PresentCharacter[];
  onUpdate: (chars: PresentCharacter[]) => void;
  chatId: string;
  layout?: HudPosition;
  onRerunSingleTracker?: (agentType: string) => void;
  isTrackerRetryBusy?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="relative">
      <button ref={buttonRef} onClick={() => setOpen(!open)} className={WIDGET} title="Present Characters">
        {characters.length > 0 ? (
          <div className="flex items-center -space-x-0.5">
            {characters.slice(0, 3).map((c, i) => (
              <span key={i} className="text-xs max-md:text-[0.5625rem] leading-none">
                {c.emoji || "👤"}
              </span>
            ))}
            {characters.length > 3 && (
              <span className="text-[0.4375rem] text-[var(--muted-foreground)]/60 ml-0.5">
                +{characters.length - 3}
              </span>
            )}
          </div>
        ) : (
          <Users size="0.875rem" className="transition-colors max-md:h-3.5 max-md:w-3.5" />
        )}
      </button>

      <WidgetPopover
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={buttonRef}
        placement={layout === "left" ? "right" : layout === "right" ? "left" : "bottom"}
        className="w-72 max-h-80 overflow-y-auto"
      >
        <Suspense fallback={<DeferredHUDPanelFallback label="Loading characters…" />}>
          <CharactersPanel
            characters={characters}
            onUpdate={onUpdate}
            chatId={chatId}
            onRerunSingleTracker={onRerunSingleTracker}
            isTrackerRetryBusy={isTrackerRetryBusy}
          />
        </Suspense>
      </WidgetPopover>
    </div>
  );
}

// ── Persona Stats Widget ─────────────────────

function PersonaStatsWidget({
  bars,
  onUpdate,
  status,
  onUpdateStatus,
  layout = "top",
  onRerunSingleTracker,
  isTrackerRetryBusy,
}: {
  bars: CharacterStat[];
  onUpdate: (bars: CharacterStat[]) => void;
  status: string;
  onUpdateStatus: (status: string) => void;
  layout?: HudPosition;
  onRerunSingleTracker?: (agentType: string) => void;
  isTrackerRetryBusy?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="relative">
      <button ref={buttonRef} onClick={() => setOpen(!open)} className={WIDGET} title="Persona Stats">
        {bars.length > 0 ? (
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
        ) : (
          <BarChart3 size="0.875rem" className="max-md:h-3.5 max-md:w-3.5" />
        )}
        <span className="sr-only">Persona</span>
      </button>

      <WidgetPopover
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={buttonRef}
        placement={layout === "left" ? "right" : layout === "right" ? "left" : "bottom"}
        className="w-60 max-h-80 overflow-y-auto"
      >
        <Suspense fallback={<DeferredHUDPanelFallback label="Loading persona stats…" />}>
          <PersonaStatsPanel
            bars={bars}
            onUpdate={onUpdate}
            status={status}
            onUpdateStatus={onUpdateStatus}
            onRerunSingleTracker={onRerunSingleTracker}
            isTrackerRetryBusy={isTrackerRetryBusy}
          />
        </Suspense>
      </WidgetPopover>
    </div>
  );
}

// ── Custom Tracker Widget ────────────────────

function CustomTrackerWidget({
  fields,
  onUpdate,
  layout = "top",
  onRerunSingleTracker,
  isTrackerRetryBusy,
}: {
  fields: CustomTrackerField[];
  onUpdate: (fields: CustomTrackerField[]) => void;
  layout?: HudPosition;
  onRerunSingleTracker?: (agentType: string) => void;
  isTrackerRetryBusy?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [cycleIdx, setCycleIdx] = useState(0);
  const [animKey, setAnimKey] = useState(0);

  // Cycle through fields every 3 seconds
  useEffect(() => {
    if (fields.length <= 1) return;
    const timer = setInterval(() => {
      setCycleIdx((prev) => (prev + 1) % fields.length);
      setAnimKey((k) => k + 1);
    }, 3000);
    return () => clearInterval(timer);
  }, [fields.length]);

  useEffect(() => {
    if (cycleIdx >= fields.length) setCycleIdx(0);
  }, [fields.length, cycleIdx]);

  const currentField = fields[cycleIdx];
  const previewLabel = currentField
    ? currentField.value
      ? `${currentField.name}: ${currentField.value}`
      : currentField.name
    : "";
  const longestWord = previewLabel.split(/\s+/).reduce((max, w) => Math.max(max, w.length), 0);
  const previewFontSize = Math.max(3.5, Math.min(6, 60 / Math.max(longestWord, 1)));

  return (
    <div className="relative">
      <button ref={buttonRef} onClick={() => setOpen(!open)} className={WIDGET} title="Custom Tracker">
        {fields.length > 0 && currentField ? (
          <span
            key={animKey}
            className="w-full px-0.5 text-center font-semibold leading-[1.2] animate-[inventory-cycle_0.4s_ease-out]"
            style={{ fontSize: `${previewFontSize}px` }}
          >
            {previewLabel}
          </span>
        ) : (
          <SlidersHorizontal size="0.875rem" className="max-md:h-3 max-md:w-3" />
        )}
      </button>

      <WidgetPopover
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={buttonRef}
        placement={layout === "left" ? "right" : layout === "right" ? "left" : "bottom"}
        className="w-72 max-h-80 overflow-y-auto"
      >
        <Suspense fallback={<DeferredHUDPanelFallback label="Loading custom tracker…" />}>
          <CustomTrackerPanel
            fields={fields}
            onUpdate={onUpdate}
            onRerunSingleTracker={onRerunSingleTracker}
            isTrackerRetryBusy={isTrackerRetryBusy}
          />
        </Suspense>
      </WidgetPopover>
    </div>
  );
}

// ── Inventory Widget ─────────────────────────

function InventoryWidget({
  items,
  onUpdate,
  onRemoveItem,
  layout = "top",
}: {
  items: InventoryItem[];
  onUpdate: (items: InventoryItem[]) => void;
  onRemoveItem?: (index: number) => void;
  layout?: HudPosition;
}) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [cycleIdx, setCycleIdx] = useState(0);
  const [animKey, setAnimKey] = useState(0);

  // Cycle through items every 3 seconds
  useEffect(() => {
    if (items.length <= 1) return;
    const timer = setInterval(() => {
      setCycleIdx((prev) => (prev + 1) % items.length);
      setAnimKey((k) => k + 1);
    }, 3000);
    return () => clearInterval(timer);
  }, [items.length]);

  // Reset index if items shrink
  useEffect(() => {
    if (cycleIdx >= items.length) setCycleIdx(0);
  }, [items.length, cycleIdx]);

  const currentItem = items[cycleIdx];

  // Auto-shrink font so the longest word fits on one line within ~36px usable width
  const itemLabel = currentItem
    ? currentItem.quantity > 1
      ? `${currentItem.name} ×${currentItem.quantity}`
      : currentItem.name
    : "";
  const longestWord = itemLabel.split(/\s+/).reduce((max, w) => Math.max(max, w.length), 0);
  // ~0.6em per char at a given font size; widget inner ≈ 36px → fontSize ≤ 60/longestWord
  const itemFontSize = Math.max(3.5, Math.min(6, 60 / Math.max(longestWord, 1)));

  return (
    <div className="relative">
      <button ref={buttonRef} onClick={() => setOpen(!open)} className={WIDGET} title="Inventory">
        {items.length > 0 && currentItem ? (
          <span
            key={animKey}
            className="w-full px-0.5 text-center font-semibold leading-[1.2] animate-[inventory-cycle_0.4s_ease-out]"
            style={{ fontSize: `${itemFontSize}px` }}
          >
            {itemLabel}
          </span>
        ) : (
          <Package size="0.875rem" className="max-md:h-3 max-md:w-3" />
        )}
      </button>

      <WidgetPopover
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={buttonRef}
        placement={layout === "left" ? "right" : layout === "right" ? "left" : "bottom"}
        className="w-64 max-h-80 overflow-y-auto"
      >
        <Suspense fallback={<DeferredHUDPanelFallback label="Loading inventory…" />}>
          <InventoryPanel items={items} onUpdate={onUpdate} onRemoveItem={onRemoveItem} />
        </Suspense>
      </WidgetPopover>
    </div>
  );
}

// ── Quests Widget ────────────────────────────

function QuestsWidget({
  quests,
  onUpdate,
  layout = "top",
  onRerunSingleTracker,
  isTrackerRetryBusy,
}: {
  quests: QuestProgress[];
  onUpdate: (quests: QuestProgress[]) => void;
  layout?: HudPosition;
  onRerunSingleTracker?: (agentType: string) => void;
  isTrackerRetryBusy?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Find the first incomplete objective from the most recent incomplete quest
  const incompleteQuests = quests.filter((q) => !q.completed);
  const mainQuest = incompleteQuests.length > 0 ? incompleteQuests[incompleteQuests.length - 1] : undefined;
  const currentObjective = mainQuest?.objectives.find((o) => !o.completed);

  return (
    <div className="relative">
      <button ref={buttonRef} onClick={() => setOpen(!open)} className={WIDGET} title="Active Quests">
        {currentObjective ? (
          <span className="widget-scroll-text w-full px-0.5 text-center text-[0.375rem] font-semibold leading-[1.15] max-md:text-[0.5rem]">
            <span className="inline-flex animate-[widget-scroll_8s_linear_infinite] whitespace-nowrap">
              <span className="px-3">{currentObjective.text}</span>
              <span className="px-3" aria-hidden>
                {currentObjective.text}
              </span>
            </span>
          </span>
        ) : (
          <Scroll size="0.875rem" className="max-md:h-3 max-md:w-3" />
        )}
      </button>

      <WidgetPopover
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={buttonRef}
        placement={layout === "left" ? "right" : layout === "right" ? "left" : "bottom"}
        className="w-72 max-h-96 overflow-y-auto"
      >
        <Suspense fallback={<DeferredHUDPanelFallback label="Loading quests…" />}>
          <QuestsPanel
            quests={quests}
            onUpdate={onUpdate}
            onRerunSingleTracker={onRerunSingleTracker}
            isTrackerRetryBusy={isTrackerRetryBusy}
          />
        </Suspense>
      </WidgetPopover>
    </div>
  );
}

// ═══════════════════════════════════════════════
// Uniform World-State Widgets
// ═══════════════════════════════════════════════

const WIDGET = cn(
  HUD_ICON_BUTTON,
  CHAT_TOOLBAR_MOBILE_OVERFLOW_HEIGHT_CLASS,
  "group flex-col gap-0 overflow-hidden cursor-pointer select-none",
);

// ═══════════════════════════════════════════════
// Combined World-State Widget (icon strip + popover, desktop & mobile)
// ═══════════════════════════════════════════════

function CombinedWorldWidget({
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
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const weatherEmoji = weather ? getWeatherEmoji(weather) : "🌤️";
  const pinColor = getLocationPinColor(location);
  const dateColor = getWorldDateIconColor(date);
  const timeColor = getWorldTimeIconColor(time);
  const weatherColor = getWeatherIconColor(weather);
  const temperatureDisplay = getTemperatureGaugeDisplay(temperature, trackerTemperatureUnit);
  const tempNumeric = temperature ? parseTemperatureValue(temperature) : null;
  const temp = tempNumeric ?? (temperature ? getTemperatureKeywordHint(temperature) : null);
  const tempColor = getTemperatureColor(temperature);

  // Dynamic calendar: show day number
  const dateParts = date ? parseDateLabel(date) : { day: null, month: null };

  // Dynamic clock: compute hand angles
  const hour = time ? extractHourFromTime(time) : -1;
  const minute = time ? parseMinutes(time) : 0;
  const hourAngle = hour >= 0 ? (hour % 12) * 30 + minute * 0.5 : 0;
  const minuteAngle = minute * 6;

  const tempFill =
    temperatureDisplay.percent == null ? 0.3 : Math.max(0, Math.min(1, temperatureDisplay.percent / 100));
  const tempFillColor = temperatureDisplay.color;
  const sideLayout = layout === "left" || layout === "right";

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setOpen(!open)}
        className={cn(
          getChatToolbarButtonClass({
            compact: true,
            open,
            className: CHAT_TOOLBAR_MOBILE_OVERFLOW_HEIGHT_CLASS,
          }),
          "cursor-pointer select-none",
          !sideLayout && "w-auto min-w-8 gap-1 px-2",
        )}
        title="World State"
      >
        {/* Location pin */}
        <MapPin size="0.9375rem" className={cn("shrink-0 drop-shadow-sm", pinColor)} />

        {/* Mini calendar with day number */}
        {!sideLayout && (
          <>
            <svg viewBox="0 0 20 20" fill="none" className={cn("shrink-0 h-4 w-4 drop-shadow-sm", dateColor)}>
              <rect x="2" y="4" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" opacity="0.7" />
              <line x1="2" y1="8" x2="18" y2="8" stroke="currentColor" strokeWidth="1.2" opacity="0.5" />
              <line
                x1="6"
                y1="2"
                x2="6"
                y2="5.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                opacity="0.7"
              />
              <line
                x1="14"
                y1="2"
                x2="14"
                y2="5.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                opacity="0.7"
              />
              {dateParts.day && (
                <text
                  x="10"
                  y="15.5"
                  textAnchor="middle"
                  fill="currentColor"
                  fontSize="7"
                  fontWeight="700"
                  opacity="0.95"
                >
                  {dateParts.day}
                </text>
              )}
            </svg>

            {/* Mini clock with dynamic hands */}
            <svg viewBox="0 0 20 20" fill="none" className={cn("shrink-0 h-4 w-4 drop-shadow-sm", timeColor)}>
              <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" opacity="0.7" />
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
                    opacity="0.95"
                  />
                  <line
                    x1="10"
                    y1="10"
                    x2={10 + 5.8 * Math.sin((minuteAngle * Math.PI) / 180)}
                    y2={10 - 5.8 * Math.cos((minuteAngle * Math.PI) / 180)}
                    stroke="currentColor"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                    opacity="0.8"
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
                    opacity="0.95"
                  />
                  <line
                    x1="10"
                    y1="10"
                    x2="14"
                    y2="10"
                    stroke="currentColor"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                    opacity="0.8"
                  />
                </>
              )}
              <circle cx="10" cy="10" r="1" fill="currentColor" opacity="0.95" />
            </svg>

            {/* Weather emoji */}
            <span
              className={cn(
                "text-sm leading-none shrink-0 drop-shadow-sm [text-shadow:0_0_8px_currentColor]",
                weatherColor,
              )}
            >
              {weatherEmoji}
            </span>

            {/* Mini thermometer with fill — vivid color & fill level changes dynamically */}
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
          </>
        )}
      </button>

      <WidgetPopover
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={buttonRef}
        placement={layout === "left" ? "right" : layout === "right" ? "left" : "bottom"}
        className="w-64"
      >
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
            dateColor={dateColor}
            timeColor={timeColor}
            weatherColor={weatherColor}
            tempColor={tempColor}
            onClose={() => setOpen(false)}
            onRerunSingleTracker={onRerunSingleTracker}
            isTrackerRetryBusy={isTrackerRetryBusy}
          />
        </Suspense>
      </WidgetPopover>
    </div>
  );
}

// ═══════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════

function parseDateLabel(date: string): { day: string | null; month: string | null } {
  const numMatch = date.match(/(\d+)/);
  const day = numMatch ? numMatch[1] : null;
  const words = date
    .replace(/\d+(st|nd|rd|th)?/gi, "")
    .split(/[\s,/.-]+/)
    .filter((w) => w.length > 2);
  const month = words[0]?.slice(0, 3) ?? null;
  return { day, month };
}

function extractHourFromTime(time: string): number {
  const t = time.toLowerCase();
  const m24 = t.match(/\b(\d{1,2})[:.h](\d{2})\b/);
  if (m24) {
    let h = parseInt(m24[1]!, 10);
    if (t.includes("pm") && h < 12) h += 12;
    if (t.includes("am") && h === 12) h = 0;
    if (h >= 0 && h < 24) return h;
  }
  const mAP = t.match(/\b(\d{1,2})\s*(am|pm)\b/);
  if (mAP) {
    let h = parseInt(mAP[1]!, 10);
    if (mAP[2] === "pm" && h < 12) h += 12;
    if (mAP[2] === "am" && h === 12) h = 0;
    if (h >= 0 && h < 24) return h;
  }
  if (t.includes("midnight")) return 0;
  if (t.includes("dawn") || t.includes("sunrise")) return 6;
  if (t.includes("morning")) return 9;
  if (t.includes("noon") || t.includes("midday")) return 12;
  if (t.includes("afternoon")) return 15;
  if (t.includes("dusk") || t.includes("sunset") || t.includes("evening")) return 18;
  if (t.includes("night")) return 22;
  return -1;
}

function parseMinutes(time: string): number {
  const m = time.match(/\b\d{1,2}[:.h](\d{2})\b/);
  return m ? parseInt(m[1]!, 10) : 0;
}

function getWeatherEmoji(weather: string): string {
  const w = weather.toLowerCase();
  if (w.includes("thunder") || w.includes("lightning")) return "⛈️";
  if (w.includes("blizzard")) return "🌨️";
  if (w.includes("heavy rain") || w.includes("downpour") || w.includes("storm")) return "🌧️";
  if (w.includes("rain") || w.includes("drizzle") || w.includes("shower")) return "🌦️";
  if (w.includes("hail")) return "🧊";
  if (w.includes("snow") || w.includes("sleet") || w.includes("frost")) return "❄️";
  if (w.includes("fog") || w.includes("mist") || w.includes("haze")) return "🌫️";
  if (w.includes("sand") || w.includes("dust")) return "🏜️";
  if (w.includes("ash") || w.includes("volcanic") || w.includes("smoke")) return "🌋";
  if (w.includes("ember") || w.includes("fire") || w.includes("inferno")) return "🔥";
  if (w.includes("wind") || w.includes("breez") || w.includes("gust")) return "💨";
  if (w.includes("cherry") || w.includes("blossom") || w.includes("petal")) return "🌸";
  if (w.includes("aurora") || w.includes("northern light")) return "🌌";
  if (w.includes("cloud") || w.includes("overcast") || w.includes("grey") || w.includes("gray")) return "☁️";
  if (w.includes("clear") || w.includes("sunny") || w.includes("bright")) return "☀️";
  if (w.includes("hot") || w.includes("swelter")) return "🥵";
  if (w.includes("cold") || w.includes("freez")) return "🥶";
  return "🌤️";
}
