// ──────────────────────────────────────────────
// Layout: Main App Shell (Discord-like three-column)
// ──────────────────────────────────────────────
import { ChatSidebar } from "./ChatSidebar";
import { TopBar } from "./TopBar";
import { SpotifyMobileWidget } from "../spotify/SpotifyMiniPlayer";
import { YouTubeMobileWidget } from "../chat/YouTubePlayer";
import { LocalMusicMobileWidget } from "../chat/LocalMusicPlayer";
import { ChatNotificationBubbles } from "../chat/ChatNotificationBubbles";
import { ProfessorMariFloatingAssistantHost } from "../chat/ProfessorMariFloatingAssistantHost";
import { hasProfessorMariFloatingFollowup } from "../chat/professor-mari-floating-events";
import {
  getTrackerPanelWidthForProfile,
  RIGHT_PANEL_WIDTH_MAX,
  RIGHT_PANEL_WIDTH_MIN,
  SIDEBAR_WIDTH_MAX,
  SIDEBAR_WIDTH_MIN,
  TRACKER_PANEL_DEFAULT_BACKGROUND_COLOR,
  useUIStore,
} from "../../stores/ui.store";
import { useChatStore } from "../../stores/chat.store";
import { useBackgroundAutonomousPolling } from "../../hooks/use-background-autonomous";
import { useClearAutonomousUnread } from "../../hooks/use-chats";
import { useIdleDetection } from "../../hooks/use-idle-detection";
import { usePageActivity } from "../../hooks/use-page-activity";
import { getCssBackgroundStyle } from "../../lib/css-colors";
import { cn } from "../../lib/utils";
import { parseChatMetadata } from "../../lib/chat-display";
import { motion, AnimatePresence } from "framer-motion";
import {
  lazy,
  Suspense,
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
  useCallback,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";

const ChatArea = lazy(() => import("../chat/ChatArea").then((module) => ({ default: module.ChatArea })));
const CharacterEditor = lazy(() =>
  import("../characters/CharacterEditor").then((module) => ({ default: module.CharacterEditor })),
);
const CharacterLibraryView = lazy(() =>
  import("../characters/CharacterLibraryView").then((module) => ({ default: module.CharacterLibraryView })),
);
const LorebookEditor = lazy(() =>
  import("../lorebooks/LorebookEditor").then((module) => ({ default: module.LorebookEditor })),
);
const PresetEditor = lazy(() => import("../presets/PresetEditor").then((module) => ({ default: module.PresetEditor })));
const ConnectionEditor = lazy(() =>
  import("../connections/ConnectionEditor").then((module) => ({ default: module.ConnectionEditor })),
);
const AgentEditor = lazy(() => import("../agents/AgentEditor").then((module) => ({ default: module.AgentEditor })));
const ToolEditor = lazy(() => import("../agents/ToolEditor").then((module) => ({ default: module.ToolEditor })));
const PersonaEditor = lazy(() =>
  import("../personas/PersonaEditor").then((module) => ({ default: module.PersonaEditor })),
);
const RegexScriptEditor = lazy(() =>
  import("../agents/RegexScriptEditor").then((module) => ({ default: module.RegexScriptEditor })),
);
const BotBrowserView = lazy(() =>
  import("../bot-browser/BotBrowserView").then((module) => ({ default: module.BotBrowserView })),
);
const GameAssetsBrowserView = lazy(() =>
  import("../game-assets/GameAssetsBrowserView").then((module) => ({ default: module.GameAssetsBrowserView })),
);
const RightPanel = lazy(() => import("./RightPanel").then((module) => ({ default: module.RightPanel })));
const TrackerDataSidebar = lazy(() =>
  import("./TrackerDataSidebar").then((module) => ({ default: module.TrackerDataSidebar })),
);
const OnboardingTutorial = lazy(() =>
  import("../onboarding/OnboardingTutorial").then((module) => ({ default: module.OnboardingTutorial })),
);

function clampWidth(width: number, min: number, max: number) {
  return Math.max(min, Math.min(max, width));
}

const PANEL_RESIZE_STEP = 16;
const PANEL_RESIZE_LARGE_STEP = 48;
const SHARED_SIDEBAR_WIDTH_MIN = Math.max(SIDEBAR_WIDTH_MIN, RIGHT_PANEL_WIDTH_MIN);
const SHARED_SIDEBAR_WIDTH_MAX = Math.min(SIDEBAR_WIDTH_MAX, RIGHT_PANEL_WIDTH_MAX);
const RESIZER_HITBOX = 10;
const TRACKER_PANEL_EDGE_OFFSET = 8;
const TRACKER_PANEL_HUD_GAP = 6;
const TRACKER_PANEL_DESKTOP_MOTION_MS = 260;
const TRACKER_PANEL_DESKTOP_EXIT_MS = 240;
const TRACKER_PANEL_DESKTOP_EASE = [0.16, 1, 0.3, 1] as const;
const TRACKER_PANEL_DESKTOP_EXIT_EASE = [0.4, 0, 1, 1] as const;
const TRACKER_PANEL_TOGGLE_SELECTOR = '[data-tracker-panel-toggle="roleplay-hud"]';
const TRACKER_PANEL_ANCHOR_SELECTOR = '[data-tracker-panel-anchor="roleplay-hud"]';
const TOP_BAR_SELECTOR = '[data-component="TopBar"]';
const MOBILE_SHELL_PANEL_TOP_CLASS = "top-[calc(env(safe-area-inset-top)_+_3rem)]";
const CENTER_COMPACT_WIDTH = 768;
const CENTER_COMPACT_HYSTERESIS = 80;
const CENTER_COMPACT_SCAN_DEPTH = 6;
const CENTER_COMPACT_OVERFLOW_TOLERANCE = 2;

function hasHorizontalOverflow(root: Element) {
  let overflows = false;
  const scan = (node: Element, depth: number) => {
    if (overflows || depth > CENTER_COMPACT_SCAN_DEPTH) return;
    const rect = node.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    if (node.scrollWidth > node.clientWidth + CENTER_COMPACT_OVERFLOW_TOLERANCE) {
      overflows = true;
      return;
    }
    for (let i = 0; i < node.children.length; i++) {
      scan(node.children[i]!, depth + 1);
    }
  };
  scan(root, 0);
  return overflows;
}

function readVisibleElementRect(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0 || window.getComputedStyle(element).display === "none") return null;
  return rect;
}

function getViewportWidth() {
  return typeof window === "undefined" ? 0 : window.innerWidth;
}

function MainPaneFallback() {
  return <div className="mari-chrome-text-muted flex flex-1 items-center justify-center text-sm">Loading...</div>;
}
/** Mounts children once `open` becomes true, then keeps them mounted so state persists.
 *  `overlay` mode uses framer-motion slide-in and never unmounts. */
function MountOnceWhenOpened({
  open,
  children,
  overlay,
}: {
  open: boolean;
  children: React.ReactNode;
  overlay?: boolean;
}) {
  const [everOpened, setEverOpened] = useState(false);
  useEffect(() => {
    if (open && !everOpened) setEverOpened(true);
  }, [open, everOpened]);
  if (!everOpened) return null;
  if (overlay) {
    return (
      <motion.div
        initial={{ opacity: 0, x: 30 }}
        animate={open ? { opacity: 1, x: 0 } : { opacity: 0, x: 30 }}
        transition={{ duration: 0.2 }}
        className={cn(
          "mari-app-background-paint absolute inset-0 flex flex-col overflow-hidden",
          open ? "z-20" : "z-10 pointer-events-none",
        )}
      >
        <Suspense fallback={<MainPaneFallback />}>{children}</Suspense>
      </motion.div>
    );
  }
  return (
    <div className={open ? "flex flex-1 flex-col overflow-hidden" : "hidden"}>
      <Suspense fallback={<MainPaneFallback />}>{children}</Suspense>
    </div>
  );
}

function SidePanelFallback() {
  return <div className="mari-chrome-text-muted flex h-full items-center justify-center text-sm">Loading...</div>;
}

export function AppShell() {
  // Background autonomous polling for inactive conversation chats
  useBackgroundAutonomousPolling();

  // Auto idle detection (10 min inactivity → idle, activity → active)
  useIdleDetection();

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return;
    const root = document.documentElement;
    let frame = 0;
    const updateVisualViewportHeight = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const height = window.visualViewport?.height ?? window.innerHeight;
        root.style.setProperty("--mari-visual-viewport-height", `${Math.max(0, Math.round(height))}px`);
      });
    };

    updateVisualViewportHeight();
    window.visualViewport?.addEventListener("resize", updateVisualViewportHeight);
    window.visualViewport?.addEventListener("scroll", updateVisualViewportHeight);
    window.addEventListener("resize", updateVisualViewportHeight);
    window.addEventListener("orientationchange", updateVisualViewportHeight);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.visualViewport?.removeEventListener("resize", updateVisualViewportHeight);
      window.visualViewport?.removeEventListener("scroll", updateVisualViewportHeight);
      window.removeEventListener("resize", updateVisualViewportHeight);
      window.removeEventListener("orientationchange", updateVisualViewportHeight);
      root.style.removeProperty("--mari-visual-viewport-height");
    };
  }, []);

  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const setSidebarOpen = useUIStore((s) => s.setSidebarOpen);
  const sidebarWidth = useUIStore((s) => s.sidebarWidth);
  const setSidebarWidth = useUIStore((s) => s.setSidebarWidth);
  const rightPanelOpen = useUIStore((s) => s.rightPanelOpen);
  const rightPanelWidth = useUIStore((s) => s.rightPanelWidth);
  const setRightPanelWidth = useUIStore((s) => s.setRightPanelWidth);
  const closeRightPanel = useUIStore((s) => s.closeRightPanel);
  const trackerPanelEnabled = useUIStore((s) => s.trackerPanelEnabled);
  const trackerPanelOpen = useUIStore((s) => s.trackerPanelOpen);
  const trackerPanelSide = useUIStore((s) => s.trackerPanelSide);
  const trackerPanelHideHudWidgets = useUIStore((s) => s.trackerPanelHideHudWidgets);
  const trackerPanelSizeProfile = useUIStore((s) => s.trackerPanelSizeProfile);
  const trackerPanelBackgroundColor = useUIStore((s) => s.trackerPanelBackgroundColor);
  const setTrackerPanelOpen = useUIStore((s) => s.setTrackerPanelOpen);
  const [sidebarDragWidth, setSidebarDragWidth] = useState<number | null>(null);
  const [rightPanelDragWidth, setRightPanelDragWidth] = useState<number | null>(null);
  const sidebarDragWidthRef = useRef<number | null>(null);
  const rightPanelDragWidthRef = useRef<number | null>(null);
  const sharedSidebarWidth = clampWidth(
    rightPanelWidth || sidebarWidth,
    SHARED_SIDEBAR_WIDTH_MIN,
    SHARED_SIDEBAR_WIDTH_MAX,
  );
  const liveSidebarWidth = sidebarDragWidth ?? rightPanelDragWidth ?? sharedSidebarWidth;
  const liveRightPanelWidth = rightPanelDragWidth ?? sidebarDragWidth ?? sharedSidebarWidth;
  const trackerPanelWidth = getTrackerPanelWidthForProfile(trackerPanelSizeProfile);
  const trackerPanelHasCustomBackground =
    trackerPanelBackgroundColor.trim().toLowerCase() !== TRACKER_PANEL_DEFAULT_BACKGROUND_COLOR;
  const trackerPanelBackgroundStyle = trackerPanelHasCustomBackground
    ? getCssBackgroundStyle(trackerPanelBackgroundColor)
    : undefined;

  // Track mobile breakpoint for right-panel animation strategy
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.innerWidth < 768);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const [viewportWidth, setViewportWidth] = useState(getViewportWidth);
  useEffect(() => {
    let rafId = 0;
    const updateViewportWidth = () => {
      window.cancelAnimationFrame(rafId);
      rafId = window.requestAnimationFrame(() => {
        setViewportWidth(getViewportWidth());
      });
    };

    updateViewportWidth();
    window.addEventListener("resize", updateViewportWidth);
    return () => {
      window.removeEventListener("resize", updateViewportWidth);
      window.cancelAnimationFrame(rafId);
    };
  }, []);

  const desktopReservedSidebarWidth = sidebarOpen ? liveSidebarWidth : 0;
  const desktopReservedRightPanelWidth = rightPanelOpen ? liveRightPanelWidth : 0;
  const desktopCenterWidth = Math.max(0, viewportWidth - desktopReservedSidebarWidth - desktopReservedRightPanelWidth);
  const centerSqueezedByPanels =
    !isMobile && (sidebarOpen || rightPanelOpen) && viewportWidth > 0 && desktopCenterWidth < CENTER_COMPACT_WIDTH;
  const shellOverlayMode = isMobile;
  const chatUiInsetLeft = !shellOverlayMode && sidebarOpen ? Math.round(liveSidebarWidth) : 0;
  const chatUiInsetRight = !shellOverlayMode && rightPanelOpen ? Math.round(liveRightPanelWidth) : 0;

  useLayoutEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--mari-chat-ui-inset-left", `${chatUiInsetLeft}px`);
    root.style.setProperty("--mari-chat-ui-inset-right", `${chatUiInsetRight}px`);
    return () => {
      root.style.removeProperty("--mari-chat-ui-inset-left");
      root.style.removeProperty("--mari-chat-ui-inset-right");
    };
  }, [chatUiInsetLeft, chatUiInsetRight]);

  // ── Center-area compact detection ──
  // Side panels can shrink the center pane below the chat chrome's usable desktop
  // width even when the viewport itself is desktop-sized. Switch that pane to the
  // compact chat layout before toolbar controls begin colliding.
  const mainRef = useRef<HTMLElement>(null);
  const compactWidthRef = useRef(0); // width when we last switched to compact
  const centerCompact = useUIStore((s) => s.centerCompact);
  const setCenterCompact = useUIStore((s) => s.setCenterCompact);

  useEffect(() => {
    if (centerSqueezedByPanels && !useUIStore.getState().centerCompact) {
      compactWidthRef.current = desktopCenterWidth;
      setCenterCompact(true);
    }
  }, [centerSqueezedByPanels, desktopCenterWidth, setCenterCompact]);

  const checkOverflow = useCallback(() => {
    const el = mainRef.current;
    if (!el) return;
    const compact = useUIStore.getState().centerCompact;
    const width = el.clientWidth;
    const tooNarrowForDesktopChatChrome = width > 0 && width < CENTER_COMPACT_WIDTH;
    const shouldCompact =
      centerSqueezedByPanels || tooNarrowForDesktopChatChrome || (!compact && hasHorizontalOverflow(el));

    if (shouldCompact) {
      compactWidthRef.current = width;
      if (!compact) setCenterCompact(true);
      return;
    }

    const releaseWidth = Math.max(
      CENTER_COMPACT_WIDTH + CENTER_COMPACT_HYSTERESIS,
      compactWidthRef.current + CENTER_COMPACT_HYSTERESIS,
    );
    if (compact && width > releaseWidth) {
      setCenterCompact(false);
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          const nextEl = mainRef.current;
          if (!nextEl || useUIStore.getState().centerCompact) return;
          const nextWidth = nextEl.clientWidth;
          if (nextWidth > 0 && (nextWidth < CENTER_COMPACT_WIDTH || hasHorizontalOverflow(nextEl))) {
            compactWidthRef.current = nextWidth;
            setCenterCompact(true);
          }
        });
      });
    }
  }, [centerSqueezedByPanels, setCenterCompact]);

  // Debounce the overflow check so ResizeObserver doesn't cause layout thrashing
  const overflowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debouncedCheckOverflow = useCallback(() => {
    if (overflowTimerRef.current) clearTimeout(overflowTimerRef.current);
    overflowTimerRef.current = setTimeout(checkOverflow, 100);
  }, [checkOverflow]);

  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const ro = new ResizeObserver(debouncedCheckOverflow);
    const mo = new MutationObserver(debouncedCheckOverflow);
    ro.observe(el);
    mo.observe(el, { childList: true, subtree: true });
    window.addEventListener("resize", debouncedCheckOverflow);
    debouncedCheckOverflow();
    return () => {
      ro.disconnect();
      mo.disconnect();
      window.removeEventListener("resize", debouncedCheckOverflow);
      if (overflowTimerRef.current) clearTimeout(overflowTimerRef.current);
    };
  }, [debouncedCheckOverflow]);

  const characterDetailId = useUIStore((s) => s.characterDetailId);
  const characterLibraryOpen = useUIStore((s) => s.characterLibraryOpen);
  const lorebookDetailId = useUIStore((s) => s.lorebookDetailId);
  const presetDetailId = useUIStore((s) => s.presetDetailId);
  const connectionDetailId = useUIStore((s) => s.connectionDetailId);
  const agentDetailId = useUIStore((s) => s.agentDetailId);
  const toolDetailId = useUIStore((s) => s.toolDetailId);
  const personaDetailId = useUIStore((s) => s.personaDetailId);
  const regexDetailId = useUIStore((s) => s.regexDetailId);
  const botBrowserOpen = useUIStore((s) => s.botBrowserOpen);
  const gameAssetsBrowserOpen = useUIStore((s) => s.gameAssetsBrowserOpen);
  const hasCompletedOnboarding = useUIStore((s) => s.hasCompletedOnboarding);
  const activeChatId = useChatStore((s) => s.activeChatId);
  const activeChat = useChatStore((s) => s.activeChat);
  const clearUnread = useChatStore((s) => s.clearUnread);
  const { mutate: clearAutonomousUnread, isPending: isClearingAutonomousUnread } = useClearAutonomousUnread();
  const isPageActive = usePageActivity();
  const [trackerPanelTop, setTrackerPanelTop] = useState(TRACKER_PANEL_EDGE_OFFSET);
  const [trackerPanelExitLayoutHold, setTrackerPanelExitLayoutHold] = useState(false);
  const [trackerPanelToggleAnchorY, setTrackerPanelToggleAnchorY] = useState<number | null>(null);
  const trackerPanelWasActiveRef = useRef(false);
  const lastAutonomousUnreadClearRef = useRef<string | null>(null);

  useEffect(() => {
    if (!activeChatId || isClearingAutonomousUnread) return;
    const metadata = parseChatMetadata(activeChat?.metadata);
    const unreadCount = typeof metadata.autonomousUnreadCount === "number" ? metadata.autonomousUnreadCount : 0;
    const persistedUnread = unreadCount > 0;
    if (!persistedUnread && !useChatStore.getState().unreadCounts.has(activeChatId)) return;
    const clearKey = `${activeChatId}:${unreadCount}:${metadata.autonomousUnreadAt ?? ""}`;
    if (lastAutonomousUnreadClearRef.current === clearKey) return;
    clearUnread(activeChatId);
    clearAutonomousUnread(activeChatId, {
      onSuccess: () => {
        lastAutonomousUnreadClearRef.current = clearKey;
      },
    });
  }, [activeChat?.metadata, activeChatId, clearAutonomousUnread, clearUnread, isClearingAutonomousUnread]);

  const startSidebarResize = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      if (shellOverlayMode) return;
      event.preventDefault();
      const originalCursor = document.body.style.cursor;
      const originalUserSelect = document.body.style.userSelect;
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      sidebarDragWidthRef.current = sharedSidebarWidth;
      setSidebarDragWidth(sharedSidebarWidth);

      const onMove = (moveEvent: MouseEvent) => {
        const nextWidth = clampWidth(moveEvent.clientX, SHARED_SIDEBAR_WIDTH_MIN, SHARED_SIDEBAR_WIDTH_MAX);
        sidebarDragWidthRef.current = nextWidth;
        setSidebarDragWidth(nextWidth);
      };
      let finished = false;
      const finishResize = () => {
        if (finished) return;
        finished = true;
        const nextWidth = sidebarDragWidthRef.current ?? sharedSidebarWidth;
        setSidebarWidth(nextWidth);
        setRightPanelWidth(nextWidth);
        sidebarDragWidthRef.current = null;
        setSidebarDragWidth(null);
        document.body.style.cursor = originalCursor;
        document.body.style.userSelect = originalUserSelect;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", finishResize);
        window.removeEventListener("blur", finishResize);
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", finishResize);
      window.addEventListener("blur", finishResize);
    },
    [setRightPanelWidth, setSidebarWidth, sharedSidebarWidth, shellOverlayMode],
  );

  const startRightPanelResize = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      if (shellOverlayMode) return;
      event.preventDefault();
      const originalCursor = document.body.style.cursor;
      const originalUserSelect = document.body.style.userSelect;
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      rightPanelDragWidthRef.current = sharedSidebarWidth;
      setRightPanelDragWidth(sharedSidebarWidth);

      const onMove = (moveEvent: MouseEvent) => {
        const nextWidth = clampWidth(
          window.innerWidth - moveEvent.clientX,
          SHARED_SIDEBAR_WIDTH_MIN,
          SHARED_SIDEBAR_WIDTH_MAX,
        );
        rightPanelDragWidthRef.current = nextWidth;
        setRightPanelDragWidth(nextWidth);
      };
      let finished = false;
      const finishResize = () => {
        if (finished) return;
        finished = true;
        const nextWidth = rightPanelDragWidthRef.current ?? sharedSidebarWidth;
        setSidebarWidth(nextWidth);
        setRightPanelWidth(nextWidth);
        rightPanelDragWidthRef.current = null;
        setRightPanelDragWidth(null);
        document.body.style.cursor = originalCursor;
        document.body.style.userSelect = originalUserSelect;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", finishResize);
        window.removeEventListener("blur", finishResize);
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", finishResize);
      window.addEventListener("blur", finishResize);
    },
    [setRightPanelWidth, setSidebarWidth, sharedSidebarWidth, shellOverlayMode],
  );

  const adjustSidebarWidth = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      const step = event.shiftKey ? PANEL_RESIZE_LARGE_STEP : PANEL_RESIZE_STEP;
      let nextWidth: number;

      if (event.key === "ArrowLeft") nextWidth = sharedSidebarWidth - step;
      else if (event.key === "ArrowRight") nextWidth = sharedSidebarWidth + step;
      else if (event.key === "Home") nextWidth = SHARED_SIDEBAR_WIDTH_MIN;
      else if (event.key === "End") nextWidth = SHARED_SIDEBAR_WIDTH_MAX;
      else return;

      event.preventDefault();
      const clampedWidth = clampWidth(nextWidth, SHARED_SIDEBAR_WIDTH_MIN, SHARED_SIDEBAR_WIDTH_MAX);
      setSidebarWidth(clampedWidth);
      setRightPanelWidth(clampedWidth);
    },
    [setRightPanelWidth, setSidebarWidth, sharedSidebarWidth],
  );

  const adjustRightPanelWidth = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      const step = event.shiftKey ? PANEL_RESIZE_LARGE_STEP : PANEL_RESIZE_STEP;
      let nextWidth: number;

      if (event.key === "ArrowLeft") nextWidth = sharedSidebarWidth + step;
      else if (event.key === "ArrowRight") nextWidth = sharedSidebarWidth - step;
      else if (event.key === "Home") nextWidth = SHARED_SIDEBAR_WIDTH_MIN;
      else if (event.key === "End") nextWidth = SHARED_SIDEBAR_WIDTH_MAX;
      else return;

      event.preventDefault();
      const clampedWidth = clampWidth(nextWidth, SHARED_SIDEBAR_WIDTH_MIN, SHARED_SIDEBAR_WIDTH_MAX);
      setSidebarWidth(clampedWidth);
      setRightPanelWidth(clampedWidth);
    },
    [setRightPanelWidth, setSidebarWidth, sharedSidebarWidth],
  );

  const detailView = regexDetailId ? (
    <RegexScriptEditor />
  ) : personaDetailId ? (
    <PersonaEditor />
  ) : toolDetailId ? (
    <ToolEditor />
  ) : agentDetailId ? (
    <AgentEditor />
  ) : connectionDetailId ? (
    <ConnectionEditor />
  ) : presetDetailId ? (
    <PresetEditor />
  ) : characterDetailId ? (
    <CharacterEditor />
  ) : characterLibraryOpen ? (
    <CharacterLibraryView />
  ) : lorebookDetailId ? (
    <LorebookEditor />
  ) : null;

  const showAmbientDecor = isPageActive && !activeChatId && !detailView && !botBrowserOpen && !gameAssetsBrowserOpen;
  const hasDetailView = detailView != null;
  const trackerPanelModeAvailable = activeChat?.mode === "roleplay" || activeChat?.mode === "visual_novel";
  const trackerPanelActive = trackerPanelEnabled && trackerPanelOpen;
  const trackerPanelSurfaceAvailable =
    trackerPanelModeAvailable && !botBrowserOpen && !gameAssetsBrowserOpen && !hasDetailView;
  const trackerPanelVisible = trackerPanelActive && trackerPanelSurfaceAvailable;

  const professorMariFloatingActive = hasDetailView && hasProfessorMariFloatingFollowup();

  useEffect(() => {
    if (!trackerPanelOpen || !activeChat?.mode || trackerPanelModeAvailable) return;
    setTrackerPanelOpen(false);
  }, [activeChat?.mode, setTrackerPanelOpen, trackerPanelModeAvailable, trackerPanelOpen]);
  useEffect(() => {
    if (trackerPanelVisible) {
      trackerPanelWasActiveRef.current = true;
      setTrackerPanelExitLayoutHold(false);
      return;
    }
    if (!trackerPanelWasActiveRef.current) return;

    trackerPanelWasActiveRef.current = false;
    setTrackerPanelExitLayoutHold(true);
    const timeout = window.setTimeout(() => setTrackerPanelExitLayoutHold(false), TRACKER_PANEL_DESKTOP_EXIT_MS);
    return () => window.clearTimeout(timeout);
  }, [trackerPanelVisible]);

  const trackerPanelPendingExit = !trackerPanelVisible && trackerPanelWasActiveRef.current;
  const trackerPanelAnchoredForMotion = trackerPanelVisible || trackerPanelExitLayoutHold || trackerPanelPendingExit;
  const trackerPanelDockToEdge = trackerPanelAnchoredForMotion && trackerPanelHideHudWidgets;
  const updateTrackerPanelToggleAnchor = useCallback(() => {
    const root = mainRef.current;
    const toggle =
      root?.querySelector<HTMLElement>(TRACKER_PANEL_TOGGLE_SELECTOR) ??
      document.querySelector<HTMLElement>(TRACKER_PANEL_TOGGLE_SELECTOR);
    if (!toggle) return;
    const rect = readVisibleElementRect(toggle);
    if (!rect) return;

    const nextCenterY = rect.top + rect.height / 2;
    setTrackerPanelToggleAnchorY((current) =>
      current !== null && Math.abs(current - nextCenterY) < 0.5 ? current : nextCenterY,
    );
  }, []);
  const updateTrackerPanelTop = useCallback(() => {
    const root = mainRef.current;
    const topCandidates = [TRACKER_PANEL_EDGE_OFFSET];
    const topBar =
      root?.querySelector<HTMLElement>(TOP_BAR_SELECTOR) ?? document.querySelector<HTMLElement>(TOP_BAR_SELECTOR);
    const topBarRect = topBar ? readVisibleElementRect(topBar) : null;
    if (topBarRect) topCandidates.push(Math.ceil(topBarRect.bottom + TRACKER_PANEL_HUD_GAP));

    const anchors = Array.from(document.querySelectorAll<HTMLElement>(TRACKER_PANEL_ANCHOR_SELECTOR));
    anchors.forEach((anchor) => {
      const rect = readVisibleElementRect(anchor);
      if (rect) topCandidates.push(Math.ceil(rect.bottom + TRACKER_PANEL_HUD_GAP));
    });

    const nextTop = Math.max(...topCandidates);
    setTrackerPanelTop((current) => (current === nextTop ? current : nextTop));
  }, []);

  useLayoutEffect(() => {
    if (shellOverlayMode || trackerPanelVisible || !trackerPanelSurfaceAvailable) return;

    let frame = 0;
    let discoveryObserver: MutationObserver | null = null;
    let observedToggle: HTMLElement | null = null;
    const observer = new ResizeObserver(() => scheduleUpdate());
    const observeToggle = () => {
      const root = mainRef.current;
      const toggle =
        root?.querySelector<HTMLElement>(TRACKER_PANEL_TOGGLE_SELECTOR) ??
        document.querySelector<HTMLElement>(TRACKER_PANEL_TOGGLE_SELECTOR);
      if (!toggle) return false;
      if (observedToggle !== toggle) {
        if (observedToggle) observer.unobserve(observedToggle);
        observer.observe(toggle);
        observedToggle = toggle;
      }
      return true;
    };
    function scheduleUpdate() {
      if (frame) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const foundToggle = observeToggle();
        updateTrackerPanelToggleAnchor();
        if (foundToggle) {
          discoveryObserver?.disconnect();
          discoveryObserver = null;
        }
      });
    }

    scheduleUpdate();
    if (mainRef.current) {
      discoveryObserver = new MutationObserver(() => scheduleUpdate());
      discoveryObserver.observe(mainRef.current, { childList: true, subtree: true });
    }
    window.addEventListener("resize", scheduleUpdate);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      observer.disconnect();
      discoveryObserver?.disconnect();
      window.removeEventListener("resize", scheduleUpdate);
    };
  }, [
    activeChat?.mode,
    activeChatId,
    botBrowserOpen,
    gameAssetsBrowserOpen,
    centerCompact,
    shellOverlayMode,
    trackerPanelSurfaceAvailable,
    trackerPanelVisible,
    updateTrackerPanelToggleAnchor,
  ]);

  useLayoutEffect(() => {
    if (shellOverlayMode || !trackerPanelAnchoredForMotion || !trackerPanelSurfaceAvailable) {
      setTrackerPanelTop(TRACKER_PANEL_EDGE_OFFSET);
      return;
    }

    let frame = 0;
    let discoveryObserver: MutationObserver | null = null;
    const observedTargets = new Set<HTMLElement>();
    const observer = new ResizeObserver(() => {
      scheduleUpdate();
    });
    const observeTargets = () => {
      const topBarTargets = Array.from(document.querySelectorAll<HTMLElement>(TOP_BAR_SELECTOR));
      const anchorTargets = Array.from(document.querySelectorAll<HTMLElement>(TRACKER_PANEL_ANCHOR_SELECTOR));
      const targets = [...topBarTargets, ...anchorTargets];
      targets.forEach((target) => {
        if (observedTargets.has(target)) return;
        observer.observe(target);
        observedTargets.add(target);
      });
      return anchorTargets.length > 0;
    };
    function scheduleUpdate() {
      if (frame) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const foundTargets = observeTargets();
        updateTrackerPanelTop();
        if (foundTargets) {
          discoveryObserver?.disconnect();
          discoveryObserver = null;
        }
      });
    }

    scheduleUpdate();
    if (mainRef.current) {
      discoveryObserver = new MutationObserver(() => scheduleUpdate());
      discoveryObserver.observe(mainRef.current, { childList: true, subtree: true });
    }
    window.addEventListener("resize", scheduleUpdate);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      observer.disconnect();
      discoveryObserver?.disconnect();
      window.removeEventListener("resize", scheduleUpdate);
    };
  }, [
    activeChat?.mode,
    activeChatId,
    botBrowserOpen,
    gameAssetsBrowserOpen,
    centerCompact,
    shellOverlayMode,
    trackerPanelAnchoredForMotion,
    trackerPanelDockToEdge,
    trackerPanelSurfaceAvailable,
    updateTrackerPanelTop,
  ]);

  const trackerPanelChatAvoidance =
    !shellOverlayMode && trackerPanelAnchoredForMotion && trackerPanelSurfaceAvailable
      ? Math.round(trackerPanelWidth * 0.62)
      : 0;
  const trackerPanelHudClearance =
    !shellOverlayMode && trackerPanelAnchoredForMotion && trackerPanelHideHudWidgets && trackerPanelSurfaceAvailable
      ? trackerPanelWidth + TRACKER_PANEL_HUD_GAP
      : 0;

  const trackerPanelDesktop = (side: "left" | "right") =>
    trackerPanelVisible && trackerPanelSide === side ? (
      <motion.aside
        key={`tracker-${side}`}
        initial={{
          x: side === "left" ? -22 : 22,
          y: Math.max(-18, Math.min(10, ((trackerPanelToggleAnchorY ?? trackerPanelTop) - trackerPanelTop) * 0.25)),
          scaleX: 0.86,
          scaleY: 0.12,
          opacity: 0,
        }}
        animate={{
          x: 0,
          y: 0,
          scaleX: 1,
          scaleY: 1,
          opacity: 1,
          transition: { duration: TRACKER_PANEL_DESKTOP_MOTION_MS / 1000, ease: TRACKER_PANEL_DESKTOP_EASE },
        }}
        exit={{
          x: side === "left" ? -14 : 14,
          y: Math.max(-16, Math.min(8, ((trackerPanelToggleAnchorY ?? trackerPanelTop) - trackerPanelTop) * 0.2)),
          scaleX: 0.9,
          scaleY: 0.14,
          opacity: 0,
          transition: {
            duration: TRACKER_PANEL_DESKTOP_EXIT_MS / 1000,
            ease: TRACKER_PANEL_DESKTOP_EXIT_EASE,
            opacity: { duration: 0.08, delay: TRACKER_PANEL_DESKTOP_EXIT_MS / 1000 - 0.08, ease: "linear" },
          },
        }}
        data-component={`TrackerDataSidebarDesktop.${side}`}
        data-tracker-size-profile={trackerPanelSizeProfile}
        aria-label="Tracker data panel"
        className={cn(
          "mari-tracker-panel fixed z-30 hidden overflow-hidden bg-zinc-950/95 shadow-2xl ring-1 ring-zinc-700/80 backdrop-blur-2xl transition-[width] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-[transform,opacity] md:block",
          side === "left" ? "rounded-r-xl" : "rounded-l-xl",
        )}
        style={{
          top: trackerPanelTop,
          maxHeight: `calc(100vh - ${trackerPanelTop + TRACKER_PANEL_EDGE_OFFSET}px)`,
          width: trackerPanelWidth,
          transformOrigin: `${side === "left" ? "left" : "right"} ${Math.max(
            -56,
            Math.min(56, (trackerPanelToggleAnchorY ?? trackerPanelTop) - trackerPanelTop),
          )}px`,
          ...(side === "left"
            ? { left: sidebarOpen ? liveSidebarWidth + RESIZER_HITBOX : 0 }
            : { right: rightPanelOpen ? liveRightPanelWidth + RESIZER_HITBOX : 0 }),
          ...(trackerPanelBackgroundStyle ?? {}),
        }}
      >
        <div className="mari-tracker-panel-scroll max-h-[inherit] overflow-x-hidden overflow-y-auto">
          <Suspense fallback={<SidePanelFallback />}>
            <TrackerDataSidebar />
          </Suspense>
        </div>
      </motion.aside>
    ) : null;

  return (
    <div
      data-component="AppShell"
      className={cn(
        "mari-app mari-app-background-paint fixed inset-0 flex overflow-hidden",
        showAmbientDecor && "retro-scanlines noise-bg geometric-grid",
      )}
    >
      {/* Y2K decorative stars */}
      {showAmbientDecor && (
        <>
          <div className="y2k-star hidden md:block" style={{ top: "10%", left: "5%", animationDelay: "0s" }} />
          <div className="y2k-star-md hidden md:block" style={{ top: "25%", right: "8%", animationDelay: "1.5s" }} />
          <div className="y2k-star-lg hidden md:block" style={{ top: "60%", left: "3%", animationDelay: "3s" }} />
          <div className="y2k-star hidden md:block" style={{ top: "80%", right: "12%", animationDelay: "0.8s" }} />
          <div className="y2k-star-md hidden md:block" style={{ top: "45%", left: "50%", animationDelay: "2.2s" }} />
        </>
      )}

      {/* Overlay sidebar backdrop */}
      {sidebarOpen && shellOverlayMode && (
        <div
          className={cn("fixed inset-x-0 bottom-0 z-30 bg-black/50 backdrop-blur-sm", MOBILE_SHELL_PANEL_TOP_CLASS)}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Left sidebar - Chat list */}
      <aside
        data-tour="sidebar"
        data-component="ChatSidebarPanel"
        aria-label="Chat list"
        className={cn(
          "mari-sidebar flex-shrink-0 overflow-hidden bg-[var(--background)]/80 backdrop-blur-xl",
          sidebarDragWidth == null && "transition-[width] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]",
          sidebarOpen && !shellOverlayMode && "mari-shell-panel-edge mari-shell-panel-edge--right md:relative",
          shellOverlayMode &&
            cn(
              "fixed bottom-0 left-0 z-40 max-h-none pb-[max(env(safe-area-inset-bottom),0.5rem)] shadow-2xl",
              MOBILE_SHELL_PANEL_TOP_CLASS,
            ),
          !sidebarOpen && shellOverlayMode && "!w-0",
        )}
        style={{ width: sidebarOpen ? (shellOverlayMode ? "100vw" : liveSidebarWidth) : 0 }}
      >
        <div className="h-full" style={{ width: shellOverlayMode ? "100vw" : liveSidebarWidth }}>
          <ChatSidebar />
        </div>
      </aside>
      {!shellOverlayMode && sidebarOpen && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize left sidebar"
          aria-valuemin={SHARED_SIDEBAR_WIDTH_MIN}
          aria-valuemax={SHARED_SIDEBAR_WIDTH_MAX}
          aria-valuenow={Math.round(liveSidebarWidth)}
          tabIndex={0}
          onMouseDown={startSidebarResize}
          onKeyDown={adjustSidebarWidth}
          className="absolute inset-y-0 z-20 hidden w-1 cursor-col-resize bg-transparent transition-colors hover:bg-[var(--primary)]/30 focus-visible:bg-[var(--primary)]/40 focus-visible:outline-none md:block"
          style={{ left: sidebarOpen ? liveSidebarWidth : 0 }}
        />
      )}

      <AnimatePresence initial={false}>
        {!shellOverlayMode && trackerPanelSurfaceAvailable && trackerPanelDesktop("left")}
      </AnimatePresence>

      {/* Center content */}
      <main
        ref={mainRef}
        data-tour="chat-area"
        data-component="CenterContent"
        data-center-compact={centerCompact ? "true" : undefined}
        data-shell-overlay-mode={shellOverlayMode ? "true" : undefined}
        aria-label="Main content"
        className="@container mari-main mari-app-background-paint relative flex min-w-0 flex-1 flex-col overflow-hidden"
      >
        {/* iOS safe area spacer — pushes TopBar below status bar and fills that gap with topbar bg */}
        <div className="flex-shrink-0 md:hidden h-[env(safe-area-inset-top)] bg-[var(--marinara-topbar-surface)] backdrop-blur-sm" />
        <TopBar />
        <div className="mari-app-background-paint relative flex flex-1 flex-col overflow-hidden">
          {/* Bot Browser — kept mounted once opened so state persists across close/reopen */}
          <MountOnceWhenOpened open={botBrowserOpen} overlay>
            <BotBrowserView />
          </MountOnceWhenOpened>
          {/* Game Assets Browser — kept mounted once opened so state persists across close/reopen */}
          <MountOnceWhenOpened open={gameAssetsBrowserOpen} overlay>
            <GameAssetsBrowserView />
          </MountOnceWhenOpened>
          <div
            className={cn(
              "mari-app-background-paint flex flex-1 flex-col overflow-hidden",
              (botBrowserOpen || gameAssetsBrowserOpen) && "hidden",
            )}
            style={
              {
                "--tracker-chat-avoid-left": `${trackerPanelSide === "left" ? trackerPanelChatAvoidance : 0}px`,
                "--tracker-chat-avoid-right": `${trackerPanelSide === "right" ? trackerPanelChatAvoidance : 0}px`,
                "--tracker-panel-hud-clear-left": `${trackerPanelSide === "left" ? trackerPanelHudClearance : 0}px`,
                "--tracker-panel-hud-clear-right": `${trackerPanelSide === "right" ? trackerPanelHudClearance : 0}px`,
              } as CSSProperties
            }
          >
            <Suspense fallback={<MainPaneFallback />}>
              {shellOverlayMode ? <ChatArea /> : (detailView ?? <ChatArea />)}
            </Suspense>
          </div>
        </div>
        {/* Floating avatar notification bubbles (right edge) */}
        <ChatNotificationBubbles />
      </main>

      <AnimatePresence initial={false}>
        {!shellOverlayMode && trackerPanelSurfaceAvailable && trackerPanelDesktop("right")}
      </AnimatePresence>

      {/* Overlay tracker panel backdrop */}
      {trackerPanelVisible && shellOverlayMode && (
        <div
          className={cn("fixed inset-x-0 bottom-0 z-30 bg-black/50 backdrop-blur-sm", MOBILE_SHELL_PANEL_TOP_CLASS)}
          onClick={() => setTrackerPanelOpen(false)}
        />
      )}

      {/* Overlay tracker panel */}
      {shellOverlayMode && (
        <AnimatePresence mode="wait">
          {trackerPanelVisible && (
            <motion.aside
              key="mobile-tracker"
              initial={{ x: trackerPanelSide === "left" ? "-100%" : "100%" }}
              animate={{ x: 0 }}
              exit={{ x: trackerPanelSide === "left" ? "-100%" : "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 350 }}
              data-component="TrackerDataSidebarMobile"
              aria-label="Tracker data panel"
              className={cn(
                "mari-tracker-panel !fixed bottom-0 z-40 w-screen max-w-none overflow-hidden bg-zinc-950/95 pb-[max(env(safe-area-inset-bottom),0.5rem)] shadow-2xl ring-1 ring-zinc-700/80 backdrop-blur-xl",
                MOBILE_SHELL_PANEL_TOP_CLASS,
                trackerPanelSide === "left" ? "left-0" : "right-0",
              )}
              style={trackerPanelBackgroundStyle}
            >
              <Suspense fallback={<SidePanelFallback />}>
                <TrackerDataSidebar fillHeight />
              </Suspense>
            </motion.aside>
          )}
        </AnimatePresence>
      )}

      {/* Overlay right panel backdrop */}
      {rightPanelOpen && shellOverlayMode && (
        <div
          className={cn("fixed inset-x-0 bottom-0 z-30 bg-black/50 backdrop-blur-sm", MOBILE_SHELL_PANEL_TOP_CLASS)}
          onClick={() => closeRightPanel()}
        />
      )}

      {/* Right panel - Context / Settings */}
      {shellOverlayMode ? (
        <AnimatePresence mode="wait">
          {rightPanelOpen && (
            <motion.aside
              key="mobile"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 350 }}
              data-component="RightPanelMobile"
              aria-label="Settings and tools panel"
              className={cn(
                "mari-right-panel !fixed bottom-0 right-0 z-40 !w-full overflow-hidden bg-[var(--background)]/80 pb-[max(env(safe-area-inset-bottom),0.5rem)] shadow-2xl backdrop-blur-xl",
                MOBILE_SHELL_PANEL_TOP_CLASS,
              )}
              style={{ "--mari-right-panel-width": "100vw" } as CSSProperties}
            >
              <Suspense fallback={<SidePanelFallback />}>
                <RightPanel />
              </Suspense>
            </motion.aside>
          )}
        </AnimatePresence>
      ) : (
        <aside
          data-component="RightPanelDesktop"
          aria-label="Settings and tools panel"
          className={cn(
            "mari-right-panel flex-shrink-0 overflow-hidden bg-[var(--background)]/80 backdrop-blur-xl",
            rightPanelDragWidth == null && "transition-[width] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]",
            rightPanelOpen && "mari-shell-panel-edge mari-shell-panel-edge--left relative",
          )}
          style={
            {
              width: rightPanelOpen ? liveRightPanelWidth : 0,
              "--mari-right-panel-width": `${liveRightPanelWidth}px`,
            } as CSSProperties
          }
        >
          {rightPanelOpen && (
            <div className="h-full" style={{ width: liveRightPanelWidth }}>
              <Suspense fallback={<SidePanelFallback />}>
                <RightPanel />
              </Suspense>
            </div>
          )}
        </aside>
      )}

      {shellOverlayMode && detailView && (
        <AnimatePresence mode="wait">
          <motion.aside
            key="mobile-detail"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 24 }}
            transition={{ type: "spring", damping: 30, stiffness: 360 }}
            data-component="MobileDetailSheet"
            aria-label="Detail editor"
            className={cn(
              "mari-mobile-detail-sheet !fixed bottom-0 right-0 z-40 flex min-h-0 !w-full flex-col overflow-hidden bg-[var(--background)]/95 pb-[max(env(safe-area-inset-bottom),0.5rem)] shadow-2xl backdrop-blur-xl",
              MOBILE_SHELL_PANEL_TOP_CLASS,
            )}
          >
            <Suspense fallback={<MainPaneFallback />}>{detailView}</Suspense>
          </motion.aside>
        </AnimatePresence>
      )}
      {!shellOverlayMode && rightPanelOpen && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize right sidebar"
          aria-valuemin={SHARED_SIDEBAR_WIDTH_MIN}
          aria-valuemax={SHARED_SIDEBAR_WIDTH_MAX}
          aria-valuenow={Math.round(liveRightPanelWidth)}
          tabIndex={0}
          onMouseDown={startRightPanelResize}
          onKeyDown={adjustRightPanelWidth}
          className="absolute inset-y-0 z-20 hidden w-1 cursor-col-resize bg-transparent transition-colors hover:bg-[var(--primary)]/30 focus-visible:bg-[var(--primary)]/40 focus-visible:outline-none md:block"
          style={{ right: rightPanelOpen ? liveRightPanelWidth : 0 }}
        />
      )}

      {/* First-time onboarding tutorial */}
      {!hasCompletedOnboarding && (
        <Suspense fallback={null}>
          <OnboardingTutorial />
        </Suspense>
      )}
      <ProfessorMariFloatingAssistantHost active={professorMariFloatingActive} />
      <SpotifyMobileWidget />
      <YouTubeMobileWidget />
      <LocalMusicMobileWidget />
    </div>
  );
}
