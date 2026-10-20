// ──────────────────────────────────────────────
// Price catalog: model prices for the cost badges, from public price lists
// ──────────────────────────────────────────────
// The provider's own list wins: OpenRouter and Together send prices with their model list, which the catalog parse
// already keeps. LinkAPI publishes its prices at `/api/pricing`; models.dev covers the rest. Both are public (no
// key is sent), read at most once a day, and only after the user allowed it (`PRICE_CATALOG_SETTINGS_KEY`).
import { connectionBalanceSource, type ModelCatalogPricing } from "@marinara-engine/shared";
import { logger } from "../../lib/logger.js";
import { safeFetch } from "../../utils/security.js";

export const LINKAPI_API_ORIGIN = "https://api.linkapi.ai";
const MODELS_DEV_URL = "https://models.dev/api.json";
const DAY_MS = 24 * 60 * 60_000;
const RETRY_MS = 15 * 60_000;

type Json = Record<string, unknown>;
const isRecord = (value: unknown): value is Json => !!value && typeof value === "object" && !Array.isArray(value);
const num = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : undefined);
const round = (value: number) => Math.round(value * 1e6) / 1e6;

// ── Cached public reads ─────────────────────────

const reads = new Map<string, { until: number; value: unknown; fetchedAt: string; loading?: Promise<unknown> }>();

/** One public JSON document, kept for a day; a failed read keeps the last copy and tries again in 15 minutes. */
async function readPublic<T>(url: string, parse: (json: unknown) => T, maxResponseBytes?: number) {
  const hit = reads.get(url);
  if (hit && Date.now() < hit.until) return hit as { value: T | null; fetchedAt: string };
  if (hit?.loading) return (await hit.loading) as { value: T | null; fetchedAt: string };
  const loading = (async () => {
    try {
      const response = await safeFetch(url, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(30_000),
        ...(maxResponseBytes ? { maxResponseBytes } : {}),
      });
      if (!response.ok) throw new Error(`${url} answered ${response.status}`);
      const entry = { until: Date.now() + DAY_MS, value: parse(JSON.parse(await response.text())), fetchedAt: "" };
      entry.fetchedAt = new Date().toISOString();
      reads.set(url, entry);
      return entry;
    } catch (err) {
      logger.warn(err, "[prices] Could not read %s; prices wait", url);
      const entry = { until: Date.now() + RETRY_MS, value: hit?.value ?? null, fetchedAt: hit?.fetchedAt ?? "" };
      reads.set(url, entry);
      return entry;
    }
  })();
  reads.set(url, { until: 0, value: hit?.value ?? null, fetchedAt: hit?.fetchedAt ?? "", loading });
  return (await loading) as { value: T | null; fetchedAt: string };
}

// ── LinkAPI ─────────────────────────────────────

/** LinkAPI's money unit: `quota_per_unit` quota is one unit, shown as `unit` (CNY at `rate` per USD, or USD). */
export interface LinkApiStatus {
  quotaPerUnit: number;
  unit: string;
  rate: number;
}

export function parseLinkApiStatus(json: unknown): LinkApiStatus {
  const data = isRecord(json) && isRecord(json.data) ? json.data : {};
  const cny = data.quota_display_type === "CNY";
  return {
    quotaPerUnit: num(data.quota_per_unit) || 500_000,
    unit: cny ? "CNY" : "USD",
    rate: cny ? num(data.usd_exchange_rate) || 1 : 1,
  };
}

/** The status read is part of a balance check, so it is not behind the price setting. */
export async function readLinkApiStatus(): Promise<LinkApiStatus> {
  const read = await readPublic(`${LINKAPI_API_ORIGIN}/api/status`, parseLinkApiStatus);
  return read.value ?? parseLinkApiStatus(null);
}

export interface LinkApiPricing {
  models: Map<string, ModelCatalogPricing>;
  groupRatio: Record<string, number>;
}

/** `tier("base", p * 1.5 + c * 7.5 + cr * 0.15 + cc * 1.875 + cc1h * 3)` → its per-1M coefficients. */
function baseTier(expr: unknown) {
  const body = typeof expr === "string" ? /tier\(\s*"base"\s*,([^)]*)\)/.exec(expr)?.[1] : undefined;
  if (!body) return null;
  const terms = new Map([...body.matchAll(/\b(p|c|cr|cc)\s*\*\s*([\d.]+)/g)].map((m) => [m[1], Number(m[2])]));
  return terms.has("p") ? terms : null;
}

/**
 * LinkAPI (New-API) prices per 1M tokens in its display unit: input = `model_ratio` × 2, output = input ×
 * `completion_ratio`, cache read/write = input × `cache_ratio`/`create_cache_ratio`; a `tiered_expr` entry's base
 * tier names the same prices directly; `quota_type: 1` is a price per call (`model_price`). All × the group's
 * ratio when the group is known, else the base price is marked "before group discount".
 */
export function linkApiPrices(
  pricing: LinkApiPricing,
  status: LinkApiStatus,
  group: string | undefined,
  fetchedAt: string,
): Map<string, ModelCatalogPricing> {
  const ratio = group !== undefined ? pricing.groupRatio[group] : undefined;
  const factor = (ratio ?? 1) * status.rate;
  const tag: ModelCatalogPricing = {
    ...(status.unit !== "USD" ? { currency: status.unit } : {}),
    source: "linkapi",
    fetchedAt,
    ...(ratio === undefined ? { beforeGroupDiscount: true as const } : {}),
  };
  const priced = new Map<string, ModelCatalogPricing>();
  for (const [id, entry] of pricing.models) {
    const out: ModelCatalogPricing = { ...tag };
    for (const key of ["prompt", "completion", "cacheRead", "cacheWrite", "perCall"] as const) {
      const value = entry[key];
      if (value !== undefined) out[key] = round(value * factor);
    }
    priced.set(id, out);
  }
  return priced;
}

/** The raw `/api/pricing` entries in quota units before group and currency (see `linkApiPrices`). */
export function parseLinkApiPricing(json: unknown): LinkApiPricing {
  const models = new Map<string, ModelCatalogPricing>();
  const root = isRecord(json) ? json : {};
  for (const entry of Array.isArray(root.data) ? root.data : []) {
    if (!isRecord(entry) || typeof entry.model_name !== "string") continue;
    if (entry.quota_type === 1) {
      const perCall = num(entry.model_price);
      if (perCall !== undefined) models.set(entry.model_name, { perCall });
      continue;
    }
    const tier = entry.billing_mode === "tiered_expr" ? baseTier(entry.billing_expr) : null;
    if (tier) {
      models.set(entry.model_name, {
        prompt: tier.get("p"),
        ...(tier.has("c") ? { completion: tier.get("c") } : {}),
        ...(tier.has("cr") ? { cacheRead: tier.get("cr") } : {}),
        ...(tier.has("cc") ? { cacheWrite: tier.get("cc") } : {}),
      });
      continue;
    }
    const ratio = num(entry.model_ratio);
    if (ratio === undefined) continue;
    const prompt = ratio * 2;
    const completion = num(entry.completion_ratio);
    const cacheRead = num(entry.cache_ratio);
    const cacheWrite = num(entry.create_cache_ratio);
    models.set(entry.model_name, {
      prompt,
      completion: prompt * (completion ?? 1),
      ...(cacheRead !== undefined ? { cacheRead: prompt * cacheRead } : {}),
      ...(cacheWrite !== undefined ? { cacheWrite: prompt * cacheWrite } : {}),
    });
  }
  const groupRatio: Record<string, number> = {};
  if (isRecord(root.group_ratio)) {
    for (const [name, value] of Object.entries(root.group_ratio)) if (num(value) !== undefined) groupRatio[name] = value as number;
  }
  return { models, groupRatio };
}

// ── models.dev ──────────────────────────────────

/** models.dev provider ids for Marinara providers; custom addresses map by host below. */
const MODELS_DEV_PROVIDER: Record<string, string> = {
  openai: "openai",
  anthropic: "anthropic",
  google: "google",
  google_vertex: "google-vertex",
  mistral: "mistral",
  cohere: "cohere",
  xai: "xai",
  zai: "zai",
  deepseek: "deepseek",
  openrouter: "openrouter",
  nanogpt: "nano-gpt",
};
const MODELS_DEV_HOST: Array<[RegExp, string]> = [
  [/(^|\.)moonshot\.(ai|cn)$/, "moonshotai"],
  [/(^|\.)together\.(xyz|ai)$/, "togetherai"],
  [/(^|\.)groq\.com$/, "groq"],
  [/(^|\.)deepseek\.com$/, "deepseek"],
];

export type ModelsDevIndex = Map<string, Map<string, ModelCatalogPricing>>;

export function parseModelsDev(json: unknown): ModelsDevIndex {
  const index: ModelsDevIndex = new Map();
  for (const [providerId, provider] of Object.entries(isRecord(json) ? json : {})) {
    if (!isRecord(provider) || !isRecord(provider.models)) continue;
    const models = new Map<string, ModelCatalogPricing>();
    for (const [id, model] of Object.entries(provider.models)) {
      const cost = isRecord(model) && isRecord(model.cost) ? model.cost : null;
      const prompt = num(cost?.input);
      if (prompt === undefined) continue;
      const completion = num(cost?.output);
      const cacheRead = num(cost?.cache_read);
      const cacheWrite = num(cost?.cache_write);
      models.set(id, {
        prompt,
        ...(completion !== undefined ? { completion } : {}),
        ...(cacheRead !== undefined ? { cacheRead } : {}),
        ...(cacheWrite !== undefined ? { cacheWrite } : {}),
      });
    }
    if (models.size) index.set(providerId, models);
  }
  return index;
}

/** The connection's own models.dev provider by id or address, then the vendor in a `vendor/model` id. */
export function modelsDevPrice(
  index: ModelsDevIndex,
  conn: { provider: string; baseUrl?: string | null },
  modelId: string,
): ModelCatalogPricing | undefined {
  let host = "";
  try {
    host = new URL(conn.baseUrl ?? "").hostname.toLowerCase();
  } catch {
    // No address: the provider id decides.
  }
  const own = MODELS_DEV_PROVIDER[conn.provider] ?? MODELS_DEV_HOST.find(([pattern]) => pattern.test(host))?.[1];
  const hit = own ? index.get(own)?.get(modelId) : undefined;
  if (hit) return hit;
  const slash = modelId.indexOf("/");
  return slash > 0 ? index.get(modelId.slice(0, slash))?.get(modelId.slice(slash + 1)) : undefined;
}

// ── Merge into a model list ─────────────────────

const hasOwnPrice = (model: Record<string, unknown>) => {
  const pricing = model.pricing as ModelCatalogPricing | undefined;
  return !!pricing && (pricing.prompt !== undefined || pricing.completion !== undefined);
};

/**
 * Fill `pricing` for models the provider's list sent no price for. Plan and free models keep their badge, so they
 * are left alone. `linkApiGroup` is the account's price group when a balance check reported it.
 */
export async function withCatalogPrices<T extends Record<string, unknown>>(
  conn: { provider: string; baseUrl?: string | null },
  models: T[],
  linkApiGroup?: string,
): Promise<T[]> {
  const open = models.filter(
    (model) => typeof model.id === "string" && !hasOwnPrice(model) && model.subscriptionIncluded !== true && model.free !== true,
  );
  if (!open.length) return models;
  let priceOf: (id: string) => ModelCatalogPricing | undefined;
  if (connectionBalanceSource(conn) === "linkapi") {
    const [pricing, status] = await Promise.all([
      readPublic(`${LINKAPI_API_ORIGIN}/api/pricing`, parseLinkApiPricing),
      readLinkApiStatus(),
    ]);
    if (!pricing.value) return models;
    const prices = linkApiPrices(pricing.value, status, linkApiGroup, pricing.fetchedAt);
    priceOf = (id) => prices.get(id);
  } else {
    const read = await readPublic(MODELS_DEV_URL, parseModelsDev, 64 * 1024 * 1024);
    if (!read.value) return models;
    const index = read.value;
    priceOf = (id) => {
      const hit = modelsDevPrice(index, conn, id);
      return hit && { ...hit, source: "models.dev" as const, fetchedAt: read.fetchedAt };
    };
  }
  const filled = new Set(open);
  return models.map((model) => {
    if (!filled.has(model)) return model;
    const pricing = priceOf(model.id as string);
    return pricing ? { ...model, pricing } : model;
  });
}
