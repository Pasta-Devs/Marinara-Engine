// ──────────────────────────────────────────────
// Layout: Top Bar (polished, with hover glow)
// ──────────────────────────────────────────────
import { MessageSquareText, Home, Settings, Link, BookOpen, Users, Sparkles, FileText, User, Bot } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useUIStore } from "../../stores/ui.store";
import { useChatStore } from "../../stores/chat.store";
import { useAgentStore } from "../../stores/agent.store";
import { cn } from "../../lib/utils";
import { SpotifyMiniPlayer } from "../spotify/SpotifyMiniPlayer";
import { YouTubePlayer } from "../chat/YouTubePlayer";

const RIGHT_PANEL_BUTTONS = [
  { panel: "lorebooks" as const, icon: BookOpen, label: "Lorebooks", color: "from-amber-400 to-orange-500" },
  { panel: "presets" as const, icon: FileText, label: "Presets", color: "from-purple-400 to-violet-500" },
  { panel: "connections" as const, icon: Link, label: "Connections", color: "from-sky-400 to-blue-500" },
  { panel: "agents" as const, icon: Sparkles, label: "Agents", color: "from-violet-400 to-purple-500" },
  { panel: "personas" as const, icon: User, label: "Personas", color: "from-emerald-400 to-teal-500" },
] as const;

const SPOTIFY_TOPBAR_MIN_WIDTH = 320;
const SPOTIFY_TOPBAR_MIN_WIDTH_WITH_VOLUME = 416;
const SPOTIFY_TOPBAR_LAYOUT_BUFFER = 32;

export function TopBar() {
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const toggleRightPanel = useUIStore((s) => s.toggleRightPanel);
  const rightPanel = useUIStore((s) => s.rightPanel);
  const rightPanelOpen = useUIStore((s) => s.rightPanelOpen);
  const setActiveChatId = useChatStore((s) => s.setActiveChatId);
  const closeAllDetails = useUIStore((s) => s.closeAllDetails);
  const failedAgentCount = useAgentStore((s) => s.failedAgentTypes.length);
  const headerRef = useRef<HTMLElement | null>(null);
  const leftControlsRef = useRef<HTMLDivElement | null>(null);
  const rightNavRef = useRef<HTMLElement | null>(null);
  const [spotifyDesktopViewport, setSpotifyDesktopViewport] = useState(false);
  const [spotifyUseFloatingFallback, setSpotifyUseFloatingFallback] = useState(false);

  const isBotBrowserActive = rightPanelOpen && rightPanel === "bot-browser";
  const isCharactersPanelActive = rightPanelOpen && rightPanel === "characters";

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
        <div ref={leftControlsRef} className="flex shrink-0 items-center gap-2">
          <button
            onClick={toggleSidebar}
            data-tour="sidebar-toggle"
            className="rounded-lg p-2 text-[var(--muted-foreground)] transition-all hover:bg-[var(--accent)] hover:text-[var(--primary)] active:scale-95"
            title="Chats"
          >
            <MessageSquareText size="0.9375rem" />
          </button>

          <button
            onClick={() => {
              window.dispatchEvent(new Event("marinara:home-professor-mari-close"));
              setActiveChatId(null);
              closeAllDetails();
            }}
            className="rounded-lg p-2 text-[var(--muted-foreground)] transition-all hover:bg-[var(--accent)] hover:text-[var(--primary)] active:scale-95"
            title="Home"
          >
            <Home size="0.9375rem" />
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
        className="flex shrink-0 items-center justify-end gap-0.5 rounded-xl p-1 max-sm:gap-0 max-sm:p-0.5"
      >
        {/* Browser */}
        <button
          onClick={() => toggleRightPanel("bot-browser")}
          data-tour="panel-bot-browser"
          className={cn(
            "relative rounded-lg p-2 transition-all duration-200 max-sm:p-1.5",
            isBotBrowserActive
              ? "bg-[var(--accent)] text-[var(--primary)] shadow-sm"
              : "text-[var(--muted-foreground)] hover:text-[var(--primary)]",
          )}
          title="Browser"
        >
          <Bot size="0.9375rem" />
          {isBotBrowserActive && (
            <span className="absolute -bottom-0.5 left-1/2 h-0.5 w-3 -translate-x-1/2 rounded-full bg-gradient-to-r from-cyan-400 to-blue-500" />
          )}
        </button>

        <button
          onClick={() => toggleRightPanel("characters")}
          data-tour="panel-characters"
          className={cn(
            "relative rounded-lg p-2 transition-all duration-200 max-sm:p-1.5",
            isCharactersPanelActive
              ? "bg-[var(--accent)] text-[var(--primary)] shadow-sm"
              : "text-[var(--muted-foreground)] hover:text-[var(--primary)]",
          )}
          title="Characters"
        >
          <Users size="0.9375rem" />
          {isCharactersPanelActive && (
            <span className="absolute -bottom-0.5 left-1/2 h-0.5 w-3 -translate-x-1/2 rounded-full bg-gradient-to-r from-pink-400 to-rose-500" />
          )}
        </button>

        {RIGHT_PANEL_BUTTONS.map(({ panel, icon: Icon, label, color }) => {
          const isActive = rightPanelOpen && rightPanel === panel;
          return (
            <button
              key={panel}
              onClick={() => toggleRightPanel(panel)}
              data-tour={`panel-${panel}`}
              className={cn(
                "relative rounded-lg p-2 transition-all duration-200 max-sm:p-1.5",
                isActive
                  ? "bg-[var(--accent)] text-[var(--primary)] shadow-sm"
                  : "text-[var(--muted-foreground)] hover:text-[var(--primary)]",
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
            "relative rounded-lg p-2 transition-all duration-200 max-sm:p-1.5",
            rightPanelOpen && rightPanel === "settings"
              ? "bg-[var(--accent)] text-[var(--primary)] shadow-sm"
              : "text-[var(--muted-foreground)] hover:text-[var(--primary)]",
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
