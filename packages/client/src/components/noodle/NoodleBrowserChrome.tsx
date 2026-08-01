import { ChevronLeft, ChevronRight, Lock, RefreshCw, Search } from "lucide-react";

export function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function BrowserChrome({
  url = "https://noodle.local",
  mobileUrl = "noodle.local/home",
  badgeLabel = "Noodle",
}: {
  url?: string;
  mobileUrl?: string;
  badgeLabel?: string;
}) {
  return (
    <div className="hidden h-11 shrink-0 items-center gap-2 border-b border-[var(--noodle-divider)] bg-[var(--background)] px-3 @min-[1024px]:flex">
      <div className="hidden items-center gap-1.5 sm:flex" aria-hidden="true">
        <span className="h-2.5 w-2.5 rounded-full bg-[var(--noodle-accent)]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[var(--muted-foreground)]/35" />
        <span className="h-2.5 w-2.5 rounded-full bg-[var(--muted-foreground)]/25" />
      </div>
      <div className="hidden items-center gap-0.5 sm:flex" aria-hidden="true">
        <span className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--noodle-accent)] opacity-70">
          <ChevronLeft size={15} />
        </span>
        <span className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--noodle-accent)] opacity-50">
          <ChevronRight size={15} />
        </span>
        <span className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--noodle-accent)]">
          <RefreshCw size={14} />
        </span>
      </div>
      <div className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-full border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--card)] px-3 text-xs shadow-sm">
        <Lock size={13} className="hidden shrink-0 text-[var(--noodle-accent)] sm:block" />
        <Search size={14} className="shrink-0 text-[var(--noodle-accent)] sm:hidden" />
        <span className="truncate text-[var(--foreground)] sm:hidden">{mobileUrl}</span>
        <span className="hidden truncate text-[var(--foreground)] sm:inline">{url}</span>
        <span className="hidden rounded-full bg-[var(--noodle-accent)]/15 px-2 py-0.5 font-semibold text-[var(--noodle-accent)] sm:inline-flex">
          {badgeLabel}
        </span>
      </div>
    </div>
  );
}
