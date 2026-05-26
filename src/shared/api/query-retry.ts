import { ApiError, getApiErrorRetryAfterMs } from "./api-errors";

interface ApiQueryRetryOptions {
  maxRetries?: number;
}

interface ApiQueryRetryDelayOptions {
  baseDelayMs?: number;
  maxDelayMs?: number;
}

export function shouldRetryApiQuery(
  failureCount: number,
  error: unknown,
  options: ApiQueryRetryOptions = {},
): boolean {
  const maxRetries = options.maxRetries ?? 1;
  const status = error instanceof ApiError ? error.status : 0;

  if (status === 429) {
    return getApiErrorRetryAfterMs(error) !== null && failureCount < 1;
  }

  if (status >= 400 && status < 500 && status !== 408) {
    return false;
  }

  return failureCount < maxRetries;
}

export function apiQueryRetryDelay(
  attemptIndex: number,
  error: unknown,
  options: ApiQueryRetryDelayOptions = {},
): number {
  if (error instanceof ApiError && error.status === 429) {
    return getApiErrorRetryAfterMs(error) ?? 0;
  }

  const baseDelayMs = options.baseDelayMs ?? 1000;
  const maxDelayMs = options.maxDelayMs ?? 30_000;
  return Math.min(baseDelayMs * 2 ** attemptIndex, maxDelayMs);
}
