import { User } from "lucide-react";
import { cn } from "../../../../shared/lib/utils";

type CharacterLibraryEmptyStateProps = {
  title: string;
  description?: string;
  tone?: "default" | "error";
  action?: {
    label: string;
    onClick: () => void;
  };
};

export function CharacterLibraryEmptyState({
  title,
  description,
  tone = "default",
  action,
}: CharacterLibraryEmptyStateProps) {
  const error = tone === "error";

  return (
    <div
      className={cn(
        "flex min-h-[18rem] flex-col items-center justify-center gap-3 rounded-[2rem] border p-6 text-center",
        error
          ? "border-[var(--destructive)]/30 bg-[var(--destructive)]/10"
          : "border-dashed border-[var(--border)]/60 bg-[var(--card)]/50",
      )}
    >
      {!error && (
        <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-gradient-to-br from-pink-400/20 to-rose-500/20 text-[var(--primary)]">
          <User size="1.5rem" />
        </div>
      )}
      <div>
        <h2 className="text-lg font-semibold text-[var(--foreground)]">{title}</h2>
        {description && <p className="mt-1 max-w-md text-sm text-[var(--muted-foreground)]">{description}</p>}
      </div>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="rounded-2xl bg-[var(--secondary)] px-4 py-2 text-sm font-medium text-[var(--secondary-foreground)] ring-1 ring-[var(--border)] transition-colors hover:bg-[var(--accent)]"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
