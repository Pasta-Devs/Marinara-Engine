import { Loader2, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export interface CommandCenterToggleProps {
  checked: boolean;
  label: string;
  onCheckedChange: (checked: boolean) => void;
  icon?: LucideIcon;
  stateLabel?: string;
  variant?: "default" | "compact";
  disabled?: boolean;
  loading?: boolean;
  className?: string;
}

export function CommandCenterToggle({
  checked,
  label,
  onCheckedChange,
  icon: Icon,
  stateLabel,
  variant = "default",
  disabled = false,
  loading = false,
  className,
}: CommandCenterToggleProps) {
  const unavailable = disabled || loading;
  const compact = variant === "compact";

  return (
    <label
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex min-h-11 min-w-0 items-center gap-2 rounded-md text-xs font-semibold transition-colors sm:min-h-9",
        compact ? "max-w-full justify-end px-1" : "border border-[var(--border)] bg-[var(--secondary)] px-2.5",
        unavailable ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-[var(--accent)]",
        checked
          ? "text-[var(--foreground)]"
          : "text-[var(--secondary-foreground)] hover:text-[var(--accent-foreground)]",
        className,
      )}
    >
      {loading ? (
        <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden="true" />
      ) : Icon ? (
        <Icon className="size-4 shrink-0" aria-hidden="true" />
      ) : null}
      <span className={cn("min-w-0 break-words", compact ? "sr-only" : "flex-1")}>{label}</span>
      {compact && stateLabel ? (
        <span className="hidden shrink-0 truncate text-right text-[var(--muted-foreground)] sm:inline">
          {stateLabel}
        </span>
      ) : null}
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={unavailable}
        onChange={(event) => onCheckedChange(event.target.checked)}
        className="peer sr-only"
      />
      <span
        className={cn(
          "relative h-5 w-9 shrink-0 rounded-full border transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--ring)] peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-[var(--background)]",
          checked ? "border-[var(--primary)] bg-[var(--primary)]" : "border-[var(--border)] bg-[var(--muted)]",
        )}
        aria-hidden="true"
      >
        <span
          className={cn(
            "absolute left-0.5 top-0.5 size-3.5 rounded-full bg-[var(--background)] shadow-sm transition-transform",
            checked && "translate-x-4",
          )}
        />
      </span>
    </label>
  );
}
