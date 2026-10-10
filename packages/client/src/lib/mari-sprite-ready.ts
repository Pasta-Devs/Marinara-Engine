import { useEffect, useReducer } from "react";

/**
 * Slice 85: a Mari sheet is drawn only once the browser has decoded it. Until then her surface keeps
 * the last sheet that was decoded, so a hand-over (empty home → sending → live line, or a window
 * opening or closing) never leaves a frame without her. Module state, so it survives the unmount of
 * the sprite it was drawn by.
 */
const decoded = new Set<string>();
const inFlight = new Map<string, Promise<void>>();
let lastDecoded: string | null = null;

/** Fetches and decodes one sheet, once. A failed sheet stays undecoded; the next show retries it. */
export function warmMariSprite(url: string): Promise<void> {
  if (decoded.has(url)) return Promise.resolve();
  let pending = inFlight.get(url);
  if (!pending) {
    const image = new Image();
    image.src = url;
    pending = image
      .decode()
      .then(() => {
        decoded.add(url);
      })
      .catch(() => undefined)
      .finally(() => inFlight.delete(url));
    inFlight.set(url, pending);
  }
  return pending;
}

/**
 * The sheet a Mari sprite draws for `url`: `url` itself once decoded, else the last decoded sheet.
 * `ready` is true when the drawn sheet is decoded, so the surface never shows an empty box.
 */
export function useMariSpriteSource(url: string): { src: string; ready: boolean } {
  const [, rerender] = useReducer((count: number) => count + 1, 0);
  const own = decoded.has(url);
  useEffect(() => {
    if (own) {
      lastDecoded = url;
      return;
    }
    let live = true;
    void warmMariSprite(url).then(() => {
      if (live) rerender();
    });
    return () => {
      live = false;
    };
  }, [url, own]);
  if (own) return { src: url, ready: true };
  return { src: lastDecoded ?? url, ready: lastDecoded !== null };
}
