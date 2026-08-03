// ──────────────────────────────────────────────
// Layout: Main App Shell (Discord-like three-column)
// ──────────────────────────────────────────────
import { useQueryClient } from "@tanstack/react-query";
import { ChatSidebar } from "./ChatSidebar";
import { TopBar } from "./TopBar";
import { SpotifyMobileWidget } from "../spotify/SpotifyMiniPlayer";
import { YouTubeMobileWidget } from "../chat/YouTubePlayer";
import { LocalMusicMobileWidget } from "../chat/LocalMusicPlayer";
import { MusicDjUnavailablePlayer } from "../music/MusicDjUnavailablePlayer";
import { ProfessorMariFloatingAssistantHost } from "../chat/ProfessorMariFloatingAssistantHost";
import { ChatResourceMobileDropDock } from "../chat/ChatResourceMobileDropDock";
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
import { useClearAutonomousUnread, useUpdateChatMetadata } from "../../hooks/use-chats";
import { lorebookKeys } from "../../hooks/use-lorebooks";
import { useIdleDetection } from "../../hooks/use-idle-detection";
import { dispatchChatVisualViewportChange } from "../../hooks/use-visual-viewport-chat-bottom";
import { usePageActivity } from "../../hooks/use-page-activity";
import { useCapabilityAgentRegistry, useCapabilityClientModules } from "../../hooks/use-capability-packages";
import { CapabilityElement } from "../capabilities/CapabilityElement";
import { FeatureAgentDetailHost } from "../agents/FeatureAgentDetailHost";
import { getCssBackgroundStyle } from "../../lib/css-colors";
import { showConfirmDialog } from "../../lib/app-dialogs";
import { cn } from "../../lib/utils";
import { parseChatMetadata } from "../../lib/chat-display";
import { resolveTrackerPanelContentScale, resolveTrackerPanelDesktopWidth } from "../../lib/tracker-panel-layout";
import {
  closeTrackerPanelWindow,
  openTrackerPanelWindow,
  TrackerPanelDetachedWindow,
  type TrackerPanelWindowTarget,
} from "../../features/tracker-panel/components/TrackerPanelDetachedWindow";
import { TrackerWindowProvider } from "../../features/tracker-panel/components/TrackerWindowContext";
import { usePersonaPortraitSaveCoordinator } from "../../features/tracker-panel/hooks/use-persona-portrait-save";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { createPortal } from "react-dom";
import {
  lazy,
  Suspense,
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
  useCallback,
  useMemo,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { useTranslation as useUiTranslation } from "react-i18next";

const ChatArea = lazy(() => import("../chat/ChatArea").then((module) => ({ default: module.ChatArea })));
const CharacterEditor = lazy(() =>
  import("../characters/CharacterEditor").then((module) => ({ default: module.CharacterEditor })),
);
const CharacterLibraryView = lazy(() =>
  import("../characters/CharacterLibraryView").then((module) => ({ default: module.CharacterLibraryView })),
);
const AgentCatalogView = lazy(() =>
  import("../agents/AgentCatalogView").then((module) => ({ default: module.AgentCatalogView })),
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
const NoodleView = lazy(() => import("../noodle/NoodleView").then((module) => ({ default: module.NoodleView })));
const RightPanel = lazy(() => import("./RightPanel").then((module) => ({ default: module.RightPanel })));
const TrackerDataSidebar = lazy(() =>
  import("./TrackerDataSidebar").then((module) => ({ default: module.TrackerDataSidebar })),
);
const ChatNotificationBubbles = lazy(() =>
  import("../chat/ChatNotificationBubbles").then((module) => ({ default: module.ChatNotificationBubbles })),
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
const TRACKER_PANEL_EDGE_OFFSET = 8;
const CHAT_SCROLLBAR_CLEARANCE = 16;
const TRACKER_PANEL_HUD_GAP = 6;
const TRACKER_PANEL_CHAT_GAP = 8;
const TRACKER_PANEL_DESKTOP_MOTION_MS = 260;
const TRACKER_PANEL_DESKTOP_EXIT_MS = 240;
const TRACKER_PANEL_DESKTOP_EASE = [0.16, 1, 0.3, 1] as const;
const TRACKER_PANEL_DESKTOP_EXIT_EASE = [0.4, 0, 1, 1] as const;
const TRACKER_PANEL_TOGGLE_SELECTOR = '[data-tracker-panel-toggle="roleplay-hud"]';
const TRACKER_PANEL_ANCHOR_SELECTOR = '[data-tracker-panel-anchor="roleplay-hud"]';
const ROLEPLAY_CHAT_COLUMN_SELECTOR = '[data-roleplay-chat-column="true"]';
const TOP_BAR_SELECTOR = '[data-component="TopBar"]';
const MOBILE_SHELL_PANEL_TOP_CLASS = "top-[calc(env(safe-area-inset-top)_+_3rem)]";
const CENTER_COMPACT_WIDTH = 768;
const CENTER_COMPACT_HYSTERESIS = 80;
const CENTER_COMPACT_SCAN_DEPTH = 6;

function TrackerPanelHostSlot({ host }: { host: HTMLElement }) {
  const slotRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    slotRef.current?.appendChild(host);
  }, [host]);

  return <div ref={slotRef} className="contents" />;
}
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
  const { t: localizeUi } = useUiTranslation();
  return (
    <div className="mari-chrome-text-muted flex flex-1 items-center justify-center text-sm">
      {localizeUi("ui.characters.characterlibraryview.loading")}
    </div>
  );
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
  const { t: localizeUi } = useUiTranslation();
  return (
    <div className="mari-chrome-text-muted flex h-full items-center justify-center text-sm">
      {localizeUi("ui.characters.characterlibraryview.loading")}
    </div>
  );
}

export function AppShell() {
  const { t: localizeUi } = useUiTranslation();
  const queryClient = useQueryClient();
  const capabilityAgents = useCapabilityAgentRegistry();
  const installedCapabilities = useCapabilityClientModules();
  const updateChatMetadata = useUpdateChatMetadata();
  const musicPlayerEnabled = useUIStore((state) => state.musicPlayerEnabled);
  const musicDjInstalled = (installedCapabilities.data ?? []).some(
    (capability) => capability.id === "spotify" && capability.status === "active",
  );
  const showMusicDjUnavailablePlayer = musicPlayerEnabled && !installedCapabilities.isLoading && !musicDjInstalled;

  // Background autonomous polling for inactive conversation chats
  useBackgroundAutonomousPolling();

  // Auto idle detection (10 min inactivity → idle, activity → active)
  useIdleDetection();

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return;
    const root = document.documentElement;
    let frame = 0;
    let focusTimers: number[] = [];
    let orientationTimers: number[] = [];
    let largestViewportHeight = window.visualViewport?.height ?? window.innerHeight;
    const supportsVirtualKeyboard = navigator.maxTouchPoints > 0 || window.matchMedia("(any-pointer: coarse)").matches;
    const isIOSWebKit =
      /iP(?:ad|hone|od)/i.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    // iOS doesn't track the keyboard's visualViewport.offsetTop/height
    // reliably, so we force offsetTop to 0 and instead counter the scroll
    // drift iOS applies with a `transform: translateY()` (a GPU compositor
    // update, unlike window.scrollTo() it doesn't fight WebKit's own
    // animation).
    const updateVisualViewportGeometry = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        frame = 0;
        const viewport = window.visualViewport;
        const heightCandidates = [viewport?.height, window.innerHeight, root.clientHeight].filter(
          (value): value is number => typeof value === "number" && Number.isFinite(value) && value > 0,
        );
        const height = heightCandidates.length > 0 ? Math.min(...heightCandidates) : window.innerHeight;
        const maxOffsetTop = Math.max(0, window.innerHeight - height);
        const visualViewportOffsetTop = Math.min(maxOffsetTop, Math.max(0, viewport?.offsetTop ?? 0));
        const offsetTop = isIOSWebKit ? 0 : visualViewportOffsetTop;
        largestViewportHeight = Math.max(largestViewportHeight, height);
        root.style.setProperty("--mari-visual-viewport-height", `${Math.max(0, Math.round(height))}px`);
        root.style.setProperty("--mari-visual-viewport-offset-top", `${Math.round(offsetTop)}px`);
        if (isIOSWebKit) {
          root.style.setProperty("--mari-app-scroll-compensate", `${Math.round(window.scrollY)}px`);
        }
        const keyboardOpen = supportsVirtualKeyboard && largestViewportHeight - height >= 80;
        root.toggleAttribute("data-mari-software-keyboard-open", keyboardOpen);
        dispatchChatVisualViewportChange({
          height,
          offsetTop,
          keyboardOpen,
        });
      });
    };
    const refreshAfterFocusChange = () => {
      focusTimers.forEach((timer) => window.clearTimeout(timer));
      focusTimers = [];
      updateVisualViewportGeometry();
      // Android browsers can publish the keyboard-adjusted viewport after the
      // focus event. Re-sample both the early animation and settled geometry.
      focusTimers.push(window.setTimeout(updateVisualViewportGeometry, 80));
      focusTimers.push(window.setTimeout(updateVisualViewportGeometry, 320));
    };
    const refreshAfterOrientationChange = () => {
      orientationTimers.forEach((timer) => window.clearTimeout(timer));
      orientationTimers = [];
      const resetViewportBaseline = () => {
        // A shorter landscape viewport is not necessarily a software keyboard.
        // Re-establish the baseline while browser chrome and safe areas settle.
        largestViewportHeight = 0;
        updateVisualViewportGeometry();
      };
      resetViewportBaseline();
      orientationTimers.push(window.setTimeout(resetViewportBaseline, 80));
      orientationTimers.push(window.setTimeout(resetViewportBaseline, 320));
    };

    updateVisualViewportGeometry();
    window.visualViewport?.addEventListener("resize", updateVisualViewportGeometry);
    window.visualViewport?.addEventListener("scroll", updateVisualViewportGeometry);
    window.addEventListener("resize", updateVisualViewportGeometry);
    window.addEventListener("orientationchange", refreshAfterOrientationChange);
    document.addEventListener("focusin", refreshAfterFocusChange);
    document.addEventListener("focusout", refreshAfterFocusChange);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      focusTimers.forEach((timer) => window.clearTimeout(timer));
      orientationTimers.forEach((timer) => window.clearTimeout(timer));
      window.visualViewport?.removeEventListener("resize", updateVisualViewportGeometry);
      window.visualViewport?.removeEventListener("scroll", updateVisualViewportGeometry);
      window.removeEventListener("resize", updateVisualViewportGeometry);
      window.removeEventListener("orientationchange", refreshAfterOrientationChange);
      document.removeEventListener("focusin", refreshAfterFocusChange);
      document.removeEventListener("focusout", refreshAfterFocusChange);
      root.style.removeProperty("--mari-visual-viewport-height");
      root.style.removeProperty("--mari-visual-viewport-offset-top");
      root.style.removeProperty("--mari-app-scroll-compensate");
      root.removeAttribute("data-mari-software-keyboard-open");
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
  const spatialMapDetailChatId = useUIStore((s) => s.spatialMapDetailChatId);
  const pendingSpatialMapDraftReview = useUIStore((s) => s.pendingSpatialMapDraftReview);
  const clearPendingSpatialMapDraftReview = useUIStore((s) => s.clearPendingSpatialMapDraftReview);
  const closeSpatialMapDetail = useUIStore((s) => s.closeSpatialMapDetail);
  const debugMode = useUIStore((s) => s.debugMode);
  const setEditorDirty = useUIStore((s) => s.setEditorDirty);
  const openLorebookDetail = useUIStore((s) => s.openLorebookDetail);
  const closeAgentDetail = useUIStore((s) => s.closeAgentDetail);
  const openRightPanel = useUIStore((s) => s.openRightPanel);
  const openAgentCatalog = useUIStore((s) => s.openAgentCatalog);
  const setTrackerPanelOpen = useUIStore((s) => s.setTrackerPanelOpen);
  const restoreTrackerPanelOpenForChat = useUIStore((s) => s.restoreTrackerPanelOpenForChat);
  const refreshLorebooks = useCallback(
    () => queryClient.invalidateQueries({ queryKey: lorebookKeys.all }),
    [queryClient],
  );
  const openSpatialLorebook = useCallback(
    (lorebookId: string) => {
      void refreshLorebooks();
      openLorebookDetail(lorebookId);
    },
    [openLorebookDetail, refreshLorebooks],
  );
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
  const [trackerPanelResolvedWidth, setTrackerPanelResolvedWidth] = useState(trackerPanelWidth);
  const [trackerPanelWindowTarget, setTrackerPanelWindowTarget] = useState<TrackerPanelWindowTarget | null>(null);
  const detachTrackerPanelPendingRef = useRef(false);
  const [trackerPanelHost] = useState(() => {
    const host = document.createElement("div");
    host.style.display = "contents";
    return host;
  });
  const { queuePersonaPortraitSave, flushPersonaPortraitSave } = usePersonaPortraitSaveCoordinator();
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

  const shellOverlayMode = isMobile;
  const [rightPanelEverOpened, setRightPanelEverOpened] = useState(rightPanelOpen);
  useEffect(() => {
    if (rightPanelOpen) setRightPanelEverOpened(true);
  }, [rightPanelOpen]);

  const layoutSidebarOpen = sidebarOpen;
  const layoutRightPanelOpen = rightPanelOpen;
  const desktopReservedSidebarWidth = layoutSidebarOpen ? liveSidebarWidth : 0;
  const desktopReservedRightPanelWidth = layoutRightPanelOpen ? liveRightPanelWidth : 0;
  const desktopCenterWidth = Math.max(0, viewportWidth - desktopReservedSidebarWidth - desktopReservedRightPanelWidth);
  const centerSqueezedByPanels =
    !isMobile &&
    (layoutSidebarOpen || layoutRightPanelOpen) &&
    viewportWidth > 0 &&
    desktopCenterWidth < CENTER_COMPACT_WIDTH;
  const chatUiInsetLeft = !shellOverlayMode && layoutSidebarOpen ? Math.round(liveSidebarWidth) : 0;
  const chatUiInsetRight = !shellOverlayMode && layoutRightPanelOpen ? Math.round(liveRightPanelWidth) : 0;

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
  const cardLibraryKind = useUIStore((s) => s.cardLibraryKind);
  const agentCatalogOpen = useUIStore((s) => s.agentCatalogOpen);
  const lorebookDetailId = useUIStore((s) => s.lorebookDetailId);
  const presetDetailId = useUIStore((s) => s.presetDetailId);
  const connectionDetailId = useUIStore((s) => s.connectionDetailId);
  const agentDetailId = useUIStore((s) => s.agentDetailId);
  const toolDetailId = useUIStore((s) => s.toolDetailId);
  const personaDetailId = useUIStore((s) => s.personaDetailId);
  const regexDetailId = useUIStore((s) => s.regexDetailId);
  const botBrowserOpen = useUIStore((s) => s.botBrowserOpen);
  const gameAssetsBrowserOpen = useUIStore((s) => s.gameAssetsBrowserOpen);
  const noodleOpen = useUIStore((s) => s.noodleOpen);
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

  const selectedFeatureAgent = useMemo(
    () =>
      agentDetailId
        ? ((capabilityAgents.data ?? []).find((agent) => agent.id === agentDetailId && agent.execution === "feature") ??
          null)
        : null,
    [agentDetailId, capabilityAgents.data],
  );
  const selectedFeaturePackage = useMemo(
    () =>
      selectedFeatureAgent
        ? ((installedCapabilities.data ?? []).find((item) =>
            item.manifest.contributions?.agentDetail?.agentIds.includes(selectedFeatureAgent.id),
          ) ?? null)
        : null,
    [installedCapabilities.data, selectedFeatureAgent],
  );
  const activeChatMetadata = parseChatMetadata(activeChat?.metadata);
  const activeChatAgentIds = Array.isArray(activeChatMetadata.activeAgentIds)
    ? activeChatMetadata.activeAgentIds.filter((id): id is string => typeof id === "string")
    : [];
  const selectedFeatureSupportsActiveChat = Boolean(
    selectedFeatureAgent &&
    activeChat &&
    (!selectedFeatureAgent.modeAllowlist || selectedFeatureAgent.modeAllowlist.includes(activeChat.mode)),
  );
  const selectedFeatureEnabledForChat = Boolean(
    selectedFeatureAgent &&
    activeChatMetadata.enableAgents === true &&
    activeChatAgentIds.includes(selectedFeatureAgent.id),
  );
  const setSelectedFeatureEnabledForChat = useCallback(
    async (enabled: boolean) => {
      if (!selectedFeatureAgent || !activeChatId || !selectedFeatureSupportsActiveChat) return;
      const latestChat = useChatStore.getState().activeChat;
      const latestMetadata = parseChatMetadata(
        latestChat?.id === activeChatId ? latestChat.metadata : activeChat?.metadata,
      );
      const latestAgentIds = Array.isArray(latestMetadata.activeAgentIds)
        ? latestMetadata.activeAgentIds.filter((id): id is string => typeof id === "string")
        : [];
      const activeAgentIds = enabled
        ? Array.from(new Set([...latestAgentIds, selectedFeatureAgent.id]))
        : latestAgentIds.filter((id) => id !== selectedFeatureAgent.id);
      await updateChatMetadata.mutateAsync({
        id: activeChatId,
        ...(enabled ? { enableAgents: true } : {}),
        activeAgentIds,
      });
    },
    [activeChat?.metadata, activeChatId, selectedFeatureAgent, selectedFeatureSupportsActiveChat, updateChatMetadata],
  );

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
    capabilityAgents.isLoading ? (
      <MainPaneFallback />
    ) : selectedFeatureAgent ? (
      <FeatureAgentDetailHost
        agent={selectedFeatureAgent}
        installedPackage={selectedFeaturePackage}
        activeChat={activeChat ? { id: activeChat.id, name: activeChat.name, mode: activeChat.mode } : null}
        activeChatSupported={selectedFeatureSupportsActiveChat}
        enabledForChat={selectedFeatureEnabledForChat}
        onEnabledForChatChange={setSelectedFeatureEnabledForChat}
        onClose={() => {
          closeAgentDetail();
          openRightPanel("agents");
        }}
        onManagePackage={openAgentCatalog}
        capabilityProps={{
          debugMode,
          confirmAction: showConfirmDialog,
          onDirtyChange: setEditorDirty,
          onOpenLorebook: openSpatialLorebook,
          onLorebooksChanged: refreshLorebooks,
        }}
      />
    ) : (
      <AgentEditor />
    )
  ) : connectionDetailId ? (
    <ConnectionEditor />
  ) : presetDetailId ? (
    <PresetEditor />
  ) : characterDetailId ? (
    <CharacterEditor />
  ) : characterLibraryOpen ? (
    <CharacterLibraryView key={cardLibraryKind} />
  ) : agentCatalogOpen ? (
    <AgentCatalogView />
  ) : lorebookDetailId ? (
    <LorebookEditor />
  ) : null;

  const showAmbientDecor =
    isPageActive && !activeChatId && !detailView && !botBrowserOpen && !gameAssetsBrowserOpen && !noodleOpen;
  const hasDetailView = detailView != null;
  const trackerPanelModeAvailable = activeChat?.mode === "roleplay";
  const trackerPanelActive = trackerPanelEnabled && trackerPanelOpen;
  const trackerPanelDetached = trackerPanelWindowTarget !== null;
  const trackerPanelSurfaceAvailable =
    trackerPanelModeAvailable && !botBrowserOpen && !gameAssetsBrowserOpen && !noodleOpen && !hasDetailView;
  const trackerPanelVisible = trackerPanelActive && trackerPanelSurfaceAvailable && !trackerPanelDetached;
  const chatSurfaceActive =
    !botBrowserOpen &&
    !gameAssetsBrowserOpen &&
    !noodleOpen &&
    !hasDetailView &&
    (!shellOverlayMode || (!sidebarOpen && !rightPanelOpen && !trackerPanelVisible));
  const trackerWindowHost = trackerPanelWindowTarget?.popup ?? window;

  const dockTrackerPanel = useCallback(() => {
    if (trackerPanelWindowTarget) closeTrackerPanelWindow(trackerPanelWindowTarget);
    setTrackerPanelWindowTarget(null);
  }, [trackerPanelWindowTarget]);

  const detachTrackerPanel = useCallback(async () => {
    if (detachTrackerPanelPendingRef.current) return;
    detachTrackerPanelPendingRef.current = true;

    try {
      const target = await openTrackerPanelWindow({
        title: localizeUi("ui.layout.appshell.detachedTrackerPanelTitle"),
        width: trackerPanelWidth,
      });
      if (!target) {
        toast.error(localizeUi("ui.layout.appshell.trackerPanelPopupBlocked"));
        return;
      }
      setTrackerPanelWindowTarget(target);
    } catch {
      toast.error(localizeUi("ui.layout.appshell.trackerPanelWindowFailed"));
    } finally {
      detachTrackerPanelPendingRef.current = false;
    }
  }, [localizeUi, trackerPanelWidth]);

  const handleTrackerPanelWindowClosed = useCallback(() => {
    setTrackerPanelWindowTarget(null);
  }, []);

  const professorMariFloatingActive = hasDetailView && hasProfessorMariFloatingFollowup();

  useEffect(() => {
    restoreTrackerPanelOpenForChat(activeChatId);
  }, [activeChatId, restoreTrackerPanelOpenForChat, trackerPanelEnabled]);
  useEffect(() => {
    if (!trackerPanelOpen || !activeChat?.mode || trackerPanelModeAvailable) return;
    setTrackerPanelOpen(false, activeChatId);
  }, [activeChat?.mode, activeChatId, setTrackerPanelOpen, trackerPanelModeAvailable, trackerPanelOpen]);
  useEffect(() => {
    if (!trackerPanelWindowTarget || (trackerPanelActive && trackerPanelModeAvailable)) return;
    closeTrackerPanelWindow(trackerPanelWindowTarget);
    setTrackerPanelWindowTarget(null);
  }, [trackerPanelActive, trackerPanelModeAvailable, trackerPanelWindowTarget]);
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

    if (!trackerPanelDockToEdge) {
      const anchors = Array.from(document.querySelectorAll<HTMLElement>(TRACKER_PANEL_ANCHOR_SELECTOR));
      anchors.forEach((anchor) => {
        const rect = readVisibleElementRect(anchor);
        if (rect) topCandidates.push(Math.ceil(rect.bottom + TRACKER_PANEL_HUD_GAP));
      });
    }

    const nextTop = Math.max(...topCandidates);
    setTrackerPanelTop((current) => (current === nextTop ? current : nextTop));
  }, [trackerPanelDockToEdge]);

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

  useLayoutEffect(() => {
    if (shellOverlayMode || !trackerPanelSurfaceAvailable || !trackerPanelAnchoredForMotion) {
      setTrackerPanelResolvedWidth(trackerPanelWidth);
      return;
    }

    let frame = 0;
    let discoveryObserver: MutationObserver | null = null;
    let observedChatColumn: HTMLElement | null = null;
    const observer = new ResizeObserver(() => scheduleUpdate());
    const update = () => {
      const main = mainRef.current;
      const chatColumn = main?.querySelector<HTMLElement>(ROLEPLAY_CHAT_COLUMN_SELECTOR) ?? null;
      const mainRect = main ? readVisibleElementRect(main) : null;
      const chatColumnRect = chatColumn ? readVisibleElementRect(chatColumn) : null;

      if (!mainRect || !chatColumn || !chatColumnRect) {
        setTrackerPanelResolvedWidth(trackerPanelWidth);
        return false;
      }

      const nextWidth = resolveTrackerPanelDesktopWidth({
        preferredWidth: trackerPanelWidth,
        mainLeft: mainRect.left,
        mainRight: mainRect.right,
        chatColumnLeft: chatColumnRect.left,
        chatColumnRight: chatColumnRect.right,
        side: trackerPanelSide,
        gap: TRACKER_PANEL_CHAT_GAP,
      });
      setTrackerPanelResolvedWidth((current) => (current === nextWidth ? current : nextWidth));

      if (observedChatColumn !== chatColumn) {
        if (observedChatColumn) observer.unobserve(observedChatColumn);
        observer.observe(chatColumn);
        observedChatColumn = chatColumn;
      }
      return true;
    };
    function scheduleUpdate() {
      if (frame) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const foundChatColumn = update();
        if (foundChatColumn) {
          discoveryObserver?.disconnect();
          discoveryObserver = null;
        }
      });
    }

    if (mainRef.current) observer.observe(mainRef.current);
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
    shellOverlayMode,
    trackerPanelAnchoredForMotion,
    trackerPanelSide,
    trackerPanelSurfaceAvailable,
    trackerPanelWidth,
  ]);

  const trackerPanelOverlayClearance =
    !shellOverlayMode && trackerPanelAnchoredForMotion && trackerPanelSurfaceAvailable
      ? trackerPanelResolvedWidth + TRACKER_PANEL_HUD_GAP
      : 0;
  const trackerPanelHudClearance = trackerPanelHideHudWidgets ? trackerPanelOverlayClearance : 0;
  const trackerPanelContentScale = resolveTrackerPanelContentScale(trackerPanelWidth, trackerPanelResolvedWidth);
  const trackerPanelPortal =
    trackerPanelActive &&
    trackerPanelModeAvailable &&
    (trackerPanelDetached || trackerPanelSurfaceAvailable) &&
    createPortal(
      <TrackerWindowProvider host={trackerWindowHost}>
        <div
          data-component={trackerPanelDetached ? "TrackerDataSidebarDetached" : undefined}
          aria-label={trackerPanelDetached ? localizeUi("ui.layout.appshell.trackerDataPanel") : undefined}
          className={
            trackerPanelDetached ? "mari-tracker-panel h-screen w-screen overflow-hidden bg-zinc-950/95" : "contents"
          }
          style={trackerPanelDetached ? trackerPanelBackgroundStyle : undefined}
        >
          <Suspense fallback={<SidePanelFallback />}>
            <TrackerDataSidebar
              detached={trackerPanelDetached}
              fillHeight={trackerPanelDetached || shellOverlayMode}
              queuePersonaPortraitSave={queuePersonaPortraitSave}
              flushPersonaPortraitSave={flushPersonaPortraitSave}
              onToggleDetached={
                trackerPanelDetached ? dockTrackerPanel : shellOverlayMode ? undefined : detachTrackerPanel
              }
            />
          </Suspense>
        </div>
      </TrackerWindowProvider>,
      trackerPanelHost,
    );

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
        aria-label={localizeUi("ui.layout.appshell.trackerDataPanel")}
        className={cn(
          "mari-tracker-panel fixed z-30 hidden overflow-hidden bg-zinc-950/95 shadow-2xl ring-1 ring-zinc-700/80 backdrop-blur-2xl transition-[width] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-[transform,opacity] md:block",
          side === "left" ? "rounded-r-xl" : "rounded-l-xl",
        )}
        style={{
          top: trackerPanelTop,
          maxHeight: `calc(100vh - ${trackerPanelTop + TRACKER_PANEL_EDGE_OFFSET}px)`,
          width: trackerPanelResolvedWidth,
          transformOrigin: `${side === "left" ? "left" : "right"} ${Math.max(
            -56,
            Math.min(56, (trackerPanelToggleAnchorY ?? trackerPanelTop) - trackerPanelTop),
          )}px`,
          ...(side === "left"
            ? { left: sidebarOpen ? liveSidebarWidth : 0 }
            : { right: (rightPanelOpen ? liveRightPanelWidth : 0) + CHAT_SCROLLBAR_CLEARANCE }),
          ...(trackerPanelBackgroundStyle ?? {}),
        }}
      >
        <div
          data-tracker-content-scale={trackerPanelContentScale.toFixed(4)}
          data-tracker-content-constrained={trackerPanelContentScale < 1 ? "true" : undefined}
          className="mari-tracker-panel-scroll max-h-[inherit] overflow-x-hidden overflow-y-auto"
          style={{ "--tracker-panel-font-scale": trackerPanelContentScale } as CSSProperties}
        >
          <TrackerPanelHostSlot host={trackerPanelHost} />
        </div>
      </motion.aside>
    ) : null;

  return (
    <div
      data-component="AppShell"
      data-chat-surface-active={chatSurfaceActive ? "true" : undefined}
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
        data-component="ChatSidebarSlot"
        aria-label={localizeUi("ui.layout.appshell.chatList")}
        aria-hidden={!sidebarOpen}
        inert={!sidebarOpen}
        className={cn(
          "mari-shell-panel-slot flex-shrink-0 overflow-hidden md:relative",
          sidebarDragWidth != null && "!transition-none",
          !sidebarOpen && "pointer-events-none",
          shellOverlayMode &&
            cn(
              "fixed bottom-0 left-0 z-40 max-h-none pb-[max(env(safe-area-inset-bottom),0.5rem)] shadow-2xl",
              MOBILE_SHELL_PANEL_TOP_CLASS,
            ),
        )}
        style={{
          width: shellOverlayMode ? "100vw" : sidebarOpen ? liveSidebarWidth : 0,
        }}
      >
        <div
          data-component="ChatSidebarPanel"
          aria-hidden={!sidebarOpen}
          inert={!sidebarOpen}
          className={cn(
            "mari-sidebar mari-shell-panel-motion absolute inset-y-0 left-0 overflow-hidden bg-[var(--background)]/95",
            shellOverlayMode && "backdrop-blur-xl",
            sidebarOpen ? "mari-shell-panel-enter-left" : "mari-shell-panel-exit-left pointer-events-none",
            !shellOverlayMode && "mari-shell-panel-edge mari-shell-panel-edge--right",
          )}
          style={{ width: shellOverlayMode ? "100vw" : liveSidebarWidth }}
        >
          <ChatSidebar />
        </div>
      </aside>
      {!shellOverlayMode && sidebarOpen && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label={localizeUi("ui.layout.appshell.resizeLeftSidebar")}
          aria-valuemin={SHARED_SIDEBAR_WIDTH_MIN}
          aria-valuemax={SHARED_SIDEBAR_WIDTH_MAX}
          aria-valuenow={Math.round(liveSidebarWidth)}
          tabIndex={0}
          onMouseDown={startSidebarResize}
          onKeyDown={adjustSidebarWidth}
          className="absolute inset-y-0 z-40 hidden w-1 cursor-col-resize bg-transparent transition-colors hover:bg-[var(--primary)]/30 focus-visible:bg-[var(--primary)]/40 focus-visible:outline-none md:block"
          style={{ left: sidebarOpen ? liveSidebarWidth : 0 }}
        />
      )}

      {/* Center content */}
      <main
        ref={mainRef}
        data-tour="chat-area"
        data-component="CenterContent"
        data-center-compact={centerCompact ? "true" : undefined}
        data-shell-overlay-mode={shellOverlayMode ? "true" : undefined}
        aria-label={localizeUi("ui.layout.appshell.mainContent")}
        className={cn(
          "@container mari-main mari-app-background-paint relative flex min-w-0 flex-1 flex-col overflow-hidden",
          shellOverlayMode && hasDetailView && "z-50",
        )}
      >
        {/* iOS safe area spacer — pushes TopBar below status bar and fills that gap with topbar bg */}
        <div className="flex-shrink-0 md:hidden h-[env(safe-area-inset-top)] bg-[var(--marinara-topbar-surface)] backdrop-blur-sm" />
        <TopBar />
        <div className="mari-app-background-paint relative flex flex-1 flex-col overflow-hidden">
          {/* Browser — kept mounted once opened so state persists across close/reopen */}
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
              (botBrowserOpen || gameAssetsBrowserOpen || (!shellOverlayMode && hasDetailView && !noodleOpen)) &&
                "hidden",
            )}
            style={
              {
                "--tracker-panel-hud-clear-left": `${trackerPanelSide === "left" ? trackerPanelHudClearance : 0}px`,
                "--tracker-panel-hud-clear-right": `${trackerPanelSide === "right" ? trackerPanelHudClearance : 0}px`,
                "--tracker-panel-overlay-clearance": `${trackerPanelOverlayClearance}px`,
              } as CSSProperties
            }
          >
            <Suspense fallback={<MainPaneFallback />}>
              {noodleOpen ? <NoodleView /> : (shellOverlayMode || !hasDetailView) && <ChatArea />}
            </Suspense>
          </div>
          {/* Keep the detail host at one React tree position across the mobile breakpoint.
              Moving an editor between separate desktop/mobile branches remounts it and
              discards component-local unsaved form state. */}
          <AnimatePresence mode="wait">
            {detailView && (shellOverlayMode || !noodleOpen) && (
              <motion.aside
                key="detail-editor"
                initial={shellOverlayMode ? { opacity: 0, x: 24 } : false}
                animate={{ opacity: 1, x: 0 }}
                exit={shellOverlayMode ? { opacity: 0, x: 24 } : undefined}
                transition={{ type: "spring", damping: 30, stiffness: 360 }}
                data-component={shellOverlayMode ? "MobileDetailSheet" : "DetailEditor"}
                aria-label={localizeUi("ui.layout.appshell.detailEditor")}
                className={cn(
                  "mari-app-background-paint flex min-h-0 flex-1 flex-col overflow-hidden",
                  shellOverlayMode &&
                    cn(
                      "mari-mobile-detail-sheet !fixed bottom-0 right-0 z-50 !w-full bg-[var(--background)]/95 pb-[max(env(safe-area-inset-bottom),0.5rem)] shadow-2xl backdrop-blur-xl",
                      MOBILE_SHELL_PANEL_TOP_CLASS,
                    ),
                )}
              >
                <Suspense fallback={<MainPaneFallback />}>{detailView}</Suspense>
              </motion.aside>
            )}
          </AnimatePresence>
        </div>
        {/* Floating avatar notification bubbles (right edge) */}
        <Suspense fallback={null}>
          <ChatNotificationBubbles />
        </Suspense>
      </main>

      <AnimatePresence initial={false} mode="wait">
        {!shellOverlayMode && trackerPanelSurfaceAvailable && trackerPanelDesktop(trackerPanelSide)}
      </AnimatePresence>

      {trackerPanelWindowTarget && trackerPanelActive && trackerPanelModeAvailable && (
        <TrackerPanelDetachedWindow
          host={trackerPanelHost}
          target={trackerPanelWindowTarget}
          onClosed={handleTrackerPanelWindowClosed}
        />
      )}

      {trackerPanelPortal}

      {/* Overlay tracker panel backdrop */}
      {trackerPanelVisible && shellOverlayMode && (
        <div
          className={cn("fixed inset-x-0 bottom-0 z-30 bg-black/50 backdrop-blur-sm", MOBILE_SHELL_PANEL_TOP_CLASS)}
          onClick={() => setTrackerPanelOpen(false, activeChatId)}
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
              aria-label={localizeUi("ui.layout.appshell.trackerDataPanel")}
              className={cn(
                "mari-tracker-panel !fixed bottom-0 z-40 w-screen max-w-none overflow-hidden bg-zinc-950/95 pb-[max(env(safe-area-inset-bottom),0.5rem)] shadow-2xl ring-1 ring-zinc-700/80 backdrop-blur-xl",
                MOBILE_SHELL_PANEL_TOP_CLASS,
                trackerPanelSide === "left" ? "left-0" : "right-0",
              )}
              style={trackerPanelBackgroundStyle}
            >
              <TrackerPanelHostSlot host={trackerPanelHost} />
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

      {shellOverlayMode && <ChatResourceMobileDropDock />}

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
              aria-label={localizeUi("ui.layout.appshell.settingsAndToolsPanel")}
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
          data-component="RightPanelDesktopSlot"
          aria-label={localizeUi("ui.layout.appshell.settingsAndToolsPanel")}
          aria-hidden={!rightPanelOpen}
          inert={!rightPanelOpen}
          className={cn(
            "mari-shell-panel-slot relative flex-shrink-0 overflow-hidden",
            rightPanelDragWidth != null && "!transition-none",
            !rightPanelOpen && "pointer-events-none",
          )}
          style={
            {
              width: rightPanelOpen ? liveRightPanelWidth : 0,
              "--mari-right-panel-width": `${liveRightPanelWidth}px`,
            } as CSSProperties
          }
        >
          {(rightPanelOpen || rightPanelEverOpened) && (
            <div
              data-component="RightPanelDesktop"
              aria-hidden={!rightPanelOpen}
              inert={!rightPanelOpen}
              className={cn(
                "mari-right-panel mari-shell-panel-motion mari-shell-panel-edge mari-shell-panel-edge--left absolute inset-y-0 right-0 overflow-hidden bg-[var(--background)]/95",
                rightPanelOpen ? "mari-shell-panel-enter-right" : "mari-shell-panel-exit-right pointer-events-none",
              )}
              style={{ width: liveRightPanelWidth }}
            >
              <Suspense fallback={<SidePanelFallback />}>
                <RightPanel />
              </Suspense>
            </div>
          )}
        </aside>
      )}

      {!shellOverlayMode && rightPanelOpen && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label={localizeUi("ui.layout.appshell.resizeRightSidebar")}
          aria-valuemin={SHARED_SIDEBAR_WIDTH_MIN}
          aria-valuemax={SHARED_SIDEBAR_WIDTH_MAX}
          aria-valuenow={Math.round(liveRightPanelWidth)}
          tabIndex={0}
          onMouseDown={startRightPanelResize}
          onKeyDown={adjustRightPanelWidth}
          className="absolute inset-y-0 z-40 hidden w-1 cursor-col-resize bg-transparent transition-colors hover:bg-[var(--primary)]/30 focus-visible:bg-[var(--primary)]/40 focus-visible:outline-none md:block"
          style={{ right: rightPanelOpen ? liveRightPanelWidth : 0 }}
        />
      )}

      {spatialMapDetailChatId ? (
        <CapabilityElement
          packageId="hierarchical-maps"
          view="workspace"
          capabilityProps={{
            chatId: spatialMapDetailChatId,
            chatName: activeChat?.id === spatialMapDetailChatId ? activeChat.name : null,
            chatMode: activeChat?.id === spatialMapDetailChatId ? activeChat.mode : null,
            debugMode,
            pendingDraftReview: pendingSpatialMapDraftReview,
            confirmAction: showConfirmDialog,
            onClearPendingDraftReview: clearPendingSpatialMapDraftReview,
            onDirtyChange: setEditorDirty,
            onOpenLorebook: openSpatialLorebook,
            onLorebooksChanged: refreshLorebooks,
            onClose: closeSpatialMapDetail,
          }}
        />
      ) : null}

      {/* First-time onboarding tutorial */}
      {!hasCompletedOnboarding && (
        <Suspense fallback={null}>
          <OnboardingTutorial />
        </Suspense>
      )}
      <ProfessorMariFloatingAssistantHost active={professorMariFloatingActive} />
      <div data-component="MobileMusicWidgetLayer" className="contents">
        {isMobile && showMusicDjUnavailablePlayer ? (
          <MusicDjUnavailablePlayer floating mobileOnly />
        ) : isMobile && musicDjInstalled ? (
          <>
            <SpotifyMobileWidget />
            <YouTubeMobileWidget />
            <LocalMusicMobileWidget />
          </>
        ) : null}
      </div>
    </div>
  );
}
