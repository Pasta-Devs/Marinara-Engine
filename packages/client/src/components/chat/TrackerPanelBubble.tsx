// ──────────────────────────────────────────────
// Trackers button for chats using the Tracker Panel
//
// This replaces the standard tracker window's button while the panel is selected.
// Its place saves with the chat like every other bubble.
// ──────────────────────────────────────────────
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { TrackerPanelIcon } from "../ui/TrackerPanelIcon";
import { WindowBubble } from "../ui/WindowBubble";
import { usePhoneBubbleBounds, useWindowBubbleBounds } from "../ui/FloatingWindow";
import { PHONE_BUBBLE_SIZE_PX, WINDOW_BUBBLE_SIZE_PX, getPhoneBubbleSlot } from "../../lib/floating-window-layout";
import { useMatchMedia } from "../../hooks/use-match-media";
import {
  FLOATING_WINDOW_Z_BASE,
  PHONE_BUBBLE_Z_INDEX,
  TRACKER_PANEL_BUBBLE_ID,
  useFloatingWindowStore,
} from "../../stores/floating-window.store";

export function TrackerPanelBubble({ chatId, phoneSlot = 0 }: { chatId: string; phoneSlot?: number }) {
  const { t } = useTranslation();
  const phoneLayout = useMatchMedia("(max-width: 767px)");
  const phoneBounds = usePhoneBubbleBounds(phoneLayout);
  const windowBounds = useWindowBubbleBounds(!phoneLayout);
  const bounds = phoneLayout ? phoneBounds : windowBounds;
  const saved = useFloatingWindowStore(
    (state) => (phoneLayout ? state.phoneBubbles : state.bubbles)[TRACKER_PANEL_BUBBLE_ID],
  );
  const open = useFloatingWindowStore((state) => state.open[TRACKER_PANEL_BUBBLE_ID] === true);
  const bubbleRef = useRef<HTMLButtonElement | null>(null);
  const [size, setSize] = useState(PHONE_BUBBLE_SIZE_PX);
  const wasOpenRef = useRef(open);

  // The panel closed: focus comes back to the bubble unless the user moved it elsewhere.
  useEffect(() => {
    if (wasOpenRef.current && !open && (!document.activeElement || document.activeElement === document.body)) {
      bubbleRef.current?.focus({ preventScroll: true });
    }
    wasOpenRef.current = open;
  }, [open]);

  // Desktop opens the selected panel initially; phones begin at the button.
  // Keep opening and cleanup together so remounts and chat switches restore the right surface.
  useEffect(() => {
    const windows = useFloatingWindowStore.getState();
    if (!phoneLayout) windows.openWindow(TRACKER_PANEL_BUBBLE_ID, null, { focus: false });
    return () => windows.closeWindow(TRACKER_PANEL_BUBBLE_ID);
  }, [chatId, phoneLayout]);

  return (
    <WindowBubble
      buttonRef={bubbleRef}
      id={TRACKER_PANEL_BUBBLE_ID}
      point={
        saved ?? {
          ...(phoneLayout ? getPhoneBubbleSlot(bounds, phoneSlot, size) : { x: bounds.left, y: bounds.top }),
          automatic: true,
        }
      }
      bounds={bounds}
      size={phoneLayout ? PHONE_BUBBLE_SIZE_PX : WINDOW_BUBBLE_SIZE_PX}
      onSizeChange={setSize}
      icon={<TrackerPanelIcon size="1.05rem" className="shrink-0" />}
      label={t("chat.trackerWindow.title")}
      expanded={open}
      zIndex={phoneLayout ? PHONE_BUBBLE_Z_INDEX : FLOATING_WINDOW_Z_BASE}
      attributes={{
        "data-presentation": phoneLayout ? "sheet" : "window",
        "data-tracker-panel-toggle": "bubble",
      }}
      onMove={(point) => {
        const state = useFloatingWindowStore.getState();
        if (phoneLayout) state.savePhoneBubble(TRACKER_PANEL_BUBBLE_ID, point);
        else state.saveBubble(TRACKER_PANEL_BUBBLE_ID, point);
      }}
      onOpen={(bubble) =>
        useFloatingWindowStore.getState().openWindow(TRACKER_PANEL_BUBBLE_ID, bubble, { focus: false })
      }
    />
  );
}
