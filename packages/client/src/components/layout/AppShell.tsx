// ──────────────────────────────────────────────
// Layout: Main App Shell (Discord-like three-column)
// ──────────────────────────────────────────────
import { useKeepFocusOnPage } from "../../hooks/use-keep-focus-on-page";
import { useDeviceWalkthroughDue } from "../../hooks/use-device-walkthrough-due";
import { useCenterPageOpen } from "../../hooks/use-chat-theme";
import { useQueryClient } from "@tanstack/react-query";
import { preloadedLazy } from "../../lib/preloaded-lazy";
import { DelayedFallback } from "../ui/DelayedFallback";
import { ChatSidebar } from "./ChatSidebar";
import { TopBar } from "./TopBar";
import { GlobalOmnibar } from "./GlobalOmnibarHost";
import { YouTubeMobileWidget } from "../chat/YouTubePlayer";
import { LocalMusicMobileWidget } from "../chat/LocalMusicPlayer";
import { ChatResourceMobileDropDock } from "../chat/ChatResourceMobileDropDock";
import {
  getTrackerPanelWidthForProfile,
  isMobileShellViewport,
  MOBILE_SHELL_MEDIA_QUERY,
  OVERHAUL_MOBILE_SHELL_MEDIA_QUERY,
  RIGHT_PANEL_WIDTH_MAX,
  RIGHT_PANEL_WIDTH_MIN,
  selectSidebarShown,
  SIDEBAR_WIDTH_MAX,
  SIDEBAR_WIDTH_MIN,
  TRACKER_PANEL_DEFAULT_BACKGROUND_COLOR,
  useUIStore,
} from "../../stores/ui.store";
import { useDiscardNewChatSetup } from "../../hooks/use-discard-new-chat-setup";
import { useChatStore } from "../../stores/chat.store";
import { useDialogStore } from "../../stores/dialog.store";
import { useBackgroundAutonomousPolling } from "../../hooks/use-background-autonomous";
import { useChats, useClearAutonomousUnread, useUpdateChatMetadata } from "../../hooks/use-chats";
import { useSetupDraftJanitor } from "../../hooks/use-setup-drafts";
import { lorebookKeys } from "../../hooks/use-lorebooks";
import { useIdleDetection } from "../../hooks/use-idle-detection";
import { dispatchChatVisualViewportChange } from "../../hooks/use-visual-viewport-chat-bottom";
import { useKeepAnyFocusedFieldAboveKeyboard } from "../../hooks/use-keep-focused-field-above-keyboard";
import { usePageActivity } from "../../hooks/use-page-activity";
import { useCapabilityAgentRegistry, useCapabilityClientModules } from "../../hooks/use-capability-packages";
import { CapabilityElement } from "../capabilities/CapabilityElement";
import { FeatureAgentDetailHost } from "../agents/FeatureAgentDetailHost";
import { getCssBackgroundStyle } from "../../lib/css-colors";
import { resolveFeatureAgentPackage } from "../../lib/feature-agent-package";
import { showConfirmDialog } from "../../lib/app-dialogs";
import { isIosWebKitBrowser } from "../../lib/generation-stream-policy";
import { isTypingTarget } from "../../lib/keyboard-shortcuts";
import { cn } from "../../lib/utils";
import { parseChatMetadata } from "../../lib/chat-display";
import { openGlobalSearch } from "../../lib/chat-insights";
import { requestChatSummaryOpen } from "../../lib/chat-floating-ui-events";
import { resolveTrackerPanelContentScale, resolveTrackerPanelDesktopWidth } from "../../lib/tracker-panel-layout";
import {
  closeDetachedWindow,
  openDetachedWindow,
  DetachedWindow,
  type DetachedWindowTarget,
} from "../ui/DetachedWindow";
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
  use,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { SkipLinks } from "./SkipLinks";
import {
  CHAT_SETTINGS_WINDOW_ID,
  TRACKER_PANEL_BUBBLE_ID,
  useFloatingWindowStore,
} from "../../stores/floating-window.store";
import { useOverhaulStore } from "../../stores/overhaul.store";
import { loadOverhaulStyles, overhaulStylesReady, type OverhaulShell } from "../../lib/overhaul-styles";
import { preloadChatSurface } from "../chat/chat-surface-preload";
import { OverhaulTopBar } from "../overhaul/OverhaulTopBar";
import { SPLIT_PANE } from "../../lib/split-view-env";
import { SPLIT_DIVIDER, SPLIT_MIN_ROOM, clampSplitSize, useSplitRoom } from "../overhaul/split-view";
import { LIBRARY_SECTIONS, openLibrarySection } from "../overhaul/library-navigation";
import { OverhaulMobileTopBar } from "../overhaul/MobileTopBar";
import { OverhaulMobileTrackerStrip } from "../overhaul/MobileTrackerStrip";
import { closeTrackerPanel } from "../../lib/tracker-panel-surface";

const SpotifyMobileWidget = lazy(() =>
  import("../spotify/SpotifyMiniPlayer").then((module) => ({ default: module.SpotifyMobileWidget })),
);
const ChatArea = preloadedLazy(() => import("../chat/ChatArea").then((module) => module.ChatArea));
const CharacterEditor = preloadedLazy(() =>
  import("../characters/CharacterEditor").then((module) => module.CharacterEditor),
);
const CharacterLibraryView = preloadedLazy(() =>
  import("../characters/CharacterLibraryView").then((module) => module.CharacterLibraryView),
);
const AgentCatalogView = preloadedLazy(() =>
  import("../agents/AgentCatalogView").then((module) => module.AgentCatalogView),
);
const LorebookEditor = preloadedLazy(() =>
  import("../lorebooks/LorebookEditor").then((module) => module.LorebookEditor),
);
const PresetEditor = preloadedLazy(() => import("../presets/PresetEditor").then((module) => module.PresetEditor));
const ProfileEditor = preloadedLazy(() => import("../presets/ProfileEditor").then((module) => module.ProfileEditor));
const ConnectionEditor = preloadedLazy(() =>
  import("../connections/ConnectionEditor").then((module) => module.ConnectionEditor),
);
const AgentEditor = preloadedLazy(() => import("../agents/AgentEditor").then((module) => module.AgentEditor));
const ToolEditor = preloadedLazy(() => import("../agents/ToolEditor").then((module) => module.ToolEditor));
const PersonaEditor = preloadedLazy(() => import("../personas/PersonaEditor").then((module) => module.PersonaEditor));
const RegexScriptEditor = preloadedLazy(() =>
  import("../agents/RegexScriptEditor").then((module) => module.RegexScriptEditor),
);
const BotBrowserView = lazy(() =>
  import("../bot-browser/BotBrowserView").then((module) => ({ default: module.BotBrowserView })),
);
const GameAssetsBrowserView = lazy(() =>
  import("../game-assets/GameAssetsBrowserView").then((module) => ({ default: module.GameAssetsBrowserView })),
);
const RightPanel = preloadedLazy(() => import("./RightPanel").then((module) => module.RightPanel));
const OverhaulSchedulesPage = preloadedLazy(() =>
  import("../chat/CharacterScheduleManagerModal").then((module) => module.OverhaulSchedulesPage),
);
const OverhaulMariPage = preloadedLazy(() => import("../overhaul/MariPage").then((module) => module.OverhaulMariPage));
const OverhaulDocsPage = preloadedLazy(() => import("../overhaul/DocsPage").then((module) => module.OverhaulDocsPage));
const OvRegexViewer = preloadedLazy(() => import("../overhaul/LibraryViewers").then((module) => module.OvRegexViewer));
const OvToolsViewer = preloadedLazy(() => import("../overhaul/LibraryViewers").then((module) => module.OvToolsViewer));
const OvProfilesViewer = preloadedLazy(() =>
  import("../overhaul/ProfilesViewer").then((module) => module.OvProfilesViewer),
);
const OvConnectionsViewer = preloadedLazy(() =>
  import("../overhaul/LibraryViewers").then((module) => module.OvConnectionsViewer),
);
const OvConnectionPageMobile = preloadedLazy(() =>
  import("../overhaul/LibraryViewers").then((module) => module.OvConnectionPageMobile),
);
const LibraryLandingPage = preloadedLazy(() =>
  import("../overhaul/LibraryLandingPage").then((module) => module.LibraryLandingPage),
);
const TrackerDataSidebar = lazy(() =>
  import("./TrackerDataSidebar").then((module) => ({ default: module.TrackerDataSidebar })),
);
const ChatNotificationBubbles = lazy(() =>
  import("../chat/ChatNotificationBubbles").then((module) => ({ default: module.ChatNotificationBubbles })),
);

/** The docked Chat settings pane's width (overhaul.css .ov-cs--docked: min(27rem, 100vw - 22rem)). */
function dockedChatSettingsWidth(): number {
  if (typeof window === "undefined") return 0;
  const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  return Math.max(0, Math.round(Math.min(27 * rem, window.innerWidth - 22 * rem)));
}

const SplitSide = lazy(() => import("../overhaul/SplitView").then((module) => ({ default: module.SplitSide })));
const SplitDropOverlay = lazy(() =>
  import("../overhaul/SplitView").then((module) => ({ default: module.SplitDropOverlay })),
);
const SplitPaneBar = lazy(() => import("../overhaul/SplitView").then((module) => ({ default: module.SplitPaneBar })));
const DESKTOP_SIDEBAR_BEFORE_TOUCH_KEY = "marinara:desktop-sidebar-before-touch";

/** What the desktop sidebar showed ("chats" or a panel) when the phone layout closed it. */
function writeDesktopSidebarBeforeTouch(view: string) {
  try {
    window.localStorage.setItem(DESKTOP_SIDEBAR_BEFORE_TOUCH_KEY, view);
  } catch {
    // Restricted storage: rotating back then keeps today's closed sidebar.
  }
}

function takeDesktopSidebarBeforeTouch(): string | null {
  try {
    const view = window.localStorage.getItem(DESKTOP_SIDEBAR_BEFORE_TOUCH_KEY);
    window.localStorage.removeItem(DESKTOP_SIDEBAR_BEFORE_TOUCH_KEY);
    return view;
  } catch {
    return null;
  }
}

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
const TRACKER_PANEL_HUD_GAP = 6;
const TRACKER_PANEL_CHAT_GAP = 8;
// The narrowest docked Tracker Panel: its close, settings and help buttons still fit side by side (#7188).
const TRACKER_PANEL_MIN_DOCKED_WIDTH = 96;
// Matches the .mari-shell-panel-slot width transition in globals.css.
const SHELL_PANEL_SLIDE_MS = 220;
const TRACKER_PANEL_DESKTOP_MOTION_MS = 260;
const TRACKER_PANEL_DESKTOP_EXIT_MS = 240;
const TRACKER_PANEL_DESKTOP_EASE = [0.16, 1, 0.3, 1] as const;
const TRACKER_PANEL_DESKTOP_EXIT_EASE = [0.4, 0, 1, 1] as const;
const TRACKER_PANEL_TOGGLE_SELECTOR = '[data-tracker-panel-toggle="bubble"]';
const TRACKER_PANEL_ANCHOR_SELECTOR = '[data-tracker-panel-anchor="roleplay-hud"]';
const ROLEPLAY_CHAT_COLUMN_SELECTOR = '[data-roleplay-chat-column="true"]';
const TOP_BAR_SELECTOR = '[data-component="TopBar"]';
// Below the TopBar, whose height a sideways phone shortens (--mari-topbar-height in globals.css).
const MOBILE_SHELL_PANEL_TOP_CLASS = "top-[calc(env(safe-area-inset-top)_+_var(--mari-topbar-height,3rem))]";
// Phone sheets fill the width the shell has: a phone turned sideways keeps its camera insets clear.
const MOBILE_SHELL_PANEL_X_CLASS = "left-(--mari-shell-inset-left) right-(--mari-shell-inset-right)";
const MOBILE_SHELL_PANEL_BOTTOM_PADDING_CLASS =
  "pb-[min(max(var(--mari-safe-area-inset-bottom,env(safe-area-inset-bottom)),0.5rem),3rem)]";
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

/** The focused element, looking inside open shadow roots (a field in one leaves its host as document.activeElement). */
function deepActiveElement(): Element | null {
  let active = document.activeElement;
  while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
  return active;
}

function getViewportWidth() {
  return typeof window === "undefined" ? 0 : window.innerWidth;
}

function MainPaneFallback() {
  const { t: localizeUi } = useUiTranslation();
  return (
    <DelayedFallback>
      <div className="mari-chrome-text-muted flex flex-1 items-center justify-center text-sm">
        {localizeUi("ui.characters.characterlibraryview.loading")}
      </div>
    </DelayedFallback>
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
    <DelayedFallback>
      <div className="mari-chrome-text-muted flex h-full items-center justify-center text-sm">
        {localizeUi("ui.characters.characterlibraryview.loading")}
      </div>
    </DelayedFallback>
  );
}

export function AppShell({
  chatWindowIntroAllowed = false,
  onChatWindowIntroOpenChange,
}: {
  chatWindowIntroAllowed?: boolean;
  onChatWindowIntroOpenChange?: (open: boolean) => void;
}) {
  // A11Y19: a page change never leaves keyboard focus on <body>.
  useKeepFocusOnPage();
  // Load the chat view and right panel while idle, so the first chat or panel open does not wait for code.
  useEffect(() => {
    const preload = () => {
      // A failed preload only means the click loads the code; the lazy import reports real failures.
      ChatArea.preload().catch(() => undefined);
      RightPanel.preload().catch(() => undefined);
      // Library pages and Settings open without a "Loading…" page first (QC Nov 14 #2).
      LibraryLandingPage.preload().catch(() => undefined);
      import("../overhaul/LibraryLandingPage").then((module) => module.preloadLibraryPages()).catch(() => undefined);
    };
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(preload, { timeout: 5_000 });
      return () => window.cancelIdleCallback(id);
    }
    const timer = window.setTimeout(preload, 2_000);
    return () => window.clearTimeout(timer);
  }, []);
  // Editors load once the Library is opened (or an editor tab is open), so opening or switching to an
  // editor never shows an empty frame or "Loading…" first (QC Nov 14 #2, #5).
  const editorsWanted = useOverhaulStore(
    (state) =>
      state.sidePane === "library" ||
      state.mobileSidePageOpen ||
      state.tabs.some((tab) => tab.kind !== "chat" && tab.kind !== "app"),
  );
  useEffect(() => {
    if (!editorsWanted) return;
    const preload = () => {
      for (const editor of [
        CharacterEditor,
        CharacterLibraryView,
        PersonaEditor,
        LorebookEditor,
        PresetEditor,
        ConnectionEditor,
        RegexScriptEditor,
        AgentEditor,
        ToolEditor,
        AgentCatalogView,
        OvRegexViewer,
        OvToolsViewer,
        OvProfilesViewer,
        OvConnectionsViewer,
        OverhaulDocsPage,
      ]) {
        editor.preload().catch(() => undefined);
      }
    };
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(preload, { timeout: 1_500 });
      return () => window.cancelIdleCallback(id);
    }
    const timer = window.setTimeout(preload, 300);
    return () => window.clearTimeout(timer);
  }, [editorsWanted]);
  const { t: localizeUi } = useUiTranslation();
  const chatWindowIntroNavigationBlocked = useUIStore((state) => state.hasAnyDetailOpen());
  const queryClient = useQueryClient();
  const capabilityAgents = useCapabilityAgentRegistry();
  const installedCapabilities = useCapabilityClientModules();
  const updateChatMetadata = useUpdateChatMetadata();
  const musicDjInstalled = (installedCapabilities.data ?? []).some(
    (capability) => capability.id === "spotify" && capability.status === "active",
  );

  // Background autonomous polling for inactive conversation chats
  useBackgroundAutonomousPolling();

  // Auto idle detection (10 min inactivity → idle, activity → active)
  useIdleDetection();
  // Editors, sheets and dialogs: the field being typed in stays above the on-screen keyboard.
  useKeepAnyFocusedFieldAboveKeyboard();

  useEffect(() => {
    const handleGlobalSearchShortcut = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.isComposing ||
        event.repeat ||
        !event.shiftKey ||
        event.altKey ||
        !(event.ctrlKey || event.metaKey) ||
        event.key.toLowerCase() !== "f"
      ) {
        return;
      }

      const target = event.target;
      if (target instanceof HTMLElement && target.isContentEditable) return;
      if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return;
      if (
        target instanceof HTMLInputElement &&
        !["button", "checkbox", "color", "file", "hidden", "radio", "range", "reset", "submit"].includes(target.type)
      ) {
        return;
      }
      if (useUIStore.getState().modal || useDialogStore.getState().dialog) return;

      event.preventDefault();
      openGlobalSearch();
    };

    document.addEventListener("keydown", handleGlobalSearchShortcut);
    return () => document.removeEventListener("keydown", handleGlobalSearchShortcut);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return;
    const root = document.documentElement;
    let frame = 0;
    let focusTimers: number[] = [];
    let orientationTimers: number[] = [];
    let largestViewportHeight = 0;
    let viewportWidth = window.innerWidth;
    let previousLayoutHeight = root.clientHeight || window.innerHeight;
    // Set once focus has left every text field while the keyboard is still up (Search closed, a field
    // blurred): the app takes its full height in one step instead of following the closing keyboard
    // step by step, which moved the chat behind in 5-8 jumps.
    let keyboardDismissed = false;
    let dismissTimer = 0;
    const supportsVirtualKeyboard = navigator.maxTouchPoints > 0 || window.matchMedia("(any-pointer: coarse)").matches;
    const isIosWebKit = isIosWebKitBrowser(navigator.userAgent, navigator.platform, navigator.maxTouchPoints);
    // An iPhone Home Screen app: no browser toolbars, so the layout viewport is the whole screen the app may use.
    const isIosHomeScreenApp =
      isIosWebKit &&
      (window.matchMedia("(display-mode: standalone)").matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone === true);
    root.toggleAttribute("data-mari-ios-webkit", isIosWebKit);
    // Safari zooms the whole page into any field whose text is under 16 px and leaves it zoomed (Nov 15:
    // the chat setup zoomed in on its Name field). maximum-scale stops that zoom; iOS still lets people
    // pinch-zoom, so nobody loses zooming. Only on iPhone/iPad Safari: Android would block pinch-zoom.
    const viewportMeta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
    const viewportBefore = viewportMeta?.content ?? null;
    if (isIosWebKit && viewportMeta && !/maximum-scale/.test(viewportMeta.content))
      viewportMeta.content = `${viewportMeta.content}, maximum-scale=1`;
    const updateVisualViewportGeometry = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        frame = 0;
        // iPhone safe areas are symmetric in landscape, although the camera is on one edge.
        // Prefer its legacy angle: older Safari inverted ScreenOrientation.angle.
        const angle = window.orientation ?? window.screen.orientation?.angle;
        const cameraSide = /iPhone|iPod/iu.test(navigator.userAgent)
          ? angle === 90
            ? "left"
            : angle === -90 || angle === 270
              ? "right"
              : null
          : null;
        if (cameraSide) root.setAttribute("data-mari-camera-side", cameraSide);
        else root.removeAttribute("data-mari-camera-side");
        const viewport = window.visualViewport;
        const scale = viewport && Number.isFinite(viewport.scale) && viewport.scale > 0 ? viewport.scale : 1;
        // Compare heights at the same zoom level so pinch zoom alone does not
        // look like a keyboard. Keyboard changes must still update a zoomed chat.
        const heightCandidates = [
          viewport ? viewport.height * scale : undefined,
          window.innerHeight,
          root.clientHeight,
        ].filter((value): value is number => typeof value === "number" && Number.isFinite(value) && value > 0);
        const unzoomedHeight = heightCandidates.length > 0 ? Math.min(...heightCandidates) : window.innerHeight;
        const currentLayoutHeight = root.clientHeight || window.innerHeight;
        // Account for split-view resizing without losing an already-open
        // keyboard's height. Height-only keyboard changes retain the baseline.
        // ponytail: with resizes-content, a keyboard change in the same sample
        // as a width change shifts the baseline too; the page has no signal to
        // split them. Upgrade path: keyboard geometry from the VirtualKeyboard API.
        if (window.innerWidth !== viewportWidth) {
          viewportWidth = window.innerWidth;
          largestViewportHeight += currentLayoutHeight - previousLayoutHeight;
        }
        previousLayoutHeight = currentLayoutHeight;
        largestViewportHeight = Math.max(largestViewportHeight, unzoomedHeight);
        const keyboardReported = supportsVirtualKeyboard && largestViewportHeight - unzoomedHeight >= 80;
        // Stays set until the keyboard is fully down, so its last steps do not move the app either.
        if (largestViewportHeight - unzoomedHeight < 2 || isTypingTarget(deepActiveElement())) {
          keyboardDismissed = false;
        }
        const keyboardOpen = keyboardReported && !keyboardDismissed;
        // An iPhone Home Screen app with its keyboard closed has nothing to fit, yet iOS can go on reporting a visual
        // viewport a status bar short (or with a stale offsetTop), and leave the page scrolled where the keyboard put
        // it, until the app is restarted. Sized from that, the whole app stopped short with the page backing in a grey
        // band below it. There, size it from the layout viewport alone, at the top, and undo the leftover scroll.
        // A focused field keeps the fit: an iPad's hardware-keyboard shortcut bar is shorter than the 80 px above.
        // ponytail: a layout viewport (innerHeight) that iOS reports short as well still leaves the band; nothing on
        // the page measures the screen any better. Upgrade path: size from screen geometry once a device shows it.
        const settledHomeScreen = isIosHomeScreenApp && !keyboardOpen && !isTypingTarget(deepActiveElement());
        // Preserve normal pinch magnification, but fit the visible area while
        // the keyboard is open. Closing it restores the layout even while zoomed.
        const height =
          keyboardOpen && viewport && viewport.height > 0
            ? Math.min(unzoomedHeight, viewport.height)
            : settledHomeScreen || keyboardDismissed
              ? Math.min(window.innerHeight, root.clientHeight || window.innerHeight)
              : unzoomedHeight;
        const layoutViewportHeight = isIosWebKit ? largestViewportHeight : window.innerHeight;
        const maxOffsetTop = Math.max(0, layoutViewportHeight - height);
        const visualViewportTop = Math.max(0, viewport?.offsetTop ?? 0, viewport?.pageTop ?? 0);
        const offsetTop = settledHomeScreen ? 0 : Math.min(maxOffsetTop, visualViewportTop);
        // Only at normal zoom: a pinch-zoomed page pans on purpose.
        if (settledHomeScreen && Math.abs(scale - 1) < 0.01 && window.scrollY !== 0) window.scrollTo(0, 0);
        root.style.setProperty("--mari-visual-viewport-height", `${Math.max(0, Math.round(height))}px`);
        root.style.setProperty("--mari-visual-viewport-offset-top", `${Math.round(offsetTop)}px`);
        root.toggleAttribute("data-mari-software-keyboard-open", keyboardOpen);
        dispatchChatVisualViewportChange({
          height,
          offsetTop,
          keyboardOpen,
        });
      });
    };
    const noteKeyboardDismissal = (event: FocusEvent) => {
      window.clearTimeout(dismissTimer);
      // Focus landing on a button (Search hands focus back to what opened it) still closes the keyboard.
      // A field inside a shadow root retargets the event to its host, so look along the whole path.
      if (event.type === "focusin" && event.composedPath().some((target) => isTypingTarget(target as Element))) return;
      const dismiss = () => {
        if (!root.hasAttribute("data-mari-software-keyboard-open") || isTypingTarget(deepActiveElement())) return;
        keyboardDismissed = true;
        updateVisualViewportGeometry();
      };
      // Focus landing on something else is certain at once, so the page closing with it (Search) and the
      // full-height app show in the same frame.
      if (event.type === "focusin") dismiss();
      // Moving between two fields blurs one before focusing the next; only a blur that stays counts.
      else dismissTimer = window.setTimeout(dismiss, 0);
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
    window.screen.orientation?.addEventListener("change", refreshAfterOrientationChange);
    // Entering or leaving the browser's fullscreen (a Home package's, HomeBrowserHub) changes the viewport by the
    // browser's own bars, which is no software keyboard either.
    document.addEventListener("fullscreenchange", refreshAfterOrientationChange);
    document.addEventListener("focusin", refreshAfterFocusChange);
    document.addEventListener("focusout", refreshAfterFocusChange);
    document.addEventListener("focusin", noteKeyboardDismissal);
    document.addEventListener("focusout", noteKeyboardDismissal);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.clearTimeout(dismissTimer);
      document.removeEventListener("focusin", noteKeyboardDismissal);
      document.removeEventListener("focusout", noteKeyboardDismissal);
      focusTimers.forEach((timer) => window.clearTimeout(timer));
      orientationTimers.forEach((timer) => window.clearTimeout(timer));
      window.visualViewport?.removeEventListener("resize", updateVisualViewportGeometry);
      window.visualViewport?.removeEventListener("scroll", updateVisualViewportGeometry);
      window.removeEventListener("resize", updateVisualViewportGeometry);
      window.removeEventListener("orientationchange", refreshAfterOrientationChange);
      window.screen.orientation?.removeEventListener("change", refreshAfterOrientationChange);
      document.removeEventListener("fullscreenchange", refreshAfterOrientationChange);
      document.removeEventListener("focusin", refreshAfterFocusChange);
      document.removeEventListener("focusout", refreshAfterFocusChange);
      root.style.removeProperty("--mari-visual-viewport-height");
      root.style.removeProperty("--mari-visual-viewport-offset-top");
      root.removeAttribute("data-mari-ios-webkit");
      if (viewportMeta && viewportBefore !== null) viewportMeta.content = viewportBefore;
      root.removeAttribute("data-mari-camera-side");
      root.removeAttribute("data-mari-software-keyboard-open");
    };
  }, []);

  const sidebarOpen = useUIStore(selectSidebarShown);
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
  const closeAllDetails = useUIStore((s) => s.closeAllDetails);
  const openPresetDetail = useUIStore((s) => s.openPresetDetail);
  const openRightPanel = useUIStore((s) => s.openRightPanel);
  const openAgentCatalog = useUIStore((s) => s.openAgentCatalog);
  const setTrackerPanelOpen = useUIStore((s) => s.setTrackerPanelOpen);
  const restoreTrackerPanelOpenForChat = useUIStore((s) => s.restoreTrackerPanelOpenForChat);
  const trackerPanelSurfaceOpen = useFloatingWindowStore((s) => s.open[TRACKER_PANEL_BUBBLE_ID] === true);
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
  const closeFeatureDetail = useCallback(() => {
    // Popping back to another surface leaves the agents panel out of sight, so it only opens when nothing was popped.
    const returnsToSurface = useUIStore.getState().mainSurfaceHistory.length > 0;
    closeAgentDetail();
    if (!returnsToSurface) openRightPanel("agents");
  }, [closeAgentDetail, openRightPanel]);
  const [sidebarDragWidth, setSidebarDragWidth] = useState<number | null>(null);
  const [rightPanelDragWidth, setRightPanelDragWidth] = useState<number | null>(null);
  const sidebarDragWidthRef = useRef<number | null>(null);
  const rightPanelDragWidthRef = useRef<number | null>(null);
  const sharedSidebarWidth = clampWidth(
    rightPanelWidth || sidebarWidth,
    SHARED_SIDEBAR_WIDTH_MIN,
    SHARED_SIDEBAR_WIDTH_MAX,
  );
  // Kept in state: reading window.innerWidth while rendering forced a full page layout each time the shell redrew.
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
  // The side panes grow with Display Size, so their text keeps fitting (theming panel H4). The stored
  // width is the one at the default size; what's on screen is that times the text scale, up to 38%
  // of the window each.
  const uiFontSize = useUIStore((s) => s.fontSize);
  const sidebarScale = Math.max(0.7, uiFontSize / 17);
  const sidebarDisplayMax = Math.max(
    SHARED_SIDEBAR_WIDTH_MIN,
    Math.min(SHARED_SIDEBAR_WIDTH_MAX * sidebarScale, viewportWidth * 0.38),
  );
  const scaledSidebarWidth = clampWidth(sharedSidebarWidth * sidebarScale, SHARED_SIDEBAR_WIDTH_MIN, sidebarDisplayMax);
  const storedSidebarWidth = (displayWidth: number) =>
    clampWidth(Math.round(displayWidth / sidebarScale), SHARED_SIDEBAR_WIDTH_MIN, SHARED_SIDEBAR_WIDTH_MAX);
  const liveSidebarWidth = sidebarDragWidth ?? rightPanelDragWidth ?? scaledSidebarWidth;
  const liveRightPanelWidth = rightPanelDragWidth ?? sidebarDragWidth ?? scaledSidebarWidth;
  const trackerPanelWidth = getTrackerPanelWidthForProfile(trackerPanelSizeProfile);
  const [trackerPanelResolvedWidth, setTrackerPanelResolvedWidth] = useState(trackerPanelWidth);
  const [trackerPanelWidthMeasured, setTrackerPanelWidthMeasured] = useState(false);
  const [trackerPanelWindowTarget, setDetachedWindowTarget] = useState<DetachedWindowTarget | null>(null);
  const trackerPanelWindowTargetRef = useRef<DetachedWindowTarget | null>(null);
  const trackerPanelDockingPopupRef = useRef<DetachedWindowTarget["popup"] | null>(null);
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

  // Use the same available-width decision as navigation and back dismissal.
  const [isMobile, setIsMobile] = useState(isMobileShellViewport);
  useEffect(() => {
    // Both queries: the overhaul's (touch tablets in landscape get the desktop shell) and the classic one.
    const queries = [window.matchMedia(MOBILE_SHELL_MEDIA_QUERY), window.matchMedia(OVERHAUL_MOBILE_SHELL_MEDIA_QUERY)];
    const handler = () => setIsMobile(isMobileShellViewport());
    handler();
    queries.forEach((mq) => mq.addEventListener("change", handler));
    window.addEventListener("resize", handler);
    const unsubscribeOverhaul = useOverhaulStore.subscribe((state, prev) => {
      if (state.enabled !== prev.enabled) handler();
    });
    return () => {
      queries.forEach((mq) => mq.removeEventListener("change", handler));
      window.removeEventListener("resize", handler);
      unsubscribeOverhaul();
    };
  }, [sharedSidebarWidth]);

  const shellOverlayMode = isMobile;
  // UI overhaul preview: the desktop shell gets the tab bar and panes; phones and tablets get the
  // mobile overhaul (top bar with the Library Stack, All Tabs viewer) over the standard overlay shell.
  const overhaulEnabled = useOverhaulStore((s) => s.enabled);
  const overhaulLibraryPage = useOverhaulStore((s) => s.libraryPage);
  const overhaulDocsTab = useOverhaulStore((s) => s.activeDocsTab);
  const overhaulMari = useOverhaulStore((s) => s.activeMari);
  const overhaulSchedules = useOverhaulStore((s) => s.activeSchedules);
  const overhaulActive = overhaulEnabled && !shellOverlayMode;
  const overhaulMobile = overhaulEnabled && shellOverlayMode;
  const homeBrowserFullscreen = useUIStore((s) => s.homeBrowserFullscreen);
  // Split view (desktop only): a second page beside the main one, when both fit.
  const split = useOverhaulStore((s) => s.split);
  const splitDragging = useOverhaulStore((s) => s.splitDrag !== null);
  // Docked Chat settings takes the Library pane's slot beside a split, instead of floating over the second side
  // (QC panel 2, D7). Only while both sides still fit next to it; a narrower window lets it float as before.
  const chatSettingsOpen = useFloatingWindowStore((s) => s.open[CHAT_SETTINGS_WINDOW_ID] === true);
  const chatSettingsFloating = useOverhaulStore((s) => s.chatSettingsFloating);
  const splitRoomBase = useSplitRoom(
    sidebarOpen && !overhaulActive ? liveSidebarWidth : 0,
    rightPanelOpen ? liveRightPanelWidth : 0,
  );
  const chatSettingsSlot =
    overhaulActive && !SPLIT_PANE && split !== null && chatSettingsOpen && !chatSettingsFloating && !rightPanelOpen
      ? dockedChatSettingsWidth()
      : 0;
  const chatSettingsTakesSlot = chatSettingsSlot > 0 && splitRoomBase - chatSettingsSlot >= SPLIT_MIN_ROOM;
  const splitRoom = chatSettingsTakesSlot ? splitRoomBase - chatSettingsSlot : splitRoomBase;
  const splitFits = overhaulActive && !SPLIT_PANE && splitRoom >= SPLIT_MIN_ROOM;
  const splitOn = splitFits && split !== null;
  const splitSize = split ? clampSplitSize(split.size, splitRoom) : 0.5;
  // Opening, closing or resizing the Library pane leaves the second side as wide as it was: the main side
  // takes the change. Sharing it made the second side cross its touch-layout width, so the page there
  // swapped layouts each time the pane opened or closed and looked like it reloaded (Nov 14 finding).
  // Chat settings taking or giving back that slot (often swapping with the Library pane) keeps the divider where it
  // is instead: the left side keeps its width and the right side takes the change (QC panel 2, D7: it jumped
  // 320 px).
  const splitWidthRef = useRef<{
    px: number;
    size: number;
    room: number;
    viewport: number;
    csSlot: boolean;
    /** When Chat settings last took or gave back the slot; the Library pane coming back right after is the swap. */
    csChangedAt: number;
  } | null>(null);
  useLayoutEffect(() => {
    if (!splitOn || !split) {
      splitWidthRef.current = null;
      return;
    }
    const usable = Math.max(1, splitRoom - SPLIT_DIVIDER);
    const viewport = window.innerWidth;
    const last = splitWidthRef.current;
    if (last && last.size === split.size && last.viewport === viewport && last.room !== splitRoom) {
      let size: number;
      const now = performance.now();
      const csChanged = last.csSlot !== chatSettingsTakesSlot;
      const csChangedAt = csChanged ? now : last.csChangedAt;
      if (csChanged || now - last.csChangedAt < 600) {
        const lastUsable = Math.max(1, last.room - SPLIT_DIVIDER);
        const secondLeft = split.side === "left";
        const leftPx = secondLeft ? last.px : lastUsable - last.px;
        size = clampSplitSize(secondLeft ? leftPx / usable : 1 - leftPx / usable, splitRoom);
      } else size = clampSplitSize(last.px / usable, splitRoom);
      splitWidthRef.current = {
        px: size * usable,
        size,
        room: splitRoom,
        viewport,
        csSlot: chatSettingsTakesSlot,
        csChangedAt,
      };
      if (size !== split.size) useOverhaulStore.getState().setSplit({ ...split, size });
      return;
    }
    if (last && last.size === split.size && last.viewport === viewport && last.room === splitRoom) {
      if (last.csSlot !== chatSettingsTakesSlot) {
        last.csSlot = chatSettingsTakesSlot;
        last.csChangedAt = performance.now();
      }
      return;
    }
    splitWidthRef.current = {
      px: splitSize * usable,
      size: split.size,
      room: splitRoom,
      viewport,
      csSlot: chatSettingsTakesSlot,
      csChangedAt: 0,
    };
  }, [chatSettingsTakesSlot, splitOn, split, splitRoom, splitSize]);
  useEffect(() => {
    document.documentElement.toggleAttribute("data-ov-split", splitOn);
    useOverhaulStore.setState({ splitShown: splitOn, splitRoom: splitFits });
    return () => document.documentElement.removeAttribute("data-ov-split");
  }, [splitFits, splitOn]);
  // Pages the overhaul adds (Library landing pages, Settings tabs, Docs, Mari, Schedules) show on both.
  const overhaulPages = overhaulActive || overhaulMobile;
  // The new layout's stylesheets load on demand (lib/overhaul-styles.ts). Wait for this shell's before
  // drawing it, so it never shows unstyled; App starts the download before this chunk arrives.
  const overhaulShell: OverhaulShell | null = overhaulActive ? "desktop" : overhaulMobile ? "mobile" : null;
  if (overhaulShell && !overhaulStylesReady(overhaulShell)) use(loadOverhaulStyles(overhaulShell));
  // Classic layout: a few shared dialogs (Add account, Peek Prompt...) use the new layout's classes, so
  // its stylesheet still arrives, just after startup instead of in the way of it.
  useEffect(() => {
    if (overhaulEnabled) return;
    const load = () => void loadOverhaulStyles("desktop").catch(() => undefined);
    const idle = (window as Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number })
      .requestIdleCallback;
    if (idle) idle(load, { timeout: 4000 });
    else window.setTimeout(load, 2000);
  }, [overhaulEnabled]);
  useEffect(() => {
    useOverhaulStore.getState().setDesktop(!isMobile);
    // The chat list is a sidebar in the desktop shell but a full-screen sheet in the phone shell: a tablet
    // turned upright (now, or since it was last open) starts on its chat, not under the list it left open
    // sideways (user panel 2, N18).
    let lastShell: string | null = null;
    try {
      lastShell = localStorage.getItem("marinara-last-shell");
      localStorage.setItem("marinara-last-shell", isMobile ? "mobile" : "desktop");
    } catch {
      /* storage blocked */
    }
    if (isMobile && lastShell === "desktop" && useUIStore.getState().sidebarOpen) {
      useUIStore.setState({ sidebarOpen: false });
    }
    // A touch screen can turn into the other shell at any moment: have the phone stylesheet ready, so the
    // first rotation doesn't show a blank frame while it downloads.
    if (!isMobile && overhaulEnabled && window.matchMedia?.("(hover: none) and (pointer: coarse)").matches) {
      const idle = (window as Window & { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback;
      const load = () => void loadOverhaulStyles("mobile").catch(() => undefined);
      if (idle) idle(load);
      else window.setTimeout(load, 2000);
    }
  }, [isMobile, overhaulEnabled]);
  // New layout: fetch the Library pages in the background once the app is idle, so opening one
  // from the Stack or a tab shows it straight away instead of "Loading…".
  useEffect(() => {
    if (!overhaulEnabled) return;
    const preload = () => {
      // Library pages and viewers first, then the editors they open, so neither shows "Loading…".
      void LibraryLandingPage.preload();
      void Promise.all([
        CharacterLibraryView.preload(),
        AgentCatalogView.preload(),
        OvRegexViewer.preload(),
        OvToolsViewer.preload(),
        OvProfilesViewer.preload(),
        OvConnectionsViewer.preload(),
      ]).then(() => {
        for (const editor of [
          CharacterEditor,
          PersonaEditor,
          LorebookEditor,
          PresetEditor,
          RegexScriptEditor,
          ConnectionEditor,
          AgentEditor,
          ToolEditor,
        ])
          void editor.preload();
      });
      // Opening a chat is the next step almost every time: fetch the chat surfaces now, not on the click.
      preloadChatSurface("roleplay");
      preloadChatSurface("conversation");
    };
    const idle = (window as Window & { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback;
    if (idle) idle(preload);
    else window.setTimeout(preload, 1500);
  }, [overhaulEnabled]);
  useEffect(() => {
    if (!overhaulActive && !overhaulMobile) return;
    document.documentElement.dataset.overhaul = overhaulActive ? "on" : "mobile";
    return () => {
      delete document.documentElement.dataset.overhaul;
    };
  }, [overhaulActive, overhaulMobile]);
  // Opening a chat leaves the Library landing page.
  useEffect(() => {
    let previous = useChatStore.getState().activeChatId;
    return useChatStore.subscribe((state) => {
      if (state.activeChatId === previous) return;
      previous = state.activeChatId;
      if (state.activeChatId) {
        useOverhaulStore.getState().setLibraryPage(null);
        useOverhaulStore.getState().setLibraryHubReturn(false);
      }
    });
  }, []);
  // New layout on phones: the old right panel (Connections, Presets... lists) never shows. Anything
  // that opens it lands on that section's Library page instead. A window shrinking into the phone
  // layout keeps the page it shows (a Docs guide, Mari, a chat): the desktop sidebar is always open,
  // so it only becomes the section's page when that pane was on its Library view beside plain Home.
  // Turning an iPad from portrait (phone layout) to landscape (desktop layout) brought the desktop layout back
  // without its sidebar: the phone layout closes the sidebar, and that closed state is what the desktop then read
  // (QC Nov 21, MOB11). The phone layout notes what the desktop sidebar showed before it closed it (kept across a
  // reload, so a portrait start works too), and growing back to the desktop layout puts it back.
  const sidebarRestoreBeforeRef = useRef(overhaulMobile);
  useEffect(() => {
    const grew = !overhaulMobile && sidebarRestoreBeforeRef.current;
    sidebarRestoreBeforeRef.current = overhaulMobile;
    if (overhaulMobile) {
      const ui = useUIStore.getState();
      if (ui.rightPanelOpen || ui.sidebarOpen) {
        writeDesktopSidebarBeforeTouch(ui.rightPanelOpen ? ui.rightPanel : "chats");
      }
      return;
    }
    if (!grew || !overhaulActive) return;
    const saved = takeDesktopSidebarBeforeTouch();
    const ui = useUIStore.getState();
    if (!saved || ui.rightPanelOpen || ui.sidebarOpen) return;
    if (saved === "chats") ui.setSidebarOpen(true);
    else ui.openRightPanel(saved as Parameters<typeof ui.openRightPanel>[0]);
  }, [overhaulActive, overhaulMobile]);
  const overhaulMobileBeforeRef = useRef(overhaulMobile);
  useEffect(() => {
    const shrank = overhaulMobile && !overhaulMobileBeforeRef.current;
    overhaulMobileBeforeRef.current = overhaulMobile;
    if (!overhaulMobile || !rightPanelOpen) return;
    const ui = useUIStore.getState();
    const panel = ui.rightPanel;
    ui.closeRightPanel();
    if (shrank) {
      const overhaul = useOverhaulStore.getState();
      const onPlainHome =
        overhaul.sidePane === "library" &&
        !overhaul.activeDocsTab &&
        !overhaul.activeMari &&
        !overhaul.activeSchedules &&
        !overhaul.activeApp &&
        !overhaul.libraryPage &&
        !useChatStore.getState().activeChatId &&
        // An open editor (or the Characters / Personas gallery) is not plain Home: reopening the section would pop
        // it and lose a draft when an iPad turns to portrait mid-edit (QC Nov 22).
        !ui.hasAnyDetailOpen();
      if (!onPlainHome) return;
    }
    if (LIBRARY_SECTIONS.some((section) => section.id === panel)) {
      openLibrarySection(panel as (typeof LIBRARY_SECTIONS)[number]["id"]);
    }
  }, [overhaulMobile, rightPanelOpen]);
  const mobileNavigationPanel = shellOverlayMode
    ? rightPanelOpen && !overhaulMobile
      ? "right"
      : sidebarOpen && !overhaulMobile
        ? "chats"
        : null
    : null;
  const [rightPanelEverOpened, setRightPanelEverOpened] = useState(rightPanelOpen);
  useEffect(() => {
    if (rightPanelOpen) setRightPanelEverOpened(true);
  }, [rightPanelOpen]);
  // The editors and library views open from the right panel: a moment after it first opens (not during
  // its own render), fetch their code while idle, so opening one renders at once without "Loading…".
  useEffect(() => {
    if (!rightPanelEverOpened) return;
    const preload = () => {
      for (const view of [
        CharacterEditor,
        CharacterLibraryView,
        PersonaEditor,
        LorebookEditor,
        PresetEditor,
        ProfileEditor,
        ConnectionEditor,
        RegexScriptEditor,
        AgentEditor,
        ToolEditor,
        AgentCatalogView,
      ]) {
        view.preload().catch(() => undefined);
      }
    };
    let idleId = 0;
    const timer = window.setTimeout(() => {
      if (typeof window.requestIdleCallback === "function")
        idleId = window.requestIdleCallback(preload, { timeout: 2_000 });
      else preload();
    }, 1_000);
    return () => {
      window.clearTimeout(timer);
      if (idleId) window.cancelIdleCallback(idleId);
    };
  }, [rightPanelEverOpened]);

  // New layout: Chats live in the one sidebar on the right, so the left chat list never shows. Anything
  // that opens it (shortcuts, Home, the tour) opens that sidebar on its Chats view instead: the right
  // pane on a computer, the slide-over page on phones and tablets.
  // Consistency audit P6/T1: on phones and tablets the sidebar's saved or default "open" from before
  // this visit doesn't open the Chats page over Home (and over the welcome tour); only opening it now does.
  const sidebarOpenAtLoadRef = useRef(sidebarOpen);
  useEffect(() => {
    if (!sidebarOpen) sidebarOpenAtLoadRef.current = false;
    if (!sidebarOpen || (!overhaulActive && !overhaulMobile)) return;
    const ui = useUIStore.getState();
    // Already handed over (React's development double run of this effect): running it again would take the
    // load's "open" for a new one and open the Chats page over Home on phones.
    if (!ui.sidebarOpen) return;
    ui.setSidebarOpen(false);
    const overhaul = useOverhaulStore.getState();
    overhaul.setSidePane("chats");
    const fromLoad = sidebarOpenAtLoadRef.current;
    sidebarOpenAtLoadRef.current = false;
    if (overhaulMobile) {
      if (!fromLoad) overhaul.setMobileSidePageOpen(true);
    } else if (!ui.rightPanelOpen) ui.openRightPanel(ui.rightPanel === "chat" ? "characters" : ui.rightPanel);
  }, [sidebarOpen, overhaulActive, overhaulMobile]);
  // The phone page belongs to the phone layout: leaving it (a wider window) closes the page.
  useEffect(() => {
    if (!overhaulMobile) useOverhaulStore.getState().setMobileSidePageOpen(false);
  }, [overhaulMobile]);
  const layoutSidebarOpen = sidebarOpen && !overhaulActive;
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

  const chatUiInsetPublishedRef = useRef(false);
  // Only floating chat UI reads the insets, so with no chat open (Home, a Library page) they are not
  // written at all: a write to <html> re-styles the whole app, which on an iPad made every Show/Hide
  // sidebar tap on Home pay for a full re-style a moment after the slide (Nov 15). Opening a chat
  // publishes the current values in the same frame the chat first renders.
  const chatOpenForInsets = useChatStore((s) => s.activeChatId != null);
  const publishedChatUiInsetRef = useRef<string | null>(null);
  useLayoutEffect(() => {
    const root = document.documentElement;
    const value = `${chatUiInsetLeft}|${chatUiInsetRight}`;
    const publish = () => {
      chatUiInsetPublishedRef.current = true;
      if (publishedChatUiInsetRef.current === value) return;
      publishedChatUiInsetRef.current = value;
      root.style.setProperty("--mari-chat-ui-inset-left", `${chatUiInsetLeft}px`);
      root.style.setProperty("--mari-chat-ui-inset-right", `${chatUiInsetRight}px`);
    };
    if (!chatOpenForInsets) {
      // Nothing reads the values now; the next chat to open gets them at once.
      chatUiInsetPublishedRef.current = false;
      return;
    }
    // Matches the globals.css rules that turn the slide off (reduced motion, desktop Firefox): nothing to wait for.
    const noSlide =
      window.matchMedia("(prefers-reduced-motion: reduce)").matches || CSS.supports("-moz-appearance", "none");
    if (!chatUiInsetPublishedRef.current || noSlide) return publish();
    // A root style write restyles the whole app. Publish once a sidebar has slid or a resize drag has
    // paused, not in the frame that starts the slide or on every drag move. Only floating chat UI reads it.
    const timer = window.setTimeout(publish, SHELL_PANEL_SLIDE_MS);
    return () => window.clearTimeout(timer);
  }, [chatUiInsetLeft, chatUiInsetRight, chatOpenForInsets]);
  useLayoutEffect(
    () => () => {
      chatUiInsetPublishedRef.current = false;
      publishedChatUiInsetRef.current = null;
      document.documentElement.style.removeProperty("--mari-chat-ui-inset-left");
      document.documentElement.style.removeProperty("--mari-chat-ui-inset-right");
    },
    [],
  );

  // ── Center-area compact detection ──
  // Side panels can shrink the center pane below the chat chrome's usable desktop
  // width even when the viewport itself is desktop-sized. Switch that pane to the
  // compact chat layout before toolbar controls begin colliding.
  const mainRef = useRef<HTMLElement>(null);
  const overlayTrackerPanelRef = useRef<HTMLElement>(null);
  // New layout on phones: the Tracker sheet opens at part height and can be pulled to full height.
  const [trackerSheetFull, setTrackerSheetFull] = useState(false);
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
    // Measured at the start of a frame, where the browser lays the page out anyway; a bare timer
    // forced an extra full restyle between React's commits (each Chat settings open paid one).
    overflowTimerRef.current = setTimeout(() => window.requestAnimationFrame(checkOverflow), 100);
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
  const profileDetailId = useUIStore((s) => s.profileDetailId);
  const connectionDetailId = useUIStore((s) => s.connectionDetailId);
  const agentDetailId = useUIStore((s) => s.agentDetailId);
  const toolDetailId = useUIStore((s) => s.toolDetailId);
  const personaDetailId = useUIStore((s) => s.personaDetailId);
  const regexDetailId = useUIStore((s) => s.regexDetailId);
  const botBrowserOpen = useUIStore((s) => s.botBrowserOpen);
  const gameAssetsBrowserOpen = useUIStore((s) => s.gameAssetsBrowserOpen);
  const hasCompletedOnboarding = useUIStore((s) => s.hasCompletedOnboarding);
  const deviceWalkthroughDue = useDeviceWalkthroughDue();
  const activeChatId = useChatStore((s) => s.activeChatId);
  // Home remembers its tab for Back from an editor; opening a chat starts it over on the first tab, as leaving Home did.
  useEffect(() => {
    if (activeChatId) useUIStore.getState().setHomeTab("home");
  }, [activeChatId]);
  // Chat Settings reopens only for the chat it was opened from.
  useEffect(() => {
    const ui = useUIStore.getState();
    if (ui.chatSettingsReturn && ui.chatSettingsReturn.chatId !== activeChatId) ui.setChatSettingsReturn(null);
    if (ui.chatSettingsRequest && ui.chatSettingsRequest.chatId !== activeChatId) ui.consumeChatSettingsRequest();
  }, [activeChatId]);
  const discardNewChatSetup = useDiscardNewChatSetup();
  useEffect(
    () => () => {
      // Watch above the lazy wizard: navigation may happen before its first mount.
      // StrictMode probes and editor remounts leave the active id unchanged.
      if (activeChatId && useChatStore.getState().activeChatId !== activeChatId) {
        void discardNewChatSetup(activeChatId).catch(() => toast.error(localizeUi("chat.wizard.cancelFailed")));
      }
    },
    [activeChatId, discardNewChatSetup, localizeUi],
  );
  // New chats whose setup never finished are drafts: leaving one removes it (H1).
  const { data: chatList } = useChats({ refetchOnMount: false });
  useSetupDraftJanitor(chatList);
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
      selectedFeatureAgent ? resolveFeatureAgentPackage(selectedFeatureAgent, installedCapabilities.data ?? []) : null,
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
  const openChatSummarySettings = useCallback(() => {
    if (!activeChatId || activeChat?.mode !== "roleplay") return;
    const chatId = activeChatId;
    closeAllDetails();
    closeRightPanel();
    window.requestAnimationFrame(() => requestChatSummaryOpen(chatId));
  }, [activeChat?.mode, activeChatId, closeAllDetails, closeRightPanel]);
  const openActivePromptPresetEditor = useCallback(() => {
    const presetId = activeChat?.promptPresetId;
    if (!activeChat || !presetId) return;
    openPresetDetail(presetId, { initialTab: "sections" });
  }, [activeChat, openPresetDetail]);

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
      const originalUserSelect = document.body.style.userSelect;
      // The drag leaves the thin handle; the page keeps the resize cursor until it ends (globals.css, #8621).
      document.documentElement.dataset.marinaraResizing = "col";
      document.body.style.userSelect = "none";
      sidebarDragWidthRef.current = scaledSidebarWidth;
      setSidebarDragWidth(scaledSidebarWidth);

      const onMove = (moveEvent: MouseEvent) => {
        const nextWidth = clampWidth(moveEvent.clientX, SHARED_SIDEBAR_WIDTH_MIN, sidebarDisplayMax);
        sidebarDragWidthRef.current = nextWidth;
        setSidebarDragWidth(nextWidth);
      };
      let finished = false;
      const finishResize = () => {
        if (finished) return;
        finished = true;
        const nextWidth = storedSidebarWidth(sidebarDragWidthRef.current ?? scaledSidebarWidth);
        setSidebarWidth(nextWidth);
        setRightPanelWidth(nextWidth);
        sidebarDragWidthRef.current = null;
        setSidebarDragWidth(null);
        delete document.documentElement.dataset.marinaraResizing;
        document.body.style.userSelect = originalUserSelect;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", finishResize);
        window.removeEventListener("blur", finishResize);
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", finishResize);
      window.addEventListener("blur", finishResize);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- storedSidebarWidth follows sidebarScale
    [setRightPanelWidth, setSidebarWidth, scaledSidebarWidth, sidebarDisplayMax, sidebarScale, shellOverlayMode],
  );

  const startRightPanelResize = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      if (shellOverlayMode) return;
      event.preventDefault();
      const originalUserSelect = document.body.style.userSelect;
      // The drag leaves the thin handle; the page keeps the resize cursor until it ends (globals.css, #8621).
      document.documentElement.dataset.marinaraResizing = "col";
      document.body.style.userSelect = "none";
      rightPanelDragWidthRef.current = scaledSidebarWidth;
      setRightPanelDragWidth(scaledSidebarWidth);

      const onMove = (moveEvent: MouseEvent) => {
        const nextWidth = clampWidth(
          window.innerWidth - moveEvent.clientX,
          SHARED_SIDEBAR_WIDTH_MIN,
          sidebarDisplayMax,
        );
        rightPanelDragWidthRef.current = nextWidth;
        setRightPanelDragWidth(nextWidth);
      };
      let finished = false;
      const finishResize = () => {
        if (finished) return;
        finished = true;
        const nextWidth = storedSidebarWidth(rightPanelDragWidthRef.current ?? scaledSidebarWidth);
        setSidebarWidth(nextWidth);
        setRightPanelWidth(nextWidth);
        rightPanelDragWidthRef.current = null;
        setRightPanelDragWidth(null);
        delete document.documentElement.dataset.marinaraResizing;
        document.body.style.userSelect = originalUserSelect;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", finishResize);
        window.removeEventListener("blur", finishResize);
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", finishResize);
      window.addEventListener("blur", finishResize);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- storedSidebarWidth follows sidebarScale
    [setRightPanelWidth, setSidebarWidth, scaledSidebarWidth, sidebarDisplayMax, sidebarScale, shellOverlayMode],
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

  // UI overhaul: opening a chat, editor or library page leaves the Docs tab.
  const overhaulDocsLeaveKeyRef = useRef<string | null>(null);
  const overhaulDocsLeaveKey = [
    activeChatId,
    regexDetailId,
    personaDetailId,
    agentDetailId,
    connectionDetailId,
    presetDetailId,
    characterDetailId,
    lorebookDetailId,
    characterLibraryOpen ? cardLibraryKind : "",
  ].join("|");
  useEffect(() => {
    const previous = overhaulDocsLeaveKeyRef.current;
    overhaulDocsLeaveKeyRef.current = overhaulDocsLeaveKey;
    if (previous === null || previous === overhaulDocsLeaveKey) return;
    const opened = overhaulDocsLeaveKey
      .split("|")
      .some((value, index) => value && value !== previous.split("|")[index]);
    if (opened) useOverhaulStore.getState().leaveDocs();
  }, [overhaulDocsLeaveKey]);

  // UI overhaul: Regex scripts, Connections and Agents open in a master-detail viewer
  // (list on the left, the item's editor on the right), like the Preset editor.
  const ovOtherDetail = Boolean(
    personaDetailId ||
    presetDetailId ||
    characterDetailId ||
    characterLibraryOpen ||
    agentCatalogOpen ||
    lorebookDetailId,
  );
  const ovViewer: "regex" | "tools" | "profiles" | "connections" | "agents" | null = !overhaulActive
    ? // Phones have no Custom tools table, so the viewer is its page there too (it was blank).
      overhaulMobile && !ovOtherDetail && (toolDetailId || overhaulLibraryPage === "tools")
      ? "tools"
      : // Settings profiles: the list, then the open profile as its own page (ov-vw--drill).
        overhaulMobile && !ovOtherDetail && (profileDetailId || overhaulLibraryPage === "profiles")
        ? "profiles"
        : null
    : regexDetailId
      ? "regex"
      : toolDetailId
        ? "tools"
        : profileDetailId
          ? "profiles"
          : connectionDetailId
            ? "connections"
            : agentDetailId
              ? selectedFeatureAgent
                ? null
                : "agents"
              : !ovOtherDetail &&
                  // Connections opens on its accounts table (board "ConnList"); a Model opens the viewer.
                  // Agents opens on the Agent Organizer (it lists installed agents too); an agent opens its settings.
                  (overhaulLibraryPage === "regex" ||
                    overhaulLibraryPage === "tools" ||
                    overhaulLibraryPage === "profiles")
                ? overhaulLibraryPage
                : null;

  // Professor Mari's tab stays mounted once opened (rendered below, hidden while another page or Home shows):
  // remounting her whole chat on every visit cost ~0.5-2 s of long frames and 8 requests on an iPad (Nov 15).
  const mariPageActive = overhaulPages && overhaulMari && !overhaulSchedules;
  const [mariPageMounted, setMariPageMounted] = useState(false);
  if (mariPageActive && !mariPageMounted) setMariPageMounted(true);
  if (!overhaulPages && mariPageMounted) setMariPageMounted(false);

  const detailView =
    overhaulPages && overhaulSchedules ? (
      <OverhaulSchedulesPage />
    ) : mariPageActive ? null : overhaulPages && overhaulDocsTab ? (
      <OverhaulDocsPage key={overhaulDocsTab} tabId={overhaulDocsTab} />
    ) : ovViewer === "regex" ? (
      <OvRegexViewer>{regexDetailId ? <RegexScriptEditor key={regexDetailId} /> : null}</OvRegexViewer>
    ) : ovViewer === "tools" ? (
      <OvToolsViewer>{toolDetailId ? <ToolEditor key={toolDetailId} /> : null}</OvToolsViewer>
    ) : ovViewer === "profiles" ? (
      <OvProfilesViewer>{profileDetailId ? <ProfileEditor key={profileDetailId} /> : null}</OvProfilesViewer>
    ) : ovViewer === "connections" ? (
      <OvConnectionsViewer>
        {connectionDetailId ? <ConnectionEditor key={connectionDetailId} /> : null}
      </OvConnectionsViewer>
    ) : ovViewer === "agents" ? (
      // The Agent Organizer is the list now, so an agent's settings take the whole pane.
      capabilityAgents.isLoading ? (
        <MainPaneFallback />
      ) : (
        <AgentEditor key={agentDetailId ?? "new"} />
      )
    ) : overhaulPages && overhaulSchedules ? (
      <OverhaulSchedulesPage />
    ) : mariPageActive ? null : overhaulPages && overhaulDocsTab ? (
      <OverhaulDocsPage key={overhaulDocsTab} tabId={overhaulDocsTab} />
    ) : regexDetailId ? (
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
          onClose={closeFeatureDetail}
          onManagePackage={() => openAgentCatalog(selectedFeaturePackage?.id)}
          capabilityProps={{
            debugMode,
            confirmAction: showConfirmDialog,
            onDirtyChange: setEditorDirty,
            onOpenLorebook: openSpatialLorebook,
            onLorebooksChanged: refreshLorebooks,
            onOpenChatSummarySettings: activeChat?.mode === "roleplay" ? openChatSummarySettings : undefined,
            onOpenActivePromptPresetEditor: activeChat?.promptPresetId ? openActivePromptPresetEditor : undefined,
          }}
        />
      ) : (
        <AgentEditor />
      )
    ) : connectionDetailId && overhaulMobile ? (
      // Accounts, the built-in model and the decision model are pages on phones too.
      <OvConnectionPageMobile>
        <ConnectionEditor />
      </OvConnectionPageMobile>
    ) : presetDetailId ? (
      <PresetEditor />
    ) : profileDetailId ? (
      <ProfileEditor />
    ) : characterDetailId ? (
      <CharacterEditor />
    ) : characterLibraryOpen ? (
      <CharacterLibraryView key={cardLibraryKind} />
    ) : agentCatalogOpen ? (
      <AgentCatalogView />
    ) : lorebookDetailId ? (
      <LorebookEditor />
    ) : overhaulPages && overhaulLibraryPage ? (
      <LibraryLandingPage key={overhaulLibraryPage} section={overhaulLibraryPage} />
    ) : null;

  const hasDetailView = detailView != null || mariPageActive;
  const showAmbientDecor = isPageActive && !activeChatId && !hasDetailView && !botBrowserOpen && !gameAssetsBrowserOpen;
  // Per-chat themes and the chat's root hooks step aside while a full page covers the chat.
  useEffect(() => {
    useCenterPageOpen.setState({ open: hasDetailView });
  }, [hasDetailView]);
  // Phones and tablets: a page covers the whole screen, so a theme's ambient layer (rising bubbles,
  // rain) holds still under it instead of repainting every frame where nobody sees it (battery).
  const pageCoversScreen = overhaulMobile && shellOverlayMode && hasDetailView;
  const mobileSidePageOpen = useOverhaulStore((state) => state.mobileSidePageOpen);
  useEffect(() => {
    if (!pageCoversScreen) return;
    document.documentElement.setAttribute("data-mari-page-covers", "");
    return () => document.documentElement.removeAttribute("data-mari-page-covers");
  }, [pageCoversScreen]);
  const trackerPanelModeAvailable = activeChat?.mode === "roleplay";
  const trackerPanelActive = trackerPanelEnabled && trackerPanelOpen && trackerPanelSurfaceOpen;
  const trackerPanelDetached = trackerPanelWindowTarget !== null;
  const trackerPanelSurfaceAvailable =
    trackerPanelModeAvailable && !botBrowserOpen && !gameAssetsBrowserOpen && !hasDetailView;
  // The chat preference chooses the surface; its Trackers button controls visibility.
  const trackerPanelVisible = trackerPanelActive && trackerPanelSurfaceAvailable && !trackerPanelDetached;
  useEffect(() => {
    if (!trackerPanelVisible) setTrackerSheetFull(false);
  }, [trackerPanelVisible]);
  const mobileTrackerStripVisible =
    overhaulMobile &&
    trackerPanelEnabled &&
    trackerPanelOpen &&
    trackerPanelSurfaceAvailable &&
    (activeChatMetadata.enableAgents === true || activeChatMetadata.advancedMemory?.enabled === true);
  const chatSurfaceActive =
    !botBrowserOpen &&
    !gameAssetsBrowserOpen &&
    !hasDetailView &&
    (!shellOverlayMode || (!sidebarOpen && !rightPanelOpen && !trackerPanelVisible));
  const trackerWindowHost = trackerPanelWindowTarget?.popup ?? window;

  const dockTrackerPanel = useCallback(() => {
    const target = trackerPanelWindowTargetRef.current;
    if (target) {
      trackerPanelDockingPopupRef.current = target.popup;
      closeDetachedWindow(target);
      trackerPanelWindowTargetRef.current = null;
    }
    setDetachedWindowTarget(null);
  }, []);

  const detachTrackerPanel = useCallback(async () => {
    if (detachTrackerPanelPendingRef.current) return;
    trackerPanelDockingPopupRef.current = null;
    detachTrackerPanelPendingRef.current = true;

    try {
      const target = await openDetachedWindow({
        title: localizeUi("ui.layout.appshell.detachedTrackerPanelTitle"),
        width: trackerPanelWidth,
      });
      if (!target) {
        toast.error(localizeUi("ui.layout.appshell.trackerPanelPopupBlocked"));
        return;
      }
      trackerPanelWindowTargetRef.current = target;
      setDetachedWindowTarget(target);
    } catch {
      toast.error(localizeUi("ui.layout.appshell.trackerPanelWindowFailed"));
    } finally {
      detachTrackerPanelPendingRef.current = false;
    }
  }, [localizeUi, trackerPanelWidth]);

  const handleTrackerPanelWindowClosed = useCallback((closedTarget: DetachedWindowTarget) => {
    if (trackerPanelDockingPopupRef.current === closedTarget.popup) {
      trackerPanelDockingPopupRef.current = null;
      return;
    }
    if (trackerPanelWindowTargetRef.current?.popup !== closedTarget.popup) return;
    trackerPanelWindowTargetRef.current = null;
    setDetachedWindowTarget(null);
    closeTrackerPanel();
  }, []);

  // The overlay Tracker Panel hides the chat control that opened it (globals.css), so keyboard focus moves into the panel.
  useEffect(() => {
    if (!shellOverlayMode || !trackerPanelVisible) return;
    if (document.activeElement?.closest('[data-chat-covered="true"]')) {
      overlayTrackerPanelRef.current?.focus({ preventScroll: true });
    }
  }, [shellOverlayMode, trackerPanelVisible]);

  useEffect(() => {
    restoreTrackerPanelOpenForChat(activeChatId);
  }, [activeChatId, restoreTrackerPanelOpenForChat, trackerPanelEnabled]);
  useEffect(() => {
    if (!trackerPanelOpen || !activeChat?.mode || trackerPanelModeAvailable) return;
    setTrackerPanelOpen(false, activeChatId);
  }, [activeChat?.mode, activeChatId, setTrackerPanelOpen, trackerPanelModeAvailable, trackerPanelOpen]);
  useEffect(() => {
    if (!trackerPanelWindowTarget || (trackerPanelActive && trackerPanelModeAvailable)) return;
    closeDetachedWindow(trackerPanelWindowTarget);
    trackerPanelWindowTargetRef.current = null;
    setDetachedWindowTarget(null);
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
      setTrackerPanelWidthMeasured(false);
      return;
    }

    setTrackerPanelWidthMeasured(false);
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
        setTrackerPanelWidthMeasured(false);
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
        minWidth: TRACKER_PANEL_MIN_DOCKED_WIDTH,
      });
      setTrackerPanelResolvedWidth((current) => (current === nextWidth ? current : nextWidth));
      setTrackerPanelWidthMeasured(true);

      if (observedChatColumn !== chatColumn) {
        if (observedChatColumn) observer.unobserve(observedChatColumn);
        observer.observe(chatColumn);
        observedChatColumn = chatColumn;
      }
      return true;
    };
    // Watches for a chat column while there is none. A chat switch unmounts the column after the first
    // measure, so a miss re-arms it; otherwise the panel would stay unmeasured and hidden (#7188).
    const discoverChatColumn = () => {
      if (discoveryObserver || !mainRef.current) return;
      discoveryObserver = new MutationObserver(() => scheduleUpdate());
      discoveryObserver.observe(mainRef.current, { childList: true, subtree: true });
    };
    function scheduleUpdate() {
      if (frame) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const foundChatColumn = update();
        if (foundChatColumn) {
          discoveryObserver?.disconnect();
          discoveryObserver = null;
        } else {
          discoverChatColumn();
        }
      });
    }

    if (mainRef.current) observer.observe(mainRef.current);
    scheduleUpdate();
    discoverChatColumn();
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
  // Room a Roleplay column placed on the panel's side (Chat position) leaves for it. It uses the chosen
  // width, not the width measured beside that column, so the two never resize each other.
  const trackerPanelChatClearance = trackerPanelOverlayClearance > 0 ? trackerPanelWidth + TRACKER_PANEL_CHAT_GAP : 0;
  // Room every Roleplay column leaves on each side for the docked panel's minimum width. A fixed amount,
  // so a column only narrows when the window is too small for both, and the two never resize each other.
  const trackerPanelColumnRoom =
    trackerPanelOverlayClearance > 0 ? TRACKER_PANEL_MIN_DOCKED_WIDTH + TRACKER_PANEL_CHAT_GAP : 0;
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
    trackerPanelVisible && trackerPanelWidthMeasured && trackerPanelSide === side ? (
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
          "mari-tracker-panel fixed z-30 hidden overflow-hidden bg-zinc-950/95 shadow-2xl ring-1 ring-[var(--marinara-app-accent-solid)] backdrop-blur-2xl transition-[width] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-[transform,opacity] md:block",
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
            : { right: rightPanelOpen ? liveRightPanelWidth : 0 }),
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
        overhaulActive && "mari-overhaul flex-col",
        showAmbientDecor && "retro-scanlines noise-bg",
        // The grid is a background on this box, which the new layout's pages always cover. Changing
        // this box's own style made Safari restyle every element on the page (~120 ms on the tablet
        // layout) on each trip to and from Home, so the new layout leaves it off.
        showAmbientDecor && !overhaulActive && "geometric-grid",
      )}
    >
      {/* A theme's backdrop art (styles/theme-tokens.css): its own layer, under everything. */}
      <div data-mari-part="app-backdrop" aria-hidden="true" />
      <SkipLinks />
      {/* Split view's second side in the phone layout (a narrow side) keeps its swap / only / close bar on top. */}
      {SPLIT_PANE && overhaulMobile ? (
        <Suspense fallback={null}>
          <SplitPaneBar phone />
        </Suspense>
      ) : null}
      {overhaulActive &&
        (SPLIT_PANE ? (
          <Suspense fallback={<div className="ov-splitbar" />}>
            <SplitPaneBar />
          </Suspense>
        ) : homeBrowserFullscreen ? null : (
          // A Home package's fullscreen takes the whole screen (HomeBrowserHub), top bar included.
          <OverhaulTopBar />
        ))}
      <div
        data-component="OverhaulShellRow"
        className={overhaulActive ? "relative flex min-h-0 flex-1 overflow-hidden" : "contents"}
      >
        {/* A theme's ambient overlay (rain, leaves, scanlines): over the chat, under the bars. */}
        <div data-mari-part="ambient" aria-hidden="true" />
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

        {/* Mobile navigation backdrop */}
        {mobileNavigationPanel && (
          <div
            className={cn(
              "fixed bottom-0 z-[45] bg-black/50 backdrop-blur-sm",
              MOBILE_SHELL_PANEL_TOP_CLASS,
              MOBILE_SHELL_PANEL_X_CLASS,
            )}
            onClick={() => {
              setSidebarOpen(false);
              closeRightPanel();
            }}
          />
        )}

        {/* Left sidebar - Chat list (the new layout keeps Chats in the right sidebar instead) */}
        {!shellOverlayMode && !overhaulActive && (
          <aside
            data-tour="sidebar"
            data-component="ChatSidebarSlot"
            aria-label={localizeUi("ui.layout.appshell.chatList")}
            aria-hidden={!sidebarOpen}
            inert={!sidebarOpen}
            className={cn(
              "mari-shell-panel-slot relative flex-shrink-0 overflow-hidden",
              sidebarDragWidth != null && "!transition-none",
              !sidebarOpen && "pointer-events-none",
            )}
            style={{
              width: sidebarOpen ? liveSidebarWidth : 0,
              order: splitOn && split?.side === "left" ? -3 : undefined,
            }}
          >
            <div
              data-component="ChatSidebarPanel"
              aria-hidden={!sidebarOpen}
              inert={!sidebarOpen}
              className={cn(
                "mari-sidebar mari-shell-panel-motion mari-shell-panel-edge mari-shell-panel-edge--right absolute inset-y-0 left-0 overflow-hidden bg-[var(--background)]/95",
                sidebarOpen ? "mari-shell-panel-enter-left" : "mari-shell-panel-exit-left pointer-events-none",
              )}
              style={{ width: liveSidebarWidth }}
            >
              <ChatSidebar />
            </div>
          </aside>
        )}
        {!shellOverlayMode && !overhaulActive && sidebarOpen && (
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
            className="absolute inset-y-0 z-40 hidden w-1 cursor-col-resize bg-transparent transition-colors hover:bg-[var(--primary)]/30 focus-visible:bg-[var(--primary)] focus-visible:outline-none md:block"
            style={{ left: sidebarOpen ? liveSidebarWidth : 0 }}
          />
        )}

        {/* Center content */}
        <main
          ref={mainRef}
          id="mari-main"
          tabIndex={-1}
          data-tour="chat-area"
          data-component="CenterContent"
          data-center-compact={centerCompact ? "true" : undefined}
          data-shell-overlay-mode={shellOverlayMode ? "true" : undefined}
          data-center-page={hasDetailView ? "true" : undefined}
          aria-label={localizeUi("ui.layout.appshell.mainContent")}
          className={cn(
            "@container mari-main mari-app-background-paint relative flex min-w-0 flex-1 flex-col overflow-hidden",
            shellOverlayMode && hasDetailView && "z-50",
          )}
          style={splitOn ? { flex: `${1 - splitSize} 1 0px` } : undefined}
        >
          {overhaulMobile ? (
            <>
              {/* Split view's second side in the phone layout: no phone top bar (tabs, chat list, Home,
                  Library), so that side stays on its page; its split bar has Chat settings. */}
              {SPLIT_PANE || homeBrowserFullscreen ? null : <OverhaulMobileTopBar />}
              {mobileTrackerStripVisible && activeChatId ? <OverhaulMobileTrackerStrip chatId={activeChatId} /> : null}
            </>
          ) : (
            !overhaulActive && <TopBar mobileTopbarNavigation={shellOverlayMode} />
          )}
          <div className="mari-app-background-paint relative flex flex-1 flex-col overflow-hidden">
            {/* Browser — kept mounted once opened so state persists across close/reopen */}
            <MountOnceWhenOpened open={botBrowserOpen} overlay>
              <BotBrowserView />
            </MountOnceWhenOpened>
            {/* Game Assets Browser — kept mounted once opened so state persists across close/reopen */}
            <MountOnceWhenOpened open={gameAssetsBrowserOpen} overlay>
              <GameAssetsBrowserView />
            </MountOnceWhenOpened>
            {/* Overlay mode keeps the chat mounted under panels and editors; globals.css hides its windows then. */}
            <div
              data-chat-covered={chatSurfaceActive ? undefined : "true"}
              // New layout on phones/tablets: a page (Settings, an editor) covers Home or the chat completely, so
              // a theme's see-through page colour never shows them through it.
              data-under-page={pageCoversScreen ? "true" : undefined}
              // Hidden under the page, so VoiceOver swipes and a keyboard's Tab can't land on its buttons either
              // (QC Nov 21, MOB missed A). Painting is untouched: `inert` doesn't hide anything.
              // The Chats/Library page (MobileSidePage) covers it the same way (QC Nov 22 K6).
              inert={pageCoversScreen || (overhaulMobile && mobileSidePageOpen) || undefined}
              className={cn(
                "mari-app-background-paint flex flex-1 flex-col overflow-hidden",
                (botBrowserOpen || gameAssetsBrowserOpen || (!shellOverlayMode && hasDetailView)) && "hidden",
              )}
              style={
                {
                  "--tracker-panel-hud-clear-left": `${trackerPanelSide === "left" ? trackerPanelHudClearance : 0}px`,
                  "--tracker-panel-hud-clear-right": `${trackerPanelSide === "right" ? trackerPanelHudClearance : 0}px`,
                  "--tracker-panel-overlay-clearance": `${trackerPanelOverlayClearance}px`,
                  "--tracker-panel-chat-clearance": `${trackerPanelChatClearance}px`,
                  "--tracker-panel-column-room": `${trackerPanelColumnRoom}px`,
                } as CSSProperties
              }
            >
              <Suspense fallback={<MainPaneFallback />}>
                {/* Home (no chat open) stays mounted under a page on wide screens too, so coming back to it
                    doesn't rebuild the whole Home screen (~1 s of long frames on an iPad, Nov 15). */}
                {(shellOverlayMode || !hasDetailView || !activeChatId) && (
                  <ChatArea
                    chatWindowIntroAllowed={
                      chatWindowIntroAllowed &&
                      !chatWindowIntroNavigationBlocked &&
                      (!shellOverlayMode || (!mobileNavigationPanel && !trackerPanelVisible))
                    }
                    onChatWindowIntroOpenChange={onChatWindowIntroOpenChange}
                  />
                )}
              </Suspense>
            </div>
            {/* Keep the detail host at one React tree position across the mobile breakpoint.
              Moving an editor between separate desktop/mobile branches remounts it and
              discards component-local unsaved form state. */}
            <AnimatePresence mode="wait">
              {detailView && (
                <motion.aside
                  key="detail-editor"
                  // No slide: the sheet sits between the camera strips, and any sideways travel crosses one.
                  // Phones and tablets: no fade either. iOS Safari painted the page, dropped it for a couple of
                  // frames (the chat showed through) and only then ran the fade, Nov 14 screen recording.
                  initial={false}
                  animate={{ opacity: 1 }}
                  // No fade out: the page goes at once. Fading it out left the tab you swiped away from
                  // flickering over the new one (a spring on opacity bounced), Nov 14 finding.
                  transition={{ duration: 0.14, ease: "easeOut" }}
                  data-component={shellOverlayMode ? "MobileDetailSheet" : "DetailEditor"}
                  // Every full page (Library pages, viewers, editors, Settings, Docs) sits in here, so a
                  // theme paints one readable surface for all of them on this hook.
                  data-mari-part="page"
                  aria-label={localizeUi("ui.layout.appshell.detailEditor")}
                  tabIndex={-1}
                  className={cn(
                    "mari-detail-editor-surface mari-app-background-paint flex min-h-0 flex-1 flex-col overflow-hidden",
                    shellOverlayMode &&
                      cn(
                        "mari-mobile-detail-sheet !fixed bottom-0 z-50 bg-[var(--background)]/95 shadow-2xl backdrop-blur-xl",
                        MOBILE_SHELL_PANEL_TOP_CLASS,
                        MOBILE_SHELL_PANEL_X_CLASS,
                        MOBILE_SHELL_PANEL_BOTTOM_PADDING_CLASS,
                      ),
                  )}
                >
                  <Suspense fallback={<MainPaneFallback />}>{detailView}</Suspense>
                </motion.aside>
              )}
            </AnimatePresence>
            {mariPageMounted && (
              // Professor Mari's tab: the same page surface as the sheet above, kept mounted and hidden
              // (inline display so no theme rule can show it) while she isn't the open tab.
              <aside
                data-component={mariPageActive ? (shellOverlayMode ? "MobileDetailSheet" : "DetailEditor") : undefined}
                data-mari-part={mariPageActive ? "page" : undefined}
                aria-label={localizeUi("ui.layout.appshell.detailEditor")}
                aria-hidden={mariPageActive ? undefined : true}
                inert={!mariPageActive}
                tabIndex={-1}
                style={mariPageActive ? undefined : { display: "none" }}
                className={cn(
                  "mari-detail-editor-surface mari-app-background-paint flex min-h-0 flex-1 flex-col overflow-hidden",
                  shellOverlayMode &&
                    cn(
                      "mari-mobile-detail-sheet !fixed bottom-0 z-50 bg-[var(--background)]/95 shadow-2xl backdrop-blur-xl",
                      MOBILE_SHELL_PANEL_TOP_CLASS,
                      MOBILE_SHELL_PANEL_X_CLASS,
                      MOBILE_SHELL_PANEL_BOTTOM_PADDING_CLASS,
                    ),
                )}
              >
                <Suspense fallback={<MainPaneFallback />}>
                  <OverhaulMariPage active={mariPageActive} />
                </Suspense>
              </aside>
            )}
          </div>
          {/* Floating avatar notification bubbles (right edge) */}
          {SPLIT_PANE ? null : (
            <Suspense fallback={null}>
              <ChatNotificationBubbles />
            </Suspense>
          )}
        </main>

        {splitOn && split ? (
          <Suspense fallback={null}>
            <SplitSide split={split} size={splitSize} />
          </Suspense>
        ) : null}
        {splitOn && chatSettingsTakesSlot ? (
          <div aria-hidden="true" className="shrink-0" data-ov-cs-slot style={{ width: chatSettingsSlot }} />
        ) : null}
        {splitFits && splitDragging ? (
          <Suspense fallback={null}>
            <SplitDropOverlay />
          </Suspense>
        ) : null}

        <AnimatePresence initial={false} mode="wait">
          {!shellOverlayMode && trackerPanelSurfaceAvailable && trackerPanelDesktop(trackerPanelSide)}
        </AnimatePresence>

        {trackerPanelWindowTarget && trackerPanelActive && trackerPanelModeAvailable && (
          <DetachedWindow
            host={trackerPanelHost}
            target={trackerPanelWindowTarget}
            onClosed={handleTrackerPanelWindowClosed}
          />
        )}

        {trackerPanelPortal}

        {/* Overlay tracker panel backdrop */}
        {trackerPanelVisible && shellOverlayMode && (
          <div
            className={cn(
              "fixed bottom-0 z-[45] bg-black/50 backdrop-blur-sm",
              MOBILE_SHELL_PANEL_TOP_CLASS,
              MOBILE_SHELL_PANEL_X_CLASS,
            )}
            onClick={closeTrackerPanel}
          />
        )}

        {/* Overlay tracker panel */}
        {shellOverlayMode && (
          <AnimatePresence mode="wait">
            {trackerPanelVisible && overhaulMobile && (
              <motion.aside
                ref={overlayTrackerPanelRef}
                tabIndex={-1}
                key="mobile-tracker-sheet"
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 30, stiffness: 340 }}
                data-component="TrackerDataSidebarMobile"
                data-sheet-full={trackerSheetFull ? "true" : undefined}
                aria-label={localizeUi("ui.layout.appshell.trackerDataPanel")}
                className="mari-tracker-panel ovm-trk-sheet outline-none"
                style={trackerPanelBackgroundStyle}
              >
                <motion.div
                  className="ovm-trk-sheet__grab"
                  drag="y"
                  dragConstraints={{ top: 0, bottom: 0 }}
                  dragElastic={0.25}
                  dragMomentum={false}
                  onDragEnd={(_event, info) => {
                    if (info.offset.y < -40) setTrackerSheetFull(true);
                    else if (info.offset.y > 60) {
                      if (trackerSheetFull) setTrackerSheetFull(false);
                      else closeTrackerPanel();
                    }
                  }}
                >
                  <button
                    type="button"
                    className="ovm-trk-sheet__handle"
                    aria-label={localizeUi(
                      trackerSheetFull
                        ? "ui.overhaul.text.showLessOfTheTracker"
                        : "ui.overhaul.text.showAllOfTheTracker",
                    )}
                    onClick={() => setTrackerSheetFull((full) => !full)}
                  />
                </motion.div>
                <div className="ovm-trk-sheet__body">
                  <TrackerPanelHostSlot host={trackerPanelHost} />
                </div>
              </motion.aside>
            )}
            {trackerPanelVisible && !overhaulMobile && (
              <motion.aside
                ref={overlayTrackerPanelRef}
                tabIndex={-1}
                key="mobile-tracker"
                // A whole screen, not the sheet's width: an inset sheet would leave a slice in the camera strip.
                initial={{ x: trackerPanelSide === "left" ? "-100vw" : "100vw" }}
                animate={{ x: 0 }}
                exit={{ x: trackerPanelSide === "left" ? "-100vw" : "100vw" }}
                transition={{ type: "spring", damping: 28, stiffness: 350 }}
                data-component="TrackerDataSidebarMobile"
                aria-label={localizeUi("ui.layout.appshell.trackerDataPanel")}
                className={cn(
                  "mari-tracker-panel !fixed bottom-0 z-50 max-w-none overflow-hidden bg-zinc-950/95 shadow-2xl outline-none ring-1 ring-[var(--marinara-app-accent-solid)] backdrop-blur-xl",
                  MOBILE_SHELL_PANEL_TOP_CLASS,
                  MOBILE_SHELL_PANEL_BOTTOM_PADDING_CLASS,
                  MOBILE_SHELL_PANEL_X_CLASS,
                )}
                style={trackerPanelBackgroundStyle}
              >
                <TrackerPanelHostSlot host={trackerPanelHost} />
              </motion.aside>
            )}
          </AnimatePresence>
        )}

        {shellOverlayMode && <ChatResourceMobileDropDock />}

        {/* Mobile navigation swaps content in one shell; desktop keeps independent sidebars. */}
        {shellOverlayMode ? (
          <AnimatePresence mode="wait">
            {mobileNavigationPanel && (
              <motion.aside
                key="mobile-navigation"
                // New layout: the Chats list belongs to the left button, so it slides in from the left.
                initial={{ x: overhaulMobile && mobileNavigationPanel === "chats" ? "-100vw" : "100vw" }}
                animate={{ x: 0 }}
                exit={{ x: overhaulMobile && mobileNavigationPanel === "chats" ? "-100vw" : "100vw" }}
                transition={{ type: "spring", damping: 28, stiffness: 350 }}
                data-tour={mobileNavigationPanel === "chats" ? "sidebar" : undefined}
                data-component={mobileNavigationPanel === "chats" ? "ChatSidebarPanel" : "RightPanelMobile"}
                aria-label={localizeUi(
                  mobileNavigationPanel === "chats"
                    ? "ui.layout.appshell.chatList"
                    : "ui.layout.appshell.settingsAndToolsPanel",
                )}
                className={cn(
                  // contain: layout makes the sheet the frame for its fixed selection bar on every engine; its blur
                  // already does that except on iOS, where the blur is switched off for this sheet.
                  "!fixed bottom-0 z-50 overflow-hidden shadow-2xl backdrop-blur-xl [contain:layout]",
                  MOBILE_SHELL_PANEL_TOP_CLASS,
                  MOBILE_SHELL_PANEL_X_CLASS,
                  MOBILE_SHELL_PANEL_BOTTOM_PADDING_CLASS,
                  mobileNavigationPanel === "chats"
                    ? "mari-sidebar bg-[var(--background)]/95"
                    : "mari-right-panel bg-[var(--background)]/80",
                )}
                style={
                  {
                    "--mari-right-panel-width":
                      "calc(100vw - var(--mari-shell-inset-left) - var(--mari-shell-inset-right))",
                  } as CSSProperties
                }
              >
                {mobileNavigationPanel === "chats" ? (
                  <ChatSidebar />
                ) : (
                  <Suspense fallback={<SidePanelFallback />}>
                    <RightPanel />
                  </Suspense>
                )}
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
            className="absolute inset-y-0 z-40 hidden w-1 cursor-col-resize bg-transparent transition-colors hover:bg-[var(--primary)]/30 focus-visible:bg-[var(--primary)] focus-visible:outline-none md:block"
            style={{ right: rightPanelOpen ? Math.max(0, liveRightPanelWidth - 4) : 0 }}
          />
        )}
      </div>

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

      {/* Classic layout: the model window opens over the page the user is on (the new layout shows it as a page). */}
      {connectionDetailId && !overhaulActive && !overhaulMobile && (
        <Suspense fallback={null}>
          <ConnectionEditor />
        </Suspense>
      )}
      {/* First-time onboarding tutorial, or this device's walkthrough the first time a phone, tablet or computer opens */}
      {!SPLIT_PANE && (!hasCompletedOnboarding || deviceWalkthroughDue) && (
        <Suspense fallback={null}>
          <OnboardingTutorial />
        </Suspense>
      )}
      <GlobalOmnibar />
      <div data-component="MobileMusicWidgetLayer" className="contents">
        {isMobile && musicDjInstalled ? (
          <>
            <Suspense fallback={null}>
              <SpotifyMobileWidget />
            </Suspense>
            <YouTubeMobileWidget />
            <LocalMusicMobileWidget />
          </>
        ) : null}
      </div>
    </div>
  );
}
