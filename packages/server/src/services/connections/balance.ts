// ──────────────────────────────────────────────
// Connection balance: what is left on the account, for services with a balance endpoint
// ──────────────────────────────────────────────
//   LinkAPI     sk- key        GET https://api.linkapi.ai/api/usage/token/   (the key's own allowance)
//               access token   GET https://api.linkapi.ai/api/user/self      (the account; needs `profile:read`)
//   OpenRouter  API key        GET https://openrouter.ai/api/v1/key
//   DeepSeek    API key        GET https://api.deepseek.com/user/balance
//   Moonshot    API key        GET https://api.moonshot.{ai,cn}/v1/users/me/balance
// Reads are kept 5 minutes per Connection; Refresh asks again. Nothing here is ever sent to the client except the
// numbers.
import {
  connectionBalanceSource,
  type ConnectionBalance,
  type ConnectionBalanceResponse,
} from "@marinara-engine/shared";
import { safeFetch } from "../../utils/security.js";
import { LINKAPI_API_ORIGIN, readLinkApiStatus, type LinkApiStatus } from "./price-catalog.js";

const BALANCE_TTL_MS = 5 * 60_000;

type Json = Record<string, unknown>;
const isRecord = (value: unknown): value is Json => !!value && typeof value === "object" && !Array.isArray(value);
/** Providers send amounts as numbers or decimal strings. */
const amount = (value: unknown) => {
  const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : undefined;
};
const round = (value: number) => Math.round(value * 1e6) / 1e6;

/** A provider answer that is not a balance. `status` 401/403 means the credential was refused. */
export class BalanceError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

// ── Parsers (pure) ──────────────────────────────

const checkedAt = () => new Date().toISOString();

/** New-API `/api/usage/token/`: `data.total_used/total_granted/total_available` in quota, `unlimited_quota`. */
export function parseLinkApiKeyUsage(json: unknown, status: LinkApiStatus): ConnectionBalance {
  const data = isRecord(json) && isRecord(json.data) ? json.data : null;
  const used = amount(data?.total_used);
  if (!data || used === undefined) throw new BalanceError("LinkAPI did not report this key's usage");
  const money = (quota: number) => round((quota / status.quotaPerUnit) * status.rate);
  const granted = amount(data.total_granted);
  const available = amount(data.total_available);
  return {
    source: "linkapi",
    scope: "key",
    unit: status.unit,
    left: data.unlimited_quota === true || available === undefined ? null : money(available),
    used: money(used),
    ...(data.unlimited_quota !== true && granted !== undefined ? { granted: money(granted) } : {}),
    checkedAt: checkedAt(),
  };
}

/** LinkAPI refuses a token without the needed scope with `success: false` and a "permission" message. */
export const isMissingPermission = (json: unknown) =>
  isRecord(json) && json.success === false && /permission|scope/i.test(String(json.message ?? ""));

/** New-API `/api/user/self`: `data.quota` (left), `used_quota`, `request_count`, `group`. */
export function parseLinkApiAccount(json: unknown, status: LinkApiStatus): ConnectionBalance {
  const data = isRecord(json) && json.success !== false && isRecord(json.data) ? json.data : null;
  const quota = amount(data?.quota);
  if (!data || quota === undefined) throw new BalanceError("LinkAPI did not report the account balance");
  const money = (value: number) => round((value / status.quotaPerUnit) * status.rate);
  const used = amount(data.used_quota);
  const requests = amount(data.request_count);
  return {
    source: "linkapi",
    scope: "account",
    unit: status.unit,
    left: money(quota),
    ...(used !== undefined ? { used: money(used) } : {}),
    ...(requests !== undefined ? { requests } : {}),
    ...(typeof data.group === "string" && data.group ? { group: data.group } : {}),
    checkedAt: checkedAt(),
  };
}

/** OpenRouter `/api/v1/key`: a key with a limit shows `limit_remaining`; without, the use this month. */
export function parseOpenRouterKey(json: unknown): ConnectionBalance {
  const data = isRecord(json) && isRecord(json.data) ? json.data : null;
  if (!data) throw new BalanceError("OpenRouter did not report this key");
  const remaining = amount(data.limit_remaining);
  if (amount(data.limit) !== undefined && remaining !== undefined) {
    const used = amount(data.usage);
    return {
      source: "openrouter",
      scope: "key",
      unit: "USD",
      left: round(remaining),
      ...(used !== undefined ? { used: round(used) } : {}),
      checkedAt: checkedAt(),
    };
  }
  return {
    source: "openrouter",
    scope: "month",
    unit: "USD",
    left: null,
    used: round(amount(data.usage_monthly) ?? 0),
    checkedAt: checkedAt(),
  };
}

/** DeepSeek `/user/balance`: one entry per currency; the first one with money, else the first. */
export function parseDeepSeekBalance(json: unknown): ConnectionBalance {
  const infos = isRecord(json) && Array.isArray(json.balance_infos) ? json.balance_infos.filter(isRecord) : [];
  const info = infos.find((entry) => (amount(entry.total_balance) ?? 0) > 0) ?? infos[0];
  const total = amount(info?.total_balance);
  if (!info || total === undefined) throw new BalanceError("DeepSeek did not report a balance");
  const granted = amount(info.granted_balance);
  const toppedUp = amount(info.topped_up_balance);
  return {
    source: "deepseek",
    scope: "account",
    unit: typeof info.currency === "string" && info.currency ? info.currency : "CNY",
    left: round(total),
    parts: [
      ...(granted !== undefined ? [{ id: "granted" as const, amount: round(granted) }] : []),
      ...(toppedUp !== undefined ? [{ id: "toppedUp" as const, amount: round(toppedUp) }] : []),
    ],
    checkedAt: checkedAt(),
  };
}

/** Moonshot `/v1/users/me/balance`: `available_balance`, `voucher_balance`, `cash_balance`; CNY on .cn, USD on .ai. */
export function parseMoonshotBalance(json: unknown, unit: string): ConnectionBalance {
  const data = isRecord(json) && isRecord(json.data) ? json.data : null;
  const available = amount(data?.available_balance);
  if (!data || available === undefined) throw new BalanceError("Moonshot did not report a balance");
  const voucher = amount(data.voucher_balance);
  const cash = amount(data.cash_balance);
  return {
    source: "moonshot",
    scope: "account",
    unit,
    left: round(available),
    parts: [
      ...(voucher !== undefined ? [{ id: "voucher" as const, amount: round(voucher) }] : []),
      ...(cash !== undefined ? [{ id: "cash" as const, amount: round(cash) }] : []),
    ],
    checkedAt: checkedAt(),
  };
}

// ── Reads ───────────────────────────────────────

export interface BalanceCredentials {
  provider: string;
  baseUrl?: string | null;
  apiKey: string;
  /** LinkAPI only: an access token with `profile:read`, and the optional user id for `New-Api-User`. */
  balanceToken?: string;
  balanceUserId?: string | null;
}

type Fetch = (url: string, init: { method: string; headers: Record<string, string>; signal: AbortSignal }) => Promise<Response>;
const defaultFetch: Fetch = (url, init) => safeFetch(url, init);

async function getJson(fetchImpl: Fetch, url: string, headers: Record<string, string>, name: string) {
  const response = await fetchImpl(url, {
    method: "GET",
    headers: { Accept: "application/json", ...headers },
    signal: AbortSignal.timeout(10_000),
  });
  const text = await response.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // Not JSON: the status decides below.
  }
  if (response.status === 401 || response.status === 403) {
    // A scoped LinkAPI token answers 403 with a permission message; the caller tells it apart.
    if (isMissingPermission(json)) return json;
    throw new BalanceError(`${name} refused the credential (${response.status})`, response.status);
  }
  if (!response.ok) throw new BalanceError(`${name} answered ${response.status}`, response.status);
  return json;
}

const originOf = (baseUrl: string | null | undefined, fallback: string) => {
  try {
    return new URL(baseUrl ?? "").origin;
  } catch {
    return fallback;
  }
};

/**
 * Ask the service for the balance. LinkAPI: the account through the access token when one is set; a token without
 * `profile:read` (or refused) falls back to the key's own usage with a notice.
 */
export async function fetchConnectionBalance(
  creds: BalanceCredentials,
  fetchImpl: Fetch = defaultFetch,
  linkApiStatus?: LinkApiStatus,
): Promise<ConnectionBalanceResponse> {
  const source = connectionBalanceSource(creds);
  if (!source) return { balance: null };
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
  switch (source) {
    case "linkapi": {
      const status = linkApiStatus ?? (await readLinkApiStatus());
      let notice: ConnectionBalanceResponse["notice"];
      if (creds.balanceToken) {
        const userId = creds.balanceUserId?.trim();
        try {
          const json = await getJson(
            fetchImpl,
            `${LINKAPI_API_ORIGIN}/api/user/self`,
            { ...bearer(creds.balanceToken), ...(userId ? { "New-Api-User": userId } : {}) },
            "LinkAPI",
          );
          if (!isMissingPermission(json)) return { balance: parseLinkApiAccount(json, status) };
          notice = "linkapi_missing_profile_read";
        } catch (err) {
          if (!(err instanceof BalanceError) || (err.status !== 401 && err.status !== 403)) throw err;
          notice = "linkapi_token_rejected";
        }
      }
      if (!creds.apiKey) throw new BalanceError("Add an API key to read the LinkAPI balance");
      // The trailing slash matters: without it LinkAPI answers 301.
      const json = await getJson(fetchImpl, `${LINKAPI_API_ORIGIN}/api/usage/token/`, bearer(creds.apiKey), "LinkAPI");
      return { balance: parseLinkApiKeyUsage(json, status), ...(notice ? { notice } : {}) };
    }
    case "openrouter": {
      const json = await getJson(fetchImpl, "https://openrouter.ai/api/v1/key", bearer(creds.apiKey), "OpenRouter");
      return { balance: parseOpenRouterKey(json) };
    }
    case "deepseek": {
      const origin = originOf(creds.baseUrl, "https://api.deepseek.com");
      const json = await getJson(fetchImpl, `${origin}/user/balance`, bearer(creds.apiKey), "DeepSeek");
      return { balance: parseDeepSeekBalance(json) };
    }
    case "moonshot": {
      const origin = originOf(creds.baseUrl, "https://api.moonshot.ai");
      const json = await getJson(fetchImpl, `${origin}/v1/users/me/balance`, bearer(creds.apiKey), "Moonshot");
      return { balance: parseMoonshotBalance(json, origin.endsWith(".cn") ? "CNY" : "USD") };
    }
  }
}

const cache = new Map<string, { until: number; value: ConnectionBalanceResponse }>();

/** The balance of one Connection, kept 5 minutes; `refresh` asks again. */
export async function readConnectionBalance(
  key: string,
  creds: BalanceCredentials,
  refresh = false,
): Promise<ConnectionBalanceResponse> {
  const hit = cache.get(key);
  if (!refresh && hit && Date.now() < hit.until) return hit.value;
  const value = await fetchConnectionBalance(creds);
  cache.set(key, { until: Date.now() + BALANCE_TTL_MS, value });
  return value;
}

/** Drop a Connection's kept balance (its key or token changed). */
export const forgetConnectionBalance = (key: string) => cache.delete(key);

/** LinkAPI's price group of a Connection, from its last account balance read, without asking again. */
export function cachedLinkApiGroup(key: string | null | undefined): string | undefined {
  return key ? cache.get(key)?.value.balance?.group : undefined;
}
