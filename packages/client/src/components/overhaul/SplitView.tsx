// ──────────────────────────────────────────────
// UI overhaul (desktop): split view, the second side and the drop targets
//
// The second side is the app itself in a frame (lib/split-view-env.ts), so a
// chat, an editor or a Library page there works on its own while the main
// side keeps going. The two talk by messages: the frame says which page it is
// on (its tab is marked in the tab bar), and the main window tells it what to
// show when something is dropped on it. Saves in either one refresh the other.
// ──────────────────────────────────────────────
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { ArrowLeftRight, Columns2, Home, Maximize2, Settings2, X } from "lucide-react";
import { SPLIT_PANE, forgetSplitPaneCopy, type SplitPage } from "../../lib/split-view-env";
import { queryClient } from "../../lib/query-client";
import { useUIStore } from "../../stores/ui.store";
import { useChatStore } from "../../stores/chat.store";
import { useDeviceLookStore } from "../../stores/device-look.store";
import { CHAT_SETTINGS_WINDOW_ID, useFloatingWindowStore } from "../../stores/floating-window.store";
import { overhaulTabKey, useOverhaulStore, type OverhaulSplit, type OverhaulTab } from "../../stores/overhaul.store";
import { useChats } from "../../hooks/use-chats";
import { useLocalizedUiText } from "../../localization/use-localized-ui-text";
import { cn } from "../../lib/utils";
import { preloadChatSettingsDrawer } from "../chat/ChatCommonOverlays";
import {
  ChatSettingsSummary,
  GamePaneToggle,
  TabIcon,
  TabLabel,
  useCurrentTab,
  usePublishTopBarHeight,
} from "./OverhaulTopBar";
import {
  HOME_PAGE,
  SPLIT_DIVIDER,
  SPLIT_MIN_SIDE,
  closeSplit,
  endSplitDrag,
  isTabPage,
  openInMain,
  openInSplit,
  pageOfTab,
  setSplitDropHandler,
  showPage,
  splitPageKey,
} from "./split-view";

type SplitMessage =
  | { type: "ov-split"; current: SplitPage }
  | { type: "ov-split"; open: SplitPage }
  | { type: "ov-split"; action: "swap" | "only" | "close" };

const origin = () => window.location.origin;

// ── Saves in one window refresh the other ──
// Both windows read the same server; a save in one (a renamed chat, an edited card) refreshes what the
// other shows. Other browser tabs of the app get the same nudge.
function startQuerySync() {
  if (typeof BroadcastChannel === "undefined") return () => {};
  const channel = new BroadcastChannel("marinara-split-sync");
  const self = Math.random().toString(36).slice(2);
  let timer: ReturnType<typeof setTimeout> | null = null;
  const unsubscribe = queryClient.getMutationCache().subscribe((event) => {
    if (event.type !== "updated" || event.action.type !== "success" || timer) return;
    timer = setTimeout(() => {
      timer = null;
      channel.postMessage({ from: self });
    }, 250);
  });
  channel.onmessage = (event: MessageEvent<{ from?: string }>) => {
    if (event.data?.from && event.data.from !== self) void queryClient.invalidateQueries();
  };
  return () => {
    unsubscribe();
    channel.close();
    if (timer) clearTimeout(timer);
  };
}

// ── Main window: the second side ──

/** The divider and the second side's frame. Rendered by AppShell beside the main page. */
export function SplitSide({ split, size }: { split: OverhaulSplit; size: number }) {
  const localize = useLocalizedUiText();
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const paneRef = useRef<HTMLElement | null>(null);
  const [src] = useState(
    () => `${window.location.pathname}?ovSplitPane=${encodeURIComponent(JSON.stringify(split.page))}`,
  );
  const [ready, setReady] = useState(false);
  const [resizing, setResizing] = useState(false);
  /** What the frame was last told to open, until it says it's there. */
  const pending = useRef<SplitPage | null>(split.page);
  /** The page the frame says it is on. */
  const frameKey = useRef<string | null>(null);

  useEffect(startQuerySync, []);

  const post = (message: SplitMessage) => frameRef.current?.contentWindow?.postMessage(message, origin());

  // The frame's news: the page it is on, and its bar's buttons.
  useEffect(() => {
    const onMessage = (event: MessageEvent<SplitMessage>) => {
      if (event.origin !== origin() || event.source !== frameRef.current?.contentWindow) return;
      const data = event.data;
      if (!data || data.type !== "ov-split") return;
      const store = useOverhaulStore.getState();
      const current = store.split;
      if (!current) return;
      if ("current" in data) {
        setReady(true);
        frameKey.current = splitPageKey(data.current);
        if (pending.current) {
          // Still on the way to the page it was sent to: news from before that is stale.
          if (splitPageKey(pending.current) !== frameKey.current)
            return post({ type: "ov-split", open: pending.current });
          pending.current = null;
        }
        if (splitPageKey(current.page) === frameKey.current) return;
        if (isTabPage(data.current)) store.touchTab(data.current as OverhaulTab);
        store.setSplit({ ...current, page: data.current });
      } else if ("action" in data) {
        if (data.action === "swap") store.setSplit({ ...current, side: current.side === "left" ? "right" : "left" });
        else if (data.action === "close") closeSplit();
        else {
          closeSplit();
          openInMain(current.page);
        }
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // A page dropped on the second side (or traded with the main side): tell the frame.
  useEffect(() => {
    if (splitPageKey(split.page) === frameKey.current) return;
    pending.current = split.page;
    if (ready) post({ type: "ov-split", open: split.page });
  }, [ready, split.page]);

  // The main side opens the page that is on the second side: the two sides trade pages.
  // Closing the tab that was on either side gives the other side the whole room.
  const mainTab = useCurrentTab();
  const tabs = useOverhaulStore((s) => s.tabs);
  const previousMain = useRef<SplitPage>(pageOfTab(mainTab));
  useEffect(() => {
    const main = pageOfTab(mainTab);
    const before = previousMain.current;
    previousMain.current = main;
    const store = useOverhaulStore.getState();
    const current = store.split;
    if (!current || splitPageKey(main) !== splitPageKey(current.page)) return;
    const stillOpen = !isTabPage(before) || store.tabs.some((tab) => overhaulTabKey(tab) === splitPageKey(before));
    if (stillOpen && splitPageKey(before) !== splitPageKey(main)) store.setSplit({ ...current, page: before });
    else closeSplit();
  }, [mainTab]);
  useEffect(() => {
    if (isTabPage(split.page) && !tabs.some((tab) => overhaulTabKey(tab) === splitPageKey(split.page))) closeSplit();
  }, [split.page, tabs]);

  // Drag the divider to give one side more room; double-click evens them out.
  const startResize = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const main = document.getElementById("mari-main");
    const pane = paneRef.current;
    if (!main || !pane) return;
    event.preventDefault();
    const a = main.getBoundingClientRect();
    const b = pane.getBoundingClientRect();
    const left = Math.min(a.left, b.left);
    const width = Math.max(a.right, b.right) - left;
    const handle = event.currentTarget;
    handle.setPointerCapture(event.pointerId);
    setResizing(true);
    let frame = 0;
    const move = (moveEvent: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const x = moveEvent.clientX - left;
        const share = useOverhaulStore.getState().split?.side === "left" ? x / width : 1 - x / width;
        const min = SPLIT_MIN_SIDE / width;
        const current = useOverhaulStore.getState().split;
        if (current)
          useOverhaulStore.getState().setSplit({ ...current, size: Math.min(1 - min, Math.max(min, share)) });
      });
    };
    const stop = () => {
      cancelAnimationFrame(frame);
      setResizing(false);
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", stop);
      handle.removeEventListener("pointercancel", stop);
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", stop);
    handle.addEventListener("pointercancel", stop);
  };
  const nudge = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 0.1 : 0.03;
    const towardSecond = split.side === "left" ? "ArrowLeft" : "ArrowRight";
    const towardMain = split.side === "left" ? "ArrowRight" : "ArrowLeft";
    let next: number | null = null;
    if (event.key === towardMain) next = split.size + step;
    else if (event.key === towardSecond) next = split.size - step;
    if (next === null) return;
    event.preventDefault();
    useOverhaulStore.getState().setSplit({ ...split, size: Math.min(0.8, Math.max(0.2, next)) });
  };

  const left = split.side === "left";
  return (
    <>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={localize("Resize split view")}
        aria-valuemin={20}
        aria-valuemax={80}
        aria-valuenow={Math.round(size * 100)}
        tabIndex={0}
        className={cn("ov-split-divider", resizing && "is-resizing")}
        style={{ order: left ? -1 : 0, flexBasis: SPLIT_DIVIDER }}
        onPointerDown={startResize}
        onDoubleClick={() => useOverhaulStore.getState().setSplit({ ...split, size: 0.5 })}
        onKeyDown={nudge}
      />
      <section
        ref={paneRef}
        data-component="SplitViewSide"
        data-side={split.side}
        aria-label={localize("Second page")}
        className={cn("ov-split-pane", resizing && "is-resizing")}
        style={{ order: left ? -2 : 0, flex: `${size} 1 0px` } as CSSProperties}
      >
        <iframe ref={frameRef} src={src} title={localize("Second page")} className="ov-split-pane__frame" />
        {ready ? null : <div className="ov-split-pane__loading" aria-hidden="true" />}
      </section>
    </>
  );
}

// ── Main window: where a drag can land ──

type Target = { where: "left" | "right" | "main" | "second"; box: DOMRect };

/**
 * Shown while a tab (or Home, a Library section, a chat, the Docs button) is dragged. With one page, the
 * outer quarter of each side splits the page; with two, a drop on a side shows it there.
 */
export function SplitDropOverlay() {
  const localize = useLocalizedUiText();
  const drag = useOverhaulStore((s) => s.splitDrag);
  const split = useOverhaulStore((s) => s.split);
  const [area, setArea] = useState<DOMRect | null>(null);
  const [target, setTarget] = useState<Target | null>(null);

  useLayoutEffect(() => {
    const main = document.getElementById("mari-main");
    const pane = document.querySelector<HTMLElement>('[data-component="SplitViewSide"]');
    if (!main) return;
    const a = main.getBoundingClientRect();
    const b = pane?.getBoundingClientRect() ?? a;
    const left = Math.min(a.left, b.left);
    const right = Math.max(a.right, b.right);
    setArea(new DOMRect(left, a.top, right - left, a.height));
  }, [split]);

  /** The target under x, y: an outer quarter (one page) or a side (two pages). */
  const pick = (x: number, y: number): Target | null => {
    if (!area || y < area.top || y > area.bottom || x < area.left || x > area.right) return null;
    if (split) {
      const pane = document.querySelector<HTMLElement>('[data-component="SplitViewSide"]')?.getBoundingClientRect();
      const main = document.getElementById("mari-main")?.getBoundingClientRect();
      if (pane && x >= pane.left && x <= pane.right) return { where: "second", box: pane };
      if (main) return { where: "main", box: main };
      return null;
    }
    const edge = Math.max(120, area.width * 0.25);
    const half = (area.width - SPLIT_DIVIDER) / 2;
    if (x <= area.left + edge) return { where: "left", box: new DOMRect(area.left, area.top, half, area.height) };
    if (x >= area.right - edge)
      return { where: "right", box: new DOMRect(area.right - half, area.top, half, area.height) };
    return null;
  };
  const show = (next: Target | null) =>
    setTarget((before) =>
      before?.where === next?.where && before?.box.width === next?.box.width && before?.box.left === next?.box.left
        ? before
        : next,
    );
  const land = (x: number, y: number) => {
    const spot = pick(x, y);
    const page = useOverhaulStore.getState().splitDrag;
    setTarget(null);
    if (!spot || !page) return false;
    if (spot.where === "left" || spot.where === "right") openInSplit(page, spot.where);
    else if (spot.where === "second") openInSplit(page);
    else openInMain(page);
    return true;
  };
  const latest = useRef({ pick, show, land });
  latest.current = { pick, show, land };

  useEffect(() => {
    // A drag that ends anywhere else (Escape, a drop on the tab bar) clears it.
    const clear = () => endSplitDrag();
    // The chat list drags rows its own way: follow the pointer here, and land where it lets go.
    const follow = (event: MouseEvent | TouchEvent) => {
      const point = "touches" in event ? event.touches[0] : event;
      if (point) latest.current.show(latest.current.pick(point.clientX, point.clientY));
    };
    setSplitDropHandler((x, y) => latest.current.land(x, y));
    window.addEventListener("dragend", clear, true);
    window.addEventListener("drop", clear);
    window.addEventListener("mousemove", follow);
    window.addEventListener("touchmove", follow, { passive: true });
    return () => {
      setSplitDropHandler(null);
      window.removeEventListener("dragend", clear, true);
      window.removeEventListener("drop", clear);
      window.removeEventListener("mousemove", follow);
      window.removeEventListener("touchmove", follow);
    };
  }, []);

  if (!area || !drag) return null;

  const over = (event: React.DragEvent) => {
    const next = pick(event.clientX, event.clientY);
    if (next) {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
    }
    show(next);
  };
  const drop = (event: React.DragEvent) => {
    event.preventDefault();
    land(event.clientX, event.clientY);
    endSplitDrag();
  };

  const label =
    target?.where === "left"
      ? localize("Open on the left")
      : target?.where === "right"
        ? localize("Open on the right")
        : target
          ? localize("Show here")
          : null;

  return (
    <div
      className="ov-split-drop"
      data-component="SplitViewDropTargets"
      style={{ left: area.left, top: area.top, width: area.width, height: area.height }}
      onDragOver={over}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setTarget(null);
      }}
      onDrop={drop}
    >
      {split ? null : (
        <>
          <span className="ov-split-drop__edge is-left" aria-hidden="true" />
          <span className="ov-split-drop__edge is-right" aria-hidden="true" />
        </>
      )}
      {target ? (
        <div
          className="ov-split-drop__preview"
          style={{
            left: target.box.left - area.left,
            top: 0,
            width: target.box.width,
            height: area.height,
          }}
        >
          <span className="ov-split-drop__label">
            <Columns2 size={14} aria-hidden="true" />
            {label}
          </span>
        </div>
      ) : null}
    </div>
  );
}

// ── Inside the frame: the second side ──

const PLACE_FIELD =
  /DetailId$|DetailChatId$|Open$|^sidebar|^rightPanel|LibrarySelectedId$|LibraryKind$|^noodle|settingsTab/;

/** Runs in the frame before its first paint: open the page it was made for, without the side panes. */
export function startSplitPane() {
  if (!SPLIT_PANE) return;
  useUIStore.setState({ sidebarOpen: false, rightPanelOpen: false });
  showPage(SPLIT_PANE);
  startQuerySync();

  // The main window tells the frame what to show.
  window.addEventListener("message", (event: MessageEvent<SplitMessage>) => {
    if (event.origin !== origin() || event.source !== window.parent) return;
    const data = event.data;
    if (data?.type === "ov-split" && "open" in data) showPage(data.open);
  });

  // Look and settings changed in the main window show here too; where this side is stays its own.
  window.addEventListener("storage", (event) => {
    if (event.storageArea !== window.localStorage || !event.key) return;
    if (event.key === "marinara-device-look") void useDeviceLookStore.persist.rehydrate();
    if (event.key !== "marinara-engine-ui") return;
    const state = useUIStore.getState() as unknown as Record<string, unknown>;
    const place = Object.fromEntries(
      Object.entries(state).filter(([key, value]) => typeof value !== "function" && PLACE_FIELD.test(key)),
    );
    forgetSplitPaneCopy("marinara-engine-ui");
    forgetSplitPaneCopy("marinara-engine-ui:host");
    void Promise.resolve(useUIStore.persist.rehydrate()).then(() => useUIStore.setState(place));
  });
}

/** The second side's own bar: what it shows, Chat settings for a chat, and swap / only this / close. */
export function SplitPaneBar() {
  const localize = useLocalizedUiText();
  const barRef = useRef<HTMLElement | null>(null);
  usePublishTopBarHeight(barRef);
  const { data: chats = [] } = useChats();
  const current = useCurrentTab();
  const docsTabs = useOverhaulStore((s) => s.docsTabs);
  const page = useMemo<SplitPage>(
    () =>
      current?.kind === "docs"
        ? { kind: "docs", id: current.id, path: docsTabs[current.id] ?? null }
        : current
          ? { kind: current.kind, id: current.id }
          : HOME_PAGE,
    [current, docsTabs],
  );
  const pageKey = splitPageKey(page);
  useEffect(() => {
    window.parent.postMessage({ type: "ov-split", current: page } satisfies SplitMessage, origin());
    // The key is what matters: a new Docs path on the same tab is the frame's own business.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageKey]);

  const activeChatId = useChatStore((s) => s.activeChatId);
  const chatSettingsOpen = useFloatingWindowStore((s) => s.open[CHAT_SETTINGS_WINDOW_ID] === true);
  const activeChat = current?.kind === "chat" ? chats.find((chat) => chat.id === activeChatId) : undefined;
  const send = (action: "swap" | "only" | "close") =>
    window.parent.postMessage({ type: "ov-split", action } satisfies SplitMessage, origin());

  return (
    <header ref={barRef} className="ov-splitbar" data-component="SplitViewBar" data-overhaul-topbar="true">
      <span className="ov-splitbar__page">
        {current ? (
          <>
            <TabIcon tab={current} chats={chats} />
            <TabLabel tab={current} chats={chats} />
          </>
        ) : (
          <>
            <Home size={14} aria-hidden="true" className="ov-tab__icon" />
            <span className="ov-tab__label">{localize("Home")}</span>
          </>
        )}
      </span>
      {activeChat ? (
        <button
          type="button"
          className={cn("ov-text-btn", chatSettingsOpen && "is-on")}
          aria-pressed={chatSettingsOpen}
          data-window-opener={CHAT_SETTINGS_WINDOW_ID}
          onClick={(event) => {
            void preloadChatSettingsDrawer();
            const windows = useFloatingWindowStore.getState();
            if (windows.open[CHAT_SETTINGS_WINDOW_ID]) windows.dismissWindow(CHAT_SETTINGS_WINDOW_ID, { force: true });
            else windows.openWindow(CHAT_SETTINGS_WINDOW_ID, event.currentTarget);
          }}
        >
          <Settings2 size={15} aria-hidden="true" />
          <span>{localize("Chat settings")}</span>
          <ChatSettingsSummary chat={activeChat} fallback="" />
        </button>
      ) : null}
      {activeChat?.mode === "game" ? <GamePaneToggle /> : null}
      <span className="ov-splitbar__fill" />
      <button
        type="button"
        className="ov-icon-btn ov-icon-btn--sm"
        title={localize("Swap sides")}
        aria-label={localize("Swap sides")}
        onClick={() => send("swap")}
      >
        <ArrowLeftRight size={14} />
      </button>
      <button
        type="button"
        className="ov-icon-btn ov-icon-btn--sm"
        title={localize("Show only this page")}
        aria-label={localize("Show only this page")}
        onClick={() => send("only")}
      >
        <Maximize2 size={14} />
      </button>
      <button
        type="button"
        className="ov-icon-btn ov-icon-btn--sm"
        title={localize("Close split view")}
        aria-label={localize("Close split view")}
        onClick={() => send("close")}
      >
        <X size={14} />
      </button>
    </header>
  );
}
