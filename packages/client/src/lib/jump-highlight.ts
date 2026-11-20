/**
 * The accent flash a jump lands on (Settings search, chips, and a button that opens a connection at one field).
 * Styles: `.ov-flash` in overhaul.css.
 */

/** How long the jumped-to block stays lit before it fades, and how long the fade takes (matches overhaul.css). */
const JUMP_HIGHLIGHT_HOLD_MS = 1600;
const JUMP_HIGHLIGHT_FADE_MS = 600;
const jumpHighlightTimers = new WeakMap<HTMLElement, number[]>();

/**
 * Lights the block a jump landed on in the accent colour, holds it, then fades it out. It only lights up once
 * the smooth scroll has settled, so the whole hold is spent where you can see it (before, most of the flash
 * played while the list was still moving). The lit state is a plain style, not an animation, so it also
 * shows with reduced motion, where every animation is cut to nothing; there it just switches off at the end.
 */
export function highlightJumpTarget(target: HTMLElement, scroller: HTMLElement) {
  for (const id of jumpHighlightTimers.get(target) ?? []) window.clearTimeout(id);
  target.classList.remove("ov-flash", "ov-flash--out");
  const timers: number[] = [];
  jumpHighlightTimers.set(target, timers);
  const light = () => {
    if (jumpHighlightTimers.get(target) !== timers) return;
    target.classList.remove("ov-flash--out");
    target.classList.add("ov-flash");
    timers.push(
      window.setTimeout(() => target.classList.add("ov-flash--out"), JUMP_HIGHLIGHT_HOLD_MS),
      window.setTimeout(
        () => target.classList.remove("ov-flash", "ov-flash--out"),
        JUMP_HIGHLIGHT_HOLD_MS + JUMP_HIGHLIGHT_FADE_MS + 50,
      ),
    );
  };
  // Wait for the scroll to stop: same position for a few frames, or 900ms at most.
  let last = scroller.scrollTop;
  let still = 0;
  const started = performance.now();
  const watch = () => {
    if (jumpHighlightTimers.get(target) !== timers) return;
    const now = scroller.scrollTop;
    still = Math.abs(now - last) < 0.5 ? still + 1 : 0;
    last = now;
    if (still >= 3 || performance.now() - started > 900) light();
    else window.requestAnimationFrame(watch);
  };
  window.requestAnimationFrame(watch);
}

/** The nearest ancestor that really scrolls, else the page. */
export function scrollingAncestorOf(target: HTMLElement): HTMLElement {
  for (let el = target.parentElement; el; el = el.parentElement) {
    const overflow = getComputedStyle(el).overflowY;
    if ((overflow === "auto" || overflow === "scroll") && el.scrollHeight > el.clientHeight + 1) return el;
  }
  return (document.scrollingElement as HTMLElement | null) ?? document.documentElement;
}
