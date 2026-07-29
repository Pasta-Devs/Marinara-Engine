import { type ReactNode } from "react";
import { Eye, HeartPulse, Shirt } from "lucide-react";
import {
  characterTrackerLockKey,
  isTrackerFieldHidden,
  normalizeTrackerFieldLocks,
  normalizeTrackerHiddenFields,
  type PresentCharacter,
} from "@marinara-engine/shared";
import type { TrackerPanelSizeProfile } from "../../../../stores/ui.store";
import { cn } from "../../../../lib/utils";
import { visibleText } from "../../lib/tracker-display";
import { InlineEdit } from "../controls/InlineControls";
import { TRACKER_PROFILE_FIELD_TILE_CLASS } from "../controls/TrackerProfileChrome";
import { useTrackerFieldLock, useTrackerLockContext } from "../TrackerLockContext";
import { useTranslation as useUiTranslation } from "react-i18next";

const FEATURED_FIELD_LIST_CLASS =
  "relative z-[1] grid h-full min-h-0 grid-cols-1 gap-0.5 overflow-hidden px-1 py-0.5";
const FEATURED_FIELD_ICON_CLASS =
  "relative flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[color-mix(in_srgb,var(--tracker-profile-icon)_58%,var(--tracker-profile-text)_42%)] opacity-[0.82] ring-1 ring-inset ring-[color-mix(in_srgb,var(--tracker-profile-dialogue-border)_18%,transparent)] transition-colors before:absolute before:inset-[3px] before:rounded-full before:bg-[color-mix(in_srgb,var(--tracker-profile-accent-solid)_3%,transparent)] before:content-[''] group-hover/field:text-[color-mix(in_srgb,var(--tracker-profile-icon)_78%,var(--tracker-profile-text)_22%)] group-hover/field:ring-[color-mix(in_srgb,var(--tracker-profile-dialogue-border)_34%,transparent)] group-hover/field:before:bg-[color-mix(in_srgb,var(--tracker-profile-accent-solid)_6%,transparent)] [&>svg]:relative [&>svg]:z-[1] [&>svg]:stroke-[1.85]";
type FeaturedCharacterFieldKey = "mood" | "appearance" | "outfit";
const FEATURED_FIELD_ICON_TONE_CLASS = {
  mood: "text-[color-mix(in_srgb,var(--tracker-profile-icon)_70%,var(--tracker-profile-text)_30%)] before:bg-[color-mix(in_srgb,var(--tracker-profile-accent-solid)_4%,transparent)] group-hover/field:text-[color-mix(in_srgb,var(--tracker-profile-icon)_84%,var(--tracker-profile-text)_16%)]",
  appearance:
    "text-[color-mix(in_srgb,var(--tracker-profile-icon)_58%,var(--tracker-profile-text)_42%)] before:bg-[color-mix(in_srgb,var(--tracker-profile-accent-solid)_3%,transparent)] group-hover/field:text-[color-mix(in_srgb,var(--tracker-profile-icon)_76%,var(--tracker-profile-text)_24%)]",
  outfit:
    "text-[color-mix(in_srgb,var(--tracker-profile-icon)_50%,var(--tracker-profile-text)_50%)] before:bg-[color-mix(in_srgb,var(--tracker-profile-accent-solid)_3%,transparent)] group-hover/field:text-[color-mix(in_srgb,var(--tracker-profile-icon)_68%,var(--tracker-profile-text)_32%)]",
} satisfies Record<FeaturedCharacterFieldKey, string>;
const FEATURED_FIELD_TILE_CLASS_BY_PROFILE = {
  compact: "py-0.5",
  standard: "py-1",
  expanded: "py-1",
} satisfies Record<TrackerPanelSizeProfile, string>;
const FEATURED_FIELD_TEXT_CLASS_BY_PROFILE = {
  compact: "text-[0.625rem] leading-[1.12]",
  standard: "text-[0.625rem] leading-[1.16]",
  expanded: "text-[0.6875rem] leading-[1.18]",
} satisfies Record<TrackerPanelSizeProfile, string>;
const FEATURED_FIELD_PREVIEW_LINES_BY_PROFILE = {
  compact: 2,
  standard: 3,
  expanded: 3,
} satisfies Record<TrackerPanelSizeProfile, 2 | 3>;
function FeaturedFieldTile({
  icon,
  accessibleLabel,
  value,
  placeholder,
  onSave,
  sizeProfile,
  fieldKey,
  lockKey,
  hidden = false,
  hideMode = false,
  onToggleHidden,
}: {
  icon: ReactNode;
  accessibleLabel: string;
  value: string | null | undefined;
  placeholder: string;
  onSave: (value: string) => void;
  sizeProfile: TrackerPanelSizeProfile;
  fieldKey: FeaturedCharacterFieldKey;
  lockKey?: string;
  hidden?: boolean;
  hideMode?: boolean;
  onToggleHidden: () => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const lock = useTrackerFieldLock(lockKey);
  if (hidden && !hideMode) return null;
  const displayValue = visibleText(value, placeholder);
  const textClass = FEATURED_FIELD_TEXT_CLASS_BY_PROFILE[sizeProfile];
  const previewLines = FEATURED_FIELD_PREVIEW_LINES_BY_PROFILE[sizeProfile];

  return (
    <div
      className={cn(
        TRACKER_PROFILE_FIELD_TILE_CLASS,
        FEATURED_FIELD_TILE_CLASS_BY_PROFILE[sizeProfile],
        hidden && "opacity-60 grayscale",
      )}
    >
      <span
        className={cn(FEATURED_FIELD_ICON_CLASS, FEATURED_FIELD_ICON_TONE_CLASS[fieldKey])}
        aria-label={accessibleLabel}
        title={accessibleLabel}
      >
        {icon}
      </span>
      {hideMode ? (
        <button
          type="button"
          onClick={onToggleHidden}
          title={hidden ?localizeUi("ui.trackerPanel.compactcharacterfield.showValue1", { value1: accessibleLabel.toLowerCase() }) :localizeUi("ui.trackerPanel.compactcharacterfield.hideValue1", { value1: accessibleLabel.toLowerCase() })}
          aria-label={hidden ?localizeUi("ui.trackerPanel.compactcharacterfield.showValue1", { value1: accessibleLabel.toLowerCase() }) :localizeUi("ui.trackerPanel.compactcharacterfield.hideValue1", { value1: accessibleLabel.toLowerCase() })}
          aria-pressed={hidden}
          className={cn(
            "w-full min-w-0 self-center rounded px-0 py-0 text-left transition-colors hover:bg-[var(--accent)]/25",
            textClass,
            hidden ? "italic text-[color-mix(in_srgb,var(--tracker-profile-muted-text)_62%,transparent)]" : "text-[color:var(--tracker-profile-text)]",
          )}
        >
          <span
            className={cn(
              "break-words [align-content:start]",
              previewLines === 2 ? "line-clamp-2" : "line-clamp-3",
            )}
          >
            {hidden ?localizeUi("ui.trackerPanel.thoughtbubble.hidden") : displayValue}
          </span>
        </button>
      ) : (
        <InlineEdit
          value={value ?? ""}
          onSave={onSave}
          placeholder={placeholder}
          className={cn(
            "w-full min-w-0 self-center px-0 py-0 text-[color:var(--tracker-profile-text)] hover:bg-[var(--accent)]/25",
            textClass,
          )}
          previewLineCount={previewLines}
          {...lock}
        />
      )}
    </div>
  );
}

export function FeaturedFieldList({
  character,
  onUpdate,
  sizeProfile,
  characterIndex,
}: {
  character: PresentCharacter;
  onUpdate: (character: PresentCharacter) => void;
  sizeProfile: TrackerPanelSizeProfile;
  characterIndex: number;
}) {
  const { hiddenTrackerFields, hideMode, onUpdateFieldLocks, onUpdateHiddenFields } = useTrackerLockContext();
  const fieldKey = (field: FeaturedCharacterFieldKey) => characterTrackerLockKey(character, characterIndex, field);
  const fieldHidden = (field: FeaturedCharacterFieldKey) => isTrackerFieldHidden(hiddenTrackerFields, fieldKey(field));
  const toggleFieldHidden = (field: FeaturedCharacterFieldKey) => {
    const key = fieldKey(field);
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
  const fields = [
    {
      accessibleLabel: "Mood",
      icon: <HeartPulse size="0.75rem" />,
      key: "mood" as const,
      onSave: (mood: string) => onUpdate({ ...character, mood }),
      placeholder: "Mood",
      hidden: fieldHidden("mood"),
      value: character.mood,
    },
    {
      accessibleLabel: "Look",
      icon: <Eye size="0.75rem" />,
      key: "appearance" as const,
      onSave: (appearance: string) => onUpdate({ ...character, appearance: appearance || null }),
      placeholder: "Appearance",
      hidden: fieldHidden("appearance"),
      value: character.appearance,
    },
    {
      accessibleLabel: "Outfit",
      icon: <Shirt size="0.75rem" />,
      key: "outfit" as const,
      onSave: (outfit: string) => onUpdate({ ...character, outfit: outfit || null }),
      placeholder: "Outfit",
      hidden: fieldHidden("outfit"),
      value: character.outfit,
    },
  ].filter((field) => !field.hidden || hideMode);
  if (fields.length === 0) return null;
  return (
    <div className={FEATURED_FIELD_LIST_CLASS} style={{ gridTemplateRows: `repeat(${fields.length}, minmax(0, 1fr))` }}>
      {fields.map((field) => (
        <FeaturedFieldTile
          key={field.key}
          icon={field.icon}
          accessibleLabel={field.accessibleLabel}
          value={field.value}
          placeholder={field.placeholder}
          onSave={field.onSave}
          sizeProfile={sizeProfile}
          fieldKey={field.key}
          lockKey={fieldKey(field.key)}
          hidden={field.hidden}
          hideMode={hideMode}
          onToggleHidden={() => toggleFieldHidden(field.key)}
        />
      ))}
    </div>
  );
}
