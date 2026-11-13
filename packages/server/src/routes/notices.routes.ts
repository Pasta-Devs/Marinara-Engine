// ──────────────────────────────────────────────
// Routes: Marinara notices published on the repo's `notices` branch
// ──────────────────────────────────────────────
// GET /api/notices — notices that match this version, for the owner only.
// The file is remote content: validate it strictly and keep it plain text.
import { Resolver } from "node:dns/promises";
import { readFileSync } from "node:fs";
import { isIP, type LookupFunction } from "node:net";
import { join } from "node:path";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { Dispatcher1Wrapper, type Dispatcher } from "undici";
import { APP_VERSION } from "@marinara-engine/shared";
import { logger } from "../lib/logger.js";
import { isMarinaraNoticesEnabled } from "../config/runtime-config.js";
import { isAdminAuthorized } from "../middleware/privileged-gate.js";
import { getRequestAccess } from "../middleware/ip-allowlist.js";
import { isBasicAuthSatisfied } from "../middleware/basic-auth.js";
import { compareVersions } from "./updates.routes.js";
import { MARINARA_NOTICES_RATE_LIMIT } from "../middleware/rate-limit.js";
import { createDispatcher } from "../utils/security.js";

const DEFAULT_NOTICES_URL = "https://raw.githubusercontent.com/Pasta-Devs/Marinara-Engine/notices/notices.json";
const REFRESH_MS = 60 * 60_000;
const FETCH_TIMEOUT_MS = 10_000;
const RESOLVE_GRACE_MS = 1_000;
const MAX_FILE_CHARS = 64_000;
const MAX_NOTICES = 20;
const DAY_MS = 86_400_000;
const HOSTS_FILE =
  process.platform === "win32"
    ? join(process.env.SystemRoot ?? "C:\\Windows", "System32", "drivers", "etc", "hosts")
    : "/etc/hosts";

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

/** The hosts file's addresses for a lowercase `hostname`, which getaddrinfo answers before DNS. */
export function hostsFileAddresses(hostsFile: string, hostname: string) {
  return hostsFile.split("\n").flatMap((line) => {
    const [address = "", ...names] = line.replace(/#.*/, "").trim().split(/\s+/);
    const family = isIP(address);
    return family && names.some((name) => name.toLowerCase() === hostname) ? [{ address, family }] : [];
  });
}

/**
 * Looks the notices host up without getaddrinfo (#8948). getaddrinfo runs on the libuv threadpool and process.exit()
 * waits for it, so a stalled system resolver held Restart Server and shutdown for up to ~30 s. c-ares (dns.resolve*)
 * queries run on the event loop, and exit drops them. They skip the hosts file, so it is read first, as getaddrinfo
 * does: a hosts entry for raw.githubusercontent.com (a common workaround where its DNS is blocked) or Docker's
 * extra_hosts still applies.
 *
 * ponytail: c-ares asks only the DNS servers in the resolver config (on Termux, $PREFIX/etc/resolv.conf: 8.8.8.8 by
 * default) and knows no mDNS `.local` names, search domains or NetBIOS. That also applies to an env proxy's own name.
 * When it cannot answer, that refresh fails with a warning and the last notices stay; it never falls back to
 * getaddrinfo. Upgrade path: retry with getaddrinfo in a
 * child process, which process.exit() does not wait for.
 */
async function resolveNoticesHost(resolver: Resolver, hostname: string, family: number) {
  const name = hostname.replace(/\.$/, "").toLowerCase();
  const wanted = (record: { family: number }) => !family || record.family === family;
  // `localhost` is this machine (RFC 6761); Windows answers it without a hosts entry.
  if (name === "localhost") {
    return [
      { address: "127.0.0.1", family: 4 },
      { address: "::1", family: 6 },
    ].filter(wanted);
  }
  let hostsFile = "";
  try {
    hostsFile = readFileSync(HOSTS_FILE, "utf8");
  } catch {
    // No readable hosts file: DNS only.
  }
  const listed = hostsFileAddresses(hostsFile, name).filter(wanted);
  if (listed.length) return listed;
  // Both families, IPv4 first: Node's connect tries the other family too, so IPv6-only (NAT64) networks still connect.
  const addresses: Array<{ address: string; family: number }> = [];
  const queries = (family ? [family] : [4, 6]).map(async (queryFamily) => {
    const answer = await (queryFamily === 4 ? resolver.resolve4(name) : resolver.resolve6(name));
    addresses.push(...answer.map((address) => ({ address, family: queryFamily })));
  });
  try {
    await Promise.any(queries);
  } catch (err) {
    throw (err as AggregateError).errors[0];
  }
  // Some routers drop AAAA queries, and c-ares retries a dropped query for up to ~30 s, past the fetch timeout. Once
  // one family has answered, the other gets a short grace, as in Happy Eyeballs (RFC 8305).
  await Promise.race([Promise.allSettled(queries), new Promise((done) => setTimeout(done, RESOLVE_GRACE_MS))]);
  if (!addresses.length) throw new Error(`${name} has no addresses`);
  return [...addresses].sort((a, b) => a.family - b.family);
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
    let resolver: Resolver | undefined;
    let dispatcher: Dispatcher | undefined;
    try {
      resolver = new Resolver();
      const lookup: LookupFunction = (hostname, options, callback) => {
        const family = options.family === 4 || options.family === 6 ? options.family : 0;
        resolveNoticesHost(resolver!, hostname, family).then(
          (addresses) =>
            options.all ? callback(null, addresses) : callback(null, addresses[0]!.address, addresses[0]!.family),
          (err: NodeJS.ErrnoException) => callback(err, "", 4),
        );
      };
      // An env proxy looks the notices host up itself, so `connect` only reaches NO_PROXY and direct requests. The
      // proxy's own name is looked up here too (`proxyTls`). A malformed proxy URL throws, and is caught below.
      dispatcher = createDispatcher(URL.parse(url)?.hostname ?? "", { connect: { lookup }, proxyTls: { lookup } });
      const res = await fetch(url, {
        redirect: "error",
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        // Node's bundled fetch still uses legacy handlers (see safeFetch).
        dispatcher: new Dispatcher1Wrapper(dispatcher),
      } as unknown as RequestInit);
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
    } finally {
      resolver?.cancel();
      void dispatcher?.destroy().catch(() => undefined);
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
