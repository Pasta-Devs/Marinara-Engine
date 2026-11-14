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
    // Hidden at most once, at the start: a page that has been shown is never hidden again.
    let shown = false;
    const hide = () => {
      if (!shown) root.setAttribute(RESTORING_ATTR, "");
    };
    const reveal = () => {
      shown = true;
      root.removeAttribute(RESTORING_ATTR);
    };
    const stop = () => {
      stopped = true;
      reveal();
      cancelAnimationFrame(frame);
      window.removeEventListener("wheel", stop, true);
      window.removeEventListener("touchstart", stop, true);
      window.removeEventListener("keydown", stop, true);
      window.removeEventListener("pointerdown", stop, true);
    };
    const resolved = new Set<string>();
    // Returns "settled" when every area on the page is in place and nothing had to move, "waiting"
    // while none of them is on the page, "moving" otherwise. Only "moving" keeps the page hidden: an
    // area that is not on the page (an editor pane that has since closed, a section still loading)
    // has nothing to show at the wrong place. It used to hide the whole page for 400 ms on every
    // visit (Regex scripts flickered after a script's editor had been scrolled, Nov 14).
    const restore = (): "settled" | "waiting" | "moving" => {
      let settled = true;
      let found = false;
      for (const [path, top] of pending) {
        const element = findByPath(path);
        if (!element) continue;
        found = true;
        if (element.scrollHeight - element.clientHeight < top - 1) {
          settled = false;
          continue;
        }
        resolved.add(path);
        // Put back before paint; it only counts as moving if it did not take (it is still filling in).
        if (Math.abs(element.scrollTop - top) > 1) element.scrollTop = top;
        if (Math.abs(element.scrollTop - top) > 1) settled = false;
      }
      return !found ? "waiting" : settled ? "settled" : "moving";
    };
    // Places that never came back during the whole window belong to something no longer on this
    // page; forget them so they cannot hide the page on later visits.
    const forgetMissing = () => {
      for (const path of pending.keys()) if (!resolved.has(path)) saved.delete(path);
    };
    // A section can re-render after the first restore and drop back to the top, so it is put back
    // for a while; the page stays hidden only while a place cannot be reached yet.
    const tick = () => {
      if (stopped) return;
      const state = restore();
      const elapsed = performance.now() - started;
      if (state === "moving" && elapsed < HIDE_FOR_MS) hide();
      else reveal();
      if (elapsed < RESTORE_FOR_MS) frame = requestAnimationFrame(tick);
      else {
        forgetMissing();
        stop();
      }
    };
    // Hide only while an area on the page still has to move into place.
    if (restore() === "moving") hide();
    else reveal();
    window.addEventListener("wheel", stop, true);
    window.addEventListener("touchstart", stop, true);
    window.addEventListener("keydown", stop, true);
    window.addEventListener("pointerdown", stop, true);
    frame = requestAnimationFrame(tick);
    return stop;
  }, [tabKey]);
}
