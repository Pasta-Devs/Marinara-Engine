// ──────────────────────────────────────────────
// Hook: docked Chat settings makes room instead of covering the chat
//
// The new layout docks Chat settings on the right as a fixed pane. While it's
// open (and not popped out as a free window) the chat beside it gets a right
// margin as wide as the pane covers, so lines reflow and Send stays visible,
// the same way the Library pane makes room.
//
// The pane's host (the chat area that holds the window) gets:
//   data-cs-docked="reflow"   the chat is narrowed by --ov-cs-reflow
//   data-cs-docked="overlay"  the window is too narrow for both; the pane floats over the chat
// Narrow-window fallback: if reflowing would leave the chat under the minimum width, it overlays.
// The minimum is the CSS custom property --ov-chat-min on the host (or :root), else OV_CHAT_MIN_WIDTH.
// ──────────────────────────────────────────────
import { useEffect, type RefObject } from "react";
import { useUIStore } from "../stores/ui.store";

/** The narrowest a chat column may get before Chat settings floats over it instead. */
export const OV_CHAT_MIN_WIDTH = 400;

function chatMinWidth(host: HTMLElement): number {
  const value = Number.parseFloat(getComputedStyle(host).getPropertyValue("--ov-chat-min"));
  return Number.isFinite(value) && value > 0 ? value : OV_CHAT_MIN_WIDTH;
}

export function useChatSettingsReflow(bodyRef: RefObject<HTMLElement | null>, active: boolean) {
  useEffect(() => {
    if (!active) return;
    let frame = 0;
    let tries = 0;
    let teardown: (() => void) | null = null;

    // The window's body can mount a frame or two after it opens, so look for it until it's there.
    const attach = () => {
      const win = bodyRef.current?.closest<HTMLElement>(".mari-window");
      const host = win?.parentElement;
      if (!win || !host) {
        if (tries++ < 60) frame = requestAnimationFrame(attach);
        return;
      }
      const measure = () => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
          const hostRect = host.getBoundingClientRect();
          const paneRect = win.getBoundingClientRect();
          const covered = Math.max(0, Math.round(hostRect.right - paneRect.left));
          const fits = hostRect.width - covered >= chatMinWidth(host);
          host.dataset.csDocked = fits ? "reflow" : "overlay";
          // A right-side Tracker panel sits behind the docked pane, so the chat stops leaving room for it.
          host.dataset.csTracker = useUIStore.getState().trackerPanelSide;
          host.style.setProperty("--ov-cs-reflow", `${fits ? covered : 0}px`);
        });
      };
      measure();
      const observer = new ResizeObserver(measure);
      observer.observe(win);
      observer.observe(host);
      window.addEventListener("resize", measure);
      teardown = () => {
        observer.disconnect();
        window.removeEventListener("resize", measure);
        delete host.dataset.csDocked;
        delete host.dataset.csTracker;
        host.style.removeProperty("--ov-cs-reflow");
      };
    };
    attach();
    return () => {
      cancelAnimationFrame(frame);
      teardown?.();
    };
  }, [bodyRef, active]);
}
