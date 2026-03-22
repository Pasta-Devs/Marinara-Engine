// ──────────────────────────────────────────────
// Layout: Top Bar (polished, with hover glow)
// ──────────────────────────────────────────────
import { PanelLeft, Home, Settings, Link, BookOpen, Users, Sparkles, FileText, UserCircle } from "lucide-react";
import { useUIStore } from "../../stores/ui.store";
import { useChatStore } from "../../stores/chat.store";
import { cn } from "../../lib/utils";

const RIGHT_PANEL_BUTTONS = [
  { panel: "characters" as const, icon: Users, label: "Characters", color: "from-pink-400 to-rose-500" },
  { panel: "lorebooks" as const, icon: BookOpen, label: "Lorebooks", color: "from-amber-400 to-orange-500" },
  { panel: "presets" as const, icon: FileText, label: "Presets", color: "from-purple-400 to-violet-500" },
  { panel: "connections" as const, icon: Link, label: "Connections", color: "from-sky-400 to-blue-500" },
  { panel: "agents" as const, icon: Sparkles, label: "Agents", color: "from-pink-300 to-purple-400" },
  { panel: "personas" as const, icon: UserCircle, label: "Personas", color: "from-emerald-400 to-teal-500" },
  { panel: "settings" as const, icon: Settings, label: "Settings", color: "from-gray-400 to-gray-500" },
] as const;

export function TopBar() {
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const toggleRightPanel = useUIStore((s) => s.toggleRightPanel);
  const rightPanel = useUIStore((s) => s.rightPanel);
  const rightPanelOpen = useUIStore((s) => s.rightPanelOpen);
  const setActiveChatId = useChatStore((s) => s.setActiveChatId);
  const closeAllDetails = useUIStore((s) => s.closeAllDetails);

  return (
    <header className="relative z-10 flex h-12 flex-shrink-0 items-center justify-between bg-[var(--card)]/80 px-3 backdrop-blur-sm">
      {/* Subtle bottom border only */}
      <div className="absolute inset-x-0 bottom-0 h-px bg-[var(--border)]/30" />

      {/* Left section: window controls + chat info */}
      <div className="flex items-center gap-2">
        <button
          onClick={toggleSidebar}
          data-tour="sidebar-toggle"
          className="rounded-lg p-2 text-[var(--muted-foreground)] transition-all hover:bg-[var(--accent)] hover:text-[var(--y2k-pink)] active:scale-95"
          title="Chats"
        >
          <PanelLeft size="1.125rem" />
        </button>

        <button
          onClick={() => {
            setActiveChatId(null);
            closeAllDetails();
          }}
          className="rounded-lg p-2 text-[var(--muted-foreground)] transition-all hover:bg-[var(--accent)] hover:text-[var(--y2k-pink)] active:scale-95"
          title="Home"
        >
          <Home size="1.125rem" />
        </button>
      </div>

      {/* Right section - Panel toggles */}
      <div data-tour="panel-buttons" className="flex items-center gap-0.5 rounded-xl p-1 max-sm:gap-0 max-sm:p-0.5">
        {RIGHT_PANEL_BUTTONS.map(({ panel, icon: Icon, label, color }) => {
          const isActive = rightPanelOpen && rightPanel === panel;
          return (
            <button
              key={panel}
              onClick={() => toggleRightPanel(panel)}
              className={cn(
                "relative rounded-lg p-2 transition-all duration-200 max-sm:p-1.5",
                isActive
                  ? "bg-[var(--accent)] text-[var(--y2k-pink)] shadow-sm shadow-pink-500/10"
                  : "text-[var(--muted-foreground)] hover:text-[var(--y2k-pink)]",
              )}
              title={label}
            >
              <Icon size="0.9375rem" />
              {isActive && (
                <span
                  className={cn(
                    "absolute -bottom-0.5 left-1/2 h-0.5 w-3 -translate-x-1/2 rounded-full bg-gradient-to-r",
                    color,
                  )}
                />
              )}
            </button>
          );
        })}
      </div>
    </header>
  );
}
