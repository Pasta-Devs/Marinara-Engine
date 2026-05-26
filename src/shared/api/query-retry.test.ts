import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { ApiError, parseRetryAfterMs } from "./api-errors";
import { apiQueryRetryDelay, shouldRetryApiQuery } from "./query-retry";

async function countQueryAttempts(error: ApiError) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: (failureCount, queryError) => shouldRetryApiQuery(failureCount, queryError, { maxRetries: 10 }),
        retryDelay: 1,
      },
    },
  });
  let attempts = 0;
  try {
    await queryClient.fetchQuery({
      queryKey: ["query-retry", error.status, JSON.stringify(error.details ?? null)],
      queryFn: async () => {
        attempts += 1;
        throw error;
      },
    });
  } catch {
    // The final failed query is expected for retry policy tests.
  } finally {
    queryClient.clear();
  }
  return attempts;
}

describe("query retry policy", () => {
  it("does not retry 429 responses without Retry-After metadata", async () => {
    await expect(countQueryAttempts(new ApiError("Too Many Requests", 429))).resolves.toBe(1);
  });

  it("allows one delayed retry for 429 responses with Retry-After metadata", async () => {
    await expect(countQueryAttempts(new ApiError("Too Many Requests", 429, { retryAfterMs: 2500 }))).resolves.toBe(2);
    expect(apiQueryRetryDelay(0, new ApiError("Too Many Requests", 429, { retryAfterMs: 2500 }))).toBe(2500);
  });

  it("keeps normal transient retries and blocks unretryable client errors", async () => {
    await expect(countQueryAttempts(new ApiError("Gateway timeout", 504))).resolves.toBe(11);
    await expect(countQueryAttempts(new ApiError("Bad Request", 400))).resolves.toBe(1);
  });
});

describe("Retry-After parsing", () => {
  it("parses seconds and HTTP-date values", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-26T12:00:00Z"));

    expect(parseRetryAfterMs("2.5")).toBe(2500);
    expect(parseRetryAfterMs("Tue, 26 May 2026 12:00:05 GMT")).toBe(5000);

    vi.useRealTimers();
  });
});
