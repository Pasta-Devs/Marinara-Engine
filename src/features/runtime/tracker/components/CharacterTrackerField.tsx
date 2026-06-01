import { type ReactNode } from "react";
import { cn } from "../../../../shared/lib/utils";
import { visibleText } from "./tracker-display.helpers";
import { InlineEdit } from "./tracker-data-sidebar.controls";
import "./TrackerProfileFields.css";

export type CompactCharacterFieldTone = "mood" | "appearance" | "outfit" | "thoughts";

const COMPACT_CHARACTER_FIELD_TONE_CLASSES: Record<CompactCharacterFieldTone, { icon: string }> = {
  mood: {
    icon: "tracker-compact-field-tone--mood",
  },
  appearance: {
    icon: "tracker-compact-field-tone--appearance",
  },
  outfit: {
    icon: "tracker-compact-field-tone--outfit",
  },
  thoughts: {
    icon: "tracker-compact-field-tone--thoughts",
  },
};

export const COMPACT_CHARACTER_MOOD_EDIT_CLASS = "tracker-compact-field-mood-edit";
export const COMPACT_CHARACTER_MOOD_STATIC_CLASS = "tracker-compact-field-mood-static";

export function CompactCharacterField({
  icon,
  accessibleLabel,
  value,
  placeholder,
  onSave,
  tone,
  readable = false,
  className,
  valueClassName,
}: {
  icon: ReactNode;
  accessibleLabel: string;
  value: string | null | undefined;
  placeholder: string;
  onSave?: (value: string) => void;
  tone: CompactCharacterFieldTone;
  readable?: boolean;
  className?: string;
  valueClassName?: string;
}) {
  if (!onSave && !value) return null;
  const toneClasses = COMPACT_CHARACTER_FIELD_TONE_CLASSES[tone];

  return (
    <div className={cn("tracker-compact-character-field", readable && "items-start pb-px pt-0.5", className)}>
      <span
        className={cn("tracker-compact-character-field__icon", toneClasses.icon)}
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
            "tracker-compact-character-field__edit",
            readable
              ? "min-h-7 leading-[1.12] @min-[176px]:leading-[1.15]"
              : "h-3.5 @min-[176px]:h-4 @min-[176px]:leading-4",
            valueClassName,
          )}
          scrollOnHover={!readable}
          twoLinePreview={readable}
          editHintMode={readable ? "overlay" : "inline"}
          showEditHint={false}
        />
      ) : (
        <span
          className={cn(
            "relative z-[1] min-w-0 text-[color:var(--tracker-profile-text)]",
            readable ? "line-clamp-2 whitespace-normal break-words leading-[1.15]" : "truncate",
            valueClassName,
          )}
        >
          {visibleText(value, placeholder)}
        </span>
      )}
    </div>
  );
}
