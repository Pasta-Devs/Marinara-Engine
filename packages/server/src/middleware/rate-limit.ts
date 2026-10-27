import type { FastifyReply, FastifyRequest } from "fastify";
import { isApiRequest } from "../utils/api-request.js";

export type MarinaraRouteRateLimit = {
  readonly max: number;
  readonly timeWindow: number;
};

declare module "fastify" {
  interface FastifyContextConfig {
    rateLimit?: MarinaraRouteRateLimit;
  }
}

type Bucket = {
  count: number;
  /** On the monotonic clock (monotonicNow), not the wall clock. */
  resetAt: number;
};

type RateLimitRule = {
  limit: number;
  windowMs: number;
  key: string;
};

const DEFAULT_RULE: RateLimitRule = { key: "default", limit: 600, windowMs: 60_000 };

/** Quick answers call a model per request; a person asks a few per minute, never in a loop. */
export const PROFESSOR_MARI_QUICK_RATE_LIMIT = {
  max: 30,
  timeWindow: 60_000,
} as const satisfies MarinaraRouteRateLimit;

/** Bulk "skip these agent updates" writes the package catalog; a person clicks it, not a script. */
export const PACKAGE_UPDATE_DECLINE_RATE_LIMIT = {
  max: 30,
  timeWindow: 60_000,
} as const satisfies MarinaraRouteRateLimit;

/** Experience file imports: each one streams a whole file through the package checks. */
export const EXPERIENCE_FILE_IMPORT_RATE_LIMIT = {
  max: 10,
  timeWindow: 60_000,
} as const satisfies MarinaraRouteRateLimit;

export const UPDATE_CHANNEL_RATE_LIMIT = {
  max: 30,
  timeWindow: 60_000,
} as const satisfies MarinaraRouteRateLimit;

export const AVATAR_STORAGE_RATE_LIMIT = {
  max: 20,
  timeWindow: 60_000,
} as const satisfies MarinaraRouteRateLimit;

/** Avatar faces: a streaming reply asks at most once per 1.2 seconds (about 50 a minute); room for two tabs. */
export const AVATAR_CLASSIFY_RATE_LIMIT = {
  max: 120,
  timeWindow: 60_000,
} as const satisfies MarinaraRouteRateLimit;

export const SPRITE_RENAME_RATE_LIMIT = {
  max: 60,
  timeWindow: 60_000,
} as const satisfies MarinaraRouteRateLimit;

/**
 * Tile packs: the overworld reads the list, the selection and one built-in pack per family from disk;
 * saving, importing and removing write the store. A person browsing or editing packs stays far below
 * this; a scripted loop does not.
 */
export const GAME_TILE_PACKS_RATE_LIMIT = {
  max: 120,
  timeWindow: 60_000,
} as const satisfies MarinaraRouteRateLimit;

/**
 * The world library: listing, reading and editing kept worlds, and making or importing one, which compiles
 * a whole world. A person building worlds stays far below this; a scripted loop does not.
 */
export const GAME_WORLDS_RATE_LIMIT = {
  max: 120,
  timeWindow: 60_000,
} as const satisfies MarinaraRouteRateLimit;

/**
 * Rulesets and creature packs: reading a package file, a ruleset's own files or the published schema, and
 * filing or choosing a creature pack. A person importing or editing stays far below this; a scripted loop
 * does not.
 */
export const GAME_RULESETS_RATE_LIMIT = {
  max: 120,
  timeWindow: 60_000,
} as const satisfies MarinaraRouteRateLimit;

export const ADMIN_RESTART_RATE_LIMIT = {
  max: 5,
  timeWindow: 60_000,
} as const satisfies MarinaraRouteRateLimit;

export const REQUEST_TIMEOUT_SETTINGS_RATE_LIMIT = {
  max: 30,
  timeWindow: 60_000,
} as const satisfies MarinaraRouteRateLimit;

/** Revision settings can prune stored code history; bound reads and writes together. */
export const EXTENSION_REVISION_HISTORY_RATE_LIMIT = {
  max: 30,
  timeWindow: 60_000,
} as const satisfies MarinaraRouteRateLimit;

/** Support snapshot of storage residency and package runtimes; a person reads it a few times, not in a loop. */
export const RUNTIME_DIAGNOSTICS_RATE_LIMIT = {
  max: 30,
  timeWindow: 60_000,
} as const satisfies MarinaraRouteRateLimit;

/** Setting the remote login; also bounds tries of the one-time setup code. */
export const ACCESS_LOGIN_RATE_LIMIT = {
  max: 10,
  timeWindow: 60_000,
} as const satisfies MarinaraRouteRateLimit;

/**
 * The sign-in pages (/login, /login/setup). Behind a proxy every browser shares one address, so this
 * only caps volume; wrong passwords and codes have their own per-browser buckets in basic-auth.
 */
export const LOGIN_PAGE_RATE_LIMIT = {
  max: 120,
  timeWindow: 60_000,
} as const satisfies MarinaraRouteRateLimit;

/** Marinara notices; each tab asks once on load and then hourly. */
export const MARINARA_NOTICES_RATE_LIMIT = {
  max: 10,
  timeWindow: 60_000,
} as const satisfies MarinaraRouteRateLimit;

/** One document per guest frame mount; each response reads and embeds the trusted bundle. */
export const MULTIPLAYER_GUEST_VIEW_RATE_LIMIT = {
  max: 30,
  timeWindow: 60_000,
} as const satisfies MarinaraRouteRateLimit;

/**
 * Operator corrections to Beholder's physical state.
 *
 * A person fixing slots clicks Apply a handful of times a minute; this is far above
 * that and still bounds an authorized write to the state the next prompt is built from.
 */
export const BEHOLDER_STATE_RATE_LIMIT = {
  max: 60,
  timeWindow: 60_000,
} as const satisfies MarinaraRouteRateLimit;

/** Each greeting-image bake downloads up to ten web images on the server. */
export const GREETING_IMAGE_BAKE_RATE_LIMIT = {
  max: 20,
  timeWindow: 60_000,
} as const satisfies MarinaraRouteRateLimit;

export const BACKUP_RATE_LIMIT = {
  max: 60,
  timeWindow: 60_000,
} as const satisfies MarinaraRouteRateLimit;

/**
 * The utility model slot's API.
 *
 * Generous enough for the UI to poll status and routing while a page is open, tight
 * enough that install and start — which spawn processes and download hundreds of
 * megabytes — cannot be hammered.
 */
export const UTILITY_SIDECAR_RATE_LIMIT = {
  max: 60,
  timeWindow: 60_000,
} as const satisfies MarinaraRouteRateLimit;

/**
 * The managed decision sidecar's API.
 *
 * Sized like the utility slot's: room for the panel to re-read its status while open,
 * a wall in front of install and remove, which download or delete about ten gigabytes.
 */
export const DECISION_SIDECAR_RATE_LIMIT = {
  max: 60,
  timeWindow: 60_000,
} as const satisfies MarinaraRouteRateLimit;

/**
 * The health probe. Launchers, Docker, the Android bootstrap and the open app poll it, so it keeps the
 * default allowance in a bucket of its own; it now also decides whether to include local model details.
 */
export const HEALTH_RATE_LIMIT = {
  max: 600,
  timeWindow: 60_000,
} as const satisfies MarinaraRouteRateLimit;

const ROUTE_RULES: Array<{ pattern: RegExp; rule: RateLimitRule }> = [
  {
    pattern: /^\/api\/access\/login(?:\?|$)/,
    rule: { key: "access-login", limit: ACCESS_LOGIN_RATE_LIMIT.max, windowMs: ACCESS_LOGIN_RATE_LIMIT.timeWindow },
  },
  {
    pattern: /^\/login(?:\/setup)?(?:\?|$)/,
    rule: { key: "login-page", limit: LOGIN_PAGE_RATE_LIMIT.max, windowMs: LOGIN_PAGE_RATE_LIMIT.timeWindow },
  },
  {
    pattern: /^\/api\/health(?:\?|$)/,
    rule: { key: "health", limit: HEALTH_RATE_LIMIT.max, windowMs: HEALTH_RATE_LIMIT.timeWindow },
  },
  {
    pattern: /^\/api\/multiplayer\/guest-view(?:\?|$)/,
    rule: {
      key: "multiplayer-guest-view",
      limit: MULTIPLAYER_GUEST_VIEW_RATE_LIMIT.max,
      windowMs: MULTIPLAYER_GUEST_VIEW_RATE_LIMIT.timeWindow,
    },
  },
  { pattern: /^\/api\/generate(?:\/|$)/, rule: { key: "generate", limit: 60, windowMs: 60_000 } },
  { pattern: /^\/api\/tts(?:\/|$)/, rule: { key: "tts", limit: 90, windowMs: 60_000 } },
  {
    pattern: /^\/api\/connections\/[^/]+\/test-image(?:\?|$)/,
    rule: { key: "image-test", limit: 20, windowMs: 60_000 },
  },
  { pattern: /^\/api\/import\/st-bulk(?:\/|$)/, rule: { key: "bulk-import", limit: 20, windowMs: 60_000 } },
  {
    pattern: /^\/api\/characters\/[^/]+\/gallery\/bake(?:\?|$)/,
    rule: {
      key: "greeting-image-bake",
      limit: GREETING_IMAGE_BAKE_RATE_LIMIT.max,
      windowMs: GREETING_IMAGE_BAKE_RATE_LIMIT.timeWindow,
    },
  },
  {
    pattern: /^\/api\/game-worlds(?:\/|$)/,
    rule: {
      key: "game-worlds",
      limit: GAME_WORLDS_RATE_LIMIT.max,
      windowMs: GAME_WORLDS_RATE_LIMIT.timeWindow,
    },
  },
  {
    pattern: /^\/api\/game-tile-packs(?:\/|$)/,
    rule: {
      key: "game-tile-packs",
      limit: GAME_TILE_PACKS_RATE_LIMIT.max,
      windowMs: GAME_TILE_PACKS_RATE_LIMIT.timeWindow,
    },
  },
  {
    pattern: /^\/api\/backup(?:\/|$)/,
    rule: { key: "backup", limit: BACKUP_RATE_LIMIT.max, windowMs: BACKUP_RATE_LIMIT.timeWindow },
  },
  {
    pattern: /^\/api\/admin\/avatar-storage(?:\/|$)/,
    rule: {
      key: "avatar-storage",
      limit: AVATAR_STORAGE_RATE_LIMIT.max,
      windowMs: AVATAR_STORAGE_RATE_LIMIT.timeWindow,
    },
  },
  {
    pattern: /^\/api\/avatar-classify(?:\/|\?|$)/,
    rule: {
      key: "avatar-classify",
      limit: AVATAR_CLASSIFY_RATE_LIMIT.max,
      windowMs: AVATAR_CLASSIFY_RATE_LIMIT.timeWindow,
    },
  },
  {
    pattern: /^\/api\/admin\/restart(?:\?|$)/,
    rule: { key: "admin-restart", limit: ADMIN_RESTART_RATE_LIMIT.max, windowMs: ADMIN_RESTART_RATE_LIMIT.timeWindow },
  },
  {
    pattern: /^\/api\/admin\/request-timeouts(?:\?|$)/,
    rule: {
      key: "request-timeout-settings",
      limit: REQUEST_TIMEOUT_SETTINGS_RATE_LIMIT.max,
      windowMs: REQUEST_TIMEOUT_SETTINGS_RATE_LIMIT.timeWindow,
    },
  },
  {
    pattern: /^\/api\/admin\/runtime-diagnostics(?:\?|$)/,
    rule: {
      key: "runtime-diagnostics",
      limit: RUNTIME_DIAGNOSTICS_RATE_LIMIT.max,
      windowMs: RUNTIME_DIAGNOSTICS_RATE_LIMIT.timeWindow,
    },
  },
  {
    pattern: /^\/api\/personal-extensions\/revision-history\/?$/,
    rule: {
      key: "extension-revision-history",
      limit: EXTENSION_REVISION_HISTORY_RATE_LIMIT.max,
      windowMs: EXTENSION_REVISION_HISTORY_RATE_LIMIT.timeWindow,
    },
  },
  { pattern: /^\/api\/updates\/apply(?:\?|$)/, rule: { key: "updates-apply", limit: 5, windowMs: 60_000 } },
  {
    pattern: /^\/api\/updates\/channel(?:\?|$)/,
    rule: {
      key: "updates-channel",
      limit: UPDATE_CHANNEL_RATE_LIMIT.max,
      windowMs: UPDATE_CHANNEL_RATE_LIMIT.timeWindow,
    },
  },
  {
    pattern: /^\/api\/sidecar\/(?:runtime\/install|reinstall|download|model|speech\/download|speech\/model)(?:\/|\?|$)/,
    rule: { key: "sidecar-privileged", limit: 20, windowMs: 60_000 },
  },
  {
    pattern: /^\/api\/decision\/sidecar(?:\/|\?|$)/,
    rule: {
      key: "decision-sidecar",
      limit: DECISION_SIDECAR_RATE_LIMIT.max,
      windowMs: DECISION_SIDECAR_RATE_LIMIT.timeWindow,
    },
  },
  { pattern: /^\/api\/haptic\/command(?:\?|$)/, rule: { key: "haptic-command", limit: 30, windowMs: 60_000 } },
  {
    pattern: /^\/api\/professor-mari\/quick\/(?:prompt|proposals\/[^/]+\/apply)(?:\?|$)/,
    rule: {
      key: "professor-mari-quick",
      limit: PROFESSOR_MARI_QUICK_RATE_LIMIT.max,
      windowMs: PROFESSOR_MARI_QUICK_RATE_LIMIT.timeWindow,
    },
  },
  {
    pattern: /^\/api\/capability-packages\/updates\/decline(?:\?|$)/,
    rule: {
      key: "package-update-decline",
      limit: PACKAGE_UPDATE_DECLINE_RATE_LIMIT.max,
      windowMs: PACKAGE_UPDATE_DECLINE_RATE_LIMIT.timeWindow,
    },
  },
  {
    pattern: /^\/api\/capability-packages\/experience-file(?:\?|$)/,
    rule: {
      key: "experience-file-import",
      limit: EXPERIENCE_FILE_IMPORT_RATE_LIMIT.max,
      windowMs: EXPERIENCE_FILE_IMPORT_RATE_LIMIT.timeWindow,
    },
  },
  // One-shot LLM call per user click; keep it out of the 600/min default
  // class so a runaway loop can't burn API credits.
  {
    pattern: /^\/api\/agents\/suite\/rewrite(?:\?|$)/,
    rule: { key: "agent-suite-rewrite", limit: 20, windowMs: 60_000 },
  },
  // Same class: a game-surface Experience's host-run structured generation
  // (#5135) is one bounded LLM call per package action — a buggy package loop
  // must hit this wall, not the 600/min default.
  {
    pattern: /^\/api\/game\/[^/]+\/experience-generation(?:\?|$)/,
    rule: { key: "game-experience-generation", limit: 20, windowMs: 60_000 },
  },
  // Same class for the experience-save transfer verbs (#5405): export serializes the
  // chat's whole experience namespace (up to ~100 x 256K) and import rewrites it row by
  // row, so both are heavy compared with the ordinary GET/PUT save. A package loop must
  // hit a dedicated wall rather than the 600/min default. The GET/PUT save pair and the
  // namespace DELETE share a path this pattern cannot separate by method, so they stay
  // in the default class — they are the cheap, per-turn verbs.
  {
    pattern: /^\/api\/game\/[^/]+\/experience-state\/(?:export|import)(?:\?|$)/,
    rule: { key: "game-experience-save-transfer", limit: 20, windowMs: 60_000 },
  },
  // Cap on extension routes so an XSS-driven mass install / spam can't
  // exploit the persistent storage path. 60/min covers React Query
  // refetches + legacy migrations of small extension lists comfortably.
  { pattern: /^\/api\/extensions(?:\/|\?|$)/, rule: { key: "extensions", limit: 60, windowMs: 60_000 } },
  // Package file serving (client bundles + declared assets) reads and
  // hash-verifies from disk on every request; keep it out of the generous
  // default bucket so a scripted loop can't turn that into cheap IO
  // amplification. Normal loads fetch one bundle per installed package and
  // revalidate with 304s afterwards, so 240/min leaves ample headroom.
  {
    pattern: /^\/api\/capability-packages\/[^/]+\/(?:client|assets)(?:\/|\?|$)/,
    rule: { key: "capability-package-files", limit: 240, windowMs: 60_000 },
  },
];

const buckets = new Map<string, Bucket>();
let lastSweepAt = 0;
/**
 * Windows run on a monotonic clock: a wall clock set back (NTP, a resumed VM, a time-zone fix) would otherwise leave
 * every bucket counting down to a reset hours away, locking all clients out for that long.
 */
const monotonicNow = () => performance.now();
const isE2ERateLimitDisabled = process.env.MARINARA_E2E_DISABLE_RATE_LIMIT === "true";

function selectRule(url: string): RateLimitRule {
  let path = url.split("?")[0] ?? url;
  // Match rules against the DECODED path the router actually dispatches on:
  // matching the raw URL let "/api/generat%65"-style percent-encoding slip any
  // rule in this table back into the permissive default bucket while the route
  // still resolved. Collapse duplicate slashes for the same reason. A malformed
  // escape keeps the raw path — the router rejects those requests anyway.
  try {
    path = decodeURIComponent(path);
  } catch {
    // fall through with the raw path
  }
  path = path.replace(/\/{2,}/g, "/");
  return ROUTE_RULES.find((entry) => entry.pattern.test(path))?.rule ?? DEFAULT_RULE;
}

function sweepExpired(now: number) {
  if (now - lastSweepAt < 60_000) return;
  lastSweepAt = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export function rateLimitHook(request: FastifyRequest, reply: FastifyReply, done: () => void) {
  if (isE2ERateLimitDisabled) return done();
  const rule = selectRule(request.url);
  // Pages and assets are not throttled, except the sign-in pages that check passwords and codes.
  if (!isApiRequest(request) && rule.key !== "login-page") return done();

  const now = monotonicNow();
  sweepExpired(now);

  const key = `${rule.key}:${request.ip}`;
  const bucket = buckets.get(key);
  const activeBucket = bucket && bucket.resetAt > now ? bucket : { count: 0, resetAt: now + rule.windowMs };
  activeBucket.count += 1;
  buckets.set(key, activeBucket);

  const remaining = Math.max(0, rule.limit - activeBucket.count);
  reply.header("RateLimit-Limit", String(rule.limit));
  reply.header("RateLimit-Remaining", String(remaining));
  reply.header("RateLimit-Reset", String(Math.ceil((Date.now() + activeBucket.resetAt - now) / 1000)));

  if (activeBucket.count > rule.limit) {
    const retryAfter = Math.ceil((activeBucket.resetAt - now) / 1000);
    reply.header("Retry-After", String(retryAfter));
    // The body repeats the wait so forms can say "Try again in N minutes".
    reply.status(429).send({ error: "Too many requests", retryAfter });
    return;
  }

  done();
}

export function resetRateLimitBucketsForTests() {
  buckets.clear();
  lastSweepAt = 0;
}
