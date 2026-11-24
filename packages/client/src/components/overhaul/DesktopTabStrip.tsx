// ──────────────────────────────────────────────
// UI overhaul (desktop): the tab strip
//
// Tabs that don't fit stay open in the overflow menu at the end of the strip
// (nothing is closed for lack of room). Tabs can be grouped Vivaldi-style:
// a group shows as one tab with a count, and when you're on one of its tabs
// a second row lists the group's tabs. Dragging a tab reorders it (a caret marks
// the spot); pausing over the middle of another tab (Vivaldi-style, about half a
// second) lights it up and dropping then groups them. Shift groups at once, and the
// right-click menu has Add to group too.
// ──────────────────────────────────────────────
import { isKeyboardContextMenu, useMenuKeyboard } from "../../hooks/use-menu-keyboard";
import { editorLeaveKeyForTab } from "../../lib/editor-leave";
import { useParkedDraftsStore } from "../../hooks/use-editor-leave-save";
import { toast } from "sonner";
import { translate } from "../../localization/i18n";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Home, Layers } from "lucide-react";
import type { Chat } from "@marinara-engine/shared";
import { overhaulTabKey, useOverhaulStore, type OverhaulTab } from "../../stores/overhaul.store";
import { useLocalizedUiText } from "../../localization/use-localized-ui-text";
import { cn } from "../../lib/utils";
import {
  TabIcon,
  TabCloseButton,
  TabLabel,
  TabPresence,
  TabDraftDot,
  activateTab,
  closeTabAndMove,
  goHome,
  reopenClosedTab,
} from "./OverhaulTopBar";
import {
  HOME_PAGE,
  SPLIT_MIME,
  beginSplitDrag,
  closeSplit,
  endSplitDrag,
  openInSplit,
  pageOfTab,
  splitPageKey,
} from "./split-view";

type Placed = { tab: OverhaulTab; key: string; index: number };
type StripItem =
  | { type: "tab"; itemKey: string; entry: Placed }
  | { type: "group"; itemKey: string; id: string; name: string; entries: Placed[] };

type Drag = { kind: "tab"; key: string } | { kind: "group"; id: string };
type DropSpot = { itemKey: string; where: "before" | "after" | "stack" };
type MenuTarget = { kind: "tab"; entry: Placed } | { kind: "group"; id: string };
type Menu = MenuTarget & { x: number; y: number };

const DRAG_MIME = "application/x-marinara-tab";
/** How long a dragged tab rests on another tab before dropping groups them. */
const GROUP_DWELL_MS = 450;

function placeIndex(spot: DropSpot, items: StripItem[]) {
  const item = items.find((entry) => entry.itemKey === spot.itemKey);
  if (!item) return null;
  const first = item.type === "tab" ? item.entry.index : item.entries[0]!.index;
  const last = item.type === "tab" ? item.entry.index : item.entries[item.entries.length - 1]!.index;
  return spot.where === "before" ? first : last + 1;
}

export function DesktopTabStrip({
  chats,
  current,
  currentKey,
  rowSlot,
}: {
  chats: Chat[];
  current: OverhaulTab | null;
  currentKey: string | null;
  /** Where the group's own row goes: a spot under the top bar, outside it (see OverhaulTopBar). */
  rowSlot: HTMLElement | null;
}) {
  const localize = useLocalizedUiText();
  const tabs = useOverhaulStore((s) => s.tabs);
  const tabGroups = useOverhaulStore((s) => s.tabGroups);
  // Split view: the tab on the second side is marked too.
  const splitKey = useOverhaulStore((s) => (s.split && s.splitShown ? splitPageKey(s.split.page) : null));
  const splitRoom = useOverhaulStore((s) => s.splitRoom);
  const touchScreen = typeof window !== "undefined" && window.matchMedia("(hover: none)").matches;
  const store = useOverhaulStore.getState;
  const stripRef = useRef<HTMLDivElement | null>(null);
  const lastMoveRef = useRef<{ key: string; width: number } | null>(null);
  const [clipped, setClipped] = useState<Set<string>>(() => new Set());
  const [drag, setDrag] = useState<Drag | null>(null);
  const [drop, setDrop] = useState<DropSpot | null>(null);
  const [menu, setMenu] = useState<Menu | null>(null);
  const [overflowOpen, setOverflowOpen] = useState(false);
  // A11Y3: both menus move focus with the arrows and give it back on Escape (hooks/use-menu-keyboard).
  const menuKeyboardRef = useRef(false);
  const menuOpenerRef = useRef<HTMLElement | null>(null);
  const tabMenuKeys = useMenuKeyboard({
    open: menu !== null,
    onClose: () => setMenu(null),
    trigger: menuOpenerRef.current,
    initialFocus: menuKeyboardRef.current ? "first" : null,
    anywhere: true,
  });
  const overflowKeys = useMenuKeyboard({
    open: overflowOpen,
    onOpen: () => setOverflowOpen(true),
    onClose: () => setOverflowOpen(false),
  });
  // Where the "More tabs" menu opens. It's portalled out of the top bar, which clips everything
  // below its one row (audit H1: the menu opened invisibly).
  const [overflowAt, setOverflowAt] = useState<{ top: number; right: number } | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);

  const items = useMemo<StripItem[]>(() => {
    const out: StripItem[] = [];
    const seen = new Set<string>();
    tabs.forEach((tab, index) => {
      const entry = { tab, key: overhaulTabKey(tab), index };
      if (!tab.group || !tabGroups[tab.group]) {
        out.push({ type: "tab", itemKey: entry.key, entry });
        return;
      }
      if (seen.has(tab.group)) {
        const group = out.find((item) => item.type === "group" && item.id === tab.group);
        if (group?.type === "group") group.entries.push(entry);
        return;
      }
      seen.add(tab.group);
      out.push({
        type: "group",
        itemKey: `group:${tab.group}`,
        id: tab.group,
        name: tabGroups[tab.group]!.name,
        entries: [entry],
      });
    });
    return out;
  }, [tabGroups, tabs]);

  const currentGroupId = current ? (tabs.find((tab) => overhaulTabKey(tab) === currentKey)?.group ?? null) : null;
  const currentGroup = items.find((item) => item.type === "group" && item.id === currentGroupId) as
    Extract<StripItem, { type: "group" }> | undefined;
  const currentItemKey = currentGroup ? currentGroup.itemKey : currentKey;

  // Remember the tab you were on inside a group, so clicking the group returns to it.
  useEffect(() => {
    if (currentGroupId && currentKey) store().setTabGroupLastKey(currentGroupId, currentKey);
  }, [currentGroupId, currentKey, store]);

  // Which strip items are cut off by the strip's edge (they move to the overflow menu).
  useLayoutEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;
    const measure = () => {
      const edge = strip.getBoundingClientRect().right + 0.5;
      const next = new Set<string>();
      strip.querySelectorAll<HTMLElement>("[data-item-key]").forEach((element) => {
        if (element.getBoundingClientRect().right > edge) next.add(element.dataset.itemKey!);
      });
      setClipped((before) => (before.size === next.size && [...next].every((key) => before.has(key)) ? before : next));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(strip);
    strip.querySelectorAll("[data-item-key]").forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [items]);

  // A new tab on screen gets its own chance to move into the strip.
  useEffect(() => {
    lastMoveRef.current = null;
  }, [currentItemKey]);

  // The tab on screen is always in the strip: if it's in the overflow, it takes the last visible place.
  useEffect(() => {
    if (!currentItemKey || !clipped.has(currentItemKey)) return;
    const visible = items.filter((item) => !clipped.has(item.itemKey));
    const lastVisible = visible[visible.length - 1];
    // Not even one tab fits (huge Display Size on a narrow screen): there's no place to move it to.
    // Moving it to the front anyway re-measured, found it still cut off and moved it again, forever
    // (React #185, theming panel H3). It stays in the overflow menu instead.
    if (!lastVisible) return;
    const at = placeIndex({ itemKey: lastVisible.itemKey, where: "before" }, items);
    if (at === null) return;
    // Moved once already at this strip width and still cut off: the tab is wider than the room left.
    const width = Math.round(stripRef.current?.getBoundingClientRect().width ?? 0);
    const lastMove = lastMoveRef.current;
    if (lastMove && lastMove.key === currentItemKey && lastMove.width === width) return;
    lastMoveRef.current = { key: currentItemKey, width };
    if (currentGroup) store().moveTabGroup(currentGroup.id, at);
    else if (currentKey) store().moveTab(currentKey, at);
  }, [clipped, currentGroup, currentItemKey, currentKey, items, store]);

  useEffect(() => {
    if (!menu && !overflowOpen) return;
    const close = (event: Event) => {
      if (event instanceof KeyboardEvent && event.key !== "Escape") return;
      if (event.type === "pointerdown" && (event.target as HTMLElement).closest?.("[data-ov-tabmenu]")) return;
      setMenu(null);
      setOverflowOpen(false);
    };
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", close);
    window.addEventListener("blur", close);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("resize", close);
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", close);
      window.removeEventListener("blur", close);
    };
  }, [menu, overflowOpen]);

  const activateGroup = (id: string) => {
    const group = items.find((item) => item.type === "group" && item.id === id);
    if (group?.type !== "group") return;
    const last = tabGroups[id]?.lastKey;
    const target = group.entries.find((entry) => entry.key === last) ?? group.entries[0]!;
    activateTab(target.tab);
  };

  const closeTab = (tab: OverhaulTab) => closeTabAndMove(tab, store().tabs, currentKey);
  const closedCount = useOverhaulStore((s) => s.closedTabs.length);
  // Ctrl+Shift+T reopens the last closed tab where the browser lets the page have it (installed app, Firefox).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || !event.shiftKey || event.altKey || event.key.toLowerCase() !== "t")
        return;
      if (reopenClosedTab()) event.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  // Bulk closes leave tabs whose unsaved edits wait as drafts; closing one of those asks on its own.
  const waitingDraft = (tab: OverhaulTab) => {
    const editorKey = editorLeaveKeyForTab(tab);
    return !!editorKey && useParkedDraftsStore.getState().keys.includes(editorKey);
  };
  // Says why some tabs stayed open, so it never looks like the close half-worked (TLR5).
  const sayKept = (kept: number) => {
    if (kept > 0) toast.info(translate("editor.draft.keptTabs", { count: kept }));
  };
  const closeOtherTabs = (keep: Placed) => {
    let kept = 0;
    for (const tab of store().tabs) {
      if (overhaulTabKey(tab) === keep.key) continue;
      if (waitingDraft(tab)) {
        kept += 1;
        continue;
      }
      store().rememberClosedTab(tab);
      store().closeTab(tab);
    }
    if (currentKey !== keep.key) activateTab(keep.tab);
    sayKept(kept);
  };
  const closeGroup = (id: string) => {
    const all = store().tabs;
    const members = all.filter((tab) => tab.group === id);
    const remaining = all.filter((tab) => tab.group !== id);
    const firstIndex = all.findIndex((tab) => tab.group === id);
    for (const tab of members) if (!waitingDraft(tab)) store().closeTab(tab);
    sayKept(members.filter(waitingDraft).length);
    if (currentGroupId === id) {
      const next = remaining[Math.min(firstIndex, remaining.length - 1)];
      if (next) activateTab(next);
      else goHome();
    }
  };

  // ── Drag and drop ──
  // Touch screens (a tablet held sideways): holding a tab or group opens its menu, like a right-click.
  const press = useRef<{ timer: ReturnType<typeof setTimeout>; x: number; y: number } | null>(null);
  // Where the finger was when holding opened the menu: moving on from there is a drag, which closes it.
  const heldMenuAt = useRef<{ x: number; y: number } | null>(null);
  const clearPress = () => {
    if (press.current) clearTimeout(press.current.timer);
    press.current = null;
  };
  useEffect(() => clearPress, []);
  const touchMenu = (value: MenuTarget) => ({
    onPointerDown: (event: React.PointerEvent) => {
      if (event.pointerType !== "touch") return;
      clearPress();
      const { clientX: x, clientY: y } = event;
      press.current = {
        x,
        y,
        timer: setTimeout(() => {
          press.current = null;
          setOverflowOpen(false);
          menuKeyboardRef.current = false;
          setMenu({ ...value, x, y });
          heldMenuAt.current = { x, y };
        }, 500),
      };
    },
    onPointerMove: (event: React.PointerEvent) => {
      if (press.current && Math.hypot(event.clientX - press.current.x, event.clientY - press.current.y) > 10)
        clearPress();
      const held = heldMenuAt.current;
      if (held && Math.hypot(event.clientX - held.x, event.clientY - held.y) > 16) {
        heldMenuAt.current = null;
        setMenu(null);
      }
    },
    onPointerUp: clearPress,
    onPointerCancel: clearPress,
  });

  const startDrag = (event: DragEvent, value: Drag) => {
    clearPress();
    // Holding a tab opens its menu, and keeping on into a drag (to reorder or to the split view edge) must not
    // leave that menu floating (Nov 14 finding).
    heldMenuAt.current = null;
    setMenu(null);
    // The press may land on the tab's inner (draggable) button: show the whole tab under the pointer either way.
    const whole = event.currentTarget as HTMLElement;
    if (event.target !== whole) {
      const box = whole.getBoundingClientRect();
      event.dataTransfer.setDragImage(whole, event.clientX - box.left, event.clientY - box.top);
    }
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(DRAG_MIME, "1");
    event.dataTransfer.setData("text/plain", value.kind === "tab" ? value.key : value.id);
    setDrag(value);
    // A tab dragged far to the left or right of the page opens there, beside the page you're on.
    if (value.kind === "tab") {
      const tab = store().tabs.find((entry) => overhaulTabKey(entry) === value.key);
      if (tab) {
        event.dataTransfer.setData(SPLIT_MIME, "1");
        beginSplitDrag(pageOfTab(tab));
      }
    }
  };
  // Pausing over the middle of another tab or group arms grouping (Vivaldi-style). A quick drop still only
  // reorders, so passing over tabs on the way never groups them by accident (Nov 7 panel finding).
  const dwell = useRef<{ itemKey: string; ready: boolean; timer: ReturnType<typeof setTimeout> } | null>(null);
  const clearDwell = () => {
    if (dwell.current) clearTimeout(dwell.current.timer);
    dwell.current = null;
  };
  useEffect(() => clearDwell, []);
  // While Shift is held, presses go straight to the tab's buttons (not the label or dots inside them), so a drag
  // that starts with Shift already down still begins. Tooltips inside the tab come back when Shift is let go.
  useEffect(() => {
    const root = document.documentElement;
    const sync = (event: KeyboardEvent) => root.toggleAttribute("data-ov-shift", event.shiftKey);
    const clear = () => root.removeAttribute("data-ov-shift");
    window.addEventListener("keydown", sync, true);
    window.addEventListener("keyup", sync, true);
    window.addEventListener("blur", clear);
    return () => {
      window.removeEventListener("keydown", sync, true);
      window.removeEventListener("keyup", sync, true);
      window.removeEventListener("blur", clear);
      clear();
    };
  }, []);
  const endDrag = () => {
    clearDwell();
    setDrag(null);
    setDrop(null);
    endSplitDrag();
  };
  /** Over a strip item: before/after by the pointer's half; pausing on the middle (or Shift) groups (tabs only). */
  const overStripItem = (event: DragEvent, item: StripItem) => {
    if (!drag) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    const self = drag.kind === "tab" ? drag.key === item.itemKey : item.itemKey === `group:${drag.id}`;
    const box = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - box.left) / box.width;
    const middle = drag.kind === "tab" && !self && x >= 0.25 && x <= 0.75;
    const half = x < 0.5 ? "before" : "after";
    if (!middle) clearDwell();
    else if (dwell.current?.itemKey !== item.itemKey) {
      clearDwell();
      const armed = {
        itemKey: item.itemKey,
        ready: false,
        timer: setTimeout(() => {
          armed.ready = true;
          setDrop((spot) => (spot?.itemKey === item.itemKey ? { itemKey: item.itemKey, where: "stack" } : spot));
        }, GROUP_DWELL_MS),
      };
      dwell.current = armed;
    }
    const where = middle && (event.shiftKey || dwell.current?.ready) ? "stack" : half;
    setDrop((spot) =>
      spot?.itemKey === item.itemKey && spot.where === where ? spot : { itemKey: item.itemKey, where },
    );
  };
  /** Over a group-row tab or an overflow row: before/after along `axis`. */
  const overEntry = (event: DragEvent, entry: Placed, axis: "x" | "y") => {
    if (!drag) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    const box = event.currentTarget.getBoundingClientRect();
    const before = axis === "x" ? event.clientX < box.left + box.width / 2 : event.clientY < box.top + box.height / 2;
    setDrop({ itemKey: `entry:${entry.key}`, where: before ? "before" : "after" });
  };
  const dropOnStripItem = (event: DragEvent, item: StripItem) => {
    event.preventDefault();
    const spot = drop;
    endDrag();
    if (!drag || !spot || spot.itemKey !== item.itemKey) return;
    if (spot.where === "stack" && drag.kind === "tab") {
      if (item.type === "group") store().setTabGroup(drag.key, item.id);
      else {
        const draggedGroup = store().tabs.find((tab) => overhaulTabKey(tab) === drag.key)?.group;
        if (draggedGroup) store().setTabGroup(drag.key, null);
        store().createTabGroup([item.entry.key, drag.key]);
      }
      return;
    }
    const at = placeIndex(spot, items);
    if (at === null) return;
    if (drag.kind === "group") store().moveTabGroup(drag.id, at);
    else store().setTabGroup(drag.key, null, at);
  };
  const dropOnEntry = (event: DragEvent, entry: Placed) => {
    event.preventDefault();
    const spot = drop;
    endDrag();
    if (!drag || !spot || spot.itemKey !== `entry:${entry.key}`) return;
    const at = spot.where === "before" ? entry.index : entry.index + 1;
    if (drag.kind === "group") {
      if (!entry.tab.group) store().moveTabGroup(drag.id, at);
      return;
    }
    store().setTabGroup(drag.key, entry.tab.group ?? null, at);
  };

  const dropClass = (itemKey: string) =>
    drag && drop?.itemKey === itemKey
      ? drop.where === "stack"
        ? "is-drop-stack"
        : drop.where === "before"
          ? "is-drop-before"
          : "is-drop-after"
      : null;

  const tabButton = (entry: Placed, extra?: { compact?: boolean }) => (
    <>
      {/* Draggable too: Chromium won't start a drag from a Shift-press on a non-draggable child (it extends the
          text selection instead), so Shift held before pressing the tab would never drag. See also data-ov-shift. */}
      <button
        type="button"
        draggable
        className="ov-tab__main"
        aria-current={entry.key === currentKey ? "page" : undefined}
        onClick={() => {
          activateTab(entry.tab);
          setOverflowOpen(false);
        }}
        onAuxClick={(event) => {
          if (event.button === 1) closeTab(entry.tab);
        }}
      >
        <TabIcon tab={entry.tab} chats={chats} />
        <TabLabel tab={entry.tab} chats={chats} />
        <TabDraftDot tab={entry.tab} current={entry.key === currentKey} />
        {extra?.compact ? null : <TabPresence tab={entry.tab} chats={chats} dotOnly />}
      </button>
      <TabCloseButton tab={entry.tab} chats={chats} onClose={() => closeTab(entry.tab)} />
    </>
  );

  const openMenu = (event: React.MouseEvent, value: MenuTarget) => {
    event.preventDefault();
    setOverflowOpen(false);
    // Shift+F10 or the menu key: the menu opens under the tab, on its first item (A11Y3).
    const keyboard = isKeyboardContextMenu(event);
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    menuKeyboardRef.current = keyboard;
    menuOpenerRef.current = event.target instanceof HTMLElement ? event.target.closest("button") : null;
    setMenu({ ...value, x: keyboard ? rect.left : event.clientX, y: keyboard ? rect.bottom + 4 : event.clientY });
  };

  const overflowItems = items.filter((item) => clipped.has(item.itemKey));
  const overflowCount = overflowItems.reduce((sum, item) => sum + (item.type === "tab" ? 1 : item.entries.length), 0);

  // Second row: the tabs of the group you're on, across the whole window under the top bar (Vivaldi's tab stacks).
  // It is its own bar below the top bar, not a wrapped line inside it: themes give the top bar a fixed height
  // (MARI to the Moon's ticker, Velvet Casket's fence), which squeezed the row into the bar and over the ticker.
  // It carries the top bar's names so a theme dresses its tabs like the ones above.
  const rowRef = useRef<HTMLDivElement | null>(null);
  const row = currentGroup ? (
    <div
      ref={rowRef}
      className="ov-topbar ov-tabrow2"
      data-component="TopBar"
      data-mari-part="top-bar"
      data-tab-row=""
      role="group"
      aria-label={`${localize("Tab group")}: ${currentGroup.name}`}
      onWheel={(event) => {
        // A mouse wheel scrolls a full row sideways.
        const el = event.currentTarget;
        if (Math.abs(event.deltaY) > Math.abs(event.deltaX) && el.scrollWidth > el.clientWidth) {
          el.scrollLeft += event.deltaY;
        }
      }}
    >
      <button
        type="button"
        className="ov-tabrow2__name"
        title={localize("Group options")}
        aria-haspopup="menu"
        onClick={(event) => {
          // The group's menu (rename, ungroup, close) opens under its name, on its first item from the keyboard.
          const rect = event.currentTarget.getBoundingClientRect();
          setOverflowOpen(false);
          menuKeyboardRef.current = event.detail === 0;
          menuOpenerRef.current = event.currentTarget;
          setMenu({ kind: "group", id: currentGroup.id, x: rect.left, y: rect.bottom + 4 });
        }}
        onContextMenu={(event) => openMenu(event, { kind: "group", id: currentGroup.id })}
      >
        <Layers size={14} aria-hidden="true" />
        <span className="ov-tabrow2__label">{currentGroup.name}</span>
        <span className="ov-tab__count">{currentGroup.entries.length}</span>
      </button>
      {/* A theme's strip under the tabs (MARI to the Moon's ticker, Velvet Casket's fence, Granite Watch's hazard
          stripe) moves from the top bar to here while a group's row shows: --mari-tab-row-strip-bg and
          --mari-tab-row-strip-height draw it, [data-mari-part="tab-row-strip"] can animate it. */}
      <span className="ov-tabrow2__strip" data-mari-part="tab-row-strip" aria-hidden="true" />
      <div className="ov-tabrow2__tabs">
        {currentGroup.entries.map((entry) => (
          <div
            key={entry.key}
            data-tab-key={entry.key}
            className={cn(
              "ov-tab",
              entry.key === currentKey && "is-on",
              entry.key === splitKey && "is-split",
              drag?.kind === "tab" && drag.key === entry.key && "is-dragging",
              dropClass(`entry:${entry.key}`),
            )}
            draggable
            onDragStart={(event) => startDrag(event, { kind: "tab", key: entry.key })}
            onDragOver={(event) => overEntry(event, entry, "x")}
            onDrop={(event) => dropOnEntry(event, entry)}
            onDragEnd={endDrag}
            onContextMenu={(event) => openMenu(event, { kind: "tab", entry })}
            {...touchMenu({ kind: "tab", entry })}
          >
            {tabButton(entry)}
          </div>
        ))}
      </div>
    </div>
  ) : null;

  useLayoutEffect(() => {
    const root = document.documentElement;
    root.toggleAttribute("data-ov-tabrow", Boolean(currentGroup));
    return () => root.removeAttribute("data-ov-tabrow");
  }, [currentGroup]);

  // The row's real height (a theme can make it taller): what sits under the top bar (the docked Chat settings
  // window) starts below it, and the fullscreen bar slides it in under itself.
  useLayoutEffect(() => {
    const el = rowRef.current;
    const root = document.documentElement;
    if (!el) {
      root.style.removeProperty("--ov-tabrow-h");
      return;
    }
    // A theme whose bar is see-through (its picture on the bar, the page's art behind) would leave the row
    // see-through too, with the page's art behind its tabs: such a row gets the page's own colour.
    const publish = () => {
      root.style.setProperty("--ov-tabrow-h", `${Math.round(el.offsetHeight)}px`);
      const bar = document.querySelector<HTMLElement>("header.ov-topbar");
      const color = bar ? getComputedStyle(bar).backgroundColor : "";
      // rgba(r, g, b, a) or color(srgb r g b / a); no alpha means opaque.
      const alpha = /(?:,|\/)\s*([\d.]+)\s*\)$/.exec(color)?.[1];
      el.toggleAttribute("data-solid", color === "transparent" || (alpha !== undefined && Number(alpha) < 0.85));
    };
    publish();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(publish);
    observer?.observe(el, { box: "border-box" });
    return () => {
      observer?.disconnect();
      root.style.removeProperty("--ov-tabrow-h");
    };
  }, [currentGroup ? currentGroup.id : null, rowSlot]);

  // The open tab stays in view in a long row.
  useEffect(() => {
    const el = rowRef.current;
    if (!el || !currentKey) return;
    const tab = el.querySelector<HTMLElement>(`[data-tab-key="${CSS.escape(currentKey)}"]`);
    tab?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [currentKey, currentGroup ? currentGroup.entries.length : 0]);

  const groupList = Object.entries(tabGroups);

  return (
    <>
      <nav
        className="ov-tabs"
        data-tour="tab-strip"
        data-tour-fit="children"
        aria-label={localize("Open tabs")}
        ref={stripRef}
        onDragLeave={() => setDrop(null)}
      >
        <button
          type="button"
          className={cn(
            "ov-tab ov-tab--home",
            current === null && "is-on",
            splitKey === splitPageKey(HOME_PAGE) && "is-split",
          )}
          aria-current={current === null ? "page" : undefined}
          onClick={goHome}
          draggable
          onDragStart={(event) => {
            event.dataTransfer.effectAllowed = "copyMove";
            event.dataTransfer.setData(SPLIT_MIME, "1");
            beginSplitDrag(HOME_PAGE);
          }}
          onDragEnd={endSplitDrag}
        >
          <Home size={14} aria-hidden="true" className="ov-tab__icon" />
          <span className="ov-tab__label">{localize("Home")}</span>
        </button>
        {items.map((item) => {
          const hidden = clipped.has(item.itemKey);
          if (item.type === "tab") {
            const entry = item.entry;
            return (
              <div
                key={item.itemKey}
                data-item-key={item.itemKey}
                data-tab-key={entry.key}
                className={cn(
                  "ov-tab",
                  entry.key === currentKey && "is-on",
                  entry.key === splitKey && "is-split",
                  hidden && "is-clipped",
                  drag?.kind === "tab" && drag.key === entry.key && "is-dragging",
                  dropClass(item.itemKey),
                )}
                draggable
                onDragStart={(event) => startDrag(event, { kind: "tab", key: entry.key })}
                onDragEnter={(event) => overStripItem(event, item)}
                onDragOver={(event) => overStripItem(event, item)}
                onDrop={(event) => dropOnStripItem(event, item)}
                onDragEnd={endDrag}
                onContextMenu={(event) => openMenu(event, { kind: "tab", entry })}
                {...touchMenu({ kind: "tab", entry })}
              >
                {tabButton(entry)}
              </div>
            );
          }
          const on = item.id === currentGroupId;
          return (
            <div
              key={item.itemKey}
              data-item-key={item.itemKey}
              className={cn(
                "ov-tab ov-tab--group",
                on && "is-on",
                hidden && "is-clipped",
                drag?.kind === "group" && drag.id === item.id && "is-dragging",
                dropClass(item.itemKey),
              )}
              draggable={renaming !== item.id}
              onDragStart={(event) => startDrag(event, { kind: "group", id: item.id })}
              onDragEnter={(event) => overStripItem(event, item)}
              onDragOver={(event) => overStripItem(event, item)}
              onDrop={(event) => dropOnStripItem(event, item)}
              onDragEnd={endDrag}
              onContextMenu={(event) => openMenu(event, { kind: "group", id: item.id })}
              {...touchMenu({ kind: "group", id: item.id })}
            >
              {renaming === item.id ? (
                <input
                  className="ov-tab__rename"
                  autoFocus
                  defaultValue={item.name}
                  aria-label={localize("Group name")}
                  onFocus={(event) => event.currentTarget.select()}
                  onBlur={(event) => {
                    store().renameTabGroup(item.id, event.currentTarget.value);
                    setRenaming(null);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") event.currentTarget.blur();
                    if (event.key === "Escape") setRenaming(null);
                  }}
                />
              ) : (
                <button
                  type="button"
                  className="ov-tab__main"
                  title={localize("Double-click to rename")}
                  onClick={() => activateGroup(item.id)}
                  onDoubleClick={() => setRenaming(item.id)}
                >
                  <Layers size={14} aria-hidden="true" className="ov-tab__icon" />
                  <span className="ov-tab__label" data-short={item.name.length <= 10 ? "true" : undefined}>
                    {item.name}
                  </span>
                  <span className="ov-tab__count">{item.entries.length}</span>
                </button>
              )}
            </div>
          );
        })}
      </nav>
      {overflowCount > 0 ? (
        <div className="ov-tabs-more" data-ov-tabmenu>
          <button
            type="button"
            className={cn("ov-icon-btn ov-tabs-more__btn", overflowOpen && "is-on")}
            {...overflowKeys.triggerProps}
            title={localize("More tabs")}
            aria-label={localize("More tabs")}
            onClick={(event) => {
              overflowKeys.noteOpener(event);
              setMenu(null);
              const rect = event.currentTarget.getBoundingClientRect();
              setOverflowAt({ top: rect.bottom + 4, right: Math.max(8, window.innerWidth - rect.right) });
              setOverflowOpen((open) => !open);
            }}
          >
            <ChevronDown size={14} />
            <span>{overflowCount}</span>
          </button>
          {overflowOpen && overflowAt
            ? createPortal(
                <div
                  ref={overflowKeys.menuRef}
                  className="ov-menu ov-tabs-more__menu"
                  role="menu"
                  data-ov-tabmenu
                  style={{ top: overflowAt.top, right: overflowAt.right }}
                >
                  {overflowItems.map((item) =>
                    item.type === "tab" ? (
                      <OverflowRow
                        key={item.itemKey}
                        entry={item.entry}
                        on={item.entry.key === currentKey}
                        dragging={drag?.kind === "tab" && drag.key === item.entry.key}
                        dropClass={dropClass(`entry:${item.entry.key}`)}
                        onDragStart={(event) => startDrag(event, { kind: "tab", key: item.entry.key })}
                        onDragOver={(event) => overEntry(event, item.entry, "y")}
                        onDrop={(event) => dropOnEntry(event, item.entry)}
                        onDragEnd={endDrag}
                      >
                        {tabButton(item.entry, { compact: true })}
                      </OverflowRow>
                    ) : (
                      <div key={item.itemKey} className="ov-tabs-more__group">
                        <button
                          type="button"
                          className="ov-tabs-more__grouphead"
                          draggable
                          onDragStart={(event) => startDrag(event, { kind: "group", id: item.id })}
                          onDragEnd={endDrag}
                          onClick={() => {
                            activateGroup(item.id);
                            setOverflowOpen(false);
                          }}
                        >
                          <Layers size={13} aria-hidden="true" />
                          {item.name}
                          <span className="ov-tab__count">{item.entries.length}</span>
                        </button>
                        {item.entries.map((entry) => (
                          <OverflowRow
                            key={entry.key}
                            entry={entry}
                            on={entry.key === currentKey}
                            dragging={drag?.kind === "tab" && drag.key === entry.key}
                            dropClass={dropClass(`entry:${entry.key}`)}
                            onDragStart={(event) => startDrag(event, { kind: "tab", key: entry.key })}
                            onDragOver={(event) => overEntry(event, entry, "y")}
                            onDrop={(event) => dropOnEntry(event, entry)}
                            onDragEnd={endDrag}
                          >
                            {tabButton(entry, { compact: true })}
                          </OverflowRow>
                        ))}
                      </div>
                    ),
                  )}
                  <p className="ov-tabs-more__hint">{localize("Drag a tab onto the tab bar to move it there.")}</p>
                </div>,
                document.body,
              )
            : null}
        </div>
      ) : null}
      {row && rowSlot ? createPortal(row, rowSlot) : row}
      {menu
        ? createPortal(
            <div
              ref={tabMenuKeys.menuRef}
              className="ov-menu ov-tabctx"
              role="menu"
              data-ov-tabmenu
              style={{ left: menu.x, top: menu.y }}
              onClick={() => setMenu(null)}
            >
              {menu.kind === "tab" ? (
                <>
                  <button type="button" role="menuitem" onClick={() => store().createTabGroup([menu.entry.key])}>
                    {localize("Add to new group")}
                  </button>
                  {groupList
                    .filter(([id]) => id !== menu.entry.tab.group)
                    .map(([id, group]) => (
                      <button
                        key={id}
                        type="button"
                        role="menuitem"
                        onClick={() => store().setTabGroup(menu.entry.key, id)}
                      >
                        {localize("Add to")} “{group.name}”
                      </button>
                    ))}
                  {menu.entry.tab.group ? (
                    <button type="button" role="menuitem" onClick={() => store().setTabGroup(menu.entry.key, null)}>
                      {localize("Remove from group")}
                    </button>
                  ) : null}
                  {/* Touch: tabs can't be dragged with a finger here, so the menu moves them. */}
                  {touchScreen && !menu.entry.tab.group && tabs.length > 1 ? (
                    <>
                      <div className="ov-menu__sep" role="separator" />
                      <button
                        type="button"
                        role="menuitem"
                        disabled={tabs.findIndex((tab) => overhaulTabKey(tab) === menu.entry.key) <= 0}
                        onClick={() => {
                          const from = store().tabs.findIndex((tab) => overhaulTabKey(tab) === menu.entry.key);
                          if (from > 0) store().moveTab(menu.entry.key, from - 1);
                        }}
                      >
                        {localize("Move left")}
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        disabled={tabs.findIndex((tab) => overhaulTabKey(tab) === menu.entry.key) >= tabs.length - 1}
                        onClick={() => {
                          const from = store().tabs.findIndex((tab) => overhaulTabKey(tab) === menu.entry.key);
                          if (from >= 0 && from < store().tabs.length - 1) store().moveTab(menu.entry.key, from + 2);
                        }}
                      >
                        {localize("Move right")}
                      </button>
                    </>
                  ) : null}
                  <div className="ov-menu__sep" role="separator" />
                  {!splitRoom ? null : menu.entry.key === splitKey ? (
                    <button type="button" role="menuitem" onClick={closeSplit}>
                      {localize("Close split view")}
                    </button>
                  ) : (
                    <button type="button" role="menuitem" onClick={() => openInSplit(pageOfTab(menu.entry.tab))}>
                      {localize("Open in split view")}
                    </button>
                  )}
                  <button type="button" role="menuitem" disabled={!closedCount} onClick={() => reopenClosedTab()}>
                    {localize("Reopen closed tab")}
                  </button>
                  {tabs.length > 1 ? (
                    <button type="button" role="menuitem" onClick={() => closeOtherTabs(menu.entry)}>
                      {localize("Close other tabs")}
                    </button>
                  ) : null}
                  <button type="button" role="menuitem" className="is-danger" onClick={() => closeTab(menu.entry.tab)}>
                    {localize("Close tab")}
                  </button>
                </>
              ) : (
                <>
                  <button type="button" role="menuitem" onClick={() => setRenaming(menu.id)}>
                    {localize("Rename group")}
                  </button>
                  <button type="button" role="menuitem" onClick={() => store().ungroupTabs(menu.id)}>
                    {localize("Ungroup tabs")}
                  </button>
                  <button type="button" role="menuitem" className="is-danger" onClick={() => closeGroup(menu.id)}>
                    {localize("Close group")}
                  </button>
                </>
              )}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function OverflowRow({
  children,
  on,
  dragging,
  dropClass,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  entry: Placed;
  children: ReactNode;
  on: boolean;
  dragging: boolean;
  dropClass: string | null;
  onDragStart: (event: DragEvent) => void;
  onDragOver: (event: DragEvent) => void;
  onDrop: (event: DragEvent) => void;
  onDragEnd: () => void;
}) {
  return (
    <div
      role="menuitem"
      className={cn("ov-tab ov-tabs-more__row", on && "is-on", dragging && "is-dragging", dropClass)}
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
    >
      {children}
    </div>
  );
}
