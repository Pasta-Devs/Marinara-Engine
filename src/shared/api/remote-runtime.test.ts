import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useUIStore } from "../stores/ui.store";
import { cancelRemoteLlmStream, checkRemoteRuntimeHealth, streamRemoteLlm } from "./remote-runtime";

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
  ])(
    "surfaces provider messages from remote stream error events for HTTP %s recovery",
    async (_scenario, message, status) => {
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
    },
  );

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

  it("reports blank remote runtime URLs as unconfigured web-shell state outside Tauri", async () => {
    await expect(checkRemoteRuntimeHealth("  ")).resolves.toEqual({
      status: "unconfigured",
      message: "Remote Runtime URL is required in web-shell mode.",
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports blank remote runtime URLs as embedded runtime state inside Tauri", async () => {
    vi.stubGlobal("__TAURI_INTERNALS__", {});

    await expect(checkRemoteRuntimeHealth("  ")).resolves.toEqual({
      status: "unconfigured",
      message: "Embedded Tauri runtime in use.",
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("checks remote health with normalized URL and reverse-proxy auth", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true, runtime: "marinara-server", writable: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify([]), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );

    await expect(checkRemoteRuntimeHealth("https://user:pass@example.com/runtime///")).resolves.toEqual({
      status: "ok",
      message: "Remote runtime is online and storage is writable.",
      health: { ok: true, runtime: "marinara-server", writable: true },
    });

    expect(fetchMock).toHaveBeenNthCalledWith(1, "https://example.com/runtime/health", {
      method: "GET",
      headers: {
        Authorization: "Basic dXNlcjpwYXNz",
        accept: "application/json",
        "X-Marinara-CSRF": "1",
      },
      signal: undefined,
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://example.com/runtime/api/invoke",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Basic dXNlcjpwYXNz",
          "content-type": "application/json",
        }),
      }),
    );
  });

  it("does not report ready when health passes but invoke auth fails", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true, runtime: "marinara-server", writable: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ code: "authentication_required" }), {
          status: 401,
          headers: { "content-type": "application/json" },
        }),
      );

    await expect(checkRemoteRuntimeHealth("http://user:pass@runtime.local:8787")).resolves.toEqual({
      status: "unreachable",
      message: "Remote runtime health is reachable, but API invoke returned 401.",
      health: { ok: true, runtime: "marinara-server", writable: true },
    });
  });

  it("reports a reachable runtime with unwritable storage", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ok: true, runtime: "marinara-server", writable: false }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    await expect(checkRemoteRuntimeHealth("http://127.0.0.1:8787")).resolves.toEqual({
      status: "not-writable",
      message: "Remote runtime is reachable, but its data storage is not writable.",
      health: { ok: true, runtime: "marinara-server", writable: false },
    });
  });

  it("reports invalid and unreachable remote runtimes", async () => {
    await expect(checkRemoteRuntimeHealth("http://[bad")).resolves.toEqual({
      status: "invalid",
      message: "Remote Runtime URL is invalid.",
    });

    fetchMock.mockRejectedValue(new TypeError("fetch failed"));

    await expect(checkRemoteRuntimeHealth("http://127.0.0.1:8787")).resolves.toEqual({
      status: "unreachable",
      message: "Remote runtime is unreachable.",
    });
  });
});
