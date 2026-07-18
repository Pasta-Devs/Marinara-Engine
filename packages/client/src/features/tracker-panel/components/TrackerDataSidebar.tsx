import { Component, useCallback, useState, type CSSProperties, type ErrorInfo, type ReactNode } from "react";
import type { PresentCharacter } from "@marinara-engine/shared";
import {
  normalizeTrackerFieldLocksForState,
  normalizeTrackerHiddenFields,
  toggleTrackerFieldHidden,
  toggleTrackerFieldLock,
  type TrackerHiddenFields,
} from "@marinara-engine/shared";
import { TRACKER_PANEL_DEFAULT_BACKGROUND_COLOR, useUIStore } from "../../../stores/ui.store";
import { useChatStore } from "../../../stores/chat.store";
import { useGameStateStore } from "../../../stores/game-state.store";
import { useGameStatePatcher } from "../../../hooks/use-game-state-patcher";
import { getCssBackgroundStyle, getCssColorFallback, isCssGradient } from "../../../lib/css-colors";
import { useRenderTimer } from "../../../lib/perf-diagnostics";
import { cn } from "../../../lib/utils";
import { useTrackerGameState } from "../hooks/use-tracker-game-state";
import { useTrackerFieldLockUpdater } from "../hooks/use-tracker-field-lock-updater";
import { useTrackerPanelModel } from "../hooks/use-tracker-panel-model";
import type { TrackerEditMode } from "../tracker-panel.types";
import { EmptySection } from "./controls/SectionControls";
import { TrackerSectionList } from "./TrackerSectionList";
import { TrackerSkeleton } from "./TrackerSkeleton";
import { TrackerSidebarHeader } from "./TrackerSidebarHeader";
import { TrackerLockProvider } from "./TrackerLockContext";

const TRACKER_PANEL_NEUTRAL_VARS =
  "[--accent:rgb(39_39_42)] [--accent-foreground:rgb(244_244_245)] [--background:rgb(18_18_21)] [--border:rgb(63_63_70)] [--card:rgb(24_24_27)] [--foreground:rgb(244_244_245)] [--input:rgb(63_63_70)] [--muted:rgb(39_39_42)] [--muted-foreground:rgb(161_161_170)] [--popover:rgb(24_24_27)] [--popover-foreground:rgb(244_244_245)] [--primary:rgb(212_212_216)] [--primary-foreground:rgb(18_18_21)] [--ring:rgb(161_161_170)] [--secondary:rgb(39_39_42)] [--tracker-panel-card-background:color-mix(in_srgb,var(--background)_22%,transparent)] [--tracker-panel-section-background:color-mix(in_srgb,var(--card)_6%,transparent)]";
type TrackerPanelSurfaceStyle = CSSProperties & Record<`--${string}`, string>;

class TrackerPanelErrorBoundary extends Component<
  { children: ReactNode; resetKey: string },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error("[TrackerPanel]", error, info);
  }

  componentDidUpdate(previousProps: Readonly<{ children: ReactNode; resetKey: string }>) {
    if (this.state.hasError && previousProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) {
      return <EmptySection>Tracker data could not be rendered.</EmptySection>;
    }
    return this.props.children;
  }
}

export function TrackerDataSidebar({ fillHeight = false }: { fillHeight?: boolean } = {}) {
  useRenderTimer("tracker-panel"); // [#3104 diagnostic]
  const activeChatId = useChatStore((s) => s.activeChatId);
  const { patchField, patchPlayerStats, flushPatch } = useGameStatePatcher(activeChatId, "tracker-data-sidebar");
  const trackerPanelSide = useUIStore((s) => s.trackerPanelSide);
  const trackerPanelCollapsedSections = useUIStore((s) => s.trackerPanelCollapsedSections);
  const trackerPanelSectionOrder = useUIStore((s) => s.trackerPanelSectionOrder);
  const trackerPanelUseExpressionSprites = useUIStore((s) => s.trackerPanelUseExpressionSprites);
  const trackerPanelThoughtBubbleDisplay = useUIStore((s) => s.trackerPanelThoughtBubbleDisplay);
  const trackerPanelDockedThoughtsAlwaysVisible = useUIStore((s) => s.trackerPanelDockedThoughtsAlwaysVisible);
  const trackerPanelSizeProfile = useUIStore((s) => s.trackerPanelSizeProfile);
  const trackerPanelBackgroundColor = useUIStore((s) => s.trackerPanelBackgroundColor);
  const trackerTemperatureUnit = useUIStore((s) => s.trackerTemperatureUnit);
  const toggleTrackerPanelSectionCollapsed = useUIStore((s) => s.toggleTrackerPanelSectionCollapsed);
  const setTrackerPanelOpen = useUIStore((s) => s.setTrackerPanelOpen);
  const setTrackerPanelSide = useUIStore((s) => s.setTrackerPanelSide);
  const setTrackerPanelSizeProfile = useUIStore((s) => s.setTrackerPanelSizeProfile);
  const { currentGameState, gameStateRefreshing, isLoadingGameState } = useTrackerGameState(activeChatId);
  const presentCharacters: PresentCharacter[] = Array.isArray(currentGameState?.presentCharacters)
    ? currentGameState.presentCharacters
    : [];
  const {
    activePersona,
    autoGenerateCharacterAvatars,
    characterSpriteLookup,
    characterTrackerConfig,
    characterTrackerSettings,
    enabledAgentTypes,
    expressionSpritesEnabled,
    featuredCharacterCardKeys,
    orderedTrackerSections,
    resolveSpriteCharacterId,
    spriteExpressions,
  } = useTrackerPanelModel({
    activeChatId,
    presentCharacters,
    trackerPanelSectionOrder,
    trackerPanelUseExpressionSprites,
  });
  const [activeEditMode, setActiveEditMode] = useState<TrackerEditMode | null>(null);
  const deleteMode = activeEditMode === "delete";
  const addMode = activeEditMode === "add";
  const lockMode = activeEditMode === "lock";
  const hideMode = activeEditMode === "hide";
  const fieldLocks = currentGameState
    ? normalizeTrackerFieldLocksForState(currentGameState.fieldLocks, currentGameState)
    : null;
  const hiddenTrackerFields = currentGameState ? normalizeTrackerHiddenFields(currentGameState.hiddenTrackerFields) : null;
  const updateFieldLocks = useTrackerFieldLockUpdater({ chatId: activeChatId, fieldLocks, patchField });
  const updateHiddenTrackerFields = useCallback(
    (updater: (hiddenFields: TrackerHiddenFields | null | undefined) => TrackerHiddenFields) => {
      const latestState = useGameStateStore.getState().current;
      const base =
        latestState?.chatId === activeChatId
          ? normalizeTrackerHiddenFields(latestState.hiddenTrackerFields)
          : hiddenTrackerFields;
      patchField("hiddenTrackerFields", updater(base));
    },
    [activeChatId, hiddenTrackerFields, patchField],
  );
  const toggleFieldLock = useCallback((key: string) => {
    updateFieldLocks((locks) => toggleTrackerFieldLock(locks, key));
  }, [updateFieldLocks]);
  const toggleFieldHidden = useCallback(
    (key: string) => {
      updateHiddenTrackerFields((hiddenFields) => toggleTrackerFieldHidden(hiddenFields, key));
    },
    [updateHiddenTrackerFields],
  );
  const hasFixedTrackerPanel = orderedTrackerSections.length > 0;
  const showTrackerSections = !!activeChatId && !isLoadingGameState && !!currentGameState && hasFixedTrackerPanel;
  const trackerPanelHasCustomBackground =
    trackerPanelBackgroundColor.trim().toLowerCase() !== TRACKER_PANEL_DEFAULT_BACKGROUND_COLOR;
  const trackerPanelBackgroundFallback = getCssColorFallback(
    trackerPanelBackgroundColor,
    TRACKER_PANEL_DEFAULT_BACKGROUND_COLOR,
  );
  const trackerPanelSurfaceStyle: TrackerPanelSurfaceStyle | undefined = trackerPanelHasCustomBackground
    ? {
        ...getCssBackgroundStyle(trackerPanelBackgroundColor),
        "--background": trackerPanelBackgroundFallback,
        "--card": trackerPanelBackgroundFallback,
        "--muted": `color-mix(in srgb, ${trackerPanelBackgroundFallback} 82%, var(--foreground) 18%)`,
        "--popover": trackerPanelBackgroundFallback,
        "--secondary": `color-mix(in srgb, ${trackerPanelBackgroundFallback} 86%, var(--foreground) 14%)`,
        "--tracker-card-neutral-material": `color-mix(in srgb, ${trackerPanelBackgroundFallback} 90%, var(--foreground) 10%)`,
        "--tracker-card-neutral-surface-bottom": `color-mix(in srgb, ${trackerPanelBackgroundFallback} 96%, var(--foreground) 4%)`,
        "--tracker-card-neutral-surface-top": `color-mix(in srgb, ${trackerPanelBackgroundFallback} 92%, var(--foreground) 8%)`,
        "--tracker-panel-card-background": `color-mix(in srgb, ${trackerPanelBackgroundFallback} 88%, var(--foreground) 12%)`,
        "--tracker-panel-section-background": isCssGradient(trackerPanelBackgroundColor)
          ? trackerPanelBackgroundColor
          : trackerPanelBackgroundFallback,
      }
    : undefined;

  return (
    <section
      data-component="TrackerDataSidebar"
      data-tracker-size-profile={trackerPanelSizeProfile}
      className={cn(
        "@container relative flex flex-col bg-zinc-950/95 text-zinc-100 backdrop-blur-sm",
        TRACKER_PANEL_NEUTRAL_VARS,
        fillHeight ? "overflow-hidden" : "overflow-visible",
        fillHeight ? "h-full" : "min-h-0",
      )}
      style={trackerPanelSurfaceStyle}
    >
      <div className="pointer-events-none absolute inset-0 z-0 opacity-[0.11] [background-image:linear-gradient(color-mix(in_srgb,var(--foreground)_12%,transparent)_1px,transparent_1px),linear-gradient(90deg,color-mix(in_srgb,var(--foreground)_9%,transparent)_1px,transparent_1px)] [background-size:8px_8px]" />
      <TrackerLockProvider
        fieldLocks={fieldLocks}
        hiddenTrackerFields={hiddenTrackerFields}
        lockMode={lockMode}
        hideMode={hideMode}
        onToggleFieldLock={toggleFieldLock}
        onToggleFieldHidden={toggleFieldHidden}
        onUpdateFieldLocks={updateFieldLocks}
        onUpdateHiddenFields={updateHiddenTrackerFields}
      >
        <TrackerSidebarHeader
          trackerPanelSide={trackerPanelSide}
          sizeProfile={trackerPanelSizeProfile}
          activeEditMode={activeEditMode}
          onSetEditMode={setActiveEditMode}
          onSetSide={setTrackerPanelSide}
          onSetSizeProfile={setTrackerPanelSizeProfile}
          onClose={() => setTrackerPanelOpen(false)}
        />

        <div className={cn("relative z-10", fillHeight && "min-h-0 flex-1 overflow-y-auto")}>
          {showTrackerSections ? (
            <TrackerPanelErrorBoundary resetKey={`${activeChatId}:${currentGameState.id}:${currentGameState.createdAt}`}>
              <TrackerSectionList
                activeChatId={activeChatId}
                activePersona={activePersona}
                autoGenerateCharacterAvatars={autoGenerateCharacterAvatars}
                characterSpriteLookup={characterSpriteLookup}
                characterTrackerConfig={characterTrackerConfig}
                characterTrackerSettings={characterTrackerSettings}
                currentGameState={currentGameState}
                enabledAgentTypes={enabledAgentTypes}
                expressionSpritesEnabled={expressionSpritesEnabled}
                featuredCharacterCardKeys={featuredCharacterCardKeys}
                flushPatch={flushPatch}
                gameStateRefreshing={gameStateRefreshing}
                orderedTrackerSections={orderedTrackerSections}
                patchField={patchField}
                patchPlayerStats={patchPlayerStats}
                resolveSpriteCharacterId={resolveSpriteCharacterId}
                spriteExpressions={spriteExpressions}
                trackerPanelCollapsedSections={trackerPanelCollapsedSections}
                trackerPanelSide={trackerPanelSide}
                trackerPanelSizeProfile={trackerPanelSizeProfile}
                trackerPanelThoughtBubbleDisplay={trackerPanelThoughtBubbleDisplay}
                trackerPanelDockedThoughtsAlwaysVisible={trackerPanelDockedThoughtsAlwaysVisible}
                trackerTemperatureUnit={trackerTemperatureUnit}
                toggleTrackerPanelSectionCollapsed={toggleTrackerPanelSectionCollapsed}
                deleteMode={deleteMode}
                addMode={addMode}
                hideMode={hideMode}
              />
            </TrackerPanelErrorBoundary>
          ) : null}

          {!activeChatId ? (
            <EmptySection>Select a chat to view tracker data.</EmptySection>
          ) : isLoadingGameState ? (
            <TrackerSkeleton />
          ) : !currentGameState ? (
            <EmptySection>No tracker data yet.</EmptySection>
          ) : !hasFixedTrackerPanel ? (
            <EmptySection>No enabled tracker panels.</EmptySection>
          ) : null}
        </div>
      </TrackerLockProvider>
    </section>
  );
}
