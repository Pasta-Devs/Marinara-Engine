// ──────────────────────────────────────────────
// Layout: Top Bar (polished, with hover glow)
// ──────────────────────────────────────────────
import { Home, Menu } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useUIStore } from "../../stores/ui.store";
import { useChatStore } from "../../stores/chat.store";
import { cn } from "../../lib/utils";
import { SpotifyMiniPlayer } from "../spotify/SpotifyMiniPlayer";
import { YouTubePlayer } from "../chat/YouTubePlayer";
import { LocalMusicPlayer } from "../chat/LocalMusicPlayer";
import { MusicDjUnavailablePlayer } from "../music/MusicDjUnavailablePlayer";
import { useInstalledCapabilityPackages } from "../../hooks/use-capability-packages";
import { useLocalizedUiText } from "../../localization/use-localized-ui-text";
import {
  PersonalExtensionContributionsMenu,
  PersonalExtensionTopbarButtons,
} from "./PersonalExtensionContributionsMenu";
import { useCharacters } from "../../hooks/use-characters";
import { ChatSidebar } from "./ChatSidebar";
import { CharactersPanel } from "../panels/CharactersPanel";

import "./TopBar.css";

const TOPBAR_PANEL_BUTTON_CLASS =
  "mari-topbar-action relative flex h-8 w-8 items-center justify-center rounded-lg p-0 transition-all duration-200 max-sm:h-7 max-sm:w-7";
const TOPBAR_ACTIVE_BUTTON_CLASS = "bg-[var(--accent)] shadow-sm";
const TOPBAR_FORCE_HOVER_CLASS = "bg-[var(--accent)]";
const TOPBAR_ACCENT_ICON_CLASS = "mari-topbar-accent-icon mari-accent-animated";
const TOPBAR_BUTTON_CLASS =
  "mari-topbar-action relative flex h-8 w-8 items-center justify-center rounded-lg p-0 transition-all hover:bg-[var(--accent)] active:scale-95 max-sm:h-7 max-sm:w-7";

const SPOTIFY_TOPBAR_MIN_WIDTH = 320;
const SPOTIFY_TOPBAR_MIN_WIDTH_WITH_VOLUME = 416;
const SPOTIFY_TOPBAR_LAYOUT_BUFFER = 32;

function isMobileTopbarNavigation() {
  return typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;
}

const REVERSE_MODE_MAP: Record<string, string> = {
  conversation: "CONVO",
  roleplay: "RP",
  game: "GM",
};

export function TopBar() {
  const localize = useLocalizedUiText();
  const toggleRightPanel = useUIStore((s) => s.toggleRightPanel);
  const rightPanelOpen = useUIStore((s) => s.rightPanelOpen);
  const activeChatId = useChatStore((s) => s.activeChatId);
  const setActiveChatId = useChatStore((s) => s.setActiveChatId);
  const activeChat = useChatStore((s) => s.activeChat);
  const closeAllDetails = useUIStore((s) => s.closeAllDetails);

  const characterDetailId = useUIStore((s) => s.characterDetailId);
  const characterLibraryOpen = useUIStore((s) => s.characterLibraryOpen);
  const activeModal = useUIStore((s) => s.modal);

  const headerRef = useRef<HTMLElement | null>(null);
  const [spotifyDesktopViewport, setSpotifyDesktopViewport] = useState(false);
  const [spotifyUseFloatingFallback, setSpotifyUseFloatingFallback] = useState(false);
  const [hoveredTopbarKey, setHoveredTopbarKey] = useState<string | null>(null);

  const { data: installedCapabilities = [], isLoading: installedCapabilitiesLoading } =
    useInstalledCapabilityPackages();
  const musicPlayerEnabled = useUIStore((s) => s.musicPlayerEnabled);
  const musicDjInstalled = installedCapabilities.some(
    (capability) => capability.id === "spotify" && capability.status === "active",
  );
  const showMusicDjUnavailablePlayer =
    spotifyDesktopViewport && musicPlayerEnabled && !installedCapabilitiesLoading && !musicDjInstalled;

  const isHomeActive = !activeChatId && !characterDetailId && !activeModal && !characterLibraryOpen;

  const isTopbarHovered = (key: string) => hoveredTopbarKey === key;

  // Popups state
  const [isCharacterPopupOpen, setIsCharacterPopupOpen] = useState(false);
  const [isChatPopupOpen, setIsChatPopupOpen] = useState(false);

  // Chat / Character lists
  const { data: rawCharactersData = [] } = useCharacters();
  const charactersData = rawCharactersData as Array<{ id: string; data?: any; avatarPath?: string | null }>;

  const currentCharacterId = activeChat?.characterIds?.[0];
  const currentCharacter = charactersData.find((c) => c.id === currentCharacterId);
  let currentCharacterName = "Select Character";
  try {
    if (currentCharacter) {
      const currentCharacterParsed =
        typeof currentCharacter.data === "string" ? JSON.parse(currentCharacter.data) : currentCharacter.data;
      currentCharacterName = currentCharacterParsed?.name ?? currentCharacterName;
    }
  } catch {
    // Ignore parse error
  }

  const currentChatModeStr = activeChat ? REVERSE_MODE_MAP[activeChat.mode] : "---";
  const currentChatName = activeChat?.name ?? "No Chat Active";

  const toggleCharacterPopup = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsChatPopupOpen(false);
    setIsCharacterPopupOpen((prev) => !prev);
  };

  const toggleChatPopup = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsCharacterPopupOpen(false);

    // If there is no active chat but we are toggling this, and we have a character selected
    // It implies we should launch the setup wizard for the user to make a new chat
    if (!activeChatId && currentCharacterId && !isChatPopupOpen) {
      useChatStore.getState().setShouldOpenWizard(true);
      useChatStore.getState().setShouldOpenWizardInShortcutMode(false);
      useChatStore.getState().setShouldOpenSettings(false);
    }

    setIsChatPopupOpen((prev) => !prev);
  };

  const closePopups = useCallback(() => {
    setIsCharacterPopupOpen(false);
    setIsChatPopupOpen(false);
  }, []);

  const prepareMobileTopbarNavigation = useCallback(() => {
    if (!isMobileTopbarNavigation()) return;
    closeAllDetails();
  }, [closeAllDetails]);

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

  const handleRightPanelClick = useCallback(
    (panel: Parameters<typeof toggleRightPanel>[0]) => {
      prepareMobileTopbarNavigation();
      toggleRightPanel(panel);
    },
    [prepareMobileTopbarNavigation, toggleRightPanel],
  );

  useEffect(() => {
    const handleDocumentClick = () => closePopups();
    document.addEventListener("click", handleDocumentClick);
    return () => document.removeEventListener("click", handleDocumentClick);
  }, [closePopups]);

  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;

    const measureSpotifyFit = () => {
      const desktop = window.matchMedia("(min-width: 768px)").matches;
      setSpotifyDesktopViewport(desktop);

      if (!desktop) {
        setSpotifyUseFloatingFallback(false);
        return;
      }

      const minPlayerWidth = window.matchMedia("(min-width: 1024px)").matches
        ? SPOTIFY_TOPBAR_MIN_WIDTH_WITH_VOLUME
        : SPOTIFY_TOPBAR_MIN_WIDTH;

      const rightNavWidth = 150; // approximate
      const leftNavWidth = 520; // approximate width of character and chat buttons

      const headerWidth = header.getBoundingClientRect().width;
      setSpotifyUseFloatingFallback(
        headerWidth < leftNavWidth + rightNavWidth + minPlayerWidth + SPOTIFY_TOPBAR_LAYOUT_BUFFER,
      );
    };

    measureSpotifyFit();

    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => measureSpotifyFit());
    observer?.observe(header);
    window.addEventListener("resize", measureSpotifyFit);

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measureSpotifyFit);
    };
  }, []);

  useEffect(() => {
    closePopups();
  }, [activeChatId, characterDetailId, activeModal, closePopups]);

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
      className="mari-topbar mari-new-top-bar"
    >
      <div
        className={cn("mari-new-backdrop", (isCharacterPopupOpen || isChatPopupOpen) && "active")}
        onClick={closePopups}
      />

      {/* Left controls: Home */}
      <div className="relative z-[999] flex shrink-0 items-center gap-2 pr-2 border-r border-[var(--border)]">
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
          title={localize("Home")}
        >
          <Home size={15} className={TOPBAR_ACCENT_ICON_CLASS} />
          {isHomeActive && (
            <span className="mari-topbar-active-underline absolute -bottom-0.5 left-1/2 h-0.5 w-3 -translate-x-1/2 rounded-full" />
          )}
        </button>
      </div>

      {/* Character Button */}
      <div
        className={cn("mari-new-top-bar-btn character-btn", isCharacterPopupOpen && "active")}
        onClick={toggleCharacterPopup}
      >
        <div className="mari-new-character-avatar">
          {currentCharacter?.avatarPath ? (
            <img src={currentCharacter.avatarPath} alt="" />
          ) : (
            <div className="mari-new-character-avatar-placeholder">
              {currentCharacter ? currentCharacterName.substring(0, 2).toUpperCase() : "---"}
            </div>
          )}
        </div>
        <div className="mari-new-btn-text-container">
          <span className="mari-new-truncated-text" title={currentCharacterName}>
            {currentCharacterName}
          </span>
        </div>

        {/* Character Popup */}
        <div
          className={cn("mari-new-popup", isCharacterPopupOpen && "active")}
          onClick={(e) => e.stopPropagation()}
          style={{ height: "600px", padding: 0, overflow: "hidden" }}
        >
          <CharactersPanel />
        </div>
      </div>

      {/* Chat Mode Button */}
      <div className={cn("mari-new-top-bar-btn chat-btn", isChatPopupOpen && "active")} onClick={toggleChatPopup}>
        <div className="mari-new-btn-text-container">
          <span className="mari-new-chat-mode-label">{currentChatModeStr}</span>
          <span className="mari-new-chat-separator">|</span>
          <span className="mari-new-truncated-text" title={currentChatName}>
            {currentChatName}
          </span>
        </div>

        {/* Chat Popup */}
        <div
          className={cn("mari-new-popup", isChatPopupOpen && "active")}
          onClick={(e) => e.stopPropagation()}
          style={{ height: "600px", padding: 0, overflow: "hidden" }}
        >
          <ChatSidebar characterFilterId={currentCharacterId} />
        </div>
      </div>

      <div className="relative z-[999] flex-1 flex justify-center min-w-0">
        {showMusicDjUnavailablePlayer ? (
          !spotifyUseFloatingFallback && <MusicDjUnavailablePlayer />
        ) : musicDjInstalled ? (
          <>
            {spotifyDesktopViewport && <SpotifyMiniPlayer forceFloating={spotifyUseFloatingFallback} />}
            <YouTubePlayer />
            <LocalMusicPlayer />
          </>
        ) : null}
      </div>

      {/* Right side icons */}
      <nav
        data-tour="panel-buttons"
        aria-label={localize("Panel navigation")}
        className="mari-topbar-panel-nav mari-rgb-icon-scope relative z-[999] flex shrink-0 items-center justify-end gap-0.5 rounded-xl p-1 max-sm:gap-0 max-sm:p-0.5 ml-auto"
      >
        <PersonalExtensionTopbarButtons />
        <PersonalExtensionContributionsMenu />

        <button
          onClick={() => {
            if (rightPanelOpen) {
              useUIStore.getState().closeRightPanel();
            } else {
              handleRightPanelClick("settings");
            }
          }}
          className={cn(
            TOPBAR_PANEL_BUTTON_CLASS,
            rightPanelOpen
              ? cn(TOPBAR_ACTIVE_BUTTON_CLASS, "text-[var(--primary)]")
              : "text-[var(--muted-foreground)] hover:text-[var(--primary)]",
          )}
          title={localize("Menu")}
        >
          <Menu size={20} />
        </button>
      </nav>
    </header>
  );
}
