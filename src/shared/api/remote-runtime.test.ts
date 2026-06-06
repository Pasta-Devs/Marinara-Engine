import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "./api-errors";
import { apiQueryRetryDelay, shouldRetryApiQuery } from "./query-retry";
import {
  cancelRemoteLlmStream,
  checkRemoteRuntimeHealth,
  invokeRemote,
  streamRemoteJsonEvents,
  streamRemoteLlm,
  type RuntimeTarget,
} from "./remote-runtime";
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

describe("remote runtime cache policy", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    useUIStore.setState({ remoteRuntimeUrl: "" });
  });

  it("uses no-store for health and invoke readiness probes", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true, runtime: "marinara-server", writable: true }), {
          headers: { "content-type": "application/json" },
          status: 200,
        }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await checkRemoteRuntimeHealth("http://runtime.example");

    expect(fetchMock).toHaveBeenCalledWith(
      "http://runtime.example/health?probe=1",
      expect.objectContaining({ cache: "no-store", method: "GET" }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "http://runtime.example/api/invoke",
      expect.objectContaining({ cache: "no-store", method: "POST" }),
    );
  });

  it("uses no-store for remote invoke calls", async () => {
    useUIStore.setState({ remoteRuntimeUrl: "http://runtime.example" });
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: "chat-1" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await invokeRemote("storage_get", { entity: "chats", id: "chat-1" });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://runtime.example/api/invoke",
      expect.objectContaining({ cache: "no-store", method: "POST" }),
    );
  });

  it("uses no-store for generic JSON event streams", async () => {
    useUIStore.setState({ remoteRuntimeUrl: "http://runtime.example" });
    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify({ code: "failed", message: "stream failed" }), {
        headers: { "content-type": "application/json" },
        status: 503,
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(streamRemoteJsonEvents("/api/import/st-bulk/run", { batchId: "batch-1" }).next()).rejects.toThrow(
      ApiError,
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "http://runtime.example/api/import/st-bulk/run",
      expect.objectContaining({ cache: "no-store", method: "POST" }),
    );
  });

  it("uses no-store for LLM stream and cancel calls", async () => {
    const target: RuntimeTarget = { baseUrl: "http://runtime.example" };
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const stream = streamRemoteLlm("stream-1", {} as Parameters<typeof streamRemoteLlm>[1], target);
    await stream.next();
    await cancelRemoteLlmStream("stream-1", target);
    await cancelRemoteLlmStream("stream-2", target, { keepalive: true });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://runtime.example/api/llm/stream",
      expect.objectContaining({ cache: "no-store", method: "POST" }),
    );
    const fetchCalls = fetchMock.mock.calls as unknown as Array<[string, RequestInit]>;
    const defaultCancelCall = fetchCalls.find(([url]) => url === "http://runtime.example/api/llm/stream/stream-1/cancel");
    const keepaliveCancelCall = fetchCalls.find(
      ([url]) => url === "http://runtime.example/api/llm/stream/stream-2/cancel",
    );

    expect(defaultCancelCall?.[1]).toEqual(expect.objectContaining({ cache: "no-store", method: "POST" }));
    expect(defaultCancelCall?.[1]).not.toHaveProperty("keepalive");
    expect(keepaliveCancelCall?.[1]).toEqual(
      expect.objectContaining({ cache: "no-store", method: "POST", keepalive: true }),
    );
  });

  it("cancels active LLM API remote streams on pagehide with keepalive", async () => {
    useUIStore.setState({ remoteRuntimeUrl: "http://runtime.example" });
    vi.stubGlobal("crypto", { randomUUID: () => "stream-unload" });
    const listeners = new Map<string, Array<(event: Event) => void>>();
    vi.stubGlobal("window", {
      addEventListener: vi.fn((type: string, listener: (event: Event) => void) => {
        listeners.set(type, [...(listeners.get(type) ?? []), listener]);
      }),
    });

    let streamController!: ReadableStreamDefaultController<Uint8Array>;
    const streamBody = new ReadableStream<Uint8Array>({
      start(controller) {
        streamController = controller;
        controller.enqueue(new TextEncoder().encode('data: {"type":"start"}\n\n'));
      },
    });
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "http://runtime.example/api/llm/stream") {
        return new Response(streamBody, {
          headers: { "content-type": "text/event-stream" },
          status: 200,
        });
      }
      if (url === "http://runtime.example/api/llm/stream/stream-unload/cancel") {
        return new Response("{}", { status: 200 });
      }
      return new Response("not found", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const { llmApi } = await import("./llm-api");

    const stream = llmApi.stream({ messages: [] });
    await expect(stream.next()).resolves.toEqual({ done: false, value: { type: "start" } });
    for (const listener of listeners.get("pagehide") ?? []) {
      listener(new Event("pagehide"));
    }

    const fetchCalls = fetchMock.mock.calls as unknown as Array<[RequestInfo | URL, RequestInit | undefined]>;
    const cancelCall = fetchCalls.find(
      ([url]) => String(url) === "http://runtime.example/api/llm/stream/stream-unload/cancel",
    );
    expect(cancelCall?.[1]).toEqual(expect.objectContaining({ cache: "no-store", keepalive: true, method: "POST" }));

    streamController.close();
    await stream.return(undefined);
  });
});
