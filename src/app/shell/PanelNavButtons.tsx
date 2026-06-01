import { BookOpen, Bot, Compass, FileText, Link, Settings, Sparkles, User, Users } from "lucide-react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { useAgentStore } from "../../shared/stores/agent.store";
import { useUIStore } from "../../shared/stores/ui.store";
import { cn } from "../../shared/lib/utils";

export const RIGHT_PANEL_BUTTONS = [
  {
    panel: "discover" as const,
    icon: Compass,
    label: "Discover",
    activeClass: "text-teal-500",
    hoverClass: "hover:text-teal-300",
    underlineClass: "from-teal-500 to-cyan-500",
  },
  {
    panel: "bot-browser" as const,
    icon: Bot,
    label: "Browser",
    activeClass: "text-cyan-500",
    hoverClass: "hover:text-cyan-300",
    underlineClass: "from-cyan-500 to-blue-500",
  },
  {
    panel: "characters" as const,
    icon: Users,
    label: "Characters",
    activeClass: "text-rose-500",
    hoverClass: "hover:text-rose-300",
    underlineClass: "from-pink-500 to-rose-500",
  },
  {
    panel: "lorebooks" as const,
    icon: BookOpen,
    label: "Lorebooks",
    activeClass: "text-amber-500",
    hoverClass: "hover:text-amber-300",
    underlineClass: "from-amber-500 to-orange-500",
  },
  {
    panel: "presets" as const,
    icon: FileText,
    label: "Presets",
    activeClass: "text-violet-500",
    hoverClass: "hover:text-violet-300",
    underlineClass: "from-purple-500 to-violet-500",
  },
  {
    panel: "connections" as const,
    icon: Link,
    label: "Connections",
    activeClass: "text-sky-500",
    hoverClass: "hover:text-sky-300",
    underlineClass: "from-sky-500 to-blue-500",
  },
  {
    panel: "agents" as const,
    icon: Sparkles,
    label: "Agents",
    activeClass: "text-pink-500",
    hoverClass: "hover:text-pink-300",
    underlineClass: "from-pink-500 to-purple-500",
  },
  {
    panel: "personas" as const,
    icon: User,
    label: "Personas",
    activeClass: "text-emerald-500",
    hoverClass: "hover:text-emerald-300",
    underlineClass: "from-emerald-500 to-teal-500",
  },
  {
    panel: "settings" as const,
    icon: Settings,
    label: "Settings",
    activeClass: "text-zinc-50",
    hoverClass: "hover:text-zinc-50",
    underlineClass: "from-zinc-50 to-zinc-300",
  },
] as const;

function stopTitlebarDrag(event: ReactMouseEvent<HTMLElement>) {
  event.stopPropagation();
}

export function PanelNavButtons({ className }: { className?: string }) {
  const toggleRightPanel = useUIStore((s) => s.toggleRightPanel);
  const rightPanel = useUIStore((s) => s.rightPanel);
  const rightPanelOpen = useUIStore((s) => s.rightPanelOpen);
  const failedAgentCount = useAgentStore((s) => s.failedAgentTypes.length);

  return (
    <nav
      data-tour="panel-buttons"
      aria-label="Panel navigation"
      className={cn("mari-panel-nav flex shrink-0 items-center gap-0.5", className)}
      onMouseDown={stopTitlebarDrag}
      onDoubleClick={stopTitlebarDrag}
    >
      {RIGHT_PANEL_BUTTONS.map(({ panel, icon: Icon, label, activeClass, hoverClass, underlineClass }) => {
        const isActive = rightPanelOpen && rightPanel === panel;
        return (
          <button
            key={panel}
            type="button"
            onClick={() => toggleRightPanel(panel)}
            onMouseDown={stopTitlebarDrag}
            onDoubleClick={stopTitlebarDrag}
            className={cn(
              "mari-titlebar-action relative rounded-md p-1.5 transition-all duration-200",
              isActive
                ? cn(activeClass, "mari-titlebar-action-active [&>svg]:stroke-[2.3]")
                : cn("text-[var(--muted-foreground)]", hoverClass),
            )}
            title={label}
            aria-label={label}
            aria-pressed={isActive}
          >
            <Icon size="0.875rem" />
            {isActive && (
              <span
                className={cn(
                  "absolute -bottom-0.5 left-1/2 h-0.5 w-3 -translate-x-1/2 rounded-full bg-gradient-to-r",
                  underlineClass,
                )}
              />
            )}
            {panel === "agents" && failedAgentCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-amber-500 ring-1 ring-[var(--card)]" />
            )}
          </button>
        );
      })}
    </nav>
  );
}
