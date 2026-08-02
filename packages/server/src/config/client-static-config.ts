import type { FastifyStaticOptions } from "@fastify/static";
import { basename, resolve, sep } from "node:path";

const REVALIDATE_FILES = new Set(["index.html"]);
const NO_STORE_FILES = new Set(["manifest.json", "sw.js", "registerSW.js"]);

export function createClientStaticOptions(clientDist: string): FastifyStaticOptions {
  const immutableAssetPrefix = `${resolve(clientDist, "assets")}${sep}`;

  return {
    root: clientDist,
    prefix: "/",
    wildcard: false,
    decorateReply: false,
    // @fastify/static applies its generated Cache-Control header after
    // setHeaders. Disable that default so the update-safe policies below win.
    cacheControl: false,
    setHeaders(res, filePath) {
      const fileName = basename(filePath);

      if (REVALIDATE_FILES.has(fileName)) {
        res.header("Cache-Control", "no-cache, must-revalidate");
        res.header("Pragma", "no-cache");
        res.header("Expires", "0");
        return;
      }

      if (NO_STORE_FILES.has(fileName)) {
        res.header("Cache-Control", "no-store, no-cache, must-revalidate");
        res.header("Pragma", "no-cache");
        res.header("Expires", "0");
        return;
      }

      // Vite fingerprints every file emitted beneath dist/assets, including
      // lazy JS chunks, CSS, and fonts. Those URLs are safe to cache forever.
      if (filePath.startsWith(immutableAssetPrefix)) {
        res.header("Cache-Control", "public, max-age=31536000, immutable");
      }
    },
  };
}
