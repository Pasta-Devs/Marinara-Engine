import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LlmRequest } from "../../engine/capabilities/llm";
import { useUIStore } from "../stores/ui.store";
import { llmApi } from "./llm-api";
import { invokeTauri } from "./tauri-client";

vi.mock("./tauri-client", () => ({
  invokeTauri: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  Channel: class MockChannel<T> {
    constructor(readonly onmessage: (event: T) => void) {}
  },
}));

const request: LlmRequest = {
  messages: [{ role: "user", content: "hello" }],
};

function pendingCommand(): Promise<void> {
  return new Promise(() => undefined);
}

function sseChunk(event: unknown): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`);
}

describe("llmApi stream cancellation", () => {
  let warn: ReturnType<typeof vi.spyOn>;
  const invokeMock = vi.mocked(invokeTauri);

  beforeEach(() => {
    warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    useUIStore.getState().setRemoteRuntimeUrl("");
  });

  afterEach(() => {
    useUIStore.getState().setRemoteRuntimeUrl("");
    warn.mockRestore();
    invokeMock.mockReset();
    vi.unstubAllGlobals();
  });

  it("cancels remote streams against the target captured when streaming started", async () => {
    let streamController: ReadableStreamDefaultController<Uint8Array> | null = null;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        streamController = controller;
      },
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(stream, { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("crypto", { randomUUID: () => "llm-stream-fixed" });
    useUIStore.getState().setRemoteRuntimeUrl("http://127.0.0.1:8787");
    const controller = new AbortController();
    const iterator = llmApi.stream(request, controller.signal);

    const first = iterator.next();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    streamController!.enqueue(sseChunk({ type: "token", text: "hello" }));

    await expect(first).resolves.toMatchObject({
      done: false,
      value: { type: "token", text: "hello" },
    });

    const next = iterator.next();
    await Promise.resolve();
    useUIStore.getState().setRemoteRuntimeUrl("http://127.0.0.1:9999");
    controller.abort();

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock.mock.calls[1]).toEqual([
      "http://127.0.0.1:8787/api/llm/stream/llm-stream-fixed/cancel",
      {
        method: "POST",
        headers: { "X-Marinara-CSRF": "1" },
      },
    ]);

    streamController!.close();
    await expect(next).resolves.toMatchObject({ done: true });
  });

  it("logs local cancel command failures without changing abort behavior", async () => {
    invokeMock.mockImplementation((command) => {
      if (command === "llm_stream_channel") return pendingCommand();
      if (command === "llm_stream_cancel") {
        return Promise.reject(Object.assign(new Error("native cancel failed"), { status: 500 }));
      }
      return Promise.reject(new Error(`Unexpected command: ${command}`));
    });
    const controller = new AbortController();
    const iterator = llmApi.stream(request, controller.signal);

    const next = iterator.next();
    await Promise.resolve();
    controller.abort();

    await expect(next).rejects.toMatchObject({ name: "AbortError" });

    const cancelCall = invokeMock.mock.calls.find(([command]) => command === "llm_stream_cancel");
    expect(cancelCall).toBeDefined();
    const cancelArgs = cancelCall?.[1] as { streamId: string };

    expect(invokeMock).toHaveBeenCalledWith(
      "llm_stream_channel",
      expect.objectContaining({
        streamId: cancelArgs.streamId,
        request,
      }),
    );
    await vi.waitFor(() =>
      expect(warn).toHaveBeenCalledWith("[llm] Stream cancel failed", {
        area: "llm-stream-cancel",
        transport: "tauri",
        streamId: cancelArgs.streamId,
        error: {
          name: "Error",
          message: "native cancel failed",
          status: 500,
        },
      }),
    );
  });

  it("does not log when the local cancel command succeeds", async () => {
    invokeMock.mockImplementation((command) => {
      if (command === "llm_stream_channel") return pendingCommand();
      if (command === "llm_stream_cancel") return Promise.resolve();
      return Promise.reject(new Error(`Unexpected command: ${command}`));
    });
    const controller = new AbortController();
    const iterator = llmApi.stream(request, controller.signal);

    const next = iterator.next();
    await Promise.resolve();
    controller.abort();

    await expect(next).rejects.toMatchObject({ name: "AbortError" });
    await Promise.resolve();

    expect(invokeMock).toHaveBeenCalledWith("llm_stream_cancel", expect.objectContaining({ streamId: expect.any(String) }));
    expect(warn).not.toHaveBeenCalled();
  });
});
