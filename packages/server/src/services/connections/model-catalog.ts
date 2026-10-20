// ──────────────────────────────────────────────
// Model catalogs: per-model metadata parse and the background refresh
// ──────────────────────────────────────────────
// A chat Connection keeps one catalog per row provider (`connection_accounts.model_catalogs`, or a standalone
// Model's own `saved_models`). The parse reads only fields the existing list fetch already receives. The refresh
// keeps the catalogs warm so the picker answers from cache; it never runs in regressions (only `index.ts` starts it)
// and `MODEL_CATALOG_REFRESH=false` switches it off.
import { isLocalAuthProvider, type ModelCatalogPricing } from "@marinara-engine/shared";
import type { DB } from "../../db/connection.js";
import { apiConnections, connectionAccounts } from "../../db/schema/index.js";
import { logger } from "../../lib/logger.js";
import { isLocalInferenceBaseUrl } from "../../middleware/ip-allowlist.js";
import {
  accountBlocksRows,
  credentialEndpoint,
  type ConnectionAccountRow,
  type ConnectionRow,
} from "../storage/connection-accounts.storage.js";
import { catalogOf, connectionSavesModelList } from "../storage/connections.storage.js";

// ── Metadata parse ──────────────────────────────

export interface CatalogModelMetadata {
  pricing?: ModelCatalogPricing;
  inputModalities?: string[];
  outputModalities?: string[];
  free?: true;
  deprecated?: true;
  retiresAt?: string;
}

const record = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

function price(value: unknown): number | undefined {
  const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  // OpenRouter marks variable-price routers with -1: that is "unknown", not a price.
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function strings(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const list = value.filter((entry): entry is string => typeof entry === "string" && !!entry.trim());
  return list.length ? list : undefined;
}

function date(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() && Number.isFinite(Date.parse(value)) ? value.trim() : undefined;
}

/**
 * Prices in USD per million tokens. OpenRouter sends USD per token as strings (cache prices as
 * `input_cache_read`/`input_cache_write`); NanoGPT sends USD per million (`unit`, `currency`); Together sends
 * `input`/`output` per million. A non-USD price is left out rather than shown wrong.
 */
function readPricing(provider: string, model: Record<string, unknown>): ModelCatalogPricing | undefined {
  const pricing = record(model.pricing);
  if (!pricing) return undefined;
  if (typeof pricing.currency === "string" && pricing.currency.trim().toUpperCase() !== "USD") return undefined;
  const unit = typeof pricing.unit === "string" ? pricing.unit : "";
  const together = pricing.prompt === undefined && pricing.input !== undefined;
  const perMillion =
    together || /million|mtok|\b1m\b/i.test(unit) || (!/token/i.test(unit) && provider === "nanogpt");
  const scale = (value: number | undefined) =>
    value === undefined ? undefined : perMillion ? value : Math.round(value * 1e6 * 1e6) / 1e6;
  const prompt = scale(price(together ? pricing.input : pricing.prompt));
  const completion = scale(price(together ? pricing.output : pricing.completion));
  if (prompt === undefined && completion === undefined) return undefined;
  const cacheRead = scale(price(pricing.input_cache_read));
  const cacheWrite = scale(price(pricing.input_cache_write));
  return {
    ...(prompt !== undefined ? { prompt } : {}),
    ...(completion !== undefined ? { completion } : {}),
    ...(cacheRead !== undefined ? { cacheRead } : {}),
    ...(cacheWrite !== undefined ? { cacheWrite } : {}),
  };
}

/** Pricing, modalities, the free flag and deprecation, from whichever of these fields the provider sends. */
export function readCatalogModelMetadata(provider: string, model: Record<string, unknown>): CatalogModelMetadata {
  const id = typeof model.id === "string" ? model.id : "";
  const pricing = readPricing(provider, model);
  const architecture = record(model.architecture);
  const capabilities = record(model.capabilities);
  const inputModalities =
    strings(architecture?.input_modalities) ??
    strings(model.input_modalities) ??
    // NanoGPT's detailed list says vision in `capabilities` instead.
    (capabilities?.vision === true ? ["text", "image"] : undefined);
  const outputModalities = strings(architecture?.output_modalities) ?? strings(model.output_modalities);
  const free =
    /:free$/i.test(id) || (!!pricing && pricing.prompt === 0 && (pricing.completion ?? 0) === 0) ? true : undefined;

  // Anthropic `lifecycle`, Mistral `deprecation`, OpenRouter `expiration_date`, Venice `model_spec.deprecation`.
  const lifecycle = record(model.lifecycle);
  const status = String((typeof model.lifecycle === "string" ? model.lifecycle : lifecycle?.status) ?? "");
  const veniceDeprecation = record(record(model.model_spec)?.deprecation);
  const retiresAt =
    date(lifecycle?.retires_at) ??
    date(model.retires_at) ??
    date(model.expiration_date) ??
    date(model.deprecation) ??
    date(record(model.deprecation)?.date) ??
    date(veniceDeprecation?.date);
  const deprecated =
    !!retiresAt ||
    /^(deprecated|retired)$/i.test(status) ||
    !!date(lifecycle?.deprecated_at ?? model.deprecated_at) ||
    model.deprecated === true ||
    !!veniceDeprecation;

  return {
    ...(pricing ? { pricing } : {}),
    ...(inputModalities ? { inputModalities } : {}),
    ...(outputModalities ? { outputModalities } : {}),
    ...(free ? { free } : {}),
    ...(deprecated ? { deprecated: true as const } : {}),
    ...(retiresAt ? { retiresAt } : {}),
  };
}

// ── Background refresh ──────────────────────────

export const CATALOG_REFRESH_START_DELAY_MS = 60_000;
export const CATALOG_REFRESH_INTERVAL_MS = 24 * 60 * 60_000;
export const CATALOG_FRESH_MS = 12 * 60 * 60_000;
const CATALOG_REFRESH_SPACING_MS = 5_000;
const MAX_BACKOFF_MS = 7 * 24 * 60 * 60_000;

export type CatalogRefreshOutcome = { ok: true } | { ok: false; status?: number; error: string };
type CatalogRefresher = (connectionId: string) => Promise<CatalogRefreshOutcome>;

let refresher: CatalogRefresher | null = null;

/** The connections routes hand over the same fetch-and-save path `GET /:id/models?refresh=true` uses. */
export function registerModelCatalogRefresher(fn: CatalogRefresher) {
  refresher = fn;
}

/** Linked Models of one provider share one catalog, so they are refreshed once. */
export function catalogRefreshKey(row: Pick<ConnectionRow, "id" | "accountId" | "provider">): string {
  return row.accountId ? `${row.accountId}\u0000${row.provider}` : row.id;
}

/** Why the refresh leaves a Model's catalog alone, or null when it is due. */
export function catalogRefreshSkipReason(
  row: ConnectionRow,
  account: ConnectionAccountRow | null,
  nowMs: number,
  backoffUntil = 0,
): "no_list" | "local" | "blocked" | "fresh" | "backoff" | null {
  if (!connectionSavesModelList(row.provider) || isLocalAuthProvider(row.provider)) return "no_list";
  if (row.treatAsLocalEndpoint === "true" || isLocalInferenceBaseUrl(credentialEndpoint(row))) return "local";
  if (row.profileImportReviewRequired === "true" || accountBlocksRows(account)) return "blocked";
  const fetchedAt = Date.parse(catalogOf(row, account)?.fetchedAt ?? "");
  if (Number.isFinite(fetchedAt) && nowMs - fetchedAt < CATALOG_FRESH_MS) return "fresh";
  if (backoffUntil > nowMs) return "backoff";
  return null;
}

/** 24 h after the first failure, doubling per failure, at most a week. */
export function catalogBackoffMs(failures: number): number {
  return Math.min(MAX_BACKOFF_MS, CATALOG_REFRESH_INTERVAL_MS * 2 ** Math.max(0, failures - 1));
}

/** One Model per catalog that is due, newest first within a catalog. */
export function dueCatalogRows(
  rows: ConnectionRow[],
  accounts: ConnectionAccountRow[],
  nowMs: number,
  backoff: ReadonlyMap<string, { until: number }> = new Map(),
): ConnectionRow[] {
  const accountById = new Map(accounts.map((account) => [account.id, account]));
  const seen = new Set<string>();
  const due: ConnectionRow[] = [];
  for (const row of [...rows].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))) {
    const key = catalogRefreshKey(row);
    if (seen.has(key)) continue;
    const account = row.accountId ? (accountById.get(row.accountId) ?? null) : null;
    const reason = catalogRefreshSkipReason(row, account, nowMs, backoff.get(key)?.until);
    // A row that cannot refresh does not speak for its catalog; a later row of it may.
    if (reason === "no_list" || reason === "local" || reason === "blocked") continue;
    seen.add(key);
    if (!reason) due.push(row);
  }
  return due;
}

/** Start the refresh: once after a delay, then daily, one Model at a time. Returns the stop function. */
export function startModelCatalogRefresh(db: DB): () => void {
  if (process.env.MODEL_CATALOG_REFRESH === "false") {
    logger.info("[connections] Background model list refresh is off (MODEL_CATALOG_REFRESH=false)");
    return () => {};
  }
  const backoff = new Map<string, { failures: number; until: number }>();
  let stopped = false;
  let running = false;

  const pass = async () => {
    if (running || stopped || !refresher) return;
    running = true;
    let refreshed = 0;
    let failed = 0;
    try {
      const rows = (await db.select().from(apiConnections)) as ConnectionRow[];
      const accounts = (await db.select().from(connectionAccounts)) as ConnectionAccountRow[];
      for (const row of dueCatalogRows(rows, accounts, Date.now(), backoff)) {
        if (stopped) break;
        const key = catalogRefreshKey(row);
        const outcome = await refresher(row.id).catch((err: unknown): CatalogRefreshOutcome => ({
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        }));
        if (outcome.ok) {
          backoff.delete(key);
          refreshed++;
        } else {
          // 429/5xx and every other failure wait: the next try is a day or more away.
          const failures = (backoff.get(key)?.failures ?? 0) + 1;
          backoff.set(key, { failures, until: Date.now() + catalogBackoffMs(failures) });
          failed++;
          logger.debug(
            "[connections] Model list refresh failed for %s (%s): %s",
            row.id,
            outcome.status ?? "-",
            outcome.error,
          );
        }
        await new Promise((resolve) => setTimeout(resolve, CATALOG_REFRESH_SPACING_MS).unref());
      }
      if (refreshed || failed) {
        logger.info("[connections] Refreshed %d model list(s) in the background, %d failed", refreshed, failed);
      }
    } catch (err) {
      logger.warn(err, "[connections] Background model list refresh stopped");
    } finally {
      running = false;
    }
  };

  const first = setTimeout(() => void pass(), CATALOG_REFRESH_START_DELAY_MS);
  const daily = setInterval(() => void pass(), CATALOG_REFRESH_INTERVAL_MS);
  first.unref();
  daily.unref();
  return () => {
    stopped = true;
    clearTimeout(first);
    clearInterval(daily);
  };
}
