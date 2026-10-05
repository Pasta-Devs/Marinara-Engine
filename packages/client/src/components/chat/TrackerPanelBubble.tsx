// ──────────────────────────────────────────────
// Phone Tracker Panel bubble
//
// With the Tracker Panel switched on in Chat Settings, a phone shows this bubble
// where the user places it. Tapping it opens the phone Tracker Panel (AppShell
// shows it while the bubble's window id is open); closing the panel brings focus
// back here. Its place saves with the chat like every other bubble.
// ──────────────────────────────────────────────
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { TrackerPanelIcon } from "../ui/TrackerPanelIcon";
import { WindowBubble } from "../ui/WindowBubble";
import { usePhoneBubbleBounds } from "../ui/FloatingWindow";
import { PHONE_BUBBLE_SIZE_PX, getPhoneBubbleSlot } from "../../lib/floating-window-layout";
import {
  PHONE_BUBBLE_Z_INDEX,
  TRACKER_PANEL_BUBBLE_ID,
  useFloatingWindowStore,
} from "../../stores/floating-window.store";

export function TrackerPanelBubble({ phoneSlot = 0 }: { phoneSlot?: number }) {
  const { t } = useTranslation();
  const bounds = usePhoneBubbleBounds(true);
  const saved = useFloatingWindowStore((state) => state.phoneBubbles[TRACKER_PANEL_BUBBLE_ID]);
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

  // Switching the Tracker Panel off (or leaving the chat) closes it too.
  useEffect(() => () => useFloatingWindowStore.getState().closeWindow(TRACKER_PANEL_BUBBLE_ID), []);

  return (
    <WindowBubble
      buttonRef={bubbleRef}
      id={TRACKER_PANEL_BUBBLE_ID}
      point={saved ?? { ...getPhoneBubbleSlot(bounds, phoneSlot, size), automatic: true }}
      bounds={bounds}
      size={PHONE_BUBBLE_SIZE_PX}
      onSizeChange={setSize}
      icon={<TrackerPanelIcon size="1.05rem" className="shrink-0" />}
      label={t("ui.panels.trackerpanelappearancedrawer.trackerPanel")}
      zIndex={PHONE_BUBBLE_Z_INDEX}
      attributes={{ "data-presentation": "sheet", "data-tracker-panel-toggle": "bubble" }}
      onMove={(point) => useFloatingWindowStore.getState().savePhoneBubble(TRACKER_PANEL_BUBBLE_ID, point)}
      onOpen={(bubble) =>
        useFloatingWindowStore.getState().openWindow(TRACKER_PANEL_BUBBLE_ID, bubble, { focus: false })
      }
    />
  );
}
