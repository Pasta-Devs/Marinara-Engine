// ──────────────────────────────────────────────
// Tracker window: a Roleplay chat's trackers in a movable window
//
// Shown on a computer while the Tracker Panel is off (its dice in Chat Settings). Each tracker is
// a drawer: collapsed it shows the tracker's miniature display, expanded its full
// box. Agent activity sits at the bottom. Closing the window minimizes it to a button.
// The Chat Settings dice switches between this window and the Tracker Panel. Each drawer
// can pop out into its own window, which stays while the Trackers window is closed.
// Beholder's launcher gets a control window of its own (a bubble), Tracker Panel or not.
// ──────────────────────────────────────────────
import { useCallback, useEffect, type ReactNode } from "react";
import {
  BarChart3,
  Backpack,
  Eye,
  MapPin,
  RefreshCw,
  Scroll,
  SlidersHorizontal,
  ListChecks,
  PackageOpen,
  PersonStanding,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import type { InstalledCapabilityPackage, Message } from "@marinara-engine/shared";
import { FloatingWindow } from "../ui/FloatingWindow";
import { Drawer } from "../ui/Drawer";
import { NEUTRAL_PANEL_SCROLL_AREA, NEUTRAL_SURFACE_VARIABLES } from "../ui/neutral-surface-styles";
import { CapabilityElement } from "../capabilities/CapabilityElement";
import { TrackerPanelIcon } from "../ui/TrackerPanelIcon";
import { AgentActivitySection } from "../agents/AgentActivitySection";
import { TrackerLockProvider } from "../../features/tracker-panel/components/TrackerLockContext";
import { TrackerWindowCharacters } from "../../features/tracker-panel/components/TrackerWindowCharacters";
import {
  partitionTrackerCapabilityPackages,
  useInstalledCapabilityPackages,
} from "../../hooks/use-capability-packages";
import { useMatchMedia } from "../../hooks/use-match-media";
import { useAgentStore } from "../../stores/agent.store";
import { useGameStateStore } from "../../stores/game-state.store";
import { TRACKER_WINDOW_ID, useFloatingWindowStore } from "../../stores/floating-window.store";
import { useUIStore } from "../../stores/ui.store";
import type { WindowBounds, WindowLayout } from "../../lib/floating-window-layout";
import { cn } from "../../lib/utils";
import { readChatWindowArea, readCssPixels } from "./chat-settings-window";
import { CHAT_CONTROL_WINDOW_IDS, ChatControlWindow } from "./ChatControlWindow";
import { AgentsRunningDot } from "../agents/AgentsRunningDot";
import {
  CombinedWorldPanel,
  CustomTrackerPanel,
  PersonaStatsPanel,
  QuestsPanel,
  RoleplayInventoryTrackerPanel,
} from "./RoleplayHUDPanels";
import {
  CharactersMiniature,
  CustomTrackerMiniature,
  InventoryTrackerMiniature,
  PersonaStatsMiniature,
  QuestsMiniature,
  RoleplayTrackerCapability,
  TRACKER_MINIATURE_TILE,
  WorldStateMiniature,
  getWorldMiniatureTileClass,
  getWorldTrackerDisplay,
  selectRoleplayTrackerPackages,
  useRoleplayTrackerState,
} from "./RoleplayHUD";

const TRACKER_WINDOW_WIDTH_REM = 22;
const TRACKER_WINDOW_HEIGHT_REM = 30;
const BUILT_IN_TRACKER_TYPES = [
  "world-state",
  "persona-stats",
  "character-tracker",
  "quest",
  "inventory-tracker",
  "custom-tracker",
];
const DRAWER_MEMORY_PREFIX = "tracker-window:";

/** Use the left gutter when it fits; otherwise begin as a button that leaves the transcript readable. */
export function getTrackerWindowDefaultLayout(bounds: WindowBounds): WindowLayout {
  const remPx = readCssPixels(document.documentElement, "font-size") || 16;
  const area = readChatWindowArea(bounds);
  const width = Math.min(TRACKER_WINDOW_WIDTH_REM * remPx, area.right - area.left);
  const height = Math.min(TRACKER_WINDOW_HEIGHT_REM * remPx, area.bottom - area.top);
  const contentLeft = Math.min(
    ...Array.from(
      area.chatRoot?.querySelectorAll(
        ".mari-roleplay-message-body, .rpg-narrator-msg > div, .mari-roleplay-input-column",
      ) ?? [],
    )
      .map((element) => element.getBoundingClientRect())
      .filter((rect) => rect.width > 1 && rect.height > 1)
      .map((rect) => rect.left),
  );
  const fitsBesideMessages = Number.isFinite(contentLeft) && area.left + width + 12 <= contentLeft;
  return {
    x: area.left,
    y: area.top,
    width,
    height,
    pinned: true,
    locked: false,
    minimized: !fitsBesideMessages,
    bubble: { x: area.left, y: bounds.top },
  };
}

/** Presses that do not count as "outside" the window: tracker popovers and dialogs render in portals. */
function ignoreTrackerWindowOutsidePointer(target: Element) {
  return !!target.closest("[data-chat-floating-panel], [data-macro-modal]");
}

export interface RoleplayTrackerWindowProps {
  chatId: string;
  enabledAgentTypes: Set<string>;
  isStreaming: boolean;
  /** Some trackers run only on request: the title bar then offers Run trackers. */
  manualTrackers: boolean;
  onRerunTrackers: () => void;
  onRerunSingleTracker: (agentType: string) => void;
  messages?: Message[];
}

/**
 * Decides whether the Tracker window shows (never on phones or when the chat uses the Tracker Panel), and gives
 * each Beholder package its control window, with its bubble at `beholderSlot` (`beholderPhoneSlot`).
 */
export function RoleplayTrackerWindow({
  beholderSlot,
  beholderPhoneSlot,
  ...props
}: RoleplayTrackerWindowProps & { beholderSlot: number; beholderPhoneSlot: number }) {
  const phoneLayout = useMatchMedia("(max-width: 767px)");
  // Closing the selected panel keeps its launcher; switching it off restores this window.
  const trackerPanelSelected = useUIStore((s) => s.trackerPanelEnabled && s.trackerPanelOpen);
  const { data: installedCapabilities = [] } = useInstalledCapabilityPackages();
  const isAgentProcessing = useAgentStore((s) => s.processingChatIds.includes(props.chatId));
  const gameStateRefreshing = useGameStateStore((s) => s.isRefreshing);
  const busy = isAgentProcessing || props.isStreaming || gameStateRefreshing;
  // Beholder has its own window, so it alone does not need this one.
  const packages = partitionTrackerCapabilityPackages(
    selectRoleplayTrackerPackages(installedCapabilities, props.enabledAgentTypes),
  );
  const hasTrackers =
    BUILT_IN_TRACKER_TYPES.some((type) => props.enabledAgentTypes.has(type)) ||
    packages.memoryNag.length + packages.other.length > 0;

  const showWindow = !phoneLayout && !trackerPanelSelected && hasTrackers;
  return (
    <>
      {packages.beholder.map((item, index) => (
        <ChatControlWindow
          key={item.id}
          id={CHAT_CONTROL_WINDOW_IDS.beholder(item.id)}
          title={item.manifest.name}
          icon={<Eye size={14} />}
          slot={beholderSlot + index}
          phoneSlot={beholderPhoneSlot + index}
          width={280}
          height={140}
          helpTarget="agent-controls"
        >
          <div className="flex flex-wrap items-center gap-0.5 p-2">
            <RoleplayTrackerCapability
              packageId={item.id}
              chatId={props.chatId}
              onRerunSingleTracker={props.onRerunSingleTracker}
              isTrackerRetryBusy={busy}
            />
          </div>
        </ChatControlWindow>
      ))}
      {/* Popped-out trackers render from inside the window, so it stays mounted, hidden, while it is closed. */}
      {showWindow && <TrackerWindow {...props} />}
    </>
  );
}

function useRememberedDrawer(id: string, defaultOpen: boolean) {
  const key = `${DRAWER_MEMORY_PREFIX}${id}`;
  const open = useUIStore((s) => s.chatSettingsExpandedSections[key] ?? defaultOpen);
  const setExpanded = useUIStore((s) => s.setChatSettingsSectionExpanded);
  return [open, useCallback((next: boolean) => setExpanded(key, next), [key, setExpanded])] as const;
}

function TrackerDrawer({
  id,
  title,
  icon,
  summary,
  defaultOpen = true,
  children,
}: {
  id: string;
  title: string;
  icon: ReactNode;
  summary?: ReactNode;
  defaultOpen?: boolean;
  children: (collapse: () => void) => ReactNode;
}) {
  const [open, setOpen] = useRememberedDrawer(id, defaultOpen);
  return (
    <Drawer
      id={id}
      title={title}
      icon={icon}
      summary={summary}
      open={open}
      onOpenChange={setOpen}
      bodyClassName="px-0 pb-1 pt-0"
    >
      {children(() => setOpen(false))}
    </Drawer>
  );
}

/** A package's toolbar control is its miniature; it handles its own presses. */
function PackageMiniature({ item, chatId, onRerunSingleTracker, busy }: PackageTrackerProps) {
  return (
    <span className="contents" onClick={(event) => event.stopPropagation()}>
      <RoleplayTrackerCapability
        packageId={item.id}
        chatId={chatId}
        onRerunSingleTracker={onRerunSingleTracker}
        isTrackerRetryBusy={busy}
      />
    </span>
  );
}

interface PackageTrackerProps {
  item: InstalledCapabilityPackage;
  chatId: string;
  onRerunSingleTracker: (agentType: string) => void;
  busy: boolean;
}

function PackageTrackerDrawer(props: PackageTrackerProps) {
  const { item, chatId } = props;
  const hasTrackerView = item.manifest.contributions?.slots?.includes("tracker-panel") === true;
  return (
    <TrackerDrawer
      id={`tracker-${item.id}`}
      title={item.manifest.name}
      icon={<PackageOpen size="0.75rem" />}
      summary={<PackageMiniature {...props} />}
    >
      {() =>
        hasTrackerView ? (
          <CapabilityElement
            packageId={item.id}
            view="tracker"
            capabilityProps={{ chatId, chatMode: "roleplay", detached: false }}
            className="block px-2"
          />
        ) : (
          <div className="flex px-3 py-1">
            <PackageMiniature {...props} />
          </div>
        )
      }
    </TrackerDrawer>
  );
}

function TrackerWindow({
  chatId,
  enabledAgentTypes,
  isStreaming,
  manualTrackers,
  onRerunTrackers,
  onRerunSingleTracker,
  messages,
}: RoleplayTrackerWindowProps) {
  const { t } = useTranslation();
  const tracker = useRoleplayTrackerState(chatId, enabledAgentTypes, "tracker-window");
  const trackerTemperatureUnit = useUIStore((s) => s.trackerTemperatureUnit);
  // Moving the chat changes the free gutter the default layout looks for.
  const chatPosition = useUIStore((s) => s.roleplayChatPosition);
  const isAgentProcessing = useAgentStore((s) => s.processingChatIds.includes(chatId));
  const gameStateRefreshing = useGameStateStore((s) => s.isRefreshing);
  const busy = isAgentProcessing || isStreaming || gameStateRefreshing;
  const { patchField, patchPlayerStats, editInventoryTracker } = tracker;
  const world = {
    location: tracker.location ?? "",
    date: tracker.date ?? "",
    time: tracker.time ?? "",
    weather: tracker.weather ?? "",
    temperature: tracker.temperature ?? "",
    worldCustomFields: tracker.worldCustomFields,
  };
  const worldDisplay = getWorldTrackerDisplay(world, trackerTemperatureUnit);
  const inventoryTotal =
    tracker.inventoryTrackerCurrencies.length +
    tracker.inventoryTrackerEquipped.length +
    tracker.inventoryTrackerInventory.length;

  // FloatingWindow opens restored windows; leaving this host only clears its runtime state.
  useEffect(() => () => useFloatingWindowStore.getState().closeWindow(TRACKER_WINDOW_ID), []);

  const packageProps = (item: InstalledCapabilityPackage) => ({ item, chatId, onRerunSingleTracker, busy });
  const runTrackersLabel = busy ? t("ui.chat.roleplayhud.trackersRunning") : t("ui.chat.roleplayhud.runTrackers");

  return (
    <FloatingWindow
      id={TRACKER_WINDOW_ID}
      drawerHost={{
        title: t("chat.trackerWindow.title"),
        scrollClassName: cn(NEUTRAL_PANEL_SCROLL_AREA, "@container"),
      }}
      title={t("chat.trackerWindow.title")}
      titleIcon={<TrackerPanelIcon size="0.8125rem" className="shrink-0 text-[var(--muted-foreground)]" />}
      titleAccessory={
        <>
          {isAgentProcessing && <AgentsRunningDot inline className="mx-1" />}
          {manualTrackers ? (
            <button
              type="button"
              onClick={onRerunTrackers}
              disabled={busy}
              title={runTrackersLabel}
              aria-label={runTrackersLabel}
              className="mari-window__control"
            >
              <RefreshCw size="0.75rem" className={cn(busy && "animate-spin")} />
            </button>
          ) : null}
        </>
      }
      closeLabel={t("chat.trackerWindow.close")}
      minimizable={{
        icon: <TrackerPanelIcon size="0.875rem" />,
        label: t("chat.trackerWindow.title"),
      }}
      getDefaultLayout={getTrackerWindowDefaultLayout}
      defaultLayoutKey={chatPosition}
      minWidth={260}
      minHeight={160}
      autoFocus={false}
      className={cn("marinara-chat-popover", NEUTRAL_SURFACE_VARIABLES)}
      headerClassName="marinara-chat-popover__header"
      titleClassName="marinara-chat-popover__title text-xs font-semibold leading-tight"
      ignoreOutsidePointer={ignoreTrackerWindowOutsidePointer}
    >
      <TrackerLockProvider {...tracker.lockProviderProps}>
        <div className={cn(NEUTRAL_PANEL_SCROLL_AREA, "@container min-h-0 flex-1 overflow-y-auto overscroll-contain")}>
          {enabledAgentTypes.has("world-state") && (
            <TrackerDrawer
              id="tracker-world"
              title={t("ui.panels.appearancesettings.worldState")}
              icon={<MapPin size="0.75rem" />}
              summary={
                <span className={cn(getWorldMiniatureTileClass(worldDisplay.hasWorldState), "pointer-events-none")}>
                  <WorldStateMiniature display={worldDisplay} />
                </span>
              }
            >
              {(collapse) => (
                <CombinedWorldPanel
                  {...world}
                  onSaveLocation={(v) => patchField("location", v)}
                  onSaveDate={(v) => patchField("date", v)}
                  onSaveTime={(v) => patchField("time", v)}
                  onSaveWeather={(v) => patchField("weather", v)}
                  onSaveTemperature={(v) => patchField("temperature", v)}
                  onUpdateWorldCustomFields={(fields) => patchField("worldCustomFields", fields)}
                  weatherEmoji={worldDisplay.weatherEmoji}
                  pinColor={worldDisplay.pinColor}
                  dateColor={worldDisplay.dateDisplay.iconColor}
                  timeColor={worldDisplay.timeColor}
                  weatherColor={worldDisplay.weatherColor}
                  tempColor={worldDisplay.tempColor}
                  onClose={collapse}
                  onRerunSingleTracker={onRerunSingleTracker}
                  isTrackerRetryBusy={busy}
                />
              )}
            </TrackerDrawer>
          )}

          {enabledAgentTypes.has("persona-stats") && (
            <TrackerDrawer
              id="tracker-persona"
              title={t("ui.chat.personastatswidget.personaStats")}
              icon={<BarChart3 size="0.75rem" />}
              summary={
                <span className={TRACKER_MINIATURE_TILE}>
                  <PersonaStatsMiniature bars={tracker.personaStatBars} />
                </span>
              }
            >
              {() => (
                <PersonaStatsPanel
                  bars={tracker.personaStatBars}
                  onUpdate={(bars) => patchField("personaStats", bars)}
                  status={tracker.personaStatus}
                  onUpdateStatus={(status) => patchPlayerStats("status", status)}
                  onRerunSingleTracker={onRerunSingleTracker}
                  isTrackerRetryBusy={busy}
                />
              )}
            </TrackerDrawer>
          )}

          {enabledAgentTypes.has("character-tracker") && (
            <TrackerDrawer
              id="tracker-characters"
              title={t("ui.chat.characterswidget.presentCharacters")}
              icon={<PersonStanding size="0.75rem" />}
              summary={
                <span className={TRACKER_MINIATURE_TILE}>
                  <CharactersMiniature />
                </span>
              }
            >
              {() => (
                <TrackerWindowCharacters
                  characters={tracker.presentCharacters}
                  chatId={chatId}
                  patchField={patchField}
                  patchPlayerStats={patchPlayerStats}
                  onRerunSingleTracker={onRerunSingleTracker}
                  isTrackerRetryBusy={busy}
                />
              )}
            </TrackerDrawer>
          )}

          {enabledAgentTypes.has("quest") && (
            <TrackerDrawer
              id="tracker-quests"
              title={t("ui.chat.questswidget.activeQuests")}
              icon={<Scroll size="0.75rem" />}
              summary={
                <span className={TRACKER_MINIATURE_TILE}>
                  <QuestsMiniature quests={tracker.activeQuests} />
                </span>
              }
            >
              {() => (
                <QuestsPanel
                  quests={tracker.activeQuests}
                  onUpdate={(quests) => patchPlayerStats("activeQuests", quests)}
                  onRerunSingleTracker={onRerunSingleTracker}
                  isTrackerRetryBusy={busy}
                />
              )}
            </TrackerDrawer>
          )}

          {enabledAgentTypes.has("inventory-tracker") && (
            <TrackerDrawer
              id="tracker-inventory"
              title={t("ui.chat.inventoryTracker.title")}
              icon={<Backpack size="0.75rem" />}
              summary={
                <span className={TRACKER_MINIATURE_TILE}>
                  <InventoryTrackerMiniature total={inventoryTotal} />
                </span>
              }
            >
              {() => (
                <RoleplayInventoryTrackerPanel
                  currencies={tracker.inventoryTrackerCurrencies}
                  equipped={tracker.inventoryTrackerEquipped}
                  inventory={tracker.inventoryTrackerInventory}
                  onUpdateCurrencies={(rows) => editInventoryTracker("currencies", rows)}
                  onUpdateEquipped={(rows) => editInventoryTracker("equipped", rows)}
                  onUpdateInventory={(rows) => editInventoryTracker("inventory", rows)}
                  onRerunSingleTracker={onRerunSingleTracker}
                  isTrackerRetryBusy={busy}
                />
              )}
            </TrackerDrawer>
          )}

          {tracker.packages.memoryNag.map((item) => (
            <PackageTrackerDrawer key={item.id} {...packageProps(item)} />
          ))}

          {enabledAgentTypes.has("custom-tracker") && (
            <TrackerDrawer
              id="tracker-custom"
              title={t("ui.chat.customtrackerwidget.customTracker")}
              icon={<SlidersHorizontal size="0.75rem" />}
              summary={
                <span className={TRACKER_MINIATURE_TILE}>
                  <CustomTrackerMiniature fields={tracker.customTrackerFields} />
                </span>
              }
            >
              {() => (
                <CustomTrackerPanel
                  fields={tracker.customTrackerFields}
                  onUpdate={(fields) => patchPlayerStats("customTrackerFields", fields)}
                  onRerunSingleTracker={onRerunSingleTracker}
                  isTrackerRetryBusy={busy}
                />
              )}
            </TrackerDrawer>
          )}

          {tracker.packages.other.map((item) => (
            <PackageTrackerDrawer key={item.id} {...packageProps(item)} />
          ))}

          <TrackerDrawer
            id="agent-activity"
            title={t("agents.activity.title")}
            icon={<ListChecks size="0.75rem" />}
            defaultOpen={false}
          >
            {() => <AgentActivitySection chatId={chatId} messages={messages} />}
          </TrackerDrawer>
        </div>
      </TrackerLockProvider>
    </FloatingWindow>
  );
}
