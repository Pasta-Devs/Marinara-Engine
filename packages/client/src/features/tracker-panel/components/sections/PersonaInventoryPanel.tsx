import { useEffect, useRef, useState, type ReactNode } from "react";
import { HeartPulse, Sparkles } from "lucide-react";
import type { CharacterStat, Persona } from "@marinara-engine/shared";
import { isTrackerFieldLocked, personaStatTrackerLockKey, personaStatusTrackerLockKey } from "@marinara-engine/shared";
import type { TrackerPanelSide, TrackerStatDisplayMode } from "../../../../stores/ui.store";
import { useCharacterSprites, type SpriteInfo } from "../../../../hooks/use-characters";
import { getTrackerCardPortraitView, parseTrackerCardColorConfig } from "../../../../lib/tracker-card-colors";
import { cn } from "../../../../lib/utils";
import {
  TRACKER_PORTRAIT_EXPRESSION_DEFAULT_FOCUS_Y,
  TRACKER_PROFILE_PORTRAIT_FRAME_STAGE_MAX_CLASS,
} from "../../lib/tracker-panel.constants";
import { visibleText } from "../../lib/tracker-display";
import {
  TRACKER_PROFILE_DETAILS_SEAM_BORDER_CLASS_BY_SIDE,
  TRACKER_PROFILE_GRID_CLASS,
  TRACKER_PROFILE_GRID_CLASS_BY_PORTRAIT_SIDE,
  TRACKER_PROFILE_ORDER_CLASS_BY_SIDE,
  getOppositeTrackerProfileSide,
  getTrackerProfilePortraitSide,
} from "../../lib/tracker-profile-layout";
import { resolveSpriteUrl } from "../../lib/sprite-expressions";
import { getPersonaAmbienceStyle } from "../../lib/tracker-profile-style";
import { shouldRenderStatGauges } from "../../lib/tracker-stat-layout";
import { InlineEdit } from "../controls/InlineControls";
import { TrackerProfileNameplate } from "../controls/TrackerProfileNameplate";
import {
  TRACKER_PROFILE_BODY_BOTTOM_RULE_CLASS,
  TRACKER_PROFILE_BODY_TONE_OVERLAY_CLASS,
  TRACKER_PROFILE_CARD_SURFACE_CLASS,
  TRACKER_PROFILE_MATERIAL_PANEL_CLASS,
  TRACKER_PROFILE_STATUS_STRIP_CLASS,
  TrackerProfileDisplayWash,
  TrackerProfileEdgeHighlight,
  TrackerReadabilityVeil,
  TRACKER_PROFILE_SURFACE_TEXTURE_CLASS,
  TRACKER_PROFILE_SURFACE_TOP_RULE_CLASS,
} from "../controls/TrackerProfileChrome";
import { SectionHeader, TRACKER_SECTION_SHELL_CLASS } from "../controls/SectionControls";
import { StatList } from "../controls/StatList";
import { useTrackerLockContext } from "../TrackerLockContext";
import { useTrackerWindow } from "../TrackerWindowContext";
import type { PersonaPortraitSaveSnapshot } from "../../hooks/use-persona-portrait-save";
import type { StatIconLookup } from "../../hooks/use-stat-icons";
import { PersonaPortraitStage } from "./PersonaPortraitStage";
import { useTranslation as useUiTranslation } from "react-i18next";

const PERSONA_COCKPIT_SHELF_CLASS = cn(
  "pointer-events-none absolute inset-x-0 top-5 z-0 h-[9rem] overflow-hidden border-b border-[color-mix(in_srgb,var(--tracker-profile-dialogue-border)_46%,transparent)] shadow-[inset_0_10px_18px_color-mix(in_srgb,var(--background)_20%,transparent),inset_0_-12px_22px_color-mix(in_srgb,var(--background)_44%,transparent)] @min-[380px]:h-[10.5rem]",
  TRACKER_PROFILE_MATERIAL_PANEL_CLASS,
);
const PERSONA_PROFILE_DETAILS_COLUMN_CLASS = cn(
  "@container relative z-[1] flex min-w-0 flex-col gap-1 overflow-hidden p-1",
  TRACKER_PROFILE_MATERIAL_PANEL_CLASS,
);
const PERSONA_STAT_DECK_CLASS = cn(
  "relative z-[1] order-3 col-span-full min-w-0 border-t border-[color-mix(in_srgb,var(--tracker-profile-dialogue-border)_50%,transparent)]",
  TRACKER_PROFILE_MATERIAL_PANEL_CLASS,
);
const PERSONA_STATUS_STRIP_CLASS = cn(TRACKER_PROFILE_STATUS_STRIP_CLASS, "mx-0.5 items-center px-1.5 py-[0.1875rem]");
export function PersonaInventoryPanel({
  persona,
  status,
  spriteExpression,
  trackerPanelSide,
  statDisplayMode,
  resolveStatIcon,
  personaStats,
  action,
  onSaveStatus,
  onUpdatePersonaStats,
  onAddPersonaStat,
  deleteMode,
  addMode,
  queuePersonaPortraitSave,
  flushPersonaPortraitSave,
  collapsed = false,
  onToggleCollapsed,
}: {
  persona: Persona | null;
  status: string;
  spriteExpression?: string;
  trackerPanelSide: TrackerPanelSide;
  statDisplayMode: TrackerStatDisplayMode;
  resolveStatIcon: StatIconLookup;
  personaStats: CharacterStat[];
  action?: ReactNode;
  onSaveStatus: (status: string) => void;
  onUpdatePersonaStats: (stats: CharacterStat[]) => void;
  onAddPersonaStat: () => void;
  deleteMode: boolean;
  addMode: boolean;
  queuePersonaPortraitSave: (snapshot: PersonaPortraitSaveSnapshot) => void;
  flushPersonaPortraitSave: (personaId: string) => void;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const { fieldLocks, lockMode, onToggleFieldLock } = useTrackerLockContext();
  const trackerWindow = useTrackerWindow();
  const personaPortraitSaveTimeoutsRef = useRef(new Map<string, number>());
  const [personaPortraitFocusOverride, setPersonaPortraitFocusOverride] = useState<{
    personaId: string;
    x: number;
    y: number;
    zoom: number;
  } | null>(null);
  const personaName = visibleText(persona?.name, "Persona");
  const personaExpression = spriteExpression?.trim() ?? "";
  const spritePersonaId = personaExpression && persona?.id ? persona.id : null;
  const { data: personaSprites } = useCharacterSprites(spritePersonaId);
  const personaSpriteUrl = personaExpression
    ? resolveSpriteUrl(personaSprites as SpriteInfo[] | undefined, personaExpression)
    : null;
  const personaPortraitMedia = personaSpriteUrl ?? persona?.avatarPath ?? null;
  const personaPortraitMediaKind = personaSpriteUrl ? "expression" : persona?.avatarPath ? "art" : null;
  const defaultPersonaPortraitFocusY =
    personaPortraitMediaKind === "expression" ? TRACKER_PORTRAIT_EXPRESSION_DEFAULT_FOCUS_Y : undefined;
  const personaTrackerCardColors = parseTrackerCardColorConfig(persona?.trackerCardColors);
  const personaSavedPortraitFocus = getTrackerCardPortraitView(personaTrackerCardColors, {
    y: defaultPersonaPortraitFocusY,
  });
  const personaPortraitFocus =
    personaPortraitFocusOverride && personaPortraitFocusOverride.personaId === persona?.id
      ? personaPortraitFocusOverride
      : personaSavedPortraitFocus;
  const updatePersonaPortraitFocus =
    persona?.id && personaPortraitMediaKind
      ? (portraitFocusX: number, portraitFocusY: number, portraitZoom: number) => {
          setPersonaPortraitFocusOverride({
            personaId: persona.id,
            x: portraitFocusX,
            y: portraitFocusY,
            zoom: portraitZoom,
          });
          queuePersonaPortraitSave({ id: persona.id, portraitFocusX, portraitFocusY, portraitZoom });
          const existingTimeout = personaPortraitSaveTimeoutsRef.current.get(persona.id);
          if (existingTimeout !== undefined) {
            trackerWindow.clearTimeout(existingTimeout);
            personaPortraitSaveTimeoutsRef.current.delete(persona.id);
          }
          const timeoutId = trackerWindow.setTimeout(() => {
            if (personaPortraitSaveTimeoutsRef.current.get(persona.id) !== timeoutId) return;
            personaPortraitSaveTimeoutsRef.current.delete(persona.id);
            flushPersonaPortraitSave(persona.id);
          }, 180);
          personaPortraitSaveTimeoutsRef.current.set(persona.id, timeoutId);
        }
      : undefined;
  const showPersonaStatDeck = personaStats.length > 0 || addMode;
  const renderPersonaGauges = shouldRenderStatGauges(statDisplayMode, addMode, deleteMode, lockMode);
  const personaPortraitSide = getTrackerProfilePortraitSide(trackerPanelSide);
  const personaDetailsSide = getOppositeTrackerProfileSide(personaPortraitSide);
  const personaStatusAccessibleName = status
    ? localizeUi("ui.trackerPanel.inlineedit.value1Value2", {
        value1: localizeUi("ui.trackerPanel.personainventorypanel.value1Status", { value1: personaName }),
        value2: status,
      })
    : localizeUi("ui.trackerPanel.personainventorypanel.value1Status", { value1: personaName });
  const renderStatusStrip = () => (
    <div className={PERSONA_STATUS_STRIP_CLASS}>
      <HeartPulse
        size="0.75rem"
        className="relative z-[1] mt-0.5 shrink-0 text-[color-mix(in_srgb,var(--tracker-profile-accent-solid)_72%,var(--tracker-profile-text)_28%)]"
      />
      <InlineEdit
        value={status}
        onSave={onSaveStatus}
        placeholder={localizeUi("ui.trackerPanel.personainventorypanel.status")}
        className="relative z-[1] min-h-5 flex-1 rounded-[2px] px-0.5 py-0 text-[0.6875rem] font-medium leading-[0.875rem] text-[color-mix(in_srgb,var(--tracker-profile-text)_92%,var(--muted-foreground)_8%)] hover:bg-[var(--accent)]/18"
        title={status || localizeUi("ui.trackerPanel.personainventorypanel.status")}
        ariaLabel={personaStatusAccessibleName}
        previewLineCount={3}
        showEditHint={false}
        locked={isTrackerFieldLocked(fieldLocks, personaStatusTrackerLockKey())}
        lockMode={lockMode}
        onToggleLock={() => onToggleFieldLock?.(personaStatusTrackerLockKey())}
      />
    </div>
  );

  useEffect(() => {
    setPersonaPortraitFocusOverride(null);
  }, [persona?.id, persona?.trackerCardColors]);

  useEffect(() => {
    const flushOnPageHide = () => {
      const livePersonaIds = [...personaPortraitSaveTimeoutsRef.current.keys()];
      for (const personaId of livePersonaIds) {
        const timeoutId = personaPortraitSaveTimeoutsRef.current.get(personaId);
        if (timeoutId !== undefined) trackerWindow.clearTimeout(timeoutId);
      }
      personaPortraitSaveTimeoutsRef.current.clear();

      for (const personaId of livePersonaIds) {
        flushPersonaPortraitSave(personaId);
      }
    };
    trackerWindow.addEventListener("pagehide", flushOnPageHide);
    return () => {
      trackerWindow.removeEventListener("pagehide", flushOnPageHide);
      flushOnPageHide();
    };
  }, [flushPersonaPortraitSave, trackerWindow]);

  return (
    <div className={cn(TRACKER_SECTION_SHELL_CLASS, "transition-colors duration-200")}>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-[color-mix(in_srgb,var(--foreground)_6%,transparent)]" />

      <SectionHeader
        icon={<Sparkles size="0.6875rem" />}
        title={localizeUi("ui.characters.cardlibrarydetailcard.persona")}
        action={action}
        className="[--primary:var(--foreground)] [--tracker-profile-icon:var(--muted-foreground)]"
        collapsed={collapsed}
        onToggle={onToggleCollapsed}
      />

      {!collapsed && (
        <div className="relative px-1 pb-1 @min-[380px]:pb-1.5">
          <div
            className={TRACKER_PROFILE_CARD_SURFACE_CLASS}
            style={getPersonaAmbienceStyle(persona, { paintBackground: false })}
          >
            <div className={TRACKER_PROFILE_BODY_TONE_OVERLAY_CLASS} />
            <TrackerReadabilityVeil strength="strong" />
            <TrackerProfileDisplayWash />
            <div className={TRACKER_PROFILE_BODY_BOTTOM_RULE_CLASS} />
            <div
              className={cn(
                TRACKER_PROFILE_GRID_CLASS,
                "@min-[380px]:grid-rows-[auto_minmax(0,1fr)]",
                TRACKER_PROFILE_GRID_CLASS_BY_PORTRAIT_SIDE[personaPortraitSide],
              )}
            >
              <TrackerProfileNameplate
                placeholder={localizeUi("ui.characters.cardlibrarydetailcard.persona")}
                value={persona?.name}
              />
              <div aria-hidden="true" className={PERSONA_COCKPIT_SHELF_CLASS}>
                <div className={TRACKER_PROFILE_SURFACE_TEXTURE_CLASS} />
                <div className={TRACKER_PROFILE_SURFACE_TOP_RULE_CLASS} />
              </div>

              <div
                className={cn(
                  PERSONA_PROFILE_DETAILS_COLUMN_CLASS,
                  TRACKER_PROFILE_PORTRAIT_FRAME_STAGE_MAX_CLASS,
                  TRACKER_PROFILE_ORDER_CLASS_BY_SIDE[personaDetailsSide],
                  TRACKER_PROFILE_DETAILS_SEAM_BORDER_CLASS_BY_SIDE[personaDetailsSide],
                )}
              >
                {renderStatusStrip()}
              </div>
              <PersonaPortraitStage
                persona={persona}
                media={personaPortraitMedia}
                mediaKind={personaPortraitMediaKind}
                defaultPortraitFocusY={defaultPersonaPortraitFocusY}
                portraitFocusX={personaPortraitFocus.x}
                portraitFocusY={personaPortraitFocus.y}
                portraitZoom={personaPortraitFocus.zoom}
                side={personaPortraitSide}
                onPortraitFocusChange={updatePersonaPortraitFocus}
              />

              {showPersonaStatDeck && (
                <div className={cn(PERSONA_STAT_DECK_CLASS, renderPersonaGauges ? "p-px" : "p-1")}>
                  <StatList
                    stats={personaStats}
                    onUpdate={onUpdatePersonaStats}
                    onAdd={onAddPersonaStat}
                    deleteMode={deleteMode}
                    addMode={addMode}
                    visualTone="instrument"
                    displayMode={statDisplayMode}
                    resolveIcon={(stat, occurrence) => resolveStatIcon.resolvePersonaStatIcon(stat.name, occurrence)}
                    onSetIcon={(stat, occurrence, icon) =>
                      resolveStatIcon.setPersonaStatIcon(stat.name, occurrence, icon)
                    }
                    onRemapIcons={resolveStatIcon.remapPersonaStatIcons}
                    getLockKey={(index, field, stat) => personaStatTrackerLockKey(stat ?? index, field, index)}
                  />
                </div>
              )}
            </div>
            <TrackerProfileEdgeHighlight
              strength="strong"
              showBottom={false}
              className="[mask-image:linear-gradient(180deg,black_0%,black_78%,transparent_100%)]"
            />
          </div>
        </div>
      )}
    </div>
  );
}
