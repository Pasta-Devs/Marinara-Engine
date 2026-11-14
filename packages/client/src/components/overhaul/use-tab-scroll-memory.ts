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
/** A place still unreached this long after the tab came back is not on the page any more. */
const FORGET_AFTER_MS = 400;

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

  // Restore when a tab becomes current again. Each place is put back before the page is painted;
  // a list that is still filling in is put back as soon as it is tall enough, for a short while
  // and until you scroll yourself. The page itself is never hidden for this: hiding it until every
  // place was back blanked whole pages (Regex scripts on every visit, a frame on others, Nov 14).
  useLayoutEffect(() => {
    keyRef.current = tabKey;
    const saved = tabKey ? memory.get(tabKey) : undefined;
    if (!saved || saved.size === 0) return;
    const pending = new Map([...saved].filter(([, top]) => top > 0));
    if (pending.size === 0) return;
    let frame = 0;
    let stopped = false;
    const started = performance.now();
    const reached = new Set<string>();
    const stop = () => {
      if (stopped) return;
      stopped = true;
      // Places that never came back belong to something no longer on this page (an editor pane
      // that has since closed); forget them.
      if (performance.now() - started >= FORGET_AFTER_MS) {
        for (const path of pending.keys()) if (!reached.has(path)) saved.delete(path);
      }
      cancelAnimationFrame(frame);
      window.removeEventListener("wheel", stop, true);
      window.removeEventListener("touchstart", stop, true);
      window.removeEventListener("keydown", stop, true);
      window.removeEventListener("pointerdown", stop, true);
    };
    const restore = () => {
      for (const [path, top] of pending) {
        const element = findByPath(path);
        if (!element || element.scrollHeight - element.clientHeight < top - 1) continue;
        reached.add(path);
        if (Math.abs(element.scrollTop - top) > 1) element.scrollTop = top;
      }
    };
    // A section can re-render after the first restore and drop back to the top, so it is put back
    // every frame for a while.
    const tick = () => {
      if (stopped) return;
      restore();
      if (performance.now() - started < RESTORE_FOR_MS) frame = requestAnimationFrame(tick);
      else stop();
    };
    restore();
    window.addEventListener("wheel", stop, true);
    window.addEventListener("touchstart", stop, true);
    window.addEventListener("keydown", stop, true);
    window.addEventListener("pointerdown", stop, true);
    frame = requestAnimationFrame(tick);
    return stop;
  }, [tabKey]);
}
