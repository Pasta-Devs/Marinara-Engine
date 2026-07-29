import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import {
  characterCustomFieldTrackerLockKey,
  characterStatTrackerLockKey,
  characterTrackerLockKey,
  isTrackerFieldHidden,
  isTrackerFieldLocked,
  normalizeTrackerFieldLocks,
  normalizeTrackerHiddenFields,
  removeTrackerFieldLockPrefix,
  renameTrackerFieldLockPrefix,
  type PresentCharacter,
} from "@marinara-engine/shared";
import type {
  TrackerPanelSide,
  TrackerPanelSizeProfile,
  TrackerStatDisplayMode,
  TrackerThoughtBubbleDisplay,
} from "../../../../stores/ui.store";
import { cn } from "../../../../lib/utils";
import type { StatIconLookup } from "../../hooks/use-stat-icons";
import { trackerEditableText } from "../../lib/tracker-display";
import { useTrackerWindow } from "../TrackerWindowContext";
import {
  makeUniqueCharacterCustomFieldName,
  normalizeCharacterCustomFieldName,
  resolveCharacterCustomFieldName,
} from "../../lib/character-custom-field-names";
import {
  TRACKER_PROFILE_PORTRAIT_MEDIA_STAGE_REM,
  TRACKER_PROFILE_PORTRAIT_ROOMY_MEDIA_STAGE_REM,
  TRACKER_PROFILE_PORTRAIT_FRAME_STAGE_MAX_CLASS,
} from "../../lib/tracker-panel.constants";
import {
  TRACKER_PROFILE_GRID_CLASS,
  TRACKER_PROFILE_GRID_CLASS_BY_PORTRAIT_SIDE,
  TRACKER_PROFILE_DETAILS_SEAM_BORDER_CLASS_BY_SIDE,
  TRACKER_PROFILE_ORDER_CLASS_BY_SIDE,
  getOppositeTrackerProfileSide,
  getTrackerProfilePortraitSide,
} from "../../lib/tracker-profile-layout";
import {
  getTrackerStatDensity,
  shouldRenderStatGauges,
  trackerStatStackHeight,
} from "../../lib/tracker-stat-layout";
import { getCharacterAmbienceStyle, type TrackerProfileColors } from "../../lib/tracker-profile-style";
import { InlineAddRow, InlineEdit } from "../controls/InlineControls";
import { StatList } from "../controls/StatList";
import {
  TRACKER_PROFILE_BODY_BOTTOM_RULE_CLASS,
  TRACKER_PROFILE_BODY_TONE_OVERLAY_CLASS,
  TRACKER_PROFILE_CARD_FRAME_CLASS,
  TRACKER_PROFILE_MATERIAL_PANEL_CLASS,
  TRACKER_PROFILE_SURFACE_TEXTURE_CLASS,
  TRACKER_PROFILE_SURFACE_TOP_RULE_CLASS,
  TrackerProfileDisplayWash,
  TrackerProfileEdgeHighlight,
  TrackerReadabilityVeil,
} from "../controls/TrackerProfileChrome";
import { FeaturedFieldList } from "./FeaturedCharacterFields";
import { FeaturedCharacterNameplate } from "./FeaturedCharacterNameplate";
import { FeaturedCharacterPortrait } from "./FeaturedCharacterPortrait";
import { ExternalThoughtBubble, InlineThoughtBubble } from "./CharacterThoughtBubbles";
import { useTrackerLockContext } from "../TrackerLockContext";
import { useTranslation as useUiTranslation } from "react-i18next";

const FEATURED_CARD_CLASS = cn(
  TRACKER_PROFILE_CARD_FRAME_CLASS,
  "group/character mx-1 hover:border-[var(--foreground)]/20",
);
const FEATURED_COCKPIT_SHELF_CLASS = cn(
  "pointer-events-none absolute inset-x-0 top-5 z-0 h-[9rem] overflow-hidden border-b border-[color-mix(in_srgb,var(--tracker-profile-dialogue-border)_42%,transparent)] shadow-[inset_0_9px_16px_color-mix(in_srgb,var(--background)_18%,transparent),inset_0_-10px_18px_color-mix(in_srgb,var(--background)_38%,transparent)] @min-[380px]:h-[10.5rem]",
  TRACKER_PROFILE_MATERIAL_PANEL_CLASS,
);
const FEATURED_REMOVE_BUTTON_CLASS =
  "rounded p-1 text-[var(--destructive)] transition-all hover:bg-[var(--destructive)]/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--border)] active:scale-90";
const FEATURED_PORTRAIT_COLUMN_CLASS = "relative z-[1] min-w-0 self-start";
const FEATURED_PORTRAIT_ANCHOR_CLASS = "relative min-w-0";
const FEATURED_DETAILS_COLUMN_CLASS =
  "relative z-[1] flex min-h-0 min-w-0 flex-col self-start overflow-hidden border-[color-mix(in_srgb,var(--tracker-profile-dialogue-border)_46%,transparent)]";
const FEATURED_DETAILS_FIELDS_CLASS = "relative min-h-0 flex-1 overflow-hidden";
const FEATURED_DOCKED_THOUGHT_CLASS = "relative z-[2] order-3 col-span-full mx-1 mb-1 mt-1 shrink-0";
const FEATURED_DOCKED_THOUGHT_SURFACE_CLASS = "scrollbar-hide overflow-hidden";
const FEATURED_STAT_BAND_CLASS = "order-4 col-span-full mt-0 rounded-b-[5px]";
const FEATURED_STAT_SHELF_CLASS = cn(
  "group/statbox relative isolate flex min-h-0 flex-col overflow-x-hidden border-t border-[color-mix(in_srgb,var(--tracker-profile-dialogue-border)_38%,transparent)] bg-[image:var(--tracker-profile-material)] p-1 shadow-[inset_0_1px_0_color-mix(in_srgb,var(--foreground)_4%,transparent),inset_0_8px_14px_color-mix(in_srgb,var(--background)_22%,transparent)] [background-blend-mode:var(--tracker-profile-material-blend)] before:pointer-events-none before:absolute before:inset-x-3 before:top-0 before:z-[1] before:h-px before:bg-[linear-gradient(90deg,transparent,color-mix(in_srgb,var(--tracker-profile-dialogue-border)_34%,transparent),transparent)] before:opacity-55 before:content-['']",
  "max-h-[7.75rem] @min-[380px]:max-h-[9.25rem]",
);
const FEATURED_CUSTOM_FIELD_LIST_CLASS =
  "relative z-[1] mx-1 mb-1 mt-1 grid gap-px border-t border-[var(--tracker-profile-rule)] pt-0.5 text-[0.625rem]";
const FEATURED_CUSTOM_FIELD_ROW_CLASS =
  "grid min-w-0 grid-cols-[minmax(3rem,0.42fr)_minmax(0,1fr)] items-center gap-1 border-b border-[var(--tracker-profile-rule)] px-0.5 py-px last:border-b-0";

export function FeaturedCharacterTrackerCard({
  character,
  spriteCharacterId,
  spriteExpression,
  expressionSpritesEnabled,
  characterPicture,
  profileColors,
  trackerPanelSide,
  trackerPanelSizeProfile,
  thoughtBubbleDisplay,
  statDisplayMode,
  resolveStatIcon,
  dockedThoughtsAlwaysVisible,
  onUpdate,
  onRemove,
  characterIndex,
  deleteMode,
  addMode,
  onToggleFeatured,
  onUploadAvatar,
}: {
  character: PresentCharacter;
  spriteCharacterId?: string | null;
  spriteExpression?: string;
  expressionSpritesEnabled: boolean;
  characterPicture?: string | null;
  profileColors?: TrackerProfileColors | null;
  trackerPanelSide: TrackerPanelSide;
  trackerPanelSizeProfile: TrackerPanelSizeProfile;
  thoughtBubbleDisplay: TrackerThoughtBubbleDisplay;
  statDisplayMode: TrackerStatDisplayMode;
  resolveStatIcon: StatIconLookup;
  dockedThoughtsAlwaysVisible: boolean;
  onUpdate: (character: PresentCharacter) => void;
  onRemove: () => void;
  characterIndex: number;
  deleteMode: boolean;
  addMode: boolean;
  onToggleFeatured: () => void;
  onUploadAvatar: () => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const trackerWindow = useTrackerWindow();
  const trackerDocument = trackerWindow.document;
  const {
    fieldLocks,
    hiddenTrackerFields,
    hideMode = false,
    lockMode,
    onToggleFieldLock,
    onUpdateFieldLocks,
    onUpdateHiddenFields,
  } = useTrackerLockContext();
  const thoughtAnchorRef = useRef<HTMLDivElement | null>(null);
  const thoughtBubbleRef = useRef<HTMLDivElement | null>(null);
  const thoughtControlRef = useRef<HTMLButtonElement | null>(null);
  const [thoughtsOpen, setThoughtsOpen] = useState(false);
  const customFields = Object.entries((character.customFields ?? {}) as Record<string, unknown>).map(
    ([name, value]) => [name, value, trackerEditableText(value)] as const,
  );
  const characterStats = Array.isArray(character.stats) ? character.stats : [];
  const featuredStatColumnHeightRem =
    trackerPanelSizeProfile === "expanded"
      ? TRACKER_PROFILE_PORTRAIT_ROOMY_MEDIA_STAGE_REM
      : TRACKER_PROFILE_PORTRAIT_MEDIA_STAGE_REM;
  const characterStatDensity = getTrackerStatDensity(
    characterStats.length,
    addMode,
    featuredStatColumnHeightRem,
  );
  const characterStatsOverflowPortrait =
    trackerStatStackHeight(characterStats.length, "tight", addMode) > featuredStatColumnHeightRem;
  const thoughtsKey = characterTrackerLockKey(character, characterIndex, "thoughts");
  const thoughtsHidden = isTrackerFieldHidden(hiddenTrackerFields, thoughtsKey);
  const toggleThoughtsHidden = () => {
    const nextHidden = !isTrackerFieldHidden(hiddenTrackerFields, thoughtsKey);
    onUpdateHiddenFields?.((hiddenFields) => {
      const next = normalizeTrackerHiddenFields(hiddenFields);
      if (nextHidden) next[thoughtsKey] = true;
      else delete next[thoughtsKey];
      return next;
    });
    onUpdateFieldLocks?.((locks) => {
      const next = normalizeTrackerFieldLocks(locks);
      if (nextHidden) next[thoughtsKey] = true;
      else delete next[thoughtsKey];
      return next;
    });
    if (nextHidden) onUpdate({ ...character, thoughts: null });
  };
  const hasThoughtsControl = !thoughtsHidden || hideMode;
  const hasCharacterStatBlock = characterStats.length > 0 || addMode;
  const renderCharacterGauges = shouldRenderStatGauges(statDisplayMode, addMode, deleteMode, lockMode);
  const featuredPortraitSide = getTrackerProfilePortraitSide(trackerPanelSide);
  const featuredDetailsSide = getOppositeTrackerProfileSide(featuredPortraitSide);

  const useInlineThoughtBubble = thoughtBubbleDisplay === "inline";
  const showDockedThoughts =
    hasThoughtsControl && useInlineThoughtBubble && (dockedThoughtsAlwaysVisible || thoughtsOpen);
  const showFloatingThoughts = hasThoughtsControl && !useInlineThoughtBubble && thoughtsOpen;
  const thoughtsVisible = showDockedThoughts || showFloatingThoughts;
  const canToggleThoughts = hasThoughtsControl && !(useInlineThoughtBubble && dockedThoughtsAlwaysVisible);

  useEffect(() => {
    if (!hasThoughtsControl) setThoughtsOpen(false);
  }, [hasThoughtsControl]);

  useEffect(() => {
    if (!thoughtsOpen || useInlineThoughtBubble) return;

    let queuedClose: number | undefined;
    const isInsideThoughtSurface = (target: EventTarget | null) => {
      const TrackerNode = trackerDocument.defaultView?.Node;
      if (!TrackerNode || !(target instanceof TrackerNode)) return false;
      return !!(
        thoughtAnchorRef.current?.contains(target) ||
        thoughtBubbleRef.current?.contains(target) ||
        thoughtControlRef.current?.contains(target)
      );
    };
    const closeAfterCurrentBlur = () => {
      if (queuedClose !== undefined) trackerWindow.clearTimeout(queuedClose);
      queuedClose = trackerWindow.setTimeout(() => {
        setThoughtsOpen(false);
      }, 0);
    };
    const handlePointerDown = (event: PointerEvent) => {
      if (!isInsideThoughtSurface(event.target)) closeAfterCurrentBlur();
    };
    const handleFocusIn = (event: FocusEvent) => {
      if (!isInsideThoughtSurface(event.target)) setThoughtsOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setThoughtsOpen(false);
    };

    trackerDocument.addEventListener("pointerdown", handlePointerDown, true);
    trackerDocument.addEventListener("focusin", handleFocusIn, true);
    trackerDocument.addEventListener("keydown", handleKeyDown, true);
    return () => {
      if (queuedClose !== undefined) trackerWindow.clearTimeout(queuedClose);
      trackerDocument.removeEventListener("pointerdown", handlePointerDown, true);
      trackerDocument.removeEventListener("focusin", handleFocusIn, true);
      trackerDocument.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [thoughtsOpen, trackerDocument, trackerWindow, useInlineThoughtBubble]);

  const addCharacterStat = () => {
    onUpdate({
      ...character,
      stats: [...characterStats, { name: "New Stat", value: 0, max: 100, color: "var(--primary)" }],
    });
  };
  const addCustomField = () => {
    const name = makeUniqueCharacterCustomFieldName(character.customFields);
    onUpdate({ ...character, customFields: { ...(character.customFields ?? {}), [name]: "" } });
  };
  const removeCustomField = (name: string) => {
    const nextFields: Record<string, unknown> = { ...(character.customFields ?? {}) };
    delete nextFields[name];
    onUpdateFieldLocks?.((locks) =>
      removeTrackerFieldLockPrefix(
        locks,
        characterCustomFieldTrackerLockKey(character, characterIndex, name, "name").replace(/\.name$/, ""),
      ),
    );
    onUpdate({ ...character, customFields: nextFields as Record<string, string> });
  };
  const updateCustomField = (oldName: string, nextName: string, nextValue: unknown) => {
    const nextFields: Record<string, unknown> = { ...(character.customFields ?? {}) };
    const trimmedName = resolveCharacterCustomFieldName(nextName, oldName);
    if (
      trimmedName !== oldName &&
      Object.keys(nextFields).some(
        (name) =>
          name !== oldName &&
          normalizeCharacterCustomFieldName(name) === normalizeCharacterCustomFieldName(trimmedName),
      )
    ) {
      return;
    }
    if (trimmedName !== oldName) {
      onUpdateFieldLocks?.((locks) =>
        renameTrackerFieldLockPrefix(
          locks,
          characterCustomFieldTrackerLockKey(character, characterIndex, oldName, "name").replace(/\.name$/, ""),
          characterCustomFieldTrackerLockKey(character, characterIndex, trimmedName, "name").replace(/\.name$/, ""),
        ),
      );
    }
    delete nextFields[oldName];
    nextFields[trimmedName] = nextValue;
    onUpdate({ ...character, customFields: nextFields as Record<string, string> });
  };

  return (
    <article
      data-tracker-size-profile={trackerPanelSizeProfile}
      className={FEATURED_CARD_CLASS}
      style={getCharacterAmbienceStyle(character, profileColors)}
    >
      <div className={TRACKER_PROFILE_BODY_TONE_OVERLAY_CLASS} />
      <TrackerReadabilityVeil strength="strong" />
      <TrackerProfileDisplayWash />
      <div className={TRACKER_PROFILE_BODY_BOTTOM_RULE_CLASS} />
      <TrackerProfileEdgeHighlight className="opacity-45" showBottom={false} />

      {deleteMode && (
        <div className="absolute right-1 top-1 z-10">
          <button
            type="button"
            onClick={onRemove}
            className={FEATURED_REMOVE_BUTTON_CLASS}
            title={localizeUi("ui.trackerPanel.charactertrackercard.removeCharacter")}
            aria-label={localizeUi("ui.trackerPanel.charactertrackercard.removeValue1", { value1: character.name.trim() ||localizeUi("ui.noodle.noodlehome.character") })}
          >
            <X size="0.6875rem" />
          </button>
        </div>
      )}

      <div
        className={cn(
          TRACKER_PROFILE_GRID_CLASS,
          deleteMode && "pr-5",
          TRACKER_PROFILE_GRID_CLASS_BY_PORTRAIT_SIDE[featuredPortraitSide],
        )}
      >
        <FeaturedCharacterNameplate
          character={character}
          onUpdate={onUpdate}
          thoughtsOpen={thoughtsVisible}
          thoughtButtonRef={thoughtControlRef}
          thoughtControlSide={featuredPortraitSide}
          onToggleThoughts={canToggleThoughts ? () => setThoughtsOpen((open) => !open) : undefined}
          onToggleFeatured={onToggleFeatured}
          characterIndex={characterIndex}
        />
        <div aria-hidden="true" className={FEATURED_COCKPIT_SHELF_CLASS}>
          <div className={TRACKER_PROFILE_SURFACE_TEXTURE_CLASS} />
          <div className={TRACKER_PROFILE_SURFACE_TOP_RULE_CLASS} />
        </div>

        <div className={cn(FEATURED_PORTRAIT_COLUMN_CLASS, TRACKER_PROFILE_ORDER_CLASS_BY_SIDE[featuredPortraitSide])}>
          <div ref={thoughtAnchorRef} className={FEATURED_PORTRAIT_ANCHOR_CLASS}>
            <FeaturedCharacterPortrait
              character={character}
              spriteCharacterId={spriteCharacterId}
              spriteExpression={spriteExpression}
              expressionSpritesEnabled={expressionSpritesEnabled}
              characterPicture={characterPicture}
              outsideSide={featuredPortraitSide}
              onUploadAvatar={onUploadAvatar}
              onPortraitFocusChange={(portraitFocusX, portraitFocusY, portraitZoom) =>
                onUpdate({ ...character, portraitFocusX, portraitFocusY, portraitZoom })
              }
            />
          </div>
        </div>

        <div
          className={cn(
            FEATURED_DETAILS_COLUMN_CLASS,
            TRACKER_PROFILE_PORTRAIT_FRAME_STAGE_MAX_CLASS,
            TRACKER_PROFILE_ORDER_CLASS_BY_SIDE[featuredDetailsSide],
            TRACKER_PROFILE_DETAILS_SEAM_BORDER_CLASS_BY_SIDE[featuredDetailsSide],
          )}
        >
          <div className={FEATURED_DETAILS_FIELDS_CLASS}>
            <FeaturedFieldList
              character={character}
              onUpdate={onUpdate}
              sizeProfile={trackerPanelSizeProfile}
              characterIndex={characterIndex}
            />
          </div>
        </div>

        {showDockedThoughts && (
          <InlineThoughtBubble
            bubbleRef={thoughtBubbleRef}
            value={character.thoughts}
            onSave={(thoughts) => onUpdate({ ...character, thoughts: thoughts || null })}
            className={FEATURED_DOCKED_THOUGHT_CLASS}
            surfaceClassName={FEATURED_DOCKED_THOUGHT_SURFACE_CLASS}
            lockKey={characterTrackerLockKey(character, characterIndex, "thoughts")}
            hidden={thoughtsHidden}
            hideMode={hideMode}
            onToggleHidden={toggleThoughtsHidden}
          />
        )}

        {hasCharacterStatBlock && (
          <div
            className={cn(
              FEATURED_STAT_SHELF_CLASS,
              renderCharacterGauges && "p-px",
              renderCharacterGauges || characterStatsOverflowPortrait ? "overflow-y-auto" : "overflow-y-hidden",
              FEATURED_STAT_BAND_CLASS,
            )}
          >
            <div className="relative z-[2]">
              <StatList
                stats={characterStats}
                onUpdate={(stats) => onUpdate({ ...character, stats })}
                onAdd={addCharacterStat}
                deleteMode={deleteMode}
                addMode={addMode}
                density={characterStatDensity}
                visualTone="instrument"
                displayMode={statDisplayMode}
                resolveIcon={(stat, occurrence) =>
                  resolveStatIcon.resolveCharacterStatIcon(character, characterIndex, stat.name, occurrence)
                }
                onSetIcon={(stat, occurrence, icon) =>
                  resolveStatIcon.setCharacterStatIcon(character, characterIndex, stat.name, occurrence, icon)
                }
                onRemapIcons={(previousStats, nextStats, previousIndexForNext) =>
                  resolveStatIcon.remapCharacterStatIcons(
                    character,
                    characterIndex,
                    previousStats,
                    nextStats,
                    previousIndexForNext,
                  )
                }
                getLockKey={(statIndex, field, stat) =>
                  characterStatTrackerLockKey(character, characterIndex, stat ?? statIndex, field, statIndex)
                }
              />
            </div>
          </div>
        )}
      </div>

      {showFloatingThoughts && (
        <ExternalThoughtBubble
          anchorRef={thoughtAnchorRef}
          bubbleRef={thoughtBubbleRef}
          value={character.thoughts}
          onSave={(thoughts) => onUpdate({ ...character, thoughts: thoughts || null })}
          panelSide={trackerPanelSide}
          lockKey={characterTrackerLockKey(character, characterIndex, "thoughts")}
          hidden={thoughtsHidden}
          hideMode={hideMode}
          onToggleHidden={toggleThoughtsHidden}
        />
      )}

      {(customFields.length > 0 || addMode) && (
        <div className={FEATURED_CUSTOM_FIELD_LIST_CLASS}>
          {customFields.map(([name, rawValue, displayValue]) => (
            <div
              key={name}
              className={cn(
                FEATURED_CUSTOM_FIELD_ROW_CLASS,
                deleteMode && "grid-cols-[minmax(3rem,0.38fr)_minmax(0,1fr)_1.25rem]",
              )}
            >
              <InlineEdit
                value={name}
                onSave={(nextName) => updateCustomField(name, nextName, rawValue)}
                placeholder={localizeUi("ui.trackerPanel.charactertrackercard.field")}
                ariaLabel={`${name} field name`}
                className="min-w-0 px-0.5 py-0 font-medium"
                scrollOnHover
                locked={isTrackerFieldLocked(
                  fieldLocks,
                  characterCustomFieldTrackerLockKey(character, characterIndex, name, "name"),
                )}
                lockMode={lockMode}
                onToggleLock={
                  onToggleFieldLock
                    ? () =>
                        onToggleFieldLock(characterCustomFieldTrackerLockKey(character, characterIndex, name, "name"))
                    : undefined
                }
              />
              <InlineEdit
                value={displayValue}
                onSave={(nextValue) => updateCustomField(name, name, nextValue)}
                placeholder={localizeUi("ui.trackerPanel.charactertrackercard.value")}
                ariaLabel={`${name} value`}
                className="min-w-0 px-0.5 py-0"
                scrollOnHover
                locked={isTrackerFieldLocked(
                  fieldLocks,
                  characterCustomFieldTrackerLockKey(character, characterIndex, name, "value"),
                )}
                lockMode={lockMode}
                onToggleLock={
                  onToggleFieldLock
                    ? () =>
                        onToggleFieldLock(characterCustomFieldTrackerLockKey(character, characterIndex, name, "value"))
                    : undefined
                }
              />
              {deleteMode && (
                <button
                  type="button"
                  onClick={() => removeCustomField(name)}
                  title={localizeUi("ui.trackerPanel.charactertrackercard.removeValue1", { value1: name })}
                  aria-label={localizeUi("ui.trackerPanel.charactertrackercard.removeValue1", { value1: name })}
                  className="flex h-5 w-5 items-center justify-center justify-self-end rounded text-[var(--destructive)] transition-all hover:bg-[var(--destructive)]/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--border)] active:scale-90 [@media(pointer:coarse)]:h-6 [@media(pointer:coarse)]:w-6"
                >
                  <X size="0.625rem" />
                </button>
              )}
            </div>
          ))}
          {addMode && (
            <InlineAddRow title={localizeUi("ui.trackerPanel.charactertrackercard.addCustomField")} onClick={addCustomField} className="col-span-full" />
          )}
        </div>
      )}
    </article>
  );
}
