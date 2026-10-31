// ──────────────────────────────────────────────
// Connection balance: which services report what is left on the account
// ──────────────────────────────────────────────

/** The services with a balance endpoint. Other Connections show no balance. */
export type ConnectionBalanceSource = "linkapi" | "openrouter" | "deepseek" | "moonshot" | "nanogpt" | "bifrost";

const hostOf = (url: string | null | undefined) => {
  try {
    return new URL((url ?? "").trim()).hostname.toLowerCase();
  } catch {
    return "";
  }
};
const onHost = (host: string, domain: string) => host === domain || host.endsWith(`.${domain}`);

/**
 * LinkAPI and Moonshot ride the custom provider, so their address names them. A Bifrost proxy is known by its
 * virtual key (`sk-bf-…`), so only the server, which holds the key, can tell; the list sends `balanceSource`.
 */
export function connectionBalanceSource(row: {
  provider: string;
  baseUrl?: string | null;
  apiKey?: string;
}): ConnectionBalanceSource | null {
  if (row.apiKey?.startsWith("sk-bf-")) return "bifrost";
  if (row.provider === "openrouter") return "openrouter";
  if (row.provider === "nanogpt") return "nanogpt";
  if (row.provider === "deepseek") return "deepseek";
  if (row.provider !== "custom") return null;
  const host = hostOf(row.baseUrl);
  if (onHost(host, "linkapi.ai")) return "linkapi";
  if (onHost(host, "moonshot.ai") || onHost(host, "moonshot.cn")) return "moonshot";
  if (onHost(host, "deepseek.com")) return "deepseek";
  return null;
}

/** LinkAPI's account balance takes a second, optional token (scope `profile:read`) and user id. */
export const takesBalanceToken = (row: { provider: string; baseUrl?: string | null }) =>
  connectionBalanceSource(row) === "linkapi";

/**
 * "via X" upstreams behind a proxy whose balance Marinara can read with a key of that upstream. Each reads only
 * from the upstream's own fixed address, never from the proxy's.
 */
export const UPSTREAM_BALANCE_TARGETS: Record<string, { provider: string; baseUrl: string; host: string }> = {
  nanogpt: { provider: "nanogpt", baseUrl: "https://nano-gpt.com/api/v1", host: "nano-gpt.com" },
  openrouter: { provider: "openrouter", baseUrl: "https://openrouter.ai/api/v1", host: "openrouter.ai" },
  deepseek: { provider: "deepseek", baseUrl: "https://api.deepseek.com", host: "api.deepseek.com" },
  moonshot: { provider: "custom", baseUrl: "https://api.moonshot.ai/v1", host: "api.moonshot.ai" },
  linkapi: { provider: "custom", baseUrl: "https://api.linkapi.ai/v1", host: "api.linkapi.ai" },
};

/** The balance source of a "via X" upstream, or null when X has no balance Marinara can read. */
export function upstreamBalanceSource(upstream: string): ConnectionBalanceSource | null {
  const target = Object.hasOwn(UPSTREAM_BALANCE_TARGETS, upstream) ? UPSTREAM_BALANCE_TARGETS[upstream] : undefined;
  return target ? connectionBalanceSource(target) : null;
}

/**
 * What the service says is left. Amounts are in `unit` (an ISO currency code such as USD or CNY, or "TOKENS").
 * `left` is null when the credential has no cap (an unlimited key, an OpenRouter key without a limit).
 */
export interface ConnectionBalance {
  source: ConnectionBalanceSource;
  /** "account": the whole account; "key": this API key's own allowance; "month": this key's use this month. */
  scope: "account" | "key" | "month";
  unit: string;
  left: number | null;
  used?: number;
  granted?: number;
  /** DeepSeek: granted vs topped-up balance; Moonshot: voucher vs cash balance. */
  parts?: Array<{ id: "granted" | "toppedUp" | "voucher" | "cash"; amount: number }>;
  requests?: number;
  /** LinkAPI: the account's price group, when the account balance reports it. */
  group?: string;
  checkedAt: string;
}

/** `GET /connection-accounts/:id/balance`. `balance` is null for a service without a balance endpoint. */
export interface ConnectionBalanceResponse {
  balance: ConnectionBalance | null;
  /** The dashboard token lacks LinkAPI's `profile:read` permission; the key's own usage shows instead. */
  notice?: "linkapi_missing_profile_read" | "linkapi_token_rejected";
}
