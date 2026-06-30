// ──────────────────────────────────────────────
// Layout: Top Bar (polished, with hover glow)
// ──────────────────────────────────────────────
import { MessageSquareText, Home, Settings, Link, BookOpen, Users, Sparkles, FileText, User, Bot } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useUIStore } from "../../stores/ui.store";
import { useChatStore } from "../../stores/chat.store";
import { cn } from "../../lib/utils";
import { SpotifyMiniPlayer } from "../spotify/SpotifyMiniPlayer";
import { YouTubePlayer } from "../chat/YouTubePlayer";
import { LocalMusicPlayer } from "../chat/LocalMusicPlayer";

type RightPanelButtonPanel = "lorebooks" | "presets" | "connections" | "agents" | "personas";

type RightPanelButtonConfig = {
  panel: RightPanelButtonPanel;
  icon: LucideIcon;
  label: string;
  gradientClass: string;
  underlineClass?: string;
};

const RIGHT_PANEL_BUTTONS: readonly RightPanelButtonConfig[] = [
  {
    panel: "lorebooks" as const,
    icon: BookOpen,
    label: "Lorebooks",
    gradientClass: "mari-panel-gradient--lorebooks",
  },
  {
    panel: "presets" as const,
    icon: FileText,
    label: "Presets",
    gradientClass: "mari-panel-gradient--presets",
    underlineClass: "mari-panel-gradient-surface mari-panel-gradient--presets",
  },
  {
    panel: "connections" as const,
    icon: Link,
    label: "Connections",
    gradientClass: "mari-panel-gradient--connections",
  },
  {
    panel: "agents" as const,
    icon: Sparkles,
    label: "Agents",
    gradientClass: "mari-panel-gradient--agents",
  },
  {
    panel: "personas" as const,
    icon: User,
    label: "Personas",
    gradientClass: "mari-panel-gradient--personas",
  },
] as const;

const SPOTIFY_TOPBAR_MIN_WIDTH = 320;
const SPOTIFY_TOPBAR_MIN_WIDTH_WITH_VOLUME = 416;
const SPOTIFY_TOPBAR_LAYOUT_BUFFER = 32;
const TOPBAR_BUTTON_CLASS =
  "mari-topbar-action relative flex h-8 w-8 items-center justify-center rounded-lg p-0 transition-all hover:bg-[var(--accent)] active:scale-95 max-sm:h-7 max-sm:w-7";
const TOPBAR_PANEL_BUTTON_CLASS =
  "mari-topbar-action relative flex h-8 w-8 items-center justify-center rounded-lg p-0 transition-all duration-200 max-sm:h-7 max-sm:w-7";
const TOPBAR_ACTIVE_BUTTON_CLASS = "bg-[var(--accent)] shadow-sm";
const TOPBAR_FORCE_HOVER_CLASS = "bg-[var(--accent)]";
const TOPBAR_ACCENT_ICON_CLASS = "mari-topbar-accent-icon mari-accent-animated";
const CHAT_TOPBAR_GRADIENT_ID = "mari-topbar-chats-gradient";

function isMobileTopbarNavigation() {
  return typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;
}

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
  const headerRef = useRef<HTMLElement | null>(null);
  const leftControlsRef = useRef<HTMLDivElement | null>(null);
  const rightNavRef = useRef<HTMLElement | null>(null);
  const [spotifyDesktopViewport, setSpotifyDesktopViewport] = useState(false);
  const [spotifyUseFloatingFallback, setSpotifyUseFloatingFallback] = useState(false);
  const [hoveredTopbarKey, setHoveredTopbarKey] = useState<string | null>(null);

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

  const isTopbarHovered = (key: string) => hoveredTopbarKey === key;

  const prepareMobileTopbarNavigation = useCallback(() => {
    if (!isMobileTopbarNavigation()) return;
    closeAllDetails();
  }, [closeAllDetails]);

  const handleSidebarClick = useCallback(() => {
    prepareMobileTopbarNavigation();
    toggleSidebar();
  }, [prepareMobileTopbarNavigation, toggleSidebar]);

  const handleRightPanelClick = useCallback(
    (panel: Parameters<typeof toggleRightPanel>[0]) => {
      prepareMobileTopbarNavigation();
      toggleRightPanel(panel);
    },
    [prepareMobileTopbarNavigation, toggleRightPanel],
  );

  const handleTopbarPointerOver = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.pointerType !== "mouse") return;
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest("[data-topbar-hover-key]");
    if (!(button instanceof HTMLElement) || !event.currentTarget.contains(button)) return;

    const nextKey = button.dataset.topbarHoverKey;
    if (!nextKey) return;
    setHoveredTopbarKey((current) => (current === nextKey ? current : nextKey));
  };

  const clearTopbarHover = useCallback(() => setHoveredTopbarKey(null), []);

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

  useEffect(() => {
    const clearWhenHidden = () => {
      if (document.visibilityState !== "visible") clearTopbarHover();
    };

    window.addEventListener("blur", clearTopbarHover);
    document.addEventListener("visibilitychange", clearWhenHidden);

    return () => {
      window.removeEventListener("blur", clearTopbarHover);
      document.removeEventListener("visibilitychange", clearWhenHidden);
    };
  }, [clearTopbarHover]);

  return (
    <header
      ref={headerRef}
      data-component="TopBar"
      onPointerLeave={clearTopbarHover}
      onPointerOver={handleTopbarPointerOver}
      className="mari-topbar relative z-10 flex h-12 flex-shrink-0 items-center justify-between bg-[var(--marinara-topbar-surface)] px-3 backdrop-blur-sm"
    >
      {/* Subtle bottom border only */}
      <div className="absolute inset-x-0 bottom-0 h-px bg-[var(--marinara-topbar-border)]" />

      {/* Left section: window controls + chat info */}
      <div className="mari-topbar-left flex min-w-0 flex-1 items-center gap-2">
        <div ref={leftControlsRef} className="mari-topbar-left-controls mari-rgb-icon-scope flex shrink-0 items-center gap-2">
          <button
            onClick={handleSidebarClick}
            data-tour="sidebar-toggle"
            data-topbar-hover-key="chats"
            className={cn(
              TOPBAR_BUTTON_CLASS,
              sidebarOpen
                ? cn(TOPBAR_ACTIVE_BUTTON_CLASS, "mari-topbar-chat-gradient-icon")
                : cn(
                    "mari-topbar-chat-gradient-hover text-[var(--muted-foreground)]",
                    isTopbarHovered("chats") && cn(TOPBAR_FORCE_HOVER_CLASS, "mari-topbar-chat-gradient-icon"),
                  ),
            )}
            title="Chats"
          >
            <MessageSquareText size={15} className={TOPBAR_ACCENT_ICON_CLASS}>
              <defs>
                <linearGradient
                  id={CHAT_TOPBAR_GRADIENT_ID}
                  x1="2"
                  x2="18"
                  y1="3"
                  y2="18"
                  gradientUnits="userSpaceOnUse"
                >
                  <stop offset="0%" stopColor="var(--mari-logo-cyan)" />
                  <stop offset="48%" stopColor="var(--mari-logo-orange)" />
                  <stop offset="100%" stopColor="var(--mari-logo-pink)" />
                </linearGradient>
              </defs>
            </MessageSquareText>
            {sidebarOpen && (
              <span className="mari-topbar-chat-gradient-underline absolute -bottom-0.5 left-1/2 h-0.5 w-3 -translate-x-1/2 rounded-full" />
            )}
          </button>

          <button
            onClick={() => {
              window.dispatchEvent(new Event("marinara:home-professor-mari-close"));
              setActiveChatId(null);
              closeAllDetails();
            }}
            data-topbar-hover-key="home"
            className={cn(
              TOPBAR_BUTTON_CLASS,
              isHomeActive
                ? TOPBAR_ACTIVE_BUTTON_CLASS
                : cn(
                    "text-[var(--muted-foreground)] hover:text-[var(--marinara-chat-chrome-button-text-hover)]",
                    isTopbarHovered("home") &&
                      cn(TOPBAR_FORCE_HOVER_CLASS, "text-[var(--marinara-chat-chrome-button-text-hover)]"),
                  ),
            )}
            title="Home"
          >
            <Home size={15} className={TOPBAR_ACCENT_ICON_CLASS} />
            {isHomeActive && (
              <span className="mari-topbar-active-underline absolute -bottom-0.5 left-1/2 h-0.5 w-3 -translate-x-1/2 rounded-full" />
            )}
          </button>
        </div>
        {spotifyDesktopViewport && <SpotifyMiniPlayer forceFloating={spotifyUseFloatingFallback} />}
        <YouTubePlayer />
        <LocalMusicPlayer />
      </div>

      {/* Right section - Panel toggles */}
      <nav
        ref={rightNavRef}
        data-tour="panel-buttons"
        aria-label="Panel navigation"
        className="mari-topbar-panel-nav mari-rgb-icon-scope flex shrink-0 items-center justify-end gap-0.5 rounded-xl p-1 max-sm:gap-0 max-sm:p-0.5"
      >
        {/* Browser */}
        <button
          onClick={() => handleRightPanelClick("bot-browser")}
          data-tour="panel-bot-browser"
          data-topbar-hover-key="browser"
          className={cn(
            TOPBAR_PANEL_BUTTON_CLASS,
            isBotBrowserActive
              ? cn(TOPBAR_ACTIVE_BUTTON_CLASS, "text-lime-300")
              : cn(
                  "text-[var(--muted-foreground)] hover:text-lime-300",
                  isTopbarHovered("browser") && cn(TOPBAR_FORCE_HOVER_CLASS, "text-lime-300"),
                ),
          )}
          title="Browser"
        >
          <Bot size={15} className={TOPBAR_ACCENT_ICON_CLASS} />
          {isBotBrowserActive && (
            <span className="absolute -bottom-0.5 left-1/2 h-0.5 w-3 -translate-x-1/2 rounded-full bg-gradient-to-r from-lime-400 via-green-500 to-cyan-500" />
          )}
        </button>

        <button
          onClick={() => handleRightPanelClick("characters")}
          data-tour="panel-characters"
          data-topbar-hover-key="characters"
          className={cn(
            TOPBAR_PANEL_BUTTON_CLASS,
            isCharactersPanelActive
              ? cn(TOPBAR_ACTIVE_BUTTON_CLASS, "text-rose-300")
              : cn(
                  "text-[var(--muted-foreground)] hover:text-rose-300",
                  isTopbarHovered("characters") && cn(TOPBAR_FORCE_HOVER_CLASS, "text-rose-300"),
                ),
          )}
          title="Characters"
        >
          <Users size={15} className={TOPBAR_ACCENT_ICON_CLASS} />
          {isCharactersPanelActive && (
            <span className="absolute -bottom-0.5 left-1/2 h-0.5 w-3 -translate-x-1/2 rounded-full bg-gradient-to-r from-pink-400 to-rose-500" />
          )}
        </button>

        {RIGHT_PANEL_BUTTONS.map(({ panel, icon: Icon, label, gradientClass, underlineClass }) => {
          const isActive = panelContextActive[panel];
          const isHovered = isTopbarHovered(panel);
          return (
            <button
              key={panel}
              onClick={() => handleRightPanelClick(panel)}
              data-tour={`panel-${panel}`}
              data-topbar-hover-key={panel}
              className={cn(
                TOPBAR_PANEL_BUTTON_CLASS,
                "mari-topbar-panel-icon",
                gradientClass,
                isHovered && cn(TOPBAR_FORCE_HOVER_CLASS, "mari-topbar-panel-icon--hovered"),
                isActive && cn(TOPBAR_ACTIVE_BUTTON_CLASS, "mari-topbar-panel-icon--active"),
              )}
              title={label}
            >
              <Icon size={15} className={TOPBAR_ACCENT_ICON_CLASS} />
              {isActive && (
                <span
                  className={cn(
                    "absolute -bottom-0.5 left-1/2 h-0.5 w-3 -translate-x-1/2 rounded-full",
                    underlineClass ?? cn("mari-panel-gradient-surface", gradientClass),
                  )}
                />
              )}
            </button>
          );
        })}

        {/* Settings */}
        <button
          onClick={() => handleRightPanelClick("settings")}
          data-tour="panel-settings"
          data-topbar-hover-key="settings"
          className={cn(
            TOPBAR_PANEL_BUTTON_CLASS,
            rightPanelOpen && rightPanel === "settings"
              ? cn(TOPBAR_ACTIVE_BUTTON_CLASS, "text-gray-300")
              : cn(
                  "text-[var(--muted-foreground)] hover:text-gray-300",
                  isTopbarHovered("settings") && cn(TOPBAR_FORCE_HOVER_CLASS, "text-gray-300"),
                ),
          )}
          title="Settings"
        >
          <Settings size={15} className={TOPBAR_ACCENT_ICON_CLASS} />
          {rightPanelOpen && rightPanel === "settings" && (
            <span className="absolute -bottom-0.5 left-1/2 h-0.5 w-3 -translate-x-1/2 rounded-full bg-gradient-to-r from-gray-400 to-gray-500" />
          )}
        </button>
      </nav>
    </header>
  );
}
