// ──────────────────────────────────────────────
// Chat control windows: the chat's top controls as minimizable windows
//
// Game's Session, Volume, Assets and Game controls, the connected chat, package
// toolbars and Beholder each open in a small window that minimizes to a button (its
// bubble). They start minimized, their bubbles in a row at the chat's top right where
// the buttons (and a phone's menu button) used to be. On a phone each opens as a sheet.
// ──────────────────────────────────────────────
import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ArrowRightLeft, Undo2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  FloatingWindow,
  PHONE_FULL_SHEET_CLASS,
  PHONE_SHEET_CLASS,
  readFloatingWindowBounds,
} from "../ui/FloatingWindow";
import { Drawer } from "../ui/Drawer";
import { useChatControlDockStore } from "../ui/drawer-host";
import { NEUTRAL_PANEL_SCROLL_AREA, NEUTRAL_SURFACE_VARIABLES } from "../ui/neutral-surface-styles";
import { useMatchMedia } from "../../hooks/use-match-media";
import {
  WINDOW_BUBBLE_SIZE_PX,
  getBubbleRowSlot,
  getPhoneBubbleSlot,
  placeWindowBesideBubble,
  type WindowBounds,
  type WindowLayout,
} from "../../lib/floating-window-layout";
import { cn } from "../../lib/utils";
import { BUBBLE_SNAP_GAP_PX } from "../../lib/window-bubble-snap";
import { useUIStore } from "../../stores/ui.store";
import { CHAT_SETTINGS_WINDOW_ID, useFloatingWindowStore } from "../../stores/floating-window.store";
import { readChatWindowArea, readCssPixels } from "./chat-settings-window";

const TRACKER_CLEARANCE_VARIABLE = "--tracker-panel-overlay-clearance";

/** Each control window's id; Game's ids are only used in Game chats. */
export const CHAT_CONTROL_WINDOW_IDS = {
  connectedChat: "control:connected-chat",
  beholder: (packageId: string) => `control:beholder:${packageId}`,
  gameControls: "control:game",
  session: "control:session",
  volume: "control:volume",
  assets: "control:assets",
  package: (packageId: string) => `control:package:${packageId}`,
} as const;

/**
 * Bubbles start in a row at the chat's top right, where its buttons were: `slot` 0 is the rightmost.
 * Their windows open below them. Both start minimized, unpinned and unlocked.
 */
export function getChatControlDefaultLayout(
  bounds: WindowBounds,
  slot: number,
  size: { width: number; height: number },
  rowOffset = 0,
  bubbleSize = WINDOW_BUBBLE_SIZE_PX,
): WindowLayout {
  const area = readChatWindowArea(bounds);
  // A right-side Tracker Panel floats over the chat; keep the bubbles clear of it.
  const trackerClearance =
    area.chatRoot && useUIStore.getState().trackerPanelSide === "right"
      ? readCssPixels(area.chatRoot, TRACKER_CLEARANCE_VARIABLE)
      : 0;
  const right = Math.min(bounds.right - trackerClearance, area.right);
  const row = getBubbleRowSlot(bounds, slot, { right, size: bubbleSize, gap: BUBBLE_SNAP_GAP_PX });
  const bubble = { x: row.x, y: row.y + rowOffset };
  const geometry = placeWindowBesideBubble(size, bubble, bounds, { minWidth: 200, minHeight: 96 }, bubbleSize);
  return { ...geometry, pinned: false, locked: false, minimized: true, bubble };
}

/** Presses on popovers and dialogs the window's content opens (they render in portals) stay inside. */
function ignoreControlWindowOutsidePointer(target: Element) {
  return !!target.closest("[data-chat-floating-panel], [data-macro-modal]");
}

export interface ChatControlWindowProps {
  id: string;
  title: string;
  icon: ReactNode;
  /** Its bubble's place in the default row, counted from the right. */
  slot: number;
  /** Its bubble's place in the phone row, counted from the right (`slot` otherwise). */
  phoneSlot?: number;
  /** The window's size when it first opens. */
  width: number;
  height: number;
  /** The Help layout target its bubble (and window) stand for. */
  helpTarget?: string;
  /** Wraps the content in a scroll area; off for content that scrolls itself (it then fills a phone's screen). */
  scroll?: boolean;
  /** Drawn on the bubble (a status dot, say). */
  bubbleBadge?: ReactNode;
  /** Moves the default row down (px), below a bar the chat shows at its top (Game's tactical combat). */
  rowOffset?: number;
  children: ReactNode;
}

/** A chat control as a minimizable window (a bubble and a sheet on phones). */
export function ChatControlWindow({
  id,
  title,
  icon,
  slot,
  phoneSlot = slot,
  width,
  height,
  helpTarget,
  scroll = true,
  bubbleBadge,
  rowOffset = 0,
  children,
}: ChatControlWindowProps) {
  const { t } = useTranslation();
  const phoneLayout = useMatchMedia("(max-width: 767px)");
  const savedLayout = useFloatingWindowStore((state) => state.layouts[id]);
  const dockHost = useChatControlDockStore((state) => state.element);
  const sectionOpen = useUIStore((state) => state.chatSettingsExpandedSections[id] !== false);
  const setSectionExpanded = useUIStore((state) => state.setChatSettingsSectionExpanded);
  const focusDockRef = useRef(false);
  const docked = savedLayout?.docked === true;

  useEffect(() => {
    if (!docked || !dockHost || !focusDockRef.current) return;
    focusDockRef.current = false;
    dockHost.querySelector<HTMLElement>(`[data-drawer="${CSS.escape(id)}"] [data-drawer-toggle]`)?.focus();
  }, [docked, dockHost, id]);

  const dock = () => {
    const windows = useFloatingWindowStore.getState();
    const layout =
      windows.layouts[id] ??
      getChatControlDefaultLayout(readFloatingWindowBounds(), slot, { width, height }, rowOffset);
    focusDockRef.current = true;
    setSectionExpanded(id, true);
    windows.saveLayout(id, { ...layout, docked: true });
    windows.closeWindow(id);
    windows.openWindow(CHAT_SETTINGS_WINDOW_ID, null, { focus: false });
  };
  const popOut = (layout: WindowLayout) => {
    const windows = useFloatingWindowStore.getState();
    // A phone sheet has no desktop geometry: moving through it must preserve the computer's layout.
    windows.saveLayout(
      id,
      phoneLayout && savedLayout
        ? { ...savedLayout, docked: false }
        : { ...savedLayout, ...layout, docked: false, minimized: phoneLayout },
    );
    if (phoneLayout) {
      windows.closeWindow(id);
      windows.dismissWindow(CHAT_SETTINGS_WINDOW_ID, { force: true });
    } else windows.openWindow(id);
  };
  const handleDragMove = (point: { x: number; y: number }, phase: "move" | "end") => {
    const target = dockHost?.closest<HTMLElement>(".mari-window");
    const rect = target && !target.hidden && target.getClientRects().length > 0 ? target.getBoundingClientRect() : null;
    const over =
      !!rect && point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom;
    if (phase === "move") {
      if (over) target?.setAttribute("data-drop-target", "true");
      else target?.removeAttribute("data-drop-target");
      return;
    }
    target?.removeAttribute("data-drop-target");
    if (!over) return;
    dock();
    return true;
  };
  if (docked) {
    return dockHost
      ? createPortal(
          <Drawer
            id={id}
            title={title}
            icon={icon}
            open={sectionOpen}
            onOpenChange={(open) => setSectionExpanded(id, open)}
            onPopOut={popOut}
            bodyClassName={cn("pt-3", !scroll && "flex h-96 min-h-0 flex-col")}
            rootAttributes={{ "data-chat-settings-section": id, "data-docked-chat-control": id }}
          >
            {children}
          </Drawer>,
          dockHost,
        )
      : null;
  }
  return (
    <FloatingWindow
      id={id}
      title={title}
      titleIcon={
        <span className="flex shrink-0 text-[var(--muted-foreground)] [&_svg]:h-3.5 [&_svg]:w-3.5">{icon}</span>
      }
      closeLabel={t("window.controls.close")}
      closeAccessory={
        <button
          type="button"
          data-window-control="put-back"
          aria-label={t("drawer.popOut.close", { host: t("chat.toolbar.settings") })}
          title={t("drawer.popOut.close", { host: t("chat.toolbar.settings") })}
          className="mari-window__control"
          onClick={dock}
        >
          <Undo2 size="0.875rem" />
        </button>
      }
      presentation={phoneLayout ? "sheet" : "window"}
      sheetClassName={cn(PHONE_SHEET_CLASS, !scroll && PHONE_FULL_SHEET_CLASS)}
      minimizable={{
        icon,
        label: title,
        getPhoneBubble: (bounds, size) => {
          const point = getPhoneBubbleSlot(bounds, phoneSlot, size);
          return { x: point.x, y: point.y + rowOffset };
        },
        bubbleBadge,
      }}
      getDefaultLayout={(bounds, bubbleSize) =>
        getChatControlDefaultLayout(bounds, slot, { width, height }, rowOffset, bubbleSize)
      }
      defaultLayoutKey={String(rowOffset)}
      minWidth={200}
      minHeight={96}
      autoFocus={false}
      className={cn("marinara-chat-popover", NEUTRAL_SURFACE_VARIABLES)}
      headerClassName="marinara-chat-popover__header"
      titleClassName="marinara-chat-popover__title text-xs font-semibold leading-tight"
      rootAttributes={{ "data-chat-help": helpTarget, "data-chat-control-window": id }}
      ignoreOutsidePointer={ignoreControlWindowOutsidePointer}
      onDragMove={handleDragMove}
    >
      {scroll ? (
        <div className={cn(NEUTRAL_PANEL_SCROLL_AREA, "@container min-h-0 flex-1 overflow-y-auto overscroll-contain")}>
          {children}
        </div>
      ) : (
        children
      )}
    </FloatingWindow>
  );
}

/** The connected chat control (every mode): its window offers the switch to the other chat. */
export function ChatConnectedChatWindow({
  name,
  onSwitch,
  phoneSlot,
  rowOffset,
}: {
  name?: string | null;
  onSwitch: () => void;
  phoneSlot?: number;
  rowOffset?: number;
}) {
  const { t } = useTranslation();
  const label = name ? t("chat.toolbar.switchTo", { name }) : t("chat.toolbar.switchToConnected");
  return (
    <ChatControlWindow
      id={CHAT_CONTROL_WINDOW_IDS.connectedChat}
      title={t("chat.toolbar.connectedChat")}
      icon={<ArrowRightLeft size={14} />}
      slot={0}
      phoneSlot={phoneSlot}
      rowOffset={rowOffset}
      width={260}
      height={120}
      helpTarget="connected-chat"
    >
      <div className="p-2">
        <button
          type="button"
          onClick={onSwitch}
          className="mari-chrome-control flex w-full min-w-0 items-center gap-2 px-3 py-2 text-xs"
        >
          <ArrowRightLeft size="0.8125rem" className="shrink-0" />
          <span className="min-w-0 truncate">{label}</span>
        </button>
      </div>
    </ChatControlWindow>
  );
}
