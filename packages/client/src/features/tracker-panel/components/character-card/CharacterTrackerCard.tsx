import type { ReactNode } from "react";
import { Eye, HeartPulse, Maximize2, Shirt, X } from "lucide-react";
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
  TrackerThoughtBubbleDisplay,
} from "../../../../stores/ui.store";
import { cn } from "../../../../lib/utils";
import { trackerEditableText, visibleText } from "../../lib/tracker-display";
import {
  makeUniqueCharacterCustomFieldName,
  normalizeCharacterCustomFieldName,
  resolveCharacterCustomFieldName,
} from "../../lib/character-custom-field-names";
import { getCharacterAmbienceStyle, type TrackerProfileColors } from "../../lib/tracker-profile-style";
import { FittedText, InlineAddRow, InlineEdit } from "../controls/InlineControls";
import {
  TrackerProfileDisplayWash,
  TrackerProfileEdgeHighlight,
  TrackerReadabilityVeil,
} from "../controls/TrackerProfileChrome";
import { StatList } from "../controls/StatList";
import { FeaturedCharacterTrackerCard } from "./FeaturedCharacterTrackerCard";
import { useTrackerFieldLock, useTrackerLockContext } from "../TrackerLockContext";
import { CharacterTrackerAvatar } from "./CharacterTrackerAvatar";
import {
  COMPACT_CHARACTER_MOOD_EDIT_CLASS,
  COMPACT_CHARACTER_MOOD_STATIC_CLASS,
  CompactCharacterField,
} from "./CharacterTrackerField";

const CHARACTER_CARD_CLASS =
  "group/character @container relative isolate h-full min-w-0 overflow-hidden rounded-md border border-[color-mix(in_srgb,var(--tracker-profile-rule)_52%,transparent)] bg-[image:var(--tracker-profile-material)] p-0.5 shadow-[0_0_9px_color-mix(in_srgb,var(--tracker-profile-dialogue-glow)_13%,transparent),inset_0_1px_0_color-mix(in_srgb,var(--foreground)_4%,transparent),inset_0_-1px_0_color-mix(in_srgb,var(--background)_24%,transparent)] transition-colors duration-200 hover:border-[color-mix(in_srgb,var(--foreground)_18%,var(--tracker-profile-rule)_82%)] [background-blend-mode:var(--tracker-profile-material-blend)]";
const CHARACTER_CARD_TONE_OVERLAY_CLASS =
  "pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(circle_at_22%_12%,color-mix(in_srgb,var(--tracker-profile-nameplate-glow)_10%,transparent),transparent_36%),linear-gradient(135deg,color-mix(in_srgb,var(--foreground)_2%,transparent),transparent_46%,color-mix(in_srgb,var(--tracker-profile-accent-solid)_4%,transparent))] opacity-[var(--tracker-profile-accent-wash-opacity,0)]";
const CHARACTER_CARD_TEXTURE_CLASS =
  "pointer-events-none absolute inset-0 z-0 bg-[repeating-linear-gradient(135deg,color-mix(in_srgb,var(--tracker-profile-rule)_7%,transparent)_0_1px,transparent_1px_7px),repeating-linear-gradient(0deg,color-mix(in_srgb,var(--foreground)_2%,transparent)_0_1px,transparent_1px_5px)] opacity-[0.24] mix-blend-soft-light [mask-image:linear-gradient(180deg,transparent_0%,black_20%,black_100%)]";
const CHARACTER_CARD_BODY_MATERIAL_CLASS =
  "pointer-events-none absolute inset-x-0 bottom-0 top-[1.35rem] z-0 bg-[image:var(--tracker-profile-material)] shadow-[inset_0_1px_0_color-mix(in_srgb,var(--foreground)_4%,transparent),inset_0_10px_18px_color-mix(in_srgb,var(--tracker-profile-accent-solid)_5%,transparent)] [background-blend-mode:var(--tracker-profile-material-blend)]";
const CHARACTER_AVATAR_CORNER_SHADE_CLASS =
  "pointer-events-none absolute left-0 top-[1.35rem] z-0 h-[3.1rem] w-[7.25rem] bg-[radial-gradient(ellipse_at_0%_0%,color-mix(in_srgb,var(--background)_48%,transparent)_0%,color-mix(in_srgb,var(--background)_24%,transparent)_34%,transparent_72%)] mix-blend-multiply [mask-image:linear-gradient(180deg,black_0%,black_60%,transparent_100%)]";
const CHARACTER_REMOVE_BUTTON_CLASS =
  "rounded p-1 text-[var(--destructive)] transition-all hover:bg-[var(--destructive)]/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--border)] active:scale-90";
const CHARACTER_HEADER_CLASS = "relative -mt-2.5 flex items-start gap-1 px-0.5";
const CHARACTER_HEADER_COPY_CLASS = "relative z-[1] min-w-0 flex-1 pt-3";
const CHARACTER_HEADER_VOID_TEXTURE_CLASS =
  "pointer-events-none absolute inset-x-0 bottom-[-0.125rem] top-[2.05rem] z-0 rounded-b-[5px] bg-[radial-gradient(ellipse_at_48%_0%,color-mix(in_srgb,var(--tracker-profile-accent-solid)_11%,transparent)_0%,transparent_62%),repeating-linear-gradient(135deg,color-mix(in_srgb,var(--tracker-profile-rule)_18%,transparent)_0_1px,transparent_1px_7px),repeating-linear-gradient(0deg,color-mix(in_srgb,var(--foreground)_4%,transparent)_0_1px,transparent_1px_5px)] opacity-[0.56] mix-blend-soft-light [mask-image:linear-gradient(180deg,transparent_0%,black_22%,black_82%,transparent_100%)]";
const CHARACTER_FEATURE_BUTTON_CLASS =
  "absolute left-0 top-0 z-[6] flex h-[1.35rem] w-[1.35rem] items-center justify-center rounded-tl-[5px] rounded-br-[5px] bg-transparent text-[var(--tracker-profile-nameplate-text)]/42 transition-all hover:bg-[color-mix(in_srgb,var(--tracker-profile-nameplate-rule)_10%,transparent)] hover:text-[var(--tracker-profile-nameplate-text)]/74 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-[var(--border)] active:scale-95 [&>svg]:drop-shadow-[0_1px_1px_rgba(0,0,0,0.35)]";
const CHARACTER_NAMEPLATE_CLASS =
  "relative z-[3] -mx-0.5 -mt-0.5 mb-0.5 flex h-[1.35rem] min-w-0 items-center overflow-hidden rounded-t-[5px] border-x border-t border-[color-mix(in_srgb,var(--tracker-profile-nameplate-rule)_20%,transparent)] bg-[image:var(--tracker-profile-nameplate)] pl-[clamp(4.05rem,43cqw,4.85rem)] pr-1.5 shadow-[0_0_4px_color-mix(in_srgb,var(--tracker-profile-nameplate-glow)_9%,transparent),inset_0_-1px_0_color-mix(in_srgb,var(--background)_24%,transparent)] [background-blend-mode:normal]";
const CHARACTER_NAMEPLATE_GLEAM_CLASS =
  "pointer-events-none absolute inset-x-0 top-0 z-[2] h-px bg-[image:var(--tracker-profile-accent-layer)] opacity-[var(--tracker-profile-accent-highlight-opacity,0.32)] [mask-image:linear-gradient(90deg,transparent_0%,black_20%,black_82%,transparent_100%)]";
const CHARACTER_AVATAR_SOCKET_CLASS =
  "pointer-events-none absolute z-[2] rounded-full border border-[color-mix(in_srgb,var(--tracker-profile-nameplate-rule)_34%,transparent)] bg-[image:var(--tracker-profile-nameplate)] shadow-[inset_0_1px_0_color-mix(in_srgb,var(--foreground)_4%,transparent),inset_0_-2px_4px_color-mix(in_srgb,var(--background)_24%,transparent)] [background-blend-mode:normal]";
const CHARACTER_AVATAR_SOCKET_SIZE_CLASS = {
  regular: "left-[0.32rem] top-[0.7rem] h-[clamp(3.06rem,35cqw,3.75rem)] w-[clamp(3.06rem,35cqw,3.75rem)]",
  dense: "left-[0.32rem] top-[0.7rem] h-[clamp(2.36rem,29cqw,3rem)] w-[clamp(2.36rem,29cqw,3rem)]",
} satisfies Record<"regular" | "dense", string>;
const CHARACTER_HEADER_FILLER_CLASS =
  "pointer-events-none mt-1 h-3 w-[86%] bg-[repeating-linear-gradient(180deg,color-mix(in_srgb,var(--tracker-profile-nameplate-rule)_16%,transparent)_0_1px,transparent_1px_6px)] opacity-45 [mask-image:linear-gradient(90deg,black_0%,transparent_100%)]";
const CHARACTER_NAME_EDIT_CLASS =
  "h-full w-full min-w-0 overflow-hidden px-0 py-0 text-[0.75rem] font-bold leading-[1.35rem] text-[color:var(--tracker-profile-nameplate-text)] drop-shadow-[0_1px_2px_rgba(0,0,0,0.38)] hover:bg-transparent";
const CHARACTER_NAME_PREVIEW_CLASS =
  "h-full w-full text-[0.75rem] font-bold leading-[1.35rem] text-[color:var(--tracker-profile-nameplate-text)] drop-shadow-[0_1px_2px_rgba(0,0,0,0.38)]";
const CHARACTER_DETAIL_ROWS_CLASS = "relative z-[1] mt-0.5 grid grid-cols-1 gap-px px-px pb-px";
const CHARACTER_STAT_BLOCK_CLASS =
  "group/statbox relative z-[1] mt-1 border-t border-[color-mix(in_srgb,var(--tracker-profile-rule)_34%,transparent)] pt-1";
const CHARACTER_CUSTOM_FIELD_LIST_CLASS =
  "relative z-[1] mt-1 grid gap-px border-t border-[color-mix(in_srgb,var(--tracker-profile-rule)_34%,transparent)] pt-1 text-[0.5625rem] @min-[176px]:text-[0.625rem]";
const CHARACTER_CUSTOM_FIELD_ROW_CLASS =
  "grid min-w-0 grid-cols-[minmax(2.05rem,0.42fr)_minmax(0,1fr)] items-center gap-0.5 @min-[176px]:grid-cols-[minmax(2.35rem,0.42fr)_minmax(0,1fr)] @min-[176px]:gap-1";

type HideableCharacterField = "mood" | "appearance" | "outfit" | "thoughts";

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
  lockKey,
  hidden = false,
  hideMode = false,
  onToggleHidden,
}: {
  value: string | null | undefined;
  onSave?: (value: string) => void;
  lockKey?: string;
  hidden?: boolean;
  hideMode?: boolean;
  onToggleHidden?: () => void;
}) {
  const lock = useTrackerFieldLock(lockKey);
  const hiddenToggleActive = hideMode && !!onToggleHidden;
  if (hidden && !hideMode) return null;
  const thoughtText = visibleText(value, "Thoughts").replace(/\s+/g, " ");

  return (
    <div className="relative z-[1] mt-0.5 w-full max-w-full">
      <div className="relative z-[2] max-h-[2.95rem] min-h-5 w-full min-w-0 overflow-hidden rounded-[1.05rem] border border-[color-mix(in_srgb,var(--tracker-profile-dialogue-border)_24%,transparent)] bg-[linear-gradient(150deg,color-mix(in_srgb,var(--tracker-profile-surface-solid)_78%,var(--tracker-profile-display-solid)_12%)_0%,color-mix(in_srgb,var(--tracker-profile-surface-solid)_72%,var(--tracker-profile-accent-solid)_10%)_54%,color-mix(in_srgb,var(--background)_34%,var(--tracker-profile-surface-solid)_66%)_100%)] px-2.5 pb-px pt-0.5 text-[var(--tracker-profile-text)] shadow-[0_3px_8px_color-mix(in_srgb,var(--background)_22%,transparent),0_0_6px_color-mix(in_srgb,var(--tracker-profile-accent-solid)_7%,transparent),inset_0_1px_0_color-mix(in_srgb,var(--foreground)_4%,transparent)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_18%,color-mix(in_srgb,var(--foreground)_7%,transparent),transparent_34%),radial-gradient(circle_at_88%_92%,color-mix(in_srgb,var(--tracker-profile-accent-solid)_9%,transparent),transparent_46%),linear-gradient(180deg,transparent_52%,color-mix(in_srgb,var(--background)_18%,transparent)_100%)]" />
        <div className="relative z-[1] flex w-full max-w-full items-center">
          {hiddenToggleActive ? (
            <button
              type="button"
              onClick={onToggleHidden}
              title={hidden ? "Show thoughts" : "Hide thoughts"}
              aria-label={hidden ? "Show thoughts" : "Hide thoughts"}
              aria-pressed={hidden}
              className="min-h-4 w-full min-w-0 rounded px-0 py-0 text-left text-[0.59375rem] font-medium italic leading-[1.05] text-[color-mix(in_srgb,var(--tracker-profile-text)_72%,transparent)] transition-colors hover:bg-[var(--tracker-profile-accent-solid)]/10"
            >
              <span className="line-clamp-3 break-words tracking-[0]">{hidden ? "Hidden" : thoughtText}</span>
            </button>
          ) : onSave ? (
            <InlineEdit
              value={value ?? ""}
              onSave={onSave}
              placeholder="Thoughts"
              className="min-h-4 w-full min-w-0 px-0 py-0 text-[0.59375rem] font-medium italic leading-[1.05] [--foreground:color-mix(in_srgb,var(--tracker-profile-text)_90%,var(--tracker-profile-accent-solid)_10%)] [--muted-foreground:color-mix(in_srgb,var(--tracker-profile-muted-text)_82%,var(--tracker-profile-accent-solid)_18%)] hover:bg-[var(--tracker-profile-accent-solid)]/10"
              showEditHint={false}
              previewLineCount={3}
              previewClassName="tracking-[0]"
              {...lock}
            />
          ) : (
            <p className="line-clamp-3 break-words text-[0.59375rem] font-medium italic leading-[1.05] tracking-[0] text-[color-mix(in_srgb,var(--tracker-profile-text)_90%,var(--tracker-profile-accent-solid)_10%)]">
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
  characterIndex = 0,
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
  characterIndex?: number;
  deleteMode?: boolean;
  addMode?: boolean;
  featured?: boolean;
  onToggleFeatured?: () => void;
  onUploadAvatar?: () => void;
}) {
  const {
    fieldLocks,
    hiddenTrackerFields,
    hideMode = false,
    lockMode,
    onToggleFieldLock,
    onUpdateFieldLocks,
    onUpdateHiddenFields,
  } = useTrackerLockContext();
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
        characterIndex={characterIndex}
        deleteMode={deleteMode}
        addMode={addMode}
        onToggleFeatured={onToggleFeatured}
        onUploadAvatar={onUploadAvatar}
      />
    );
  }

  const customFields = Object.entries((character.customFields ?? {}) as Record<string, unknown>).map(
    ([name, value]) => [name, value, trackerEditableText(value)] as const,
  );
  const characterStats = Array.isArray(character.stats) ? character.stats : [];
  const hasDeleteAction = !!onRemove && deleteMode;
  const avatarMedia = characterPicture ?? character.avatarPath ?? null;
  const compactAvatarUpload = characterPicture ? undefined : onUploadAvatar;
  const hasEditableCustomFieldAdd = !!onUpdate && addMode;
  const characterFieldKey = (field: HideableCharacterField) =>
    characterTrackerLockKey(character, characterIndex, field);
  const fieldHidden = (field: HideableCharacterField) =>
    isTrackerFieldHidden(hiddenTrackerFields, characterFieldKey(field));
  const toggleCharacterFieldHidden = (field: HideableCharacterField) => {
    if (!onUpdate) return;
    const key = characterFieldKey(field);
    const nextHidden = !isTrackerFieldHidden(hiddenTrackerFields, key);
    onUpdateHiddenFields?.((hiddenFields) => {
      const next = normalizeTrackerHiddenFields(hiddenFields);
      if (nextHidden) next[key] = true;
      else delete next[key];
      return next;
    });
    onUpdateFieldLocks?.((locks) => {
      const next = normalizeTrackerFieldLocks(locks);
      if (nextHidden) next[key] = true;
      else delete next[key];
      return next;
    });
    if (nextHidden) onUpdate({ ...character, [field]: field === "mood" ? "" : null });
  };
  const moodHidden = fieldHidden("mood");
  const appearanceHidden = fieldHidden("appearance");
  const outfitHidden = fieldHidden("outfit");
  const thoughtsHidden = fieldHidden("thoughts");
  const showAppearance = !!(character.appearance || onUpdate) && (!appearanceHidden || hideMode);
  const showOutfit = !!(character.outfit || onUpdate) && (!outfitHidden || hideMode);
  const showMood = !!(character.mood || onUpdate) && (!moodHidden || hideMode);
  const showThoughts = !!(character.thoughts || onUpdate) && (!thoughtsHidden || hideMode);
  const hasDetailRows = showMood || showAppearance || showOutfit;
  const hasDenseContent = characterStats.length > 0 || customFields.length > 0 || hasEditableCustomFieldAdd;
  const readableDetailRows = hasDenseContent;
  const readableCustomFields = trackerPanelSizeProfile === "expanded";
  const emojiLockKey = characterTrackerLockKey(character, characterIndex, "emoji");
  const avatarSize = hasDenseContent
    ? "z-[5] mt-0 w-[clamp(2.25rem,28%,3rem)] -translate-y-0.5"
    : "z-[5] mt-0 w-[clamp(3rem,36%,3.75rem)] -translate-y-0.5";
  const avatarSocketSize = hasDenseContent ? "dense" : "regular";
  const updateCustomField = (oldName: string, nextName: string, nextValue: unknown) => {
    if (!onUpdate) return;
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
  const addCharacterStat = () => {
    if (!onUpdate) return;
    onUpdate({
      ...character,
      stats: [...characterStats, { name: "New Stat", value: 0, max: 100, color: "var(--primary)" }],
    });
  };
  const addCustomField = () => {
    if (!onUpdate) return;
    const name = makeUniqueCharacterCustomFieldName(character.customFields);
    onUpdate({ ...character, customFields: { ...(character.customFields ?? {}), [name]: "" } });
  };
  const removeCustomField = (name: string) => {
    if (!onUpdate) return;
    const nextFields = { ...(character.customFields ?? {}) };
    delete nextFields[name];
    onUpdateFieldLocks?.((locks) =>
      removeTrackerFieldLockPrefix(
        locks,
        characterCustomFieldTrackerLockKey(character, characterIndex, name, "name").replace(/\.name$/, ""),
      ),
    );
    onUpdate({ ...character, customFields: nextFields });
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
            locked={isTrackerFieldLocked(fieldLocks, characterTrackerLockKey(character, characterIndex, "name"))}
            lockMode={lockMode}
            onToggleLock={
              onToggleFieldLock
                ? () => onToggleFieldLock(characterTrackerLockKey(character, characterIndex, "name"))
                : undefined
            }
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
          onSaveEmoji={onUpdate ? (emoji) => onUpdate({ ...character, emoji }) : undefined}
          emojiLocked={isTrackerFieldLocked(fieldLocks, emojiLockKey)}
          lockMode={lockMode}
          onToggleEmojiLock={onToggleFieldLock ? () => onToggleFieldLock(emojiLockKey) : undefined}
        />
        <div className={CHARACTER_HEADER_COPY_CLASS}>
          {showThoughts && (
            <CompactThoughtBubble
              value={character.thoughts}
              onSave={onUpdate ? (thoughts) => onUpdate({ ...character, thoughts: thoughts || null }) : undefined}
              lockKey={characterTrackerLockKey(character, characterIndex, "thoughts")}
              hidden={thoughtsHidden}
              hideMode={hideMode}
              onToggleHidden={onUpdate ? () => toggleCharacterFieldHidden("thoughts") : undefined}
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
              lockKey={characterTrackerLockKey(character, characterIndex, "mood")}
              hidden={moodHidden}
              hideMode={hideMode}
              onToggleHidden={onUpdate ? () => toggleCharacterFieldHidden("mood") : undefined}
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
              lockKey={characterTrackerLockKey(character, characterIndex, "appearance")}
              hidden={appearanceHidden}
              hideMode={hideMode}
              onToggleHidden={onUpdate ? () => toggleCharacterFieldHidden("appearance") : undefined}
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
              lockKey={characterTrackerLockKey(character, characterIndex, "outfit")}
              hidden={outfitHidden}
              hideMode={hideMode}
              onToggleHidden={onUpdate ? () => toggleCharacterFieldHidden("outfit") : undefined}
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
            getLockKey={(statIndex, field, stat) =>
              characterStatTrackerLockKey(character, characterIndex, stat, field, statIndex)
            }
          />
        </div>
      )}

      {(customFields.length > 0 || hasEditableCustomFieldAdd) && (
        <div className={CHARACTER_CUSTOM_FIELD_LIST_CLASS}>
          {customFields.map(([name, rawValue, displayValue]) => (
            <div
              key={name}
              className={cn(
                CHARACTER_CUSTOM_FIELD_ROW_CLASS,
                deleteMode &&
                  "grid-cols-[minmax(2.05rem,0.38fr)_minmax(0,1fr)_1.25rem] @min-[176px]:grid-cols-[minmax(2.35rem,0.38fr)_minmax(0,1fr)_1.25rem]",
              )}
            >
              {onUpdate ? (
                <InlineEdit
                  value={name}
                  onSave={(nextName) => updateCustomField(name, nextName, rawValue)}
                  placeholder="Field"
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
              ) : (
                <span className="truncate font-medium text-[color:var(--tracker-profile-muted-text)]">{name}</span>
              )}
              {onUpdate ? (
                <InlineEdit
                  value={displayValue}
                  onSave={(nextValue) => updateCustomField(name, name, nextValue)}
                  placeholder="Value"
                  ariaLabel={`${name} value`}
                  className="min-w-0 px-0.5 py-0"
                  scrollOnHover={!readableCustomFields}
                  twoLinePreview={readableCustomFields}
                  locked={isTrackerFieldLocked(
                    fieldLocks,
                    characterCustomFieldTrackerLockKey(character, characterIndex, name, "value"),
                  )}
                  lockMode={lockMode}
                  onToggleLock={
                    onToggleFieldLock
                      ? () =>
                          onToggleFieldLock(
                            characterCustomFieldTrackerLockKey(character, characterIndex, name, "value"),
                          )
                      : undefined
                  }
                />
              ) : (
                <span
                  title={displayValue}
                  className={cn(
                    "min-w-0 text-[color:var(--tracker-profile-text)]",
                    readableCustomFields ? "line-clamp-2 whitespace-normal break-words" : "truncate",
                  )}
                >
                  {displayValue}
                </span>
              )}
              {deleteMode && onUpdate && (
                <button
                  type="button"
                  onClick={() => removeCustomField(name)}
                  title={`Remove ${name}`}
                  aria-label={`Remove ${name}`}
                  className="flex h-5 w-5 items-center justify-center justify-self-end rounded text-[var(--destructive)] transition-all hover:bg-[var(--destructive)]/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--border)] active:scale-90 [@media(pointer:coarse)]:h-6 [@media(pointer:coarse)]:w-6"
                >
                  <X size="0.625rem" />
                </button>
              )}
            </div>
          ))}
          {hasEditableCustomFieldAdd && (
            <InlineAddRow title="Add custom field" onClick={addCustomField} className="col-span-full" />
          )}
        </div>
      )}
    </article>
  );
}
