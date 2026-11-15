/**
 * Runs `callback` just after the next frame is painted, when the page's styles and layout are already
 * worked out, so reading a size or a computed style there costs next to nothing.
 *
 * Reading one while the page still has changes pending (in an effect right after React mounts a tab,
 * or in a timer that lands mid-update) makes the browser redo style and layout for the whole page on
 * the spot. Chrome does that in a few milliseconds; Safari took 110-370 ms per read on the tablet
 * layout, and a tab switch did several (Nov 15, WebKit profile). Returns a cancel function.
 */
export function afterNextPaint(callback: () => void): () => void {
  if (typeof window === "undefined" || typeof requestAnimationFrame === "undefined") {
    const timer = setTimeout(callback, 0);
    return () => clearTimeout(timer);
  }
  let timer: ReturnType<typeof setTimeout> | null = null;
  const frame = requestAnimationFrame(() => {
    // rAF runs before this frame's paint; the task after it runs once the frame is out.
    timer = setTimeout(() => {
      timer = null;
      callback();
    }, 0);
  });
  return () => {
    cancelAnimationFrame(frame);
    if (timer !== null) clearTimeout(timer);
  };
}
