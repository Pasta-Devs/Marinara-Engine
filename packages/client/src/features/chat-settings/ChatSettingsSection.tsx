import { useEffect, useState, type CSSProperties, type ReactNode, type KeyboardEvent } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "../../lib/utils";
import { HelpTooltip } from "../../components/ui/HelpTooltip";
import { useUIStore } from "../../stores/ui.store";

interface ChatSettingsSectionProps {
  /** Stable id used to remember this section's expand/collapse state across reopens. */
  id?: string;
  label: string;
  icon?: ReactNode;
  count?: number;
  help?: string;
  style?: CSSProperties;
  initialOpen?: boolean;
  contentClassName?: string;
  children: ReactNode;
}

export function ChatSettingsSection({
  id,
  label,
  icon,
  count,
  help,
  style,
  initialOpen = false,
  contentClassName,
  children,
}: ChatSettingsSectionProps) {
  const rememberedOpen = useUIStore((s) => (id ? s.chatSettingsExpandedSections[id] : undefined));
  const setSectionExpanded = useUIStore((s) => s.setChatSettingsSectionExpanded);
  // Remembered state wins once it exists; otherwise fall back to initialOpen.
  const [open, setOpen] = useState(rememberedOpen ?? initialOpen);
  useEffect(() => {
    if (rememberedOpen === undefined && initialOpen) setOpen(true);
  }, [initialOpen, rememberedOpen]);
  const toggleOpen = () => {
    const next = !open;
    setOpen(next);
    if (id) setSectionExpanded(id, next);
  };
  const handleHeaderKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    toggleOpen();
  };

  return (
    <div data-chat-settings-section={id} className="border-b border-[var(--border)]" style={style}>
      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        data-testid={id ? `chat-settings-section-${id}` : undefined}
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
      {open && <div className={cn("px-4 pb-3", contentClassName ?? "pt-3")}>{children}</div>}
    </div>
  );
}
