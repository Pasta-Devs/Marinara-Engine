import { type ReactNode } from "react";
import { Eye, HeartPulse, Shirt } from "lucide-react";
import type { CharacterStat, PresentCharacter } from "../../../../engine/contracts/types/game-state";
import type { TrackerPanelSizeProfile } from "../../../../shared/stores/ui.store";
import { cn } from "../../../../shared/lib/utils";
import type { TrackerStatDensity } from "./tracker-data-sidebar.constants";
import { visibleText } from "./tracker-display.helpers";
import { InlineEdit, TRACKER_PROFILE_FIELD_TILE_CLASS } from "./tracker-data-sidebar.controls";
import { StatList as TrackerStatList } from "./tracker-data-sidebar.stats";
import "./TrackerProfileFields.css";

const FEATURED_FIELD_LIST_CLASS = "relative z-[1] grid h-full min-h-0 grid-cols-1 gap-1 overflow-hidden p-1";
const FEATURED_FIELD_ICON_CLASS = "tracker-featured-field-icon";
type FeaturedFieldTone = "mood" | "appearance" | "outfit";
const FEATURED_FIELD_ICON_TONE_CLASS = {
  mood: "tracker-featured-field-icon--mood",
  appearance: "tracker-featured-field-icon--appearance",
  outfit: "tracker-featured-field-icon--outfit",
} satisfies Record<FeaturedFieldTone, string>;
const FEATURED_FIELD_TILE_CLASS_BY_PROFILE = {
  compact: "py-0.5",
  standard: "py-1",
  expanded: "py-1.5",
} satisfies Record<TrackerPanelSizeProfile, string>;
const FEATURED_FIELD_TEXT_CLASS_BY_PROFILE = {
  compact: "text-[0.625rem] leading-[1.12]",
  standard: "text-[0.625rem] leading-[1.16]",
  expanded: "text-[0.6875rem] leading-[1.18]",
} satisfies Record<TrackerPanelSizeProfile, string>;
const FEATURED_FIELD_PREVIEW_LINES_BY_PROFILE = {
  compact: 2,
  standard: 3,
  expanded: 4,
} satisfies Record<TrackerPanelSizeProfile, 2 | 3 | 4>;
const FEATURED_FIELD_PREVIEW_CLASS_BY_PROFILE = {
  compact: "line-clamp-2",
  standard: "line-clamp-3",
  expanded: "line-clamp-4",
} satisfies Record<TrackerPanelSizeProfile, string>;
const FEATURED_STAT_SHELF_CLASS = cn("group/statbox tracker-featured-stat-shelf");

function FeaturedFieldTile({
  icon,
  accessibleLabel,
  value,
  placeholder,
  onSave,
  readable = false,
  sizeProfile,
  tone,
}: {
  icon: ReactNode;
  accessibleLabel: string;
  value: string | null | undefined;
  placeholder: string;
  onSave?: (value: string) => void;
  readable?: boolean;
  sizeProfile: TrackerPanelSizeProfile;
  tone: FeaturedFieldTone;
}) {
  const displayValue = visibleText(value, placeholder);
  const textClass = FEATURED_FIELD_TEXT_CLASS_BY_PROFILE[sizeProfile];
  const previewLines = FEATURED_FIELD_PREVIEW_LINES_BY_PROFILE[sizeProfile];

  return (
    <div className={cn(TRACKER_PROFILE_FIELD_TILE_CLASS, FEATURED_FIELD_TILE_CLASS_BY_PROFILE[sizeProfile])}>
      <span
        className={cn(FEATURED_FIELD_ICON_CLASS, FEATURED_FIELD_ICON_TONE_CLASS[tone])}
        aria-label={accessibleLabel}
        title={accessibleLabel}
      >
        {icon}
      </span>
      {onSave ? (
        <InlineEdit
          value={value ?? ""}
          onSave={onSave}
          placeholder={placeholder}
          className={cn(
            "w-full min-w-0 self-center px-0 py-0 text-[color:var(--tracker-profile-text)] hover:bg-[var(--accent)]/25",
            readable ? textClass : "h-4 text-[0.625rem] leading-4",
          )}
          editHintMode={readable ? "overlay" : "inline"}
          scrollOnHover={!readable}
          twoLinePreview={readable}
          previewLineCount={previewLines}
        />
      ) : (
        <span
          className={cn(
            "self-center text-[color:var(--tracker-profile-text)]",
            readable ? "min-h-0 break-words [align-content:start]" : "block truncate text-[0.625rem]",
            readable && textClass,
            readable && FEATURED_FIELD_PREVIEW_CLASS_BY_PROFILE[sizeProfile],
          )}
        >
          {displayValue}
        </span>
      )}
    </div>
  );
}

export function FeaturedFieldList({
  character,
  onUpdate,
  readableRows = true,
  sizeProfile,
}: {
  character: PresentCharacter;
  onUpdate?: (character: PresentCharacter) => void;
  readableRows?: boolean;
  sizeProfile: TrackerPanelSizeProfile;
}) {
  const fields = [
    {
      accessibleLabel: "Mood",
      icon: <HeartPulse size="0.75rem" />,
      key: "mood",
      onSave: onUpdate ? (mood: string) => onUpdate({ ...character, mood }) : undefined,
      placeholder: "Mood",
      show: !!(character.mood || onUpdate),
      tone: "mood" as const,
      value: character.mood,
    },
    {
      accessibleLabel: "Look",
      icon: <Eye size="0.75rem" />,
      key: "appearance",
      onSave: onUpdate ? (appearance: string) => onUpdate({ ...character, appearance: appearance || null }) : undefined,
      placeholder: "Appearance",
      show: !!(character.appearance || onUpdate),
      tone: "appearance" as const,
      value: character.appearance,
    },
    {
      accessibleLabel: "Outfit",
      icon: <Shirt size="0.75rem" />,
      key: "outfit",
      onSave: onUpdate ? (outfit: string) => onUpdate({ ...character, outfit: outfit || null }) : undefined,
      placeholder: "Outfit",
      show: !!(character.outfit || onUpdate),
      tone: "outfit" as const,
      value: character.outfit,
    },
  ].filter((field) => field.show);
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
          readable={readableRows}
          sizeProfile={sizeProfile}
          tone={field.tone}
        />
      ))}
    </div>
  );
}

export function FeaturedStatGrid({
  stats,
  onUpdate,
  onAdd,
  deleteMode,
  addMode,
  density,
  scrollable,
  wideColumns,
  className,
}: {
  stats: CharacterStat[];
  onUpdate?: (stats: CharacterStat[]) => void;
  onAdd?: () => void;
  deleteMode: boolean;
  addMode: boolean;
  density: TrackerStatDensity;
  scrollable: boolean;
  wideColumns?: boolean;
  className?: string;
}) {
  return (
    <div className={cn(FEATURED_STAT_SHELF_CLASS, scrollable ? "overflow-y-auto" : "overflow-y-hidden", className)}>
      <div className="relative z-[2]">
        <TrackerStatList
          stats={stats}
          onUpdate={onUpdate}
          onAdd={onAdd}
          deleteMode={deleteMode}
          addMode={addMode}
          nameMode="truncate"
          density={density}
          fillAvailable={false}
          wideColumns={wideColumns}
          showWideColumnGhost={wideColumns}
          visualTone="instrument"
        />
      </div>
    </div>
  );
}
