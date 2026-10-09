// ──────────────────────────────────────────────
// Layout: Top Bar (polished, with hover glow)
// ──────────────────────────────────────────────
import {
  MessageSquareText,
  Home,
  Settings,
  Link,
  BookOpen,
  Users,
  Sparkles,
  FileText,
  VenetianMask,
  Menu,
  Check,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useUIStore } from "../../stores/ui.store";
import { useChatStore } from "../../stores/chat.store";
import { cn } from "../../lib/utils";
import { SpotifyMiniPlayer } from "../spotify/SpotifyMiniPlayer";
import { YouTubePlayer } from "../chat/YouTubePlayer";
import { LocalMusicPlayer } from "../chat/LocalMusicPlayer";
import { useInstalledCapabilityPackages } from "../../hooks/use-capability-packages";
import { usePullToOpenOmnibar } from "../../hooks/use-pull-to-open-omnibar";
import { useMariEdgeGlow } from "../../hooks/use-mari-presence";
import type { MariEdgeGlow } from "../../lib/mari-presence-seen";
import type { PullTarget } from "../../lib/pull-to-open";
import { requestProfessorMariOpen } from "../../lib/professor-mari-open";
import { OmnibarPullDrop } from "./OmnibarPullDrop";
import { MariTopbarStatus } from "./MariTopbarStatus";
import { useLocalizedUiText } from "../../localization/use-localized-ui-text";
import {
  activatePersonalExtensionContribution,
  usePersonalExtensionContributions,
} from "../../lib/personal-extension-contributions";
import { PersonalExtensionContributionIcon } from "../extensions/PersonalExtensionContributionIcon";
import {
  PersonalExtensionContributionsMenu,
  PersonalExtensionTopbarButtons,
} from "./PersonalExtensionContributionsMenu";

// English source text for `localize()` - the lookup matches on the literal string, not the key.
const MARI_EDGE_GLOW_LABEL: Record<Exclude<MariEdgeGlow, null>, string> = {
  working: "Professor Mari is working",
  finished: "Professor Mari finished",
  approval: "Professor Mari needs your answer",
  error: "Professor Mari's last run failed",
};

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
    panel: "personas" as const,
    icon: VenetianMask,
    label: "Personas",
    gradientClass: "mari-panel-gradient--personas",
  },
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
] as const;

const SPOTIFY_TOPBAR_MIN_WIDTH = 320;
const SPOTIFY_TOPBAR_MIN_WIDTH_WITH_VOLUME = 416;
const SPOTIFY_TOPBAR_LAYOUT_BUFFER = 32;
const PHONE_TOPBAR_QUERY = "(max-width: 639px)";
const PHONE_OVERFLOW_HIDDEN_CLASS = "max-sm:hidden";
// UX-16: a touch screen gets 44 px top-bar buttons, the minimum touch target.
const TOPBAR_COARSE_TARGET_CLASS = "[@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:w-11";
const TOPBAR_BUTTON_CLASS = `mari-topbar-action relative flex h-8 w-8 items-center justify-center rounded-lg p-0 transition-all hover:bg-[var(--accent)] active:scale-95 ${TOPBAR_COARSE_TARGET_CLASS}`;
const TOPBAR_PANEL_BUTTON_CLASS = `mari-topbar-action relative flex h-8 w-8 items-center justify-center rounded-lg p-0 transition-all duration-200 ${TOPBAR_COARSE_TARGET_CLASS}`;
const TOPBAR_ACTIVE_BUTTON_CLASS = "bg-[var(--accent)] shadow-sm";
const TOPBAR_FORCE_HOVER_CLASS = "bg-[var(--accent)]";
const TOPBAR_ACCENT_ICON_CLASS = "mari-topbar-accent-icon mari-accent-animated";
const CHAT_TOPBAR_GRADIENT_ID = "mari-topbar-chats-gradient";
const HOME_LONG_PRESS_MS = 550;

export function TopBar({ mobileTopbarNavigation }: { mobileTopbarNavigation: boolean }) {
  const localize = useLocalizedUiText();
  const mariEdgeGlow = useMariEdgeGlow();
  const { contributions } = usePersonalExtensionContributions();
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const setOmnibarOpen = useUIStore((s) => s.setOmnibarOpen);
  const setSidebarOpen = useUIStore((s) => s.setSidebarOpen);
  const toggleRightPanel = useUIStore((s) => s.toggleRightPanel);
  const closeRightPanel = useUIStore((s) => s.closeRightPanel);
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
  const cardLibraryKind = useUIStore((s) => s.cardLibraryKind);
  const headerRef = useRef<HTMLElement | null>(null);
  const leftControlsRef = useRef<HTMLDivElement | null>(null);
  const rightNavRef = useRef<HTMLElement | null>(null);
  const homeLongPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressHomeClickRef = useRef(false);
  const [spotifyDesktopViewport, setSpotifyDesktopViewport] = useState(false);
  const [spotifyUseFloatingFallback, setSpotifyUseFloatingFallback] = useState(false);
  const [hoveredTopbarKey, setHoveredTopbarKey] = useState<string | null>(null);
  const { data: installedCapabilities = [] } = useInstalledCapabilityPackages();
  const musicDjInstalled = installedCapabilities.some(
    (capability) => capability.id === "spotify" && capability.status === "active",
  );

  const isCharactersPanelActive =
    (rightPanelOpen && rightPanel === "characters") ||
    Boolean(characterDetailId) ||
    (characterLibraryOpen && cardLibraryKind === "characters");
  const panelContextActive: Record<RightPanelButtonPanel, boolean> = {
    lorebooks: (rightPanelOpen && rightPanel === "lorebooks") || Boolean(lorebookDetailId),
    presets:
      (rightPanelOpen && rightPanel === "presets") ||
      Boolean(presetDetailId) ||
      Boolean(regexDetailId) ||
      Boolean(toolDetailId),
    connections: (rightPanelOpen && rightPanel === "connections") || Boolean(connectionDetailId),
    agents: (rightPanelOpen && rightPanel === "agents") || Boolean(agentDetailId),
    personas:
      (rightPanelOpen && rightPanel === "personas") ||
      Boolean(personaDetailId) ||
      (characterLibraryOpen && cardLibraryKind === "personas"),
  };
  const isMobileOverlayActive = mobileTopbarNavigation && (sidebarOpen || rightPanelOpen);
  const isHomeActive =
    !activeChatId &&
    !isMobileOverlayActive &&
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
  const phoneTopbar = usePhoneTopbar();

  const prepareMobileTopbarNavigation = useCallback(() => {
    if (!mobileTopbarNavigation) return;
    closeAllDetails();
  }, [closeAllDetails, mobileTopbarNavigation]);

  const handleSidebarClick = useCallback(() => {
    prepareMobileTopbarNavigation();
    toggleSidebar();
  }, [prepareMobileTopbarNavigation, toggleSidebar]);

  const handleOmnibarClick = useCallback(() => {
    prepareMobileTopbarNavigation();
    setOmnibarOpen(true);
  }, [prepareMobileTopbarNavigation, setOmnibarOpen]);

  const clearHomeLongPress = useCallback(() => {
    if (homeLongPressTimerRef.current !== null) {
      clearTimeout(homeLongPressTimerRef.current);
      homeLongPressTimerRef.current = null;
    }
  }, []);

  const handleHomePointerDown = useCallback(() => {
    clearHomeLongPress();
    suppressHomeClickRef.current = false;
    homeLongPressTimerRef.current = setTimeout(() => {
      homeLongPressTimerRef.current = null;
      suppressHomeClickRef.current = true;
      handleOmnibarClick();
    }, HOME_LONG_PRESS_MS);
  }, [clearHomeLongPress, handleOmnibarClick]);

  const handlePullOpen = useCallback(
    (target: PullTarget) => {
      if (target === "search") return handleOmnibarClick();
      // The same door as Home's "Ask Professor Mari": the omnibar, straight in Mari's pane. The open editor
      // stays open, because she arrives with what is on screen (M9).
      requestProfessorMariOpen();
    },
    [handleOmnibarClick],
  );

  const pull = usePullToOpenOmnibar({ onPullStart: clearHomeLongPress, onOpen: handlePullOpen });

  const handleRightPanelClick = useCallback(
    (panel: Parameters<typeof toggleRightPanel>[0]) => {
      prepareMobileTopbarNavigation();
      toggleRightPanel(panel);
    },
    [prepareMobileTopbarNavigation, toggleRightPanel],
  );

  const handleHomeClick = useCallback(() => {
    if (suppressHomeClickRef.current) {
      suppressHomeClickRef.current = false;
      return;
    }

    window.dispatchEvent(new Event("marinara:home-professor-mari-close"));
    setActiveChatId(null);
    closeAllDetails();
    if (!mobileTopbarNavigation) return;
    setSidebarOpen(false);
    closeRightPanel();
  }, [closeAllDetails, closeRightPanel, mobileTopbarNavigation, setActiveChatId, setSidebarOpen]);

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

  const overflowItems: TopbarOverflowItem[] = [
    {
      key: "characters",
      icon: <Users size={16} />,
      iconClassName: "mari-panel-gradient--characters text-[var(--mari-panel-gradient-start)]",
      label: localize("Characters"),
      active: isCharactersPanelActive,
      onSelect: () => handleRightPanelClick("characters"),
    },
    ...RIGHT_PANEL_BUTTONS.map(({ panel, icon: Icon, label, gradientClass }) => ({
      key: panel,
      icon: <Icon size={16} />,
      iconClassName: cn(gradientClass, "text-[var(--mari-panel-gradient-start)]"),
      label: localize(label),
      active: panelContextActive[panel],
      onSelect: () => handleRightPanelClick(panel),
    })),
    ...contributions
      .filter((contribution) => contribution.kind === "button" && (contribution.surface ?? "top-bar") === "top-bar")
      .slice(0, 2)
      .map((contribution) => ({
        key: `extension:${contribution.key}`,
        icon: <PersonalExtensionContributionIcon icon={contribution.icon} size={16} />,
        label: contribution.label,
        hint: contribution.extensionName,
        onSelect: () => activatePersonalExtensionContribution(contribution.key),
      })),
    {
      key: "settings",
      icon: <Settings size={16} />,
      iconClassName: "mari-panel-gradient--settings text-[var(--mari-panel-gradient-start)]",
      label: localize("Settings"),
      active: rightPanelOpen && rightPanel === "settings",
      onSelect: () => handleRightPanelClick("settings"),
    },
  ];

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
    return clearHomeLongPress;
  }, [clearHomeLongPress]);

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

  const chatsActive = sidebarOpen && (!mobileTopbarNavigation || !rightPanelOpen);
  const chatsButton = (
    <button
      key="chats"
      onClick={handleSidebarClick}
      aria-pressed={chatsActive}
      data-tour="sidebar-toggle"
      data-topbar-hover-key="chats"
      className={cn(
        TOPBAR_BUTTON_CLASS,
        chatsActive
          ? cn(TOPBAR_ACTIVE_BUTTON_CLASS, !mobileTopbarNavigation && "mari-topbar-chat-gradient-icon")
          : cn(
              "text-[var(--muted-foreground)]",
              !mobileTopbarNavigation && "mari-topbar-chat-gradient-hover",
              !mobileTopbarNavigation &&
                isTopbarHovered("chats") &&
                cn(TOPBAR_FORCE_HOVER_CLASS, "mari-topbar-chat-gradient-icon"),
            ),
      )}
      title={localize("Chats")}
      aria-label={localize("Chats")}
    >
      <MessageSquareText size={15} className={TOPBAR_ACCENT_ICON_CLASS}>
        <defs>
          <linearGradient id={CHAT_TOPBAR_GRADIENT_ID} x1="2" x2="18" y1="3" y2="18" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="var(--mari-logo-cyan)" />
            <stop offset="48%" stopColor="var(--mari-logo-orange)" />
            <stop offset="100%" stopColor="var(--mari-logo-pink)" />
          </linearGradient>
        </defs>
      </MessageSquareText>
      {chatsActive && (
        <span className="mari-topbar-chat-gradient-underline absolute -bottom-0.5 left-1/2 h-0.5 w-3 -translate-x-1/2 rounded-full" />
      )}
    </button>
  );

  const homeButton = (
    <button
      key="home"
      onClick={handleHomeClick}
      onPointerDown={handleHomePointerDown}
      onPointerUp={clearHomeLongPress}
      onPointerCancel={clearHomeLongPress}
      onPointerLeave={clearHomeLongPress}
      aria-pressed={isHomeActive}
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
      aria-label={localize("Home")}
    >
      <Home size={15} className={TOPBAR_ACCENT_ICON_CLASS} />
      {isHomeActive && (
        <span className="mari-topbar-active-underline absolute -bottom-0.5 left-1/2 h-0.5 w-3 -translate-x-1/2 rounded-full" />
      )}
    </button>
  );

  const header = (
    <header
      ref={headerRef}
      data-component="TopBar"
      {...pull.handlers}
      onPointerLeave={clearTopbarHover}
      onPointerOver={handleTopbarPointerOver}
      className={cn(
        "mari-topbar relative z-10 flex h-12 flex-shrink-0 items-center justify-between bg-[var(--marinara-topbar-surface)] px-3 backdrop-blur-sm",
        mobileTopbarNavigation ? "touch-none" : "select-none",
      )}
    >
      {/* Subtle bottom border only */}
      <div className="absolute inset-x-0 bottom-0 h-px bg-[var(--marinara-topbar-border)]" />
      {/* Mari is busy or has a result you have not seen: a thin line in her state colour (P2). */}
      {mariEdgeGlow ? (
        <span
          aria-hidden="true"
          data-component="TopBar.MariEdgeGlow"
          data-state={mariEdgeGlow}
          className="mari-topbar-edge-glow"
        />
      ) : null}
      {/* The line above is decorative - this is the only signal screen readers get for her state. */}
      <span aria-live="polite" className="sr-only">
        {mariEdgeGlow ? localize(MARI_EDGE_GLOW_LABEL[mariEdgeGlow]) : ""}
      </span>

      {/* Left section: window controls + chat info */}
      <div className="mari-topbar-left flex min-w-0 flex-1 items-center gap-2">
        <div
          ref={leftControlsRef}
          className="mari-topbar-left-controls mari-rgb-icon-scope flex shrink-0 items-center gap-2"
        >
          {mobileTopbarNavigation ? [homeButton, chatsButton] : [chatsButton, homeButton]}
        </div>
        {musicDjInstalled ? (
          <>
            {spotifyDesktopViewport && <SpotifyMiniPlayer forceFloating={spotifyUseFloatingFallback} />}
            <YouTubePlayer />
            <LocalMusicPlayer />
          </>
        ) : null}
        <MariTopbarStatus state={mariEdgeGlow} />
      </div>

      {/* Right section - Panel toggles */}
      <nav
        ref={rightNavRef}
        data-tour="panel-buttons"
        aria-label={localize("Panel navigation")}
        className="mari-topbar-panel-nav mari-rgb-icon-scope flex shrink-0 items-center justify-end gap-0.5 rounded-xl p-1 max-sm:gap-0 max-sm:p-0.5"
      >
        <button
          onClick={() => handleRightPanelClick("characters")}
          aria-pressed={isCharactersPanelActive}
          data-tour="panel-characters"
          data-topbar-hover-key="characters"
          className={cn(
            TOPBAR_PANEL_BUTTON_CLASS,
            PHONE_OVERFLOW_HIDDEN_CLASS,
            isCharactersPanelActive
              ? TOPBAR_ACTIVE_BUTTON_CLASS
              : cn(
                  "text-[var(--muted-foreground)] hover:text-[var(--marinara-chat-chrome-button-text-hover)]",
                  isTopbarHovered("characters") &&
                    cn(TOPBAR_FORCE_HOVER_CLASS, "text-[var(--marinara-chat-chrome-button-text-hover)]"),
                ),
          )}
          title={localize("Characters")}
        >
          <Users size={15} className={TOPBAR_ACCENT_ICON_CLASS} />
          {isCharactersPanelActive && (
            <span
              data-component="CharactersTopbarUnderline"
              className="mari-panel-gradient-surface mari-panel-gradient--characters absolute -bottom-0.5 left-1/2 h-0.5 w-3 -translate-x-1/2 rounded-full"
            />
          )}
        </button>

        {RIGHT_PANEL_BUTTONS.map(({ panel, icon: Icon, label, gradientClass, underlineClass }) => {
          const isActive = panelContextActive[panel];
          const isHovered = isTopbarHovered(panel);
          return (
            <button
              key={panel}
              onClick={() => handleRightPanelClick(panel)}
              aria-pressed={isActive}
              data-tour={`panel-${panel}`}
              data-topbar-hover-key={panel}
              className={cn(
                TOPBAR_PANEL_BUTTON_CLASS,
                "mari-topbar-panel-icon",
                PHONE_OVERFLOW_HIDDEN_CLASS,
                gradientClass,
                isHovered && cn(TOPBAR_FORCE_HOVER_CLASS, "mari-topbar-panel-icon--hovered"),
                isActive && cn(TOPBAR_ACTIVE_BUTTON_CLASS, "mari-topbar-panel-icon--active"),
              )}
              title={localize(label)}
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
          aria-pressed={rightPanelOpen && rightPanel === "settings"}
          className={cn(
            TOPBAR_PANEL_BUTTON_CLASS,
            PHONE_OVERFLOW_HIDDEN_CLASS,
            rightPanelOpen && rightPanel === "settings"
              ? cn(TOPBAR_ACTIVE_BUTTON_CLASS, "text-gray-300")
              : cn(
                  "text-[var(--muted-foreground)] hover:text-gray-300",
                  isTopbarHovered("settings") && cn(TOPBAR_FORCE_HOVER_CLASS, "text-gray-300"),
                ),
          )}
          title={localize("Settings")}
        >
          <Settings size={15} className={TOPBAR_ACCENT_ICON_CLASS} />
          {rightPanelOpen && rightPanel === "settings" && (
            <span className="absolute -bottom-0.5 left-1/2 h-0.5 w-3 -translate-x-1/2 rounded-full bg-gradient-to-r from-gray-400 to-gray-500" />
          )}
        </button>

        <PersonalExtensionTopbarButtons className={PHONE_OVERFLOW_HIDDEN_CLASS} />
        <PersonalExtensionContributionsMenu />
        <TopbarMoreMenu items={overflowItems} headerRef={headerRef} phoneTopbar={phoneTopbar} />
      </nav>
    </header>
  );

  return (
    <>
      {/* iOS safe area spacer — pushes TopBar below status bar on the opaque page backing; part of the pull area. */}
      <div
        {...pull.handlers}
        className={cn(
          "flex-shrink-0 md:hidden h-[env(safe-area-inset-top)] bg-[var(--marinara-page-backing,var(--background))]",
          mobileTopbarNavigation && "touch-none",
        )}
      />
      {header}
      {/* Phones pull with a finger, desktop drags with the mouse from empty bar space (M18). */}
      <OmnibarPullDrop visuals={pull.visuals} edgeGlow={mariEdgeGlow} />
    </>
  );
}

function subscribePhoneTopbar(onChange: () => void) {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {};
  const query = window.matchMedia(PHONE_TOPBAR_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function readPhoneTopbar() {
  return typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia(PHONE_TOPBAR_QUERY).matches
    : false;
}

function usePhoneTopbar() {
  return useSyncExternalStore(subscribePhoneTopbar, readPhoneTopbar, () => false);
}

type TopbarOverflowItem = {
  key: string;
  icon: ReactNode;
  iconClassName?: string;
  label: string;
  hint?: string;
  active?: boolean;
  onSelect: () => void;
};

function TopbarMoreMenu({
  items,
  headerRef,
  phoneTopbar,
}: {
  items: TopbarOverflowItem[];
  headerRef: RefObject<HTMLElement | null>;
  phoneTopbar: boolean;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [menuTop, setMenuTop] = useState(48);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const initialFocusRef = useRef<"first" | "last" | null>(null);
  const menuId = useId();
  const label = t("navigation.topbar.more");

  const close = useCallback((restoreFocus: boolean) => {
    setOpen(false);
    if (restoreFocus) requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);

  const openMenu = (focus: "first" | "last" | null) => {
    setMenuTop(Math.round(headerRef.current?.getBoundingClientRect().bottom ?? 48));
    initialFocusRef.current = focus;
    setOpen(true);
  };

  useEffect(() => {
    if (!phoneTopbar) setOpen(false);
  }, [phoneTopbar]);

  useEffect(() => {
    if (!open) return;
    const rows = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    const target = initialFocusRef.current;
    initialFocusRef.current = null;
    const activeRow = rows.find((row) => row.dataset.active === "true");
    (target === "last" ? rows.at(-1) : target === "first" ? rows[0] : (activeRow ?? rows[0]))?.focus();

    const closeOnOutsidePress = (event: PointerEvent) => {
      const node = event.target;
      if (!(node instanceof Node)) return;
      if (triggerRef.current?.contains(node) || menuRef.current?.contains(node)) return;
      setOpen(false);
    };
    const closeOnViewportChange = () => setOpen(false);
    document.addEventListener("pointerdown", closeOnOutsidePress);
    window.addEventListener("orientationchange", closeOnViewportChange);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePress);
      window.removeEventListener("orientationchange", closeOnViewportChange);
    };
  }, [open]);

  const handleTriggerKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    openMenu(event.key === "ArrowDown" ? "first" : "last");
  };

  const handleMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const rows = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]'));
    const index = rows.indexOf(document.activeElement as HTMLElement);
    const focusAt = (next: number) => rows[(next + rows.length) % rows.length]?.focus();
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        focusAt(index + 1);
        break;
      case "ArrowUp":
        event.preventDefault();
        focusAt(index - 1);
        break;
      case "Home":
        event.preventDefault();
        focusAt(0);
        break;
      case "End":
        event.preventDefault();
        focusAt(rows.length - 1);
        break;
      case "Escape":
        if (event.nativeEvent.isComposing) return;
        event.preventDefault();
        event.stopPropagation();
        close(true);
        break;
      case "Tab":
        // Let native traversal continue from the trigger after the portal closes.
        triggerRef.current?.focus();
        close(false);
        break;
    }
  };

  const select = (item: TopbarOverflowItem) => {
    if (!item.key.startsWith("extension:")) triggerRef.current?.focus({ preventScroll: true });
    close(false);
    item.onSelect();
    requestAnimationFrame(() => {
      if (document.activeElement === document.body) triggerRef.current?.focus({ preventScroll: true });
    });
  };

  const menu = open ? (
    <div
      ref={menuRef}
      id={menuId}
      role="menu"
      aria-label={t("navigation.topbar.moreMenu")}
      data-component="TopbarMoreMenu"
      onKeyDown={handleMenuKeyDown}
      style={{
        top: menuTop + 4,
        maxHeight: `calc(100dvh - ${menuTop + 12}px)`,
        backgroundColor: "var(--background)",
        backgroundImage: "linear-gradient(var(--card), var(--card))",
      }}
      className="mari-chrome-token-scope fixed right-[max(0.5rem,env(safe-area-inset-right))] z-[9000] w-[min(16.5rem,calc(100vw-1rem))] overflow-y-auto overscroll-contain rounded-xl border border-[var(--marinara-chat-chrome-panel-border)] p-1.5 text-[var(--foreground)] shadow-2xl"
    >
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          role="menuitem"
          data-topbar-panel={item.key.startsWith("extension:") ? undefined : item.key}
          data-active={item.active ? "true" : undefined}
          aria-current={item.active ? "true" : undefined}
          onClick={() => select(item)}
          className={cn(
            "flex min-h-11 w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-[var(--accent)] focus-visible:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]",
            item.active && "bg-[var(--accent)] font-semibold",
          )}
        >
          <span
            aria-hidden="true"
            className={cn(
              "relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--secondary)] text-[var(--marinara-chat-chrome-button-text-active)]",
              item.iconClassName,
            )}
          >
            {item.icon}
          </span>
          <span className="min-w-0 flex-1 truncate">{item.label}</span>
          {item.hint ? (
            <span className="max-w-[40%] shrink-0 truncate text-[0.6875rem] text-[var(--muted-foreground)]">
              {item.hint}
            </span>
          ) : null}
          {item.active ? <Check aria-hidden="true" size={15} className="shrink-0 text-[var(--primary)]" /> : null}
        </button>
      ))}
    </div>
  ) : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        data-topbar-more=""
        onClick={() => (open ? close(false) : openMenu(null))}
        onKeyDown={handleTriggerKeyDown}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={label}
        title={label}
        className={cn(
          TOPBAR_PANEL_BUTTON_CLASS,
          "ml-auto sm:hidden",
          open
            ? TOPBAR_ACTIVE_BUTTON_CLASS
            : "text-[var(--muted-foreground)] hover:text-[var(--marinara-chat-chrome-button-text-hover)]",
        )}
      >
        <Menu size={15} className={TOPBAR_ACCENT_ICON_CLASS} />
      </button>
      {typeof document === "undefined" ? null : createPortal(menu, document.body)}
    </>
  );
}
