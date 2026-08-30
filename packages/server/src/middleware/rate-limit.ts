import type { FastifyReply, FastifyRequest } from "fastify";

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
  resetAt: number;
};

type RateLimitRule = {
  limit: number;
  windowMs: number;
  key: string;
};

const DEFAULT_RULE: RateLimitRule = { key: "default", limit: 600, windowMs: 60_000 };

export const AVATAR_STORAGE_RATE_LIMIT = {
  max: 20,
  timeWindow: 60_000,
} as const satisfies MarinaraRouteRateLimit;

export const SPRITE_RENAME_RATE_LIMIT = {
  max: 60,
  timeWindow: 60_000,
} as const satisfies MarinaraRouteRateLimit;

export const ADMIN_RESTART_RATE_LIMIT = {
  max: 5,
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

const ROUTE_RULES: Array<{ pattern: RegExp; rule: RateLimitRule }> = [
  { pattern: /^\/api\/generate(?:\/|$)/, rule: { key: "generate", limit: 60, windowMs: 60_000 } },
  { pattern: /^\/api\/tts(?:\/|$)/, rule: { key: "tts", limit: 90, windowMs: 60_000 } },
  {
    pattern: /^\/api\/connections\/[^/]+\/test-image(?:\?|$)/,
    rule: { key: "image-test", limit: 20, windowMs: 60_000 },
  },
  { pattern: /^\/api\/import\/st-bulk(?:\/|$)/, rule: { key: "bulk-import", limit: 20, windowMs: 60_000 } },
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
    pattern: /^\/api\/admin\/restart(?:\?|$)/,
    rule: { key: "admin-restart", limit: ADMIN_RESTART_RATE_LIMIT.max, windowMs: ADMIN_RESTART_RATE_LIMIT.timeWindow },
  },
  { pattern: /^\/api\/updates\/apply(?:\?|$)/, rule: { key: "updates-apply", limit: 5, windowMs: 60_000 } },
  {
    pattern: /^\/api\/sidecar\/(?:runtime\/install|reinstall|download|model|speech\/download|speech\/model)(?:\/|\?|$)/,
    rule: { key: "sidecar-privileged", limit: 20, windowMs: 60_000 },
  },
  { pattern: /^\/api\/haptic\/command(?:\?|$)/, rule: { key: "haptic-command", limit: 30, windowMs: 60_000 } },
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
  if (!request.url.startsWith("/api/")) return done();
  if (isE2ERateLimitDisabled) return done();

  const now = Date.now();
  sweepExpired(now);

  const rule = selectRule(request.url);
  const key = `${rule.key}:${request.ip}`;
  const bucket = buckets.get(key);
  const activeBucket = bucket && bucket.resetAt > now ? bucket : { count: 0, resetAt: now + rule.windowMs };
  activeBucket.count += 1;
  buckets.set(key, activeBucket);

  const remaining = Math.max(0, rule.limit - activeBucket.count);
  reply.header("RateLimit-Limit", String(rule.limit));
  reply.header("RateLimit-Remaining", String(remaining));
  reply.header("RateLimit-Reset", String(Math.ceil(activeBucket.resetAt / 1000)));

  if (activeBucket.count > rule.limit) {
    reply.header("Retry-After", String(Math.ceil((activeBucket.resetAt - now) / 1000)));
    reply.status(429).send({ error: "Too many requests" });
    return;
  }

  done();
}

export function resetRateLimitBucketsForTests() {
  buckets.clear();
  lastSweepAt = 0;
}
