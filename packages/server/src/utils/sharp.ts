import { logger } from "../lib/logger.js";

// sharp can fail to load on Android/Termux because it has no native Android
// prebuild. Lazy-load it so callers can degrade without blocking server startup.
/** The `sharp` factory itself, so callers keep its real signature instead of `any`. */
export type SharpFn = typeof import("sharp").default;
let cachedSharp: SharpFn | null = null;
let sharpLoadFailed = false;
let sharpLoadPromise: Promise<SharpFn | null> | null = null;

/** Resolve the optional native `sharp` dependency, or null where it cannot load. */
export async function getSharp(): Promise<SharpFn | null> {
  if (cachedSharp) return cachedSharp;
  if (sharpLoadFailed) return null;
  if (sharpLoadPromise) return sharpLoadPromise;

  sharpLoadPromise = (async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore - optional native dep, may not load on some platforms
      const mod = await import("sharp");
      const sharp = (mod.default ?? mod) as SharpFn;
      // libvips keeps up to 20 of the files it has read open, and a file read only for its metadata (an animated
      // image served at full size) stays open. Windows cannot delete an open file, so deleting such an image left it on
      // disk. The in-memory cache is kept; only open files are not. Every path-reading caller loads sharp here.
      // Kept only once this succeeds, so a failure here counts as sharp not loading, for every later call too.
      sharp.cache({ files: 0 });
      cachedSharp = sharp;
      return cachedSharp;
    } catch (error) {
      sharpLoadFailed = true;
      // Once per process, thanks to the sharpLoadFailed guard: this is why locked teasers and
      // thumbnails silently stop appearing, so it should be visible without debug logging on.
      logger.warn(error, "[image] sharp could not be loaded; image processing is unavailable");
      return null;
    } finally {
      sharpLoadPromise = null;
    }
  })();

  return sharpLoadPromise;
}
