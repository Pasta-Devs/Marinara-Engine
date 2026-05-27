import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useUIStore } from "../stores/ui.store";
import { cancelRemoteLlmStream, streamRemoteLlm } from "./remote-runtime";

describe("remote LLM stream cancellation", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    useUIStore.getState().setRemoteRuntimeUrl("");
  });

  afterEach(() => {
    useUIStore.getState().setRemoteRuntimeUrl("");
    warn.mockRestore();
    vi.unstubAllGlobals();
  });

  it("does not attempt remote cancellation without a remote runtime target", async () => {
    await cancelRemoteLlmStream("stream-1", null);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });

  it("sends cancel requests to the remote stream endpoint", async () => {
    const streamTarget = { baseUrl: "http://127.0.0.1:8787" };
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await cancelRemoteLlmStream("stream/1", streamTarget);

    expect(fetchMock).toHaveBeenCalledWith("http://127.0.0.1:8787/api/llm/stream/stream%2F1/cancel", {
      method: "POST",
      headers: { "X-Marinara-CSRF": "1" },
    });
    expect(warn).not.toHaveBeenCalled();
  });

  it("uses the supplied stream target even if the remote runtime setting changes", async () => {
    const streamTarget = { baseUrl: "http://127.0.0.1:8787" };
    useUIStore.getState().setRemoteRuntimeUrl("http://127.0.0.1:9999");
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await cancelRemoteLlmStream("stream-4", streamTarget);

    expect(fetchMock).toHaveBeenCalledWith("http://127.0.0.1:8787/api/llm/stream/stream-4/cancel", {
      method: "POST",
      headers: { "X-Marinara-CSRF": "1" },
    });
    expect(warn).not.toHaveBeenCalled();
  });

  it("logs non-OK remote cancellation responses without throwing", async () => {
    const streamTarget = { baseUrl: "http://127.0.0.1:8787" };
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ message: "cancel route failed" }), {
        status: 500,
        headers: { "content-type": "application/json" },
      }),
    );

    await expect(cancelRemoteLlmStream("stream-2", streamTarget)).resolves.toBeUndefined();

    expect(warn).toHaveBeenCalledWith("[llm] Stream cancel failed", {
      area: "llm-stream-cancel",
      transport: "remote",
      streamId: "stream-2",
      error: {
        name: "ApiError",
        message: "cancel route failed",
        status: 500,
      },
    });
  });

  it("logs remote cancellation transport failures without throwing", async () => {
    const streamTarget = { baseUrl: "http://127.0.0.1:8787" };
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));

    await expect(cancelRemoteLlmStream("stream-3", streamTarget)).resolves.toBeUndefined();

    expect(warn).toHaveBeenCalledWith("[llm] Stream cancel failed", {
      area: "llm-stream-cancel",
      transport: "remote",
      streamId: "stream-3",
      error: {
        name: "TypeError",
        message: "fetch failed",
      },
    });
  });

  it.each([
    ["500", "fake provider 500", 500],
    ["429", "fake provider 429", 429],
  ])("surfaces provider messages from remote stream error events for HTTP %s recovery", async (_scenario, message, status) => {
    fetchMock.mockResolvedValue(
      new Response(
        `data: ${JSON.stringify({
          type: "error",
          code: "provider_error",
          message,
          data: { status },
        })}\n\n`,
        { status: 200, headers: { "content-type": "text/event-stream" } },
      ),
    );

    const consumeStream = async () => {
      for await (const _chunk of streamRemoteLlm(
        `stream-${status}`,
        { model: "marinara-fake", messages: [{ role: "user", content: "trigger provider failure" }] },
        { baseUrl: "http://127.0.0.1:8787" },
      )) {
        // The fake stream only emits an error event.
      }
    };

    await expect(consumeStream()).rejects.toMatchObject({
      message,
      status,
      details: {
        code: "provider_error",
      },
    });
  });

  it.each([
    ["text", { type: "error", text: "legacy text failure" }, "legacy text failure"],
    ["string data", { type: "error", data: "legacy data failure" }, "legacy data failure"],
  ])("keeps legacy remote stream %s error messages readable", async (_scenario, event, message) => {
    fetchMock.mockResolvedValue(
      new Response(`data: ${JSON.stringify(event)}\n\n`, {
        status: 200,
        headers: { "content-type": "text/event-stream" },
      }),
    );

    const consumeStream = async () => {
      for await (const _chunk of streamRemoteLlm(
        "stream-legacy",
        { model: "marinara-fake", messages: [{ role: "user", content: "trigger legacy failure" }] },
        { baseUrl: "http://127.0.0.1:8787" },
      )) {
        // The fake stream only emits an error event.
      }
    };

    await expect(consumeStream()).rejects.toMatchObject({
      message,
      status: 0,
    });
  });
});
