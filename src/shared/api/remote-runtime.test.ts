import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "./api-errors";
import { apiQueryRetryDelay, shouldRetryApiQuery } from "./query-retry";
import { invokeRemote } from "./remote-runtime";
import { useUIStore } from "../stores/ui.store";

describe("remote runtime retry metadata", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    useUIStore.setState({ remoteRuntimeUrl: "" });
  });

  it("preserves Retry-After on 429 API errors for query retry handling", async () => {
    useUIStore.setState({ remoteRuntimeUrl: "http://runtime.example" });
    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify({ code: "rate_limited", message: "Too many requests" }), {
        headers: {
          "content-type": "application/json",
          "retry-after": "2",
        },
        status: 429,
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    let error: unknown;
    try {
      await invokeRemote("storage_list", { entity: "chats" });
    } catch (caught) {
      error = caught;
    }

    expect(fetchMock).toHaveBeenCalledWith(
      "http://runtime.example/api/invoke",
      expect.objectContaining({
        method: "POST",
      }),
    );
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      details: {
        code: "rate_limited",
        retryAfterMs: 2000,
      },
      status: 429,
    });
    expect(shouldRetryApiQuery(0, error)).toBe(true);
    expect(apiQueryRetryDelay(0, error)).toBe(2000);
  });
});
