// ──────────────────────────────────────────────
// UI overhaul: tabs keep their place
//
// Scroll positions are remembered per tab while you scroll, keyed by the
// scrolled element's position in the DOM. Coming back to a tab puts each of
// its scroll areas back where it was, retrying for a moment while lazy
// sections render, and stopping as soon as you scroll yourself.
// ──────────────────────────────────────────────
import { useLayoutEffect, useRef } from "react";

/** Areas that are not part of a tab's page: the chat list, Library pane, tab bar and floating windows. */
const IGNORED =
  '[data-component="ChatSidebar"], .ov-libnav, .ov-topbar, .mari-window, [role="dialog"], [data-component="Modal"]';
const RESTORE_FOR_MS = 2500;
/** How long the page may stay hidden while it waits to be put back in place. */
const HIDE_FOR_MS = 400;
const RESTORING_ATTR = "data-ov-restoring-scroll";

const memory = new Map<string, Map<string, number>>();

function elementPath(element: Element): string | null {
  const parts: string[] = [];
  let node: Element | null = element;
  while (node && node !== document.body) {
    const parent: Element | null = node.parentElement;
    if (!parent) return null;
    parts.push(`${node.tagName}:${Array.prototype.indexOf.call(parent.children, node)}`);
    node = parent;
  }
  return parts.reverse().join("/");
}

function findByPath(path: string): HTMLElement | null {
  let node: Element | null = document.body;
  for (const part of path.split("/")) {
    const [tag, index] = part.split(":");
    const child: Element | undefined = node?.children[Number(index)];
    if (!child || child.tagName !== tag) return null;
    node = child;
  }
  return node as HTMLElement | null;
}

/** Pass the current tab's key (null when no tab, or for tabs that manage their own scroll). */
export function useTabScrollMemory(tabKey: string | null) {
  const keyRef = useRef<string | null>(tabKey);

  // Record scrolls under whichever tab is showing.
  useLayoutEffect(() => {
    const onScroll = (event: Event) => {
      const key = keyRef.current;
      const target = event.target;
      if (!key || !(target instanceof HTMLElement) || target.closest(IGNORED)) return;
      const path = elementPath(target);
      if (!path) return;
      let saved = memory.get(key);
      if (!saved) memory.set(key, (saved = new Map()));
      saved.set(path, target.scrollTop);
    };
    document.addEventListener("scroll", onScroll, true);
    return () => document.removeEventListener("scroll", onScroll, true);
  }, []);

  // Restore when a tab becomes current again. The page is put back before it is painted, and
  // while a lazy section is still rendering the page stays hidden for a moment, so it appears
  // already in place instead of showing the top first and then jumping.
  useLayoutEffect(() => {
    keyRef.current = tabKey;
    const saved = tabKey ? memory.get(tabKey) : undefined;
    if (!saved || saved.size === 0) return;
    const pending = new Map([...saved].filter(([, top]) => top > 0));
    if (pending.size === 0) return;
    const root = document.documentElement;
    let frame = 0;
    let stopped = false;
    const started = performance.now();
    const reveal = () => root.removeAttribute(RESTORING_ATTR);
    const stop = () => {
      stopped = true;
      reveal();
      cancelAnimationFrame(frame);
      window.removeEventListener("wheel", stop, true);
      window.removeEventListener("touchstart", stop, true);
      window.removeEventListener("keydown", stop, true);
      window.removeEventListener("pointerdown", stop, true);
    };
    // Returns true when every area is in place and nothing had to move.
    const restore = () => {
      let settled = true;
      for (const [path, top] of pending) {
        const element = findByPath(path);
        if (!element || element.scrollHeight - element.clientHeight < top - 1) {
          settled = false;
          continue;
        }
        if (Math.abs(element.scrollTop - top) > 1) {
          element.scrollTop = top;
          settled = false;
        }
      }
      return settled;
    };
    // A section can re-render after the first restore and drop back to the top, so the page stays
    // hidden until it has held its place for a few frames.
    let calmFrames = 0;
    const tick = () => {
      if (stopped) return;
      calmFrames = restore() ? calmFrames + 1 : 0;
      const elapsed = performance.now() - started;
      if (calmFrames >= 3 || elapsed >= HIDE_FOR_MS) reveal();
      if (elapsed < RESTORE_FOR_MS) frame = requestAnimationFrame(tick);
      else stop();
    };
    restore();
    root.setAttribute(RESTORING_ATTR, "");
    window.addEventListener("wheel", stop, true);
    window.addEventListener("touchstart", stop, true);
    window.addEventListener("keydown", stop, true);
    window.addEventListener("pointerdown", stop, true);
    frame = requestAnimationFrame(tick);
    return stop;
  }, [tabKey]);
}
