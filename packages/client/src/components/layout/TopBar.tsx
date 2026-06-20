// ──────────────────────────────────────────────
// Layout: Top Bar (polished, with hover glow)
// ──────────────────────────────────────────────
import { MessageSquareText, Home, Settings, Link, BookOpen, Users, Sparkles, FileText, User, Bot } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useUIStore } from "../../stores/ui.store";
import { useChatStore } from "../../stores/chat.store";
import { useAgentStore } from "../../stores/agent.store";
import { cn } from "../../lib/utils";
import { SpotifyMiniPlayer } from "../spotify/SpotifyMiniPlayer";
import { YouTubePlayer } from "../chat/YouTubePlayer";

type RightPanelButtonPanel = "lorebooks" | "presets" | "connections" | "agents" | "personas";

type RightPanelButtonConfig = {
  panel: RightPanelButtonPanel;
  icon: LucideIcon;
  label: string;
  color: string;
  iconColor: string;
  hoverColor: string;
  underlineClass?: string;
};

const RIGHT_PANEL_BUTTONS: readonly RightPanelButtonConfig[] = [
  {
    panel: "lorebooks" as const,
    icon: BookOpen,
    label: "Lorebooks",
    color: "from-amber-400 to-orange-500",
    iconColor: "text-amber-300",
    hoverColor: "hover:text-amber-300",
  },
  {
    panel: "presets" as const,
    icon: FileText,
    label: "Presets",
    color: "",
    iconColor: "mari-panel-gradient--presets text-[var(--mari-panel-gradient-start)]",
    hoverColor: "mari-panel-gradient--presets hover:text-[var(--mari-panel-gradient-start)]",
    underlineClass: "mari-panel-gradient-surface mari-panel-gradient--presets",
  },
  {
    panel: "connections" as const,
    icon: Link,
    label: "Connections",
    color: "from-sky-400 to-blue-500",
    iconColor: "text-sky-300",
    hoverColor: "hover:text-sky-300",
  },
  {
    panel: "agents" as const,
    icon: Sparkles,
    label: "Agents",
    color: "from-violet-400 to-purple-500",
    iconColor: "text-violet-300",
    hoverColor: "hover:text-violet-300",
  },
  {
    panel: "personas" as const,
    icon: User,
    label: "Personas",
    color: "from-emerald-400 to-teal-500",
    iconColor: "text-emerald-300",
    hoverColor: "hover:text-emerald-300",
  },
] as const;

const SPOTIFY_TOPBAR_MIN_WIDTH = 320;
const SPOTIFY_TOPBAR_MIN_WIDTH_WITH_VOLUME = 416;
const SPOTIFY_TOPBAR_LAYOUT_BUFFER = 32;
const TOPBAR_BUTTON_CLASS = "relative rounded-lg p-2 transition-all hover:bg-[var(--accent)] active:scale-95";
const TOPBAR_PANEL_BUTTON_CLASS = "relative rounded-lg p-2 transition-all duration-200 max-sm:p-1.5";
const TOPBAR_ACTIVE_BUTTON_CLASS = "bg-[var(--accent)] shadow-sm";

export function TopBar() {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const toggleRightPanel = useUIStore((s) => s.toggleRightPanel);
  const rightPanel = useUIStore((s) => s.rightPanel);
  const rightPanelOpen = useUIStore((s) => s.rightPanelOpen);
  const activeChatId = useChatStore((s) => s.activeChatId);
  const setActiveChatId = useChatStore((s) => s.setActiveChatId);
  const closeAllDetails = useUIStore((s) => s.closeAllDetails);
  const characterDetailId = useUIStore((s) => s.characterDetailId);
  const lorebookDetailId = useUIStore((s) => s.lorebookDetailId);
  const presetDetailId = useUIStore((s) => s.presetDetailId);
  const connectionDetailId = useUIStore((s) => s.connectionDetailId);
  const agentDetailId = useUIStore((s) => s.agentDetailId);
  const toolDetailId = useUIStore((s) => s.toolDetailId);
  const personaDetailId = useUIStore((s) => s.personaDetailId);
  const regexDetailId = useUIStore((s) => s.regexDetailId);
  const botBrowserOpen = useUIStore((s) => s.botBrowserOpen);
  const gameAssetsBrowserOpen = useUIStore((s) => s.gameAssetsBrowserOpen);
  const characterLibraryOpen = useUIStore((s) => s.characterLibraryOpen);
  const failedAgentCount = useAgentStore((s) => s.failedAgentTypes.length);
  const headerRef = useRef<HTMLElement | null>(null);
  const leftControlsRef = useRef<HTMLDivElement | null>(null);
  const rightNavRef = useRef<HTMLElement | null>(null);
  const [spotifyDesktopViewport, setSpotifyDesktopViewport] = useState(false);
  const [spotifyUseFloatingFallback, setSpotifyUseFloatingFallback] = useState(false);

  const isBotBrowserActive = (rightPanelOpen && rightPanel === "bot-browser") || botBrowserOpen;
  const isCharactersPanelActive =
    (rightPanelOpen && rightPanel === "characters") || Boolean(characterDetailId) || characterLibraryOpen;
  const panelContextActive: Record<RightPanelButtonPanel, boolean> = {
    lorebooks: (rightPanelOpen && rightPanel === "lorebooks") || Boolean(lorebookDetailId),
    presets:
      (rightPanelOpen && rightPanel === "presets") ||
      Boolean(presetDetailId) ||
      Boolean(regexDetailId) ||
      Boolean(toolDetailId),
    connections: (rightPanelOpen && rightPanel === "connections") || Boolean(connectionDetailId),
    agents: (rightPanelOpen && rightPanel === "agents") || Boolean(agentDetailId),
    personas: (rightPanelOpen && rightPanel === "personas") || Boolean(personaDetailId),
  };
  const isHomeActive =
    !activeChatId &&
    !characterDetailId &&
    !lorebookDetailId &&
    !presetDetailId &&
    !connectionDetailId &&
    !agentDetailId &&
    !toolDetailId &&
    !personaDetailId &&
    !regexDetailId &&
    !botBrowserOpen &&
    !gameAssetsBrowserOpen &&
    !characterLibraryOpen;

  useEffect(() => {
    const header = headerRef.current;
    const leftControls = leftControlsRef.current;
    const rightNav = rightNavRef.current;
    if (!header || !leftControls || !rightNav) return;

    const measureSpotifyFit = () => {
      const desktop = window.matchMedia("(min-width: 768px)").matches;
      setSpotifyDesktopViewport(desktop);

      if (!desktop) {
        setSpotifyUseFloatingFallback(false);
        return;
      }

      const headerWidth = header.getBoundingClientRect().width;
      const leftControlsWidth = leftControls.getBoundingClientRect().width;
      const rightNavWidth = rightNav.getBoundingClientRect().width;
      const minPlayerWidth = window.matchMedia("(min-width: 1024px)").matches
        ? SPOTIFY_TOPBAR_MIN_WIDTH_WITH_VOLUME
        : SPOTIFY_TOPBAR_MIN_WIDTH;

      setSpotifyUseFloatingFallback(
        headerWidth < leftControlsWidth + rightNavWidth + minPlayerWidth + SPOTIFY_TOPBAR_LAYOUT_BUFFER,
      );
    };

    measureSpotifyFit();

    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => {
            measureSpotifyFit();
          });
    observer?.observe(header);
    observer?.observe(leftControls);
    observer?.observe(rightNav);
    window.addEventListener("resize", measureSpotifyFit);

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measureSpotifyFit);
    };
  }, []);

  return (
    <header
      ref={headerRef}
      data-component="TopBar"
      className="mari-topbar relative z-10 flex h-12 flex-shrink-0 items-center justify-between bg-[var(--marinara-topbar-surface)] px-3 backdrop-blur-sm"
    >
      {/* Subtle bottom border only */}
      <div className="absolute inset-x-0 bottom-0 h-px bg-[var(--marinara-topbar-border)]" />

      {/* Left section: window controls + chat info */}
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <div ref={leftControlsRef} className="mari-rgb-icon-scope flex shrink-0 items-center gap-2">
          <button
            onClick={toggleSidebar}
            data-tour="sidebar-toggle"
            className={cn(
              TOPBAR_BUTTON_CLASS,
              sidebarOpen
                ? cn(TOPBAR_ACTIVE_BUTTON_CLASS, "mari-topbar-chat-cycle")
                : "text-[var(--muted-foreground)] hover:text-cyan-300",
            )}
            title="Chats"
          >
            <MessageSquareText size="0.9375rem" />
            {sidebarOpen && (
              <span className="mari-topbar-chat-cycle-underline absolute -bottom-0.5 left-1/2 h-0.5 w-3 -translate-x-1/2 rounded-full" />
            )}
          </button>

          <button
            onClick={() => {
              window.dispatchEvent(new Event("marinara:home-professor-mari-close"));
              setActiveChatId(null);
              closeAllDetails();
            }}
            className={cn(
              TOPBAR_BUTTON_CLASS,
              isHomeActive
                ? cn(TOPBAR_ACTIVE_BUTTON_CLASS, "mari-chrome-accent-icon mari-accent-animated")
                : "text-[var(--muted-foreground)] hover:text-[var(--marinara-chat-chrome-button-text-hover)]",
            )}
            title="Home"
          >
            <Home size="0.9375rem" />
            {isHomeActive && (
              <span className="mari-topbar-active-underline mari-accent-animated absolute -bottom-0.5 left-1/2 h-0.5 w-3 -translate-x-1/2 rounded-full" />
            )}
          </button>
        </div>
        {spotifyDesktopViewport && <SpotifyMiniPlayer forceFloating={spotifyUseFloatingFallback} />}
        <YouTubePlayer />
      </div>

      {/* Right section - Panel toggles */}
      <nav
        ref={rightNavRef}
        data-tour="panel-buttons"
        aria-label="Panel navigation"
        className="mari-rgb-icon-scope flex shrink-0 items-center justify-end gap-0.5 rounded-xl p-1 max-sm:gap-0 max-sm:p-0.5"
      >
        {/* Browser */}
        <button
          onClick={() => toggleRightPanel("bot-browser")}
          data-tour="panel-bot-browser"
          className={cn(
            TOPBAR_PANEL_BUTTON_CLASS,
            isBotBrowserActive
              ? cn(TOPBAR_ACTIVE_BUTTON_CLASS, "text-lime-300")
              : "text-[var(--muted-foreground)] hover:text-lime-300",
          )}
          title="Browser"
        >
          <Bot size="0.9375rem" />
          {isBotBrowserActive && (
            <span className="absolute -bottom-0.5 left-1/2 h-0.5 w-3 -translate-x-1/2 rounded-full bg-gradient-to-r from-lime-400 via-green-500 to-cyan-500" />
          )}
        </button>

        <button
          onClick={() => toggleRightPanel("characters")}
          data-tour="panel-characters"
          className={cn(
            TOPBAR_PANEL_BUTTON_CLASS,
            isCharactersPanelActive
              ? cn(TOPBAR_ACTIVE_BUTTON_CLASS, "text-rose-300")
              : "text-[var(--muted-foreground)] hover:text-rose-300",
          )}
          title="Characters"
        >
          <Users size="0.9375rem" />
          {isCharactersPanelActive && (
            <span className="absolute -bottom-0.5 left-1/2 h-0.5 w-3 -translate-x-1/2 rounded-full bg-gradient-to-r from-pink-400 to-rose-500" />
          )}
        </button>

        {RIGHT_PANEL_BUTTONS.map(({ panel, icon: Icon, label, color, iconColor, hoverColor, underlineClass }) => {
          const isActive = panelContextActive[panel];
          return (
            <button
              key={panel}
              onClick={() => toggleRightPanel(panel)}
              data-tour={`panel-${panel}`}
              className={cn(
                TOPBAR_PANEL_BUTTON_CLASS,
                isActive ? cn(TOPBAR_ACTIVE_BUTTON_CLASS, iconColor) : cn("text-[var(--muted-foreground)]", hoverColor),
              )}
              title={label}
            >
              <Icon size="0.9375rem" />
              {isActive && (
                <span
                  className={cn(
                    "absolute -bottom-0.5 left-1/2 h-0.5 w-3 -translate-x-1/2 rounded-full",
                    underlineClass ?? cn("bg-gradient-to-r", color),
                  )}
                />
              )}
              {panel === "agents" && failedAgentCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-amber-500 ring-1 ring-[var(--card)]" />
              )}
            </button>
          );
        })}

        {/* Settings */}
        <button
          onClick={() => toggleRightPanel("settings")}
          data-tour="panel-settings"
          className={cn(
            TOPBAR_PANEL_BUTTON_CLASS,
            rightPanelOpen && rightPanel === "settings"
              ? cn(TOPBAR_ACTIVE_BUTTON_CLASS, "text-gray-300")
              : "text-[var(--muted-foreground)] hover:text-gray-300",
          )}
          title="Settings"
        >
          <Settings size="0.9375rem" />
          {rightPanelOpen && rightPanel === "settings" && (
            <span className="absolute -bottom-0.5 left-1/2 h-0.5 w-3 -translate-x-1/2 rounded-full bg-gradient-to-r from-gray-400 to-gray-500" />
          )}
        </button>
      </nav>
    </header>
  );
}
