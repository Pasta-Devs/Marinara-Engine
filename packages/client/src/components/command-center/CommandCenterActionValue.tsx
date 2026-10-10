import { Loader2, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export type CommandCenterActionTone = "neutral" | "primary" | "destructive";

export interface CommandCenterActionValueProps {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  value?: string | number;
  valueIcon?: LucideIcon;
  variant?: "default" | "compact";
  tone?: CommandCenterActionTone;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
}

const toneClasses: Record<CommandCenterActionTone, string> = {
  neutral:
    "border-[var(--border)] bg-[var(--secondary)] text-[var(--secondary-foreground)] hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)]",
  primary:
    "border-[color-mix(in_srgb,var(--primary)_45%,var(--border))] bg-[color-mix(in_srgb,var(--primary)_14%,var(--secondary))] text-[var(--foreground)] hover:bg-[color-mix(in_srgb,var(--primary)_20%,var(--secondary))]",
  destructive:
    "border-[color-mix(in_srgb,var(--destructive)_45%,var(--border))] bg-[color-mix(in_srgb,var(--destructive)_12%,var(--secondary))] text-[var(--destructive)] hover:bg-[color-mix(in_srgb,var(--destructive)_18%,var(--secondary))]",
};

export function CommandCenterActionValue({
  label,
  icon: Icon,
  onClick,
  value,
  valueIcon: ValueIcon,
  variant = "default",
  tone = "neutral",
  disabled = false,
  loading = false,
  className,
}: CommandCenterActionValueProps) {
  const compact = variant === "compact";

  return (
    <button
      type="button"
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-11 min-w-0 items-center gap-2 rounded-md text-xs font-semibold transition-colors sm:min-h-9",
        compact ? "px-2" : "border px-2.5",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        toneClasses[tone],
        className,
      )}
    >
      {loading ? (
        <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden="true" />
      ) : (
        <Icon className="size-4 shrink-0" aria-hidden="true" />
      )}
      <span className="min-w-0 flex-1 break-words text-left">{label}</span>
      {value !== undefined ? (
        <span
          className={cn(
            "ml-auto inline-flex max-w-40 shrink-0 items-center gap-1 break-words text-right text-[0.6875rem] font-medium tabular-nums text-[var(--muted-foreground)]",
            !compact && "rounded-sm bg-[var(--background)]/55 px-1.5 py-0.5 ring-1 ring-inset ring-[var(--border)]",
          )}
        >
          {ValueIcon ? <ValueIcon className="size-3.5 shrink-0" aria-hidden="true" /> : null}
          {value}
        </span>
      ) : null}
    </button>
  );
}
