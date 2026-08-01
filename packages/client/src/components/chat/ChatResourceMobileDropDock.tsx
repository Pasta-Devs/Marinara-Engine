import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import {
  getActiveChatResourceTouchDrag,
  requestChatResourceAssignment,
  setPendingChatResourcePanelRestore,
  subscribeChatResourceTouchDrag,
} from "../../lib/chat-resource-drag";
import { resolveChatResourceDropAction } from "../../lib/chat-resource-drop-capabilities";
import { useChatStore } from "../../stores/chat.store";
import { useUIStore } from "../../stores/ui.store";
import {
  CHAT_RESOURCE_ACTION_ACCENT_CLASS,
  CHAT_RESOURCE_ACTION_TITLE_KEY,
  chatResourceBlockedKey,
  getChatResourceActionIcon,
} from "./ChatResourceDropOverlay";

/** The dock stays small on screen, but a dragging thumb gets a forgiving margin around it. */
const DOCK_HIT_PADDING_PX = 16;

/**
 * The library panel covers the whole screen on mobile, so a touch drag has no chat surface to aim
 * at. This dock rides above the panel while a chat-resource touch drag is active and hands the drop
 * to the same assignment flow the desktop overlay and the row action button use.
 */
export function ChatResourceMobileDropDock() {
  const { t } = useTranslation();
  const payload = useSyncExternalStore(subscribeChatResourceTouchDrag, getActiveChatResourceTouchDrag);
  const rightPanelOpen = useUIStore((state) => state.rightPanelOpen);
  const chat = useChatStore((state) => state.activeChat);
  const dockRef = useRef<HTMLDivElement>(null);
  const rectRef = useRef<DOMRect | null>(null);
  const [over, setOver] = useState(false);

  const visible = payload !== null && rightPanelOpen && chat !== null;
  const action = visible && payload && chat ? resolveChatResourceDropAction(payload, chat) : null;

  // The dock is fixed and does not move for the life of a drag, so one measurement is enough.
  useLayoutEffect(() => {
    rectRef.current = visible ? (dockRef.current?.getBoundingClientRect() ?? null) : null;
  }, [visible]);

  useEffect(() => {
    if (!visible || !payload) {
      setOver(false);
      return;
    }
    const isOverDock = (touch: Touch) => {
      const rect = rectRef.current;
      return (
        !!rect &&
        touch.clientX >= rect.left - DOCK_HIT_PADDING_PX &&
        touch.clientX <= rect.right + DOCK_HIT_PADDING_PX &&
        touch.clientY >= rect.top - DOCK_HIT_PADDING_PX &&
        touch.clientY <= rect.bottom + DOCK_HIT_PADDING_PX
      );
    };
    const handleTouchMove = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (touch) setOver(isOverDock(touch));
    };
    // Capture phase: the touch drag hook clears the payload on its own bubble-phase `touchend`.
    const handleTouchEnd = (event: TouchEvent) => {
      const touch = event.changedTouches[0];
      setOver(false);
      if (!touch || !isOverDock(touch)) return;
      // Land the user back on the chat so the result, the toast and its undo are actually visible,
      // then return to the library once the drop's follow-up is done.
      setPendingChatResourcePanelRestore(useUIStore.getState().rightPanel);
      useUIStore.getState().closeRightPanel();
      requestChatResourceAssignment(payload);
    };
    window.addEventListener("touchmove", handleTouchMove, { capture: true, passive: true });
    window.addEventListener("touchend", handleTouchEnd, { capture: true });
    return () => {
      window.removeEventListener("touchmove", handleTouchMove, { capture: true });
      window.removeEventListener("touchend", handleTouchEnd, { capture: true });
    };
  }, [payload, visible]);

  if (!visible || !payload || !action) return null;

  const blocked = action.type === "blocked";
  const title = blocked
    ? t(chatResourceBlockedKey(action), { name: payload.label })
    : t(CHAT_RESOURCE_ACTION_TITLE_KEY[action.type], { name: payload.label });

  return createPortal(
    <div
      ref={dockRef}
      data-chat-resource-mobile-dock={blocked ? "blocked" : action.type}
      role="status"
      aria-live="polite"
      aria-label={title}
      className={`mari-chat-drop-dock fixed left-2 top-1/2 z-[9000] flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-2xl border-2 border-dotted backdrop-blur-sm ${
        blocked ? "mari-chat-drop-dock--blocked" : CHAT_RESOURCE_ACTION_ACCENT_CLASS[action.type]
      } ${over ? "mari-chat-drop-dock--over" : ""}`}
    >
      <span
        className={
          blocked
            ? "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--destructive)]/15 text-[var(--destructive)]"
            : "mari-chat-drop-icon flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
        }
      >
        {getChatResourceActionIcon(action)}
      </span>
    </div>,
    document.body,
  );
}
