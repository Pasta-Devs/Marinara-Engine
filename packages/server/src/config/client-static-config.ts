import type { FastifyStaticOptions } from "@fastify/static";
import type { FastifyReply, FastifyRequest } from "fastify";
import { readFile } from "node:fs/promises";
import { basename, resolve, sep } from "node:path";

const REVALIDATE_FILES = new Set(["index.html"]);
const NO_STORE_FILES = new Set(["manifest.json", "sw.js", "registerSW.js"]);

export function createClientNotFoundHandler(clientIndex: string) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const pathname = new URL(req.url, "http://localhost").pathname;
    const acceptsHtml = req.headers.accept?.split(",").some((range) => {
      const [type, ...parameters] = range.split(";").map((part) => part.trim().toLowerCase());
      const quality = parameters.find((parameter) => parameter.startsWith("q="))?.slice(2) ?? "1";
      return type === "text/html" && /^(?:0(?:\.\d{0,3})?|1(?:\.0{0,3})?)$/.test(quality) && Number(quality) > 0;
    });
    const destination = req.headers["sec-fetch-dest"];
    const isNavigation =
      (req.method === "GET" || req.method === "HEAD") &&
      (destination === undefined || ["document", "iframe", "frame"].includes(String(destination))) &&
      (acceptsHtml || (req.headers.accept === undefined && destination === "document"));
    reply.header("Cache-Control", "no-store");
    if (pathname === "/api" || pathname.startsWith("/api/") || pathname.startsWith("/assets/") || !isNavigation) {
      return reply.status(404).send({ error: "Not Found" });
    }
    reply.header("Cache-Control", "no-cache, must-revalidate");
    reply.header("Pragma", "no-cache");
    reply.header("Expires", "0");
    return reply.type("text/html; charset=utf-8").send(await readFile(clientIndex));
  };
}

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
