// ──────────────────────────────────────────────
// Routes: Marinara notices published on the repo's `notices` branch
// ──────────────────────────────────────────────
// GET /api/notices — notices that match this version, for the owner only.
// The file is remote content: validate it strictly and keep it plain text.
import type { FastifyInstance, FastifyRequest } from "fastify";
import { APP_VERSION } from "@marinara-engine/shared";
import { logger } from "../lib/logger.js";
import { isMarinaraNoticesEnabled } from "../config/runtime-config.js";
import { isAdminAuthorized } from "../middleware/privileged-gate.js";
import { getRequestAccess } from "../middleware/ip-allowlist.js";
import { isBasicAuthSatisfied } from "../middleware/basic-auth.js";
import { compareVersions } from "./updates.routes.js";
import { MARINARA_NOTICES_RATE_LIMIT } from "../middleware/rate-limit.js";

const DEFAULT_NOTICES_URL = "https://raw.githubusercontent.com/Pasta-Devs/Marinara-Engine/notices/notices.json";
const REFRESH_MS = 60 * 60_000;
const FETCH_TIMEOUT_MS = 10_000;
const MAX_FILE_CHARS = 64_000;
const MAX_NOTICES = 20;
const DAY_MS = 86_400_000;

export interface MarinaraNotice {
  id: string;
  level: "warning" | "critical";
  title: string;
  text: string;
  action: string;
  link: string | null;
}

function cappedText(value: unknown, max: number) {
  return typeof value === "string" && value.trim() && value.trim().length <= max ? value.trim() : null;
}

/** `<=2.5.1`, `>=2.4.0 <2.5.2`, `2.5.0 || 2.5.1`: space = and, `||` = or. */
export function versionInRange(version: string, range: string) {
  // `>= 2.4.0` means `>=2.4.0`, not a bare operator followed by a version.
  return range
    .replace(/(<=|>=|<|>|=)\s+/g, "$1")
    .split("||")
    .some((set) => {
      const comparators = set.trim().split(/\s+/);
      return comparators.every((comparator) => {
        const match = /^(<=|>=|<|>|=)?(v?\d+(?:\.\d+){0,2})$/.exec(comparator);
        if (!match) return false;
        const diff = compareVersions(version, match[2]!);
        switch (match[1]) {
          case "<":
            return diff < 0;
          case "<=":
            return diff <= 0;
          case ">":
            return diff > 0;
          case ">=":
            return diff >= 0;
          default:
            return diff === 0;
        }
      });
    });
}

function allowedLink(value: unknown) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    const allowed =
      url.origin === "https://github.com" && !url.username && !url.password && url.pathname.startsWith("/Pasta-Devs/");
    return allowed ? url.href : null;
  } catch {
    return null;
  }
}

/** Reads the body but stops once it passes the cap, so a huge file is never buffered. */
async function readCapped(res: Response) {
  if (Number(res.headers.get("content-length")) > MAX_FILE_CHARS) throw new Error("notices file is too large");
  const reader = res.body?.getReader();
  const decoder = new TextDecoder();
  let body = "";
  for (let chunk = await reader?.read(); chunk && !chunk.done; chunk = await reader!.read()) {
    body += decoder.decode(chunk.value, { stream: true });
    if (body.length > MAX_FILE_CHARS) {
      await reader!.cancel();
      throw new Error("notices file is too large");
    }
  }
  return body + decoder.decode();
}

/** Drops every notice that is malformed, expired, or for another version. */
export function parseMarinaraNotices(raw: unknown, version: string, now = Date.now()): MarinaraNotice[] {
  if (!Array.isArray(raw) || raw.length > MAX_NOTICES) return [];
  const notices: MarinaraNotice[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const item = entry as Record<string, unknown>;
    const id = typeof item.id === "string" && /^[a-z0-9][a-z0-9-]{0,63}$/i.test(item.id) ? item.id : null;
    const level = item.level === "warning" || item.level === "critical" ? item.level : null;
    const title = cappedText(item.title, 120);
    const text = cappedText(item.text, 500);
    const action = cappedText(item.action, 200);
    const versions = cappedText(item.versions, 100);
    const expires =
      typeof item.expires === "string" && /^\d{4}-\d{2}-\d{2}$/.test(item.expires) ? Date.parse(item.expires) : NaN;
    // The notice still shows on its `expires` day (UTC).
    if (!id || !level || !title || !text || !action || !versions || !(expires + DAY_MS > now)) continue;
    if (!versionInRange(version, versions) || notices.some((notice) => notice.id === id)) continue;
    notices.push({ id, level, title, text, action, link: allowedLink(item.link) });
  }
  return notices;
}

/** Local machine, IP_ALLOWLIST or trusted Tailscale/Docker peer, admin secret, or signed in with Basic Auth. */
export function isNoticeOwner(request: FastifyRequest) {
  const access = getRequestAccess(request);
  if (access.trustedPeer || isAdminAuthorized(request)) return true;
  return access.basicAuthConfigured && isBasicAuthSatisfied(request);
}

export async function noticesRoutes(app: FastifyInstance) {
  let cached: unknown = [];

  const refresh = async () => {
    if (!isMarinaraNoticesEnabled()) return;
    const url = process.env.MARINARA_NOTICES_URL?.trim() || DEFAULT_NOTICES_URL;
    try {
      const res = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
      if (res.status === 404) {
        cached = [];
        logger.debug("[notices] No notices file at %s", url);
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      cached = JSON.parse(await readCapped(res));
    } catch (err) {
      // Keep the last good file; a failed fetch never blocks startup.
      logger.warn(err, "[notices] Could not fetch Marinara notices");
    }
  };

  void refresh();
  const timer = setInterval(() => void refresh(), REFRESH_MS);
  timer.unref();
  app.addHook("onClose", async () => clearInterval(timer));

  app.get("/", { config: { rateLimit: MARINARA_NOTICES_RATE_LIMIT } }, async (req) => ({
    notices: isMarinaraNoticesEnabled() && isNoticeOwner(req) ? parseMarinaraNotices(cached, APP_VERSION) : [],
  }));
}
