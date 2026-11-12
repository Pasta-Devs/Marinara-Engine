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
// Narrow-window fallback: if reflowing would leave message bubbles under OV_BUBBLE_MIN_WIDTH, the chat
// list is folded away first (and comes back on close); only if that is still too narrow does it overlay.
// The minimum is the CSS custom property --ov-chat-min on the host (or :root), else OV_CHAT_MIN_WIDTH.
// ──────────────────────────────────────────────
import { useEffect, type RefObject } from "react";
import { useUIStore } from "../stores/ui.store";

/** The narrowest a chat column may get before Chat settings floats over it instead. */
export const OV_CHAT_MIN_WIDTH = 560;
/** What the reader actually needs: message bubbles at least this wide (user panel 3, PR2). */
export const OV_BUBBLE_MIN_WIDTH = 480;
/** Slack either side of the bubble threshold, so resizing a window doesn't flip it back and forth. */
const BUBBLE_HYSTERESIS = 24;
/** The avatar and side gutters around a bubble, capped so a bubble held at its max width doesn't count. */
const MAX_BUBBLE_OVERHEAD = 320;

function chatMinWidth(host: HTMLElement): number {
  const value = Number.parseFloat(getComputedStyle(host).getPropertyValue("--ov-chat-min"));
  return Number.isFinite(value) && value > 0 ? value : OV_CHAT_MIN_WIDTH;
}

/**
 * Handing over between two panes on the same host: the loading pane (shown while Chat settings' code
 * loads) makes room right away, and the real pane takes over when it mounts. The first one's clean-up
 * waits for the next frame, so the chat doesn't widen and narrow again in between; the next pane
 * cancels it and inherits the chat list it folded away.
 */
const pendingRelease = new WeakMap<HTMLElement, { timer: number; hidSidebar: boolean }>();

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
      /** The chat list was folded away to make room; it comes back when Chat settings closes. */
      let hidSidebar = false;
      const handed = pendingRelease.get(host);
      if (handed) {
        cancelAnimationFrame(handed.timer);
        pendingRelease.delete(host);
        hidSidebar = handed.hidSidebar;
      }
      let settleUntil = 0;
      let settleTimer = 0;
      // How much narrower than the chat column its bubbles are (avatar, gutters), read while reflowed.
      let overhead: number | null = null;
      const readOverhead = () => {
        const column = host.firstElementChild as HTMLElement | null;
        const bubble = host.querySelector<HTMLElement>(".mari-message-bubble");
        if (!column || !bubble || column === win) return;
        const gap = column.getBoundingClientRect().width - bubble.getBoundingClientRect().width;
        if (gap > 0) overhead = Math.min(gap, MAX_BUBBLE_OVERHEAD);
      };
      const measure = () => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
          if (performance.now() < settleUntil) return;
          const hostRect = host.getBoundingClientRect();
          const paneRect = win.getBoundingClientRect();
          const covered = Math.max(0, Math.round(hostRect.right - paneRect.left));
          const was = host.dataset.csDocked;
          if (was === "reflow" || overhead === null) readOverhead();
          const column = hostRect.width - covered;
          // Room is judged on the bubbles, not the column: at 1366 a 560 px column left 285 px bubbles with
          // names and times wrapping (user panel 3, PR2). Too narrow with the chat list open: fold the chat
          // list away first (it comes back when Chat settings closes).
          const slack = was === "overlay" ? BUBBLE_HYSTERESIS : was === "reflow" ? -BUBBLE_HYSTERESIS : 0;
          const roomy = overhead === null || column - overhead >= OV_BUBBLE_MIN_WIDTH + slack;
          if (!roomy) {
            const ui = useUIStore.getState();
            if (ui.sidebarOpen && !hidSidebar && window.matchMedia("(min-width: 768px)").matches) {
              hidSidebar = true;
              ui.setSidebarOpen(false);
              // Judge again once the chat list has finished sliding away, not on a half-way frame.
              settleUntil = performance.now() + 700;
              settleTimer = window.setTimeout(measure, 720);
              return;
            }
          }
          // The column still decides floating: covered bubbles read worse than narrow ones, so it only
          // floats when the column itself would be a strip (with a little slack against flicker).
          const min = chatMinWidth(host) + (was === "overlay" ? 16 : was === "reflow" ? -16 : 0);
          const fits = column >= min;
          host.dataset.csDocked = fits ? "reflow" : "overlay";
          // Floating: the composer keeps clear of the pane, so Send stays in reach.
          host.style.setProperty("--ov-cs-cover", `${covered}px`);
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
        window.clearTimeout(settleTimer);
        window.removeEventListener("resize", measure);
        const release = () => {
          pendingRelease.delete(host);
          // Put back the chat list this folded away, unless the player has opened or closed it since.
          if (hidSidebar && !useUIStore.getState().sidebarOpen) useUIStore.getState().setSidebarOpen(true);
          delete host.dataset.csDocked;
          delete host.dataset.csTracker;
          host.style.removeProperty("--ov-cs-reflow");
          host.style.removeProperty("--ov-cs-cover");
        };
        // Released in the next frame (before it paints), unless the loaded pane takes over in between.
        pendingRelease.set(host, { timer: requestAnimationFrame(release), hidSidebar });
      };
    };
    attach();
    return () => {
      cancelAnimationFrame(frame);
      teardown?.();
    };
  }, [bodyRef, active]);
}
