// ──────────────────────────────────────────────
// Chat Settings window: shared look and default placement
//
// Used by the Chat Settings window and by its loading placeholder, so both open
// in the same place and the placeholder does not jump when the panel arrives.
// ──────────────────────────────────────────────
import { useEffect, useState, type CSSProperties } from "react";
import {
  WINDOW_MARGIN_PX,
  placeWindowBesideBubble,
  type WindowBounds,
  type WindowLayout,
} from "../../lib/floating-window-layout";
import { cn } from "../../lib/utils";
import { isDesktopShellNavigationTarget } from "../../lib/chat-floating-ui-events";
import { useUIStore } from "../../stores/ui.store";
import { NEUTRAL_SURFACE_VARIABLES } from "../ui/neutral-surface-styles";
import { isChatToolbarPanelTrigger, type ChatToolbarFloatingPanelAnchor } from "./ChatToolbarControls";

const CHAT_SETTINGS_WINDOW_WIDTH_REM = 34;
const CHAT_WINDOW_GAP_PX = 12;

export function readCssPixels(element: Element, property: string) {
  const value = Number.parseFloat(window.getComputedStyle(element).getPropertyValue(property));
  return Number.isFinite(value) ? value : 0;
}

/**
 * The free part of the visible chat: inside its edges (minus a gap), below its top controls and above its
 * message box. Chat windows open here by default.
 */
export function readChatWindowArea(bounds: WindowBounds) {
  const chatRoot = Array.from(document.querySelectorAll<HTMLElement>("[data-chat-mode]")).find((element) => {
    const rect = element.getBoundingClientRect();
    return rect.width > 1 && rect.height > 1;
  });
  const rootRect = chatRoot?.getBoundingClientRect();
  const topControlsBottom = Math.max(
    0,
    ...Array.from(chatRoot?.querySelectorAll("[data-chat-help]") ?? [])
      // Top controls and their bubbles count; an open control window does not.
      .filter((element) => !element.closest(".mari-window"))
      .map((element) => element.getBoundingClientRect())
      .filter((rect) => rect.width > 1 && rect.height > 1 && rect.top < (rootRect?.top ?? 0) + 80)
      .map((rect) => rect.bottom),
  );
  const composer = chatRoot?.querySelector("[data-chat-composer]");
  const composerTop = (composer?.closest("[data-chat-resource-drop-exclude]") ?? composer)?.getBoundingClientRect().top;
  return {
    chatRoot,
    left: Math.max(bounds.left, (rootRect?.left ?? bounds.left - WINDOW_MARGIN_PX) + CHAT_WINDOW_GAP_PX),
    right: Math.min(bounds.right, (rootRect?.right ?? bounds.right + WINDOW_MARGIN_PX) - CHAT_WINDOW_GAP_PX),
    top: Math.max(bounds.top, topControlsBottom ? topControlsBottom + WINDOW_MARGIN_PX : bounds.top + 48),
    bottom: Math.min(bounds.bottom, composerTop ? composerTop - CHAT_WINDOW_GAP_PX : bounds.bottom - 132),
  };
}

/**
 * Open below the Chat Settings button, within the chat and clear of a right-side Tracker Panel.
 */
export function getChatSettingsDefaultLayout(bounds: WindowBounds): WindowLayout {
  const remPx = readCssPixels(document.documentElement, "font-size") || 16;
  const area = readChatWindowArea(bounds);
  // A right-side Tracker Panel floats over the chat; AppShell publishes its width plus a gap.
  const trackerClearance =
    area.chatRoot && useUIStore.getState().trackerPanelSide === "right"
      ? readCssPixels(area.chatRoot, TRACKER_CLEARANCE_VARIABLE)
      : 0;
  const right = Math.min(bounds.right - trackerClearance, area.right);
  const width = Math.min(CHAT_SETTINGS_WINDOW_WIDTH_REM * remPx, right - bounds.left);
  const button = document.querySelector<HTMLElement>("[data-chat-settings-button]")?.getBoundingClientRect();
  if (button && button.width > 1 && button.height > 1) {
    const geometry = placeWindowBesideBubble(
      { width, height: area.bottom - area.top },
      { x: button.left, y: button.top },
      { ...bounds, right, bottom: area.bottom },
      { minWidth: 320, minHeight: 240 },
      button.height,
    );
    return { ...geometry, pinned: false, locked: false };
  }
  return { x: right - width, y: area.top, width, height: area.bottom - area.top, pinned: false, locked: false };
}

const TRACKER_CLEARANCE_VARIABLE = "--tracker-panel-overlay-clearance";

/**
 * AppShell's Tracker Panel clearance, kept current. It changes when the panel opens, closes or settles
 * on its width, so passing it as `defaultLayoutKey` keeps an unmoved window clear of the panel.
 */
export function useTrackerPanelClearance(enabled: boolean) {
  const [clearance, setClearance] = useState("");
  useEffect(() => {
    if (!enabled) return;
    const host = document.querySelector<HTMLElement>(`[style*="${TRACKER_CLEARANCE_VARIABLE}"]`);
    if (!host) return;
    const read = () => setClearance(host.style.getPropertyValue(TRACKER_CLEARANCE_VARIABLE));
    read();
    const observer = new MutationObserver(read);
    observer.observe(host, { attributes: true, attributeFilter: ["style"] });
    return () => observer.disconnect();
  }, [enabled]);
  return clearance;
}

/** Presses that do not count as "outside" Chat Settings. */
function ignoreChatSettingsOutsidePointer(target: Element) {
  return (
    isDesktopShellNavigationTarget(target) ||
    isChatToolbarPanelTrigger(target, "settings") ||
    // The expanded prompt editor, the macro reference and other chat panels render in portals
    // outside the window; using them must not close Chat Settings, only their own close controls.
    !!target.closest("[data-chat-floating-panel], [data-macro-modal]")
  );
}

/** Props both the window and its loading placeholder pass to <FloatingWindow>. */
export function getChatSettingsWindowProps(anchor: ChatToolbarFloatingPanelAnchor | undefined) {
  // On phones the sheet opens beside the toolbar menu it came from, as it always has.
  const sheetStyle: CSSProperties | undefined =
    anchor && typeof window !== "undefined" && window.innerWidth < 768
      ? {
          bottom: "auto",
          left: "auto",
          maxHeight: `min(42rem, calc(100dvh - ${anchor.top}px - 0.75rem - var(--mari-safe-area-inset-bottom,env(safe-area-inset-bottom))))`,
          right: `${anchor.right}px`,
          top: `${anchor.top}px`,
          width: `min(34rem, calc(100vw - ${anchor.right}px - 0.75rem))`,
        }
      : undefined;
  return {
    getDefaultLayout: getChatSettingsDefaultLayout,
    className: cn("marinara-chat-popover animate-message-in", NEUTRAL_SURFACE_VARIABLES),
    sheetClassName: cn(
      "fixed bottom-3 z-[70] w-[min(34rem,calc(100vw-var(--mari-chat-ui-inset-left,0px)-var(--mari-chat-ui-inset-right,0px)-1.5rem))] overflow-hidden max-md:inset-x-2 max-md:bottom-[calc(0.75rem+var(--mari-safe-area-inset-bottom,env(safe-area-inset-bottom)))] max-md:top-[calc(3.5rem+env(safe-area-inset-top))] max-md:w-auto",
      anchor ? "" : "right-[calc(var(--mari-chat-ui-inset-right,0px)+0.75rem)] top-14",
    ),
    sheetStyle,
    headerClassName: "marinara-chat-popover__header",
    titleClassName: "marinara-chat-popover__title text-xs font-semibold leading-tight",
    rootAttributes: { "data-chat-floating-panel": true } as Record<`data-${string}`, boolean>,
    ignoreOutsidePointer: ignoreChatSettingsOutsidePointer,
  };
}
