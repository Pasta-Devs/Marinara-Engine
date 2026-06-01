import { useEffect, useState } from "react";
import { cn } from "../../../../../shared/lib/utils";

type SelectOption = { value: string; label: string };

export function CompactSelect({
  value,
  onChange,
  options,
  title,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  options: SelectOption[];
  title?: string;
  className?: string;
}) {
  return (
    <select
      value={value}
      title={title}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "h-6 min-w-0 truncate rounded-md bg-[var(--secondary)] px-1 text-[0.625rem] ring-1 ring-[var(--border)] transition-colors hover:ring-amber-400/40 focus:outline-none focus:ring-2 focus:ring-[var(--ring)]",
        className,
      )}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

export function CompactNumber({
  value,
  onCommit,
  title,
  ariaLabel,
  prefix,
  suffix,
  min,
  max,
}: {
  value: number;
  onCommit: (v: number) => void;
  title?: string;
  ariaLabel: string;
  prefix?: string;
  suffix?: string;
  min?: number;
  max?: number;
}) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const commit = () => {
    const parsed = parseInt(draft, 10);
    if (Number.isNaN(parsed)) {
      setDraft(String(value));
      return;
    }
    let clamped = parsed;
    if (min !== undefined && clamped < min) clamped = min;
    if (max !== undefined && clamped > max) clamped = max;
    if (clamped !== value) {
      setDraft(String(clamped));
      onCommit(clamped);
    } else if (clamped !== parsed) {
      setDraft(String(clamped));
    }
  };

  return (
    <label
      className="flex h-6 items-center gap-px rounded-md bg-[var(--secondary)] px-1 text-[0.625rem] ring-1 ring-[var(--border)] transition-colors hover:ring-amber-400/40 focus-within:ring-2 focus-within:ring-[var(--ring)]"
      title={title}
    >
      {prefix && <span className="text-[var(--muted-foreground)]">{prefix}:</span>}
      <input
        type="number"
        aria-label={ariaLabel}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            (e.currentTarget as HTMLInputElement).blur();
          }
        }}
        min={min}
        max={max}
        className="w-8 bg-transparent text-right tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      {suffix && <span className="text-[var(--muted-foreground)]">{suffix}</span>}
    </label>
  );
}

export function MobileSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: SelectOption[];
}) {
  return (
    <label className="grid grid-cols-[5.75rem_minmax(0,1fr)] items-center gap-2 text-[0.6875rem]">
      <span className="text-[var(--muted-foreground)]">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full min-w-0 rounded-lg bg-[var(--secondary)] px-2 text-xs ring-1 ring-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function MobileNumber({
  label,
  value,
  onCommit,
  min,
  max,
  suffix,
}: {
  label: string;
  value: number;
  onCommit: (v: number) => void;
  min?: number;
  max?: number;
  suffix?: string;
}) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const commit = () => {
    const parsed = parseInt(draft, 10);
    if (Number.isNaN(parsed)) {
      setDraft(String(value));
      return;
    }

    let clamped = parsed;
    if (min !== undefined && clamped < min) clamped = min;
    if (max !== undefined && clamped > max) clamped = max;
    setDraft(String(clamped));
    if (clamped !== value) {
      onCommit(clamped);
    }
  };

  return (
    <label className="grid grid-cols-[5.75rem_minmax(0,1fr)] items-center gap-2 text-[0.6875rem]">
      <span className="text-[var(--muted-foreground)]">{label}</span>
      <span className="flex h-9 min-w-0 items-center rounded-lg bg-[var(--secondary)] px-2 ring-1 ring-[var(--border)] focus-within:ring-2 focus-within:ring-[var(--ring)]">
        <input
          type="number"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              (e.currentTarget as HTMLInputElement).blur();
            }
          }}
          min={min}
          max={max}
          className="w-full min-w-0 bg-transparent text-right text-xs tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        {suffix && <span className="pl-1 text-xs text-[var(--muted-foreground)]">{suffix}</span>}
      </span>
    </label>
  );
}
