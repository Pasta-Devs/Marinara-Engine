// ──────────────────────────────────────────────
// UI overhaul, phones and tablets: the top bar, the Stack menu and All Tabs
//
// Home on the left; Chat settings, All Tabs and the Library on the right. The
// Library button opens the one sidebar (Chats | Library) as a slide-over page. The bottom of the screen stays free for the
// message composer. Tabs are not shown in the bar; they live in a
// Safari-style All Tabs viewer, opened from the Stack menu.
// ──────────────────────────────────────────────
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowUp, Check, Home, Layers, Plus, Search, Settings2, X } from "lucide-react";
import type { Chat } from "@marinara-engine/shared";
import { useUIStore } from "../../stores/ui.store";
import { useChatStore } from "../../stores/chat.store";
import { CHAT_SETTINGS_WINDOW_ID, useFloatingWindowStore } from "../../stores/floating-window.store";
import { overhaulTabKey, useOverhaulStore, type OverhaulTab } from "../../stores/overhaul.store";
import { useChats } from "../../hooks/use-chats";
import { useLocalizedUiText } from "../../localization/use-localized-ui-text";
import { cn } from "../../lib/utils";
import { preloadChatSettingsDrawer } from "../chat/ChatCommonOverlays";
import {
  ChatSettingsSummary,
  TabIcon,
  useTabPicture,
  TabLabel,
  TabPresence,
  activateTab,
  closeTabAndMove,
  goHome,
  useCurrentTab,
  useTabBookkeeping,
  usePublishTopBarHeight,
  DocumentTitle,
} from "./OverhaulTopBar";
import { useTabScrollMemory } from "./use-tab-scroll-memory";
import { MobileSidePage } from "./SidePane";
import { useHorizontalSwipe, type SwipeDirection } from "./use-horizontal-swipe";

/** Leave the Chats list or a mobile side panel before showing something else in the main area. */
function closeMobilePanels() {
  const ui = useUIStore.getState();
  ui.setSidebarOpen(false);
  if (ui.rightPanelOpen) ui.closeRightPanel();
}

function useWideEnoughForLabel() {
  const query = "(min-width: 600px)";
  const [wide, setWide] = useState(() => typeof window !== "undefined" && window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const update = () => setWide(mq.matches);
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return wide;
}

/** One tab as a card in the All Tabs grid. */
function TabCard({
  tab,
  chats,
  on,
  query,
  onClose,
}: {
  tab: OverhaulTab | null;
  chats: Chat[];
  on: boolean;
  query: string;
  onClose?: () => void;
}) {
  const localize = useLocalizedUiText();
  const ref = useRef<HTMLDivElement | null>(null);
  const [hidden, setHidden] = useState(false);
  useLayoutEffect(() => {
    const text = ref.current?.querySelector(".ovm-tabcard__label")?.textContent ?? "";
    setHidden(Boolean(query) && !text.toLowerCase().includes(query.toLowerCase()));
  });
  const picture = useTabPicture(tab, chats);
  const [pictureFailed, setPictureFailed] = useState(false);
  const kindLabel = tab
    ? localize(
        tab.kind === "chat"
          ? (() => {
              const mode = chats.find((chat) => chat.id === tab.id)?.mode;
              return mode === "conversation" ? "Conversation" : mode === "game" ? "Game" : "Roleplay";
            })()
          : tab.kind === "character"
            ? "Character"
            : tab.kind === "persona"
              ? "Persona"
              : tab.kind === "lorebook"
                ? "Lorebook"
                : tab.kind === "preset"
                  ? "Preset"
                  : tab.kind === "mari"
                    ? "Professor Mari"
                    : tab.kind === "schedules"
                      ? "Schedules"
                      : tab.kind === "app"
                        ? "App"
                        : "Library",
      )
    : localize("Home");
  return (
    <div ref={ref} className={cn("ovm-tabcard", on && "is-on")} hidden={hidden}>
      <button
        type="button"
        className="ovm-tabcard__main"
        aria-current={on ? "page" : undefined}
        onClick={() => {
          useOverhaulStore.getState().setAllTabsOpen(false);
          closeMobilePanels();
          if (tab) activateTab(tab);
          else goHome();
        }}
      >
        <span className={cn("ovm-tabcard__thumb", picture && !pictureFailed && "has-pic")} aria-hidden="true">
          {picture && !pictureFailed ? (
            <img className="ovm-tabcard__pic" src={picture} alt="" onError={() => setPictureFailed(true)} />
          ) : tab ? (
            <span className="ovm-tabcard__glyph">
              <TabIcon tab={tab} chats={chats} />
            </span>
          ) : (
            <img className="ovm-tabcard__logo" src="/icon-192.png" alt="" />
          )}
          <span className="ovm-tabcard__kind">{kindLabel}</span>
          {tab ? <TabPresence tab={tab} chats={chats} /> : null}
        </span>
        <span className="ovm-tabcard__label">
          {tab ? (
            <TabLabel tab={tab} chats={chats} />
          ) : (
            <span className="ov-tab__label">
              <Home size={14} aria-hidden="true" /> {localize("Home")}
            </span>
          )}
        </span>
      </button>
      {onClose ? (
        <button type="button" className="ovm-tabcard__close" aria-label={localize("Close tab")} onClick={onClose}>
          <X size={16} />
        </button>
      ) : null}
    </div>
  );
}

/** Safari's All Tabs: every open tab as a card, + for a new one, Done to go back. */
function AllTabsViewer({ chats, current }: { chats: Chat[]; current: OverhaulTab | null }) {
  const localize = useLocalizedUiText();
  const tabs = useOverhaulStore((s) => s.tabs);
  const setOpen = useOverhaulStore((s) => s.setAllTabsOpen);
  const [query, setQuery] = useState("");
  const currentKey = current ? overhaulTabKey(current) : null;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [setOpen]);
  const count = tabs.length + 1;
  return createPortal(
    <div className="ovm-alltabs" role="dialog" aria-modal="true" aria-label={localize("All tabs")}>
      <header className="ovm-alltabs__head">
        {count} {localize(count === 1 ? "Tab" : "Tabs")}
      </header>
      <div className="ovm-alltabs__grid">
        <TabCard tab={null} chats={chats} on={current === null} query={query} />
        {tabs.map((tab) => {
          const key = overhaulTabKey(tab);
          return (
            <TabCard
              key={key}
              tab={tab}
              chats={chats}
              on={key === currentKey}
              query={query}
              onClose={() => closeTabAndMove(tab, tabs, currentKey)}
            />
          );
        })}
      </div>
      <footer className="ovm-alltabs__foot">
        <button
          type="button"
          className="ovm-round"
          aria-label={localize("Search or open anything")}
          onClick={() => {
            setOpen(false);
            useUIStore.getState().setOmnibarOpen(true);
          }}
        >
          <Plus size={24} />
        </button>
        <label className="ovm-alltabs__search">
          <Search size={18} aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={localize("Search tabs")}
            aria-label={localize("Search tabs")}
          />
        </label>
        <button
          type="button"
          className="ovm-round ovm-round--accent"
          aria-label={localize("Done")}
          onClick={() => setOpen(false)}
        >
          <Check size={24} />
        </button>
      </footer>
    </div>,
    document.body,
  );
}

export function OverhaulMobileTopBar() {
  const barRef = useRef<HTMLElement | null>(null);
  usePublishTopBarHeight(barRef);
  const localize = useLocalizedUiText();
  const { data: chats = [] } = useChats();
  const current = useCurrentTab();
  const currentKey = current ? overhaulTabKey(current) : null;
  useTabScrollMemory(current && current.kind !== "chat" ? currentKey : null);
  useTabBookkeeping(current, chats);
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const rightPanelOpen = useUIStore((s) => s.rightPanelOpen);
  const activeChatId = useChatStore((s) => s.activeChatId);
  const chatSettingsOpen = useFloatingWindowStore((s) => s.open[CHAT_SETTINGS_WINDOW_ID] === true);
  const allTabsOpen = useOverhaulStore((s) => s.allTabsOpen);
  const tabCount = useOverhaulStore((s) => s.tabs.length);
  const swipeGestures = useUIStore((s) => s.swipeGestures);
  // Swiping the title moves through the open tabs in strip order (Home sits before the first).
  const tabSteps = (direction: SwipeDirection) => {
    const tabs = useOverhaulStore.getState().tabs;
    const index = currentKey ? tabs.findIndex((tab) => overhaulTabKey(tab) === currentKey) : -1;
    return { tabs, next: direction === "left" ? index + 1 : index - 1 };
  };
  // The whole middle of the bar takes the swipe (panel 3, PT5); only the title inside it moves, clipped
  // to that box so it never slides over the icons (PP9).
  const titleSwipe = useHorizontalSwipe({
    enabled: swipeGestures && !sidebarOpen && tabCount > 0,
    maxFollow: 48,
    moveTarget: (el) => el.querySelector<HTMLElement>(".ovm-title__inner"),
    canSwipe: (direction) => {
      const { tabs, next } = tabSteps(direction);
      return next >= -1 && next < tabs.length;
    },
    onSwipe: (direction) => {
      const { tabs, next } = tabSteps(direction);
      closeMobilePanels();
      if (next < 0) goHome();
      else if (tabs[next]) activateTab(tabs[next]);
    },
  });

  const activeChat = activeChatId ? chats.find((chat) => chat.id === activeChatId) : undefined;
  const chatOnScreen = current?.kind === "chat" && activeChat && !sidebarOpen && !rightPanelOpen;
  const modeLabel = activeChat
    ? localize(activeChat.mode === "conversation" ? "Conversation" : activeChat.mode === "game" ? "Game" : "Roleplay")
    : "";

  const toggleChatSettings = (button: HTMLButtonElement) => {
    void preloadChatSettingsDrawer();
    const windows = useFloatingWindowStore.getState();
    if (windows.open[CHAT_SETTINGS_WINDOW_ID]) windows.dismissWindow(CHAT_SETTINGS_WINDOW_ID, { force: true });
    else windows.openWindow(CHAT_SETTINGS_WINDOW_ID, button);
  };

  return (
    <header ref={barRef} data-component="TopBar" data-overhaul-topbar="mobile" className="ovm-topbar">
      <DocumentTitle tab={current} chats={chats} />
      {/* Three columns with equal sides, so the title sits in the true centre. */}
      <div className="ovm-topbar__side">
        <button
          type="button"
          className={cn("ovm-icon-btn", !current && !sidebarOpen && "is-on")}
          aria-label={localize("Home")}
          title={localize("Home")}
          onClick={() => {
            closeMobilePanels();
            goHome();
          }}
        >
          <Home size={22} />
        </button>
      </div>
      <button
        type="button"
        className="ovm-title"
        {...titleSwipe}
        onClick={() => useUIStore.getState().setOmnibarOpen(true)}
        aria-label={localize("Search or open anything")}
        data-tour="omnibar-button"
      >
        <span className="ovm-title__inner">
          {sidebarOpen ? (
            <span className="ovm-title__text">
              <b>{localize("Chats")}</b>
            </span>
          ) : current?.kind === "chat" && activeChat ? (
            <>
              <TabIcon tab={current} chats={chats} />
              <span className="ovm-title__text">
                <TabLabel tab={current} chats={chats} />
                <ChatSettingsSummary chat={activeChat} fallback={modeLabel} />
              </span>
            </>
          ) : current ? (
            <>
              <TabIcon tab={current} chats={chats} />
              <span className="ovm-title__text">
                <TabLabel tab={current} chats={chats} />
              </span>
            </>
          ) : (
            <>
              <img className="ovm-title__logo" src="/favicon.png" srcSet="/favicon.png 1x, /icon-192.png 3x" alt="" />
              <span className="ovm-title__text">
                <b>{localize("Home")}</b>
              </span>
            </>
          )}
        </span>
      </button>
      <div className="ovm-topbar__side ovm-topbar__side--end">
        {chatOnScreen ? (
          <button
            type="button"
            className={cn("ovm-icon-btn", chatSettingsOpen && "is-on")}
            aria-pressed={chatSettingsOpen}
            aria-label={localize("Chat settings")}
            title={localize("Chat settings")}
            data-window-opener={CHAT_SETTINGS_WINDOW_ID}
            onClick={(event) => toggleChatSettings(event.currentTarget)}
          >
            <Settings2 size={22} />
          </button>
        ) : null}
        {/* Safari's tabs button: the open-tab count, one tap to All Tabs. */}
        <button
          type="button"
          className={cn("ovm-icon-btn", allTabsOpen && "is-on")}
          aria-label={localize("All tabs")}
          title={localize("All tabs")}
          onClick={() => useOverhaulStore.getState().setAllTabsOpen(!allTabsOpen)}
        >
          <span className="ovm-tabs-icon" aria-hidden="true">
            {tabCount + 1}
          </span>
        </button>
        <MobileLibraryButton />
      </div>
      {allTabsOpen ? <AllTabsViewer chats={chats} current={current} /> : null}
      <MobileSidePage />
      <JumpToTop />
    </header>
  );
}

/**
 * The Library (Stack) button. It sits top-right on every phone screen, the chat list included, so that
 * corner always means Library (panel 3, PV7: "+ New" there made chats by accident).
 */
export function MobileLibraryButton({ tour = true }: { tour?: boolean }) {
  const localize = useLocalizedUiText();
  const open = useOverhaulStore((s) => s.mobileSidePageOpen);
  const wide = useWideEnoughForLabel();
  return (
    <button
      type="button"
      className={cn("ovm-stack-btn", open && "is-on", wide && "has-label")}
      aria-expanded={open}
      aria-label={localize("Library")}
      title={localize("Library")}
      onClick={() => {
        const ui = useUIStore.getState();
        if (ui.sidebarOpen) ui.setSidebarOpen(false);
        useOverhaulStore.getState().setMobileSidePageOpen(!open);
      }}
      data-tour={tour ? "panel-buttons" : undefined}
    >
      <Layers size={22} aria-hidden="true" />
      {wide ? <span>{localize("Library")}</span> : null}
    </button>
  );
}

/** The Home row for the top line of the Chats list (between the title and its + and close buttons). */
export function MobileChatsHomeButton() {
  const localize = useLocalizedUiText();
  return (
    <button
      type="button"
      className="ovm-chats-home"
      onClick={() => {
        closeMobilePanels();
        goHome();
      }}
    >
      <Home size={18} aria-hidden="true" />
      <span>{localize("Home")}</span>
    </button>
  );
}

/** Library pages, editors, Settings and Docs: the scroll areas that get a jump-to-top button. */
const JUMP_SCROLLERS =
  ".ov-gallery, .ov-settings, .ov-ed, .ov-lv, .ov-docs__reader, .ov-docs__nav, .ov-libpage, .mari-editor-content";
const JUMP_MIN_SCROLL = 240;

/**
 * Bottom-right button that appears on a Library page once the reader is well down it and scrolls back
 * up (the moment they are looking for the top). Scrolling down or reaching the top hides it.
 */
function JumpToTop() {
  const localize = useLocalizedUiText();
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const last = useRef(new WeakMap<HTMLElement, number>());
  useEffect(() => {
    const onScroll = (event: Event) => {
      const el = event.target;
      if (!(el instanceof HTMLElement) || !el.matches(JUMP_SCROLLERS)) return;
      const top = el.scrollTop;
      const previous = last.current.get(el) ?? top;
      last.current.set(el, top);
      if (top < JUMP_MIN_SCROLL || top > previous + 2) setTarget(null);
      else if (top < previous - 2) setTarget(el);
    };
    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    return () => document.removeEventListener("scroll", onScroll, { capture: true });
  }, []);
  if (!target || !target.isConnected) return null;
  return createPortal(
    <button
      type="button"
      className="ovm-jump-top"
      aria-label={localize("Jump to top")}
      title={localize("Jump to top")}
      onClick={() => {
        target.scrollTo({ top: 0, behavior: "smooth" });
        setTarget(null);
      }}
    >
      <ArrowUp size={22} aria-hidden="true" />
    </button>,
    document.body,
  );
}
