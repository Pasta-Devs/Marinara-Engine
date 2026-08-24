export const GAME_SETUP_GENERATION_TIMEOUT_MS = 500 * 1000;

export function resolveInitialGameGmConnectionId(
  explicitConnectionId: string | null | undefined,
  chatConnectionId: string | null | undefined,
): string | null {
  return explicitConnectionId || chatConnectionId || null;
}

export function formatInitialGameGmConnectionError(error: unknown): {
  statusCode: 400 | 401 | 429 | 502 | 504;
  message: string;
} {
  const details: string[] = [];
  const seen = new Set<object>();
  let current: unknown = error;

  while (current && typeof current === "object" && !seen.has(current) && seen.size < 5) {
    seen.add(current);
    const value = current as { name?: unknown; message?: unknown; code?: unknown; status?: unknown; cause?: unknown };
    for (const detail of [value.name, value.message, value.code, value.status]) {
      if (typeof detail === "string" || typeof detail === "number") details.push(String(detail));
    }
    current = value.cause;
  }

  const joined = details.join(" ").toLowerCase();
  if (/timed? out|timeout|etimedout|und_err_(connect|headers)_timeout/u.test(joined)) {
    return {
      statusCode: 504,
      message: "The GM connection timed out. Check the connection and try again.",
    };
  }
  if (/econnrefused|connection refused/u.test(joined)) {
    return {
      statusCode: 502,
      message:
        "The GM connection refused the request. Check that the provider is running and the connection URL is correct, then try again.",
    };
  }
  if (
    /fetch failed|bad port|enotfound|eai_again|enetunreach|ehostunreach|econnreset|err_invalid_url|und_err_connect/u.test(
      joined,
    )
  ) {
    return {
      statusCode: 502,
      message: "The GM connection could not be reached. Check the connection and try again.",
    };
  }
  if (
    /\b(?:401|403)\b|unauthori[sz]ed|forbidden|invalid api key|api key.*expired|expired.*api key|authentication/u.test(
      joined,
    )
  ) {
    return {
      statusCode: 401,
      message:
        "The GM provider rejected the configured credentials. Check the API key or account connection and try again.",
    };
  }
  if (/invalid model|unknown model|model.*(?:not found|does not exist|unavailable)/u.test(joined)) {
    return {
      statusCode: 400,
      message: "The selected GM model is unavailable. Check the connection's model and try again.",
    };
  }
  if (/\b429\b|rate.?limit|quota/u.test(joined)) {
    return {
      statusCode: 429,
      message: "The GM provider is rate-limited or out of quota. Check the provider account or try again later.",
    };
  }
  return {
    statusCode: 502,
    message: "The GM provider returned an error. Check the provider and model settings, then try again.",
  };
}
