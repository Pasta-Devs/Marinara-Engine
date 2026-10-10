import { UserRound, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { CharacterPreviewModel } from "../../lib/character-preview";
import { cn } from "../../lib/utils";
import { CommandCenterMedia } from "../command-center/CommandCenterMedia";

interface CharacterSubjectProps {
  character: CharacterPreviewModel;
  label: string;
  onRemove?: () => void;
  compact?: boolean;
  className?: string;
  removeLabel?: string;
}

/** Compact identity marker for places that reference a character without opening a card. */
export function CharacterSubject({
  character,
  label,
  onRemove,
  compact = false,
  className,
  removeLabel,
}: CharacterSubjectProps) {
  const { t } = useTranslation();
  const resolvedRemoveLabel =
    removeLabel ?? t("ui.characters.charactersubject.removeValue1", "Remove {{value1}}", { value1: character.name });
  return (
    <div
      data-component="CharacterSubject"
      className={cn(
        "flex min-w-0 items-center gap-2 rounded-lg border border-[var(--primary)]/25 bg-[var(--primary)]/8 text-left",
        compact ? "px-1.5 py-1" : "px-2.5 py-2",
        className,
      )}
    >
      <CommandCenterMedia
        size="row"
        role="row"
        icon={UserRound}
        src={character.avatarSrc}
        alt=""
        kind="avatar"
        avatarCropStyle={character.avatarCropStyle}
        className={compact ? "size-6" : "size-8"}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[0.625rem] font-semibold uppercase tracking-[0.06em] text-[var(--muted-foreground)]">
          {label}
        </p>
        <p className={cn("truncate font-semibold text-[var(--foreground)]", compact ? "text-xs" : "text-sm")}>
          {character.name}
        </p>
      </div>
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          className="flex size-7 shrink-0 items-center justify-center rounded-md text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
          aria-label={resolvedRemoveLabel}
          title={resolvedRemoveLabel}
        >
          <X size="0.75rem" />
        </button>
      ) : null}
    </div>
  );
}
