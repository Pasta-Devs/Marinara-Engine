import { useState, type CSSProperties, type ReactNode, type KeyboardEvent } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "../../lib/utils";
import { HelpTooltip } from "../../components/ui/HelpTooltip";

interface ChatSettingsSectionProps {
  label: string;
  icon?: ReactNode;
  count?: number;
  help?: string;
  style?: CSSProperties;
  children: ReactNode;
}

export function ChatSettingsSection({ label, icon, count, help, style, children }: ChatSettingsSectionProps) {
  const [open, setOpen] = useState(false);
  const toggleOpen = () => setOpen((o) => !o);
  const handleHeaderKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    toggleOpen();
  };

  return (
    <div className="border-b border-[var(--border)]" style={style}>
      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={toggleOpen}
        onKeyDown={handleHeaderKeyDown}
        className="flex w-full items-center gap-2 px-4 py-3 text-left transition-colors hover:bg-[var(--accent)]/50"
      >
        {icon && <span className="text-[var(--muted-foreground)]">{icon}</span>}
        <span className="flex-1 text-xs font-semibold">{label}</span>
        {count != null && count > 0 && (
          <span className="rounded-full bg-[var(--primary)]/15 px-1.5 py-0.5 text-[0.625rem] font-medium text-[var(--primary)]">
            {count}
          </span>
        )}
        {help && (
          <span onClick={(e) => e.stopPropagation()}>
            <HelpTooltip text={help} side="left" />
          </span>
        )}
        <ChevronDown
          size="0.75rem"
          className={cn("text-[var(--muted-foreground)] transition-transform", open && "rotate-180")}
        />
      </div>
      {open && <div className="px-4 pb-3 pt-3">{children}</div>}
    </div>
  );
}
