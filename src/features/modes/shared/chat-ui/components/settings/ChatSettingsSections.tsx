import { ChevronDown, Search, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { HelpTooltip } from "../../../../../../shared/components/ui/HelpTooltip";
import { cn } from "../../../../../../shared/lib/utils";

export function ChatSettingsSectionHeader({
  label,
  icon,
  count,
  help,
  expanded,
  onToggle,
}: {
  label: string;
  icon?: ReactNode;
  count?: number;
  help?: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className={cn(
          "flex min-h-11 w-full min-w-0 items-center gap-2 px-4 py-3 text-left transition-colors hover:bg-[var(--accent)]/50",
          help && "pr-12 max-md:pr-16",
        )}
      >
        {icon && <span className="text-[var(--muted-foreground)]">{icon}</span>}
        <span className="flex-1 truncate text-xs font-semibold">{label}</span>
        {count != null && count > 0 && (
          <span className="rounded-full bg-[var(--primary)]/15 px-1.5 py-0.5 text-[0.625rem] font-medium text-[var(--primary)]">
            {count}
          </span>
        )}
        <ChevronDown
          size="0.75rem"
          className={cn("text-[var(--muted-foreground)] transition-transform", expanded && "rotate-180")}
        />
      </button>
      {help && (
        <span className="absolute right-4 top-3 z-10 max-md:top-0">
          <HelpTooltip text={help} side="left" />
        </span>
      )}
    </div>
  );
}

export function ChatSettingsSection({
  label,
  icon,
  count,
  help,
  children,
}: {
  label: string;
  icon?: ReactNode;
  count?: number;
  help?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-[var(--border)]">
      <ChatSettingsSectionHeader
        label={label}
        icon={icon}
        count={count}
        help={help}
        expanded={open}
        onToggle={() => setOpen((o) => !o)}
      />
      {open && <div className="px-6 py-3">{children}</div>}
    </div>
  );
}

export function AgentCategorySection({
  label,
  icon,
  description,
  count,
  children,
}: {
  label: string;
  icon: ReactNode;
  description: string;
  count?: number;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="overflow-hidden rounded-lg border border-[var(--border)]">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-[var(--accent)]/50"
      >
        <span className="text-[var(--muted-foreground)]">{icon}</span>
        <div className="min-w-0 flex-1">
          <span className="text-[0.6875rem] font-semibold">{label}</span>
          {!open && (
            <p className="truncate text-[0.5625rem] leading-tight text-[var(--muted-foreground)]">{description}</p>
          )}
        </div>
        {count != null && count > 0 && (
          <span className="rounded-full bg-[var(--primary)]/15 px-1.5 py-0.5 text-[0.5625rem] font-medium text-[var(--primary)]">
            {count}
          </span>
        )}
        <ChevronDown
          size="0.625rem"
          className={cn("shrink-0 text-[var(--muted-foreground)] transition-transform", open && "rotate-180")}
        />
      </button>
      {open && (
        <div className="space-y-1.5 px-3 pb-2.5">
          <p className="text-[0.5625rem] leading-tight text-[var(--muted-foreground)]">{description}</p>
          {children}
        </div>
      )}
    </div>
  );
}

export function PickerDropdown({
  search,
  onSearchChange,
  onClose,
  placeholder,
  children,
  footer,
}: {
  search: string;
  onSearchChange: (v: string) => void;
  onClose: () => void;
  placeholder: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div ref={ref} className="mt-2 overflow-hidden rounded-lg bg-[var(--card)] ring-1 ring-[var(--border)]">
      <div className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-2">
        <Search size="0.75rem" className="text-[var(--muted-foreground)]" />
        <input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={placeholder}
          autoFocus
          className="flex-1 bg-transparent text-xs outline-none placeholder:text-[var(--muted-foreground)]"
        />
        <button onClick={onClose} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
          <X size="0.75rem" />
        </button>
      </div>
      <div className="max-h-48 overflow-y-auto">{children}</div>
      {footer}
    </div>
  );
}

export function SpriteRangeSlider({
  label,
  value,
  min,
  max,
  step,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5 rounded-lg bg-[var(--secondary)]/50 px-2.5 py-2 text-[0.625rem] text-[var(--muted-foreground)]">
      <span className="flex items-center justify-between gap-2">
        <span className="font-medium text-[var(--foreground)]">{label}</span>
        <span className="rounded-full bg-[var(--background)] px-2 py-0.5 text-[0.5625rem] tabular-nums text-[var(--muted-foreground)] ring-1 ring-[var(--border)]">
          {value}
          {suffix}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-8 w-full cursor-pointer accent-[var(--primary)]"
      />
    </label>
  );
}
