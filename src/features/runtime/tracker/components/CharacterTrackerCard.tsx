import type { ReactNode } from "react";
import { Eye, HeartPulse, Maximize2, Shirt, X } from "lucide-react";
import type { PresentCharacter } from "../../../../engine/contracts/types/game-state";
import type {
  TrackerPanelSide,
  TrackerPanelSizeProfile,
  TrackerThoughtBubbleDisplay,
} from "../../../../shared/stores/ui.store";
import { cn } from "../../../../shared/lib/utils";
import { visibleText } from "./tracker-display.helpers";
import { getCharacterAmbienceStyle } from "./tracker-character-profile-style";
import type { TrackerProfileColors } from "./tracker-profile-colors";
import { addPresentCharacterStat, updatePresentCharacterCustomField } from "../../world-state/index";
import { FittedText, InlineEdit } from "./tracker-data-sidebar.controls";
import {
  TrackerProfileDisplayWash,
  TrackerProfileEdgeHighlight,
  TrackerReadabilityVeil,
} from "./tracker-data-sidebar.controls";
import { StatList } from "./tracker-data-sidebar.stats";
import { FeaturedCharacterTrackerCard } from "./FeaturedCharacterTrackerCard";
import { CharacterTrackerAvatar } from "./CharacterTrackerAvatar";
import {
  COMPACT_CHARACTER_MOOD_EDIT_CLASS,
  COMPACT_CHARACTER_MOOD_STATIC_CLASS,
  CompactCharacterField,
} from "./CharacterTrackerField";
import {
  TRACKER_PROFILE_THOUGHT_BUBBLE_EDIT_CLASS,
  TRACKER_PROFILE_THOUGHT_BUBBLE_OVERLAY_CLASS,
  TRACKER_PROFILE_THOUGHT_BUBBLE_SURFACE_CLASS,
  TRACKER_PROFILE_THOUGHT_BUBBLE_TEXT_CLASS,
} from "./CharacterThoughtBubble.styles";

const CHARACTER_CARD_CLASS = "group/character tracker-compact-character-card";
const CHARACTER_CARD_TONE_OVERLAY_CLASS = "tracker-compact-character-tone-overlay";
const CHARACTER_CARD_TEXTURE_CLASS = "tracker-compact-character-texture";
const CHARACTER_CARD_BODY_MATERIAL_CLASS = "tracker-compact-character-body-material";
const CHARACTER_AVATAR_CORNER_SHADE_CLASS = "tracker-compact-character-avatar-corner-shade";
const CHARACTER_REMOVE_BUTTON_CLASS = "tracker-compact-character-remove-button";
const CHARACTER_HEADER_CLASS = "relative -mt-2.5 flex items-start gap-1 px-0.5";
const CHARACTER_HEADER_COPY_CLASS = "relative z-[1] min-w-0 flex-1 pt-3";
const CHARACTER_HEADER_VOID_TEXTURE_CLASS = "tracker-compact-character-header-void-texture";
const CHARACTER_FEATURE_BUTTON_CLASS = "tracker-compact-character-feature-button";
const CHARACTER_NAMEPLATE_CLASS = "tracker-compact-character-nameplate";
const CHARACTER_NAMEPLATE_GLEAM_CLASS = "tracker-compact-character-nameplate-gleam";
const CHARACTER_AVATAR_SOCKET_CLASS = "tracker-compact-character-avatar-socket";
const CHARACTER_AVATAR_SOCKET_SIZE_CLASS = {
  regular: "tracker-compact-character-avatar-socket--regular",
  dense: "tracker-compact-character-avatar-socket--dense",
} satisfies Record<"regular" | "dense", string>;
const CHARACTER_HEADER_FILLER_CLASS = "tracker-compact-character-header-filler";
const CHARACTER_NAME_EDIT_CLASS = "tracker-compact-character-name-edit";
const CHARACTER_NAME_PREVIEW_CLASS = "tracker-compact-character-name-preview";
const CHARACTER_DETAIL_ROWS_CLASS = "relative z-[1] mt-0.5 grid grid-cols-1 gap-px px-px pb-px";
const CHARACTER_STAT_BLOCK_CLASS = "group/statbox tracker-compact-character-stat-block";
const CHARACTER_CUSTOM_FIELD_LIST_CLASS = "tracker-compact-character-custom-field-list";
const CHARACTER_CUSTOM_FIELD_ROW_CLASS = "tracker-compact-character-custom-field-row";

function CompactCharacterNameplate({ children }: { children: ReactNode }) {
  return (
    <div className={CHARACTER_NAMEPLATE_CLASS}>
      <div className={CHARACTER_NAMEPLATE_GLEAM_CLASS} />
      <div className="relative z-[1] min-w-0 flex-1 overflow-hidden">{children}</div>
    </div>
  );
}

function CompactThoughtBubble({
  value,
  onSave,
}: {
  value: string | null | undefined;
  onSave?: (value: string) => void;
}) {
  const thoughtText = visibleText(value, "Thoughts").replace(/\s+/g, " ");

  return (
    <div className="relative z-[1] mt-0.5 w-full max-w-full">
      <div
        className={cn(
          "relative z-[2] max-h-[2.95rem] min-h-5 w-full min-w-0 overflow-hidden rounded-[1.05rem] px-2.5 pb-px pt-0.5",
          TRACKER_PROFILE_THOUGHT_BUBBLE_SURFACE_CLASS,
        )}
      >
        <div className={TRACKER_PROFILE_THOUGHT_BUBBLE_OVERLAY_CLASS} />
        <div className="relative z-[1] flex w-full max-w-full items-center">
          {onSave ? (
            <InlineEdit
              value={value ?? ""}
              onSave={onSave}
              placeholder="Thoughts"
              className={cn(
                "min-h-4 w-full min-w-0 px-0 py-0 text-[0.59375rem] font-medium italic leading-[1.05]",
                TRACKER_PROFILE_THOUGHT_BUBBLE_EDIT_CLASS,
              )}
              showEditHint={false}
              previewLineCount={3}
              editHintMode="overlay"
              previewClassName="tracking-[0]"
            />
          ) : (
            <p
              className={cn(
                "line-clamp-3 break-words text-[0.59375rem] font-medium italic leading-[1.05] tracking-[0]",
                TRACKER_PROFILE_THOUGHT_BUBBLE_TEXT_CLASS,
              )}
            >
              {thoughtText}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export function CharacterTrackerCard({
  character,
  spriteCharacterId,
  spriteExpression,
  expressionSpritesEnabled,
  characterPicture,
  profileColors,
  trackerPanelSide,
  trackerPanelSizeProfile,
  thoughtBubbleDisplay,
  dockedThoughtsAlwaysVisible,
  action,
  onUpdate,
  onRemove,
  deleteMode = false,
  addMode = false,
  featured = false,
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
  dockedThoughtsAlwaysVisible: boolean;
  action?: ReactNode;
  onUpdate?: (character: PresentCharacter) => void;
  onRemove?: () => void;
  deleteMode?: boolean;
  addMode?: boolean;
  featured?: boolean;
  onToggleFeatured?: () => void;
  onUploadAvatar?: () => void;
}) {
  if (featured) {
    return (
      <FeaturedCharacterTrackerCard
        character={character}
        spriteCharacterId={spriteCharacterId}
        spriteExpression={spriteExpression}
        expressionSpritesEnabled={expressionSpritesEnabled}
        characterPicture={characterPicture}
        profileColors={profileColors}
        trackerPanelSide={trackerPanelSide}
        trackerPanelSizeProfile={trackerPanelSizeProfile}
        thoughtBubbleDisplay={thoughtBubbleDisplay}
        dockedThoughtsAlwaysVisible={dockedThoughtsAlwaysVisible}
        action={action}
        onUpdate={onUpdate}
        onRemove={onRemove}
        deleteMode={deleteMode}
        addMode={addMode}
        onToggleFeatured={onToggleFeatured}
        onUploadAvatar={onUploadAvatar}
      />
    );
  }

  const customFields = Object.entries(character.customFields ?? {});
  const characterStats = character.stats ?? [];
  const hasDeleteAction = !!onRemove && deleteMode;
  const avatarMedia = characterPicture ?? character.avatarPath ?? null;
  const compactAvatarUpload = characterPicture ? undefined : onUploadAvatar;
  const showAppearance = !!(character.appearance || onUpdate);
  const showOutfit = !!(character.outfit || onUpdate);
  const showMood = !!(character.mood || onUpdate);
  const showThoughts = !!(character.thoughts || onUpdate);
  const hasDetailRows = showMood || showAppearance || showOutfit;
  const hasDenseContent = characterStats.length > 0 || customFields.length > 0;
  const readableDetailRows = hasDenseContent;
  const readableCustomFields = trackerPanelSizeProfile === "expanded";
  const avatarSize = hasDenseContent
    ? "z-[5] mt-0 w-[clamp(2.25rem,28%,3rem)] -translate-y-0.5"
    : "z-[5] mt-0 w-[clamp(3rem,36%,3.75rem)] -translate-y-0.5";
  const avatarSocketSize = hasDenseContent ? "dense" : "regular";
  const updateCustomField = (oldName: string, nextName: string, nextValue: string) => {
    if (!onUpdate) return;
    const nextCharacter = updatePresentCharacterCustomField(character, oldName, nextName, nextValue);
    if (nextCharacter) onUpdate(nextCharacter);
  };
  const addCharacterStat = () => {
    if (!onUpdate) return;
    onUpdate(addPresentCharacterStat(character));
  };
  return (
    <article className={CHARACTER_CARD_CLASS} style={getCharacterAmbienceStyle(character, profileColors)}>
      <div className={CHARACTER_CARD_TONE_OVERLAY_CLASS} />
      <TrackerReadabilityVeil strength={hasDenseContent || hasDetailRows ? "strong" : "soft"} />
      <div className={CHARACTER_CARD_BODY_MATERIAL_CLASS} />
      <div className={CHARACTER_AVATAR_CORNER_SHADE_CLASS} />
      <div className={CHARACTER_CARD_TEXTURE_CLASS} />
      <TrackerProfileDisplayWash className="z-[1]" />
      <TrackerProfileEdgeHighlight className="z-[2] opacity-[0.3]" showBottom={false} />
      <div className={cn(CHARACTER_AVATAR_SOCKET_CLASS, CHARACTER_AVATAR_SOCKET_SIZE_CLASS[avatarSocketSize])} />
      {hasDeleteAction && (
        <div className="absolute right-1 top-1 z-10">
          <button
            type="button"
            onClick={onRemove}
            className={CHARACTER_REMOVE_BUTTON_CLASS}
            title="Remove character"
            aria-label={`Remove ${visibleText(character.name, "character")}`}
          >
            <X size="0.6875rem" />
          </button>
        </div>
      )}

      <CompactCharacterNameplate>
        {onUpdate ? (
          <InlineEdit
            value={character.name}
            onSave={(name) => onUpdate({ ...character, name: name || "Character" })}
            placeholder="Character"
            className={CHARACTER_NAME_EDIT_CLASS}
            showEditHint={false}
            fitPreview
            fitMinScale={0.58}
          />
        ) : (
          <FittedText
            className={CHARACTER_NAME_PREVIEW_CLASS}
            title={visibleText(character.name, "Character")}
            minScale={0.58}
          >
            {visibleText(character.name, "Character")}
          </FittedText>
        )}
      </CompactCharacterNameplate>
      {onToggleFeatured && (
        <button
          type="button"
          onClick={onToggleFeatured}
          title="Feature character card"
          aria-label="Feature character card"
          aria-pressed={false}
          className={CHARACTER_FEATURE_BUTTON_CLASS}
        >
          <Maximize2 size="0.5625rem" />
        </button>
      )}

      <div className={cn(CHARACTER_HEADER_CLASS, hasDeleteAction && "pr-7")}>
        <div className={CHARACTER_HEADER_VOID_TEXTURE_CLASS} />
        <CharacterTrackerAvatar
          character={character}
          avatarMedia={avatarMedia}
          avatarSize={avatarSize}
          onUploadAvatar={compactAvatarUpload}
        />
        <div className={CHARACTER_HEADER_COPY_CLASS}>
          {showThoughts && (
            <CompactThoughtBubble
              value={character.thoughts}
              onSave={onUpdate ? (thoughts) => onUpdate({ ...character, thoughts: thoughts || null }) : undefined}
            />
          )}
          {!showThoughts && <div className={CHARACTER_HEADER_FILLER_CLASS} />}
        </div>
      </div>

      {hasDetailRows && (
        <div className={CHARACTER_DETAIL_ROWS_CLASS}>
          {showMood && (
            <CompactCharacterField
              icon={<HeartPulse size="0.6875rem" />}
              accessibleLabel="Mood"
              value={character.mood}
              placeholder="Mood"
              onSave={onUpdate ? (mood) => onUpdate({ ...character, mood }) : undefined}
              tone="mood"
              readable={readableDetailRows}
              valueClassName={onUpdate ? COMPACT_CHARACTER_MOOD_EDIT_CLASS : COMPACT_CHARACTER_MOOD_STATIC_CLASS}
            />
          )}
          {showAppearance && (
            <CompactCharacterField
              icon={<Eye size="0.6875rem" />}
              accessibleLabel="Look"
              value={character.appearance}
              placeholder="Appearance"
              onSave={onUpdate ? (appearance) => onUpdate({ ...character, appearance: appearance || null }) : undefined}
              tone="appearance"
              readable={readableDetailRows}
            />
          )}
          {showOutfit && (
            <CompactCharacterField
              icon={<Shirt size="0.6875rem" />}
              accessibleLabel="Outfit"
              value={character.outfit}
              placeholder="Outfit"
              onSave={onUpdate ? (outfit) => onUpdate({ ...character, outfit: outfit || null }) : undefined}
              tone="outfit"
              readable={readableDetailRows}
            />
          )}
        </div>
      )}

      {(characterStats.length > 0 || (onUpdate && addMode)) && (
        <div className={CHARACTER_STAT_BLOCK_CLASS}>
          <StatList
            stats={characterStats}
            onUpdate={onUpdate ? (stats) => onUpdate({ ...character, stats }) : undefined}
            onAdd={onUpdate ? addCharacterStat : undefined}
            nameMode="truncate"
            deleteMode={deleteMode}
            addMode={addMode}
          />
        </div>
      )}

      {customFields.length > 0 && (
        <div className={CHARACTER_CUSTOM_FIELD_LIST_CLASS}>
          {customFields.map(([name, value]) => (
            <div key={name} className={CHARACTER_CUSTOM_FIELD_ROW_CLASS}>
              {onUpdate ? (
                <InlineEdit
                  value={name}
                  onSave={(nextName) => updateCustomField(name, nextName, value)}
                  placeholder="Field"
                  className="min-w-0 px-0.5 py-0 font-medium"
                  scrollOnHover
                />
              ) : (
                <span className="truncate font-medium text-[color:var(--tracker-profile-muted-text)]">{name}</span>
              )}
              {onUpdate ? (
                <InlineEdit
                  value={value}
                  onSave={(nextValue) => updateCustomField(name, name, nextValue)}
                  placeholder="Value"
                  className="min-w-0 px-0.5 py-0"
                  scrollOnHover={!readableCustomFields}
                  twoLinePreview={readableCustomFields}
                  editHintMode={readableCustomFields ? "overlay" : "inline"}
                />
              ) : (
                <span
                  className={cn(
                    "min-w-0 text-[color:var(--tracker-profile-text)]",
                    readableCustomFields ? "line-clamp-2 whitespace-normal break-words" : "truncate",
                  )}
                >
                  {value}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </article>
  );
}
