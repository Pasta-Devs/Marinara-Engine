import { afterEach, describe, expect, it, vi } from "vitest";
import type { LlmChunk, LlmRequest } from "../../engine/capabilities/llm";
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

    expect(fetchMock).toHaveBeenCalledWith(
      "http://runtime.example/api/llm/stream",
      expect.objectContaining({ cache: "no-store", method: "POST" }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "http://runtime.example/api/llm/stream/stream-1/cancel",
      expect.objectContaining({ cache: "no-store", method: "POST" }),
    );
  });
});

describe("remote LLM stream events", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("yields SSE error events instead of throwing them", async () => {
    const target: RuntimeTarget = { baseUrl: "http://runtime.example" };
    const fetchMock = vi.fn(async () => {
      return new Response(
        'data: {"type":"error","code":"llm_provider_error","message":"Provider failed","data":{"safe":true}}\n\n',
        {
          headers: { "content-type": "text/event-stream" },
          status: 200,
        },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const stream = streamRemoteLlm("stream-1", {} as Parameters<typeof streamRemoteLlm>[1], target);

    await expect(stream.next()).resolves.toMatchObject({
      done: false,
      value: {
        type: "error",
        code: "llm_provider_error",
        message: "Provider failed",
        text: "Provider failed",
        data: { safe: true },
      },
    });
    await expect(stream.next()).resolves.toMatchObject({ done: true });
  });
});

const llmRequest: LlmRequest = {
  messages: [{ role: "user", content: "Hello" }],
};

async function collectLlmChunks(stream: AsyncGenerator<LlmChunk>): Promise<LlmChunk[]> {
  const chunks: LlmChunk[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return chunks;
}

async function loadMockedLlmApi() {
  const mocks = {
    cancelRemoteLlmStream: vi.fn(),
    invokeTauri: vi.fn(),
    remoteRuntimeTarget: vi.fn().mockReturnValue(null),
    streamRemoteLlm: vi.fn(),
  };

  vi.resetModules();
  vi.doMock("@tauri-apps/api/core", () => ({
    Channel: class<T> {
      private readonly handler: (event: T) => void;

      constructor(handler: (event: T) => void) {
        this.handler = handler;
      }

      send(event: T): void {
        this.handler(event);
      }
    },
  }));
  vi.doMock("./tauri-client", () => ({
    invokeTauri: mocks.invokeTauri,
  }));
  vi.doMock("./remote-runtime", () => ({
    cancelRemoteLlmStream: mocks.cancelRemoteLlmStream,
    remoteRuntimeTarget: mocks.remoteRuntimeTarget,
    streamRemoteLlm: mocks.streamRemoteLlm,
  }));

  const [{ ApiError: MockedApiError }, { llmApi }] = await Promise.all([import("./api-errors"), import("./llm-api")]);
  return { ApiError: MockedApiError, llmApi, mocks };
}

describe("embedded LLM stream events", () => {
  afterEach(() => {
    vi.doUnmock("@tauri-apps/api/core");
    vi.doUnmock("./tauri-client");
    vi.doUnmock("./remote-runtime");
    vi.resetModules();
  });

  it("yields a stream error chunk when the native stream command rejects", async () => {
    const { ApiError: MockedApiError, llmApi, mocks } = await loadMockedLlmApi();
    mocks.invokeTauri.mockImplementation((command: string) => {
      if (command === "llm_stream_channel") {
        return Promise.reject(
          new MockedApiError("Provider failed", 500, {
            code: "llm_provider_error",
            safe: true,
          }),
        );
      }
      return Promise.resolve(null);
    });

    await expect(collectLlmChunks(llmApi.stream(llmRequest))).resolves.toEqual([
      {
        type: "error",
        text: "Provider failed",
        data: {
          code: "llm_provider_error",
          message: "Provider failed",
          safe: true,
          status: 500,
        },
      },
    ]);
  });

  it("keeps cancellation as a thrown AbortError", async () => {
    const { llmApi, mocks } = await loadMockedLlmApi();
    const controller = new AbortController();
    controller.abort();
    mocks.invokeTauri.mockImplementation((command: string) => {
      if (command === "llm_stream_cancel") return Promise.resolve({ cancelled: true });
      return new Promise(() => {});
    });

    await expect(llmApi.stream(llmRequest, controller.signal).next()).rejects.toMatchObject({
      name: "AbortError",
    });
  });
});
