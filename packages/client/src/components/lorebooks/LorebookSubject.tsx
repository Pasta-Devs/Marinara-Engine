import { BookOpen, X } from "lucide-react";
import type { LorebookPreviewModel } from "../../lib/lorebook-preview";
import { cn } from "../../lib/utils";
import { CommandCenterMedia } from "../command-center/CommandCenterMedia";

type Props = {
  lorebook: LorebookPreviewModel;
  label: string;
  compact?: boolean;
  className?: string;
} & ({ onRemove: () => void; removeLabel: string } | { onRemove?: undefined; removeLabel?: never });

export function LorebookSubject({ lorebook, label, compact = false, onRemove, removeLabel, className }: Props) {
  return (
    <div
      className={cn(
        "flex min-w-0 items-center rounded-lg border border-[var(--border)] bg-[var(--card)]",
        compact ? "gap-2 px-2 py-1.5" : "gap-2.5 p-2.5",
        className,
      )}
    >
      <CommandCenterMedia
        size="row"
        role="row"
        icon={BookOpen}
        src={lorebook.imageSrc}
        alt=""
        kind="artwork"
        className={compact ? "size-8" : "size-10"}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[0.625rem] font-semibold uppercase tracking-[0.06em] text-[var(--muted-foreground)]">
          {label}
        </p>
        <p className="truncate text-sm font-semibold text-[var(--foreground)]">{lorebook.name}</p>
      </div>
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          className="flex size-7 shrink-0 items-center justify-center rounded-md text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
          aria-label={removeLabel}
          title={removeLabel}
        >
          <X className="size-3.5" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}
